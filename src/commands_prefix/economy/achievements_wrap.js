'use strict';
const slashCmd = require('../../commands_guild/economy/achievements.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'achievements',
  aliases: [],
  description: 'Execute the achievements command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};