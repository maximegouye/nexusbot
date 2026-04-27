/**
 * &profil [@membre] — Même qualité que /profil slash.
 */
const { _build } = require('../../commands/social/profil');

module.exports = {
  name: 'profil',
  aliases: ['profile', 'me', 'p'],
  description: 'Carte profil premium',
  category: 'Social',
  cooldown: 3,

  async run(message, args, client, db) {
    const target = message.mentions.users.first() || message.author;
    const member = message.guild.members.cache.get(target.id) || await message.guild.members.fetch(target.id).catch(() => null);
    const cfg = db.getConfig(message.guild.id);
    const user = db.getUser(target.id, message.guild.id);

    return message.reply({
      embeds: [_build.buildMainEmbed(target, member, user, cfg, message.guild)],
      components: _build.buildButtons(message.author.id, target.id),
      allowedMentions: { repliedUser: false },
    });
  },
};
