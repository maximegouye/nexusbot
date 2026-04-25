'use strict';
const slashCmd = require('../../commands_guild/economy/leaderboard.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'classement',
  aliases: [],
  description: 'Execute the classement command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};