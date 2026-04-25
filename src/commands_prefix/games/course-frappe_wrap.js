'use strict';
const slashCmd = require('../../commands_guild/games/course_frappe.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'course-frappe',
  aliases: [],
  description: 'Execute the course-frappe command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};