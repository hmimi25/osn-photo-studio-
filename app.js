(() => {
'use strict';

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { x = clamp((x - a) / (b - a)); return x * x * (3 - 2 * x); };
const pad = (n, l = 2) => String(n).padStart(l, '0');
const toBlob = (cv, q) => new Promise(r => cv.toBlob(r, 'image/jpeg', q));

const OUT_W = 1080;
const PREVIEW_SCALE = 0.45;
const ZIP_PART = 40;
const SHARE_BATCH = 10;
const PREP_DELAY = 1200;
const DEFAULT_SRC = { cover: 'cover.png', minimal: 'minimal.png' };
const LS_KEY = { cover: 'osn-cover', minimal: 'osn-page2' };

/* ---------- sports + cinematic filters (48) ---------- */
const N = { bright: 1, contrast: 1, sat: 1, shadow: [0, 0, 0], hi: [0, 0, 0], fade: 0, grain: 0, vig: 0, warm: 0, grass: 0, sky: 0, duo: 0, dk: [0, 0, 0], lt: [1, 1, 1], sharp: 0, glow: 0, clarity: 0 };
const P = (cat, name, o) => ({ ...N, cat, name, ...o });
const CATS = { all: 'الكل', sport: 'رياضي', cine: 'سينمائي', color: 'ألوان', bw: 'أبيض وأسود', fx: 'تأثيرات' };
const PRESETS = {
  none:       P('all',   'بدون فلتر', {}),
  // رياضي
  pro:        P('sport', 'ستاد برو', { contrast: 1.2, sat: 1.2, grass: .3, sharp: .5, vig: .3, grain: .1 }),
  broadcast:  P('sport', 'بث تلفزيوني HD', { bright: 1.03, contrast: 1.12, sat: 1.15, shadow: [-.01, 0, .03], hi: [.02, .02, .03], sharp: .6, vig: .15 }),
  night:      P('sport', 'ليلة الأبطال', { bright: .95, contrast: 1.25, sat: 1.15, shadow: [-.02, 0, .08], hi: [.02, .04, .1], sharp: .3, vig: .55, grain: .15 }),
  floodlight: P('sport', 'أضواء الملعب', { bright: 1.05, contrast: 1.18, sat: 1.12, hi: [.05, .05, .08], glow: .35, clarity: .4, vig: .35 }),
  hdr:        P('sport', 'HDR أكشن', { contrast: 1.18, sat: 1.2, clarity: .9, sharp: .3, vig: .2 }),
  speed:      P('sport', 'سرعة', { contrast: 1.25, sat: .8, sharp: .8, clarity: .6, vig: .3, grain: .15 }),
  derby:      P('sport', 'يوم الديربي', { contrast: 1.25, sat: 1.2, warm: .2, clarity: .5, vig: .4, grain: .15 }),
  redzone:    P('sport', 'أحمر الحماس', { contrast: 1.25, sat: 1.2, shadow: [.05, -.02, -.02], hi: [.1, 0, -.02], vig: .45, sharp: .3 }),
  grass:      P('sport', 'عشب أخضر', { contrast: 1.15, sat: 1.1, grass: .9, hi: [.03, .04, -.02], sharp: .4, vig: .25 }),
  victory:    P('sport', 'مجد الفوز', { bright: 1.04, contrast: 1.2, sat: 1.25, hi: [.1, .07, -.02], sharp: .45, vig: .3 }),
  clean:      P('sport', 'نهار ساطع', { bright: 1.08, contrast: 1.05, sat: 1.15, hi: [.04, .03, 0], sharp: .3, vig: .1 }),
  training:   P('sport', 'تدريب نقي', { bright: 1.02, contrast: 1.08, sat: 1.08, sharp: .35, vig: .15 }),
  sharp:      P('sport', 'حدة عالية', { contrast: 1.12, sat: 1.1, sharp: 1, vig: .15 }),
  skyblue:    P('sport', 'سماء زرقاء', { contrast: 1.15, sat: 1.1, sky: .8, sharp: .3, vig: .2 }),
  osn:        P('sport', 'OSN أزرق', { contrast: 1.15, sat: 1.05, shadow: [-.03, .03, .09], hi: [0, .05, .08], sky: .5, grain: .2, vig: .35 }),
  stadium:    P('sport', 'ليل الملعب', { bright: .92, contrast: 1.25, sat: 1.15, shadow: [-.01, 0, .06], hi: [.03, .04, .08], grain: .2, vig: .5 }),
  sunset:     P('sport', 'غروب الملعب', { bright: 1.02, contrast: 1.12, sat: 1.2, shadow: [.04, 0, -.03], hi: [.12, .05, -.08], warm: .4, grain: .15, vig: .35 }),
  // سينمائي
  cinema:     P('cine',  'Teal & Orange', { contrast: 1.15, sat: 1.12, shadow: [-.03, .05, .08], hi: [.08, .03, -.07], fade: .02, grain: .25, vig: .35 }),
  blockbuster:P('cine',  'بلوك باستر', { contrast: 1.2, sat: 1.15, shadow: [-.03, .04, .08], hi: [.08, .03, -.06], clarity: .45, vig: .4, grain: .15 }),
  golden:     P('cine',  'الساعة الذهبية', { bright: 1.03, contrast: 1.1, sat: 1.08, shadow: [.03, .01, -.02], hi: [.09, .04, -.05], fade: .02, grain: .15, vig: .3 }),
  moody:      P('cine',  'كئيب سينمائي', { contrast: 1.2, sat: .8, shadow: [-.03, .04, .04], hi: [.02, .03, 0], fade: .06, grain: .3, vig: .5 }),
  dramatic:   P('cine',  'درامي داكن', { bright: .88, contrast: 1.4, sat: .85, shadow: [-.02, -.01, .02], sharp: .3, grain: .3, vig: .6 }),
  street:     P('cine',  'شارع قاسي', { contrast: 1.35, sat: .6, fade: .04, sharp: .6, grain: .5, vig: .45 }),
  fire:       P('cine',  'ناري', { contrast: 1.25, sat: 1.25, shadow: [.04, -.01, -.03], hi: [.12, .03, -.1], warm: .8, vig: .5, sharp: .3 }),
  ice:        P('cine',  'جليدي', { contrast: 1.15, sat: .8, shadow: [-.03, 0, .07], hi: [-.03, .03, .1], warm: -.8, vig: .3, sharp: .3 }),
  neon:       P('cine',  'نيون الليل', { contrast: 1.3, sat: 1.3, shadow: [.05, -.02, .08], hi: [-.03, .08, .06], vig: .5, grain: .2 }),
  retro:      P('cine',  'كرة التسعينات', { contrast: 1.05, sat: .9, shadow: [.04, 0, .05], hi: [.1, .06, -.04], fade: .08, warm: .3, grain: .45, vig: .35 }),
  kodak:      P('cine',  'كوداك قديم', { sat: 1.05, shadow: [.02, .03, -.01], hi: [.08, .05, -.02], fade: .06, grain: .4, vig: .3 }),
  matte:      P('cine',  'مات فيلم', { contrast: 1.05, sat: .9, shadow: [.01, .02, .03], hi: [.04, .02, 0], fade: .09, grain: .25, vig: .2 }),
  cold:       P('cine',  'فولاذ بارد', { contrast: 1.15, sat: .85, shadow: [-.02, 0, .06], hi: [-.02, .02, .05], grain: .2, vig: .3 }),
  bleach:     P('cine',  'Bleach Bypass', { contrast: 1.35, sat: .55, grain: .3, vig: .35, sharp: .4 }),
  // ألوان
  electric:   P('color', 'أصفر كهربائي', { contrast: 1.2, sat: 1.1, shadow: [0, 0, .03], hi: [.09, .08, -.06], grain: .15, vig: .3 }),
  duoOsn:     P('color', 'ثنائي OSN', { contrast: 1.15, duo: 1, dk: [.02, .05, .14], lt: [.65, .88, 1], vig: .3, grain: .15 }),
  duoVolt:    P('color', 'أسود وأصفر', { contrast: 1.3, duo: 1, dk: [0, 0, 0], lt: [.91, 1, 0], grain: .2, vig: .3 }),
  blackgold:  P('color', 'أسود وذهبي', { contrast: 1.2, duo: 1, dk: [.03, .02, 0], lt: [1, .85, .45], grain: .25, vig: .4 }),
  duoRed:     P('color', 'أسود وأحمر', { contrast: 1.25, duo: 1, dk: [.06, 0, .02], lt: [1, .42, .3], grain: .2, vig: .4 }),
  sepia:      P('color', 'سيبيا كلاسيك', { contrast: 1.05, duo: 1, dk: [.12, .07, .03], lt: [.98, .9, .72], grain: .3, vig: .4 }),
  cross:      P('color', 'كروس بروسس', { contrast: 1.2, sat: 1.2, shadow: [0, .04, .08], hi: [.08, .04, -.1], fade: .03, grain: .2, vig: .3 }),
  // أبيض وأسود
  noir:       P('bw',    'أبيض وأسود نوار', { bright: .98, contrast: 1.3, sat: 0, fade: .03, grain: .35, vig: .5 }),
  bwsport:    P('bw',    'أبيض وأسود رياضي', { contrast: 1.4, sat: 0, sharp: .6, grain: .3, vig: .4 }),
  bwsoft:     P('bw',    'أبيض وأسود ناعم', { contrast: 1.08, sat: 0, fade: .08, glow: .3, grain: .3, vig: .3 }),
  bwhard:     P('bw',    'أبيض وأسود قاسٍ', { contrast: 1.6, sat: 0, clarity: .8, grain: .4, vig: .6 }),
  // تأثيرات
  glow:       P('fx',    'وهج ناعم', { contrast: 1.05, sat: 1.1, glow: .7, vig: .2 }),
  dream:      P('fx',    'حلم', { bright: 1.03, sat: 1.1, fade: .05, glow: 1, vig: .15 }),
  detail:     P('fx',    'تفاصيل HDR', { contrast: 1.1, sat: 1.1, clarity: 1.3, sharp: .3 }),
  darkframe:  P('fx',    'إطار داكن', { contrast: 1.1, vig: .9 }),
  heavygrain: P('fx',    'حبيبات ثقيلة', { contrast: 1.1, fade: .04, grain: .85, vig: .25 })
};

/* ---------- state ---------- */
const state = { items: [], cur: -1, cover: 0, coverManual: false, preset: 'pro', cat: 'all', hover: null, compare: false, busy: false, prepCount: 0, scoring: 0 };
const ov = { cover: null, minimal: null };
const defaults = { cover: null, minimal: null };
let ver = 0, prepared = null, prepPromise = null, prepVer = -1, prepTimer = 0, placeholderCv = null, deferredInstall = null;

/* ---------- options ---------- */
function getFilter() {
  if (state.compare) return { ...N, intensity: 0 };
  if (state.hover) return { ...PRESETS[state.hover], intensity: 1 };
  const p = PRESETS[state.preset];
  return {
    ...p,
    intensity: +$('#intensity').value / 100,
    bright: p.bright * (1 + +$('#bri').value / 100),
    contrast: p.contrast * (1 + +$('#con').value / 100),
    sat: p.sat * (1 + +$('#sat').value / 100),
    warm: p.warm + +$('#warm').value / 100,
    grain: +$('#grain').value / 100,
    vig: +$('#vig').value / 100,
    sharp: +$('#sharp').value / 100
  };
}
const getOpts = () => ({ fit: $('#fit').value, filter: getFilter() });
const orderedIdx = () => {
  const n = state.items.length; if (!n) return [];
  const c = Math.min(state.cover, n - 1);
  return [c, ...state.items.map((_, i) => i).filter(i => i !== c)];
};

/* ---------- image loading ---------- */
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('load ' + src.slice(0, 40))); i.src = src; });
async function loadBitmap(file) {
  try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* fallback */ }
  const url = URL.createObjectURL(file);
  try { return await loadImg(url); } finally { setTimeout(() => URL.revokeObjectURL(url), 8000); }
}
async function ensureWork(it) {
  if (it.work) return it.work;
  const bmp = await loadBitmap(it.file);
  const s = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
  x.drawImage(bmp, 0, 0, c.width, c.height);
  if (bmp.close) bmp.close();
  it.work = c; return c;
}
function placeholder() {
  if (placeholderCv) return placeholderCv;
  const c = document.createElement('canvas'); c.width = 1400; c.height = 1000;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 1400, 1000);
  g.addColorStop(0, '#1c3b52'); g.addColorStop(.55, '#6b8a9c'); g.addColorStop(1, '#d9a35b');
  x.fillStyle = g; x.fillRect(0, 0, 1400, 1000);
  x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.arc(700, 470, 150, 0, 7); x.fill(); x.fillRect(560, 600, 280, 400);
  return (placeholderCv = c);
}

