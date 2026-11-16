// ---------- the mystery bag engine: a puffy foil pouch with a sticker, torn open along the top ----------
// One engine for the app and for the bag editor artifact. It tilts after the pointer on springs, wiggles when left
// alone, stretches when tugged up or down, and tears along a fresh ragged line when pulled sideways: the torn strip
// is cut into slices that each bend a little more, so its loose end curls up toward you. A soft pink light grows out of
// the torn part and glowing stars fly from the mouth while it tears; when the tear runs through, the strip is thrown up,
// the stars burst and the figure rises out of the bag. The bag has thickness, a pillow outline, crinkled foil lit from
// a light that moves with the tilt, a bulge where the figure sits and a silver inside that shows through the mouth.

const BAG_DEFAULTS = {
  foil: "#f4f2ee", w: 210, h: 236, rad: 6, crimp: 9, wrink: 0.7, depth: 22, puff: 0.7, lump: 0.6, sheen: 0.6,
  tint: "#e7bfe6", ink: "#5a3b3f", star: "#ff6f91", ssize: 66, stop: 30, srad: 12, holo: 0.35, title: "MYSTERY BAG", subtitle: "", mascot: true,
  tilt: 20, response: 0.7, bounce: 0.28, float: 6, wiggle: 5, stretch: 120,
  curl: 1, ragged: 1, pull: 0.85, tearSpeed: 2.2, throw: 1900, rays: true, stars: true, starCount: 1, sound: true, haptics: true,
};
const BAG_K = 9; // slices of the tear strip
const BAG_N = 48; // points along the tear

