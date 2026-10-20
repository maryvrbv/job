"""hh.ru without Apify: reads the public search and vacancy pages (the JSON state hh embeds in them).

The official API answers 403 to anonymous vacancy search, but the site itself is open.

    python3 ingest/hh.py search            # remote vacancies for the queries below, newest first, as JSON
                                           # (ruble ranges topping out under MIN_RUB are dropped)
    python3 ingest/hh.py details 138221309 # description, salary, experience, format, closed flag, as JSON

Prints JSON to stdout; writing to Supabase stays with Claude (MCP), so no keys are needed here.
"""
import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

QUERIES = ["продуктовый дизайнер", "product designer", "UX/UI дизайнер", "UX дизайнер"]
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
MAX_PAGES = 3
# Masha's floor in Russia: a vacancy whose whole range in rubles is below it is skipped and never stored
MIN_RUB = 270_000
RUB_PER = {"RUR": 1, "USD": 80, "EUR": 90}  # rough on purpose: only clearly lower ranges should drop
EXPERIENCE = {"noExperience": "нет", "between1And3": "1–3", "between3And6": "3–6", "moreThan6": "6+"}
FORMATS = {"REMOTE": "удалёнка", "HYBRID": "гибрид", "ON_SITE": "офис", "FIELD_WORK": "разъездной"}
# companies Masha does not want back (former employers and the like); matched in lower case
SKIP_COMPANIES = {"digital chief"}


def fetch_state(url):
    for attempt in range(3):
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "ru"})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                page = r.read().decode("utf-8")
            break
        except urllib.error.HTTPError as e:
            # hh answers 403/429 to bursts of requests; back off and retry
            if e.code not in (403, 429) or attempt == 2:
                raise
            time.sleep(10 * (attempt + 1))
    m = re.search(r'<template[^>]*id="HH-Lux-InitialState"[^>]*>(.*?)</template>', page, re.S)
    if not m:
        raise RuntimeError("no page state at " + url + " (captcha?)")
    return json.loads(html.unescape(m.group(1)))


def salary(c):
    if not c or c.get("noCompensation"):
        return ""
    lo, hi = c.get("from"), c.get("to")
    cur = {"RUR": "₽", "USD": "$", "EUR": "€"}.get(c.get("currencyCode"), c.get("currencyCode") or "")
    k = lambda n: f"{round(n / 1000)}k"
    tax = " gross" if c.get("gross") else " net"
    if lo and hi:
        return f"{k(lo)}–{k(hi)} {cur}{tax}" if lo != hi else f"{k(lo)} {cur}{tax}"
    return (f"от {k(lo)} {cur}" if lo else f"до {k(hi)} {cur}") + tax if (lo or hi) else ""


def below_floor(c):
    """True only when the range has a known top under MIN_RUB in rubles; "от X" alone or no salary passes."""
    rate = RUB_PER.get((c or {}).get("currencyCode"))
    if not c or c.get("noCompensation") or not rate:
        return False
    top = c.get("to")
    return bool(top) and top * rate < MIN_RUB


def formats(raw):
    flat = []
    for f in raw or []:
        flat += f.get("workFormatsElement", [f]) if isinstance(f, dict) else [f]
    return ", ".join(FORMATS.get(f, f) for f in flat)


def search():
    jobs, skipped = {}, set()
    for q in QUERIES:
        for page in range(MAX_PAGES):
            params = {"text": q, "area": "113", "schedule": "remote", "search_field": "name",
                      "order_by": "publication_time", "items_on_page": "100", "page": str(page)}
            res = fetch_state("https://hh.ru/search/vacancy?" + urllib.parse.urlencode(params))["vacancySearchResult"]
            for v in res.get("vacancies", []):
                vid = str(v["vacancyId"])
                company = (v.get("company") or {}).get("visibleName") or (v.get("company") or {}).get("name", "")
                if below_floor(v.get("compensation")) or company.lower() in SKIP_COMPANIES:
                    skipped.add(vid)
                    continue
                jobs.setdefault(vid, {
                    "id": "hh:" + vid,
                    "url": "https://hh.ru/vacancy/" + vid,
                    "title": v.get("name", ""),
                    "company": company,
                    "salary": salary(v.get("compensation")),
                    "experience": EXPERIENCE.get(v.get("workExperience"), ""),
                    "work_format": formats(v.get("workFormats")),
                    "posted_at": ((v.get("publicationTime") or {}).get("$") or "")[:10],
                    "applicants": str(v.get("responsesCount") or v.get("totalResponsesCount") or ""),
                })
            paging = res.get("paging") or {}
            if not paging.get("next"):
                break
            time.sleep(1)
        time.sleep(1)
    print(f"skipped {len(skipped)}: below {MIN_RUB // 1000}k RUB or a skipped company", file=sys.stderr)
    return sorted(jobs.values(), key=lambda j: j["posted_at"], reverse=True)


def details(vid):
    v = fetch_state("https://hh.ru/vacancy/" + vid)["vacancyView"]["vacancyFull"]["vacancy"]
    text = re.sub(r"<(br|/p|/li|/h\d)[^>]*>", "\n", v.get("description") or "")
    text = re.sub(r"<li[^>]*>", "• ", text)
    text = html.unescape(re.sub(r"<[^>]+>", "", text))
    text = re.sub(r"\n\s*\n+", "\n\n", text).strip()
    return {
        "id": "hh:" + vid,
        "title": v.get("name", ""),
        "company": (v.get("company") or {}).get("visibleName") or (v.get("company") or {}).get("name", ""),
        "salary": salary(v.get("compensation")),
        "experience": EXPERIENCE.get(v.get("workExperience"), ""),
        "work_format": formats(v.get("workFormats")),
        "posted_at": (v.get("publicationTimeIso") or "")[:10],
        "closed": bool(v.get("closedForApplicants")) or v.get("status", {}).get("archived", False) is True,
        "description": text,
    }


if __name__ == "__main__":
    cmd, args = (sys.argv[1], sys.argv[2:]) if len(sys.argv) > 1 else ("", [])
    if cmd == "search":
        out = search()
    elif cmd == "details" and args:
        out = []
        for a in args:
            try:
                out.append(details(a.removeprefix("hh:")))
            except Exception as e:  # one bad page should not lose the rest
                out.append({"id": "hh:" + a.removeprefix("hh:"), "error": str(e)})
            time.sleep(2)
    else:
        sys.exit(__doc__)
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
