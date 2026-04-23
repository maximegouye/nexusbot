/**
 * /historique — Historique des transactions économiques (navigation par pages).
 * Affiche les dernières opérations : gains, dépenses, virements, crypto, jeux…
 */
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

const PAGE_SIZE = 10;

const TYPE_EMOJI = {
  earn:         '📈',
  spend:        '📉',
  transfer_in:  '📥',
  transfer_out: '📤',
  game_win:     '🏆',
  game_loss:    '💸',
  buy_crypto:   '💹',
  sell_crypto:  '💵',
  deposit:      '🏦',
  withdraw:     '🏧',
  admin:        '⚙️',
  daily:        '📅',
  work:         '💼',
  crime:        '🔫',
  rob:          '🥷',
  fish:         '🎣',
  hunt:         '🏹',
};

const TYPE_LABEL = {
  earn: 'Gain',
  spend: 'Dépense',
  transfer_in: 'Reçu',
  transfer_out: 'Envoyé',
  game_win: 'Jeu · gain',
  game_loss: 'Jeu · perte',
  buy_crypto: 'Achat crypto',
  sell_crypto: 'Vente crypto',
  deposit: 'Dépôt banque',
  withdraw: 'Retrait banque',
  admin: 'Action admin',
  daily: 'Récompense quotidienne',
  work: 'Travail',
  crime: 'Crime',
  rob: 'Vol',
  fish: 'Pêche',
  hunt: 'Chasse',
};

function buildEmbed({ user, guild, page, total, rows, symbol, color }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const lines = rows.length
    ? rows.map((r, i) => {
        const emoji = TYPE_EMOJI[r.type] || '🔹';
        const label = TYPE_LABEL[r.type] || r.type;
        const sign  = r.amount > 0 ? '+' : '';
        const amt   = `${sign}${r.amount.toLocaleString('fr-FR')}${symbol}`;
        const dest  = r.related_user ? ` · <@${r.related_user}>` : '';
        const note  = r.note ? ` — *${r.note}*` : '';
        const when  = `<t:${r.created_at}:R>`;
        return `\`${String(start + i + 1).padStart(2, '0')}.\` ${emoji} **${label}** ${amt}${dest}${note} · ${when}`;
      }).join('\n')
    : '*Aucune transaction enregistrée pour le moment.*';

  return new EmbedBuilder()
    .setColor(color || '#7C3AED')
    .setTitle(`📜 Historique — ${user.username}`)
    .setDescription(lines)
    .setThumbnail(user.displayAvatarURL({ size: 128 }))
    .setFooter({ text: `Page ${page} / ${pages} · ${total.toLocaleString('fr-FR')} transaction${total > 1 ? 's' : ''} au total` })
    .setTimestamp();
}

function buildButtons(userId, page, pages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`hist_first:${userId}`).setLabel('⏮').setStyle(ButtonStyle.Secondary).setDisabled(page <= 1),
    new ButtonBuilder().setCustomId(`hist_prev:${userId}:${page}`).setLabel('◀ Précédent').setStyle(ButtonStyle.Primary).setDisabled(page <= 1),
    new ButtonBuilder().setCustomId(`hist_refresh:${userId}:${page}`).setLabel(`${page} / ${pages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId(`hist_next:${userId}:${page}`).setLabel('Suivant ▶').setStyle(ButtonStyle.Primary).setDisabled(page >= pages),
    new ButtonBuilder().setCustomId(`hist_last:${userId}:${pages}`).setLabel('⏭').setStyle(ButtonStyle.Secondary).setDisabled(page >= pages),
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('historique')
    .setDescription('📜 Consulte l\'historique complet de tes transactions économiques')
    .addUserOption(o => o.setName('membre').setDescription('Voir l\'historique d\'un autre membre (admin seulement)').setRequired(false)),
  cooldown: 3,

  async execute(interaction) {
    const target = interaction.options.getUser('membre') || interaction.user;
    if (target.id !== interaction.user.id && !interaction.member.permissions.has('ManageGuild')) {
      return interaction.editReply({ content: '❌ Tu dois être admin pour consulter l\'historique d\'un autre membre.', ephemeral: true });
    }
    const cfg    = db.getConfig(interaction.guildId);
    const symbol = cfg.currency_emoji || '€';
    const color  = cfg.color || '#7C3AED';

    const total = db.countTransactions(target.id, interaction.guildId);
    const rows  = db.getTransactions(target.id, interaction.guildId, PAGE_SIZE, 0);
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return interaction.editReply({
      embeds: [buildEmbed({ user: target, guild: interaction.guild, page: 1, total, rows, symbol, color })],
      components: [buildButtons(target.id, 1, pages)],
    });
  },

  _build: { buildEmbed, buildButtons, PAGE_SIZE, TYPE_EMOJI, TYPE_LABEL },
};