const BAG_CSS = `
.bg-stage{position:relative;width:min(340px,100%);height:360px;margin:6px auto 0;perspective:1100px;touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none}
.bg-stage:active{cursor:grabbing}
.bg-fx{position:absolute;inset:-40px;width:calc(100% + 80px);height:calc(100% + 80px);pointer-events:none;z-index:5}
.bg-rays{position:absolute;left:50%;top:0;width:var(--w);height:calc(70px + var(--h) * .3);margin-left:calc(var(--w) / -2);overflow:visible;pointer-events:none;opacity:.95;filter:blur(12px)}
.bg-fig{position:absolute;left:50%;top:90px;width:150px;margin-left:-75px;opacity:0;transform:translateY(90px) scale(.55);pointer-events:none;z-index:1}
.bg-fig>*{width:100%;height:auto;display:block}
.bg-fig.rise{opacity:1;transform:translateY(-44px) scale(1);transition:transform .85s .2s cubic-bezier(.2,1.5,.4,1),opacity .25s .2s}
.bg-shadow{position:absolute;left:50%;bottom:22px;width:190px;height:20px;margin-left:-95px;border-radius:50%;background:radial-gradient(closest-side,rgb(60 30 90 / .26),transparent)}
.bg-pack{position:absolute;left:50%;top:70px;width:var(--w);height:var(--h);margin-left:calc(var(--w) / -2);transform-style:preserve-3d;transform-origin:50% 60%;z-index:2;--gx:50%;--gy:30%;--ha:0deg;--lx:0px;--ly:0px}
.bg-skin{position:absolute;inset:0;border-radius:var(--rad);overflow:hidden;background:var(--foil);-webkit-mask:var(--pillow) 0 0/100% 100% no-repeat;mask:var(--pillow) 0 0/100% 100% no-repeat;box-shadow:inset 0 0 calc(var(--w) * .14 * var(--puff)) rgb(110 98 85 / calc(var(--puff) * .38));backface-visibility:hidden;-webkit-backface-visibility:hidden;transform:translateZ(calc(var(--d) / 2))}
.bg-skin.back{transform:rotateY(180deg) translateZ(calc(var(--d) / 2))}
.bg-skin i{position:absolute;pointer-events:none}
.bg-side{position:absolute;top:10%;bottom:8%;width:var(--d);border-radius:40%/8%;background:linear-gradient(90deg,color-mix(in srgb,var(--foil) 70%,#5e544a),color-mix(in srgb,var(--foil) 85%,#5e544a) 50%,color-mix(in srgb,var(--foil) 70%,#5e544a))}
.bg-side.l{left:calc(var(--d) / -2);transform:rotateY(-90deg)}
.bg-side.r{right:calc(var(--d) / -2);transform:rotateY(90deg)}
.bg-foil{inset:0;background:radial-gradient(55% 42% at 46% 52%,rgb(255 255 255 / calc(var(--puff) * 1)) 0%,transparent 70%),radial-gradient(120% 90% at 50% 55%,transparent 38%,color-mix(in srgb,var(--foil) 62%,#6e6255) 100%),linear-gradient(180deg,transparent 70%,rgb(110 98 85 / calc(var(--puff) * .18))),var(--foil)}
.bg-lump{left:18%;right:18%;top:30%;bottom:14%;border-radius:50% 50% 46% 46%;transform:translate(var(--lx),var(--ly));opacity:var(--lump);
  background:radial-gradient(50% 40% at 38% 30%,rgb(255 255 255 / .95),transparent 72%),radial-gradient(28% 22% at 30% 18%,rgb(80 70 60 / .14),transparent 75%),radial-gradient(28% 22% at 70% 18%,rgb(80 70 60 / .14),transparent 75%),radial-gradient(75% 55% at 58% 82%,rgb(80 70 60 / .26),transparent 72%)}
.bg-crimp{left:0;right:0;height:var(--crimp);background:repeating-linear-gradient(90deg,color-mix(in srgb,var(--foil) 88%,#7a7065) 0 2px,color-mix(in srgb,var(--foil) 40%,#fff) 2px 4px);box-shadow:inset 0 -1px 0 rgb(0 0 0 / .06)}
.bg-crimp.top{top:0}.bg-crimp.bottom{bottom:0}
.bg-seal{top:0;bottom:0;width:5%;background:linear-gradient(90deg,color-mix(in srgb,var(--foil) 90%,#7a7065),color-mix(in srgb,var(--foil) 40%,#fff))}
.bg-seal.l{left:0}.bg-seal.r{right:0;transform:scaleX(-1)}
.bg-wrinkles{inset:8% 4%;opacity:var(--wrink);background:linear-gradient(115deg,transparent 30%,rgb(255 255 255 / .85) 36%,transparent 42%),linear-gradient(70deg,transparent 58%,rgb(0 0 0 / .06) 62%,transparent 66%),linear-gradient(160deg,transparent 70%,rgb(0 0 0 / .05) 74%,transparent 78%)}
.bg-perf{left:7%;right:7%;top:calc(var(--crimp) + 2.5%);border-top:1.5px dashed rgb(150 140 130 / .38)}
.bg-notch{top:calc(var(--crimp) - 1%);width:10px;height:10px;background:var(--notchbg,#fff);transform:rotate(45deg)}
.bg-notch.l{left:-6px}.bg-notch.r{right:-6px}
.bg-lit{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.bg-lit .crinkle{mix-blend-mode:multiply;opacity:calc(var(--wrink) * .42)}
.bg-lit .sheen{mix-blend-mode:screen;opacity:var(--sheen)}
.bg-tiltshade{inset:0;background:linear-gradient(90deg,rgb(70 60 55 / var(--sl,0)),transparent 45%,transparent 55%,rgb(70 60 55 / var(--sr,0))),linear-gradient(180deg,rgb(255 255 255 / var(--st,0)),transparent 40%,transparent 65%,rgb(70 60 55 / var(--sb,0)))}
.bg-mouth{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;transform:translateZ(0)}
.bg-glare{inset:0;background:radial-gradient(circle at var(--gx) var(--gy),rgb(255 255 255 / .9),rgb(255 255 255 / 0) 40%);mix-blend-mode:soft-light}
.bg-sticker{position:absolute;left:calc((100% - var(--ssize)) / 2);width:var(--ssize);top:var(--stop);aspect-ratio:1;border-radius:var(--srad);background:var(--tint);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
  box-shadow:0 1px 0 rgb(255 255 255 / .6) inset,0 3px 7px rgb(90 70 120 / .18);overflow:hidden;transform:translate(calc(var(--lx) * .35),calc(var(--ly) * .35)) scale(calc(1 + var(--puff) * .03))}
.bg-sticker svg{width:60%;height:auto}
.bg-sticker b{font:900 calc(var(--w) * .062)/1 "Nunito","Arial Rounded MT Bold",system-ui,sans-serif;color:var(--ink);letter-spacing:.03em;text-align:center;padding:0 6px}
.bg-sticker small{font:700 calc(var(--w) * .04)/1.1 system-ui,sans-serif;color:var(--ink);opacity:.7;text-align:center;padding:0 6px}
.bg-sticker .bg-holo{inset:0;opacity:var(--holo);background:conic-gradient(from var(--ha) at 70% 30%,#ff9ad5,#ffe58a,#9dffcf,#8fd8ff,#c7a6ff,#ff9ad5);mix-blend-mode:soft-light}
.bg-eyes{transform-origin:40px 41px;transition:transform .08s}
.bg-eyes.blink{transform:scaleY(.1)}
.bg-strip{position:absolute;inset:0;transform-style:preserve-3d;pointer-events:none}
.bg-ply{position:absolute;overflow:hidden;pointer-events:none}
.bg-plyin{position:absolute}
.bg-plyin>*{position:absolute;inset:0}
.bg-ply .bg-skin{transform:none;backface-visibility:visible;-webkit-backface-visibility:visible}
.bg-plyback{display:none;background:linear-gradient(180deg,#eef0f4,#b9bec8 45%,#e3e6ec 70%,#a9aeb8)}
.bg-ply.flip .bg-plyback{display:block}
.bg-shade{background:#3a2c20;opacity:0}
.bg-cut{position:absolute;inset:0;width:100%;height:100%;z-index:4;pointer-events:none;overflow:visible;transform:translateZ(calc(var(--d) / 2 + 1px));filter:drop-shadow(0 1px 0 rgb(0 0 0 / .14))}
.bg-stage.opened .bg-pack{transition:opacity .55s .75s,translate 1s .5s ease-in;opacity:0;translate:0 40px}
.bg-mini{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;width:130px;height:147px;margin:6px 0 6px;border-radius:5px;overflow:hidden;
  background:linear-gradient(180deg,color-mix(in srgb,var(--tint) 55%,#fff),color-mix(in srgb,var(--tint) 80%,#fff) 55%,var(--tint));
  clip-path:polygon(0 0,100% 0,100% 12%,96% 50%,100% 88%,100% 100%,0 100%,0 88%,4% 50%,0 12%);
  animation:bg-sway 3.6s ease-in-out infinite;filter:drop-shadow(0 4px 6px rgb(80 60 110 / .22))}
.bgm i{position:absolute;pointer-events:none}
.bgm-holo{inset:0;background:linear-gradient(115deg,#ffb3e6 0%,#b5f0ff 18%,#fff6b0 32%,#d6b8ff 48%,#a8ffe0 62%,#ffc4dc 78%,#b5d4ff 100%);background-size:260% 260%;mix-blend-mode:hard-light;opacity:.6;animation:bgm-holo 6s ease-in-out infinite alternate}
.bgm::after{content:"";position:absolute;inset:0;background:radial-gradient(60% 45% at 50% 50%,rgb(255 255 255 / .55),transparent 70%),linear-gradient(100deg,transparent 30%,rgb(255 255 255 / .55) 45%,transparent 60%);background-size:100% 100%,250% 100%;animation:bgm-glint 4.5s ease-in-out infinite;pointer-events:none}
.bgm-crimp{left:0;right:0;height:9%;background:repeating-linear-gradient(90deg,color-mix(in srgb,var(--tint) 60%,#9aa0ad) 0 2px,color-mix(in srgb,var(--tint) 30%,#fff) 2px 4px)}
.bgm-crimp.t{top:0}.bgm-crimp.b{bottom:0}
.bgm svg{position:relative;width:46%;height:auto;z-index:1}
.bgm b{position:relative;z-index:1;font:900 12px/1 "Nunito","Arial Rounded MT Bold",system-ui,sans-serif;color:var(--ink);letter-spacing:.02em;-webkit-text-stroke:2.4px #fff;paint-order:stroke fill}
@keyframes bgm-holo{to{background-position:100% 100%}}
.bg-mini-img{display:block;width:150px;max-width:100%;height:auto;margin:2px 0 4px;animation:bg-sway 3.6s ease-in-out infinite;filter:drop-shadow(0 5px 6px rgb(80 60 110 / .2))}
.box-card:nth-child(2n) .bg-mini-img{animation-delay:-1.4s}
.bg-mini-img.appear{animation:bg-appear .45s ease-out both,bg-sway 3.6s ease-in-out .45s infinite}
@keyframes bg-appear{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:none}}
.bg-mini-ph{display:block;width:150px;max-width:100%;aspect-ratio:240/260;margin:2px 0 4px;border-radius:14px;
  background:radial-gradient(60% 55% at 50% 50%,color-mix(in srgb,var(--tint) 70%,#fff),transparent 75%);animation:bg-ph 1.3s ease-in-out infinite alternate}
@keyframes bg-ph{from{opacity:.35;transform:scale(.96)}to{opacity:.8;transform:scale(1)}}
@keyframes bgm-glint{0%,100%{background-position:0 0,120% 0}50%{background-position:0 0,-20% 0}}
.box-card:nth-child(2n) .bg-mini{animation-delay:-1.4s}
@keyframes bg-sway{0%,100%{transform:rotate(-2deg) translateY(0)}50%{transform:rotate(2deg) translateY(-3px)}}
@media (prefers-reduced-motion:reduce){.bg-fig.rise{transition:none}.bg-mini,.bg-mini-img,.bg-mini-ph,.bgm-holo,.bgm::after{animation:none}}
`;
// the mascot on the sticker: a little round ghost with a star, holding a letter (our own, not anyone's character)
const bagMascot = star => `<svg viewBox="0 0 80 70" aria-hidden="true">
  <path d="M40 9l2.6 5.4 5.9.9-4.3 4.1 1 5.9L40 22.5l-5.2 2.8 1-5.9-4.3-4.1 5.9-.9z" fill="${star}"/>
  <path d="M16 62V44a24 24 0 0 1 48 0v18l-6-4-6 4-6-4-6 4-6-4-6 4-6-4z" fill="#fff" stroke="#e7e2f5" stroke-width="1.2"/>
  <g class="bg-eyes"><ellipse cx="32" cy="41" rx="2.6" ry="3.2" fill="#3b2b33"/><ellipse cx="48" cy="41" rx="2.6" ry="3.2" fill="#3b2b33"/></g>
  <ellipse cx="27" cy="47" rx="3" ry="1.8" fill="#ffb3c6"/><ellipse cx="53" cy="47" rx="3" ry="1.8" fill="#ffb3c6"/>
  <path d="M38 46q2 2 4 0" stroke="#3b2b33" stroke-width="1.2" fill="none" stroke-linecap="round"/>
  <rect x="31" y="50" width="18" height="11" rx="2" fill="#ffc9d6" stroke="#e0889f" stroke-width="1"/><path d="M31.5 51l8.5 5.5 8.5-5.5" fill="none" stroke="#e0889f" stroke-width="1"/></svg>`;
