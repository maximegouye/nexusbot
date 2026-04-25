'use strict';
const slashCmd = require('../../commands_guild/economy/investissement_immobilier.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'immo',
  aliases: [],
  description: 'Execute the immo command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};