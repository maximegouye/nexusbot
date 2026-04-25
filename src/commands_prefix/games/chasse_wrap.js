'use strict';
const slashCmd = require('../../commands_guild/games/chasse.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'chasse',
  aliases: [],
  description: 'Execute the chasse command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};