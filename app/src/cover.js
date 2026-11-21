// Palm Neon cover renderer — draws the multi-panel GTA-style poster cover.
// Pure canvas, no network, no external assets. Used by the editor (live preview),
// by the PNG exporter (exact post sizes) and by the ?shot=cover scene.
'use strict';

// ---------------------------------------------------------------- grades

export const GRADES = {
  sunset: { name: 'Sunset', sky: ['#2b1055', '#7597de', '#ff9a5a', '#ffd76a'], sun: '#fff3b0', tint: 'rgba(255,122,60,0.20)', deep: '#ff7a3c' },
  neon: { name: 'Neon', sky: ['#12002e', '#3b0a6e', '#ff2e88', '#00e5ff'], sun: '#ffe9f6', tint: 'rgba(255,46,136,0.18)', deep: '#00e5ff' },
  heat: { name: 'Heatwave', sky: ['#3d0c02', '#a83208', '#ff6a00', '#ffc93c'], sun: '#fff8d6', tint: 'rgba(255,106,0,0.22)', deep: '#ff5e00' },
  palm: { name: 'Palm', sky: ['#062b2a', '#0e6b5c', '#37c978', '#d8f79a'], sun: '#f4ffe0', tint: 'rgba(55,201,120,0.16)', deep: '#1fae6b' },
  vice: { name: 'Vice', sky: ['#1a0033', '#5b2a86', '#c94bff', '#ff9de2'], sun: '#ffe9fb', tint: 'rgba(201,75,255,0.20)', deep: '#b44dff' },
};

export const GRADE_ORDER = ['sunset', 'neon', 'heat', 'palm', 'vice'];

// ---------------------------------------------------------------- layouts

// Panel rects in a 100 x 74 zone (title band takes the bottom 26). Each panel:
// [x, y, w, h, tiltDeg, tag] — tag is the cast label drawn on the panel.
export const LAYOUTS = {
  seven: {
    name: 'Seven Panel',
    panels: [
      { x: 0, y: 0, w: 30, h: 24, tilt: 0, tag: 0 },
      { x: 0, y: 25, w: 30, h: 24, tilt: 0, tag: 1 },
      { x: 0, y: 50, w: 30, h: 24, tilt: 0, tag: 2 },
      { x: 31, y: 0, w: 38, h: 74, tilt: 0, tag: 3, hero: true },
      { x: 70, y: 0, w: 30, h: 24, tilt: 0, tag: 1 },
      { x: 70, y: 25, w: 30, h: 24, tilt: 0, tag: 2 },
      { x: 70, y: 50, w: 30, h: 24, tilt: 0, tag: 0 },
    ],
  },
  six: {
    name: 'Hero Six',
    panels: [
      { x: 0, y: 0, w: 55, h: 74, tilt: 0, tag: 3, hero: true },
      { x: 56, y: 0, w: 44, h: 24, tilt: 0, tag: 0 },
      { x: 56, y: 25, w: 21, h: 24, tilt: 0, tag: 1 },
      { x: 78, y: 25, w: 22, h: 24, tilt: 0, tag: 2 },
      { x: 56, y: 50, w: 21, h: 24, tilt: 0, tag: 2 },
      { x: 78, y: 50, w: 22, h: 24, tilt: 0, tag: 1 },
    ],
  },
  tilt: {
    name: 'Tilted Snaps',
    panels: [
      { x: 4, y: 4, w: 34, h: 44, tilt: -4, tag: 0 },
      { x: 33, y: 0, w: 34, h: 74, tilt: 0, tag: 3, hero: true },
      { x: 62, y: 4, w: 34, h: 44, tilt: 4, tag: 1 },
      { x: 10, y: 50, w: 26, h: 24, tilt: -2, tag: 2 },
      { x: 64, y: 50, w: 26, h: 24, tilt: 2, tag: 2 },
    ],
  },
};

export const LAYOUT_ORDER = ['seven', 'six', 'tilt'];

// ---------------------------------------------------------------- helpers

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// ---------------------------------------------------------------- face-aware crop

