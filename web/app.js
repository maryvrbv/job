const sb = window.supabase.createClient(window.JOB_CONFIG.supabaseUrl, window.JOB_CONFIG.supabaseAnonKey);

const MARKETS = [
  { key: "uae", label: "ОАЭ", short: "ОАЭ", lang: "en" },
  { key: "ru", label: "Россия, удалёнка", short: "РФ", lang: "ru" },
];
const TABS = [
  { key: "today", label: "Откликнуться сегодня" },
  { key: "process", label: "В процессе", process: true },
  ...MARKETS.map(m => ({ key: m.key, label: m.label, market: m.key })),
  { key: "applied-uae", label: "Отклики ОАЭ", market: "uae", applied: true },
  { key: "applied-ru", label: "Отклики РФ", market: "ru", applied: true },
  { key: "archive", label: "Архив", archive: true },
];
const FRESH_DAYS = 3, ARCHIVE_DAYS = 14;
// pipeline order matters: the funnel and the "where did it stop" logic read it
const STAGES = ["Откликнулась", "Скрининг с HR", "Собес с лидом", "Тестовое", "Финальный собес", "Оффер"];
// short stage names for the interface; the base keeps the full ones
const SHORT = { "Откликнулась": "Отклик", "Скрининг с HR": "HR", "Собес с лидом": "Команда", "Финальный собес": "Финал" };
const short = s => SHORT[s] || s;
const NEW = "Не откликалась", REJECT = "Отказ", SKIP = "Не подходит", RECRUITER = "Написала рекрутеру", CLOSED = "Отклики закрыты";
const ENDED = [SKIP, REJECT, CLOSED];
const SKIP_REASONS = ["Только офис без релокации", "Не мой домен", "Слишком джуниорская роль", "Низкая зарплата", "Нужен арабский", "Это агентство/аутстаф", "Уже откликалась раньше"];
// everything except the long description, which loads when the panel opens
const LIST_COLUMNS = "id,market,url,title,company,city,work_format,salary,experience,posted_at,applicants,domain,level,fit,why,status,applied_at,reject_stage,feedback,skip_reason,comment,letter,closed_at,updated_at,referral";
const CACHE_KEY = "jobs-cache-v1";

const state = { view: "jobs", tab: "today", jobs: [], sel: {}, loading: true, desc: {}, loadedAt: null };
try { const t = localStorage.getItem("tab"); if (TABS.some(s => s.key === t)) state.tab = t; } catch (e) {}
try { const v = localStorage.getItem("view"); if (["dash", "diary", "folio"].includes(v)) state.view = v; } catch (e) {}
try { const s = localStorage.getItem("sort"); if (s && document.querySelector(`#sort option[value="${s}"]`)) document.getElementById("sort").value = s; } catch (e) {}

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// a short note at the bottom; with an action (like «Отменить») it stays longer and carries a button
function toast(msg, action) {
  const t = $("toast"); t.textContent = msg; t.hidden = false;
  if (action) {
    const b = document.createElement("button"); b.type = "button"; b.className = "toast-act"; b.textContent = action.label;
    b.onclick = () => { t.hidden = true; action.run(); }; t.append(b);
  }
  clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, action ? 6000 : 2400);
}
const todayIso = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
// in the list the current year goes without saying: 11.10 instead of 11.10.2026
const shortDate = iso => iso && iso.slice(0, 4) === String(new Date().getFullYear()) ? iso.slice(8, 10) + "." + iso.slice(5, 7) : ruDate(iso);
const ruDate = iso => iso ? iso.slice(8, 10) + "." + iso.slice(5, 7) + "." + iso.slice(0, 4) : "";
function ageDays(iso) { if (!/^\d{4}-\d{2}-\d{2}/.test(iso || "")) return null; const t = new Date(iso.slice(0, 10) + "T00:00:00"); const n = new Date(); n.setHours(0, 0, 0, 0); return Math.round((n - t) / 864e5); }
function ageText(d) { return d == null ? "" : d <= 0 ? "сегодня" : d === 1 ? "вчера" : d + " дн. назад"; }
const stageIx = s => STAGES.indexOf(s === RECRUITER ? "Откликнулась" : s);
function statusCls(s) { if (s === NEW) return "s-new"; if (s === REJECT || s === SKIP) return "s-reject"; if (s === CLOSED) return "s-new"; if (s === "Оффер") return "s-offer"; if (stageIx(s) >= 1) return "s-interview"; return "s-applied"; }
const marketOf = k => MARKETS.find(m => m.key === k);
function showBanner(text) { const b = $("banner"); b.className = "banner err"; b.textContent = text; b.hidden = !text; }

// ---------- data ----------

function cacheSave() { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: state.loadedAt, jobs: state.jobs })); } catch (e) {} }
function cacheLoad() { try { const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); if (c?.jobs) { state.jobs = c.jobs; state.loadedAt = c.at; state.loading = false; } } catch (e) {} }

async function load() {
  state.loading = !state.jobs.length; render();
  const { data, error } = await sb.from("jobs").select(LIST_COLUMNS).order("posted_at", { ascending: false, nullsFirst: false }).limit(2000);
  state.loading = false;
  if (error) { showBanner("Не получилось загрузить вакансии: " + error.message); render(); return; }
  showBanner("");
  state.jobs = data; state.loadedAt = new Date().toISOString(); cacheSave(); events = null; render(); loadEvents(); if (!folio.data) loadFolio(); // the status log gives the activity map and the application times
}

let writing = Promise.resolve();
function save(job, patch, okMsg, action) {
  const before = { ...job }; Object.assign(job, patch); render();
  writing = writing.then(async () => {
    const { error } = await sb.from("jobs").update(patch).eq("id", job.id);
    if (error) { Object.assign(job, before); render(); showBanner("Не сохранилось: " + error.message + ". Значение вернула назад, попробуй ещё раз."); return; }
    cacheSave(); toast(okMsg, action);
  });
  return writing;
}

async function loadDesc(job) {
  const body = $("descBody");
  if (state.desc[job.id] == null) {
    const { data, error } = await sb.from("jobs").select("description").eq("id", job.id).single();
    if (error) { body.textContent = "Не получилось загрузить описание: " + error.message; return; }
    state.desc[job.id] = (data.description || "").trim();
  }
  if (state.sel[state.tab] === job.id) renderDesc(job, !state.desc[job.id]);
}

// hh.ru often blocks descriptions, so the text can be pasted in by hand; letters then use it
function renderDesc(job, editing) {
  const body = $("descBody"), text = state.desc[job.id] || "";
  if (!editing) {
    body.innerHTML = `<div class="text"></div><div class="row"><button class="btn" type="button" id="descEdit">Изменить описание</button></div>`;
    body.querySelector(".text").textContent = text;
    $("descEdit").onclick = () => renderDesc(job, true);
    return;
  }
  body.innerHTML = `<p class="note">${text ? "Поправь текст и сохрани." : "Описание не подтянулось. Открой вакансию по ссылке в заголовке, скопируй текст и вставь сюда: по нему будет точнее письмо."}</p>
    <textarea id="descText" placeholder="Текст вакансии: задачи, требования, условия"></textarea>
    <div class="row"><button class="btn primary" type="button" id="descSave" disabled>Сохранить описание</button>${text ? '<button class="btn" type="button" id="descCancel">Отмена</button>' : ""}</div>`;
  const ta = $("descText"), btn = $("descSave");
  ta.value = text;
  ta.oninput = () => btn.disabled = ta.value.trim() === text;
  if ($("descCancel")) $("descCancel").onclick = () => renderDesc(job, false);
  btn.onclick = async () => {
    const v = ta.value.trim();
    btn.disabled = true;
    const { error } = await sb.from("jobs").update({ description: v }).eq("id", job.id);
    if (error) { btn.disabled = false; showBanner("Описание не сохранилось: " + error.message); return; }
    state.desc[job.id] = v; toast("Описание сохранено");
    if (state.sel[state.tab] === job.id) renderDesc(job, !v);
  };
}

const TR = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" };
// link tags stay Latin-only so analytics reports read cleanly: «Яндекс» → yandeks
const slug = s => (s.toLowerCase().replace(/[а-яё]/g, c => TR[c]).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "co").slice(0, 30);

// Same instructions as the Supabase function, packed into one message for a Claude chat
function letterPrompt(job, desc) {
  const d = (desc || "").slice(0, 4000);
  if (job.market === "uae") {
    const tag = "li-" + slug(job.company);
    return `${window.JOB_PROFILE}\nWrite a cover letter from Maria for this job. English, 130–180 words, warm and confident, no clichés ("excited to apply", "passionate", "thrilled" are banned). Greeting "Hi ${job.company} team,"; why this role in 1–2 sentences, referring to concrete things from the description; 2–3 most relevant achievements with numbers; one line: relocating to Dubai, available immediately; then exactly "Portfolio: https://marydis.com/index-en.html?from=${tag}"; sign-off "Best regards,\nMaria Vorobyeva". Plain text only, no placeholders, no invented facts. Reply with the letter only.\n\nJob: ${job.title} at ${job.company}. Domain: ${job.domain}. Level: ${job.level}. Why it fits: ${job.why}\nLink: ${job.url}\nDescription:\n${d || "(no description)"}`;
  }
  const tag = "hh-" + slug(job.company);
  return `${window.JOB_PROFILE}\nНапиши сопроводительное письмо от Маши на эту вакансию. Русский, 110–160 слов. Тон тёплый и живой, без канцелярита и клише; начинай с «Здравствуйте!». Почему именно эта вакансия — 1–2 предложения; 2–3 самых подходящих результата с цифрами; строки портфолио ровно такие:\nПортфолио\n\nОткрывается из России: https://mariadis.gitverse.site/?from=${tag}\nМожет понадобиться VPN: https://marydis.com/?from=${tag}\nЗаверши фразой «Буду рада обсудить вакансию 🐱» и подписью «Маша Воробьева». Про переезд в ОАЭ не пиши. Только простой текст, без плейсхолдеров и выдуманных фактов. В ответе — только письмо.\n\nВакансия: ${job.title}, компания ${job.company}. Сфера: ${job.domain}. Уровень: ${job.level}. Формат: ${job.work_format}. Почему подходит: ${job.why}\nСсылка: ${job.url}${d ? "\nОписание:\n" + d : ""}`;
}

