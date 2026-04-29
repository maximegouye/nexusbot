const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS app_forms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, name TEXT,
    questions TEXT DEFAULT '[]',
    channel_id TEXT,
    log_channel TEXT,
    role_id TEXT,
    status TEXT DEFAULT 'open',
    UNIQUE(guild_id, name)
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS app_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, form_name TEXT,
    user_id TEXT, answers TEXT,
    status TEXT DEFAULT 'pending',
    reviewer_id TEXT,
    submitted_at INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('candidature')
    .setDescription('📋 Système de candidatures / formulaires de staff')
    .addSubcommand(s => s.setName('creer').setDescription('➕ Créer un formulaire (Admin)')
      .addStringOption(o => o.setName('nom').setDescription('Nom du formulaire (ex: staff, modérateur)').setRequired(true).setMaxLength(50))
      .addChannelOption(o => o.setName('salon').setDescription('Salon où les gens posent leur candidature').setRequired(true))
      .addChannelOption(o => o.setName('logs').setDescription('Salon où arrivent les candidatures (staff)').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Rôle donné si accepté')))
    .addSubcommand(s => s.setName('question').setDescription('❓ Ajouter/voir les questions d\'un formulaire (Admin)')
      .addStringOption(o => o.setName('formulaire').setDescription('Nom du formulaire').setRequired(true))
      .addStringOption(o => o.setName('texte').setDescription('Question à ajouter (vide = voir les questions)')))
    .addSubcommand(s => s.setName('supprimer_question').setDescription('🗑️ Supprimer une question (Admin)')
      .addStringOption(o => o.setName('formulaire').setDescription('Nom du formulaire').setRequired(true))
      .addIntegerOption(o => o.setName('numero').setDescription('Numéro de la question à supprimer').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('postuler').setDescription('📝 Postuler pour un rôle')
      .addStringOption(o => o.setName('formulaire').setDescription('Nom du formulaire').setRequired(true)))
    .addSubcommand(s => s.setName('liste').setDescription('📋 Voir les formulaires disponibles'))
    .addSubcommand(s => s.setName('voir').setDescription('🔍 Voir vos candidatures'))
    .addSubcommand(s => s.setName('fermer').setDescription('🔒 Ouvrir/fermer un formulaire (Admin)')
      .addStringOption(o => o.setName('formulaire').setDescription('Nom du formulaire').setRequired(true))),

  // Indique au routeur global de NE PAS auto-deferReply pour 'postuler' (ouvre un modal)
  opensModal: (interaction) => {
    try { return interaction.options.getSubcommand(false) === 'postuler'; } catch { return false; }
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    // 'postuler' ouvre un modal → pas de deferReply
    if (sub !== 'postuler' && !interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const isAdmin = interaction.member.permissions.has(0x20n);

    if (sub === 'creer') {
      if (!isAdmin) {
        if (interaction.deferred || interaction.replied) {
          return interaction.editReply({ content: '❌ Admin uniquement.', ephemeral: true });
        } else {
          return interaction.reply({ content: '❌ Admin uniquement.', ephemeral: true });
        }
      }
      const nom = interaction.options.getString('nom').toLowerCase().replace(/\s+/g, '-');
      const salon = interaction.options.getChannel('salon');
      const logs = interaction.options.getChannel('logs');
      const role = interaction.options.getRole('role');

      try {
        db.db.prepare('INSERT INTO app_forms (guild_id, name, channel_id, log_channel, role_id) VALUES (?,?,?,?,?)')
          .run(guildId, nom, salon.id, logs.id, role?.id || null);
      } catch {
        if (interaction.deferred || interaction.replied) {
          return interaction.editReply({ content: '❌ Un formulaire avec ce nom existe déjà.', ephemeral: true });
        } else {
          return interaction.reply({ content: '❌ Un formulaire avec ce nom existe déjà.', ephemeral: true });
        }
      }

      // Envoyer le panneau dans le salon
      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle(`📋 Candidature : ${nom}`)
        .setDescription(`Cliquez sur le bouton ci-dessous pour postuler.\n\nAssurez-vous de lire les conditions et de remplir le formulaire honnêtement.`)
        .setFooter({ text: interaction.guild.name });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`apply_${nom}`).setLabel('📝 Postuler').setStyle(ButtonStyle.Primary)
      );

      await salon.send({ embeds: [embed], components: [row] }).catch(() => {});

      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({ embeds: [
          new EmbedBuilder().setColor('#2ECC71').setTitle('✅ Formulaire créé !')
            .addFields(
              { name: '📋 Nom', value: nom, inline: true },
              { name: '📌 Salon', value: `${salon}`, inline: true },
              { name: '📋 Logs', value: `${logs}`, inline: true },
              { name: '🎭 Rôle si accepté', value: role ? `${role}` : 'Aucun', inline: true },
            )
            .setDescription('Ajoutez des questions avec `/candidature question`.')
        ], ephemeral: true });
      } else {
        return interaction.reply({ embeds: [
          new EmbedBuilder().setColor('#2ECC71').setTitle('✅ Formulaire créé !')
            .addFields(
              { name: '📋 Nom', value: nom, inline: true },
              { name: '📌 Salon', value: `${salon}`, inline: true },
              { name: '📋 Logs', value: `${logs}`, inline: true },
              { name: '🎭 Rôle si accepté', value: role ? `${role}` : 'Aucun', inline: true },
            )
            .setDescription('Ajoutez des questions avec `/candidature question`.')
        ], ephemeral: true });
      }
    }

    if (sub === 'question') {
      if (!isAdmin) {
        if (interaction.deferred || interaction.replied) {
          return interaction.editReply({ content: '❌ Admin uniquement.', ephemeral: true });
        } else {
          return interaction.reply({ content: '❌ Admin uniquement.', ephemeral: true });
        }
      }
      const nom = interaction.options.getString('formulaire').toLowerCase();
      const texte = interaction.options.getString('texte');
      const form = db.db.prepare('SELECT * FROM app_forms WHERE guild_id=? AND name=?').get(guildId, nom);
      if (!form) {
        if (interaction.deferred || interaction.replied) {
          return interaction.editReply({ content: `❌ Formulaire \`${nom}\` introuvable.`, ephemeral: true });
        } else {
          return interaction.reply({ content: `❌ Formulaire \`${nom}\` introuvable.`, ephemeral: true });
        }
      }

      const questions = JSON.parse(form.questions || '[]');

      if (!texte) {
        const desc = questions.length
          ? questions.map((q, i) => `**${i+1}.** ${q}`).join('\n')
          : '*Aucune question pour l\'instant.*';
        if (interaction.deferred || interaction.replied) {
          return interaction.editReply({ embeds: [
            new EmbedBuilder().setColor('#7B2FBE').setTitle(`❓ Questions — ${nom}`)
              .setDescription(desc)
              .setFooter({ text: `${questions.length}/5 questions` })
          ], ephemeral: true });
        } else {
          return interaction.reply({ embeds: [
            new EmbedBuilder().setColor('#7B2FBE').setTitle(`❓ Questions — ${nom}`)
              .setDescription(desc)
              .setFooter({ text: `${questions.length}/5 questions` })
          ], ephemeral: true });
        }
      }

      if (questions.length >= 5) {
        if (interaction.deferred || interaction.replied) {
          return interaction.editReply({ content: '❌ Maximum 5 questions par formulaire.', ephemeral: true });
        } else {
          return interaction.reply({ content: '❌ Maximum 5 questions par formulaire.', ephemeral: true });
        }
      }
      questions.push(texte);
      db.db.prepare('UPDATE app_forms SET questions=? WHERE guild_id=? AND name=?').run(JSON.stringify(questions), guildId, nom);
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({ content: `✅ Question **${questions.length}** ajoutée : *${texte}*`, ephemeral: true });
      } else {
        return interaction.reply({ content: `✅ Question **${questions.length}** ajoutée : *${texte}*`, ephemeral: true });
      }
    }

    if (sub === 'supprimer_question') {
      if (!isAdmin) {
        if (interaction.deferred || interaction.replied) {
          return interaction.editReply({ content: '❌ Admin uniquement.', ephemeral: true });
        } else {
          return interaction.reply({ content: '❌ Admin uniquement.', ephemeral: true });
        }
      }
      const nom = interaction.options.getString('formulaire').toLowerCase();
      const num = interaction.options.getInteger('numero') - 1;
      const form = db.db.prepare('SELECT * FROM app_forms WHERE guild_id=? AND name=?').get(guildId, nom);
      if (!form) {
        if (interaction.deferred || interaction.replied) {
          return interaction.editReply({ content: '❌ Formulaire introuvable.', ephemeral: true });
        } else {
          return interaction.reply({ content: '❌ Formulaire introuvable.', ephemeral: true });
        }
      }

      const questions = JSON.parse(form.questions || '[]');
      if (num < 0 || num >= questions.length) {
        if (interaction.deferred || interaction.replied) {
          return interaction.editReply({ content: '❌ Numéro invalide.', ephemeral: true });
        } else {
          return interaction.reply({ content: '❌ Numéro invalide.', ephemeral: true });
        }
      }
      questions.splice(num, 1);
      db.db.prepare('UPDATE app_forms SET questions=? WHERE guild_id=? AND name=?').run(JSON.stringify(questions), guildId, nom);
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({ content: `✅ Question supprimée. (${questions.length} restantes)`, ephemeral: true });
      } else {
        return interaction.reply({ content: `✅ Question supprimée. (${questions.length} restantes)`, ephemeral: true });
      }
    }

    if (sub === 'postuler') {
      const nom = interaction.options.getString('formulaire').toLowerCase();
      return handleApplication(interaction, guildId, userId, nom);
    }

    if (sub === 'liste') {
      const forms = db.db.prepare('SELECT * FROM app_forms WHERE guild_id=?').all(guildId);
      if (!forms.length) {
        if (interaction.deferred || interaction.replied) {
          return interaction.editReply({ content: '❌ Aucun formulaire sur ce serveur.', ephemeral: true });
        } else {
          return interaction.reply({ content: '❌ Aucun formulaire sur ce serveur.', ephemeral: true });
        }
      }

      const desc = forms.map(f => {
        const qs = JSON.parse(f.questions || '[]').length;
        return `**${f.name}** — ${f.status === 'open' ? '🟢 Ouvert' : '🔴 Fermé'} • ${qs} question(s)`;
      }).join('\n');

      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({ embeds: [
          new EmbedBuilder().setColor('#7B2FBE').setTitle('📋 Formulaires disponibles').setDescription(desc)
        ], ephemeral: true });
      } else {
        return interaction.reply({ embeds: [
          new EmbedBuilder().setColor('#7B2FBE').setTitle('📋 Formulaires disponibles').setDescription(desc)
        ], ephemeral: true });
      }
    }

    if (sub === 'voir') {
      const subs = db.db.prepare('SELECT * FROM app_submissions WHERE guild_id=? AND user_id=? ORDER BY submitted_at DESC LIMIT 10').all(guildId, userId);
      if (!subs.length) {
        if (interaction.deferred || interaction.replied) {
          return interaction.editReply({ content: '❌ Vous n\'avez aucune candidature.', ephemeral: true });
        } else {
          return interaction.reply({ content: '❌ Vous n\'avez aucune candidature.', ephemeral: true });
        }
      }

      const desc = subs.map(s => {
        const emoji = s.status === 'accepted' ? '✅' : s.status === 'rejected' ? '❌' : '⏳';
        const date = `<t:${s.submitted_at}:R>`;
        return `${emoji} **${s.form_name}** — ${s.status} • ${date}`;
      }).join('\n');

      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({ embeds: [
          new EmbedBuilder().setColor('#7B2FBE').setTitle('📋 Mes candidatures').setDescription(desc)
        ], ephemeral: true });
      } else {
        return interaction.reply({ embeds: [
          new EmbedBuilder().setColor('#7B2FBE').setTitle('📋 Mes candidatures').setDescription(desc)
        ], ephemeral: true });
      }
    }

    if (sub === 'fermer') {
      if (!isAdmin) {
        if (interaction.deferred || interaction.replied) {
          return interaction.editReply({ content: '❌ Admin uniquement.', ephemeral: true });
        } else {
          return interaction.reply({ content: '❌ Admin uniquement.', ephemeral: true });
        }
      }
      const nom = interaction.options.getString('formulaire').toLowerCase();
      const form = db.db.prepare('SELECT * FROM app_forms WHERE guild_id=? AND name=?').get(guildId, nom);
      if (!form) {
        if (interaction.deferred || interaction.replied) {
          return interaction.editReply({ content: '❌ Formulaire introuvable.', ephemeral: true });
        } else {
          return interaction.reply({ content: '❌ Formulaire introuvable.', ephemeral: true });
        }
      }

      const newStatus = form.status === 'open' ? 'closed' : 'open';
      db.db.prepare('UPDATE app_forms SET status=? WHERE guild_id=? AND name=?').run(newStatus, guildId, nom);
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({ content: `✅ Formulaire **${nom}** : ${newStatus === 'open' ? '🟢 Ouvert' : '🔴 Fermé'}.`, ephemeral: true });
      } else {
        return interaction.reply({ content: `✅ Formulaire **${nom}** : ${newStatus === 'open' ? '🟢 Ouvert' : '🔴 Fermé'}.`, ephemeral: true });
      }
    }
  }
};

