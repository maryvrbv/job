"""Portfolio visits from Google Analytics, squeezed into one small snapshot for the app.

Runs inside the Composio remote workbench (COMPOSIO_REMOTE_WORKBENCH), where `run_composio_tool`
reaches Google Analytics through Masha's connection; there are no GA keys anywhere else.
Paste the whole file as code_to_execute: it prints one line of JSON, which Claude writes to
Supabase (`portfolio_stats`, id 'snapshot') with ingest/stats_to_sql.py.

Masha herself. Whoever opened a draft of the home page is her checking the site; those visitors are left out.

People and robots. Link previews and safe-link scanners (LinkedIn and Outlook on Azure, Google, AWS)
open every link: they load the page, sometimes wait (so read_time fires), but never scroll or click.
A visitor counts as a person once they scroll (scroll_depth) or click anything on the site; the rest are robots.
Visits without a visitor id (before 14 October, or blocked) can't be told apart and are counted as unknown.

What is in the snapshot (sites marydis.com and mariadis.gitverse.site, no draft home pages, last 30 days
unless said otherwise; robots left out everywhere except the robot counts):
  totals    people, robots, unknown, people's visits, views and average visit
  daily     people and robots per day, last 90 days
  countries, devices, pages
  periods   the same totals, plus people and robots per site, countries, devices and the reading table,
            for the last 3, 7, 30 and 90 days: the period switch in the app reads these
  reading   per page: people who opened it, scroll marks 25/50/75/100 and read marks 30 s/1/2/5 min
  tags      every link tag (from=<tag> in letters, CVs and cover letters), last 90 days: people, robots,
            visits and time of people, first and last visit, cities, what people did, and the same
            reading table for that tag alone
  history   the last 3 days as a feed, one entry per visitor per hour (Moscow time): person or robot, which visitor
            and which of their visits it is, city, device, the link tag or the site they came from (direct visits
            too), and every page opened in that hour with time, scroll and read marks
  guests    for every person in the history: the browser mark that tells it is the same visitor (visitor_id,
            a random number the site keeps in the browser), first visit, and all their days in the last 90 days:
            visits, time, link tags and sources, city, device, pages with time and scroll
"""
import json
from collections import defaultdict
from datetime import datetime
from zoneinfo import ZoneInfo

P, ACC = "properties/555639250", "google_analytics_bat-bases"
HOST = {"filter": {"fieldName": "hostname", "stringFilter": {"matchType": "FULL_REGEXP", "value": "marydis\\.com|mariadis\\.gitverse\\.site"}}}
# drafts of the home page (index-orbit-h.html, index-v3.html, …) and mistyped paths: only Masha opens these
DRAFT = r"/index-[^e].*|/index-e[^n].*|.*-v[0-9]+\.html|.*(geologica|manrope|prata|classic|orbit).*|/[^a-z/].*"
NODRAFT = {"notExpression": {"filter": {"fieldName": "pagePath", "stringFilter": {"matchType": "FULL_REGEXP", "value": DRAFT}}}}
SITE = {"andGroup": {"expressions": [HOST, NODRAFT]}}
TEST_TAGS = {"test", "claude-check", "verify"}
HUMAN_EVENTS = {"scroll_depth", "case_open", "cv_click", "email_click", "linkedin_click", "telegram_click", "deck_open",
                "file_download", "lang_switch", "next_case", "research_open", "back_click", "click"}
SCROLL_MARKS, READ_MARKS = ["25", "50", "75", "100"], ["30", "60", "120", "300"]


def rep(dims, mets, filt, start="90daysAgo", limit=25000):
    args = {"property": P, "dateRanges": [{"startDate": start, "endDate": "today"}], "dimensions": [{"name": d} for d in dims],
            "metrics": [{"name": m} for m in mets], "dimensionFilter": filt, "limit": limit}
    r, e = run_composio_tool("GOOGLE_ANALYTICS_RUN_REPORT", args, account=ACC)  # noqa: F821 (workbench helper)
    if e:
        raise Exception(e)
    return [dict(zip(dims + mets, [x["value"] for x in row["dimensionValues"]] + [x["value"] for x in row["metricValues"]]))
            for row in r["data"].get("rows", [])]


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0


def day(d):
    return f"{d[:4]}-{d[4:6]}-{d[6:]}"


def tag_of(row):
    t = row.get("customEvent:link_tag", "")
    if t in ("", "(not set)", "(none)"):
        t = row.get("sessionSource", "")
    return "" if t in ("", "(not set)", "(none)", "(direct)") or t in TEST_TAGS or "." in t or t in ("google", "bing", "yandex") else t


