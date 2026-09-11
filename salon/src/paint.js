/**
 * Salón Tricolor — el pincel.
 *
 * Dos láminas dibujadas a mano alzada sobre canvas: un rostro y una mano.
 * Todo se traza en un espacio virtual de 1000 x 1000 y se escala al final,
 * así el mismo código sirve para un teléfono y para una pantalla grande.
 *
 * Los rostros son caricaturas paramétricas —piel, pelo, gafas, vello— y no
 * retratos: el objetivo es que se distingan entre sí, no que se parezcan.
 */
import {
  PALETTES, figureById, colorOf, optionOf, hasExtra, mix, shade, alpha, Rng,
} from './engine.js';

export const CANVAS_UNITS = 1000;

/* ------------------------------------------------------------ primitivas - */

function path(ctx, d) {
  ctx.beginPath();
  d(ctx);
  ctx.closePath();
}

function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

function capsule(ctx, x1, y1, x2, y2, w) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function soft(ctx, x, y, r, color, strength) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, alpha(color, strength));
  g.addColorStop(0.6, alpha(color, strength * 0.45));
  g.addColorStop(1, alpha(color, 0));
  ctx.fillStyle = g;
  ellipse(ctx, x, y, r, r);
  ctx.fill();
}

function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r * 0.42 : r;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** Tono de piel resultante: la piel del personaje velada por la base. */
export function skinOf(look) {
  const fig = figureById(look.figura);
  if (look.base === 0) return fig.piel;
  // la base matiza, no reemplaza: quien se sienta en la silla sigue siendo quien es
  return mix(fig.piel, PALETTES.base[look.base].c, 0.3);
}

/* ---------------------------------------------------------------- rostro - */

const FACE = {
  chin: 742,
  eye: { y: 452, dx: 92, rx: 58, ry: 30 },
  brow: 382,
  lips: 630,
  cheek: { y: 545, dx: 128 },
};

function headPath(ctx) {
  ctx.beginPath();
  ctx.moveTo(500, 205);
  ctx.bezierCurveTo(645, 205, 712, 322, 712, 452);
  ctx.bezierCurveTo(712, 604, 638, FACE.chin, 500, FACE.chin);
  ctx.bezierCurveTo(362, FACE.chin, 288, 604, 288, 452);
  ctx.bezierCurveTo(288, 322, 355, 205, 500, 205);
  ctx.closePath();
}

function lipPaths(ctx, part) {
  ctx.beginPath();
  if (part === 'arriba') {
    ctx.moveTo(428, 628);
    ctx.quadraticCurveTo(456, 597, 500, 616);
    ctx.quadraticCurveTo(544, 597, 572, 628);
    ctx.quadraticCurveTo(500, 642, 428, 628);
  } else {
    ctx.moveTo(428, 628);
    ctx.quadraticCurveTo(500, 642, 572, 628);
    ctx.quadraticCurveTo(500, 700, 428, 628);
  }
  ctx.closePath();
}

function eyeSocket(ctx, cx) {
  const { y, rx, ry } = FACE.eye;
  ctx.beginPath();
  ctx.ellipse(cx, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.closePath();
}

function drawBackdrop(ctx, tone) {
  const g = ctx.createLinearGradient(0, 0, 0, CANVAS_UNITS);
  g.addColorStop(0, shade(tone, 0.1));
  g.addColorStop(1, shade(tone, -0.12));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CANVAS_UNITS, CANVAS_UNITS);
  soft(ctx, 500, 380, 460, '#ffffff', 0.22);
}

function drawTorso(ctx, fig) {
  const skin = fig._skin;
  ctx.fillStyle = shade(skin, -0.12);
  path(ctx, (c) => {
    c.moveTo(432, 690);
    c.lineTo(568, 690);
    c.lineTo(578, 836);
    c.lineTo(422, 836);
  });
  ctx.fill();

  ctx.fillStyle = fig.traje;
  path(ctx, (c) => {
    c.moveTo(500, 806);
    c.bezierCurveTo(700, 812, 852, 886, 880, 1010);
    c.lineTo(120, 1010);
    c.bezierCurveTo(148, 886, 300, 812, 500, 806);
  });
  ctx.fill();

  // camisa y solapas
  ctx.fillStyle = '#f4f1ea';
  path(ctx, (c) => {
    c.moveTo(500, 812);
    c.lineTo(592, 856);
    c.lineTo(560, 1010);
    c.lineTo(440, 1010);
    c.lineTo(408, 856);
  });
  ctx.fill();

  ctx.fillStyle = shade(fig.traje, 0.08);
  path(ctx, (c) => { c.moveTo(500, 812); c.lineTo(408, 856); c.lineTo(372, 1010); c.lineTo(470, 1010); });
  ctx.fill();
  path(ctx, (c) => { c.moveTo(500, 812); c.lineTo(592, 856); c.lineTo(628, 1010); c.lineTo(530, 1010); });
  ctx.fill();

  if (fig.corbata) {
    ctx.fillStyle = fig.corbata;
    path(ctx, (c) => {
      c.moveTo(500, 826);
      c.lineTo(528, 856);
      c.lineTo(516, 1010);
      c.lineTo(484, 1010);
      c.lineTo(472, 856);
    });
    ctx.fill();
  }
}

