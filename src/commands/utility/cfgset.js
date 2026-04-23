/**
 * /cfgset — Éditeur BDD universel (slash global, sans tiret pour sync rapide).
 *
 * Permet de modifier N'IMPORTE QUELLE valeur stockée par le bot depuis Discord.
 *
 * Exemples :
 *   /cfgset set chemin:guild_config.prefix valeur:!
 *   /cfgset set chemin:guild_config.daily_amount valeur:10000
 *   /cfgset set chemin:guild_kv.mon_flag valeur:true
 *   /cfgset set chemin:users.balance.123456789 valeur:999999
 *   /cfgset get chemin:guild_config.prefix
 *   /cfgset tables
 *   /cfgset columns table:custom_commands
 */
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const ef = require('../../utils/embedFactory');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cfgset')
    .setDescription('🛠️ Modifier N\'IMPORTE QUELLE valeur du bot (admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand(s => s.setName('set').setDescription('Modifier une valeur')
      .addStringOption(o => o.setName('chemin').setDescription('table.colonne[.id] ex: guild_config.prefix').setRequired(true).setMaxLength(200))
      .addStringOption(o => o.setName('valeur').setDescription('Nouvelle valeur (NULL pour effacer)').setRequired(true).setMaxLength(2000)))
    .addSubcommand(s => s.setName('get').setDescription('Lire une valeur')
      .addStringOption(o => o.setName('chemin').setDescription('table.colonne[.id]').setRequired(true).setMaxLength(200)))
    .addSubcommand(s => s.setName('tables').setDescription('Lister toutes les tables'))
    .addSubcommand(s => s.setName('columns').setDescription('Lister les colonnes d\'une table')
      .addStringOption(o => o.setName('table').setDescription('Nom de la table').setRequired(true).setMaxLength(80))),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [ef.error('Permission manquante', 'Tu dois avoir **Gérer le serveur**.')], ephemeral: true });
    }
    const sub = interaction.options.getSubcommand();

    if (sub === 'tables') {
      const tables = db.listAllTables();
      // Si > 20 tables : split en plusieurs fields pour rester lisible
      const chunks = [];
      for (let i = 0; i < tables.length; i += 30) chunks.push(tables.slice(i, i + 30));
      const embed = ef.info('📦 Tables disponibles', `**${tables.length}** tables détectées dans la BDD.`, {
        fields: chunks.map((chunk, i) => ({
          name: chunks.length > 1 ? `Page ${i + 1}/${chunks.length}` : ' ',
          value: chunk.map(t => `\`${t}\``).join(' · ').slice(0, 1020),
          inline: false,
        })),
      });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'columns') {
      const table = interaction.options.getString('table');
      try {
        const cols = db.listTableColumns(table);
        const lines = cols.map(c => `• \`${c.name}\` (${c.type}${c.pk ? ' · PK' : ''}${c.notnull ? ' · NOT NULL' : ''})`).join('\n');
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          embeds: [ef.info(`📋 Colonnes de \`${table}\``, lines, { footer: `${cols.length} colonnes` })],
          ephemeral: true,
        });
      } catch (e) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [ef.error('Erreur', e.message)], ephemeral: true });
      }
    }

    if (sub === 'get') {
      const chemin = interaction.options.getString('chemin');
      try {
        const val = db.getArbitrary(interaction.guildId, chemin);
        const display = val === null || val === undefined ? '*(null)*' : typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          embeds: [ef.info(`🔍 \`${chemin}\``, '```' + display.slice(0, 3800) + '```')],
          ephemeral: true,
        });
      } catch (e) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [ef.error('Erreur', e.message)], ephemeral: true });
      }
    }

    if (sub === 'set') {
      const chemin = interaction.options.getString('chemin');
      const valeur = interaction.options.getString('valeur');
      try {
        const res = db.setArbitrary(interaction.guildId, chemin, valeur);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          embeds: [ef.success('Valeur modifiée', [
            `**Chemin :** \`${chemin}\``,
            `**Nouvelle valeur :** ${valeur.length > 100 ? valeur.slice(0, 100) + '…' : valeur}`,
            res.changes !== undefined ? `**Lignes affectées :** ${res.changes}` : '',
          ])],
          ephemeral: true,
        });
      } catch (e) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [ef.error('Erreur', e.message)], ephemeral: true });
      }
    }
  },
};
