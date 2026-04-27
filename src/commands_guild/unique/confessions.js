/**
 * NexusBot — Confessions Anonymes
 * /confession — Partagez anonymement, réagissez avec empathie !
 */
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS confessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    message     TEXT NOT NULL,
    channel_msg TEXT,
    reactions   TEXT DEFAULT '{}',
    approved    INTEGER DEFAULT 1,
    created_at  INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS confession_config (
    guild_id    TEXT PRIMARY KEY,
    channel_id  TEXT,
    moderation  INTEGER DEFAULT 0,
    cooldown_m  INTEGER DEFAULT 30
  )`).run();
} catch {}

const REACTION_EMOJIS = ['❤️','🤗','💙','😢','💪','🙏'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('confession')
    .setDescription('🤫 Système de confessions anonymes')
    .addSubcommand(s => s.setName('envoyer')
      .setDescription('✉️ Envoyer une confession anonyme')
      .addStringOption(o => o.setName('message').setDescription('Votre confession (100% anonyme)').setRequired(true).setMaxLength(800)))
    .addSubcommand(s => s.setName('config')
      .setDescription('⚙️ Configurer le système (admin)')
      .addChannelOption(o => o.setName('salon').setDescription('Salon des confessions').setRequired(true))
      .addBooleanOption(o => o.setName('moderation').setDescription('Activer la modération avant publication'))
    .addSubcommand(s => s.setName('voir')
      .setDescription('📋 Voir les dernières confessions')),

  cooldown: 5,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId  = interaction.user.id;

    if (sub === 'config') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
        return interaction.editReply({ content: '❌ Permission insuffisante.' });

      const salon    = interaction.options.getChannel('salon');
      const modEnable = interaction.options.getBoolean('moderation') ?? false;
      const cooldown  = interaction.options.getInteger('cooldown') || 30;

      db.db.prepare('INSERT OR REPLACE INTO confession_config (guild_id, channel_id, moderation, cooldown_m) VALUES (?,?,?,?)')
        .run(guildId, salon.id, modEnable ? 1 : 0, cooldown);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2ecc71').setDescription(`✅ Confessions configurées !\n📍 Salon : ${salon}\n🔒 Modération : ${modEnable ? 'Activée' : 'Désactivée'}\n⏱️ Cooldown : ${cooldown} minutes`)] });
    }

    if (sub === 'envoyer') {
      const cfg = db.db.prepare('SELECT * FROM confession_config WHERE guild_id=?').get(guildId);
      if (!cfg || !cfg.channel_id) return interaction.editReply({ content: '❌ Le système de confessions n\'est pas encore configuré. Demandez à un admin !' });

      // Cooldown check
      const last = db.db.prepare('SELECT * FROM confessions WHERE guild_id=? AND user_id=? ORDER BY created_at DESC LIMIT 1').get(guildId, userId);
      if (last) {
        const elapsed = Math.floor(Date.now()/1000) - last.created_at;
        const cd = (cfg.cooldown_m || 30) * 60;
        if (elapsed < cd) {
          const remaining = Math.ceil((cd - elapsed) / 60);
          return interaction.editReply({ content: `⏳ Attends encore **${remaining}** minute(s) avant ta prochaine confession.` });
        }
      }

      const message = interaction.options.getString('message');
      const result  = db.db.prepare('INSERT INTO confessions (guild_id, user_id, message) VALUES (?,?,?)').run(guildId, userId, message);
      const id      = result.lastInsertRowid;

      const embed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle(`🤫 Confession Anonyme #${id}`)
        .setDescription(`*"${message}"*`)
        .setFooter({ text: `Confession #${id} • 100% anonyme` })
        .setTimestamp();

      const ch = interaction.guild.channels.cache.get(cfg.channel_id);
      if (ch) {
        const msg = await ch.send({ embeds: [embed] }).catch(() => null);
        if (msg) {
          db.db.prepare('UPDATE confessions SET channel_msg=? WHERE id=?').run(msg.id, id);
          for (const emoji of REACTION_EMOJIS) await msg.react(emoji).catch(() => {});
        }
      }

      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2ecc71').setDescription(`✅ Ta confession **#${id}** a été envoyée anonymement.\n📍 Visible dans <#${cfg.channel_id}>`)] });
    }

    if (sub === 'voir') {
      const confs = db.db.prepare('SELECT id, message, created_at FROM confessions WHERE guild_id=? AND approved=1 ORDER BY created_at DESC LIMIT 5').all(guildId);
      if (!confs.length) return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#95a5a6').setDescription('Aucune confession publiée.')] });
      const embed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle('🤫 Dernières Confessions')
        .setDescription(confs.map(c => `**#${c.id}** <t:${c.created_at}:R>\n*"${c.message.slice(0,100)}${c.message.length>100?'...':''}"*`).join('\n\n'));
      return interaction.editReply({ embeds: [embed] });
    }
  }
};

// Réactivé comme prefix-only (limite slash Discord)
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
