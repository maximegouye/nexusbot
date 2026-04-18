/**
 * &roue <mise> — Roue de la fortune (mise illimitée).
 */
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const CASES = [
  { emoji: '💀', mult: 0,    weight: 30, label: '💀 Banqueroute' },
  { emoji: '🪙', mult: 0.5,  weight: 22, label: '🪙 Moitié remboursée' },
  { emoji: '⚖️', mult: 1,    weight: 18, label: '⚖️ Mise récupérée' },
  { emoji: '💰', mult: 1.5,  weight: 12, label: '💰 Petit gain ×1.5' },
  { emoji: '💎', mult: 2,    weight:  8, label: '💎 Gain ×2' },
  { emoji: '🏆', mult: 3,    weight:  5, label: '🏆 Bon gain ×3' },
  { emoji: '⭐', mult: 5,    weight:  3, label: '⭐ GROS gain ×5' },
  { emoji: '💫', mult: 10,   weight:  2, label: '💫 JACKPOT ×10' },
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
  name: 'roue',
  aliases: ['wheel', 'fortune'],
  description: 'Roue de la fortune — mise illimitée',
  category: 'Jeux',
  cooldown: 3,

  async execute(message, args, client, db) {
    const cfg    = db.getConfig(message.guild.id);
    const user   = db.getUser(message.author.id, message.guild.id);
    const symbol = cfg.currency_emoji || '€';
    const color  = cfg.color || '#9B59B6';
    const raw    = args[0];
    if (!raw) return message.reply('🎡 Utilise `&roue <mise>`. Ex : `&roue 500`, `&roue all`, `&roue 25%`.');

    const bet = parseBet(raw, user.balance);
    if (bet == null) return message.reply('❌ Mise invalide.');
    if (bet < 1n)    return message.reply('❌ Mise minimum : 1.');
    if (bet > BigInt(user.balance)) return message.reply(`❌ Solde insuffisant (**${user.balance.toLocaleString('fr-FR')}${symbol}**).`);

    const mise = Number(bet);
    db.removeCoins(message.author.id, message.guild.id, mise);

    const sent = await message.reply({
      embeds: [new EmbedBuilder().setColor(color).setTitle('🎡 La roue tourne…').setDescription(`**${message.author.username}** mise **${mise.toLocaleString('fr-FR')}${symbol}**…`)],
      allowedMentions: { repliedUser: false },
    });
    await new Promise(r => setTimeout(r, 2000));

    const pick = POOL[Math.floor(Math.random() * POOL.length)];
    const gain = Math.floor(mise * pick.mult);
    if (gain > 0) db.addCoins(message.author.id, message.guild.id, gain);
    const net = gain - mise;
    const balanceAfter = Math.max(0, user.balance - mise + gain);
    const resColor = pick.mult === 0 ? '#E74C3C' : pick.mult < 1 ? '#F39C12' : pick.mult >= 5 ? '#9B59B6' : '#2ECC71';

    const embed = new EmbedBuilder()
      .setColor(resColor)
      .setTitle(`🎡 La roue s'arrête sur… ${pick.emoji}`)
      .setDescription(`${pick.label}`)
      .addFields(
        { name: '💰 Mise',            value: `${mise.toLocaleString('fr-FR')}${symbol}`,              inline: true },
        { name: '✖️ Multiplicateur',   value: `×${pick.mult}`,                                        inline: true },
        { name: '🏆 Gain',            value: `${gain.toLocaleString('fr-FR')}${symbol}`,              inline: true },
        { name: net >= 0 ? '📈 Bénéfice' : '📉 Perte', value: `**${net > 0 ? '+' : ''}${net.toLocaleString('fr-FR')}${symbol}**`, inline: true },
        { name: `${symbol} Solde`,    value: `**${balanceAfter.toLocaleString('fr-FR')}${symbol}**`,  inline: true },
      )
      .setFooter({ text: '🎡 Roue de la fortune · NexusBot' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`roue_replay:${encodeURIComponent(String(mise))}`).setLabel('🎡 Rejouer').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`roue_double:${encodeURIComponent(String(mise))}`).setLabel('✖️ Rejouer ×2').setStyle(ButtonStyle.Success),
    );
    await sent.edit({ embeds: [embed], components: [row] }).catch(() => {});
  },
};
