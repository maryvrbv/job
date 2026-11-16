// «Коллекция»: original vinyl-toy figures drawn in SVG. Four series of 12 figures and one secret each.
// Every figure is built from shared parts (vinyl shading, eyes, mouths, small props) plus its own body,
// so the whole shelf keeps one style. Nothing here copies an existing toy line.

const TOY_INK = "#231f2b";
function toyMix(hex, amt) { // amt > 0 lightens toward white, < 0 darkens toward black
  const n = parseInt(hex.slice(1), 16), t = amt > 0 ? 255 : 0, p = Math.abs(amt);
  const ch = s => Math.round(((n >> s) & 255) + (t - ((n >> s) & 255)) * p);
  return "#" + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}
// glossy vinyl: a light spot up left, the base colour, a darker rim
const vinyl = (id, c) => `<radialGradient id="${id}" cx="36%" cy="28%" r="80%"><stop offset="0" stop-color="${toyMix(c, 0.38)}"/><stop offset=".55" stop-color="${c}"/><stop offset="1" stop-color="${toyMix(c, -0.25)}"/></radialGradient>`;
const GOLD = "#e2b23a";

function toyEyes(x, y, gap, style = "dot", r = 5.4) {
  const ink = TOY_INK;
  const dot = (cx, rr = r) => `<ellipse cx="${cx}" cy="${y}" rx="${rr * 0.86}" ry="${rr}" fill="${ink}"/><circle cx="${cx - rr * 0.3}" cy="${y - rr * 0.42}" r="${rr * 0.34}" fill="#fff"/><circle cx="${cx + rr * 0.32}" cy="${y + rr * 0.36}" r="${rr * 0.14}" fill="#fff"/>`;
  const arcUp = cx => `<path d="M${cx - r} ${y + 1.5}q${r} ${-r * 1.5} ${2 * r} 0" stroke="${ink}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  const arcDown = cx => `<path d="M${cx - r} ${y - 0.5}q${r} ${r * 1.2} ${2 * r} 0" stroke="${ink}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  const side = (cx, dx) => `<ellipse cx="${cx}" cy="${y}" rx="${r * 1.05}" ry="${r * 1.15}" fill="#fff" stroke="${ink}" stroke-width="1.2"/><circle cx="${cx + dx}" cy="${y + 0.5}" r="${r * 0.55}" fill="${ink}"/><circle cx="${cx + dx - 1}" cy="${y - 1}" r="${r * 0.18}" fill="#fff"/>`;
  const star = cx => dot(cx, r * 1.15) + `<path d="M${cx + r * 0.2} ${y - r * 0.2}l1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1z" fill="#fff"/>`;
  const L = x - gap, R = x + gap;
  switch (style) {
    case "happy": return arcUp(L) + arcUp(R);
    case "sleepy": return arcDown(L) + arcDown(R);
    case "wink": return dot(L) + arcUp(R);
    case "star": return star(L) + star(R);
    case "side": return side(L, 2.4) + side(R, 2.4);
    case "one": return dot(x, r * 1.7);
    case "three": return dot(x - gap * 1.1, r * 0.8) + dot(x, r * 1.05) + dot(x + gap * 1.1, r * 0.8);
    case "worried": return dot(L) + dot(R) + `<path d="M${L - r} ${y - r - 3}l${r * 1.6} ${-2.4}M${R + r} ${y - r - 3}l${-r * 1.6} ${-2.4}" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`;
    case "angry": return dot(L) + dot(R) + `<path d="M${L - r} ${y - r - 4.5}l${r * 1.7} ${2.6}M${R + r} ${y - r - 4.5}l${-r * 1.7} ${2.6}" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>`;
    case "big": return dot(L, r * 1.3) + dot(R, r * 1.3);
    default: return dot(L) + dot(R);
  }
}
function toyMouth(x, y, style = "smile") {
  const ink = TOY_INK, s = `stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  switch (style) {
    case "open": return `<path d="M${x - 6} ${y - 1}q6 9 12 0z" fill="${ink}"/><path d="M${x - 3} ${y + 2.6}q3 2.4 6 0" fill="#e86f7c"/>`;
    case "cat": return `<path d="M${x - 6} ${y}q3 3.5 6 0q3 3.5 6 0" ${s}/>`;
    case "o": return `<ellipse cx="${x}" cy="${y + 1}" rx="2.6" ry="3.2" fill="${ink}"/>`;
    case "fang": return `<path d="M${x - 6} ${y}q6 5 12 0" ${s}/><path d="M${x + 2} ${y + 1.6}l1.6 3.4 1.6-3.8z" fill="#fff" stroke="${ink}" stroke-width="1"/>`;
    case "teeth": return `<path d="M${x - 8} ${y - 1}h16q-1 7-8 7t-8-7z" fill="${ink}"/><path d="M${x - 7} ${y - 1}l2 3 2-3 2 3 2-3 2 3 2-3 2 3" fill="#fff"/>`;
    case "flat": return `<path d="M${x - 4} ${y + 1}h8" ${s}/>`;
    case "wobble": return `<path d="M${x - 7} ${y + 1}q1.75-2.5 3.5 0t3.5 0 3.5 0 3.5 0" ${s}/>`;
    case "frown": return `<path d="M${x - 5} ${y + 3}q5-5 10 0" ${s}/>`;
    case "grin": return `<path d="M${x - 8} ${y - 1}q8 11 16 0z" fill="${ink}"/><path d="M${x - 6} ${y}h12l-1 2h-10z" fill="#fff"/>`;
    default: return `<path d="M${x - 5} ${y}q5 5 10 0" ${s}/>`;
  }
}
const toyBlush = (x, y, gap, c = "#ff8fa3") => `<ellipse cx="${x - gap}" cy="${y}" rx="5" ry="3" fill="${c}" opacity=".55"/><ellipse cx="${x + gap}" cy="${y}" rx="5" ry="3" fill="${c}" opacity=".55"/>`;
const toyShadow = (w = 34) => `<ellipse cx="60" cy="142" rx="${w}" ry="5" fill="#000" opacity=".13"/>`;

// small props a figure holds in front of it (centred on x, y)
function toyProp(kind, x, y) {
  const ink = TOY_INK, line = `stroke="${ink}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"`;
  switch (kind) {
    case "letter": return `<g transform="translate(${x - 11} ${y - 7})"><rect width="22" height="15" rx="2.5" fill="#fff" ${line}/><path d="M1.5 2l9.5 7 9.5-7" fill="none" ${line}/><circle cx="17" cy="4" r="2.6" fill="#ff6b81"/></g>`;
    case "folder": return `<g transform="translate(${x - 12} ${y - 9})"><path d="M0 3a2 2 0 0 1 2-2h6l3 3h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2z" fill="#ffd166" ${line}/><path d="M5 9h14M5 13h9" ${line}/></g>`;
    case "mug": return `<g transform="translate(${x - 9} ${y - 9})"><path d="M14 6h2.5a3.5 3.5 0 0 1 0 7H14" fill="none" ${line}/><rect x="0" y="3" width="15" height="15" rx="3" fill="#fff" ${line}/><path d="M4 0q1 1.5 0 3M9 0q1 1.5 0 3" fill="none" stroke="#b0a8b9" stroke-width="1.3" stroke-linecap="round"/><path d="M4 10h7" stroke="#c98a5b" stroke-width="3" stroke-linecap="round"/></g>`;
    case "laptop": return `<g transform="translate(${x - 15} ${y - 10})"><rect x="3" y="0" width="24" height="16" rx="2" fill="#5b6b8c" ${line}/><circle cx="15" cy="8" r="2.4" fill="#fff" opacity=".8"/><path d="M0 16h30l-2 4H2z" fill="#c9d1e3" ${line}/></g>`;
    case "phone": return `<g transform="translate(${x - 7} ${y - 11})"><rect width="14" height="22" rx="3" fill="#3a3550" ${line}/><rect x="2.5" y="3" width="9" height="13" rx="1.5" fill="#8fd3ff"/><circle cx="7" cy="18.6" r="1.1" fill="#fff"/></g>`;
    case "pencil": return `<g transform="translate(${x} ${y}) rotate(-35)"><rect x="-3" y="-14" width="6" height="22" rx="1" fill="#ffc53d" ${line}/><path d="M-3 8l3 6 3-6z" fill="#f6d7b0" ${line}/><path d="M-1 12.5l1 1.8 1-1.8z" fill="${ink}"/><rect x="-3" y="-17" width="6" height="4" rx="1" fill="#ff8fa3" ${line}/></g>`;
    case "hourglass": return `<g transform="translate(${x - 8} ${y - 11})"><path d="M0 1h16M0 21h16" ${line}/><path d="M2 1q0 7 6 10q6-3 6-10zM2 21q0-7 6-10q6 3 6 10z" fill="#e9f4ff" ${line}/><path d="M5 19q3-4 6 0z" fill="#f2b84b"/></g>`;
    case "suitcase": return `<g transform="translate(${x - 13} ${y - 10})"><path d="M9 3V1h8v2" fill="none" ${line}/><rect y="3" width="26" height="17" rx="3" fill="#e76f51" ${line}/><path d="M0 9h26" ${line}/><circle cx="8" cy="14" r="2.2" fill="#ffd166"/><path d="M14 12h7v4h-7z" fill="#fff" opacity=".8"/></g>`;
    case "tablet": return `<g transform="translate(${x - 12} ${y - 9})"><rect width="20" height="17" rx="2.5" fill="#2f3a56" ${line}/><path d="M4 12q4-7 8-2t5-4" stroke="#ff9ec4" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M19 15l7-11" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M19 15l7-11" ${line} opacity=".6"/></g>`;
    case "magnifier": return `<g transform="translate(${x} ${y})"><circle cx="-2" cy="-3" r="7" fill="#d9f2ff" fill-opacity=".7" ${line}/><path d="M3 2l7 7" stroke="${ink}" stroke-width="3" stroke-linecap="round"/></g>`;
    case "ruler": return `<g transform="translate(${x} ${y}) rotate(-20)"><rect x="-14" y="-4" width="28" height="8" rx="1.5" fill="#ffd166" ${line}/><path d="M-10 -4v3M-6 -4v2M-2 -4v3M2 -4v2M6 -4v3M10 -4v2" ${line}/></g>`;
    case "clock": return `<g transform="translate(${x} ${y})"><circle r="9" fill="#fff" ${line}/><path d="M0-5v5l3.5 2" ${line}/><path d="M-6-9l-3 2M6-9l3 2" ${line}/></g>`;
    case "stylus": return `<g transform="translate(${x} ${y}) rotate(30)"><rect x="-2.2" y="-13" width="4.4" height="20" rx="2" fill="#f1f1f5" ${line}/><path d="M-2.2 7l2.2 5 2.2-5z" fill="#9aa3b5" ${line}/></g>`;
    case "note": return `<g transform="translate(${x - 9} ${y - 9}) rotate(-6 9 9)"><rect width="18" height="18" rx="1.5" fill="#fff07a" ${line}/><path d="M4 6h10M4 10h7" ${line}/></g>`;
    case "palette": return `<g transform="translate(${x} ${y})"><path d="M-11 0a11 9 0 1 1 15 8c-3 1-2-3-5-3s-10 3-10-5z" fill="#fff" ${line}/><circle cx="-5" cy="-3" r="2" fill="#ff6b81"/><circle cx="0" cy="-5" r="2" fill="#ffd166"/><circle cx="5" cy="-3" r="2" fill="#4cc9f0"/><circle cx="6" cy="2" r="2" fill="#80ed99"/></g>`;
    case "heart": return `<path d="M${x} ${y + 7}c-8-5-11-9-11-13a5.5 5.5 0 0 1 11-1 5.5 5.5 0 0 1 11 1c0 4-3 8-11 13z" fill="#ff5c7a" ${line}/>`;
    case "trophy": return `<g transform="translate(${x - 10} ${y - 11})"><path d="M4 1h12v6a6 6 0 0 1-12 0z" fill="${GOLD}" ${line}/><path d="M4 3H1q0 5 4 6M16 3h3q0 5-4 6" fill="none" ${line}/><path d="M10 13v4M6 20h8l-1-3H7z" fill="${GOLD}" ${line}/></g>`;
    case "cv": return `<g transform="translate(${x - 9} ${y - 11}) rotate(5 9 11)"><path d="M0 0h13l5 5v17H0z" fill="#fff" ${line}/><circle cx="6" cy="7" r="2.6" fill="#9ad1ff"/><path d="M4 13h10M4 16.5h8M4 20h6" ${line}/></g>`;
    default: return "";
  }
}
// paws holding a prop: two small rounded hands in front, the prop between them
const toyHands = (c, y = 106, gap = 15) => `<ellipse cx="${60 - gap}" cy="${y}" rx="7" ry="6" fill="${c}" stroke="${toyMix(c, -0.3)}" stroke-width="1.2"/><ellipse cx="${60 + gap}" cy="${y}" rx="7" ry="6" fill="${c}" stroke="${toyMix(c, -0.3)}" stroke-width="1.2"/>`;
const toyFeet = (c, y = 135, gap = 13) => `<ellipse cx="${60 - gap}" cy="${y}" rx="10" ry="6" fill="${toyMix(c, -0.12)}"/><ellipse cx="${60 + gap}" cy="${y}" rx="10" ry="6" fill="${toyMix(c, -0.12)}"/>`;
const gloss = (x, y, rx = 11, ry = 6) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity=".35" transform="rotate(-20 ${x} ${y})"/>`;

// ---------- figures: a big-headed kid in a costume hood ----------
// One renderer for every figure: a soft matte vinyl kid with a hood shaped by the character, a rolly costume body,
// tiny mitten hands holding a prop and a little round base. Fluffy ones get a soft fur edge.
const KID_SKIN = "#ffe3d3", INK = "#2b1d24";
const toyHashArt = s => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
function kidEyes(style, color = INK) {
  const L = 51, R = 69, y = 71;
  const dot = (x, k = 1) => `<ellipse cx="${x}" cy="${y}" rx="${4.4 * k}" ry="${5.2 * k}" fill="${color}"/><ellipse cx="${x - 1.4 * k}" cy="${y - 2 * k}" rx="${1.7 * k}" ry="${1.9 * k}" fill="#fff"/><circle cx="${x + 1.5 * k}" cy="${y + 1.8 * k}" r="${0.8 * k}" fill="#fff" opacity=".9"/>`;
  const shut = x => `<path d="M${x - 4.5} ${y}q4.5 3.6 9 0" stroke="${INK}" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M${x - 4.5} ${y + .4}l-1.6 1.4M${x + 4.5} ${y + .4}l1.6 1.4" stroke="${INK}" stroke-width="1.2" stroke-linecap="round"/>`;
  const happy = x => `<path d="M${x - 4.5} ${y + 1.5}q4.5-5 9 0" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  const star = x => dot(x, 1.12) + `<path d="M${x + 1} ${y - 2.6}l.8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8z" fill="#fff"/>`;
  const side = x => `<ellipse cx="${x}" cy="${y}" rx="4.6" ry="5.2" fill="#fff" stroke="${INK}" stroke-width=".8"/><ellipse cx="${x + 2}" cy="${y + .5}" rx="2.6" ry="3.2" fill="${color}"/><circle cx="${x + 1.3}" cy="${y - .6}" r=".9" fill="#fff"/>`;
  switch (style) {
    case "sleepy": return shut(L) + shut(R);
    case "happy": return happy(L) + happy(R);
    case "wink": return dot(L) + happy(R);
    case "star": return star(L) + star(R);
    case "side": return side(L) + side(R);
    case "worried": return dot(L) + dot(R) + `<path d="M${L - 5} ${y - 8}l7-2.2M${R + 5} ${y - 8}l-7-2.2" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`;
    case "cross": return dot(L) + dot(R) + `<path d="M${L - 5} ${y - 9.5}l7 2.4M${R + 5} ${y - 9.5}l-7 2.4" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`;
    case "cry": return dot(L) + dot(R) + `<path d="M${L - 4} ${y + 4}q-1 7 2 9q3-2 2-9z" fill="#dff4ff" stroke="#8fcfff" stroke-width=".8"/><path d="M${R + 4} ${y + 4}q1 7-2 9q-3-2-2-9z" fill="#dff4ff" stroke="#8fcfff" stroke-width=".8"/>`;
    default: return dot(L) + dot(R);
  }
}
function kidMouth(style) {
  const s = `stroke="${INK}" stroke-width="1.5" fill="none" stroke-linecap="round"`;
  switch (style) {
    case "open": return `<path d="M56.5 81.5q3.5 5 7 0z" fill="#c8506a"/>`;
    case "o": return `<ellipse cx="60" cy="83" rx="1.8" ry="2.2" fill="#c8506a"/>`;
    case "smile": return `<path d="M57 81.5q3 3 6 0" ${s}/>`;
    case "cat": return `<path d="M56 81.5q2 2 4 0q2 2 4 0" ${s}/>`;
    case "wobble": return `<path d="M55.5 83q1.1-1.6 2.25 0t2.25 0 2.25 0 2.25 0" ${s}/>`;
    case "flat": return `<path d="M58 82.5h4" ${s}/>`;
    case "grin": return `<path d="M55 81q5 6 10 0z" fill="#c8506a"/><path d="M55.6 81.2h8.8" stroke="#fff" stroke-width="1.2"/>`;
    case "pout": return `<ellipse cx="60" cy="82.6" rx="2.4" ry="1.6" fill="#e98aa0"/>`;
    default: return "";
  }
}
// the hair under the hood: a soft fringe
const kidHair = (c, style) => style === "none" ? "" : style === "side"
  ? `<path d="M34.6 67q0-22 25.4-22.8q25.4 0.8 25.4 20q-10-8-22-6q-12 2-28.8 8.8z" fill="${c}"/>`
  : `<path d="M34.6 65q1-20.6 25.4-20.6t25.4 20.6q-6.6-5.6-13.4-5.6q-2 5-6 5q-2-5-6-5q-2 5-6 5q-2-5-6-5q-6.8 0-13.4 5.6z" fill="${c}"/>`; // the hair covers the top of the face, so no skin peeks out under the hood
// small signs of each character on or around the hood
function hoodParts(f, c, dark, inner) {
  const back = [], front = [];
  const ear = (d, di) => { back.push(`<path d="${d}" fill="url(#HOOD)" stroke="${dark}" stroke-width="1.2" stroke-linejoin="round"/>`); if (di) back.push(`<path d="${di}" fill="${inner}"/>`); };
  const hoodEyes = (y = 28, gap = 11, r = 5) => front.push(`<circle cx="${60 - gap}" cy="${y}" r="${r}" fill="#fff" stroke="${dark}" stroke-width="1"/><circle cx="${60 + gap}" cy="${y}" r="${r}" fill="#fff" stroke="${dark}" stroke-width="1"/><circle cx="${60 - gap + 1}" cy="${y + .6}" r="${r * .5}" fill="${INK}"/><circle cx="${60 + gap + 1}" cy="${y + .6}" r="${r * .5}" fill="${INK}"/>`);
  switch (f.hood) {
    case "cat": ear("M24 50L27 14L52 32Z", "M29 42l1-20 14 12z"); ear("M96 50L93 14L68 32Z", "M91 42l-1-20-14 12z"); break;
    case "bear": back.push(`<circle cx="28" cy="34" r="12" fill="url(#HOOD)" stroke="${dark}" stroke-width="1.2"/><circle cx="92" cy="34" r="12" fill="url(#HOOD)" stroke="${dark}" stroke-width="1.2"/><circle cx="28" cy="34" r="6" fill="${inner}"/><circle cx="92" cy="34" r="6" fill="${inner}"/>`); break;
    case "bigears": ear("M22 52L10 0L54 30Z", "M25 42l-8-32 26 20z"); ear("M98 52L110 0L66 30Z", "M95 42l8-32-26 20z"); break;
    case "roundears": back.push(`<ellipse cx="30" cy="22" rx="14" ry="19" fill="url(#HOOD)" stroke="${dark}" stroke-width="1.2" transform="rotate(-18 30 22)"/><ellipse cx="90" cy="22" rx="14" ry="19" fill="url(#HOOD)" stroke="${dark}" stroke-width="1.2" transform="rotate(18 90 22)"/><ellipse cx="31" cy="24" rx="8" ry="12" fill="${inner}" transform="rotate(-18 31 24)"/><ellipse cx="89" cy="24" rx="8" ry="12" fill="${inner}" transform="rotate(18 89 24)"/>`); break;
    case "wideears": ear("M18 58L14 28L44 38Z", "M21 52l-2-16 14 6z"); ear("M102 58L106 28L76 38Z", "M99 52l2-16-14 6z"); front.push(`<path d="M44 30v6M60 26v7M76 30v6" stroke="${dark}" stroke-width="2.4" stroke-linecap="round"/>`); break;
    case "horns": back.push(`<path d="M46 30L36 -4" stroke="#4a3e36" stroke-width="5" stroke-linecap="round"/><path d="M74 30L84 -4" stroke="#4a3e36" stroke-width="5" stroke-linecap="round"/><path d="M41 16l5-1M39 8l5-1M79 16l-5-1M81 8l-5-1" stroke="#8b7d70" stroke-width="1.4"/>`); ear("M24 46q-14-2-18 6q10 4 20 0z"); ear("M96 46q14-2 18 6q-10 4-20 0z"); front.push(`<path d="M52 30q8-5 16 0l-1 7h-14z" fill="#4a3e36" opacity=".55"/>`); break;
    case "curvehorns": back.push(`<path d="M46 32q-12-14-4-34" stroke="#5b4636" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M74 32q12-14 4-34" stroke="#5b4636" stroke-width="5" fill="none" stroke-linecap="round"/>`); ear("M24 48q-14-4-18 4q10 6 20 2z"); ear("M96 48q14-4 18 4q-10 6-20 2z"); break;
    case "camel": ear("M30 34q-6-10 2-14q6 4 4 14z"); ear("M90 34q6-10-2-14q-6 4-4 14z"); back.push(`<ellipse cx="60" cy="24" rx="20" ry="12" fill="url(#HOOD)" stroke="${dark}" stroke-width="1"/>`); front.push(`<path d="M46 30q14-8 28 0" stroke="${dark}" stroke-width="1.4" fill="none" opacity=".5"/>`); break;
    case "bird": hoodEyes(30, 11, 4.6); front.push(`<path d="M53 37h14q-2 8-7 10q-5-2-7-10z" fill="#f2c14e" stroke="#c99627" stroke-width="1" stroke-linejoin="round"/>`); break;
    case "flamingo": hoodEyes(30, 11, 4.4); front.push(`<path d="M52 38q8-4 16 0q0 6-5 9q2 4-3 6q-2-6-8-15z" fill="#fff6f0" stroke="${dark}" stroke-width="1"/><path d="M57 48q3 3 3 5q4-1 3-5z" fill="${INK}"/>`); back.push(`<path d="M60 22q-4-10 3-16" stroke="${dark}" stroke-width="3" fill="none" stroke-linecap="round"/>`); break;
    case "hoopoe": back.push(`<g stroke="${INK}" stroke-width=".8">${[-26, -13, 0, 13, 26].map((a, k) => `<path d="M60 26L${60 + a * .9} ${-4 + Math.abs(a) * .35}l${k % 2 ? 6 : -6} 3z" fill="#f28c38"/>`).join("")}</g>`); hoodEyes(32, 11, 4.2); front.push(`<path d="M56 39q4-3 8 0q-1 3-2 4q6 6 12 9q-9-1-13-5q-4-3-5-8z" fill="#6b4f3a"/>`); break;
    case "fin": back.push(`<path d="M60 24q12-24 30-24q-10 14-12 28z" fill="${dark}"/>`); hoodEyes(32, 12, 4); front.push(`<ellipse cx="60" cy="42" rx="10" ry="5" fill="${inner}"/>`); break;
    case "shell": hoodEyes(30, 11, 4.4); break;
    case "dugong": hoodEyes(28, 13, 3.6); front.push(`<ellipse cx="60" cy="40" rx="13" ry="7" fill="${inner}"/><g fill="${dark}"><circle cx="54" cy="39" r=".9"/><circle cx="57" cy="42" r=".9"/><circle cx="63" cy="42" r=".9"/><circle cx="66" cy="39" r=".9"/></g>`); break;
    case "kandura": front.push(`<path d="M24 50q-2-30 36-32t36 32" fill="none" stroke="#fffdf6" stroke-width="9"/><ellipse cx="60" cy="24" rx="26" ry="5" fill="none" stroke="#2b2b2b" stroke-width="3"/><ellipse cx="60" cy="24" rx="26" ry="5" fill="none" stroke="${GOLD}" stroke-width="1"/>`); hoodEyes(34, 11, 4); front.push(`<path d="M54 40h12q-2 7-6 9q-4-2-6-9z" fill="#f2c14e" stroke="#c99627" stroke-width="1"/>`); break;
    // Дизайбик: design things worn as hoods and hats
    case "pixel": back.push(`<rect x="100" y="20" width="8" height="8" fill="${toyMix(c, .3)}"/><rect x="10" y="40" width="6" height="6" fill="${toyMix(c, .4)}"/><rect x="104" y="40" width="5" height="5" fill="${c}"/>`); break;
    case "cursor": front.push(`<path d="M52 2l22 18-10 2 6 12-5 2-6-12-7 7z" fill="#fff" stroke="${dark}" stroke-width="2" stroke-linejoin="round"/>`); break;
    case "layers": back.push(`<rect x="34" y="6" width="52" height="16" rx="5" fill="${toyMix(c, .45)}" stroke="${dark}" stroke-width="1"/><rect x="30" y="14" width="60" height="16" rx="5" fill="${toyMix(c, .22)}" stroke="${dark}" stroke-width="1"/>`); break;
    case "pipette": back.push(`<rect x="52" y="12" width="16" height="16" rx="3" fill="${dark}"/><ellipse cx="60" cy="8" rx="12" ry="11" fill="#ff6b81" stroke="${toyMix("#ff6b81", -.35)}" stroke-width="1.2"/><ellipse cx="56" cy="4" rx="3.5" ry="2.2" fill="#fff" opacity=".6"/>`); break;
    case "coin": front.push(`<circle cx="60" cy="62" r="35" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="3 3" opacity=".7"/><path d="M60 14l3 6 6.5 1-4.8 4.5 1.2 6.5-5.9-3.2-5.9 3.2 1.2-6.5-4.8-4.5 6.5-1z" fill="#fff6c2" stroke="${dark}" stroke-width=".8"/>`); break;
    case "grid": front.push(`<path d="M40 22v80M60 18v6M80 22v80M22 40h76M18 60h6M96 60h6" stroke="#fff" stroke-width="1.4" opacity=".55"/>`); break;
    case "nib": front.push(`<path d="M60 4v20" stroke="${INK}" stroke-width="2"/><circle cx="60" cy="27" r="3.4" fill="#fff" stroke="${INK}" stroke-width="1.5"/>`); break;
    case "font": front.push(`<text x="60" y="34" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="22" font-weight="700" fill="#fff" opacity=".95">Aa</text>`); break;
    case "frame": back.push(`<path d="M18 30h84M18 96h84M30 18v84M90 18v84" stroke="${dark}" stroke-width="2" opacity=".6"/>`); break;
    case "bubble": back.push(`<path d="M86 92l18 16-4-20z" fill="url(#HOOD)" stroke="${dark}" stroke-width="1.2"/>`); front.push(`<circle cx="94" cy="24" r="8" fill="#ff5c7a" stroke="#fff" stroke-width="2"/><text x="94" y="27.5" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9.5" font-weight="800" fill="#fff">1</text>`); break;
    case "auto": back.push(`<path d="M8 62h12M100 62h12M60 2v10" stroke="${dark}" stroke-width="3" stroke-linecap="round"/><path d="M4 62l6-4v8zM116 62l-6-4v8zM60 -2l-4 6h8z" fill="${dark}"/>`); break;
    case "system": back.push(`<rect x="36" y="14" width="48" height="12" rx="5" fill="#ffd166"/><rect x="40" y="4" width="40" height="12" rx="5" fill="#80ed99"/><path d="M48 4l4-10 8 6 8-6 4 10z" fill="${GOLD}" stroke="${toyMix(GOLD, -.35)}" stroke-width="1"/>`); break;
    // Монстрики: fuzzy monster suits
    case "smallhorns": back.push(`<path d="M38 30q-6-14 2-22q4 10 10 14zM82 30q6-14-2-22q-4 10-10 14z" fill="${f.hornColor || "#fff4e0"}" stroke="${dark}" stroke-width="1"/>`); break;
    case "devil": back.push(`<path d="M34 32q-10-16-2-30q6 12 14 18zM86 32q10-16 2-30q-6 12-14 18z" fill="#3a1d24"/>`); break;
    case "spiky": for (let k = 0; k < 9; k++) { const a = Math.PI * (1.05 + k * 0.1125); back.push(`<path d="M${60 + Math.cos(a) * 30} ${62 + Math.sin(a) * 30}L${60 + Math.cos(a + .06) * 50} ${62 + Math.sin(a + .06) * 50}L${60 + Math.cos(a + .14) * 30} ${62 + Math.sin(a + .14) * 30}z" fill="url(#HOOD)" stroke="${dark}" stroke-width="1"/>`); } break;
    case "antenna": back.push(`<path d="M60 26V6" stroke="${dark}" stroke-width="2.5"/><circle cx="60" cy="5" r="5" fill="#ffd166" stroke="${dark}" stroke-width="1"/>`); break;
    case "flame": back.push(`<path d="M60 -4q-14 16-8 28q-6-2-8-8q-6 16 8 22h16q14-6 8-22q-2 6-8 8q6-14-8-28z" fill="#ff9f1c"/><path d="M60 12q-6 8-2 14h4q4-6-2-14z" fill="#ffd166"/>`); break;
    case "eyes3": front.push([[42, 28, 4], [60, 22, 5], [78, 28, 4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/><circle cx="${x}" cy="${y + .5}" r="${r * .55}" fill="${INK}"/>`).join("")); break;
    case "manyeyes": front.push([[40, 34, 3], [52, 24, 3.4], [68, 24, 3.4], [80, 34, 3]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/><circle cx="${x + 1.2}" cy="${y}" r="${r * .55}" fill="${INK}"/>`).join("")); break;
    case "ask": front.push(`<text x="96" y="20" font-family="system-ui,sans-serif" font-size="18" font-weight="900" fill="${dark}">?</text><text x="14" y="30" font-family="system-ui,sans-serif" font-size="13" font-weight="900" fill="${dark}">?</text>`); break;
    case "ghost": break;
  }
  return { back: back.join(""), front: front.join("") };
}
// the hood itself: round by default, or shaped by the character
function hoodPath(h) {
  switch (h) {
    case "pixel": case "grid": case "frame": case "auto": return `<rect x="20" y="22" width="80" height="78" rx="14" fill="url(#HOOD)"/>`;
    case "diamond": return `<path d="M60 14l44 48-44 44-44-44z" fill="url(#HOOD)" stroke-linejoin="round"/>`;
    case "nib": return `<path d="M60 8l34 38q6 8 2 18q-6 26-36 34q-30-8-36-34q-4-10 2-18z" fill="url(#HOOD)"/>`;
    case "bubble": return `<rect x="18" y="20" width="84" height="80" rx="26" fill="url(#HOOD)"/>`;
    case "ghost": return `<path d="M20 104V60a40 40 0 0 1 80 0v44l-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6z" fill="url(#HOOD)"/>`;
    default: return `<ellipse cx="60" cy="62" rx="41" ry="39" fill="url(#HOOD)"/>`;
  }
}
function drawKid(f, id) {
  const gold = f.rare === 2, c = gold ? GOLD : f.color, dark = toyMix(c, -0.28), inner = f.inner || toyMix(c, 0.55);
  const body = f.body || c, bodyDark = toyMix(body, -0.25);
  const parts = hoodParts(f, c, dark, f.innerEar || "#ffc2cf");
  const fur = f.fluffy ? ` filter="url(#${id}fz)"` : "";
  const pattern = {
    stripes: `<path d="M48 26q2 6 0 10M60 23v10M72 26q-2 6 0 10M22 62h8M90 62h8M34 112q6 2 10 0M76 112q6 2 10 0" stroke="${dark}" stroke-width="3" stroke-linecap="round" fill="none" opacity=".7"/>`,
    calico: `<path d="M24 46q4-20 22-22q-4 10-2 18q-12 6-20 4z" fill="#f4a261"/><path d="M96 46q-4-20-22-22q4 10 2 18q12 6 20 4z" fill="#7a4e2d"/><ellipse cx="74" cy="122" rx="7" ry="5" fill="#f4a261"/><ellipse cx="46" cy="128" rx="5" ry="4" fill="#7a4e2d"/>`,
    patch: `<path d="M24 50q4-22 24-24q-6 12-4 22q-12 6-20 2z" fill="${f.patch || dark}"/>`,
    shell: `<path d="M34 104l10-6 10 6v10l-10 6-10-6zM66 104l10-6 10 6v10l-10 6-10-6zM50 116l10-6 10 6v10l-10 6-10-6z" fill="none" stroke="${dark}" stroke-width="2" opacity=".6"/>`,
    spots: `<circle cx="36" cy="50" r="4" fill="${dark}" opacity=".3"/><circle cx="86" cy="44" r="3" fill="${dark}" opacity=".3"/><circle cx="80" cy="120" r="3.5" fill="${dark}" opacity=".3"/>`,
  }[f.pattern] || "";
  const neck = f.collar ? `<path d="M40 96q20 8 40 0" stroke="${f.collar}" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="60" cy="101" r="3.6" fill="${GOLD}" stroke="${toyMix(GOLD, -.35)}" stroke-width=".8"/><path d="M58.4 102.4h3.2" stroke="${toyMix(GOLD, -.45)}" stroke-width=".8"/>`
    : f.neck === "tie" ? `<path d="M56 96h8l-1 4 4 14-7 6-7-6 4-14z" fill="#355caa"/>`
    : f.neck === "scarf" ? `<path d="M36 94q24 10 48 0v8q-24 10-48 0z" fill="#f4a261"/><path d="M74 100l4 16h-8z" fill="#e76f51"/>`
    : f.neck === "bandana" ? `<path d="M40 94q20 8 40 0l-20 14z" fill="#2a9d8f"/>` : "";
  const hat = { crown: `<path d="M46 24l4-14 6 8 4-12 4 12 6-8 4 14z" fill="${GOLD}" stroke="${toyMix(GOLD, -.35)}" stroke-width="1" stroke-linejoin="round"/><circle cx="60" cy="13" r="2" fill="#ff5c7a"/>`,
    headset: `<path d="M24 64q0-40 36-40t36 40" fill="none" stroke="#3a3550" stroke-width="4"/><rect x="16" y="56" width="10" height="16" rx="5" fill="#3a3550"/><rect x="94" y="56" width="10" height="16" rx="5" fill="#3a3550"/><path d="M21 72q2 12 18 12" fill="none" stroke="#3a3550" stroke-width="2"/><circle cx="40" cy="84" r="2.6" fill="#ff6b81"/>`,
    beret: `<path d="M32 30q28-22 56 0q-2 6-28 6t-28-6z" fill="#e63946"/><circle cx="60" cy="16" r="3" fill="#e63946"/>`,
    nightcap: `<path d="M34 34q10-28 44-28q8 0 6 10q-20-2-28 20z" fill="#7b8cde"/><circle cx="88" cy="12" r="5" fill="#fff"/>`,
    glasses: "" }[f.hat] || "";
  const glasses = f.glasses ? `<g fill="none" stroke="${INK}" stroke-width="1.6"><circle cx="51" cy="71" r="7"/><circle cx="69" cy="71" r="7"/><path d="M58 70h4"/></g>` : "";
  const mask = f.mask ? `<path d="M38 66q22-8 44 0q1 10-8 10q-6 0-9-4h-2q-3 4-9 4q-9 0-8-10z" fill="#2b2240"/><circle cx="51" cy="70" r="2.6" fill="#fff"/><circle cx="69" cy="70" r="2.6" fill="#fff"/>` : "";
  const sweat = f.sweat ? `<path d="M84 60q-4 6 0 9q4-3 0-9zM90 72q-3 4 0 6q3-2 0-6z" fill="#cdefff" stroke="#7cc4f0" stroke-width=".8"/>` : "";
  const shake = f.shake ? `<path d="M8 66q-4 8 0 16M14 58q-6 14 0 30M112 66q4 8 0 16M106 58q6 14 0 30" stroke="${dark}" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".55"/>` : "";
  const cape = f.cape ? `<path d="M30 94q30 12 60 0l14 46H16z" fill="#e63946"/>` : "";
  const tail = f.tail === "long" ? `<path d="M88 128q28 2 26-38" stroke="${dark}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M114 92q-6-10 0-16q6 6 0 16z" fill="${INK}"/>`
    : f.tail ? `<path d="M88 126q22-4 16-30" stroke="${body}" stroke-width="8" fill="none" stroke-linecap="round"/>` : "";
  const hands = f.prop ? `<ellipse cx="48" cy="111" rx="7" ry="6.5" fill="${body}" stroke="${bodyDark}" stroke-width="1"/><ellipse cx="72" cy="111" rx="7" ry="6.5" fill="${body}" stroke="${bodyDark}" stroke-width="1"/>${toyProp(f.prop, 60, 111)}`
    : `<ellipse cx="38" cy="114" rx="6.5" ry="6" fill="${body}" stroke="${bodyDark}" stroke-width="1"/><ellipse cx="82" cy="114" rx="6.5" ry="6" fill="${body}" stroke="${bodyDark}" stroke-width="1"/>`;
  const robe = f.robe ? `<path d="M30 136q-2-30 30-38q32 8 30 38z" fill="#fffdf6" stroke="#ddd6c8" stroke-width="1"/><path d="M60 100v34" stroke="${GOLD}" stroke-width="1.5"/>` : "";
  return `<defs>
      <radialGradient id="${id}hood" cx="38%" cy="28%" r="80%"><stop offset="0" stop-color="${toyMix(c, 0.32)}"/><stop offset=".6" stop-color="${c}"/><stop offset="1" stop-color="${toyMix(c, -0.18)}"/></radialGradient>
      <radialGradient id="${id}body" cx="40%" cy="20%" r="85%"><stop offset="0" stop-color="${toyMix(body, 0.28)}"/><stop offset=".65" stop-color="${body}"/><stop offset="1" stop-color="${toyMix(body, -0.2)}"/></radialGradient>
      <radialGradient id="${id}skin" cx="45%" cy="35%" r="70%"><stop offset="0" stop-color="#fff3ea"/><stop offset="1" stop-color="${f.skin || KID_SKIN}"/></radialGradient>
      ${f.fluffy ? `<filter id="${id}fz" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="3.2"/></filter>` : ""}
    </defs>
    <ellipse cx="60" cy="144" rx="34" ry="5" fill="#000" opacity=".12"/>
    <ellipse cx="60" cy="140" rx="32" ry="6.5" fill="${f.base || "#fbf7ff"}" stroke="${toyMix(f.base || "#e9e2f5", -0.08)}" stroke-width="1"/>
    ${cape}${tail}
    <g${fur}>${parts.back.replaceAll("url(#HOOD)", `url(#${id}hood)`)}
      <path d="M30 136q-4-34 30-40q34 6 30 40z" fill="url(#${id}body)"/>
      <ellipse cx="60" cy="120" rx="16" ry="12" fill="${f.belly || toyMix(body, 0.5)}" opacity=".9"/>
      ${robe}
      <ellipse cx="47" cy="136" rx="9" ry="5" fill="${bodyDark}"/><ellipse cx="73" cy="136" rx="9" ry="5" fill="${bodyDark}"/>
      ${hoodPath(f.hood).replace("url(#HOOD)", `url(#${id}hood)`)}${pattern}</g>
    <ellipse cx="60" cy="69" rx="25" ry="23" fill="url(#${id}skin)"/>
    ${kidHair(f.hair || ["#4a2e2a", "#2b2024", "#8a4b2d", "#c98b4e", "#5b3a2e"][toyHashArt(f.id) % 5], f.hairStyle)}
    ${kidEyes(f.eyes, f.eyeColor)}${mask}${glasses}
    <path d="M58.6 76.8h2.8l-1.4 2z" fill="#f08a9a"/>
    ${kidMouth(f.mouth)}
    <ellipse cx="45" cy="79" rx="4.6" ry="2.8" fill="#ff8fab" opacity=".5"/><ellipse cx="75" cy="79" rx="4.6" ry="2.8" fill="#ff8fab" opacity=".5"/>
    ${parts.front.replaceAll("url(#HOOD)", `url(#${id}hood)`)}${hat}${neck}${sweat}${shake}
    ${hands}${gold ? sparkles() : ""}`;
}

function sparkles() {
  const s = (x, y, r) => `<path d="M${x} ${y - r}l${r * 0.3} ${r * 0.7} ${r * 0.7} ${r * 0.3}-${r * 0.7} ${r * 0.3}-${r * 0.3} ${r * 0.7}-${r * 0.3}-${r * 0.7}-${r * 0.7}-${r * 0.3} ${r * 0.7}-${r * 0.3}z" fill="#fff6c2"/>`;
  return s(14, 30, 7) + s(106, 44, 5) + s(102, 120, 6) + s(18, 112, 4);
}

// rarity: 0 common, 1 rare, 2 secret. line: a short note to cheer the search on
const TOY_SERIES = [
  { key: "dubai", name: "Дубайские зверята", short: "Зверята", color: "#f4a261", accent: "#2a9d8f", draw: drawKid, figures: [
    { id: "camel", name: "Верблюжонок", line: "Медленно — это тоже вперёд. Дойдёшь", hood: "camel", color: "#e0b07a", body: "#e0b07a", prop: "tablet" },
    { id: "falcon", name: "Соколёнок", line: "Смотри шире: твоя вакансия где-то рядом", hood: "bird", color: "#8b6a4f", inner: "#f3e6cf", eyes: "wink" },
    { id: "oryx", name: "Орикс", line: "Держи голову высоко, даже на пятом собесе", hood: "horns", color: "#f3eee6", innerEar: "#e9d9c8", eyes: "happy" },
    { id: "fennec", name: "Фенёк", line: "Слушай фидбек — и делай по-своему", hood: "bigears", color: "#efc591", tail: true, mouth: "smile" },
    { id: "flamingo", name: "Фламингошка", line: "Можно ждать ответа и при этом оставаться красивой", hood: "flamingo", color: "#f7a6c8", eyes: "happy" },
    { id: "turtle", name: "Черепашка", line: "Твой темп — правильный темп", hood: "shell", color: "#8fd19e", body: "#4f9e69", pattern: "shell", mouth: "open" },
    { id: "gazelle", name: "Газель", line: "Один прыжок — и ты на следующем этапе", hood: "curvehorns", color: "#d9a877", prop: "note" },
    { id: "hoopoe", name: "Удодик", line: "Покажи хохолок: ты лучше, чем думаешь", hood: "hoopoe", color: "#eaa36c", eyes: "wink" },
    { id: "dolphin", name: "Дельфинчик", line: "Ныряй в задачу, выныривай с решением", hood: "fin", color: "#7fb6e6", mouth: "open" },
    { id: "jerboa", name: "Тушканчик", line: "Чемодан собран, мечта ждёт", hood: "roundears", color: "#e8c796", tail: "long", prop: "suitcase" },
    { id: "dugong", name: "Дюгонь", line: "Спокойствие — твоя суперсила", hood: "dugong", color: "#a9bfcb", eyes: "sleepy", rare: 1 },
    { id: "sandcat", name: "Барханный кот", line: "Тебя видно, даже когда кажется, что нет", hood: "wideears", color: "#dcc59e", tail: true, eyes: "happy", rare: 1 },
    { id: "goldfalcon", name: "Золотой сокол", line: "Секретный. Прилетает, когда ты уже почти в Дубае", hood: "kandura", robe: true, body: "#fffdf6", rare: 2, eyes: "star", mouth: "smile" },
  ] },
  { key: "spirits", name: "Дизайбик", short: "Дизайбик", color: "#7b8cde", accent: "#ffd166", draw: drawKid, figures: [
    { id: "pixel", name: "Пиксель", line: "Маленький шаг тоже меняет картинку", hood: "pixel", color: "#ff7b93", mouth: "smile" },
    { id: "cursor", name: "Курсор", line: "Ты знаешь, куда нажать. Жми", hood: "round", color: "#5ec8f2", eyes: "wink" },
    { id: "layers", name: "Слоик", line: "В тебе столько слоёв опыта — покажи их", hood: "layers", color: "#8f9cf0" },
    { id: "pipette", name: "Пипетка", line: "Бери лучшее из каждого отказа", hood: "pipette", color: "#cfe8ff", inner: "#eef7ff", mouth: "open" },
    { id: "component", name: "Компонент", line: "Однажды сделала хорошо — используй везде", hood: "diamond", color: "#b893f0", eyes: "happy" },
    { id: "token", name: "Токен", line: "Ты ценная. Это просто факт", hood: "coin", color: "#ffd166", mouth: "smile" },
    { id: "grid", name: "Сеточка", line: "Всё встанет на свои места", hood: "grid", color: "#86e8a2" },
    { id: "nib", name: "Пёрышко", line: "Кривая безье тоже сначала не слушается", hood: "nib", color: "#6d7ea3", eyes: "cross", mouth: "flat" },
    { id: "font", name: "Шрифтик", line: "Говори о себе крупным кеглем", hood: "font", color: "#f4845f", eyes: "wink" },
    { id: "frame", name: "Фреймик", line: "Дай идее место — и она вырастет", hood: "frame", color: "#64dfdf" },
    { id: "comment", name: "Комментарий", line: "Фидбек — это подарок, даже в странной упаковке", hood: "bubble", color: "#ffb3c6", mouth: "open", rare: 1 },
    { id: "autolayout", name: "Автолейаут", line: "Подстроишься под любые требования и не сломаешься", hood: "auto", color: "#9381ff", eyes: "happy", rare: 1 },
    { id: "designsystem", name: "Дизайн-система", line: "Секретный. Всё твоё уже собрано в систему", hood: "system", color: "#7b8cde", rare: 2, eyes: "star", mouth: "smile" },
  ] },
  { key: "cats", name: "Котики «Мяу-оффер»", short: "Котики", color: "#ffafcc", accent: "#cdb4db", draw: drawKid, figures: [
    { id: "letter", name: "Котик Отклик", line: "Отправила — значит, уже ближе", hood: "cat", color: "#fbfaf7", inner: "#ffffff", collar: "#9fb7d9", prop: "letter", fluffy: true, eyeColor: "#2c7a86" },
    { id: "screen", name: "Котик Скрининг", line: "Ты справишься с любым звонком", hood: "cat", color: "#b9c0c9", pattern: "stripes", hat: "headset", fluffy: true },
    { id: "folio", name: "Котик Портфолио", line: "Твои кейсы говорят за тебя", hood: "cat", color: "#fffaf3", pattern: "calico", prop: "folder", collar: "#2a9d8f", fluffy: true },
    { id: "coffee", name: "Котик Кофе-брейк", line: "Перерыв — тоже часть плана", hood: "cat", color: "#c9a27c", prop: "mug", eyes: "happy", fluffy: true },
    { id: "deadline", name: "Котик Дедлайн", line: "Успеешь. Ты всегда успеваешь", hood: "cat", color: "#a3acb8", prop: "laptop", glasses: true, fluffy: true },
    { id: "network", name: "Котик Нетворкинг", line: "Одно сообщение может всё изменить", hood: "cat", color: "#2f2c38", innerEar: "#5a5566", collar: GOLD, prop: "phone", fluffy: true, eyeColor: "#2c7a86" },
    { id: "test", name: "Котик Тестовое", line: "Сделала тестовое — ты уже молодец", hood: "cat", color: "#fbe7c6", prop: "pencil", hat: "beret", fluffy: true },
    { id: "wait", name: "Котик Терпение", line: "Ответ придёт. А пока можно подремать", hood: "cat", color: "#ececec", pattern: "patch", patch: "#8d8d8d", prop: "hourglass", eyes: "sleepy", fluffy: true },
    { id: "relocate", name: "Котик Релокейт", line: "Новый город — новые возможности", hood: "cat", color: "#f2a65a", pattern: "stripes", prop: "suitcase", neck: "bandana", fluffy: true },
    { id: "pixelcat", name: "Котик Пиксель-перфект", line: "Видишь детали, которые другие пропускают", hood: "cat", color: "#ffc6dd", prop: "tablet", collar: "#ff8fab", fluffy: true },
    { id: "weekend", name: "Котик Выходной", line: "Отдых — это стратегия, а не слабость", hood: "cat", color: "#d6c2ef", hat: "nightcap", neck: "scarf", eyes: "sleepy", fluffy: true, rare: 1 },
    { id: "lead", name: "Котик Лид", line: "Ты уже ведёшь — просто ещё не по должности", hood: "cat", color: "#f28482", neck: "tie", prop: "cv", eyes: "wink", fluffy: true, rare: 1 },
    { id: "offer", name: "Котик Оффер", line: "Секретный. Пришёл сказать: всё получилось", hood: "cat", hat: "crown", prop: "trophy", rare: 2, eyes: "star", mouth: "open", fluffy: true },
  ] },
  { key: "monsters", name: "Монстрики страхов", short: "Монстрики", color: "#9381ff", accent: "#ff8fa3", draw: drawKid, figures: [
    { id: "impostor", name: "Самозванец", line: "Сними маску: ты правда этого достойна", hood: "smallhorns", color: "#a78bfa", mask: true, mouth: "wobble", fluffy: true },
    { id: "reject", name: "Страх отказа", line: "Поплачь и иди дальше. Отказ — не про тебя", hood: "ghost", color: "#a5b4cb", eyes: "cry", mouth: "pout" },
    { id: "procrast", name: "Прокрастин", line: "Начни с пяти минут. Потом станет легче", hood: "round", color: "#c4b5fd", eyes: "sleepy", prop: "phone", mouth: "flat", fluffy: true },
    { id: "perfect", name: "Перфекционист", line: "Готово лучше, чем идеально", hood: "antenna", color: "#7dd3c0", eyes: "cross", prop: "ruler", mouth: "flat" },
    { id: "compare", name: "Сравнялка", line: "Твой путь не обязан быть похожим на чужой", hood: "manyeyes", color: "#fde68a", eyes: "side", mouth: "o", fluffy: true },
    { id: "anxiety", name: "Тревожка", line: "Выдохни. Ты в безопасности, всё идёт по плану", hood: "spiky", color: "#f9a8d4", eyes: "worried", mouth: "wobble", shake: true },
    { id: "critic", name: "Внутренний критик", line: "Пусть ворчит. Ты всё равно молодец", hood: "devil", color: "#f87171", eyes: "cross", prop: "pencil", mouth: "smile" },
    { id: "interview", name: "Страх собеса", line: "Волнуешься — значит, тебе не всё равно", hood: "ghost", color: "#93c5fd", eyes: "worried", sweat: true, mouth: "open" },
    { id: "english", name: "Страх английского", line: "Говори с акцентом — главное, говори", hood: "ask", color: "#5eead4", mouth: "o", fluffy: true },
    { id: "testtask", name: "Страх тестового", line: "Дедлайн не съест тебя. Ты сильнее", hood: "antenna", color: "#fdba74", prop: "clock", eyes: "worried", mouth: "open" },
    { id: "burnout", name: "Выгорашка", line: "Береги огонёк: отдых — часть работы", hood: "flame", color: "#8a8f98", eyes: "sleepy", mouth: "flat", fluffy: true, rare: 1 },
    { id: "unknown", name: "Неизвестность", line: "Не знаешь, что впереди? Значит, там может быть лучшее", hood: "eyes3", color: "#4c4f7a", mouth: "o", fluffy: true, rare: 1 },
    { id: "courage", name: "Смелость", line: "Секретная. Вырастает из всех страхов сразу", hood: "smallhorns", hornColor: "#fff4e0", cape: true, rare: 2, eyes: "star", mouth: "grin", fluffy: true },
  ] },
];
const toySeries = key => TOY_SERIES.find(s => s.key === key);
const toyFigure = (series, id) => toySeries(series)?.figures.find(f => f.id === id);
function toySvg(seriesKey, figId, cls = "") {
  const s = toySeries(seriesKey), f = s && s.figures.find(x => x.id === figId); if (!f) return "";
  return `<svg class="toy ${cls}" viewBox="0 0 120 150" role="img" aria-label="${f.name}">${s.draw(f, "t" + seriesKey + figId)}</svg>`;
}
// the sealed box of a series: a cube with the series colour, a ribbon and a question mark; the lid is its own group
function boxSvg(seriesKey, cls = "") {
  // a box does not tell its series: the same mystery colours for all, the series falls out with the figure
  const s = toySeries(seriesKey) || { key: "mystery", color: "#8b5cf6", accent: "#c6f432" }, c = s.color, a = s.accent, id = "bx" + s.key;
  return `<svg class="tbox ${cls}" viewBox="0 0 120 130" aria-hidden="true"><defs>${vinyl(id, c)}<pattern id="${id}p" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="7" cy="7" r="2" fill="#fff" opacity=".28"/></pattern></defs>
    <ellipse cx="60" cy="124" rx="40" ry="5" fill="#000" opacity=".13"/>
    <g class="tbox-body"><path d="M18 50h84v62a8 8 0 0 1-8 8H26a8 8 0 0 1-8-8z" fill="url(#${id})"/><path d="M18 50h84v62a8 8 0 0 1-8 8H26a8 8 0 0 1-8-8z" fill="url(#${id}p)"/>
      <rect x="54" y="50" width="12" height="70" fill="${a}"/>
      <text x="60" y="98" text-anchor="middle" font-family="system-ui,sans-serif" font-size="30" font-weight="800" fill="#fff" stroke="${toyMix(c, -0.35)}" stroke-width="1.5" paint-order="stroke">?</text></g>
    <g class="tbox-lid"><rect x="12" y="36" width="96" height="18" rx="5" fill="${toyMix(c, -0.08)}"/><rect x="54" y="36" width="12" height="18" fill="${toyMix(a, -0.1)}"/>
      <path d="M60 36q-18-22-26-8q4 8 26 8zM60 36q18-22 26-8q-4 8-26 8z" fill="${a}" stroke="${toyMix(a, -0.3)}" stroke-width="1.5"/><circle cx="60" cy="35" r="4" fill="${toyMix(a, -0.2)}"/></g></svg>`;
}

// ---------- the box: a pastel blind box cube in CSS 3D, with a hinged lid ----------
// Six faces in real 3D; each face catches light by its own angle, so the foil sheen shimmers while it turns.
// The tint tells the series (a box knows it from its key); the figure inside stays a surprise.
const TOY_TINT = { dubai: ["#ffd9b8", "#ffb3c7"], spirits: ["#cfd2ff", "#b9a4ff"], cats: ["#ffd3ea", "#e7b8ff"], monsters: ["#c9f3e4", "#b7c6ff"] };
const BOX_INK = { dubai: "#7a3fb8", spirits: "#4b3cc4", cats: "#8a3fb0", monsters: "#3f5fc0" };
const CLOUD = (x, y, k = 1, o = 0.9) => `<path transform="translate(${x} ${y}) scale(${k})" d="M6 18a8 8 0 0 1 2-15.6A10 10 0 0 1 27 2a7.5 7.5 0 0 1 9 8 6 6 0 0 1-2 11.8H8A6 6 0 0 1 6 18z" fill="#fff" opacity="${o}" stroke="#bcd0ff" stroke-width="1.2"/>`;
const QMARK = (x, y, k = 1, c = "#ffd166", r = 0) => `<text x="${x}" y="${y}" font-family="'Arial Rounded MT Bold',system-ui,sans-serif" font-size="${18 * k}" font-weight="900" fill="${c}" stroke="#f4a261" stroke-width="${0.8 * k}" paint-order="stroke" transform="rotate(${r} ${x} ${y})">?</text>`;
const SPARK = (x, y, k = 1) => `<path transform="translate(${x} ${y}) scale(${k})" d="M0-6l1.4 4.6L6 0l-4.6 1.4L0 6l-1.4-4.6L-6 0l4.6-1.4z" fill="#fff7d1"/>`;
function boxFaceArt(name, seriesKey, ink) {
  const clean = t => (t || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const sname = clean(toySeries(seriesKey)?.name), sshort = clean(toySeries(seriesKey)?.short); // the short name fits the front band
  if (name === "front") return `<svg viewBox="0 0 100 115" preserveAspectRatio="none">${CLOUD(6, 30, .5)}${CLOUD(60, 84, .62, .8)}${QMARK(78, 44, .8, "#ffd166", 12)}${QMARK(8, 104, .7, "#ffd166", -10)}${SPARK(20, 50, .6)}${SPARK(88, 70, .5)}
      <text x="50" y="62" text-anchor="middle" font-family="'Arial Rounded MT Bold',system-ui,sans-serif" font-size="17" font-weight="900" fill="${ink}" letter-spacing=".5">BLIND</text>
      <text x="50" y="80" text-anchor="middle" font-family="'Arial Rounded MT Bold',system-ui,sans-serif" font-size="17" font-weight="900" fill="${ink}" letter-spacing=".5">BOX</text>
      <text x="50" y="94" text-anchor="middle" font-family="system-ui,sans-serif" font-size="7.4" font-weight="800" fill="#f2b84b" letter-spacing="1.4">MYSTERY</text></svg>
      <b class="bf-band" style="color:${ink}">${sshort}</b><i class="bf-sticker" style="color:${ink}">?</i>`;
  if (name === "back") return `<svg viewBox="0 0 100 115" preserveAspectRatio="none">${CLOUD(54, 10, .6)}${QMARK(14, 30, .8, "#ffd166", -8)}${SPARK(80, 48, .55)}
      <text x="50" y="62" text-anchor="middle" font-family="system-ui,sans-serif" font-size="8.5" font-weight="800" fill="${ink}">сюрприз внутри</text>
      <text x="50" y="74" text-anchor="middle" font-family="system-ui,sans-serif" font-size="5.6" fill="${ink}" opacity=".75">1 фигурка · 13 в серии · 1 секретная</text>
      <g fill="${ink}" opacity=".6">${[0, 2, 3.5, 6, 7.5, 9.5, 12, 13.5, 15.5, 18, 19.5, 21].map((x, i) => `<rect x="${39 + x}" y="84" width="${i % 3 ? .9 : 1.6}" height="12"/>`).join("")}</g></svg>`;
  if (name === "left" || name === "right") return `<svg viewBox="0 0 100 115" preserveAspectRatio="none">${CLOUD(name === "left" ? 14 : 50, 16, .62)}${QMARK(name === "left" ? 66 : 18, 64, 1.2, "#ffd166", name === "left" ? 10 : -12)}${SPARK(30, 92, .7)}${SPARK(80, 34, .5)}${CLOUD(name === "left" ? 52 : 10, 86, .5, .75)}
      <text x="50" y="108" text-anchor="middle" font-family="'Arial Rounded MT Bold',system-ui,sans-serif" font-size="9" font-weight="900" fill="${ink}" opacity=".8">BLIND BOX</text></svg><i class="bf-stripe"></i>
      <b class="bf-side-name" style="color:${ink}">${sname}</b>`;
  if (name === "top") return `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${CLOUD(14, 50, .8)}${SPARK(18, 18, .6)}${SPARK(82, 76, .6)}</svg><i class="bf-star"></i>`;
  return "";
}
// a face: tinted card stock, the art, a soft foil sheen and the light that follows its angle
function boxFace(name, W, H, transform, n, art, origin = "50% 50%") {
  return `<div class="bf bf-${name}" style="width:${W}px;height:${H}px;margin:${-H / 2}px 0 0 ${-W / 2}px;transform:${transform};transform-origin:${origin}" data-n="${n}"><i class="bf-holo"></i>${art}<i class="bf-light"></i></div>`;
}
function boxHtml(series, { S = 140, cls = "" } = {}) {
  const [c1, c2] = TOY_TINT[series] || TOY_TINT.cats, ink = BOX_INK[series] || "#4b3cc4";
  const W = S, D = S, H = Math.round(S * 1.12);
  const f = (name, w, h, tr, n) => boxFace(name, w, h, tr, n, boxFaceArt(name, series, ink));
  return `<div class="box3d ${cls}" style="--c1:${c1};--c2:${c2};--w:${W}px;--h:${H}px;--d:${D}px">
    ${f("front", W, H, `translateZ(${D / 2}px)`, "0 0 1")}
    ${f("back", W, H, `rotateY(180deg) translateZ(${D / 2}px)`, "0 0 -1")}
    ${f("right", D, H, `rotateY(90deg) translateZ(${W / 2}px)`, "1 0 0")}
    ${f("left", D, H, `rotateY(-90deg) translateZ(${W / 2}px)`, "-1 0 0")}
    ${f("bottom", W, D, `rotateX(-90deg) translateZ(${H / 2}px)`, "0 1 0")}
    <div class="bx-inside" style="width:${W - 2}px;height:${D - 2}px;margin:${-(D - 2) / 2}px 0 0 ${-(W - 2) / 2}px;transform:rotateX(90deg) translateZ(${H / 2 - 2}px)"></div>
    <div class="bx-lid" ${cls.includes("live") ? 'id="boxLid"' : ""} style="transform:translate3d(0,${-H / 2}px,${-D / 2}px) rotateX(calc(var(--open, 0) * 118deg))">
      <div class="bf bf-top" style="width:${W}px;height:${D}px;margin-left:${-W / 2}px;transform-origin:50% 0;transform:rotateX(90deg)" data-n="0 -1 0"><i class="bf-holo"></i>${boxFaceArt("top", series, ink)}<i class="bf-light"></i>
        <div class="bf-flap" style="width:${W}px"></div></div>
    </div>
    <div class="bx-glow" style="transform:translate3d(0,${-H / 2}px,0) rotateX(90deg)"></div>
  </div>`;
}
// light and foil follow the angle: each face gets its own brightness, sheen offset and glare spot
function boxShade(el, rx, ry) {
  const a = ry * Math.PI / 180, b = rx * Math.PI / 180;
  for (const f of el.querySelectorAll(".bf")) {
    const [x, y, z] = f.dataset.n.split(" ").map(Number);
    const x1 = x * Math.cos(a) + z * Math.sin(a), z1 = -x * Math.sin(a) + z * Math.cos(a);
    const y2 = y * Math.cos(b) - z1 * Math.sin(b), z2 = y * Math.sin(b) + z1 * Math.cos(b);
    const light = Math.max(0, 0.35 * -y2 + 0.3 * -x1 + 0.6 * z2); // light from the upper left front
    f.style.setProperty("--l", (0.6 + light * 0.45).toFixed(3));
    f.style.setProperty("--hx", (50 + x1 * 60 + ry * 0.4).toFixed(1) + "%");
    f.style.setProperty("--hy", (50 + y2 * 60 + rx * 0.5).toFixed(1) + "%");
    f.style.setProperty("--gx", (50 - x1 * 80).toFixed(1) + "%");
    f.style.setProperty("--gy", (35 + y2 * 80).toFixed(1) + "%");
    f.style.setProperty("--ha", (ry * 1.6 + rx * 2 + x1 * 90).toFixed(0) + "deg"); // the foil stickers turn their rainbow
  }
}