function drawHairBack(ctx, fig) {
  const { cabello, pelo } = fig;
  if (pelo === 'melena') {
    ctx.fillStyle = shade(cabello, -0.12);
    path(ctx, (c) => {
      c.moveTo(500, 168);
      c.bezierCurveTo(700, 168, 772, 330, 766, 520);
      c.bezierCurveTo(762, 690, 790, 800, 780, 880);
      c.lineTo(640, 880);
      c.bezierCurveTo(680, 740, 676, 560, 660, 430);
      c.lineTo(340, 430);
      c.bezierCurveTo(324, 560, 320, 740, 360, 880);
      c.lineTo(220, 880);
      c.bezierCurveTo(210, 800, 238, 690, 234, 520);
      c.bezierCurveTo(228, 330, 300, 168, 500, 168);
    });
    ctx.fill();
  }
  if (pelo === 'corto-fem') {
    ctx.fillStyle = shade(cabello, -0.1);
    ellipse(ctx, 500, 430, 246, 290);
    ctx.fill();
  }
}

function drawEars(ctx, fig) {
  ctx.fillStyle = fig._skin;
  ctx.strokeStyle = shade(fig._skin, -0.25);
  ctx.lineWidth = 3;
  for (const x of [288, 712]) {
    ellipse(ctx, x, 480, 30, 48);
    ctx.fill();
    ctx.stroke();
  }
  if (fig.aretes) {
    ctx.fillStyle = '#e3b341';
    for (const x of [286, 714]) {
      ellipse(ctx, x, 530, 16, 16);
      ctx.fill();
      ellipse(ctx, x, 566, 22, 26);
      ctx.strokeStyle = '#e3b341';
      ctx.lineWidth = 7;
      ctx.stroke();
    }
  }
}

function drawHairFront(ctx, fig) {
  const { cabello, pelo } = fig;
  ctx.fillStyle = cabello;
  if (pelo === 'turbante') {
    ctx.fillStyle = fig.tocado || cabello;
    path(ctx, (c) => {
      c.moveTo(276, 420);
      c.bezierCurveTo(258, 250, 360, 120, 500, 120);
      c.bezierCurveTo(648, 120, 748, 250, 726, 420);
      c.bezierCurveTo(700, 330, 640, 296, 500, 296);
      c.bezierCurveTo(362, 296, 300, 330, 276, 420);
    });
    ctx.fill();
    ctx.strokeStyle = shade(fig.tocado || cabello, -0.2);
    ctx.lineWidth = 9;
    for (const [x1, y1, x2, y2] of [[300, 350, 700, 350], [312, 290, 690, 290], [338, 228, 664, 228]]) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(500, y1 - 74, x2, y2);
      ctx.stroke();
    }
    ctx.fillStyle = shade(fig.tocado || cabello, 0.12);
    ellipse(ctx, 690, 196, 58, 44, -0.5);
    ctx.fill();
    return;
  }

  if (pelo === 'rizado') {
    ctx.fillStyle = cabello;
    const rng = Rng('rizos');
    for (let i = 0; i <= 26; i++) {
      const a = Math.PI + (Math.PI * i) / 26;
      const r = 232 + rng() * 12;
      ellipse(ctx, 500 + Math.cos(a) * r, 448 + Math.sin(a) * r * 1.05, 44 + rng() * 14, 42 + rng() * 12);
      ctx.fill();
    }
    return;
  }

  const caps = {
    ondulado: (c) => {
      c.moveTo(272, 520);
      c.bezierCurveTo(256, 300, 360, 166, 500, 166);
      c.bezierCurveTo(640, 166, 744, 300, 728, 520);
      c.bezierCurveTo(716, 430, 706, 328, 664, 300);
      c.bezierCurveTo(604, 344, 548, 320, 500, 292);
      c.bezierCurveTo(452, 326, 396, 336, 342, 302);
      c.bezierCurveTo(298, 330, 286, 430, 272, 520);
    },
    peinado: (c) => {
      c.moveTo(276, 500);
      c.bezierCurveTo(262, 292, 366, 172, 500, 172);
      c.bezierCurveTo(636, 172, 740, 292, 726, 500);
      c.bezierCurveTo(716, 404, 702, 300, 604, 286);
      c.bezierCurveTo(474, 268, 364, 296, 332, 330);
      c.bezierCurveTo(302, 376, 288, 432, 276, 500);
    },
    corto: (c) => {
      c.moveTo(280, 500);
      c.bezierCurveTo(268, 300, 370, 178, 500, 178);
      c.bezierCurveTo(630, 178, 732, 300, 720, 500);
      c.bezierCurveTo(708, 400, 690, 312, 620, 304);
      c.bezierCurveTo(540, 294, 440, 294, 376, 306);
      c.bezierCurveTo(310, 316, 292, 400, 280, 500);
    },
    'corto-fem': (c) => {
      c.moveTo(264, 548);
      c.bezierCurveTo(250, 286, 360, 158, 500, 158);
      c.bezierCurveTo(644, 158, 754, 286, 740, 548);
      c.bezierCurveTo(726, 452, 712, 332, 656, 306);
      c.bezierCurveTo(566, 352, 426, 342, 348, 288);
      c.bezierCurveTo(300, 330, 278, 436, 264, 548);
    },
    melena: (c) => {
      c.moveTo(268, 560);
      c.bezierCurveTo(256, 280, 362, 158, 500, 158);
      c.bezierCurveTo(640, 158, 748, 280, 734, 560);
      c.bezierCurveTo(720, 440, 702, 322, 630, 300);
      c.bezierCurveTo(524, 364, 402, 346, 340, 290);
      c.bezierCurveTo(300, 340, 282, 444, 268, 560);
    },
  };
  path(ctx, caps[pelo] || caps.corto);
  ctx.fill();
}

