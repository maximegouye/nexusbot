/**
 * /roue <mise> — Roue de la fortune.
 * 8 cases, chacune avec un multiplicateur (×0, ×0.5, ×1, ×1.5, ×2, ×3, ×5, ×10).
 * Pondération : plus le multiplicateur est élevé, plus la probabilité est faible.
 */
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

// ── Adaptateur préfixe→interaction ────────────────────────────────────────────
function mkFake(message, opts = {}) {
  let replied = false, deferred = false;
  const send = async (data) => {
    if (replied || deferred) return message.channel.send(data).catch(() => {});
    replied = true;
    return message.reply(data).catch(() => message.channel.send(data).catch(() => {}));
  };
  return {
    user: message.author, member: message.member,
    guild: message.guild, guildId: message.guildId,
    channel: message.channel, client: message.client,
    get deferred() { return deferred; }, get replied() { return replied; },
    options: {
      getSubcommand: opts.getSubcommand || (() => null),
      getUser:    opts.getUser    || ((k) => null),
      getMember:  opts.getMember  || ((k) => null),
      getRole:    opts.getRole    || ((k) => null),
      getChannel: opts.getChannel || ((k) => null),
      getString:  opts.getString  || ((k) => null),
      getInteger: opts.getInteger || ((k) => null),
      getNumber:  opts.getNumber  || ((k) => null),
      getBoolean: opts.getBoolean || ((k) => null),
    },
    deferReply: async () => { deferred = true; },
    editReply:  async (d) => send(d),
    reply:      async (d) => send(d),
    followUp:   async (d) => message.channel.send(d).catch(() => {}),
    update:     async (d) => {},
  };
}


const CASES = [
  { emoji: '💀', mult: 0,    weight: 30, label: '💀 Banqueroute',       color: '#000000' },
  { emoji: '💸', mult: 0.5,  weight: 22, label: '💸 Moitié remboursée', color: '#95A5A6' },
  { emoji: '⚖️', mult: 1,    weight: 18, label: '⚖️ Mise récupérée',    color: '#3498DB' },
  { emoji: '💰', mult: 1.5,  weight: 12, label: '💰 Petit gain ×1.5',   color: '#F39C12' },
  { emoji: '💎', mult: 2,    weight:  8, label: '💎 Gain ×2',            color: '#2ECC71' },
  { emoji: '🏆', mult: 3,    weight:  5, label: '🏆 Bon gain ×3',        color: '#E67E22' },
  { emoji: '⭐', mult: 5,    weight:  3, label: '⭐ GROS gain ×5',       color: '#9B59B6' },
  { emoji: '💫', mult: 10,   weight:  2, label: '💫 JACKPOT ×10',         color: '#FF6B6B' },
];
const POOL = CASES.flatMap(c => Array(c.weight).fill(c));

function parseBet(raw, balance) {
  if (!raw) return null;
  const s = String(raw).replace(/[\s_,]/g, '').toLowerCase();
  if (s === 'all' || s === 'tout' || s === 'max') return BigInt(balance);
  if (s === 'moitié' || s === 'moitie' || s === '50%' || s === 'half') return BigInt(Math.floor(balance / 2));
  const m = s.match(/^(\d+(?:\.\d+)?)(%)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!isFinite(n) || n < 0) return null;
  if (m[2] === '%') return BigInt(Math.floor(balance * Math.min(100, n) / 100));
  return BigInt(Math.floor(n));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roue')
    .setDescription('🎡 Roue de la fortune — tourne pour tenter un ×10 !')
    .addStringOption(o => o.setName('mise').setDescription('Montant (ex: 500, all, 25%)').setRequired(true).setMaxLength(20)),
  cooldown: 3,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }).catch(() => {}); } catch (e) { /* déjà ack */ }
    }

    try {
    const cfg    = db.getConfig(interaction.guildId);
    const user   = db.getUser(interaction.user.id, interaction.guildId);
    const symbol = cfg.currency_emoji || '€';
    const raw = interaction.options.getString('mise') ?? interaction.options.get?.('mise')?.value ?? null;

    const bet = parseBet(raw, user.balance);
    if (bet == null) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Mise invalide.', ephemeral: true });
    if (bet < 1n)    return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Mise minimum : 1.', ephemeral: true });
    if (bet > BigInt(user.balance)) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Solde insuffisant (**${user.balance.toLocaleString('fr-FR')}${symbol}**).`, ephemeral: true });

    const mise = Number(bet);
    db.removeCoins(interaction.user.id, interaction.guildId, mise);

    const color = cfg.color || '#9B59B6';
    // Animation : on simule la roue qui tourne en mettant à jour plusieurs fois
    const WHEEL_EMOJIS = CASES.map(c => c.emoji);
    const buildSpinEmbed = (frame) => {
      const fakePick = WHEEL_EMOJIS[frame % WHEEL_EMOJIS.length];
      const dots = '.'.repeat((frame % 4) + 1);
      return new EmbedBuilder().setColor(color)
        .setTitle(`🎡 La roue tourne${dots}`)
        .setDescription([
          '```',
          `        ⬆️        `,
          `   💀  💶  ⚖️    `,
          `  💫   ${fakePick}   💰  `,
          `   ⭐       💎    `,
          `      🏆         `,
          '```',
          `**${interaction.user.username}** mise **${mise.toLocaleString('fr-FR')}${symbol}**…`,
          `\n🎯 La bille tourne…`,
        ].join('\n'));
    };

    await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [buildSpinEmbed(0)] });
    for (let i = 1; i <= 6; i++) {
      await new Promise(r => setTimeout(r, 450));
      await interaction.editReply({ embeds: [buildSpinEmbed(i)] }).catch(() => {});
    }

    const pick = POOL[Math.floor(Math.random() * POOL.length)];
    const gain = Math.floor(mise * pick.mult);
    if (gain > 0) db.addCoins(interaction.user.id, interaction.guildId, gain);
    const net = gain - mise;
    const balanceAfter = Math.max(0, user.balance - mise + gain);

    const resColor = pick.mult === 0 ? '#E74C3C' : pick.mult < 1 ? '#F39C12' : pick.mult >= 5 ? '#9B59B6' : '#2ECC71';

    const embed = new EmbedBuilder()
      .setColor(resColor)
      .setTitle(`🎡 La roue s'arrête sur… ${pick.emoji}`)
      .setDescription(`${pick.label}`)
      .addFields(
        { name: '💰 Mise',      value: `${mise.toLocaleString('fr-FR')}${symbol}`,              inline: true },
        { name: '✖️ Multiplicateur', value: `×${pick.mult}`,                                    inline: true },
        { name: '🏆 Gain',      value: `${gain.toLocaleString('fr-FR')}${symbol}`,              inline: true },
        { name: net >= 0 ? '📈 Bénéfice' : '📉 Perte', value: `**${net > 0 ? '+' : ''}${net.toLocaleString('fr-FR')}${symbol}**`, inline: true },
        { name: `${symbol} Solde`, value: `**${balanceAfter.toLocaleString('fr-FR')}${symbol}**`, inline: true },
      )
      .setFooter({ text: '🎡 Roue de la fortune · NexusBot' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`roue_replay:${encodeURIComponent(String(mise))}`).setLabel('🎡 Rejouer').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`roue_double:${encodeURIComponent(String(mise))}`).setLabel('✖️ Rejouer ×2').setStyle(ButtonStyle.Success),
    );

    await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed], components: [row] }).catch(() => {});
    } catch (err) {
    console.error('[CMD] Erreur execute:', err?.message || err);
    const errMsg = { content: `❌ Une erreur est survenue : ${err?.message || 'Erreur inconnue'}`, ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errMsg).catch(() => {});
      } else {
        await interaction.reply(errMsg).catch(() => {});
      }
    } catch {}
  }},

  name: 'roue',
  aliases: ['wheel', 'spinner'],
  async run(message, args) {
    const raw = args[0];
    if (!raw) return message.reply('❌ Usage : `&roue <mise>`');
    const fake = mkFake(message, { getString: () => raw });
    await this.execute(fake);
  },
};
;

