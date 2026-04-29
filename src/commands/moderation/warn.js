const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('⚠️ Avertir un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('membre').setDescription('Membre à avertir').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison de l\'avertissement').setRequired(true)),
  cooldown: 3,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: true }).catch(() => {}); } catch (e) { /* already ack'd */ }
    }

    try {
      const target = interaction.options.getUser('membre');
      const raison = interaction.options.getString('raison');

      if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers))
        return interaction.editReply({ content: '❌ Tu n\'as pas les permissions.', ephemeral: true });

      if (target.id === interaction.user.id) return interaction.editReply({ content: '❌ Tu ne peux pas t\'avertir toi-même.', ephemeral: true });

      db.db.prepare('INSERT INTO warnings (guild_id, user_id, mod_id, reason, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(interaction.guildId, target.id, interaction.user.id, raison, Math.floor(Date.now() / 1000));

      const count = db.db.prepare('SELECT COUNT(*) as c FROM warnings WHERE guild_id = ? AND user_id = ?')
        .get(interaction.guildId, target.id).c;

      // DM à la cible
      await target.send({
        embeds: [new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle(`⚠️ Avertissement sur ${interaction.guild.name}`)
          .addFields(
            { name: '📝 Raison', value: raison },
            { name: '📊 Avertissements', value: `**${count}** au total` },
          )
        ]
      }).catch(() => {});

      // Actions automatiques selon le nombre d'avertissements
      let autoAction = '';
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (member) {
        if (count >= 5) {
          await member.ban({ reason: `5 avertissements (automod)` }).catch(() => {});
          autoAction = '\n🔨 **Action automatique : Bannissement** (5 warns atteints)';
        } else if (count >= 3) {
          await member.timeout(3600 * 1000, `3 avertissements (automod)`).catch(() => {});
          autoAction = '\n🔇 **Action automatique : Mute 1h** (3 warns atteints)';
        }
      }

      const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('⚠️ Avertissement émis')
        .setDescription(`**${target.username}** a reçu un avertissement.${autoAction}`)
        .addFields(
          { name: '👮 Modérateur',         value: interaction.user.username, inline: true },
          { name: '📊 Total avertissements', value: `**${count}**`,     inline: true },
          { name: '📝 Raison',             value: raison,               inline: false },
        )
        .setThumbnail(target.displayAvatarURL())
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[CMD] Erreur execute:', err?.message || err);
      const errMsg = { content: `❌ Une erreur est survenue : ${err?.message || 'Erreur inconnue'}`, ephemeral: true };
      try {
        await interaction.editReply(errMsg).catch(() => {});
      } catch {}
    }
  }
};