function drawBrows(ctx, look, fig) {
  const estilo = optionOf(look, 'cejas');
  const grosor = { natural: 10, definidas: 15, laminadas: 19 }[estilo] * (0.86 + fig.cejas * 0.06);
  const color = estilo === 'laminadas' ? shade(fig.cabello, -0.25) : shade(fig.cabello, -0.15);
  ctx.strokeStyle = color;
  ctx.lineWidth = grosor;
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    const cx = 500 + s * FACE.eye.dx;
    ctx.beginPath();
    if (estilo === 'definidas') {
      ctx.moveTo(cx - s * 62, FACE.brow + 14);
      ctx.quadraticCurveTo(cx - s * 6, FACE.brow - 30, cx + s * 54, FACE.brow + 4);
    } else {
      ctx.moveTo(cx - s * 60, FACE.brow + 10);
      ctx.quadraticCurveTo(cx, FACE.brow - 22, cx + s * 56, FACE.brow + 10);
    }
    ctx.stroke();
  }
  if (estilo === 'laminadas') {
    // el pelo peinado hacia arriba deja un filo más claro en el borde de arriba
    ctx.lineWidth = grosor * 0.3;
    ctx.strokeStyle = alpha(shade(fig.cabello, 0.35), 0.75);
    for (const s of [-1, 1]) {
      const cx = 500 + s * FACE.eye.dx;
      ctx.beginPath();
      ctx.moveTo(cx - s * 52, FACE.brow + 2);
      ctx.quadraticCurveTo(cx, FACE.brow - 28, cx + s * 48, FACE.brow + 3);
      ctx.stroke();
    }
  }
}

