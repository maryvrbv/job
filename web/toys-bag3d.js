// ---------- the mystery bag in real 3D (WebGL through three.js) ----------
// The same bag, settings and gestures as createBag in toys-bag.js, drawn as a real puffed pouch: the front and back
// panels are inflated meshes that meet at flat crimped seams; the foil has a crinkle relief (a normal map) and is lit
// by soft studio light, so highlights and reflections slide across it as it tilts; the sticker is matte with a
// holographic sheen. The tear runs along the ragged line in the mesh itself: the strip above it rolls up toward you,
// the mouth gapes and shows the silver inside. The glow, the stars and the figure are the same page layers as in the
// flat bag. bagMount falls back to the flat bag when WebGL or the library is not available.
const BAG3D_LIB = "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";
let bag3dLib = null, bag3dCan = null;
const bag3dLoad = () => (bag3dLib ||= import(BAG3D_LIB));
function bag3dOk() {
  if (bag3dCan === null) try { const c = document.createElement("canvas"), g = c.getContext("webgl2") || c.getContext("webgl"); bag3dCan = !!g; g?.getExtension("WEBGL_lose_context")?.loseContext(); } catch (e) { bag3dCan = false; }
  return bag3dCan;
}
const bag3dCss = `
.bg-gl{position:absolute;inset:0;width:100%;height:100%;z-index:2;display:block}
.bg-stage.bg3d .bg-fx{z-index:5}`;

