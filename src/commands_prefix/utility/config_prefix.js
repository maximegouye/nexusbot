/**
 * NexusBot — &config
 * Panneau de configuration rapide via préfixe &
 * Pour modifier les paramètres, utilise les sous-commandes ou /config
 */
const { EmbedBuilder } = require('discord.js');

function chanMention(id) { return id ? `<#${id}>` : '`Non configuré`'; }
function roleMention(id) { return id ? `<@&${id}>` : '`Non configuré`'; }
function onOff(val)      { return val ? '✅ Activé' : '❌ Désactivé'; }
function formatList(arr) {
  try { const a = JSON.parse(arr || '[]'); return a.length ? a.join(', ') : '*Aucun*'; } catch { return '*Aucun*'; }
}

module.exports = {
  name: 'config',
  aliases: ['cfg', 'parametres', 'settings'],
  description: 'Voir et gérer la configuration du serveur',
  category: 'Utilitaire',
  cooldown: 5,
  permissions: '8', // ManageGuild

  async execute(message, args, client, db) {
    // Vérifier permission
    if (!message.member.permissions.has(8n)) {
      return message.reply('❌ Tu dois avoir la permission **Gérer le serveur** pour accéder à la configuration.');
    }

    const cfg    = message.guild ? db.getConfig(message.guild.id) : null;
    if (!cfg) return message.reply('❌ Impossible de récupérer la configuration du serveur.');

    const coin   = cfg.currency_emoji || '€';
    const sub    = args[0]?.toLowerCase();
    const guildId = message.guild.id;

    // ══════════════════════════════════════
    // &config jeux
    // ══════════════════════════════════════
    if (sub === 'jeux') {
      return message.reply({ embeds: [new EmbedBuilder()
        .setColor(cfg.color || '#7B2FBE')
        .setTitle('🎮 Configuration des jeux')
        .setDescription('Paramètres des jeux et paris sur ce serveur.')
        .addFields(
          { name: '⚡ Statut',   value: onOff(cfg.game_enabled ?? 1),                 inline: true },
          { name: '⬇️ Mise min', value: `**${cfg.game_min_bet  || 10}** ${coin}`,      inline: true },
          { name: '⬆️ Mise max', value: `**${cfg.game_max_bet  || 50000}** ${coin}`,   inline: true },
        )
        .addFields({ name: '✏️ Pour modifier', value:
          '`/config jeux activer` — Activer les jeux\n' +
          '`/config jeux desactiver` — Désactiver les jeux\n' +
          '`/config jeux mise_min [montant]` — Changer la mise minimum\n' +
          '`/config jeux mise_max [montant]` — Changer la mise maximum'
        })
        .setFooter({ text: 'NexusBot — Configuration' })
      ]});
    }

    // ══════════════════════════════════════
    // &config eco / economie
    // ══════════════════════════════════════
    if (sub === 'eco' || sub === 'economie' || sub === 'monnaie') {
      return message.reply({ embeds: [new EmbedBuilder()
        .setColor(cfg.color || '#7B2FBE')
        .setTitle('💰 Configuration de l\'économie')
        .addFields(
          { name: '⚡ Statut',        value: onOff(cfg.eco_enabled),                         inline: true },
          { name: '💰 Monnaie',       value: `${cfg.currency_emoji || '€'} ${cfg.currency_name || 'Euros'}`, inline: true },
          { name: '📅 Daily',         value: `**${cfg.daily_amount || 25}** ${coin}`,         inline: true },
          { name: '💬 Par message',   value: `**${cfg.coins_per_msg || 1}** ${coin}`,         inline: true },
          { name: '🎮 Mise min jeux', value: `**${cfg.game_min_bet || 10}** ${coin}`,         inline: true },
          { name: '🎮 Mise max jeux', value: `**${cfg.game_max_bet || 50000}** ${coin}`,      inline: true },
        )
        .addFields({ name: '✏️ Pour modifier', value:
          '`/config monnaie nom [nom]` — Renommer la monnaie\n' +
          '`/config monnaie emoji [emoji]` — Changer l\'emoji\n' +
          '`/config monnaie daily [montant]` — Montant daily\n' +
          '`/config monnaie message [montant]` — Coins par message\n' +
          '`/config monnaie activer/desactiver` — Activer/désactiver'
        })
        .setFooter({ text: 'NexusBot — Configuration' })
      ]});
    }

    // ══════════════════════════════════════
    // &config reponses [voir]
    // ══════════════════════════════════════
    if (sub === 'reponses' || sub === 'cmds' || sub === 'commandes') {
      const cmds = db.getCustomCommands(guildId);
      if (!cmds.length) {
        return message.reply({ embeds: [new EmbedBuilder()
          .setColor('#3498DB')
          .setTitle('💬 Commandes personnalisées')
          .setDescription('Aucune commande personnalisée configurée.\n\nUtilise `/config reponses ajouter [déclencheur] [réponse]` pour en créer.')
          .setFooter({ text: 'NexusBot — Configuration' })
        ]});
      }
      const desc = cmds.slice(0, 25).map(c =>
        `\`${c.trigger}\` → ${c.response.slice(0, 70)}${c.response.length > 70 ? '...' : ''}`
      ).join('\n');
      return message.reply({ embeds: [new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle(`💬 Commandes personnalisées (${cmds.length})`)
        .setDescription(desc)
        .addFields({ name: '✏️ Pour modifier', value:
          '`/config reponses ajouter [déclencheur] [réponse]` — Ajouter\n' +
          '`/config reponses supprimer [déclencheur]` — Supprimer\n' +
          '`/config reponses vider` — Tout supprimer'
        })
        .setFooter({ text: cmds.length > 25 ? `+ ${cmds.length - 25} autres non affichées` : `${cmds.length} commande(s)` })
      ]});
    }

    // ══════════════════════════════════════
    // &config logs
    // ══════════════════════════════════════
    if (sub === 'logs') {
      return message.reply({ embeds: [new EmbedBuilder()
        .setColor(cfg.color || '#7B2FBE')
        .setTitle('📜 Configuration des logs')
        .addFields(
          { name: '📋 Logs généraux', value: chanMention(cfg.log_channel), inline: true },
          { name: '🔨 Logs modération', value: chanMention(cfg.mod_log_channel), inline: true },
        )
        .addFields({ name: '✏️ Pour modifier', value:
          '`/config logs canal [salon]` — Salon des logs généraux\n' +
          '`/config logs canal_mod [salon]` — Salon des logs de modération\n' +
          '`/config logs effacer` — Supprimer les logs'
        })
        .setFooter({ text: 'NexusBot — Configuration' })
      ]});
    }

    // ══════════════════════════════════════
    // &config bienvenue
    // ══════════════════════════════════════
    if (sub === 'bienvenue' || sub === 'welcome') {
      return message.reply({ embeds: [new EmbedBuilder()
        .setColor(cfg.color || '#7B2FBE')
        .setTitle('👋 Configuration bienvenue & au revoir')
        .addFields(
          { name: '👋 Canal bienvenue', value: chanMention(cfg.welcome_channel), inline: true },
          { name: '🚪 Canal au revoir', value: chanMention(cfg.leave_channel), inline: true },
          { name: '📝 Message bienvenue', value: cfg.welcome_msg ? `\`${cfg.welcome_msg.slice(0, 80)}...\`` : '*Par défaut*' },
          { name: '📝 Message au revoir', value: cfg.leave_msg ? `\`${cfg.leave_msg.slice(0, 80)}...\`` : '*Par défaut*' },
        )
        .addFields({ name: '✏️ Pour modifier', value:
          '`/config bienvenue canal [salon]` — Salon bienvenue\n' +
          '`/config bienvenue message [texte]` — Message bienvenue\n' +
          '`/config bienvenue test` — Tester le message\n' +
          '`/config aurevoir canal [salon]` — Salon au revoir'
        })
        .setFooter({ text: 'Variables: {user} {server} {count}' })
      ]});
    }

    // ══════════════════════════════════════
    // &config (vue d'ensemble — sans argument)
    // ══════════════════════════════════════
    const customCmdsCount = db.getCustomCommands(guildId).length;

    const embed = new EmbedBuilder()
      .setColor(cfg.color || '#7B2FBE')
      .setTitle(`⚙️ Configuration de ${message.guild.name}`)
      .setThumbnail(message.guild.iconURL())
      .setDescription('Vue d\'ensemble de la configuration. Utilise `/config` pour tout modifier.')
      .addFields(
        // Général
        { name: '🔧 Général', value:
          `Préfixe : \`&\` (fixe)\n` +
          `Couleur : \`${cfg.color || '#7B2FBE'}\``, inline: true },
        // Monnaie
        { name: '💰 Économie', value:
          `${onOff(cfg.eco_enabled)} — ${cfg.currency_emoji || '€'} ${cfg.currency_name || 'Euros'}\n` +
          `Daily : **${cfg.daily_amount || 25}** ${coin}\n` +
          `Par message : **${cfg.coins_per_msg || 1}** ${coin}`, inline: true },
        // XP
        { name: '⭐ XP & Niveaux', value:
          `${onOff(cfg.xp_enabled)}\n` +
          `Multiplicateur : **×${cfg.xp_multiplier || 1}**\n` +
          `Canal niveau : ${chanMention(cfg.level_channel)}`, inline: true },
        // Bienvenue
        { name: '👋 Bienvenue', value: chanMention(cfg.welcome_channel), inline: true },
        // Au revoir
        { name: '🚪 Au revoir', value: chanMention(cfg.leave_channel), inline: true },
        // Logs
        { name: '📜 Logs', value:
          `Général : ${chanMention(cfg.log_channel)}\n` +
          `Modération : ${chanMention(cfg.mod_log_channel)}`, inline: true },
        // AutoMod
        { name: '🤖 AutoMod', value:
          `${onOff(cfg.automod_enabled)}\n` +
          `Anti-liens : ${onOff(cfg.automod_antilink)}\n` +
          `Anti-spam : ${onOff(cfg.automod_antispam)}`, inline: true },
        // Jeux
        { name: '🎮 Jeux', value:
          `${onOff(cfg.game_enabled ?? 1)}\n` +
          `Mise : ${cfg.game_min_bet || 10}–${cfg.game_max_bet || 50000} ${coin}`, inline: true },
        // Réponses
        { name: '💬 Cmds perso', value: `**${customCmdsCount}** commande(s)`, inline: true },
        // Tickets
        { name: '🎫 Tickets', value:
          `Canal : ${chanMention(cfg.ticket_channel)}\n` +
          `Staff : ${roleMention(cfg.ticket_staff_role)}`, inline: true },
        // Anniversaires
        { name: '🎂 Anniversaires', value: chanMention(cfg.birthday_channel), inline: true },
        // Rôles
        { name: '🎭 Rôles', value:
          `Muet : ${roleMention(cfg.mute_role)}\n` +
          `Auto : ${roleMention(cfg.autorole)}`, inline: true },
      )
      .addFields({ name: '📌 Commandes rapides', value:
        '`&config jeux` • `&config eco` • `&config logs` • `&config bienvenue` • `&config reponses`\n' +
        'Pour modifier un paramètre → `/config [groupe] [option]`'
      })
      .setFooter({ text: `NexusBot — Configuration • ${message.guild.name}` });

    return message.reply({ embeds: [embed] });
  }
};