function drawShadow(ctx, look) {
  const color = colorOf(look, 'sombra');
  const estilo = optionOf(look, 'sombraEstilo');
  const { y, dx, rx } = FACE.eye;
  for (const s of [-1, 1]) {
    const cx = 500 + s * dx;
    ctx.save();
    if (estilo === 'suave') {
      soft(ctx, cx, y - 26, rx * 1.25, color, 0.62);
    } else if (estilo === 'humo') {
      soft(ctx, cx, y - 16, rx * 1.7, color, 0.7);
      soft(ctx, cx + s * 26, y + 26, rx * 0.8, color, 0.4);
    } else if (estilo === 'gato') {
      ctx.fillStyle = alpha(color, 0.72);
      path(ctx, (c) => {
        c.moveTo(cx - s * rx, y - 8);
        c.quadraticCurveTo(cx, y - 60, cx + s * rx * 0.9, y - 34);
        c.quadraticCurveTo(cx + s * (rx + 52), y - 66, cx + s * (rx + 62), y - 22);
        c.quadraticCurveTo(cx + s * rx, y - 6, cx - s * rx, y - 8);
      });
      ctx.fill();
      soft(ctx, cx, y - 22, rx, color, 0.35);
    } else {
      ctx.fillStyle = alpha(color, 0.85);
      path(ctx, (c) => {
        c.moveTo(cx - s * rx * 1.05, y - 16);
        c.quadraticCurveTo(cx, y - 74, cx + s * rx * 1.1, y - 20);
        c.quadraticCurveTo(cx, y - 34, cx - s * rx * 1.05, y - 16);
      });
      ctx.fill();
      ctx.fillStyle = alpha(shade(color, 0.5), 0.9);
      ellipse(ctx, cx, y - 14, rx * 0.55, 9);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawEyes(ctx, look, fig) {
  const { y, dx, rx, ry } = FACE.eye;
  for (const s of [-1, 1]) {
    const cx = 500 + s * dx;
    ctx.fillStyle = '#fbf8f3';
    eyeSocket(ctx, cx);
    ctx.fill();
    ctx.save();
    eyeSocket(ctx, cx);
    ctx.clip();
    ctx.fillStyle = fig.ojos || '#4a3524';
    ellipse(ctx, cx, y + 2, 23, 23);
    ctx.fill();
    ctx.fillStyle = '#12100e';
    ellipse(ctx, cx, y + 2, 10, 10);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ellipse(ctx, cx - 8, y - 7, 6, 6);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = shade(fig._skin, -0.4);
    ctx.lineWidth = 3;
    eyeSocket(ctx, cx);
    ctx.stroke();
    // párpado
    ctx.strokeStyle = alpha(shade(fig._skin, -0.35), 0.5);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.95, y - ry * 0.5);
    ctx.quadraticCurveTo(cx, y - ry * 1.7, cx + rx * 0.95, y - ry * 0.5);
    ctx.stroke();
  }
}

function drawLiner(ctx, look) {
  const estilo = optionOf(look, 'delineador');
  if (estilo === 'ninguno') return;
  const { y, dx, rx, ry } = FACE.eye;
  const grosor = { fino: 6, alado: 9, grafico: 9 }[estilo];
  ctx.strokeStyle = '#14120f';
  ctx.lineCap = 'round';
  ctx.lineWidth = grosor;
  for (const s of [-1, 1]) {
    const cx = 500 + s * dx;
    ctx.beginPath();
    ctx.moveTo(cx - s * rx, y - 4);
    ctx.quadraticCurveTo(cx, y - ry - 8, cx + s * rx * 0.98, y - 6);
    ctx.stroke();
    if (estilo !== 'fino') {
      ctx.beginPath();
      ctx.moveTo(cx + s * rx * 0.9, y - 8);
      ctx.quadraticCurveTo(cx + s * (rx + 30), y - 22, cx + s * (rx + 54), y - 44);
      ctx.lineWidth = grosor * 0.8;
      ctx.stroke();
    }
    if (estilo === 'grafico') {
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(cx - s * rx * 0.6, y - 46);
      ctx.quadraticCurveTo(cx + s * 16, y - 62, cx + s * (rx + 30), y - 52);
      ctx.stroke();
    }
  }
}

function drawLashes(ctx, look) {
  const estilo = optionOf(look, 'pestanas');
  const { y, dx, rx, ry } = FACE.eye;
  const largo = { natural: 12, rizadas: 22, dramaticas: 34 }[estilo];
  const grosor = { natural: 3, rizadas: 5, dramaticas: 7 }[estilo];
  ctx.strokeStyle = '#141210';
  ctx.lineWidth = grosor;
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    const cx = 500 + s * dx;
    for (let i = -2; i <= 2; i++) {
      const t = i / 2;
      const px = cx + t * rx * 0.85;
      const py = y - Math.cos(t * 1.2) * ry * 0.92;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + s * largo * 0.4, py - largo * 0.7, px + s * largo * 0.85, py - largo);
      ctx.stroke();
    }
    if (estilo === 'dramaticas') {
      ctx.lineWidth = 3;
      for (let i = -1; i <= 1; i++) {
        const px = cx + i * rx * 0.5;
        ctx.beginPath();
        ctx.moveTo(px, y + ry * 0.85);
        ctx.lineTo(px + i * 4, y + ry * 0.85 + 14);
        ctx.stroke();
      }
    }
  }
}