async function generate(job) {
  const note = $("letterNote"), btn = $("gen"), ta = $("letter");
  if (!window.JOB_CONFIG.letterFunction) {
    // free path: copy a full prompt, paste it into a Claude chat, paste the answer back here
    if (state.desc[job.id] == null) {
      const { data } = await sb.from("jobs").select("description").eq("id", job.id).single();
      state.desc[job.id] = (data?.description || "").trim();
    }
    const text = letterPrompt(job, state.desc[job.id]);
    try { await navigator.clipboard.writeText(text); }
    catch (e) { ta.value = text; ta.focus(); ta.select(); note.textContent = "Скопируй выделенный текст вручную."; return; }
    note.textContent = "Запрос скопирован. Вставь его в чат с Claude, а готовое письмо вставь сюда и нажми «Сохранить правки».";
    window.open("https://claude.ai/new", "_blank", "noopener");
    return;
  }
  btn.disabled = true; note.textContent = "Claude пишет письмо…";
  const { data, error } = await sb.functions.invoke("letter", { body: { job_id: job.id } });
  btn.disabled = false;
  if (error || data?.error) { note.textContent = "Не получилось написать письмо: " + (data?.error || error.message); return; }
  note.textContent = "";
  job.letter = data.letter; ta.value = data.letter; cacheSave(); render(); toast("Новое письмо сохранено");
}

// ---------- views ----------

const isHot = j => j.fit === "Высокий" && j.status === NEW && ageDays(j.posted_at) != null && ageDays(j.posted_at) <= FRESH_DAYS;
// "Отклики" tabs: everything I applied to, rejections included, whatever the age.
// Vacancies I never applied to go to "Архив" once they are older than ARCHIVE_DAYS.
const isApplied = j => ![NEW, SKIP, CLOSED].includes(j.status);
// a hiring stage past the application is going on (an offer included): these live in «В процессе», not in «Отклики»
const inProcess = j => stageIx(j.status) >= 1;
const isOld = j => (ageDays(j.posted_at) ?? 0) > ARCHIVE_DAYS;
const tabOf = k => TABS.find(t => t.key === k);
// «Низкий» vacancies stay in the base only so the next search does not bring them back as new:
// they are hidden everywhere unless I applied anyway or pick «Низкое» in the filter
const isLow = j => j.fit === "Низкий" && !isApplied(j);
function jobsOf(t, withLow = false) {
  const pool = withLow ? state.jobs : state.jobs.filter(j => !isLow(j));
  if (t.key === "today") return pool.filter(isHot);
  if (t.archive) return pool.filter(j => !isApplied(j) && isOld(j));
  if (t.process) return pool.filter(inProcess);
  if (t.applied) return pool.filter(j => j.market === t.market && isApplied(j) && !inProcess(j));
  return pool.filter(j => j.market === t.market && !isApplied(j) && !isOld(j));
}
const byApplyTime = () => { const t = tabOf(state.tab); return t.applied || t.process; };
const tabJobs = () => jobsOf(tabOf(state.tab), $("fFit").value === "Низкий");

function filtered() {
  const q = $("q").value.trim().toLowerCase(), fit = $("fFit").value, fmt = $("fFmt").value, sort = $("sort").value;
  // the tabs split by status now: «Отклики» keep rejections (their feedback matters), elsewhere «Не подходит» and closed stay hidden
  const okStatus = j => tabOf(state.tab).applied || !ENDED.includes(j.status);
  const rows = tabJobs().filter(j =>
    (!q || (j.company + " " + j.title).toLowerCase().includes(q)) &&
    (!fit || j.fit === fit) && (!fmt || (j.work_format || "").includes(fmt)) && okStatus(j));
  const num = s => { const n = parseInt(String(s).replace(/\D/g, ""), 10); return isNaN(n) ? 1e9 : n; };
  const byDate = (a, b) => (b.posted_at || "").localeCompare(a.posted_at || "");
  const fitRank = f => ({ "Высокий": 0, "Средний": 1 }[f] ?? 2);
  // when I applied: the logged move out of «Не откликалась» if there is one, else the date alone (start of that day)
  const appliedMs = {};
  for (const e of events || []) if (isApplyStatus(e.to_status) && !isApplyStatus(e.from_status || NEW)) appliedMs[e.job_id] = Date.parse(e.at);
  const appliedAt = j => appliedMs[j.id] ?? (j.applied_at ? Date.parse(j.applied_at) : 0);
  const byApplied = (a, b) => appliedAt(b) - appliedAt(a) || byDate(a, b);
  const cmp = {
    fit: (a, b) => fitRank(a.fit) - fitRank(b.fit) || byDate(a, b),
    date: byDate,
    "date-old": (a, b) => -byDate(a, b),
    applied: byApplied,
    few: (a, b) => num(a.applicants) - num(b.applicants),
    company: (a, b) => a.company.localeCompare(b.company, "ru"),
  }[sort === "date" && byApplyTime() ? "applied" : sort]; // «Отклики» and «В процессе» default to the latest application first
  return rows.sort(cmp);
}

// Furthest pipeline stage a vacancy reached; a rejection counts up to the stage where it stopped
function reached(j) {
  if (j.status === REJECT) return j.reject_stage ? stageIx(j.reject_stage) : 0;
  return stageIx(j.status);
}

// funnel source: everything, regular applications or referrals only
let funnelSrc = "all", funnelStage = null; // funnelStage: the stage row opened to show its companies
const FUNNEL_SRC = [["all", "Все"], ["plain", "Обычные"], ["ref", "Рефералки"]];
const pct = (a, b) => b ? Math.round(a / b * 100) + "%" : "—";
// companies that reached a funnel stage, latest application first; a tap opens the vacancy
function stageJobs(pool, i) {
  const js = pool.filter(j => reached(j) >= i).sort((a, b) => (b.applied_at || "").localeCompare(a.applied_at || ""));
  if (!js.length) return '<div class="fjobs"><p class="note">Пока никого</p></div>';
  return `<div class="fjobs">${js.map(j => `<button type="button" class="fjob" data-id="${esc(j.id)}"><span class="fj-c">${esc(j.company)}${j.referral ? ' <span class="chip ref">реф.</span>' : ""}<small>${esc(j.title)}</small></span><span class="pill ${statusCls(j.status)}">${esc(j.status === REJECT ? "Отказ: " + short(j.reject_stage || STAGES[0]) : short(j.status))}</span></button>`).join("")}</div>`;
}
function openJob(id) {
  const j = state.jobs.find(x => x.id === id); if (!j) return;
  const t = TABS.find(t => t.key !== "today" && jobsOf(t, true).includes(j)); if (!t) return;
  state.view = "jobs"; state.tab = t.key; state.sel[t.key] = id;
  if (j.fit === "Низкий" && !isApplied(j)) $("fFit").value = "Низкий";
  render(); scrollTo({ top: 0 });
  if (mobile.matches) { $("detail").scrollTop = 0; openSheet("detail"); }
}
function renderSummary() {
  const all = state.jobs, sent = all.filter(j => reached(j) >= 0);
  const procAll = all.filter(j => stageIx(j.status) >= 1 && j.status !== "Оффер"), procRef = procAll.filter(j => j.referral).length;
  const items = [
    ["Откликнуться сегодня", all.filter(isHot).length],
    ["Откликов отправлено", sent.length],
    ["В процессе", procAll.length, procRef ? `${procRef} реф.` : ""],
    ["Офферов", all.filter(j => j.status === "Оффер").length],
  ];
  const dash = state.loading && !all.length;
  $("stats").innerHTML = items.map(([l, n, note]) => `<div class="stat"><b>${dash ? "–" : n}${note && !dash ? `<small>${note}</small>` : ""}</b><span>${l}</span></div>`).join("");
  const pool = funnelSrc === "all" ? all : all.filter(j => !!j.referral === (funnelSrc === "ref"));
  const max = Math.max(1, pool.filter(j => reached(j) >= 0).length);
  // does a referral get further than a cold application: share of sent ones that reached at least an HR call
  const cmp = list => { const s = list.filter(j => reached(j) >= 0); return [s.filter(j => reached(j) >= 1).length, s.length]; };
  const [rT, rS] = cmp(all.filter(j => j.referral)), [pT, pS] = cmp(all.filter(j => !j.referral));
  $("funnel").innerHTML = `<div class="head"><span>Воронка по этапам</span><span>дошли · отказы на этапе</span></div>
    <div class="fsrc" role="tablist">${FUNNEL_SRC.map(([k, l]) => `<button type="button" data-src="${k}" aria-selected="${k === funnelSrc}">${l}</button>`).join("")}</div>` + STAGES.map((s, i) => {
    const got = pool.filter(j => reached(j) >= i).length;
    const lost = pool.filter(j => j.status === REJECT && reached(j) === i).length;
    return `<button type="button" class="frow" data-stage="${i}" aria-expanded="${funnelStage === i}"><span>${esc(short(s))}</span><span class="bar" title="${got} дошли, ${lost} отказов на этом этапе"><i style="width:${(got - lost) / max * 100}%"></i><i class="x" style="width:${lost / max * 100}%"></i></span><span class="num"><b>${got}</b>${lost ? " · −" + lost : ""}</span></button>${funnelStage === i ? stageJobs(pool, i) : ""}`;
  }).join("") + (rS ? `<p class="fcmp">Дошли до HR и дальше: рефералки <b>${rT} из ${rS}</b> (${pct(rT, rS)}) · обычные <b>${pT} из ${pS}</b> (${pct(pT, pS)})</p>` : "");
  // per market: fresh relevant vacancies still waiting for me, and how my applications go
  const row = m => {
    const js = all.filter(j => j.market === m.key);
    const fresh = js.filter(j => j.status === NEW && ["Высокий", "Средний"].includes(j.fit) && !isOld(j)).length;
    const sentM = js.filter(j => reached(j) >= 0);
    const talks = js.filter(j => reached(j) >= 1).length;
    const rejects = js.filter(j => j.status === REJECT).length;
    return `<div class="mrow"><b>${esc(m.short)}</b><span><b>${fresh}</b> ждут отклика</span><span><b>${sentM.length}</b> откликов</span><span><b>${talks}</b> собесов</span><span><b>${rejects}</b> отказов</span></div>`;
  };
  renderActivity();
  $("markets").innerHTML = dash ? "" : `<div class="head">По рынкам</div>` + MARKETS.map(row).join("");
  $("updated").textContent = state.loadedAt ? "Обновлено " + new Date(state.loadedAt).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "";
}

