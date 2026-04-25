'use strict';
const slashCmd = require('../../commands_guild/economy/marche_noir.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'marchenoir',
  aliases: [],
  description: 'Execute the marchenoir command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};