const bagEsc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// crinkled foil lit by a light that moves with the tilt: a noise relief through diffuse light (the creases) and
// specular light (the soft sheen of matte foil); the filters are shared by id, one set per bag
const bagLitHtml = (id, seed) => `<svg class="bg-lit" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${bagLitDefs(id, seed)}<rect class="crinkle" width="100" height="100" filter="url(#${id}c)"/><rect class="sheen" width="100" height="100" filter="url(#${id}s)"/></svg>`;
const bagLitDefs = (id, seed) => `<defs>
  <filter id="${id}c" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.018 0.03" numOctaves="4" seed="${seed}" result="n"/>
    <feDiffuseLighting in="n" surfaceScale="4" diffuseConstant="1.3" lighting-color="#fff"><feDistantLight class="lt" azimuth="235" elevation="48"/></feDiffuseLighting></filter>
  <filter id="${id}s" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="2" seed="${seed + 7}" result="n"/>
    <feSpecularLighting in="n" surfaceScale="6" specularConstant=".9" specularExponent="14" lighting-color="#fff" result="s"><feDistantLight class="lt" azimuth="235" elevation="48"/></feSpecularLighting>
    <feComposite in="s" in2="SourceAlpha" operator="in"/></filter></defs>`;
function bagSkinHtml(P, back, lit) {
  const L = lit ? bagLitHtml(lit[0] + (back ? "b" : "f"), lit[1]) : "";
  if (back) return `<i class="bg-foil"></i>${L}<i class="bg-crimp top"></i><i class="bg-crimp bottom"></i><i class="bg-seal l"></i><i class="bg-seal r"></i><i class="bg-wrinkles"></i><i class="bg-tiltshade"></i><i class="bg-glare"></i>`;
  return `<i class="bg-foil"></i>${L}<i class="bg-lump"></i><i class="bg-crimp top"></i><i class="bg-crimp bottom"></i><i class="bg-seal l"></i><i class="bg-seal r"></i>
    <i class="bg-wrinkles"></i><i class="bg-perf"></i><i class="bg-notch l"></i><i class="bg-notch r"></i><i class="bg-tiltshade"></i>
    <div class="bg-sticker">${P.mascot ? bagMascot(P.star) : ""}<b>${bagEsc(P.title)}</b>${P.subtitle ? `<small>${bagEsc(P.subtitle)}</small>` : ""}<i class="bg-holo"></i></div><i class="bg-glare"></i>`;
}
// the pillow outline: crimped seams stay flat and full width, the puffed middle pulls the sides in a little
function bagPillow(P) {
  const c = +P.crimp, k = Math.max(0, P.puff) * 4, t = c + 2, b = 98 - c;
  const d = `M0 0H100V${t}Q${100 - 2 * k} 50 100 ${b}V100H0V${b}Q${2 * k} 50 0 ${t}Z`;
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><path d='${d}'/></svg>`)}")`;
}
function bagLook(stage, P) { // colours and sizes as CSS variables on the stage
  const set = (k, v) => stage.style.setProperty(k, v);
  set("--w", P.w + "px"); set("--h", P.h + "px"); set("--rad", P.rad + "px"); set("--crimp", P.crimp + "%"); set("--wrink", P.wrink); set("--d", P.depth + "px");
  set("--puff", P.puff); set("--lump", P.lump); set("--foil", P.foil); set("--tint", P.tint); set("--ink", P.ink);
  set("--ssize", P.ssize + "%"); set("--stop", P.stop + "%"); set("--srad", P.srad + "px"); set("--holo", P.holo);
  set("--sheen", P.sheen); set("--pillow", bagPillow(P));
}
// a small still bag for lists (no engine): holographic foil in the series colour with the mascot and the title
// printed on it, the rainbow slowly drifting across, as the 3D bag looks
const bagMiniHtml = P => `<span class="bg-mini bgm" style="--tint:${P.tint};--ink:${P.ink}"><i class="bgm-holo"></i><i class="bgm-crimp t"></i><i class="bgm-crimp b"></i>${P.mascot ? bagMascot(P.star) : ""}<b>${bagEsc(P.title)}</b></span>`;

