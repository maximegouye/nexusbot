'use strict';
const slashCmd = require('../../commands/leveling/levelrole.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'levelrole',
  aliases: [],
  description: 'Execute the levelrole command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};