async function handleApplication(interaction, guildId, userId, nom) {
  const db = require('../../database/db');
  const form = db.db.prepare('SELECT * FROM app_forms WHERE guild_id=? AND name=?').get(guildId, nom);
  if (!form) {
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ content: `❌ Formulaire \`${nom}\` introuvable.`, ephemeral: true });
    } else {
      return interaction.reply({ content: `❌ Formulaire \`${nom}\` introuvable.`, ephemeral: true });
    }
  }
  if (form.status === 'closed') {
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ content: '❌ Ce formulaire est actuellement fermé.', ephemeral: true });
    } else {
      return interaction.reply({ content: '❌ Ce formulaire est actuellement fermé.', ephemeral: true });
    }
  }

  const questions = JSON.parse(form.questions || '[]');
  if (!questions.length) {
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ content: '❌ Ce formulaire n\'a pas encore de questions.', ephemeral: true });
    } else {
      return interaction.reply({ content: '❌ Ce formulaire n\'a pas encore de questions.', ephemeral: true });
    }
  }

  // Vérifier si déjà une candidature en attente
  const existing = db.db.prepare("SELECT * FROM app_submissions WHERE guild_id=? AND form_name=? AND user_id=? AND status='pending'").get(guildId, nom, userId);
  if (existing) {
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ content: '❌ Vous avez déjà une candidature en attente pour ce formulaire.', ephemeral: true });
    } else {
      return interaction.reply({ content: '❌ Vous avez déjà une candidature en attente pour ce formulaire.', ephemeral: true });
    }
  }

  // Créer un modal avec jusqu'à 5 questions
  const modal = new ModalBuilder().setCustomId(`appmodal_${nom}`).setTitle(`Candidature : ${nom}`);
  const rows = questions.slice(0, 5).map((q, i) =>
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId(`q${i}`)
        .setLabel(q.slice(0, 45))
        .setStyle(i === 0 ? TextInputStyle.Short : TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000)
    )
  );
  modal.addComponents(...rows);

  await interaction.showModal(modal);

  // Collecter la réponse du modal
  try {
    const modalSubmit = await interaction.awaitModalSubmit({ filter: i => i.user.id === userId && i.customId === `appmodal_${nom}`, time: 300000 });

    const answers = questions.slice(0, 5).map((q, i) => ({
      question: q,
      answer: modalSubmit.fields.getTextInputValue(`q${i}`) || ''
    }));

    db.db.prepare('INSERT INTO app_submissions (guild_id, form_name, user_id, answers) VALUES (?,?,?,?)')
      .run(guildId, nom, userId, JSON.stringify(answers));

    const submission = db.db.prepare('SELECT last_insert_rowid() as id').get();

    // Envoyer dans le canal de logs staff
    if (form.log_channel) {
      const logCh = interaction.guild.channels.cache.get(form.log_channel);
      if (logCh) {
        const embed = new EmbedBuilder()
          .setColor('#F1C40F')
          .setTitle(`📋 Nouvelle candidature — ${nom}`)
          .setDescription(`De : <@${userId}> (${interaction.user.username})`)
          .setThumbnail(interaction.user.displayAvatarURL())
          .setTimestamp()
          .setFooter({ text: `ID candidature: ${submission?.id || '?'}` });

        answers.forEach((a, i) => embed.addFields({ name: `${i+1}. ${a.question}`, value: a.answer.slice(0, 1024) || '*Vide*' }));

        const actionRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`app_accept_${submission?.id || 0}_${form.role_id || ''}`).setLabel('✅ Accepter').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`app_reject_${submission?.id || 0}`).setLabel('❌ Refuser').setStyle(ButtonStyle.Danger),
        );

        await logCh.send({ embeds: [embed], components: [actionRow] }).catch(() => {});
      }
    }

    await modalSubmit.reply({ content: `✅ Votre candidature pour **${nom}** a été soumise ! L'équipe la traitera bientôt.`, ephemeral: true });
  } catch {}
}