let bagSeq = 0;
class BagSpring {
  constructor(x, response = 0.5, bounce = 0) { this.x = this.to = x; this.v = 0; this.set(response, bounce); }
  set(response, bounce = 0) { this.k = (2 * Math.PI / response) ** 2; this.c = 4 * Math.PI * (1 - bounce) / response; return this; }
  step(h) { this.v += (this.k * (this.to - this.x) - this.c * this.v) * h; this.x += this.v * h; }
}
let bagAudio = null;
function bagSfx(P, kind) {
  if (!P.sound) return;
  try {
    bagAudio = bagAudio || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = bagAudio, now = ctx.currentTime, g = ctx.createGain(); g.connect(ctx.destination);
    if (kind === "pop" || kind === "twinkle") {
      const o = ctx.createOscillator(); o.type = "sine"; const f0 = kind === "pop" ? 520 : 1400 + Math.random() * 900;
      o.frequency.setValueAtTime(f0, now); o.frequency.exponentialRampToValueAtTime(f0 * (kind === "pop" ? 2.5 : 1.6), now + 0.12);
      g.gain.setValueAtTime(kind === "pop" ? 0.12 : 0.025, now); g.gain.exponentialRampToValueAtTime(0.001, now + (kind === "pop" ? 0.22 : 0.18)); o.connect(g); o.start(now); o.stop(now + 0.25); return;
    }
    const dur = kind === "rip" ? 0.34 : kind === "crinkle" ? 0.12 : 0.035, buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, kind === "rip" ? 1.2 : 2.5) * (Math.random() < (kind === "tick" ? 1 : 0.18) ? 1 : 0.35);
    const src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(); src.buffer = buf; fl.type = "bandpass";
    fl.frequency.value = kind === "rip" ? 2600 : kind === "crinkle" ? 5200 : 3800; fl.Q.value = 0.9;
    g.gain.value = kind === "rip" ? 0.32 : kind === "crinkle" ? 0.05 : 0.09; src.connect(fl).connect(g); src.start(now);
  } catch (e) {}
}
const BAG_RAY_COLORS = ["#ff8fc7", "#ffb3d9", "#ff7eb6", "#ffc2e2", "#f9a0cf", "#ffa6c9", "#ffd1ea"]; // a soft pink glow
const BAG_STAR_COLORS = ["#ffffff", "#ffd1ea", "#ffb3d9", "#fff0f7", "#ff9ccf", "#ffe3f1"];

