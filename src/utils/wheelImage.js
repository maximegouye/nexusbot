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

// ─── Easings ──────────────────────────────────────────────────
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
// Bounce dramatique en fin de course : la roue dépasse légèrement sa cible
// puis rebondit avant de s'arrêter — donne une vraie impression de bille
// qui résiste à la friction (style casino réel).
function easeOutBounce(t) {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1)         return n1 * t * t;
  if (t < 2 / d1) { t -= 1.5 / d1;  return n1 * t * t + 0.75; }
  if (t < 2.5 / d1) { t -= 2.25 / d1; return n1 * t * t + 0.9375; }
  t -= 2.625 / d1; return n1 * t * t + 0.984375;
}
// Mix : majoritairement cubic (rotation rapide qui décélère) avec un léger
// bounce en fin de course (~15 % de l'amplitude). Évite les rebonds trop
// caricaturaux mais ajoute la sensation de friction réelle.
function easeOutCubicWithBounce(t) {
  const cubic = easeOutCubic(t);
  if (t < 0.85) return cubic;
  // Sur les 15 % finaux, on superpose un mini bounce d'amplitude 0.5°
  const localT = (t - 0.85) / 0.15;
  const bounce = easeOutBounce(localT) - 1; // -1..0
  return cubic + bounce * 0.008; // amplitude réduite — léger overshoot/recul
}

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
  const size = options.size || 380;
  const frames = options.frames || 32;
  const rotations = options.rotations || 5;
  const holdFrames = options.holdFrames || 14;

  // 'neuquant' = palette optimisée (couleurs plus fidèles, idéal casino),
  // 'octree' = plus rapide mais moins fluide. On choisit neuquant pour les
  // GIFs casino car la palette rouge/noir/vert mérite une fidélité couleur.
  const enc = new GIFEncoder(size, size, 'neuquant', true, frames + holdFrames);
  enc.start();
  enc.setRepeat(-1); // ne joue qu'une fois (pas de loop)
  enc.setQuality(15); // 15 = couleurs plus fidèles (1=meilleure, 30=plus petite)

  const N = segments.length;

  // L'angle final pour que le segment finalIdx soit pile sous le pointeur (top, angle 0).
  // La roue est dessinée avec segment 0 en haut + rotation. Donc pour que le segment finalIdx
  // soit en haut, rotation = -finalIdx * (2π/N) (mod 2π). On part d'un angle 0 (segment 0 en haut)
  // et on fait `rotations` tours complets PUIS on s'arrête sur finalIdx.
  const segAngle = (2 * Math.PI) / N;
  const finalAngle = -finalIdx * segAngle;
  const totalAngle = (-rotations * 2 * Math.PI) + finalAngle; // tourne dans le sens horaire

  // Animation : ease-out cubic + léger bounce en fin de course (sensation de
  // friction réelle, comme une vraie bille qui résiste avant de se poser).
  for (let f = 1; f <= frames; f++) {
    const t = f / frames;
    const e = easeOutCubicWithBounce(t);
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

  // Hold sur le segment final — séquence dramatique :
  // 1. Frame fixe sans flash (la bille s'est posée)
  // 2. Flash blanc rapide (révélation)
  // 3. Pulses dorés alternés (célébration)
  // 4. Frame finale stable (le joueur peut lire confortablement)
  for (let h = 0; h < holdFrames; h++) {
    const c = createCanvas(size, size);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0A0A0F';
    ctx.fillRect(0, 0, size, size);
    drawWheel(ctx, segments, totalAngle, size);
    drawPointer(ctx, size);

    // Phase 1 : flash blanc bref sur la 2e frame du hold (reveal moment)
    if (h === 1) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(0, 0, size, size);
      ctx.restore();
      enc.setDelay(80);
    }
    // Phase 2 : pulses dorés alternés (frames 2-7) — effet "winner glow"
    else if (h >= 2 && h <= 7) {
      const pulseIntensity = h % 2 === 0 ? 0.28 : 0.10;
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = `rgba(255,215,0,${pulseIntensity})`;
      ctx.fillRect(0, 0, size, size);
      ctx.restore();
      enc.setDelay(140);
    }
    // Phase 3 : pause finale stable (les frames de fin) — lecture confort
    else {
      enc.setDelay(h === holdFrames - 1 ? 1200 : 320);
    }

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
    frames: options.frames || 36,
    rotations: options.rotations || 6,
    holdFrames: options.holdFrames || 16,
  });
}

