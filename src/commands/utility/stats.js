const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const os = require('os');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('📈 Statistiques du bot NexusBot'),
  cooldown: 10,

  async execute(interaction) {
    const cfg   = db.getConfig(interaction.guildId);
    const uptime = process.uptime();
    const d = Math.floor(uptime / 86400);
    const h = Math.floor((uptime % 86400) / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = Math.floor(uptime % 60);

    const guilds   = interaction.client.guilds.cache.size;
    const users    = interaction.client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);
    const channels = interaction.client.channels.cache.size;
    const ping     = interaction.client.ws.ping;
    const mem      = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);

    // Stats de ce serveur
    const gStats   = db.db.prepare('SELECT * FROM guild_stats WHERE guild_id = ?').get(interaction.guildId);
    const totalCmds = db.db.prepare('SELECT COUNT(*) as c FROM users WHERE guild_id = ?').get(interaction.guildId)?.c || 0;
    const giveaways = db.db.prepare('SELECT COUNT(*) as c FROM giveaways WHERE guild_id = ?').get(interaction.guildId)?.c || 0;
    const tickets   = db.db.prepare('SELECT COUNT(*) as c FROM tickets WHERE guild_id = ?').get(interaction.guildId)?.c || 0;

    const embed = new EmbedBuilder()
      .setColor(cfg.color || '#7B2FBE')
      .setTitle('📈 Statistiques NexusBot')
      .setThumbnail(interaction.client.user.displayAvatarURL())
      .addFields(
        // Global
        { name: '🌍 Serveurs',      value: `**${guilds.toLocaleString('fr-FR')}**`,   inline: true },
        { name: '👥 Utilisateurs',  value: `**${users.toLocaleString('fr-FR')}**`,    inline: true },
        { name: '📁 Salons',        value: `**${channels.toLocaleString('fr-FR')}**`, inline: true },
        { name: '⚡ Ping',          value: `**${ping}ms**`,                        inline: true },
        { name: '💾 Mémoire',       value: `**${mem} MB** / ${totalMem} GB`,       inline: true },
        { name: '⏱️ Uptime',        value: `**${d}j ${h}h ${m}m ${s}s**`,          inline: true },
        // Ce serveur
        { name: '\u200b', value: '**── Stats de ce serveur ──**', inline: false },
        { name: '👤 Membres suivis', value: `**${totalCmds}**`,  inline: true },
        { name: '🎉 Giveaways',     value: `**${giveaways}**`,   inline: true },
        { name: '🎫 Tickets',       value: `**${tickets}**`,     inline: true },
        { name: '📨 Messages totaux', value: `**${(gStats?.total_messages || 0).toLocaleString('fr-FR')}**`, inline: true },
        { name: '👋 Arrivées',      value: `**${(gStats?.joined_members || 0).toLocaleString('fr-FR')}**`, inline: true },
        { name: '🚪 Départs',       value: `**${(gStats?.left_members || 0).toLocaleString('fr-FR')}**`,  inline: true },
      )
      .setFooter({ text: `Node.js ${process.version} • discord.js v14` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