function drawNose(ctx, fig) {
  ctx.strokeStyle = shade(fig._skin, -0.28);
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(500, 470);
  ctx.lineTo(486, 548);
  ctx.quadraticCurveTo(500, 566, 522, 550);
  ctx.stroke();
  ctx.fillStyle = alpha(shade(fig._skin, -0.35), 0.55);
  ellipse(ctx, 470, 556, 9, 6);
  ctx.fill();
  ellipse(ctx, 534, 556, 9, 6);
  ctx.fill();
}

function drawLips(ctx, look) {
  const color = colorOf(look, 'labial');
  const acabado = optionOf(look, 'labialAcabado');
  for (const part of ['arriba', 'abajo']) {
    lipPaths(ctx, part);
    if (acabado === 'metalico') {
      const g = ctx.createLinearGradient(430, 600, 570, 690);
      g.addColorStop(0, shade(color, 0.45));
      g.addColorStop(0.45, color);
      g.addColorStop(1, shade(color, -0.3));
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = part === 'arriba' ? shade(color, -0.12) : color;
    }
    ctx.fill();
  }
  ctx.strokeStyle = alpha(shade(color, -0.45), 0.8);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(428, 628);
  ctx.quadraticCurveTo(500, 642, 572, 628);
  ctx.stroke();
  if (acabado === 'gloss') {
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ellipse(ctx, 500, 650, 30, 9);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ellipse(ctx, 474, 618, 16, 6, -0.3);
    ctx.fill();
  }
}

