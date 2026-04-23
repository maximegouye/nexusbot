const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

function parseDuration(str) {
  const map = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  const m = str.match(/^(\d+)([smhd])$/i);
  if (!m) return null;
  const ms = parseInt(m[1]) * (map[m[2].toLowerCase()] || 0);
  if (ms < 5000 || ms > 28 * 24 * 3600000) return null; // Discord: max 28j
  return ms;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('⏱️ Mettre un membre en sourdine temporaire (Discord natif)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(s => s.setName('appliquer').setDescription('Mettre en timeout')
      .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
      .addStringOption(o => o.setName('duree').setDescription('Durée (ex: 10m, 1h, 1d, 7d — max 28j)').setRequired(true))
      .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false)))
    .addSubcommand(s => s.setName('retirer').setDescription('Retirer le timeout d\'un membre')
      .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
      .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false))),

  async execute(interaction) {
    const sub    = interaction.options.getSubcommand();
    const target = interaction.options.getMember('membre');
    const raison = interaction.options.getString('raison') || 'Aucune raison spécifiée';

    if (!target) return interaction.reply({ content: '❌ Membre introuvable.', ephemeral: true });
    if (target.id === interaction.user.id) return interaction.reply({ content: '❌ Tu ne peux pas te mettre toi-même en timeout.', ephemeral: true });
    if (!target.moderatable) return interaction.reply({ content: '❌ Je ne peux pas mettre ce membre en timeout (rôle trop élevé).', ephemeral: true });

    if (sub === 'appliquer') {
      const duree = interaction.options.getString('duree');
      const ms    = parseDuration(duree);
      if (!ms) return interaction.reply({ content: '❌ Durée invalide. Ex: `10m`, `1h`, `7d` (max 28j, min 5s)', ephemeral: true });

      await target.timeout(ms, raison);

      // Log en BDD
      db.db.prepare('INSERT INTO warnings (guild_id,user_id,mod_id,reason) VALUES (?,?,?,?)').run(
        interaction.guildId, target.id, interaction.user.id, `[TIMEOUT ${duree}] ${raison}`);

      const expiresAt = Math.floor((Date.now() + ms) / 1000);
      const embed = new EmbedBuilder()
        .setColor('Orange')
        .setTitle('⏱️ Timeout appliqué')
        .setThumbnail(target.user.displayAvatarURL())
        .addFields(
          { name: '👤 Membre',       value: `<@${target.id}>`, inline: true },
          { name: '⏱️ Durée',        value: duree, inline: true },
          { name: '🔓 Fin',           value: `<t:${expiresAt}:R>`, inline: true },
          { name: '🛡️ Modérateur',  value: `<@${interaction.user.id}>`, inline: true },
          { name: '📋 Raison',        value: raison },
        );

      // Notifier le membre
      target.user.send({ embeds: [new EmbedBuilder().setColor('Orange')
        .setDescription(`⏱️ Tu as été mis en sourdine sur **${interaction.guild.name}** pendant **${duree}**.\nRaison: ${raison}`)
      ]}).catch(() => {});

      // Log mod
      const cfg = db.getConfig(interaction.guildId);
      if (cfg.mod_log_channel) {
        const ch = interaction.guild.channels.cache.get(cfg.mod_log_channel);
        if (ch) ch.send({ embeds: [embed] }).catch(() => {});
      }

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'retirer') {
      if (!target.isCommunicationDisabled()) return interaction.reply({ content: '❌ Ce membre n\'est pas en timeout.', ephemeral: true });
      await target.timeout(null, raison);

      return interaction.reply({ embeds: [new EmbedBuilder()
        .setColor('Green')
        .setDescription(`✅ Timeout retiré pour <@${target.id}>.\nRaison: ${raison}`)
      ], ephemeral: true });
    }
  }
};
