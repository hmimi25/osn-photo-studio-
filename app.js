(() => {
'use strict';

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const smooth = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };
const setLS = (ctx, px) => { if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px'; };
const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); };

const INK = '#0b0b0b';
const FORMATS = { '4:5': [1080, 1350], '1:1': [1080, 1080], '9:16': [1080, 1920] };
const FONTS = { 'Anton': 400, 'Big Shoulders Display': 900, 'Bebas Neue': 400, 'Russo One': 400 };
const PREVIEW_SCALE = 0.45;
const ZIP_PART = 40;

/* ---------- cinematic presets ---------- */
const N = { bright: 1, contrast: 1, sat: 1, shadow: [0, 0, 0], hi: [0, 0, 0], fade: 0, grain: 0, vig: 0, warm: 0 };
const P = (name, o) => ({ ...N, name, ...o });
const PRESETS = {
  none:     P('بدون فلتر', {}),
  cinema:   P('Teal & Orange', { contrast: 1.15, sat: 1.12, shadow: [-.03, .05, .08], hi: [.08, .03, -.07], fade: .02, grain: .25, vig: .35 }),
  osn:      P('OSN أزرق', { contrast: 1.15, sat: 1.05, shadow: [-.03, .03, .09], hi: [0, .05, .08], grain: .2, vig: .35 }),
  golden:   P('الساعة الذهبية', { bright: 1.03, contrast: 1.1, sat: 1.08, shadow: [.03, .01, -.02], hi: [.09, .04, -.05], fade: .02, grain: .15, vig: .3 }),
  noir:     P('أبيض وأسود نوار', { bright: .98, contrast: 1.3, sat: 0, fade: .03, grain: .35, vig: .5 }),
  cold:     P('فولاذ بارد', { contrast: 1.15, sat: .85, shadow: [-.02, 0, .06], hi: [-.02, .02, .05], grain: .2, vig: .3 }),
  matte:    P('مات فيلم', { contrast: 1.05, sat: .9, shadow: [.01, .02, .03], hi: [.04, .02, 0], fade: .09, grain: .25, vig: .2 }),
  kodak:    P('كوداك قديم', { sat: 1.05, shadow: [.02, .03, -.01], hi: [.08, .05, -.02], fade: .06, grain: .4, vig: .3 }),
  stadium:  P('ليل الملعب', { bright: .92, contrast: 1.25, sat: 1.15, shadow: [-.01, 0, .06], hi: [.03, .04, .08], grain: .2, vig: .5 }),
  bleach:   P('Bleach Bypass', { contrast: 1.35, sat: .55, grain: .3, vig: .35 }),
  electric: P('أصفر كهربائي', { contrast: 1.2, sat: 1.1, shadow: [0, 0, .03], hi: [.09, .08, -.06], grain: .15, vig: .3 })
};

/* ---------- state ---------- */
const state = { items: [], cur: -1, preset: 'cinema', accent: '#38b6f0', logoImg: null, logoData: null, customCover: null, customPage2: null, results: [], busy: false };
let defaultLogo = null;
let placeholderCv = null;
let thumbSrc = null;

/* ---------- options ---------- */
function getFilter() {
  const p = PRESETS[state.preset];
  return {
    ...p,
    intensity: +$('#intensity').value / 100,
    bright: p.bright * (1 + +$('#bri').value / 100),
    contrast: p.contrast * (1 + +$('#con').value / 100),
    sat: p.sat * (1 + +$('#sat').value / 100),
    warm: +$('#warm').value / 100,
    grain: +$('#grain').value / 100,
    vig: +$('#vig').value / 100,
    bars: $('#bars').checked
  };
}
function getOpts() {
  return {
    title: $('#title').value.trim() || 'TRAINING',
    sub: $('#sub').value.trim(),
    cat: $('#cat').value.trim(),
    club: $('#club').value.trim() || 'OSN',
    motto: $('#showMotto').checked ? $('#motto').value.trim() : '',
    font: $('#font').value,
    format: $('#format').value,
    fit: $('#fit').value,
    accent: state.accent,
    logo: state.logoImg,
    customCover: state.customCover,
    customPage2: state.customPage2,
    filter: getFilter()
  };
}
const selectedPages = () => [
  $('#pgCover').checked && 'cover',
  $('#pgMin').checked && 'minimal',
  $('#pgPhoto').checked && 'photo'
].filter(Boolean);

