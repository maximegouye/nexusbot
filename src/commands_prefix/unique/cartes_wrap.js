'use strict';
const slashCmd = require('../../commands_guild/unique/cartes.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'cartes',
  aliases: [],
  description: 'Execute the cartes command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};