// Finds the skin-tone cluster of a photo and returns its centre in 0..1 photo
// coordinates. Falls back to the upper-middle of the frame when no skin shows,
// so a face (or the subject) stays inside every panel crop.
export function detectFaceAnchor(source) {
  const probe = document.createElement('canvas');
  probe.width = 64; probe.height = 64;
  const pctx = probe.getContext('2d');
  pctx.drawImage(source, 0, 0, 64, 64);
  let data;
  try { data = pctx.getImageData(0, 0, 64, 64).data; } catch (e) { return { x: 0.5, y: 0.35 }; }
  let sx = 0, sy = 0, sw = 0, minX = 64, maxX = 0, minY = 64, maxY = 0;
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const skin = r > 90 && g > 40 && b > 20 && r > g + 12 && r > b + 20 && (r - Math.min(g, b)) > 18 && (Math.max(r, g, b) - Math.min(r, g, b)) > 15;
      if (!skin) continue;
      const w = 1 + (r - g) / 120;
      sx += x * w; sy += y * w; sw += w;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (sw < 24) return { x: 0.5, y: 0.35 };
  const cx = sx / sw / 64, cy = sy / sw / 64;
  const spread = (maxX - minX + maxY - minY) / 128;
  if (spread > 0.55) return { x: 0.5, y: 0.35 }; // skin everywhere: not a face
  return { x: Math.min(0.85, Math.max(0.15, cx)), y: Math.min(0.8, Math.max(0.15, cy)) };
}

// Draws img cover-fit into rect, anchored on the photo's face point, with a
// per-panel zoom and pan. The face point maps to the panel centre by default.
export function drawCoverFit(ctx, img, fx, fy, x, y, w, h, zoom, dx, dy) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  if (!iw || !ih || w <= 0 || h <= 0) return;
  const scale = Math.max(w / iw, h / ih) * (zoom || 1);
  const dw = iw * scale, dh = ih * scale;
  const ax = fx * dw, ay = fy * dh; // face point in drawn-image space
  const cx = x + w / 2 + (dx || 0) * w;
  const cy = y + h / 2 + (dy || 0) * h;
  ctx.drawImage(img, cx - ax, cy - ay, dw, dh);
}

// ---------------------------------------------------------------- background

function drawSunsetBackdrop(ctx, W, H, grade, seed) {
  const g = GRADES[grade] || GRADES.sunset;
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.78);
  sky.addColorStop(0, g.sky[0]); sky.addColorStop(0.45, g.sky[1]);
  sky.addColorStop(0.8, g.sky[2]); sky.addColorStop(1, g.sky[3]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  // Sun with halo.
  const sunX = W * 0.68, sunY = H * 0.42, sunR = W * 0.085;
  const halo = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 3.2);
  halo.addColorStop(0, g.sun); halo.addColorStop(0.25, g.sky[3] + 'aa'); halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = g.sun;
  ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2); ctx.fill();
  // Retro sun slats.
  ctx.save();
  ctx.fillStyle = g.sky[0];
  for (let i = 0; i < 5; i++) {
    const sy = sunY + sunR * (0.15 + i * 0.18);
    ctx.fillRect(sunX - sunR - 2, sy, sunR * 2 + 4, Math.max(2, sunR * 0.05 * (i + 1)));
  }
  ctx.restore();
  // Skyline silhouette.
  const rnd = mulberry32(seed);
  ctx.fillStyle = '#160a2e';
  let bx = -W * 0.02;
  while (bx < W * 1.02) {
    const bw = W * (0.04 + rnd() * 0.05);
    const bh = H * (0.06 + rnd() * 0.13);
    ctx.fillRect(bx, H * 0.78 - bh, bw, bh);
    // Lit windows.
    ctx.fillStyle = 'rgba(255,214,106,0.85)';
    for (let wy = H * 0.78 - bh + 6; wy < H * 0.78 - 8; wy += 12) {
      for (let wx = bx + 5; wx < bx + bw - 6; wx += 11) {
        if (rnd() > 0.62) ctx.fillRect(wx, wy, 4, 5);
      }
    }
    ctx.fillStyle = '#160a2e';
    bx += bw + W * 0.008;
  }
  // Sea / road band.
  const sea = ctx.createLinearGradient(0, H * 0.78, 0, H);
  sea.addColorStop(0, g.sky[2]); sea.addColorStop(1, '#12041f');
  ctx.fillStyle = sea; ctx.fillRect(0, H * 0.78, W, H * 0.22);
  // Palm silhouettes left and right.
  drawPalm(ctx, W * 0.03, H * 0.8, H * 0.30, -0.25, '#0d0518');
  drawPalm(ctx, W * 0.97, H * 0.82, H * 0.26, 0.3, '#0d0518');
}

