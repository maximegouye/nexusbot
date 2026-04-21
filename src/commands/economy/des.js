/**
 * /des <mise> <pari> — Jeu de dés à 2 dés (2-12).
 * Paris :
 *   - pair (×2)
 *   - impair (×2)
 *   - bas (2-6) ×2 / haut (8-12) ×2 / sept (=7) ×5
 *   - numero (2-12, cote variable selon probabilité : ×35/×17/×11/×8/×6/×5)
 */
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

const DICE_EMOJI = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
// Multiplicateurs pour un numéro précis (2..12). Somme de 2 dés.
const NUM_MULT = { 2: 35, 3: 17, 4: 11, 5: 8, 6: 6, 7: 5, 8: 6, 9: 8, 10: 11, 11: 17, 12: 35 };

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
    .setName('des')
    .setDescription('🎲 Lance 2 dés — parie pair/impair, haut/bas, 7, ou un numéro précis')
    .addStringOption(o => o.setName('mise').setDescription('Montant (ex: 500, all, 25%)').setRequired(true).setMaxLength(20))
    .addStringOption(o => o.setName('pari').setDescription('Type de pari').setRequired(true).addChoices(
      { name: '🔢 Pair (×2)',                 value: 'pair' },
      { name: '🔢 Impair (×2)',               value: 'impair' },
      { name: '⬇️ Bas 2–6 (×2)',              value: 'bas' },
      { name: '⬆️ Haut 8–12 (×2)',            value: 'haut' },
      { name: '🎯 Sept (×5)',                  value: 'sept' },
      { name: '🎰 Numéro précis (×5 à ×35)',   value: 'numero' },
    ))
  cooldown: 2,

  async execute(interaction) {
    const cfg    = db.getConfig(interaction.guildId);
    const user   = db.getUser(interaction.user.id, interaction.guildId);
    const symbol = cfg.currency_emoji || '€';
    const pari    = interaction.options.getString('pari');
    const miseRaw = interaction.options.get('mise');
    const raw     = miseRaw ? String(miseRaw.value) : null;

    const bet = parseBet(raw, user.balance);
    if (bet == null) return interaction.reply({ content: '❌ Mise invalide.', ephemeral: true });
    if (bet < 1n)    return interaction.reply({ content: '❌ Mise minimum : 1.', ephemeral: true });
    if (bet > BigInt(user.balance)) return interaction.reply({ content: `❌ Solde insuffisant (**${user.balance.toLocaleString('fr-FR')}${symbol}**).`, ephemeral: true });

    let numeroVise = null;
    if (pari === 'numero') {
      numeroVise = interaction.options.getInteger('numero');
      if (numeroVise == null) return interaction.reply({ content: '❌ Précise aussi le numéro (2–12).', ephemeral: true });
    }

    const mise = Number(bet);
    db.removeCoins(interaction.user.id, interaction.guildId, mise);

    // Suspense : 2 frames avec dés qui changent rapidement
    const color = cfg.color || '#F39C12';
    const rollFrame = () => {
      const a = DICE_EMOJI[1 + Math.floor(Math.random() * 6)];
      const b = DICE_EMOJI[1 + Math.floor(Math.random() * 6)];
      return `# ${a}    ${b}`;
    };
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(color)
        .setTitle('🎲 Les dés roulent…')
        .setDescription(['```', rollFrame(), '```', '🌪️ Les dés tournent dans le gobelet…'].join('\n'))
      ],
    });
    await new Promise(r => setTimeout(r, 700));
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(color)
        .setTitle('🎲 Les dés roulent…')
        .setDescription(['```', rollFrame(), '```', '⚡ Ils ralentissent…'].join('\n'))
      ],
    }).catch(() => {});
    await new Promise(r => setTimeout(r, 700));

    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    const total = d1 + d2;

    let won = false, mult = 0, label = '';
    switch (pari) {
      case 'pair':   won = total % 2 === 0; mult = 2; label = '🔢 Pair';   break;
      case 'impair': won = total % 2 === 1; mult = 2; label = '🔢 Impair'; break;
      case 'bas':    won = total <= 6;      mult = 2; label = '⬇️ Bas (2–6)';  break;
      case 'haut':   won = total >= 8;      mult = 2; label = '⬆️ Haut (8–12)'; break;
      case 'sept':   won = total === 7;     mult = 5; label = '🎯 Sept';    break;
      case 'numero': won = total === numeroVise; mult = NUM_MULT[numeroVise] || 5; label = `🎰 Numéro ${numeroVise}`; break;
    }

    const gain = won ? mise * mult : 0;
    if (gain > 0) db.addCoins(interaction.user.id, interaction.guildId, gain);
    const balanceAfter = Math.max(0, user.balance - mise + gain);

    const resultEmbed = new EmbedBuilder()
      .setColor(won ? '#2ECC71' : '#E74C3C')
      .setTitle(won ? `🎲 GAGNÉ — ${total}` : `🎲 Perdu — ${total}`)
      .setDescription(`${DICE_EMOJI[d1]} ${DICE_EMOJI[d2]}  →  **${total}**`)
      .addFields(
        { name: '🎯 Pari',             value: label,                                              inline: true },
        { name: '💰 Mise',             value: `${mise.toLocaleString('fr-FR')}${symbol}`,         inline: true },
        { name: '✖️ Multiplicateur',    value: `×${mult}`,                                         inline: true },
        won
          ? { name: '💵 Gain net',     value: `**+${(gain - mise).toLocaleString('fr-FR')}${symbol}**`, inline: true }
          : { name: '💸 Perte',        value: `**-${mise.toLocaleString('fr-FR')}${symbol}**`,     inline: true },
        { name: `${symbol} Solde`,     value: `**${balanceAfter.toLocaleString('fr-FR')}${symbol}**`, inline: true },
      )
      .setFooter({ text: '🎲 Dés · NexusBot' })
      .setTimestamp();

    const encoded = encodeURIComponent(`${pari}:${numeroVise ?? ''}:${mise}`);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`des_replay:${encoded}`).setLabel('🎲 Rejouer').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`des_double:${encoded}`).setLabel('✖️ Rejouer ×2').setStyle(ButtonStyle.Success),
    );

    await interaction.editReply({ embeds: [resultEmbed], components: [row] }).catch(() => {});
  },
};
