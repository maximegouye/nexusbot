'use strict';
const slashCmd = require('../../commands_guild/games/donjon.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'donjon',
  aliases: [],
  description: 'Execute the donjon command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};