function drawPalm(ctx, x, y, size, lean, color) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(lean);
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = Math.max(3, size * 0.035);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(size * 0.06, -size * 0.5, size * 0.02, -size); ctx.stroke();
  const topX = size * 0.02, topY = -size;
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * (0.08 + i * 0.14);
    const len = size * (0.42 - Math.abs(i - 3) * 0.03);
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(topX + Math.cos(a) * len * 0.6, topY + Math.sin(a) * len * 0.6 - size * 0.08, topX + Math.cos(a) * len, topY + Math.sin(a) * len + size * 0.12);
    ctx.quadraticCurveTo(topX + Math.cos(a) * len * 0.55, topY + Math.sin(a) * len * 0.55 + size * 0.05, topX, topY);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- title & chrome

function chromeGradient(ctx, y0, y1) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0.0, '#ffffff');
  g.addColorStop(0.22, '#ffe9a8');
  g.addColorStop(0.38, '#ff9de2');
  g.addColorStop(0.52, '#ff5e7a');
  g.addColorStop(0.66, '#7ad9ff');
  g.addColorStop(0.82, '#ffffff');
  g.addColorStop(1.0, '#ffd76a');
  return g;
}

function drawChromeTitle(ctx, text, cx, y, size, maxW) {
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  let fontSize = size;
  ctx.font = `900 ${fontSize}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  try { ctx.letterSpacing = `${Math.max(1, fontSize * 0.02)}px`; } catch (e) { /* older canvas */ }
  while (ctx.measureText(text).width > maxW && fontSize > 20) {
    fontSize *= 0.94;
    ctx.font = `900 ${fontSize}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  }
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = fontSize * 0.12; ctx.shadowOffsetY = fontSize * 0.05;
  ctx.strokeStyle = '#14041f'; ctx.lineWidth = Math.max(4, fontSize * 0.09);
  ctx.strokeText(text, cx, y);
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.fillStyle = chromeGradient(ctx, y - fontSize, y + fontSize * 0.08);
  ctx.fillText(text, cx, y);
  // Chrome shine stripe.
  ctx.globalAlpha = 0.35; ctx.fillStyle = '#ffffff';
  ctx.fillRect(cx - maxW / 2, y - fontSize * 0.62, maxW, Math.max(2, fontSize * 0.05));
  ctx.globalAlpha = 1;
  ctx.restore();
  return fontSize;
}

