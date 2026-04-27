/**
 * &aide / &help — Identique au slash.
 */
const { _build } = require('../../commands/utility/help');

module.exports = {
  name: 'aide',
  aliases: ['help', 'h', 'commandes'],
  description: 'Aide interactive',
  category: 'Utilitaire',
  cooldown: 3,

  async run(message, args, client, db) {
    const cfg = db.getConfig(message.guild.id);
    const color = cfg.color || '#7B2FBE';
    const fakeInteraction = {
      guild: message.guild,
      client,
      user: message.author,
    };
    await message.reply({
      embeds: [_build.buildHomeEmbed(fakeInteraction, color)],
      components: _build.buildComponents(message.author.id, 'accueil'),
      allowedMentions: { repliedUser: false },
    });
  },
};