function drawFacialHair(ctx, fig) {
  if (!fig.vello || fig.vello === 'ninguno') return;
  const color = alpha(shade(fig.cabello, -0.2), 0.85);
  ctx.fillStyle = color;
  if (fig.vello === 'barba') {
    ctx.save();
    headPath(ctx);
    ctx.clip();
    path(ctx, (c) => {
      c.moveTo(318, 500);
      c.bezierCurveTo(330, 700, 400, 770, 500, 770);
      c.bezierCurveTo(600, 770, 670, 700, 682, 500);
      c.bezierCurveTo(660, 620, 600, 660, 500, 660);
      c.bezierCurveTo(400, 660, 340, 620, 318, 500);
    });
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = color;
  path(ctx, (c) => {
    c.moveTo(444, 592);
    c.quadraticCurveTo(500, 572, 556, 592);
    c.quadraticCurveTo(500, 606, 444, 592);
  });
  ctx.fill();
}

function drawGlasses(ctx, fig) {
  if (!fig.gafas || fig.gafas === 'ninguno') return;
  ctx.strokeStyle = '#2a2622';
  ctx.lineWidth = 8;
  ctx.lineJoin = 'round';
  const { y, dx } = FACE.eye;
  for (const s of [-1, 1]) {
    const cx = 500 + s * dx;
    ctx.beginPath();
    if (fig.gafas === 'redondo') ctx.ellipse(cx, y, 74, 66, 0, 0, Math.PI * 2);
    else ctx.roundRect(cx - 78, y - 52, 156, 100, 18);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + s * 78, y - 16);
    ctx.lineTo(cx + s * 140, y - 30);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(500 - dx + 76, y - 6);
  ctx.quadraticCurveTo(500, y - 22, 500 + dx - 76, y - 6);
  ctx.stroke();
}

function drawExtras(ctx, look, fig) {
  // los extras brillan en el tono de la sombra: así el rostro sigue leyéndose
  // como una sola idea y no como tres maquillajes distintos a la vez
  const brillo = colorOf(look, 'sombra');
  if (hasExtra(look, 'antifaz')) {
    ctx.save();
    headPath(ctx);
    ctx.clip();
    ctx.fillStyle = alpha(brillo, 0.45);
    path(ctx, (c) => {
      c.moveTo(300, 420);
      c.quadraticCurveTo(500, 356, 700, 420);
      c.quadraticCurveTo(700, 520, 592, 516);
      c.quadraticCurveTo(500, 470, 408, 516);
      c.quadraticCurveTo(300, 520, 300, 420);
    });
    ctx.fill();
    ctx.restore();
  }
  if (hasExtra(look, 'pecas')) {
    const rng = Rng('pecas');
    ctx.fillStyle = alpha(mix(fig._skin, '#6b3f22', 0.62), 0.5);
    for (let i = 0; i < 30; i++) {
      const lado = i % 2 ? 1 : -1;
      const x = 500 + lado * (46 + rng() * 148);
      const y = 486 + rng() * 82;
      ellipse(ctx, x, y, 2.6 + rng() * 2, 2.4 + rng() * 1.6);
      ctx.fill();
    }
    for (let i = 0; i < 6; i++) {           // unas pocas cruzando el puente
      ellipse(ctx, 470 + rng() * 60, 470 + rng() * 30, 2.4 + rng() * 1.4, 2.2 + rng());
      ctx.fill();
    }
  }
  if (hasExtra(look, 'purpurina')) {
    const rng = Rng('purpurina');
    for (let i = 0; i < 34; i++) {
      const a = rng() * Math.PI * 2;
      const r = 60 + rng() * 180;
      const x = 500 + Math.cos(a) * r;
      const y = 470 + Math.sin(a) * r * 0.72;
      ctx.fillStyle = alpha(rng() > 0.5 ? brillo : '#ffffff', 0.55 + rng() * 0.4);
      star(ctx, x, y, 5 + rng() * 7);
      ctx.fill();
    }
  }
  if (hasExtra(look, 'pedreria')) {
    for (const s of [-1, 1]) {
      const cx = 500 + s * (FACE.eye.dx + FACE.eye.rx + 12);
      for (let i = 0; i < 4; i++) {
        const x = cx + s * i * 14;
        const y = FACE.eye.y - 20 - i * 16;
        ctx.fillStyle = brillo;
        ellipse(ctx, x, y, 10 - i, 10 - i);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ellipse(ctx, x - 2.5, y - 2.5, 3.2, 3.2);
        ctx.fill();
      }
    }
  }
  if (hasExtra(look, 'lunar')) {
    ctx.fillStyle = '#3a2418';
    ellipse(ctx, 578, 588, 9, 8);
    ctx.fill();
  }
}

/** Dibuja la lámina del rostro completa. */
export function paintFace(ctx, look, tone = '#efe3e0') {
  const fig = { ...figureById(look.figura), _skin: skinOf(look) };
  ctx.save();
  drawBackdrop(ctx, tone);
  drawHairBack(ctx, fig);
  drawTorso(ctx, fig);
  drawEars(ctx, fig);

  // cabeza
  ctx.save();
  headPath(ctx);
  ctx.fillStyle = fig._skin;
  ctx.fill();
  ctx.clip();

  if (look.contorno > 0) {
    const k = look.contorno / 3;
    const sombra = shade(fig._skin, -0.55);
    for (const s of [-1, 1]) {
      soft(ctx, 500 + s * 216, 496, 112 + k * 34, sombra, 0.16 + k * 0.24);
      soft(ctx, 500 + s * 152, 600, 72 + k * 24, sombra, 0.1 + k * 0.2);
    }
    soft(ctx, 500, 252, 150 + k * 40, sombra, 0.1 + k * 0.12);
    soft(ctx, 500, 724, 118 + k * 26, sombra, 0.08 + k * 0.16);
  }
  if (look.brillo > 0) {
    const k = look.brillo / 3;
    for (const [x, y, r] of [[398, 512, 70], [602, 512, 70], [500, 400, 54], [500, 706, 46]]) {
      soft(ctx, x, y, r * (0.8 + k * 0.5), '#fff6e8', 0.2 + k * 0.45);
    }
  }
  if (look.ruborInt > 0) {
    const k = look.ruborInt / 3;
    for (const s of [-1, 1]) {
      soft(ctx, 500 + s * FACE.cheek.dx, FACE.cheek.y, 96 + k * 26, colorOf(look, 'rubor'), 0.22 + k * 0.42);
    }
  }
  ctx.restore();

  drawShadow(ctx, look);
  drawEyes(ctx, look, fig);
  drawLiner(ctx, look);
  drawLashes(ctx, look);
  drawBrows(ctx, look, fig);
  drawNose(ctx, fig);
  drawFacialHair(ctx, fig);
  drawLips(ctx, look);
  drawHairFront(ctx, fig);
  drawGlasses(ctx, fig);
  drawExtras(ctx, look, fig);
  ctx.restore();
}

/** Qué herramienta corresponde al punto tocado del rostro (espacio 1000). */
export function faceHit(x, y) {
  const { eye, cheek, brow } = FACE;
  if (y > 560 && y < 700 && Math.abs(x - 500) < 110) return 'labial';
  if (y > brow - 46 && y < brow + 28 && Math.abs(x - 500) > 20 && Math.abs(x - 500) < 180) return 'cejas';
  if (y > brow + 28 && y < eye.y + 46 && Math.abs(x - 500) < 200) return 'sombra';
  if (y > cheek.y - 80 && y < cheek.y + 80 && Math.abs(x - 500) > 60 && Math.abs(x - 500) < 220) return 'rubor';
  if (y > 120 && y < 760) return 'base';
  return null;
}

/* ----------------------------------------------------------------- manos - */

/* Los cinco dedos: base, punta y grosor. El pulgar sale en diagonal, como
   en cualquier mano que se apoya en la mesa de manicura. */
const FINGERS = [
  { x1: 372, y1: 768, x2: 356, y2: 404, w: 104 },
  { x1: 490, y1: 752, x2: 486, y2: 352, w: 108 },
  { x1: 606, y1: 758, x2: 618, y2: 398, w: 104 },
  { x1: 708, y1: 790, x2: 734, y2: 492, w: 90 },
  { x1: 368, y1: 876, x2: 216, y2: 700, w: 112 },
];

const SHAPES = {
  redonda: { tip: 0.84, len: 0.78, bow: 0.03, round: 1.0 },
  ovalada: { tip: 0.64, len: 1.0, bow: 0.05, round: 1.05 },
  almendra: { tip: 0.34, len: 1.28, bow: 0.06, round: 0.95 },
  cuadrada: { tip: 0.96, len: 0.86, bow: 0.0, round: 0.12 },
  coffin: { tip: 0.5, len: 1.22, bow: 0.0, round: 0.08 },
  stiletto: { tip: 0.1, len: 1.55, bow: 0.02, round: 0.45 },
};

function nailPath(ctx, w, h, forma) {
  const p = SHAPES[forma] || SHAPES.ovalada;
  const H = h * p.len;
  const tw = w * p.tip;
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.bezierCurveTo(-w / 2 - p.bow * w, -H * 0.42, -tw / 2, -H * 0.72, -tw / 2, -H);
  ctx.quadraticCurveTo(0, -H - p.round * w * 0.42, tw / 2, -H);
  ctx.bezierCurveTo(tw / 2, -H * 0.72, w / 2 + p.bow * w, -H * 0.42, w / 2, 0);
  ctx.quadraticCurveTo(0, w * 0.18, -w / 2, 0);
  ctx.closePath();
  return H;
}

function nailArt(ctx, look, w, H, base, tinta) {
  const arte = optionOf(look, 'arte');
  if (arte === 'ninguno') return;
  ctx.save();
  if (arte === 'frances') {
    ctx.fillStyle = tinta;
    ctx.beginPath();
    ctx.moveTo(-w, -H * 0.56);
    ctx.quadraticCurveTo(0, -H * 0.34, w, -H * 0.56);
    ctx.lineTo(w, -H * 2);
    ctx.lineTo(-w, -H * 2);
    ctx.closePath();
    ctx.fill();
  } else if (arte === 'puntos') {
    ctx.fillStyle = tinta;
    for (let r = 0; r < 4; r++) {
      for (let c = -1; c <= 1; c++) {
        const y = -H * (0.2 + r * 0.22);
        const x = c * w * 0.26 + (r % 2 ? w * 0.13 : 0);
        ellipse(ctx, x, y, w * 0.08, w * 0.08);
        ctx.fill();
      }
    }
  } else if (arte === 'rayas') {
    ctx.strokeStyle = tinta;
    ctx.lineWidth = w * 0.1;
    ctx.lineCap = 'round';
    for (let i = -1; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(-w * 0.5, -H * (0.15 + i * 0.26));
      ctx.lineTo(w * 0.5, -H * (0.38 + i * 0.26));
      ctx.stroke();
    }
  } else if (arte === 'estrellas') {
    ctx.fillStyle = tinta;
    for (const [x, y, r] of [[-0.16, 0.3, 0.17], [0.18, 0.56, 0.13], [-0.05, 0.8, 0.1]]) {
      star(ctx, x * w, -y * H, r * w);
      ctx.fill();
    }
  } else if (arte === 'flores') {
    for (const [x, y, r] of [[-0.14, 0.34, 0.15], [0.16, 0.66, 0.12]]) {
      ctx.fillStyle = tinta;
      for (let i = 0; i < 5; i++) {
        const a = (Math.PI * 2 * i) / 5;
        ellipse(ctx, x * w + Math.cos(a) * r * w, -y * H + Math.sin(a) * r * w, r * w * 0.62, r * w * 0.62);
        ctx.fill();
      }
      ctx.fillStyle = shade(base, -0.35);
      ellipse(ctx, x * w, -y * H, r * w * 0.5, r * w * 0.5);
      ctx.fill();
    }
  } else if (arte === 'degradado') {
    const g = ctx.createLinearGradient(0, 0, 0, -H);
    g.addColorStop(0, alpha(base, 0));
    g.addColorStop(1, tinta);
    ctx.fillStyle = g;
    ctx.fillRect(-w, -H * 1.4, w * 2, H * 1.4);
  } else if (arte === 'tricolor') {
    // amarillo la mitad de arriba, azul y rojo un cuarto cada uno
    const bandas = [['#f5c518', 1.6, 1.1], ['#1b6fb5', 0.5, 0.25], ['#d4212a', 0.25, 0.25]];
    for (const [c, top, alto] of bandas) {
      ctx.fillStyle = c;
      ctx.fillRect(-w, -H * top, w * 2, H * alto);
    }
  }
  ctx.restore();
}

function drawNail(ctx, look, x, y, ang, w, acento) {
  const forma = optionOf(look, 'forma');
  const acabado = optionOf(look, 'acabado');
  const esmalte = colorOf(look, 'esmalte');
  const tintaArte = colorOf(look, 'arteColor');
  const base = acento ? tintaArte : esmalte;
  const tinta = acento ? esmalte : tintaArte;
  const nw = w * 0.74;
  const nh = w * (0.62 + look.largo * 0.26);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);

  ctx.save();
  ctx.shadowColor = 'rgba(40, 20, 30, 0.35)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  const H = nailPath(ctx, nw, nh, forma);
  ctx.fillStyle = base;
  ctx.fill();
  ctx.restore();

  const H2 = nailPath(ctx, nw, nh, forma);
  ctx.save();
  ctx.clip();
  nailArt(ctx, look, nw, H2, base, tinta);

  if (acabado === 'cromado') {
    const g = ctx.createLinearGradient(-nw / 2, 0, nw / 2, -H2);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.05)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = g;
    ctx.fillRect(-nw, -H2 * 1.6, nw * 2, H2 * 1.8);
  } else if (acabado === 'mate') {
    ctx.fillStyle = 'rgba(245, 240, 236, 0.14)';
    ctx.fillRect(-nw, -H2 * 1.6, nw * 2, H2 * 1.8);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ellipse(ctx, -nw * 0.2, -H2 * 0.66, nw * 0.16, H2 * 0.2, 0.3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ellipse(ctx, nw * 0.22, -H2 * 0.4, nw * 0.1, H2 * 0.14, -0.2);
    ctx.fill();
  }
  ctx.restore();

  nailPath(ctx, nw, nh, forma);
  ctx.strokeStyle = alpha(shade(base, -0.45), 0.55);
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();
}

