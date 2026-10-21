"""LinkedIn without Apify: the public "guest" job search and job pages that linkedin.com/jobs uses when signed out.

    python3 ingest/linkedin.py search 108000   # UAE vacancies posted in the last N seconds, as JSON
    python3 ingest/linkedin.py details 4469454345 4479998034   # description, level, applicants, closed flag

Prints JSON to stdout; writing to Supabase stays with Claude (MCP), so no keys are needed here.
LinkedIn rate-limits guests (HTTP 429): requests are spaced out and retried a few times.
"""
import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

GEO_UAE = "104305776"
# Exact phrases: a broad "designer" query brings engineers, BIM and marketing (tested 17.10)
QUERIES = ['"product designer"', '"UI/UX designer"', '"UX/UI designer"', '"staff designer"', '"principal designer"']
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
PAGE = 10        # the guest search returns 10 cards per request
# The guest search treats quoted phrases loosely and brings engineers, architects and graphic designers.
# Titles are filtered here; what passes still gets Claude's own judgement.
KEEP = re.compile(r"product design|\bux\b|\bui\b|ui/ux|ux/ui|uiux|user experience|experience design|interaction design|"
                  r"design lead|lead designer|head of design|design manager|design director|staff designer|principal designer|"
                  r"service design|design system", re.I)
DROP = re.compile(r"graphic|interior|landscape|fashion|apparel|womenswear|couture|motion|video|"
                  r"3d|packaging|wayfinding|facade|façade|mep\b|bim\b|structural|automotive|industrial designer|"
                  r"brand designer|creative designer|multimedia|content|marketing|nationals only|uae national|emirati|"
                  r"intern\b|trainee|graduate|junior|expert opportunity", re.I)
# engineering words drop a title only when it is not a designer's: "Senior UX/UI Designer – Developer Handover" stays
NOT_DESIGN = re.compile(r"architect|engineer|developer|front-?end|full.?stack", re.I)
DESIGNER = re.compile(r"designer", re.I)


def keep(title):
    return bool(KEEP.search(title)) and not DROP.search(title) and not (NOT_DESIGN.search(title) and not DESIGNER.search(title))
MAX_PER_QUERY = 100


def get(url):
    for attempt in range(4):
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en"})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            if e.code == 400 and "seeMoreJobPostings" in url:
                return ""  # past the last page
            if e.code != 429 or attempt == 3:
                raise
            time.sleep(5 * (attempt + 1))
    return ""


def text(fragment):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", fragment or ""))).strip()


def first(rx, s):
    m = re.search(rx, s, re.S)
    return m.group(1) if m else ""


def search(seconds):
    jobs = {}
    for q in QUERIES:
        for start in range(0, MAX_PER_QUERY, PAGE):
            params = {"keywords": q, "geoId": GEO_UAE, "f_TPR": f"r{seconds}", "start": start}
            page = get("https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?" + urllib.parse.urlencode(params))
            cards = page.split("<li")[1:]
            for c in cards:
                jid = first(r"urn:li:jobPosting:(\d+)", c)
                title = text(first(r'base-search-card__title">(.*?)</h3>', c))
                if not jid or not keep(title):
                    continue
                jobs.setdefault(jid, {
                    "id": "li:" + jid,
                    "url": "https://www.linkedin.com/jobs/view/" + jid,
                    "title": title,
                    "company": text(first(r'base-search-card__subtitle">(.*?)</h4>', c)),
                    "location": text(first(r'job-search-card__location">(.*?)</span>', c)),
                    "salary": text(first(r'job-search-card__salary-info">(.*?)</span>', c)),
                    "posted_at": first(r'datetime="([^"]+)"', c),
                    "query": q,
                })
            if len(cards) < PAGE:
                break
            time.sleep(1.5)
        time.sleep(1.5)
    return sorted(jobs.values(), key=lambda j: j["posted_at"], reverse=True)


def details(jid):
    s = get("https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/" + jid)
    criteria = {text(k): text(v) for k, v in re.findall(
        r'description__job-criteria-subheader">(.*?)</h3>\s*<span[^>]*>(.*?)</span>', s, re.S)}
    body = first(r'show-more-less-html__markup[^>]*>(.*?)</div>', s)
    body = re.sub(r"<(br|/p|/li|/h\d)[^>]*>", "\n", body)
    body = re.sub(r"<li[^>]*>", "• ", body)
    body = html.unescape(re.sub(r"<[^>]+>", "", body))
    body = re.sub(r"[ \t]+", " ", re.sub(r"\n\s*\n+", "\n\n", body)).strip()
    applicants = text(first(r'num-applicants__caption[^>]*>(.*?)</', s))
    return {
        "id": "li:" + jid,
        "title": text(first(r'top-card-layout__title[^>]*>(.*?)</h', s)),
        "company": text(first(r'topcard__org-name-link[^>]*>(.*?)</a>', s)),
        "level": criteria.get("Seniority level", ""),
        "employment": criteria.get("Employment type", ""),
        "industries": criteria.get("Industries", ""),
        "salary": text(first(r'compensation__salary[^>]*>(.*?)</', s)),
        "applicants": re.sub(r"\D", "", applicants) + ("+" if "Over" in applicants else ""),
        "closed": "No longer accepting applications" in s,
        "description": body,
    }


if __name__ == "__main__":
    cmd, args = (sys.argv[1], sys.argv[2:]) if len(sys.argv) > 1 else ("", [])
    if cmd == "search":
        out = search(int(args[0]) if args else 86400)
    elif cmd == "details" and args:
        out = []
        for a in args:
            try:
                out.append(details(a.removeprefix("li:")))
            except Exception as e:  # one bad page should not lose the rest
                out.append({"id": "li:" + a.removeprefix("li:"), "error": str(e)})
            time.sleep(1.5)
    else:
        sys.exit(__doc__)
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
