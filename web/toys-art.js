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

// ---------- Котики «Мяу-оффер» ----------
function drawCat(f, id) {
  const gold = f.secret, c = gold ? GOLD : f.color, belly = f.belly || toyMix(c, 0.55), dark = toyMix(c, -0.3), ear = "#ffb3c1";
  const fill = `url(#${id}b)`;
  const pattern = {
    stripes: `<path d="M50 38q2 6 0 10M60 36v11M70 38q-2 6 0 10" stroke="${dark}" stroke-width="3.2" stroke-linecap="round" fill="none"/><path d="M27 70h8M85 70h8" stroke="${dark}" stroke-width="3" stroke-linecap="round"/>`,
    patch: `<path d="M22 56q4-22 22-24q-4 12-2 26q-12 4-20-2z" fill="${f.patch || dark}"/>`,
    tuxedo: `<path d="M38 84q22 16 44 0q-4 16-22 16t-22-16z" fill="#fff"/>`,
    socks: "",
  }[f.pattern] || "";
  const top = { crown: `<path d="M44 30l4-14 6 9 6-12 6 12 6-9 4 14z" fill="${GOLD}" stroke="${toyMix(GOLD, -0.35)}" stroke-width="1.5" stroke-linejoin="round"/><circle cx="60" cy="20" r="2.2" fill="#ff5c7a"/>`,
    headset: `<path d="M24 66q0-42 36-42t36 42" fill="none" stroke="#3a3550" stroke-width="4"/><rect x="16" y="58" width="11" height="18" rx="5" fill="#3a3550"/><rect x="93" y="58" width="11" height="18" rx="5" fill="#3a3550"/><path d="M22 76q4 12 18 12" fill="none" stroke="#3a3550" stroke-width="2.2"/><circle cx="41" cy="88" r="3" fill="#ff6b81"/>`,
    beret: `<path d="M34 34q26-20 52 0q-2 6-26 6t-26-6z" fill="#e63946"/><circle cx="60" cy="22" r="3" fill="#e63946"/>`,
    bow: `<path d="M74 30l10-8v16zM74 30l-10-8v16z" fill="#ff5c8a"/><circle cx="74" cy="30" r="3.4" fill="#ff8fab"/>`,
    sleepcap: `<path d="M38 36q10-26 40-26q8 0 6 10q-18-2-26 18z" fill="#7b8cde"/><circle cx="88" cy="16" r="5" fill="#fff"/>`,
  }[f.top] || "";
  const neck = { tie: `<path d="M56 96h8l-1 4 4 16-7 6-7-6 4-16z" fill="#355caa" stroke="${TOY_INK}" stroke-width="1"/>`,
    scarf: `<path d="M34 94q26 10 52 0v8q-26 10-52 0z" fill="#f4a261"/><path d="M74 100l4 18h-8z" fill="#e76f51"/>`,
    bandana: `<path d="M38 94q22 8 44 0l-22 16z" fill="#2a9d8f"/>` }[f.neck] || "";
  const glasses = f.glasses ? `<g fill="none" stroke="${TOY_INK}" stroke-width="2"><circle cx="45" cy="68" r="9"/><circle cx="75" cy="68" r="9"/><path d="M54 67h12"/></g>` : "";
  return `<defs>${vinyl(id + "b", gold ? GOLD : c)}</defs>${toyShadow()}
    <path d="M86 120q24-6 16-36" stroke="${gold ? toyMix(GOLD, -0.15) : dark}" stroke-width="9" fill="none" stroke-linecap="round"/>
    <ellipse cx="60" cy="114" rx="30" ry="25" fill="${fill}"/>
    <ellipse cx="60" cy="118" rx="17" ry="15" fill="${gold ? toyMix(GOLD, 0.45) : belly}"/>
    ${toyFeet(gold ? GOLD : c)}
    <path d="M22 54L27 18L52 38Z" fill="${fill}" stroke="${gold ? GOLD : c}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M98 54L93 18L68 38Z" fill="${fill}" stroke="${gold ? GOLD : c}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M29 44l2-16 12 11z" fill="${ear}"/><path d="M91 44l-2-16-12 11z" fill="${ear}"/>
    <ellipse cx="60" cy="68" rx="42" ry="35" fill="${fill}"/>
    ${pattern}${gloss(40, 48)}
    ${f.pattern === "tuxedo" ? "" : `<ellipse cx="60" cy="84" rx="15" ry="9" fill="${gold ? toyMix(GOLD, 0.5) : belly}" opacity=".9"/>`}
    ${toyEyes(60, 68, 15, f.eyes)}${glasses}
    <path d="M57 77h6l-3 3.5z" fill="#ff7b93"/>${toyMouth(60, 81, f.mouth || "cat")}
    ${toyBlush(60, 80, 25)}
    <path d="M18 76l12 1M18 83l12-2M102 76l-12 1M102 83l-12-2" stroke="${TOY_INK}" stroke-width="1.2" stroke-linecap="round" opacity=".55"/>
    ${top}${neck}
    ${f.prop ? toyHands(gold ? GOLD : c, 108) + toyProp(f.prop, 60, 108) : toyHands(gold ? GOLD : c, 108, 12)}
    ${gold ? sparkles() : ""}`;
}