// Activity map: columns are days (last 90), rows are parts of the day; darker means more applications.
// The time of an application comes from job_events (status change log); older ones have only a date.
const RU_MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const SLOTS = [["morning", "Утро", "утром"], ["day", "День", "днём"], ["evening", "Вечер", "вечером"], ["night", "Ночь", "ночью"], ["unknown", "Без времени", "время не записано"]];
const HEAT_DAYS = 90;
const isoOf = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const slotOf = h => h >= 6 && h < 12 ? "morning" : h >= 12 && h < 18 ? "day" : h >= 18 ? "evening" : "night";
let events = null; // status changes, oldest first; by_me marks the ones made in the app (not by the update scripts)
async function loadEvents() {
  events = events || [];
  const { data } = await sb.from("job_events").select("job_id,from_status,to_status,at,by_me").order("at");
  events = data || [];
  if (state.view === "dash") renderActivity(); else if (state.view === "jobs" && byApplyTime()) render(); // «Отклики» sort by application time
  const h = $("hist"); if (h) renderHistory(h.dataset.id);
}
const isApplyStatus = st => ![NEW, SKIP, CLOSED].includes(st);
// my work on vacancies placed into a day and a part of the day: every status change I made,
// plus applications from before the log existed (those have only a date)
function jobActs() {
  const byId = Object.fromEntries(state.jobs.map(j => [j.id, j]));
  const acts = (events || []).filter(e => e.by_me !== false && byId[e.job_id]).map(e => {
    const t = new Date(e.at);
    return { job: byId[e.job_id], to: e.to_status, at: t, day: isoOf(t), slot: slotOf(t.getHours()) };
  });
  const logged = new Set(acts.filter(a => isApplyStatus(a.to)).map(a => a.job.id));
  for (const j of state.jobs) if (isApplied(j) && j.applied_at && !logged.has(j.id))
    acts.push({ job: j, to: "Откликнулась", at: null, day: j.applied_at.slice(0, 10), slot: "unknown" });
  return acts;
}
const hm = d => String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
// the vacancy's own history under its stages: when I moved it and where
function renderHistory(id) {
  const h = $("hist"); if (!h || h.dataset.id !== id) return;
  const list = (events || []).filter(e => e.job_id === id);
  h.innerHTML = list.length ? "История: " + list.map(e => { const t = new Date(e.at);
    return `<span>${esc(ruDate(isoOf(t)).slice(0, 5))} ${hm(t)} → ${esc(e.to_status)}${e.by_me === false ? " (автоматически)" : ""}</span>`; }).join("") : "";
  h.hidden = !list.length;
}
// diary entries (not the open goals) in the same day × part-of-day grid; entries without a time go to «Без времени»
function diaryActs() {
  return (diary.rows || []).filter(r => !isOpenGoal(r)).map(r =>
    ({ row: r, day: r.day, slot: r.at_time ? slotOf(+r.at_time.slice(0, 2)) : "unknown" }));
}
const APP_SHADES = ["", "#C9B5F8", "#A783F3", "#8B55EE", "#5B21B6"];
const DIARY_SHADES = ["", "#FBCFE8", "#F9A8D4", "#F472B6", "#DB2777"];
function renderActivity() {
  if (!events) loadEvents();
  if (!diary.rows) loadDiary();
  const A = $("activity"), apps = jobActs(), notes = diaryActs();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today); start.setDate(start.getDate() - HEAT_DAYS + 1);
  const startIso = isoOf(start), recent = apps.filter(a => a.day >= startIso);
  const recentNotes = notes.filter(a => a.day >= startIso && a.day <= isoOf(today));
  const slots = SLOTS.filter(([k]) => k !== "unknown" || recent.some(a => a.slot === "unknown") || recentNotes.some(a => a.slot === "unknown"));
  const count = {}, noteCount = {};
  for (const a of recent) count[a.day + "|" + a.slot] = (count[a.day + "|" + a.slot] || 0) + 1;
  for (const a of recentNotes) noteCount[a.day + "|" + a.slot] = (noteCount[a.day + "|" + a.slot] || 0) + 1;
  const level = n => n >= 5 ? 4 : n >= 3 ? 3 : n; // fixed steps: 1, 2, 3–4, 5+
  // applications are lilac, diary entries pink; a cell with both is split along the diagonal
  const paint = (n, m) => !n && !m ? "" : !m ? `background:${APP_SHADES[level(n)]}` : !n ? `background:${DIARY_SHADES[level(m)]}`
    : `background:linear-gradient(135deg,${APP_SHADES[level(n)]} 50%,${DIARY_SHADES[level(m)]} 50%)`;
  let cells = "", heads = "", col = 0;
  for (const d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    col++;
    const iso = isoOf(d);
    if (iso === isoOf(today)) heads += `<span class="t" style="grid-column:${col}">${d.getDate()}</span>`;
    else if (d.getDate() === 1 || col === 1) heads += `<span class="m" style="grid-column:${col}">${RU_MONTHS[d.getMonth()]}</span>`;
    else if (d.getDay() === 1 && col < HEAT_DAYS - 2) heads += `<span style="grid-column:${col}">${d.getDate()}</span>`;
    slots.forEach(([k], r) => { const key = iso + "|" + k; cells += `<i style="grid-row:${r + 1};grid-column:${col};${paint(count[key] || 0, noteCount[key] || 0)}" data-d="${iso}" data-s="${k}"></i>`; });
  }
  // streak: days in a row with applications, counting from today (or yesterday, if today is still empty)
  const days = new Set(apps.map(a => a.day));
  let streak = 0; const c = new Date(today);
  if (!days.has(isoOf(c))) c.setDate(c.getDate() - 1);
  while (days.has(isoOf(c))) { streak++; c.setDate(c.getDate() - 1); }
  const recentDays = new Set([...recent, ...recentNotes].map(a => a.day)).size;
  const applied = recent.filter(a => isApplyStatus(a.to)).length;
  const bySlot = SLOTS.slice(0, 4).map(([k, , w]) => [w, recent.filter(a => a.slot === k).length]).sort((a, b) => b[1] - a[1]);
  const fav = bySlot[0][1] ? ` · чаще всего ${bySlot[0][0]}` : "";
  const cols = `grid-template-columns:repeat(${col},14px)`;
  A.innerHTML = `<div class="head"><span>Активность: вакансии и дневник</span><span>За ${HEAT_DAYS} дней ${recent.length} ${plural(recent.length, "действие", "действия", "действий")} с вакансиями, из них ${applied} ${plural(applied, "отклик", "отклика", "откликов")}, и ${recentNotes.length} ${plural(recentNotes.length, "запись", "записи", "записей")} в дневнике · ${recentDays} ${plural(recentDays, "активный день", "активных дня", "активных дней")}${streak ? ` · серия ${streak} ${plural(streak, "день", "дня", "дней")}` : ""}${fav}</span></div>
    <div class="heat-scroll" id="heatScroll"><div class="heat"><div class="heat-corner"></div>
      <div class="heat-months" style="${cols}">${heads}</div>
      <div class="heat-days" style="grid-template-rows:repeat(${slots.length},14px)">${slots.map(([, l]) => `<span>${l}</span>`).join("")}</div>
      <div class="heat-cells" style="${cols};grid-template-rows:repeat(${slots.length},14px)">${cells}</div>
    </div></div>
    <div class="heat-foot"><p class="heat-day" id="heatDay"></p><div class="heat-legend"><i style="background:${APP_SHADES[2]}"></i>вакансии <i style="background:${DIARY_SHADES[2]}"></i>дневник <i style="background:linear-gradient(135deg,${APP_SHADES[2]} 50%,${DIARY_SHADES[2]} 50%)"></i>оба</div></div>`;
  const sc = $("heatScroll"); sc.scrollLeft = sc.scrollWidth; // today on the right
  const keep = heatSel && heatSel.day >= startIso ? heatSel : { day: isoOf(today), slot: null };
  showHeatDay(keep.day, keep.slot);
}
// what I did with vacancies in a cell, one line per new status: time span, status, how many and which companies
function vacancyLines(acts) {
  const groups = {};
  for (const a of acts) (groups[a.to] = groups[a.to] || []).push(a);
  const order = st => isApplyStatus(st) ? 0 : st === SKIP ? 1 : 2;
  return Object.entries(groups).sort(([x], [y]) => order(x) - order(y)).map(([st, list]) => {
    const times = list.filter(a => a.at).map(a => hm(a.at)).sort();
    const span = times.length ? (times[0] === times[times.length - 1] ? times[0] : times[0] + "–" + times[times.length - 1]) + " · " : "";
    const names = [...new Set(list.map(a => a.job.company))];
    const shown = names.slice(0, 6).join(", ") + (names.length > 6 ? ` и ещё ${names.length - 6}` : "");
    return `<span class="hd-app">${esc(span)}${esc(st)} — ${list.length}: ${esc(shown)}</span>`;
  }).join("");
}
// tap a square: the line under the map tells the day, the part of the day, how many applications and where
let heatSel = null;
function showHeatDay(iso, slot) {
  heatSel = { day: iso, slot };
  const here = a => a.day === iso && (!slot || a.slot === slot);
  const apps = jobActs().filter(here), notes = diaryActs().filter(here);
  const d = new Date(iso + "T00:00:00").toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "long" });
  const part = slot ? ", " + SLOTS.find(([k]) => k === slot)[2] : "";
  const short = t => t.length > 90 ? t.slice(0, 88).trimEnd() + "…" : t;
  $("heatDay").innerHTML = `<div><b>${esc(d)}${esc(part)}</b>${!apps.length && !notes.length ? " · ничего не отмечено" : ""}</div>`
    + vacancyLines(apps)
    + notes.map(a => `<span class="hd-note">${a.row.at_time ? esc(hhmm(a.row.at_time)) + " · " : ""}${a.row.is_goal ? "✓ " : ""}${esc(short(a.row.text.replace(/\s+/g, " ")))}</span>`).join("");
  $("activity").querySelectorAll("i.sel").forEach(i => i.classList.remove("sel"));
  if (slot) $("activity").querySelector(`i[data-d="${iso}"][data-s="${slot}"]`)?.classList.add("sel");
}
const pickHeat = e => { const c = e.target.closest("i[data-d]"); if (c) showHeatDay(c.dataset.d, c.dataset.s); };
$("funnel").addEventListener("click", e => {
  const src = e.target.closest("[data-src]"), row = e.target.closest("[data-stage]"), job = e.target.closest(".fjob");
  if (src) { funnelSrc = src.dataset.src; renderSummary(); }
  else if (row) { const i = +row.dataset.stage; funnelStage = funnelStage === i ? null : i; renderSummary(); }
  else if (job) openJob(job.dataset.id);
});
$("activity").addEventListener("click", pickHeat);
$("activity").addEventListener("mouseover", pickHeat);

function plural(n, one, few, many) { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many; }

function renderTabs() {
  const loaded = state.jobs.length > 0;
  $("tabs").innerHTML = TABS.map(t => {
    const n = !loaded ? null : jobsOf(t).filter(j => t.key === "today" || t.archive || t.process || (t.applied ? j.status !== REJECT : j.status === NEW)).length;
    const tail = n == null ? "" : `<span class="n">${t.key === "today" || t.archive || t.process ? n : n + (t.applied ? " ждут ответа" : " новых")}</span>`;
    return `<button class="tab ${t.key === "today" ? "today" : ""}" role="tab" type="button" data-k="${t.key}" aria-selected="${t.key === state.tab}">${esc(t.label)}${tail}</button>`;
  }).join("");
  // keep the chosen tab visible in the scrolling row on phones, without moving the page
  const T = $("tabs"), cur = T.querySelector('[aria-selected="true"]');
  if (cur && (cur.offsetLeft < T.scrollLeft || cur.offsetLeft + cur.offsetWidth > T.scrollLeft + T.clientWidth)) T.scrollLeft = cur.offsetLeft - 10;
  $("intro").textContent = `Высокое совпадение, опубликованы за последние ${FRESH_DAYS} дня, ты ещё не откликалась. Чем раньше отклик, тем выше он в списке у рекрутера.`;
  $("intro").hidden = state.tab !== "today";
}

