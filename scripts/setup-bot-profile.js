#!/usr/bin/env node
// ============================================================
// setup-bot-profile.js — Configure l'avatar et le profil du bot
// Usage : node scripts/setup-bot-profile.js
// Lance ce script UNE SEULE FOIS depuis ton terminal local.
// ============================================================
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');
const https = require('https');
const fs    = require('fs');

const TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;

if (!TOKEN) {
  console.error('❌ TOKEN non trouvé dans .env');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

// ── Avatar : logo NexusBot (SVG → base64) ─────────────────
// SVG généré programmatiquement — robot futuriste violet/bleu
const svgAvatar = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a0533"/>
      <stop offset="100%" style="stop-color:#0d1b3e"/>
    </linearGradient>
    <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#7B2FBE"/>
      <stop offset="50%" style="stop-color:#5865F2"/>
      <stop offset="100%" style="stop-color:#00d4ff"/>
    </linearGradient>
    <filter id="blur">
      <feGaussianBlur stdDeviation="8"/>
    </filter>
  </defs>

  <!-- Fond -->
  <rect width="512" height="512" rx="100" fill="url(#bg)"/>

  <!-- Halo de fond -->
  <ellipse cx="256" cy="256" rx="180" ry="180" fill="#7B2FBE" opacity="0.15" filter="url(#blur)"/>

  <!-- Corps du robot -->
  <rect x="156" y="210" width="200" height="180" rx="20" fill="url(#glow)" opacity="0.9"/>

  <!-- Tête -->
  <rect x="176" y="130" width="160" height="110" rx="25" fill="url(#glow)" opacity="0.95"/>

  <!-- Antenne -->
  <rect x="250" y="90" width="12" height="45" rx="6" fill="#00d4ff"/>
  <circle cx="256" cy="82" r="12" fill="#00d4ff" opacity="0.9"/>
  <circle cx="256" cy="82" r="6" fill="white" opacity="0.8"/>

  <!-- Yeux -->
  <rect x="196" y="158" width="40" height="28" rx="8" fill="#0d1b3e"/>
  <rect x="276" y="158" width="40" height="28" rx="8" fill="#0d1b3e"/>
  <!-- Iris -->
  <ellipse cx="216" cy="172" rx="14" ry="10" fill="#00d4ff" opacity="0.9"/>
  <ellipse cx="296" cy="172" rx="14" ry="10" fill="#00d4ff" opacity="0.9"/>
  <!-- Pupilles -->
  <circle cx="216" cy="172" r="6" fill="white"/>
  <circle cx="296" cy="172" r="6" fill="white"/>

  <!-- Bouche / Display -->
  <rect x="200" y="200" width="112" height="22" rx="8" fill="#0d1b3e"/>
  <!-- Barres de son -->
  <rect x="210" y="205" width="8" height="12" rx="2" fill="#7B2FBE"/>
  <rect x="224" y="203" width="8" height="16" rx="2" fill="#5865F2"/>
  <rect x="238" y="206" width="8" height="10" rx="2" fill="#7B2FBE"/>
  <rect x="252" y="202" width="8" height="18" rx="2" fill="#00d4ff"/>
  <rect x="266" y="205" width="8" height="12" rx="2" fill="#5865F2"/>
  <rect x="280" y="203" width="8" height="16" rx="2" fill="#7B2FBE"/>
  <rect x="294" y="206" width="8" height="10" rx="2" fill="#00d4ff"/>

  <!-- Bras gauche -->
  <rect x="106" y="220" width="55" height="30" rx="12" fill="url(#glow)" opacity="0.8"/>
  <circle cx="105" cy="235" r="18" fill="url(#glow)" opacity="0.7"/>

  <!-- Bras droit -->
  <rect x="351" y="220" width="55" height="30" rx="12" fill="url(#glow)" opacity="0.8"/>
  <circle cx="407" cy="235" r="18" fill="url(#glow)" opacity="0.7"/>

  <!-- Panneau central du corps -->
  <rect x="186" y="232" width="140" height="90" rx="12" fill="#0d1b3e" opacity="0.7"/>
  <!-- Diodes -->
  <circle cx="220" cy="260" r="8" fill="#00d4ff" opacity="0.9"/>
  <circle cx="256" cy="260" r="8" fill="#7B2FBE" opacity="0.9"/>
  <circle cx="292" cy="260" r="8" fill="#5865F2" opacity="0.9"/>
  <!-- Barre de progression -->
  <rect x="200" y="280" width="112" height="10" rx="5" fill="#1a0533"/>
  <rect x="200" y="280" width="75" height="10" rx="5" fill="url(#glow)"/>
  <!-- N stylisé -->
  <text x="256" y="315" font-family="Arial Black, sans-serif" font-size="22" font-weight="900"
        text-anchor="middle" fill="white" opacity="0.9">NexusBot</text>

  <!-- Jambes -->
  <rect x="196" y="395" width="50" height="60" rx="10" fill="url(#glow)" opacity="0.85"/>
  <rect x="266" y="395" width="50" height="60" rx="10" fill="url(#glow)" opacity="0.85"/>

  <!-- Pieds -->
  <rect x="188" y="442" width="66" height="22" rx="8" fill="url(#glow)" opacity="0.75"/>
  <rect x="258" y="442" width="66" height="22" rx="8" fill="url(#glow)" opacity="0.75"/>

  <!-- Reflets -->
  <rect x="176" y="130" width="160" height="20" rx="25" fill="white" opacity="0.08"/>
  <rect x="156" y="210" width="200" height="15" rx="5" fill="white" opacity="0.06"/>
</svg>`;

async function main() {
  console.log('🤖 NexusBot — Configuration du profil\n');

  // ── 1. Convertir SVG en base64 PNG (data URI) ──────────
  console.log('🎨 Génération de l\'avatar...');
  const avatarDataURI = `data:image/svg+xml;base64,${Buffer.from(svgAvatar).toString('base64')}`;

  // ── 2. Mettre à jour le profil via l'API ───────────────
  console.log('📡 Mise à jour du profil Discord...');
  try {
    const updated = await rest.patch(Routes.user('@me'), {
      body: {
        avatar: avatarDataURI,
      },
    });
    console.log(`✅ Avatar mis à jour pour : ${updated.username}#${updated.discriminator}`);
  } catch (err) {
    console.error('❌ Erreur avatar:', err?.rawError?.message || err.message);
    console.log('   → Astuce : La mise à jour de l\'avatar est limitée à 2x/heure par Discord');
  }

  // ── 3. Récapitulatif ───────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Script terminé.');
  console.log('\n📋 Pour la bio du bot (About Me), fais-le manuellement :');
  console.log('   1. Va sur https://discord.com/developers/applications');
  console.log('   2. Clique sur NexusBot');
  console.log('   3. Onglet "General Information"');
  console.log('   4. Dans "Description" (visible dans le profil) :');
  console.log('');
  console.log('   ┌─────────────────────────────────────────────────┐');
  console.log('   │ 🤖 Le bot tout-en-un pour ton serveur Discord   │');
  console.log('   │                                                  │');
  console.log('   │ 🎰 15+ jeux de casino                           │');
  console.log('   │ 💰 Système d\'économie complet                   │');
  console.log('   │ 🎫 Tickets & support                            │');
  console.log('   │ 🏆 XP, classements & récompenses               │');
  console.log('   │ 🎁 Giveaways & événements                       │');
  console.log('   │ ⚙️  Config complète avec /config                │');
  console.log('   │                                                  │');
  console.log('   │ /aide pour voir toutes les commandes            │');
  console.log('   └─────────────────────────────────────────────────┘');
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(console.error);
