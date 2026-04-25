'use strict';
const slashCmd = require('../../commands/economy/crime.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'crime',
  aliases: [],
  description: 'Execute the crime command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};