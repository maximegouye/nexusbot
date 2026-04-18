/**
 * &des <mise> <pari> [numero] — Jeu de dés.
 * Pari : pair | impair | bas | haut | sept | numero <2-12>
 */
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const DICE_EMOJI = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const NUM_MULT = { 2: 35, 3: 17, 4: 11, 5: 8, 6: 6, 7: 5, 8: 6, 9: 8, 10: 11, 11: 17, 12: 35 };
const TYPES = new Set(['pair','impair','bas','haut','sept','numero']);

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
  name: 'des',
  aliases: ['dés', 'dice'],
  description: 'Jeu de dés — mise illimitée',
  category: 'Jeux',
  cooldown: 2,

  async execute(message, args, client, db) {
    const cfg    = db.getConfig(message.guild.id);
    const user   = db.getUser(message.author.id, message.guild.id);
    const symbol = cfg.currency_emoji || '€';
    const color  = cfg.color || '#F39C12';

    if (args.length < 2) {
      return message.reply({ content: '🎲 **Usage :** `&des <mise> <pari> [numero]`\n**Paris :** pair, impair, bas, haut, sept, numero\n**Exemple :** `&des 500 sept` · `&des all numero 7` · `&des 25% pair`' });
    }

    const bet = parseBet(args[0], user.balance);
    if (bet == null) return message.reply('❌ Mise invalide.');
    if (bet < 1n)    return message.reply('❌ Mise minimum : 1.');
    if (bet > BigInt(user.balance)) return message.reply(`❌ Solde insuffisant (**${user.balance.toLocaleString('fr-FR')}${symbol}**).`);

    const pari = args[1].toLowerCase();
    if (!TYPES.has(pari)) return message.reply(`❌ Pari invalide \`${pari}\`. Utilise : pair, impair, bas, haut, sept, numero`);

    let numeroVise = null;
    if (pari === 'numero') {
      numeroVise = parseInt(args[2], 10);
      if (isNaN(numeroVise) || numeroVise < 2 || numeroVise > 12) return message.reply('❌ Précise un numéro entre 2 et 12.');
    }

    const mise = Number(bet);
    db.removeCoins(message.author.id, message.guild.id, mise);

    const sent = await message.reply({
      embeds: [new EmbedBuilder().setColor(color).setTitle('🎲 Les dés roulent…').setDescription('⚃ ⚁  ?  ⚅ ⚂')],
      allowedMentions: { repliedUser: false },
    });
    await new Promise(r => setTimeout(r, 1400));

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
    if (gain > 0) db.addCoins(message.author.id, message.guild.id, gain);
    const balanceAfter = Math.max(0, user.balance - mise + gain);

    const embed = new EmbedBuilder()
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

    await sent.edit({ embeds: [embed], components: [row] }).catch(() => {});
  },
};
