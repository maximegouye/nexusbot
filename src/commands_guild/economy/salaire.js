/**
 * NexusBot — Système de salaire automatique par rôle
 * /salaire — Attribuer des revenus automatiques selon les rôles
 * Unique : personne d'autre ne fait ça aussi bien
 */
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS salaires (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, role_id TEXT,
    montant INTEGER DEFAULT 100,
    intervalle TEXT DEFAULT 'daily',
    last_paid INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, role_id)
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS salary_claims (
    guild_id TEXT, user_id TEXT, last_claim INTEGER DEFAULT 0,
    PRIMARY KEY(guild_id, user_id)
  )`).run();
} catch {}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('salaire')
    .setDescription('💼 Système de salaire automatique par rôle')

    .addSubcommand(s => s.setName('configurer').setDescription('⚙️ Définir le salaire d\'un rôle (admin)')
      .addRoleOption(o => o.setName('role').setDescription('Rôle concerné').setRequired(true))
      .addStringOption(o => o.setName('montant').setDescription('Salaire à recevoir (aucune limite)').setRequired(true).setMaxLength(30))
      .addStringOption(o => o.setName('intervalle').setDescription('Fréquence de paiement').setRequired(true)
        .addChoices(
          { name: '⏰ Toutes les heures', value: 'hourly' },
          { name: '📅 Chaque jour', value: 'daily' },
          { name: '📆 Chaque semaine', value: 'weekly' },
        )))

    .addSubcommand(s => s.setName('supprimer').setDescription('🗑️ Supprimer le salaire d\'un rôle (admin)')
      .addRoleOption(o => o.setName('role').setDescription('Rôle à supprimer').setRequired(true)))

    .addSubcommand(s => s.setName('liste').setDescription('📋 Voir tous les salaires configurés'))

    .addSubcommand(s => s.setName('reclamer').setDescription('💰 Réclamer votre salaire'))

    .addSubcommand(s => s.setName('mon_salaire').setDescription('👤 Voir votre salaire potentiel')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId  = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '€';
    const now = Math.floor(Date.now() / 1000);

    const intervalSeconds = { hourly: 3600, daily: 86400, weekly: 604800 };
    const intervalLabels  = { hourly: '⏰ Heure', daily: '📅 Jour', weekly: '📆 Semaine' };

    if (sub === 'configurer') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
        return interaction.reply({ content: '❌ Permission **Gérer le serveur** requise.', ephemeral: true });

      const role     = interaction.options.getRole('role');
      const montant  = interaction.options.getInteger('montant');
      const intervalle = interaction.options.getString('intervalle');

      db.db.prepare(`INSERT INTO salaires (guild_id,role_id,montant,intervalle) VALUES(?,?,?,?)
        ON CONFLICT(guild_id,role_id) DO UPDATE SET montant=?,intervalle=?`)
        .run(guildId, role.id, montant, intervalle, montant, intervalle);

      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#2ECC71')
        .setTitle('✅ Salaire configuré')
        .addFields(
          { name: '🎭 Rôle',      value: `${role}`,                    inline: true },
          { name: '💰 Montant',   value: `${montant} ${coin}`,          inline: true },
          { name: '⏱️ Fréquence', value: intervalLabels[intervalle],    inline: true },
        )
        .setDescription(`Les membres avec ${role} pourront réclamer **${montant} ${coin}** ${intervalLabels[intervalle].toLowerCase()}.`)] });
    }

    if (sub === 'supprimer') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
        return interaction.reply({ content: '❌ Permission requise.', ephemeral: true });
      const role = interaction.options.getRole('role');
      db.db.prepare('DELETE FROM salaires WHERE guild_id=? AND role_id=?').run(guildId, role.id);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#E74C3C')
        .setDescription(`🗑️ Salaire de ${role} supprimé.`)] });
    }

    if (sub === 'liste') {
      const salaires = db.db.prepare('SELECT * FROM salaires WHERE guild_id=? ORDER BY montant DESC').all(guildId);
      if (!salaires.length) return interaction.reply({ content: '💼 Aucun salaire configuré. Utilisez `/salaire configurer`.', ephemeral: true });
      const lines = salaires.map(s =>
        `🎭 <@&${s.role_id}> → **${s.montant} ${coin}** / ${intervalLabels[s.intervalle] || s.intervalle}`
      );
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#3498DB')
        .setTitle('💼 Salaires configurés')
        .setDescription(lines.join('\n'))] });
    }

    if (sub === 'reclamer') {
      // Récupère tous les salaires du serveur
      const allSalaires = db.db.prepare('SELECT * FROM salaires WHERE guild_id=?').all(guildId);
      if (!allSalaires.length) return interaction.reply({ content: '💼 Aucun salaire configuré sur ce serveur.', ephemeral: true });

      // Récupère les rôles du membre
      const member = interaction.member;
      const claim = db.db.prepare('SELECT * FROM salary_claims WHERE guild_id=? AND user_id=?').get(guildId, userId)
        || { last_claim: 0 };

      let totalGain = 0;
      const gains = [];

      for (const sal of allSalaires) {
        if (!member.roles.cache.has(sal.role_id)) continue;
        const cooldown = intervalSeconds[sal.intervalle] || 86400;
        if (now - claim.last_claim < cooldown) {
          const reste = cooldown - (now - claim.last_claim);
          const h = Math.floor(reste / 3600);
          const m = Math.floor((reste % 3600) / 60);
          gains.push(`⏳ <@&${sal.role_id}> — disponible dans **${h}h ${m}min**`);
          continue;
        }
        totalGain += sal.montant;
        gains.push(`✅ <@&${sal.role_id}> → +**${sal.montant} ${coin}**`);
      }

      if (totalGain > 0) {
        db.addCoins(userId, guildId, totalGain);
        db.db.prepare(`INSERT INTO salary_claims (guild_id,user_id,last_claim) VALUES(?,?,?)
          ON CONFLICT(guild_id,user_id) DO UPDATE SET last_claim=?`).run(guildId, userId, now, now);
      }

      return interaction.reply({ embeds: [new EmbedBuilder().setColor(totalGain > 0 ? '#2ECC71' : '#F59E0B')
        .setTitle(`💼 Salaire${totalGain > 0 ? ` reçu : +${totalGain} ${coin}` : ' — Pas encore disponible'}`)
        .setDescription(gains.join('\n') || '*Vous n\'avez aucun rôle avec un salaire.*')
        .setThumbnail(interaction.user.displayAvatarURL())], ephemeral: true });
    }

    if (sub === 'mon_salaire') {
      const allSalaires = db.db.prepare('SELECT * FROM salaires WHERE guild_id=?').all(guildId);
      const member = interaction.member;
      const myRoles = [];
      let totalPotentiel = 0;

      for (const sal of allSalaires) {
        if (member.roles.cache.has(sal.role_id)) {
          myRoles.push(`🎭 <@&${sal.role_id}> → **${sal.montant} ${coin}** / ${intervalLabels[sal.intervalle]}`);
          if (sal.intervalle === 'daily') totalPotentiel += sal.montant;
          if (sal.intervalle === 'hourly') totalPotentiel += sal.montant * 24;
          if (sal.intervalle === 'weekly') totalPotentiel += Math.floor(sal.montant / 7);
        }
      }

      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#F59E0B')
        .setTitle('💼 Votre salaire')
        .setDescription(myRoles.length ? myRoles.join('\n') : '*Vous n\'avez aucun rôle avec un salaire.*')
        .addFields(
          { name: '📈 Potentiel journalier estimé', value: `~${totalPotentiel} ${coin}`, inline: true },
        )], ephemeral: true });
    }
  }
};
