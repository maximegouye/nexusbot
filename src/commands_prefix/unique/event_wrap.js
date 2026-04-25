'use strict';
const slashCmd = require('../../commands_guild/unique/events_manager.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'event',
  aliases: [],
  description: 'Execute the event command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};