// createBag(stage, P, { figure, onOpen }) builds a bag in the stage element and runs it until destroy()
function bagInjectCss() { if (!document.getElementById("bg-css")) { const st = document.createElement("style"); st.id = "bg-css"; st.textContent = BAG_CSS; document.head.append(st); } }
function createBag(stage, P0, opts = {}) {
  bagInjectCss();
  const P = opts.live ? Object.assign(P0, { ...BAG_DEFAULTS, ...P0 }) : { ...BAG_DEFAULTS, ...P0 }; // live: the editor keeps changing P
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const buzz = p => { if (P.haptics) try { navigator.vibrate?.(p); } catch (e) {} };
  const S = {
    state: "idle", t0: performance.now(), last: performance.now(), dir: 1, p: 0, pTo: 0, pv: 0, drag: null, pointer: null, fly: null, auto: false,
    nudgeAt: (P.wiggle || 999) + Math.random() * 2, blinkAt: 1.6, roll: 0.8 + Math.random() * 0.6, stars: [], emitAcc: 0, twinkleAt: 0,
    rx: new BagSpring(-6, P.response, P.bounce), ry: new BagSpring(0, P.response, P.bounce), rz: new BagSpring(0, P.response * 0.85, P.bounce),
    y: new BagSpring(0, P.response * 0.85, P.bounce), stretch: new BagSpring(1, 0.35, 0.55), lift: new BagSpring(0, 0.3, 0.35),
  };
  // a ragged line across the top, fresh for every bag
  const jag = (() => {
    const k = P.ragged, y0 = 10 + (P.crimp - 9) * 0.6 + Math.random() * 1.5, slope = (Math.random() - 0.5) * 2 * k, bow = (Math.random() - 0.5) * 2 * k;
    const wob = (0.25 + Math.random() * 0.45) * k, freq = 1.5 + Math.random() * 2, ph = Math.random() * 6.28; let walk = 0;
    return Array.from({ length: BAG_N + 1 }, (_, i) => {
      const x = i / BAG_N * 100, s = x / 50 - 1;
      walk = Math.max(-1.2, Math.min(1.2, walk + (Math.random() - 0.5) * 0.3 * k + (Math.random() < 0.04 ? (Math.random() - 0.5) * 1.6 * k : 0)));
      return [i && i < BAG_N ? x + (Math.random() - 0.5) * 0.6 : x, y0 + slope * s + bow * (1 - s * s) + wob * Math.sin(s * freq * Math.PI + ph) + walk];
    });
  })();
  const yAt = x => { const f = Math.max(0, Math.min(100, x)) / 100 * BAG_N, i = Math.min(BAG_N - 1, f | 0); return jag[i][1] + (jag[i + 1][1] - jag[i][1]) * (f - i); };
  const poly = a => `polygon(${a.map(([x, y]) => `${(+x).toFixed(2)}% ${(+y).toFixed(2)}%`).join(",")})`;
  const NR = 16;
  const rays = Array.from({ length: NR }, (_, j) => ({ x: 6 + 88 * (j + 0.5) / NR, c: BAG_RAY_COLORS[j % BAG_RAY_COLORS.length], g: new BagSpring(0, 0.45, 0.3), on: false, ph: Math.random() * 6.28, len: 40 + Math.random() * 22 }));

  stage.classList.add("bg-stage"); stage.classList.remove("opened"); bagLook(stage, P);
  const lid = "bgl" + (++bagSeq), seed = 1 + Math.floor(Math.random() * 400);
  stage.innerHTML = `<svg class="bg-rays" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs>${rays.map((r, j) => `<radialGradient id="bgr${j}" cx=".5" cy=".75" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".35" stop-color="${r.c}" stop-opacity=".85"/><stop offset="1" stop-color="${r.c}" stop-opacity="0"/></radialGradient>`).join("")}</defs>${rays.map((r, j) => `<path id="bgr-p${j}" fill="url(#bgr${j})" d=""/>`).join("")}</svg>
    <div class="bg-fig"${opts.figId ? ` id="${opts.figId}"` : ""} aria-hidden="true">${opts.figure || ""}</div><div class="bg-shadow"></div>
    <div class="bg-pack">
      <i class="bg-side l"></i><i class="bg-side r"></i>
      <div class="bg-skin back">${bagSkinHtml(P, true, [lid, seed])}</div>
      <svg class="bg-mouth" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="${lid}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3f5f8"/><stop offset=".22" stop-color="#b7bcc6"/><stop offset=".5" stop-color="#5e5466"/><stop offset="1" stop-color="#2b2230"/></linearGradient></defs><path fill="url(#${lid}m)" d=""/></svg>
      <div class="bg-skin front">${bagSkinHtml(P, false, [lid, seed])}</div>
      <div class="bg-strip">${Array.from({ length: BAG_K }, () => `<div class="bg-ply" hidden><div class="bg-plyin"><div class="bg-skin front">${bagSkinHtml(P)}</div><i class="bg-plyback"></i><i class="bg-shade"></i></div></div>`).join("")}</div>
      <svg class="bg-cut" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline class="ag" fill="none" stroke="#b9bec8" stroke-width="2.4" vector-effect="non-scaling-stroke" points=""/><polyline fill="none" stroke="#fff" stroke-width="1" vector-effect="non-scaling-stroke" points=""/></svg>
    </div><canvas class="bg-fx"></canvas>`;
  const $q = s => stage.querySelector(s);
  const pack = $q(".bg-pack"), body = $q(".bg-pack > .bg-skin.front"), strip = $q(".bg-strip"), cuts = [...stage.querySelectorAll(".bg-cut polyline")], fig = $q(".bg-fig");
  const cut = { setAttribute: (k, v) => cuts.forEach(c => c.setAttribute(k, v)), get parentNode() { return cuts[0].parentNode; } };
  const mouth = $q(".bg-mouth path"), lights = [...stage.querySelectorAll(".lt")]; let litAt = [999, 999];
  const plies = [...stage.querySelectorAll(".bg-ply")].map(el => ({ el, inner: el.querySelector(".bg-plyin"), shade: el.querySelector(".bg-shade") }));
  const rayEls = rays.map((_, j) => $q("#bgr-p" + j)), raysEl = $q(".bg-rays"), fx = $q(".bg-fx"), g2 = fx.getContext("2d");
  try { stage.style.setProperty("--notchbg", getComputedStyle(stage.parentElement).backgroundColor); } catch (e) {}

  // the tear: the body keeps everything but the torn strip; each slice of the strip is cut once the tear passed it
  function clips(p) {
    const d = S.dir, xt = d > 0 ? p * 100 : 100 - p * 100, yt = yAt(xt);
    if (p <= 0) { body.style.clipPath = ""; cut.setAttribute("points", ""); mouth.setAttribute("d", ""); plies.forEach(s => s.el.hidden = true); return; }
    const torn = jag.filter(([x]) => d > 0 ? x < xt : x > xt);
    body.style.clipPath = poly(d > 0 ? [[xt, -5], [105, -5], [105, 105], [-5, 105], [-5, torn[0]?.[1] ?? yt], ...torn, [xt, yt]] : [[-5, -5], [xt, -5], [xt, yt], ...torn, [105, torn[torn.length - 1]?.[1] ?? yt], [105, 105], [-5, 105]]);
    const edge = d > 0 ? [...torn, [xt, yt]] : [[xt, yt], ...torn];
    cut.setAttribute("points", edge.map(([x, y]) => `${(+x).toFixed(2)},${(y + 0.5).toFixed(2)}`).join(" "));
    // the mouth: through the torn part you see the silver inside of the back panel and the dark of the bag below it,
    // gaping a little wider in the middle of the torn stretch (the puffed bag pulls it open)
    if (edge.length > 1) {
      const x0 = edge[0][0], x1 = edge[edge.length - 1][0], span = Math.max(1, x1 - x0), gape = (1.2 + 2.6 * Math.min(1, span / 60)) * (0.6 + 0.4 * P.puff);
      const upper = edge.map(([x, y]) => [x, y - gape * Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (x - x0) / span)))) ** 0.7]);
      mouth.setAttribute("d", "M" + upper.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join("L") + "L" + edge.slice().reverse().map(([x, y]) => `${x.toFixed(2)} ${(y + 1.5).toFixed(2)}`).join("L") + "Z");
    }
    // each slice is a small layer of exactly its own piece of the strip (full-size layers tilted every which way
    // confuse the browser's 3D sorting and vanish); the pack's own coordinates are kept through the transform origin
    const w = 100 / BAG_K, lap = 0.3, W = pack.offsetWidth, H = pack.offsetHeight, yMax = Math.max(...jag.map(q => q[1])) + 1.5, top = 0.05 * H, bandH = (yMax + 5) / 100 * H;
    plies.forEach((s, k) => {
      const lo = d > 0 ? k * w : Math.max(k * w, xt), hi = d > 0 ? Math.min((k + 1) * w, xt) : (k + 1) * w;
      if (hi <= lo) { s.el.hidden = true; return; }
      s.el.hidden = false;
      const L = Math.max(0, lo - lap), R = Math.min(100, hi + lap);
      const span = [[L, yAt(L)], ...jag.filter(q => q[0] > L && q[0] < R), [R, yAt(R)]], piece = [[L, -5], [R, -5], ...span.slice().reverse()];
      const Lp = L / 100 * W, st = s.el.style, si = s.inner.style;
      st.left = Lp + "px"; st.top = -top + "px"; st.width = (R - L) / 100 * W + "px"; st.height = bandH + "px"; st.transformOrigin = `${-Lp}px ${top}px`;
      si.left = -Lp + "px"; si.top = top + "px"; si.width = W + "px"; si.height = H + "px"; si.clipPath = poly(piece);
    });
    // out from the tip each hinge bends further than the last: the loose end curls up toward you
    const k0 = Math.max(0, Math.min(BAG_K - 1, Math.floor((d > 0 ? xt - 1e-6 : xt) / w))), bend = (3.5 + 4 * p) * S.roll * P.curl + S.lift.x;
    const jit = Math.min(1, Math.abs(S.pv) * 0.4) * 1.6, t = (performance.now() - S.t0) / 1000;
    let m = `translateZ(${(P.depth / 2 + 0.5).toFixed(1)}px) `, sum = 0;
    for (let n = 0, k = k0; k >= 0 && k < BAG_K; n++, k -= d) {
      const x = ((n ? (d > 0 ? k + 1 : k) * w : xt) / 100 * W).toFixed(2), a = d * (bend * (0.4 + 0.32 * n) + Math.sin(t * 16 + n * 0.9) * jit);
      sum += a; m += `translateX(${x}px) rotateY(${a.toFixed(2)}deg) rotateX(${(-Math.abs(a) * 0.7).toFixed(2)}deg) translateX(-${x}px) `;
      plies[k].el.style.transform = m; plies[k].shade.style.opacity = Math.min(0.26, Math.abs(sum) / 300).toFixed(2); plies[k].el.classList.toggle("flip", Math.abs(sum) > 80);
    }
  }
  // soft diffused light from the mouth: a pastel haze grows wherever the tear has run past, breathes gently,
  // flares once as the bag opens and then fades away with it (it does not hang in the air after)
  function drawRays(t) {
    const xt = S.dir > 0 ? S.p * 100 : 100 - S.p * 100, since = S.openAt ? t - S.openAt : -1;
    rays.forEach((r, j) => {
      if (P.rays && S.p > 0 && (S.dir > 0 ? r.x < xt : r.x > xt)) r.on = true;
      r.g.to = !r.on ? 0 : since < 0 ? 1 : since < 0.25 ? 1.45 : 0;
      const g = Math.max(0, r.g.x), L = r.len * g * (1 + Math.sin(t * 1.3 + r.ph) * 0.08), base = (70 + yAt(r.x) / 100 * P.h) / (70 + 0.3 * P.h) * 100 + 3;
      if (L < 0.5) { rayEls[j].setAttribute("d", ""); return; }
      const cx = r.x + (r.x - 50) * 0.12 * g, rx = 5 + 7 * g, ry = L * 0.55, cy = base - ry * 0.75; // a wide soft ellipse leaning outward
      rayEls[j].setAttribute("d", `M${(cx - rx).toFixed(2)} ${cy.toFixed(2)}a${rx.toFixed(2)} ${ry.toFixed(2)} 0 1 0 ${(2 * rx).toFixed(2)} 0a${rx.toFixed(2)} ${ry.toFixed(2)} 0 1 0 ${(-2 * rx).toFixed(2)} 0Z`);
    });
    raysEl.style.transform = `translateY(${S.y.x.toFixed(1)}px) rotate(${(S.rz.x * 0.6).toFixed(2)}deg)`; // the light stays with the bag
  }
  // glowing stars from the mouth: a trickle while it tears, a burst when it opens
  function emit(n, burst) {
    const R = fx.getBoundingClientRect(), PR = pack.getBoundingClientRect(), xt = S.dir > 0 ? S.p : 1 - S.p;
    for (let i = 0; i < n; i++) {
      const u = burst ? Math.random() : S.dir > 0 ? Math.random() * xt : xt + Math.random() * (1 - xt);
      const x = PR.left - R.left + u * PR.width, y = PR.top - R.top + yAt(u * 100) / 100 * PR.height;
      const sp = burst ? 260 + Math.random() * 520 : 90 + Math.random() * 200, a = -Math.PI / 2 + (Math.random() - 0.5) * (burst ? 2.2 : 1.2) + (u - 0.5) * 0.8;
      S.stars.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: (burst ? 4 : 2.6) + Math.random() * (burst ? 6 : 4), rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 6,
        life: 0, max: 0.9 + Math.random() * (burst ? 1.2 : 0.7), c: BAG_STAR_COLORS[(Math.random() * BAG_STAR_COLORS.length) | 0], tw: Math.random() * 6.28, pts: Math.random() < 0.6 ? 4 : 5 });
    }
  }
  function drawStars(dt) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = fx.clientWidth, H = fx.clientHeight;
    if (fx.width !== W * dpr) { fx.width = W * dpr; fx.height = H * dpr; }
    g2.setTransform(dpr, 0, 0, dpr, 0, 0); g2.clearRect(0, 0, W, H);
    S.stars = S.stars.filter(s => (s.life += dt) < s.max);
    for (const s of S.stars) {
      s.vy += 380 * dt; s.vx *= 0.985; s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt;
      const k = s.life / s.max, alpha = (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85) * (0.75 + 0.25 * Math.sin(s.tw + s.life * 18)), r = s.r * (0.7 + 0.3 * Math.sin(s.tw + s.life * 9));
      g2.save(); g2.translate(s.x, s.y); g2.rotate(s.rot); g2.globalAlpha = Math.max(0, alpha);
      g2.shadowColor = s.c; g2.shadowBlur = r * 3.2; g2.fillStyle = s.c; g2.beginPath();
      const inner = s.pts === 4 ? r * 0.28 : r * 0.45;
      for (let i = 0; i < s.pts * 2; i++) { const a = i * Math.PI / s.pts, rr = i % 2 ? inner : r; g2.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      g2.closePath(); g2.fill(); g2.shadowBlur = 0; g2.globalAlpha = Math.max(0, alpha) * 0.9; g2.fillStyle = "#fff"; g2.beginPath(); g2.arc(0, 0, r * 0.22, 0, 6.28); g2.fill(); g2.restore();
    }
  }
  function finish() {
    if (S.state !== "idle") return;
    S.state = "open"; S.pTo = S.p = 1; clips(1); S.openAt = (performance.now() - S.t0) / 1000;
    bagSfx(P, "rip"); buzz([14, 40, 24]);
    S.fly = { x: 0, y: 0, vx: S.dir * P.throw * 0.14, vy: -P.throw, rz: 0, vrz: S.dir * (220 + Math.random() * 200), rx: 0, vrx: -380 };
    S.y.v += 260; S.rz.v -= S.dir * 40;
    if (P.stars && !reduced) emit(Math.round(46 * P.starCount), true);
    stage.classList.add("opened");
    if (opts.figure) setTimeout(() => { fig.classList.add("rise"); bagSfx(P, "pop"); buzz(18); }, 220); // else the caller fills the figure and lifts it
    opts.onOpen?.();
  }
  function auto() { if (S.state !== "idle") return; if (!S.pTo) S.dir = Math.random() < 0.5 ? 1 : -1; S.auto = true; }

  const onDown = e => {
    if (S.state !== "idle" || e.button) return;
    stage.setPointerCapture(e.pointerId); bagSfx(P, "crinkle");
    S.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, p0: S.pTo, moved: false, dy: 0 };
  };
  const onMove = e => {
    const r = stage.getBoundingClientRect(); S.pointer = [(e.clientX - r.left) / r.width * 2 - 1, (e.clientY - r.top) / r.height * 2 - 1];
    const d = S.drag; if (!d || e.pointerId !== d.id || S.state !== "idle") return;
    const dx = e.clientX - d.x0; let dy = e.clientY - d.y0;
    if (!d.moved) { if (Math.hypot(dx, dy) < 6) return; d.moved = true; }
    if (S.pTo === 0) { // nothing tears until the hand goes sideways; until then it's just a tug
      d.dy = dy;
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 0.6) return;
      S.dir = dx < 0 ? -1 : 1; d.y0 = e.clientY; dy = 0; d.dy = 0; bagSfx(P, "tick"); buzz(6);
    }
    const p = Math.max(S.pTo, Math.min(1, d.p0 + Math.abs(dx) / (pack.offsetWidth * P.pull)));
    if (Math.floor(p * 12) > Math.floor(S.pTo * 12)) { bagSfx(P, "tick"); buzz(3); }
    S.pTo = p; S.lift.to = Math.max(-6, Math.min(20, -dy * 0.15)); // pull up and the strip lifts more
    if (p >= 0.98) finish();
  };
  const onUp = e => { const d = S.drag; S.drag = null; if (!d || S.state !== "idle") return; if (!d.moved || S.pTo > 0.62) auto(); };
  const onLeave = () => { S.pointer = null; };
  stage.addEventListener("pointerdown", onDown); stage.addEventListener("pointermove", onMove);
  stage.addEventListener("pointerup", onUp); stage.addEventListener("pointercancel", onUp); stage.addEventListener("pointerleave", onLeave);

  let raf = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - S.last) / 1000), t = (now - S.t0) / 1000; S.last = now;
    const motion = reduced ? 0 : 1, d = S.drag;
    if (S.state === "idle") {
      const tug = motion && d?.moved && !S.pTo ? Math.sign(d.dy) * P.stretch * (1 - 1 / (1 + Math.abs(d.dy) / Math.max(1, P.stretch))) : 0;
      S.stretch.to = 1 + Math.abs(tug) / 520 + (d ? 0.012 : 0);
      const [nx, ny] = S.pointer || [0, 0], tilt = d?.moved ? 0.3 : 1;
      S.ry.to = nx * P.tilt * tilt; S.rx.to = -ny * P.tilt * 0.7 * tilt - 6;
      S.y.to = Math.sin(t * 1.4) * P.float * motion + tug;
      S.rz.to = Math.sin(t * 0.9) * 1.5 * motion - (S.p > 0 ? S.dir * S.p * 3 : 0);
      if (P.wiggle > 0 && !d && S.pTo < 1 && motion && t > S.nudgeAt) { S.rz.v += (Math.random() < 0.5 ? -1 : 1) * 60; if (S.pTo) S.lift.v += 60; S.nudgeAt = t + P.wiggle + Math.random() * 2; bagSfx(P, "crinkle"); }
      if (S.auto) { S.pTo = Math.min(1, S.pTo + dt * P.tearSpeed); if (Math.random() < 0.3) bagSfx(P, "tick"); if (S.pTo >= 1) finish(); }
    } else { S.rx.to = 0; S.ry.to = 0; S.rz.to = 0; S.y.to = 24; S.stretch.to = 1; }
    if (t > S.blinkAt) { S.blinkAt = t + 2.2 + Math.random() * 3; const e = body.querySelector(".bg-eyes"); if (e) { e.classList.add("blink"); setTimeout(() => e.classList.remove("blink"), 140); } }
    for (const s of [S.rx, S.ry, S.rz, S.y, S.stretch, S.lift]) for (let k = 0; k < 2; k++) s.step(dt / 2);
    for (const r of rays) for (let k = 0; k < 2; k++) r.g.step(dt / 2);
    const prev = S.p; S.p += (S.pTo - S.p) * Math.min(1, dt * 16); S.pv = (S.p - prev) / Math.max(dt, 1e-3);
    if (S.state === "idle") {
      clips(S.p);
      if (P.stars && !reduced && S.p > 0.02) { S.emitAcc += dt * (4 + Math.abs(S.pv) * 30) * P.starCount; while (S.emitAcc > 1) { emit(1, false); S.emitAcc -= 1; } if (t > S.twinkleAt && S.pv > 0.05) { bagSfx(P, "twinkle"); S.twinkleAt = t + 0.12; } }
    }
    pack.style.transform = `translateY(${S.y.x.toFixed(1)}px) rotateX(${S.rx.x.toFixed(2)}deg) rotateY(${S.ry.x.toFixed(2)}deg) rotate(${S.rz.x.toFixed(2)}deg) scaleY(${S.stretch.x.toFixed(3)})`;
    pack.style.setProperty("--gx", `${50 + S.ry.x * 2}%`); pack.style.setProperty("--gy", `${30 - S.rx.x * 2}%`); pack.style.setProperty("--ha", `${S.ry.x * 6 + S.rx.x * 4}deg`);
    // one light from the upper left: tilting turns one side of the bag toward it and the other into shade
    const sl = Math.max(0, S.ry.x) / 40 + 0.04, sr = Math.max(0, -S.ry.x) / 40 + 0.06, sb = Math.max(0, -S.rx.x - 2) / 45 + 0.05, stt = Math.max(0, S.rx.x + 8) / 60;
    for (const [k, v] of [["--sl", sl], ["--sr", sr], ["--sb", sb], ["--st", stt]]) pack.style.setProperty(k, Math.min(0.4, v).toFixed(3));
    if (Math.abs(S.ry.x - litAt[0]) + Math.abs(S.rx.x - litAt[1]) > 1.2) { // relight the creases only when the tilt really changed
      litAt = [S.ry.x, S.rx.x]; const az = (235 - S.ry.x * 3.5).toFixed(1), el = Math.max(20, Math.min(75, 48 + S.rx.x * 1.4)).toFixed(1);
      for (const l of lights) { l.setAttribute("azimuth", az); l.setAttribute("elevation", el); }
    }
    pack.style.setProperty("--lx", `${(S.ry.x * 0.35).toFixed(2)}px`); pack.style.setProperty("--ly", `${(-S.rx.x * 0.3).toFixed(2)}px`); // the figure inside shifts as it tilts
    $q(".bg-shadow").style.transform = `scale(${(1 - S.y.x / 300).toFixed(3)})`;
    if (S.fly) { // the strip is thrown: it races up, flips and spins away
      const f = S.fly; f.vy += 3000 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rz += f.vrz * dt; f.rx += f.vrx * dt;
      strip.style.transform = `translate3d(${f.x.toFixed(1)}px, ${f.y.toFixed(1)}px, 40px) rotateX(${f.rx.toFixed(1)}deg) rotate(${(-S.dir * f.rz).toFixed(1)}deg)`;
      strip.style.opacity = Math.max(0, 1 - Math.abs(f.y) / 520).toFixed(2); cut.parentNode.style.opacity = "0";
    }
    drawRays(t); drawStars(dt);
    raf = requestAnimationFrame(frame);
  }
  clips(0); raf = requestAnimationFrame(frame);
  return {
    tear: auto, setFigure: html => { fig.innerHTML = html; },
    destroy() { cancelAnimationFrame(raf); for (const [k, f] of [["pointerdown", onDown], ["pointermove", onMove], ["pointerup", onUp], ["pointercancel", onUp], ["pointerleave", onLeave]]) stage.removeEventListener(k, f); },
  };
}

