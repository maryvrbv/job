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
  daily     people and robots per day, last 60 days
  countries, devices, pages
  hosts     people per site (marydis.com and gitverse)
  reading   per page: people who opened it, scroll marks 25/50/75/100 and read marks 30 s/1/2/5 min
  tags      every link tag (from=<tag> in letters, CVs and cover letters), last 90 days: people, robots,
            visits and time of people, first and last visit, cities, what people did, and the same
            reading table for that tag alone
  recent    the last 3 days visit by visit: each person with time (Moscow), city, device, the link tag
            or the site they came from (direct visits too), and every page they read: time, scroll, read marks;
            robots only as a count per tag
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
d30, d60 = ago(29), ago(59)


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
    if r["date"] >= d60 and kind(r["customEvent:visitor_id"]) != "unknown":
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
snap["hosts"] = count_by("hostname")

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

# the last 3 days, visit by visit. GA reports hours in the property's zone (Europe/Helsinki), Masha reads Moscow time
HEL, MSK = ZoneInfo("Europe/Helsinki"), ZoneInfo("Europe/Moscow")
d3 = ago(2)
hours = [r for r in rep(["customEvent:visitor_id", "dateHour", "sessionSource", "customEvent:link_tag", "city", "deviceCategory"],
                        ["sessions", "userEngagementDuration"], SITE, start=day(d3)) if r["customEvent:visitor_id"] not in me]
pages = [r for r in rep(["customEvent:visitor_id", "hostname", "pagePath"], ["userEngagementDuration", "screenPageViews"], SITE, start=day(d3))
         if r["customEvent:visitor_id"] not in me]
marks = defaultdict(lambda: {"scroll": 0, "read": 0})
for r in events:
    if r["date"] >= d3:
        m = marks[(r["customEvent:visitor_id"], r["hostname"], r["pagePath"])]
        if r["eventName"] == "scroll_depth":
            m["scroll"] = max(m["scroll"], int(num(r["customEvent:scroll_percent"])))
        elif r["eventName"] == "read_time":
            m["read"] = max(m["read"], int(num(r["customEvent:read_seconds"])))
recent, robots = {}, defaultdict(set)
for r in sorted(hours, key=lambda r: r["dateHour"]):
    v, k = r["customEvent:visitor_id"], kind(r["customEvent:visitor_id"])
    if k != "person":
        if k == "robot":
            robots[tag_of(r) or r["sessionSource"]].add(v)
        continue
    h = r["dateHour"]
    at = datetime(int(h[:4]), int(h[4:6]), int(h[6:8]), int(h[8:]), tzinfo=HEL).astimezone(MSK).strftime("%Y-%m-%d %H:00")
    g = recent.setdefault(v, {"first": at, "last": at, "city": "", "device": r["deviceCategory"], "tag": "", "source": "",
                              "sessions": 0, "seconds": 0})
    g["last"] = at
    g["sessions"] += int(r["sessions"]); g["seconds"] += int(num(r["userEngagementDuration"]))
    if r["city"] != "(not set)":
        g["city"] = g["city"] or r["city"]
    g["tag"] = g["tag"] or tag_of(r)
    if g["source"] in ("", "(direct)", "(not set)"):  # a real referrer beats a direct visit
        g["source"] = r["sessionSource"]
for v, g in recent.items():
    g["pages"] = sorted(({"host": r["hostname"], "path": r["pagePath"], "seconds": int(num(r["userEngagementDuration"])),
                          "views": int(r["screenPageViews"]), **marks[(v, r["hostname"], r["pagePath"])]}
                         for r in pages if r["customEvent:visitor_id"] == v), key=lambda p: -p["seconds"])
snap["recent"] = {"from": day(d3), "people": len(recent), "robots": sum(len(x) for x in robots.values()),
                  "robot_tags": sorted(([t, len(x)] for t, x in robots.items()), key=lambda x: -x[1]),
                  "visits": sorted(recent.values(), key=lambda g: g["last"], reverse=True)}
print(json.dumps(snap, ensure_ascii=False, separators=(",", ":")))