def mark(v, marks):
    v = str(int(num(v))) if num(v) else ""
    return v if v in marks else ""


visits = rep(["customEvent:visitor_id", "date", "hostname", "sessionSource", "customEvent:link_tag", "city", "country", "deviceCategory"],
             ["sessions", "userEngagementDuration"], SITE)
events = rep(["customEvent:visitor_id", "date", "hostname", "pagePath", "eventName", "customEvent:scroll_percent", "customEvent:read_seconds"],
             ["eventCount"], SITE)

NOID = ("", "(not set)")
# whoever opened a draft page is Masha herself checking the site: her visits are left out entirely
drafts = {"andGroup": {"expressions": [HOST, {"filter": {"fieldName": "pagePath", "stringFilter": {"matchType": "FULL_REGEXP", "value": DRAFT}}}]}}
me = {r["customEvent:visitor_id"] for r in rep(["customEvent:visitor_id"], ["eventCount"], drafts)} - set(NOID)
visits = [r for r in visits if r["customEvent:visitor_id"] not in me]
events = [r for r in events if r["customEvent:visitor_id"] not in me]
human = {r["customEvent:visitor_id"] for r in events if r["eventName"] in HUMAN_EVENTS and r["customEvent:visitor_id"] not in NOID}
kind = lambda v: "unknown" if v in NOID else "person" if v in human else "robot"

today = max(r["date"] for r in visits)
from datetime import date, timedelta
def ago(n):
    t = date(int(today[:4]), int(today[4:6]), int(today[6:])) - timedelta(days=n)
    return t.strftime("%Y%m%d")
d30, d90 = ago(29), ago(89)


def reading_table(evs, people):
    """per page: people who opened it, and how many times they passed each scroll and read mark"""
    t = defaultdict(lambda: {"users": set(), **{"s" + m: 0 for m in SCROLL_MARKS}, **{"r" + m: 0 for m in READ_MARKS}})
    for r in evs:
        v = r["customEvent:visitor_id"]
        if v not in people:
            continue
        g = t[(r["hostname"], r["pagePath"])]
        if r["eventName"] == "page_view":
            g["users"].add(v)
        elif r["eventName"] == "scroll_depth" and mark(r["customEvent:scroll_percent"], SCROLL_MARKS):
            g["s" + mark(r["customEvent:scroll_percent"], SCROLL_MARKS)] += int(r["eventCount"])
        elif r["eventName"] == "read_time" and mark(r["customEvent:read_seconds"], READ_MARKS):
            g["r" + mark(r["customEvent:read_seconds"], READ_MARKS)] += int(r["eventCount"])
    rows = [{"host": h, "path": p, **{**g, "users": len(g["users"])}} for (h, p), g in t.items() if g["users"]]
    return sorted(rows, key=lambda x: -x["users"])


# totals, daily, countries, devices: last 30 (60 for the chart) days
v30 = [r for r in visits if r["date"] >= d30]
people30 = {r["customEvent:visitor_id"] for r in v30 if kind(r["customEvent:visitor_id"]) == "person"}
sess = sum(int(r["sessions"]) for r in v30 if r["customEvent:visitor_id"] in people30)
secs = sum(num(r["userEngagementDuration"]) for r in v30 if r["customEvent:visitor_id"] in people30)
e30 = [r for r in events if r["date"] >= d30]
snap = {"totals": {
    "me": len(me),
    "people": len(people30),
    "robots": len({r["customEvent:visitor_id"] for r in v30 if kind(r["customEvent:visitor_id"]) == "robot"}),
    "unknown_visits": sum(int(r["sessions"]) for r in v30 if kind(r["customEvent:visitor_id"]) == "unknown"),
    "sessions": sess, "views": sum(int(r["eventCount"]) for r in e30 if r["eventName"] == "page_view" and r["customEvent:visitor_id"] in people30),
    "avg_session": round(secs / sess) if sess else 0}}

daily = defaultdict(lambda: {"people": set(), "robots": set()})
for r in visits:
    if r["date"] >= d90 and kind(r["customEvent:visitor_id"]) != "unknown":
        daily[day(r["date"])]["people" if kind(r["customEvent:visitor_id"]) == "person" else "robots"].add(r["customEvent:visitor_id"])
snap["daily"] = [{"day": k, "people": len(v["people"]), "robots": len(v["robots"])} for k, v in sorted(daily.items())]


def count_by(field):
    c = defaultdict(set)
    for r in v30:
        if r["customEvent:visitor_id"] in people30:
            c[r[field]].add(r["customEvent:visitor_id"])
    return sorted(([k, len(v)] for k, v in c.items()), key=lambda x: -x[1])


