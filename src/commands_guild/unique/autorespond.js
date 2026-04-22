/**
 * NexusBot — Auto-réponses personnalisées
 * /autorespond — Créer des réponses automatiques à des mots-clés
 * Mieux que Carl-bot
 */
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS auto_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, trigger_word TEXT,
    response TEXT, exact_match INTEGER DEFAULT 0,
    channel_id TEXT, role_required TEXT,
    uses INTEGER DEFAULT 0, active INTEGER DEFAULT 1,
    created_by TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autorespond')
    .setDescription('💬 Gérer les réponses automatiques du bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)

    .addSubcommand(s => s.setName('ajouter').setDescription('➕ Créer une auto-réponse')
      .addStringOption(o => o.setName('declencheur').setDescription('Mot ou phrase qui déclenche la réponse').setRequired(true).setMaxLength(100))
      .addStringOption(o => o.setName('reponse').setDescription('Réponse du bot').setRequired(true).setMaxLength(1500))
      .addBooleanOption(o => o.setName('exact').setDescription('true = correspondance exacte, false = contient le mot'))
      .addChannelOption(o => o.setName('salon').setDescription('Limiter à un salon spécifique'))
      .addRoleOption(o => o.setName('role').setDescription('Limiter à un rôle spécifique')))

    .addSubcommand(s => s.setName('supprimer').setDescription('🗑️ Supprimer une auto-réponse')
      .addIntegerOption(o => o.setName('id').setDescription('ID de l\'auto-réponse').setRequired(true)))

    .addSubcommand(s => s.setName('liste').setDescription('📋 Voir toutes les auto-réponses'))

    .addSubcommand(s => s.setName('voir').setDescription('🔍 Voir le détail d\'une auto-réponse')
      .addIntegerOption(o => o.setName('id').setDescription('ID').setRequired(true)))

    .addSubcommand(s => s.setName('activer').setDescription('✅ Activer/désactiver une auto-réponse')
      .addIntegerOption(o => o.setName('id').setDescription('ID').setRequired(true))
      .addBooleanOption(o => o.setName('actif').setDescription('true = activer, false = désactiver').setRequired(true)))

    .addSubcommand(s => s.setName('stats').setDescription('📊 Statistiques d\'utilisation des auto-réponses')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'ajouter') {
      const trigger  = interaction.options.getString('declencheur').toLowerCase();
      const response = interaction.options.getString('reponse');
      const exact    = interaction.options.getBoolean('exact') ? 1 : 0;
      const salon    = interaction.options.getChannel('salon');
      const role     = interaction.options.getRole('role');

      // Vérifie doublons
      const existing = db.db.prepare('SELECT id FROM auto_responses WHERE guild_id=? AND LOWER(trigger_word)=?').get(guildId, trigger);
      if (existing) return interaction.editReply({ content: `❌ Une auto-réponse pour **"${trigger}"** existe déjà (#${existing.id}). Supprimez-la d'abord.`, ephemeral: true });

      const result = db.db.prepare(`
        INSERT INTO auto_responses (guild_id,trigger_word,response,exact_match,channel_id,role_required,created_by)
        VALUES(?,?,?,?,?,?,?)
      `).run(guildId, trigger, response, exact, salon?.id ?? null, role?.id ?? null, interaction.user.id);

      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2ECC71')
        .setTitle(`✅ Auto-réponse créée — ID #${result.lastInsertRowid}`)
        .addFields(
          { name: '🔑 Déclencheur', value: `\`${trigger}\``, inline: true },
          { name: '🎯 Type',        value: exact ? 'Correspondance exacte' : 'Contient le mot', inline: true },
          { name: '💬 Salon',       value: salon ? `${salon}` : 'Tous les salons', inline: true },
          { name: '🎭 Rôle requis', value: role ? `${role}` : 'Tous', inline: true },
          { name: '📝 Réponse',     value: response.slice(0, 300), inline: false },
        )] });
    }

    if (sub === 'supprimer') {
      const id = parseInt(interaction.options.getString('id'));
      const entry = db.db.prepare('SELECT * FROM auto_responses WHERE id=? AND guild_id=?').get(id, guildId);
      if (!entry) return interaction.editReply({ content: `❌ Auto-réponse #${id} introuvable.`, ephemeral: true });
      db.db.prepare('DELETE FROM auto_responses WHERE id=?').run(id);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#E74C3C')
        .setDescription(`🗑️ Auto-réponse **#${id}** (\`${entry.trigger_word}\`) supprimée.`)] });
    }

    if (sub === 'liste') {
      const entries = db.db.prepare('SELECT * FROM auto_responses WHERE guild_id=? ORDER BY id DESC LIMIT 20').all(guildId);
      if (!entries.length) return interaction.editReply({ content: '💬 Aucune auto-réponse. Créez-en avec `/autorespond ajouter`.', ephemeral: true });
      const lines = entries.map(e =>
        `${e.active ? '✅' : '❌'} **#${e.id}** \`${e.trigger_word}\` → ${e.response.slice(0,60)}${e.response.length>60?'...':''} | 🔢 ${e.uses} uses`
      );
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#3498DB')
        .setTitle(`💬 Auto-réponses (${entries.length})`)
        .setDescription(lines.join('\n'))], ephemeral: true });
    }

    if (sub === 'voir') {
      const id = parseInt(interaction.options.getString('id'));
      const entry = db.db.prepare('SELECT * FROM auto_responses WHERE id=? AND guild_id=?').get(id, guildId);
      if (!entry) return interaction.editReply({ content: `❌ #${id} introuvable.`, ephemeral: true });
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#9B59B6')
        .setTitle(`💬 Auto-réponse #${id}`)
        .addFields(
          { name: '🔑 Déclencheur', value: `\`${entry.trigger_word}\``, inline: true },
          { name: '🎯 Mode',        value: entry.exact_match ? 'Exact' : 'Contient', inline: true },
          { name: '📊 Utilisations', value: `${entry.uses}`, inline: true },
          { name: '💬 Salon',       value: entry.channel_id ? `<#${entry.channel_id}>` : 'Tous', inline: true },
          { name: '🎭 Rôle',        value: entry.role_required ? `<@&${entry.role_required}>` : 'Tous', inline: true },
          { name: '📊 Statut',      value: entry.active ? '✅ Actif' : '❌ Inactif', inline: true },
          { name: '📝 Réponse',     value: entry.response, inline: false },
        )], ephemeral: true });
    }

    if (sub === 'activer') {
      const id   = parseInt(interaction.options.getString('id'));
      const actif = interaction.options.getBoolean('actif');
      const entry = db.db.prepare('SELECT * FROM auto_responses WHERE id=? AND guild_id=?').get(id, guildId);
      if (!entry) return interaction.editReply({ content: `❌ #${id} introuvable.`, ephemeral: true });
      db.db.prepare('UPDATE auto_responses SET active=? WHERE id=?').run(actif ? 1 : 0, id);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(actif ? '#2ECC71' : '#95A5A6')
        .setDescription(`${actif ? '✅ Activée' : '❌ Désactivée'} — Auto-réponse **#${id}** (\`${entry.trigger_word}\`)`)] });
    }

    if (sub === 'stats') {
      const total  = db.db.prepare('SELECT COUNT(*) as c, SUM(uses) as u FROM auto_responses WHERE guild_id=?').get(guildId);
      const top5   = db.db.prepare('SELECT * FROM auto_responses WHERE guild_id=? ORDER BY uses DESC LIMIT 5').all(guildId);
      const lines  = top5.map((e,i) => `**${i+1}.** \`${e.trigger_word}\` — **${e.uses}** utilisations`);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#F59E0B')
        .setTitle('📊 Statistiques Auto-réponses')
        .addFields(
          { name: '📝 Total configuré', value: `${total.c}`, inline: true },
          { name: '🔢 Total utilisations', value: `${total.u || 0}`, inline: true },
          { name: '🏆 Les plus utilisées', value: lines.join('\n') || '*Aucune.*', inline: false },
        )], ephemeral: true });
    }
  }
};
