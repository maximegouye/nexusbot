const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

// Caractères à supprimer en début de pseudo
// eslint-disable-next-line no-control-regex
const HOIST_CHARS = /^[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~0-9]+/u;

function dehoist(name) {
  // Supprimer les caractères hoistant en début
  let cleaned = name.replace(HOIST_CHARS, '');

  // Si le nom devient vide, ajouter "Membre"
  if (!cleaned || cleaned.trim() === '') {
    cleaned = 'Membre';
  }

  return cleaned;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dehoist')
    .setDescription('🔤 Supprimer les caractères spéciaux en début de pseudo')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
    .addSubcommand(s => s.setName('scanner')
      .setDescription('📊 Aperçu des pseudos à renommer (sans modifier)'))
    .addSubcommand(s => s.setName('appliquer')
      .setDescription('✏️ Renommer tous les membres avec hoisting'))
    .addSubcommand(s => s.setName('membre')
      .setDescription('✏️ Renommer un seul membre')
      .addUserOption(o => o.setName('utilisateur').setDescription('Utilisateur à renommer').setRequired(true))),
  cooldown: 10,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'scanner') {
      const members = await interaction.guild.members.fetch();
      const hoisted = members.filter(m => {
        const current = m.nickname || m.user.username;
        return dehoist(current) !== current;
      });

      if (hoisted.size === 0) {
        return interaction.reply({ content: '✅ Aucun pseudo avec hoisting détecté !', ephemeral: true });
      }

      const list = hoisted
        .first(25)
        .map(m => {
          const current = m.nickname || m.user.username;
          const cleaned = dehoist(current);
          return `${m.user.username} → **${cleaned}**`;
        })
        .join('\n');

      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle(`📊 Scan Dehoist - ${hoisted.size} détecté(s)`)
        .setDescription(list || 'Aucun')
        .setFooter({ text: `${hoisted.size} pseudo(s) à nettoyer (affichage limité à 25)` });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'appliquer') {
      const members = await interaction.guild.members.fetch();
      const hoisted = members.filter(m => {
        const current = m.nickname || m.user.username;
        return dehoist(current) !== current;
      });

      if (hoisted.size === 0) {
        return interaction.reply({ content: '✅ Aucun pseudo avec hoisting à traiter !', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });

      let successful = 0;
      let processed = 0;

      for (const member of hoisted.values()) {
        try {
          const current = member.nickname || member.user.username;
          const cleaned = dehoist(current);

          if (cleaned !== current) {
            await member.setNickname(cleaned, 'Dehoist');
            successful++;
          }
        } catch (err) {
          // Ignorer les erreurs (permissions)
          if (interaction.isRepliable() && !interaction.replied) {
            interaction.editReply({ content: '❌ Une erreur est survenue. Ressaie.', }).catch(() => {});
          }
        }

        processed++;
        if (processed % 10 === 0) {
          try {
            await interaction.editReply({
              content: `⏳ Traitement... **${processed}/${hoisted.size}**`
            });
          } catch (err) {
            // Ignore
            if (interaction.isRepliable() && !interaction.replied) {
              interaction.editReply({ content: '❌ Une erreur est survenue. Ressaie.', }).catch(() => {});
            }
          }
        }
      }

      const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('✅ Dehoist Appliqué')
        .setDescription(`**${successful}** membre(s) ont été renommé(s).`)
        .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() });

      return interaction.editReply({ content: '', embeds: [embed] });
    }

    if (sub === 'membre') {
      const user = interaction.options.getUser('utilisateur');
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (!member) {
        return interaction.reply({ content: '❌ Utilisateur non trouvé.', ephemeral: true });
      }

      const current = member.nickname || member.user.username;
      const cleaned = dehoist(current);

      if (cleaned === current) {
        return interaction.reply({ content: '✅ Ce pseudo n\'a pas de hoisting.', ephemeral: true });
      }

      try {
        await member.setNickname(cleaned, 'Dehoist manuel');
        const embed = new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('✅ Pseudo Nettoyé')
          .setDescription(`${member} : **${current}** → **${cleaned}**`)
          .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() });

        return interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (err) {
        return interaction.reply({ content: `❌ Erreur : impossible de renommer (permissions insuffisantes).`, ephemeral: true });
      }
    }
  }
};
