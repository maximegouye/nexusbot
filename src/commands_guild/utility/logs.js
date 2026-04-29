const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const db = require('../../database/db');

try {
  const cols = db.db.prepare('PRAGMA table_info(guild_config)').all().map(c => c.name);
  if (!cols.includes('log_joins'))     db.db.prepare("ALTER TABLE guild_config ADD COLUMN log_joins TEXT").run();
  if (!cols.includes('log_leaves'))    db.db.prepare("ALTER TABLE guild_config ADD COLUMN log_leaves TEXT").run();
  if (!cols.includes('log_messages'))  db.db.prepare("ALTER TABLE guild_config ADD COLUMN log_messages TEXT").run();
  if (!cols.includes('log_moderation'))db.db.prepare("ALTER TABLE guild_config ADD COLUMN log_moderation TEXT").run();
  if (!cols.includes('log_voice'))     db.db.prepare("ALTER TABLE guild_config ADD COLUMN log_voice TEXT").run();
  if (!cols.includes('log_roles'))     db.db.prepare("ALTER TABLE guild_config ADD COLUMN log_roles TEXT").run();
} catch {}

const LOG_TYPES = {
  joins:      { label: '🟢 Arrivées', desc: 'Membres qui rejoignent le serveur' },
  leaves:     { label: '🔴 Départs',  desc: 'Membres qui quittent le serveur' },
  messages:   { label: '💬 Messages', desc: 'Messages supprimés/modifiés' },
  moderation: { label: '🔨 Modération', desc: 'Bans, kicks, timeouts, warns' },
  voice:      { label: '🎙️ Vocal',    desc: 'Entrées/sorties en vocal' },
  roles:      { label: '🎭 Rôles',    desc: 'Attribution/retrait de rôles' },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('📋 Configurez les canaux de logs du serveur')
    .addSubcommand(s => s.setName('setup').setDescription('⚙️ Configurer un type de log')
      .addStringOption(o => o.setName('type').setDescription('Type de log').setRequired(true)
        .addChoices(
          { name: '🟢 Arrivées', value: 'joins' },
          { name: '🔴 Départs', value: 'leaves' },
          { name: '💬 Messages', value: 'messages' },
          { name: '🔨 Modération', value: 'moderation' },
          { name: '🎙️ Vocal', value: 'voice' },
          { name: '🎭 Rôles', value: 'roles' },
        ))
      .addChannelOption(o => o.setName('salon').setDescription('Salon de logs (vide = désactiver)').addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(s => s.setName('voir').setDescription('📋 Voir la configuration actuelle des logs'))
    .addSubcommand(s => s.setName('test').setDescription('🧪 Envoyer un message de test dans un canal de logs')
      .addStringOption(o => o.setName('type').setDescription('Type de log').setRequired(true)
        .addChoices(...Object.entries(LOG_TYPES).map(([k, v]) => ({ name: v.label, value: k }))))),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: true }).catch(() => {}); } catch (e) { /* already ack'd */ }
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (!interaction.member.permissions.has(0x20n)) // ManageGuild
      return interaction.editReply({ content: '❌ Permission insuffisante.', ephemeral: true });

    if (sub === 'setup') {
      const type = interaction.options.getString('type');
      const channel = interaction.options.getChannel('salon');

      db.setConfig(guildId, `log_${type}`, channel?.id || null);

      return interaction.editReply({ embeds: [
        new EmbedBuilder().setColor('#2ECC71')
          .setDescription(channel
            ? `✅ Logs **${LOG_TYPES[type].label}** → ${channel}`
            : `✅ Logs **${LOG_TYPES[type].label}** désactivés.`)
      ], ephemeral: true });
    }

    if (sub === 'voir') {
      const cfg = db.getConfig(guildId);
      const lines = Object.entries(LOG_TYPES).map(([k, v]) => {
        const chId = cfg[`log_${k}`];
        return `${v.label} — ${chId ? `<#${chId}>` : '❌ Désactivé'}`;
      }).join('\n');

      return interaction.editReply({ embeds: [
        new EmbedBuilder().setColor('#7B2FBE').setTitle('📋 Configuration des Logs')
          .setDescription(lines)
      ], ephemeral: true });
    }

    if (sub === 'test') {
      const type = interaction.options.getString('type');
      const cfg = db.getConfig(guildId);
      const chId = cfg[`log_${type}`];

      if (!chId) return interaction.editReply({ content: `❌ Aucun canal configuré pour les logs **${LOG_TYPES[type].label}**.`, ephemeral: true });

      try {
        const ch = await interaction.client.channels.fetch(chId);
        await ch.send({ embeds: [
          new EmbedBuilder().setColor('#F1C40F').setTitle(`🧪 Test — ${LOG_TYPES[type].label}`)
            .setDescription('Ceci est un message de test. Les logs s\'afficheront ici.')
            .setTimestamp()
        ]});
        return interaction.editReply({ content: `✅ Message de test envoyé dans <#${chId}> !`, ephemeral: true });
      } catch (e) {
        return interaction.editReply({ content: `❌ Impossible d'envoyer dans <#${chId}> : ${e.message}`, ephemeral: true });
      }
    }
  }
};

// Réactivé comme prefix-only (limite slash Discord)
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
