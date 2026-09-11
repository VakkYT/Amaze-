/**
 * Salón Tricolor — la mesa de trabajo.
 *
 * Aquí no hay reglas de belleza: sólo se arman los controles a partir de las
 * paletas del engine, se empuja cada cambio a un historial y se vuelven a
 * pintar las dos láminas. Todo lo que se puede comprobar sin navegador vive
 * en engine.js; esto es cableado.
 */
import {
  FIGURES, PALETTES, OPTIONS, EXTRAS, FIELDS,
  defaultLook, apply, toggleExtra, hasExtra, randomLook, judge,
  encodeLook, decodeLook, figureById,
} from './engine.js';
import { paintFace, paintHand, faceHit, nailHit, CANVAS_UNITS } from './paint.js';

const $ = (id) => document.getElementById(id);

const TICKS = {
  contorno: ['sin', 'leve', 'medio', 'escultura'],
  brillo: ['sin', 'rocío', 'glow', 'faro'],
  ruborInt: ['sin', 'apenas', 'medio', 'carnaval'],
  largo: ['al ras', 'corta', 'media', 'garra'],
};

const DEDOS = ['Ninguna', 'Índice', 'Medio', 'Anular', 'Meñique', 'Pulgar'];

/** El rail entero se declara aquí y se dibuja solo. */
const PANELS = [
  {
    id: 'rostro',
    groups: [
      { n: 'Piel', fields: [
        { k: 'base', t: 'palette', n: 'Tono de base' },
        { k: 'contorno', t: 'range', n: 'Contorno' },
        { k: 'brillo', t: 'range', n: 'Iluminador' },
      ] },
      { n: 'Mejillas', fields: [
        { k: 'rubor', t: 'palette', n: 'Rubor' },
        { k: 'ruborInt', t: 'range', n: 'Intensidad' },
      ] },
      { n: 'Ojos', fields: [
        { k: 'sombra', t: 'palette', n: 'Sombra' },
        { k: 'sombraEstilo', t: 'seg', n: 'Aplicación' },
        { k: 'delineador', t: 'seg', n: 'Delineador' },
        { k: 'pestanas', t: 'seg', n: 'Pestañas' },
        { k: 'cejas', t: 'seg', n: 'Cejas' },
      ] },
      { n: 'Labios', fields: [
        { k: 'labial', t: 'palette', n: 'Labial' },
        { k: 'labialAcabado', t: 'seg', n: 'Acabado' },
      ] },
      { n: 'Detalles', fields: [{ k: 'extras', t: 'extras', n: 'Extras', nota: 'La purpurina, la pedrería y el antifaz brillan en el tono de la sombra.' }] },
    ],
  },
  {
    id: 'unas',
    groups: [
      { n: 'Forma', fields: [
        { k: 'forma', t: 'seg', n: 'Corte' },
        { k: 'largo', t: 'range', n: 'Largo' },
      ] },
      { n: 'Esmalte', fields: [
        { k: 'esmalte', t: 'palette', n: 'Color' },
        { k: 'acabado', t: 'seg', n: 'Acabado' },
      ] },
      { n: 'Decoración', fields: [
        { k: 'arte', t: 'seg', n: 'Diseño' },
        { k: 'arteColor', t: 'palette', n: 'Color del diseño' },
        { k: 'acento', t: 'acento', n: 'Uña acentuada' },
      ] },
    ],
  },
];

/** Qué panel abrir cuando alguien toca una zona del rostro. */
const PANEL_DE = { base: 'rostro', rubor: 'rostro', sombra: 'rostro', cejas: 'rostro', labial: 'rostro' };

let look = defaultLook();
let past = [];
let future = [];
let panel = 'rostro';
const syncers = [];

/* ------------------------------------------------------------ historial - */

function commit(next) {
  if (next === look) return;
  past.push(look);
  if (past.length > 120) past.shift();
  future.length = 0;
  look = next;
  render();
}

function undo() {
  if (!past.length) return;
  future.push(look);
  look = past.pop();
  render();
}

function redo() {
  if (!future.length) return;
  past.push(look);
  look = future.pop();
  render();
}

const set = (k, v) => commit(apply(look, k, v));