/* ---------- picking the cover photo (sharpness, exposure, contrast, colour, framing) ---------- */
async function scorePhoto(it) {
  const bmp = await loadBitmap(it.file);
  const iw = bmp.width, ih = bmp.height, s = 160 / Math.max(iw, ih);
  const w = Math.max(8, Math.round(iw * s)), h = Math.max(8, Math.round(ih * s));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bmp, 0, 0, w, h);
  if (bmp.close) bmp.close();
  const d = x.getImageData(0, 0, w, h).data, n = w * h, L = new Float32Array(n);
  let sum = 0, clip = 0, chroma = 0;
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2], l = .2126 * r + .7152 * g + .0722 * b;
    L[p] = l; sum += l; if (l < 12 || l > 243) clip++;
    chroma += Math.max(r, g, b) - Math.min(r, g, b);
  }
  const mean = sum / n; let vr = 0;
  for (let p = 0; p < n; p++) vr += (L[p] - mean) * (L[p] - mean);
  const std = Math.sqrt(vr / n);
  let lap = 0, wt = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let xx = 1; xx < w - 1; xx++) {
      const p = y * w + xx, v = 4 * L[p] - L[p - 1] - L[p + 1] - L[p - w] - L[p + w];
      const dx = (xx / w - .5) * 2, dy = (y / h - .5) * 2, cw = 1.6 - .9 * Math.min(1, Math.hypot(dx, dy));
      lap += v * v * cw; wt += cw;
    }
  }
  const sharpN = clamp(Math.log10(1 + lap / wt) / 3.2);
  const expN = (1 - clamp(Math.abs(mean - 118) / 118)) * (1 - clamp((clip / n) * 2.5));
  const conN = clamp(std / 70), colN = clamp((chroma / n) / 70);
  const aspectN = 1 - clamp(Math.abs(Math.log((iw / ih) / .75)) / Math.log(2.2));
  const resN = clamp((iw * ih) / 1.2e6);
  return .38 * sharpN + .22 * expN + .14 * conN + .08 * colN + .10 * aspectN + .08 * resN;
}
function pickCover() {
  let best = -1, bi = state.cover;
  state.items.forEach((it, i) => { if (it.score != null && it.score > best) { best = it.score; bi = i; } });
  if (best < 0) return;
  state.cover = bi; renderStrip(); changed();
}
async function scoreNew(list) {
  state.scoring++; setStatus('جاري اختيار أفضل صورة للغلاف…');
  try {
    for (const it of list) {
      try { it.score = await scorePhoto(it); } catch (e) { it.score = 0; }
      await sleep(0);
    }
  } finally { state.scoring--; }
  if (!state.scoring) { if (!state.coverManual) pickCover(); else changed(); setStatus(''); }
}