// ─── Génère un GIF de Plinko (bille qui tombe à travers les pegs) ───
// path : array d'indices de colonnes [start, ...intermediates, finalSlot]
// mults : array de multiplicateurs pour chaque slot du bas
// finalSlot : index du slot final
async function generatePlinkoGif(path, mults, options = {}) {
  if (!isAvailable()) return null;

  const W = options.width || 360;
  const H = options.height || 480;
  const ROWS = path.length - 1; // nombre de rangées de pegs
  const COLS = mults.length; // nombre de slots du bas

  // Géométrie
  const padTop = 40;
  const padBottom = 70;
  const padX = 30;
  const boardW = W - 2 * padX;
  const boardH = H - padTop - padBottom;
  const rowSpacing = boardH / (ROWS + 1);
  const colSpacing = boardW / (COLS - 1);

  function pegX(col) { return padX + col * colSpacing; }
  function pegY(row) { return padTop + row * rowSpacing; }

  // Couleurs des slots selon multiplicateur
  function slotColor(m) {
    if (m >= 10) return '#3498DB';
    if (m >= 5)  return '#27AE60';
    if (m >= 2)  return '#F1C40F';
    if (m >= 1)  return '#E67E22';
    return '#E74C3C';
  }

  // Dessine le board (pegs + slots)
  function drawBoard(ctx) {
    // Fond
    ctx.fillStyle = '#0A0A0F';
    ctx.fillRect(0, 0, W, H);

    // Bordure dorée
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, W - 16, H - 16);

    // Pegs (forme triangulaire)
    for (let r = 0; r < ROWS; r++) {
      const colsThisRow = r + 3; // ligne 0 a 3 pegs, ligne 1 a 4, etc.
      const startCol = (COLS - colsThisRow) / 2;
      for (let c = 0; c < colsThisRow; c++) {
        const x = padX + (startCol + c) * colSpacing;
        const y = pegY(r);
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#CCCCCC';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Slots du bas
    const slotY = H - padBottom + 5;
    const slotH = padBottom - 15;
    for (let i = 0; i < COLS; i++) {
      const x = pegX(i) - colSpacing / 2 + 2;
      const w = colSpacing - 4;
      ctx.fillStyle = slotColor(mults[i]);
      ctx.fillRect(x, slotY, w, slotH);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, slotY, w, slotH);

      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const txt = '×' + mults[i];
      ctx.strokeText(txt, pegX(i), slotY + slotH / 2);
      ctx.fillText(txt, pegX(i), slotY + slotH / 2);
    }
  }

  function drawBall(ctx, x, y) {
    // Trail
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, 2 * Math.PI);
    const grad = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, 8);
    grad.addColorStop(0, '#FFFFFF');
    grad.addColorStop(0.5, '#FFD700');
    grad.addColorStop(1, '#B8860B');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const totalFrames = ROWS * 3 + 8; // ~3 frames par row + hold final
  const finalSlot = path[path.length - 1];

  const enc = new GIFEncoder(W, H, 'octree', true, totalFrames);
  enc.start();
  enc.setRepeat(-1);
  enc.setQuality(20);

  // Animation : la bille parcourt path[] en interpolant entre chaque rangée
  const stepsPerRow = 3;
  for (let r = 0; r < ROWS; r++) {
    const colA = path[r];
    const colB = path[r + 1];
    const yA = pegY(r);
    const yB = pegY(r + 1);
    const xA = pegX(colA);
    const xB = pegX(colB);

    for (let s = 0; s < stepsPerRow; s++) {
      const t = (s + 1) / stepsPerRow;
      // Easing parabolic pour effet de gravité
      const ease = t * t;
      const x = xA + (xB - xA) * ease;
      const y = yA + (yB - yA) * t;

      const c = createCanvas(W, H);
      const ctx = c.getContext('2d');
      drawBoard(ctx);
      drawBall(ctx, x, y);

      enc.setDelay(60);
      enc.addFrame(ctx);
    }
  }

  // Hold final : bille atterrit dans le slot, flash sur le slot gagnant
  for (let h = 0; h < 8; h++) {
    const c = createCanvas(W, H);
    const ctx = c.getContext('2d');
    drawBoard(ctx);

    // Highlight final slot
    const slotY = H - padBottom + 5;
    const slotH = padBottom - 15;
    const x = pegX(finalSlot) - colSpacing / 2 + 2;
    const w = colSpacing - 4;
    if (h % 2 === 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(x, slotY, w, slotH);
      ctx.restore();
    }

    drawBall(ctx, pegX(finalSlot), H - padBottom + slotH / 2);
    enc.setDelay(220);
    enc.addFrame(ctx);
  }

  enc.finish();
  return enc.out.getData();
}

