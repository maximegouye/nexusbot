'use strict';
const slashCmd = require('../../commands_guild/utility/antiraid.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'antiraid',
  aliases: [],
  description: 'Execute the antiraid command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};