// ============================================================
// crash.js — Crash game en temps réel
// Emplacement : src/commands_guild/games/crash.js
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');
const { makeGameRow, changeMiseModal, parseMise } = require('../../utils/casinoUtils');

// ─── DB stats ─────────────────────────────────────────────
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS crash_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id   TEXT,
    multiplier REAL,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}

function addCrashHistory(guildId, mult) {
  try {
    db.db.prepare('INSERT INTO crash_history (guild_id,multiplier) VALUES (?,?)').run(guildId, mult);
    // Garder que les 20 derniers
    db.db.prepare('DELETE FROM crash_history WHERE guild_id=? AND id NOT IN (SELECT id FROM crash_history WHERE guild_id=? ORDER BY id DESC LIMIT 20)').run(guildId, guildId);
  } catch {}
}
function getCrashHistory(guildId) {
  return db.db.prepare('SELECT multiplier FROM crash_history WHERE guild_id=? ORDER BY id DESC LIMIT 8').all(guildId);
}

// ─── Parties actives ──────────────────────────────────────
const activeGames = new Map(); // userId → { cashedOut, mult, interval, msg, gameLoop }
const crashHistoryMap = new Map(); // guildId → [mult1, mult2, ...] (max 8 en mémoire)

// ─── Génération du multiplicateur de crash ────────────────
// Courbe : beaucoup de crashes bas (1.0-2.0), rares grands (>10)
function generateCrashPoint() {
  const r = Math.random();
  if (r < 0.01) return 1.0;                        // 1% instant crash
  if (r < 0.33) return 1.0 + Math.random() * 0.5; // 32% : 1.0-1.5
  if (r < 0.60) return 1.5 + Math.random() * 1.0; // 27% : 1.5-2.5
  if (r < 0.80) return 2.5 + Math.random() * 2.5; // 20% : 2.5-5.0
  if (r < 0.93) return 5.0 + Math.random() * 10;  // 13% : 5-15
  if (r < 0.98) return 15  + Math.random() * 35;  // 5%  : 15-50
  return 50 + Math.random() * 50;                  // 2%  : 50-100
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function multColor(m) {
  if (m < 1.5) return '#E74C3C';
  if (m < 2.0) return '#E67E22';
  if (m < 5.0) return '#F1C40F';
  if (m < 10)  return '#2ECC71';
  return '#9B59B6';
}

// ─── Enhanced trajectory bar with color progression ───────
function graphBar(current, crashPoint) {
  const pct  = Math.min(current / crashPoint, 1);
  const len  = 18;
  const fill = Math.floor(pct * len);

  // Color progression: green -> yellow -> orange -> red
  let barColor = '';
  if (pct < 0.33) barColor = '█';  // green
  else if (pct < 0.66) barColor = '▓';  // yellow/orange
  else barColor = '▒';  // orange/red

  const bar  = barColor.repeat(fill) + '░'.repeat(len - fill);
  const pctStr = (pct * 100).toFixed(0).padStart(3);
  return `[${bar}] ${pctStr}%`;
}

function rocketEmoji(mult) {
  if (mult >= 50)  return '🌌';
  if (mult >= 20)  return '⭐';
  if (mult >= 10)  return '🌙';
  if (mult >= 5)   return '🛸';
  if (mult >= 2.5) return '🚀';
  return '🛫';
}

// ─── Enhanced altitude bar with stages ────────────────────
function altitudeBar(current, crashPoint) {
  const steps = 12;
  const pct   = Math.min(current / crashPoint, 1);
  const pos   = Math.floor(pct * steps);
  const bars  = Array(steps).fill('─');
  bars[pos]   = rocketEmoji(current);
  return bars.join('');
}

// ─── Crash animation (explosion dramatique avec 6+ frames) ──
async function animateCrash(msg) {
  const crashFlashes = [
    { color: '#FFD700', desc: '⚠️ ATTENTION !' },
    { color: '#FFA500', desc: '🔴 ALERTE !' },
    { color: '#E74C3C', desc: '💥 CRASH !' },
    { color: '#C0392B', desc: '💥💥 EXPLOSION !' },
    { color: '#8B0000', desc: '💥💥💥 DESTRUCTION !' },
    { color: '#E74C3C', desc: '💥 CRASH !' },
    { color: '#000000', desc: '⚫ NÉANT ⚫' },
  ];

  for (const { color, desc } of crashFlashes) {
    const e = new EmbedBuilder()
      .setColor(color)
      .setTitle(desc)
      .setDescription('*🎆 Explosion en cours... 🎆*');
    await msg.edit({ embeds: [e] }).catch(() => {});
    await sleep(100);
  }
}

// ─── Jeu ─────────────────────────────────────────────────
async function playCrash(source, userId, guildId, mise, autoCashout = null) {
  const isInteraction = !!source.editReply;
  const u    = db.getUser(userId, guildId);
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '€';

  if (!u || u.balance < mise) {
    const err = `❌ Solde insuffisant. Tu as **${u?.balance || 0} ${coin}**.`;
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }
  if (activeGames.has(userId)) {
    const err = '⚠️ Tu as deja un crash en cours !';
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }
  if (mise < 10) {
    const err = '❌ Mise minimale : **10 €**.';
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }

  db.addCoins(userId, guildId, -mise);

  const crashPoint = generateCrashPoint();
  let current      = 1.0;
  let cashedOut    = false;
  let cashoutMult  = null;
  let gameLoop     = null;

  function buildCrashEmbed(crashed = false) {
    const color = crashed ? '#E74C3C' : cashedOut ? '#2ECC71' : multColor(current);
    const title = crashed     ? '💥 CRASH !'
                : cashedOut   ? '✅ Cash-Out Reussi !'
                : `${rocketEmoji(current)} Crash - En Vol`;

    const bar    = graphBar(current, crashPoint);
    const rocket = rocketEmoji(current);
    const alt    = altitudeBar(current, crashPoint);

    // Affichage dramatique du multiplicateur avec styling amélioré
    const multDisplay = `# ×${current.toFixed(2)}`.padStart(8);

    // Alerte si le multiplicateur approche du crash point (90%)
    const alertThreshold = crashPoint * 0.9;
    const isWarning = !crashed && !cashedOut && current >= alertThreshold;
    const warningText = isWarning ? '\n⚠️ **DANGER ! À 90% du crash !** ⚠️' : '';

    // Sparkline de l'historique (derniers 8 crashes)
    const hist = crashHistoryMap.get(guildId) || [];
    let sparkline = '';
    if (hist.length > 0) {
      sparkline = hist.map(m => {
        const val = m.toFixed(1) + '×';
        return m > 5 ? `**${val}**` : val;
      }).join(' | ');
    }

    const e = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .addFields(
        {
          name: crashed ? `💥 Crash a` : cashedOut ? `✅ Cash-out a` : `${rocket} Multiplicateur`,
          value: `## ×${current.toFixed(2)}${warningText}`,
          inline: false,
        },
        { name: '✈️ Altitude', value: '`' + alt + '`', inline: false },
        { name: '📊 Danger', value: '`' + bar + '`', inline: false },
        { name: '💰 Mise', value: `${mise} ${coin}`, inline: true },
      );

    if (!crashed && !cashedOut) {
      const potentialGain = Math.floor(mise * current);
      e.addFields({ name: '💵 Gain potentiel', value: `${potentialGain} ${coin}`, inline: true });
      if (autoCashout) e.addFields({ name: '🤖 Auto cash-out', value: `a ×${autoCashout}`, inline: true });
    }

    if (cashedOut && cashoutMult) {
      const gain = Math.floor(mise * cashoutMult);
      e.addFields({ name: '💵 Gain', value: `+${gain} ${coin}`, inline: true });
    }

    if (crashed) {
      const lostOrGain = cashedOut
        ? `+${Math.floor(mise * cashoutMult)} ${coin}`
        : `-${mise} ${coin}`;
      e.addFields({ name: '💸 Resultat', value: lostOrGain, inline: true });
      if (sparkline) e.addFields({ name: '📊 Historique', value: sparkline, inline: false });
    }

    return e;
  }

  const cashoutBtn = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`crash_cashout_${userId}`)
      .setLabel(`💰 Cash-Out (×${current.toFixed(2)})`)
      .setStyle(ButtonStyle.Success),
  );

  let msg;
  if (isInteraction) {
    if (!source.deferred && !source.replied) await source.deferReply();
    msg = await source.editReply({ embeds: [buildCrashEmbed()], components: [cashoutBtn] });
  } else {
    msg = await source.reply({ embeds: [buildCrashEmbed()], components: [cashoutBtn] });
  }

  activeGames.set(userId, { cashedOut: false, mult: 1.0, msg, gameLoop: null });

  // Collecteur bouton cash-out (5 minutes timeout)
  const filter = i => i.user.id === userId && i.customId === `crash_cashout_${userId}`;
  const collector = msg.createMessageComponentCollector({ filter, time: 5 * 60 * 1000 }); // 5 min

  collector.on('collect', async i => {
    await i.deferUpdate().catch(() => {});
    if (!cashedOut && current < crashPoint) {
      cashedOut   = true;
      cashoutMult = current;
      let gain  = Math.floor(mise * cashoutMult);
      // 🎰 RTP réaliste + cap
      try {
        const rtp = require('../../utils/realCasinoEngine');
        gain = rtp.applyRtp('crash', mise, gain);
        gain = rtp.capWin('crash', mise, gain);
      } catch (_) {}
      db.addCoins(userId, guildId, gain);
    }
  });

  // Boucle de montée
  const TICK = 400; // ms par tick
  const INCREMENT = 0.08; // +8% par tick (environ)

  gameLoop = setInterval(async () => {
    if (cashedOut) {
      // Continuer a afficher mais cash-out deja pris
      current = parseFloat((current + INCREMENT + current * 0.02).toFixed(2));

      if (current >= crashPoint) {
        clearInterval(gameLoop);
        collector.stop();
        activeGames.delete(userId);
        addCrashHistory(guildId, crashPoint);
        
        // Mettre à jour crashHistoryMap
        if (!crashHistoryMap.has(guildId)) crashHistoryMap.set(guildId, []);
        const hist = crashHistoryMap.get(guildId);
        hist.push(crashPoint);
        if (hist.length > 8) hist.shift();

        // Animate crash
        await animateCrash(msg);

        const replayRows = makeCrashEndRows(userId, mise);
        await msg.edit({ embeds: [buildCrashEmbed(true)], components: replayRows }).catch(() => {});
      } else {
        // Update embed pour montrer progression
        const e = buildCrashEmbed();
        await msg.edit({ embeds: [e], components: [] }).catch(() => {});
      }
      return;
    }

    current = parseFloat((current + INCREMENT + current * 0.02).toFixed(2));

    // Auto cash-out
    if (autoCashout && current >= autoCashout && !cashedOut) {
      cashedOut   = true;
      cashoutMult = autoCashout;
      const gain  = Math.floor(mise * cashoutMult);
      db.addCoins(userId, guildId, gain);
    }

    if (current >= crashPoint) {
      clearInterval(gameLoop);
      collector.stop();
      activeGames.delete(userId);
      addCrashHistory(guildId, crashPoint);
      
      // Mettre à jour crashHistoryMap
      if (!crashHistoryMap.has(guildId)) crashHistoryMap.set(guildId, []);
      const hist = crashHistoryMap.get(guildId);
      hist.push(crashPoint);
      if (hist.length > 8) hist.shift();

      // Animate crash
      await animateCrash(msg);

      const replayRows2 = makeCrashEndRows(userId, mise);
      const e = buildCrashEmbed(true);
      await msg.edit({ embeds: [e], components: replayRows2 }).catch(() => {});
    } else {
      // Update bouton avec nouveau multiplicateur
      const btn = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`crash_cashout_${userId}`)
          .setLabel(`💰 Cash-Out (×${current.toFixed(2)})`)
          .setStyle(cashedOut ? ButtonStyle.Secondary : ButtonStyle.Success)
          .setDisabled(cashedOut),
      );
      const e = buildCrashEmbed();

      // Flash d'alerte si à 90% du crash point
      const alertThreshold = crashPoint * 0.9;
      if (current >= alertThreshold && !cashedOut) {
        // Mini flash warning
        const flashEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('⚠️⚠️⚠️ DANGER IMMINENT ⚠️⚠️⚠️')
          .setDescription(`Le crash va se produire bientôt !\n\n**×${current.toFixed(2)}** / ×${crashPoint.toFixed(2)}`);
        await msg.edit({ embeds: [flashEmbed], components: [btn] }).catch(() => {});
        await sleep(50);
      }

      await msg.edit({ embeds: [e], components: [btn] }).catch(() => {});
    }
  }, TICK);

  // Store gameLoop reference
  activeGames.get(userId).gameLoop = gameLoop;

  collector.on('end', () => {
    const game = activeGames.get(userId);
    if (game && game.gameLoop) {
      clearInterval(game.gameLoop);
      activeGames.delete(userId);
    }
  });
}

