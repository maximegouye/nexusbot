const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quest')
    .setDescription('🗺️ Quêtes communautaires — progressez ensemble !')
    .addSubcommand(s => s.setName('voir').setDescription('📋 Voir les quêtes actives'))
    .addSubcommand(s => s.setName('contribuer').setDescription('🙋 Contribuer à une quête')
      .addIntegerOption(o => o.setName('quest_id').setDescription('ID de la quête').setRequired(true).setMinValue(1))
      .addIntegerOption(o => o.setName('montant').setDescription('Montant à contribuer').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('creer').setDescription('➕ Créer une quête (Admin)')
      .addStringOption(o => o.setName('titre').setDescription('Titre').setRequired(true).setMaxLength(100))
      .addStringOption(o => o.setName('description').setDescription('Description').setRequired(true).setMaxLength(500))
      .addIntegerOption(o => o.setName('objectif').setDescription('Objectif en €').setRequired(true).setMinValue(1))
      .addStringOption(o => o.setName('recompense').setDescription('Récompense à distribuer').setRequired(true))
      .addIntegerOption(o => o.setName('jours').setDescription('Durée en jours').setMinValue(1).setRequired(false))),
  cooldown: 5,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* already ack'd */ }
    }

    const sub = interaction.options.getSubcommand();
    const cfg = db.getConfig(interaction.guildId);
    const emoji = cfg.currency_emoji || '€';
    const name  = cfg.currency_name  || 'Coins';

    // ── VOIR ──
    if (sub === 'voir') {
      const quests = db.db.prepare('SELECT * FROM quests WHERE guild_id = ? AND status = "active" ORDER BY created_at DESC').all(interaction.guildId);

      if (!quests.length) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          embeds: [new EmbedBuilder()
            .setColor(cfg.color || '#7B2FBE')
            .setTitle('🗺️ Quêtes communautaires')
            .setDescription('Aucune quête active. Un admin peut en créer avec `/quest creer`.')
          ]
        });
      }

      const embed = new EmbedBuilder()
        .setColor(cfg.color || '#7B2FBE')
        .setTitle('🗺️ Quêtes communautaires')
        .setDescription('Contribuez ensemble pour atteindre les objectifs !');

      for (const q of quests) {
        const pct     = Math.min(Math.round(q.current / q.target * 100), 100);
        const barLen  = 15;
        const filled  = Math.round(pct / 100 * barLen);
        const bar     = '█'.repeat(filled) + '░'.repeat(barLen - filled);
        const endsAt  = q.ends_at ? `⏰ Fin <t:${q.ends_at}:R>` : '';
        embed.addFields({
          name: `#${q.id} 🗺️ ${q.title}`,
          value: `${q.description}\n${bar} **${pct}%** (${q.current.toLocaleString('fr-FR')}/${q.target.toLocaleString('fr-FR')} ${name})\n🏆 **Récompense :** ${q.reward}\n${endsAt}`,
          inline: false,
        });
      }

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    // ── CONTRIBUER ──
    if (sub === 'contribuer') {
      const questId = interaction.options.getInteger('quest_id');
      const amount  = interaction.options.getInteger('montant');
      const quest   = db.db.prepare('SELECT * FROM quests WHERE id = ? AND guild_id = ? AND status = "active"').get(questId, interaction.guildId);

      if (!quest) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Quête **#${questId}** introuvable.`, ephemeral: true });

      const user = db.getUser(interaction.user.id, interaction.guildId);
      if (user.balance < amount) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Tu n'as que **${user.balance.toLocaleString('fr-FR')} ${name}**.`, ephemeral: true });

      db.removeCoins(interaction.user.id, interaction.guildId, amount);
      db.db.prepare('UPDATE quests SET current = current + ? WHERE id = ?').run(amount, questId);
      db.db.prepare(`INSERT INTO quest_contributions (quest_id, guild_id, user_id, amount, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(quest_id, user_id) DO UPDATE SET amount = amount + ?`)
        .run(questId, interaction.guildId, interaction.user.id, amount, Math.floor(Date.now() / 1000), amount);

      const updated = db.db.prepare('SELECT * FROM quests WHERE id = ?').get(questId);
      const pct     = Math.min(Math.round(updated.current / updated.target * 100), 100);
      const barLen  = 15;
      const filled  = Math.round(pct / 100 * barLen);
      const bar     = '█'.repeat(filled) + '░'.repeat(barLen - filled);

      let completionMsg = '';
      if (updated.current >= updated.target && updated.status === 'active') {
        db.db.prepare('UPDATE quests SET status = "completed" WHERE id = ?').run(questId);
        completionMsg = `\n\n🎉 **QUÊTE ACCOMPLIE !** ${updated.reward}`;
        // Distribuer une récompense bonus à tous les contributeurs
        const contributors = db.db.prepare('SELECT * FROM quest_contributions WHERE quest_id = ?').all(questId);
        for (const c of contributors) {
          const bonus = Math.floor(c.amount * 0.1); // 10% bonus
          if (bonus > 0) db.addCoins(c.user_id, interaction.guildId, bonus);
        }
      }

      const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle(`🗺️ Contribution à "${quest.title}"`)
        .setDescription(`Tu as contribué **${amount.toLocaleString('fr-FR')} ${name}** ${emoji}${completionMsg}`)
        .addFields(
          { name: '📊 Progression', value: `${bar} **${pct}%**`, inline: false },
          { name: `${emoji} Restant`, value: `**${Math.max(0, updated.target - updated.current).toLocaleString('fr-FR')}** ${name}`, inline: true },
        );

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    // ── CRÉER (Admin) ──
    if (sub === 'creer') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tu n\'as pas la permission de créer des quêtes.', ephemeral: true });
      }

      const titre    = interaction.options.getString('titre');
      const desc     = interaction.options.getString('description');
      const objectif = interaction.options.getInteger('objectif');
      const reward   = interaction.options.getString('recompense');
      const days     = interaction.options.getInteger('jours') || null;
      const endsAt   = days ? Math.floor(Date.now() / 1000) + days * 86400 : null;

      const result = db.db.prepare(`INSERT INTO quests (guild_id, title, description, target, current, reward, status, ends_at, created_at)
        VALUES (?, ?, ?, ?, 0, ?, "active", ?, ?)`)
        .run(interaction.guildId, titre, desc, objectif, reward, endsAt, Math.floor(Date.now() / 1000));

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('✅ Quête créée !')
          .addFields(
            { name: '🗺️ Titre',       value: titre,                                      inline: true },
            { name: `€ Objectif`, value: `${objectif.toLocaleString('fr-FR')} €`, inline: true },
            { name: '🏆 Récompense',   value: reward,                                    inline: false },
            ...(endsAt ? [{ name: '⏰ Fin', value: `<t:${endsAt}:D>`, inline: true }] : []),
          )
        ]
      });
    }
  }
};
