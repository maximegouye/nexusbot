'use strict';
const slashCmd = require('../../commands/utility/color.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'color',
  aliases: [],
  description: 'Execute the color command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};