// ─── Helper : rangée de fin de partie enrichie ────────────
function makeCrashEndRows(userId, mise) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`crash_replay_${userId}_${mise}`).setLabel('🔄 Rejouer').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`crash_changemise_${userId}`).setLabel('💰 Changer mise').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`crash_allin_${userId}_${mise}`).setLabel('🎲 All-In').setStyle(ButtonStyle.Danger),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`crash_auto_${userId}_${mise}_1.5`).setLabel('🤖 Auto ×1.5').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`crash_auto_${userId}_${mise}_2`).setLabel('🤖 Auto ×2').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`crash_auto_${userId}_${mise}_3`).setLabel('🤖 Auto ×3').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`crash_auto_${userId}_${mise}_5`).setLabel('🤖 Auto ×5').setStyle(ButtonStyle.Secondary),
  );
  return [row1, row2];
}

// ─── Handle Component ──────────────────────────────────────
async function handleComponent(interaction) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  // ── Auto cash-out preset ─────────────────────────────────
  if (interaction.customId.startsWith('crash_auto_')) {
    const parts = interaction.customId.split('_');
    const customUserId = parts[2];
    const mise         = parseInt(parts[3]);
    const autoCashout  = parseFloat(parts[4]);
    if (customUserId !== userId) {
      return interaction.reply({ content: '❌ Ce bouton n\'est pas pour toi.', ephemeral: true }).catch(() => {});
    }
    await interaction.deferUpdate();
    const source = { editReply: (d) => interaction.editReply(d), deferred: true };
    await playCrash(source, userId, guildId, mise, autoCashout);
    return true;
  }

  // ── All-In ────────────────────────────────────────────────
  if (interaction.customId.startsWith('crash_allin_')) {
    const parts = interaction.customId.split('_');
    const customUserId = parts[2];
    if (customUserId !== userId) {
      return interaction.editReply({ content: '❌ Ce bouton n\'est pas pour toi.', ephemeral: true });
    }
    await interaction.deferUpdate();
    const u2 = db.getUser(userId, guildId);
    const allIn = u2?.balance || 0;
    if (allIn < 10) {
      return interaction.editReply({ content: '❌ Solde insuffisant pour un All-In (min 10).', ephemeral: true });
    }
    const source = { editReply: (d) => interaction.editReply(d), deferred: true };
    await playCrash(source, userId, guildId, allIn, null);
    return true;
  }

  if (interaction.customId.startsWith('crash_replay_')) {
    const parts = interaction.customId.split('_');
    const customUserId = parts[2];
    const mise = parseInt(parts[3]);

    if (customUserId !== userId) {
      return interaction.editReply({ content: '❌ Ce bouton n\'est pas pour toi.', ephemeral: true });
    }

    await interaction.deferUpdate();
    const source = { editReply: (d) => interaction.editReply(d), deferred: true };
    await playCrash(source, userId, guildId, mise, null);
    return true;
  }

  if (interaction.customId.startsWith('crash_changemise_')) {
    const parts = interaction.customId.split('_');
    const customUserId = parts[2];
    if (customUserId !== userId) {
      return interaction.editReply({ content: '❌ Ce bouton n\'est pas pour toi.', ephemeral: true });
    }
    await interaction.showModal(changeMiseModal('crash', userId));
    return true;
  }

  if (interaction.customId.startsWith('crash_modal_') && interaction.isModalSubmit()) {
    const parts = interaction.customId.split('_');
    const customUserId = parts[2];
    if (customUserId !== userId) {
      return interaction.editReply({ content: '❌ Ce modal n\'est pas pour toi.', ephemeral: true });
    }
    const rawMise = interaction.fields.getTextInputValue('newmise');
    const u = db.getUser(userId, guildId);
    const newMise = parseMise(rawMise, u?.balance || 0);
    if (!newMise || newMise < 10) {
      return interaction.reply({ content: '❌ Mise invalide (min 10 €).', ephemeral: true });
    }
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false });
    await playCrash(interaction, userId, guildId, newMise, null);
    return true;
  }
}

// ─── Exports ──────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('crash')
    .setDescription('🚀 Crash - regardez le multiplicateur monter et cashoutez avant le crash !')
    .addIntegerOption(o => o
      .setName('mise').setDescription('Montant a miser (min 10)').setRequired(true).setMinValue(10))
    .addNumberOption(o => o
      .setName('auto').setDescription('Cash-out automatique a ce multiplicateur (ex: 2.5)').setMinValue(1.1)),

  async execute(interaction) {
    // NOTE: deferReply is already called by interactionCreate.js
    await playCrash(
      interaction,
      interaction.user.id,
      interaction.guildId,
      interaction.options.getInteger('mise'),
      interaction.options.getNumber('auto') || null,
    );
  },

  name: 'crash',
  aliases: ['rocket', 'vol'],
  async run(message, args) {
    const mise = parseInt(args[0]);
    const auto = parseFloat(args[1]) || null;
    if (!mise || mise < 10) return message.reply('❌ Usage : `&crash <mise> [auto-cashout]`\nEx: `&crash 200 2.5`');
    await playCrash(message, message.author.id, message.guildId, mise, auto);
  },

  handleComponent,
};
