'use strict';
const slashCmd = require('../../commands_guild/economy/ferme.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'ferme',
  aliases: [],
  description: 'Execute the ferme command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};