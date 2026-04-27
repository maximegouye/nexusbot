/**
 * /customcmd — Créer des commandes personnalisées ILLIMITÉES par serveur
 * Stockées en DB, exécutées via messageCreate (préfixe) ET comme réponses automatiques
 * C'est ainsi que Carl-bot, MEE6 etc. ont des "milliers de commandes" par serveur
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS custom_commands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, trigger TEXT,
    response TEXT, created_by TEXT,
    uses INTEGER DEFAULT 0,
    embed INTEGER DEFAULT 0,
    embed_color TEXT DEFAULT '#7B2FBE',
    restricted_role TEXT,
    cooldown INTEGER DEFAULT 0,
    last_used INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, trigger)
  )`).run();
} catch {}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('customcmd')
    .setDescription('⚡ Commandes personnalisées illimitées — Créez vos propres commandes !')
    .addSubcommand(s => s.setName('creer').setDescription('➕ Créer une commande personnalisée')
      .addStringOption(o => o.setName('trigger').setDescription('Déclencheur (ex: !rules, !discord)').setRequired(true).setMaxLength(50))
      .addStringOption(o => o.setName('reponse').setDescription('Réponse (supports {user} {server} {args})').setRequired(true).setMaxLength(2000))
      .addBooleanOption(o => o.setName('embed').setDescription('Afficher en embed ?'))
      .addStringOption(o => o.setName('couleur').setDescription('Couleur embed HEX'))
      .addRoleOption(o => o.setName('role_requis').setDescription('Rôle requis pour utiliser cette commande'))
    .addSubcommand(s => s.setName('supprimer').setDescription('🗑️ Supprimer une commande personnalisée')
      .addStringOption(o => o.setName('trigger').setDescription('Déclencheur à supprimer').setRequired(true)))
    .addSubcommand(s => s.setName('liste').setDescription('📋 Voir toutes les commandes de ce serveur'))
    .addSubcommand(s => s.setName('voir').setDescription('🔍 Voir les détails d\'une commande')
      .addStringOption(o => o.setName('trigger').setDescription('Déclencheur').setRequired(true)))
    .addSubcommand(s => s.setName('modifier').setDescription('✏️ Modifier une commande existante')
      .addStringOption(o => o.setName('trigger').setDescription('Déclencheur à modifier').setRequired(true))
      .addStringOption(o => o.setName('nouvelle_reponse').setDescription('Nouvelle réponse').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const isAdmin = interaction.member.permissions.has(0x20n) || interaction.member.permissions.has(0x4000n);

    if (!isAdmin) return interaction.reply({ content: '❌ Staff uniquement.', ephemeral: true });

    if (sub === 'creer') {
      const trigger = interaction.options.getString('trigger').toLowerCase().trim();
      const reponse = interaction.options.getString('reponse');
      const isEmbed = interaction.options.getBoolean('embed') ?? false;
      const couleur = interaction.options.getString('couleur') || '#7B2FBE';
      const roleReq = interaction.options.getRole('role_requis');
      const cooldown = interaction.options.getInteger('cooldown') || 0;

      try {
        db.db.prepare('INSERT INTO custom_commands (guild_id, trigger, response, created_by, embed, embed_color, restricted_role, cooldown) VALUES(?,?,?,?,?,?,?,?)')
          .run(guildId, trigger, reponse, userId, isEmbed ? 1 : 0, couleur, roleReq?.id || null, cooldown);
      } catch {
        return interaction.reply({ content: `❌ La commande \`${trigger}\` existe déjà. Utilisez \`/customcmd modifier\`.`, ephemeral: true });
      }

      const count = db.db.prepare('SELECT COUNT(*) as c FROM custom_commands WHERE guild_id=?').get(guildId);

      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#2ECC71').setTitle('✅ Commande créée !')
          .addFields(
            { name: '⚡ Trigger', value: `\`${trigger}\``, inline: true },
            { name: '💬 Mode', value: isEmbed ? 'Embed' : 'Texte', inline: true },
            { name: '🔢 Total serveur', value: `**${count.c}** commandes custom`, inline: true },
            { name: '📋 Réponse', value: reponse.slice(0, 500), inline: false },
          )
          .setDescription('Variables disponibles : `{user}` `{username}` `{server}` `{args}` `{count}`')
      ], ephemeral: true });
    }

    if (sub === 'supprimer') {
      const trigger = interaction.options.getString('trigger').toLowerCase();
      const result = db.db.prepare('DELETE FROM custom_commands WHERE guild_id=? AND trigger=?').run(guildId, trigger);
      if (!result.changes) return interaction.reply({ content: `❌ Commande \`${trigger}\` introuvable.`, ephemeral: true });
      return interaction.reply({ content: `✅ Commande \`${trigger}\` supprimée.`, ephemeral: true });
    }

    if (sub === 'liste') {
      const cmds = db.db.prepare('SELECT trigger, uses, embed, created_at FROM custom_commands WHERE guild_id=? ORDER BY uses DESC').all(guildId);
      if (!cmds.length) return interaction.reply({ content: '❌ Aucune commande personnalisée sur ce serveur.\nCréez-en avec `/customcmd creer` !', ephemeral: true });

      // Afficher par pages de 20
      const desc = cmds.slice(0, 50).map((c, i) => `**${i+1}.** \`${c.trigger}\` ${c.embed ? '📋' : '💬'} — ${c.uses} utilisations`).join('\n');
      const more = cmds.length > 50 ? `\n*...et ${cmds.length - 50} autres*` : '';

      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#7B2FBE').setTitle(`⚡ Commandes Custom — ${interaction.guild.name}`)
          .setDescription(desc + more)
          .setFooter({ text: `${cmds.length} commandes • Utilisables avec n! ou !` })
      ], ephemeral: true });
    }

    if (sub === 'voir') {
      const trigger = interaction.options.getString('trigger').toLowerCase();
      const cmd = db.db.prepare('SELECT * FROM custom_commands WHERE guild_id=? AND trigger=?').get(guildId, trigger);
      if (!cmd) return interaction.reply({ content: `❌ Commande \`${trigger}\` introuvable.`, ephemeral: true });

      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor(cmd.embed_color || '#7B2FBE').setTitle(`⚡ \`${cmd.trigger}\``)
          .addFields(
            { name: '💬 Mode', value: cmd.embed ? 'Embed' : 'Texte', inline: true },
            { name: '🔢 Utilisations', value: `${cmd.uses}`, inline: true },
            { name: '⏱️ Cooldown', value: cmd.cooldown > 0 ? `${cmd.cooldown}s` : 'Aucun', inline: true },
            { name: '🎭 Rôle requis', value: cmd.restricted_role ? `<@&${cmd.restricted_role}>` : 'Tous', inline: true },
            { name: '📅 Créé', value: `<t:${cmd.created_at}:R>`, inline: true },
            { name: '📋 Réponse', value: cmd.response.slice(0, 1024), inline: false },
          )
      ], ephemeral: true });
    }

    if (sub === 'modifier') {
      const trigger = interaction.options.getString('trigger').toLowerCase();
      const newReponse = interaction.options.getString('nouvelle_reponse');
      const result = db.db.prepare('UPDATE custom_commands SET response=? WHERE guild_id=? AND trigger=?').run(newReponse, guildId, trigger);
      if (!result.changes) return interaction.reply({ content: `❌ Commande \`${trigger}\` introuvable.`, ephemeral: true });
      return interaction.reply({ content: `✅ Commande \`${trigger}\` mise à jour.`, ephemeral: true });
    }
  }
};

// Réactivé comme prefix-only (limite slash Discord)
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