async function handleComponent(interaction, customId) {
  if (!customId.startsWith('roue_')) return false;

  const cfg    = db.getConfig(interaction.guildId);
  const symbol = cfg.currency_emoji || '€';

  if (customId.startsWith('roue_replay:') || customId.startsWith('roue_double:')) {
    const miseStr = decodeURIComponent(customId.split(':')[1]);
    const mise    = parseInt(miseStr);

    if (!mise || mise < 1) {
      await interaction.editReply({ content: '❌ Mise invalide.', ephemeral: true }).catch(() => {});
      return true;
    }

    const user = db.getUser(interaction.user.id, interaction.guildId);
    if (user.balance < mise) {
      await interaction.editReply({ content: `❌ Solde insuffisant (**${user.balance.toLocaleString('fr-FR')}${symbol}**).`, ephemeral: true }).catch(() => {});
      return true;
    }

    db.removeCoins(interaction.user.id, interaction.guildId, mise);

    const pick = POOL[Math.floor(Math.random() * POOL.length)];
    const gain = Math.floor(mise * pick.mult);
    if (gain > 0) db.addCoins(interaction.user.id, interaction.guildId, gain);

    const net          = gain - mise;
    const balanceAfter = Math.max(0, user.balance - mise + gain);
    const resColor     = pick.mult === 0 ? '#E74C3C' : pick.mult < 1 ? '#F39C12' : pick.mult >= 5 ? '#9B59B6' : '#2ECC71';

    const embed = new EmbedBuilder()
      .setColor(resColor)
      .setTitle(`🎡 ${pick.emoji} ${pick.label}`)
      .addFields(
        { name: '💰 Mise',           value: `${mise.toLocaleString('fr-FR')}${symbol}`,              inline: true },
        { name: '✖️ Multiplicateur', value: `×${pick.mult}`,                                          inline: true },
        { name: '🏆 Gain',           value: `${gain.toLocaleString('fr-FR')}${symbol}`,              inline: true },
        { name: net >= 0 ? '📈 Bénéfice' : '📉 Perte', value: `**${net > 0 ? '+' : ''}${net.toLocaleString('fr-FR')}${symbol}**`, inline: true },
        { name: `${symbol} Solde`,   value: `**${balanceAfter.toLocaleString('fr-FR')}${symbol}**`,  inline: true },
      )
      .setFooter({ text: '🎡 Roue de la fortune · NexusBot' })
      .setTimestamp();

    const newRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`roue_replay:${encodeURIComponent(String(mise))}`).setLabel('🎡 Rejouer').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`roue_double:${encodeURIComponent(String(mise * 2))}`).setLabel('✖️ Rejouer ×2').setStyle(ButtonStyle.Success),
    );

    await interaction.update({ embeds: [embed], components: [newRow] }).catch(() => {});
    return true;
  }

  return false;
}

module.exports.handleComponent = handleComponent;