snap["countries"] = count_by("country")[:10]
snap["devices"] = count_by("deviceCategory")
snap["reading"] = reading_table(e30, people30)[:15]


def period(n):
    """everything the period switch shows, for the last n days: people and robots per site counted per site"""
    since = ago(n - 1)
    vs, es = [r for r in visits if r["date"] >= since], [r for r in events if r["date"] >= since]
    who = {r["customEvent:visitor_id"] for r in vs}
    ppl = {v for v in who if kind(v) == "person"}
    s_ = sum(int(r["sessions"]) for r in vs if r["customEvent:visitor_id"] in ppl)
    t_ = sum(num(r["userEngagementDuration"]) for r in vs if r["customEvent:visitor_id"] in ppl)
    sites = defaultdict(lambda: {"people": set(), "robots": set()})
    for r in vs:
        k = kind(r["customEvent:visitor_id"])
        if k != "unknown":
            sites[r["hostname"]]["people" if k == "person" else "robots"].add(r["customEvent:visitor_id"])

    def by(field):
        c = defaultdict(set)
        for r in vs:
            if r["customEvent:visitor_id"] in ppl:
                c[r[field]].add(r["customEvent:visitor_id"])
        return sorted(([k, len(v)] for k, v in c.items()), key=lambda x: -x[1])
    return {"totals": {"people": len(ppl), "robots": len({v for v in who if kind(v) == "robot"}),
                       "unknown_visits": sum(int(r["sessions"]) for r in vs if kind(r["customEvent:visitor_id"]) == "unknown"),
                       "sessions": s_, "avg_session": round(t_ / s_) if s_ else 0},
            "sites": sorted(([h, len(g["people"]), len(g["robots"])] for h, g in sites.items()), key=lambda x: x[0] != "marydis.com"),
            "countries": by("country")[:10], "devices": by("deviceCategory"), "reading": reading_table(es, ppl)[:15]}


snap["periods"] = {str(n): period(n) for n in (3, 7, 30, 90)}

# link tags, 90 days
tags = {}
for r in visits:
    t = tag_of(r)
    if not t:
        continue
    v, k = r["customEvent:visitor_id"], kind(r["customEvent:visitor_id"])
    g = tags.setdefault(t, {"tag": t, "people": set(), "robots": set(), "unknown": 0, "sessions": 0, "seconds": 0, "first": "9999",
                            "last": "", "cities": set()})
    g["seen"] = max(g.get("seen", ""), day(r["date"]))
    if k == "unknown":
        g["unknown"] += int(r["sessions"])
        continue
    g[k + "s" if k == "robot" else "people"].add(v)
    if k == "person":
        g["sessions"] += int(r["sessions"]); g["seconds"] += int(num(r["userEngagementDuration"]))
        g["first"] = min(g["first"], day(r["date"])); g["last"] = max(g["last"], day(r["date"]))
        if r["city"] != "(not set)":
            g["cities"].add(r["city"])
out = []
for g in tags.values():
    did = defaultdict(int)
    for r in events:
        if r["customEvent:visitor_id"] in g["people"] and r["eventName"] in HUMAN_EVENTS - {"scroll_depth"}:
            did[r["eventName"]] += int(r["eventCount"])
    out.append({"tag": g["tag"], "people": len(g["people"]), "robots": len(g["robots"]), "unknown": g["unknown"],
                "sessions": g["sessions"], "seconds": g["seconds"], "first": g["first"] if g["people"] else "", "last": g["last"], "seen": g["seen"],
                "cities": sorted(g["cities"]), "did": dict(did), "reading": reading_table(events, g["people"])[:8]})
snap["tags"] = sorted(out, key=lambda g: (g["people"] > 0, g["seen"]), reverse=True)

# the last 3 days as a feed. GA reports hours in the property's zone (Europe/Helsinki), Masha reads Moscow time
HEL, MSK = ZoneInfo("Europe/Helsinki"), ZoneInfo("Europe/Moscow")
d3 = ago(2)
V = "customEvent:visitor_id"
hours = [r for r in rep([V, "dateHour", "sessionSource", "customEvent:link_tag", "city", "deviceCategory"],
                        ["sessions", "userEngagementDuration"], SITE, start=day(d3)) if r[V] not in me and r[V] not in NOID]
pages = [r for r in rep([V, "dateHour", "hostname", "pagePath"], ["userEngagementDuration", "screenPageViews"], SITE, start=day(d3))
         if r[V] not in me]
