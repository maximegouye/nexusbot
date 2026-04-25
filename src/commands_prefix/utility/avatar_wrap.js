'use strict';
const slashCmd = require('../../commands/utility/avatar.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'avatar',
  aliases: [],
  description: 'Execute the avatar command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};