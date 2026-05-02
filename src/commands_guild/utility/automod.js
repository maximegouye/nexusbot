const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

// ── Table infractions automod ────────────────────────────────────────────────
try {
  db.db.exec(`CREATE TABLE IF NOT EXISTS automod_infractions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id   TEXT NOT NULL,
    user_id    TEXT NOT NULL,
    reason     TEXT NOT NULL,
    action     TEXT DEFAULT 'delete',
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`);
} catch {}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('🤖 Modération automatique avancée')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // ── 1. Voir ──────────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('voir')
      .setDescription('📋 Voir toute la configuration automod'))

    // ── 2. Spam ──────────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('spam')
      .setDescription('🚫 Anti-spam (trop de messages en peu de temps)')
      .addBooleanOption(o => o.setName('actif').setDescription('Activer/Désactiver').setRequired(true))
      .addIntegerOption(o => o.setName('seuil').setDescription('Nb messages en 5s avant action (défaut: 5)').setMinValue(2).setMaxValue(20)))

    // ── 3. Caps ───────────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('caps')
      .setDescription('🔠 Anti-MAJUSCULES excessives (>70% du message)')
      .addBooleanOption(o => o.setName('actif').setDescription('Activer/Désactiver').setRequired(true)))

    // ── 4. Invites ────────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('invites')
      .setDescription('🔗 Bloquer les invitations Discord')
      .addBooleanOption(o => o.setName('actif').setDescription('Activer/Désactiver').setRequired(true)))

    // ── 5. Liens ──────────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('liens')
      .setDescription('🌐 Bloquer les liens externes')
      .addBooleanOption(o => o.setName('actif').setDescription('Activer/Désactiver').setRequired(true)))

    // ── 6. Mots ───────────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('mots')
      .setDescription('🤬 Gérer la liste noire de mots')
      .addStringOption(o => o.setName('action').setDescription('Action').setRequired(true)
        .addChoices(
          { name: '📋 Voir la liste',         value: 'voir'      },
          { name: '➕ Ajouter un mot',         value: 'ajouter'   },
          { name: '➖ Supprimer un mot',        value: 'supprimer' },
          { name: '🗑️ Effacer toute la liste', value: 'effacer'   }
        ))
      .addStringOption(o => o.setName('mot').setDescription('Mot à ajouter/supprimer')))

    // ── 7. Mentions ───────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('mentions')
      .setDescription('📣 Anti-flood de mentions (@user, @role, @everyone)')
      .addBooleanOption(o => o.setName('actif').setDescription('Activer/Désactiver').setRequired(true))
      .addIntegerOption(o => o.setName('max').setDescription('Nb max de mentions par message (défaut: 5)').setMinValue(1).setMaxValue(20)))

    // ── 8. Emojis ─────────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('emojis')
      .setDescription('😂 Anti-spam d\'emojis (trop d\'emojis dans un message)')
      .addBooleanOption(o => o.setName('actif').setDescription('Activer/Désactiver').setRequired(true))
      .addIntegerOption(o => o.setName('max').setDescription('Nb max d\'emojis par message (défaut: 10)').setMinValue(1).setMaxValue(50)))

    // ── 9. Flood ──────────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('flood')
      .setDescription('♻️ Anti-flood (même message répété plusieurs fois)')
      .addBooleanOption(o => o.setName('actif').setDescription('Activer/Désactiver').setRequired(true))
      .addIntegerOption(o => o.setName('max').setDescription('Nb max de fois le même message (défaut: 3)').setMinValue(2).setMaxValue(10)))

    // ── 10. Zalgo ─────────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('zalgo')
      .setDescription('👾 Anti-zalgo (texte corrompu/déformé avec caractères unicode)')
      .addBooleanOption(o => o.setName('actif').setDescription('Activer/Désactiver').setRequired(true)))

    // ── 11. Whitelist ─────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('whitelist')
      .setDescription('✅ Domaines autorisés malgré l\'anti-liens actif')
      .addStringOption(o => o.setName('action').setDescription('Action').setRequired(true)
        .addChoices(
          { name: '📋 Voir les domaines',    value: 'voir'      },
          { name: '➕ Ajouter un domaine',    value: 'ajouter'   },
          { name: '➖ Supprimer un domaine',  value: 'supprimer' }
        ))
      .addStringOption(o => o.setName('domaine').setDescription('ex: youtube.com, twitch.tv')))

    // ── 12. Action ────────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('action')
      .setDescription('⚡ Configurer l\'action appliquée par l\'automod')
      .addStringOption(o => o.setName('type').setDescription('Action à effectuer').setRequired(true)
        .addChoices(
          { name: '🗑️ Supprimer uniquement',              value: 'delete'      },
          { name: '⚠️ Supprimer + Avertir (embed)',        value: 'warn'        },
          { name: '🔇 Supprimer + Mute temporaire auto',   value: 'mute'        }
        ))
      .addIntegerOption(o => o.setName('mute_minutes').setDescription('Durée du mute auto en minutes (si action=mute, défaut: 10)').setMinValue(1).setMaxValue(1440))
      .addIntegerOption(o => o.setName('warn_avant_mute').setDescription('Nb d\'avertissements avant mute auto (défaut: 3)').setMinValue(1).setMaxValue(10)))

    // ── 13. Logs ──────────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('logs')
      .setDescription('📋 Salon de logs des infractions automod')
      .addChannelOption(o => o.setName('salon').setDescription('Salon de logs (vide = désactiver)')))

    // ── 14. Exempt ────────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('exempt')
      .setDescription('🛡️ Rôles et salons exemptés de l\'automod')
      .addStringOption(o => o.setName('type').setDescription('Type').setRequired(true)
        .addChoices(
          { name: '👁️ Voir les exemptions',       value: 'voir'      },
          { name: '➕ Ajouter rôle exempté',       value: 'role_add'  },
          { name: '➖ Retirer rôle exempté',        value: 'role_del'  },
          { name: '➕ Ajouter salon exempté',       value: 'chan_add'  },
          { name: '➖ Retirer salon exempté',        value: 'chan_del'  }
        ))
      .addRoleOption(o => o.setName('role').setDescription('Rôle à exempter'))
      .addChannelOption(o => o.setName('salon').setDescription('Salon à exempter')))

    // ── 15. Stats ─────────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('stats')
      .setDescription('📊 Statistiques des infractions automod')
      .addUserOption(o => o.setName('utilisateur').setDescription('Stats d\'un utilisateur précis (optionnel)')))

    // ── 16. Reset ─────────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('reset')
      .setDescription('♻️ Remettre toute la configuration automod à zéro')),

  ephemeral: true,

  async execute(interaction) {
    // Normalisation : aliases pour compatibilité avec les anciennes commandes Discord enregistrées
    const _rawSub = interaction.options.getSubcommand();
    const _aliases = {
      'statut':       'voir',
      'antispam':     'spam',
      'anticaps':     'caps',
      'antiinvites':  'invites',
      'antiliens':    'liens',
      'antimentions': 'mentions',
      'antiemojis':   'emojis',
      'antiflood':    'flood',
      'antizalgo':    'zalgo',
    };
    const sub     = _aliases[_rawSub] ?? _rawSub;
    const guildId = interaction.guildId;

    try {
      const cfg = db.getConfig(guildId);

      // ════════════════════════════════════════════════════════
      // VOIR
      // ════════════════════════════════════════════════════════
      if (sub === 'voir') {
        const words     = _json(cfg.automod_words,            []);
        const whitelist = _json(cfg.automod_whitelist,        []);
        const exRoles   = _json(cfg.automod_exempt_roles,     []);
        const exChans   = _json(cfg.automod_exempt_channels,  []);

        const action = cfg.automod_action || 'delete';
        const actionLabel = { delete: '🗑️ Supprimer', warn: '⚠️ Supprimer + Avertir', mute: '🔇 Supprimer + Mute auto' };

        const embed = new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('🤖 Configuration AutoMod — Nexus Bot')
          .setDescription(`**Action globale :** ${actionLabel[action] || action}${action === 'mute' ? ` (${cfg.automod_mute_min || 10} min, après ${cfg.automod_warn_threshold || 3} warns)` : ''}`)
          .addFields(
            { name: '🚫 Anti-Spam',      value: cfg.automod_spam      ? `✅ Actif — **${cfg.automod_spam_threshold || 5}** msg/5s`           : '❌ Inactif', inline: true },
            { name: '🔠 Anti-Caps',      value: cfg.automod_caps      ? '✅ Actif — >70% maj'                                                : '❌ Inactif', inline: true },
            { name: '🔗 Anti-Invites',   value: cfg.automod_invites   ? '✅ Actif'                                                           : '❌ Inactif', inline: true },
            { name: '🌐 Anti-Liens',     value: cfg.automod_links     ? '✅ Actif'                                                           : '❌ Inactif', inline: true },
            { name: '📣 Anti-Mentions',  value: cfg.automod_mentions  ? `✅ Actif — max **${cfg.automod_mentions_max || 5}** mentions`       : '❌ Inactif', inline: true },
            { name: '😂 Anti-Emojis',   value: cfg.automod_emojis    ? `✅ Actif — max **${cfg.automod_emojis_max || 10}** emojis`          : '❌ Inactif', inline: true },
            { name: '♻️ Anti-Flood',     value: cfg.automod_flood     ? `✅ Actif — max **${cfg.automod_flood_max || 3}** répétitions`       : '❌ Inactif', inline: true },
            { name: '👾 Anti-Zalgo',     value: cfg.automod_zalgo     ? '✅ Actif'                                                           : '❌ Inactif', inline: true },
            { name: '🤬 Mots interdits', value: words.length          ? `**${words.length}** mot(s)`                                         : '❌ Aucun',   inline: true },
            { name: '✅ Whitelist',      value: whitelist.length      ? whitelist.join(', ')                                                  : '❌ Vide',    inline: false },
            { name: '📋 Logs',           value: cfg.automod_log       ? `<#${cfg.automod_log}>`                                              : '❌ Off',     inline: true },
            { name: '🛡️ Rôles exemptés',  value: exRoles.length       ? exRoles.map(r  => `<@&${r}>`).join(', ')                            : '❌ Aucun',   inline: false },
            { name: '🛡️ Salons exemptés', value: exChans.length       ? exChans.map(c  => `<#${c}>`).join(', ')                             : '❌ Aucun',   inline: false },
          )
          .setTimestamp()
          .setFooter({ text: 'Utilisez les sous-commandes pour modifier chaque paramètre' });

        return interaction.editReply({ embeds: [embed] });
      }

      // ════════════════════════════════════════════════════════
      // SPAM
      // ════════════════════════════════════════════════════════
      if (sub === 'spam') {
        const actif = interaction.options.getBoolean('actif');
        const seuil = interaction.options.getInteger('seuil') || cfg.automod_spam_threshold || 5;
        db.setConfig(guildId, 'automod_spam',           actif ? 1 : 0);
        db.setConfig(guildId, 'automod_spam_threshold', seuil);
        return interaction.editReply({ embeds: [_embed(actif, `🚫 Anti-spam **${actif ? 'activé' : 'désactivé'}**${actif ? ` — seuil : **${seuil}** msg/5s` : ''}.`)] });
      }

      // ════════════════════════════════════════════════════════
      // CAPS
      // ════════════════════════════════════════════════════════
      if (sub === 'caps') {
        const actif = interaction.options.getBoolean('actif');
        db.setConfig(guildId, 'automod_caps', actif ? 1 : 0);
        return interaction.editReply({ embeds: [_embed(actif, `🔠 Anti-CAPS **${actif ? 'activé' : 'désactivé'}** — >70% majuscules.`)] });
      }

      // ════════════════════════════════════════════════════════
      // INVITES
      // ════════════════════════════════════════════════════════
      if (sub === 'invites') {
        const actif = interaction.options.getBoolean('actif');
        db.setConfig(guildId, 'automod_invites', actif ? 1 : 0);
        return interaction.editReply({ embeds: [_embed(actif, `🔗 Anti-invitations **${actif ? 'activé' : 'désactivé'}**.`)] });
      }

      // ════════════════════════════════════════════════════════
      // LIENS
      // ════════════════════════════════════════════════════════
      if (sub === 'liens') {
        const actif = interaction.options.getBoolean('actif');
        db.setConfig(guildId, 'automod_links', actif ? 1 : 0);
        return interaction.editReply({ embeds: [_embed(actif, `🌐 Anti-liens **${actif ? 'activé' : 'désactivé'}**.`)] });
      }

      // ════════════════════════════════════════════════════════
      // MOTS
      // ════════════════════════════════════════════════════════
      if (sub === 'mots') {
        const action = interaction.options.getString('action');
        let words = _json(cfg.automod_words, []);

        if (action === 'voir') {
          return interaction.editReply({ embeds: [
            new EmbedBuilder().setColor('#E74C3C').setTitle(`🤬 Mots interdits (${words.length})`)
              .setDescription(words.length ? words.map((w, i) => `\`${i + 1}.\` \`${w}\``).join('\n') : '✅ Aucun mot interdit.')
          ]});
        }
        if (action === 'ajouter') {
          const mot = interaction.options.getString('mot');
          if (!mot) return interaction.editReply({ content: '❌ Précisez un mot avec l\'option `mot`.' });
          const m = mot.toLowerCase().trim();
          if (words.includes(m)) return interaction.editReply({ content: `❌ \`${m}\` est déjà dans la liste.` });
          words.push(m);
          db.setConfig(guildId, 'automod_words', JSON.stringify(words));
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription(`✅ \`${m}\` ajouté — **${words.length}** mot(s) au total.`)] });
        }
        if (action === 'supprimer') {
          const mot = interaction.options.getString('mot');
          if (!mot) return interaction.editReply({ content: '❌ Précisez le mot à supprimer.' });
          const m = mot.toLowerCase().trim();
          if (!words.includes(m)) return interaction.editReply({ content: `❌ \`${m}\` n'est pas dans la liste.` });
          words = words.filter(w => w !== m);
          db.setConfig(guildId, 'automod_words', JSON.stringify(words));
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription(`✅ \`${m}\` supprimé — **${words.length}** mot(s) restant(s).`)] });
        }
        if (action === 'effacer') {
          db.setConfig(guildId, 'automod_words', '[]');
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription(`🗑️ Liste effacée (${words.length} mot(s) supprimé(s)).`)] });
        }
      }

      // ════════════════════════════════════════════════════════
      // MENTIONS
      // ════════════════════════════════════════════════════════
      if (sub === 'mentions') {
        const actif = interaction.options.getBoolean('actif');
        const max   = interaction.options.getInteger('max') || cfg.automod_mentions_max || 5;
        db.setConfig(guildId, 'automod_mentions',     actif ? 1 : 0);
        db.setConfig(guildId, 'automod_mentions_max', max);
        return interaction.editReply({ embeds: [_embed(actif, `📣 Anti-mentions **${actif ? 'activé' : 'désactivé'}**${actif ? ` — max **${max}** mentions par message.` : '.'}`)] });
      }

      // ════════════════════════════════════════════════════════
      // EMOJIS
      // ════════════════════════════════════════════════════════
      if (sub === 'emojis') {
        const actif = interaction.options.getBoolean('actif');
        const max   = interaction.options.getInteger('max') || cfg.automod_emojis_max || 10;
        db.setConfig(guildId, 'automod_emojis',     actif ? 1 : 0);
        db.setConfig(guildId, 'automod_emojis_max', max);
        return interaction.editReply({ embeds: [_embed(actif, `😂 Anti-emojis **${actif ? 'activé' : 'désactivé'}**${actif ? ` — max **${max}** emojis par message.` : '.'}`)] });
      }

      // ════════════════════════════════════════════════════════
      // FLOOD
      // ════════════════════════════════════════════════════════
      if (sub === 'flood') {
        const actif = interaction.options.getBoolean('actif');
        const max   = interaction.options.getInteger('max') || cfg.automod_flood_max || 3;
        db.setConfig(guildId, 'automod_flood',     actif ? 1 : 0);
        db.setConfig(guildId, 'automod_flood_max', max);
        return interaction.editReply({ embeds: [_embed(actif, `♻️ Anti-flood **${actif ? 'activé' : 'désactivé'}**${actif ? ` — max **${max}** fois le même message.` : '.'}`)] });
      }

      // ════════════════════════════════════════════════════════
      // ZALGO
      // ════════════════════════════════════════════════════════
      if (sub === 'zalgo') {
        const actif = interaction.options.getBoolean('actif');
        db.setConfig(guildId, 'automod_zalgo', actif ? 1 : 0);
        return interaction.editReply({ embeds: [_embed(actif, `👾 Anti-zalgo **${actif ? 'activé' : 'désactivé'}** — texte corrompu/déformé bloqué.`)] });
      }

      // ════════════════════════════════════════════════════════
      // WHITELIST
      // ════════════════════════════════════════════════════════
      if (sub === 'whitelist') {
        const action = interaction.options.getString('action');
        let list = _json(cfg.automod_whitelist, []);

        if (action === 'voir') {
          return interaction.editReply({ embeds: [
            new EmbedBuilder().setColor('#3498DB').setTitle(`✅ Whitelist liens (${list.length})`)
              .setDescription(list.length ? list.map((d, i) => `\`${i + 1}.\` \`${d}\``).join('\n') : '❌ Aucun domaine whitelisté.')
              .setFooter({ text: 'Ces domaines sont autorisés même si l\'anti-liens est actif.' })
          ]});
        }
        if (action === 'ajouter') {
          const dom = interaction.options.getString('domaine');
          if (!dom) return interaction.editReply({ content: '❌ Précisez un domaine (ex: youtube.com).' });
          const d = dom.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
          if (list.includes(d)) return interaction.editReply({ content: `❌ \`${d}\` est déjà dans la whitelist.` });
          list.push(d);
          db.setConfig(guildId, 'automod_whitelist', JSON.stringify(list));
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription(`✅ \`${d}\` ajouté à la whitelist.`)] });
        }
        if (action === 'supprimer') {
          const dom = interaction.options.getString('domaine');
          if (!dom) return interaction.editReply({ content: '❌ Précisez le domaine à supprimer.' });
          const d = dom.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
          if (!list.includes(d)) return interaction.editReply({ content: `❌ \`${d}\` n'est pas dans la whitelist.` });
          list = list.filter(x => x !== d);
          db.setConfig(guildId, 'automod_whitelist', JSON.stringify(list));
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription(`✅ \`${d}\` retiré de la whitelist.`)] });
        }
      }

      // ════════════════════════════════════════════════════════
      // ACTION
      // ════════════════════════════════════════════════════════
      if (sub === 'action') {
        const type        = interaction.options.getString('type');
        const muteMin     = interaction.options.getInteger('mute_minutes')   || cfg.automod_mute_min       || 10;
        const warnThresh  = interaction.options.getInteger('warn_avant_mute') || cfg.automod_warn_threshold || 3;
        db.setConfig(guildId, 'automod_action',          type);
        db.setConfig(guildId, 'automod_mute_min',        muteMin);
        db.setConfig(guildId, 'automod_warn_threshold',  warnThresh);

        const labels = { delete: '🗑️ Supprimer uniquement', warn: '⚠️ Supprimer + Avertir', mute: '🔇 Supprimer + Mute auto' };
        const desc = type === 'mute'
          ? `⚡ Action : **${labels[type]}**\n— Mute de **${muteMin} min** appliqué dès la **${warnThresh}ème** infraction.`
          : type === 'warn'
          ? `⚡ Action : **${labels[type]}**\n— Un embed d'avertissement est envoyé dans le salon + log des infractions.`
          : `⚡ Action : **${labels[type]}**\n— Le message est supprimé discrètement, sans message.`;
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#3498DB').setDescription(desc)] });
      }

      // ════════════════════════════════════════════════════════
      // LOGS
      // ════════════════════════════════════════════════════════
      if (sub === 'logs') {
        const channel = interaction.options.getChannel('salon');
        db.setConfig(guildId, 'automod_log', channel?.id ?? null);
        return interaction.editReply({ embeds: [_embed(!!channel, channel ? `📋 Logs AutoMod → ${channel}` : '📋 Logs AutoMod désactivés.')] });
      }

      // ════════════════════════════════════════════════════════
      // EXEMPT
      // ════════════════════════════════════════════════════════
      if (sub === 'exempt') {
        const type = interaction.options.getString('type');
        let exRoles = _json(cfg.automod_exempt_roles, []);
        let exChans = _json(cfg.automod_exempt_channels, []);

        if (type === 'voir') {
          return interaction.editReply({ embeds: [
            new EmbedBuilder().setColor('#3498DB').setTitle('🛡️ Exemptions AutoMod')
              .addFields(
                { name: '👥 Rôles',  value: exRoles.length ? exRoles.map(r => `<@&${r}>`).join('\n') : '❌ Aucun', inline: true },
                { name: '💬 Salons', value: exChans.length ? exChans.map(c => `<#${c}>`).join('\n')  : '❌ Aucun', inline: true },
              )
          ]});
        }
        if (type === 'role_add') {
          const role = interaction.options.getRole('role');
          if (!role) return interaction.editReply({ content: '❌ Précisez un rôle.' });
          if (exRoles.includes(role.id)) return interaction.editReply({ content: `❌ **${role.name}** est déjà exempté.` });
          exRoles.push(role.id);
          db.setConfig(guildId, 'automod_exempt_roles', JSON.stringify(exRoles));
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription(`✅ Rôle **${role.name}** exempté de l'automod.`)] });
        }
        if (type === 'role_del') {
          const role = interaction.options.getRole('role');
          if (!role) return interaction.editReply({ content: '❌ Précisez un rôle.' });
          if (!exRoles.includes(role.id)) return interaction.editReply({ content: `❌ **${role.name}** n'est pas exempté.` });
          exRoles = exRoles.filter(r => r !== role.id);
          db.setConfig(guildId, 'automod_exempt_roles', JSON.stringify(exRoles));
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription(`✅ Exemption retirée pour **${role.name}**.`)] });
        }
        if (type === 'chan_add') {
          const ch = interaction.options.getChannel('salon');
          if (!ch) return interaction.editReply({ content: '❌ Précisez un salon.' });
          if (exChans.includes(ch.id)) return interaction.editReply({ content: `❌ **${ch.name}** est déjà exempté.` });
          exChans.push(ch.id);
          db.setConfig(guildId, 'automod_exempt_channels', JSON.stringify(exChans));
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription(`✅ Salon ${ch} exempté de l'automod.`)] });
        }
        if (type === 'chan_del') {
          const ch = interaction.options.getChannel('salon');
          if (!ch) return interaction.editReply({ content: '❌ Précisez un salon.' });
          if (!exChans.includes(ch.id)) return interaction.editReply({ content: `❌ **${ch.name}** n'est pas exempté.` });
          exChans = exChans.filter(c => c !== ch.id);
          db.setConfig(guildId, 'automod_exempt_channels', JSON.stringify(exChans));
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription(`✅ Exemption retirée pour ${ch}.`)] });
        }
      }

      // ════════════════════════════════════════════════════════
      // STATS
      // ════════════════════════════════════════════════════════
      if (sub === 'stats') {
        const targetUser = interaction.options.getUser('utilisateur');
        const reasonIcons = { spam: '🚫', caps: '🔠', invites: '🔗', liens: '🌐', mots: '🤬', mentions: '📣', emojis: '😂', flood: '♻️', zalgo: '👾' };
        const allReasons  = ['spam', 'caps', 'invites', 'liens', 'mots', 'mentions', 'emojis', 'flood', 'zalgo'];

        const nowSec = Math.floor(Date.now() / 1000);
        const h24    = nowSec - 86400;
        const d7     = nowSec - 604800;

        let totalRows, total24h, total7d, byReason, topOffenders, recent;

        if (targetUser) {
          totalRows = db.db.prepare('SELECT COUNT(*) as c FROM automod_infractions WHERE guild_id=? AND user_id=?').get(guildId, targetUser.id);
          total24h  = db.db.prepare('SELECT COUNT(*) as c FROM automod_infractions WHERE guild_id=? AND user_id=? AND created_at>?').get(guildId, targetUser.id, h24);
          total7d   = db.db.prepare('SELECT COUNT(*) as c FROM automod_infractions WHERE guild_id=? AND user_id=? AND created_at>?').get(guildId, targetUser.id, d7);
          byReason  = db.db.prepare('SELECT reason, COUNT(*) as c FROM automod_infractions WHERE guild_id=? AND user_id=? GROUP BY reason ORDER BY c DESC').all(guildId, targetUser.id);
          recent    = db.db.prepare('SELECT * FROM automod_infractions WHERE guild_id=? AND user_id=? ORDER BY created_at DESC LIMIT 5').all(guildId, targetUser.id);
        } else {
          totalRows    = db.db.prepare('SELECT COUNT(*) as c FROM automod_infractions WHERE guild_id=?').get(guildId);
          total24h     = db.db.prepare('SELECT COUNT(*) as c FROM automod_infractions WHERE guild_id=? AND created_at>?').get(guildId, h24);
          total7d      = db.db.prepare('SELECT COUNT(*) as c FROM automod_infractions WHERE guild_id=? AND created_at>?').get(guildId, d7);
          byReason     = db.db.prepare('SELECT reason, COUNT(*) as c FROM automod_infractions WHERE guild_id=? GROUP BY reason ORDER BY c DESC').all(guildId);
          topOffenders = db.db.prepare('SELECT user_id, COUNT(*) as c FROM automod_infractions WHERE guild_id=? GROUP BY user_id ORDER BY c DESC LIMIT 5').all(guildId);
          recent       = db.db.prepare('SELECT * FROM automod_infractions WHERE guild_id=? ORDER BY created_at DESC LIMIT 5').all(guildId);
        }

        const total    = totalRows?.c  || 0;
        const count24h = total24h?.c   || 0;
        const count7d  = total7d?.c    || 0;

        // Map reason → count pour lookup O(1)
        const reasonMap = {};
        for (const r of byReason) reasonMap[r.reason] = r.c;

        // Toutes les catégories, même celles à 0
        const byTypeLines = allReasons.map(r => {
          const n = reasonMap[r] || 0;
          const bar = n > 0 ? '`' + n + '`' : '`—`';
          return `${reasonIcons[r]} **${r}** ${bar}`;
        }).join('\n');

        const embed = new EmbedBuilder()
          .setColor(total > 0 ? '#E74C3C' : '#2ECC71')
          .setTitle(targetUser ? `📊 Infractions — ${targetUser.username}` : '📊 Statistiques AutoMod')
          .setDescription(
            total === 0
              ? '✅ **Aucune infraction enregistrée** — le serveur est propre !'
              : `**${total}** infraction${total > 1 ? 's' : ''} enregistrée${total > 1 ? 's' : ''}${targetUser ? ` pour ${targetUser.username}` : ' sur ce serveur'}.`
          )
          .addFields(
            {
              name: '📆 Résumé temporel',
              value: [
                `**Dernières 24h :** ${count24h > 0 ? `**${count24h}**` : '`0`'} infraction${count24h > 1 ? 's' : ''}`,
                `**Derniers 7 jours :** ${count7d  > 0 ? `**${count7d}**`  : '`0`'} infraction${count7d  > 1 ? 's' : ''}`,
                `**Total :** ${total > 0 ? `**${total}**` : '`0`'} infraction${total > 1 ? 's' : ''}`,
              ].join('\n'),
              inline: false,
            },
            {
              name: '📋 Infractions par type',
              value: byTypeLines,
              inline: true,
            },
          )
          .setTimestamp()
          .setFooter({ text: targetUser ? `ID : ${targetUser.id}` : 'AutoMod — NexusBot' });

        // Top contrevenants (serveur global uniquement)
        if (!targetUser && topOffenders?.length > 0) {
          embed.addFields({
            name: '🎯 Top contrevenants',
            value: topOffenders.map((o, i) => {
              const medal = ['🥇','🥈','🥉'][i] || `**${i + 1}.**`;
              return `${medal} <@${o.user_id}> — \`${o.c}\` infraction${o.c > 1 ? 's' : ''}`;
            }).join('\n'),
            inline: true,
          });
        }

        // 5 dernières infractions
        if (recent?.length > 0) {
          embed.addFields({
            name: '🕐 5 dernières infractions',
            value: recent.map(r =>
              `${reasonIcons[r.reason] || '🔹'} <@${r.user_id}> — **${r.reason}** <t:${r.created_at}:R>`
            ).join('\n'),
            inline: false,
          });
        } else {
          embed.addFields({
            name: '💡 Aucune infraction récente',
            value: 'Les infractions apparaîtront ici dès que l\'automod en détectera une.\nActivez les modules avec `/automod spam`, `/automod caps`, etc.',
            inline: false,
          });
        }

        return interaction.editReply({ embeds: [embed] });
      }

      // ════════════════════════════════════════════════════════
      // RESET
      // ════════════════════════════════════════════════════════
      if (sub === 'reset') {
        const cols = [
          'automod_spam', 'automod_spam_threshold', 'automod_caps', 'automod_invites',
          'automod_links', 'automod_words', 'automod_log', 'automod_mentions',
          'automod_mentions_max', 'automod_emojis', 'automod_emojis_max', 'automod_flood',
          'automod_flood_max', 'automod_zalgo', 'automod_whitelist', 'automod_action',
          'automod_mute_min', 'automod_warn_threshold', 'automod_exempt_roles', 'automod_exempt_channels'
        ];
        const zeros    = cols.filter(c => !['automod_words','automod_whitelist','automod_action','automod_exempt_roles','automod_exempt_channels'].includes(c));
        const empties  = ['automod_words','automod_whitelist','automod_exempt_roles','automod_exempt_channels'];

        for (const c of zeros)   db.setConfig(guildId, c, 0);
        for (const c of empties) db.setConfig(guildId, c, '[]');
        db.setConfig(guildId, 'automod_action', 'delete');
        db.setConfig(guildId, 'automod_log', null);

        return interaction.editReply({ embeds: [
          new EmbedBuilder().setColor('#E74C3C').setTitle('♻️ AutoMod réinitialisé')
            .setDescription('Toute la configuration automod a été remise à zéro.')
        ]});
      }

    } catch (error) {
      console.error('[AUTOMOD] Erreur /automod:', error);
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('❌ Erreur')
          .setDescription(`\`${error.message?.slice(0, 300)}\``)
        ]
      }).catch(() => {});
    }
  }
};

// ── Helpers privés ────────────────────────────────────────────────────────────
function _json(raw, fallback) {
  try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
function _embed(ok, desc) {
  return new EmbedBuilder().setColor(ok ? '#2ECC71' : '#E74C3C').setDescription(desc);
}
