const sb = window.supabase.createClient(window.JOB_CONFIG.supabaseUrl, window.JOB_CONFIG.supabaseAnonKey);

const MARKETS = [
  { key: "uae", label: "ОАЭ", short: "ОАЭ", lang: "en" },
  { key: "ru", label: "Россия, удалёнка", short: "РФ", lang: "ru" },
];
const TABS = [
  { key: "today", label: "Откликнуться сегодня" },
  ...MARKETS.map(m => ({ key: m.key, label: m.label, market: m.key })),
  { key: "applied-uae", label: "Отклики ОАЭ", market: "uae", applied: true },
  { key: "applied-ru", label: "Отклики РФ", market: "ru", applied: true },
  { key: "archive", label: "Архив", archive: true },
];
const FRESH_DAYS = 3, ARCHIVE_DAYS = 14;
// pipeline order matters: the funnel and the "where did it stop" logic read it
const STAGES = ["Откликнулась", "Скрининг с HR", "Собес с лидом", "Тестовое", "Финальный собес", "Оффер"];
const NEW = "Не откликалась", REJECT = "Отказ", SKIP = "Не подходит", RECRUITER = "Написала рекрутеру", CLOSED = "Отклики закрыты";
const ENDED = [SKIP, REJECT, CLOSED];
const SKIP_REASONS = ["Только офис без релокации", "Не мой домен", "Слишком джуниорская роль", "Низкая зарплата", "Нужен арабский", "Это агентство/аутстаф", "Уже откликалась раньше"];
// everything except the long description, which loads when the panel opens
const LIST_COLUMNS = "id,market,url,title,company,city,work_format,salary,experience,posted_at,applicants,domain,level,fit,why,status,applied_at,reject_stage,feedback,skip_reason,comment,letter,closed_at,updated_at";
const CACHE_KEY = "jobs-cache-v1";

const state = { tab: "today", jobs: [], sel: {}, loading: true, desc: {}, loadedAt: null };
try { const t = localStorage.getItem("tab"); if (TABS.some(s => s.key === t)) state.tab = t; } catch (e) {}
try { const s = localStorage.getItem("sort"); if (s && document.querySelector(`#sort option[value="${s}"]`)) document.getElementById("sort").value = s; } catch (e) {}

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, 2400); }
const todayIso = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
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
  state.jobs = data; state.loadedAt = new Date().toISOString(); cacheSave(); render();
}

