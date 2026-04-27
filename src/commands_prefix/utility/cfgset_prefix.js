/**
 * &cfg-set <chemin> <valeur> · &cfg-get <chemin>
 * &cfg-tables · &cfg-columns <table>
 *
 * Version préfixe de l'éditeur BDD universel. Même fonctionnement que le slash.
 */
const ef = require('../../utils/embedFactory');
const { PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: 'cfgset',
  aliases: ['cfg-set', 'configset', 'dbset', 'cfgs'],
  description: 'Modifier n\'importe quelle valeur du bot (admin)',
  category: 'Admin',
  permissions: String(PermissionFlagsBits.ManageGuild),
  cooldown: 1,

  async run(message, args, client, db) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply({ embeds: [ef.error('Permission manquante', 'Tu dois avoir **Gérer le serveur**.')] });
    }
    const action = (args[0] || 'help').toLowerCase();

    if (action === 'help' || action === 'aide' || !args.length) {
      return message.reply({ embeds: [ef.info('🛠️ Éditeur BDD universel', [
        '**Usage :**',
        '• `&cfg-set set <chemin> <valeur>` — modifier',
        '• `&cfg-set get <chemin>` — lire',
        '• `&cfg-set tables` — liste des tables',
        '• `&cfg-set columns <table>` — liste des colonnes',
        '',
        '**Exemples :**',
        '• `&cfg-set set guild_config.prefix !`',
        '• `&cfg-set set guild_config.daily_amount 10000`',
        '• `&cfg-set set guild_kv.mon_flag true`',
        '• `&cfg-set set users.balance.123456789 999999`',
        '• `&cfg-set set custom_commands.response.bonjour Salut tout le monde !`',
        '• `&cfg-set get guild_config.prefix`',
        '',
        '**Notes :**',
        '• `NULL`, `null`, ou vide = effacer la valeur',
        '• Nombres typés automatiquement (ex: `10000` → int, `12.5` → float, `true/false` → 1/0)',
        '• Pour `guild_kv`, la clé est libre (ne nécessite pas d\'exister préalablement)',
      ])] });
    }

    if (action === 'tables') {
      const tables = db.listAllTables();
      return message.reply({ embeds: [ef.info('📦 Tables disponibles', tables.map(t => `• \`${t}\``).join('\n'), { footer: `${tables.length} tables` })] });
    }

    if (action === 'columns' || action === 'cols') {
      const table = args[1];
      if (!table) return message.reply({ embeds: [ef.error('Usage', '`&cfg-set columns <table>`')] });
      try {
        const cols = db.listTableColumns(table);
        const lines = cols.map(c => `• \`${c.name}\` (${c.type}${c.pk ? ' · PK' : ''}${c.notnull ? ' · NOT NULL' : ''})`).join('\n');
        return message.reply({ embeds: [ef.info(`📋 Colonnes de \`${table}\``, lines, { footer: `${cols.length} colonnes` })] });
      } catch (e) { return message.reply({ embeds: [ef.error('Erreur', e.message)] }); }
    }

    if (action === 'get') {
      const chemin = args[1];
      if (!chemin) return message.reply({ embeds: [ef.error('Usage', '`&cfg-set get <chemin>`')] });
      try {
        const val = db.getArbitrary(message.guild.id, chemin);
        const display = val === null || val === undefined ? '*(null)*' : typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val);
        return message.reply({ embeds: [ef.info(`🔍 \`${chemin}\``, '```' + display.slice(0, 3800) + '```')] });
      } catch (e) { return message.reply({ embeds: [ef.error('Erreur', e.message)] }); }
    }

    if (action === 'set') {
      const chemin = args[1];
      if (!chemin) return message.reply({ embeds: [ef.error('Usage', '`&cfg-set set <chemin> <valeur>`')] });
      const valeur = args.slice(2).join(' ');
      if (valeur === undefined) return message.reply({ embeds: [ef.error('Usage', 'Précise aussi une valeur (utilise `NULL` pour effacer).')] });
      try {
        const res = db.setArbitrary(message.guild.id, chemin, valeur);
        return message.reply({ embeds: [ef.success('Valeur modifiée', [
          `**Chemin :** \`${chemin}\``,
          `**Nouvelle valeur :** ${valeur.length > 100 ? valeur.slice(0, 100) + '…' : valeur}`,
          res.changes !== undefined ? `**Lignes affectées :** ${res.changes}` : '',
        ])] });
      } catch (e) { return message.reply({ embeds: [ef.error('Erreur', e.message)] }); }
    }

    return message.reply({ embeds: [ef.warning('Action inconnue', `Tape \`&cfg-set\` tout court pour voir l\'aide.`)] });
  },
};
