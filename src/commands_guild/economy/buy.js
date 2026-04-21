const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('buy')
    .setDescription('🛍️ Achète un article dans la boutique')
  cooldown: 5,

  async execute(interaction) {
    const cfg   = db.getConfig(interaction.guildId);
    const emoji = cfg.currency_emoji || '€';
    const name  = cfg.currency_name  || 'Euros';
    const id    = interaction.options.getInteger('id');
    const qty   = interaction.options.getInteger('quantite') || 1;

    const item = db.db.prepare('SELECT * FROM shop WHERE id = ? AND guild_id = ? AND active = 1').get(id, interaction.guildId);
    if (!item) {
      return interaction.reply({ content: `❌ Article **#${id}** introuvable dans la boutique.`, ephemeral: true });
    }

    const user  = db.getUser(interaction.user.id, interaction.guildId);
    const total = item.price * qty;

    if (user.balance < total) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#FF6B6B')
          .setDescription(`❌ Solde insuffisant ! Il te faut **${total.toLocaleString('fr-FR')} ${name}** mais tu n'as que **${user.balance.toLocaleString('fr-FR')}**.`)
        ], ephemeral: true
      });
    }

    // Vérifier les limites de quantité
    if (item.max_per_user) {
      const owned = db.db.prepare('SELECT SUM(quantity) as q FROM inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?')
        .get(interaction.user.id, interaction.guildId, item.id)?.q || 0;
      if (owned + qty > item.max_per_user) {
        return interaction.reply({ content: `❌ Tu ne peux pas posséder plus de **${item.max_per_user}** × "${item.name}".`, ephemeral: true });
      }
    }

    db.removeCoins(interaction.user.id, interaction.guildId, total);
    const expiresAt = item.duration_hours ? Math.floor(Date.now() / 1000) + item.duration_hours * 3600 : null;
    db.addItem(interaction.user.id, interaction.guildId, item.id, qty, expiresAt);

    // Donner le rôle Discord si défini
    if (item.role_id) {
      const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
      if (member) {
        const role = interaction.guild.roles.cache.get(item.role_id);
        if (role) await member.roles.add(role).catch(() => {});

        // Planifier la suppression si temporaire
        if (item.duration_hours && expiresAt) {
          db.db.prepare('INSERT INTO temp_roles (guild_id, user_id, role_id, expires_at) VALUES (?, ?, ?, ?)')
            .run(interaction.guildId, interaction.user.id, item.role_id, expiresAt);
        }
      }
    }

    const embed = new EmbedBuilder()
      .setColor('#2ECC71')
      .setTitle(`🛍️ Achat réussi !`)
      .setDescription(`Tu as acheté **${qty}x ${item.emoji || '📦'} ${item.name}** pour **${total.toLocaleString('fr-FR')} ${name}** ${emoji}`)
      .addFields(
        { name: '💰 Dépensé',        value: `**${total.toLocaleString('fr-FR')}** ${name}`,               inline: true },
        { name: `${emoji} Restant`,  value: `**${(user.balance - total).toLocaleString('fr-FR')}** ${name}`, inline: true },
        ...(item.role_id ? [{ name: '🎭 Rôle attribué', value: `<@&${item.role_id}>`, inline: true }] : []),
        ...(item.duration_hours ? [{ name: '⏱️ Durée', value: `${item.duration_hours}h`, inline: true }] : []),
      );

    await interaction.reply({ embeds: [embed] });
  }
};