// ─── Génère un PNG des 3 portes du coffre magique ───
// opened : index de la porte ouverte (-1 si toutes fermées)
// content : 'treasure' | 'bomb' | null (si ouverte)
// level : 1-5 (numero du niveau actuel)
async function generateCoffreImage(opened, content, level, options = {}) {
  if (!isAvailable()) return null;

  const W = options.width || 540;
  const H = options.height || 360;

  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');

  // Fond
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#1A1A2E');
  bgGrad.addColorStop(1, '#0F0F1B');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Titre
  ctx.fillStyle = '#FFD700';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const title = '🗝️ COFFRE MAGIQUE — NIVEAU ' + level + ' / 5';
  ctx.strokeText(title, W / 2, 18);
  ctx.fillText(title, W / 2, 18);

  // 3 portes
  const doorW = 130;
  const doorH = 230;
  const gap = 30;
  const totalW = 3 * doorW + 2 * gap;
  const startX = (W - totalW) / 2;
  const doorY = 80;

  for (let i = 0; i < 3; i++) {
    const x = startX + i * (doorW + gap);

    // Cadre extérieur (or)
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(x - 6, doorY - 6, doorW + 12, doorH + 12);

    if (opened === i) {
      // Porte ouverte : montrer le contenu
      ctx.fillStyle = '#0A0A0F';
      ctx.fillRect(x, doorY, doorW, doorH);

      const cx = x + doorW / 2;
      const cy = doorY + doorH / 2;

      if (content === 'bomb') {
        // Bombe : cercle noir avec mèche
        ctx.beginPath();
        ctx.arc(cx, cy + 10, 45, 0, 2 * Math.PI);
        ctx.fillStyle = '#1C1C1C';
        ctx.fill();
        ctx.strokeStyle = '#E74C3C';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.fillStyle = '#FF4500';
        ctx.font = 'bold 60px sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText('💣', cx, cy);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 18px sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText('BOMBE !', cx, cy + 60);
      } else {
        // Trésor : pile d'or
        const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 50);
        grad.addColorStop(0, '#FFE680');
        grad.addColorStop(1, '#B8860B');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy + 10, 45, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.font = 'bold 50px sans-serif';
        ctx.textBaseline = 'middle';
        ctx.strokeText('💎', cx, cy);
        ctx.fillText('💎', cx, cy);
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 18px sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText('TRÉSOR !', cx, cy + 60);
      }
    } else {
      // Porte fermée : couleur bois + lettre
      const woodGrad = ctx.createLinearGradient(x, doorY, x + doorW, doorY + doorH);
      woodGrad.addColorStop(0, '#8B4513');
      woodGrad.addColorStop(0.5, '#6B3410');
      woodGrad.addColorStop(1, '#4A2510');
      ctx.fillStyle = woodGrad;
      ctx.fillRect(x, doorY, doorW, doorH);

      // Détails de la porte (panneaux)
      ctx.strokeStyle = '#3A1A0A';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 12, doorY + 18, doorW - 24, 90);
      ctx.strokeRect(x + 12, doorY + 122, doorW - 24, 90);

      // Poignée
      ctx.beginPath();
      ctx.arc(x + doorW - 22, doorY + doorH / 2, 5, 0, 2 * Math.PI);
      ctx.fillStyle = '#FFD700';
      ctx.fill();
      ctx.strokeStyle = '#8B6914';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Lettre A/B/C en gros
      ctx.fillStyle = '#FFD700';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.font = 'bold 64px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const letter = 'ABC'[i];
      ctx.strokeText(letter, x + doorW / 2, doorY + doorH / 2);
      ctx.fillText(letter, x + doorW / 2, doorY + doorH / 2);
    }

    // Étiquette en bas
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const lbl = 'PORTE ' + 'ABC'[i];
    ctx.fillText(lbl, x + doorW / 2, doorY + doorH + 12);
  }

  return c.toBuffer('image/png');
}

module.exports = {
  isAvailable,
  generateWheelGif,
  generateRouletteGif,
  generatePlinkoGif,
  generateCoffreImage,
};