/* ------------------------------------------------------------- controles - */

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function buildFigures() {
  const host = $('figuras');
  for (const fig of FIGURES) {
    const b = el('button');
    b.type = 'button';
    const dot = el('i');
    dot.style.background = fig.campana[0];
    const box = el('span');
    box.append(fig.nombre, el('small', null, fig.cargo));
    b.append(dot, box);
    b.addEventListener('click', () => commit(apply(look, 'figura', fig.id)));
    host.append(b);
    syncers.push(() => b.setAttribute('aria-pressed', String(look.figura === fig.id)));
  }
}

function buildPalette(field, host) {
  const wrap = el('div', 'field');
  wrap.append(el('label', null, field.n));
  const grid = el('div', 'swatches');
  const pal = PALETTES[FIELDS[field.k].pal];
  pal.forEach((tono, i) => {
    const b = el('button', 'swatch');
    b.type = 'button';
    b.title = tono.n;
    b.setAttribute('aria-label', tono.n);
    if (tono.c.length > 7) b.classList.add('none');
    else b.style.background = tono.c;
    b.addEventListener('click', () => set(field.k, i));
    grid.append(b);
    syncers.push(() => b.setAttribute('aria-pressed', String(look[field.k] === i)));
  });
  wrap.append(grid);
  host.append(wrap);
}

function buildRange(field, host) {
  const wrap = el('div', 'field');
  const head = el('div', 'slider-head');
  const value = el('b');
  head.append(el('label', null, field.n), value);
  const input = el('input');
  input.type = 'range';
  input.min = '0';
  input.max = String(FIELDS[field.k].max);
  input.step = '1';
  input.addEventListener('input', () => set(field.k, Number(input.value)));
  wrap.append(head, input);
  host.append(wrap);
  syncers.push(() => {
    input.value = String(look[field.k]);
    value.textContent = (TICKS[field.k] || [])[look[field.k]] ?? look[field.k];
  });
}

function buildSegmented(field, host) {
  const wrap = el('div', 'field');
  wrap.append(el('label', null, field.n));
  const seg = el('div', 'segmented');
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-label', field.n);
  OPTIONS[FIELDS[field.k].opt].forEach((opt, i) => {
    const b = el('button', null, opt.n);
    b.type = 'button';
    b.addEventListener('click', () => set(field.k, i));
    seg.append(b);
    syncers.push(() => b.setAttribute('aria-pressed', String(look[field.k] === i)));
  });
  wrap.append(seg);
  host.append(wrap);
}

function buildExtras(field, host) {
  const wrap = el('div', 'field');
  wrap.append(el('label', null, field.n));
  const chips = el('div', 'chips');
  for (const extra of EXTRAS) {
    const b = el('button', null, extra.n);
    b.type = 'button';
    b.addEventListener('click', () => commit(toggleExtra(look, extra.id)));
    chips.append(b);
    syncers.push(() => b.setAttribute('aria-pressed', String(hasExtra(look, extra.id))));
  }
  wrap.append(chips);
  if (field.nota) wrap.append(el('p', 'note', field.nota));
  host.append(wrap);
}

function buildAcento(field, host) {
  const wrap = el('div', 'field');
  wrap.append(el('label', null, field.n));
  const chips = el('div', 'chips');
  DEDOS.forEach((nombre, i) => {
    const b = el('button', null, nombre);
    b.type = 'button';
    b.addEventListener('click', () => set('acento', i));
    chips.append(b);
    syncers.push(() => b.setAttribute('aria-pressed', String(look.acento === i)));
  });
  wrap.append(chips);
  host.append(wrap);
}

const BUILDERS = { palette: buildPalette, range: buildRange, seg: buildSegmented, extras: buildExtras, acento: buildAcento };

function buildPanels() {
  const host = $('panels');
  for (const p of PANELS) {
    const box = el('div');
    box.dataset.panel = p.id;
    for (const group of p.groups) {
      const section = el('section', 'group');
      section.append(el('h2', null, group.n));
      for (const field of group.fields) BUILDERS[field.t](field, section);
      box.append(section);
    }
    host.append(box);
    syncers.push(() => { box.hidden = panel !== p.id; });
  }
  for (const b of document.querySelectorAll('.panels button')) {
    b.addEventListener('click', () => {
      panel = b.dataset.panel;
      sync();
    });
    syncers.push(() => b.setAttribute('aria-pressed', String(panel === b.dataset.panel)));
  }
}

/* ---------------------------------------------------------------- lienzo - */