function renderList(rows) {
  const L = $("list");
  if (state.loading) { L.innerHTML = Array.from({ length: 6 }, () => '<div class="skeleton"></div>').join(""); return; }
  if (!state.jobs.length) { L.innerHTML = '<div class="empty">Вакансий пока нет. Они появятся после первого запуска сбора вакансий или импорта из Google Таблицы.</div>'; return; }
  if (!rows.length) {
    L.innerHTML = state.tab === "today"
      ? '<div class="empty">Свежих вакансий с высоким совпадением сейчас нет. Новые приходят каждое утро; пока можно пройтись по вкладкам ОАЭ и России.</div>'
      : '<div class="empty">Под эти фильтры ничего не подходит. Попробуй сбросить фильтры или очистить поиск.</div>';
    return;
  }
  const sel = state.sel[state.tab];
  L.innerHTML = rows.map(j => {
    const bits = [j.company, j.city, j.work_format && j.work_format !== "не указан" ? j.work_format : "", j.salary, j.referral ? "рефералка" : ""].filter(Boolean).map(esc).join(" · ");
    const meta = state.tab === "today"
      ? `<span class="src">${marketOf(j.market).short}</span><span class="age">${ageText(ageDays(j.posted_at))}</span>`
      : `${tabOf(state.tab).archive || tabOf(state.tab).process ? `<span class="src">${marketOf(j.market).short}</span>` : ""}${j.status === NEW ? "" : `<span class="pill ${statusCls(j.status)}">${esc(short(j.status))}</span>`}${isApplied(j) && j.applied_at ? `<span class="applied-on">отклик ${esc(shortDate(j.applied_at))}</span>` : esc(shortDate(j.posted_at))}`;
    return `<button class="item" type="button" data-id="${esc(j.id)}" aria-current="${j.id === sel}">
      <span class="stripe ${j.fit === "Высокий" ? "high" : ""}" title="Совпадение: ${esc(j.fit)}"></span>
      <span style="min-width:0"><span class="t">${esc(j.title)}</span><span class="c">${bits}</span></span>
      <span class="meta">${meta}</span>
    </button>`;
  }).join("");
}

function visitsChip(j) {
  if (!folio.data) return "";
  const v = folioVisits(j, tagJobs());
  if (!v) return "";
  return v.people
    ? `<span class="chip seen">Портфолио смотрели: <strong>${v.people} ${plural(v.people, "человек", "человека", "человек")}, ${minSec(v.seconds)}, ${esc(shortDate(v.last))}</strong></span>`
    : `<span class="chip">Ссылку открыл только робот-превью</span>`;
}
function stepsHtml(j) {
  const cur = j.status === REJECT ? -1 : stageIx(j.status);
  const failAt = j.status === REJECT ? reached(j) : -1;
  return STAGES.map((s, i) => {
    let cls = "";
    if (i === failAt) cls = "failed"; else if ((cur >= 0 && i < cur) || (failAt >= 0 && i < failAt)) cls = "done";
    return `<button type="button" data-st="${esc(s)}" class="${cls}" aria-pressed="${i === cur && j.status !== RECRUITER}">${esc(short(s))}</button>`;
  }).join('<span class="sep" aria-hidden="true">→</span>');
}

function renderDetail(rows) {
  const D = $("detail");
  const j = rows.find(x => x.id === state.sel[state.tab]) || tabJobs().find(x => x.id === state.sel[state.tab]) || rows[0];
  if (!j) { D.innerHTML = '<p class="note" style="margin:0">Выбери вакансию слева: здесь появятся описание, этапы и письмо.</p>'; return; }
  state.sel[state.tab] = j.id;
  const m = marketOf(j.market);
  const fmtChip = j.work_format ? `<span class="chip fmt">Формат: <strong>${esc(j.work_format)}</strong></span>` : "";
  const age = ageDays(j.posted_at);
  const sinceApplied = ageDays(j.applied_at);
  const appliedChip = isApplied(j) && j.applied_at
    ? `<span class="chip applied">Откликнулась: <strong>${esc(ruDate(j.applied_at))}${sinceApplied != null ? " (" + esc(ageText(sinceApplied)) + ")" : ""}</strong></span>` : "";
  const chips = [["Совпадение", j.fit], ["Сфера", j.domain], ["Уровень", j.level], ["Город", j.city], ["Опыт", j.experience && j.experience + " лет"], ["Зарплата", j.salary], ["Опубликовано", j.posted_at ? ruDate(j.posted_at) + (age != null ? " (" + ageText(age) + ")" : "") : ""], ["Откликов", j.applicants]]
    .filter(([, v]) => v && v !== "—").map(([k, v]) => `<span class="chip">${k}: <strong>${esc(v)}</strong></span>`).join("");
  const pressed = s => j.status === s ? "true" : "false";
  D.innerHTML = `
    <div class="sheet-bar"><div class="grab" aria-hidden="true"></div><button class="btn icon-btn" type="button" id="detailClose" aria-label="Закрыть">✕</button></div>
    <div>
      <p class="lbl">${esc(m.label)} · ${esc(j.company)}</p>
      <h2><a href="${esc(j.url)}" target="_blank" rel="noopener">${esc(j.title)} ↗</a></h2>
    </div>
    <div class="chips">${j.referral ? '<span class="chip ref">Рефералка</span>' : ""}${visitsChip(j)}${appliedChip}${fmtChip}${chips}</div>
    ${j.why ? `<p class="why">${esc(j.why)}</p>` : ""}
    <details class="desc" id="desc"><summary>Описание вакансии</summary><div class="body" id="descBody">Загружаю…</div></details>
    <div>
      <p class="lbl">Этап${isApplied(j) && j.applied_at ? ` · откликнулась ${esc(ruDate(j.applied_at))}` : ""}</p>
      <div class="steps" id="steps">${stepsHtml(j)}</div>
      <div class="outcomes" id="outcomes">
        <button type="button" data-st="${NEW}" aria-pressed="${pressed(NEW)}">Не откликалась</button>
        <button type="button" data-st="${RECRUITER}" aria-pressed="${pressed(RECRUITER)}">Написала рекрутеру</button>
        <button type="button" data-st="${REJECT}" aria-pressed="${pressed(REJECT)}">Отказ</button>
        <button type="button" data-st="${SKIP}" aria-pressed="${pressed(SKIP)}">Не подходит</button>
        <button type="button" data-st="${CLOSED}" aria-pressed="${pressed(CLOSED)}">Отклики закрыты</button>
      </div>
      <p class="note hist" id="hist" data-id="${esc(j.id)}" hidden></p>
    </div>
    <div id="extra"></div>
    <div>
      <p class="lbl">Сопроводительное письмо ${m.lang === "en" ? "(английский)" : "(русский)"}</p>
      <textarea class="letter" id="letter" spellcheck="true" placeholder="Письма пока нет. Попроси Claude в чате написать его, а ответ вставь сюда.">${esc(j.letter)}</textarea>
      <div class="row" style="margin-top:8px">
        <button class="btn primary" type="button" id="copy" ${j.letter ? "" : "disabled"}>Скопировать письмо</button>
        <button class="btn" type="button" id="saveLetter" disabled>Сохранить правки</button>
        <button class="btn" type="button" id="cv">Скачать CV</button>
        ${window.JOB_CONFIG.letterFunction ? `<button class="btn" type="button" id="gen">${j.letter ? "Переписать заново" : "Написать письмо"}</button>` : ""}
        <span class="note grow" id="letterNote"></span>
      </div>
    </div>
    <div>
      <p class="lbl"><label for="comment">Комментарий</label></p>
      <input class="comment" id="comment" value="${esc(j.comment)}" placeholder="Например: написала Патрисии в LinkedIn">
      <label class="check ref-check"><input type="checkbox" id="referral" ${j.referral ? "checked" : ""}> По рекомендации (рефералка)</label>
    </div>`;

  renderExtra(j); renderHistory(j.id);
  D.querySelector("h2 a").onclick = openOutside;
  $("detailClose").onclick = () => closeSheet();
  $("desc").addEventListener("toggle", () => { if ($("desc").open) loadDesc(j); });
  const ta = $("letter");
  ta.addEventListener("input", () => { $("saveLetter").disabled = ta.value === j.letter; $("copy").disabled = !ta.value.trim(); });
  $("copy").onclick = async () => {
    try { await navigator.clipboard.writeText(ta.value); toast("Письмо скопировано"); }
    catch (e) { ta.focus(); ta.select(); toast("Текст выделен: нажми Ctrl+C / ⌘C"); }
  };
  $("saveLetter").onclick = () => save(j, { letter: ta.value }, "Письмо сохранено");
  if ($("gen")) $("gen").onclick = () => generate(j); // only with the letter function; letters otherwise come from the Claude chat
  $("referral").onchange = e => save(j, { referral: e.target.checked }, e.target.checked ? "Отмечено: рефералка" : "Отметка снята");
  $("cv").onclick = () => downloadCv(j).catch(err => toast("Не получилось собрать CV: " + err.message));
  const pick = e => { const b = e.target.closest("button[data-st]"); if (b) setStatus(j, b.dataset.st); };
  $("steps").onclick = pick; $("outcomes").onclick = pick;
  const cm = $("comment");
  cm.addEventListener("change", () => { if (cm.value !== j.comment) save(j, { comment: cm.value }, "Комментарий сохранён"); });
}

