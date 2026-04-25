'use strict';
const slashCmd = require('../../commands/utility/convertisseur.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'convertir',
  aliases: [],
  description: 'Execute the convertir command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};