/* ---------- grading ---------- */
function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h), inv = 1 / (2 * r + 1);
  const pass = (a, b, horiz) => {
    const len = horiz ? w : h, cnt = horiz ? h : w, stride = horiz ? 1 : w, step = horiz ? w : 1;
    for (let k = 0; k < cnt; k++) {
      const base = k * step; let sum = 0;
      for (let i = -r; i <= r; i++) sum += a[base + Math.min(len - 1, Math.max(0, i)) * stride];
      for (let i = 0; i < len; i++) {
        b[base + i * stride] = sum * inv;
        sum += a[base + Math.min(len - 1, i + r + 1) * stride] - a[base + Math.max(0, i - r) * stride];
      }
    }
  };
  pass(src, tmp, true); pass(tmp, out, false); pass(out, tmp, true); pass(tmp, out, false);
  return out;
}

function grade(ctx, w, h, f) {
  if (!(f.intensity > 0) && !f.grain && !f.vig && !f.sharp && !f.clarity && !f.glow) return;
  const id = ctx.getImageData(0, 0, w, h), d = id.data;
  const k = f.intensity, [sr, sg, sb] = f.shadow, [hr, hg, hb] = f.hi, fade = f.fade, warm = f.warm * 0.06, vg = f.vig;
  const grass = f.grass, sky = f.sky, duo = f.duo, dk = f.dk, lt = f.lt;
  const cx = w / 2, cy = h / 2, inv = 1 / Math.hypot(cx, cy);
  for (let y = 0; y < h; y++) {
    const dy2 = (y - cy) * (y - cy);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const or = d[i] / 255, og = d[i + 1] / 255, ob = d[i + 2] / 255;
      let r = or * f.bright, g = og * f.bright, b = ob * f.bright;
      r = (r - .5) * f.contrast + .5; g = (g - .5) * f.contrast + .5; b = (b - .5) * f.contrast + .5;
      let l = .2126 * r + .7152 * g + .0722 * b;
      if (grass) { const gd = g - (r > b ? r : b); if (gd > 0) { const m = 1 + grass * Math.min(1, gd * 5); r = l + (r - l) * m; g = l + (g - l) * m; b = l + (b - l) * m; } }
      if (sky) { const bd = b - (r > g ? r : g); if (bd > 0) { const m = 1 + sky * Math.min(1, bd * 5); r = l + (r - l) * m; g = l + (g - l) * m; b = l + (b - l) * m; } }
      r = l + (r - l) * f.sat; g = l + (g - l) * f.sat; b = l + (b - l) * f.sat;
      if (duo) {
        const lc = Math.min(1, Math.max(0, .2126 * r + .7152 * g + .0722 * b));
        r += (dk[0] + (lt[0] - dk[0]) * lc - r) * duo; g += (dk[1] + (lt[1] - dk[1]) * lc - g) * duo; b += (dk[2] + (lt[2] - dk[2]) * lc - b) * duo;
      }
      l = .2126 * r + .7152 * g + .0722 * b;
      const sh = 1 - smooth(0, .6, l), hi = smooth(.4, 1, l);
      r += sr * sh + hr * hi + warm; g += sg * sh + hg * hi; b += sb * sh + hb * hi - warm;
      if (fade) { r = fade + r * (1 - fade); g = fade + g * (1 - fade); b = fade + b * (1 - fade); }
      r = or + (r - or) * k; g = og + (g - og) * k; b = ob + (b - ob) * k;
      if (vg) { const dx = x - cx, v = 1 - vg * smooth(.35, 1, Math.sqrt(dx * dx + dy2) * inv) * .85; r *= v; g *= v; b *= v; }
      d[i] = r * 255; d[i + 1] = g * 255; d[i + 2] = b * 255;
    }
  }
  if (f.clarity || f.glow) {
    const n = w * h, Lf = new Float32Array(n);
    for (let p = 0, i = 0; p < n; p++, i += 4) Lf[p] = (d[i] * .2126 + d[i + 1] * .7152 + d[i + 2] * .0722) / 255;
    const Lb = boxBlur(Lf, w, h, Math.max(2, Math.round(w * .02)));
    for (let p = 0, i = 0; p < n; p++, i += 4) {
      const diff = Lf[p] - Lb[p], mid = Math.max(.2, 1 - Math.abs(Lf[p] - .5) * 1.2);
      const add = f.clarity * diff * 255 * mid * 1.1, gl = f.glow * Math.max(0, Lb[p] - .45) * 255;
      d[i] += add + gl; d[i + 1] += add + gl * .95; d[i + 2] += add + gl * .85;
    }
  }
  if (f.sharp) {
    const src = new Uint8ClampedArray(d), kk = f.sharp * 0.6, w4 = w * 4;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) { const j = i + c, v = src[j]; d[j] = v + kk * (4 * v - src[j - 4] - src[j + 4] - src[j - w4] - src[j + w4]); }
      }
    }
  }
  if (f.grain) {
    const amp = f.grain * 255 * 0.16;
    for (let i = 0; i < d.length; i += 4) {
      const l = (d[i] * .2126 + d[i + 1] * .7152 + d[i + 2] * .0722) / 255;
      const n = (Math.random() - .5) * 2 * amp * (1 - Math.abs(l - .5) * 1.1);
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
  }
  ctx.putImageData(id, 0, 0);
}