/** Dibuja la lámina de la mano con las cinco uñas. */
export function paintHand(ctx, look, tone = '#efe3e0') {
  const fig = figureById(look.figura);
  const skin = skinOf(look);
  ctx.save();
  drawBackdrop(ctx, tone);

  // la toalla del puesto de manicura
  ctx.fillStyle = alpha('#ffffff', 0.3);
  ctx.beginPath();
  ctx.roundRect(60, 690, 880, 310, 46);
  ctx.fill();

  // La mano se dibuja dos veces: primero el contorno, en un tono más oscuro y
  // más gordo, y encima la piel. Así queda una línea limpia alrededor de todo
  // y entre los dedos, sin tener que unir las siluetas a mano.
  const cuerpo = (crece, color) => {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.roundRect(290 - crece, 640 - crece, 496 + crece * 2, 330 + crece * 2, 150);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(392 - crece, 870 - crece, 296 + crece * 2, 170 + crece * 2, 64);
    ctx.fill();
    for (const f of FINGERS) capsule(ctx, f.x1, f.y1, f.x2, f.y2, f.w + crece * 2);
  };

  ctx.save();
  ctx.shadowColor = 'rgba(60, 30, 40, 0.26)';
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 12;
  cuerpo(7, shade(skin, -0.3));
  ctx.restore();
  cuerpo(0, skin);

  // el hueco de la palma, nada más
  ctx.fillStyle = alpha(shade(skin, -0.35), 0.13);
  ellipse(ctx, 532, 806, 152, 72, -0.08);
  ctx.fill();

  // manga
  ctx.fillStyle = fig.traje;
  ctx.beginPath();
  ctx.roundRect(370, 962, 340, 92, 34);
  ctx.fill();

  for (let i = 0; i < FINGERS.length; i++) {
    const f = FINGERS[i];
    const ang = Math.atan2(f.y2 - f.y1, f.x2 - f.x1) + Math.PI / 2;
    drawNail(ctx, look, f.x2, f.y2, ang, f.w, look.acento === i + 1);
  }
  ctx.restore();
}

/** Índice de uña (0..4) bajo el punto, o -1. Espacio 1000. */
export function nailHit(x, y) {
  let best = -1;
  let bestD = 96;
  for (let i = 0; i < FINGERS.length; i++) {
    const f = FINGERS[i];
    const d = Math.hypot(x - f.x2, y - f.y2);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}
