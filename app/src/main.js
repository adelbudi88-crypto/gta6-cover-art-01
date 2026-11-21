// Palm Neon — editor wiring: photos, panels, lettering, export.
// Photos are read on this machine only (FileReader / canvas) and never leave it.
import { GRADES, GRADE_ORDER, LAYOUTS, LAYOUT_ORDER, detectFaceAnchor, drawCover, drawSampleScene, panelAt } from './cover.js';

const $ = (id) => document.getElementById(id);
const PREVIEW_W = 900;
const SAMPLE_KINDS = ['boulevard', 'rooftop', 'neon'];
const SAMPLE_NAMES = ['Boulevard', 'Rooftop', 'Neon Street'];

const state = {
  layout: 'seven',
  grade: 'sunset',
  title: 'PALM NEON',
  subtitle: 'Sunset Coast',
  tagline: 'Every sunset has a price',
  seal: 'EST. 2026',
  stars: 5,
  cast: [
    { name: 'LUCIA', role: 'THE DRIVER' },
    { name: 'MARCUS', role: 'THE FIXER' },
    { name: 'DANA', role: 'THE ROOKIE' },
    { name: 'BIG TONY', role: 'THE BOSS' },
  ],
  photos: [], // { img, name, anchor:{x,y}, zoom, dx, dy }
  panelPhoto: [0, 1, 2, 0, 1, 2, 0],
  selectedPanel: 3,
};

let previewCanvas, previewCtx, exportSize = '1080x1080';
let dragPhoto = null; // { panel, x0, y0, dx0, dy0 }
let redrawQueued = false;

function queueRedraw() {
  if (redrawQueued) return;
  redrawQueued = true;
  requestAnimationFrame(() => { redrawQueued = false; drawPreview(); });
}

function previewDims() {
  if (exportSize === '1080x1350') return { w: 720, h: 900 };
  if (exportSize === '1920x1080') return { w: 960, h: 540 };
  return { w: 800, h: 800 };
}

function drawPreview() {
  if (!previewCanvas) return;
  const d = previewDims();
  previewCanvas.width = d.w; previewCanvas.height = d.h;
  drawCover(previewCtx, d.w, d.h, state);
  updatePhotoStrip();
  updateInspector();
}

function addPhoto(img, name) {
  const photo = { img, name, anchor: { x: 0.5, y: 0.35 }, zoom: 1, dx: 0, dy: 0 };
  try { photo.anchor = detectFaceAnchor(img); } catch (e) { /* keep fallback */ }
  state.photos.push(photo);
  if (state.photos.length > 6) state.photos.shift();
  return photo;
}

function loadSamples() {
  if (state.photos.length >= 3 && state.photos.every((p) => p.sample)) return;
  SAMPLE_KINDS.forEach((kind, i) => {
    const scene = drawSampleScene(kind, 900, 900);
    const photo = addPhoto(scene, SAMPLE_NAMES[i] + ' (illustrated)');
    photo.sample = true;
    photo.anchor = kind === 'boulevard' ? { x: 0.42, y: 0.42 } : kind === 'rooftop' ? { x: 0.5, y: 0.42 } : { x: 0.5, y: 0.42 };
  });
  // Spread the three scenes across the panels.
  state.panelPhoto = [0, 1, 2, 0, 1, 2, 0];
  queueRedraw();
}

// ---------------------------------------------------------------- photo strip

function updatePhotoStrip() {
  const strip = $('photoStrip');
  if (!strip) return;
  strip.innerHTML = '';
  state.photos.forEach((photo, i) => {
    const btn = document.createElement('button');
    btn.className = 'thumb' + (state.panelPhoto[state.selectedPanel] === i ? ' active' : '');
    btn.title = photo.name + ' — click to put in the selected panel';
    const tc = document.createElement('canvas');
    tc.width = 96; tc.height = 96;
    const tctx = tc.getContext('2d');
    tctx.drawImage(photo.img, 0, 0, 96, 96);
    btn.appendChild(tc);
    const label = document.createElement('span');
    label.textContent = photo.name;
    btn.appendChild(label);
    btn.addEventListener('click', () => {
      state.panelPhoto[state.selectedPanel] = i;
      queueRedraw();
    });
    strip.appendChild(btn);
  });
  const hint = $('photoHint');
  if (hint) hint.textContent = state.photos.length === 0
    ? 'No photo yet — load the samples or drop in your own.'
    : `${state.photos.length} photo${state.photos.length > 1 ? 's' : ''} loaded · click a panel, then a photo to place it. Face-aware crop keeps faces in frame.`;
}