marks = defaultdict(lambda: {"scroll": 0, "read": 0})
for r in rep([V, "dateHour", "hostname", "pagePath", "eventName", "customEvent:scroll_percent", "customEvent:read_seconds"],
             ["eventCount"], SITE, start=day(d3)):
    m = marks[(r[V], r["dateHour"], r["hostname"], r["pagePath"])]
    if r["eventName"] == "scroll_depth":
        m["scroll"] = max(m["scroll"], int(num(r["customEvent:scroll_percent"])))
    elif r["eventName"] == "read_time":
        m["read"] = max(m["read"], int(num(r["customEvent:read_seconds"])))
entries, guests, seen = {}, {}, defaultdict(int)
for r in sorted(hours, key=lambda r: r["dateHour"]):
    v, h = r[V], r["dateHour"]
    e = entries.get((v, h))
    if not e:
        guests.setdefault(v, len(guests) + 1)
        seen[v] += 1
        at = datetime(int(h[:4]), int(h[4:6]), int(h[6:8]), int(h[8:]), tzinfo=HEL).astimezone(MSK).strftime("%Y-%m-%d %H:00")
        e = entries[(v, h)] = {"at": at, "who": "person" if kind(v) == "person" else "robot", "guest": guests[v], "visit": seen[v],
                               "city": "", "device": r["deviceCategory"], "tag": "", "source": "", "seconds": 0}
    e["seconds"] += int(num(r["userEngagementDuration"]))
    if r["city"] != "(not set)":
        e["city"] = e["city"] or r["city"]
    e["tag"] = e["tag"] or tag_of(r)
    if e["source"] in ("", "(direct)", "(not set)"):  # a real referrer beats a direct visit
        e["source"] = r["sessionSource"]
for (v, h), e in entries.items():
    e["pages"] = sorted(({"host": r["hostname"], "path": r["pagePath"], "seconds": int(num(r["userEngagementDuration"])),
                          **marks[(v, h, r["hostname"], r["pagePath"])]}
                         for r in pages if r[V] == v and r["dateHour"] == h), key=lambda p: -p["seconds"])
snap["history"] = {"from": day(d3), "people": len({k[0] for k, e in entries.items() if e["who"] == "person"}),
                   "robots": len({k[0] for k, e in entries.items() if e["who"] == "robot"}),
                   "entries": sorted(entries.values(), key=lambda e: e["at"], reverse=True)}
# every person in the history, day by day over 90 days: the app shows this when a guest is tapped
keys = {}
for (v, _), e in entries.items():
    if e["who"] == "person":
        keys[v] = e["guest"]
gpages = [r for r in rep([V, "date", "hostname", "pagePath"], ["userEngagementDuration"], SITE) if r[V] in keys] if keys else []
gscroll = defaultdict(int)
for r in events:
    if r[V] in keys and r["eventName"] == "scroll_depth":
        k = (r[V], r["date"], r["hostname"], r["pagePath"])
        gscroll[k] = max(gscroll[k], int(num(r["customEvent:scroll_percent"])))
guests = {}
for v, n in keys.items():
    days = defaultdict(lambda: {"sessions": 0, "seconds": 0, "tags": set(), "sources": set(), "city": "", "device": ""})
    for r in visits:
        if r[V] == v:
            g = days[r["date"]]
            g["sessions"] += int(r["sessions"]); g["seconds"] += int(num(r["userEngagementDuration"]))
            if tag_of(r):
                g["tags"].add(tag_of(r))
            elif r["sessionSource"] not in ("(not set)",):
                g["sources"].add(r["sessionSource"])
            g["city"] = g["city"] or ("" if r["city"] == "(not set)" else r["city"])
            g["device"] = g["device"] or r["deviceCategory"]
    out = []
    for d_, g in sorted(days.items(), reverse=True):
        out.append({"day": day(d_), "sessions": g["sessions"], "seconds": g["seconds"], "tags": sorted(g["tags"]), "sources": sorted(g["sources"]),
                    "city": g["city"], "device": g["device"],
                    "pages": sorted(({"host": r["hostname"], "path": r["pagePath"], "seconds": int(num(r["userEngagementDuration"])),
                                      "scroll": gscroll[(v, d_, r["hostname"], r["pagePath"])]} for r in gpages if r[V] == v and r["date"] == d_),
                                    key=lambda p: -p["seconds"])})
    guests[str(n)] = {"mark": v, "first": out[-1]["day"] if out else "", "days": out}
snap["guests"] = guests
print(json.dumps(snap, ensure_ascii=False, separators=(",", ":")))
