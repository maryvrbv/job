"""Daily vacancy ingest: LinkedIn (UAE) + hh.ru (Russia, remote) -> Claude scoring -> Supabase.

Runs from GitHub Actions. Only inserts vacancies that are not in the database yet,
so statuses, letters and feedback in the app are never overwritten.
"""

import html
import json
import os
import re
import sys
import time
from pathlib import Path

import anthropic
import requests

APIFY_TOKEN = os.environ["APIFY_TOKEN"]
SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL") or "claude-opus-5-5"
LOOKBACK_HOURS = int(os.environ.get("LOOKBACK_HOURS") or 48)
APIFY_BUDGET_USD = os.environ.get("APIFY_BUDGET_USD") or "0.5"

PROFILE = (Path(__file__).parent / "profile.md").read_text(encoding="utf-8")

LINKEDIN_ACTOR = "curious_coder~linkedin-jobs-scraper"
HH_ACTOR = "abotapi~hh-ru-jobs-scraper"
LINKEDIN_QUERIES = ["Product Designer", "UX UI Designer", "UX Designer"]
HH_QUERIES = ["продуктовый дизайнер", "product designer", "UX/UI дизайнер", "UX дизайнер"]

# Titles that are clearly not digital product design; saves Claude calls
TITLE_KEEP = re.compile(r"design|дизайн|ux|ui\b|product", re.I)
TITLE_DROP = re.compile(
    r"graphic|motion|interior|fashion|wear|footwear|3d|cad|mechanical|engineer|wayfinding|packaging|"
    r"game|gamedev|instructional|multimedia|social media|intern|trainee|стаж|junior|младший|"
    r"графическ|моушн|интерьер|игров|веб-студ|web-дизайнер",
    re.I,
)

session = requests.Session()


def log(msg: str) -> None:
    print(msg, flush=True)


# ---------- Apify ----------

def run_actor(actor: str, payload: dict) -> list[dict]:
    """Start an actor run, wait for it, return its dataset items."""
    params = {"token": APIFY_TOKEN, "maxTotalChargeUsd": APIFY_BUDGET_USD}
    run = session.post(f"https://api.apify.com/v2/acts/{actor}/runs", params=params, json=payload, timeout=60)
    run.raise_for_status()
    run = run.json()["data"]
    run_id, dataset = run["id"], run["defaultDatasetId"]
    for _ in range(90):  # up to ~15 minutes
        time.sleep(10)
        status = session.get(f"https://api.apify.com/v2/actor-runs/{run_id}", params={"token": APIFY_TOKEN}, timeout=30).json()["data"]["status"]
        if status not in ("READY", "RUNNING"):
            break
    log(f"{actor}: {status}")
    items = session.get(f"https://api.apify.com/v2/datasets/{dataset}/items", params={"token": APIFY_TOKEN, "clean": "1"}, timeout=120)
    items.raise_for_status()
    return items.json()


def work_format(text: str) -> str:
    t = text.lower()
    found = []
    if re.search(r"\bremote\b|work from home|удал[её]н", t):
        found.append("удалёнка")
    if re.search(r"hybrid|гибрид", t):
        found.append("гибрид")
    if re.search(r"on-?site|in[- ]office|office-based|офис", t):
        found.append("офис")
    return ", ".join(found) or "не указан"


def fetch_linkedin() -> list[dict]:
    seconds = LOOKBACK_HOURS * 3600
    urls = [
        "https://www.linkedin.com/jobs/search/?keywords=" + requests.utils.quote(q)
        + f"&location=United%20Arab%20Emirates&geoId=104305776&f_TPR=r{seconds}"
        for q in LINKEDIN_QUERIES
    ]
    items = run_actor(LINKEDIN_ACTOR, {"urls": urls, "limitPerSource": 100, "scrapeCompany": False})
    jobs = {}
    for it in items:
        jid = str(it.get("id") or "")
        if not jid:
            continue
        desc = (it.get("descriptionText") or "").strip()
        jobs[f"li:{jid}"] = {
            "id": f"li:{jid}",
            "market": "uae",
            "url": f"https://www.linkedin.com/jobs/view/{jid}",
            "title": it.get("title") or "",
            "company": it.get("companyName") or "",
            "city": (it.get("location") or "").split(",")[0],
            "work_format": work_format(f"{it.get('title', '')} {desc}"),
            "posted_at": (it.get("postedAt") or "")[:10] or None,
            "applicants": "200+" if str(it.get("applicantsCount")) == "200" else str(it.get("applicantsCount") or ""),
            "description": desc[:20000],
        }
    return list(jobs.values())


