// Opens the app locally with a fake Supabase (made-up vacancies, diary, empty collection) and takes screenshots,
// so a change can be checked before it goes to main. Nothing touches the real database.
//
//   node tools/app_check.js OUT_PREFIX [view] [width]
//     view: jobs | dash | diary | folio | toys (default jobs), width: 1280 (desktop) or 390 (phone)
//   e.g. node tools/app_check.js /tmp/shot diary 390   → /tmp/shot-diary-390.png, page errors printed
//
// Playwright and Chromium are preinstalled in cloud sessions. 3D bags need
// chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }),
// already passed below; software WebGL is slow, so timings in it are not real.
// Never open screenshots of figures Masha has not opened yet: they are secrets, and she sees what Claude opens.
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "web"), [OUT = "/tmp/app", VIEW = "jobs", WIDTH = "1280"] = process.argv.slice(2);
const types = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png" };
const srv = http.createServer((q, r) => {
  const rel = decodeURIComponent(q.url.split("?")[0]), p = path.join(ROOT, rel === "/" ? "index.html" : rel);
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); r.end(d); });
}).listen(8765);

const today = new Date().toISOString().slice(0, 10);
const job = (id, status, applied_at, company, extra = {}) => ({ id, market: "ru", url: "https://example.com", title: "Продуктовый дизайнер", company, city: "", work_format: "удалёнка", salary: "", experience: "",
  posted_at: today, applicants: "", domain: "", level: "", fit: "Высокий", why: "Тестовая вакансия", status, applied_at, reject_stage: "", feedback: "", skip_reason: "", comment: "", letter: "",
  closed_at: null, updated_at: new Date().toISOString(), referral: false, reserve: false, ...extra });
const jobs = [job("hh:1", "Отказ", "2026-11-01", "Альфа", { reject_stage: "Собес с лидом" }), job("hh:2", "Скрининг с HR", "2026-11-10", "Бета"), job("hh:3", "Откликнулась", today, "Гамма"),
  job("hh:4", "Откликнулась", today, "Дельта"), job("hh:5", "Не подходит", null, "Эпсилон"), job("hh:6", "Не откликалась", null, "Зета")];
const ev = (job_id, from_status, to_status) => ({ job_id, from_status, to_status, at: new Date().toISOString(), by_me: true });
const events = [ev("hh:3", "Не откликалась", "Откликнулась"), ev("hh:4", "Не откликалась", "Откликнулась"), ev("hh:5", "Не откликалась", "Не подходит"), ev("hh:1", "Откликнулась", "Отказ"), ev("hh:2", "Откликнулась", "Скрининг с HR")];
const diary = [{ id: 1, day: today, at_time: "10:00", text: "Собес", is_goal: false, priority: null, done: false, kind: "interview" },
  { id: 2, day: today, at_time: null, text: "Подготовить кейс", is_goal: true, priority: "high", done: false, kind: null }];

(async () => {
  const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const ctx = await b.newContext({ viewport: { width: +WIDTH, height: +WIDTH < 600 ? 844 : 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  await ctx.route(/supabase\.co/, route => {
    const u = new URL(route.request().url()), m = route.request().method(), j = (d, s = 200) => route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(d) });
    if (u.pathname.startsWith("/auth/v1/user")) return j({ id: "u1", email: "test@example.com", aud: "authenticated", role: "authenticated" });
    if (u.pathname.startsWith("/auth/") || u.pathname.startsWith("/storage/")) return j({});
    const t = u.pathname.split("/").pop();
    if (m !== "GET") return route.fulfill({ status: 201, contentType: "application/json", body: m === "POST" ? route.request().postData() || "{}" : "{}" });
    return j({ jobs, job_events: events, diary, toy_boxes: [], portfolio_stats: null }[t] ?? []);
  });
  await p.addInitScript(() => localStorage.setItem("sb-iiaqpkynritnvcwjhooh-auth-token", JSON.stringify({ access_token: "a", refresh_token: "r", token_type: "bearer", expires_in: 360000,
    expires_at: Math.floor(Date.now() / 1000) + 360000, user: { id: "u1", email: "test@example.com", aud: "authenticated" } })));
  await p.goto("http://localhost:8765/"); await p.waitForTimeout(2500);
  if (VIEW !== "jobs") { await p.click(`#views [data-v=${VIEW}]`); await p.waitForTimeout(800); }
  const file = `${OUT}-${VIEW}-${WIDTH}.png`; await p.screenshot({ path: file });
  console.log(file); console.log("page errors:", errs.length ? errs : "none");
  // the collection without pictures: bags waiting on the badge, and whether the shelf is still loading
  console.log("toys:", await p.evaluate(() => ({ badge: document.getElementById("toysBadge")?.hidden ? 0 : document.getElementById("toysBadge")?.textContent,
    loading: (document.getElementById("toysHead")?.textContent || "").includes("Загружаю") })));
  await b.close(); srv.close();
})();
