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
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }).catch(() => {}); } catch (e) { /* already ack'd */ }
    }

    const sub = interaction.options.getSubcommand();
    const cfg = db.getConfig(interaction.guildId);

    // ── AJOUTER ──
    if (sub === 'ajouter') {
      const msgId = interaction.options.getString('message_id');
      const emoji = interaction.options.getString('emoji');
      const role  = interaction.options.getRole('role');

      // Vérifie que le message existe — cherche dans TOUS les salons text
      let message = null;
      let foundChannel = null;

      // 1. D'abord essayer le salon courant (rapide)
      try {
        message = await interaction.channel.messages.fetch(msgId);
        foundChannel = interaction.channel;
      } catch {}

      // 2. Sinon, scanner tous les salons text/announcement du serveur
      if (!message) {
        for (const [, ch] of interaction.guild.channels.cache) {
          if (ch.type !== 0 && ch.type !== 5) continue; // GuildText=0, GuildAnnouncement=5
          try {
            const m = await ch.messages.fetch(msgId);
            if (m) { message = m; foundChannel = ch; break; }
          } catch {}
        }
      }

      if (!message) {
        return interaction.editReply({ content: `❌ Message **${msgId}** introuvable dans ce serveur. Vérifie l'ID et que le message existe encore.` });
      }

      // Vérifier que le bot a les permissions sur le salon trouvé
      const me = interaction.guild.members.me;
      const botPerms = foundChannel.permissionsFor(me);
      if (!botPerms?.has('AddReactions') || !botPerms?.has('ReadMessageHistory')) {
        return interaction.editReply({
          content: `❌ Je n'ai pas la permission **Ajouter des réactions** ou **Voir l'historique** dans ${foundChannel}. Ajoute-moi ces permissions et relance.`
        });
      }

      // Extraire l'ID de l'emoji custom si applicable
      const emojiMatch = emoji.match(/<a?:\w+:(\d+)>/);
      const emojiKey   = emojiMatch ? emojiMatch[1] : emoji;

      // Vérifier que le bot a accès à l'emoji custom
      if (emojiMatch) {
        const customEmoji = interaction.client.emojis.cache.get(emojiKey);
        if (!customEmoji) {
          return interaction.editReply({
            content: `❌ Emoji custom **${emoji}** introuvable. Le bot doit être membre du serveur où l'emoji est créé. Utilise plutôt un emoji standard (ex: 🎮, 🎯, ✅).`
          });
        }
      }

      const existing = db.db.prepare('SELECT * FROM reaction_roles WHERE guild_id = ? AND message_id = ? AND emoji = ?')
        .get(interaction.guildId, msgId, emojiKey);
      if (existing) {
        return interaction.editReply({ content: `❌ Ce reaction role existe déjà sur le message **${msgId}**.` });
      }

      // ESSAYER d'ajouter la réaction (capture les vraies erreurs)
      let reactError = null;
      try {
        await message.react(emoji);
      } catch (e) {
        reactError = e?.message || String(e);
      }

      if (reactError) {
        return interaction.editReply({
          content: `❌ Impossible d'ajouter la réaction **${emoji}** sur le message :\n\`${reactError}\`\n\nVérifie : (1) que l'emoji est valide, (2) que le bot a les permissions dans ${foundChannel}.`
        });
      }

      // OK : enregistrer en BDD seulement si la réaction est bien ajoutée
      db.db.prepare('INSERT INTO reaction_roles (guild_id, message_id, emoji, role_id) VALUES (?, ?, ?, ?)')
        .run(interaction.guildId, msgId, emojiKey, role.id);

      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('✅ Reaction Role ajouté')
          .setDescription(`${emoji} → <@&${role.id}>\n📍 Salon : ${foundChannel}`)
          .setFooter({ text: `Message ID: ${msgId}` })
        ]
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

      if (!result.changes) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Reaction role introuvable.', ephemeral: true });

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder().setColor('#FFA500').setDescription(`✅ Reaction role **${emoji}** sur le message **${msgId}** supprimé.`)],
        ephemeral: true
      });
    }

    // ── LISTE ──
    if (sub === 'liste') {
      const rrs = db.db.prepare('SELECT * FROM reaction_roles WHERE guild_id = ? LIMIT 25').all(interaction.guildId);
      if (!rrs.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucun reaction role configuré.', ephemeral: true });

      const embed = new EmbedBuilder()
        .setColor(cfg.color || '#7B2FBE')
        .setTitle('🎭 Reaction Roles')
        .setDescription(rrs.map(r => `Message \`${r.message_id}\` → ${r.emoji} → <@&${r.role_id}>`).join('\n'));

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed], ephemeral: true });
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

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        content: `✅ Message de rôles créé ! Utilisez \`/reactionrole ajouter message_id:${msg.id} emoji:... role:...\` pour configurer les rôles.`,
        ephemeral: true
      });
    }
  }
};