def hh_salary(it: dict) -> str:
    lo, hi, cur = it.get("salaryFrom"), it.get("salaryTo"), it.get("salaryCurrency") or ""
    if not lo and not hi:
        return ""
    k = lambda v: f"{int(v) // 1000}k" if cur == "RUR" else f"{int(v)}"
    unit = "" if cur == "RUR" else f" {cur}"
    gross = " gross" if it.get("salaryGross") else " net"
    if lo and hi:
        return f"{k(lo)}–{k(hi)}{unit}{gross}"
    return (f"от {k(lo)}" if lo else f"до {k(hi)}") + unit + gross


HH_FORMATS = {"REMOTE": "удалёнка", "HYBRID": "гибрид", "ON_SITE": "офис"}
HH_EXPERIENCE = {"noExperience": "без опыта", "between1And3": "1–3", "between3And6": "3–6", "moreThan6": "6+"}


def hh_description(vacancy_id: str) -> str:
    """hh.ru often blocks scrapers; its public API usually still answers. Best effort."""
    try:
        r = session.get(f"https://api.hh.ru/vacancies/{vacancy_id}", headers={"User-Agent": "job-tracker/1.0"}, timeout=20)
        if r.ok:
            text = re.sub(r"<[^>]+>", "\n", r.json().get("description") or "")
            return re.sub(r"\n\s*\n+", "\n\n", html.unescape(text)).strip()
    except requests.RequestException:
        pass
    return ""


def fetch_hh() -> list[dict]:
    items = run_actor(HH_ACTOR, {
        "mode": "search", "queries": HH_QUERIES, "searchField": "name", "areas": ["113"],
        "schedule": ["remote"], "experience": "any", "orderBy": "publication_time",
        "maxPages": 1, "maxListings": 150, "fetchDetails": True,
    })
    jobs = {}
    for it in items:
        vid = str(it.get("vacancyId") or "")
        if not vid:
            continue
        formats = ", ".join(HH_FORMATS.get(f, f) for f in (it.get("workFormats") or []))
        jobs[f"hh:{vid}"] = {
            "id": f"hh:{vid}",
            "market": "ru",
            "url": f"https://hh.ru/vacancy/{vid}",
            "title": it.get("name") or "",
            "company": (it.get("company") or {}).get("name") or "",
            "work_format": formats or "удалёнка",
            "salary": hh_salary(it),
            "experience": HH_EXPERIENCE.get(it.get("workExperience"), ""),
            "posted_at": (it.get("publicationDate") or "")[:10] or None,
            "applicants": str(it.get("totalResponsesCount") or ""),
            "description": (it.get("descriptionText") or "").strip()[:20000],
        }
    return list(jobs.values())


# ---------- Supabase ----------

def sb_headers(extra: dict | None = None) -> dict:
    h = {"apikey": SUPABASE_KEY}
    if SUPABASE_KEY.startswith("eyJ"):  # legacy service_role JWT; new sb_secret_ keys go in apikey only
        h["Authorization"] = f"Bearer {SUPABASE_KEY}"
    return h | (extra or {})


def existing_ids(ids: list[str]) -> set[str]:
    found = set()
    for i in range(0, len(ids), 80):
        chunk = ",".join(f'"{x}"' for x in ids[i:i + 80])
        r = session.get(f"{SUPABASE_URL}/rest/v1/jobs", params={"select": "id", "id": f"in.({chunk})"}, headers=sb_headers(), timeout=30)
        r.raise_for_status()
        found |= {row["id"] for row in r.json()}
    return found


def insert_jobs(rows: list[dict]) -> None:
    if not rows:
        return
    r = session.post(
        f"{SUPABASE_URL}/rest/v1/jobs", params={"on_conflict": "id"}, json=rows, timeout=60,
        headers=sb_headers({"Prefer": "resolution=ignore-duplicates,return=minimal", "Content-Type": "application/json"}),
    )
    if not r.ok:
        log(r.text)
    r.raise_for_status()


# ---------- Claude scoring ----------

