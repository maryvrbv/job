"""HireHi (hirehi.ru) without keys: reads the public design listings and vacancy pages.

HireHi gathers vacancies from hh, LinkedIn and company career sites. Most of them we already get
from hh.py / linkedin.py; the point is the ones posted only on company sites (2ГИС and the like).
Ids differ between boards, so match new ones against the base by company + title before writing.

    python3 ingest/hirehi.py search           # design vacancies in the UAE and remote in Russia,
                                              # product/UX titles only, newest first, as JSON
    python3 ingest/hirehi.py details 164672   # description and closed flag, as JSON

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

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
BASE = "https://hirehi.ru"
LISTINGS = [("uae", {"country": "UAE"}), ("ru", {"format": "удалённо по РФ"})]
MAX_PAGES = 6
KEEP = re.compile(r"product|продукт|ux|ui\b|interaction|experience design", re.I)
DROP = re.compile(r"графич|graphic|motion|моушн|video|видео|3d|game|игр|художник|artist|арт-|art director|brand|бренд"
                  r"|маркетплейс|packag|упаков|presentation|презентац|webflow|web-дизайн|web designer|photograph|фото"
                  r"|intern|стаж|junior|младш|сторис|stories", re.I)
# companies Masha does not want back (keep in sync with hh.py)
SKIP_COMPANIES = {"digital chief"}
# same floor as hh.py: a ruble range topping out under it is dropped
MIN_RUB = 270_000
RUB_PER = {"₽": 1, "$": 80, "€": 90}


def fetch(url):
    for attempt in range(3):
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "ru"})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if e.code not in (403, 429, 502, 503) or attempt == 2:
                raise
        except urllib.error.URLError:
            if attempt == 2:
                raise
        time.sleep(5 * (attempt + 1))


def text(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()


def below_floor(salary):
    """True only for a range with a known top under MIN_RUB; «от X» alone or no salary passes."""
    s = salary.replace(" ", " ")
    cur = next((c for c in RUB_PER if c in s), None)
    nums = [int(n.replace(" ", "")) for n in re.findall(r"\d[\d ]*\d|\d", s)]
    if not cur or not nums or s.strip().lower().startswith("от"):
        return False
    return max(nums) * RUB_PER[cur] < MIN_RUB


def cards(page):
    for c in re.findall(r'<a class="job-card"(.*?)</a>', page, re.S):
        get = lambda p: (re.search(p, c, re.S) or [None, ""])[1]
        tags = [text(t) for t in re.findall(r'<div class="job-tag[^"]*">(.*?)</div>', c, re.S)]
        yield {
            "hid": get(r'data-id="(\d+)"'),
            "href": get(r'href="([^"]+)"'),
            "company": text(get(r'job-company-name-text">(.*?)</span>')),
            "posted_at": get(r'data-date="([^"]+)"')[:10],
            "title": text(get(r'<div class="job-title">(.*?)</div>')),
            "salary": text(get(r'<span class="job-salary-value">(.*?)</span>')),
            "tags": tags,
        }


def search():
    jobs = {}
    for market, params in LISTINGS:
        for page in range(1, MAX_PAGES + 1):
            q = dict(params, **({"page": page} if page > 1 else {}))
            body = fetch(f"{BASE}/vacancies/design?" + urllib.parse.urlencode(q))
            found = list(cards(body or ""))
            if not found:
                break
            for c in found:
                title = c["title"][:1].upper() + c["title"][1:]
                title = re.sub(r"\b(ux|ui|ai|b2b|b2c|saas|fbo)\b", lambda m: m[1].upper(), title, flags=re.I)
                if not KEEP.search(title) or DROP.search(title) or c["company"].lower() in SKIP_COMPANIES:
                    continue
                salary = "" if c["salary"] == "зп не указана" else c["salary"]
                if market == "ru" and below_floor(salary):
                    continue
                level = next((t for t in c["tags"] if t.lower() in ("intern", "junior", "middle", "senior", "lead", "head")), "")
                if level.lower() in ("intern", "junior"):
                    continue
                fmt = next((t for t in c["tags"] if t != level), "")
                jobs["hr:" + c["hid"]] = {
                    "id": "hr:" + c["hid"], "market": market, "url": BASE + c["href"], "title": title,
                    "company": c["company"], "salary": salary, "level": level,
                    "work_format": "удалёнка" if "удал" in fmt else fmt, "posted_at": c["posted_at"],
                }
            time.sleep(1)
    return sorted(jobs.values(), key=lambda j: j["posted_at"], reverse=True)


def details(hid):
    page = fetch(f"{BASE}/design/x-{hid}")  # the slug is decorative, the id at the end decides
    if page is None:
        return {"id": "hr:" + hid, "closed": True, "description": ""}
    post = {}
    for block in re.findall(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', page, re.S):
        if '"JobPosting"' in block:
            post = json.loads(block)
    desc = re.sub(r"\n\s*\n+", "\n\n", text(post.get("description", ""))).strip()
    valid = post.get("validThrough") or ""
    return {
        "id": "hr:" + hid,
        "title": post.get("title", ""),
        "company": (post.get("hiringOrganization") or {}).get("name", ""),
        "posted_at": (post.get("datePosted") or "")[:10],
        "closed": bool(valid) and valid[:10] < time.strftime("%Y-%m-%d"),
        "description": desc,
    }


if __name__ == "__main__":
    cmd, args = (sys.argv[1], sys.argv[2:]) if len(sys.argv) > 1 else ("", [])
    if cmd == "search":
        out = search()
    elif cmd == "details" and args:
        out = []
        for a in args:
            try:
                out.append(details(a.removeprefix("hr:")))
            except Exception as e:  # one bad page should not lose the rest
                out.append({"id": "hr:" + a.removeprefix("hr:"), "error": str(e)})
            time.sleep(1)
    else:
        sys.exit(__doc__)
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
