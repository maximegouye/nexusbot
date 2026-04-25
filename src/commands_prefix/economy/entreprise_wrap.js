'use strict';
const slashCmd = require('../../commands_guild/economy/entreprise.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'entreprise',
  aliases: [],
  description: 'Execute the entreprise command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};