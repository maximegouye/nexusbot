'use strict';
const slashCmd = require('../../commands_guild/economy/coffre.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'coffre',
  aliases: [],
  description: 'Execute the coffre command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};