function drawFit(ctx, img, w, h, mode) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const s = mode === 'contain' ? Math.min(w / iw, h / ih) : Math.max(w / iw, h / ih);
  const dw = iw * s, dh = ih * s;
  if (mode === 'contain') { ctx.fillStyle = '#111'; ctx.fillRect(0, 0, w, h); }
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

/* photo (filtered) underneath, template overlay on top: exactly one design per photo */
function renderPhoto(src, role, o, scale) {
  const t = role === 'cover' ? ov.cover : ov.minimal;
  const W = OUT_W, H = Math.round(W * t.naturalHeight / t.naturalWidth);
  const cv = document.createElement('canvas');
  cv.width = Math.round(W * scale); cv.height = Math.round(H * scale);
  const ctx = cv.getContext('2d'); ctx.imageSmoothingQuality = 'high';
  drawFit(ctx, src, cv.width, cv.height, o.fit);
  grade(ctx, cv.width, cv.height, o.filter);
  ctx.drawImage(t, 0, 0, cv.width, cv.height);
  return cv;
}

/* ---------- templates (default + custom) ---------- */
const overlaysReady = (async () => {
  for (const key of ['cover', 'minimal']) {
    try { defaults[key] = await loadImg(DEFAULT_SRC[key]); } catch (e) { defaults[key] = null; }
    let custom = null, data = null;
    try { data = localStorage.getItem(LS_KEY[key]); if (data) custom = await loadImg(data); } catch (e) { custom = null; }
    ov[key] = custom || defaults[key];
    if (custom) $(key === 'cover' ? '#tpCover' : '#tpMin').src = data;
  }
})();

