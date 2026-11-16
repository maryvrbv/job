// ---------- «Коллекция»: blind boxes for the job search ----------
// Boxes are worked out from my own data every time (nothing to tick by hand); the table toy_boxes keeps only
// the opened ones and what fell out of each. Everything counts from the day the collection appeared, plus a small
// welcome pack, so old history does not flood the shelf. A box has no series: the series is rolled when it opens.
const TOYS_LAUNCH = "2026-11-16";
const toys = { opened: null, last: null, cur: null };
const toyHash = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const mskDay = ts => new Date(ts).toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" });
const STAGE_BOX = ["Скрининг с HR", "Собес с лидом", "Тестовое", "Финальный собес"]; // the process, not the offer
const FOLIO_STEP = 4, SORT_STEP = 3, NOTE_STEP = 2; // a box for every 4 portfolio visits, 3 sorted vacancies, 2 diary notes

async function loadToys() {
  const { data, error } = await sb.from("toy_boxes").select("key,series,figure,opened_at").order("opened_at");
  if (error) return;
  toys.opened = data || [];
  if (!diary.rows) loadDiary(); // diary interviews and tests bring boxes too
  updateToyBadge(); if (state.view === "toys") renderToys();
}

function earnedBoxes() {
  if (!events || !toys.opened) return null;
  // tag: what the box is for in a word or two, printed on the box; why: the longer story
  const out = [], add = (key, tag, why, day) => out.push({ key, tag, why, day: day || todayIso() });
  const after = d => d && d >= TOYS_LAUNCH;
  const byId = Object.fromEntries(state.jobs.map(j => [j.id, j]));
  const who = id => byId[id]?.company || byId[id]?.title || "вакансия";
  for (let i = 1; i <= 5; i++) add("start:" + i, "Старт", "Стартовый набор: добро пожаловать в коллекцию", TOYS_LAUNCH);
  // every rejection: a fear met face to face
  const rej = new Map();
  for (const e of events) if (e.to_status === REJECT && !rej.has(e.job_id)) rej.set(e.job_id, mskDay(e.at));
  for (const j of state.jobs) if (j.status === REJECT && !rej.has(j.id) && j.updated_at) rej.set(j.id, mskDay(j.updated_at));
  for (const [id, day] of rej) if (after(day)) add("rej:" + id, "Отказ", `${who(id)}. Отказ — это смелость, а не провал`, day);
  // every new stage of the process; the offer is a reward of its own
  const stg = new Map();
  for (const e of events) if (STAGE_BOX.includes(e.to_status)) { const k = e.job_id + "|" + e.to_status; if (!stg.has(k)) stg.set(k, mskDay(e.at)); }
  for (const j of state.jobs) if (STAGE_BOX.includes(j.status)) { const k = j.id + "|" + j.status; if (!stg.has(k)) stg.set(k, j.applied_at || ""); }
  for (const [k, day] of stg) { const [id, st] = k.split("|"); if (after(day)) add(`stg:${id}:${st}`, "Новый этап", `${who(id)}: ${st}`, day); }
  // interviews and test tasks marked in the diary
  for (const r of diary.rows || []) if (r.kind && after(r.day)) add("dia:" + r.id, r.kind === "interview" ? "Собес" : "Тестовое", r.text.slice(0, 80), r.day);
  // the diary itself: every 2 notes and every reached goal
  const notes = (diary.rows || []).filter(r => !r.is_goal && after(r.day)).map(r => r.day).sort();
  for (let i = NOTE_STEP; i <= notes.length; i += NOTE_STEP) add("note:" + i, "Дневник", `${i} ${plural(i, "запись", "записи", "записей")} в дневнике`, notes[i - 1]);
  for (const r of diary.rows || []) if (r.is_goal && r.done && after(r.day)) add("goal:" + r.id, "Цель", r.text.slice(0, 80), r.day);
  // every 5 sorted vacancies (my first decision on a new one) and every 2 applications
  const sorted = [], seenJob = new Set();
  for (const e of events) if (e.by_me && e.from_status === NEW && !seenJob.has(e.job_id)) { seenJob.add(e.job_id); if (after(mskDay(e.at))) sorted.push(mskDay(e.at)); }
  for (let i = SORT_STEP; i <= sorted.length; i += SORT_STEP) add("sort:" + i, "Разбор вакансий", `Разобрано ${i} ${plural(i, "вакансия", "вакансии", "вакансий")}`, sorted[i - 1]);
  // every application
  for (const j of state.jobs) if (isApplied(j) && after(j.applied_at)) add("app1:" + j.id, "Отклик", who(j.id), j.applied_at);
  // every 8 visits of people to the portfolio: one guest on one day is one visit
  const visits = Object.values(folio.data?.guests || {}).flatMap(g => g.days.map(d => d.day)).filter(after).sort();
  for (let i = FOLIO_STEP; i <= visits.length; i += FOLIO_STEP) add("folio:" + i, "Портфолио", `${i} ${plural(i, "заход", "захода", "заходов")} людей в портфолио`, visits[i - 1]);
  return out;
}
const unopened = () => { const e = earnedBoxes(); if (!e) return null; for (const b of e) b.series = seriesOf(b.key); const got = new Set(toys.opened.map(o => o.key)); return e.filter(b => !got.has(b.key)).sort((a, b) => (b.day || "").localeCompare(a.day || "")); };

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
// a box gets its series from its key: random to me, unrelated to what it was for, the same on every visit
const seriesOf = key => TOY_SERIES[toyHash("s" + key) % TOY_SERIES.length].key;
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
  const have = new Set(toys.opened.map(o => o.series + ":" + o.figure)), dups = toys.opened.length - have.size;
  $("toysHead").innerHTML = `<div class="stats toy-stats">
      <div class="stat"><b>${have.size}<small> из ${total}</small></b><span>фигурок в коллекции</span></div>
      <div class="stat"><b>${dups}</b><span>${plural(dups, "повторка", "повторки", "повторок")}</span></div>
      <div class="stat"><b>${list.length}</b><span>${plural(list.length, "коробка ждёт", "коробки ждут", "коробок ждут")}</span></div></div>`;
  $("toysBoxes").innerHTML = list.length ? `<h2 class="fsec">Ждут открытия</h2><div class="box-grid">${list.slice(0, 24).map(b =>
    `<button type="button" class="box-card" data-box="${esc(b.key)}"><span class="box-tag">${esc(b.tag)}</span><span class="tet-mini">${tetHtml(b.series, { S: 34, cls: "spin" })}</span><span class="box-series">${esc(toySeries(b.series).short)}</span><span class="box-why">${esc(b.why)}</span></button>`).join("")}</div>
    ${list.length > 24 ? `<p class="note">И ещё ${list.length - 24}. Открывай по одной или подряд, они никуда не денутся</p>` : ""}`
    : `<h2 class="fsec">Ждут открытия</h2><p class="note">Все коробки открыты. Следующая придёт за отклики, разобранные вакансии, собес, тестовое, новый этап, отказ или заходы в портфолио.</p>`;
  const counts = {}; for (const o of toys.opened) counts[o.series + ":" + o.figure] = (counts[o.series + ":" + o.figure] || 0) + 1;
  $("toysShelves").innerHTML = TOY_SERIES.map(s => {
    const got = s.figures.filter(f => have.has(s.key + ":" + f.id)).length;
    return `<div class="panel-card shelf"><div class="shelf-head"><h3>${esc(s.name)}</h3><span class="shelf-n">${got}/${s.figures.length}</span></div>
      <div class="shelf-grid">${s.figures.map(f => {
        const n = counts[s.key + ":" + f.id] || 0, rare = f.rare === 2 ? "secret" : f.rare === 1 ? "rare" : "";
        // every empty slot looks the same: no silhouettes and no hint which one is the secret
        if (!n) return `<div class="slot empty" title="Ещё не выпала"><span class="slot-q">?</span><span class="slot-name">???</span></div>`;
        return `<button type="button" class="slot ${rare}" data-fig="${s.key}:${f.id}">${toySvg(s.key, f.id)}${n > 1 ? `<span class="slot-x" title="Повторки">+${n - 1}</span>` : ""}<span class="slot-name">${esc(f.name)}</span>${n > 1 ? `<span class="slot-dup">${n - 1} ${plural(n - 1, "повторка", "повторки", "повторок")}</span>` : ""}</button>`;
      }).join("")}</div></div>`;
  }).join("") + `<details class="panel-card toy-rules"><summary>За что дают коробки</summary><ul>
      <li><b>Каждый отклик</b></li>
      <li><b>Каждые 3 разобранные вакансии</b>: отклик или «не подходит»</li>
      <li><b>Каждый отказ</b>. Отказ — это смелость, а не провал</li>
      <li><b>Каждый новый этап</b>: скрининг, собес с лидом, тестовое, финал. Оффер — награда сам по себе</li>
      <li><b>Собес или тестовое в дневнике</b> — коробка за каждое</li>
      <li><b>Каждые 2 записи в дневнике и каждая достигнутая цель</b></li>
      <li><b>Каждые 4 захода людей в портфолио</b></li>
      <li>Серию видно по цвету пирамидки, а какая фигурка внутри — сюрприз. Серия не зависит от того, за что дана коробка. В каждой серии 13 фигурок, одна из них секретная и очень редкая. Каждая 10-я коробка серии — точно новая фигурка, остальные могут быть повторками</li>
      <li>Считается всё с 16 ноября, когда появилась коллекция. За старт — 5 коробок</li></ul></details>`;
}

