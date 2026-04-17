const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS compteurs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, channel_id TEXT,
    type TEXT, value INTEGER DEFAULT 0,
    UNIQUE(guild_id, type)
  )`).run();
  const cols = db.db.prepare('PRAGMA table_info(guild_config)').all().map(c => c.name);
  if (!cols.includes('counter_members')) db.db.prepare("ALTER TABLE guild_config ADD COLUMN counter_members TEXT").run();
  if (!cols.includes('counter_online'))  db.db.prepare("ALTER TABLE guild_config ADD COLUMN counter_online TEXT").run();
  if (!cols.includes('counter_bots'))    db.db.prepare("ALTER TABLE guild_config ADD COLUMN counter_bots TEXT").run();
} catch {}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('compteur')
    .setDescription('📊 Compteurs automatiques affichant les stats du serveur dans des salons vocaux')
    .addSubcommand(s => s.setName('setup').setDescription('⚙️ Créer un compteur automatique')
      .addStringOption(o => o.setName('type').setDescription('Type de compteur').setRequired(true)
        .addChoices(
          { name: '👥 Membres totaux', value: 'members' },
          { name: '🟢 Membres en ligne', value: 'online' },
          { name: '🤖 Bots', value: 'bots' },
          { name: '📋 Channels', value: 'channels' },
        ))
      .addStringOption(o => o.setName('format').setDescription('Format (ex: "👥 Membres: {count}")').setRequired(true)))
    .addSubcommand(s => s.setName('update').setDescription('🔄 Mettre à jour tous les compteurs maintenant'))
    .addSubcommand(s => s.setName('supprimer').setDescription('🗑️ Supprimer un compteur')
      .addStringOption(o => o.setName('type').setDescription('Type').setRequired(true)
        .addChoices(
          { name: '👥 Membres totaux', value: 'members' },
          { name: '🟢 Membres en ligne', value: 'online' },
          { name: '🤖 Bots', value: 'bots' },
          { name: '📋 Channels', value: 'channels' },
        ))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const guild = interaction.guild;

    if (!interaction.member.permissions.has(0x20n)) return interaction.reply({ content: '❌ Admin uniquement.', ephemeral: true });

    if (sub === 'setup') {
      const type = interaction.options.getString('type');
      const format = interaction.options.getString('format');

      const counts = {
        members: guild.memberCount,
        online: guild.members.cache.filter(m => m.presence?.status !== 'offline').size,
        bots: guild.members.cache.filter(m => m.user.bot).size,
        channels: guild.channels.cache.size,
      };

      const name = format.replace('{count}', counts[type]);
      let channel;
      try {
        channel = await guild.channels.create({
          name,
          type: ChannelType.GuildVoice,
          permissionOverwrites: [{ id: guild.id, deny: ['Connect'] }],
        });
      } catch (e) {
        return interaction.reply({ content: `❌ Impossible de créer le salon : ${e.message}`, ephemeral: true });
      }

      db.db.prepare('INSERT OR REPLACE INTO compteurs (guild_id, channel_id, type, value) VALUES (?,?,?,?)').run(guildId, channel.id, `${type}:${format}`, counts[type]);

      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#2ECC71').setTitle('✅ Compteur créé !')
          .addFields(
            { name: '📊 Type', value: type, inline: true },
            { name: '📍 Salon', value: `${channel}`, inline: true },
          )
          .setDescription('Le compteur se met à jour automatiquement.')
      ], ephemeral: true });
    }

    if (sub === 'update') {
      const counters = db.db.prepare('SELECT * FROM compteurs WHERE guild_id=?').all(guildId);
      if (!counters.length) return interaction.reply({ content: '❌ Aucun compteur configuré.', ephemeral: true });

      await guild.members.fetch();
      let updated = 0;

      for (const c of counters) {
        const [type, format] = c.type.split(':');
        if (!format) continue;

        const counts = {
          members: guild.memberCount,
          online: guild.members.cache.filter(m => m.presence?.status !== 'offline').size,
          bots: guild.members.cache.filter(m => m.user.bot).size,
          channels: guild.channels.cache.size,
        };

        const newName = format.replace('{count}', counts[type] || 0);
        try {
          const ch = guild.channels.cache.get(c.channel_id);
          if (ch) { await ch.setName(newName); updated++; }
        } catch {}
      }

      return interaction.reply({ content: `✅ **${updated}** compteur(s) mis à jour.`, ephemeral: true });
    }

    if (sub === 'supprimer') {
      const type = interaction.options.getString('type');
      const counter = db.db.prepare("SELECT * FROM compteurs WHERE guild_id=? AND type LIKE ?").get(guildId, `${type}:%`);
      if (!counter) return interaction.reply({ content: '❌ Compteur introuvable.', ephemeral: true });

      try {
        const ch = guild.channels.cache.get(counter.channel_id);
        if (ch) await ch.delete();
      } catch {}

      db.db.prepare("DELETE FROM compteurs WHERE guild_id=? AND type LIKE ?").run(guildId, `${type}:%`);
      return interaction.reply({ content: '✅ Compteur supprimé.', ephemeral: true });
    }
  }
};
