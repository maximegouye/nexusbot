/**
 * &banque — Version préfixe, même UI que /banque.
 */
const { _build } = require('../../commands/economy/banque');

module.exports = {
  name: 'banque',
  aliases: ['bank', 'money'],
  description: 'Banque avec boutons dépôt/retrait · mise illimitée',
  category: 'Économie',
  cooldown: 3,

  async execute(message, args, client, db) {
    const cfg  = db.getConfig(message.guild.id);
    const user = db.getUser(message.author.id, message.guild.id);
    return message.reply({
      embeds: [_build.buildEmbed(user, cfg)],
      components: _build.buildButtons(message.author.id),
      allowedMentions: { repliedUser: false },
    });
  },
};
