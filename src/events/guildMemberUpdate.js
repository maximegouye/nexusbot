const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember, client) {
    const { guild, user } = newMember;
    const cfg = db.getConfig(guild.id);

    // Détecte le début d'un boost Nitro
    const startedBoosting = !oldMember.premiumSince && newMember.premiumSince;
    const stoppedBoosting = oldMember.premiumSince && !newMember.premiumSince;

    if (startedBoosting) {
      try {
        // 1. Donne 25 000€ virtuels
        db.addCoins(user.id, guild.id, 25000);

        // 2. Donne le rôle boost configuré si défini
        if (cfg.boost_role) {
          const role = guild.roles.cache.get(cfg.boost_role);
          if (role) {
            await newMember.roles.add(role).catch(() => {});
          }
        }

        // 3. Envoie un message de remerciement dans le salon configuré
        const channelId = cfg.boost_announcement_channel || cfg.welcome_channel || cfg.general_channel;
        if (channelId) {
          const channel = guild.channels.cache.get(channelId);
          if (channel && channel.isTextBased()) {
            const boostEmbed = new EmbedBuilder()
              .setColor('#FF73FA') // Rose Nitro
              .setTitle('💎 Nouveau Booster !')
              .setDescription(
                `**${user.toString()}** vient de booster le serveur ! 🚀\n\n` +
                `Merci pour ton soutien, tu reçois **25 000€** virtuels !`
              )
              .setThumbnail(user.displayAvatarURL({ size: 256 }))
              .setFooter({ text: guild.name })
              .setTimestamp();

            await channel.send({ embeds: [boostEmbed] }).catch(() => {});
          }
        }

        // 4. DM au membre pour le remercier
        try {
          const dmEmbed = new EmbedBuilder()
            .setColor('#FF73FA')
            .setTitle('💎 Merci pour ton boost !')
            .setDescription(
              `Salut **${user.username}**,\n\n` +
              `Tu viens de booster **${guild.name}** ! 🎉\n\n` +
              `Nous te remercions infiniment pour ton soutien. Tu reçois **25 000€** virtuels en récompense.\n\n` +
              `Ton aide nous permet de continuer à améliorer le serveur. 💪`
            )
            .setThumbnail(guild.iconURL())
            .setFooter({ text: `${guild.name} · Merci !` })
            .setTimestamp();

          await user.send({ embeds: [dmEmbed] }).catch(() => {});
        } catch {}
      } catch (err) {
        console.error(`[GuildMemberUpdate] Erreur en gestion du boost pour ${user.id}:`, err);
      }
    }

    if (stoppedBoosting) {
      try {
        // Retire le rôle boost si configuré
        if (cfg.boost_role) {
          const role = guild.roles.cache.get(cfg.boost_role);
          if (role) {
            await newMember.roles.remove(role).catch(() => {});
          }
        }
      } catch (err) {
        console.error(`[GuildMemberUpdate] Erreur en retirant le rôle boost pour ${user.id}:`, err);
      }
    }
  }
};
