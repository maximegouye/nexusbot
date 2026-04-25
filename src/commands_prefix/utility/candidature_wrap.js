'use strict';
const slashCmd = require('../../commands_guild/utility/applications.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'candidature',
  aliases: [],
  description: 'Execute the candidature command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};