function setCustomOverlay(key, file) {
  const r = new FileReader();
  r.onload = async () => {
    try {
      const img = await loadImg(r.result); ov[key] = img;
      $(key === 'cover' ? '#tpCover' : '#tpMin').src = r.result;
      try { localStorage.setItem(LS_KEY[key], r.result); } catch (e) { setStatus('القالب يعمل الآن، لكن حجمه كبير فلن يُحفظ للمرة القادمة.'); }
      changed();
    } catch (e) { setStatus('تعذّر قراءة صورة القالب.'); }
  };
  r.readAsDataURL(file);
}
function resetOverlay(key) {
  try { localStorage.removeItem(LS_KEY[key]); } catch (e) { /* ignore */ }
  ov[key] = defaults[key];
  $(key === 'cover' ? '#tpCover' : '#tpMin').src = DEFAULT_SRC[key];
  changed();
}

/* ---------- preview ---------- */
let timer = 0, token = 0;
function schedule() { clearTimeout(timer); timer = setTimeout(refresh, 40); }
function changed() { ver++; updateShareBtn(); schedule(); schedulePrep(); }

async function refresh() {
  const my = ++token;
  await overlaysReady;
  const it = state.items[state.cur];
  const src = it ? await ensureWork(it) : placeholder();
  if (my !== token) return;
  if (!ov.cover || !ov.minimal) { setStatus('تعذّر تحميل ملفات القالب (cover.png و minimal.png). تأكد أنها مرفوعة في GitHub.'); return; }
  const role = !it || state.cur === state.cover ? 'cover' : 'minimal';
  $('#holder').replaceChildren(renderPhoto(src, role, getOpts(), PREVIEW_SCALE));
  let cap;
  if (state.compare) cap = 'قبل الفلتر (الصورة الأصلية داخل القالب)';
  else if (state.hover) cap = 'معاينة الفلتر: ' + PRESETS[state.hover].name;
  else if (!it) cap = 'معاينة تجريبية';
  else if (role === 'cover') cap = state.coverManual ? 'الغلاف (اخترتَه أنت): يحمل TRAINING الكبير' : 'الغلاف (اختيار تلقائي: الأوضح والأفضل إضاءة): يحمل TRAINING الكبير';
  else cap = 'القالب المينيماليست';
  $('#cap').textContent = cap;
  $('#empty').style.display = it ? 'none' : '';
  $('#setCover').hidden = !(it && state.cur !== state.cover);
  $('#autoCover').hidden = !(it && state.coverManual && state.items.length > 1);
  $('#cmp').hidden = !it;
}

