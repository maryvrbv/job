// ---------- the mystery bag: a white foil pouch with a sticker, torn open along the top ----------
// It tilts after the pointer on springs, wiggles when left alone, stretches when tugged up or down,
// tears along a ragged line when pulled sideways (the torn strip curls up), and when the tear runs through,
// the strip flies off, light pours out of the mouth and the figure rises out of the bag.

const BAG_N = 40; // points along the tear
function bagJag() { // a fresh ragged line across the top for every bag, in % of the bag
  const y0 = 10 + Math.random() * 1.5, slope = (Math.random() - 0.5) * 2, wob = 0.3 + Math.random() * 0.5, freq = 2 + Math.random() * 2, ph = Math.random() * 6.28;
  let walk = 0;
  return Array.from({ length: BAG_N + 1 }, (_, i) => {
    const x = i / BAG_N * 100, s = x / 50 - 1;
    walk = Math.max(-1, Math.min(1, walk + (Math.random() - 0.5) * 0.4));
    return [x, y0 + slope * s + wob * Math.sin(s * freq * Math.PI + ph) + walk + (Math.random() - 0.5) * 0.6];
  });
}
// the mascot on the sticker: a little round ghost with a star, holding a letter (our own, not anyone's character)
const BAG_MASCOT = `<svg viewBox="0 0 80 70" aria-hidden="true">
  <path d="M40 9l2.6 5.4 5.9.9-4.3 4.1 1 5.9L40 22.5l-5.2 2.8 1-5.9-4.3-4.1 5.9-.9z" fill="#ff6f91"/>
  <path d="M16 62V44a24 24 0 0 1 48 0v18l-6-4-6 4-6-4-6 4-6-4-6 4-6-4z" fill="#fff"/>
  <path d="M16 62V44a24 24 0 0 1 48 0v18l-6-4-6 4-6-4-6 4-6-4-6 4-6-4z" fill="none" stroke="#e7e2f5" stroke-width="1.2"/>
  <g class="bag-eyes"><ellipse cx="32" cy="41" rx="2.6" ry="3.2" fill="#3b2b33"/><ellipse cx="48" cy="41" rx="2.6" ry="3.2" fill="#3b2b33"/></g>
  <ellipse cx="27" cy="47" rx="3" ry="1.8" fill="#ffb3c6"/><ellipse cx="53" cy="47" rx="3" ry="1.8" fill="#ffb3c6"/>
  <path d="M38 46q2 2 4 0" stroke="#3b2b33" stroke-width="1.2" fill="none" stroke-linecap="round"/>
  <rect x="31" y="50" width="18" height="11" rx="2" fill="#ffc9d6" stroke="#e0889f" stroke-width="1"/><path d="M31.5 51l8.5 5.5 8.5-5.5" fill="none" stroke="#e0889f" stroke-width="1"/><path d="M40 56.6l-1.2-1.2a.9.9 0 0 1 1.2-1.3.9.9 0 0 1 1.2 1.3z" fill="#ff6f91"/>
</svg>`;
const BAG_TINT = { dubai: "#f6c9b9", spirits: "#bfc0ee", cats: "#e7bfe6", monsters: "#b9dcec" };
function bagSkin(series) {
  const s = toySeries(series), tint = BAG_TINT[series] || "#c9c3ef";
  return `<i class="bag-foil"></i><i class="bag-crimp top"></i><i class="bag-crimp bottom"></i><i class="bag-seal l"></i><i class="bag-seal r"></i>
    <i class="bag-wrinkles"></i><i class="bag-perf"></i><i class="bag-notch l"></i><i class="bag-notch r"></i>
    <div class="bag-sticker" style="--tint:${tint}">${BAG_MASCOT}<b>MYSTERY BAG</b><small>${esc(s?.name || "")}</small><i class="bag-sticker-holo"></i></div>
    <i class="bag-glare"></i>`;
}
// a small still bag for the list of boxes waiting
const bagMini = series => `<span class="bag-mini"><span class="bag-body">${bagSkin(series)}</span></span>`;