// ---------- Дубайские зверята ----------
function drawAnimal(f, id) {
  const c = f.secret ? GOLD : f.color, dark = toyMix(c, -0.3), light = f.belly || toyMix(c, 0.55), fill = `url(#${id}b)`;
  const k = f.kind;
  let back = "", ears = "", head = `<circle cx="60" cy="66" r="37" fill="${fill}"/>`, face = "", extra = "", feet = toyFeet(c), body = `<ellipse cx="60" cy="114" rx="28" ry="24" fill="${fill}"/><ellipse cx="60" cy="119" rx="16" ry="14" fill="${light}"/>`;
  const eyeY = 64;
  let eyes = toyEyes(60, eyeY, 14, f.eyes), mouth = toyMouth(60, 82, f.mouth), blush = toyBlush(60, 78, 24);
  if (k === "camel") {
    back = `<ellipse cx="80" cy="100" rx="18" ry="16" fill="${dark}"/>`;
    ears = `<ellipse cx="30" cy="40" rx="7" ry="10" fill="${fill}" transform="rotate(-30 30 40)"/><ellipse cx="90" cy="40" rx="7" ry="10" fill="${fill}" transform="rotate(30 90 40)"/>`;
    face = `<ellipse cx="60" cy="84" rx="20" ry="13" fill="${light}"/><ellipse cx="54" cy="81" rx="2" ry="1.3" fill="${TOY_INK}"/><ellipse cx="66" cy="81" rx="2" ry="1.3" fill="${TOY_INK}"/><path d="M48 36q12-10 24 0q-4 4-12 4t-12-4z" fill="${dark}"/>`;
    mouth = toyMouth(60, 88, f.mouth); blush = toyBlush(60, 76, 27);
  } else if (k === "falcon" || k === "kandura") {
    back = `<ellipse cx="32" cy="110" rx="10" ry="20" fill="${dark}" transform="rotate(20 32 110)"/><ellipse cx="88" cy="110" rx="10" ry="20" fill="${dark}" transform="rotate(-20 88 110)"/>`;
    face = `<path d="M30 54q30-34 60 0q-30-8-60 0z" fill="${dark}"/><path d="M53 76h14q-2 10-7 13q-5-3-7-13z" fill="#f2c14e" stroke="${toyMix("#f2c14e", -0.4)}" stroke-width="1.2" stroke-linejoin="round"/>`;
    mouth = ""; blush = toyBlush(60, 76, 25);
    if (k === "falcon") body += `<path d="M54 112l3 3 3-3M62 120l3 3 3-3M50 122l3 3 3-3" stroke="${dark}" stroke-width="1.5" fill="none"/>`;
    if (k === "kandura") {
      body = `<path d="M34 96q26-8 52 0l6 42H28z" fill="#fbfaf6" stroke="#d9d4c7" stroke-width="1.5"/><path d="M60 96v18" stroke="#d9d4c7" stroke-width="1.5"/><circle cx="60" cy="102" r="2.4" fill="${GOLD}"/>`;
      feet = ""; back = `<ellipse cx="30" cy="104" rx="9" ry="18" fill="${toyMix(GOLD, -0.2)}" transform="rotate(25 30 104)"/><ellipse cx="90" cy="104" rx="9" ry="18" fill="${toyMix(GOLD, -0.2)}" transform="rotate(-25 90 104)"/>`;
    }
  } else if (k === "oryx") {
    ears = `<path d="M44 38L36 2" stroke="#3b3530" stroke-width="5" stroke-linecap="round"/><path d="M76 38L84 2" stroke="#3b3530" stroke-width="5" stroke-linecap="round"/><path d="M40 22l5-1M38 14l5-1M80 22l-5-1M82 14l-5-1" stroke="#6b625a" stroke-width="1.5"/><ellipse cx="24" cy="54" rx="11" ry="5" fill="${fill}" transform="rotate(-20 24 54)"/><ellipse cx="96" cy="54" rx="11" ry="5" fill="${fill}" transform="rotate(20 96 54)"/>`;
    face = `<path d="M38 58q6-4 12 0q2 10-2 18q-6 0-10-18zM82 58q-6-4-12 0q-2 10 2 18q6 0 10-18z" fill="#5a4e45" opacity=".55"/><path d="M54 40q6-5 12 0l-2 12h-8z" fill="#5a4e45" opacity=".45"/><ellipse cx="60" cy="84" rx="13" ry="9" fill="#f9f6f0"/><ellipse cx="60" cy="81" rx="3.4" ry="2.4" fill="${TOY_INK}"/>`;
    eyes = toyEyes(60, 64, 15, f.eyes); mouth = toyMouth(60, 87, f.mouth); blush = toyBlush(60, 77, 27);
  } else if (k === "fennec" || k === "sandcat") {
    const big = k === "fennec";
    ears = big ? `<path d="M30 52L14 0L56 34Z" fill="${fill}" stroke="${c}" stroke-width="6" stroke-linejoin="round"/><path d="M90 52L106 0L64 34Z" fill="${fill}" stroke="${c}" stroke-width="6" stroke-linejoin="round"/><path d="M32 42l-10-32 24 22z" fill="#ffc9b9"/><path d="M88 42l10-32-24 22z" fill="#ffc9b9"/>`
      : `<path d="M22 58L18 26L48 40Z" fill="${fill}" stroke="${c}" stroke-width="6" stroke-linejoin="round"/><path d="M98 58L102 26L72 40Z" fill="${fill}" stroke="${c}" stroke-width="6" stroke-linejoin="round"/><path d="M24 50l-2-16 14 8z" fill="#2f2a26" opacity=".6"/><path d="M96 50l2-16-14 8z" fill="#2f2a26" opacity=".6"/>`;
    face = `<ellipse cx="60" cy="82" rx="18" ry="11" fill="${light}"/><ellipse cx="60" cy="77" rx="3.5" ry="2.6" fill="${TOY_INK}"/>` + (big ? "" : `<path d="M30 92q6 4 0 8M90 92q-6 4 0 8M50 38v6M60 36v7M70 38v6" stroke="${dark}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`);
    mouth = toyMouth(60, 84, f.mouth || "cat");
    extra = `<path d="M86 124q26 0 22-26" stroke="${c}" stroke-width="12" fill="none" stroke-linecap="round"/><path d="M106 102q2-6 0-10" stroke="${big ? "#fff" : "#2f2a26"}" stroke-width="10" stroke-linecap="round"/>`;
  } else if (k === "flamingo") {
    head = `<circle cx="60" cy="62" r="33" fill="${fill}"/>`;
    back = `<ellipse cx="88" cy="108" rx="12" ry="18" fill="${dark}" transform="rotate(-30 88 108)"/>`;
    face = `<path d="M50 72q8-4 16 0q2 8-4 14q-4 4-8 2q-6-6-4-16z" fill="#fff6f0" stroke="${toyMix(c, -0.25)}" stroke-width="1.2"/><path d="M54 84q4 6 8 2q-1 6-4 6t-4-8z" fill="${TOY_INK}"/>`;
    mouth = ""; eyes = toyEyes(58, 60, 12, f.eyes); blush = toyBlush(58, 72, 22);
    feet = `<path d="M60 136v-6" stroke="#e07a95" stroke-width="3"/><path d="M52 138h14" stroke="#e07a95" stroke-width="4" stroke-linecap="round"/><path d="M60 128q8-6 4-14" stroke="#e07a95" stroke-width="3" fill="none"/>`;
    extra = `<path d="M60 16q-4-8 2-12" stroke="${dark}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  } else if (k === "turtle") {
    back = `<path d="M24 118q0-34 36-34t36 34z" fill="#3f8f5e"/><path d="M60 88l-12 10 4 14h16l4-14zM36 104l12-6M84 104l-12-6M38 118l14-6M82 118l-14-6" stroke="#2c6b45" stroke-width="2.2" fill="none" stroke-linejoin="round"/>`;
    body = `<ellipse cx="60" cy="122" rx="34" ry="14" fill="${fill}"/>`;
    head = `<ellipse cx="60" cy="64" rx="31" ry="29" fill="${fill}"/>`; feet = toyFeet(c, 136, 26);
    face = ""; eyes = toyEyes(60, 62, 12, f.eyes); mouth = toyMouth(60, 76, f.mouth); blush = toyBlush(60, 72, 20);
  } else if (k === "dugong") {
    head = `<ellipse cx="60" cy="70" rx="38" ry="34" fill="${fill}"/>`;
    back = `<ellipse cx="28" cy="112" rx="14" ry="7" fill="${dark}" transform="rotate(30 28 112)"/><ellipse cx="92" cy="112" rx="14" ry="7" fill="${dark}" transform="rotate(-30 92 112)"/>`;
    face = `<ellipse cx="60" cy="86" rx="20" ry="13" fill="${light}"/><g fill="${dark}"><circle cx="52" cy="84" r="1.2"/><circle cx="56" cy="88" r="1.2"/><circle cx="64" cy="88" r="1.2"/><circle cx="68" cy="84" r="1.2"/></g>`;
    eyes = toyEyes(60, 64, 16, f.eyes, 4.6); mouth = toyMouth(60, 92, f.mouth); feet = `<path d="M44 136q16-10 32 0q-16 6-32 0z" fill="${dark}"/>`;
  } else if (k === "gazelle") {
    ears = `<path d="M46 36q-10-14-2-32" stroke="#4a3b2c" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M74 36q10-14 2-32" stroke="#4a3b2c" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M42 26h6M41 18h6M78 26h-6M79 18h-6" stroke="#8a7560" stroke-width="1.5"/><ellipse cx="26" cy="52" rx="12" ry="6" fill="${fill}" transform="rotate(-25 26 52)"/><ellipse cx="94" cy="52" rx="12" ry="6" fill="${fill}" transform="rotate(25 94 52)"/>`;
    face = `<ellipse cx="60" cy="84" rx="16" ry="11" fill="${light}"/><ellipse cx="60" cy="79" rx="3.2" ry="2.4" fill="${TOY_INK}"/><path d="M38 110q22 6 44 0" stroke="#4a3b2c" stroke-width="4" fill="none" stroke-linecap="round" opacity=".7"/>`;
    mouth = toyMouth(60, 86, f.mouth);
  } else if (k === "hoopoe") {
    ears = `<g stroke="${TOY_INK}" stroke-width="1"><path d="M60 34L42 4l10 2z" fill="#f28c38"/><path d="M60 34L52 0l8 4z" fill="#f28c38"/><path d="M60 34L64 -2l6 6z" fill="#f28c38"/><path d="M60 34L76 2l4 8z" fill="#f28c38"/></g><path d="M42 4l3 5M52 0l2 6M64-2l1 6M76 2l-1 6" stroke="${TOY_INK}" stroke-width="3.5"/>`;
    back = `<path d="M30 102q8 20 20 28M90 102q-8 20-20 28" stroke="#fff" stroke-width="9" fill="none"/><path d="M30 102q8 20 20 28M90 102q-8 20-20 28" stroke="${TOY_INK}" stroke-width="9" stroke-dasharray="5 5" fill="none"/>`;
    face = `<path d="M55 76q5-3 10 0q-1 4-3 7q6 6 14 9q-10 0-14-5q-5-4-7-11z" fill="#6b4f3a"/>`;
    mouth = ""; blush = toyBlush(60, 76, 24);
  } else if (k === "dolphin") {
    head = `<ellipse cx="60" cy="72" rx="38" ry="40" fill="${fill}"/>`;
    ears = `<path d="M60 34q10-22 26-24q-8 14-10 26z" fill="${dark}"/>`;
    face = `<ellipse cx="60" cy="90" rx="16" ry="10" fill="${light}"/><ellipse cx="60" cy="100" rx="16" ry="6" fill="${light}"/>`;
    back = `<ellipse cx="26" cy="108" rx="13" ry="6" fill="${dark}" transform="rotate(35 26 108)"/><ellipse cx="94" cy="108" rx="13" ry="6" fill="${dark}" transform="rotate(-35 94 108)"/>`;
    eyes = toyEyes(60, 70, 15, f.eyes); mouth = toyMouth(60, 88, f.mouth); feet = `<path d="M40 138q20-14 40 0q-20 4-40 0z" fill="${dark}"/>`;
    body = `<ellipse cx="60" cy="118" rx="26" ry="20" fill="${fill}"/><ellipse cx="60" cy="122" rx="15" ry="12" fill="${light}"/>`;
  } else if (k === "jerboa") {
    ears = `<ellipse cx="34" cy="26" rx="14" ry="20" fill="${fill}" transform="rotate(-20 34 26)"/><ellipse cx="86" cy="26" rx="14" ry="20" fill="${fill}" transform="rotate(20 86 26)"/><ellipse cx="35" cy="28" rx="8" ry="13" fill="#ffc9c9" transform="rotate(-20 35 28)"/><ellipse cx="85" cy="28" rx="8" ry="13" fill="#ffc9c9" transform="rotate(20 85 28)"/>`;
    extra = `<path d="M84 128q30 4 30-40" stroke="${dark}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M114 88q-6-10 0-16q6 6 0 16z" fill="${TOY_INK}"/><path d="M114 80l0 8" stroke="#fff" stroke-width="2"/>`;
    face = `<ellipse cx="60" cy="80" rx="12" ry="8" fill="${light}"/><ellipse cx="60" cy="76" rx="2.6" ry="2" fill="#ff7b93"/>`;
    eyes = toyEyes(60, 64, 15, f.eyes, 6.2); mouth = toyMouth(60, 82, f.mouth || "cat"); feet = `<ellipse cx="44" cy="136" rx="15" ry="5" fill="${dark}"/><ellipse cx="76" cy="136" rx="15" ry="5" fill="${dark}"/>`;
  }
  const hands = f.prop ? toyHands(c === GOLD ? GOLD : c, 106) + toyProp(f.prop, 60, 106) : "";
  return `<defs>${vinyl(id + "b", c)}</defs>${toyShadow()}${extra}${back}${body}${feet}${ears}${head}${gloss(42, 46)}${face}${eyes}${mouth}${blush}${hands}${f.secret ? sparkles() : ""}`;
}

