const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('🎭 Gérer les rôles par réaction')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(s => s.setName('ajouter').setDescription('➕ Ajouter un reaction role')
      .addStringOption(o => o.setName('message_id').setDescription('ID du message').setRequired(true))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji à utiliser').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Rôle à attribuer').setRequired(true)))
    .addSubcommand(s => s.setName('retirer').setDescription('➖ Retirer un reaction role')
      .addStringOption(o => o.setName('message_id').setDescription('ID du message').setRequired(true))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji concerné').setRequired(true)))
    .addSubcommand(s => s.setName('liste').setDescription('📋 Voir tous les reaction roles'))
    .addSubcommand(s => s.setName('creer').setDescription('✨ Créer un message de sélection de rôles')
      .addStringOption(o => o.setName('titre').setDescription('Titre du message').setRequired(true))
      .addStringOption(o => o.setName('description').setDescription('Description').setRequired(false))),
  cooldown: 5,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const cfg = db.getConfig(interaction.guildId);

    // ── AJOUTER ──
    if (sub === 'ajouter') {
      const msgId = interaction.options.getString('message_id');
      const emoji = interaction.options.getString('emoji');
      const role  = interaction.options.getRole('role');

      // Vérifie que le message existe
      let message;
      try { message = await interaction.channel.messages.fetch(msgId); } catch {
        return interaction.reply({ content: '❌ Message introuvable dans ce salon.', ephemeral: true });
      }

      // Extraire l'ID de l'emoji custom si applicable
      const emojiMatch = emoji.match(/<a?:\w+:(\d+)>/);
      const emojiKey   = emojiMatch ? emojiMatch[1] : emoji;

      const existing = db.db.prepare('SELECT * FROM reaction_roles WHERE guild_id = ? AND message_id = ? AND emoji = ?')
        .get(interaction.guildId, msgId, emojiKey);
      if (existing) return interaction.reply({ content: '❌ Ce reaction role existe déjà.', ephemeral: true });

      db.db.prepare('INSERT INTO reaction_roles (guild_id, message_id, emoji, role_id) VALUES (?, ?, ?, ?)')
        .run(interaction.guildId, msgId, emojiKey, role.id);

      // Ajouter la réaction au message
      await message.react(emoji).catch(() => {});

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setDescription(`✅ Reaction role ajouté ! ${emoji} → <@&${role.id}>`)
        ], ephemeral: true
      });
    }

    // ── RETIRER ──
    if (sub === 'retirer') {
      const msgId = interaction.options.getString('message_id');
      const emoji = interaction.options.getString('emoji');
      const emojiMatch = emoji.match(/<a?:\w+:(\d+)>/);
      const emojiKey   = emojiMatch ? emojiMatch[1] : emoji;

      const result = db.db.prepare('DELETE FROM reaction_roles WHERE guild_id = ? AND message_id = ? AND emoji = ?')
        .run(interaction.guildId, msgId, emojiKey);

      if (!result.changes) return interaction.reply({ content: '❌ Reaction role introuvable.', ephemeral: true });

      return interaction.reply({
        embeds: [new EmbedBuilder().setColor('#FFA500').setDescription(`✅ Reaction role **${emoji}** sur le message **${msgId}** supprimé.`)],
        ephemeral: true
      });
    }

    // ── LISTE ──
    if (sub === 'liste') {
      const rrs = db.db.prepare('SELECT * FROM reaction_roles WHERE guild_id = ? LIMIT 25').all(interaction.guildId);
      if (!rrs.length) return interaction.reply({ content: '❌ Aucun reaction role configuré.', ephemeral: true });

      const embed = new EmbedBuilder()
        .setColor(cfg.color || '#7B2FBE')
        .setTitle('🎭 Reaction Roles')
        .setDescription(rrs.map(r => `Message \`${r.message_id}\` → ${r.emoji} → <@&${r.role_id}>`).join('\n'));

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── CRÉER ──
    if (sub === 'creer') {
      const titre = interaction.options.getString('titre');
      const desc  = interaction.options.getString('description') || 'Réagissez avec l\'emoji correspondant pour obtenir un rôle !';

      const embed = new EmbedBuilder()
        .setColor(cfg.color || '#7B2FBE')
        .setTitle(`🎭 ${titre}`)
        .setDescription(desc)
        .setFooter({ text: 'Réagissez pour obtenir vos rôles !' });

      const msg = await interaction.channel.send({ embeds: [embed] });

      return interaction.reply({
        content: `✅ Message de rôles créé ! Utilisez \`/reactionrole ajouter message_id:${msg.id} emoji:... role:...\` pour configurer les rôles.`,
        ephemeral: true
      });
    }
  }
};