// Panels for a rejection (where it stopped + their feedback) and for "not a fit" (my reason)
function renderExtra(j) {
  const X = $("extra");
  if (j.status === REJECT) {
    X.innerHTML = `<div class="panel bad">
      <label for="rjStage">На каком этапе отказали</label>
      <select id="rjStage">${STAGES.slice(0, -1).map(s => `<option value="${esc(s)}" ${s === (j.reject_stage || "Откликнулась") ? "selected" : ""}>${esc(short(s))}</option>`).join("")}</select>
      <label for="fb">Обратная связь от компании</label>
      <textarea id="fb" placeholder="Что сказали: почему отказ, что понравилось, что улучшить">${esc(j.feedback)}</textarea>
      <div class="row"><button class="btn" type="button" id="saveFb" disabled>Сохранить</button></div>
    </div>`;
    const sel = $("rjStage"), fb = $("fb"), btn = $("saveFb");
    const dirty = () => btn.disabled = sel.value === (j.reject_stage || "Откликнулась") && fb.value === j.feedback;
    sel.onchange = dirty; fb.oninput = dirty;
    btn.onclick = () => save(j, { reject_stage: sel.value, feedback: fb.value }, "Отказ и обратная связь сохранены");
  } else if (j.status === SKIP) {
    X.innerHTML = `<div class="panel">
      <label for="why">Почему не подходит</label>
      <div class="quick" id="quick">${SKIP_REASONS.map(s => `<button type="button">${esc(s)}</button>`).join("")}</div>
      <textarea id="why" placeholder="Например: только офис в Абу-Даби, нужен арабский">${esc(j.skip_reason)}</textarea>
      <div class="row"><button class="btn" type="button" id="saveWhy" disabled>Сохранить причину</button></div>
    </div>`;
    const w = $("why"), btn = $("saveWhy");
    w.oninput = () => btn.disabled = w.value === j.skip_reason;
    $("quick").onclick = e => { const b = e.target.closest("button"); if (!b) return; w.value = w.value.trim() ? w.value.trim() + "; " + b.textContent : b.textContent; w.oninput(); w.focus(); };
    btn.onclick = () => save(j, { skip_reason: w.value }, "Причина сохранена");
  } else if (j.status === CLOSED) {
    const lived = j.posted_at && j.closed_at ? Math.round((new Date(j.closed_at) - new Date(j.posted_at)) / 864e5) : null;
    X.innerHTML = `<div class="panel"><p class="note" style="margin:0">Приём откликов закрыт${j.closed_at ? ` (заметила ${esc(ruDate(j.closed_at))})` : ""}.${lived != null ? ` Прожила не больше ${lived} дн. с публикации ${esc(ruDate(j.posted_at))}.` : ""}</p></div>`;
  } else X.innerHTML = "";
}

function setStatus(j, st) {
  if (st === j.status) return;
  const patch = { status: st }, was = j.status;
  if (st !== NEW && st !== SKIP && st !== CLOSED && !j.applied_at) patch.applied_at = todayIso();
  if (st === NEW) patch.applied_at = null; // undoing an application by mistake clears its date
  if (events) events.push({ job_id: j.id, from_status: was, to_status: st, at: new Date().toISOString(), by_me: true }); // the server logs the same
  patch.closed_at = st === CLOSED ? todayIso() : null;
  if (st === REJECT && !j.reject_stage) patch.reject_stage = stageIx(was) >= 0 && was !== "Оффер" ? (was === RECRUITER ? "Откликнулась" : was) : "Откликнулась";
  const back = Object.fromEntries(Object.keys(patch).map(k => [k, j[k] ?? null]));
  const undo = { label: "Отменить", run: () => {
    if (events) events.push({ job_id: j.id, from_status: st, to_status: was, at: new Date().toISOString(), by_me: true });
    save(j, back, "Вернула: " + was);
  } };
  save(j, patch, st === REJECT ? "Отмечен отказ" : st === SKIP ? "Отмечено «Не подходит»" : st === CLOSED ? "Отмечено: отклики закрыты" : "Этап: " + st, undo);
  // on a phone the vacancy is a bottom sheet: once it drops out of the current list, close it,
  // otherwise the sheet quietly switches to the next vacancy and the next tap lands on it
  if (mobile.matches && sheetOpen === "detail" && !filtered().some(x => x.id === j.id)) closeSheet();
}

// In the installed app on Android a vacancy link opens in a tab layered over the app, so I cannot
// switch back to copy the letter. An intent hands it to the system instead: the LinkedIn / hh app
// or the browser opens as a separate window, and the app stays one swipe away.
const isAndroid = /Android/i.test(navigator.userAgent);
function openOutside(e) {
  if (!isAndroid || !standalone()) return; // elsewhere target=_blank already opens a separate tab
  e.preventDefault();
  const u = new URL(e.currentTarget.href);
  location.href = `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.slice(0, -1)};action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(u.href)};end`;
}

function render() {
  renderSummary(); renderTabs();
  // top level: vacancies, the dashboard or the diary
  const v = state.view, jobsView = v === "jobs";
  for (const b of $("views").querySelectorAll("button")) b.setAttribute("aria-selected", String(b.dataset.v === v));
  moveThumb();
  $("summary").hidden = v !== "dash"; $("diary").hidden = v !== "diary"; $("folio").hidden = v !== "folio";
  $("tabs").hidden = $("controls").hidden = $("pane").hidden = !jobsView;
  if (!jobsView) $("intro").hidden = true;
  renderFiltersCount();
  if (v === "diary" && !diary.rows) loadDiary();
  if (v === "folio") folio.data ? renderFolio() : loadFolio();
  if (v === "dash") $("heatScroll").scrollLeft = $("heatScroll").scrollWidth; // today on the right, once it is visible
  if (!jobsView) return;
  const rows = filtered(); renderList(rows); renderDetail(rows);
}

// ---------- «Портфолио»: who visits marydis.com and mariadis.gitverse.site ----------
// Claude copies a Google Analytics snapshot into portfolio_stats twice a day (ingest/portfolio_stats.py);
// link tags (from=<tag> in letters and CVs) are matched back to vacancies, so a visit reads as «Etihad opened it».
const folio = { data: null, at: null };
async function loadFolio() {
  const { data, error } = await sb.from("portfolio_stats").select("data,updated_at").eq("id", "snapshot").maybeSingle();
  if (error) { showBanner("Не получилось загрузить статистику портфолио: " + error.message); return; }
  folio.data = data?.data || null; folio.at = data?.updated_at || null;
  renderFolio(); if (state.view === "jobs") render(); // vacancy cards show visits too
}
const GENERIC_TAGS = { "hh": "Профиль на hh", "cv-ru": "Резюме RU", "cv-en": "Резюме EN", "socium": "Socium" };
const tagLabel = t => GENERIC_TAGS[t] || (/-$/.test(t) ? GENERIC_TAGS[t.slice(0, -1)] + " (старая ссылка)" : "");
// tag → vacancies whose letter, CV or cover letter carries it
function tagJobs() {
  const map = {};
  for (const j of state.jobs) {
    const tags = new Set([...(j.letter || "").matchAll(/from=((?:hh|li|tg)-[a-z0-9-]+)/g)].map(m => m[1]));
    if (j.letter || j.comment || isApplied(j)) tags.add(cvTag(j));
    for (const t of tags) (map[t] = map[t] || []).push(j);
  }
  return map;
}
const jobsForTag = (map, t) => map[t] || map[t.replace(/-cl$/, "")] || [];
const minSec = s => s >= 60 ? Math.round(s / 60) + " мин" : s + " с";
function folioTags(j, map) { return (folio.data?.tags || []).filter(g => jobsForTag(map, g.tag).includes(j)); }
function folioVisits(j, map) {
  const tags = folioTags(j, map);
  if (!tags.length) return null;
  const sum = k => tags.reduce((a, g) => a + (g[k] || 0), 0);
  return { people: sum("people"), robots: sum("robots"), sessions: sum("sessions"), seconds: sum("seconds"),
    last: tags.map(g => g.last || "").sort().pop(), reading: tags.flatMap(g => g.reading || []) };
}
// «Как читают страницы»: people per page and how often they passed each scroll and read mark
const MARKS = [["s25", "25%"], ["s50", "50%"], ["s75", "75%"], ["s100", "100%"], ["r30", "30 с"], ["r60", "1 мин"], ["r120", "2 мин"], ["r300", "5 мин"]];
function readingTable(rows) {
  if (!rows?.length) return '<p class="note">Пока никто из людей не читал</p>';
  const site = h => h === "marydis.com" ? '<i class="dot h1"></i>marydis.com' : '<i class="dot h2"></i>gitverse';
  return `<div class="rtable-wrap"><table class="rtable"><thead><tr><th>Сайт</th><th>Страница</th><th>Люди</th>${MARKS.map(([, l]) => `<th>${l}</th>`).join("")}</tr></thead><tbody>
    ${rows.map(r => `<tr><td class="site">${site(r.host)}</td><td>${esc(r.path)}</td><td class="n">${r.users}</td>${MARKS.map(([k]) => `<td>${r[k] ? `<b>${r[k]}</b>` : ""}</td>`).join("")}</tr>`).join("")}
  </tbody></table></div>`;
}
let folioOpen = null; // the link tag whose reading table is unfolded
function renderFolio() {
  const d = folio.data;
  if (!d || !d.totals) { $("folioNote").textContent = "Статистики пока нет: она появится после ближайшего обновления вакансий."; return; }
  const t = d.totals;
  $("folioNote").textContent = `marydis.com и mariadis.gitverse.site за 30 дней. Люди — те, кто прокрутил страницу или что-то нажал. Роботы — превью ссылок и проверки почты (LinkedIn, Outlook, Google): открывают ссылку, но не листают. Твои собственные заходы не считаются. Обновлено ${new Date(folio.at).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}.`;
  $("folioStats").innerHTML = [["Людей", t.people], ["Роботов и превью", t.robots], ["Визитов людей", t.sessions], ["Средний визит", minSec(t.avg_session)]]
    .map(([l, n], i) => `<div class="stat${i === 1 ? " muted" : ""}"><b>${esc(n)}</b><span>${l}</span></div>`).join("");

  // people and robots per day for 60 days
  const by = Object.fromEntries(d.daily.map(r => [r.day, r])), days = [];
  for (let i = 59; i >= 0; i--) { const x = new Date(); x.setDate(x.getDate() - i); days.push(isoOf(x)); }
  const max = Math.max(1, ...days.map(k => (by[k]?.people || 0) + (by[k]?.robots || 0)));
  $("folioDaily").innerHTML = `<div class="head"><span>Заходы по дням</span><span class="legend"><i class="h1"></i>люди <i class="bot"></i>роботы</span></div>
    <div class="bars">${days.map(k => { const p = by[k]?.people || 0, r = by[k]?.robots || 0;
      return `<span title="${esc(ruDate(k))}: людей ${p}, роботов ${r}"><i class="bot" style="height:${r / max * 100}%"></i><i class="h1" style="height:${p / max * 100}%"></i></span>`; }).join("")}</div>
    <div class="bars-axis"><span>${esc(shortDate(days[0]))}</span><span>людей и роботов различаем с 14.10</span><span>сегодня</span></div>`;

  // link tags, matched to vacancies; a tap unfolds how this company read the portfolio
  const map = tagJobs();
  const rows = d.tags.map(g => {
    const j = jobsForTag(map, g.tag)[0];
    const who = j ? `${esc(j.company)}<small>${esc(j.title)}${/-cl$/.test(g.tag) ? " · cover letter" : ""}</small>` : esc(tagLabel(g.tag) || g.tag) + `<small>${esc(g.tag)}</small>`;
    const num = g.people
      ? `<b>${g.people}</b> ${plural(g.people, "человек", "человека", "человек")} · ${minSec(g.seconds)}<small>${esc(shortDate(g.last))}${g.robots ? ` · ещё роботов: ${g.robots}` : ""}</small>`
      : `<span class="bot-only">только ${g.robots ? "робот" : "без данных"}</span><small>${esc(shortDate(g.seen))}</small>`;
    const did = [g.did?.case_open && `кейсов открыто: ${g.did.case_open}`, g.did?.cv_click && `резюме: ${g.did.cv_click}`,
      (g.did?.email_click || g.did?.telegram_click || g.did?.linkedin_click) && "нажимали контакты", g.cities?.length && g.cities.join(", ")].filter(Boolean).join(" · ");
    const open = folioOpen === g.tag;
    return `<div class="ftag-wrap${g.people ? "" : " dim"}">
      <button type="button" class="ftag" data-tag="${esc(g.tag)}" aria-expanded="${open}" ${g.people ? "" : "disabled"}>
        <span class="ft-who">${who}</span><span class="ft-num">${num}</span>${did ? `<span class="ft-did">${esc(did)}</span>` : ""}
      </button>
      ${open ? `<div class="ft-more">${readingTable(g.reading)}${j ? `<button type="button" class="btn" data-open="${esc(j.id)}">Открыть вакансию</button>` : ""}</div>` : ""}
    </div>`;
  });
  $("folioTags").innerHTML = `<div class="head"><span>Кто открывал по ссылкам из откликов</span><span>люди · время</span></div>${rows.join("") || '<p class="note">Пока никто</p>'}`;

  $("folioPages").innerHTML = `<div class="head"><span>Как читают страницы</span><span>сколько раз прокрутили до отметки и читали дольше</span></div>${readingTable(d.reading)}`;
  const list = (title, items) => `<div class="head"><span>${title}</span></div>` + items.map(([k, n]) => `<div class="frow-s"><span>${esc(k)}</span><b>${n}</b></div>`).join("");
  const DEV = { desktop: "Компьютер", mobile: "Телефон", tablet: "Планшет" };
  $("folioWhere").innerHTML = list("Страны", d.countries.filter(([c]) => c !== "(not set)").slice(0, 8)) + list("Устройства", d.devices.map(([k, n]) => [DEV[k] || k, n]));
}
$("folioTags").addEventListener("click", e => {
  const o = e.target.closest("[data-open]"); if (o) return openJob(o.dataset.open);
  const b = e.target.closest(".ftag[data-tag]"); if (!b || b.disabled) return;
  folioOpen = folioOpen === b.dataset.tag ? null : b.dataset.tag; renderFolio();
});