// ---------- Дизайн-духи ----------
function drawSpirit(f, id) {
  const c = f.secret ? GOLD : f.color, dark = toyMix(c, -0.3), fill = `url(#${id}b)`, ink = TOY_INK;
  const line = `stroke="${toyMix(c, -0.35)}" stroke-width="2" stroke-linejoin="round"`;
  let shape = "", fx = 60, fy = 84, deco = "";
  switch (f.kind) {
    case "pixel": shape = `<rect x="28" y="50" width="64" height="64" rx="10" fill="${fill}" ${line}/>`;
      deco = `<rect x="96" y="44" width="9" height="9" fill="${toyMix(c, 0.2)}"/><rect x="14" y="60" width="7" height="7" fill="${toyMix(c, 0.3)}"/><rect x="100" y="62" width="5" height="5" fill="${c}"/>`; break;
    case "cursor": shape = `<path d="M34 30l58 46-28 4 14 30-12 6-14-30-18 18z" fill="${fill}" ${line} stroke-width="3"/>`; fx = 52; fy = 66; break;
    case "layers": shape = `<rect x="38" y="36" width="58" height="50" rx="9" fill="${toyMix(c, 0.45)}" ${line}/><rect x="31" y="48" width="58" height="50" rx="9" fill="${toyMix(c, 0.22)}" ${line}/><rect x="24" y="60" width="58" height="52" rx="9" fill="${fill}" ${line}/>`; fx = 53; fy = 86; break;
    case "pipette": shape = `<path d="M48 54v40q0 10 6 22l6 12 6-12q6-12 6-22V54z" fill="${fill}" ${line}/><rect x="42" y="46" width="36" height="10" rx="4" fill="${dark}"/><ellipse cx="60" cy="32" rx="16" ry="17" fill="#ff6b81" stroke="${toyMix("#ff6b81", -0.35)}" stroke-width="2"/>${gloss(54, 26, 5, 3)}<path d="M54 112q6 6 12 0" fill="${toyMix(c, -0.1)}"/>`; fx = 60; fy = 80; break;
    case "diamond": shape = `<path d="M60 26l40 44-40 44-40-44z" fill="${fill}" ${line} stroke-width="3"/><path d="M60 40l26 30-26 30-26-30z" fill="#fff" opacity=".18"/>`; fx = 60; fy = 72; break;
    case "token": shape = `<circle cx="60" cy="80" r="38" fill="${toyMix(c, -0.15)}"/><circle cx="60" cy="76" r="38" fill="${fill}" ${line}/><circle cx="60" cy="76" r="30" fill="none" stroke="#fff" stroke-width="2" opacity=".45" stroke-dasharray="4 4"/>`; fy = 78; break;
    case "grid": shape = `<rect x="26" y="44" width="68" height="70" rx="10" fill="${fill}" ${line}/><path d="M48.7 44v70M71.3 44v70M26 67.3h68M26 90.6h68" stroke="#fff" stroke-width="1.6" opacity=".45"/>`; fy = 82; break;
    case "nib": shape = `<path d="M60 22l30 40q4 6 0 12l-30 44-30-44q-4-6 0-12z" fill="${fill}" ${line} stroke-width="3"/><path d="M60 118V88" stroke="${ink}" stroke-width="2.4"/><circle cx="60" cy="84" r="5" fill="#fff" stroke="${ink}" stroke-width="2"/>`; fx = 60; fy = 62; break;
    case "font": shape = `<rect x="26" y="40" width="68" height="76" rx="12" fill="${fill}" ${line}/><text x="60" y="76" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="34" font-weight="700" fill="#fff" opacity=".9">Aa</text>`; fy = 96; break;
    case "frame": shape = `<rect x="28" y="46" width="64" height="66" rx="4" fill="${fill}" ${line}/><rect x="36" y="54" width="48" height="50" rx="2" fill="#fff" opacity=".35"/><path d="M22 54h76M22 104h76M36 40v78M84 40v78" stroke="${dark}" stroke-width="2.2" opacity=".75"/>`; fy = 80; break;
    case "bubble": shape = `<path d="M24 46a12 12 0 0 1 12-12h48a12 12 0 0 1 12 12v40a12 12 0 0 1-12 12H56l-18 16 2-16h-4a12 12 0 0 1-12-12z" fill="${fill}" ${line} stroke-width="3"/><circle cx="96" cy="32" r="9" fill="#ff5c7a" stroke="#fff" stroke-width="2"/><text x="96" y="36" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="#fff">1</text>`; fy = 64; break;
    case "auto": shape = `<rect x="26" y="42" width="68" height="70" rx="12" fill="${fill}" ${line}/><path d="M18 77h10M92 77h10M60 34v8M60 112v8" stroke="${dark}" stroke-width="3" stroke-linecap="round"/><path d="M14 77l5-4v8zM106 77l-5-4v8zM60 30l-4 5h8zM60 124l-4-5h8z" fill="${dark}"/>`; fy = 80; break;
    case "system": shape = `<rect x="30" y="94" width="60" height="22" rx="7" fill="#7b8cde" ${line}/><rect x="34" y="74" width="52" height="22" rx="7" fill="#80ed99" ${line}/><rect x="38" y="54" width="44" height="22" rx="7" fill="#ffd166" ${line}/><rect x="42" y="34" width="36" height="22" rx="7" fill="${fill}" ${line}/><path d="M48 34l4-12 8 7 8-7 4 12z" fill="${GOLD}" stroke="${toyMix(GOLD, -0.35)}" stroke-width="1.4" stroke-linejoin="round"/>`; fx = 60; fy = 66; break;
  }
  const arms = f.kind === "system" ? "" : `<path d="M${fx - 34} ${fy + 14}q-8 6-6 14M${fx + 34} ${fy + 14}q8 6 6 14" stroke="${dark}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  const legs = `<path d="M50 120v14M70 120v14" stroke="${dark}" stroke-width="5" stroke-linecap="round"/><ellipse cx="48" cy="136" rx="8" ry="4.5" fill="${dark}"/><ellipse cx="72" cy="136" rx="8" ry="4.5" fill="${dark}"/>`;
  const faceS = f.kind === "system" ? toyEyes(fx, 102, 12, f.eyes, 4.6) + toyMouth(fx, 110, f.mouth) : toyEyes(fx, fy, 12, f.eyes, 5) + toyMouth(fx, fy + 11, f.mouth) + toyBlush(fx, fy + 8, 20);
  return `<defs>${vinyl(id + "b", c)}</defs>${toyShadow(28)}${legs}${deco}${shape}${f.kind === "system" ? "" : arms}${gloss(fx - 16, fy - 26, 9, 5)}${faceS}${f.prop ? toyProp(f.prop, fx + 30, fy + 26) : ""}${f.secret ? sparkles() : ""}`;
}

// ---------- Монстрики страхов ----------
function drawMonster(f, id) {
  const c = f.secret ? GOLD : f.color, dark = toyMix(c, -0.3), fill = `url(#${id}b)`, ink = TOY_INK;
  let body = "", top = "", fy = 76, extra = "";
  switch (f.kind) {
    case "ghost": body = `<path d="M22 132V70a38 38 0 0 1 76 0v62l-9.5-8-9.5 8-9.5-8-9.5 8-9.5-8-9.5 8-9.5-8z" fill="${fill}"/>`; break;
    case "bean": body = `<path d="M60 24c26 0 36 26 36 56s-8 56-36 56-36-26-36-56 10-56 36-56z" fill="${fill}"/>`; fy = 74; break;
    case "fuzz": {
      let d = ""; for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2, r = i % 2 ? 44 : 38; d += (i ? "L" : "M") + (60 + Math.cos(a) * r).toFixed(1) + " " + (88 + Math.sin(a) * r * 0.95).toFixed(1); }
      body = `<path d="${d}z" fill="${fill}" stroke="${fill}" stroke-width="4" stroke-linejoin="round"/>`; fy = 82; break;
    }
    case "spiky": {
      let d = ""; for (let i = 0; i < 18; i++) { const a = -Math.PI / 2 + i / 18 * Math.PI * 2, r = i % 2 ? 36 : 48; d += (i ? "L" : "M") + (60 + Math.cos(a) * r).toFixed(1) + " " + (86 + Math.sin(a) * r).toFixed(1); }
      body = `<path d="${d}z" fill="${fill}" stroke="${fill}" stroke-width="6" stroke-linejoin="round"/>`; fy = 84; break;
    }
    case "fog": body = `<path d="M24 128q-12-8-6-26q-10-18 6-30q2-22 22-26q14-20 32-6q22-2 24 20q14 12 6 30q8 18-8 30q-6 12-22 6q-12 10-28 2q-18 8-26 0z" fill="${fill}"/>`; fy = 82; break;
  }
  const feet = f.kind === "ghost" ? "" : `<ellipse cx="44" cy="134" rx="10" ry="6" fill="${dark}"/><ellipse cx="76" cy="134" rx="10" ry="6" fill="${dark}"/>`;
  if (f.horns) top += `<path d="M38 40q-8-14-2-26q6 10 14 16zM82 40q8-14 2-26q-6 10-14 16z" fill="${f.horns === true ? "#fff4e0" : f.horns}" stroke="${toyMix(c, -0.4)}" stroke-width="1.5" stroke-linejoin="round"/>`;
  if (f.flame) top += `<path d="M60 4q-14 16-8 28q-6-2-8-8q-6 16 8 24h16q14-8 8-24q-2 6-8 8q6-14-8-28z" fill="#ff9f1c"/><path d="M60 22q-6 8-2 16h4q4-8-2-16z" fill="#ffd166"/>`;
  if (f.antenna) top += `<path d="M60 30V12" stroke="${dark}" stroke-width="3"/><circle cx="60" cy="10" r="5" fill="#ffd166"/>`;
  if (f.mask) extra += `<path d="M30 ${fy - 10}q30-12 60 0q2 14-10 14q-8 0-12-6h-6q-4 6-12 6q-12 0-10-14z" fill="#2b2240"/><path d="M90 ${fy - 8}l12-6" stroke="#2b2240" stroke-width="2"/>`;
  if (f.tear) extra += `<path d="M${60 + 20} ${fy + 4}q-4 7 0 10q4-3 0-10z" fill="#7fd3ff" stroke="#3aa0d8" stroke-width="1"/>`;
  if (f.sweat) extra += `<path d="M94 ${fy - 20}q-5 8 0 11q5-3 0-11zM100 ${fy - 4}q-3 5 0 7q3-2 0-7z" fill="#7fd3ff" stroke="#3aa0d8" stroke-width="1"/>`;
  if (f.ask) extra += `<text x="94" y="40" font-family="system-ui,sans-serif" font-size="20" font-weight="800" fill="${dark}">?</text><text x="20" y="48" font-family="system-ui,sans-serif" font-size="14" font-weight="800" fill="${dark}">?</text>`;
  if (f.shake) extra += `<path d="M10 70q-4 8 0 16M16 62q-6 14 0 30M110 70q4 8 0 16M104 62q6 14 0 30" stroke="${dark}" stroke-width="2" fill="none" stroke-linecap="round" opacity=".6"/>`;
  if (f.cape) extra = `<path d="M30 70q30 14 60 0l12 66H18z" fill="#e63946"/>` + extra;
  const eyes = f.mask ? toyEyes(60, fy - 4, 15, "dot", 4.2) : toyEyes(60, fy, 15, f.eyes);
  const prop = f.prop ? `<ellipse cx="46" cy="${fy + 34}" rx="7" ry="6" fill="${c}" stroke="${dark}" stroke-width="1.2"/><ellipse cx="74" cy="${fy + 34}" rx="7" ry="6" fill="${c}" stroke="${dark}" stroke-width="1.2"/>` + toyProp(f.prop, 60, fy + 34) : "";
  return `<defs>${vinyl(id + "b", c)}</defs>${toyShadow(32)}${f.cape ? extra : ""}${feet}${top}${body}${gloss(40, fy - 30, 10, 6)}${eyes}${toyMouth(60, fy + 15, f.mouth)}${toyBlush(60, fy + 10, 25, f.secret ? "#ff8fa3" : "#ffffff")}${f.cape ? "" : extra}${prop}${f.secret ? sparkles() : ""}`;
}