function drawSeal(ctx, cx, cy, r, text) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = '#ffd76a';
  ctx.strokeStyle = '#14041f'; ctx.lineWidth = Math.max(2, r * 0.06);
  ctx.beginPath();
  const spikes = 12;
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.8;
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#14041f';
  ctx.font = `900 ${Math.max(9, r * 0.24)}px Arial, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const words = String(text || 'EST. 2026').split(' ');
  words.forEach((w, i) => ctx.fillText(w, 0, (i - (words.length - 1) / 2) * r * 0.3));
  ctx.restore();
}

// ---------------------------------------------------------------- panels

function drawPanelPhoto(ctx, photo, panel, rect, state) {
  if (!photo || !photo.img) return false;
  ctx.save();
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, Math.max(2, rect.w * 0.02));
  ctx.clip();
  drawCoverFit(ctx, photo.img, photo.anchor.x, photo.anchor.y, rect.x, rect.y, rect.w, rect.h, photo.zoom, photo.dx, photo.dy);
  // Grade wash over the photo.
  const g = GRADES[state.grade] || GRADES.sunset;
  ctx.fillStyle = g.tint; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalCompositeOperation = 'overlay';
  const wash = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  wash.addColorStop(0, 'rgba(255,120,80,0.16)'); wash.addColorStop(1, 'rgba(40,10,90,0.22)');
  ctx.fillStyle = wash; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
  return true;
}

function drawPanelFrame(ctx, rect, tilt, selected) {
  ctx.save();
  ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
  ctx.rotate((tilt || 0) * Math.PI / 180);
  ctx.translate(-rect.w / 2, -rect.h / 2);
  ctx.strokeStyle = selected ? '#ffd76a' : 'rgba(255,255,255,0.92)';
  ctx.lineWidth = Math.max(2, rect.w * 0.012);
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = Math.max(6, rect.w * 0.04); ctx.shadowOffsetY = Math.max(3, rect.w * 0.015);
  roundRectPath(ctx, 0, 0, rect.w, rect.h, Math.max(2, rect.w * 0.02));
  ctx.stroke();
  ctx.restore();
}

function drawPanelTag(ctx, rect, cast, tilt) {
  if (!cast) return;
  ctx.save();
  ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
  ctx.rotate((tilt || 0) * Math.PI / 180);
  ctx.translate(-rect.w / 2, -rect.h / 2);
  const pad = Math.max(4, rect.w * 0.03);
  const fs = Math.max(9, rect.w * 0.055);
  ctx.font = `900 ${fs}px Arial, sans-serif`;
  const nameW = ctx.measureText(cast.name).width;
  ctx.font = `700 ${fs * 0.72}px Arial, sans-serif`;
  const roleW = ctx.measureText(cast.role).width;
  const tagW = Math.max(nameW, roleW) + pad * 2;
  const tagH = fs * 2.1;
  const tx = pad, ty = rect.h - tagH - pad;
  ctx.fillStyle = 'rgba(10,2,20,0.82)';
  roundRectPath(ctx, tx, ty, tagW, tagH, tagH / 2); ctx.fill();
  ctx.fillStyle = '#ffd76a';
  ctx.font = `900 ${fs}px Arial, sans-serif`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(cast.name, tx + pad, ty + tagH * 0.30);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${fs * 0.72}px Arial, sans-serif`;
  ctx.fillText(cast.role, tx + pad, ty + tagH * 0.74);
  ctx.restore();
}