// ---------- unboxing ----------
// The pouch sits in 3D: drag it to spin and tilt (the holographic sheen follows), pull the notch at the top
// to tear the corner off, a small tap on the notch tears it by itself. Soft sounds and a vibration on phones.
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
let actx = null, muted = false;
try { muted = localStorage.getItem("toys-muted") === "1"; } catch (e) {}
function sfx(kind) {
  if (muted) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const now = actx.currentTime, g = actx.createGain(); g.connect(actx.destination);
    if (kind === "pop") { // a bright little «plop» when the figure jumps out
      const o = actx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(520, now); o.frequency.exponentialRampToValueAtTime(1300, now + 0.12);
      g.gain.setValueAtTime(0.12, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.22); o.connect(g); o.start(now); o.stop(now + 0.25); return;
    }
    const dur = kind === "rip" ? 0.32 : kind === "crinkle" ? 0.12 : 0.035, buf = actx.createBuffer(1, Math.ceil(actx.sampleRate * dur), actx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, kind === "rip" ? 1.2 : 2.5) * (Math.random() < (kind === "tick" ? 1 : 0.18) ? 1 : 0.35);
    const src = actx.createBufferSource(), f = actx.createBiquadFilter(); src.buffer = buf; f.type = "bandpass";
    f.frequency.value = kind === "rip" ? 2600 : kind === "crinkle" ? 5200 : 3800; f.Q.value = 0.9;
    g.gain.value = kind === "rip" ? 0.32 : kind === "crinkle" ? 0.05 : 0.09; src.connect(f).connect(g); src.start(now);
  } catch (e) {}
}
const buzz = p => { try { navigator.vibrate?.(p); } catch (e) {} };

