'use strict';
const slashCmd = require('../../commands/utility/logs.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'logs',
  aliases: [],
  description: 'Execute the logs command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};