"""Company career sites in the UAE, read through the public job APIs of their hiring systems.

Strong UAE companies post on their own sites first; LinkedIn gets the same vacancy days or weeks later,
or never. These boards are open JSON (Greenhouse, Ashby, Lever, SmartRecruiters), so no keys are needed.

    python3 ingest/careers.py search            # design roles in the UAE across COMPANIES, newest first, as JSON
    python3 ingest/careers.py details <id> ...  # description for co:<source>:<company>:<job id>, as JSON

Ids are co:<source>:<board>:<job id>, so details knows where to look. Prints JSON to stdout;
writing to Supabase stays with Claude (MCP), so no keys are needed here.
"""
import html
import json
import re
import sys
import time
import urllib.error
import urllib.request

# (name shown in the app, hiring system, board name). Checked 20.10: these boards answer and carry UAE roles.
COMPANIES = [
    ("Careem", "greenhouse", "careem"),
    ("Tamara", "greenhouse", "tamara"),
    ("Deliveroo", "greenhouse", "deliveroo"),
    ("OKX", "greenhouse", "okx"),
    ("Binance", "greenhouse", "binance"),
    ("Ziina", "ashby", "ziina"),
    ("Checkout.com", "ashby", "checkout.com"),
    ("Lean Technologies", "ashby", "leantech"),
    ("Thndr", "ashby", "thndr"),
    ("Crypto.com", "lever", "crypto"),
    ("Delivery Hero / talabat", "smartrecruiters", "DeliveryHero"),
    ("Namshi", "smartrecruiters", "namshi"),
    ("Almosafer", "smartrecruiters", "almosafer"),
]
UAE = re.compile(r"dubai|abu dhabi|sharjah|united arab emirates|\buae\b|,\s*ae\b|\bae$", re.I)
KEEP = re.compile(r"design|\bux\b|\bui\b|user experience|interaction", re.I)
DROP = re.compile(r"graphic|brand|motion|video|creative|content|marketing|interior|fashion|packag|illustrat|3d|game"
                  r"|intern\b|junior|manager(?!.*design)|analyst|research(?!.*design)"
                  r"|operations|emirati|uae national", re.I)
# engineering words drop a title only when it is not a designer's ("Designer – Developer Handover" stays)
NOT_DESIGN = re.compile(r"engineer|developer|front-?end|full.?stack", re.I)
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      "Accept": "application/json"}


def get(url):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code not in (429, 500, 502, 503) or attempt == 2:
                raise
        except urllib.error.URLError:
            if attempt == 2:
                raise
        time.sleep(5 * (attempt + 1))


def plain(markup):
    text = re.sub(r"<(br|/p|/li|/h\d|/div)[^>]*>", "\n", markup or "")
    text = re.sub(r"<li[^>]*>", "• ", text)
    text = html.unescape(re.sub(r"<[^>]+>", "", text))
    return re.sub(r"\n\s*\n+", "\n\n", re.sub(r"[ \t]+", " ", text)).strip()


# each lister yields (job id, title, location, url, posted date)
def greenhouse(board):
    for j in get(f"https://boards-api.greenhouse.io/v1/boards/{board}/jobs")["jobs"]:
        yield str(j["id"]), j["title"], (j.get("location") or {}).get("name", ""), j["absolute_url"], \
            (j.get("first_published") or j.get("updated_at") or "")[:10]


def ashby(board):
    for j in get(f"https://api.ashbyhq.com/posting-api/job-board/{board}")["jobs"]:
        locs = [j.get("location", "")] + [s.get("location", "") for s in j.get("secondaryLocations") or []]
        yield j["id"], j["title"], " / ".join(filter(None, locs)) + (" (remote)" if j.get("isRemote") else ""), \
            j["jobUrl"], (j.get("publishedAt") or "")[:10]


def lever(board):
    for j in get(f"https://api.lever.co/v0/postings/{board}?mode=json"):
        cat = j.get("categories") or {}
        posted = time.strftime("%Y-%m-%d", time.gmtime(j["createdAt"] / 1000)) if j.get("createdAt") else ""
        yield j["id"], j["text"], " / ".join(cat.get("allLocations") or [cat.get("location", "")]), j["hostedUrl"], posted


def smartrecruiters(board):
    offset = 0
    while True:
        page = get(f"https://api.smartrecruiters.com/v1/companies/{board}/postings?limit=100&offset={offset}")
        for j in page["content"]:
            loc = j.get("location") or {}
            yield j["id"], j["name"], f'{loc.get("city", "")}, {loc.get("country", "")}', \
                f"https://jobs.smartrecruiters.com/{board}/{j['id']}", (j.get("releasedDate") or "")[:10]
        offset += 100
        if offset >= page["totalFound"] or offset >= 2000:
            break


LISTERS = {"greenhouse": greenhouse, "ashby": ashby, "lever": lever, "smartrecruiters": smartrecruiters}


def search():
    jobs = []
    for name, source, board in COMPANIES:
        try:
            for jid, title, loc, url, posted in LISTERS[source](board):
                if UAE.search(loc) and KEEP.search(title) and not DROP.search(title) \
                        and not (NOT_DESIGN.search(title) and "designer" not in title.lower()):
                    jobs.append({"id": f"co:{source}:{board}:{jid}", "company": name, "title": title.strip(),
                                 "location": loc, "url": url, "posted_at": posted})
        except Exception as e:  # one broken board should not lose the rest
            print(f"{name}: {e}", file=sys.stderr)
    return sorted(jobs, key=lambda j: j["posted_at"], reverse=True)


def details(cid):
    _, source, board, jid = cid.split(":", 3)
    if source == "greenhouse":
        j = get(f"https://boards-api.greenhouse.io/v1/boards/{board}/jobs/{jid}")
        desc = plain(html.unescape(j.get("content", "")))
    elif source == "ashby":
        j = next((x for x in get(f"https://api.ashbyhq.com/posting-api/job-board/{board}")["jobs"] if x["id"] == jid), None)
        if j is None:
            return {"id": cid, "closed": True, "description": ""}
        desc = j.get("descriptionPlain") or plain(j.get("descriptionHtml", ""))
    elif source == "lever":
        j = get(f"https://api.lever.co/v0/postings/{board}/{jid}")
        parts = [j.get("descriptionPlain", "")]
        for block in j.get("lists") or []:
            parts.append(block.get("text", "") + "\n" + plain(block.get("content", "")))
        parts.append(j.get("additionalPlain", ""))
        desc = "\n\n".join(p.strip() for p in parts if p.strip())
    else:
        j = get(f"https://api.smartrecruiters.com/v1/companies/{board}/postings/{jid}")
        sections = (j.get("jobAd") or {}).get("sections") or {}
        desc = "\n\n".join(plain(s.get("text", "")) for s in sections.values() if isinstance(s, dict) and s.get("text"))
    return {"id": cid, "closed": False, "description": desc}


if __name__ == "__main__":
    cmd, args = (sys.argv[1], sys.argv[2:]) if len(sys.argv) > 1 else ("", [])
    if cmd == "search":
        out = search()
    elif cmd == "details" and args:
        out = []
        for a in args:
            try:
                out.append(details(a))
            except urllib.error.HTTPError as e:
                out.append({"id": a, "closed": e.code == 404, "description": "", **({} if e.code == 404 else {"error": str(e)})})
            except Exception as e:  # one bad page should not lose the rest
                out.append({"id": a, "error": str(e)})
            time.sleep(1)
    else:
        sys.exit(__doc__)
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
