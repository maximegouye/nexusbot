// ============================================================
// wheelImage.js — Génération de GIFs animés de roues qui tournent
// Utilise @napi-rs/canvas + gif-encoder-2 (prebuilt, pas de deps natives apt)
// Si les libs ne chargent pas → null retourné, le caller fallback sur ASCII.
// ============================================================

let createCanvas = null;
let GIFEncoder   = null;
try {
  ({ createCanvas } = require('@napi-rs/canvas'));
  GIFEncoder = require('gif-encoder-2');
} catch (e) {
  console.log('[wheelImage] libs canvas/gif indisponibles → fallback ASCII. (' + e.message.split('\n')[0] + ')');
}

function isAvailable() {
  return !!(createCanvas && GIFEncoder);
}

// ─── Easing cubic ease-out ────────────────────────────────────
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

// ─── Helper: lighten/darken hex color ─────────────────────────
function shadeColor(hex, percent) {
  const c = hex.replace('#', '');
  const num = parseInt(c, 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + percent));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + percent));
  const b = Math.max(0, Math.min(255, (num & 0xff) + percent));
  return `rgb(${r},${g},${b})`;
}

// ─── Dessine une roue à N segments ────────────────────────────
// segments: [{ label, color, emoji? }] (color = #hex)
// rotation: angle de rotation en RADIANS (la roue est tournée DE rotation)
// highlight: index du segment gagnant à mettre en évidence (-1 = aucun)
function drawWheel(ctx, segments, rotation, size, opts = {}) {
  const N = segments.length;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.42;
  const angle = (2 * Math.PI) / N;

  // Fond de la roue (cercle externe)
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 12, 0, 2 * Math.PI);
  ctx.fillStyle = '#1A1A1A';
  ctx.fill();
  ctx.restore();

  // Bordure dorée
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 8, 0, 2 * Math.PI);
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 6;
  ctx.stroke();

  // Segments (le top — angle 0 — pointe vers le haut)
  // L'angle de référence est -π/2 pour avoir le segment 0 en haut
  for (let i = 0; i < N; i++) {
    const a0 = -Math.PI / 2 + i * angle - angle / 2 + rotation;
    const a1 = -Math.PI / 2 + i * angle + angle / 2 + rotation;
    const seg = segments[i];

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, a0, a1);
    ctx.closePath();

    // Gradient pour chaque segment (effet 3D)
    const grad = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius);
    grad.addColorStop(0, shadeColor(seg.color, 30));
    grad.addColorStop(1, seg.color);
    ctx.fillStyle = grad;
    ctx.fill();

    // Bordure entre segments
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Texte / emoji au milieu du segment
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 2 + i * angle + rotation);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    const fontSize = N <= 12 ? 18 : N <= 20 ? 14 : 10;
    ctx.font = `bold ${fontSize}px sans-serif`;
    const label = (seg.shortLabel || seg.label || '').slice(0, 14);
    const x = radius - 18;
    ctx.strokeText(label, x, 0);
    ctx.fillText(label, x, 0);
    ctx.restore();
  }

  // Hub central
  ctx.beginPath();
  ctx.arc(cx, cy, 32, 0, 2 * Math.PI);
  const hubGrad = ctx.createRadialGradient(cx - 8, cy - 8, 4, cx, cy, 32);
  hubGrad.addColorStop(0, '#FFE680');
  hubGrad.addColorStop(1, '#B8860B');
  ctx.fillStyle = hubGrad;
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3;
  ctx.stroke();
}

