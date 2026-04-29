const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('massrole')
    .setDescription('👥 Ajouter/Retirer un rôle à tous les membres')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(s => s.setName('ajouter')
      .setDescription('Ajouter un rôle à tous les membres')
      .addRoleOption(o => o.setName('role').setDescription('Rôle à ajouter').setRequired(true))
      .addRoleOption(o => o.setName('filtre_role').setDescription('Filtrer: seulement les membres avec ce rôle').setRequired(false)))
    .addSubcommand(s => s.setName('retirer')
      .setDescription('Retirer un rôle à tous les membres')
      .addRoleOption(o => o.setName('role').setDescription('Rôle à retirer').setRequired(true))
      .addRoleOption(o => o.setName('filtre_role').setDescription('Filtrer: seulement les membres avec ce rôle').setRequired(false)))
    .addSubcommand(s => s.setName('info')
      .setDescription('Voir combien de membres ont ce rôle')
      .addRoleOption(o => o.setName('role').setDescription('Rôle à vérifier').setRequired(true))),
  cooldown: 10,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: true }).catch(() => {}); } catch (e) { /* already ack'd */ }
    }

    const sub = interaction.options.getSubcommand();
    const role = interaction.options.getRole('role');
    const filterRole = interaction.options.getRole('filtre_role');

    // Récupérer tous les membres
    let members = await interaction.guild.members.fetch();

    // Filtrer par rôle si spécifié
    if (filterRole) {
      members = members.filter(m => m.roles.cache.has(filterRole.id));
    }

    if (sub === 'info') {
      const count = members.filter(m => m.roles.cache.has(role.id)).size;
      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('📊 Info Rôle')
        .setDescription(`Le rôle <@&${role.id}> est attribué à **${count}** membre(s).`)
        .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() });
      return await interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'ajouter' || sub === 'retirer') {
      // Vérifier que le bot peut gérer ce rôle
      if (interaction.guild.members.me.roles.highest.comparePositionTo(role) <= 0) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Je ne peux pas gérer ce rôle (trop élevé).', ephemeral: true });
      }

      const isAdd = sub === 'ajouter';
      const targetMembers = members.filter(m =>
        isAdd ? !m.roles.cache.has(role.id) : m.roles.cache.has(role.id)
      );

      if (targetMembers.size === 0) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Aucun membre à traiter.`, ephemeral: true });
      }

      // Defer si plus de 50 membres
      if (targetMembers.size > 50) {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
      }

      let successful = 0;
      let ignored = 0;
      let processed = 0;

      for (const member of targetMembers.values()) {
        try {
          if (isAdd) {
            await member.roles.add(role);
          } else {
            await member.roles.remove(role);
          }
          successful++;
        } catch (err) {
          ignored++;
          if (interaction.isRepliable() && !interaction.replied) {
            (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Une erreur est survenue. Ressaie.', }).catch(() => {});
          }
        }

        processed++;

        // Mettre à jour tous les 10 membres si > 50
        if (targetMembers.size > 50 && processed % 10 === 0) {
          const progress = Math.round((processed / targetMembers.size) * 100);
          try {
            await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
              content: `⏳ Traitement en cours... **${processed}/${targetMembers.size}** (${progress}%)`
            });
          } catch (err) {
            // Ignore les erreurs d'update
            if (interaction.isRepliable() && !interaction.replied) {
              (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Une erreur est survenue. Ressaie.', }).catch(() => {});
            }
          }
        }
      }

      const embed = new EmbedBuilder()
        .setColor(successful > ignored ? '#2ECC71' : '#E74C3C')
        .setTitle(`✅ ${isAdd ? 'Rôle Ajouté' : 'Rôle Retiré'}`)
        .addFields(
          { name: '✅ Réussis', value: `**${successful}** membres`, inline: true },
          { name: '⚠️ Ignorés', value: `**${ignored}** membres (permissions insuffisantes)`, inline: true }
        )
        .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() });

      if (targetMembers.size > 50) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '', embeds: [embed] });
      } else {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed], ephemeral: true });
      }
    }
  }
};
