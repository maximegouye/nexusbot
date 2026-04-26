const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS prison (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT,
    libere_at INTEGER, motif TEXT, gardien_id TEXT,
    caution INTEGER DEFAULT 0,
    UNIQUE(guild_id, user_id)
  )`).run();
} catch {}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('prison')
    .setDescription('⛓️ Système de prison virtuelle')
    .addSubcommand(s => s.setName('emprisonner').setDescription('⛓️ Emprisonner un membre')
      .addUserOption(o => o.setName('membre').setDescription('Membre à emprisonner').setRequired(true))
      .addStringOption(o => o.setName('motif').setDescription('Motif').setRequired(true)))
    .addSubcommand(s => s.setName('liberer').setDescription('🔓 Libérer un prisonnier (admin)')
      .addUserOption(o => o.setName('membre').setDescription('Membre à libérer').setRequired(true)))
    .addSubcommand(s => s.setName('evasion').setDescription('🏃 Tenter une évasion (50% de chance)'))
    .addSubcommand(s => s.setName('caution').setDescription('💰 Payer sa caution pour se libérer'))
    .addSubcommand(s => s.setName('statut').setDescription('📋 Voir les prisonniers actuels'))
    .addSubcommand(s => s.setName('cellule').setDescription('🔍 Voir ton statut en prison')),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '€';

    if (sub === 'emprisonner') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers))
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Permission refusée.', ephemeral: true });

      const target = interaction.options.getUser('membre');
      const duree = interaction.options.getInteger('duree');
      const motif = interaction.options.getString('motif');
      const caution = parseInt(interaction.options.getString('caution')) || 0;

      if (target.bot) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tu ne peux pas emprisonner un bot.', ephemeral: true });

      const libereAt = Math.floor(Date.now() / 1000) + duree * 60;
      try {
        db.db.prepare('INSERT OR REPLACE INTO prison (guild_id, user_id, libere_at, motif, gardien_id, caution) VALUES (?,?,?,?,?,?)')
          .run(guildId, target.id, libereAt, motif, userId, caution);
      } catch (e) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Erreur : ${e.message}`, ephemeral: true });
      }

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('Red')
          .setTitle('⛓️ Membre emprisonné !')
          .setDescription(`<@${target.id}> a été envoyé en prison !`)
          .addFields(
            { name: '📋 Motif', value: motif, inline: true },
            { name: '⏰ Libération', value: `<t:${libereAt}:R>`, inline: true },
            { name: '💰 Caution', value: caution > 0 ? `**${caution} ${coin}**` : 'Aucune', inline: true },
          ).setTimestamp()
      ]});
    }

    if (sub === 'liberer') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers))
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Permission refusée.', ephemeral: true });

      const target = interaction.options.getUser('membre');
      const p = db.db.prepare('SELECT * FROM prison WHERE guild_id=? AND user_id=?').get(guildId, target.id);
      if (!p) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ <@${target.id}> n'est pas en prison.`, ephemeral: true });

      db.db.prepare('DELETE FROM prison WHERE guild_id=? AND user_id=?').run(guildId, target.id);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('Green').setDescription(`🔓 <@${target.id}> a été libéré(e) par <@${userId}>.`)
      ]});
    }

    if (sub === 'evasion') {
      const p = db.db.prepare('SELECT * FROM prison WHERE guild_id=? AND user_id=?').get(guildId, userId);
      if (!p) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tu n\'es pas en prison.', ephemeral: true });

      if (Math.random() < 0.5) {
        db.db.prepare('DELETE FROM prison WHERE guild_id=? AND user_id=?').run(guildId, userId);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          new EmbedBuilder().setColor('Green').setTitle('🏃 Évasion réussie !')
            .setDescription('Tu t\'es échappé(e) de prison ! Cours vite avant d\'être repris !')
        ]});
      } else {
        // Peine doublée en cas d'échec
        const newRelease = p.libere_at + 600; // +10 minutes
        db.db.prepare('UPDATE prison SET libere_at=? WHERE id=?').run(newRelease, p.id);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          new EmbedBuilder().setColor('Red').setTitle('❌ Évasion échouée !')
            .setDescription(`Tu t\'es fait(e) reprendre ! Ta peine a été allongée de 10 minutes.\nLibération : <t:${newRelease}:R>`)
        ]});
      }
    }

    if (sub === 'caution') {
      const p = db.db.prepare('SELECT * FROM prison WHERE guild_id=? AND user_id=?').get(guildId, userId);
      if (!p) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tu n\'es pas en prison.', ephemeral: true });
      if (!p.caution || p.caution <= 0) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucune caution n\'a été fixée pour toi.', ephemeral: true });

      const u = db.getUser(userId, guildId);
      if (u.balance < p.caution) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Tu n'as pas assez de ${coin}. Caution : **${p.caution} ${coin}**.`, ephemeral: true });

      db.addCoins(userId, guildId, -p.caution);
      db.db.prepare('DELETE FROM prison WHERE guild_id=? AND user_id=?').run(guildId, userId);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('Green').setTitle('🔓 Caution payée !')
          .setDescription(`Tu as payé ta caution de **${p.caution} ${coin}** et tu es libre !`)
      ]});
    }

    if (sub === 'cellule') {
      const p = db.db.prepare('SELECT * FROM prison WHERE guild_id=? AND user_id=?').get(guildId, userId);
      if (!p) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '✅ Tu es libre comme l\'air !', ephemeral: true });

      const now = Math.floor(Date.now() / 1000);
      if (p.libere_at <= now) {
        db.db.prepare('DELETE FROM prison WHERE guild_id=? AND user_id=?').run(guildId, userId);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '✅ Ta peine est terminée ! Tu es libre.', ephemeral: true });
      }

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('Orange').setTitle('⛓️ Tu es en prison')
          .addFields(
            { name: '📋 Motif', value: p.motif, inline: true },
            { name: '⏰ Libération', value: `<t:${p.libere_at}:R>`, inline: true },
            { name: '💰 Caution', value: p.caution > 0 ? `${p.caution} ${coin}` : 'Aucune', inline: true },
          ).setTimestamp()
      ], ephemeral: true });
    }

    if (sub === 'statut') {
      const prisonniers = db.db.prepare('SELECT * FROM prison WHERE guild_id=? ORDER BY libere_at ASC').all(guildId);
      const now = Math.floor(Date.now() / 1000);

      // Nettoyer les libérations passées
      db.db.prepare('DELETE FROM prison WHERE guild_id=? AND libere_at<=?').run(guildId, now);
      const actifs = prisonniers.filter(p => p.libere_at > now);

      if (!actifs.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '✅ Aucun prisonnier en ce moment.', ephemeral: true });

      const lines = actifs.map(p => `⛓️ <@${p.user_id}> — Motif: *${p.motif}* — Libre <t:${p.libere_at}:R>`).join('\n');
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('Red').setTitle(`⛓️ Prisonniers (${actifs.length})`).setDescription(lines).setTimestamp()
      ]});
    }
  }
};