SCORE_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "fit": {"type": "string", "enum": ["Высокий", "Средний", "Низкий", "Не подходит"]},
                    "domain": {"type": "string"},
                    "level": {"type": "string", "enum": ["Junior", "Middle", "Senior", "Lead", "—"]},
                    "why": {"type": "string"},
                },
                "required": ["id", "fit", "domain", "level", "why"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["items"],
    "additionalProperties": False,
}

SCORE_INSTRUCTIONS = """Оцени, насколько каждая вакансия подходит кандидату. Для каждой верни:
- fit: «Высокий» — продуктовый/UX-дизайн уровня Middle+ и выше в финтехе, банках, телекоме, e-commerce, суперапах, крупных B2C; «Средний» — продуктовый дизайн, но домен или уровень дальше от опыта; «Низкий» — джуниор, явно низкая зарплата, сомнительная компания; «Не подходит» — не цифровой продуктовый дизайн (графика, маркетинг, моушн, интерьер, разработка, менеджмент).
- domain: сфера по-русски, 1–3 слова.
- level: уровень роли.
- why: одно короткое предложение по-русски, обращаясь к кандидату на «ты»: почему подходит или что смущает.
Опирайся только на факты о кандидате."""


def score(jobs: list[dict], client: anthropic.Anthropic) -> dict[str, dict]:
    results: dict[str, dict] = {}
    for i in range(0, len(jobs), 15):
        batch = jobs[i:i + 15]
        listing = "\n\n".join(
            f"ID: {j['id']}\nНазвание: {j['title']}\nКомпания: {j['company']}\nРынок: {'ОАЭ' if j['market'] == 'uae' else 'Россия, удалёнка'}\n"
            f"Формат: {j.get('work_format', '')}\nЗарплата: {j.get('salary', '')}\nОпыт: {j.get('experience', '')}\n"
            f"Описание: {j.get('description', '')[:2500] or '(нет)'}"
            for j in batch
        )
        try:
            resp = client.beta.messages.create(
                model=CLAUDE_MODEL,
                max_tokens=16000,
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
                output_config={"effort": "low", "format": {"type": "json_schema", "schema": SCORE_SCHEMA}},
                system=PROFILE,
                messages=[{"role": "user", "content": f"{SCORE_INSTRUCTIONS}\n\nВакансии:\n\n{listing}"}],
            )
        except anthropic.APIError as e:
            log(f"scoring batch {i // 15} failed: {e}")
            continue
        if resp.stop_reason == "refusal":
            log(f"scoring batch {i // 15} refused")
            continue
        text = next((b.text for b in resp.content if b.type == "text"), "")
        try:
            for item in json.loads(text)["items"]:
                results[item["id"]] = item
        except (json.JSONDecodeError, KeyError) as e:
            log(f"scoring batch {i // 15}: bad JSON ({e})")
    return results


def main() -> int:
    fetched = []
    for name, fn in (("LinkedIn", fetch_linkedin), ("hh.ru", fetch_hh)):
        try:
            got = fn()
            log(f"{name}: {len(got)} fetched")
            fetched += got
        except Exception as e:  # one source failing must not stop the other
            log(f"{name} failed: {e}")

    candidates = [j for j in fetched if TITLE_KEEP.search(j["title"]) and not TITLE_DROP.search(j["title"])]
    known = existing_ids([j["id"] for j in candidates])
    new = [j for j in candidates if j["id"] not in known]
    log(f"{len(candidates)} design titles, {len(new)} new")
    if not new:
        return 0

    for j in new:
        if j["market"] == "ru" and not j.get("description"):
            j["description"] = hh_description(j["id"].split(":", 1)[1])

    scores = score(new, anthropic.Anthropic())
    rows = []
    for j in new:
        s = scores.get(j["id"])
        if not s or s["fit"] == "Не подходит":
            continue
        # bulk inserts need the same keys on every row
        base = {"city": "", "work_format": "", "salary": "", "experience": "", "applicants": "", "description": "", "posted_at": None}
        rows.append(base | j | {"fit": s["fit"], "domain": s["domain"], "level": s["level"], "why": s["why"]})
    insert_jobs(rows)
    log(f"inserted {len(rows)} vacancies ({sum(r['fit'] == 'Высокий' for r in rows)} high fit)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
