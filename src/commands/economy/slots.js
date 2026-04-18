/**
 * /slots <mise> — Machine à sous premium, mises ILLIMITÉES.
 */
const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database/db');
const sl = require('../../utils/slotsEngine');

function parseBet(raw, balance) {
  if (!raw) return null;
  const s = String(raw).replace(/[\s_,]/g, '').toLowerCase();
  if (s === 'all' || s === 'tout' || s === 'max') return BigInt(balance);
  if (s === 'half' || s === 'moitié' || s === 'moitie' || s === '50%') return BigInt(Math.floor(balance / 2));
  const m = s.match(/^(\d+(?:\.\d+)?)(%)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!isFinite(n) || n < 0) return null;
  if (m[2] === '%') return BigInt(Math.floor(balance * Math.min(100, n) / 100));
  return BigInt(Math.floor(n));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slots')
    .setDescription('🎰 Machine à sous — mise ce que tu veux')
    .addStringOption(o => o.setName('mise').setDescription('Montant (ex: 500, 10000, all, 25%)').setRequired(true).setMaxLength(20)),
  cooldown: 3,

  async execute(interaction) {
    const cfg    = db.getConfig(interaction.guildId);
    const user   = db.getUser(interaction.user.id, interaction.guildId);
    const symbol = cfg.currency_emoji || '€';
    const miseRaw = interaction.options.get('mise');
    const raw     = miseRaw ? String(miseRaw.value) : null;

    const bet = parseBet(raw, user.balance);
    if (bet == null)                return interaction.reply({ content: '❌ Mise invalide.', ephemeral: true });
    if (bet < 1n)                   return interaction.reply({ content: '❌ La mise doit être d\'au moins **1**.', ephemeral: true });
    if (bet > BigInt(user.balance)) return interaction.reply({ content: `❌ Tu n'as que **${user.balance.toLocaleString('fr-FR')}${symbol}** en poche.`, ephemeral: true });

    const miseNum = Number(bet);
    db.removeCoins(interaction.user.id, interaction.guildId, miseNum);

    const color = cfg.color || '#9B59B6';
    const spinEmbed = sl.buildSpinEmbed({ userName: interaction.user.username, mise: miseNum, symbol, color });
    await interaction.reply({ embeds: [spinEmbed] });

    await new Promise(r => setTimeout(r, 1500));

    const { reels, gain, label } = sl.runRound(miseNum);
    if (gain > 0) db.addCoins(interaction.user.id, interaction.guildId, gain);
    const balanceAfter = Math.max(0, user.balance - miseNum + gain);

    await interaction.editReply({
      embeds: [sl.buildResultEmbed({ userName: interaction.user.username, mise: miseNum, gain, label, reels, balanceAfter, symbol, color })],
      components: [sl.buildReplayButtons(miseNum)],
    }).catch(() => {});
  },
};
