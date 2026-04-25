'use strict';
const slashCmd = require('../../commands_guild/unique/countdown.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'countdown',
  aliases: [],
  description: 'Execute the countdown command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};