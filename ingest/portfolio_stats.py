"""Portfolio visits from Google Analytics, squeezed into one small snapshot for the app.

Runs inside the Composio remote workbench (COMPOSIO_REMOTE_WORKBENCH), where `run_composio_tool`
reaches Google Analytics through Masha's connection; there are no GA keys anywhere else.
Paste the whole file as code_to_execute: it prints one line of JSON, which Claude writes to
Supabase (`portfolio_stats`, id 'snapshot') with the usual chr(59) escaping.

What is in the snapshot (sites marydis.com and mariadis.gitverse.site, no draft home pages):
  daily     users per day and site, last 90 days
  sites     users, sessions, views, engagement and average session per site, last 30 days
  countries, devices, pages   last 30 days
  tags      every link tag (from=<tag> in the portfolio links of letters and CVs): visitors, sessions,
            time on site, first and last visit, cities, devices, what they did (pages, cases opened,
            CV and contact clicks, deepest scroll, longest read)
"""
import json

P, ACC = "properties/555639250", "google_analytics_bat-bases"
HOST = {"filter": {"fieldName": "hostname", "stringFilter": {"matchType": "FULL_REGEXP", "value": "marydis\\.com|mariadis\\.gitverse\\.site"}}}
NODRAFT = {"notExpression": {"filter": {"fieldName": "pagePath", "stringFilter": {"matchType": "FULL_REGEXP", "value": ".*-v[0-9]+\\.html|.*(geologica|manrope|prata|classic).*"}}}}
TAGGED = {"orGroup": {"expressions": [
    {"filter": {"fieldName": "sessionMedium", "stringFilter": {"matchType": "EXACT", "value": "link"}}},
    {"filter": {"fieldName": "customEvent:link_tag", "stringFilter": {"matchType": "FULL_REGEXP", "value": "[A-Za-z0-9].*"}}}]}}
SITE = {"andGroup": {"expressions": [HOST, NODRAFT]}}
TEST_TAGS = {"test", "claude-check", "verify"}
EVENTS = ["page_view", "scroll_depth", "read_time", "case_open", "cv_click", "email_click", "linkedin_click",
          "telegram_click", "deck_open", "file_download", "research_open"]


def rep(dims, mets, filt, start="30daysAgo", limit=10000):
    args = {"property": P, "dateRanges": [{"startDate": start, "endDate": "today"}], "dimensions": [{"name": d} for d in dims],
            "metrics": [{"name": m} for m in mets], "dimensionFilter": filt, "limit": limit}
    r, e = run_composio_tool("GOOGLE_ANALYTICS_RUN_REPORT", args, account=ACC)  # noqa: F821 (workbench helper)
    if e:
        raise Exception(e)
    return [dict(zip(dims + mets, [x["value"] for x in row["dimensionValues"]] + [x["value"] for x in row["metricValues"]]))
            for row in r["data"].get("rows", [])]


def num(x):
    try:
        return round(float(x), 2)
    except (TypeError, ValueError):
        return 0


def day(d):
    return f"{d[:4]}-{d[4:6]}-{d[6:]}"


def tag_of(row):
    t = row.get("customEvent:link_tag", "")
    if t in ("", "(not set)", "(none)"):
        t = row.get("sessionSource", "")
    return "" if t in ("", "(not set)", "(none)", "(direct)") or t in TEST_TAGS else t


snap = {
    "daily": [{"day": day(r["date"]), "host": r["hostname"], "users": int(r["activeUsers"])}
              for r in rep(["date", "hostname"], ["activeUsers"], SITE, "90daysAgo")],
    "sites": [{"host": r["hostname"], "users": int(r["activeUsers"]), "sessions": int(r["sessions"]), "views": int(r["screenPageViews"]),
               "engagement": num(r["engagementRate"]), "avg_session": num(r["averageSessionDuration"])}
              for r in rep(["hostname"], ["activeUsers", "sessions", "screenPageViews", "engagementRate", "averageSessionDuration"], SITE)],
    "countries": sorted(({"country": r["country"], "users": int(r["activeUsers"])} for r in rep(["country"], ["activeUsers"], SITE)),
                        key=lambda x: -x["users"])[:12],
    "devices": [{"device": r["deviceCategory"], "users": int(r["activeUsers"])} for r in rep(["deviceCategory"], ["activeUsers"], SITE)],
    "pages": sorted(({"host": r["hostname"], "path": r["pagePath"], "users": int(r["activeUsers"]), "views": int(r["screenPageViews"])}
                     for r in rep(["hostname", "pagePath"], ["activeUsers", "screenPageViews"], SITE)), key=lambda x: -x["users"])[:15],
}

tags = {}
for r in rep(["customEvent:visitor_id", "sessionSource", "customEvent:link_tag", "city", "deviceCategory", "date"],
             ["sessions", "userEngagementDuration"], TAGGED, "90daysAgo"):
    t = tag_of(r)
    if not t:
        continue
    g = tags.setdefault(t, {"tag": t, "visitors": set(), "sessions": 0, "seconds": 0, "first": "9999", "last": "", "cities": set(),
                            "devices": set(), "events": {}, "pages": {}, "scroll": 0, "read": 0})
    if r["customEvent:visitor_id"] not in ("", "(not set)"):
        g["visitors"].add(r["customEvent:visitor_id"])
    g["sessions"] += int(r["sessions"]); g["seconds"] += int(num(r["userEngagementDuration"]))
    g["first"] = min(g["first"], day(r["date"])); g["last"] = max(g["last"], day(r["date"]))
    if r["city"] != "(not set)":
        g["cities"].add(r["city"])
    g["devices"].add(r["deviceCategory"])

ev_filter = {"andGroup": {"expressions": [TAGGED, HOST, {"filter": {"fieldName": "eventName", "inListFilter": {"values": EVENTS}}}]}}
for r in rep(["sessionSource", "customEvent:link_tag", "pagePath", "eventName", "customEvent:scroll_percent", "customEvent:read_seconds"],
             ["eventCount"], ev_filter, "90daysAgo"):
    g = tags.get(tag_of(r))
    if not g:
        continue
    n, e = int(r["eventCount"]), r["eventName"]
    g["events"][e] = g["events"].get(e, 0) + n
    if e == "page_view":
        g["pages"][r["pagePath"]] = g["pages"].get(r["pagePath"], 0) + n
    g["scroll"] = max(g["scroll"], int(num(r["customEvent:scroll_percent"])))
    g["read"] = max(g["read"], int(num(r["customEvent:read_seconds"])))

snap["tags"] = sorted(({**g, "visitors": len(g["visitors"]) or 1, "cities": sorted(g["cities"]), "devices": sorted(g["devices"]),
                        "pages": sorted(g["pages"].items(), key=lambda x: -x[1])[:6]} for g in tags.values()),
                      key=lambda g: g["last"], reverse=True)
print(json.dumps(snap, ensure_ascii=False, separators=(",", ":")))
