/**
 * NexusBot — Commandes Admin Ultra-Complètes
 * /admin : gestion du serveur, membres, rôles, channels, bot
 */
const {
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType,
  ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('🛡️ Panneau d\'administration complet (Administrateurs)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    // ── Membres ──────────────────────────────────────────────────────
    .addSubcommandGroup(g => g
      .setName('membre')
      .setDescription('👤 Gestion des membres')
      .addSubcommand(s => s
        .setName('info')
        .setDescription('📋 Infos complètes sur un membre')
        .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
      )
      .addSubcommand(s => s
        .setName('roles')
        .setDescription('🎭 Voir tous les rôles d\'un membre')
        .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
      )
      .addSubcommand(s => s
        .setName('xp-reset')
        .setDescription('🔄 Remettre l\'XP d\'un membre à zéro')
        .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
      )
      .addSubcommand(s => s
        .setName('niveau')
        .setDescription('✏️ Définir le niveau d\'un membre')
        .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
        .addIntegerOption(o => o.setName('niveau').setDescription('Niveau').setRequired(true).setMinValue(1).setMaxValue(500))
      )
    )

    // ── Rôles ─────────────────────────────────────────────────────────
    .addSubcommandGroup(g => g
      .setName('role')
      .setDescription('🎭 Gestion des rôles')
      .addSubcommand(s => s
        .setName('donner')
        .setDescription('➕ Donner un rôle à un membre')
        .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
        .addRoleOption(o => o.setName('role').setDescription('Rôle').setRequired(true))
      )
      .addSubcommand(s => s
        .setName('retirer')
        .setDescription('➖ Retirer un rôle à un membre')
        .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
        .addRoleOption(o => o.setName('role').setDescription('Rôle').setRequired(true))
      )
      .addSubcommand(s => s
        .setName('masse')
        .setDescription('👥 Donner un rôle à tous les membres d\'un autre rôle')
        .addRoleOption(o => o.setName('cible').setDescription('Rôle à donner').setRequired(true))
        .addRoleOption(o => o.setName('condition').setDescription('Membres qui ont ce rôle (vide = tous)').setRequired(false))
      )
      .addSubcommand(s => s
        .setName('info')
        .setDescription('📋 Infos sur un rôle')
        .addRoleOption(o => o.setName('role').setDescription('Rôle').setRequired(true))
      )
    )

    // ── Salons ────────────────────────────────────────────────────────
    .addSubcommandGroup(g => g
      .setName('salon')
      .setDescription('📢 Gestion des salons')
      .addSubcommand(s => s
        .setName('lock')
        .setDescription('🔒 Verrouiller un salon')
        .addChannelOption(o => o.setName('salon').setDescription('Salon (vide = salon courant)').setRequired(false))
        .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false))
      )
      .addSubcommand(s => s
        .setName('unlock')
        .setDescription('🔓 Déverrouiller un salon')
        .addChannelOption(o => o.setName('salon').setDescription('Salon (vide = salon courant)').setRequired(false))
      )
      .addSubcommand(s => s
        .setName('slowmode')
        .setDescription('⏱️ Définir le mode lent')
        .addIntegerOption(o => o.setName('secondes').setDescription('Délai en secondes (0 = désactiver)').setRequired(true).setMinValue(0).setMaxValue(21600))
        .addChannelOption(o => o.setName('salon').setDescription('Salon (vide = courant)').setRequired(false))
      )
      .addSubcommand(s => s
        .setName('purge')
        .setDescription('🗑️ Supprimer des messages en masse')
        .addIntegerOption(o => o.setName('nombre').setDescription('Nombre de messages (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
        .addUserOption(o => o.setName('membre').setDescription('Uniquement les messages de ce membre').setRequired(false))
      )
      .addSubcommand(s => s
        .setName('renommer')
        .setDescription('✏️ Renommer un salon')
        .addStringOption(o => o.setName('nom').setDescription('Nouveau nom').setRequired(true).setMaxLength(100))
        .addChannelOption(o => o.setName('salon').setDescription('Salon (vide = courant)').setRequired(false))
      )
    )

    // ── Serveur ───────────────────────────────────────────────────────
    .addSubcommandGroup(g => g
      .setName('serveur')
      .setDescription('🏠 Gestion du serveur')
      .addSubcommand(s => s.setName('info').setDescription('📋 Informations du serveur'))
      .addSubcommand(s => s.setName('stats').setDescription('📊 Statistiques du serveur'))
      .addSubcommand(s => s
        .setName('message')
        .setDescription('📢 Envoyer un message dans un salon au nom du bot')
        .addChannelOption(o => o.setName('salon').setDescription('Salon de destination').setRequired(true).addChannelTypes(ChannelType.GuildText))
        .addStringOption(o => o.setName('contenu').setDescription('Contenu du message').setRequired(true).setMaxLength(2000))
      )
      .addSubcommand(s => s
        .setName('embed')
        .setDescription('📝 Envoyer un embed personnalisé')
        .addChannelOption(o => o.setName('salon').setDescription('Salon').setRequired(true).addChannelTypes(ChannelType.GuildText))
        .addStringOption(o => o.setName('titre').setDescription('Titre de l\'embed').setRequired(true).setMaxLength(256))
        .addStringOption(o => o.setName('description').setDescription('Description').setRequired(true).setMaxLength(4000))
        .addStringOption(o => o.setName('couleur').setDescription('Couleur HEX (ex: #7B2FBE)').setRequired(false))
      )
    )

    // ── Bot ───────────────────────────────────────────────────────────
    .addSubcommandGroup(g => g
      .setName('bot')
      .setDescription('🤖 Gestion du bot')
      .addSubcommand(s => s.setName('statut').setDescription('📊 Statut du bot'))
      .addSubcommand(s => s
        .setName('prefix')
        .setDescription('⌨️ Changer le préfixe du serveur')
        .addStringOption(o => o.setName('prefix').setDescription('Nouveau préfixe').setRequired(true).setMaxLength(5))
      )
      .addSubcommand(s => s.setName('config').setDescription('⚙️ Voir la configuration complète'))
      .addSubcommand(s => s
        .setName('blacklist')
        .setDescription('🚫 Blacklister un utilisateur du bot')
        .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
        .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false))
      )
      .addSubcommand(s => s
        .setName('unblacklist')
        .setDescription('✅ Retirer un utilisateur de la blacklist')
        .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
      )
    ),

  cooldown: 3,

  async execute(interaction) {
    const group = interaction.options.getSubcommandGroup();
    const sub   = interaction.options.getSubcommand();
    const cfg   = db.getConfig(interaction.guildId);
    const sym   = cfg.currency_emoji || '€';

    await interaction.deferReply({ ephemeral: true });

    // ══ MEMBRE ══════════════════════════════════════════════════════
    if (group === 'membre') {

      if (sub === 'info') {
        const target   = interaction.options.getUser('membre');
        const member   = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (!member) return interaction.editReply({ content: '❌ Membre introuvable.' });

        const user     = db.getUser(target.id, interaction.guildId);
        const warnings = db.db.prepare('SELECT COUNT(*) as c FROM warnings WHERE guild_id=? AND user_id=?').get(interaction.guildId, target.id)?.c || 0;
        const joinedAgo = Math.floor((Date.now() - member.joinedTimestamp) / 86400000);
        const roles = member.roles.cache.filter(r => r.id !== interaction.guild.roles.everyone.id).map(r => `<@&${r.id}>`).slice(0, 10).join(' ');

        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(member.displayHexColor || '#7B2FBE')
            .setTitle(`👤 ${target.username}`)
            .setThumbnail(target.displayAvatarURL({ size: 256 }))
            .addFields(
              { name: '🆔 ID',            value: `\`${target.id}\``,                    inline: true },
              { name: '📅 Rejoint',        value: `<t:${Math.floor(member.joinedTimestamp/1000)}:R> (${joinedAgo}j)`, inline: true },
              { name: '📅 Compte créé',   value: `<t:${Math.floor(target.createdTimestamp/1000)}:R>`, inline: true },
              { name: '⚠️ Warnings',      value: `**${warnings}**`,                      inline: true },
              { name: `${sym} Solde`,     value: `**${user.balance.toLocaleString('fr')}${sym}**`, inline: true },
              { name: '⭐ Niveau',        value: `**${user.level}** (${user.xp} XP)`,   inline: true },
              { name: '🎭 Rôles',         value: roles || 'Aucun',                       inline: false },
            )
            .setTimestamp()
          ]
        });
      }

      if (sub === 'roles') {
        const target = interaction.options.getUser('membre');
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (!member) return interaction.editReply({ content: '❌ Membre introuvable.' });

        const roles = member.roles.cache.filter(r => r.id !== interaction.guild.roles.everyone.id)
          .sort((a, b) => b.position - a.position)
          .map(r => `<@&${r.id}>`)
          .join('\n') || 'Aucun rôle';

        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#7B2FBE')
            .setTitle(`🎭 Rôles de ${target.username}`)
            .setDescription(roles.slice(0, 4000))
          ]
        });
      }

      if (sub === 'xp-reset') {
        const target = interaction.options.getUser('membre');
        db.db.prepare('UPDATE users SET xp=0, level=1 WHERE user_id=? AND guild_id=?').run(target.id, interaction.guildId);
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('🔄 XP remis à zéro')
            .setDescription(`L'XP de <@${target.id}> a été remis à zéro (niveau 1).`)]
        });
      }

      if (sub === 'niveau') {
        const target = interaction.options.getUser('membre');
        const level  = interaction.options.getInteger('niveau');
        const xp = db.getXPForLevel ? db.getXPForLevel(level) : Math.floor(100 * Math.pow(1.35, level - 1));
        db.db.prepare('UPDATE users SET level=?, xp=? WHERE user_id=? AND guild_id=?').run(level, xp, target.id, interaction.guildId);
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor('#2ECC71').setTitle('✏️ Niveau défini')
            .setDescription(`<@${target.id}> est maintenant au **niveau ${level}**.`)]
        });
      }
    }

    // ══ ROLE ════════════════════════════════════════════════════════
    if (group === 'role') {

      if (sub === 'donner') {
        const target = interaction.options.getUser('membre');
        const role   = interaction.options.getRole('role');
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (!member) return interaction.editReply({ content: '❌ Membre introuvable.' });
        if (role.managed) return interaction.editReply({ content: '❌ Ce rôle est géré par une intégration.' });

        await member.roles.add(role);
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor('#2ECC71').setTitle('✅ Rôle attribué')
            .setDescription(`<@&${role.id}> a été donné à <@${target.id}>.`)]
        });
      }

      if (sub === 'retirer') {
        const target = interaction.options.getUser('membre');
        const role   = interaction.options.getRole('role');
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (!member) return interaction.editReply({ content: '❌ Membre introuvable.' });

        await member.roles.remove(role);
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor('#E67E22').setTitle('✅ Rôle retiré')
            .setDescription(`<@&${role.id}> a été retiré à <@${target.id}>.`)]
        });
      }

      if (sub === 'masse') {
        const roleTarget = interaction.options.getRole('cible');
        const condition  = interaction.options.getRole('condition');

        await interaction.guild.members.fetch();
        let members = interaction.guild.members.cache.filter(m => !m.user.bot);
        if (condition) members = members.filter(m => m.roles.cache.has(condition.id));

        let count = 0;
        for (const [, member] of members) {
          await member.roles.add(roleTarget).catch(() => {});
          count++;
        }

        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor('#2ECC71').setTitle('✅ Attribution de masse terminée')
            .setDescription(`<@&${roleTarget.id}> attribué à **${count}** membre(s).`)]
        });
      }

      if (sub === 'info') {
        const role = interaction.options.getRole('role');
        const memberCount = interaction.guild.members.cache.filter(m => m.roles.cache.has(role.id)).size;
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(role.hexColor || '#7B2FBE')
            .setTitle(`🎭 ${role.name}`)
            .addFields(
              { name: '🆔 ID',          value: `\`${role.id}\``,                      inline: true },
              { name: '🎨 Couleur',     value: role.hexColor || 'Aucune',              inline: true },
              { name: '👥 Membres',     value: `**${memberCount}**`,                   inline: true },
              { name: '📊 Position',    value: `**${role.position}**`,                 inline: true },
              { name: '🔒 Menagé',      value: role.managed ? 'Oui' : 'Non',          inline: true },
              { name: '📌 Mentionnable', value: role.mentionable ? 'Oui' : 'Non',     inline: true },
            )
          ]
        });
      }
    }

    // ══ SALON ════════════════════════════════════════════════════════
    if (group === 'salon') {

      if (sub === 'lock') {
        const channel = interaction.options.getChannel('salon') || interaction.channel;
        const raison  = interaction.options.getString('raison') || 'Pas de raison précisée';
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('🔒 Salon verrouillé')
            .setDescription(`${channel} a été verrouillé.\n**Raison :** ${raison}`)]
        });
      }

      if (sub === 'unlock') {
        const channel = interaction.options.getChannel('salon') || interaction.channel;
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor('#2ECC71').setTitle('🔓 Salon déverrouillé')
            .setDescription(`${channel} est de nouveau accessible.`)]
        });
      }

      if (sub === 'slowmode') {
        const delay   = interaction.options.getInteger('secondes');
        const channel = interaction.options.getChannel('salon') || interaction.channel;
        await channel.setRateLimitPerUser(delay);
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor('#3498DB').setTitle('⏱️ Mode lent mis à jour')
            .setDescription(delay === 0 ? `Mode lent désactivé sur ${channel}.` : `Mode lent de **${delay}s** appliqué sur ${channel}.`)]
        });
      }

      if (sub === 'purge') {
        const count  = interaction.options.getInteger('nombre');
        const member = interaction.options.getUser('membre');
        const channel = interaction.channel;

        let messages = await channel.messages.fetch({ limit: count + 10 }).catch(() => null);
        if (!messages) return interaction.editReply({ content: '❌ Impossible de récupérer les messages.' });

        if (member) messages = messages.filter(m => m.author.id === member.id);
        const toDelete = [...messages.values()].slice(0, count);

        // Discord ne peut supprimer que des messages < 14 jours en masse
        const bulkOk = toDelete.filter(m => Date.now() - m.createdTimestamp < 14 * 24 * 3600 * 1000);
        const deleted = await channel.bulkDelete(bulkOk, true).catch(() => null);

        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('🗑️ Messages supprimés')
            .setDescription(`**${deleted?.size || 0}** message(s) supprimé(s) dans ${channel}.`)]
        });
      }

      if (sub === 'renommer') {
        const nom     = interaction.options.getString('nom');
        const channel = interaction.options.getChannel('salon') || interaction.channel;
        const oldName = channel.name;
        await channel.setName(nom);
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor('#3498DB').setTitle('✏️ Salon renommé')
            .setDescription(`\`${oldName}\` → **${nom}**`)]
        });
      }
    }

    // ══ SERVEUR ══════════════════════════════════════════════════════
    if (group === 'serveur') {

      if (sub === 'info') {
        const guild = interaction.guild;
        await guild.members.fetch();
        const bots    = guild.members.cache.filter(m => m.user.bot).size;
        const humans  = guild.memberCount - bots;
        const online  = guild.members.cache.filter(m => m.presence?.status !== 'offline').size;

        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(cfg.color || '#7B2FBE')
            .setTitle(`🏠 ${guild.name}`)
            .setThumbnail(guild.iconURL({ size: 256 }))
            .addFields(
              { name: '🆔 ID',           value: `\`${guild.id}\``,                       inline: true },
              { name: '👑 Propriétaire', value: `<@${guild.ownerId}>`,                   inline: true },
              { name: '📅 Créé',         value: `<t:${Math.floor(guild.createdTimestamp/1000)}:R>`, inline: true },
              { name: '👤 Humains',      value: `**${humans}**`,                          inline: true },
              { name: '🤖 Bots',         value: `**${bots}**`,                            inline: true },
              { name: '🟢 En ligne',     value: `**${online}**`,                          inline: true },
              { name: '📢 Salons',       value: `**${guild.channels.cache.size}**`,       inline: true },
              { name: '🎭 Rôles',        value: `**${guild.roles.cache.size}**`,          inline: true },
              { name: '🚀 Boosts',       value: `**${guild.premiumSubscriptionCount || 0}** (Niv. ${guild.premiumTier})`, inline: true },
            )
            .setTimestamp()
          ]
        });
      }

      if (sub === 'stats') {
        const today = new Date().toISOString().split('T')[0];
        const statsRow = db.db.prepare('SELECT * FROM guild_stats WHERE guild_id=? AND date=?').get(interaction.guildId, today);
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(cfg.color || '#7B2FBE')
            .setTitle(`📊 Stats du ${today}`)
            .addFields(
              { name: '💬 Messages', value: `**${statsRow?.total_messages || 0}**`, inline: true },
              { name: '👋 Arrivées', value: `**${statsRow?.new_members || 0}**`,   inline: true },
              { name: '🚪 Départs',  value: `**${statsRow?.left_members || 0}**`,  inline: true },
            )
          ]
        });
      }

      if (sub === 'message') {
        const channel = interaction.options.getChannel('salon');
        const contenu = interaction.options.getString('contenu');
        await channel.send(contenu);
        return interaction.editReply({ content: `✅ Message envoyé dans ${channel}.` });
      }

      if (sub === 'embed') {
        const channel = interaction.options.getChannel('salon');
        const titre   = interaction.options.getString('titre');
        const desc    = interaction.options.getString('description');
        const color   = interaction.options.getString('couleur') || cfg.color || '#7B2FBE';

        const embed = new EmbedBuilder().setTitle(titre).setDescription(desc);
        if (/^#[0-9A-Fa-f]{6}$/.test(color)) embed.setColor(color);

        await channel.send({ embeds: [embed] });
        return interaction.editReply({ content: `✅ Embed envoyé dans ${channel}.` });
      }
    }

    // ══ BOT ═══════════════════════════════════════════════════════════
    if (group === 'bot') {

      if (sub === 'statut') {
        const uptime = process.uptime();
        const h = Math.floor(uptime / 3600);
        const m = Math.floor((uptime % 3600) / 60);
        const s = Math.floor(uptime % 60);
        const guilds  = interaction.client.guilds.cache.size;
        const users   = interaction.client.users.cache.size;
        const mem     = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);

        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#7B2FBE')
            .setTitle('🤖 Statut de NexusBot')
            .setThumbnail(interaction.client.user.displayAvatarURL())
            .addFields(
              { name: '⏱️ Uptime',        value: `**${h}h ${m}m ${s}s**`,        inline: true },
              { name: '📡 Ping',          value: `**${interaction.client.ws.ping}ms**`, inline: true },
              { name: '🏠 Serveurs',      value: `**${guilds}**`,                 inline: true },
              { name: '👤 Utilisateurs',  value: `**${users}**`,                  inline: true },
              { name: '💾 RAM',           value: `**${mem} MB**`,                 inline: true },
              { name: '⚙️ Version',       value: `**Node.js** ${process.version}`,inline: true },
            )
            .setTimestamp()
          ]
        });
      }

      if (sub === 'prefix') {
        const newPrefix = interaction.options.getString('prefix');
        db.setConfig(interaction.guildId, 'prefix', newPrefix);
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor('#2ECC71').setTitle('✅ Préfixe mis à jour')
            .setDescription(`Le préfixe du serveur est maintenant \`${newPrefix}\`.\n*(Les préfixes \`&\`, \`n!\` et \`!\` restent toujours actifs)*`)]
        });
      }

      if (sub === 'config') {
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(cfg.color || '#7B2FBE')
            .setTitle('⚙️ Configuration NexusBot')
            .addFields(
              { name: '⌨️ Préfixe',      value: `\`${cfg.prefix || 'n!'}\``,       inline: true },
              { name: '🎨 Couleur',       value: cfg.color || '#7B2FBE',            inline: true },
              { name: '💰 Monnaie',       value: `${cfg.currency_emoji || '€'} ${cfg.currency_name || 'Euros'}`, inline: true },
              { name: '📅 Daily',         value: `**${cfg.daily_amount || 25}${cfg.currency_emoji || '€'}**`,   inline: true },
              { name: '⭐ XP',           value: cfg.xp_enabled ? '✅ Activé' : '❌ Désactivé', inline: true },
              { name: '🛡️ AutoMod',      value: cfg.automod_enabled ? '✅ Activé' : '❌ Désactivé', inline: true },
              { name: '👋 Welcome',       value: cfg.welcome_channel ? `<#${cfg.welcome_channel}>` : 'Non configuré', inline: true },
              { name: '🎫 Tickets',       value: cfg.ticket_channel ? `<#${cfg.ticket_channel}>` : 'Non configuré', inline: true },
            )
          ]
        });
      }

      if (sub === 'blacklist') {
        const target = interaction.options.getUser('membre');
        const raison = interaction.options.getString('raison') || 'Aucune raison';
        try {
          db.db.prepare('INSERT OR REPLACE INTO nexus_blacklist (guild_id, user_id, reason, added_by, created_at) VALUES (?,?,?,?,?)')
            .run(interaction.guildId, target.id, raison, interaction.user.id, Math.floor(Date.now()/1000));
        } catch {
          db.db.prepare('CREATE TABLE IF NOT EXISTS nexus_blacklist (guild_id TEXT, user_id TEXT, reason TEXT, added_by TEXT, created_at INTEGER, PRIMARY KEY(guild_id,user_id))').run();
          db.db.prepare('INSERT OR REPLACE INTO nexus_blacklist (guild_id, user_id, reason, added_by, created_at) VALUES (?,?,?,?,?)').run(interaction.guildId, target.id, raison, interaction.user.id, Math.floor(Date.now()/1000));
        }
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('🚫 Utilisateur blacklisté')
            .setDescription(`<@${target.id}> ne peut plus utiliser les commandes du bot.\n**Raison :** ${raison}`)]
        });
      }

      if (sub === 'unblacklist') {
        const target = interaction.options.getUser('membre');
        db.db.prepare('DELETE FROM nexus_blacklist WHERE guild_id=? AND user_id=?').run(interaction.guildId, target.id);
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor('#2ECC71').setTitle('✅ Blacklist levée')
            .setDescription(`<@${target.id}> peut de nouveau utiliser les commandes du bot.`)]
        });
      }
    }

    return interaction.editReply({ content: '❌ Sous-commande inconnue.' });
  }
};
