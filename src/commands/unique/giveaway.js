const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

function parseDuration(str) {
  const match = str.match(/^(\d+)(s|m|h|d|w)$/);
  if (!match) return null;
  const n = parseInt(match[1]);
  const mult = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 };
  return n * mult[match[2]];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('🎉 Gérer les giveaways')
    .addSubcommand(s => s.setName('start').setDescription('🎉 Lancer un giveaway')
      .addStringOption(o => o.setName('duree').setDescription('Durée ex: 1d, 12h, 30m').setRequired(true))
      .addStringOption(o => o.setName('prix').setDescription('Prix à gagner').setRequired(true).setMaxLength(200))
      .addRoleOption(o => o.setName('role_bonus').setDescription('Rôle avec entrées bonus').setRequired(false))
      .addStringOption(o => o.setName('salon').setDescription('Salon (défaut: salon actuel)').setRequired(false)))
    .addSubcommand(s => s.setName('end').setDescription('⏹️ Terminer un giveaway maintenant')
      .addStringOption(o => o.setName('message_id').setDescription('ID du message du giveaway').setRequired(true)))
    .addSubcommand(s => s.setName('reroll').setDescription('🔄 Re-tirer les gagnants')
      .addStringOption(o => o.setName('message_id').setDescription('ID du message du giveaway').setRequired(true))),
  cooldown: 5,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const cfg = db.getConfig(interaction.guildId);

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: '❌ Tu as besoin de la permission Gérer le serveur.', ephemeral: true });
    }

    // ── START ──
    if (sub === 'start') {
      const durStr   = interaction.options.getString('duree');
      const winners  = interaction.options.getInteger('gagnants');
      const prize    = interaction.options.getString('prix');
      const minLevel = interaction.options.getInteger('min_niveau') || 0;
      const minBal   = interaction.options.getInteger('min_balance') || 0;
      const roleBonus = interaction.options.getRole('role_bonus');

      const durSec = parseDuration(durStr);
      if (!durSec) return interaction.reply({ content: '❌ Format de durée invalide. Exemples : `1d`, `12h`, `30m`', ephemeral: true });

      const endsAt  = Math.floor(Date.now() / 1000) + durSec;
      const channel = interaction.channel;

      const requirements = [];
      if (minLevel > 0) requirements.push(`⭐ Niveau minimum : **${minLevel}**`);
      if (minBal > 0) requirements.push(`💰 Solde minimum : **${minBal.toLocaleString('fr-FR')}** ${cfg.currency_name || 'coins'}`);
      if (roleBonus) requirements.push(`🎟️ **${roleBonus.name}** → entrées bonus`);

      const embed = new EmbedBuilder()
        .setColor('#FF73FA')
        .setTitle(`🎉 GIVEAWAY — ${prize}`)
        .setDescription([
          `🏆 **Prix :** ${prize}`,
          `🎟️ **Participants :** 0`,
          `👑 **Gagnants :** ${winners}`,
          `⏰ **Fin :** <t:${endsAt}:R> (<t:${endsAt}:f>)`,
          requirements.length ? `\n**Conditions :**\n${requirements.join('\n')}` : '',
          `\nClique sur 🎉 pour participer !`,
        ].filter(Boolean).join('\n'))
        .setFooter({ text: `Organisé par ${interaction.user.username}` })
        .setTimestamp(endsAt * 1000);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('giveaway_enter').setLabel('Participer').setEmoji('🎉').setStyle(ButtonStyle.Success)
      );

      const gMsg = await channel.send({ embeds: [embed], components: [row] });

      db.db.prepare(`INSERT INTO giveaways (guild_id, channel_id, message_id, prize, winners_count, ends_at, host_id, min_level, min_balance, bonus_role_id, status, entries)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', '[]')`)
        .run(interaction.guildId, channel.id, gMsg.id, prize, winners, endsAt, interaction.user.id, minLevel, minBal, roleBonus?.id || null);

      await interaction.reply({ content: `✅ Giveaway lancé dans ${channel} !`, ephemeral: true });
    }

    // ── END ──
    if (sub === 'end') {
      const msgId = interaction.options.getString('message_id');
      const gw    = db.db.prepare('SELECT * FROM giveaways WHERE message_id = ? AND guild_id = ?').get(msgId, interaction.guildId);
      if (!gw) return interaction.reply({ content: '❌ Giveaway introuvable.', ephemeral: true });
      if (gw.status !== 'active') return interaction.reply({ content: '❌ Ce giveaway est déjà terminé.', ephemeral: true });

      db.db.prepare('UPDATE giveaways SET ends_at = ? WHERE message_id = ?').run(Math.floor(Date.now() / 1000) - 1, msgId);
      await interaction.reply({ content: '✅ Le giveaway sera terminé au prochain tick (< 1 min).', ephemeral: true });
    }

    // ── REROLL ──
    if (sub === 'reroll') {
      const msgId = interaction.options.getString('message_id');
      const gw    = db.db.prepare('SELECT * FROM giveaways WHERE message_id = ? AND guild_id = ?').get(msgId, interaction.guildId);
      if (!gw) return interaction.reply({ content: '❌ Giveaway introuvable.', ephemeral: true });
      if (gw.status === 'active') return interaction.reply({ content: '❌ Ce giveaway est encore actif. Termine-le d\'abord.', ephemeral: true });

      const entries = JSON.parse(gw.entries || '[]');
      if (!entries.length) return interaction.reply({ content: '❌ Aucun participant.', ephemeral: true });

      const newWinners = [];
      const pool = [...entries];
      for (let i = 0; i < Math.min(gw.winners_count, pool.length); i++) {
        const idx = Math.floor(Math.random() * pool.length);
        newWinners.push(pool.splice(idx, 1)[0]);
      }

      const winnerMentions = newWinners.map(id => `<@${id}>`).join(', ');
      const channel = interaction.guild.channels.cache.get(gw.channel_id);
      if (channel) {
        channel.send({
          embeds: [new EmbedBuilder()
            .setColor('#FF73FA')
            .setTitle('🔄 Reroll — ' + gw.prize)
            .setDescription(`Nouveau${newWinners.length > 1 ? 'x' : ''} gagnant${newWinners.length > 1 ? 's' : ''} : ${winnerMentions} 🎉`)
          ]
        }).catch(() => {});
      }

      await interaction.reply({ content: `✅ Reroll effectué ! Gagnants : ${winnerMentions}`, ephemeral: true });
    }
  }
};