/* ---------- filters UI: categories + live thumbnails ---------- */
function renderCats() {
  const holder = $('#cats');
  for (const [key, label] of Object.entries(CATS)) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip' + (key === state.cat ? ' on' : ''); b.dataset.c = key; b.textContent = label;
    b.addEventListener('click', () => { state.cat = key; $$('.chip').forEach(c => c.classList.toggle('on', c.dataset.c === key)); applyCat(); $('#presets').scrollTo({ left: 0 }); });
    holder.append(b);
  }
}
function applyCat() { $$('.pr').forEach(b => { const c = PRESETS[b.dataset.k].cat; b.hidden = !(state.cat === 'all' || c === 'all' || c === state.cat); }); }
function renderPresetThumbs() {
  const holder = $('#presets');
  const src = state.items[state.cur]?.work || placeholder();
  if (!holder.children.length) {
    for (const [key, p] of Object.entries(PRESETS)) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'pr'; b.dataset.k = key;
      const c = document.createElement('canvas'); c.width = 96; c.height = 120;
      const s = document.createElement('span'); s.textContent = p.name;
      b.append(c, s); holder.append(b);
      b.addEventListener('click', () => { state.hover = null; choosePreset(key); });
      b.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { state.hover = key; schedule(); } });
      b.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && state.hover) { state.hover = null; schedule(); } });
    }
    applyCat();
  }
  for (const b of $$('.pr', holder)) {
    const key = b.dataset.k, c = $('canvas', b), x = c.getContext('2d');
    drawFit(x, src, 96, 120, 'cover');
    grade(x, 96, 120, { ...PRESETS[key], intensity: 1 });
    b.classList.toggle('on', key === state.preset);
  }
}
function choosePreset(key) {
  state.preset = key;
  const p = PRESETS[key];
  ['bri', 'con', 'sat', 'warm'].forEach(id => { $('#' + id).value = 0; });
  $('#intensity').value = 100;
  $('#grain').value = Math.round(p.grain * 100); $('#vig').value = Math.round(p.vig * 100); $('#sharp').value = Math.round(p.sharp * 100);
  syncOutputs(); $$('.pr').forEach(b => b.classList.toggle('on', b.dataset.k === key));
  save(); changed();
}

/* ---------- photos list ---------- */
function renderStrip() {
  const strip = $('#strip'); strip.replaceChildren();
  state.items.forEach((it, i) => {
    const d = document.createElement('div'); d.className = 'th' + (i === state.cur ? ' on' : '');
    const img = document.createElement('img'); img.src = it.url; img.alt = '';
    const x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.title = 'حذف';
    x.addEventListener('click', e => { e.stopPropagation(); removeItem(i); });
    d.append(img, x);
    if (i === state.cover) { const bg = document.createElement('div'); bg.className = 'bg'; bg.textContent = '⭐ غلاف'; d.append(bg); }
    d.addEventListener('click', () => select(i));
    strip.append(d);
  });
  $('#count').textContent = `${state.items.length} صورة`;
  $('#drop').classList.toggle('compact', state.items.length > 0);
  $('.pics').classList.toggle('has', state.items.length > 0);
}
async function select(i) {
  state.cur = i;
  state.items.forEach((it, k) => { if (k !== i) it.work = null; });
  if (state.items[i]) await ensureWork(state.items[i]);
  renderStrip(); renderPresetThumbs(); schedule();
}
function removeItem(i) {
  const [it] = state.items.splice(i, 1); URL.revokeObjectURL(it.url);
  if (!state.items.length) { state.cover = 0; state.coverManual = false; clearResults(); }
  else if (i === state.cover) { state.coverManual = false; state.cover = Math.min(i, state.items.length - 1); pickCover(); }
  else if (i < state.cover) state.cover--;
  select(state.items.length ? Math.min(i, state.items.length - 1) : -1); changed();
}
function addFiles(list) {
  const files = [...list].filter(f => f.type.startsWith('image/'));
  if (!files.length) { setStatus('لم يتم العثور على صور صالحة (صيغة HEIC غير مدعومة في بعض المتصفحات).'); return; }
  const fresh = files.map(f => ({ file: f, url: URL.createObjectURL(f), work: null, score: null }));
  if (!state.items.length) { state.cover = 0; state.coverManual = false; }
  state.items.push(...fresh);
  select(state.cur >= 0 ? state.cur : 0); changed();
  scoreNew(fresh);
}
function clearAll() {
  state.items.forEach(i => URL.revokeObjectURL(i.url)); state.items = []; state.cover = 0; state.coverManual = false;
  clearResults(); select(-1); changed(); setStatus('');
}

/* ---------- status / lock ---------- */
function setStatus(t) { $('#status').textContent = t; }
function lock(on) { state.busy = on; $('#shareAll').disabled = on; $('#export').disabled = on; }
function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