// Hero pop-out: the hero photo re-drawn as an arched cut-out that rises above
// its frame, white keyline, hard shadow — the poster's cut-out figure.
function drawHeroPopout(ctx, photo, rect, state) {
  if (!photo || !photo.img) return;
  const rise = rect.h * 0.10;
  const top = rect.y - rise;
  const w = rect.w, h = rect.h + rise;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = w * 0.06; ctx.shadowOffsetY = h * 0.02;
  ctx.beginPath();
  ctx.moveTo(rect.x, rect.y + h);
  ctx.lineTo(rect.x, top + w * 0.28);
  ctx.quadraticCurveTo(rect.x + w / 2, top - w * 0.16, rect.x + w, top + w * 0.28);
  ctx.lineTo(rect.x + w, rect.y + h);
  ctx.closePath();
  ctx.clip();
  drawCoverFit(ctx, photo.img, photo.anchor.x, photo.anchor.y, rect.x, top, w, h, photo.zoom, photo.dx, photo.dy);
  const g = GRADES[state.grade] || GRADES.sunset;
  ctx.fillStyle = g.tint; ctx.fillRect(rect.x, top, w, h);
  ctx.restore();
  // Keyline around the arch, with a hard drop shadow.
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = Math.max(6, w * 0.05); ctx.shadowOffsetY = Math.max(3, h * 0.015);
  ctx.beginPath();
  ctx.moveTo(rect.x, rect.y + h);
  ctx.lineTo(rect.x, top + w * 0.28);
  ctx.quadraticCurveTo(rect.x + w / 2, top - w * 0.16, rect.x + w, top + w * 0.28);
  ctx.lineTo(rect.x + w, rect.y + h);
  ctx.closePath();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(3, w * 0.014);
  ctx.lineJoin = 'round'; ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- the cover

// state: { layout, grade, title, subtitle, tagline, cast[{name,role}], seal,
//   stars, photos[{img,anchor,zoom,dx,dy}], panelPhoto[number per panel],
//   selectedPanel }
export function drawCover(ctx, W, H, state) {
  const grade = state.grade || 'sunset';
  const layout = LAYOUTS[state.layout] || LAYOUTS.seven;
  // The panel zone starts 6% down so the hero pop-out arch (which rises
  // ~5% above its frame) never clips at the canvas top edge.
  const zoneY = H * 0.06;
  const zoneH = H * 0.68;
  drawSunsetBackdrop(ctx, W, H, grade, 7);
  // Panels (hero last, on top).
  const heroIdx = layout.panels.findIndex((p) => p.hero);
  layout.panels.forEach((p, i) => {
    const rect = { x: (p.x / 100) * W, y: zoneY + (p.y / 100) * zoneH, w: (p.w / 100) * W, h: (p.h / 100) * zoneH };
    if (p.hero) return;
    const photo = state.photos[state.panelPhoto[i] ?? 0];
    ctx.save();
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.rotate((p.tilt || 0) * Math.PI / 180);
    ctx.translate(-rect.w / 2, -rect.h / 2);
    const inner = { x: 0, y: 0, w: rect.w, h: rect.h };
    if (!drawPanelPhoto(ctx, photo, p, inner, state)) {
      ctx.fillStyle = '#241338';
      roundRectPath(ctx, 0, 0, rect.w, rect.h, Math.max(2, rect.w * 0.02)); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = `700 ${Math.max(10, rect.w * 0.06)}px Arial, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('ADD PHOTO', rect.w / 2, rect.h / 2);
    }
    ctx.restore();
    drawPanelFrame(ctx, rect, p.tilt, state.selectedPanel === i);
    const cast = state.cast[p.tag % state.cast.length];
    drawPanelTag(ctx, rect, cast, p.tilt);
  });
  // Hero pop-out on top.
  if (heroIdx >= 0) {
    const p = layout.panels[heroIdx];
    const rect = { x: (p.x / 100) * W, y: zoneY + (p.y / 100) * zoneH, w: (p.w / 100) * W, h: (p.h / 100) * zoneH };
    const photo = state.photos[state.panelPhoto[heroIdx] ?? 0];
    ctx.save();
    ctx.fillStyle = '#241338';
    roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, Math.max(2, rect.w * 0.02)); ctx.fill();
    ctx.restore();
    drawHeroPopout(ctx, photo, rect, state);
    if (!photo || !photo.img) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = `700 ${Math.max(12, rect.w * 0.06)}px Arial, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('ADD PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.restore();
    }
    const cast = state.cast[p.tag % state.cast.length];
    drawPanelTag(ctx, rect, cast, 0);
  }
  // Title band.
  const bandY = H * 0.74;
  const bandGrad = ctx.createLinearGradient(0, bandY, 0, H);
  bandGrad.addColorStop(0, 'rgba(12,2,24,0.0)');
  bandGrad.addColorStop(0.18, 'rgba(12,2,24,0.88)');
  bandGrad.addColorStop(1, 'rgba(12,2,24,0.96)');
  ctx.fillStyle = bandGrad; ctx.fillRect(0, bandY, W, H - bandY);
  // Neon rule lines.
  ctx.fillStyle = '#ff2e88'; ctx.fillRect(W * 0.06, bandY + H * 0.012, W * 0.88, Math.max(2, H * 0.003));
  ctx.fillStyle = '#00e5ff'; ctx.fillRect(W * 0.06, bandY + H * 0.02, W * 0.88, Math.max(1, H * 0.0015));
  const titleSize = H * 0.105;
  const titleY = bandY + H * 0.135;
  drawChromeTitle(ctx, (state.title || 'PALM NEON').toUpperCase(), W / 2, titleY, titleSize, W * 0.86);
  // Subtitle script + tagline.
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff9de2';
  ctx.font = `italic 700 ${Math.max(13, H * 0.028)}px Georgia, serif`;
  ctx.fillText(state.subtitle || 'Sunset Coast', W / 2, titleY + H * 0.045);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `700 ${Math.max(10, H * 0.016)}px Arial, sans-serif`;
  try { ctx.letterSpacing = `${Math.max(1, H * 0.004)}px`; } catch (e) { /* noop */ }
  ctx.fillText((state.tagline || 'EVERY SUNSET HAS A PRICE').toUpperCase(), W / 2, titleY + H * 0.078);
  ctx.restore();
  // Heat meter stars.
  const starY = H * 0.965;
  const starR = Math.max(6, H * 0.011);
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const stars = Math.max(1, Math.min(5, state.stars || 5));
  const totalW = stars * starR * 2.6;
  for (let i = 0; i < 5; i++) {
    const sx = W / 2 - totalW / 2 + i * starR * 2.6 + starR;
    ctx.fillStyle = i < stars ? '#ffd76a' : 'rgba(255,255,255,0.25)';
    drawStar(ctx, sx, starY, starR);
  }
  ctx.restore();
  // Seal badge, bottom-right.
  drawSeal(ctx, W * 0.9, H * 0.93, Math.max(18, H * 0.038), state.seal || 'EST. 2026');
  // Grain + vignette.
  addGrain(ctx, W, H, 20261121);
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(8,0,16,0.42)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}

function drawStar(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill();
}

function addGrain(ctx, W, H, seed) {
  const rnd = mulberry32(seed);
  ctx.save();
  ctx.globalAlpha = 0.05;
  const n = Math.floor((W * H) / 9000);
  for (let i = 0; i < n; i++) {
    const v = rnd() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(rnd() * W, rnd() * H, 1.4, 1.4);
  }
  ctx.restore();
}

// Panel hit-test in cover space: returns the panel index at (x, y) in a
// W x H cover, or -1. Used by the editor to select a panel by clicking.
export function panelAt(state, W, H, x, y) {
  const layout = LAYOUTS[state.layout] || LAYOUTS.seven;
  const zoneY = H * 0.06;
  const zoneH = H * 0.68;
  for (let i = layout.panels.length - 1; i >= 0; i--) {
    const p = layout.panels[i];
    const rx = (p.x / 100) * W, ry = zoneY + (p.y / 100) * zoneH, rw = (p.w / 100) * W, rh = (p.h / 100) * zoneH;
    if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) return i;
  }
  return -1;
}

// ---------------------------------------------------------------- sample scenes

// Illustrated sample photos drawn by the app itself (flat vector scenes, no
// real person, no game artwork). They give the editor something to load and
// the screenshots a photo to show, fully offline.
export function drawSampleScene(kind, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  if (kind === 'neon') {
    sky.addColorStop(0, '#160a33'); sky.addColorStop(0.55, '#3b0a6e'); sky.addColorStop(1, '#ff2e88');
  } else if (kind === 'rooftop') {
    sky.addColorStop(0, '#1a1033'); sky.addColorStop(0.55, '#7a3cff'); sky.addColorStop(1, '#ff9a5a');
  } else {
    sky.addColorStop(0, '#2b1055'); sky.addColorStop(0.5, '#c94b7a'); sky.addColorStop(1, '#ffd76a');
  }
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  // Sun.
  ctx.fillStyle = kind === 'neon' ? '#ffe9f6' : '#fff3b0';
  ctx.beginPath(); ctx.arc(w * 0.72, h * 0.34, w * 0.11, 0, Math.PI * 2); ctx.fill();
  if (kind === 'boulevard') {
    // Road + convertible + illustrated driver.
    ctx.fillStyle = '#241338'; ctx.fillRect(0, h * 0.72, w, h * 0.28);
    ctx.fillStyle = '#3a1c5c';
    for (let i = 0; i < 5; i++) ctx.fillRect(0, h * (0.76 + i * 0.05), w, 3);
    drawConvertible(ctx, w, h);
    drawIllustratedPerson(ctx, w * 0.42, h * 0.52, h * 0.34, { skin: '#e8b48c', hair: '#2a1a12', shirt: '#f5f0e6', shades: true, hoops: true });
    drawPalm(ctx, w * 0.06, h * 0.74, h * 0.4, -0.2, '#12041f');
    drawPalm(ctx, w * 0.94, h * 0.74, h * 0.34, 0.25, '#12041f');
  } else if (kind === 'rooftop') {
    // Skyline + illustrated man.
    ctx.fillStyle = '#160a2e';
    let bx = 0;
    const rnd = mulberry32(42);
    while (bx < w) {
      const bw = w * (0.08 + rnd() * 0.08), bh = h * (0.2 + rnd() * 0.3);
      ctx.fillRect(bx, h * 0.78 - bh, bw, bh);
      bx += bw + 4;
    }
    ctx.fillStyle = '#2c1445'; ctx.fillRect(0, h * 0.78, w, h * 0.22);
    drawIllustratedPerson(ctx, w * 0.5, h * 0.55, h * 0.42, { skin: '#c98d5f', hair: '#14100c', shirt: '#ff7a3c', beard: true, chain: true });
    drawPalm(ctx, w * 0.08, h * 0.8, h * 0.3, -0.15, '#0d0518');
  } else {
    // Neon street: signs, wet pavement, two friends.
    ctx.fillStyle = '#1c0b33';
    ctx.fillRect(0, 0, w * 0.3, h * 0.62);
    ctx.fillRect(w * 0.7, 0, w * 0.3, h * 0.55);
    neonSign(ctx, w * 0.15, h * 0.2, w * 0.2, h * 0.09, 'DINER', '#ff2e88');
    neonSign(ctx, w * 0.82, h * 0.16, w * 0.14, h * 0.07, 'OPEN', '#00e5ff');
    ctx.fillStyle = '#241640'; ctx.fillRect(0, h * 0.62, w, h * 0.38);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#ff2e88'; ctx.fillRect(w * 0.1, h * 0.66, w * 0.22, h * 0.05);
    ctx.fillStyle = '#00e5ff'; ctx.fillRect(w * 0.68, h * 0.7, w * 0.2, h * 0.04);
    ctx.globalAlpha = 1;
    drawIllustratedPerson(ctx, w * 0.38, h * 0.5, h * 0.36, { skin: '#e8b48c', hair: '#3a2418', shirt: '#ffd76a', laugh: true });
    drawIllustratedPerson(ctx, w * 0.62, h * 0.52, h * 0.34, { skin: '#8a5a34', hair: '#0e0a08', shirt: '#00e5ff', laugh: true });
  }
  return c;
}

function neonSign(ctx, x, y, w, h, text, color) {
  ctx.save();
  ctx.shadowColor = color; ctx.shadowBlur = 18;
  ctx.strokeStyle = color; ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.font = `900 ${Math.max(10, h * 0.5)}px Arial, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2 + 1);
  ctx.restore();
}

function drawConvertible(ctx, w, h) {
  ctx.save();
  ctx.translate(w * 0.5, h * 0.78);
  ctx.fillStyle = '#c22e3d';
  ctx.beginPath();
  ctx.moveTo(-w * 0.34, 0);
  ctx.lineTo(-w * 0.30, -h * 0.09);
  ctx.quadraticCurveTo(0, -h * 0.13, w * 0.32, -h * 0.08);
  ctx.lineTo(w * 0.36, 0);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#7d1a24';
  ctx.fillRect(-w * 0.34, -h * 0.015, w * 0.7, h * 0.02);
  ctx.fillStyle = '#12041f';
  ctx.beginPath(); ctx.arc(-w * 0.2, h * 0.005, w * 0.045, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w * 0.22, h * 0.005, w * 0.045, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8e8e8';
  ctx.beginPath(); ctx.arc(-w * 0.2, h * 0.005, w * 0.02, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w * 0.22, h * 0.005, w * 0.02, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// A flat-illustration person: head, hair, sunglasses optional, shirt, arms.
// Clearly drawn art, never a photograph of a real person.
function drawIllustratedPerson(ctx, cx, cy, size, opt) {
  const s = size;
  ctx.save();
  ctx.translate(cx, cy);
  // Shoulders / shirt.
  ctx.fillStyle = opt.shirt || '#f5f0e6';
  ctx.beginPath();
  ctx.moveTo(-s * 0.30, s * 0.5);
  ctx.quadraticCurveTo(-s * 0.32, s * 0.02, -s * 0.14, -s * 0.02);
  ctx.lineTo(s * 0.14, -s * 0.02);
  ctx.quadraticCurveTo(s * 0.32, s * 0.02, s * 0.30, s * 0.5);
  ctx.closePath(); ctx.fill();
  // Neck + head.
  ctx.fillStyle = opt.skin || '#e8b48c';
  ctx.fillRect(-s * 0.05, -s * 0.10, s * 0.10, s * 0.12);
  ctx.beginPath(); ctx.arc(0, -s * 0.24, s * 0.17, 0, Math.PI * 2); ctx.fill();
  // Hair.
  ctx.fillStyle = opt.hair || '#2a1a12';
  ctx.beginPath();
  ctx.arc(0, -s * 0.28, s * 0.175, Math.PI, Math.PI * 2);
  ctx.quadraticCurveTo(s * 0.18, -s * 0.10, s * 0.14, -s * 0.16);
  ctx.lineTo(-s * 0.14, -s * 0.16);
  ctx.quadraticCurveTo(-s * 0.18, -s * 0.10, -s * 0.175, -s * 0.28);
  ctx.closePath(); ctx.fill();
  // Beard.
  if (opt.beard) {
    ctx.fillStyle = opt.hair;
    ctx.beginPath();
    ctx.arc(0, -s * 0.18, s * 0.16, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.quadraticCurveTo(0, -s * 0.02, s * 0.155, -s * 0.18);
    ctx.closePath(); ctx.fill();
  }
  // Sunglasses or smile.
  if (opt.shades) {
    ctx.fillStyle = '#12041f';
    roundRectPath(ctx, -s * 0.14, -s * 0.30, s * 0.11, s * 0.07, s * 0.02); ctx.fill();
    roundRectPath(ctx, s * 0.03, -s * 0.30, s * 0.11, s * 0.07, s * 0.02); ctx.fill();
    ctx.fillRect(-s * 0.03, -s * 0.28, s * 0.06, s * 0.015);
  } else if (opt.laugh) {
    ctx.fillStyle = '#12041f';
    ctx.beginPath(); ctx.arc(-s * 0.07, -s * 0.26, s * 0.012, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.07, -s * 0.26, s * 0.012, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#12041f'; ctx.lineWidth = s * 0.012;
    ctx.beginPath(); ctx.arc(0, -s * 0.20, s * 0.06, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  } else {
    ctx.fillStyle = '#12041f';
    ctx.beginPath(); ctx.arc(-s * 0.07, -s * 0.26, s * 0.012, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.07, -s * 0.26, s * 0.012, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#12041f'; ctx.lineWidth = s * 0.012;
    ctx.beginPath(); ctx.arc(0, -s * 0.17, s * 0.05, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
  }
  // Gold hoops.
  if (opt.hoops) {
    ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = s * 0.014;
    ctx.beginPath(); ctx.arc(-s * 0.17, -s * 0.14, s * 0.035, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(s * 0.17, -s * 0.14, s * 0.035, 0, Math.PI * 2); ctx.stroke();
  }
  // Gold chain.
  if (opt.chain) {
    ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = s * 0.02;
    ctx.beginPath(); ctx.arc(0, -s * 0.02, s * 0.16, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
  }
  ctx.restore();
}