// springs in the SwiftUI sense (response, bounce): the bag swings back to rest with a little bounce
class Spring {
  constructor(x, response = 0.5, bounce = 0) { this.x = this.to = x; this.v = 0; this.k = (2 * Math.PI / response) ** 2; this.c = 4 * Math.PI * (1 - bounce) / response; }
  step(h) { this.v += (this.k * (this.to - this.x) - this.c * this.v) * h; this.x += this.v * h; }
}
const pz = { rx: -14, ry: -28, vx: 0, drag: null, tear: 0, done: false, raf: 0, t0: 0, last: 0, tilt: new Spring(-14, 0.6, 0.35), squeeze: new Spring(1, 0.25, 0.5) };
function openUnbox(key) {
  const list = unopened() || []; const b = list.find(x => x.key === key) || list[0]; if (!b) return;
  toys.cur = b; const u = $("unbox");
  Object.assign(pz, { rx: -14, ry: -28, vx: 0, drag: null, tear: 0, done: false, t0: performance.now(), last: performance.now(), tilt: new Spring(-14, 0.6, 0.35), squeeze: new Spring(1, 0.25, 0.5) });
  u.innerHTML = `<div class="ub-card ub-sealed">
      <button class="btn icon-btn ub-close" type="button" data-ub="close" aria-label="Закрыть">✕</button>
      <button class="btn icon-btn ub-mute" type="button" data-ub="mute" aria-pressed="${muted}" aria-label="${muted ? "Включить звук" : "Выключить звук"}">${muted ? "🔇" : "🔊"}</button>
      <p class="ub-why"><span class="box-tag">${esc(b.tag)}</span><br>${esc(b.why)}</p>
      <div class="pz-stage" id="pzStage"><div class="pz-shadow" id="pzShadow"></div><div class="pz" id="pz">${tetHtml(b.series, { tag: b.tag, S: 86, cls: "live" })}</div><span class="pz-notch" aria-hidden="true"></span></div>
      <p class="ub-hint">${esc(toySeries(b.series).name)} · покрути пирамидку и потяни верхний шов вбок, чтобы надорвать</p>
      <button type="button" class="btn ub-tap" data-ub="tear">Открыть одним нажатием</button></div>`;
  u.hidden = false; document.body.classList.add("ub-open");
  const stage = $("pzStage");
  stage.addEventListener("pointerdown", pzDown); stage.addEventListener("pointermove", pzMove);
  stage.addEventListener("pointerup", pzUp); stage.addEventListener("pointercancel", pzUp);
  cancelAnimationFrame(pz.raf); pz.raf = requestAnimationFrame(pzLoop);
}
function pzDown(e) {
  if (pz.done) return;
  const r = $("pzStage").getBoundingClientRect(), y = (e.clientY - r.top) / r.height;
  const nearTear = y < 0.3; // the top seam: grab it and pull sideways to tear
  pz.drag = { mode: nearTear ? "tear" : "spin", x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), p0: pz.tear };
  e.currentTarget.setPointerCapture(e.pointerId);
  pz.squeeze.to = nearTear ? 0.96 : 0.98; // the bag gives a little under the fingers
  if (!nearTear) sfx("crinkle");
}
function pzMove(e) {
  const d = pz.drag; if (!d) return;
  if (d.mode === "spin") {
    const dx = e.clientX - d.x, dy = e.clientY - d.y, dt = Math.max(16, performance.now() - d.t);
    pz.ry += dx * 0.6; pz.rx = Math.max(-50, Math.min(40, pz.rx - dy * 0.4)); pz.tilt.x = pz.rx; pz.tilt.v = 0;
    pz.vx = dx * 0.6 / dt * 16; d.vy = -dy * 0.4 / dt * 16;
    if (Math.abs(dx) + Math.abs(dy) > 18 && Math.random() < 0.25) sfx("crinkle");
  } else {
    const t = Math.max(pz.tear, Math.min(1, d.p0 + Math.abs(e.clientX - d.sx) / 120));
    if (Math.floor(t * 10) > Math.floor(pz.tear * 10)) { sfx("tick"); buzz(4); }
    pz.tear = t; pzTearDraw();
    if (t >= 0.97) finishTear();
  }
  d.x = e.clientX; d.y = e.clientY; d.t = performance.now();
}
function pzUp(e) {
  const d = pz.drag; pz.drag = null; pz.squeeze.to = 1; if (!d || pz.done) return;
  if (d.mode === "spin") { pz.tilt.x = pz.rx; pz.tilt.v = (d.vy || 0) * 60; }
  if (d.mode === "tear" && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 8) autoTear(); // a tap on the seam tears it by itself
}
function pzTearDraw() {
  const top = $("tetTop"); if (!top) return;
  top.style.setProperty("--tear", pz.tear.toFixed(3)); // the cut runs along the seam, the fin lifts as it goes
}
function autoTear() {
  if (pz.done) return;
  const from = pz.tear, t0 = performance.now(), dur = reduced() ? 1 : 520;
  const step = now => {
    const k = Math.min(1, (now - t0) / dur), t = from + (1 - from) * (1 - Math.pow(1 - k, 2));
    if (Math.floor(t * 10) > Math.floor(pz.tear * 10)) { sfx("tick"); buzz(4); }
    pz.tear = t; pzTearDraw(); if (k < 1) requestAnimationFrame(step); else finishTear();
  };
  requestAnimationFrame(step);
}
function pzLoop(now) {
  const el = $("pz"); if (!el) return;
  const h = Math.min(0.05, (now - pz.last) / 1000); pz.last = now;
  pz.squeeze.step(h);
  if (!pz.drag) { // the spin glides on and slows down; the tilt springs back to rest with a small bounce
    pz.ry += pz.vx; pz.vx *= 0.95;
    pz.tilt.step(h); pz.rx = pz.tilt.x;
    if (!pz.done && Math.abs(pz.vx) < 0.05 && !reduced()) pz.ry += Math.sin((now - pz.t0) / 900) * 0.15; // idle sway
  }
  const float = reduced() || pz.done ? 0 : Math.sin((now - pz.t0) / 700) * 5;
  el.style.transform = `translateY(${float}px) scale(${pz.squeeze.x})`;
  el.firstElementChild.style.transform = `rotateX(${pz.rx}deg) rotateY(${pz.ry}deg)`;
  $("pzShadow").style.transform = `scale(${1 - float / 60})`;
  tetShade(el, pz.rx, pz.ry);
  pz.raf = requestAnimationFrame(pzLoop);
}
async function finishTear() {
  if (pz.done) return; pz.done = true; pz.tear = 1; pzTearDraw();
  sfx("rip"); buzz([12, 40, 22]);
  $("unbox").querySelector(".ub-card").classList.add("pz-torn");
  pz.vx = 0;
  await tearBox();
}
async function tearBox() {
  const b = toys.cur; if (!b || toys.busy) return; toys.busy = true;
  const f = rollFigure(b.series), before = toys.opened.filter(o => o.series === b.series && o.figure === f.id).length;
  const { error } = await sb.from("toy_boxes").insert({ key: b.key, series: b.series, figure: f.id });
  toys.busy = false;
  if (error) { toast(error.code === "23505" ? "Эта коробка уже открыта" : "Не получилось открыть: " + error.message); closeUnbox(); loadToys(); return; }
  toys.opened.push({ key: b.key, series: b.series, figure: f.id, opened_at: new Date().toISOString() });
  toys.last = Math.max(0, (toys.last || 1) - 1); updateToyBadge();
  const card = $("unbox").querySelector(".ub-card");
  const rare = f.rare === 2 ? "secret" : f.rare === 1 ? "rare" : "common", more = (unopened() || []).length;
  const confetti = Array.from({ length: f.rare ? 36 : 22 }, (_, i) => `<i style="--a:${(i * 137) % 360}deg;--d:${60 + (i * 53) % 90}px;--c:${["#ff6b81", "#ffd166", "#4cc9f0", "#80ed99", "#b388eb", "#f4a261"][i % 6]};--t:${(i % 7) * 40}ms"></i>`).join("");
  setTimeout(() => {
    cancelAnimationFrame(pz.raf); sfx("pop"); buzz(18);
    card.className = `ub-card ub-reveal ${rare}`;
    card.innerHTML = `<button class="btn icon-btn ub-close" type="button" data-ub="close" aria-label="Закрыть">✕</button>
      <div class="ub-stage"><div class="ub-rays" aria-hidden="true"></div><div class="ub-confetti" aria-hidden="true">${confetti}</div>${toySvg(b.series, f.id, "ub-fig")}</div>
      <p class="ub-badge">${before ? `Повторка · у тебя их ${before}` : f.rare === 2 ? "Секретная фигурка!" : f.rare === 1 ? "Редкая! Новинка в коллекции" : "Новинка в коллекции!"}</p>
      <h3 class="ub-name">${esc(f.name)}</h3><p class="ub-line">${esc(f.line)}</p><p class="ub-hint">${esc(toySeries(b.series).name)}</p>
      <div class="ub-actions">${more ? `<button type="button" class="btn primary" data-ub="next">Следующая коробка · ${more}</button>` : ""}<button type="button" class="btn" data-ub="close">В коллекцию</button></div>`;
  }, reduced() ? 0 : 950);
}
function showFigure(seriesKey, figId) {
  const s = toySeries(seriesKey), f = toyFigure(seriesKey, figId), mine = toys.opened.filter(o => o.series === seriesKey && o.figure === figId);
  $("unbox").innerHTML = `<div class="ub-card ub-reveal ${f.rare === 2 ? "secret" : f.rare === 1 ? "rare" : "common"} still"><button class="btn icon-btn ub-close" type="button" data-ub="close" aria-label="Закрыть">✕</button>
    <div class="ub-stage"><div class="ub-rays" aria-hidden="true"></div>${toySvg(seriesKey, figId, "ub-fig")}</div>
    <p class="ub-badge">${f.rare === 2 ? "Секретная" : f.rare === 1 ? "Редкая" : "Обычная"}${mine.length > 1 ? ` · ${mine.length - 1} ${plural(mine.length - 1, "повторка", "повторки", "повторок")}` : ""}</p>
    <h3 class="ub-name">${esc(f.name)}</h3><p class="ub-line">${esc(f.line)}</p><p class="ub-hint">${esc(s.name)} · впервые ${esc(shortDate(mskDay(mine[0].opened_at)))}</p></div>`;
  $("unbox").hidden = false; document.body.classList.add("ub-open");
}
function closeUnbox() { cancelAnimationFrame(pz.raf); $("unbox").hidden = true; $("unbox").innerHTML = ""; document.body.classList.remove("ub-open"); toys.cur = null; if (state.view === "toys") renderToys(); }
$("unbox").addEventListener("click", e => {
  const a = e.target.closest("[data-ub]")?.dataset.ub;
  if (a === "tear") return autoTear();
  if (a === "mute") { muted = !muted; try { localStorage.setItem("toys-muted", muted ? "1" : "0"); } catch (x) {} const m = e.target.closest("[data-ub]"); m.textContent = muted ? "🔇" : "🔊"; m.setAttribute("aria-pressed", muted); m.setAttribute("aria-label", muted ? "Включить звук" : "Выключить звук"); if (!muted) sfx("crinkle"); return; }
  if (a === "next") return openUnbox();
  if (a === "close" || e.target === $("unbox")) return closeUnbox();
});
addEventListener("keydown", e => { if (e.key === "Escape" && !$("unbox").hidden) closeUnbox(); });
$("toysBoxes").addEventListener("click", e => { const b = e.target.closest("[data-box]"); if (b) openUnbox(b.dataset.box); });
$("toysShelves").addEventListener("click", e => { const b = e.target.closest("[data-fig]"); if (b) { const [s, f] = b.dataset.fig.split(":"); showFigure(s, f); } });
