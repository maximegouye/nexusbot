const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

const HORSES = [
  { name: 'Tonnerre',  emoji: '⚡', speed: 0.85, odds: 1.5 },
  { name: 'Éclair',   emoji: '💨', speed: 0.78, odds: 2.0 },
  { name: 'Pégase',   emoji: '🦄', speed: 0.65, odds: 3.5 },
  { name: 'Tornado',  emoji: '🌪️', speed: 0.90, odds: 1.2 },
  { name: 'Comète',   emoji: '☄️', speed: 0.55, odds: 5.0 },
  { name: 'Fantôme',  emoji: '👻', speed: 0.40, odds: 8.0 },
];

function runRace() {
  const results = HORSES.map(h => ({
    ...h,
    score: h.speed + (Math.random() - 0.5) * 0.4
  })).sort((a, b) => b.score - a.score);
  return results;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('course')
    .setDescription('🏇 Courses hippiques — Pariez sur le bon cheval !')
    .addSubcommand(s => s.setName('parier').setDescription('🏇 Parier sur un cheval')
      .addStringOption(o => o.setName('cheval').setDescription('Cheval sur lequel parier').setRequired(true)
        .addChoices(...HORSES.map(h => ({ name: `${h.emoji} ${h.name} (x${h.odds})`, value: h.name }))))
      .addStringOption(o => o.setName('mise').setDescription('Mise en coins (all/tout/50%) — ILLIMITÉ').setRequired(true).setMaxLength(30)))
    .addSubcommand(s => s.setName('cotes').setDescription('📊 Voir les cotes actuelles')),

  async execute(interaction) {
    try {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '🪙';

    if (sub === 'cotes') {
      const lines = HORSES.map(h => `${h.emoji} **${h.name}** — Cote: **x${h.odds}** | Vitesse estimée: ${Math.round(h.speed * 100)}%`).join('\n');
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#8B4513').setTitle('🏇 Cotes des chevaux').setDescription(lines)
          .setFooter({ text: 'Cotes × mise = gain potentiel' })
      ]});
    }

    if (sub === 'parier') {
      const chosenName = interaction.options.getString('cheval');
      const u = db.getUser(userId, guildId);
      const parseBet = (raw, base) => {
        const s = String(raw ?? '').replace(/[\s_,]/g, '').toLowerCase();
        if (s === 'all' || s === 'tout' || s === 'max') return Math.max(0, Number(base || 0));
        if (s === 'half' || s === 'moitié' || s === 'moitie' || s === '50%') return Math.floor(Number(base || 0) / 2);
        const m = s.match(/^(\d+(?:\.\d+)?)(%)?$/);
        if (!m) return NaN;
        const n = parseFloat(m[1]);
        if (m[2] === '%') return Math.floor((n / 100) * Number(base || 0));
        return Math.floor(n);
      };
      const miseRaw = interaction.options.get('mise')?.value;
      const mise = parseBet(miseRaw, u.balance);
      if (!Number.isFinite(mise) || mise < 10) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Mise invalide. Minimum **10**. Tape un nombre, `all`, `50%`, `moitié`.', ephemeral: true });
      }
      const chosen = HORSES.find(h => h.name === chosenName);

      if (u.balance < mise) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Solde insuffisant.`, ephemeral: true });

      db.addCoins(userId, guildId, -mise);
      await interaction.deferReply();

      // Animation de course
      const lines = HORSES.map(h => `${h.emoji} **${h.name}** : ${'🟫'.repeat(3)}`);
      await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#8B4513').setTitle('🏇 DÉPART !').setDescription(lines.join('\n'))
      ]});

      await new Promise(r => setTimeout(r, 2000));
      const results = runRace();
      const winner = results[0];
      const pos = results.findIndex(h => h.name === chosenName) + 1;

      const podium = results.slice(0, 3).map((h, i) => `${['🥇', '🥈', '🥉'][i]} ${h.emoji} **${h.name}**`).join('\n');

      let gain = 0;
      let resultMsg = '';
      if (pos === 1) {
        gain = Math.floor(mise * chosen.odds);
        db.addCoins(userId, guildId, gain);
        resultMsg = `🎉 Votre cheval ${chosen.emoji} **${chosen.name}** a **GAGNÉ** ! **+${gain} ${coin}**`;
      } else {
        resultMsg = `😔 Votre cheval ${chosen.emoji} **${chosen.name}** est arrivé **${pos}ème**. Perdu **${mise} ${coin}**.`;
      }

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor(pos === 1 ? '#F1C40F' : '#E74C3C').setTitle('🏇 Résultat de la course !')
          .addFields(
            { name: '🏆 Podium', value: podium, inline: true },
            { name: '🎯 Votre résultat', value: resultMsg, inline: false },
          )
      ]});
    }
    } catch (err) {
    console.error('[CMD] Erreur:', err?.message || err);
    const _em = { content: `❌ Erreur : ${String(err?.message || 'Erreur inconnue').slice(0,200)}`, ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) await interaction.editReply(_em).catch(() => {});
      else await interaction.reply(_em).catch(() => {});
    } catch {}
  }}
};

// Réactivé comme prefix-only (limite slash Discord)
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
