const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

// S'assurer que la table automod existe
db.db.prepare(`
  CREATE TABLE IF NOT EXISTS automod_config (
    guild_id TEXT PRIMARY KEY,
    anti_spam INTEGER DEFAULT 0,
    spam_threshold INTEGER DEFAULT 5,
    spam_window INTEGER DEFAULT 5,
    anti_links INTEGER DEFAULT 0,
    allowed_links TEXT DEFAULT '[]',
    anti_invites INTEGER DEFAULT 0,
    anti_caps INTEGER DEFAULT 0,
    caps_threshold INTEGER DEFAULT 70,
    anti_mentions INTEGER DEFAULT 0,
    mentions_limit INTEGER DEFAULT 5,
    bad_words TEXT DEFAULT '[]',
    log_channel TEXT,
    action TEXT DEFAULT 'warn',
    updated_at INTEGER DEFAULT 0
  )
`).run();

function getAutomodCfg(guildId) {
  let row = db.db.prepare('SELECT * FROM automod_config WHERE guild_id = ?').get(guildId);
  if (!row) {
    db.db.prepare('INSERT OR IGNORE INTO automod_config (guild_id) VALUES (?)').run(guildId);
    row = db.db.prepare('SELECT * FROM automod_config WHERE guild_id = ?').get(guildId);
  }
  row.allowed_links = JSON.parse(row.allowed_links || '[]');
  row.bad_words     = JSON.parse(row.bad_words || '[]');
  return row;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('🛡️ Configurer l\'auto-modération avancée du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s
      .setName('statut')
      .setDescription('Voir la configuration actuelle')
    )
    .addSubcommand(s => s
      .setName('antispam')
      .setDescription('Activer/désactiver l\'anti-spam')
      .addBooleanOption(o => o.setName('actif').setDescription('Activer').setRequired(true))
      .addIntegerOption(o => o.setName('seuil').setDescription('Nombre de messages avant warn').setMinValue(1).setRequired(false))
      .addIntegerOption(o => o.setName('fenetre').setDescription('Fenêtre temporelle en secondes').setMinValue(1).setRequired(false))
    )
    .addSubcommand(s => s
      .setName('antiliens')
      .setDescription('Bloquer les liens externes')
      .addBooleanOption(o => o.setName('actif').setDescription('Activer').setRequired(true))
      .addStringOption(o => o.setName('exceptions').setDescription('Domaines autorisés séparés par virgule (ex: youtube.com,twitch.tv)'))
    )
    .addSubcommand(s => s
      .setName('antiinvites')
      .setDescription('Bloquer les invitations Discord')
      .addBooleanOption(o => o.setName('actif').setDescription('Activer').setRequired(true))
    )
    .addSubcommand(s => s
      .setName('anticaps')
      .setDescription('Bloquer les messages en MAJUSCULES')
      .addBooleanOption(o => o.setName('actif').setDescription('Activer').setRequired(true))
      .addIntegerOption(o => o.setName('pourcentage').setDescription('% minimum de majuscules').setMinValue(1).setMaxValue(100).setRequired(false))
    )
    .addSubcommand(s => s
      .setName('antimentions')
      .setDescription('Limiter les mentions en masse')
      .addBooleanOption(o => o.setName('actif').setDescription('Activer').setRequired(true))
      .addIntegerOption(o => o.setName('limite').setDescription('Maximum de mentions par message').setMinValue(1).setRequired(false))
    )
    .addSubcommand(s => s
      .setName('mauvaismots')
      .setDescription('Gérer la liste de mots interdits')
      .addStringOption(o => o.setName('action').setDescription('ajouter ou supprimer').setRequired(true).addChoices(
        { name: 'Ajouter', value: 'add' },
        { name: 'Supprimer', value: 'remove' },
        { name: 'Voir la liste', value: 'list' },
        { name: 'Vider la liste', value: 'clear' },
      ))
      .addStringOption(o => o.setName('mot').setDescription('Le mot à ajouter/supprimer'))
    )
    .addSubcommand(s => s
      .setName('action')
      .setDescription('Action à effectuer lors d\'une violation')
      .addStringOption(o => o.setName('type').setDescription('Type d\'action').setRequired(true).addChoices(
        { name: '⚠️ Avertir (warn)', value: 'warn' },
        { name: '🗑️ Supprimer seulement', value: 'delete' },
        { name: '🔇 Mute 5 minutes', value: 'mute' },
        { name: '👢 Kick', value: 'kick' },
      ))
    )
    .addSubcommand(s => s
      .setName('log')
      .setDescription('Salon pour les logs automod')
      .addChannelOption(o => o.setName('salon').setDescription('Salon de logs').setRequired(true))
    ),

  async execute(interaction) {
    try {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const cfg = getAutomodCfg(interaction.guildId);

    if (sub === 'statut') {
      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('🛡️ Configuration AutoMod')
        .addFields(
          { name: '🚫 Anti-Spam',      value: cfg.anti_spam ? `✅ Actif (${cfg.spam_threshold} msg / ${cfg.spam_window}s)` : '❌ Inactif', inline: true },
          { name: '🔗 Anti-Liens',     value: cfg.anti_links ? `✅ Actif\nExceptions: ${cfg.allowed_links.join(', ') || 'aucune'}` : '❌ Inactif', inline: true },
          { name: '📨 Anti-Invites',   value: cfg.anti_invites ? '✅ Actif' : '❌ Inactif', inline: true },
          { name: '🔠 Anti-Caps',      value: cfg.anti_caps ? `✅ Actif (${cfg.caps_threshold}%)` : '❌ Inactif', inline: true },
          { name: '📢 Anti-Mentions',  value: cfg.anti_mentions ? `✅ Actif (max ${cfg.mentions_limit})` : '❌ Inactif', inline: true },
          { name: '🤬 Mots interdits', value: cfg.bad_words.length ? `${cfg.bad_words.length} mot(s)` : 'Aucun', inline: true },
          { name: '⚡ Action',          value: cfg.action === 'warn' ? '⚠️ Avertissement' : cfg.action === 'delete' ? '🗑️ Suppression' : cfg.action === 'mute' ? '🔇 Mute' : '👢 Kick', inline: true },
          { name: '📋 Log channel',    value: cfg.log_channel ? `<#${cfg.log_channel}>` : 'Non configuré', inline: true },
        )
        .setFooter({ text: 'NexusBot AutoMod v2' });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'antispam') {
      const actif  = interaction.options.getBoolean('actif');
      const seuil  = interaction.options.getInteger('seuil') ?? cfg.spam_threshold;
      const fen    = interaction.options.getInteger('fenetre') ?? cfg.spam_window;
      db.db.prepare('UPDATE automod_config SET anti_spam=?, spam_threshold=?, spam_window=? WHERE guild_id=?')
        .run(actif ? 1 : 0, seuil, fen, interaction.guildId);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor(actif ? 'Green' : 'Red')
        .setDescription(`✅ Anti-Spam ${actif ? `activé (${seuil} messages / ${fen}s)` : 'désactivé'}`)] });
    }

    if (sub === 'antiliens') {
      const actif  = interaction.options.getBoolean('actif');
      const exc    = interaction.options.getString('exceptions');
      const allowed = exc ? exc.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : cfg.allowed_links;
      db.db.prepare('UPDATE automod_config SET anti_links=?, allowed_links=? WHERE guild_id=?')
        .run(actif ? 1 : 0, JSON.stringify(allowed), interaction.guildId);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor(actif ? 'Green' : 'Red')
        .setDescription(`✅ Anti-Liens ${actif ? `activé${allowed.length ? ` (exceptions: ${allowed.join(', ')})` : ''}` : 'désactivé'}`)] });
    }

    if (sub === 'antiinvites') {
      const actif = interaction.options.getBoolean('actif');
      db.db.prepare('UPDATE automod_config SET anti_invites=? WHERE guild_id=?').run(actif ? 1 : 0, interaction.guildId);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor(actif ? 'Green' : 'Red')
        .setDescription(`✅ Anti-Invitations ${actif ? 'activé' : 'désactivé'}`)] });
    }

    if (sub === 'anticaps') {
      const actif = interaction.options.getBoolean('actif');
      const pct   = interaction.options.getInteger('pourcentage') ?? cfg.caps_threshold;
      db.db.prepare('UPDATE automod_config SET anti_caps=?, caps_threshold=? WHERE guild_id=?')
        .run(actif ? 1 : 0, pct, interaction.guildId);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor(actif ? 'Green' : 'Red')
        .setDescription(`✅ Anti-Caps ${actif ? `activé (seuil: ${pct}% de majuscules)` : 'désactivé'}`)] });
    }

    if (sub === 'antimentions') {
      const actif   = interaction.options.getBoolean('actif');
      const limite  = interaction.options.getInteger('limite') ?? cfg.mentions_limit;
      db.db.prepare('UPDATE automod_config SET anti_mentions=?, mentions_limit=? WHERE guild_id=?')
        .run(actif ? 1 : 0, limite, interaction.guildId);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor(actif ? 'Green' : 'Red')
        .setDescription(`✅ Anti-Mentions ${actif ? `activé (max ${limite} mentions/message)` : 'désactivé'}`)] });
    }

    if (sub === 'mauvaismots') {
      const action = interaction.options.getString('action');
      const mot    = interaction.options.getString('mot')?.toLowerCase().trim();
      let words = [...cfg.bad_words];

      if (action === 'list') {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#7B2FBE')
          .setTitle('🤬 Mots interdits')
          .setDescription(words.length ? `\`${words.join('`, `')}\`` : 'Aucun mot interdit configuré.')
        ]});
      }
      if (action === 'clear') {
        db.db.prepare('UPDATE automod_config SET bad_words=? WHERE guild_id=?').run('[]', interaction.guildId);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('Green').setDescription('✅ Liste de mots interdits vidée.')] });
      }
      if (!mot) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)('❌ Précise un mot.');
      if (action === 'add') {
        if (!words.includes(mot)) words.push(mot);
        db.db.prepare('UPDATE automod_config SET bad_words=? WHERE guild_id=?').run(JSON.stringify(words), interaction.guildId);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`✅ Mot \`${mot}\` ajouté à la liste.`)] });
      }
      if (action === 'remove') {
        words = words.filter(w => w !== mot);
        db.db.prepare('UPDATE automod_config SET bad_words=? WHERE guild_id=?').run(JSON.stringify(words), interaction.guildId);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`✅ Mot \`${mot}\` retiré de la liste.`)] });
      }
    }

    if (sub === 'action') {
      const type = interaction.options.getString('type');
      db.db.prepare('UPDATE automod_config SET action=? WHERE guild_id=?').run(type, interaction.guildId);
      const labels = { warn: '⚠️ Avertissement', delete: '🗑️ Suppression', mute: '🔇 Mute 5min', kick: '👢 Kick' };
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('Green')
        .setDescription(`✅ Action AutoMod définie : **${labels[type]}**`)] });
    }

    if (sub === 'log') {
      const ch = interaction.options.getChannel('salon');
      db.db.prepare('UPDATE automod_config SET log_channel=? WHERE guild_id=?').run(ch.id, interaction.guildId);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('Green')
        .setDescription(`✅ Logs AutoMod → <#${ch.id}>`)] });
    }
    } catch (err) {
    console.error('[CMD] Erreur execute:', err?.message || err);
    const errMsg = { content: `❌ Une erreur est survenue : ${err?.message || 'Erreur inconnue'}`, ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errMsg).catch(() => {});
      } else {
        await interaction.editReply(errMsg).catch(() => {});
      }
    } catch {}
  }}
};