// ---------------------------------------------------------------- inspector

function updateInspector() {
  const layout = LAYOUTS[state.layout];
  const p = layout.panels[state.selectedPanel];
  const name = $('panelName');
  if (name) name.textContent = p ? (p.hero ? `Panel ${state.selectedPanel + 1} — HERO (pop-out)` : `Panel ${state.selectedPanel + 1}`) : 'No panel';
  const photo = state.photos[state.panelPhoto[state.selectedPanel] ?? 0];
  const zoom = $('zoomRange'), dx = $('dxRange'), dy = $('dyRange');
  if (zoom) { zoom.value = photo ? photo.zoom : 1; }
  if (dx) { dx.value = photo ? photo.dx : 0; }
  if (dy) { dy.value = photo ? photo.dy : 0; }
  const zv = $('zoomVal'); if (zv) zv.textContent = photo ? `${Math.round(photo.zoom * 100)}%` : '—';
}

function bindInspector() {
  $('zoomRange').addEventListener('input', (e) => {
    const photo = state.photos[state.panelPhoto[state.selectedPanel] ?? 0];
    if (photo) { photo.zoom = parseFloat(e.target.value); queueRedraw(); }
  });
  $('dxRange').addEventListener('input', (e) => {
    const photo = state.photos[state.panelPhoto[state.selectedPanel] ?? 0];
    if (photo) { photo.dx = parseFloat(e.target.value); queueRedraw(); }
  });
  $('dyRange').addEventListener('input', (e) => {
    const photo = state.photos[state.panelPhoto[state.selectedPanel] ?? 0];
    if (photo) { photo.dy = parseFloat(e.target.value); queueRedraw(); }
  });
  $('resetCrop').addEventListener('click', () => {
    const photo = state.photos[state.panelPhoto[state.selectedPanel] ?? 0];
    if (photo) { photo.zoom = 1; photo.dx = 0; photo.dy = 0; queueRedraw(); }
  });
  $('refaceBtn').addEventListener('click', () => {
    const photo = state.photos[state.panelPhoto[state.selectedPanel] ?? 0];
    if (photo) {
      try { photo.anchor = detectFaceAnchor(photo.img); } catch (e) { /* keep */ }
      queueRedraw();
    }
  });
}

// ---------------------------------------------------------------- export

function exportCover(w, h, filename) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  drawCover(c.getContext('2d'), w, h, state);
  return new Promise((resolve) => {
    c.toBlob((blob) => {
      if (!blob) { resolve(false); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      resolve(true);
    }, 'image/png');
  });
}

async function exportOne() {
  const [w, h] = exportSize.split('x').map(Number);
  const ok = await exportCover(w, h, `palm-neon-${exportSize}.png`);
  flashStatus(ok ? `Exported ${w}×${h} PNG — check your downloads.` : 'Export failed in this browser.');
}

async function exportAll() {
  const sizes = [[1080, 1080], [1080, 1350], [1920, 1080]];
  for (const [w, h] of sizes) {
    await exportCover(w, h, `palm-neon-${w}x${h}.png`);
    await new Promise((r) => setTimeout(r, 350));
  }
  flashStatus('Exported all three sizes: 1080×1080, 1080×1350, 1920×1080.');
}

function flashStatus(msg) {
  const el = $('statusLine');
  if (el) el.textContent = msg;
}

// ---------------------------------------------------------------- controls