/* ---------- build final images in the background (cover first, then the rest) ---------- */
function clearResults() {
  if (prepared) prepared.files.forEach(f => URL.revokeObjectURL(f.url));
  prepared = null; $('#rgrid').replaceChildren(); $('#results').hidden = true; $('#barFill').style.width = '0'; updateShareBtn();
}
function addCard(f) {
  $('#results').hidden = false;
  const d = document.createElement('div'); d.className = 'rc';
  const im = new Image(); im.src = f.url; im.alt = f.name;
  const lb = document.createElement('div'); lb.className = 'lb'; lb.textContent = f.label;
  const b = document.createElement('button'); b.type = 'button'; b.textContent = 'حفظ';
  b.addEventListener('click', () => download(f.blob, f.name));
  d.append(im, lb, b); $('#rgrid').append(d);
}
function schedulePrep() {
  clearTimeout(prepTimer);
  if (!state.items.length || state.scoring) return;
  prepTimer = setTimeout(() => { ensurePrepared().catch(e => console.error(e)); }, PREP_DELAY);
}
async function buildPrepared(v0) {
  if (prepared) clearResults();
  $('#rgrid').replaceChildren();
  await overlaysReady;
  if (!ov.cover || !ov.minimal) throw new Error('ملفات القالب غير محمّلة');
  const o = getOpts(), q = +$('#quality').value / 100, order = orderedIdx(), files = [];
  state.prepCount++; updateShareBtn();
  try {
    for (let k = 0; k < order.length; k++) {
      if (v0 !== ver) return null;
      const i = order[k], role = i === state.cover ? 'cover' : 'minimal';
      const bmp = await loadBitmap(state.items[i].file);
      const blob = await toBlob(renderPhoto(bmp, role, o, 1), q);
      if (bmp.close) bmp.close();
      if (v0 !== ver) return null;
      const name = `OSN_${pad(k + 1)}${role === 'cover' ? '_cover' : ''}.jpg`;
      const f = { name, blob, url: URL.createObjectURL(blob), label: role === 'cover' ? '⭐ الغلاف' : `صورة ${k + 1}`, file: new File([blob], name, { type: 'image/jpeg' }) };
      files.push(f); addCard(f);
      $('#barFill').style.width = ((k + 1) / order.length * 100) + '%';
      setStatus(`جاري التجهيز ${k + 1} / ${order.length}`);
      await sleep(0);
    }
    prepared = { v: v0, files, batches: null, batch: 0, ready: false };
    setStatus('✓ كل الصور جاهزة، اضغط مشاركة.');
    return prepared;
  } finally { state.prepCount--; updateShareBtn(); }
}
function ensurePrepared() {
  if (prepared && prepared.v === ver) return Promise.resolve(prepared);
  if (prepPromise && prepVer === ver) return prepPromise;
  prepVer = ver;
  const pr = buildPrepared(ver).finally(() => { if (prepPromise === pr) prepPromise = null; });
  prepPromise = pr; return pr;
}
async function getPrepared() {
  for (let n = 0; n < 4; n++) { const p = await ensurePrepared(); if (p && p.v === ver) return p; }
  return null;
}

/* ---------- share (Facebook via the phone's share sheet, no account link) ---------- */
const canShareFiles = files => { try { return !!(navigator.canShare && navigator.canShare({ files })); } catch (e) { return false; } };
function makeBatches(files) {
  let n = files.length;
  while (n >= 1 && !canShareFiles(files.slice(0, n).map(f => f.file))) n = n > SHARE_BATCH ? SHARE_BATCH : n - 1;
  if (n < 1) return null;
  const out = []; for (let s = 0; s < files.length; s += n) out.push(files.slice(s, s + n));
  return out;
}
function updateShareBtn() {
  const b = $('#shareAll'), n = state.items.length, ok = !!(prepared && prepared.v === ver);
  let t;
  if (!n) t = 'مشاركة الكل على فيسبوك';
  else if (ok && prepared.batches && prepared.batches.length > 1) t = `مشاركة الدفعة ${prepared.batch + 1} من ${prepared.batches.length}`;
  else if (ok && prepared.ready) t = `اضغط للمشاركة الآن (${prepared.files.length} صورة)`;
  else if (ok) t = `مشاركة الكل على فيسبوك (${n}) ✓`;
  else if (state.prepCount > 0) t = `مشاركة الكل (${n}) · جاري التجهيز…`;
  else t = `مشاركة الكل على فيسبوك (${n})`;
  b.textContent = t; b.classList.toggle('ready', ok);
}
/* the share sheet must open inside the tap, so when the photos are ready nothing is awaited before navigator.share */
function shareAll() {
  if (state.busy) return;
  if (!state.items.length) { setStatus('اختر صورك أولاً.'); return; }
  if (prepared && prepared.v === ver) { doShare(prepared); return; }
  slowShare();
}
async function slowShare() {
  setStatus('جاري تجهيز الصور…');
  let p;
  try { p = await getPrepared(); } catch (e) { console.error(e); setStatus('حدث خطأ أثناء التجهيز: ' + e.message); return; }
  if (!p) { setStatus('تغيّرت الإعدادات أثناء التجهيز. اضغط الزر مرة أخرى.'); return; }
  doShare(p);
}
async function doShare(p) {
  if (!p.batches) p.batches = makeBatches(p.files);
  if (!p.batches) { setStatus('المشاركة المباشرة غير مدعومة في هذا المتصفح. افتح التطبيق من الهاتف (Chrome أو Safari) أو استخدم زر ZIP.'); updateShareBtn(); return; }
  updateShareBtn();
  const files = p.batches[p.batch].map(f => f.file);
  try {
    await navigator.share({ files });
    p.batch++;
    if (p.batch >= p.batches.length) { p.batch = 0; p.ready = false; setStatus('تمت مشاركة كل الصور.'); }
    else setStatus(`تمت الدفعة ${p.batch} من ${p.batches.length}. اضغط الزر لمشاركة الدفعة التالية.`);
  } catch (e) {
    if (e && e.name === 'AbortError') setStatus('أُلغيت المشاركة.');
    else if (e && e.name === 'NotAllowedError') { p.ready = true; setStatus('الصور جاهزة. اضغط الزر مرة أخرى للمشاركة.'); }
    else setStatus('تعذّرت المشاركة: ' + (e && e.message ? e.message : e));
  }
  updateShareBtn();
}