// colours: mix two hex colours (t from 0 to 1) into an rgb() string
function bag3dMix(a, b, t) {
  const h = s => { s = s.replace("#", ""); if (s.length === 3) s = [...s].map(c => c + c).join(""); return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16)); };
  const A = h(a), B = h(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",")})`;
}
// the printed foil, roughness, holo and relief maps, drawn on canvases in the bag's own proportions
function bag3dMaps(THREE, P, W, H, blink, mascotImg) {
  const TW = 512, TH = Math.round(TW * H / W), k = TW / W, c = P.crimp / 100 * H;
  const canvas = () => { const cv = document.createElement("canvas"); cv.width = TW; cv.height = TH; return [cv, cv.getContext("2d")]; };
  const crimpStripe = (g, a, b) => { for (const y0 of [0, H - c]) for (let x = 0; x < W; x += 4) { g.fillStyle = a; g.fillRect(x * k, y0 * k, 2 * k, c * k); g.fillStyle = b; g.fillRect((x + 2) * k, y0 * k, 2 * k, c * k); } };
  const notches = g => { g.save(); g.globalCompositeOperation = "destination-out"; for (const x of [0, W]) { g.beginPath(); const y = c - 0.01 * H; g.moveTo((x - 6) * k, y * k); g.lineTo(x * k, (y - 6) * k); g.lineTo((x + 6) * k, y * k); g.lineTo(x * k, (y + 6) * k); g.fill(); } g.restore(); };
  // a little seeded random, so the pattern is the same on every redraw (the blink redraws the front)
  let seed = [...String(P.tint) + P.title].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const srnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pattern = [];
  for (let i = 0; i < 46; i++) pattern.push({ x: srnd() * W, y: c + 6 + srnd() * (H - 2 * c - 12), r: 2 + srnd() * 5.5, kind: srnd(), rot: srnd() * 6.28, a: 0.45 + srnd() * 0.5 });
  const sparkle = (g, x, y, r, rot) => { g.save(); g.translate(x * k, y * k); g.rotate(rot); g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = (i % 2 ? r * 0.28 : r) * k; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.fill(); g.restore(); };
  // holographic foil all over: the series colour as a pale metallic base, a scatter of sparkles, dots and question
  // marks printed on it, the mascot and the title printed straight on the foil (no sticker)
  function print(front, closedEyes) {
    const [cv, g] = canvas(), base = bag3dMix(P.tint, "#ffffff", 0.22);
    const gr = g.createLinearGradient(0, 0, 0, TH); gr.addColorStop(0, bag3dMix(P.tint, "#ffffff", 0.45)); gr.addColorStop(0.5, base); gr.addColorStop(1, bag3dMix(P.tint, "#8a7fb0", 0.12));
    g.fillStyle = gr; g.fillRect(0, 0, TW, TH);
    crimpStripe(g, bag3dMix(P.tint, "#9aa0ad", 0.35), bag3dMix(P.tint, "#ffffff", 0.7));
    for (const q of pattern) {
      if (front && Math.abs(q.x - W / 2) < W * 0.3 && q.y > H * 0.22 && q.y < H * 0.8 && q.kind < 0.8) continue; // keep the middle calm for the mascot
      g.globalAlpha = q.a;
      if (q.kind < 0.55) { g.fillStyle = "#ffffff"; sparkle(g, q.x, q.y, q.r, q.rot); }
      else if (q.kind < 0.8) { g.fillStyle = bag3dMix(P.tint, P.ink, 0.35); g.beginPath(); g.arc(q.x * k, q.y * k, q.r * 0.38 * k, 0, 6.28); g.fill(); }
      else { g.fillStyle = bag3dMix(P.tint, "#ffffff", 0.8); g.font = `900 ${q.r * 3.2 * k}px Nunito, "Arial Rounded MT Bold", system-ui, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.save(); g.translate(q.x * k, q.y * k); g.rotate(q.rot * 0.25 - 0.4); g.fillText("?", 0, 0); g.restore(); }
    }
    g.globalAlpha = 1;
    if (front) {
      g.strokeStyle = bag3dMix(P.tint, "#ffffff", 0.75); g.lineWidth = 1.5 * k; g.setLineDash([4 * k, 3 * k]); g.beginPath(); g.moveTo(0.07 * W * k, (c + 0.025 * H) * k); g.lineTo(0.93 * W * k, (c + 0.025 * H) * k); g.stroke(); g.setLineDash([]);
      const tSize = 0.092 * W, sSize = 0.046 * W, mW = P.mascot ? W * 0.5 : 0, mH = mW * 70 / 80, block = mH + tSize * 1.2 + (P.subtitle ? sSize * 1.5 : 0);
      let y = (H - block) / 2 + 0.02 * H;
      if (P.mascot) { // a soft white halo, then the mascot
        const hg = g.createRadialGradient(W / 2 * k, (y + mH * 0.55) * k, 0, W / 2 * k, (y + mH * 0.55) * k, mW * 0.75 * k); hg.addColorStop(0, "rgba(255,255,255,.75)"); hg.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = hg; g.fillRect(0, 0, TW, TH);
        if (mascotImg?.[closedEyes ? 1 : 0]) g.drawImage(mascotImg[closedEyes ? 1 : 0], (W / 2 - mW / 2) * k, y * k, mW * k, mH * k);
      }
      y += mH; g.textAlign = "center"; g.textBaseline = "top"; g.lineJoin = "round";
      g.font = `900 ${tSize * k}px Nunito, "Arial Rounded MT Bold", system-ui, sans-serif`;
      g.lineWidth = tSize * 0.32 * k; g.strokeStyle = "#ffffff"; g.strokeText(P.title || "", W / 2 * k, (y + tSize * 0.1) * k, W * 0.86 * k);
      g.fillStyle = P.ink; g.fillText(P.title || "", W / 2 * k, (y + tSize * 0.1) * k, W * 0.86 * k); y += tSize * 1.2;
      if (P.subtitle) { g.font = `800 ${sSize * k}px Nunito, system-ui, sans-serif`; g.lineWidth = sSize * 0.35 * k; g.strokeText(P.subtitle, W / 2 * k, (y + sSize * 0.2) * k, W * 0.8 * k); g.globalAlpha = 0.85; g.fillText(P.subtitle, W / 2 * k, (y + sSize * 0.2) * k, W * 0.8 * k); g.globalAlpha = 1; }
    }
    notches(g);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  // roughness (green): glossy foil, satin crimps; holo strength (red): full on the foil, less on the crimps
  const [rcv, rg] = canvas(); rg.fillStyle = "rgb(0,58,0)"; rg.fillRect(0, 0, TW, TH); rg.fillStyle = "rgb(0,110,0)"; rg.fillRect(0, 0, TW, c * k); rg.fillRect(0, (H - c) * k, TW, c * k);
  const [icv, ig] = canvas(); ig.fillStyle = "#fff"; ig.fillRect(0, 0, TW, TH); ig.fillStyle = "#b0b0b0"; ig.fillRect(0, 0, TW, c * k); ig.fillRect(0, (H - c) * k, TW, c * k);
  { const cx = W / 2 * k, cy = H * 0.52 * k, hg = ig.createRadialGradient(cx, cy, 0, cx, cy, W * 0.42 * k); hg.addColorStop(0, "rgba(40,40,40,.85)"); hg.addColorStop(0.7, "rgba(40,40,40,.5)"); hg.addColorStop(1, "rgba(40,40,40,0)"); ig.fillStyle = hg; ig.fillRect(0, 0, TW, TH); }
  // relief: soft dents and a few sharp creases, ribbed crimps, a calmer sticker; turned into normals
  const hf = new Float32Array(TW * TH), rnd = Math.random;
  for (const [cell, amp] of [[64, 1], [26, 0.45], [11, 0.18]]) {
    const gx = Math.ceil(TW / cell) + 2, gy = Math.ceil(TH / cell) + 2, grid = Float32Array.from({ length: gx * gy }, () => rnd() * 2 - 1);
    for (let y = 0; y < TH; y++) { const fy = y / cell, j = fy | 0, ty = fy - j, sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < TW; x++) { const fx = x / cell, i = fx | 0, tx = fx - i, sx = tx * tx * (3 - 2 * tx), a = grid[j * gx + i], b = grid[j * gx + i + 1], cc = grid[(j + 1) * gx + i], d = grid[(j + 1) * gx + i + 1];
        hf[y * TW + x] += amp * (a + (b - a) * sx + (cc - a + (a - b - cc + d) * sx) * sy); } }
  }
  for (let n = 0; n < 26; n++) { // creases: straight-ish ridges and valleys
    const px = rnd() * TW, py = rnd() * TH, an = rnd() * Math.PI, nx = Math.cos(an), ny = Math.sin(an), wd = 1.2 + rnd() * 2.6, amp = (rnd() < 0.5 ? -1 : 1) * (0.25 + rnd() * 0.45), len = 60 + rnd() * 220;
    const x0 = Math.max(0, Math.floor(px - len)), x1 = Math.min(TW, Math.ceil(px + len)), y0 = Math.max(0, Math.floor(py - len)), y1 = Math.min(TH, Math.ceil(py + len));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const dx = x - px, dy = y - py, along = dx * ny - dy * nx, dist = Math.abs(dx * nx + dy * ny); if (dist < wd && Math.abs(along) < len) hf[y * TW + x] += amp * (1 - dist / wd) * (1 - Math.abs(along) / len); }
  }
  const normals = () => {
    const h = Float32Array.from(hf), ck = c * k;
    for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
      const i = y * TW + x;
      if (y < ck || y > TH - ck) h[i] = 0.55 * Math.sin(2 * Math.PI * x / (4 * k)) + h[i] * 0.15;
      else if (x < 0.05 * TW || x > 0.95 * TW) h[i] *= 0.3;
    }
    const [cv, g] = canvas(), img = g.createImageData(TW, TH), D = img.data, s = 2.4;
    for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
      const l = h[y * TW + Math.max(0, x - 1)], r = h[y * TW + Math.min(TW - 1, x + 1)], u = h[Math.max(0, y - 1) * TW + x], dn = h[Math.min(TH - 1, y + 1) * TW + x];
      let nx = (l - r) * s, ny = (dn - u) * s, nz = 1; const m = Math.hypot(nx, ny, nz); nx /= m; ny /= m; nz /= m;
      const o = (y * TW + x) * 4; D[o] = (nx * 0.5 + 0.5) * 255; D[o + 1] = (ny * 0.5 + 0.5) * 255; D[o + 2] = (nz * 0.5 + 0.5) * 255; D[o + 3] = 255;
    }
    g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; return t;
  };
  // the inside: silver right under the edge, then the dark of the bag
  const [ncv, ng] = canvas(), gr = ng.createLinearGradient(0, 0, 0, TH);
  for (const [o, col] of [[0, "#f1f3f6"], [0.12, "#d9dde3"], [0.16, "#a19fac"], [0.27, "#3b3142"], [1, "#221a25"]]) gr.addColorStop(o, col);
  ng.fillStyle = gr; ng.fillRect(0, 0, TW, TH);
  const tex = cv => new THREE.CanvasTexture(cv), inner = tex(ncv); inner.colorSpace = THREE.SRGBColorSpace;
  // the thickness of the holo film (green) wanders over the bag, so the rainbow comes in patches and bands
  const [tcv, tg] = canvas(), timg = tg.createImageData(TW, TH), TD = timg.data, cell = 170, gx = Math.ceil(TW / cell) + 2, gy = Math.ceil(TH / cell) + 2, ng2 = Float32Array.from({ length: gx * gy }, () => rnd());
  for (let y = 0; y < TH; y++) { const fy = y / cell, j = fy | 0, ty = fy - j, sy = ty * ty * (3 - 2 * ty);
    for (let x = 0; x < TW; x++) { const fx = x / cell, i = fx | 0, tx = fx - i, sx = tx * tx * (3 - 2 * tx), a = ng2[j * gx + i], b = ng2[j * gx + i + 1], cc = ng2[(j + 1) * gx + i], d = ng2[(j + 1) * gx + i + 1];
      const nv = a + (b - a) * sx + (cc - a + (a - b - cc + d) * sx) * sy, v = Math.round(255 * (0.5 + 0.5 * Math.sin((x + y * 0.7) / TW * Math.PI * 2.2 + nv * 3 + hf[y * TW + x] * 0.25)));
      const o = (y * TW + x) * 4; TD[o] = TD[o + 1] = TD[o + 2] = v; TD[o + 3] = 255; } }
  tg.putImageData(timg, 0, 0);
  const nm = normals();
  return { front: print(true, false), frontBlink: print(true, true), back: print(false), rough: tex(rcv), holo: tex(icv), thick: tex(tcv), nFront: nm, nBack: nm, inner };
}
// a soft studio to reflect: a light room, a big softbox up left, a smaller one to the right and a pink bounce below
function bag3dStudio(THREE, renderer) {
  const scene = new THREE.Scene(), geo = new THREE.SphereGeometry(50, 32, 16), col = [], pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const t = (pos.getY(i) / 50 + 1) / 2, a = [0.62, 0.58, 0.66], b = [1.05, 1.04, 1.06]; col.push(...a.map((v, j) => v + (b[j] - v) * t)); }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true })));
  const box = (w, h, x, y, z, rgb) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(...rgb), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); scene.add(m); };
  box(34, 22, -22, 28, 26, [5, 5, 5]); box(14, 30, 34, 6, 22, [1.6, 2.6, 3.2]); box(50, 10, 0, -26, 18, [3, 1.4, 2.4]); box(30, 30, 0, 10, -45, [1.4, 1.4, 1.5]);
  box(16, 16, -38, -6, 12, [2.8, 1.6, 3.2]); box(20, 12, 20, 30, 10, [3.2, 2.8, 1.4]);
  const pm = new THREE.PMREMGenerator(renderer), env = pm.fromScene(scene, 0.035).texture; pm.dispose(); geo.dispose(); return env;
}