function buildPickers() {
  const layoutBar = $('layoutBar');
  LAYOUT_ORDER.forEach((key) => {
    const b = document.createElement('button');
    b.className = 'chip' + (state.layout === key ? ' on' : '');
    b.textContent = LAYOUTS[key].name;
    b.addEventListener('click', () => {
      state.layout = key;
      state.selectedPanel = LAYOUTS[key].panels.findIndex((p) => p.hero);
      if (state.selectedPanel < 0) state.selectedPanel = 0;
      document.querySelectorAll('#layoutBar .chip').forEach((c) => c.classList.remove('on'));
      b.classList.add('on');
      queueRedraw();
    });
    layoutBar.appendChild(b);
  });
  const gradeBar = $('gradeBar');
  GRADE_ORDER.forEach((key) => {
    const b = document.createElement('button');
    b.className = 'chip swatch-' + key + (state.grade === key ? ' on' : '');
    b.textContent = GRADES[key].name;
    b.addEventListener('click', () => {
      state.grade = key;
      document.querySelectorAll('#gradeBar .chip').forEach((c) => c.classList.remove('on'));
      b.classList.add('on');
      queueRedraw();
    });
    gradeBar.appendChild(b);
  });
  const sizeBar = $('sizeBar');
  ['1080x1080', '1080x1350', '1920x1080'].forEach((s) => {
    const b = document.createElement('button');
    b.className = 'chip' + (exportSize === s ? ' on' : '');
    b.textContent = s === '1080x1080' ? 'Square 1:1' : s === '1080x1350' ? 'Portrait 4:5' : 'Wide 16:9';
    b.title = s;
    b.addEventListener('click', () => {
      exportSize = s;
      document.querySelectorAll('#sizeBar .chip').forEach((c) => c.classList.remove('on'));
      b.classList.add('on');
      queueRedraw();
    });
    sizeBar.appendChild(b);
  });
}

function buildCastEditor() {
  const wrap = $('castEditor');
  state.cast.forEach((member, i) => {
    const row = document.createElement('div');
    row.className = 'cast-row';
    const nameInput = document.createElement('input');
    nameInput.value = member.name; nameInput.maxLength = 14; nameInput.setAttribute('aria-label', `Cast ${i + 1} name`);
    nameInput.addEventListener('input', () => { member.name = nameInput.value.toUpperCase() || '???'; queueRedraw(); });
    const roleInput = document.createElement('input');
    roleInput.value = member.role; roleInput.maxLength = 18; roleInput.setAttribute('aria-label', `Cast ${i + 1} role`);
    roleInput.addEventListener('input', () => { member.role = roleInput.value.toUpperCase() || '???'; queueRedraw(); });
    row.appendChild(nameInput); row.appendChild(roleInput);
    wrap.appendChild(row);
  });
}

function bindTextInputs() {
  $('titleInput').addEventListener('input', (e) => { state.title = e.target.value || 'PALM NEON'; queueRedraw(); });
  $('subtitleInput').addEventListener('input', (e) => { state.subtitle = e.target.value; queueRedraw(); });
  $('taglineInput').addEventListener('input', (e) => { state.tagline = e.target.value; queueRedraw(); });
  $('sealInput').addEventListener('input', (e) => { state.seal = e.target.value; queueRedraw(); });
  $('starsRange').addEventListener('input', (e) => { state.stars = parseInt(e.target.value, 10); $('starsVal').textContent = `${state.stars} / 5`; queueRedraw(); });
}

function bindPhotos() {
  const input = $('photoInput');
  $('addPhotoBtn').addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const files = [...input.files].filter((f) => f.type.startsWith('image/')).slice(0, 6);
    if (!files.length) return;
    let loaded = 0;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          addPhoto(img, file.name.replace(/\.[^.]+$/, '').slice(0, 18));
          loaded++;
          if (loaded === files.length) { flashStatus(`${files.length} photo${files.length > 1 ? 's' : ''} loaded — kept on this machine.`); queueRedraw(); }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
    input.value = '';
  });
  $('sampleBtn').addEventListener('click', () => { loadSamples(); flashStatus('Sample scenes loaded — illustrated art, drawn by the app.'); });
  // Drag a photo file straight onto the preview.
  previewCanvas.addEventListener('dragover', (e) => e.preventDefault());
  previewCanvas.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = [...(e.dataTransfer.files || [])].filter((f) => f.type.startsWith('image/'));
    files.slice(0, 6).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => { addPhoto(img, file.name.replace(/\.[^.]+$/, '').slice(0, 18)); queueRedraw(); };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  });
}