// ─── Dessine le pointeur fixe en haut ─────────────────────────
function drawPointer(ctx, size) {
  const cx = size / 2;
  const top = size * 0.05;

  // Pointeur (triangle pointant vers le bas)
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(cx - 18, top);
  ctx.lineTo(cx + 18, top);
  ctx.lineTo(cx, top + 32);
  ctx.closePath();

  const grad = ctx.createLinearGradient(cx - 18, top, cx + 18, top + 32);
  grad.addColorStop(0, '#FFD700');
  grad.addColorStop(1, '#B8860B');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

// ─── Génère un GIF animé de la roue qui tourne ────────────────
// segments : [{ label, color, shortLabel? }]
// finalIdx : index du segment gagnant
// options  : { size, frames, rotations, holdFrames }
async function generateWheelGif(segments, finalIdx, options = {}) {
  if (!isAvailable()) return null;

  // Tailles optimisées pour Discord : ~600KB à 1.2MB max, gen <1sec
  const size = options.size || 360;
  const frames = options.frames || 24;
  const rotations = options.rotations || 4;
  const holdFrames = options.holdFrames || 6;

  // 'neuquant' = palette optimisée, 'octree' = plus rapide mais moins fluide
  const enc = new GIFEncoder(size, size, 'octree', true, frames + holdFrames);
  enc.start();
  enc.setRepeat(-1); // ne joue qu'une fois (pas de loop)
  enc.setQuality(20); // 20 = compromis taille/qualité (1=meilleure, 30=plus petite)

  const N = segments.length;

  // L'angle final pour que le segment finalIdx soit pile sous le pointeur (top, angle 0).
  // La roue est dessinée avec segment 0 en haut + rotation. Donc pour que le segment finalIdx
  // soit en haut, rotation = -finalIdx * (2π/N) (mod 2π). On part d'un angle 0 (segment 0 en haut)
  // et on fait `rotations` tours complets PUIS on s'arrête sur finalIdx.
  const segAngle = (2 * Math.PI) / N;
  const finalAngle = -finalIdx * segAngle;
  const totalAngle = (-rotations * 2 * Math.PI) + finalAngle; // tourne dans le sens horaire

  // Animation : ease-out cubic
  for (let f = 1; f <= frames; f++) {
    const t = f / frames;
    const e = easeOutCubic(t);
    const rotation = totalAngle * e;

    const c = createCanvas(size, size);
    const ctx = c.getContext('2d');

    // Fond noir
    ctx.fillStyle = '#0A0A0F';
    ctx.fillRect(0, 0, size, size);

    drawWheel(ctx, segments, rotation, size);
    drawPointer(ctx, size);

    // Délai variable (cinématique : court → long)
    const delay = Math.round(40 + 220 * Math.pow(t, 1.7));
    enc.setDelay(delay);
    enc.addFrame(ctx);
  }

  // Hold sur le segment final pour bien voir le résultat
  for (let h = 0; h < holdFrames; h++) {
    const c = createCanvas(size, size);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0A0A0F';
    ctx.fillRect(0, 0, size, size);
    drawWheel(ctx, segments, totalAngle, size);
    drawPointer(ctx, size);

    // Flash effect : alterne couleur de fond
    if (h % 2 === 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = 'rgba(255,215,0,0.15)';
      ctx.fillRect(0, 0, size, size);
      ctx.restore();
    }

    enc.setDelay(220);
    enc.addFrame(ctx);
  }

  enc.finish();
  return enc.out.getData();
}

// ─── Génère un GIF de roulette de casino (37 ou 38 numéros) ───
// wheelOrder : ordre des numéros sur le cylindre (européen ou américain)
// resultIdx  : index dans wheelOrder du numéro gagnant
async function generateRouletteGif(wheelOrder, resultIdx, options = {}) {
  if (!isAvailable()) return null;

  // Construit les segments depuis l'ordre du cylindre
  const RED_NUMS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  const segments = wheelOrder.map(n => {
    let color;
    if (n === 0) color = '#1B7B3F'; // vert
    else if (RED_NUMS.has(n)) color = '#C0392B';
    else color = '#1A1A1A';
    return { label: String(n), shortLabel: String(n), color };
  });

  return generateWheelGif(segments, resultIdx, {
    size: options.size || 420,
    frames: options.frames || 28,
    rotations: options.rotations || 5,
    holdFrames: options.holdFrames || 8,
  });
}

module.exports = {
  isAvailable,
  generateWheelGif,
  generateRouletteGif,
};