function sparkles() {
  const s = (x, y, r) => `<path d="M${x} ${y - r}l${r * 0.3} ${r * 0.7} ${r * 0.7} ${r * 0.3}-${r * 0.7} ${r * 0.3}-${r * 0.3} ${r * 0.7}-${r * 0.3}-${r * 0.7}-${r * 0.7}-${r * 0.3} ${r * 0.7}-${r * 0.3}z" fill="#fff6c2"/>`;
  return s(14, 30, 7) + s(106, 44, 5) + s(102, 120, 6) + s(18, 112, 4);
}

// rarity: 0 common, 1 rare, 2 secret
const TOY_SERIES = [
  { key: "dubai", name: "Дубайские зверята", short: "Зверята", color: "#f4a261", accent: "#2a9d8f", draw: drawAnimal,
    for: "собесы, этапы и оффер", figures: [
      { id: "camel", name: "Верблюжонок", line: "Терпеливо идёт к цели через любые пески", kind: "camel", color: "#d9a86c", prop: "tablet" },
      { id: "falcon", name: "Сокол", line: "Замечает хорошую вакансию с высоты", kind: "falcon", color: "#8b6a4f", belly: "#f3e6cf" },
      { id: "oryx", name: "Орикс", line: "Держит рога прямо даже на финальном собесе", kind: "oryx", color: "#f1ece3", eyes: "happy" },
      { id: "fennec", name: "Фенек", line: "Слышит фидбек раньше, чем его скажут", kind: "fennec", color: "#e8c48f", mouth: "smile" },
      { id: "flamingo", name: "Фламинго", line: "Стоит на одной ноге, пока ждёт ответа", kind: "flamingo", color: "#f49ac1", eyes: "happy" },
      { id: "turtle", name: "Черепашка", line: "Медленно, но каждый отклик доплывает", kind: "turtle", color: "#8fd19e", mouth: "open" },
      { id: "gazelle", name: "Газель", line: "Прыгает с этапа на этап", kind: "gazelle", color: "#d4a373", belly: "#fbf3e6", prop: "note" },
      { id: "hoopoe", name: "Удод", line: "Распускает хохолок перед презентацией кейса", kind: "hoopoe", color: "#e8a06a", belly: "#f7d9bd", eyes: "wink" },
      { id: "dolphin", name: "Дельфин", line: "Ныряет в задачу и выныривает с решением", kind: "dolphin", color: "#6fa8dc", mouth: "open" },
      { id: "jerboa", name: "Тушканчик", line: "Готов к релокации уже вчера", kind: "jerboa", color: "#e3c08d", prop: "suitcase" },
      { id: "dugong", name: "Дюгонь", line: "Самый спокойный на собесе в Персидском заливе", kind: "dugong", color: "#9db4c0", eyes: "sleepy", rare: 1 },
      { id: "sandcat", name: "Барханный кот", line: "Невидим в песках, но заметен рекрутерам", kind: "sandcat", color: "#d8c19a", eyes: "happy", rare: 1 },
      { id: "goldfalcon", name: "Золотой сокол в кандуре", line: "Секретный. Прилетает с оффером из Дубая", kind: "kandura", secret: true, rare: 2, eyes: "star" },
    ] },
  { key: "spirits", name: "Дизайн-духи", short: "Духи", color: "#7b8cde", accent: "#ffd166", draw: drawSpirit,
    for: "отклики и разобранные вакансии", figures: [
      { id: "pixel", name: "Пиксель", line: "Маленький, но без него картинки не бывает", kind: "pixel", color: "#ff6b81" },
      { id: "cursor", name: "Курсор", line: "Всегда знает, куда нажать", kind: "cursor", color: "#4cc9f0", eyes: "wink" },
      { id: "layers", name: "Слой", line: "Хранит всё, что лежит под ним", kind: "layers", color: "#7b8cde" },
      { id: "pipette", name: "Пипетка", line: "Берёт лучший цвет из любой ситуации", kind: "pipette", color: "#cfe8ff", mouth: "open" },
      { id: "component", name: "Компонент", line: "Один раз сделала, везде переиспользуешь", kind: "diamond", color: "#b388eb", eyes: "happy" },
      { id: "token", name: "Токен", line: "Знает, как назвать каждый цвет", kind: "token", color: "#ffd166", mouth: "open" },
      { id: "grid", name: "Сетка", line: "Всё выравнивает, даже мысли", kind: "grid", color: "#80ed99" },
      { id: "nib", name: "Перо", line: "Рисует безье с первой попытки", kind: "nib", color: "#5b6b8c", eyes: "big" },
      { id: "font", name: "Шрифт", line: "Говорит с характером", kind: "font", color: "#f4845f", eyes: "wink" },
      { id: "frame", name: "Фрейм", line: "Даёт каждой идее своё место", kind: "frame", color: "#64dfdf" },
      { id: "comment", name: "Комментарий", line: "Приносит фидбек, но по-доброму", kind: "bubble", color: "#ffb3c6", mouth: "open", rare: 1 },
      { id: "autolayout", name: "Автолейаут", line: "Подстраивается под любые требования", kind: "auto", color: "#9381ff", eyes: "happy", rare: 1 },
      { id: "designsystem", name: "Дизайн-система", line: "Секретный. Держит всю коллекцию в порядке", kind: "system", secret: true, rare: 2, eyes: "star" },
    ] },
  { key: "cats", name: "Котики «Мяу-оффер»", short: "Котики", color: "#ffafcc", accent: "#cdb4db", draw: drawCat,
    for: "дни, когда ты что-то сделала для поиска", figures: [
      { id: "letter", name: "Котик Отклик", line: "Отправил письмо и не перечитывает", color: "#f6c28b", prop: "letter" },
      { id: "screen", name: "Котик Скрининг", line: "Звонок через пять минут, всё под контролем", color: "#b8c0cc", top: "headset", pattern: "stripes" },
      { id: "folio", name: "Котик Портфолио", line: "Носит лучшие кейсы с собой", color: "#ffd6a5", prop: "folder", pattern: "patch", patch: "#e08e45" },
      { id: "coffee", name: "Котик Кофе-брейк", line: "Перерыв тоже часть процесса", color: "#c8a27c", prop: "mug", eyes: "happy" },
      { id: "deadline", name: "Котик Дедлайн", line: "Тестовое будет к утру", color: "#9aa5b1", prop: "laptop", glasses: true },
      { id: "network", name: "Котик Нетворкинг", line: "Знает всех рекрутеров Дубая", color: "#3d3a4b", belly: "#f4f1ea", prop: "phone", pattern: "tuxedo" },
      { id: "test", name: "Котик Тестовое", line: "Рисует, пока не получится", color: "#fbe7c6", prop: "pencil", top: "beret" },
      { id: "wait", name: "Котик Терпение", line: "Ответ придёт, а пока можно подремать", color: "#e5e5e5", prop: "hourglass", eyes: "sleepy", pattern: "patch", patch: "#8d8d8d" },
      { id: "relocate", name: "Котик Релокейт", line: "Чемодан собран, виза в процессе", color: "#ffb4a2", prop: "suitcase", neck: "bandana" },
      { id: "pixelcat", name: "Котик Пиксель-перфект", line: "Видит разницу в один пиксель", color: "#a0c4ff", prop: "tablet", eyes: "big" },
      { id: "weekend", name: "Котик Выходной", line: "Отдых — тоже стратегия", color: "#cdb4db", top: "sleepcap", neck: "scarf", eyes: "sleepy", rare: 1 },
      { id: "lead", name: "Котик Лид", line: "Ведёт команду и не теряет усы", color: "#f28482", neck: "tie", prop: "cv", eyes: "wink", rare: 1 },
      { id: "offer", name: "Котик Оффер", line: "Секретный. Пришёл с кубком и контрактом", top: "crown", prop: "trophy", secret: true, rare: 2, eyes: "star", mouth: "open" },
    ] },
  { key: "monsters", name: "Монстрики страхов", short: "Монстрики", color: "#9381ff", accent: "#ff8fa3", draw: drawMonster,
    for: "отказы: каждый страх, который ты встретила лицом к лицу", figures: [
      { id: "impostor", name: "Самозванец", line: "Шепчет «ты недостаточно хороша». Врёт", kind: "bean", color: "#a78bfa", mask: true, mouth: "wobble" },
      { id: "reject", name: "Страх отказа", line: "Плачет, но уже не так громко", kind: "ghost", color: "#a5b4cb", eyes: "worried", tear: true, mouth: "frown" },
      { id: "procrast", name: "Прокрастин", line: "Ещё пять минут в телефоне и точно начнём", kind: "fuzz", color: "#c4b5fd", eyes: "sleepy", prop: "phone", mouth: "flat" },
      { id: "perfect", name: "Перфекционист", line: "Двигает кнопку на 1 px уже третий час", kind: "bean", color: "#7dd3c0", eyes: "angry", prop: "ruler", mouth: "flat" },
      { id: "compare", name: "Сравнялка", line: "Всё время смотрит в чужие портфолио", kind: "ghost", color: "#fde68a", eyes: "side", mouth: "o" },
      { id: "anxiety", name: "Тревожка", line: "Обновляет почту каждые 30 секунд", kind: "spiky", color: "#f9a8d4", eyes: "big", mouth: "wobble", shake: true },
      { id: "critic", name: "Внутренний критик", line: "Всё зачёркивает, но ты пиши дальше", kind: "bean", color: "#f87171", horns: true, eyes: "angry", prop: "pencil", mouth: "fang" },
      { id: "interview", name: "Страх собеса", line: "Потеет перед звонком, а потом всё хорошо", kind: "ghost", color: "#93c5fd", eyes: "worried", sweat: true, mouth: "open" },
      { id: "english", name: "Страх английского", line: "Боится сказать «I think» не так", kind: "fuzz", color: "#5eead4", ask: true, mouth: "o" },
      { id: "testtask", name: "Страх тестового", line: "Считает часы до дедлайна", kind: "bean", color: "#fdba74", prop: "clock", mouth: "teeth", antenna: true },
      { id: "burnout", name: "Выгорашка", line: "Просит отдохнуть. Её надо слушать", kind: "fuzz", color: "#6b7280", flame: true, eyes: "sleepy", mouth: "flat", rare: 1 },
      { id: "unknown", name: "Неизвестность", line: "Много глаз, но ни одного ответа", kind: "fog", color: "#4c4f7a", eyes: "three", mouth: "fang", rare: 1 },
      { id: "courage", name: "Смелость", line: "Секретный. Вырастает из всех страхов сразу", kind: "bean", secret: true, rare: 2, eyes: "star", mouth: "grin", cape: true, horns: "#fff4e0" },
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

// ---------- the pyramid: a tetra blind bag (like a tetra pack) with two scalloped sealed seams ----------
// Real 3D in CSS: four triangular faces placed with matrix3d, a sealed fin along the bottom edge (across) and one
// along the top edge (front to back). Each face catches light by its own angle, so the foil shimmers as it turns.
// The tint tells the series: a box knows its series from the start, the figure stays a surprise.
const TOY_TINT = { dubai: ["#ffd79a", "#ff8a5c"], spirits: ["#b9c8ff", "#7b68ff"], cats: ["#ffc8e4", "#ff78b8"], monsters: ["#b8f5c8", "#3fc1c9"] };
const TET_A = 1, TET_H = 1.04; // half the seam length and half the height, in units of the size S
function tetFaces(S) {
  const v = { L: [-TET_A, TET_H, 0], R: [TET_A, TET_H, 0], K: [0, -TET_H, -TET_A], F: [0, -TET_H, TET_A] };
  const sub = (p, q) => p.map((x, i) => x - q[i]), add = (p, q) => p.map((x, i) => x + q[i]), mul = (p, k) => p.map(x => x * k);
  const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2], cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  const len = p => Math.hypot(...p);
  return [["front", "F", "R", "L"], ["back", "K", "L", "R"], ["left", "L", "F", "K"], ["right", "R", "K", "F"]].map(([name, a, b, c]) => {
    let A = mul(v[a], S), B = mul(v[b], S), C = mul(v[c], S);
    const build = (B, C) => {
      const W = len(sub(B, C)), cx = mul(sub(B, C), 1 / W), mid = add(C, mul(cx, W / 2)), H = len(sub(A, mid));
      const cy = mul(sub(mid, A), 1 / H), n = cross(cx, cy), T = sub(C, mul(cy, H)); // element (0,0) is above C by H
      return { W, H, cx, cy, n, T };
    };
    let f = build(B, C);
    const centroid = mul(add(add(A, B), C), 1 / 3);
    if (dot(f.n, centroid) < 0) f = build(C, B); // front side of the element must face outwards
    const m = [...f.cx, 0, ...f.cy, 0, ...f.n, 0, ...f.T, 1].map(x => +x.toFixed(4)).join(",");
    return { name, W: f.W, H: f.H, n: f.n, m };
  });
}
const SCALLOP = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="14" height="16"><path d="M0 0h14v10q-3.5 6-7 0t-7 0z" fill="#fff"/></svg>');
const SCALLOP_UP = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="14" height="16"><path d="M0 16h14V6q-3.5-6-7 0t-7 0z" fill="#fff"/></svg>');
function tetHtml(series, { tag = "", S = 86, cls = "" } = {}) {
  const [c1, c2] = TOY_TINT[series] || TOY_TINT.cats, seam = 2 * TET_A * S + 22;
  const face = f => {
    const content = f.name === "front"
      ? `<svg class="tf-art" viewBox="0 0 100 86" preserveAspectRatio="none"><g transform="translate(50 52)"><circle cx="-9" cy="-4" r="2.6" fill="#3a2a4f"/><circle cx="9" cy="-4" r="2.6" fill="#3a2a4f"/><circle cx="-9.8" cy="-4.9" r=".9" fill="#fff"/><circle cx="8.2" cy="-4.9" r=".9" fill="#fff"/><path d="M-3 1q3 3 6 0" stroke="#3a2a4f" stroke-width="1.3" fill="none" stroke-linecap="round"/><ellipse cx="-15" cy="1.5" rx="3.4" ry="2" fill="#ff6fa3" opacity=".45"/><ellipse cx="15" cy="1.5" rx="3.4" ry="2" fill="#ff6fa3" opacity=".45"/></g>
         <text x="50" y="69" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="5.2" font-weight="600" fill="#4a3b66" opacity=".7" letter-spacing=".3">blind box</text>${tag ? `<text x="50" y="78" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="7" font-weight="800" fill="#3d25b0">${tag.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>` : ""}</svg>`
      : f.name === "back" ? `<svg class="tf-art" viewBox="0 0 100 86" preserveAspectRatio="none"><text x="50" y="58" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="6" font-weight="700" fill="#4a3b66" opacity=".75">сюрприз внутри</text><g fill="#4a3b66" opacity=".5">${[0, 2, 3.5, 6, 7.5, 9.5, 12, 13.5, 15.5, 18, 19.5, 21].map((x, i) => `<rect x="${39 + x}" y="64" width="${i % 3 ? .9 : 1.5}" height="9"/>`).join("")}</g></svg>` : "";
    return `<div class="tf tf-${f.name}" style="width:${f.W.toFixed(1)}px;height:${f.H.toFixed(1)}px;transform:matrix3d(${f.m})" data-n="${f.n.map(x => x.toFixed(3)).join(" ")}"><i class="tf-holo"></i><i class="tf-glit"></i>${content}<i class="tf-light"></i></div>`;
  };
  return `<div class="tet ${cls}" style="--c1:${c1};--c2:${c2};--seam:${seam.toFixed(0)}px;--h:${(TET_H * S).toFixed(1)}px">
    ${tetFaces(S).map(face).join("")}
    <div class="tfin tfin-bottom" style="width:${seam.toFixed(0)}px;--scal:url('${SCALLOP}')"></div>
    <div class="tfin tfin-top" ${cls.includes("live") ? 'id="tetTop"' : ""} style="width:${seam.toFixed(0)}px;--scal:url('${SCALLOP_UP}')"><i class="tfin-cut"></i></div>
  </div>`;
}
// light and foil follow the angle: each face gets its own brightness, rainbow offset and glare spot
function tetShade(el, rx, ry) {
  const a = ry * Math.PI / 180, b = rx * Math.PI / 180;
  for (const f of el.querySelectorAll(".tf")) {
    const [x, y, z] = f.dataset.n.split(" ").map(Number);
    const x1 = x * Math.cos(a) + z * Math.sin(a), z1 = -x * Math.sin(a) + z * Math.cos(a);
    const y2 = y * Math.cos(b) - z1 * Math.sin(b), z2 = y * Math.sin(b) + z1 * Math.cos(b);
    const light = Math.max(0, 0.35 * -y2 + 0.25 * -x1 + 0.6 * z2); // light from the upper left front
    f.style.setProperty("--l", (0.55 + light * 0.5).toFixed(3));
    f.style.setProperty("--hx", (50 + x1 * 60 + ry * 0.35).toFixed(1) + "%");
    f.style.setProperty("--hy", (50 + y2 * 60 + rx * 0.5).toFixed(1) + "%");
    f.style.setProperty("--gx", (50 - x1 * 70).toFixed(1) + "%");
    f.style.setProperty("--gy", (40 + y2 * 70).toFixed(1) + "%");
    f.style.setProperty("--g", Math.pow(Math.max(0, z2), 3).toFixed(3)); // glitter flashes when the face looks right at you
  }
}
