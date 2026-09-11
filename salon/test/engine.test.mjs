/**
 * Comprobaciones del engine del salón. Se corre con: node --test salon/test/
 *
 * Lo que importa aquí es que ningún control pueda dejar un look inválido y
 * que el código compartible sea de ida y vuelta exacta: si el código pierde
 * un campo, el look que le llega a otra persona no es el que se copió.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FIGURES, PALETTES, OPTIONS, EXTRAS, FIELDS, FIELD_ORDER,
  defaultLook, apply, toggleExtra, hasExtra, extrasOf, randomLook,
  encodeLook, decodeLook, judge, verdict, figureById,
  Rng, hexToRgb, mix, shade, hexToHsl,
} from '../src/engine.js';

const HEX = /^#[0-9a-f]{6}$/i;

test('las paletas son hex legibles y con nombre', () => {
  for (const [nombre, pal] of Object.entries(PALETTES)) {
    assert.ok(pal.length >= 6 && pal.length <= 36, `${nombre}: ${pal.length} tonos no cabe en el código`);
    for (const tono of pal) {
      assert.equal(typeof tono.n, 'string');
      assert.ok(tono.n.length > 0, `${nombre}: un tono sin nombre`);
      assert.ok(HEX.test(tono.c) || tono.c === '#00000000', `${nombre}: color raro ${tono.c}`);
    }
  }
  for (const [nombre, opts] of Object.entries(OPTIONS)) {
    assert.ok(opts.length >= 2 && opts.length <= 36, `${nombre}: cantidad de opciones fuera de rango`);
    assert.equal(new Set(opts.map((o) => o.id)).size, opts.length, `${nombre}: ids repetidos`);
  }
  assert.ok(EXTRAS.length <= 5, 'los extras deben caber en un solo dígito base 36');
});

test('cada personaje trae los rasgos que el pincel necesita', () => {
  assert.equal(new Set(FIGURES.map((f) => f.id)).size, FIGURES.length, 'ids repetidos');
  for (const fig of FIGURES) {
    for (const campo of ['nombre', 'cargo', 'piel', 'cabello', 'pelo', 'traje']) {
      assert.ok(fig[campo], `${fig.id}: falta ${campo}`);
    }
    assert.ok(HEX.test(fig.piel) && HEX.test(fig.cabello) && HEX.test(fig.traje), `${fig.id}: color inválido`);
    assert.equal(fig.campana.length, 2, `${fig.id}: la paleta de campaña son dos colores`);
    for (const c of fig.campana) assert.ok(HEX.test(c), `${fig.id}: campaña con color inválido`);
  }
  assert.equal(figureById('no-existe').id, FIGURES[0].id, 'un id desconocido cae en el primero');
});

test('el look por defecto es válido campo por campo', () => {
  const look = defaultLook();
  for (const key of FIELD_ORDER) {
    assert.equal(typeof look[key], 'number', `${key} no es número`);
    assert.ok(look[key] >= 0, `${key} negativo`);
  }
  assert.ok(FIGURES.some((f) => f.id === look.figura));
});

test('apply recorta, redondea y no muta el look anterior', () => {
  const look = defaultLook();
  const copia = { ...look };

  assert.equal(apply(look, 'labial', 999).labial, PALETTES.labial.length - 1);
  assert.equal(apply(look, 'labial', -5).labial, 0);
  assert.equal(apply(look, 'contorno', 2.6).contorno, 3);
  assert.equal(apply(look, 'contorno', Number.NaN).contorno, 0);
  assert.deepEqual(look, copia, 'apply mutó el original');

  assert.equal(apply(look, 'labial', look.labial), look, 'un cambio nulo devuelve el mismo objeto');
  assert.equal(apply(look, 'figura', 'francia').figura, 'francia');
  assert.equal(apply(look, 'figura', 'mengano').figura, FIGURES[0].id);
  assert.throws(() => apply(look, 'peluca', 1), /campo desconocido/);
});

test('los extras prenden y apagan por id', () => {
  let look = defaultLook();
  assert.deepEqual(extrasOf(look), []);
  look = toggleExtra(look, 'lunar');
  look = toggleExtra(look, 'pecas');
  assert.ok(hasExtra(look, 'lunar') && hasExtra(look, 'pecas'));
  look = toggleExtra(look, 'lunar');
  assert.equal(hasExtra(look, 'lunar'), false);
  assert.deepEqual(extrasOf(look), ['pecas']);
  assert.equal(toggleExtra(look, 'sombrero'), look, 'un extra inexistente no cambia nada');
});

test('el código del look es de ida y vuelta exacta', () => {
  for (let i = 0; i < 400; i++) {
    const look = randomLook(`look-${i}`);
    const code = encodeLook(look);
    assert.match(code, /^SLN1-[a-z]+-[0-9a-z]+$/, `código con forma rara: ${code}`);
    assert.deepEqual(decodeLook(code), look, `no volvió igual: ${code}`);
    assert.deepEqual(decodeLook(code.toUpperCase()), look, 'el código debe leerse sin importar mayúsculas');
  }
});

test('un código corrupto se rechaza en vez de dar un look a medias', () => {
  const code = encodeLook(defaultLook('claudia'));
  const malos = [
    '', 'hola', 'SLN1', 'SLN1-claudia', `SLN0-${code.slice(5)}`,
    code.replace('claudia', 'pericles'),
    code.slice(0, -1),
    `${code}0`,
    code.slice(0, 12) + (code[12] === 'z' ? 'y' : 'z') + code.slice(13),   // suma de control rota
    null, 42, undefined,
  ];
  for (const malo of malos) assert.equal(decodeLook(malo), null, `debió rechazar: ${malo}`);
});

test('randomLook es determinista y siempre dentro de rango', () => {
  assert.deepEqual(randomLook('misma'), randomLook('misma'));
  assert.notDeepEqual(randomLook('una'), randomLook('otra'));
  for (let i = 0; i < 200; i++) {
    const look = randomLook(`r-${i}`, 'fico');
    assert.equal(look.figura, 'fico', 'respeta el personaje pedido');
    assert.ok(look.base > 0, 'un azar sin base deja la cara sin maquillar');
    for (const key of FIELD_ORDER) {
      const f = FIELDS[key];
      const max = f.kind === 'palette' ? PALETTES[f.pal].length - 1
        : f.kind === 'option' ? OPTIONS[f.opt].length - 1
          : f.kind === 'bits' ? (1 << f.list.length) - 1 : f.max;
      assert.ok(look[key] >= 0 && look[key] <= max, `${key}=${look[key]} fuera de 0..${max}`);
    }
  }
});

test('el jurado siempre entrega cuatro medidores en 0..100 y un veredicto', () => {
  for (let i = 0; i < 300; i++) {
    const v = judge(randomLook(`j-${i}`));
    for (const key of ['armonia', 'atrevimiento', 'coherencia', 'produccion', 'nota']) {
      assert.ok(Number.isInteger(v[key]), `${key} no es entero`);
      assert.ok(v[key] >= 0 && v[key] <= 100, `${key}=${v[key]} fuera de rango`);
    }
    assert.ok(v.veredicto.length > 10, 'veredicto vacío');
  }
});

test('el jurado lee lo que se aplicó, no lo que se eligió sin aplicar', () => {
  const base = defaultLook();
  const lavada = {
    ...base, contorno: 0, brillo: 0, ruborInt: 0, delineador: 0, pestanas: 0,
    cejas: 0, extras: 0, arte: 0, acento: 0, largo: 0,
  };
  assert.equal(judge(lavada).produccion, 0, 'una cara lavada no produce nada');
  const completa = {
    ...base, contorno: 2, brillo: 2, ruborInt: 2, delineador: 2, pestanas: 2,
    cejas: 2, extras: 1, arte: 2, acento: 3, largo: 3,
  };
  assert.equal(judge(completa).produccion, 100, 'con todo el kit la producción es total');

  const suave = { ...base, forma: 0, largo: 0, pestanas: 0, delineador: 0, sombraEstilo: 0, ruborInt: 0, extras: 0, arte: 0 };
  const fuerte = { ...base, forma: 5, largo: 3, pestanas: 2, delineador: 3, sombraEstilo: 3, ruborInt: 3, extras: 31, arte: 4 };
  assert.ok(judge(fuerte).atrevimiento > judge(suave).atrevimiento + 25, 'el atrevimiento debe separar los extremos');
});

test('el veredicto es una función pura de los medidores', () => {
  const m = { armonia: 80, atrevimiento: 75, coherencia: 50, produccion: 70 };
  assert.equal(verdict(m), verdict({ ...m }));
  const vistos = new Set();
  for (let a = 0; a <= 100; a += 10) {
    for (let b = 0; b <= 100; b += 10) {
      for (const c of [20, 80]) {
        for (const d of [10, 60]) {
          const texto = verdict({ armonia: a, atrevimiento: b, coherencia: c, produccion: d });
          assert.equal(typeof texto, 'string');
          vistos.add(texto);
        }
      }
    }
  }
  assert.ok(vistos.size >= 6, `el jurado sólo dijo ${vistos.size} cosas distintas`);
});

test('las utilidades de color hacen lo que dicen', () => {
  assert.deepEqual(hexToRgb('#ff8000'), [255, 128, 0]);
  assert.deepEqual(hexToRgb('#fff'), [255, 255, 255]);
  assert.equal(mix('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(mix('#123456', '#abcdef', 0), '#123456');
  assert.equal(mix('#123456', '#abcdef', 2), '#abcdef', 'la mezcla se recorta a 0..1');
  assert.equal(shade('#808080', 1), '#ffffff');
  assert.equal(shade('#808080', -1), '#000000');
  const [h, s, l] = hexToHsl('#ff0000');
  assert.equal(Math.round(h), 0);
  assert.equal(Math.round(s * 100), 100);
  assert.equal(Math.round(l * 100), 50);
  assert.equal(Math.round(hexToHsl('#00ff00')[0]), 120);
  assert.equal(Math.round(hexToHsl('#0000ff')[0]), 240);
  assert.equal(hexToHsl('#777777')[1], 0, 'un gris no tiene saturación');
});

test('el azar sembrado se repite', () => {
  const a = Array.from({ length: 8 }, Rng('semilla'));
  const b = Array.from({ length: 8 }, Rng('semilla'));
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, Array.from({ length: 8 }, Rng('otra')));
  for (const v of a) assert.ok(v >= 0 && v < 1);
  const rng = Rng('int');
  for (let i = 0; i < 100; i++) assert.ok(Number.isInteger(rng.int(7)) && rng.int(7) < 7);
});
