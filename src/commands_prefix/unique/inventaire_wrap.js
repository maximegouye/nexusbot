'use strict';
const slashCmd = require('../../commands_guild/unique/inventaire.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'inventaire',
  aliases: [],
  description: 'Execute the inventaire command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};