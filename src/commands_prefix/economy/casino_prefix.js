/**
 * &casino — Menu unifié du casino.
 */
const { _build } = require('../../commands/economy/casino');

module.exports = {
  name: 'casino',
  aliases: ['games', 'jeux'],
  description: 'Menu unifié du casino — tous les jeux + stats',
  category: 'Jeux',
  cooldown: 3,

  async execute(message, args, client, db) {
    const cfg = db.getConfig(message.guild.id);
    const fakeInteraction = {
      guild: message.guild,
      guildId: message.guild.id,
      user: message.author,
      client,
    };
    return message.reply({
      embeds: [_build.buildMainEmbed(fakeInteraction, cfg)],
      components: _build.buildButtons(message.author.id),
      allowedMentions: { repliedUser: false },
    });
  },
};
