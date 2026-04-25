'use strict';
const slashCmd = require('../../commands_guild/social/mariage.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'mariage',
  aliases: [],
  description: 'Execute the mariage command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};