'use strict';
const slashCmd = require('../../commands/utility/autoresponder.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'autoresponder',
  aliases: [],
  description: 'Execute the autoresponder command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};