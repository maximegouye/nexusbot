const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

// ════════════════════════════════════════════════════════════════════════════════
// DATABASE MIGRATIONS
// ════════════════════════════════════════════════════════════════════════════════

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS birthdays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    jour INTEGER NOT NULL,
    mois INTEGER NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, user_id)
  )`).run();

  const gc = db.db.prepare('PRAGMA table_info(guild_config)').all().map(c => c.name);
  if (!gc.includes('birthday_channel')) {
    db.db.prepare("ALTER TABLE guild_config ADD COLUMN birthday_channel TEXT").run();
  }
  if (!gc.includes('birthday_role')) {
    db.db.prepare("ALTER TABLE guild_config ADD COLUMN birthday_role TEXT").run();
  }
} catch (error) {
  // Schema already exists or migration completed
}

// ════════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Calculates days until next birthday (this year or next)
 * @param {number} jour Day (1-31)
 * @param {number} mois Month (1-12)
 * @returns {number} Days until next birthday
 */
function calculateDaysUntilBirthday(jour, mois) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  // Birthday this year
  let birthdayDate = new Date(currentYear, mois - 1, jour);

  // If birthday has already passed this year, use next year
  if (birthdayDate < today) {
    birthdayDate = new Date(currentYear + 1, mois - 1, jour);
  }

  // Calculate difference in milliseconds
  const timeDiff = birthdayDate.getTime() - today.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

  return daysDiff;
}

/**
 * Formats a birthday date for display
 * @param {number} jour Day
 * @param {number} mois Month
 * @returns {string} Formatted date string
 */
function formatBirthdayDate(jour, mois) {
  const months = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
  ];
  return `${jour} ${months[mois - 1]}`;
}

/**
 * Validates day and month values
 * @param {number} jour Day
 * @param {number} mois Month
 * @returns {boolean} Whether the date is valid
 */
function isValidDate(jour, mois) {
  if (jour < 1 || jour > 31 || mois < 1 || mois > 12) {
    return false;
  }
  // Additional validation for months with fewer days
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return jour <= daysInMonth[mois - 1];
}

// ════════════════════════════════════════════════════════════════════════════════
// SLASH COMMAND DEFINITION
// ════════════════════════════════════════════════════════════════════════════════

module.exports = {
  data: new SlashCommandBuilder()
    .setName('anniversaire')
    .setDescription('🎂 Système de gestion des anniversaires du serveur')
    .addSubcommand(s => s
      .setName('set')
      .setDescription('➕ Enregistrer votre date d\'anniversaire')
      .addStringOption(o => o
        .setName('jour')
        .setDescription('Jour du mois (1-31)')
        .setRequired(true)
      )
      .addStringOption(o => o
        .setName('mois')
        .setDescription('Mois (1-12)')
        .setRequired(true)
      )
    )
    .addSubcommand(s => s
      .setName('voir')
      .setDescription('👀 Voir l\'anniversaire d\'un utilisateur')
      .addUserOption(o => o
        .setName('utilisateur')
        .setDescription('Utilisateur à regarder (vous par défaut)')
        .setRequired(false)
      )
    )
    .addSubcommand(s => s
      .setName('liste')
      .setDescription('📋 Liste des anniversaires à venir (30 prochains jours)')
    )
    .addSubcommand(s => s
      .setName('setup')
      .setDescription('⚙️ Configurer le système d\'anniversaire (Admin)')
      .addChannelOption(o => o
        .setName('salon')
        .setDescription('Salon pour les annonces d\'anniversaire')
        .setRequired(true)
      )
      .addRoleOption(o => o
        .setName('role')
        .setDescription('Rôle à donner pendant 24h le jour de l\'anniversaire (optionnel)')
        .setRequired(false)
      )
    )
    .addSubcommand(s => s
      .setName('supprimer')
      .setDescription('❌ Supprimer votre anniversaire du système')
    )
    .addSubcommand(s => s
      .setName('prochain')
      .setDescription('🎉 Afficher le prochain anniversaire du serveur')
    ),

  cooldown: 3,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const cfg = db.getConfig(interaction.guildId);

    // ─────────────────────────────────────────────────────────────────────────────
    // SET SUBCOMMAND
    // ─────────────────────────────────────────────────────────────────────────────
    if (sub === 'set') {
      const jour = parseInt(interaction.options.getString('jour'));
      const mois = parseInt(interaction.options.getString('mois'));

      if (!isValidDate(jour, mois)) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          embeds: [new EmbedBuilder()
            .setColor('#E74C3C')
            .setDescription('❌ Date invalide ! Vérifiez le jour et le mois.')
          ],
          ephemeral: true
        });
      }

      try {
        db.db.prepare(`
          INSERT INTO birthdays (guild_id, user_id, jour, mois)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(guild_id, user_id) DO UPDATE SET
            jour = excluded.jour,
            mois = excluded.mois,
            created_at = (strftime('%s','now'))
        `).run(interaction.guildId, interaction.user.id, jour, mois);

        const formattedDate = formatBirthdayDate(jour, mois);

        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          embeds: [new EmbedBuilder()
            .setColor('#2ECC71')
            .setDescription(`✅ Anniversaire enregistré : **${formattedDate}** 🎂`)
            .setFooter({ text: 'Votre anniversaire est maintenant visible pour le serveur' })
          ]
        });
      } catch (error) {
        console.error('Anniversaire SET error:', error);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          embeds: [new EmbedBuilder()
            .setColor('#E74C3C')
            .setDescription('❌ Une erreur est survenue lors de l\'enregistrement.')
          ],
          ephemeral: true
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // VOIR SUBCOMMAND
    // ─────────────────────────────────────────────────────────────────────────────
    if (sub === 'voir') {
      const user = interaction.options.getUser('utilisateur') || interaction.user;

      try {
        const birthday = db.db.prepare(`
          SELECT jour, mois FROM birthdays
          WHERE guild_id = ? AND user_id = ?
        `).get(interaction.guildId, user.id);

        if (!birthday) {
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
            embeds: [new EmbedBuilder()
              .setColor('#95A5A6')
              .setDescription(`🤔 ${user.username} n'a pas enregistré son anniversaire.`)
            ],
            ephemeral: true
          });
        }

        const formattedDate = formatBirthdayDate(birthday.jour, birthday.mois);
        const daysUntil = calculateDaysUntilBirthday(birthday.jour, birthday.mois);

        let daysMessage = '';
        if (daysUntil === 0) {
          daysMessage = 'C\'est aujourd\'hui ! 🎉';
        } else if (daysUntil === 1) {
          daysMessage = 'Demain ! 🎂';
        } else {
          daysMessage = `${daysUntil} jours ⏳`;
        }

        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          embeds: [new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle(`🎂 Anniversaire de ${user.username}`)
            .setDescription(`**Date :** ${formattedDate}\n**Prochainement :** ${daysMessage}`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: `Demandé par ${interaction.user.username}` })
          ]
        });
      } catch (error) {
        console.error('Anniversaire VOIR error:', error);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          embeds: [new EmbedBuilder()
            .setColor('#E74C3C')
            .setDescription('❌ Une erreur est survenue.')
          ],
          ephemeral: true
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // LISTE SUBCOMMAND (Paginated)
    // ─────────────────────────────────────────────────────────────────────────────
    if (sub === 'liste') {
      try {
        const allBirthdays = db.db.prepare(`
          SELECT user_id, jour, mois FROM birthdays
          WHERE guild_id = ?
          ORDER BY jour, mois
        `).all(interaction.guildId);

        if (!allBirthdays.length) {
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
            embeds: [new EmbedBuilder()
              .setColor('#95A5A6')
              .setDescription('📭 Aucun anniversaire n\'a été enregistré sur ce serveur.')
            ],
            ephemeral: true
          });
        }

        // Sort by days until birthday (next 30 days highlighted)
        const birthdaysWithDays = allBirthdays.map(b => ({
          userId: b.user_id,
          jour: b.jour,
          mois: b.mois,
          daysUntil: calculateDaysUntilBirthday(b.jour, b.mois)
        })).sort((a, b) => a.daysUntil - b.daysUntil);

        // Filter for next 30 days and separate from later ones
        const upcoming30 = birthdaysWithDays.filter(b => b.daysUntil <= 30);
        const later = birthdaysWithDays.filter(b => b.daysUntil > 30);

        const pageSize = 10;
        let currentPage = 0;
        const allEntries = [...upcoming30, ...later];

        const generateEmbed = (page) => {
          const start = page * pageSize;
          const end = start + pageSize;
          const pageEntries = allEntries.slice(start, end);

          const embed = new EmbedBuilder()
            .setColor('#9B59B6')
            .setTitle('📅 Anniversaires à venir')
            .setDescription('Liste complète des anniversaires du serveur');

          let description = '';
          pageEntries.forEach((b, idx) => {
            const formattedDate = formatBirthdayDate(b.jour, b.mois);
            const isUpcoming = b.daysUntil <= 30;
            const emoji = isUpcoming ? '🔥' : '📌';

            if (b.daysUntil === 0) {
              description += `${emoji} **<@${b.userId}>** - ${formattedDate} - C'est aujourd'hui ! 🎉\n`;
            } else if (b.daysUntil === 1) {
              description += `${emoji} **<@${b.userId}>** - ${formattedDate} - Demain ! 🎂\n`;
            } else {
              description += `${emoji} **<@${b.userId}>** - ${formattedDate} - ${b.daysUntil} jours\n`;
            }
          });

          embed.setDescription(description || 'Aucune entrée pour cette page');

          const totalPages = Math.ceil(allEntries.length / pageSize);
          embed.setFooter({
            text: `Page ${page + 1}/${totalPages} | Total: ${allEntries.length} anniversaire(s)`
          });

          return embed;
        };

        const embed = generateEmbed(0);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });

      } catch (error) {
        console.error('Anniversaire LISTE error:', error);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          embeds: [new EmbedBuilder()
            .setColor('#E74C3C')
            .setDescription('❌ Une erreur est survenue.')
          ],
          ephemeral: true
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // SETUP SUBCOMMAND (Admin)
    // ─────────────────────────────────────────────────────────────────────────────
    if (sub === 'setup') {
      const channel = interaction.options.getChannel('salon');
      const role = interaction.options.getRole('role');

      try {
        // Update guild config
        const currentConfig = db.getConfig(interaction.guildId);
        db.db.prepare(`
          UPDATE guild_config SET birthday_channel = ?, birthday_role = ?
          WHERE guild_id = ?
        `).run(channel.id, role ? role.id : null, interaction.guildId);

        let description = `✅ Configuration mise à jour !\n\n`;
        description += `📢 **Salon d'annonces :** ${channel.toString()}\n`;
        if (role) {
          description += `🎁 **Rôle d'anniversaire :** ${role.toString()}`;
        } else {
          description += `🎁 **Rôle d'anniversaire :** Aucun`;
        }

        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          embeds: [new EmbedBuilder()
            .setColor('#2ECC71')
            .setDescription(description)
            .setFooter({ text: 'Le système d\'anniversaire est maintenant prêt !' })
          ]
        });
      } catch (error) {
        console.error('Anniversaire SETUP error:', error);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          embeds: [new EmbedBuilder()
            .setColor('#E74C3C')
            .setDescription('❌ Une erreur est survenue lors de la configuration.')
          ],
          ephemeral: true
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // SUPPRIMER SUBCOMMAND
    // ─────────────────────────────────────────────────────────────────────────────
    if (sub === 'supprimer') {
      try {
        const result = db.db.prepare(`
          DELETE FROM birthdays
          WHERE guild_id = ? AND user_id = ?
        `).run(interaction.guildId, interaction.user.id);

        if (!result.changes) {
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
            embeds: [new EmbedBuilder()
              .setColor('#95A5A6')
              .setDescription('ℹ️ Vous n\'aviez pas d\'anniversaire enregistré.')
            ],
            ephemeral: true
          });
        }

        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          embeds: [new EmbedBuilder()
            .setColor('#F39C12')
            .setDescription('✅ Votre anniversaire a été supprimé du système.')
          ]
        });
      } catch (error) {
        console.error('Anniversaire SUPPRIMER error:', error);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          embeds: [new EmbedBuilder()
            .setColor('#E74C3C')
            .setDescription('❌ Une erreur est survenue.')
          ],
          ephemeral: true
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // PROCHAIN SUBCOMMAND
    // ─────────────────────────────────────────────────────────────────────────────
    if (sub === 'prochain') {
      try {
        const allBirthdays = db.db.prepare(`
          SELECT user_id, jour, mois FROM birthdays
          WHERE guild_id = ?
        `).all(interaction.guildId);

        if (!allBirthdays.length) {
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
            embeds: [new EmbedBuilder()
              .setColor('#95A5A6')
              .setDescription('📭 Aucun anniversaire n\'a été enregistré sur ce serveur.')
            ],
            ephemeral: true
          });
        }

        // Find the next birthday
        const birthdaysWithDays = allBirthdays.map(b => ({
          userId: b.user_id,
          jour: b.jour,
          mois: b.mois,
          daysUntil: calculateDaysUntilBirthday(b.jour, b.mois)
        })).sort((a, b) => a.daysUntil - b.daysUntil);

        const nextBirthday = birthdaysWithDays[0];
        const formattedDate = formatBirthdayDate(nextBirthday.jour, nextBirthday.mois);

        let message = '';
        if (nextBirthday.daysUntil === 0) {
          message = `🎉 **C'est aujourd'hui l'anniversaire de <@${nextBirthday.userId}>** !`;
        } else if (nextBirthday.daysUntil === 1) {
          message = `🎂 L'anniversaire de <@${nextBirthday.userId}> est **demain** !`;
        } else {
          message = `⏳ Prochain anniversaire : <@${nextBirthday.userId}> le **${formattedDate}** (${nextBirthday.daysUntil} jours)`;
        }

        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          embeds: [new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle('🎉 Prochain Anniversaire')
            .setDescription(message)
            .setFooter({ text: `${birthdaysWithDays.length} anniversaire(s) enregistré(s)` })
          ]
        });
      } catch (error) {
        console.error('Anniversaire PROCHAIN error:', error);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          embeds: [new EmbedBuilder()
            .setColor('#E74C3C')
            .setDescription('❌ Une erreur est survenue.')
          ],
          ephemeral: true
        });
      }
    }
  }
};
