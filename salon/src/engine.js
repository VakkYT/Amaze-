/**
 * Salón Tricolor — la lógica pura del salón.
 *
 * Nada de aquí toca el DOM ni el canvas: son datos (paletas, personajes,
 * opciones), transformaciones sobre un "look" y el veredicto del jurado.
 * Eso lo vuelve comprobable con `node --test`, y deja el dibujo en paint.js.
 *
 * Nota: los personajes son caricaturas vectoriales, no retratos. Es un juego
 * de salón sobre figuras públicas, repartido de lado a lado del espectro.
 */

/* ------------------------------------------------------------------ azar - */

/** mulberry32 sembrado con un hash de texto: misma semilla, mismo look. */
export function Rng(seed) {
  let h = 2166136261 >>> 0;
  for (const ch of String(seed)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let a = h || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = (n) => Math.floor(next() * n);
  next.pick = (list) => list[next.int(list.length)];
  return next;
}

/* --------------------------------------------------------------- colores - */

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Mezcla lineal entre dos hex. t = 0 devuelve a, t = 1 devuelve b. */
export function mix(a, b, t) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const k = Math.max(0, Math.min(1, t));
  return rgbToHex(r1 + (r2 - r1) * k, g1 + (g2 - g1) * k, b1 + (b2 - b1) * k);
}

/** Aclara (amt > 0) u oscurece (amt < 0) un hex. */
export function shade(hex, amt) {
  return amt >= 0 ? mix(hex, '#ffffff', amt) : mix(hex, '#000000', -amt);
}