// ---------- the app: one bag per series tint, the figure comes from tearBox() in toys.js ----------
const BAG_TINT = { dubai: "#f6c9b9", spirits: "#bfc0ee", cats: "#e7bfe6", monsters: "#b9dcec" };
const bagParams = series => ({ tint: BAG_TINT[series] || "#c9c3ef", subtitle: toySeries(series)?.name || "" });
// the small bags in the list are pictures of the 3D bag itself (rendered once per series and kept); until the
// picture is ready, and where there is no WebGL, a drawn look-alike stands in
const bagStills = {};
let bagStillBusy = false;
// pictures are kept in the browser, so after the first visit the list shows the real bags at once
const BAG_STILL_VER = "s1";
const bagStillKey = series => { const p = bagParams(series); return `bag-still:${BAG_STILL_VER}:${series}:${toyHash(p.tint + p.subtitle)}`; };
function bagStillCached(series) { try { return localStorage.getItem(bagStillKey(series)); } catch (e) { return null; } }
async function bagStillRun() {
  if (bagStillBusy || typeof bag3dStill !== "function" || !bag3dOk()) return; bagStillBusy = true;
  try {
    const THREE = await bag3dLoad();
    for (let series; (series = Object.keys(bagStills).find(k => !bagStills[k]));) {
      const url = await bag3dStill(THREE, { ...bagParams(series), sound: false }); bagStills[series] = url;
      try { localStorage.setItem(bagStillKey(series), url); } catch (e) {}
      document.querySelectorAll(`[data-mini="${series}"]`).forEach(el => { el.outerHTML = `<img class="bg-mini-img appear" src="${url}" alt="">`; });
    }
  } catch (e) {}
  bagStillBusy = false;
}
const bagMini = series => {
  if (!bagStills[series]) { const c = bagStillCached(series); if (c) bagStills[series] = c; }
  if (bagStills[series]) return `<img class="bg-mini-img" src="${bagStills[series]}" alt="">`;
  const flat = () => bagMiniHtml({ ...BAG_DEFAULTS, ...bagParams(series) });
  if (typeof bag3dStill !== "function" || !bag3dOk()) return flat(); // no 3D here: the drawn bag is all there is
  if (!(series in bagStills)) { bagStills[series] = null; setTimeout(bagStillRun, 0); }
  // until the picture is ready, a soft glow in the series colour holds its place
  return `<span class="bg-mini-ph" data-mini="${series}" style="--tint:${bagParams(series).tint}" aria-hidden="true"></span>`;
};
let bagLive = null, bagSeries = null;
function bagOpen(b) { bagSeries = b.series; return `<div id="bagStage"></div>`; }
// the bag is real 3D where WebGL and the library are there, the flat bag otherwise
async function bagMount() {
  const st = document.getElementById("bagStage"); if (!st) return;
  bagClose();
  const P = { ...bagParams(bagSeries), sound: !muted }, o = { figId: "bagFig", onOpen: () => tearBox() };
  if (typeof createBag3D === "function" && bag3dOk()) {
    try { const THREE = await bag3dLoad(); if (document.getElementById("bagStage") !== st) return; bagLive = createBag3D(THREE, st, P, o); return; } catch (e) {}
  }
  if (document.getElementById("bagStage") === st) bagLive = createBag(st, P, o);
}
function bagClose() { bagLive?.destroy(); bagLive = null; }
bagInjectCss();
