/**
 * /roulette <mise> [pari] — Roulette européenne.
 * Mise ILLIMITÉE (min 1, max = solde). Si pari omis, un menu propose les choix.
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const r  = require('../../utils/rouletteEngine');

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

const CHOIX = [
  { name: '🔴 Rouge (×2)',             value: 'rouge' },
  { name: '⚫ Noir (×2)',               value: 'noir' },
  { name: '🔢 Pair (×2)',               value: 'pair' },
  { name: '🔢 Impair (×2)',             value: 'impair' },
  { name: '1️⃣ Manque 1–18 (×2)',       value: 'manque' },
  { name: '2️⃣ Passe 19–36 (×2)',       value: 'passe' },
  { name: '🎯 1ère douzaine (×3)',      value: 'douzaine_1' },
  { name: '🎯 2ème douzaine (×3)',      value: 'douzaine_2' },
  { name: '🎯 3ème douzaine (×3)',      value: 'douzaine_3' },
  { name: '📊 1ère colonne (×3)',       value: 'colonne_1' },
  { name: '📊 2ème colonne (×3)',       value: 'colonne_2' },
  { name: '📊 3ème colonne (×3)',       value: 'colonne_3' },
  { name: '🟢 Numéro plein (×36)',      value: 'numero' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roulette')
    .setDescription('🎡 Roulette — mise ce que tu veux, choisis ton pari')
    .addStringOption(o => o.setName('mise').setDescription('Montant misé (ex: 500, 1000, all, 25%)').setRequired(true).setMaxLength(20))
    .addStringOption(o => o.setName('pari').setDescription('Type de pari').setRequired(false).addChoices(...CHOIX))
  cooldown: 3,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const cfg    = db.getConfig(interaction.guildId);
    const user   = db.getUser(interaction.user.id, interaction.guildId);
    const symbol = cfg.currency_emoji || '€';
    // Accepte String OU Integer (compat cache Discord qui peut encore avoir l'ancienne signature)
    const miseRaw = interaction.options.get('mise');
    const raw     = miseRaw ? String(miseRaw.value) : null;

    const mise = parseBet(raw, user.balance);
    if (mise == null)   return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Mise invalide.', ephemeral: true });
    if (mise < 1n)      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Mise minimum : 1.', ephemeral: true });
    if (mise > BigInt(user.balance)) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Tu n'as que **${user.balance.toLocaleString('fr-FR')}${symbol}** en poche.`, ephemeral: true });

    const pariType = interaction.options.getString('pari');
    if (!pariType) {
      // Pas de pari → on propose le menu
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder()
          .setColor(cfg.color || '#9B59B6')
          .setTitle('🎡 Choisis ton pari')
          .setDescription(`Tu mises **${mise.toLocaleString('fr-FR')}${symbol}**. Sélectionne dans le menu ci-dessous.`)
          .setFooter({ text: 'Pour miser sur un numéro précis, utilise /roulette mise pari:numero numero:<N>' })
        ],
        components: [r.buildChoiceMenu(Number(mise))],
        ephemeral: true,
      });
    }

    let param = null;
    if (pariType === 'numero') {
      param = parseInt(interaction.options.getString('numero'));
      if (param == null) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Pour un numéro plein, précise aussi `numero:<0-36>`.', ephemeral: true });
    }

    await spinAndResolve(interaction, { type: pariType, param }, mise, cfg, symbol, user);
  },

  // Exporté pour que le handler de bouton/select puisse rappeler
  _spinAndResolve: spinAndResolve,
};

async function spinAndResolve(interaction, bet, mise, cfg, symbol, user) {
  const color = cfg.color || '#9B59B6';
  const userName = interaction.user.username;
  const miseNum = Number(mise);

  // Prélèvement de la mise
  db.removeCoins(interaction.user.id, interaction.guildId, miseNum);

  // Phase de suspense : animation 3 frames avec ralentissement progressif
  const spinEmbed0 = r.buildSpinningEmbed({ userName, bet, mise: miseNum, symbol, color, frame: 0 });
  let replyMsg;
  if (interaction.replied || interaction.deferred) {
    replyMsg = await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [spinEmbed0], components: [] }).catch(() => null);
  } else {
    replyMsg = await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [spinEmbed0], components: [], fetchReply: true }).catch(() => null);
  }

  await new Promise(res => setTimeout(res, 900));
  await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [r.buildSpinningEmbed({ userName, bet, mise: miseNum, symbol, color, frame: 1 })] }).catch(() => {});
  await new Promise(res => setTimeout(res, 900));
  await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [r.buildSpinningEmbed({ userName, bet, mise: miseNum, symbol, color, frame: 2 })] }).catch(() => {});
  await new Promise(res => setTimeout(res, 700));

  // Tirage + résolution
  const result = r.spin();
  const { won, mult } = r.checkWin(bet, result);
  const delta = won ? miseNum * (mult - 1) : 0;
  if (won) db.addCoins(interaction.user.id, interaction.guildId, miseNum * mult);
  const balanceAfter = won ? user.balance - miseNum + miseNum * mult : user.balance - miseNum;

  const finalEmbed = r.buildResultEmbed({ userName, bet, mise: miseNum, symbol, color, result, won, mult, delta, balanceAfter: Math.max(0, balanceAfter) });
  const replayRow  = r.buildReplayButtons(bet, miseNum);

  if (interaction.replied || interaction.deferred) {
    await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [finalEmbed], components: [replayRow] }).catch(() => {});
  } else {
    await interaction.followUp({ embeds: [finalEmbed], components: [replayRow] }).catch(() => {});
  }
}