const bag = { on: false };
function bagOpen(b) {
  const jag = bagJag();
  Object.assign(bag, {
    on: true, b, jag, state: "idle", t0: performance.now(), last: performance.now(), dir: 1,
    p: 0, pTo: 0, th: new Spring(0, 0.3, 0.35), rx: new Spring(-4, 0.7, 0.28), ry: new Spring(0, 0.7, 0.28), rz: new Spring(0, 0.6, 0.3),
    y: new Spring(0, 0.6, 0.3), stretch: new Spring(1, 0.35, 0.55), pointer: null, drag: null, nudgeAt: 3 + Math.random() * 3, blinkAt: 1.5, fly: null,
  });
  return `<div class="bag-stage" id="bagStage">
      <div class="bag-rays" id="bagRays" aria-hidden="true"></div>
      <div class="bag-fig" id="bagFig" aria-hidden="true"></div>
      <div class="bag-shadow" id="bagShadow"></div>
      <div class="bag" id="bag">
        <div class="bag-body" id="bagBody">${bagSkin(b.series)}</div>
        <div class="bag-body bag-flap" id="bagFlap">${bagSkin(b.series)}</div>
        <svg class="bag-cut" id="bagCut" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline id="bagCutLine" fill="none" stroke="#fff" stroke-width="1.2" vector-effect="non-scaling-stroke" points=""/></svg>
      </div>
    </div>`;
}
function bagMount() {
  const st = $("bagStage"); if (!st) return;
  st.addEventListener("pointerdown", bagDown); st.addEventListener("pointermove", bagMove);
  st.addEventListener("pointerup", bagUp); st.addEventListener("pointercancel", bagUp);
  st.addEventListener("pointerleave", () => { bag.pointer = null; });
  bagClip(0); cancelAnimationFrame(bag.raf); bag.raf = requestAnimationFrame(bagFrame);
}
const bagYAt = x => { const f = Math.max(0, Math.min(100, x)) / 100 * BAG_N, i = Math.min(BAG_N - 1, f | 0); return bag.jag[i][1] + (bag.jag[i + 1][1] - bag.jag[i][1]) * (f - i); };
const bagPoly = a => `polygon(${a.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(",")})`;
// the body keeps everything but the torn piece; the flap is that piece, hinged at the tip of the tear
function bagClip(p) {
  const body = $("bagBody"), flap = $("bagFlap"), line = $("bagCutLine"); if (!body) return;
  if (p <= 0) { body.style.clipPath = ""; flap.style.display = "none"; line.setAttribute("points", ""); return; }
  const d = bag.dir, xt = d > 0 ? p * 100 : 100 - p * 100, yt = bagYAt(xt);
  const torn = bag.jag.filter(([x]) => d > 0 ? x < xt : x > xt);
  const rest = d > 0 ? [[xt, 0], [100, 0], [100, 100], [0, 100], ...torn, [xt, yt]] : [[0, 0], [xt, 0], [xt, yt], ...torn, [100, 100], [0, 100]];
  const piece = d > 0 ? [[0, 0], [xt, 0], [xt, yt], ...torn.slice().reverse()] : [[xt, 0], [100, 0], ...torn.slice().reverse(), [xt, yt]];
  body.style.clipPath = bagPoly(rest);
  flap.style.display = ""; flap.style.clipPath = bagPoly(piece); flap.style.transformOrigin = `${xt}% ${yt}%`;
  line.setAttribute("points", (d > 0 ? [...torn, [xt, yt]] : [[xt, yt], ...torn]).map(([x, y]) => `${x.toFixed(2)},${(y + 0.6).toFixed(2)}`).join(" "));
}
function bagDown(e) {
  if (bag.state !== "idle" || e.button) return;
  e.currentTarget.setPointerCapture(e.pointerId); sfx("crinkle");
  bag.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, p0: bag.pTo, moved: false, dy: 0 };
}
function bagMove(e) {
  const r = $("bagStage").getBoundingClientRect();
  bag.pointer = [(e.clientX - r.left) / r.width * 2 - 1, (e.clientY - r.top) / r.height * 2 - 1];
  const d = bag.drag; if (!d || e.pointerId !== d.id || bag.state !== "idle") return;
  const dx = e.clientX - d.x0; let dy = e.clientY - d.y0;
  if (!d.moved) { if (Math.hypot(dx, dy) < 6) return; d.moved = true; }
  if (bag.pTo === 0) { // nothing tears until the hand goes sideways; until then it's just a tug
    d.dy = dy;
    if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 0.6) return;
    bag.dir = dx < 0 ? -1 : 1; d.x0 = e.clientX - dx; d.dy = 0; sfx("tick"); buzz(6);
  }
  const W = $("bag").offsetWidth, p = Math.max(bag.pTo, Math.min(1, d.p0 + Math.abs(dx) / (W * 0.85)));
  if (Math.floor(p * 12) > Math.floor(bag.pTo * 12)) { sfx("tick"); buzz(3); }
  bag.pTo = p; bag.th.to = 8 + p * 16 + Math.max(-6, Math.min(20, -dy * 0.15));
  if (p >= 0.98) bagFinish();
}
function bagUp(e) {
  const d = bag.drag; bag.drag = null; if (!d || bag.state !== "idle") return;
  if (!d.moved) return bagAuto(); // a click tears it all by itself
  if (bag.pTo > 0.62) bagAuto();
}
function bagAuto() { // run the tear to the end on its own
  if (bag.state !== "idle") return;
  if (!bag.pTo) bag.dir = Math.random() < 0.5 ? 1 : -1;
  bag.auto = true;
}
function bagFinish() {
  if (bag.state !== "idle") return;
  bag.state = "open"; bag.pTo = 1; bag.p = 1; bagClip(1);
  sfx("rip"); buzz([14, 40, 24]);
  bag.fly = { x: 0, y: 0, vx: bag.dir * 260, vy: -1700, r: bag.th.x, vr: bag.dir * -480 };
  bag.y.v += 260; bag.rz.v -= bag.dir * 40;
  $("bagStage").classList.add("opened");
  tearBox(); // the figure comes out (and the box is saved) while the light pours
}
function bagBlink() { const e = $("bagBody")?.querySelector(".bag-eyes"); if (!e) return; e.classList.add("blink"); setTimeout(() => e.classList.remove("blink"), 140); }
function bagFrame(now) {
  const el = $("bag"); if (!el || !bag.on) return;
  const dt = Math.min(0.05, (now - bag.last) / 1000), t = (now - bag.t0) / 1000; bag.last = now;
  const motion = reduced() ? 0 : 1, d = bag.drag;
  if (bag.state === "idle") {
    const tug = motion && d?.moved && !bag.pTo ? Math.sign(d.dy) * 120 * (1 - 1 / (1 + Math.abs(d.dy) / 120)) : 0; // tugged, it stretches after the hand
    bag.stretch.to = 1 + Math.abs(tug) / 500 + (d ? 0.012 : 0);
    const [nx, ny] = bag.pointer || [0, 0], tilt = d?.moved ? 0.3 : 1;
    bag.ry.to = nx * 20 * tilt; bag.rx.to = -ny * 14 * tilt - 4;
    bag.y.to = Math.sin(t * 1.4) * 6 * motion + tug;
    bag.rz.to = Math.sin(t * 0.9) * 1.5 * motion - (bag.p > 0 ? bag.dir * bag.p * 3 : 0);
    if (!d && bag.pTo < 1 && motion && t > bag.nudgeAt) { bag.rz.v += (Math.random() < 0.5 ? -1 : 1) * 60; if (bag.pTo) bag.th.v += 100; bag.nudgeAt = t + 4 + Math.random() * 3; sfx("crinkle"); } // left alone it wiggles
    if (bag.auto) { bag.pTo = Math.min(1, bag.pTo + dt * 2.2); bag.th.to = 10 + bag.pTo * 18; if (Math.random() < 0.3) sfx("tick"); if (bag.pTo >= 1) bagFinish(); }
  } else { bag.rx.to = 0; bag.ry.to = 0; bag.rz.to = 0; bag.y.to = 30; bag.stretch.to = 1; }
  if (t > bag.blinkAt) { bag.blinkAt = t + 2.2 + Math.random() * 3; bagBlink(); }
  for (const s of [bag.th, bag.rx, bag.ry, bag.rz, bag.y, bag.stretch]) for (let k = 0; k < 2; k++) s.step(dt / 2);
  bag.p += (bag.pTo - bag.p) * Math.min(1, dt * 18);
  if (bag.state === "idle") bagClip(bag.p);
  el.style.transform = `translateY(${bag.y.x.toFixed(1)}px) rotateX(${bag.rx.x.toFixed(2)}deg) rotateY(${bag.ry.x.toFixed(2)}deg) rotate(${bag.rz.x.toFixed(2)}deg) scaleY(${bag.stretch.x.toFixed(3)})`;
  el.style.setProperty("--gx", `${50 + bag.ry.x * 2}%`); el.style.setProperty("--gy", `${30 - bag.rx.x * 2}%`); el.style.setProperty("--ha", `${bag.ry.x * 6 + bag.rx.x * 4}deg`);
  $("bagShadow").style.transform = `scale(${(1 - bag.y.x / 300).toFixed(3)})`;
  const flap = $("bagFlap");
  if (bag.fly) { // the torn strip is thrown off: it races up and spins away
    const f = bag.fly; f.vy += 3200 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.r += f.vr * dt;
    flap.style.transform = `translate(${f.x.toFixed(1)}px, ${f.y.toFixed(1)}px) rotate(${(-bag.dir * f.r).toFixed(1)}deg)`; flap.style.opacity = Math.max(0, 1 - Math.abs(f.y) / 500).toFixed(2);
  } else if (flap) flap.style.transform = `rotate(${(-bag.dir * bag.th.x).toFixed(2)}deg)`; // the torn piece curls up
  bag.raf = requestAnimationFrame(bagFrame);
}
function bagClose() { bag.on = false; cancelAnimationFrame(bag.raf); }