// ---------- «Дорогой дневник»: what I did, day by day, newest first; the form for a new entry is on top ----------
// An entry can be a goal with a priority: open goals sit in a horizontal strip on top, a ticked goal moves to the log as done today
// (unticking «Выполнена» in edit mode brings it back).

const diary = { rows: null, editing: null };
const PRIORITIES = [["high", "Горит"], ["mid", "Важно"], ["low", "Не горит"]];
const PRIO_RANK = { high: 0, mid: 1, low: 2 };
const prioLabel = p => (PRIORITIES.find(([k]) => k === p) || PRIORITIES[1])[1];
const DIARY_COLS = "id,day,at_time,text,is_goal,priority,done";
const nowTime = () => { const d = new Date(); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
const hhmm = t => t ? t.slice(0, 5) : "";
async function loadDiary() {
  diary.rows = diary.rows || [];
  const { data, error } = await sb.from("diary").select(DIARY_COLS).order("day", { ascending: false }).order("at_time", { ascending: false, nullsFirst: false }).order("id", { ascending: false });
  if (error) { showBanner("Не получилось загрузить дневник: " + error.message); return; }
  diary.rows = data; renderDiary();
  if (state.view === "dash") renderActivity(); else if (state.view === "jobs" && byApplyTime()) render(); // «Отклики» sort by application time
}
const byNewest = (a, b) => b.day.localeCompare(a.day) || hhmm(b.at_time).localeCompare(hhmm(a.at_time)) || b.id - a.id;
const isOpenGoal = r => r.is_goal && !r.done;
const PENCIL = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
const TRASH = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>';
const longDate = iso => new Date(iso + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" });
const prioRadios = (name, cur) => `<div class="prio" role="radiogroup" aria-label="Приоритет">${PRIORITIES.map(([k, l]) =>
  `<label class="p-${k}"><input type="radio" name="${name}" value="${k}" ${k === cur ? "checked" : ""}><span>${l}</span></label>`).join("")}</div>`;

function entryHtml(r) {
  if (diary.editing === r.id) return `<div class="dentry editing" data-id="${r.id}">
    <textarea class="dedit">${esc(r.text)}</textarea>
    <label class="check"><input type="checkbox" class="dgoal" ${r.is_goal ? "checked" : ""}> Это цель</label>
    <div class="goal-fields" ${r.is_goal ? "" : "hidden"}><span class="lbl">Приоритет</span>${prioRadios("prio-" + r.id, r.priority || "mid")}
      <label class="check"><input type="checkbox" class="ddone" ${r.done ? "checked" : ""}> Выполнена</label></div>
    <div class="when"><input type="date" class="dday-input" value="${esc(r.day)}" aria-label="Дата"><input type="time" class="dtime-input" value="${esc(hhmm(r.at_time))}" aria-label="Время"></div>
    <div class="edit-actions"><button class="btn del-btn" type="button" data-a="del" aria-label="Удалить запись" title="Удалить">${TRASH}</button><button class="btn" type="button" data-a="cancel">Отмена</button><button class="btn primary" type="button" data-a="save">Сохранить</button></div>
  </div>`;
  const tick = isOpenGoal(r) ? `<button class="goal-tick" type="button" data-a="done" aria-label="Цель выполнена" title="Отметить выполненной"></button>` : "";
  const tag = r.is_goal ? (r.done ? `<span class="gtag done">✓ Цель выполнена</span>` : `<span class="gtag p-${r.priority || "mid"}" title="Приоритет">${prioLabel(r.priority)}</span>`) : "";
  return `<div class="dentry ${isOpenGoal(r) ? "goal" : ""}" data-id="${r.id}">${tick}<div class="dbody">${r.at_time && !isOpenGoal(r) || tag ? `<div class="dmeta">${r.at_time && !isOpenGoal(r) ? `<span class="dtime">${esc(hhmm(r.at_time))}</span>` : ""}${tag}</div>` : ""}<p>${esc(r.text)}</p></div><button class="icon-edit" type="button" data-a="edit" aria-label="Изменить запись" title="Изменить">${PENCIL}</button></div>`;
}

function renderDiary() {
  const all = diary.rows || [];
  const goals = all.filter(isOpenGoal).sort((a, b) => PRIO_RANK[a.priority || "mid"] - PRIO_RANK[b.priority || "mid"] || byNewest(a, b));
  const log = all.filter(r => !isOpenGoal(r));
  const days = [...new Set(log.map(r => r.day))];
  const doneGoals = log.filter(r => r.is_goal).length;
  $("diaryStats").textContent = log.length
    ? `${log.length} ${plural(log.length, "запись", "записи", "записей")} за ${days.length} ${plural(days.length, "день", "дня", "дней")}, с ${longDate(log[log.length - 1].day).replace(/^\S+ /, "")}${doneGoals ? `, ${doneGoals} ${plural(doneGoals, "цель достигнута", "цели достигнуты", "целей достигнуто")}` : ""}. Каждая строчка — шаг вперёд.`
    : "Записывай сюда всё, что сделала для поиска работы: отклики, портфолио, созвоны, новые навыки.";
  $("goalsBox").hidden = !goals.length;
  $("goalsLbl").textContent = `Мои цели · ${goals.length}`;
  $("diaryGoals").innerHTML = goals.map(entryHtml).join("");
  $("diaryList").innerHTML = days.map(d => `<div class="dday"><p class="lbl">${esc(longDate(d))}</p>${log.filter(r => r.day === d).map(entryHtml).join("")}</div>`).join("");
}

const resetWhen = () => { $("diaryDay").value = todayIso(); $("diaryTime").value = nowTime(); };
resetWhen();
// the form shows the current date and time; refresh them when I come back to an empty form
$("diaryText").addEventListener("focus", () => { if (!$("diaryText").value.trim()) resetWhen(); });
$("diaryGoal").onchange = () => { $("diaryGoalFields").hidden = !$("diaryGoal").checked; };
$("diaryForm").onsubmit = async e => {
  e.preventDefault();
  const text = $("diaryText").value.trim(), day = $("diaryDay").value || todayIso(), is_goal = $("diaryGoal").checked;
  if (!text) return;
  const entry = { day, at_time: $("diaryTime").value || null, text, is_goal, priority: is_goal ? ($("diaryForm").querySelector("input[name=prio-new]:checked")?.value || "mid") : null };
  $("diarySave").disabled = true;
  const { data, error } = await sb.from("diary").insert(entry).select(DIARY_COLS).single();
  $("diarySave").disabled = false;
  if (error) { showBanner("Запись не сохранилась: " + error.message); return; }
  diary.rows.push(data); diary.rows.sort(byNewest);
  $("diaryText").value = ""; resetWhen(); $("diaryGoal").checked = false; $("diaryGoalFields").hidden = true;
  renderDiary(); toast(is_goal ? "Цель записана. У тебя получится!" : "Записала. Ты молодец!");
};

async function diaryAction(e) {
  const box = e.target.closest(".dentry"); if (!box) return;
  if (e.target.matches(".dgoal")) { box.querySelector(".goal-fields").hidden = !e.target.checked; return; }
  const b = e.target.closest("button[data-a]"); if (!b) return;
  const id = +box.dataset.id, row = diary.rows.find(r => r.id === id);
  const a = b.dataset.a;
  if (a === "edit") { diary.editing = id; renderDiary(); document.querySelector(".dedit").focus(); return; }
  if (a === "cancel") { diary.editing = null; renderDiary(); return; }
  if (a === "del") {
    if (!confirm("Удалить запись?")) return;
    const { error } = await sb.from("diary").delete().eq("id", id);
    if (error) { showBanner("Не удалилось: " + error.message); return; }
    diary.rows = diary.rows.filter(r => r.id !== id); diary.editing = null; renderDiary(); toast("Запись удалена"); return;
  }
  let patch;
  if (a === "done") patch = { done: true, day: todayIso(), at_time: nowTime() }; // a reached goal goes into today's log, now
  else {
    const text = box.querySelector(".dedit").value.trim(); if (!text) return;
    const is_goal = box.querySelector(".dgoal").checked;
    patch = { text, day: box.querySelector(".dday-input").value || row.day, at_time: box.querySelector(".dtime-input").value || null, is_goal,
      priority: is_goal ? (box.querySelector(`input[name=prio-${id}]:checked`)?.value || "mid") : null, done: is_goal && box.querySelector(".ddone").checked };
  }
  const { error } = await sb.from("diary").update(patch).eq("id", id);
  if (error) { showBanner("Не сохранилось: " + error.message); return; }
  Object.assign(row, patch); diary.rows.sort(byNewest);
  diary.editing = null; renderDiary(); toast(a === "done" ? "Цель достигнута! Горжусь тобой" : "Запись обновлена");
}
$("diaryList").addEventListener("click", diaryAction); $("diaryGoals").addEventListener("click", diaryAction);
$("diaryList").addEventListener("change", diaryAction); $("diaryGoals").addEventListener("change", diaryAction);

// ---------- CV with this vacancy's link tag ----------
// The base CVs live in the private Storage bucket "cv" (ru.pdf, en.pdf), their portfolio links carry from=cv-ru / cv-en.
// For a vacancy the links get the same tag as its letter, so portfolio analytics shows where a visit came from;
// the file name stays neutral, so nothing in it tells the company the CV was made for them.
const TRANSLIT = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ы: "y", э: "e", ю: "yu", я: "ya" };
function cvTag(j) {
  const found = (j.letter || "").match(/from=((?:hh|li|tg)-[a-z0-9-]+)/) || (j.comment || "").match(/\b((?:hh|li|tg)-[a-z0-9-]+)/);
  if (found) return found[1];
  const slug = [...(j.company || "").toLowerCase()].map(c => TRANSLIT[c] ?? c).join("").replace(/[^a-z0-9]/g, "").slice(0, 20) || "cv";
  return (j.id.startsWith("tg:") ? "tg-" : j.market === "uae" ? "li-" : "hh-") + slug;
}
async function downloadCv(j) {
  const lang = j.market === "uae" ? "en" : "ru";
  if (!window.PDFLib) await loadScript("https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js");
  const { PDFDocument, PDFName, PDFDict, PDFString } = window.PDFLib;
  const { data, error } = await sb.storage.from("cv").download(lang + ".pdf");
  if (error) throw error;
  const doc = await PDFDocument.load(await data.arrayBuffer());
  const tag = cvTag(j);
  for (const page of doc.getPages()) {
    const annots = page.node.lookup(PDFName.of("Annots"));
    for (const ref of annots ? annots.asArray() : []) {
      const act = doc.context.lookup(ref)?.lookup(PDFName.of("A"));
      const uri = act instanceof PDFDict && act.lookup(PDFName.of("URI"));
      if (uri && /from=cv-/.test(uri.decodeText())) act.set(PDFName.of("URI"), PDFString.of(uri.decodeText().replace(/from=[^&#]*/, "from=" + tag)));
    }
  }
  const url = URL.createObjectURL(new Blob([await doc.save()], { type: "application/pdf" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `CV_Vorobeva_Mariia_${lang.toUpperCase()}.pdf` });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  toast("CV с меткой " + tag);
}
async function uploadCv(lang, file) {
  const { error } = await sb.storage.from("cv").upload(lang + ".pdf", file, { upsert: true, contentType: "application/pdf" });
  if (error) throw error;
  toast("Резюме " + lang.toUpperCase() + " обновлено");
}

// ---------- import from the old Google Sheet (.xlsx download) ----------

const loadScript = src => new Promise((ok, fail) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = fail; document.head.appendChild(s); });

async function importXlsx(file) {
  if (!window.XLSX) await loadScript("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js");
  const wb = window.XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const sheets = [["UAE", "uae"], ["Россия удалёнка", "ru"]];
  const iso = v => v instanceof Date ? v.toISOString().slice(0, 10) : /^\d{2}\.\d{2}\.\d{4}$/.test(String(v)) ? String(v).split(".").reverse().join("-") : /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? String(v).slice(0, 10) : null;
  const rows = [];
  for (const [name, market] of sheets) {
    const ws = wb.Sheets[name]; if (!ws) continue;
    const range = window.XLSX.utils.decode_range(ws["!ref"]);
    const head = [];
    for (let c = range.s.c; c <= range.e.c; c++) head.push(String(ws[window.XLSX.utils.encode_cell({ r: 0, c })]?.v ?? "").trim());
    for (let r = 1; r <= range.e.r; r++) {
      const cell = n => { const c = head.indexOf(n); return c < 0 ? undefined : ws[window.XLSX.utils.encode_cell({ r, c })]; };
      const val = n => { const x = cell(n); return x == null ? "" : x.v instanceof Date ? x.v : String(x.v ?? "").trim(); };
      const vc = cell("Вакансия"); if (!vc) continue;
      const url = vc.l?.Target || (String(vc.f || "").match(/"(https?:[^"]+)"/) || [])[1];
      if (!url) continue;
      const num = url.match(market === "uae" ? /(\d{8,})/ : /vacancy\/(\d+)/);
      if (!num) continue;
      const status = val("Статус") || NEW;
      rows.push({
        id: (market === "uae" ? "li:" : "hh:") + num[1], market, url, title: String(vc.v ?? ""),
        company: val("Компания"), city: val("Город"), work_format: val("Формат"), salary: val("Зарплата"),
        experience: val("Опыт, лет"), posted_at: iso(val("Опубликовано")), applicants: val("Откликов"),
        domain: val("Сфера"), level: val("Уровень"), fit: ["Высокий", "Средний", "Низкий"].includes(val("Совпадение")) ? val("Совпадение") : "Средний",
        why: val("Почему подходит"), description: val("Описание"),
        status: status === "Собес" ? "Собес с лидом" : status, applied_at: iso(val("Дата отклика")),
        reject_stage: val("Этап отказа"), feedback: val("Обратная связь"), skip_reason: val("Причина"),
        comment: val("Комментарий"), letter: val("Сопроводительное"),
      });
    }
  }
  if (!rows.length) { showBanner("В файле не нашлось листов «UAE» и «Россия удалёнка» со ссылками на вакансии."); return; }
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await sb.from("jobs").upsert(rows.slice(i, i + 200), { onConflict: "id" });
    if (error) { showBanner("Импорт остановился: " + error.message); return; }
  }
  toast("Импортировано вакансий: " + rows.length); load();
}

// ---------- auth & wiring ----------

let recovering = false;
async function boot() {
  if (recovering) { $("login").hidden = true; $("app").hidden = true; $("reset").hidden = false; return; }
  $("reset").hidden = true;
  const { data: { session } } = await sb.auth.getSession();
  $("login").hidden = !!session; $("app").hidden = !session;
  if (!session) return;
  cacheLoad(); render(); load();
}

// Email + password. The very first sign-in creates the account; after that sign-ups are closed in Supabase.
$("loginForm").onsubmit = async e => {
  e.preventDefault();
  const email = $("email").value.trim(), password = $("password").value, note = $("loginNote");
  note.textContent = "Вхожу…";
  let { error } = await sb.auth.signInWithPassword({ email, password });
  if (error && /invalid login credentials/i.test(error.message)) {
    const up = await sb.auth.signUp({ email, password });
    error = up.error && /not allowed|disabled/i.test(up.error.message) ? { message: "Неверная почта или пароль." } : up.error;
  }
  note.textContent = error ? "Не получилось: " + error.message : "";
};
// Forgotten password: Supabase emails a link back to this page, which then asks for a new password
$("forgot").onclick = async () => {
  const email = $("email").value.trim(), note = $("loginNote");
  if (!email) { note.textContent = "Впиши почту выше, и я пришлю ссылку для нового пароля."; $("email").focus(); return; }
  note.textContent = "Отправляю…";
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  note.textContent = error ? "Не получилось: " + error.message : "Письмо со ссылкой отправлено на " + email + ". Открой его на этом устройстве.";
};
$("resetForm").onsubmit = async e => {
  e.preventDefault();
  const note = $("resetNote"); note.textContent = "Сохраняю…";
  const { error } = await sb.auth.updateUser({ password: $("newPassword").value });
  if (error) { note.textContent = "Не получилось: " + error.message; return; }
  recovering = false; history.replaceState(null, "", location.pathname); boot();
};
$("logout").onclick = async () => { await sb.auth.signOut(); try { localStorage.removeItem(CACHE_KEY); } catch (e) {} location.reload(); };
// the white thumb of the segmented control slides to the chosen section
function moveThumb() {
  const cur = $("views").querySelector('[aria-selected="true"]'), t = $("viewsThumb");
  if (!cur || !cur.offsetWidth) return;
  t.style.width = cur.offsetWidth + "px"; t.style.transform = `translateX(${cur.offsetLeft}px)`;
  if (!t.classList.contains("ready")) requestAnimationFrame(() => t.classList.add("ready")); // no slide on the first paint
}
addEventListener("resize", moveThumb); document.fonts?.ready.then(moveThumb);
$("views").onclick = e => {
  const b = e.target.closest("button[data-v]"); if (!b) return;
  state.view = b.dataset.v; try { localStorage.setItem("view", state.view); } catch (x) {}
  render();
};
$("tabs").onclick = e => { const b = e.target.closest(".tab"); if (!b) return; state.tab = b.dataset.k; try { localStorage.setItem("tab", state.tab); } catch (x) {} render(); };
$("list").onclick = e => { const b = e.target.closest(".item"); if (!b) return; state.sel[state.tab] = b.dataset.id; render(); if (mobile.matches) { $("detail").scrollTop = 0; openSheet("detail"); } };
["q", "fFit", "fFmt", "sort"].forEach(id => $(id).addEventListener("input", render));
$("sort").addEventListener("change", () => { try { localStorage.setItem("sort", $("sort").value); } catch (e) {} });
$("reload").onclick = load;

// ---------- phone layout: the vacancy and the filters slide up as bottom sheets, the rest hides in the settings menu ----------

const mobile = matchMedia("(max-width:860px)");
let sheetOpen = null;
function openSheet(id) {
  if (sheetOpen === id) return;
  if (sheetOpen) $(sheetOpen).classList.remove("open");
  // the phone's back gesture closes the sheet instead of leaving the app
  history[history.state?.sheet ? "replaceState" : "pushState"]({ sheet: id }, "");
  sheetOpen = id; $(id).classList.add("open"); $("backdrop").hidden = false; document.body.classList.add("locked");
}
function closeSheet(fromHistory) {
  if (!sheetOpen) return;
  $(sheetOpen).classList.remove("open"); sheetOpen = null; $("backdrop").hidden = true; document.body.classList.remove("locked");
  if (!fromHistory && history.state?.sheet) history.back();
}
addEventListener("popstate", () => closeSheet(true));
addEventListener("keydown", e => { if (e.key === "Escape") closeSheet(); });
$("backdrop").onclick = () => closeSheet();
mobile.addEventListener("change", () => { if (!mobile.matches) closeSheet(); });
// pull the sheet down by its top bar to close it
for (const id of ["detail", "filters"]) {
  const el = $(id); let y0 = null;
  el.addEventListener("touchstart", e => { if (!e.target.closest(".sheet-bar, .sheet-head")) return; y0 = e.touches[0].clientY; el.style.transition = "none"; }, { passive: true });
  el.addEventListener("touchmove", e => { if (y0 != null) el.style.transform = `translateY(${Math.max(0, e.touches[0].clientY - y0)}px)`; }, { passive: true });
  el.addEventListener("touchend", e => {
    if (y0 == null) return;
    const dy = e.changedTouches[0].clientY - y0; y0 = null; el.style.transition = el.style.transform = "";
    if (dy > 80) closeSheet();
  });
}

const FILTER_DEFAULTS = { fFit: "", fFmt: "", sort: "date" };
function renderFiltersCount() {
  const n = Object.entries(FILTER_DEFAULTS).filter(([id, v]) => $(id).value !== v).length;
  $("filtersCount").textContent = n; $("filtersCount").hidden = !n;
}
$("filtersBtn").onclick = () => openSheet("filters");
$("filtersDone").onclick = () => closeSheet();
$("filtersReset").onclick = () => {
  for (const [id, v] of Object.entries(FILTER_DEFAULTS)) $(id).value = v;
  try { localStorage.setItem("sort", "date"); } catch (e) {}
  render();
};

const menu = $("menuSheet");
$("menuBtn").onclick = () => { $("menuInstall").hidden = standalone(); menu.showModal(); };
menu.onclick = e => {
  if (e.target === menu) return menu.close(); // tap on the dimmed area
  const b = e.target.closest("button[data-act]"); if (!b) return;
  menu.close();
  ({
    reload: load,
    notify: () => { $("notifyPanel").hidden = false; renderNotify(); scrollTo({ top: 0, behavior: "smooth" }); },
    install: () => install(),
    import: () => $("importFile").click(),
    "cv-ru": () => { $("cvFile").dataset.lang = "ru"; $("cvFile").click(); },
    "cv-en": () => { $("cvFile").dataset.lang = "en"; $("cvFile").click(); },
    logout: () => $("logout").click(),
  })[b.dataset.act]();
};
$("installSheet").onclick = e => { if (e.target === $("installSheet")) $("installSheet").close(); };
$("cvFile").onchange = e => { const f = e.target.files[0]; if (f) uploadCv(e.target.dataset.lang, f).catch(err => showBanner("Резюме не загрузилось: " + err.message)); e.target.value = ""; };
$("importFile").onchange = e => { const f = e.target.files[0]; if (f) importXlsx(f).catch(err => showBanner("Импорт не удался: " + err.message)); e.target.value = ""; };
sb.auth.onAuthStateChange((event) => {
  if (event === "PASSWORD_RECOVERY") recovering = true;
  if (["SIGNED_IN", "SIGNED_OUT", "PASSWORD_RECOVERY"].includes(event)) boot();
});

// ---------- install as an app & push notifications ----------
// The notify function (Supabase) pushes at 12:00 and 20:00 MSK when new relevant vacancies appeared.

const swReady = "serviceWorker" in navigator
  ? navigator.serviceWorker.register("sw.js").then(() => navigator.serviceWorker.ready).catch(() => null)
  : Promise.resolve(null);
let installPrompt = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); installPrompt = e; renderInstall(); if (!$("notifyPanel").hidden) renderNotify(); });
addEventListener("appinstalled", () => { installPrompt = null; renderInstall(); toast("Приложение установлено"); });
const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const pushSupported = () => "PushManager" in window && "Notification" in window && "serviceWorker" in navigator;
function urlB64(s) { const b = atob((s + "=".repeat((4 - s.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(b, c => c.charCodeAt(0)); }
async function currentSub() { const reg = await swReady; return reg ? reg.pushManager.getSubscription() : null; }

async function renderNotify() {
  const st = $("notifyStatus"), hint = $("notifyHint"), tg = $("notifyToggle"), test = $("notifyTest");
  $("installBtn").hidden = standalone();
  hint.textContent = isIOS && !standalone()
    ? "На iPhone уведомления работают только в установленном приложении: Safari → «Поделиться» → «На экран „Домой“», затем открой «Отклики» с иконки и включи уведомления там."
    : "";
  if (!pushSupported()) {
    st.textContent = isIOS && !standalone() ? "Сначала установи приложение на экран «Домой»." : "Этот браузер не поддерживает уведомления.";
    tg.hidden = test.hidden = true; return;
  }
  if (Notification.permission === "denied") {
    st.textContent = "Уведомления запрещены в настройках браузера.";
    hint.textContent = "Разреши уведомления для этого сайта в настройках браузера или телефона и вернись сюда.";
    tg.hidden = test.hidden = true; return;
  }
  const sub = await currentSub();
  st.textContent = sub ? "Включены на этом устройстве." : "Выключены на этом устройстве.";
  tg.hidden = false;
  tg.textContent = sub ? "Выключить на этом устройстве" : "Включить на этом устройстве";
  tg.className = sub ? "btn" : "btn primary";
  test.hidden = !sub;
}

async function toggleNotify() {
  const sub = await currentSub();
  if (sub) {
    await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe(); toast("Уведомления выключены"); return renderNotify();
  }
  if (await Notification.requestPermission() !== "granted") return renderNotify();
  const reg = await swReady;
  const s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(window.JOB_CONFIG.vapidPublicKey) });
  const { error } = await sb.from("push_subscriptions").upsert({ endpoint: s.endpoint, subscription: s.toJSON() });
  if (error) { await s.unsubscribe(); showBanner("Не сохранилась подписка на уведомления: " + error.message); }
  else toast("Уведомления включены");
  renderNotify();
}

$("notifyBtn").onclick = () => {
  const p = $("notifyPanel"); p.hidden = !p.hidden;
  $("notifyBtn").setAttribute("aria-expanded", String(!p.hidden));
  if (!p.hidden) renderNotify();
};
$("notifyClose").onclick = () => { $("notifyPanel").hidden = true; $("notifyBtn").setAttribute("aria-expanded", "false"); };
$("notifyToggle").onclick = () => toggleNotify().catch(e => { showBanner("Не получилось включить уведомления: " + e.message); renderNotify(); });
$("notifyTest").onclick = async () => {
  const { data, error } = await sb.functions.invoke("notify", { body: { test: true } });
  toast(error ? "Не отправилось: " + error.message : data?.sent ? "Отправлено, сейчас придёт" : "Отправить не удалось");
};
// Which device and browser this is, so the install sheet shows the right steps
function deviceInfo() {
  const ua = navigator.userAgent;
  const ios = isIOS, android = /Android/i.test(ua);
  const inApp = /Instagram|FBAN|FBAV|Telegram|Line\/|VK\b|WhatsApp/i.test(ua);
  const browser = /EdgiOS|EdgA|Edg\//.test(ua) ? "edge" : /CriOS|Chrome\//.test(ua) && !/OPR|YaBrowser|SamsungBrowser/.test(ua) ? "chrome"
    : /FxiOS|Firefox\//.test(ua) ? "firefox" : /SamsungBrowser/.test(ua) ? "samsung" : /YaBrowser/.test(ua) ? "yandex"
    : /Safari\//.test(ua) ? "safari" : "other";
  const os = ios ? (/iPad/.test(ua) || navigator.maxTouchPoints > 1 && /Macintosh/.test(ua) ? "iPad" : "iPhone") : android ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "компьютер";
  return { ios, android, inApp, browser, os };
}
const BROWSER = { safari: "Safari", chrome: "Chrome", edge: "Edge", firefox: "Firefox", samsung: "Samsung Internet", yandex: "Яндекс Браузер", other: "браузер" };

function installGuide() {
  const d = deviceInfo();
  const where = `${d.os}, ${BROWSER[d.browser]}`;
  if (d.inApp) return { where: d.os + ", встроенный браузер приложения", steps: [
    "Открой меню «⋯» в правом верхнем углу.",
    d.ios ? "Выбери «Открыть в Safari»." : "Выбери «Открыть в браузере» (лучше Chrome).",
    "В открывшемся браузере снова нажми «Установить приложение»." ], note: "Из встроенного браузера Telegram, Instagram и других приложений установить нельзя." };
  if (d.ios) return { where, steps: d.browser === "safari" ? [
    "Нажми «Поделиться» внизу экрана (квадрат со стрелкой вверх).",
    "Прокрути список и выбери «На экран „Домой“».",
    "Нажми «Добавить». На экране появится зелёная иконка «Отклики».",
    "Открой приложение с иконки и включи там уведомления." ] : [
    "Нажми «Поделиться» в адресной строке (квадрат со стрелкой вверх).",
    "Выбери «На экран „Домой“» (если пункта нет — открой сайт в Safari и сделай то же там).",
    "Открой приложение с иконки и включи там уведомления." ],
    note: "На iPhone уведомления приходят только в установленном приложении (iOS 16.4 и новее)." };
  if (d.android) return { where, steps: d.browser === "samsung" ? [
    "Нажми меню «≡» внизу справа.", "Выбери «Добавить страницу на» → «Главный экран».", "Открой «Отклики» с иконки." ]
    : d.browser === "firefox" ? [ "Нажми меню «⋮».", "Выбери «Установить».", "Открой «Отклики» с иконки." ]
    : [ "Нажми меню «⋮» в правом верхнем углу.", "Выбери «Установить приложение» или «Добавить на главный экран».", "Подтверди. Иконка «Отклики» появится на главном экране." ], note: "" };
  if (d.browser === "safari") return { where, steps: [
    "В меню Safari выбери «Файл» → «Добавить в Dock».", "Нажми «Добавить». «Отклики» появятся в Dock и в Launchpad." ], note: "Нужен macOS Sonoma (Safari 17) или новее." };
  if (d.browser === "firefox") return { where, steps: [
    "Открой сайт в Chrome, Edge или Яндекс Браузере.", "Там нажми «Установить приложение»." ], note: "Firefox на компьютере не умеет устанавливать веб-приложения." };
  return { where, steps: [
    "Нажми значок установки справа в адресной строке (монитор со стрелкой вниз).",
    "Если значка нет: меню «⋮» → «Трансляция, сохранение и отправка» → «Установить страницу как приложение» (в Edge: «⋯» → «Приложения» → «Установить этот сайт как приложение»).",
    "Подтверди. «Отклики» откроются отдельным окном." ], note: "" };
}

async function install() {
  if (installPrompt) {
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice; installPrompt = null; renderInstall();
    if (outcome === "accepted") return;
  }
  const g = installGuide();
  $("installDevice").textContent = "Твоё устройство: " + g.where;
  $("installSteps").innerHTML = g.steps.map(s => `<li>${esc(s)}</li>`).join("");
  $("installNote").textContent = g.note; $("installNote").hidden = !g.note;
  $("installSheet").showModal();
}
function renderInstall() { $("installTop").hidden = standalone(); }
$("installBtn").onclick = install;
$("installTop").onclick = install;
renderInstall();

boot();