/* ---------- image loading ---------- */
async function loadBitmap(file) {
  try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* fallback */ }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally { setTimeout(() => URL.revokeObjectURL(url), 8000); }
}
async function ensureWork(it) {
  if (it.work) return it.work;
  const bmp = await loadBitmap(it.file);
  const s = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  const x = c.getContext('2d');
  x.imageSmoothingQuality = 'high';
  x.drawImage(bmp, 0, 0, c.width, c.height);
  if (bmp.close) bmp.close();
  it.work = c;
  return c;
}
function placeholder() {
  if (placeholderCv) return placeholderCv;
  const c = document.createElement('canvas'); c.width = 1400; c.height = 1000;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 1400, 1000);
  g.addColorStop(0, '#1c3b52'); g.addColorStop(.55, '#6b8a9c'); g.addColorStop(1, '#d9a35b');
  x.fillStyle = g; x.fillRect(0, 0, 1400, 1000);
  x.fillStyle = 'rgba(0,0,0,.35)';
  x.beginPath(); x.arc(700, 470, 150, 0, 7); x.fill();
  x.fillRect(560, 600, 280, 400);
  return (placeholderCv = c);
}

/* ---------- grading ---------- */
function grade(ctx, w, h, f) {
  if (!(f.intensity > 0) && !f.grain && !f.vig) return;
  const id = ctx.getImageData(0, 0, w, h), d = id.data;
  const k = f.intensity, [sr, sg, sb] = f.shadow, [hr, hg, hb] = f.hi;
  const amp = f.grain * 0.16, vg = f.vig, fade = f.fade, warm = f.warm * 0.06;
  const cx = w / 2, cy = h / 2, inv = 1 / Math.hypot(cx, cy);
  for (let y = 0; y < h; y++) {
    const dy2 = (y - cy) * (y - cy);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const or = d[i] / 255, og = d[i + 1] / 255, ob = d[i + 2] / 255;
      let r = or * f.bright, g = og * f.bright, b = ob * f.bright;
      r = (r - .5) * f.contrast + .5; g = (g - .5) * f.contrast + .5; b = (b - .5) * f.contrast + .5;
      const l = .2126 * r + .7152 * g + .0722 * b;
      r = l + (r - l) * f.sat; g = l + (g - l) * f.sat; b = l + (b - l) * f.sat;
      const sh = 1 - smooth(0, .6, l), hi = smooth(.4, 1, l);
      r += sr * sh + hr * hi + warm; g += sg * sh + hg * hi; b += sb * sh + hb * hi - warm;
      if (fade) { r = fade + r * (1 - fade); g = fade + g * (1 - fade); b = fade + b * (1 - fade); }
      r = or + (r - or) * k; g = og + (g - og) * k; b = ob + (b - ob) * k;
      if (vg) {
        const dx = x - cx, dd = Math.sqrt(dx * dx + dy2) * inv;
        const v = 1 - vg * smooth(.35, 1, dd) * .85;
        r *= v; g *= v; b *= v;
      }
      if (amp) {
        const n = (Math.random() - .5) * 2 * amp * (1 - Math.abs(l - .5) * 1.1);
        r += n; g += n; b += n;
      }
      d[i] = r * 255; d[i + 1] = g * 255; d[i + 2] = b * 255;
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

function drawPhotoWindow(ctx, src, x, y, w, h, o, scale, pathFn) {
  const pw = Math.max(1, Math.round(w * scale)), ph = Math.max(1, Math.round(h * scale));
  const off = document.createElement('canvas'); off.width = pw; off.height = ph;
  const oc = off.getContext('2d'); oc.imageSmoothingQuality = 'high';
  drawFit(oc, src, pw, ph, o.fit);
  grade(oc, pw, ph, o.filter);
  if (o.filter.bars) {
    const bh = Math.max(0, (ph - pw / 2.39) / 2);
    oc.fillStyle = '#000'; oc.fillRect(0, 0, pw, bh); oc.fillRect(0, ph - bh, pw, bh);
  }
  ctx.save();
  if (pathFn) { ctx.beginPath(); pathFn(ctx); ctx.clip(); }
  ctx.drawImage(off, x, y, w, h);
  ctx.restore();
}

/* ---------- template pieces ---------- */
function drawLogo(ctx, o, x, y, size) {
  if (o.logo) {
    const iw = o.logo.naturalWidth || o.logo.width, ih = o.logo.naturalHeight || o.logo.height;
    const s = Math.min(size / iw, size / ih), dw = iw * s, dh = ih * s;
    ctx.drawImage(o.logo, x + (size - dw) / 2, y + (size - dh) / 2, dw, dh);
    return;
  }
  ctx.save();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = o.accent; ctx.font = `400 ${size * .34}px "Anton", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; setLS(ctx, 0);
  ctx.fillText('OSN', x + size / 2, y + size / 2 + size * .02);
  ctx.restore();
}
const titleFont = (o, s) => `${FONTS[o.font]} ${s}px "${o.font}", Impact, sans-serif`;
function fitTitle(ctx, o, maxW, maxSize) {
  ctx.font = titleFont(o, 100); setLS(ctx, 1.5);
  const tw = ctx.measureText(o.title).width || 1;
  return Math.min(100 * maxW / tw, maxSize);
}

function pageCover(ctx, W, H, src, o, scale) {
  const m = W * .055;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);

  // header
  const lg = W * .075, hy = m * .8;
  drawLogo(ctx, o, m, hy, lg);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = INK;
  ctx.font = `700 ${W * .027}px "Barlow Condensed", sans-serif`; setLS(ctx, W * .004);
  ctx.fillText(o.club.toUpperCase(), m + lg + W * .02, hy + lg / 2);
  if (o.cat) {
    ctx.font = `700 ${W * .03}px "Barlow Condensed", sans-serif`; setLS(ctx, W * .003);
    const tw = ctx.measureText(o.cat).width, pw = tw + W * .05, ph = lg * .62;
    const px = W - m - pw, py = hy + lg / 2 - ph / 2;
    ctx.fillStyle = INK; rr(ctx, px, py, pw, ph, ph / 2); ctx.fill();
    ctx.fillStyle = o.accent; ctx.textAlign = 'center';
    ctx.fillText(o.cat, px + pw / 2 + W * .0015, py + ph / 2 + 1);
  }

  // geometry (title decides how tall the photo window can be)
  const wx = m, ww = W - 2 * m, wy = hy + lg + W * .03;
  const s = fitTitle(ctx, o, ww, H * .22);
  ctx.font = titleFont(o, s); setLS(ctx, s * .015);
  const cap = ctx.measureText(o.title).actualBoundingBoxAscent || s * .72;
  const rowY = H - m * .9;
  const baseline = rowY - W * .03;
  const wh = Math.max(H * .3, baseline - cap * .82 - wy);

  // photo window with cut corner
  const cut = W * .11;
  const path = c => { c.moveTo(wx, wy); c.lineTo(wx + ww - cut, wy); c.lineTo(wx + ww, wy + cut); c.lineTo(wx + ww, wy + wh); c.lineTo(wx, wy + wh); c.closePath(); };
  drawPhotoWindow(ctx, src, wx, wy, ww, wh, o, scale, path);
  ctx.fillStyle = o.accent;
  ctx.beginPath(); ctx.moveTo(wx + ww - cut, wy); ctx.lineTo(wx + ww, wy); ctx.lineTo(wx + ww, wy + cut); ctx.closePath(); ctx.fill();
  ctx.fillRect(wx, wy - W * .008, W * .1, W * .008);

  // big title
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.font = titleFont(o, s); setLS(ctx, s * .015);
  ctx.fillStyle = o.accent; ctx.fillText(o.title, wx + W * .012, baseline + W * .012);
  ctx.lineJoin = 'round'; ctx.lineWidth = W * .008; ctx.strokeStyle = '#fff'; ctx.strokeText(o.title, wx, baseline);
  ctx.fillStyle = INK; ctx.fillText(o.title, wx, baseline);

  // bottom row
  ctx.textBaseline = 'middle';
  ctx.fillStyle = o.accent; ctx.fillRect(wx, rowY - W * .012, W * .024, W * .024);
  ctx.fillStyle = INK; ctx.font = `700 ${W * .027}px "Barlow Condensed", sans-serif`; setLS(ctx, W * .004);
  ctx.fillText(o.sub.toUpperCase(), wx + W * .04, rowY);
  if (o.motto) {
    ctx.textAlign = 'right'; setLS(ctx, 0);
    ctx.font = `700 ${W * .034}px "Cairo", sans-serif`;
    ctx.fillText(o.motto, W - m, rowY - W * .004);
  }
}

function pageMinimal(ctx, W, H, src, o, scale) {
  const m = W * .07;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);

  // top row
  const topY = m * .75;
  ctx.textBaseline = 'middle'; ctx.fillStyle = INK;
  ctx.font = `700 ${W * .024}px "Barlow Condensed", sans-serif`; setLS(ctx, W * .005);
  ctx.textAlign = 'left'; ctx.fillText(o.club.toUpperCase(), m, topY);
  ctx.textAlign = 'right'; ctx.fillText(o.cat.toUpperCase(), W - m, topY);
  const ly = topY + W * .032;
  ctx.fillStyle = INK; ctx.fillRect(m, ly, W - 2 * m, 1.5);
  ctx.fillStyle = o.accent; ctx.fillRect(m, ly - 1.5, W * .1, 4.5);

  // geometry
  const ww = W - 2 * m * 1.35, wx = (W - ww) / 2;
  const reserved = m * .8 + W * .14 + W * .06 + W * .03;
  const top = ly + W * .045, avail = H - top - reserved;
  const wh = Math.min(avail, ww * 1.6);
  const wy = top + (avail - wh) / 2;
  const gap = W * .014;

  drawPhotoWindow(ctx, src, wx, wy, ww, wh, o, scale, c => c.rect(wx, wy, ww, wh));

  // frame + corner ticks
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
  ctx.strokeRect(wx - gap, wy - gap, ww + 2 * gap, wh + 2 * gap);
  ctx.strokeStyle = o.accent; ctx.lineWidth = W * .006; ctx.lineCap = 'butt';
  const L = W * .045, fx = wx - gap, fy = wy - gap, fw = ww + 2 * gap, fh = wh + 2 * gap;
  const tick = (x, y, dx, dy) => { ctx.beginPath(); ctx.moveTo(x + dx * L, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * L); ctx.stroke(); };
  tick(fx, fy, 1, 1); tick(fx + fw, fy, -1, 1); tick(fx, fy + fh, 1, -1); tick(fx + fw, fy + fh, -1, -1);

  // row under frame
  const r1 = fy + fh + W * .035;
  ctx.textBaseline = 'middle'; ctx.fillStyle = INK;
  ctx.font = `700 ${W * .024}px "Barlow Condensed", sans-serif`; setLS(ctx, W * .004);
  ctx.textAlign = 'left'; ctx.fillText(o.sub.toUpperCase(), wx, r1);
  if (o.motto) {
    ctx.textAlign = 'right'; setLS(ctx, 0);
    ctx.font = `700 ${W * .03}px "Cairo", sans-serif`;
    ctx.fillText(o.motto, wx + ww, r1 - W * .004);
  }

  // bottom block
  const base = H - m * .8;
  const s = Math.min(W * .075, fitTitle(ctx, o, W * .6, W * .075));
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.fillStyle = INK;
  ctx.font = titleFont(o, s); setLS(ctx, s * .015);
  ctx.fillText(o.title, wx, base - W * .014);
  ctx.fillStyle = o.accent; ctx.fillRect(wx, base - W * .002, W * .09, W * .006);
  const lg = W * .08;
  drawLogo(ctx, o, wx + ww - lg, base - lg, lg);
}

function overlayFor(page, o) { return page === 'cover' ? o.customCover : page === 'minimal' ? o.customPage2 : null; }
function renderPage(src, page, o, scale) {
  const ov = overlayFor(page, o);
  let [W, H] = FORMATS[o.format];
  if (ov) { W = 1080; H = Math.round(1080 * (ov.naturalHeight || ov.height) / (ov.naturalWidth || ov.width)); }
  const cv = document.createElement('canvas');
  cv.width = Math.round(W * scale); cv.height = Math.round(H * scale);
  const ctx = cv.getContext('2d');
  ctx.scale(cv.width / W, cv.height / H);
  ctx.imageSmoothingQuality = 'high';
  if (ov) { drawPhotoWindow(ctx, src, 0, 0, W, H, o, scale, null); ctx.drawImage(ov, 0, 0, W, H); }
  else if (page === 'cover') pageCover(ctx, W, H, src, o, scale);
  else if (page === 'minimal') pageMinimal(ctx, W, H, src, o, scale);
  else drawPhotoWindow(ctx, src, 0, 0, W, H, o, scale, null);
  return cv;
}

/* ---------- fonts ---------- */
const fontsReady = (async () => {
  try {
    const jobs = Object.entries(FONTS).map(([f, w]) => document.fonts.load(`${w} 100px "${f}"`, 'TRAINING'));
    jobs.push(document.fonts.load('700 20px "Barlow Condensed"', 'OSN'));
    jobs.push(document.fonts.load('700 20px "Cairo"', 'نربي قبل ما نعلم'));
    await Promise.all(jobs);
  } catch (e) { /* offline: fallback fonts */ }
})();

/* ---------- preview ---------- */
let timer = 0, token = 0, ver = 0, prepared = null;
function schedule() { ver++; clearTimeout(timer); timer = setTimeout(refresh, 60); }

async function refresh() {
  const my = ++token;
  await fontsReady;
  const it = state.items[state.cur];
  const src = it ? await ensureWork(it) : placeholder();
  if (my !== token) return;
  const o = getOpts();
  const map = { cover: '#sheetCover', minimal: '#sheetMin', photo: '#sheetPhoto' };
  const sel = selectedPages();
  for (const [page, id] of Object.entries(map)) {
    const sheet = $(id);
    sheet.style.display = sel.includes(page) ? '' : 'none';
    if (sel.includes(page)) $('.holder', sheet).replaceChildren(renderPage(src, page, o, PREVIEW_SCALE));
  }
  $('#empty').style.display = it ? 'none' : '';
}

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
      b.addEventListener('click', () => choosePreset(key));
    }
  }
  for (const b of $$('.pr', holder)) {
    const key = b.dataset.k, c = $('canvas', b), x = c.getContext('2d');
    drawFit(x, src, 96, 120, 'cover');
    grade(x, 96, 120, { ...PRESETS[key], intensity: 1, bars: false });
    b.classList.toggle('on', key === state.preset);
  }
}

function choosePreset(key) {
  state.preset = key;
  const p = PRESETS[key];
  $('#intensity').value = 100; $('#bri').value = 0; $('#con').value = 0; $('#sat').value = 0; $('#warm').value = 0;
  $('#grain').value = Math.round(p.grain * 100); $('#vig').value = Math.round(p.vig * 100);
  syncOutputs(); $$('.pr').forEach(b => b.classList.toggle('on', b.dataset.k === key));
  save(); schedule();
}

/* ---------- photos list ---------- */
function updateCount() { $('#count').textContent = `${state.items.length} صورة`; }

function renderStrip() {
  const strip = $('#strip'); strip.replaceChildren();
  state.items.forEach((it, i) => {
    const d = document.createElement('div'); d.className = 'th' + (i === state.cur ? ' on' : '');
    const img = document.createElement('img'); img.src = it.url; img.alt = '';
    const x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.title = 'حذف';
    x.addEventListener('click', e => { e.stopPropagation(); removeItem(i); });
    d.append(img, x); d.addEventListener('click', () => select(i)); strip.append(d);
  });
  updateCount();
}

async function select(i) {
  state.cur = i;
  state.items.forEach((it, k) => { if (k !== i) it.work = null; });
  if (state.items[i]) await ensureWork(state.items[i]);
  renderStrip(); renderPresetThumbs(); schedule();
}

function removeItem(i) {
  const [it] = state.items.splice(i, 1); URL.revokeObjectURL(it.url);
  select(state.items.length ? Math.min(i, state.items.length - 1) : -1);
}

function addFiles(list) {
  const files = [...list].filter(f => f.type.startsWith('image/'));
  if (!files.length) { setStatus('لم يتم العثور على صور صالحة (صيغة HEIC غير مدعومة في بعض المتصفحات).'); return; }
  for (const f of files) state.items.push({ file: f, url: URL.createObjectURL(f), work: null });
  select(state.cur >= 0 ? state.cur : 0);
}

/* ---------- export ---------- */
function setStatus(t) { $('#status').textContent = t; }
function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}
const toBlob = (cv, q) => new Promise(r => cv.toBlob(r, 'image/jpeg', q));
const pad = (n, l = 3) => String(n).padStart(l, '0');

async function exportAll() {
  if (state.busy) return;
  if (!state.items.length) { setStatus('اختر صورًا أولاً.'); return; }
  const pages = selectedPages();
  if (!pages.length) { setStatus('اختر صفحة واحدة على الأقل (غلاف / مينيماليست / صورة فقط).'); return; }
  state.busy = true; $('#export').disabled = true;
  await fontsReady;
  const o = getOpts(), q = +$('#quality').value / 100;
  const useZip = typeof JSZip !== 'undefined';
  const total = state.items.length * pages.length;
  let done = 0, part = 1, zip = useZip ? new JSZip() : null, inZip = 0;

  const flush = async () => {
    if (!zip || !inZip) return;
    setStatus('جاري إنشاء ملف ZIP…');
    const blob = await zip.generateAsync({ type: 'blob' });
    download(blob, `OSN_photos_${pad(part, 2)}.zip`);
    part++; zip = new JSZip(); inZip = 0; await sleep(500);
  };

  try {
    for (let i = 0; i < state.items.length; i++) {
      const it = state.items[i];
      const base = it.file.name.replace(/\.[^.]+$/, '').replace(/[^\w\u0600-\u06FF-]+/g, '_').slice(0, 40);
      const bmp = await loadBitmap(it.file);
      for (const page of pages) {
        const cv = renderPage(bmp, page, o, 1);
        const blob = await toBlob(cv, q);
        const name = `${pad(i + 1)}_${base}_${page}.jpg`;
        if (useZip) { zip.file(name, blob); inZip++; if (inZip >= ZIP_PART) await flush(); }
        else { download(blob, name); await sleep(250); }
        done++;
        $('#barFill').style.width = (done / total * 100) + '%';
        setStatus(`${done} / ${total}`);
        await sleep(0);
      }
      if (bmp.close) bmp.close();
    }
    await flush();
    setStatus(`تم! ${total} صورة جاهزة.`);
  } catch (e) {
    console.error(e); setStatus('حدث خطأ أثناء التصدير: ' + e.message);
  } finally {
    state.busy = false; $('#export').disabled = false;
  }
}

/* ---------- custom overlays ---------- */
function setOverlay(key, dataUrl) {
  const prop = key === 'cover' ? 'customCover' : 'customPage2';
  const lsk = key === 'cover' ? 'osn-cover' : 'osn-page2';
  if (!dataUrl) { state[prop] = null; try { localStorage.removeItem(lsk); } catch (e) { /* ignore */ } schedule(); return; }
  const img = new Image();
  img.onload = () => {
    state[prop] = img;
    try { localStorage.setItem(lsk, dataUrl); } catch (e) { setStatus('الغلاف يعمل الآن، لكن حجمه كبير فلن يُحفظ للمرة القادمة.'); }
    schedule();
  };
  img.onerror = () => setStatus('تعذّر قراءة صورة الغلاف.');
  img.src = dataUrl;
}

/* ---------- share + results gallery ---------- */
const safeBase = it => it.file.name.replace(/\.[^.]+$/, '').replace(/[^\w\u0600-\u06FF-]+/g, '_').slice(0, 40) || 'photo';
const toFile = (blob, name) => new File([blob], name, { type: 'image/jpeg' });
const canShareFiles = files => { try { return !!(navigator.canShare && navigator.canShare({ files })); } catch (e) { return false; } };
const lockUI = on => { state.busy = on; ['#shareCur', '#prepAll', '#export'].forEach(s => { $(s).disabled = on; }); };

async function shareFiles(files) {
  if (!canShareFiles(files)) {
    setStatus('المشاركة المباشرة غير مدعومة في هذا المتصفح. افتح التطبيق من الهاتف (Chrome أو Safari) أو استخدم الحفظ.');
    return false;
  }
  try { await navigator.share({ files }); return true; }
  catch (e) { if (e && e.name === 'AbortError') return false; throw e; }
}
function reportShareError(e) {
  if (e && e.name === 'NotAllowedError') setStatus('الصور جاهزة. اضغط الزر مرة أخرى للمشاركة.');
  else setStatus('تعذّرت المشاركة: ' + (e && e.message ? e.message : e));
}

async function shareCurrent() {
  if (state.busy) return;
  const it = state.items[state.cur];
  if (!it) { setStatus('اختر صورة أولاً.'); return; }
  const pages = selectedPages();
  if (!pages.length) { setStatus('اختر صفحة واحدة على الأقل.'); return; }
  let files;
  if (prepared && prepared.v === ver && prepared.i === state.cur) files = prepared.files;
  else {
    lockUI(true); setStatus('جاري تجهيز الصور…');
    try {
      await fontsReady;
      const o = getOpts(), q = +$('#quality').value / 100, bmp = await loadBitmap(it.file), base = safeBase(it);
      files = [];
      for (const page of pages) files.push(toFile(await toBlob(renderPage(bmp, page, o, 1), q), `${base}_${page}.jpg`));
      if (bmp.close) bmp.close();
      prepared = { v: ver, i: state.cur, files };
    } catch (e) { console.error(e); setStatus('حدث خطأ أثناء التجهيز: ' + e.message); lockUI(false); return; }
    lockUI(false);
  }
  try { const ok = await shareFiles(files); if (ok) setStatus('تمت المشاركة.'); }
  catch (e) { reportShareError(e); }
}

function clearResults() {
  state.results.forEach(g => g.files.forEach(f => URL.revokeObjectURL(f.url)));
  state.results = []; $('#rgrid').replaceChildren(); $('#results').hidden = true;
}

function addGroupCard(g) {
  $('#results').hidden = false;
  const d = document.createElement('div'); d.className = 'rc';
  const imgs = document.createElement('div'); imgs.className = 'rimgs';
  g.files.forEach(f => { const im = new Image(); im.src = f.url; im.alt = f.name; imgs.append(im); });
  const row = document.createElement('div'); row.className = 'rb';
  const sh = document.createElement('button'); sh.type = 'button'; sh.className = 'sh'; sh.textContent = g.files.length > 1 ? 'مشاركة الكل' : 'مشاركة';
  sh.addEventListener('click', async () => {
    try { const ok = await shareFiles(g.files.map(f => toFile(f.blob, f.name))); if (ok) setStatus('تمت المشاركة.'); }
    catch (e) { reportShareError(e); }
  });
  const sv = document.createElement('button'); sv.type = 'button'; sv.className = 'sv'; sv.textContent = 'حفظ';
  sv.addEventListener('click', async () => { for (const f of g.files) { download(f.blob, f.name); await sleep(400); } });
  row.append(sh, sv); d.append(imgs, row); $('#rgrid').append(d);
}

async function prepareAll() {
  if (state.busy) return;
  if (!state.items.length) { setStatus('اختر صورًا أولاً.'); return; }
  const pages = selectedPages();
  if (!pages.length) { setStatus('اختر صفحة واحدة على الأقل.'); return; }
  lockUI(true); clearResults();
  const total = state.items.length * pages.length; let done = 0;
  try {
    await fontsReady;
    const o = getOpts(), q = +$('#quality').value / 100;
    for (let i = 0; i < state.items.length; i++) {
      const it = state.items[i], base = safeBase(it), bmp = await loadBitmap(it.file), g = { files: [] };
      for (const page of pages) {
        const blob = await toBlob(renderPage(bmp, page, o, 1), q);
        g.files.push({ name: `${String(i + 1).padStart(3, '0')}_${base}_${page}.jpg`, blob, url: URL.createObjectURL(blob) });
        done++; $('#barFill').style.width = (done / total * 100) + '%'; setStatus(`${done} / ${total}`);
        await sleep(0);
      }
      if (bmp.close) bmp.close();
      state.results.push(g); addGroupCard(g);
    }
    setStatus(`جاهزة: ${total} صورة. اضغط «مشاركة» تحت أي صورة في المعرض.`);
    $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) { console.error(e); setStatus('حدث خطأ أثناء التجهيز: ' + e.message); }
  finally { lockUI(false); }
}

/* ---------- persistence ---------- */
const SAVE = ['title', 'sub', 'cat', 'club', 'motto', 'showMotto', 'font', 'format', 'fit', 'pgCover', 'pgMin', 'pgPhoto',
  'intensity', 'bri', 'con', 'sat', 'warm', 'grain', 'vig', 'bars', 'quality'];
function save() {
  const d = {};
  SAVE.forEach(id => { const e = $('#' + id); d[id] = e.type === 'checkbox' ? e.checked : e.value; });
  d.accent = state.accent; d.preset = state.preset;
  try { localStorage.setItem('osn-studio', JSON.stringify(d)); } catch (e) { /* ignore */ }
}
function restore() {
  try {
    const d = JSON.parse(localStorage.getItem('osn-studio') || 'null');
    if (d) {
      SAVE.forEach(id => { if (id in d) { const e = $('#' + id); if (e.type === 'checkbox') e.checked = d[id]; else e.value = d[id]; } });
      if (d.accent) state.accent = d.accent;
      if (d.preset && PRESETS[d.preset]) state.preset = d.preset;
    }
    const logo = localStorage.getItem('osn-logo');
    if (logo) setLogo(logo); else useDefaultLogo();
    const c1 = localStorage.getItem('osn-cover'); if (c1) setOverlay('cover', c1);
    const c2 = localStorage.getItem('osn-page2'); if (c2) setOverlay('page2', c2);
  } catch (e) { /* ignore */ }
}
function useDefaultLogo() {
  if (!window.OSN_LOGO) { state.logoImg = null; schedule(); return; }
  if (defaultLogo) { state.logoImg = defaultLogo; schedule(); return; }
  const img = new Image();
  img.onload = () => { defaultLogo = img; state.logoImg = img; schedule(); };
  img.src = window.OSN_LOGO;
}
function setLogo(dataUrl) {
  if (!dataUrl) { state.logoData = null; try { localStorage.removeItem('osn-logo'); } catch (e) { /* ignore */ } useDefaultLogo(); return; }
  const img = new Image();
  img.onload = () => { state.logoImg = img; state.logoData = dataUrl; try { localStorage.setItem('osn-logo', dataUrl); } catch (e) { /* ignore */ } schedule(); };
  img.src = dataUrl;
}

/* ---------- UI wiring ---------- */
function syncOutputs() { $$('.rng').forEach(l => { const r = $('input', l), o = $('output', l); if (o) o.textContent = r.value; }); }
function syncAccentUI() {
  $('#accentPick').value = state.accent;
  $$('.sw button').forEach(b => b.classList.toggle('on', b.dataset.c.toLowerCase() === state.accent.toLowerCase()));
}

function init() {
  restore();
  if (!state.logoImg && !localStorage.getItem('osn-logo')) useDefaultLogo();
  syncOutputs(); syncAccentUI();

  $('#files').addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => addFiles(e.dataTransfer.files));
  $('#clear').addEventListener('click', () => { state.items.forEach(i => URL.revokeObjectURL(i.url)); state.items = []; select(-1); });

  $$('.panel input:not([type=file]), .panel select').forEach(el => {
    el.addEventListener('input', () => { syncOutputs(); save(); schedule(); });
  });
  $$('.sw button').forEach(b => b.addEventListener('click', () => { state.accent = b.dataset.c; syncAccentUI(); save(); schedule(); }));
  $('#accentPick').addEventListener('input', e => { state.accent = e.target.value; syncAccentUI(); save(); schedule(); });

  $('#logoFile').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => setLogo(r.result); r.readAsDataURL(f);
  });
  $('#logoClear').addEventListener('click', () => { $('#logoFile').value = ''; setLogo(null); });

  $('#export').addEventListener('click', exportAll);
  $('#shareCur').addEventListener('click', shareCurrent);
  $('#prepAll').addEventListener('click', prepareAll);
  $('#resClear').addEventListener('click', clearResults);
  const readTo = (id, key) => $(id).addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => setOverlay(key, r.result); r.readAsDataURL(f);
  });
  readTo('#coverFile', 'cover'); readTo('#page2File', 'page2');
  $('#coverClear').addEventListener('click', () => { $('#coverFile').value = ''; setOverlay('cover', null); });
  $('#page2Clear').addEventListener('click', () => { $('#page2File').value = ''; setOverlay('page2', null); });

  renderPresetThumbs();
  updateCount();
  fontsReady.then(schedule);
  schedule();
}

init();
})();