function bindCanvasPointer() {
  const toCover = (e) => {
    const r = previewCanvas.getBoundingClientRect();
    const d = previewDims();
    return { x: ((e.clientX - r.left) / r.width) * d.w, y: ((e.clientY - r.top) / r.height) * d.h };
  };
  previewCanvas.addEventListener('pointerdown', (e) => {
    const p = toCover(e);
    const idx = panelAt(state, previewDims().w, previewDims().h, p.x, p.y);
    if (idx < 0) return;
    state.selectedPanel = idx;
    const photo = state.photos[state.panelPhoto[idx] ?? 0];
    if (photo) dragPhoto = { x0: p.x, y0: p.y, dx0: photo.dx, dy0: photo.dy };
    previewCanvas.setPointerCapture(e.pointerId);
    queueRedraw();
  });
  previewCanvas.addEventListener('pointermove', (e) => {
    if (!dragPhoto) return;
    const p = toCover(e);
    const d = previewDims();
    const photo = state.photos[state.panelPhoto[state.selectedPanel] ?? 0];
    if (!photo) return;
    photo.dx = Math.max(-0.5, Math.min(0.5, dragPhoto.dx0 + (p.x - dragPhoto.x0) / d.w));
    photo.dy = Math.max(-0.5, Math.min(0.5, dragPhoto.dy0 + (p.y - dragPhoto.y0) / d.h));
    queueRedraw();
  });
  const endDrag = () => { dragPhoto = null; };
  previewCanvas.addEventListener('pointerup', endDrag);
  previewCanvas.addEventListener('pointercancel', endDrag);
  previewCanvas.addEventListener('wheel', (e) => {
    const photo = state.photos[state.panelPhoto[state.selectedPanel] ?? 0];
    if (!photo) return;
    e.preventDefault();
    photo.zoom = Math.max(0.6, Math.min(3, photo.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
    queueRedraw();
  }, { passive: false });
}

// ---------------------------------------------------------------- shot scenes

// ?shot=cover renders one exported cover full-frame (the app's own drawing at
// a size inside the screenshot limits). ?shot=editor shows the editor with a
// sample photo loaded. Used to take the entry's screenshots.
function runShotScene() {
  const q = new URLSearchParams(location.search);
  const shot = q.get('shot');
  if (!shot) return false;
  document.body.classList.add('shot-mode');
  if (shot === 'cover') {
    const size = q.get('size') || '1920x1080';
    const [w, h] = size.split('x').map(Number);
    const c = document.createElement('canvas');
    c.id = 'shotCanvas';
    c.width = w; c.height = h;
    c.style.width = '100vw'; c.style.height = '100vh'; c.style.objectFit = 'contain';
    c.style.background = '#12041f';
    document.body.innerHTML = '';
    document.body.appendChild(c);
    loadSamples();
    // Hero gets the boulevard scene, side panels the other two.
    state.panelPhoto = [1, 2, 0, 0, 2, 1, 1];
    drawCover(c.getContext('2d'), w, h, state);
    document.title = `Palm Neon cover ${size}`;
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- boot

function boot() {
  previewCanvas = $('previewCanvas');
  previewCtx = previewCanvas.getContext('2d');
  if (runShotScene()) return;
  buildPickers();
  buildCastEditor();
  bindTextInputs();
  bindPhotos();
  bindInspector();
  bindCanvasPointer();
  $('exportBtn').addEventListener('click', exportOne);
  $('exportAllBtn').addEventListener('click', exportAll);
  loadSamples();
  drawPreview();
  flashStatus('Ready — samples loaded. Add your own photos, pick a layout and grade, then export a PNG.');
}

document.addEventListener('DOMContentLoaded', boot);
