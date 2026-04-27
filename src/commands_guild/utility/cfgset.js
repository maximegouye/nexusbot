/**
 * /cfg-set <chemin> <valeur> · /cfg-get <chemin>
 * /cfg-tables · /cfg-columns <table>
 *
 * L'éditeur BDD universel depuis Discord. Permet de modifier N'IMPORTE
 * QUELLE valeur stockée par le bot, sans avoir à ouvrir le panneau.
 *
 * Exemples :
 *   /cfg-set guild_config.prefix  !
 *   /cfg-set guild_config.daily_amount  10000
 *   /cfg-set guild_kv.mon_flag_custom  true
 *   /cfg-set users.balance.123456789  999999
 *   /cfg-set custom_commands.response.bonjour  Salut tout le monde !
 *   /cfg-get guild_config.prefix
 *   /cfg-tables
 *   /cfg-columns custom_commands
 */
const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const db = require('../../database/db');
const ef = require('../../utils/embedFactory');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cfg-set')
    .setDescription('🛠️ Modifier N\'IMPORTE QUELLE valeur du bot (admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
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
      return interaction.reply({ embeds: [ef.error('Permission manquante', 'Tu dois avoir **Gérer le serveur**.')], ephemeral: true });
    }
    const sub = interaction.options.getSubcommand();

    if (sub === 'tables') {
      const tables = db.listAllTables();
      return interaction.reply({
        embeds: [ef.info('📦 Tables disponibles', tables.map(t => `• \`${t}\``).join('\n'), { footer: `${tables.length} tables` })],
        ephemeral: true,
      });
    }

    if (sub === 'columns') {
      const table = interaction.options.getString('table');
      try {
        const cols = db.listTableColumns(table);
        const lines = cols.map(c => `• \`${c.name}\` (${c.type}${c.pk ? ' · PK' : ''}${c.notnull ? ' · NOT NULL' : ''})`).join('\n');
        return interaction.reply({
          embeds: [ef.info(`📋 Colonnes de \`${table}\``, lines, { footer: `${cols.length} colonnes` })],
          ephemeral: true,
        });
      } catch (e) {
        return interaction.reply({ embeds: [ef.error('Erreur', e.message)], ephemeral: true });
      }
    }

    if (sub === 'get') {
      const chemin = interaction.options.getString('chemin');
      try {
        const val = db.getArbitrary(interaction.guildId, chemin);
        const display = val === null || val === undefined ? '*(null)*' : typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val);
        return interaction.reply({
          embeds: [ef.info(`🔍 \`${chemin}\``, '```' + display.slice(0, 3800) + '```')],
          ephemeral: true,
        });
      } catch (e) {
        return interaction.reply({ embeds: [ef.error('Erreur', e.message)], ephemeral: true });
      }
    }

    if (sub === 'set') {
      const chemin = interaction.options.getString('chemin');
      const valeur = interaction.options.getString('valeur');
      try {
        const res = db.setArbitrary(interaction.guildId, chemin, valeur);
        return interaction.reply({
          embeds: [ef.success('Valeur modifiée', [
            `**Chemin :** \`${chemin}\``,
            `**Nouvelle valeur :** ${valeur.length > 100 ? valeur.slice(0, 100) + '…' : valeur}`,
            res.changes !== undefined ? `**Lignes affectées :** ${res.changes}` : '',
          ])],
          ephemeral: true,
        });
      } catch (e) {
        return interaction.reply({ embeds: [ef.error('Erreur', e.message)], ephemeral: true });
      }
    }
  },
};

// Réactivé comme prefix-only (limite slash Discord)
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