let writing = Promise.resolve();
function save(job, patch, okMsg) {
  const before = { ...job }; Object.assign(job, patch); render();
  writing = writing.then(async () => {
    const { error } = await sb.from("jobs").update(patch).eq("id", job.id);
    if (error) { Object.assign(job, before); render(); showBanner("Не сохранилось: " + error.message + ". Значение вернула назад, попробуй ещё раз."); return; }
    cacheSave(); toast(okMsg);
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
const isOld = j => (ageDays(j.posted_at) ?? 0) > ARCHIVE_DAYS;
const tabOf = k => TABS.find(t => t.key === k);
function jobsOf(t) {
  if (t.key === "today") return state.jobs.filter(isHot);
  if (t.archive) return state.jobs.filter(j => !isApplied(j) && isOld(j));
  if (t.applied) return state.jobs.filter(j => j.market === t.market && isApplied(j));
  return state.jobs.filter(j => j.market === t.market && !isApplied(j) && !isOld(j));
}
const tabJobs = () => jobsOf(tabOf(state.tab));

function filtered() {
  const q = $("q").value.trim().toLowerCase(), fit = $("fFit").value, fmt = $("fFmt").value, st = $("fStatus").value, sort = $("sort").value;
  const okStatus = j => !st ? true
    : st === "active" ? !ENDED.includes(j.status)
    : st === "new" ? j.status === NEW
    : st === "process" ? ![NEW, ...ENDED].includes(j.status)
    : ENDED.includes(j.status);
  const rows = tabJobs().filter(j =>
    (!q || (j.company + " " + j.title).toLowerCase().includes(q)) &&
    (!fit || j.fit === fit) && (!fmt || (j.work_format || "").includes(fmt)) && okStatus(j));
  const num = s => { const n = parseInt(String(s).replace(/\D/g, ""), 10); return isNaN(n) ? 1e9 : n; };
  const byDate = (a, b) => (b.posted_at || "").localeCompare(a.posted_at || "");
  const fitRank = f => ({ "Высокий": 0, "Средний": 1 }[f] ?? 2);
  const byApplied = (a, b) => (b.applied_at || "").localeCompare(a.applied_at || "") || byDate(a, b);
  const cmp = {
    fit: (a, b) => fitRank(a.fit) - fitRank(b.fit) || byDate(a, b),
    date: byDate,
    "date-old": (a, b) => -byDate(a, b),
    applied: byApplied,
    few: (a, b) => num(a.applicants) - num(b.applicants),
    company: (a, b) => a.company.localeCompare(b.company, "ru"),
  }[sort];
  return rows.sort(cmp);
}

// Furthest pipeline stage a vacancy reached; a rejection counts up to the stage where it stopped
function reached(j) {
  if (j.status === REJECT) return j.reject_stage ? stageIx(j.reject_stage) : 0;
  return stageIx(j.status);
}

function renderSummary() {
  const all = state.jobs, sent = all.filter(j => reached(j) >= 0);
  const items = [
    ["Откликнуться сегодня", all.filter(isHot).length],
    ["Откликов отправлено", sent.length],
    ["В процессе", all.filter(j => stageIx(j.status) >= 1 && j.status !== "Оффер").length],
    ["Офферов", all.filter(j => j.status === "Оффер").length],
  ];
  const dash = state.loading && !all.length;
  $("stats").innerHTML = items.map(([l, n]) => `<div class="stat"><b>${dash ? "–" : n}</b><span>${l}</span></div>`).join("");
  const max = Math.max(1, sent.length);
  $("funnel").innerHTML = `<div class="head"><span>Воронка по этапам</span><span>дошли · отказы на этапе</span></div>` + STAGES.map((s, i) => {
    const got = all.filter(j => reached(j) >= i).length;
    const lost = all.filter(j => j.status === REJECT && reached(j) === i).length;
    return `<div class="frow"><span>${esc(s)}</span><span class="bar" title="${got} дошли, ${lost} отказов на этом этапе"><i style="width:${(got - lost) / max * 100}%"></i><i class="x" style="width:${lost / max * 100}%"></i></span><span class="num"><b>${got}</b>${lost ? " · −" + lost : ""}</span></div>`;
  }).join("");
  $("updated").textContent = state.loadedAt ? "Обновлено " + new Date(state.loadedAt).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "";
}

function renderTabs() {
  const loaded = state.jobs.length > 0;
  $("tabs").innerHTML = TABS.map(t => {
    const n = !loaded ? null : jobsOf(t).filter(j => t.key === "today" || t.archive || (t.applied ? j.status !== REJECT : j.status === NEW)).length;
    const tail = n == null ? "" : `<span class="n">${t.key === "today" || t.archive ? n : n + (t.applied ? " в процессе" : " новых")}</span>`;
    return `<button class="tab ${t.key === "today" ? "today" : ""}" role="tab" type="button" data-k="${t.key}" aria-selected="${t.key === state.tab}">${esc(t.label)}${tail}</button>`;
  }).join("");
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
      : '<div class="empty">Под эти фильтры ничего не подходит. Попробуй «Все статусы» или очисти поиск.</div>';
    return;
  }
  const sel = state.sel[state.tab];
  L.innerHTML = rows.map(j => {
    const bits = [j.company, j.city, j.work_format && j.work_format !== "не указан" ? j.work_format : "", j.salary].filter(Boolean).map(esc).join(" · ");
    const meta = state.tab === "today"
      ? `<span class="src">${marketOf(j.market).short}</span><span class="age">${ageText(ageDays(j.posted_at))}</span>`
      : `${tabOf(state.tab).archive ? `<span class="src">${marketOf(j.market).short}</span>` : ""}<span class="pill ${statusCls(j.status)}">${esc(j.status)}</span>${isApplied(j) && j.applied_at ? `<span class="applied-on">отклик ${esc(ruDate(j.applied_at))}</span>` : esc(ruDate(j.posted_at))}`;
    return `<button class="item" type="button" data-id="${esc(j.id)}" aria-current="${j.id === sel}">
      <span class="stripe ${j.fit === "Высокий" ? "high" : ""}" title="Совпадение: ${esc(j.fit)}"></span>
      <span style="min-width:0"><span class="t">${esc(j.title)}</span><span class="c">${bits}</span></span>
      <span class="meta">${meta}</span>
    </button>`;
  }).join("");
}

function stepsHtml(j) {
  const cur = j.status === REJECT ? -1 : stageIx(j.status);
  const failAt = j.status === REJECT ? reached(j) : -1;
  return STAGES.map((s, i) => {
    let cls = "";
    if (i === failAt) cls = "failed"; else if ((cur >= 0 && i < cur) || (failAt >= 0 && i < failAt)) cls = "done";
    return `<button type="button" data-st="${esc(s)}" class="${cls}" aria-pressed="${i === cur && j.status !== RECRUITER}">${esc(s)}</button>`;
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
    <div>
      <p class="lbl">${esc(m.label)} · ${esc(j.company)}</p>
      <h2><a href="${esc(j.url)}" target="_blank" rel="noopener">${esc(j.title)} ↗</a></h2>
    </div>
    <div class="chips">${appliedChip}${fmtChip}${chips}</div>
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
    </div>
    <div id="extra"></div>
    <div>
      <p class="lbl">Сопроводительное письмо ${m.lang === "en" ? "(английский)" : "(русский)"}</p>
      <textarea class="letter" id="letter" spellcheck="true" placeholder="Письма пока нет. Нажми «Запрос для Claude»: запрос скопируется, вставь его в чат с Claude, а ответ — сюда.">${esc(j.letter)}</textarea>
      <div class="row" style="margin-top:8px">
        <button class="btn primary" type="button" id="copy" ${j.letter ? "" : "disabled"}>Скопировать письмо</button>
        <button class="btn" type="button" id="saveLetter" disabled>Сохранить правки</button>
        <button class="btn" type="button" id="gen">${window.JOB_CONFIG.letterFunction ? (j.letter ? "Переписать заново" : "Написать письмо") : "Запрос для Claude ↗"}</button>
        <span class="note grow" id="letterNote"></span>
      </div>
    </div>
    <div>
      <p class="lbl"><label for="comment">Комментарий</label></p>
      <input class="comment" id="comment" value="${esc(j.comment)}" placeholder="Например: написала Патрисии в LinkedIn">
    </div>`;

  renderExtra(j);
  $("desc").addEventListener("toggle", () => { if ($("desc").open) loadDesc(j); });
  const ta = $("letter");
  ta.addEventListener("input", () => { $("saveLetter").disabled = ta.value === j.letter; $("copy").disabled = !ta.value.trim(); });
  $("copy").onclick = async () => {
    try { await navigator.clipboard.writeText(ta.value); toast("Письмо скопировано"); }
    catch (e) { ta.focus(); ta.select(); toast("Текст выделен: нажми Ctrl+C / ⌘C"); }
  };
  $("saveLetter").onclick = () => save(j, { letter: ta.value }, "Письмо сохранено");
  $("gen").onclick = () => generate(j);
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
      <select id="rjStage">${STAGES.slice(0, -1).map(s => `<option ${s === (j.reject_stage || "Откликнулась") ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>
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
  patch.closed_at = st === CLOSED ? todayIso() : null;
  if (st === REJECT && !j.reject_stage) patch.reject_stage = stageIx(was) >= 0 && was !== "Оффер" ? (was === RECRUITER ? "Откликнулась" : was) : "Откликнулась";
  save(j, patch, st === REJECT ? "Отмечен отказ. Укажи этап и обратную связь" : st === SKIP ? "Отмечено «Не подходит». Можно написать почему" : st === CLOSED ? "Отмечено: отклики закрыты" : "Этап: " + st);
}

function render() {
  renderSummary(); renderTabs();
  const rows = filtered(); renderList(rows); renderDetail(rows);
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

async function boot() {
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
$("logout").onclick = async () => { await sb.auth.signOut(); try { localStorage.removeItem(CACHE_KEY); } catch (e) {} location.reload(); };
$("tabs").onclick = e => { const b = e.target.closest(".tab"); if (!b) return; state.tab = b.dataset.k; try { localStorage.setItem("tab", state.tab); } catch (x) {} render(); };
$("list").onclick = e => { const b = e.target.closest(".item"); if (!b) return; state.sel[state.tab] = b.dataset.id; render(); if (matchMedia("(max-width:860px)").matches) $("detail").scrollIntoView({ behavior: "smooth", block: "start" }); };
["q", "fFit", "fFmt", "fStatus", "sort"].forEach(id => $(id).addEventListener("input", render));
$("sort").addEventListener("change", () => { try { localStorage.setItem("sort", $("sort").value); } catch (e) {} });
$("reload").onclick = load;
$("importFile").onchange = e => { const f = e.target.files[0]; if (f) importXlsx(f).catch(err => showBanner("Импорт не удался: " + err.message)); e.target.value = ""; };
sb.auth.onAuthStateChange((event) => { if (event === "SIGNED_IN" || event === "SIGNED_OUT") boot(); });
boot();
