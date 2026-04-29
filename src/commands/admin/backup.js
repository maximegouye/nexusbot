const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

// Créer la table si elle n'existe pas
db.db.prepare(`
  CREATE TABLE IF NOT EXISTS backups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )
`).run();

// ─── Helper unique pour répondre — toujours sûr ────────────
async function safeReply(interaction, payload) {
  try {
    if (interaction.deferred || interaction.replied) {
      return await interaction.editReply(payload);
    }
    return await interaction.reply({ ...payload, ephemeral: payload.ephemeral !== false });
  } catch (e) {
    // Si on plante encore, dernier recours : followUp
    try { return await interaction.followUp({ ...payload, ephemeral: true }); } catch {}
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('💾 Sauvegarder et restaurer la configuration du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('creer')
      .setDescription('Créer une sauvegarde')
      .addStringOption(o => o.setName('nom').setDescription('Nom de la sauvegarde').setRequired(false).setMaxLength(100)))
    .addSubcommand(s => s.setName('restaurer')
      .setDescription('Restaurer une sauvegarde')
      .addIntegerOption(o => o.setName('id').setDescription('ID du backup').setRequired(true)))
    .addSubcommand(s => s.setName('liste')
      .setDescription('📋 Voir les sauvegardes'))
    .addSubcommand(s => s.setName('supprimer')
      .setDescription('Supprimer une sauvegarde')
      .addIntegerOption(o => o.setName('id').setDescription('ID du backup').setRequired(true))),
  cooldown: 10,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // Defer une seule fois au début
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }

    try {
      if (sub === 'creer') return await doCreer(interaction);
      if (sub === 'restaurer') return await doRestaurer(interaction);
      if (sub === 'liste') return await doListe(interaction);
      if (sub === 'supprimer') return await doSupprimer(interaction);
    } catch (error) {
      console.error('[backup]', sub, 'erreur:', error.message);
      return safeReply(interaction, { content: '❌ Erreur : ' + error.message.slice(0, 200) });
    }
  }
};

async function doCreer(interaction) {
  // Vérifier le nombre de backups existants
  let isPrem = false; try { isPrem = db.isPremium(interaction.guildId); } catch {}
  const maxBackups = isPrem ? 20 : 5;
  const row = db.db.prepare('SELECT COUNT(*) as count FROM backups WHERE guild_id = ?').get(interaction.guildId);
  const backupCount = row?.count || 0;

  if (backupCount >= maxBackups) {
    return safeReply(interaction, { content: `❌ Limite de backups atteinte (${maxBackups}). Supprime-en pour en créer un nouveau.` });
  }

  // Récupérer les données
  const guildConfig = db.getConfig(interaction.guildId) || {};
  let warningCount = 0;
  try {
    warningCount = db.db.prepare('SELECT COUNT(*) as count FROM warnings WHERE guild_id = ?').get(interaction.guildId)?.count || 0;
  } catch {}

  // Rôles & canaux — robust pour Collection / Map / Array
  let roles = [];
  try {
    const fetched = await interaction.guild.roles.fetch().catch(() => null);
    if (fetched) {
      const arr = Array.from(fetched.values?.() || []);
      roles = arr.map(r => ({ id: r.id, name: r.name, color: r.color }));
    }
  } catch (e) { console.error('[backup] roles:', e.message); }

  let channels = [];
  try {
    const ch = interaction.guild.channels.cache;
    const arr = ch ? Array.from(ch.values()) : [];
    channels = arr.map(c => ({ id: c.id, name: c.name, type: c.type }));
  } catch (e) { console.error('[backup] channels:', e.message); }

  let premium = null; try { premium = db.getPremium(interaction.guildId); } catch {}

  const backupData = {
    guildName: interaction.guild.name,
    config: guildConfig,
    warningCount,
    rolesCount: roles.length,
    channelsCount: channels.length,
    isPremium: !!premium,
    timestamp: Date.now()
  };

  const backupName = interaction.options.getString('nom') || `Backup ${new Date().toLocaleDateString('fr-FR')}`;

  db.db.prepare('INSERT INTO backups (guild_id, name, data) VALUES (?, ?, ?)')
    .run(interaction.guildId, backupName, JSON.stringify(backupData));

  const embed = new EmbedBuilder()
    .setColor('#2ECC71')
    .setTitle('✅ Sauvegarde créée')
    .setDescription(`**${backupName}**`)
    .addFields(
      { name: '📋 Config', value: '✓ Sauvegardée', inline: true },
      { name: '⚠️ Avertissements', value: `${warningCount}`, inline: true },
      { name: '🏷️ Rôles', value: `${roles.length}`, inline: true },
      { name: '📍 Salons', value: `${channels.length}`, inline: true }
    )
    .setFooter({ text: 'Tape /backup liste pour voir tous tes backups' })
    .setTimestamp();

  return safeReply(interaction, { embeds: [embed] });
}

async function doRestaurer(interaction) {
  const backupId = interaction.options.getInteger('id');
  const backup = db.db.prepare('SELECT * FROM backups WHERE id = ? AND guild_id = ?')
    .get(backupId, interaction.guildId);

  if (!backup) {
    return safeReply(interaction, { content: '❌ Sauvegarde non trouvée.' });
  }

  const data = JSON.parse(backup.data);
  const cfg = data.config || {};
  for (const key of Object.keys(cfg)) {
    if (key !== 'guild_id' && key !== 'created_at') {
      try { db.setConfig(interaction.guildId, key, cfg[key]); } catch {}
    }
  }

  const embed = new EmbedBuilder()
    .setColor('#2ECC71')
    .setTitle('✅ Sauvegarde restaurée')
    .setDescription(`**${backup.name}** a été restaurée.`)
    .addFields(
      { name: '⚠️ Note', value: 'Seule la configuration a été restaurée. Les rôles, canaux et messages ne sont pas modifiés.' }
    );
  return safeReply(interaction, { embeds: [embed] });
}

async function doListe(interaction) {
  const backups = db.db.prepare(
    'SELECT * FROM backups WHERE guild_id = ? ORDER BY created_at DESC LIMIT 10'
  ).all(interaction.guildId);

  const embed = new EmbedBuilder().setColor('#7B2FBE').setTitle('💾 Sauvegardes');
  if (backups.length > 0) {
    const fields = backups.map(b => {
      const date = new Date(b.created_at * 1000).toLocaleDateString('fr-FR');
      return { name: `#${b.id} • ${b.name}`, value: `📅 ${date}`, inline: false };
    });
    embed.addFields(...fields);
  } else {
    embed.setDescription('Aucune sauvegarde trouvée. Tape `/backup creer` pour en créer une.');
  }
  return safeReply(interaction, { embeds: [embed] });
}

async function doSupprimer(interaction) {
  const backupId = interaction.options.getInteger('id');
  const backup = db.db.prepare('SELECT * FROM backups WHERE id = ? AND guild_id = ?')
    .get(backupId, interaction.guildId);

  if (!backup) {
    return safeReply(interaction, { content: '❌ Sauvegarde non trouvée.' });
  }

  db.db.prepare('DELETE FROM backups WHERE id = ?').run(backupId);

  const embed = new EmbedBuilder()
    .setColor('#2ECC71')
    .setTitle('✅ Sauvegarde supprimée')
    .setDescription(`**${backup.name}** a été supprimée.`);
  return safeReply(interaction, { embeds: [embed] });
}