/* ---------- ZIP ---------- */
async function exportZip() {
  if (state.busy) return;
  if (!state.items.length) { setStatus('اختر صورك أولاً.'); return; }
  lock(true);
  try {
    setStatus('جاري تجهيز الصور…');
    const p = await getPrepared();
    if (!p) { setStatus('تغيّرت الإعدادات أثناء التجهيز. اضغط الزر مرة أخرى.'); return; }
    if (typeof JSZip === 'undefined') { for (const f of p.files) { download(f.blob, f.name); await sleep(400); } }
    else {
      let part = 1;
      for (let s = 0; s < p.files.length; s += ZIP_PART) {
        const zip = new JSZip(); p.files.slice(s, s + ZIP_PART).forEach(f => zip.file(f.name, f.blob));
        setStatus('جاري إنشاء ملف ZIP…');
        download(await zip.generateAsync({ type: 'blob', compression: 'STORE' }), `OSN_photos_${pad(part++)}.zip`);
        await sleep(500);
      }
    }
    setStatus(`تم! ${p.files.length} صورة.`);
  } catch (e) { console.error(e); setStatus('حدث خطأ: ' + e.message); }
  finally { lock(false); }
}

/* ---------- persistence ---------- */
const SAVE = ['fit', 'intensity', 'bri', 'con', 'sat', 'warm', 'grain', 'vig', 'sharp', 'quality'];
function save() {
  const d = {}; SAVE.forEach(id => { d[id] = $('#' + id).value; }); d.preset = state.preset;
  try { localStorage.setItem('osn-studio-v2', JSON.stringify(d)); } catch (e) { /* ignore */ }
}
function restore() {
  try {
    const d = JSON.parse(localStorage.getItem('osn-studio-v2') || 'null');
    if (!d) return;
    SAVE.forEach(id => { if (id in d) $('#' + id).value = d[id]; });
    if (d.preset && PRESETS[d.preset]) state.preset = d.preset;
  } catch (e) { /* ignore */ }
}
function syncOutputs() { $$('.rng').forEach(l => { const r = $('input', l), o = $('output', l); if (o) o.textContent = r.value; }); }

/* ---------- install as an app (PWA: Android + iOS) ---------- */
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function initInstall() {
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch(() => { /* ignore */ });
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) setStatus('تم تحديث التطبيق. أغلقه وافتحه من جديد لتفعيل التحديث.'); });
  }
  const btn = $('#installBtn'), hint = $('#iosHint');
  if (isStandalone()) { btn.hidden = true; return; }
  btn.hidden = false;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });
  window.addEventListener('appinstalled', () => { btn.hidden = true; deferredInstall = null; setStatus('تم تثبيت التطبيق.'); });
  btn.addEventListener('click', async () => {
    if (deferredInstall) { deferredInstall.prompt(); try { await deferredInstall.userChoice; } catch (e) { /* ignore */ } deferredInstall = null; return; }
    hint.textContent = isIOS()
      ? 'في آيفون (Safari): اضغط زر المشاركة ⬆︎ في أسفل الشاشة ثم اختر «إضافة إلى الشاشة الرئيسية».'
      : 'من قائمة المتصفح ⋮ اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».';
    hint.hidden = !hint.hidden;
  });
}

/* ---------- wiring ---------- */
function init() {
  restore(); syncOutputs();
  $('#files').addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => addFiles(e.dataTransfer.files));
  $('#clear').addEventListener('click', clearAll);
  $('#resClear').addEventListener('click', clearResults);

  SAVE.forEach(id => $('#' + id).addEventListener('input', () => { syncOutputs(); save(); if (id !== 'quality') changed(); else { ver++; updateShareBtn(); schedulePrep(); } }));

  const pick = (inp, key) => $(inp).addEventListener('change', e => { const f = e.target.files[0]; if (f) setCustomOverlay(key, f); });
  pick('#coverFile', 'cover'); pick('#minFile', 'minimal');
  $('#coverClear').addEventListener('click', () => { $('#coverFile').value = ''; resetOverlay('cover'); });
  $('#minClear').addEventListener('click', () => { $('#minFile').value = ''; resetOverlay('minimal'); });

  $('#setCover').addEventListener('click', () => { state.cover = state.cur; state.coverManual = true; renderStrip(); changed(); });
  $('#autoCover').addEventListener('click', () => { state.coverManual = false; pickCover(); });
  const cmp = $('#cmp'), setCmp = on => { if (state.compare !== on) { state.compare = on; schedule(); } };
  cmp.addEventListener('pointerdown', e => { e.preventDefault(); setCmp(true); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => cmp.addEventListener(ev, () => setCmp(false)));
  cmp.addEventListener('contextmenu', e => e.preventDefault());
  $('#shareAll').addEventListener('click', shareAll);
  $('#export').addEventListener('click', exportZip);

  initInstall();
  renderCats(); renderPresetThumbs(); updateShareBtn(); schedule();
}
init();
})();
