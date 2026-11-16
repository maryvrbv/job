// ---------- «Коллекция»: blind boxes for the job search ----------
// Boxes are worked out from my own data every time (nothing to tick by hand); the table toy_boxes keeps only
// the opened ones and what fell out of each. Big, rare steps count over the whole history; frequent ones
// (applications, sorted vacancies, active days) count from the day the collection appeared.
const TOYS_LAUNCH = "2026-11-16";
const toys = { opened: null, last: null, queue: [], cur: null };
const mskDay = ts => new Date(ts).toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" });
const toyHash = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const STAGE_BOX = ["Скрининг с HR", "Собес с лидом", "Тестовое", "Финальный собес"];
const STAGE_FIRST = { "Скрининг с HR": "Первый скрининг с HR", "Собес с лидом": "Первый собес с лидом", "Тестовое": "Первое тестовое", "Финальный собес": "Первый финальный собес", "Оффер": "Первый оффер" };

async function loadToys() {
  const { data, error } = await sb.from("toy_boxes").select("key,series,figure,opened_at").order("opened_at");
  if (error) return;
  toys.opened = data || [];
  if (!diary.rows) loadDiary(); // diary interviews and tests bring boxes too
  updateToyBadge(); if (state.view === "toys") renderToys();
}

function earnedBoxes() {
  if (!events || !toys.opened) return null;
  const out = [], add = (key, series, why, day) => out.push({ key, series, why, day: day || todayIso() });
  const byId = Object.fromEntries(state.jobs.map(j => [j.id, j]));
  const who = id => byId[id]?.company || byId[id]?.title || "вакансия";
  const mine = events.filter(e => e.by_me);
  // every rejection, over all time: a fear met face to face
  const rej = new Map();
  for (const e of events) if (e.to_status === REJECT && !rej.has(e.job_id)) rej.set(e.job_id, mskDay(e.at));
  for (const j of state.jobs) if (j.status === REJECT && !rej.has(j.id)) rej.set(j.id, j.updated_at ? mskDay(j.updated_at) : "");
  for (const [id, day] of rej) add("rej:" + id, "monsters", `Отказ от ${who(id)}. Ты встретила страх лицом к лицу`, day);
  // every new hiring stage of every vacancy, over all time; an offer brings three boxes
  const stg = new Map();
  for (const e of events) if (STAGE_BOX.includes(e.to_status) || e.to_status === "Оффер") { const k = e.job_id + "|" + e.to_status; if (!stg.has(k)) stg.set(k, mskDay(e.at)); }
  for (const j of state.jobs) if (STAGE_BOX.includes(j.status) || j.status === "Оффер") { const k = j.id + "|" + j.status; if (!stg.has(k)) stg.set(k, j.applied_at || ""); }
  for (const [k, day] of stg) {
    const [id, st] = k.split("|");
    if (st === "Оффер") ["cats", "dubai", "spirits"].forEach((s, i) => add(`offer:${id}:${i + 1}`, s, `Оффер от ${who(id)}!`, day));
    else add(`stg:${id}:${st}`, "dubai", `${who(id)}: новый этап «${st}»`, day);
  }
  // interviews and test tasks marked in the diary
  for (const r of diary.rows || []) if (r.kind) add("dia:" + r.id, r.kind === "interview" ? "dubai" : "spirits", r.kind === "interview" ? "Собес в дневнике" : "Тестовое в дневнике", r.day);
  // from the launch on: every 5 sorted vacancies (my first decision on a new one), every 2 applications, every active day
  const sorted = [], seenJob = new Set();
  for (const e of mine) if (e.from_status === NEW && !seenJob.has(e.job_id)) { seenJob.add(e.job_id); if (mskDay(e.at) >= TOYS_LAUNCH) sorted.push(mskDay(e.at)); }
  for (let i = 5; i <= sorted.length; i += 5) add("sort:" + i, "spirits", `Разобрано ${i} ${plural(i, "вакансия", "вакансии", "вакансий")}`, sorted[i - 1]);
  const applied = state.jobs.filter(j => isApplied(j) && j.applied_at && j.applied_at >= TOYS_LAUNCH).map(j => j.applied_at).sort();
  for (let i = 2; i <= applied.length; i += 2) add("app:" + i, "spirits", `${i} ${plural(i, "отклик", "отклика", "откликов")} с начала коллекции`, applied[i - 1]);
  const active = new Set(mine.map(e => mskDay(e.at)));
  for (const r of diary.rows || []) if (!isOpenGoal(r)) active.add(r.day);
  for (const d of [...active].filter(d => d >= TOYS_LAUNCH).sort()) add("day:" + d, "cats", "День, когда ты занималась поиском", d);
  // milestones, counted over all time, each once
  const ms = (key, why, series) => add("ms:" + key, series || ["cats", "dubai", "spirits"][toyHash(key) % 3], why, "");
  const nApplied = state.jobs.filter(isApplied).length;
  for (const n of [1, 5, 10, 25, 50, 75, 100, 150, 200]) if (nApplied >= n) ms("app:" + n, n === 1 ? "Первый отклик" : `${n} откликов`);
  for (const n of [25, 50, 100, 200, 300, 500]) if (seenJob.size >= n) ms("sort:" + n, `Разобрано ${n} вакансий`);
  for (const n of [1, 5, 10, 20, 30]) if (rej.size >= n) ms("rej:" + n, n === 1 ? "Пережила первый отказ" : `Пережила ${n} отказов и не сдалась`, "monsters");
  const reached = new Set([...stg.keys()].map(k => k.split("|")[1]));
  for (const st of [...STAGE_BOX, "Оффер"]) if (reached.has(st)) ms("first:" + st, STAGE_FIRST[st]);
  const notes = (diary.rows || []).filter(r => !isOpenGoal(r)), goals = (diary.rows || []).filter(r => r.is_goal && r.done);
  for (const n of [10, 25, 50, 100]) if (notes.length >= n) ms("diary:" + n, `${n} записей в дневнике`);
  for (const n of [1, 5, 10, 25]) if (goals.length >= n) ms("goal:" + n, n === 1 ? "Первая цель достигнута" : `${n} целей достигнуто`);
  const days = [...new Set([...mine.map(e => mskDay(e.at)), ...notes.map(r => r.day)])].sort();
  let best = 0, run = 0, prev = null;
  for (const d of days) { run = prev && (new Date(d) - new Date(prev)) / 864e5 === 1 ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  for (const n of [3, 7, 14, 30]) if (best >= n) ms("streak:" + n, `${n} дней подряд в поиске`);
  if ((folio.data?.tags || []).some(t => t.people > 0 && !GENERIC_TAGS[t.tag] && !/-$/.test(t.tag))) ms("guest:1", "Первый гость пришёл по твоей ссылке");
  return out;
}
const unopened = () => { const e = earnedBoxes(); if (!e) return null; const got = new Set(toys.opened.map(o => o.key)); return e.filter(b => !got.has(b.key)).sort((a, b) => (b.day || "").localeCompare(a.day || "")); };

// the tab carries the number of boxes waiting; a box earned while the app is open says so right away
function updateToyBadge() {
  const list = unopened(); if (!list) return;
  const b = $("toysBadge"); b.textContent = list.length; b.hidden = !list.length;
  if (toys.last != null && list.length > toys.last && state.view !== "toys")
    toast(list.length - toys.last > 1 ? `Новые коробки: ${list.length - toys.last}!` : "Новая коробка! " + list[0].why, { label: "Открыть", run: () => { state.view = "toys"; render(); openUnbox(list[0].key); } });
  if (diary.rows) toys.last = list.length; // start announcing only once the diary is in, or its old boxes would pop up as new
}

// a figure out of the box: common ones weigh 10, rare 4, the secret 1.5 (about 1 in 72, like real blind boxes);
// every 10th box of a series is sure to bring a figure I don't have yet, while there are some left
function rollFigure(seriesKey) {
  const s = toySeries(seriesKey), mine = toys.opened.filter(o => o.series === seriesKey);
  const have = new Set(mine.map(o => o.figure)), missing = s.figures.filter(f => !have.has(f.id));
  const pool = (mine.length + 1) % 10 === 0 && missing.length ? missing : s.figures;
  const w = f => f.rare === 2 ? 1.5 : f.rare === 1 ? 4 : 10;
  let r = Math.random() * pool.reduce((a, f) => a + w(f), 0);
  for (const f of pool) { r -= w(f); if (r <= 0) return f; }
  return pool[pool.length - 1];
}

function renderToys() {
  if (!toys.opened) { $("toysHead").innerHTML = '<p class="note">Загружаю коллекцию…</p>'; if (toys.opened === null) loadToys(); return; }
  if (!diary.rows) loadDiary();
  const list = unopened() || [], total = TOY_SERIES.reduce((a, s) => a + s.figures.length, 0);
  const have = new Set(toys.opened.map(o => o.series + ":" + o.figure));
  $("toysHead").innerHTML = `<div class="stats toy-stats">
      <div class="stat"><b>${have.size}<small> из ${total}</small></b><span>фигурок в коллекции</span></div>
      <div class="stat"><b>${toys.opened.length}</b><span>${plural(toys.opened.length, "коробка открыта", "коробки открыто", "коробок открыто")}</span></div>
      <div class="stat"><b>${list.length}</b><span>${plural(list.length, "коробка ждёт", "коробки ждут", "коробок ждут")}</span></div></div>`;
  $("toysBoxes").innerHTML = list.length ? `<h2 class="fsec">Ждут открытия</h2><div class="box-grid">${list.slice(0, 24).map(b =>
    `<button type="button" class="box-card" data-box="${esc(b.key)}">${boxSvg(b.series, "idle")}<span class="box-series">${esc(toySeries(b.series).short)}</span><span class="box-why">${esc(b.why)}</span></button>`).join("")}</div>
    ${list.length > 24 ? `<p class="note">И ещё ${list.length - 24}. Открывай по одной или подряд, они никуда не денутся</p>` : ""}`
    : `<h2 class="fsec">Ждут открытия</h2><p class="note">Все коробки открыты. Следующая придёт за отклик, разобранные вакансии или просто за день, когда ты что-то сделаешь для поиска.</p>`;
  const counts = {}; for (const o of toys.opened) counts[o.series + ":" + o.figure] = (counts[o.series + ":" + o.figure] || 0) + 1;
  $("toysShelves").innerHTML = TOY_SERIES.map(s => {
    const got = s.figures.filter(f => have.has(s.key + ":" + f.id)).length;
    return `<div class="panel-card shelf"><div class="shelf-head"><h3>${esc(s.name)}</h3><span class="shelf-n">${got}/${s.figures.length}</span></div>
      <p class="rv-meta">Приходят за ${esc(s.for)}</p>
      <div class="shelf-grid">${s.figures.map(f => {
        const n = counts[s.key + ":" + f.id] || 0, rare = f.rare === 2 ? "secret" : f.rare === 1 ? "rare" : "";
        // no silhouettes: what is inside stays a surprise until it falls out of a box
        if (!n) return `<div class="slot empty ${rare}" title="${f.rare === 2 ? "Секретная фигурка" : "Ещё не выпала"}"><span class="slot-q">${f.rare === 2 ? "★" : "?"}</span><span class="slot-name">${f.rare === 2 ? "Секрет" : "???"}</span></div>`;
        return `<button type="button" class="slot ${rare}" data-fig="${s.key}:${f.id}">${toySvg(s.key, f.id)}${n > 1 ? `<span class="slot-x">×${n}</span>` : ""}<span class="slot-name">${esc(f.name)}</span></button>`;
      }).join("")}</div></div>`;
  }).join("") + `<details class="panel-card toy-rules"><summary>За что дают коробки</summary><ul>
      <li><b>Каждый отказ</b> — монстрик страха. Отказ — это смелость, а не провал</li>
      <li><b>Каждый новый этап</b>: скрининг, собес с лидом, тестовое, финал — дубайский зверёк. Оффер — сразу три коробки</li>
      <li><b>Собес или тестовое в дневнике</b> — коробка за каждое</li>
      <li><b>Каждые 2 отклика и каждые 5 разобранных вакансий</b> — дизайн-дух</li>
      <li><b>Каждый день</b>, когда ты что-то сделала: статус, отклик или запись в дневнике — котик</li>
      <li><b>Достижения</b>: первые 1, 5, 10, 25… откликов, серии дней подряд, цели, первый гость по ссылке</li>
      <li>В каждой серии 12 фигурок и 1 секретная, шанс примерно 1 к 72. Каждая 10-я коробка серии — точно новая фигурка</li></ul></details>`;
}

// ---------- unboxing ----------
function openUnbox(key) {
  const list = unopened() || []; const b = list.find(x => x.key === key) || list[0]; if (!b) return;
  toys.cur = b; const u = $("unbox");
  u.innerHTML = `<div class="ub-card ub-sealed" data-series="${esc(b.series)}">
      <button class="btn icon-btn ub-close" type="button" data-ub="close" aria-label="Закрыть">✕</button>
      <p class="ub-why">${esc(b.why)}</p>
      <button type="button" class="ub-box" data-ub="tear" aria-label="Открыть коробку">${boxSvg(b.series, "wiggle")}</button>
      <p class="ub-hint">${esc(toySeries(b.series).name)} · нажми, чтобы открыть</p></div>`;
  u.hidden = false; document.body.classList.add("ub-open");
}
async function tearBox() {
  const b = toys.cur; if (!b || toys.busy) return; toys.busy = true;
  const f = rollFigure(b.series), before = toys.opened.filter(o => o.series === b.series && o.figure === f.id).length;
  const { error } = await sb.from("toy_boxes").insert({ key: b.key, series: b.series, figure: f.id });
  toys.busy = false;
  if (error) { toast(error.code === "23505" ? "Эта коробка уже открыта" : "Не получилось открыть: " + error.message); closeUnbox(); loadToys(); return; }
  toys.opened.push({ key: b.key, series: b.series, figure: f.id, opened_at: new Date().toISOString() });
  toys.last = Math.max(0, (toys.last || 1) - 1); updateToyBadge();
  const card = $("unbox").querySelector(".ub-card"); card.classList.add("ub-tearing");
  const rare = f.rare === 2 ? "secret" : f.rare === 1 ? "rare" : "common", more = (unopened() || []).length;
  const confetti = Array.from({ length: f.rare ? 36 : 22 }, (_, i) => `<i style="--a:${(i * 137) % 360}deg;--d:${60 + (i * 53) % 90}px;--c:${["#ff6b81", "#ffd166", "#4cc9f0", "#80ed99", "#b388eb", "#f4a261"][i % 6]};--t:${(i % 7) * 40}ms"></i>`).join("");
  setTimeout(() => {
    card.className = `ub-card ub-reveal ${rare}`;
    card.innerHTML = `<button class="btn icon-btn ub-close" type="button" data-ub="close" aria-label="Закрыть">✕</button>
      <div class="ub-stage"><div class="ub-rays" aria-hidden="true"></div><div class="ub-confetti" aria-hidden="true">${confetti}</div>${toySvg(b.series, f.id, "ub-fig")}</div>
      <p class="ub-badge">${before ? `Повтор · теперь ×${before + 1}` : f.rare === 2 ? "Секретная фигурка!" : f.rare === 1 ? "Редкая! Новинка в коллекции" : "Новинка в коллекции!"}</p>
      <h3 class="ub-name">${esc(f.name)}</h3><p class="ub-line">${esc(f.line)}</p><p class="ub-hint">${esc(toySeries(b.series).name)}</p>
      <div class="ub-actions">${more ? `<button type="button" class="btn primary" data-ub="next">Следующая коробка · ${more}</button>` : ""}<button type="button" class="btn" data-ub="close">В коллекцию</button></div>`;
  }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 900);
}
function showFigure(seriesKey, figId) {
  const s = toySeries(seriesKey), f = toyFigure(seriesKey, figId), mine = toys.opened.filter(o => o.series === seriesKey && o.figure === figId);
  $("unbox").innerHTML = `<div class="ub-card ub-reveal ${f.rare === 2 ? "secret" : f.rare === 1 ? "rare" : "common"} still"><button class="btn icon-btn ub-close" type="button" data-ub="close" aria-label="Закрыть">✕</button>
    <div class="ub-stage"><div class="ub-rays" aria-hidden="true"></div>${toySvg(seriesKey, figId, "ub-fig")}</div>
    <p class="ub-badge">${f.rare === 2 ? "Секретная" : f.rare === 1 ? "Редкая" : "Обычная"} · ×${mine.length}</p>
    <h3 class="ub-name">${esc(f.name)}</h3><p class="ub-line">${esc(f.line)}</p><p class="ub-hint">${esc(s.name)} · впервые ${esc(shortDate(mskDay(mine[0].opened_at)))}</p></div>`;
  $("unbox").hidden = false; document.body.classList.add("ub-open");
}
function closeUnbox() { $("unbox").hidden = true; $("unbox").innerHTML = ""; document.body.classList.remove("ub-open"); toys.cur = null; if (state.view === "toys") renderToys(); }
$("unbox").addEventListener("click", e => {
  const a = e.target.closest("[data-ub]")?.dataset.ub;
  if (a === "tear") return tearBox();
  if (a === "next") return openUnbox();
  if (a === "close" || e.target === $("unbox")) return closeUnbox();
});
addEventListener("keydown", e => { if (e.key === "Escape" && !$("unbox").hidden) closeUnbox(); });
$("toysBoxes").addEventListener("click", e => { const b = e.target.closest("[data-box]"); if (b) openUnbox(b.dataset.box); });
$("toysShelves").addEventListener("click", e => { const b = e.target.closest("[data-fig]"); if (b) { const [s, f] = b.dataset.fig.split(":"); showFigure(s, f); } });