function stage(id, paint) {
  const canvas = $(id);
  const ctx = canvas.getContext('2d');
  let size = 0;

  const resize = () => {
    const box = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const next = Math.max(1, Math.round(box.width * dpr));
    if (next === size) return false;
    size = next;
    canvas.width = size;
    canvas.height = size;
    return true;
  };

  const draw = () => {
    if (!size) resize();
    const k = size / CANVAS_UNITS;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, CANVAS_UNITS, CANVAS_UNITS);
    const tone = getComputedStyle(document.body).getPropertyValue('--plate').trim() || '#f6e7e3';
    paint(ctx, look, tone);
  };

  const at = (event) => {
    const box = canvas.getBoundingClientRect();
    return [
      ((event.clientX - box.left) / box.width) * CANVAS_UNITS,
      ((event.clientY - box.top) / box.height) * CANVAS_UNITS,
    ];
  };

  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => { if (resize()) draw(); }).observe(canvas);
  } else {
    window.addEventListener('resize', () => { if (resize()) draw(); });
  }

  return { canvas, draw, at };
}

const rostro = stage('rostro', paintFace);
const manos = stage('manos', paintHand);

rostro.canvas.addEventListener('click', (e) => {
  const zona = faceHit(...rostro.at(e));
  if (!zona) return;
  panel = PANEL_DE[zona] || panel;
  sync();
  const label = [...document.querySelectorAll('#panels label')]
    .find((l) => l.textContent === { base: 'Tono de base', rubor: 'Rubor', sombra: 'Sombra', cejas: 'Cejas', labial: 'Labial' }[zona]);
  if (label) label.parentElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});

manos.canvas.addEventListener('click', (e) => {
  const i = nailHit(...manos.at(e));
  if (i < 0) return;
  set('acento', look.acento === i + 1 ? 0 : i + 1);
});

/* ---------------------------------------------------------------- pintar - */

function sync() {
  for (const fn of syncers) fn();
}

function render() {
  sync();
  rostro.draw();
  manos.draw();

  const fig = figureById(look.figura);
  $('chip-figura').textContent = fig.nombre;
  $('chip-unas').textContent = `${OPTIONS.forma[look.forma].n} · ${TICKS.largo[look.largo]}`;

  const v = judge(look);
  $('chip-nota').textContent = `${v.nota}/100`;
  for (const key of ['armonia', 'atrevimiento', 'coherencia', 'produccion']) {
    $(`m-${key}`).textContent = `${v[key]}%`;
    $(`b-${key}`).style.width = `${v[key]}%`;
  }
  $('veredicto').textContent = v.veredicto;

  const code = encodeLook(look);
  if (document.activeElement !== $('codigo')) $('codigo').value = code;
  $('deshacer').disabled = past.length === 0;
  $('rehacer').disabled = future.length === 0;
  try { history.replaceState(null, '', `#${code}`); } catch { /* iframe sin permiso: da igual */ }
}

/* ---------------------------------------------------------------- turnos - */

$('azar').addEventListener('click', () => {
  commit(randomLook(`${Date.now()}-${Math.random()}`, look.figura));
});

$('limpiar').addEventListener('click', () => {
  const limpio = { ...defaultLook(look.figura), base: 0, contorno: 0, brillo: 0, ruborInt: 0, sombraEstilo: 0, delineador: 0, pestanas: 0, cejas: 0, labial: 0, labialAcabado: 0, extras: 0, esmalte: 0, arte: 0, acento: 0, largo: 1 };
  commit(limpio);
});

$('deshacer').addEventListener('click', undo);
$('rehacer').addEventListener('click', redo);

$('cargar').addEventListener('click', () => {
  const nota = $('codigo-nota');
  const leido = decodeLook($('codigo').value);
  if (!leido) {
    nota.textContent = 'Ese código no se entiende. Debe empezar por SLN1-.';
    nota.classList.add('error');
    return;
  }
  nota.textContent = 'Look cargado.';
  nota.classList.remove('error');
  commit(leido);
});

$('codigo').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('cargar').click();
});

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.metaKey || e.ctrlKey) return;
  const k = e.key.toLowerCase();
  if (k === 'a') $('azar').click();
  else if (k === 'z') undo();
  else if (k === 'y') redo();
});

/* ------------------------------------------------------------- apertura - */

buildFigures();
buildPanels();

const inicial = decodeLook(location.hash.slice(1));
if (inicial) look = inicial;
render();
window.addEventListener('load', render);