/** hex + opacidad -> rgba() para las capas de maquillaje. */
export function alpha(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, a))})`;
}

export function hexToHsl(hex) {
  const [r0, g0, b0] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r0, g0, b0);
  const min = Math.min(r0, g0, b0);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r0) h = ((g0 - b0) / d + (g0 < b0 ? 6 : 0)) / 6;
  else if (max === g0) h = ((b0 - r0) / d + 2) / 6;
  else h = ((r0 - g0) / d + 4) / 6;
  return [h * 360, s, l];
}

/* --------------------------------------------------------------- paletas - */

const P = (n, c) => ({ n, c });

export const PALETTES = {
  base: [
    P('Sin base', '#00000000'),
    P('Porcelana', '#f3ddc8'),
    P('Arena', '#e6c4a0'),
    P('Canela', '#cf9f72'),
    P('Caramelo', '#b97f4f'),
    P('Cacao', '#8c5730'),
    P('Ébano', '#5f3a20'),
  ],
  rubor: [
    P('Durazno', '#f09a72'),
    P('Coral', '#ee6a55'),
    P('Rosa té', '#e88ba0'),
    P('Fucsia', '#d84a86'),
    P('Ciruela', '#9c4266'),
    P('Terracota', '#c1603a'),
    P('Malva', '#b07fa8'),
    P('Bronce', '#a7703f'),
  ],
  sombra: [
    P('Champaña', '#e6cfa8'),
    P('Miel', '#d29b4c'),
    P('Cobre', '#b8632f'),
    P('Vino', '#7a2f42'),
    P('Ciruela', '#5c3b76'),
    P('Índigo', '#2f3f8f'),
    P('Turquesa', '#1f8f8a'),
    P('Esmeralda', '#1c7a4b'),
    P('Grafito', '#3a3a42'),
    P('Oliva', '#6f7434'),
  ],
  labial: [
    P('Nude', '#c88a76'),
    P('Palo de rosa', '#c9707c'),
    P('Rojo tinto', '#a31f34'),
    P('Rojo bandera', '#d81f26'),
    P('Coral', '#ef6a4c'),
    P('Fucsia', '#cf2f7f'),
    P('Vino', '#6f1f38'),
    P('Ciruela oscura', '#4a2038'),
    P('Naranja pop', '#f0722a'),
    P('Chocolate', '#7a4530'),
  ],
  esmalte: [
    P('Transparente', '#efe6de'),
    P('Blanco leche', '#f6f3ec'),
    P('Rosa bebé', '#f0c3cb'),
    P('Rojo bandera', '#d4212a'),
    P('Vino', '#6d1c33'),
    P('Naranja mango', '#f07d23'),
    P('Amarillo maracuyá', '#f5c518'),
    P('Verde monte', '#1f7a4d'),
    P('Azul Caribe', '#1b6fb5'),
    P('Azul noche', '#22305c'),
    P('Lila', '#9a6fc4'),
    P('Negro charol', '#1b1b1f'),
  ],
  arte: [
    P('Blanco', '#fdfbf6'),
    P('Negro', '#16161a'),
    P('Oro', '#e3b341'),
    P('Plata', '#cfd4da'),
    P('Rojo', '#d4212a'),
    P('Azul', '#1b6fb5'),
    P('Verde', '#1f9d55'),
    P('Fucsia', '#d63384'),
  ],
};

const O = (id, n) => ({ id, n });

export const OPTIONS = {
  sombraEstilo: [O('suave', 'Difuminada'), O('gato', 'Ojo de gato'), O('humo', 'Ahumada'), O('corte', 'Corte agudo')],
  delineador: [O('ninguno', 'Sin delinear'), O('fino', 'Fino'), O('alado', 'Alado'), O('grafico', 'Gráfico')],
  pestanas: [O('natural', 'Naturales'), O('rizadas', 'Rizadas'), O('dramaticas', 'De telenovela')],
  cejas: [O('natural', 'Naturales'), O('definidas', 'Definidas'), O('laminadas', 'Laminadas')],
  labialAcabado: [O('mate', 'Mate'), O('gloss', 'Gloss'), O('metalico', 'Metálico')],
  forma: [O('redonda', 'Redonda'), O('ovalada', 'Ovalada'), O('almendra', 'Almendra'), O('cuadrada', 'Cuadrada'), O('coffin', 'Coffin'), O('stiletto', 'Stiletto')],
  acabado: [O('brillante', 'Brillante'), O('mate', 'Mate'), O('cromado', 'Cromado')],
  arte: [
    O('ninguno', 'Liso'), O('frances', 'Francés'), O('puntos', 'Puntos'), O('rayas', 'Rayas'),
    O('estrellas', 'Estrellas'), O('flores', 'Flores'), O('degradado', 'Degradado'), O('tricolor', 'Tricolor'),
  ],
};

export const EXTRAS = [
  O('lunar', 'Lunar'),
  O('pecas', 'Pecas'),
  O('purpurina', 'Purpurina'),
  O('pedreria', 'Pedrería'),
  O('antifaz', 'Antifaz de brillo'),
];

/* ------------------------------------------------------------ personajes - */

/**
 * Rasgos de dibujo (piel, pelo, gafas) más una "paleta de campaña": dos
 * colores que el jurado usa para medir coherencia. No hay nada político
 * codificado aquí; son parámetros de trazo y dos hex.
 */
export const FIGURES = [
  {
    id: 'petro', nombre: 'Gustavo Petro', cargo: 'Presidente',
    piel: '#d8a97f', cabello: '#c6c2b9', pelo: 'ondulado', vello: 'ninguno',
    gafas: 'ninguno', cejas: 3, traje: '#1e2c46', corbata: '#b4322f',
    campana: ['#f2b705', '#c4342a'],
  },
  {
    id: 'francia', nombre: 'Francia Márquez', cargo: 'Vicepresidenta',
    piel: '#7c4b2e', cabello: '#1d1512', pelo: 'turbante', vello: 'ninguno',
    gafas: 'ninguno', cejas: 2, traje: '#1f6d57', corbata: null, aretes: true,
    tocado: '#18906d', campana: ['#18906d', '#f2b705'],
  },
  {
    id: 'uribe', nombre: 'Álvaro Uribe', cargo: 'Expresidente',
    piel: '#dbb18b', cabello: '#b8b2a7', pelo: 'peinado', vello: 'ninguno',
    gafas: 'ninguno', cejas: 3, traje: '#25324a', corbata: '#2a5fa8',
    campana: ['#2a5fa8', '#d8d3c6'],
  },
  {
    id: 'fajardo', nombre: 'Sergio Fajardo', cargo: 'Exgobernador',
    piel: '#dcae86', cabello: '#cecbc4', pelo: 'rizado', vello: 'ninguno',
    gafas: 'ninguno', cejas: 2, traje: '#2f4a45', corbata: null,
    campana: ['#2fa37a', '#f2f0e6'],
  },
  {
    id: 'claudia', nombre: 'Claudia López', cargo: 'Exalcaldesa',
    piel: '#e0b895', cabello: '#6b4a33', pelo: 'corto-fem', vello: 'ninguno',
    gafas: 'rect', cejas: 2, traje: '#3b4a63', corbata: null, aretes: true,
    campana: ['#1f9f4d', '#f2c249'],
  },
  {
    id: 'fico', nombre: 'Federico Gutiérrez', cargo: 'Alcalde',
    piel: '#d8a87e', cabello: '#2f2620', pelo: 'peinado', vello: 'ninguno',
    gafas: 'ninguno', cejas: 3, traje: '#213a5c', corbata: '#f28c28',
    campana: ['#1f6fb2', '#f28c28'],
  },
  {
    id: 'cabal', nombre: 'María Fernanda Cabal', cargo: 'Senadora',
    piel: '#e3bd9a', cabello: '#c8a463', pelo: 'melena', vello: 'ninguno',
    gafas: 'ninguno', cejas: 2, traje: '#1e4f9c', corbata: null, aretes: true,
    campana: ['#1e4f9c', '#d8d3c6'],
  },
  {
    id: 'duque', nombre: 'Iván Duque', cargo: 'Expresidente',
    piel: '#d9ac84', cabello: '#241d18', pelo: 'peinado', vello: 'ninguno',
    gafas: 'ninguno', cejas: 2, traje: '#1c3f74', corbata: '#e0742a',
    campana: ['#e0742a', '#1c3f74'],
  },
  {
    id: 'generico', nombre: 'Candidatx sin nombre', cargo: 'Aspirante',
    piel: '#c89468', cabello: '#3a2d24', pelo: 'corto', vello: 'barba',
    gafas: 'redondo', cejas: 2, traje: '#4a4a55', corbata: '#8a8a99',
    campana: ['#8a8a99', '#d9d4c8'],
  },
];

export const figureById = (id) => FIGURES.find((f) => f.id === id) || FIGURES[0];

/* ------------------------------------------------------------------ look - */

/**
 * Un look es plano y numérico a propósito: cada campo es un índice o un
 * entero pequeño, así que cabe entero en un código de texto compartible.
 */
export const FIELDS = {
  base: { kind: 'palette', pal: 'base' },
  contorno: { kind: 'range', max: 3 },
  brillo: { kind: 'range', max: 3 },
  rubor: { kind: 'palette', pal: 'rubor' },
  ruborInt: { kind: 'range', max: 3 },
  sombra: { kind: 'palette', pal: 'sombra' },
  sombraEstilo: { kind: 'option', opt: 'sombraEstilo' },
  delineador: { kind: 'option', opt: 'delineador' },
  pestanas: { kind: 'option', opt: 'pestanas' },
  cejas: { kind: 'option', opt: 'cejas' },
  labial: { kind: 'palette', pal: 'labial' },
  labialAcabado: { kind: 'option', opt: 'labialAcabado' },
  extras: { kind: 'bits', list: EXTRAS },
  forma: { kind: 'option', opt: 'forma' },
  largo: { kind: 'range', max: 3 },
  esmalte: { kind: 'palette', pal: 'esmalte' },
  acabado: { kind: 'option', opt: 'acabado' },
  arte: { kind: 'option', opt: 'arte' },
  arteColor: { kind: 'palette', pal: 'arte' },
  acento: { kind: 'range', max: 5 },   // 0 = ninguna, 1..5 = uña acentuada
};

/** Orden estable de los campos: define el código y no debe reordenarse. */
export const FIELD_ORDER = Object.keys(FIELDS);

function limit(key) {
  const f = FIELDS[key];
  if (f.kind === 'palette') return PALETTES[f.pal].length - 1;
  if (f.kind === 'option') return OPTIONS[f.opt].length - 1;
  if (f.kind === 'bits') return (1 << f.list.length) - 1;
  return f.max;
}

const clamp = (v, hi) => (Number.isFinite(v) ? Math.max(0, Math.min(hi, Math.round(v))) : 0);

export function defaultLook(figura = FIGURES[0].id) {
  return {
    figura: figureById(figura).id,
    base: 2, contorno: 1, brillo: 1,
    rubor: 2, ruborInt: 2,
    sombra: 4, sombraEstilo: 0,
    delineador: 1, pestanas: 1, cejas: 1,
    labial: 2, labialAcabado: 1,
    extras: 0,
    forma: 2, largo: 2,
    esmalte: 3, acabado: 0,
    arte: 1, arteColor: 0,
    acento: 4,
  };
}

/** Devuelve un look nuevo con un campo cambiado (o el mismo si no cambia). */
export function apply(look, key, value) {
  if (key === 'figura') {
    const id = figureById(value).id;
    return id === look.figura ? look : { ...look, figura: id };
  }
  if (!(key in FIELDS)) throw new Error(`campo desconocido: ${key}`);
  const v = clamp(value, limit(key));
  return v === look[key] ? look : { ...look, [key]: v };
}

/** Prende o apaga un extra por id. */
export function toggleExtra(look, id) {
  const i = EXTRAS.findIndex((e) => e.id === id);
  if (i < 0) return look;
  return { ...look, extras: look.extras ^ (1 << i) };
}

export const hasExtra = (look, id) => {
  const i = EXTRAS.findIndex((e) => e.id === id);
  return i >= 0 && (look.extras & (1 << i)) !== 0;
};

export const extrasOf = (look) => EXTRAS.filter((e) => hasExtra(look, e.id)).map((e) => e.id);

/** Lee el valor de un campo como opción/colores según su tipo. */
export const optionOf = (look, key) => OPTIONS[FIELDS[key].opt][look[key]].id;
export const colorOf = (look, key) => PALETTES[FIELDS[key].pal][look[key]].c;

export function randomLook(seed, figura) {
  const rng = Rng(seed);
  const id = figura || rng.pick(FIGURES).id;
  const look = { figura: figureById(id).id };
  for (const key of FIELD_ORDER) look[key] = rng.int(limit(key) + 1);
  look.base = 1 + rng.int(PALETTES.base.length - 1);   // un rostro sin base es raro de nacimiento
  return look;
}

/* ---------------------------------------------------------------- código - */

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const PREFIX = 'SLN1';

/** Serializa un look a un código corto y legible: SLN1-<figura>-<campos><suma>. */
export function encodeLook(look) {
  const body = FIELD_ORDER.map((k) => ALPHABET[clamp(look[k], limit(k))]).join('');
  const fig = figureById(look.figura).id;
  let sum = 0;
  for (const ch of fig + body) sum = (sum + ch.charCodeAt(0)) % 36;
  return `${PREFIX}-${fig}-${body}${ALPHABET[sum]}`;
}

/** Lee un código. Devuelve null si no es válido; nunca lanza. */
export function decodeLook(code) {
  if (typeof code !== 'string') return null;
  const parts = code.trim().toLowerCase().split('-');
  if (parts.length !== 3 || parts[0] !== PREFIX.toLowerCase()) return null;
  const [, fig, tail] = parts;
  if (!FIGURES.some((f) => f.id === fig)) return null;
  if (tail.length !== FIELD_ORDER.length + 1) return null;
  const body = tail.slice(0, -1);
  let sum = 0;
  for (const ch of fig + body) sum = (sum + ch.charCodeAt(0)) % 36;
  if (ALPHABET[sum] !== tail.slice(-1)) return null;
  const look = { figura: fig };
  for (let i = 0; i < FIELD_ORDER.length; i++) {
    const key = FIELD_ORDER[i];
    const v = ALPHABET.indexOf(body[i]);
    if (v < 0) return null;
    look[key] = clamp(v, limit(key));
  }
  return look;
}

/* ---------------------------------------------------------------- jurado - */

function hueDist(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Curva de armonía: monocromo, análogo, triádico y complementario puntúan alto. */
const CENTERS = [[0, 26, 1], [40, 22, 0.9], [120, 26, 0.8], [180, 26, 0.94]];
function pairHarmony(d) {
  let best = 0;
  for (const [c, s, w] of CENTERS) best = Math.max(best, w * Math.exp(-((d - c) ** 2) / (2 * s * s)));
  return best;
}

/** Colores efectivamente aplicados, con su peso en la lectura del jurado. */
function activeColors(look) {
  const out = [];
  if (look.ruborInt > 0) out.push(colorOf(look, 'rubor'));
  if (optionOf(look, 'sombraEstilo') !== 'suave' || look.sombra > 0) out.push(colorOf(look, 'sombra'));
  out.push(colorOf(look, 'labial'));
  out.push(colorOf(look, 'esmalte'));
  if (optionOf(look, 'arte') !== 'ninguno') out.push(colorOf(look, 'arteColor'));
  return out;
}

const PESO_FORMA = { redonda: 0.2, ovalada: 0.35, almendra: 0.6, cuadrada: 0.5, coffin: 0.8, stiletto: 1 };
const PESO_SOMBRA = { suave: 0.2, gato: 0.65, humo: 0.75, corte: 1 };
const PESO_LINEA = { ninguno: 0, fino: 0.35, alado: 0.75, grafico: 1 };
const PESO_PESTANA = { natural: 0.15, rizadas: 0.55, dramaticas: 1 };

const pct = (v) => Math.max(0, Math.min(100, Math.round(v * 100)));

/** Cuatro medidores y un veredicto. Determinista: mismo look, misma lectura. */
export function judge(look) {
  const fig = figureById(look.figura);
  const colors = activeColors(look);
  const cromaticos = colors.filter((c) => hexToHsl(c)[1] > 0.12);

  let pares = 0;
  let suma = 0;
  for (let i = 0; i < cromaticos.length; i++) {
    for (let j = i + 1; j < cromaticos.length; j++) {
      suma += pairHarmony(hueDist(hexToHsl(cromaticos[i])[0], hexToHsl(cromaticos[j])[0]));
      pares++;
    }
  }
  const armonia = pares ? suma / pares : 0.7;

  const sat = (c) => hexToHsl(c)[1];
  const atrevimiento = mean([
    sat(colorOf(look, 'labial')),
    sat(colorOf(look, 'esmalte')),
    look.ruborInt / 3,
    PESO_SOMBRA[optionOf(look, 'sombraEstilo')],
    PESO_LINEA[optionOf(look, 'delineador')],
    PESO_PESTANA[optionOf(look, 'pestanas')],
    look.largo / 3,
    PESO_FORMA[optionOf(look, 'forma')],
    extrasOf(look).length / EXTRAS.length,
    optionOf(look, 'arte') === 'ninguno' ? 0 : 0.8,
  ]);

  const coherencia = cromaticos.length
    ? mean(cromaticos.map((c) => {
      const h = hexToHsl(c)[0];
      return Math.max(...fig.campana.map((k) => Math.exp(-(hueDist(h, hexToHsl(k)[0]) ** 2) / (2 * 34 * 34))));
    }))
    : 0.5;

  const lista = [
    look.contorno > 0, look.brillo > 0, look.ruborInt > 0,
    optionOf(look, 'delineador') !== 'ninguno',
    optionOf(look, 'pestanas') !== 'natural',
    optionOf(look, 'cejas') !== 'natural',
    extrasOf(look).length > 0,
    optionOf(look, 'arte') !== 'ninguno',
    look.acento > 0,
    look.largo >= 2,
  ];
  const produccion = lista.filter(Boolean).length / lista.length;

  const m = {
    armonia: pct(armonia),
    atrevimiento: pct(atrevimiento),
    coherencia: pct(coherencia),
    produccion: pct(produccion),
  };
  return { ...m, veredicto: verdict(m), nota: Math.round((m.armonia * 0.4 + m.atrevimiento * 0.25 + m.coherencia * 0.2 + m.produccion * 0.15)) };
}

function mean(xs) {
  return xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
}

/** El veredicto es una función pura de los cuatro medidores. */
export function verdict({ armonia, atrevimiento, coherencia, produccion }) {
  if (armonia >= 78 && atrevimiento >= 70 && produccion >= 60) return 'Portada de revista. El jurado se pone de pie y pide el nombre del salón.';
  if (armonia >= 78 && atrevimiento < 35) return 'Impecable y prudente: listo para rueda de prensa a las siete de la mañana.';
  if (atrevimiento >= 80 && armonia < 45) return 'Un acto de fe cromática. Valiente, ruidoso y absolutamente imposible de ignorar.';
  if (coherencia >= 75 && armonia >= 55) return 'Todo combina con la campaña. Sospechosamente disciplinado.';
  if (produccion <= 20) return 'Apenas un toque. O el turno se acabó, o esto es minimalismo militante.';
  if (armonia < 40 && atrevimiento < 40) return 'Tibio y disparejo: el jurado carraspea y mira el reloj.';
  if (atrevimiento >= 65) return 'Fuerte, con una idea clara. Falta afinar un tono para que no se peleen.';
  return 'Correcto y agradable. Le falta una decisión arriesgada para volverse memorable.';
}
