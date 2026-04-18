/**
 * NexusBot — &config / &panel
 * Lance le panneau de configuration interactif
 */
const { buildMainMenu } = require('../../utils/configPanel');

module.exports = {
  name: 'config',
  aliases: ['cfg', 'panel', 'parametres', 'settings'],
  description: 'Ouvrir le panneau de configuration interactif',
  category: 'Utilitaire',
  cooldown: 5,
  permissions: '8', // ManageGuild

  async execute(message, args, client, db) {
    if (!message.member.permissions.has(8n)) {
      return message.reply('❌ Tu dois avoir la permission **Gérer le serveur** pour accéder à la configuration.');
    }

    const cfg   = db.getConfig(message.guild.id);
    const panel = buildMainMenu(cfg, message.guild, message.author.id);

    // Envoyer en éphémère si possible, sinon en réponse normale
    return message.reply(panel);
  }
};