function createBag3D(THREE, stage, P0, opts = {}) {
  bagInjectCss();
  if (!document.getElementById("bg3d-css")) { const s = document.createElement("style"); s.id = "bg3d-css"; s.textContent = bag3dCss; document.head.append(s); }
  const P = opts.live ? Object.assign(P0, { ...BAG_DEFAULTS, ...P0 }) : { ...BAG_DEFAULTS, ...P0 };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches, D2R = Math.PI / 180;
  const buzz = p => { if (P.haptics) try { navigator.vibrate?.(p); } catch (e) {} };
  const S = {
    state: "idle", t0: performance.now(), last: performance.now(), dir: 1, p: 0, pTo: 0, pv: 0, drag: null, pointer: null, fly: null, auto: false, openAt: 0,
    nudgeAt: (P.wiggle || 999) + Math.random() * 2, blinkAt: 1.6, blinkTill: 0, roll: 0.8 + Math.random() * 0.6, stars: [], emitAcc: 0, twinkleAt: 0, key: "",
    rx: new BagSpring(-6, P.response, P.bounce), ry: new BagSpring(0, P.response, P.bounce), rz: new BagSpring(0, P.response * 0.85, P.bounce),
    y: new BagSpring(0, P.response * 0.85, P.bounce), stretch: new BagSpring(1, 0.35, 0.55), lift: new BagSpring(0, 0.3, 0.35),
  };
  const jag = (() => { // a ragged line across the top, fresh for every bag (as in the flat bag)
    const k = P.ragged, y0 = 10 + (P.crimp - 9) * 0.6 + Math.random() * 1.5, slope = (Math.random() - 0.5) * 2 * k, bow = (Math.random() - 0.5) * 2 * k;
    const wob = (0.25 + Math.random() * 0.45) * k, freq = 1.5 + Math.random() * 2, ph = Math.random() * 6.28; let walk = 0;
    return Array.from({ length: BAG_N + 1 }, (_, i) => {
      const x = i / BAG_N * 100, s = x / 50 - 1;
      walk = Math.max(-1.2, Math.min(1.2, walk + (Math.random() - 0.5) * 0.3 * k + (Math.random() < 0.04 ? (Math.random() - 0.5) * 1.6 * k : 0)));
      return [x, y0 + slope * s + bow * (1 - s * s) + wob * Math.sin(s * freq * Math.PI + ph) + walk];
    });
  })();
  const yAt = x => { const f = Math.max(0, Math.min(100, x)) / 100 * BAG_N, i = Math.min(BAG_N - 1, f | 0); return jag[i][1] + (jag[i + 1][1] - jag[i][1]) * (f - i); };
  const NR = 16, rays = Array.from({ length: NR }, (_, j) => ({ x: 6 + 88 * (j + 0.5) / NR, c: BAG_RAY_COLORS[j % BAG_RAY_COLORS.length], g: new BagSpring(0, 0.45, 0.3), on: false, ph: Math.random() * 6.28, len: 40 + Math.random() * 22 }));

  stage.classList.add("bg-stage", "bg3d"); stage.classList.remove("opened"); bagLook(stage, P);
  stage.innerHTML = `<svg class="bg-rays" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs>${rays.map((r, j) => `<radialGradient id="bgr${j}" cx=".5" cy=".75" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".35" stop-color="${r.c}" stop-opacity=".85"/><stop offset="1" stop-color="${r.c}" stop-opacity="0"/></radialGradient>`).join("")}</defs>${rays.map((r, j) => `<path id="bgr-p${j}" fill="url(#bgr${j})" d=""/>`).join("")}</svg>
    <div class="bg-fig"${opts.figId ? ` id="${opts.figId}"` : ""} aria-hidden="true">${opts.figure || ""}</div><div class="bg-shadow"></div>
    <canvas class="bg-gl" aria-label="Пакетик-сюрприз"></canvas><canvas class="bg-fx"></canvas>`;
  const $q = s => stage.querySelector(s);
  const rayEls = rays.map((_, j) => $q("#bgr-p" + j)), raysEl = $q(".bg-rays"), fx = $q(".bg-fx"), g2 = fx.getContext("2d"), fig = $q(".bg-fig"), shadow = $q(".bg-shadow");

  // ---- the scene ----
  const renderer = new THREE.WebGLRenderer({ canvas: $q(".bg-gl"), antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.05; renderer.setClearColor(0, 0);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, 10, 4000); camera.position.set(0, 0, 1100);
  scene.environment = bag3dStudio(THREE, renderer);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcdbcd9, 0.32));
  const sun = new THREE.DirectionalLight(0xffffff, 0.95); sun.position.set(-0.7, 1, 0.9); scene.add(sun);
  const root = new THREE.Group(), pack = new THREE.Group(), inner = new THREE.Group(), stripG = new THREE.Group();
  scene.add(root); root.add(pack); pack.add(inner); inner.add(stripG);
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = 2 * Math.atan(h / 2 / 1100) / D2R; camera.updateProjectionMatrix();
    S.cy = h / 2 - (70 + P.h / 2); // where the bag's centre sits, as in the flat bag
  }
  const ro = new ResizeObserver(resize); ro.observe(stage);

  let W, H, maps, mats, geos, meshes = [], mascot = null;
  const mascotSvg = closed => `<svg xmlns="http://www.w3.org/2000/svg" ${bagMascot(P.star).slice(5)}`.replace(closed ? /<g class="bg-eyes">[\s\S]*?<\/g>/ : /^$/, closed ? `<path d="M29.5 41.5q2.5 1.6 5 0M45.5 41.5q2.5 1.6 5 0" stroke="#3b2b33" stroke-width="1.3" fill="none" stroke-linecap="round"/>` : "");
  let mascotStar = null;
  function loadMascot() {
    mascotStar = P.star; const imgs = [false, true].map(cl => { const im = new Image(); im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(mascotSvg(cl)); return im; });
    Promise.all(imgs.map(im => im.decode())).then(() => { mascot = imgs; build(); if (opts.still) snap(); }).catch(() => { if (opts.still) snap(); });
  }
  // the pillow: flat seams, the middle puffed out, the sides pulled in by the puff, a bump where the figure lies
  function shape(X, Y, side) {
    const c = P.crimp / 100 * H, ax = Math.min(1, Math.max(0, (W / 2 - Math.abs(X) - 0.03 * W) / (0.2 * W))), ay = Math.min(1, Math.max(0, (Math.min(H / 2 - Y, Y + H / 2) - c) / (0.22 * H)));
    const sm = t => t * t * (3 - 2 * t), fx = sm(ax), fy = sm(ay), f = Math.pow(fx * fy, 0.75);
    let z = side * (0.7 + P.puff * 0.14 * W * f);
    if (side > 0) z += P.lump * 0.06 * W * f * Math.exp(-((X / (0.27 * W)) ** 2 + ((Y + 0.1 * H) / (0.3 * H)) ** 2));
    return [X * (1 - 0.07 * P.puff * fy), Y * (1 - 0.025 * P.puff * fx), z];
  }
  function grid(side, part) {
    const NX = BAG_N, NY = part === "body" ? 40 : 5, pos = [], uv = [], meta = [], idx = [];
    for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
      const xp = jag[i][0], X = (xp / 100 - 0.5) * W, yTop = H / 2 - jag[i][1] / 100 * H, t = j / NY;
      const Y = part === "body" ? -H / 2 + (yTop + H / 2) * t : yTop + (H / 2 - yTop) * t;
      pos.push(...shape(X, Y, side)); uv.push(xp / 100, Y / H + 0.5); meta.push(X, Y, yTop);
    }
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; side > 0 ? idx.push(a, b, d, a, d, c) : idx.push(a, d, b, a, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    g.userData = { base: Float32Array.from(pos), meta: Float32Array.from(meta), side }; return g;
  }
  function build() {
    W = P.w; H = P.h; S.key = "";
    for (const m of meshes) inner.remove(m), stripG.remove(m);
    geos && Object.values(geos).forEach(g => g.dispose()); mats && Object.values(mats).forEach(m => m.dispose()); maps && Object.values(maps).forEach(t => t.dispose());
    maps = bag3dMaps(THREE, P, W, H, false, mascot);
    const n = new THREE.Vector2(P.wrink * 0.95, P.wrink * 0.95), holo = Math.min(1, 0.35 + P.holo * 1.8);
    const common = { roughness: 1.3 - 0.5 * P.sheen, roughnessMap: maps.rough, metalness: 0.55, clearcoat: 0.3 + 0.4 * P.sheen, clearcoatRoughness: 0.25, envMapIntensity: 0.75 + 0.6 * P.sheen, transparent: true, alphaTest: 0.02, normalScale: n,
      iridescence: holo, iridescenceMap: maps.holo, iridescenceIOR: 1.5, iridescenceThicknessMap: maps.thick, iridescenceThicknessRange: [200, 700] };
    const front = new THREE.MeshPhysicalMaterial({ ...common, map: maps.front, normalMap: maps.nFront });
    const back = new THREE.MeshPhysicalMaterial({ ...common, map: maps.back, normalMap: maps.nBack });
    const ins = new THREE.MeshStandardMaterial({ map: maps.inner, metalness: 0.85, roughness: 0.34, normalMap: maps.nBack, normalScale: n, side: THREE.BackSide, transparent: true, alphaTest: 0.02, envMapIntensity: 1 });
    mats = { front, back, ins, sFront: front.clone(), sBack: back.clone(), sIns: ins.clone() };
    geos = { bf: grid(1, "body"), bb: grid(-1, "body"), sf: grid(1, "strip"), sb: grid(-1, "strip") };
    meshes = [[geos.bf, mats.front, inner], [geos.bf, mats.ins, inner], [geos.bb, mats.back, inner], [geos.bb, mats.ins, inner],
      [geos.sf, mats.sFront, stripG], [geos.sf, mats.sIns, stripG], [geos.sb, mats.sBack, stripG], [geos.sb, mats.sIns, stripG]].map(([g, m, parent]) => { const me = new THREE.Mesh(g, m); parent.add(me); return me; });
    resize(); deform(S.p, true);
  }
  // the tear: the mouth gapes over the torn stretch, the strip rolls up from the tip of the tear
  const AX = new Float32Array(400), AZ = new Float32Array(400), AT = new Float32Array(400);
  function deform(p, force) {
    const d = S.dir, xt = d > 0 ? -W / 2 + p * W : W / 2 - p * W, open = S.state === "open";
    const key = `${p.toFixed(4)}|${S.lift.x.toFixed(2)}|${open}|${Math.abs(S.pv) > 0.02 ? Math.round(performance.now() / 33) : 0}`;
    if (!force && key === S.key) return; S.key = key;
    const x0 = d > 0 ? -W / 2 : xt, x1 = d > 0 ? xt : W / 2, span = Math.max(1, x1 - x0), gMax = p > 0 ? (4 + 11 * Math.min(1, span / W)) * (0.5 + 0.6 * P.puff) * (open ? 1.5 : 1) : 0;
    for (const g of [geos.bf, geos.bb]) {
      const a = g.attributes.position.array, b = g.userData.base, m = g.userData.meta, side = g.userData.side;
      for (let v = 0, n = m.length / 3; v < n; v++) {
        const X = m[v * 3], Y = m[v * 3 + 1], yTop = m[v * 3 + 2]; let x = b[v * 3], y = b[v * 3 + 1], z = b[v * 3 + 2];
        if (gMax && X >= x0 && X <= x1) {
          const w = Math.max(0, 1 - (yTop - Y) / (0.17 * H)) ** 2, gg = gMax * Math.max(0, Math.sin(Math.PI * (X - x0) / span)) ** 0.7 * w;
          if (side > 0) { z += gg; y -= gg * 0.35; } else { z -= gg * 0.55; y += gg * 0.12; }
        }
        a[v * 3] = x; a[v * 3 + 1] = y; a[v * 3 + 2] = z;
      }
      g.attributes.position.needsUpdate = true; g.computeVertexNormals();
    }
    // the arc the strip rolls along: out from the tip each step bends a little more (as the slices of the flat bag)
    const bend = ((3.5 + 4 * p) * S.roll * P.curl + S.lift.x) * D2R, w9 = W / 9, ds = 2, t = (performance.now() - S.t0) / 1000, jit = Math.min(1, Math.abs(S.pv) * 0.4) * 1.6 * D2R;
    AX[0] = AZ[0] = AT[0] = 0;
    for (let n = 1; n < 400; n++) { const s = n * ds, th = Math.min(3.4, bend * (0.4 * s / w9 + 0.16 * (s / w9) ** 2) + Math.sin(t * 16 + s / w9 * 0.9) * jit * (s / w9)), tm = (th + AT[n - 1]) / 2; AT[n] = th; AX[n] = AX[n - 1] + Math.cos(tm) * ds; AZ[n] = AZ[n - 1] + Math.sin(tm) * ds; }
    for (const g of [geos.sf, geos.sb]) {
      const a = g.attributes.position.array, b = g.userData.base, m = g.userData.meta;
      for (let v = 0, n = m.length / 3; v < n; v++) {
        const X = m[v * 3], s = p > 0 ? (d > 0 ? xt - X : X - xt) : 0, x = b[v * 3], y = b[v * 3 + 1], z = b[v * 3 + 2];
        if (s <= 0) { a[v * 3] = x; a[v * 3 + 1] = y; a[v * 3 + 2] = z; continue; }
        const f = Math.min(398, s / ds), i = f | 0, q = f - i, ax = AX[i] + (AX[i + 1] - AX[i]) * q, az = AZ[i] + (AZ[i + 1] - AZ[i]) * q, th = AT[i] + (AT[i + 1] - AT[i]) * q;
        a[v * 3] = xt - d * ax + d * z * Math.sin(th); a[v * 3 + 1] = y + az * 0.6; a[v * 3 + 2] = az + z * Math.cos(th);
      }
      g.attributes.position.needsUpdate = true; g.computeVertexNormals();
    }
  }
  function drawRays(t) { // the soft pink light from the mouth, as in the flat bag
    const xt = S.dir > 0 ? S.p * 100 : 100 - S.p * 100, since = S.openAt ? t - S.openAt : -1;
    rays.forEach((r, j) => {
      if (P.rays && S.p > 0 && (S.dir > 0 ? r.x < xt : r.x > xt)) r.on = true;
      r.g.to = !r.on ? 0 : since < 0 ? 1 : since < 0.25 ? 1.45 : 0;
      const g = Math.max(0, r.g.x), L = r.len * g * (1 + Math.sin(t * 1.3 + r.ph) * 0.08), base = (70 + yAt(r.x) / 100 * P.h) / (70 + 0.3 * P.h) * 100 + 3;
      if (L < 0.5) { rayEls[j].setAttribute("d", ""); return; }
      const cx = r.x + (r.x - 50) * 0.12 * g, rx = 5 + 7 * g, ry = L * 0.55, cy = base - ry * 0.75;
      rayEls[j].setAttribute("d", `M${(cx - rx).toFixed(2)} ${cy.toFixed(2)}a${rx.toFixed(2)} ${ry.toFixed(2)} 0 1 0 ${(2 * rx).toFixed(2)} 0a${rx.toFixed(2)} ${ry.toFixed(2)} 0 1 0 ${(-2 * rx).toFixed(2)} 0Z`);
    });
    raysEl.style.transform = `translateY(${S.y.x.toFixed(1)}px) rotate(${(S.rz.x * 0.6).toFixed(2)}deg)`;
  }
  function emit(n, burst) {
    const R = fx.getBoundingClientRect(), SR = stage.getBoundingClientRect(), left = SR.left - R.left + SR.width / 2 - P.w / 2, top = SR.top - R.top + 70 + S.y.x, xt = S.dir > 0 ? S.p : 1 - S.p;
    for (let i = 0; i < n; i++) {
      const u = burst ? Math.random() : S.dir > 0 ? Math.random() * xt : xt + Math.random() * (1 - xt), x = left + u * P.w, y = top + yAt(u * 100) / 100 * P.h;
      const sp = burst ? 260 + Math.random() * 520 : 90 + Math.random() * 200, a = -Math.PI / 2 + (Math.random() - 0.5) * (burst ? 2.2 : 1.2) + (u - 0.5) * 0.8;
      S.stars.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: (burst ? 4 : 2.6) + Math.random() * (burst ? 6 : 4), rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 6,
        life: 0, max: 0.9 + Math.random() * (burst ? 1.2 : 0.7), c: BAG_STAR_COLORS[(Math.random() * BAG_STAR_COLORS.length) | 0], tw: Math.random() * 6.28, pts: Math.random() < 0.6 ? 4 : 5 });
    }
  }
  function drawStars(dt) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), Wc = fx.clientWidth, Hc = fx.clientHeight;
    if (fx.width !== Wc * dpr) { fx.width = Wc * dpr; fx.height = Hc * dpr; }
    g2.setTransform(dpr, 0, 0, dpr, 0, 0); g2.clearRect(0, 0, Wc, Hc);
    S.stars = S.stars.filter(s => (s.life += dt) < s.max);
    for (const s of S.stars) {
      s.vy += 380 * dt; s.vx *= 0.985; s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt;
      const k = s.life / s.max, alpha = (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85) * (0.75 + 0.25 * Math.sin(s.tw + s.life * 18)), r = s.r * (0.7 + 0.3 * Math.sin(s.tw + s.life * 9));
      g2.save(); g2.translate(s.x, s.y); g2.rotate(s.rot); g2.globalAlpha = Math.max(0, alpha); g2.shadowColor = s.c; g2.shadowBlur = r * 3.2; g2.fillStyle = s.c; g2.beginPath();
      const inn = s.pts === 4 ? r * 0.28 : r * 0.45;
      for (let i = 0; i < s.pts * 2; i++) { const a = i * Math.PI / s.pts, rr = i % 2 ? inn : r; g2.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      g2.closePath(); g2.fill(); g2.shadowBlur = 0; g2.globalAlpha = Math.max(0, alpha) * 0.9; g2.fillStyle = "#fff"; g2.beginPath(); g2.arc(0, 0, r * 0.22, 0, 6.28); g2.fill(); g2.restore();
    }
  }
  function finish() {
    if (S.state !== "idle") return;
    S.state = "open"; S.pTo = S.p = 1; S.openAt = (performance.now() - S.t0) / 1000; deform(1, true);
    bagSfx(P, "rip"); buzz([14, 40, 24]);
    S.fly = { x: 0, y: 0, vx: S.dir * P.throw * 0.14, vy: -P.throw, rz: 0, vrz: S.dir * (220 + Math.random() * 200), rx: 0, vrx: -380 };
    S.y.v += 260; S.rz.v -= S.dir * 40;
    if (P.stars && !reduced) emit(Math.round(46 * P.starCount), true);
    stage.classList.add("opened");
    if (opts.figure) setTimeout(() => { fig.classList.add("rise"); bagSfx(P, "pop"); buzz(18); }, 220);
    opts.onOpen?.();
  }
  function auto() { if (S.state !== "idle") return; if (!S.pTo) S.dir = Math.random() < 0.5 ? 1 : -1; S.auto = true; }
  const onDown = e => { if (S.state !== "idle" || e.button) return; stage.setPointerCapture(e.pointerId); bagSfx(P, "crinkle"); S.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, p0: S.pTo, moved: false, dy: 0 }; };
  const onMove = e => {
    const r = stage.getBoundingClientRect(); S.pointer = [(e.clientX - r.left) / r.width * 2 - 1, (e.clientY - r.top) / r.height * 2 - 1];
    const d = S.drag; if (!d || e.pointerId !== d.id || S.state !== "idle") return;
    const dx = e.clientX - d.x0; let dy = e.clientY - d.y0;
    if (!d.moved) { if (Math.hypot(dx, dy) < 6) return; d.moved = true; }
    if (S.pTo === 0) { d.dy = dy; if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 0.6) return; S.dir = dx < 0 ? -1 : 1; d.y0 = e.clientY; dy = 0; d.dy = 0; bagSfx(P, "tick"); buzz(6); }
    const p = Math.max(S.pTo, Math.min(1, d.p0 + Math.abs(dx) / (P.w * P.pull)));
    if (Math.floor(p * 12) > Math.floor(S.pTo * 12)) { bagSfx(P, "tick"); buzz(3); }
    S.pTo = p; S.lift.to = Math.max(-6, Math.min(20, -dy * 0.15)); if (p >= 0.98) finish();
  };
  const onUp = () => { const d = S.drag; S.drag = null; if (!d || S.state !== "idle") return; if (!d.moved || S.pTo > 0.62) auto(); };
  const onLeave = () => { S.pointer = null; };
  stage.addEventListener("pointerdown", onDown); stage.addEventListener("pointermove", onMove); stage.addEventListener("pointerup", onUp); stage.addEventListener("pointercancel", onUp); stage.addEventListener("pointerleave", onLeave);

  let raf = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - S.last) / 1000), t = (now - S.t0) / 1000; S.last = now;
    const motion = reduced ? 0 : 1, d = S.drag;
    if (S.state === "idle") {
      const tug = motion && d?.moved && !S.pTo ? Math.sign(d.dy) * P.stretch * (1 - 1 / (1 + Math.abs(d.dy) / Math.max(1, P.stretch))) : 0;
      S.stretch.to = 1 + Math.abs(tug) / 520 + (d ? 0.012 : 0);
      const [nx, ny] = S.pointer || [0, 0], tl = d?.moved ? 0.3 : 1;
      S.ry.to = nx * P.tilt * tl; S.rx.to = -ny * P.tilt * 0.7 * tl - 6;
      S.y.to = Math.sin(t * 1.4) * P.float * motion + tug;
      S.rz.to = Math.sin(t * 0.9) * 1.5 * motion - (S.p > 0 ? S.dir * S.p * 3 : 0);
      if (P.wiggle > 0 && !d && S.pTo < 1 && motion && t > S.nudgeAt) { S.rz.v += (Math.random() < 0.5 ? -1 : 1) * 60; if (S.pTo) S.lift.v += 60; S.nudgeAt = t + P.wiggle + Math.random() * 2; bagSfx(P, "crinkle"); }
      if (S.auto) { S.pTo = Math.min(1, S.pTo + dt * P.tearSpeed); if (Math.random() < 0.3) bagSfx(P, "tick"); if (S.pTo >= 1) finish(); }
    } else { S.rx.to = 0; S.ry.to = 0; S.rz.to = 0; S.y.to = 24; S.stretch.to = 1; }
    if (t > S.blinkAt && mats) { S.blinkAt = t + 2.2 + Math.random() * 3; S.blinkTill = t + 0.14; mats.front.map = mats.sFront.map = maps.frontBlink; }
    if (S.blinkTill && t > S.blinkTill && mats) { S.blinkTill = 0; mats.front.map = mats.sFront.map = maps.front; }
    for (const s of [S.rx, S.ry, S.rz, S.y, S.stretch, S.lift]) for (let k = 0; k < 2; k++) s.step(dt / 2);
    for (const r of rays) for (let k = 0; k < 2; k++) r.g.step(dt / 2);
    const prev = S.p; S.p += (S.pTo - S.p) * Math.min(1, dt * 16); S.pv = (S.p - prev) / Math.max(dt, 1e-3);
    if (S.state === "idle" && geos) {
      deform(S.p);
      if (P.stars && !reduced && S.p > 0.02) { S.emitAcc += dt * (4 + Math.abs(S.pv) * 30) * P.starCount; while (S.emitAcc > 1) { emit(1, false); S.emitAcc -= 1; } if (t > S.twinkleAt && S.pv > 0.05) { bagSfx(P, "twinkle"); S.twinkleAt = t + 0.12; } }
    }
    // the flat bag's transform, in 3D terms: pivot at 60% down, CSS y and z-rotation point the other way
    const since = S.openAt ? t - S.openAt : 0, drop = S.openAt ? 40 * Math.min(1, Math.max(0, (since - 0.5) / 1) ** 2) : 0;
    root.position.set(0, (S.cy || 0) - 0.1 * P.h - S.y.x - drop, 0); inner.position.y = 0.1 * P.h;
    pack.rotation.set(-S.rx.x * D2R, S.ry.x * D2R, -S.rz.x * D2R, "XYZ"); inner.scale.set(1, S.stretch.x, 1);
    if (S.openAt && mats) { const o = 1 - Math.min(1, Math.max(0, (since - 0.75) / 0.55)); for (const m of [mats.front, mats.back, mats.ins]) m.opacity = o; }
    shadow.style.transform = `scale(${(1 - S.y.x / 300).toFixed(3)})`; shadow.style.opacity = S.openAt ? String(1 - Math.min(1, Math.max(0, (since - 0.75) / 0.55))) : "";
    if (S.fly && mats) {
      const f = S.fly; f.vy += 3000 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rz += f.vrz * dt; f.rx += f.vrx * dt;
      stripG.position.set(f.x, -f.y, 40); stripG.rotation.set(-f.rx * D2R, 0, S.dir * f.rz * D2R);
      const o = Math.max(0, 1 - Math.abs(f.y) / 520); for (const m of [mats.sFront, mats.sBack, mats.sIns]) m.opacity = o;
    }
    drawRays(t); drawStars(dt);
    if (geos) renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  // a still picture of the bag at rest, for the small bags in the list: the same render, cropped to the bag
  function snap() {
    const w = stage.clientWidth || 340, h = stage.clientHeight || 360, rw = Math.round(P.w * 1.14), rh = Math.round(P.h * 1.1), cx = w / 2, cy = 70 + P.h / 2;
    resize(); root.position.set(0, (S.cy || 0) - 0.1 * P.h, 0); inner.position.y = 0.1 * P.h; pack.rotation.set(6 * D2R, -14 * D2R, 1.5 * D2R, "XYZ");
    camera.setViewOffset(w, h, cx - rw / 2, cy - rh / 2, rw, rh); renderer.setPixelRatio(2); renderer.setSize(rw, rh, false);
    renderer.render(scene, camera); opts.onStill?.(renderer.domElement.toDataURL("image/webp", 0.9)); // webp keeps the transparency and is small enough to keep
  }
  build();
  if (opts.still) { if (P.mascot) loadMascot(); else snap(); return { destroy() { ro.disconnect(); Object.values(geos || {}).forEach(g => g.dispose()); Object.values(mats || {}).forEach(m => m.dispose()); Object.values(maps || {}).forEach(t => t.dispose()); scene.environment?.dispose(); renderer.dispose(); renderer.forceContextLoss(); } }; }
  if (P.mascot) loadMascot();
  raf = requestAnimationFrame(frame);
  return {
    tear: auto, setFigure: html => { fig.innerHTML = html; },
    refresh() { if (S.state !== "idle") return; bagLook(stage, P); if (P.mascot && (!mascot || mascotStar !== P.star)) loadMascot(); else build(); },
    destroy() {
      cancelAnimationFrame(raf); ro.disconnect();
      for (const [k, f] of [["pointerdown", onDown], ["pointermove", onMove], ["pointerup", onUp], ["pointercancel", onUp], ["pointerleave", onLeave]]) stage.removeEventListener(k, f);
      Object.values(geos || {}).forEach(g => g.dispose()); Object.values(mats || {}).forEach(m => m.dispose()); Object.values(maps || {}).forEach(t => t.dispose());
      scene.environment?.dispose(); renderer.dispose(); renderer.forceContextLoss(); stage.classList.remove("bg3d");
    },
  };
}

// bag3dStill(THREE, P) renders one bag off screen and resolves with a PNG of it
function bag3dStill(THREE, P) {
  const host = document.createElement("div"); host.style.cssText = "position:fixed;left:-10000px;top:0;width:340px;height:360px;pointer-events:none"; document.body.append(host);
  return new Promise(res => { let b = null; const done = url => { setTimeout(() => { b?.destroy(); host.remove(); }, 0); res(url); }; b = createBag3D(THREE, host, P, { still: true, onStill: done }); });
}