async function handleComponent(interaction) {
  const db = require('../../database/db');
  const customId = interaction.customId;

  try {
    // Gérer les boutons de candidature (apply_*)
    if (customId.startsWith('apply_')) {
      const nom = customId.slice(6); // Récupère le nom après 'apply_'
      return await handleApplication(interaction, interaction.guildId, interaction.user.id, nom);
    }

    // Gérer les boutons accept/reject (app_*)
    if (customId.startsWith('app_')) {
      const isAdmin = interaction.member.permissions.has(0x20n);
      if (!isAdmin) {
        return interaction.editReply({ content: '❌ Admin uniquement.', ephemeral: true });
      }

      // app_accept_<submissionId>_<roleId>
      if (customId.startsWith('app_accept_')) {
        const parts = customId.slice(11).split('_');
        const submissionId = parseInt(parts[0]);
        const roleId = parts.slice(1).join('_') || null;

        const submission = db.db.prepare('SELECT * FROM app_submissions WHERE id=?').get(submissionId);
        if (!submission) {
          return interaction.editReply({ content: '❌ Candidature introuvable.', ephemeral: true });
        }

        // Mettre à jour le statut
        db.db.prepare('UPDATE app_submissions SET status=?, reviewer_id=? WHERE id=?')
          .run('accepted', interaction.user.id, submissionId);

        // Donner le rôle si applicable
        if (roleId) {
          const member = await interaction.guild.members.fetch(submission.user_id).catch(() => null);
          if (member) {
            await member.roles.add(roleId).catch(() => {});
          }
        }

        // Mettre à jour l'embed et retirer les boutons
        const embed = interaction.message.embeds[0];
        if (embed) {
          embed.setColor('#2ECC71')
            .setTitle(embed.title.replace('Nouvelle', 'Candidature acceptée'));
          embed.fields[0] = {
            name: 'Status',
            value: `✅ Acceptée par <@${interaction.user.id}>`,
            inline: false
          };
        }

        await interaction.message.edit({ embeds: [embed], components: [] }).catch(() => {});
        return interaction.editReply({ content: `✅ Candidature acceptée !${roleId ? ' Rôle attribué.' : ''}`, ephemeral: true });
      }

      // app_reject_<submissionId>
      if (customId.startsWith('app_reject_')) {
        const submissionId = parseInt(customId.slice(11));

        const submission = db.db.prepare('SELECT * FROM app_submissions WHERE id=?').get(submissionId);
        if (!submission) {
          return interaction.editReply({ content: '❌ Candidature introuvable.', ephemeral: true });
        }

        // Mettre à jour le statut
        db.db.prepare('UPDATE app_submissions SET status=?, reviewer_id=? WHERE id=?')
          .run('rejected', interaction.user.id, submissionId);

        // Mettre à jour l'embed et retirer les boutons
        const embed = interaction.message.embeds[0];
        if (embed) {
          embed.setColor('#E74C3C')
            .setTitle(embed.title.replace('Nouvelle', 'Candidature refusée'));
          embed.fields[0] = {
            name: 'Status',
            value: `❌ Refusée par <@${interaction.user.id}>`,
            inline: false
          };
        }

        await interaction.message.edit({ embeds: [embed], components: [] }).catch(() => {});
        return interaction.editReply({ content: '✅ Candidature refusée.', ephemeral: true });
      }
    }

    return false;
  } catch (error) {
    console.error('Erreur dans handleComponent (applications):', error);
    try {
      return interaction.editReply({ content: '❌ Une erreur s\'est produite.', ephemeral: true });
    } catch {}
    return false;
  }
}

module.exports.handleComponent = handleComponent;
