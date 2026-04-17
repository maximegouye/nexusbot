const {
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  StringSelectMenuBuilder,
  AttachmentBuilder,
} = require('discord.js');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {

    // ── SLASH COMMANDS ───────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      // ── Vérification blacklist NexusBot ───────────────────
      if (interaction.commandName !== 'nexus') {
        try {
          const dbCheck = require('../database/db');
          const bl = dbCheck.db.prepare(
            'SELECT 1 FROM nexus_blacklist WHERE guild_id=? AND user_id=?'
          ).get(interaction.guildId, interaction.user.id);
          if (bl) {
            return interaction.reply({
              embeds: [new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('🚫 Accès refusé')
                .setDescription('Vous n\'êtes pas autorisé à utiliser les commandes de ce bot sur ce serveur.\nContactez un administrateur si vous pensez qu\'il s\'agit d\'une erreur.')
                .setFooter({ text: interaction.guild?.name || '' })
              ], ephemeral: true
            });
          }
        } catch {}
      }

      // Cooldown
      if (!client.cooldowns.has(command.data.name)) {
        client.cooldowns.set(command.data.name, new Map());
      }
      const now = Date.now();
      const ts  = client.cooldowns.get(command.data.name);
      const cd  = (command.cooldown ?? 3) * 1000;

      if (ts.has(interaction.user.id)) {
        const exp = ts.get(interaction.user.id) + cd;
        if (now < exp) {
          return interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor('#FF6B6B')
              .setDescription(`⏱️ Attends encore **${((exp - now) / 1000).toFixed(1)}s** avant de refaire \`/${command.data.name}\`.`)
            ], ephemeral: true
          });
        }
      }
      ts.set(interaction.user.id, now);
      setTimeout(() => ts.delete(interaction.user.id), cd);

      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error(`[CMD] Erreur /${interaction.commandName}:`, error);
        const errEmbed = new EmbedBuilder()
          .setColor('#FF6B6B')
          .setTitle('❌ Erreur inattendue')
          .setDescription('Une erreur est survenue. Réessaie plus tard ou contacte un admin.')
          .setFooter({ text: error.message?.slice(0, 100) });

        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({ embeds: [errEmbed] }).catch(() => {});
        } else {
          await interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => {});
        }
      }
      return;
    }

    // ── BOUTONS ──────────────────────────────────────────
    if (interaction.isButton()) {
      const db = require('../database/db');
      const customId = interaction.customId;

      // ══════════════════════════════════════════════════════
      // TICKET SYSTEM v2 — BOUTONS
      // ══════════════════════════════════════════════════════

      // ── Ouvrir un ticket : vérifier blacklist + afficher sélecteur de catégorie ──
      if (customId === 'ticket_open') {
        // Vérifier la blacklist
        const blacklisted = db.db.prepare('SELECT * FROM ticket_blacklist WHERE guild_id=? AND user_id=?')
          .get(interaction.guildId, interaction.user.id);
        if (blacklisted) {
          return interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor('#E74C3C')
              .setTitle('🚫 Accès refusé — Tickets désactivés')
              .setDescription(
                `Tu as été **banni du système de tickets** de ce serveur.\n\n` +
                `**Raison :** ${blacklisted.reason || 'Aucune raison précisée'}\n` +
                `**Banni par :** <@${blacklisted.banned_by}>\n\n` +
                `> Si tu penses que c'est une erreur, contacte un admin directement.`
              )
              .setFooter({ text: `${interaction.guild.name} • Support` })
            ],
            ephemeral: true
          });
        }

        const existing = db.db.prepare("SELECT * FROM tickets WHERE guild_id=? AND user_id=? AND status='open'")
          .get(interaction.guildId, interaction.user.id);
        if (existing)
          return interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor('#E67E22')
              .setTitle('⚠️ Ticket déjà ouvert')
              .setDescription(`Tu as déjà un ticket en cours : <#${existing.channel_id}>\n\nFerme-le avant d'en ouvrir un nouveau.`)
            ],
            ephemeral: true
          });

        const { CATEGORIES } = require('../commands/unique/ticket');
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('ticket_select_cat')
          .setPlaceholder('📂 Sélectionne une catégorie...')
          .addOptions(CATEGORIES.map(c => ({ label: c.label, description: c.description, value: c.value, emoji: c.emoji })));

        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor('#7B2FBE')
            .setTitle('🎫 Ouvrir un ticket — Étape 1/2')
            .setDescription(
              '**Quelle est la nature de ta demande ?**\n\n' +
              CATEGORIES.map(c => `${c.emoji} **${c.label.replace(/^.*? /,'')}** — *${c.description}*`).join('\n') +
              '\n\n> 📌 Sélectionne une catégorie dans le menu ci-dessous.'
            )
            .setFooter({ text: 'Étape suivante : choisir le niveau d\'urgence' })
          ],
          components: [new ActionRowBuilder().addComponents(selectMenu)],
          ephemeral: true,
        });
      }

      // ── Fermer (bouton dans le ticket) ──
      if (customId.startsWith('ticket_close_')) {
        const ticketId = parseInt(customId.replace('ticket_close_', ''));
        const ticket   = db.db.prepare('SELECT * FROM tickets WHERE id=?').get(ticketId);
        if (!ticket) return interaction.reply({ content: '❌ Ticket introuvable.', ephemeral: true });

        const cfg = db.getConfig(interaction.guildId);
        const canClose = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)
          || (cfg.ticket_staff_role && interaction.member.roles.cache.has(cfg.ticket_staff_role))
          || interaction.user.id === ticket.user_id;
        if (!canClose) return interaction.reply({ content: '❌ Tu n\'as pas la permission.', ephemeral: true });

        const cat2 = require('../commands/unique/ticket').getCatInfo(ticket.category);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`ticket_confirm_close_${ticket.id}`).setLabel('Confirmer la fermeture').setEmoji('🔒').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`ticket_cancel_close_${ticket.id}`).setLabel('Annuler').setStyle(ButtonStyle.Secondary),
        );
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor('#E74C3C')
            .setAuthor({ name: `Fermeture demandée par ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTitle('🔒 Fermer ce ticket ?')
            .setDescription(
              '> 📄 Un **transcript complet** sera généré et sauvegardé\n' +
              '> 📨 Le créateur recevra le transcript par **DM**\n' +
              '> ⭐ Une **évaluation** du support sera demandée\n\n' +
              '**Cette action est irréversible.**'
            )
            .addFields(
              { name: `${cat2.emoji} Catégorie`, value: cat2.label, inline: true },
              { name: '👤 Créateur', value: `<@${ticket.user_id}>`, inline: true },
            )
            .setFooter({ text: 'Utilise le bouton Annuler si c\'est une erreur.' })
          ], components: [row]
        });
      }

      // ── Confirmer la fermeture + transcript ──
      if (customId.startsWith('ticket_confirm_close_')) {
        const ticketId = parseInt(customId.replace('ticket_confirm_close_', ''));
        const ticket   = db.db.prepare('SELECT * FROM tickets WHERE id=?').get(ticketId);
        if (!ticket) return interaction.reply({ content: '❌ Ticket introuvable.', ephemeral: true });

        await interaction.deferReply();

        const cfg = db.getConfig(interaction.guildId);
        const { generateTranscript, getCatInfo } = require('../commands/unique/ticket');
        const cat = getCatInfo(ticket.category);

        // Générer transcript
        const transcriptBuffer = await generateTranscript(interaction.channel, ticket);
        const attachment = new AttachmentBuilder(transcriptBuffer, { name: `transcript-${interaction.channel.name}.txt` });

        // Marquer fermé en DB
        db.db.prepare("UPDATE tickets SET status='closed', closed_at=? WHERE id=?")
          .run(Math.floor(Date.now() / 1000), ticketId);

        // Envoyer dans le salon logs
        if (cfg.ticket_log_channel) {
          const logCh = interaction.guild.channels.cache.get(cfg.ticket_log_channel);
          if (logCh) {
            await logCh.send({
              embeds: [new EmbedBuilder()
                .setColor(cat.color || '#7B2FBE')
                .setTitle(`📋 Ticket fermé — ${interaction.channel.name}`)
                .addFields(
                  { name: '👤 Créateur', value: `<@${ticket.user_id}>`, inline: true },
                  { name: `${cat.emoji} Catégorie`, value: cat.label, inline: true },
                  { name: '🔒 Fermé par', value: `<@${interaction.user.id}>`, inline: true },
                  { name: '📝 Raison', value: ticket.close_reason || 'Aucune', inline: false },
                  { name: '✋ Pris en charge', value: ticket.claimed_by ? `<@${ticket.claimed_by}>` : 'Non réclamé', inline: true },
                )
                .setTimestamp()
              ],
              files: [attachment],
            }).catch(() => {});
          }
        }

        // Notifier l'utilisateur en DM avec le transcript
        const creator = await interaction.guild.members.fetch(ticket.user_id).catch(() => null);
        if (creator) {
          creator.send({
            embeds: [new EmbedBuilder()
              .setColor('#FF6B6B')
              .setTitle('🔒 Ton ticket a été fermé')
              .setDescription(`Ton ticket **${interaction.channel.name}** sur **${interaction.guild.name}** a été fermé.\nMerci d'avoir contacté le support ! Le transcript est joint.`)
              .setFooter({ text: `Fermé par ${interaction.user.tag}` })
            ],
            files: [new AttachmentBuilder(transcriptBuffer, { name: `transcript-${interaction.channel.name}.txt` })],
          }).catch(() => {});
        }

        // ── Afficher le select menu de notation DANS le salon ──
        const ratingSelect = new StringSelectMenuBuilder()
          .setCustomId(`ticket_rate_select_${ticketId}`)
          .setPlaceholder('⭐ Évalue notre support...')
          .addOptions([
            { label: '😡 1 étoile — Très insatisfait',  description: 'Le support n\'a pas répondu à mes attentes',   value: '1' },
            { label: '😕 2 étoiles — Insatisfait',      description: 'Plusieurs points à améliorer',                  value: '2' },
            { label: '😐 3 étoiles — Neutre',            description: 'Correct, mais peut mieux faire',               value: '3' },
            { label: '🙂 4 étoiles — Satisfait',         description: 'Bonne expérience, merci !',                    value: '4' },
            { label: '😄 5 étoiles — Excellent !',       description: 'Support parfait, je suis très satisfait !',    value: '5' },
          ]);

        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#FFD700')
            .setAuthor({ name: `Support ${interaction.guild.name}`, iconURL: interaction.guild.iconURL() })
            .setTitle('⭐ Comment s\'est passée ton expérience ?')
            .setDescription(
              `<@${ticket.user_id}> — Ton avis nous aide à améliorer notre support !\n\n` +
              `> Sélectionne une note dans le menu ci-dessous\n` +
              `> Ce salon disparaît dans **60 secondes**`
            )
            .addFields(
              { name: '🎟️ Ticket', value: `\`#${ticketId}\``, inline: true },
              { name: '🔒 Fermé par', value: `<@${interaction.user.id}>`, inline: true },
              { name: '📋 Transcript', value: '`✅ Sauvegardé`', inline: true },
            )
            .setFooter({ text: 'Ton retour nous aide à mieux vous servir ⭐' })
            .setTimestamp()
          ],
          components: [new ActionRowBuilder().addComponents(ratingSelect)],
        });

        // Suppression auto après 60 secondes si pas de notation
        const channelRef = interaction.channel;
        setTimeout(() => channelRef.delete().catch(() => {}), 60000);
        return;
      }

      // ── Annuler la fermeture ──
      if (customId.startsWith('ticket_cancel_close_')) {
        return interaction.update({
          embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription('✅ Fermeture annulée.')],
          components: []
        });
      }

      // (ticket_rate_ par bouton supprimé — remplacé par select menu ticket_rate_select_)

      // ── Claim via bouton (dans le message d'accueil du ticket) ──
      if (customId.startsWith('ticket_claim_')) {
        const ticketId = parseInt(customId.replace('ticket_claim_', ''));
        const ticket   = db.db.prepare('SELECT * FROM tickets WHERE id=?').get(ticketId);
        if (!ticket) return interaction.reply({ content: '❌ Ticket introuvable.', ephemeral: true });

        const cfg = db.getConfig(interaction.guildId);
        const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)
          || (cfg.ticket_staff_role && interaction.member.roles.cache.has(cfg.ticket_staff_role));
        if (!isStaff) return interaction.reply({ content: '❌ Réservé au staff.', ephemeral: true });
        if (ticket.claimed_by)
          return interaction.reply({ content: `⚠️ Déjà pris en charge par <@${ticket.claimed_by}>.`, ephemeral: true });

        db.db.prepare('UPDATE tickets SET claimed_by=? WHERE id=?').run(interaction.user.id, ticketId);
        await interaction.channel.setTopic(`Pris en charge par ${interaction.user.tag}`).catch(() => {});

        return interaction.reply({
          embeds: [new EmbedBuilder().setColor('#2ECC71')
            .setDescription(`✋ **${interaction.member.displayName}** a pris en charge ce ticket.`)
          ]
        });
      }

      // ── Garder le ticket ouvert (bouton inactivité) ──
      if (customId.startsWith('ticket_keepopen_')) {
        const ticketId = parseInt(customId.replace('ticket_keepopen_', ''));
        const ticket   = db.db.prepare('SELECT * FROM tickets WHERE id=?').get(ticketId);
        if (!ticket) return interaction.reply({ content: '❌ Ticket introuvable.', ephemeral: true });

        if (interaction.user.id !== ticket.user_id) {
          return interaction.reply({ content: '❌ Seul le créateur du ticket peut confirmer sa présence.', ephemeral: true });
        }

        // Réinitialiser l'avertissement
        db.db.prepare('UPDATE tickets SET warn_sent=0 WHERE id=?').run(ticketId);

        await interaction.update({
          embeds: [new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('✅ Ticket maintenu ouvert')
            .setDescription(`**<@${interaction.user.id}>** est encore là !\n\nLe ticket reste ouvert et le compteur d'inactivité a été réinitialisé.`)
            .setFooter({ text: 'Nouveau délai de fermeture auto : 48h d\'inactivité' })
          ],
          components: [],
        });

        return interaction.followUp({
          embeds: [new EmbedBuilder()
            .setColor('#2ECC71')
            .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
            .setDescription(`✅ <@${ticket.user_id}> a confirmé être encore là. Le staff reviendra vers toi dès que possible !`)
          ]
        });
      }

      // ── Réponses rapides (bouton staff) ──
      if (customId.startsWith('ticket_quickreply_')) {
        const ticketId = parseInt(customId.replace('ticket_quickreply_', ''));
        const ticket   = db.db.prepare('SELECT * FROM tickets WHERE id=?').get(ticketId);
        if (!ticket) return interaction.reply({ content: '❌ Ticket introuvable.', ephemeral: true });

        const cfgQR = db.getConfig(interaction.guildId);
        const isStaffQR = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)
          || (cfgQR.ticket_staff_role && interaction.member.roles.cache.has(cfgQR.ticket_staff_role));
        if (!isStaffQR) return interaction.reply({ content: '❌ Réservé au staff.', ephemeral: true });

        const DEFAULT_QR = [
          { label: '👋 Message d\'accueil',   value: 'qr_welcome',    description: 'Accueillir le membre et se présenter' },
          { label: '⏳ Merci de patienter',   value: 'qr_wait',       description: 'Demander de la patience' },
          { label: '📷 Captures demandées',   value: 'qr_screenshot', description: 'Demander des preuves visuelles' },
          { label: '🔄 Plus d\'informations', value: 'qr_info',       description: 'Demander des détails supplémentaires' },
          { label: '✅ Problème résolu',       value: 'qr_resolved',   description: 'Confirmer la résolution' },
          { label: '🔒 Fermeture imminente',  value: 'qr_closing',    description: 'Prévenir de la fermeture' },
        ];

        const customReplies = db.db.prepare('SELECT * FROM ticket_quick_replies WHERE guild_id=? ORDER BY title LIMIT 15')
          .all(interaction.guildId);
        const customOpts = customReplies.map(r => ({
          label: `✏️ ${r.title}`.slice(0, 100),
          value: `qr_custom_${r.id}`,
          description: r.content.slice(0, 100),
        }));

        const allOpts = [...DEFAULT_QR, ...customOpts].slice(0, 25);
        const qrSelect = new StringSelectMenuBuilder()
          .setCustomId(`ticket_qr_select_${ticketId}`)
          .setPlaceholder('💬 Choisir une réponse rapide...')
          .addOptions(allOpts);

        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor('#7B2FBE')
            .setTitle('💬 Réponses rapides')
            .setDescription(`Sélectionne une réponse à envoyer dans ce ticket.\n\n> ✏️ Ajoute tes propres réponses avec \`/ticket addreply\``)
          ],
          components: [new ActionRowBuilder().addComponents(qrSelect)],
          ephemeral: true,
        });
      }

      // ── Giveaway — participer ──
      if (customId === 'giveaway_enter') {
        const gw = db.db.prepare('SELECT * FROM giveaways WHERE channel_id = ? AND message_id = ? AND status = "active"')
          .get(interaction.channelId, interaction.message.id);

        if (!gw) return interaction.reply({ content: '❌ Ce giveaway est terminé.', ephemeral: true });

        const user    = db.getUser(interaction.user.id, interaction.guildId);
        const entries = JSON.parse(gw.entries || '[]');

        // Conditions
        if (gw.min_level > 0 && user.level < gw.min_level) {
          return interaction.reply({ content: `❌ Niveau minimum : **${gw.min_level}** (tu as niveau **${user.level}**).`, ephemeral: true });
        }
        if (gw.min_balance > 0 && user.balance < gw.min_balance) {
          return interaction.reply({ content: `❌ Solde minimum : **${gw.min_balance.toLocaleString('fr')}** coins.`, ephemeral: true });
        }

        // Déjà inscrit ?
        if (entries.includes(interaction.user.id)) {
          return interaction.reply({ content: '⚠️ Tu participes déjà !', ephemeral: true });
        }

        // Bonus entrées si rôle bonus
        let bonus = 1;
        if (gw.bonus_role_id && interaction.member.roles.cache.has(gw.bonus_role_id)) bonus = 3;
        for (let i = 0; i < bonus; i++) entries.push(interaction.user.id);

        db.db.prepare('UPDATE giveaways SET entries = ? WHERE id = ?').run(JSON.stringify(entries), gw.id);

        const unique = new Set(entries).size;
        // Mettre à jour le message giveaway
        try {
          const embed = interaction.message.embeds[0]?.toJSON();
          if (embed) {
            embed.description = embed.description?.replace(/🎟️ \*\*Participants :\*\* \d+/, `🎟️ **Participants :** ${unique}`);
            await interaction.message.edit({ embeds: [embed] });
          }
        } catch {}

        return interaction.reply({
          content: `🎉 Tu es inscrit ! Tu as **${bonus}** ticket${bonus > 1 ? 's' : ''} ! (${unique} participants au total)`,
          ephemeral: true
        });
      }

      // ── Role Menu — toggle rôle ──
      if (customId.startsWith('rolemenu_toggle_')) {
        const roleId = customId.replace('rolemenu_toggle_', '');
        const menu = db.db.prepare('SELECT * FROM role_menus WHERE guild_id=? AND message_id=?')
          .get(interaction.guildId, interaction.message.id);
        if (!menu) return interaction.reply({ content: '❌ Menu introuvable.', ephemeral: true });

        const roles = JSON.parse(menu.roles || '[]');
        if (!roles.includes(roleId)) return interaction.reply({ content: '❌ Rôle non autorisé pour ce menu.', ephemeral: true });

        const member = interaction.member;
        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) return interaction.reply({ content: '❌ Rôle inexistant.', ephemeral: true });

        if (member.roles.cache.has(roleId)) {
          await member.roles.remove(role).catch(() => {});
          return interaction.reply({ content: `✅ Rôle **${role.name}** retiré.`, ephemeral: true });
        } else {
          if (menu.max_choices > 0) {
            const currentCount = roles.filter(r => member.roles.cache.has(r)).length;
            if (currentCount >= menu.max_choices) {
              return interaction.reply({ content: `❌ Tu as déjà **${menu.max_choices}** rôle(s) max sélectionné(s).`, ephemeral: true });
            }
          }
          if (menu.required_role && !member.roles.cache.has(menu.required_role)) {
            return interaction.reply({ content: `❌ Tu dois avoir le rôle <@&${menu.required_role}> pour accéder à ce menu.`, ephemeral: true });
          }
          await member.roles.add(role).catch(() => {});
          return interaction.reply({ content: `✅ Rôle **${role.name}** obtenu !`, ephemeral: true });
        }
      }

      // ── Coinflip — accepter/refuser ──
      if (customId.startsWith('coinflip_accept_') || customId.startsWith('coinflip_decline_')) {
        // Handled by collector inside coinflip.js — ignore here
        return;
      }

      // ── TicTacToe / Connect4 buttons ── (handled by collectors in command files)
      if (customId.startsWith('ttt_') || customId.startsWith('c4_')) return;

      // ── Poll — voter ──
      if (customId.startsWith('poll_vote_')) {
        const parts    = customId.replace('poll_vote_', '').split('_');
        const pollId   = parseInt(parts[0]);
        const optIdx   = parseInt(parts[1]);
        const poll     = db.db.prepare('SELECT * FROM polls WHERE id = ?').get(pollId);

        if (!poll || poll.ended) return interaction.reply({ content: '❌ Ce sondage est terminé.', ephemeral: true });

        const votes = JSON.parse(poll.votes || '{}');

        // Un vote par personne
        for (const voters of Object.values(votes)) {
          if (Array.isArray(voters) && voters.includes(interaction.user.id)) {
            return interaction.reply({ content: '⚠️ Tu as déjà voté !', ephemeral: true });
          }
        }

        if (!votes[optIdx]) votes[optIdx] = [];
        votes[optIdx].push(interaction.user.id);
        db.db.prepare('UPDATE polls SET votes = ? WHERE id = ?').run(JSON.stringify(votes), pollId);

        const choices = JSON.parse(poll.choices || '[]');
        const total   = Object.values(votes).reduce((a, v) => a + v.length, 0);
        const emojis  = ['🇦', '🇧', '🇨', '🇩'];

        const embed = new EmbedBuilder()
          .setColor('#7B2FBE')
          .setTitle(`📊 ${poll.question}`)
          .setFooter({ text: `${total} vote${total !== 1 ? 's' : ''}` });

        for (let i = 0; i < choices.length; i++) {
          const cnt = (votes[i] || []).length;
          const pct = total > 0 ? Math.round(cnt / total * 100) : 0;
          const barL = 20;
          const fill = Math.round(pct / 100 * barL);
          const bar  = '█'.repeat(fill) + '░'.repeat(barL - fill);
          embed.addFields({ name: `${emojis[i]} ${choices[i]}`, value: `${bar} **${pct}%** (${cnt})`, inline: false });
        }

        await interaction.update({ embeds: [embed] });
        return;
      }

      // ── Candidatures — Accept/Reject (boutons app_accept_ / app_reject_) ──────
      if (customId.startsWith('app_accept_') || customId.startsWith('app_reject_')) {
        if (!interaction.member.permissions.has(0x4000n)) {
          return interaction.reply({ content: '❌ Staff uniquement.', ephemeral: true });
        }
        const parts = customId.split('_');
        const action = parts[1]; // 'accept' ou 'reject'
        const subId = parseInt(parts[2]);
        const roleId = parts[3] || null;

        const sub2 = db.db.prepare('SELECT * FROM app_submissions WHERE id=?').get(subId);
        if (!sub2) return interaction.reply({ content: '❌ Candidature introuvable.', ephemeral: true });
        if (sub2.status !== 'pending') return interaction.reply({ content: '❌ Cette candidature a déjà été traitée.', ephemeral: true });

        db.db.prepare('UPDATE app_submissions SET status=?, reviewer_id=? WHERE id=?')
          .run(action === 'accept' ? 'accepted' : 'rejected', interaction.user.id, subId);

        // Notifier l'auteur en DM
        try {
          const targetUser = await interaction.client.users.fetch(sub2.user_id);
          const dmEmbed = new EmbedBuilder()
            .setColor(action === 'accept' ? '#2ECC71' : '#E74C3C')
            .setTitle(action === 'accept' ? '✅ Candidature acceptée !' : '❌ Candidature refusée')
            .setDescription(action === 'accept'
              ? `Félicitations ! Votre candidature **${sub2.form_name}** sur **${interaction.guild.name}** a été **acceptée** !`
              : `Votre candidature **${sub2.form_name}** sur **${interaction.guild.name}** a été refusée. N'hésitez pas à réessayer plus tard.`)
            .setFooter({ text: `Traité par ${interaction.user.username}` });
          await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});

          // Donner le rôle si accepté
          if (action === 'accept' && roleId) {
            const member2 = await interaction.guild.members.fetch(sub2.user_id).catch(() => null);
            if (member2) await member2.roles.add(roleId).catch(() => {});
          }
        } catch {}

        // Mettre à jour le message staff
        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(action === 'accept' ? '#2ECC71' : '#E74C3C')
          .setFooter({ text: `${action === 'accept' ? '✅ Accepté' : '❌ Refusé'} par ${interaction.user.username}` });

        await interaction.update({ embeds: [updatedEmbed], components: [] });
        return;
      }

      // ── Candidatures — bouton postuler (apply_nom) ────────────────────────────
      if (customId.startsWith('apply_')) {
        const nom = customId.replace('apply_', '');
        const { execute } = require('../commands_guild/utility/applications');
        const fakeInteraction = Object.assign(Object.create(Object.getPrototypeOf(interaction)), interaction);
        fakeInteraction.options = {
          getSubcommand: () => 'postuler',
          getString: (key) => key === 'formulaire' ? nom : null,
        };
        try { await execute(fakeInteraction); } catch {}
        return;
      }

      // ── Prestige (confirmation) ──────────────────────────────────────────────
      if (customId.startsWith('prestige_confirm_') || customId.startsWith('prestige_cancel_')) {
        const targetUserId = customId.split('_').pop();
        if (interaction.user.id !== targetUserId) return interaction.reply({ content: '❌ Ce n\'est pas votre confirmation.', ephemeral: true });
        if (customId.startsWith('prestige_cancel_')) return interaction.update({ content: '❌ Prestige annulé.', embeds: [], components: [] });

        const PRESTIGE_LEVELS = [
          { level: 1, required_xp_level: 50, color: '#CD7F32', emoji: '🥉', bonus: '+15% XP permanent', multiplier: 1.15 },
          { level: 2, required_xp_level: 50, color: '#C0C0C0', emoji: '🥈', bonus: '+30% XP permanent', multiplier: 1.30 },
          { level: 3, required_xp_level: 50, color: '#FFD700', emoji: '🥇', bonus: '+50% XP permanent', multiplier: 1.50 },
          { level: 4, required_xp_level: 75, color: '#9B59B6', emoji: '💜', bonus: '+75% XP + 10% coins', multiplier: 1.75 },
          { level: 5, required_xp_level: 75, color: '#3498DB', emoji: '💎', bonus: '+100% XP + 20% coins', multiplier: 2.00 },
          { level: 6, required_xp_level: 100, color: '#E74C3C', emoji: '🔴', bonus: '+150% XP + 30% coins', multiplier: 2.50 },
          { level: 7, required_xp_level: 100, color: '#FF6B6B', emoji: '🌟', bonus: '+200% XP + 50% coins', multiplier: 3.00 },
          { level: 8, required_xp_level: 150, color: '#FFD700', emoji: '👑', bonus: 'LÉGENDAIRE — +300% XP + 100% coins', multiplier: 4.00 },
        ];
        const u = db.getUser(targetUserId, interaction.guildId);
        const currentPrestige = u.prestige || 0;
        const nextP = PRESTIGE_LEVELS[currentPrestige];
        if (!nextP) return interaction.update({ content: '✅ Prestige maximum déjà atteint !', embeds: [], components: [] });

        const coinReward = 5000 * (currentPrestige + 1);
        db.db.prepare('UPDATE users SET prestige=?, level=1, xp=0, prestige_coins_total=prestige_coins_total+? WHERE user_id=? AND guild_id=?')
          .run(currentPrestige + 1, coinReward, targetUserId, interaction.guildId);
        db.addCoins(targetUserId, interaction.guildId, coinReward);

        const cfg2 = db.getConfig(interaction.guildId);
        return interaction.update({ embeds: [new EmbedBuilder()
          .setColor(nextP.color)
          .setTitle(`${nextP.emoji} Prestige ${currentPrestige + 1} atteint !`)
          .setDescription(`Félicitations ! Vous êtes maintenant **${nextP.emoji} Prestige ${currentPrestige + 1}** !\n\n✅ Bonus actif : **${nextP.bonus}**\n💰 +${coinReward.toLocaleString()} ${cfg2.currency_emoji || '🪙'}`)
        ], components: [] });
      }

      // ── Morpion (boutons morpion_*) ────────────────────────────────────────────
      if (customId.startsWith('morpion_')) {
        try {
          const { handleButton } = require('../commands_guild/games/morpion');
          await handleButton(interaction);
        } catch (e) { console.error('[MORPION]', e.message); }
        return;
      }

      // ── Tournoi (bouton inscription tournoi_join_id) ───────────────────────────
      if (customId.startsWith('tournoi_join_')) {
        const tournoiId = parseInt(customId.replace('tournoi_join_', ''));
        const db2 = require('../database/db');
        const guildId2 = interaction.guildId;
        const userId2 = interaction.user.id;
        const tournoi2 = db2.db.prepare('SELECT * FROM tournois WHERE id=? AND guild_id=?').get(tournoiId, guildId2);
        if (!tournoi2 || tournoi2.status !== 'inscription') {
          return interaction.reply({ content: '❌ Les inscriptions sont fermées.', ephemeral: true });
        }
        const count2 = db2.db.prepare('SELECT COUNT(*) as c FROM tournoi_players WHERE tournoi_id=?').get(tournoiId);
        if (count2.c >= tournoi2.max_players) {
          return interaction.reply({ content: '❌ Le tournoi est complet.', ephemeral: true });
        }
        try {
          db2.db.prepare('INSERT INTO tournoi_players (tournoi_id, guild_id, user_id) VALUES (?,?,?)').run(tournoiId, guildId2, userId2);
          return interaction.reply({ content: `✅ Inscrit au tournoi **${tournoi2.name}** ! (${count2.c + 1}/${tournoi2.max_players})`, ephemeral: true });
        } catch {
          return interaction.reply({ content: '❌ Vous êtes déjà inscrit.', ephemeral: true });
        }
      }

      // ── Pendu (boutons pendu_lettre) ──────────────────────────────────────────
      if (customId.startsWith('pendu_')) {
        try {
          const { handleButton } = require('../commands_guild/games/pendu');
          await handleButton(interaction);
        } catch (e) { console.error('[PENDU]', e.message); }
        return;
      }

      // ── Pets — abandon confirmation ───────────────────────────────────────────
      if (customId.startsWith('pet_abandon_confirm_') || customId.startsWith('pet_abandon_cancel_')) {
        const targetUserId = customId.split('_').pop();
        if (interaction.user.id !== targetUserId) return interaction.reply({ content: '❌ Ce n\'est pas votre action.', ephemeral: true });
        if (customId.startsWith('pet_abandon_cancel_')) {
          return interaction.update({ content: '✅ Abandon annulé, votre animal est en sécurité !', embeds: [], components: [] });
        }
        // Confirm abandon
        db.db.prepare('DELETE FROM pets WHERE guild_id=? AND owner_id=?').run(interaction.guildId, targetUserId);
        return interaction.update({ embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('💔 Animal abandonné').setDescription('Votre animal a été libéré. Vous pouvez en adopter un nouveau avec `/pet adopter`.')], components: [] });
      }

// ── Reaction Roles (boutons rr_) ─────────────────────────────────────────
      if (customId.startsWith('rr_')) {
        const roleId = customId.replace('rr_', '');
        const rr = db.db.prepare('SELECT * FROM reaction_roles WHERE guild_id=? AND role_id=? AND message_id=?').get(interaction.guildId, roleId, interaction.message.id);
        if (!rr) return interaction.reply({ content: '❌ Configuration introuvable.', ephemeral: true });

        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) return interaction.reply({ content: '❌ Rôle inexistant.', ephemeral: true });

        const hasRole = interaction.member.roles.cache.has(roleId);
        if (hasRole) {
          await interaction.member.roles.remove(roleId);
          return interaction.reply({ content: `✅ Rôle **${role.name}** retiré !`, ephemeral: true });
        } else {
          await interaction.member.roles.add(roleId);
          return interaction.reply({ content: `✅ Rôle **${role.name}** attribué !`, ephemeral: true });
        }
      }
    }

    // ── AUTOCOMPLETE ─────────────────────────────────────
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (command?.autocomplete) {
        await command.autocomplete(interaction).catch(() => {});
      }
      return;
    }

    // ── STRING SELECT MENUS ──────────────────────────────
    if (interaction.isStringSelectMenu()) {
      const db = require('../database/db');

      // ── Sélection de catégorie ticket → afficher menu priorité ──
      if (interaction.customId === 'ticket_select_cat') {
        const category = interaction.values[0];
        const { getCatInfo, PRIORITIES } = require('../commands/unique/ticket');
        const { detectAutoPriority, detectSpam, calcTrustScore, getTrustLabel } = require('../utils/ticketIntelligence');
        const cat = getCatInfo(category);

        // Vérification spam
        const spamCheck = detectSpam(db.db, interaction.guildId, interaction.user.id);
        if (spamCheck.spam) {
          return interaction.update({
            embeds: [new EmbedBuilder()
              .setColor('#E74C3C')
              .setTitle('🚫 Action refusée — Limite atteinte')
              .setDescription(
                `Tu ne peux pas ouvrir de nouveau ticket pour le moment.\n\n` +
                `**Raison :** ${spamCheck.reason}\n\n` +
                `> ⚠️ Si tu penses que c'est une erreur, contacte un administrateur.`
              )
            ],
            components: [],
          });
        }

        const existing = db.db.prepare("SELECT * FROM tickets WHERE guild_id=? AND user_id=? AND status='open'")
          .get(interaction.guildId, interaction.user.id);
        if (existing)
          return interaction.update({ content: `❌ Tu as déjà un ticket ouvert : <#${existing.channel_id}>`, embeds: [], components: [] });

        // Calcul trust score pour affichage
        const trustScore = calcTrustScore(db.db, interaction.guildId, interaction.user.id);
        const trustInfo  = getTrustLabel(trustScore);

        // Suggestion automatique de priorité
        const PRIORITIES_ALL = PRIORITIES.map(p => {
          const suggested = category === 'bug' && p.value === 'elevee'
                         || category === 'signalement' && p.value === 'elevee';
          return {
            label: p.label + (suggested ? ' ✨ Suggéré' : ''),
            description: p.description,
            value: p.value,
          };
        });

        const priorityMenu = new StringSelectMenuBuilder()
          .setCustomId(`ticket_pri_${category}`)
          .setPlaceholder('⚡ Sélectionne le niveau d\'urgence...')
          .addOptions(PRIORITIES_ALL);

        return interaction.update({
          embeds: [new EmbedBuilder()
            .setColor(cat.color || '#7B2FBE')
            .setTitle(`${cat.emoji} ${cat.label.replace(/^.*? /,'')} — Étape 2/2`)
            .setDescription(
              '**Quel est le niveau d\'urgence de ta demande ?**\n\n' +
              '🟢 **Faible** — Pas urgent, quand vous avez le temps\n' +
              '🟡 **Normale** — Demande standard\n' +
              '🟠 **Élevée** — Assez urgent, j\'ai besoin d\'aide\n' +
              '🔴 **Urgente** — Besoin d\'aide immédiatement !\n\n' +
              `> ${trustInfo.emoji} Ton score de confiance : **${trustScore}/100** (${trustInfo.label})\n` +
              `> ⚠️ N'abuse pas de la priorité urgente — cela aide le staff à traiter les vrais cas critiques.`
            )
            .setFooter({ text: `Catégorie : ${cat.label} • Étape 2/2` })
          ],
          components: [new ActionRowBuilder().addComponents(priorityMenu)],
        });
      }

      // ── Sélection de priorité → créer le ticket ──
      if (interaction.customId.startsWith('ticket_pri_')) {
        const category = interaction.customId.replace('ticket_pri_', '');
        const priority = interaction.values[0];

        // Vérification rapide : ticket déjà ouvert ?
        const existing2 = db.db.prepare("SELECT * FROM tickets WHERE guild_id=? AND user_id=? AND status='open'")
          .get(interaction.guildId, interaction.user.id);
        if (existing2)
          return interaction.update({ content: `⚠️ Tu as déjà un ticket ouvert : <#${existing2.channel_id}>`, embeds: [], components: [] });

        // Vérification permissions du bot AVANT deferUpdate
        const botSelf = interaction.guild.members.me;
        if (!botSelf?.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return interaction.update({
            embeds: [new EmbedBuilder()
              .setColor('#E74C3C')
              .setTitle('❌ Permission manquante')
              .setDescription('Le bot n\'a pas la permission **Gérer les salons** sur ce serveur.\n\nUn administrateur doit accorder cette permission à NexusBot.')
            ],
            components: [],
          });
        }

        // Tout semble OK → différer
        await interaction.deferUpdate().catch(() => {});

        const cfg   = db.getConfig(interaction.guildId);
        const guild = interaction.guild;
        const { getCatInfo, getPriInfo } = require('../commands/unique/ticket');
        const {
          calcTrustScore, getTrustLabel,
          detectSpam, isSensitiveContent,
          getAutoAssignStaff, estimateResponseTime,
        } = require('../utils/ticketIntelligence');
        const cat = getCatInfo(category);
        const pri = getPriInfo(priority);

        // ── Double-vérification spam ──────────────────────────────────────────
        const spamCheck2 = detectSpam(db.db, interaction.guildId, interaction.user.id);
        if (spamCheck2.spam) {
          return interaction.followUp({
            embeds: [new EmbedBuilder()
              .setColor('#E74C3C')
              .setTitle('🚫 Action refusée — Limite atteinte')
              .setDescription(
                `Tu ne peux pas ouvrir de nouveau ticket pour le moment.\n\n` +
                `**Raison :** ${spamCheck2.reason}\n\n` +
                `> ⚠️ Si tu penses que c'est une erreur, contacte un administrateur.`
              )
            ],
            ephemeral: true,
          }).catch(() => {});
        }

        try {
          const ticketNumber = (db.db.prepare('SELECT COUNT(*) as c FROM tickets WHERE guild_id=?').get(interaction.guildId)?.c ?? 0) + 1;
          // Nom de canal sécurisé : lettres/chiffres/tirets uniquement, max 100 chars
          const safeUser = interaction.user.username.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 12) || 'user';
          const channelName = `${category}-${safeUser}-${ticketNumber}`.slice(0, 100);

          // ── Mode privé pour contenus sensibles (signalement) ─────────────────
          const isPrivate = isSensitiveContent(category, '');

          // Permissions : @everyone bloqué, user + staff + bot autorisés
          const permissionOverwrites = [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            {
              id: interaction.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
              ],
            },
            // Bot lui-même — doit toujours pouvoir voir et envoyer
            {
              id: botSelf.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageMessages,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.AttachFiles,
              ],
            },
          ];

          // En mode privé, le rôle staff n'est PAS ajouté automatiquement
          // Seul un admin peut y accéder (via permission ManageChannels)
          if (cfg.ticket_staff_role && !isPrivate) {
            permissionOverwrites.push({
              id: cfg.ticket_staff_role,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageMessages,
                PermissionFlagsBits.AttachFiles,
              ],
            });
          }

          // Catégorie parente — DB en priorité, sinon auto-détecter
          let parent = cfg.ticket_category ? guild.channels.cache.get(cfg.ticket_category) : null;
          if (!parent) {
            parent = guild.channels.cache.find(c =>
              c.type === ChannelType.GuildCategory && /ticket|support|aide|help/i.test(c.name)
            ) || null;
          }

          // Créer le salon
          const ticketChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: parent?.id ?? undefined,
            permissionOverwrites,
            topic: `${cat.emoji} ${cat.label} | ${pri.emoji} ${pri.label} | Ouvert par : ${interaction.user.tag}${isPrivate ? ' | 🔒 PRIVÉ' : ''}`,
          });

          // ── Intelligence : trust score + auto-assign + ETA ────────────────────
          const trustScore  = calcTrustScore(db.db, interaction.guildId, interaction.user.id);
          const trustInfo   = getTrustLabel(trustScore);
          const etaMins     = estimateResponseTime(db.db, interaction.guildId);
          const etaText     = etaMins < 60
            ? `~${etaMins} minute${etaMins > 1 ? 's' : ''}`
            : `~${Math.round(etaMins / 60)}h`;

          // Auto-assign au staff le moins chargé
          let autoAssignedMember = null;
          try {
            autoAssignedMember = await getAutoAssignStaff(guild, cfg, db.db);
          } catch {}

          // Insérer en DB avec trust_score, is_private, auto_assigned, claimed_by
          const nowTs = Math.floor(Date.now() / 1000);
          const result = db.db.prepare(
            `INSERT INTO tickets
              (guild_id, channel_id, user_id, status, category, priority, created_at,
               trust_score, is_private, auto_assigned, claimed_by)
             VALUES (?,?,?,'open',?,?,?, ?,?,?,?)`
          ).run(
            interaction.guildId, ticketChannel.id, interaction.user.id,
            category, priority, nowTs,
            trustScore,
            isPrivate ? 1 : 0,
            autoAssignedMember ? 1 : 0,
            autoAssignedMember?.id ?? null,
          );
          const ticketId = result.lastInsertRowid;

          // ── Texte d'accueil personnalisé par catégorie ────────────────────────
          const catMsgKey = `ticket_msg_${category}`;
          const welcomeText = cfg[catMsgKey]
            || cfg.ticket_welcome_msg
            || (isPrivate
              ? '🔒 Ce ticket est **confidentiel**. Seul le staff autorisé pourra y accéder. Décris ton signalement en détail.'
              : 'Décris ton problème en détail et un membre du staff te répondra dès que possible.');

          const controlRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`ticket_claim_${ticketId}`).setLabel('Prendre en charge').setEmoji('✋').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`ticket_close_${ticketId}`).setLabel('Fermer le ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`ticket_quickreply_${ticketId}`).setLabel('Réponses rapides').setEmoji('💬').setStyle(ButtonStyle.Secondary),
          );

          const embedColor = {
            urgente: '#E74C3C', elevee: '#E67E22', normale: cat.color || '#7B2FBE', faible: '#2ECC71'
          }[priority] || (cat.color || '#7B2FBE');

          const urgentBanner = priority === 'urgente'
            ? '\n\n> 🚨 **PRIORITÉ URGENTE** — Le staff va traiter cette demande immédiatement.'
            : priority === 'elevee' ? '\n\n> 🟠 **Priorité élevée** — Traitement accéléré.' : '';

          const privateBanner = isPrivate
            ? '\n\n> 🔒 **Ticket confidentiel** — Seul le staff habilité peut accéder à ce salon.'
            : '';

          const assignedLine = autoAssignedMember
            ? `✋ Assigné automatiquement à <@${autoAssignedMember.id}>`
            : '✋ En attente d\'un membre du staff';

          // Notifier le staff assigné seulement si pas mode privé (ou si admin)
          const notifyContent = isPrivate
            ? `<@${interaction.user.id}>`
            : `<@${interaction.user.id}>${autoAssignedMember ? ` <@${autoAssignedMember.id}>` : (cfg.ticket_staff_role ? ` <@&${cfg.ticket_staff_role}>` : '')}`;

          // Envoyer le message d'accueil dans le ticket
          await ticketChannel.send({
            content: notifyContent,
            embeds: [new EmbedBuilder()
              .setColor(embedColor)
              .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
              .setTitle(`${cat.emoji} Ticket #${ticketNumber} — ${cat.label.replace(/^[^\s]+ /, '')}`)
              .setDescription(
                `Bienvenue <@${interaction.user.id}> ! 👋\n\n**${welcomeText}**${urgentBanner}${privateBanner}\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `📝 Décris ton problème en détail\n` +
                `📸 Joins des captures si nécessaire\n` +
                `⏱️ Temps de réponse estimé : **${etaText}**`
              )
              .addFields(
                { name: `${cat.emoji} Catégorie`,  value: `\`${cat.label}\``,        inline: true },
                { name: `${pri.emoji} Priorité`,   value: `\`${pri.label}\``,        inline: true },
                { name: '🎟️ N°',                  value: `\`#${ticketNumber}\``,     inline: true },
                { name: '📅 Ouvert',               value: `<t:${nowTs}:R>`,          inline: true },
                { name: '👤 Membre',               value: `<@${interaction.user.id}>`, inline: true },
                { name: '📊 Statut',               value: isPrivate ? '`🔒 Privé`' : '`🟢 Ouvert`', inline: true },
                { name: '🤖 Assigné',              value: assignedLine,              inline: false },
              )
              .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
              .setFooter({ text: `${interaction.guild.name} • Support`, iconURL: interaction.guild.iconURL() })
              .setTimestamp()
            ],
            components: [controlRow],
          });

          // ── DM au staff auto-assigné ──────────────────────────────────────────
          if (autoAssignedMember) {
            autoAssignedMember.send({
              embeds: [new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(`📋 Nouveau ticket assigné — #${ticketNumber}`)
                .setDescription(
                  `Tu as été **automatiquement assigné** à un nouveau ticket.\n\n` +
                  `> Rends-toi dans ${ticketChannel} pour traiter la demande.`
                )
                .addFields(
                  { name: '👤 Utilisateur',    value: `<@${interaction.user.id}> (\`${interaction.user.tag}\`)`, inline: false },
                  { name: `${cat.emoji} Catégorie`, value: cat.label,  inline: true },
                  { name: `${pri.emoji} Priorité`,  value: pri.label,  inline: true },
                  { name: '🎟️ Ticket',          value: `\`#${ticketNumber}\``, inline: true },
                  { name: `${trustInfo.emoji} Confiance`, value: `${trustScore}/100 (${trustInfo.label})`, inline: true },
                )
                .setFooter({ text: `${interaction.guild.name} • Auto-assigné par NexusBot` })
                .setTimestamp()
              ],
            }).catch(() => {});
          }

          // ── Profil utilisateur automatique (visible staff dans le ticket) ──
          try {
            const prevTickets   = db.db.prepare("SELECT * FROM tickets WHERE guild_id=? AND user_id=? AND id!=? ORDER BY created_at DESC LIMIT 5")
              .all(interaction.guildId, interaction.user.id, ticketId);
            const warnings      = db.db.prepare("SELECT COUNT(*) as c FROM warnings WHERE guild_id=? AND user_id=?")
              .get(interaction.guildId, interaction.user.id)?.c || 0;
            const notes         = db.db.prepare("SELECT COUNT(*) as c FROM mod_notes WHERE guild_id=? AND user_id=?")
              .get(interaction.guildId, interaction.user.id)?.c || 0;
            const acctAgeDays   = Math.floor((Date.now() - interaction.user.createdTimestamp) / 86400000);
            const joinAgeDays   = interaction.member?.joinedTimestamp
              ? Math.floor((Date.now() - interaction.member.joinedTimestamp) / 86400000)
              : null;

            const prevLines = prevTickets.length
              ? prevTickets.map(t => {
                  const tc = getCatInfo(t.category);
                  const tp = getPriInfo(t.priority || 'normale');
                  const st = t.status === 'open' ? '🟢' : '🔴';
                  return `${st} ${tc.emoji} \`#${t.id}\` ${tp.emoji} <t:${t.created_at}:d>`;
                }).join('\n')
              : '`Aucun ticket précédent`';

            // Niveau de risque
            let riskStr = warnings >= 5 ? '🔴 Risque élevé (5+ warns)'
              : warnings >= 3 ? '🟠 Modéré (3+ warns)'
              : warnings >= 1 ? '🟡 À surveiller (1-2 warns)'
              : '🟢 Aucun avertissement';
            if (acctAgeDays < 7) riskStr += '\n⚠️ Compte récent (< 7 jours)';

            const profileColor = warnings >= 3 ? '#E74C3C' : warnings >= 1 ? '#E67E22' : '#2C2F33';

            await ticketChannel.send({
              embeds: [new EmbedBuilder()
                .setColor(profileColor)
                .setAuthor({ name: '👤 Profil Utilisateur — Vue Staff', iconURL: interaction.user.displayAvatarURL() })
                .setDescription(`> ⚠️ Ces informations sont **visibles uniquement par le staff**.`)
                .addFields(
                  { name: '👤 Utilisateur',    value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: false },
                  { name: '📅 Compte créé',    value: `<t:${Math.floor(interaction.user.createdTimestamp/1000)}:R> (${acctAgeDays}j)`, inline: true },
                  { name: '📆 Sur le serveur', value: joinAgeDays !== null ? `<t:${Math.floor(interaction.member.joinedTimestamp/1000)}:R> (${joinAgeDays}j)` : 'Inconnu', inline: true },
                  { name: '⚠️ Warns',          value: `**${warnings}**`, inline: true },
                  { name: '📝 Notes mod',      value: `**${notes}**`,    inline: true },
                  { name: `${trustInfo.emoji} Score confiance`, value: `**${trustScore}/100** — ${trustInfo.label}`, inline: true },
                  { name: '🛡️ Profil',         value: riskStr,          inline: false },
                  { name: `🎫 Tickets précédents (${prevTickets.length})`, value: prevLines, inline: false },
                )
                .setFooter({ text: '📋 Vue interne automatique — /ticket profile pour le détail complet' })
              ]
            }).catch(() => {});
          } catch {}

          // Logguer l'ouverture si un salon logs est configuré
          if (cfg.ticket_log_channel) {
            const logCh = guild.channels.cache.get(cfg.ticket_log_channel);
            if (logCh) {
              logCh.send({ embeds: [new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(`📂 Nouveau ticket #${ticketNumber}${isPrivate ? ' 🔒' : ''}`)
                .addFields(
                  { name: '👤 Membre', value: `<@${interaction.user.id}>`, inline: true },
                  { name: `${cat.emoji} Catégorie`, value: cat.label, inline: true },
                  { name: `${pri.emoji} Priorité`, value: pri.label, inline: true },
                  { name: '🔗 Salon', value: `${ticketChannel}`, inline: true },
                  { name: `${trustInfo.emoji} Confiance`, value: `${trustScore}/100`, inline: true },
                  { name: '✋ Assigné', value: autoAssignedMember ? `<@${autoAssignedMember.id}>` : 'Non assigné', inline: true },
                )
                .setTimestamp()
              ] }).catch(() => {});
            }
          }

          // Effacer l'interaction de sélection (le menu priorité disparaît)
          await interaction.editReply({ content: '', embeds: [], components: [] }).catch(() => {});

          // Confirmer en éphémère
          return interaction.followUp({
            embeds: [new EmbedBuilder()
              .setColor('#2ECC71')
              .setTitle('✅ Ticket ouvert !')
              .setDescription(`Ton ticket est prêt : ${ticketChannel}\n\nLe staff sera notifié et te répondra rapidement.\n\n> ⏱️ Temps de réponse estimé : **${etaText}**`)
              .addFields({ name: '🎟️ Référence', value: `\`Ticket #${ticketNumber}\``, inline: true })
              .setFooter({ text: `${cat.label} • ${pri.label}` })
            ],
            ephemeral: true,
          });

        } catch (err) {
          console.error('[TICKET] Erreur création ticket:', err);
          return interaction.followUp({
            embeds: [new EmbedBuilder()
              .setColor('#E74C3C')
              .setTitle('❌ Création du ticket impossible')
              .setDescription(
                'Une erreur est survenue. Causes fréquentes :\n\n' +
                '• Le bot manque de la permission **Gérer les salons**\n' +
                '• La **catégorie Discord** pour les tickets n\'existe pas\n' +
                '• Le serveur a atteint la **limite de 500 salons**\n\n' +
                '> Lance `/ticket setup` pour reconfigurer, puis réessaie.\n\n' +
                `\`\`\`${err.message?.slice(0, 200) || 'Erreur inconnue'}\`\`\``
              )
            ],
            ephemeral: true,
          }).catch(() => {});
        }
      }

      // Le menu /help est géré dans le collecteur interne à help.js
    }

    // ── STRING SELECT MENUS (suite) — Réponses rapides ticket + Notation ──
    if (interaction.isStringSelectMenu()) {
      const db2 = require('../database/db');

      // ── Quick Reply envoi ──
      if (interaction.customId.startsWith('ticket_qr_select_')) {
        const ticketId = parseInt(interaction.customId.replace('ticket_qr_select_', ''));
        const ticket   = db2.db.prepare('SELECT * FROM tickets WHERE id=?').get(ticketId);
        if (!ticket) return interaction.reply({ content: '❌ Ticket introuvable.', ephemeral: true });

        const channel = interaction.guild.channels.cache.get(ticket.channel_id);
        if (!channel) return interaction.reply({ content: '❌ Salon introuvable.', ephemeral: true });

        const value = interaction.values[0];

        // Map des réponses rapides par défaut
        const QR_MESSAGES = {
          qr_welcome:    `👋 Bonjour <@${ticket.user_id}> ! Je suis **${interaction.member.displayName}** et je vais m'occuper de ta demande. Décris-moi ton problème en détail, je t'aide dès que possible !`,
          qr_wait:       `⏳ Merci pour ta patience <@${ticket.user_id}> ! Nous examinons ta demande et te revenons dès que possible.`,
          qr_screenshot: `📷 Pourrais-tu nous fournir des **captures d'écran** ou tout autre élément visuel pour mieux comprendre ton problème ? Merci !`,
          qr_info:       `🔄 Pourriez-vous nous fournir plus de détails ?\n\n• Version concernée / contexte\n• Étapes pour reproduire le problème\n• Ce que vous avez déjà essayé\n• Messages d'erreur éventuels`,
          qr_resolved:   `✅ Il semble que le problème soit résolu ! Si tu as d'autres questions, n'hésite pas à demander. Sinon, nous allons fermer ce ticket prochainement. Merci d'avoir contacté le support !`,
          qr_closing:    `🔒 <@${ticket.user_id}> — Ce ticket va être **fermé prochainement** faute d'activité. Si tu as encore besoin d'aide, envoie un message maintenant !`,
        };

        let msgContent;

        if (value.startsWith('qr_custom_')) {
          // Réponse personnalisée du serveur
          const customId = parseInt(value.replace('qr_custom_', ''));
          const customReply = db2.db.prepare('SELECT * FROM ticket_quick_replies WHERE id=? AND guild_id=?')
            .get(customId, interaction.guildId);
          if (!customReply) return interaction.reply({ content: '❌ Réponse introuvable.', ephemeral: true });
          // Remplacer {user} par la mention
          msgContent = customReply.content.replace(/\{user\}/g, `<@${ticket.user_id}>`);
        } else {
          msgContent = QR_MESSAGES[value];
        }

        if (!msgContent) return interaction.reply({ content: '❌ Réponse inconnue.', ephemeral: true });

        await channel.send({ content: msgContent }).catch(() => {});

        return interaction.update({
          embeds: [new EmbedBuilder()
            .setColor('#2ECC71')
            .setDescription(`✅ Réponse rapide envoyée dans <#${ticket.channel_id}>.`)
          ],
          components: [],
        });
      }

      if (interaction.customId.startsWith('ticket_rate_select_')) {
        const ticketId = parseInt(interaction.customId.replace('ticket_rate_select_', ''));
        const rating   = parseInt(interaction.values[0]);
        const ticket   = db2.db.prepare('SELECT * FROM tickets WHERE id=?').get(ticketId);
        if (!ticket) return interaction.reply({ content: '❌ Ticket introuvable.', ephemeral: true });

        if (interaction.user.id !== ticket.user_id) {
          return interaction.reply({ content: '❌ Seul le créateur du ticket peut évaluer le support.', ephemeral: true });
        }

        db2.db.prepare('UPDATE tickets SET rating=? WHERE id=?').run(rating, ticketId);

        const ratingColors  = { 1: '#E74C3C', 2: '#E67E22', 3: '#F1C40F', 4: '#9ACD32', 5: '#2ECC71' };
        const ratingLabels  = { 1: '😡 Très insatisfait', 2: '😕 Insatisfait', 3: '😐 Neutre', 4: '🙂 Satisfait', 5: '😄 Excellent !' };
        const ratingMessages = {
          1: 'Nous sommes vraiment désolés de ne pas avoir répondu à tes attentes. Nous allons faire mieux.',
          2: 'Merci pour ton retour. Nous allons travailler à améliorer notre support.',
          3: 'Merci ! Nous visons l\'excellence et continuerons à nous améliorer.',
          4: 'Super ! Merci pour ce retour positif, ça nous encourage !',
          5: 'Incroyable, merci beaucoup ! Ça motive toute l\'équipe ! 🎉',
        };
        const stars = '⭐'.repeat(rating);

        // Log dans le salon des logs
        try {
          const cfgData = db2.getConfig(ticket.guild_id);
          if (cfgData?.ticket_log_channel) {
            const logCh = interaction.guild.channels.cache.get(cfgData.ticket_log_channel);
            if (logCh) {
              await logCh.send({
                embeds: [new EmbedBuilder()
                  .setColor(ratingColors[rating])
                  .setAuthor({ name: `Évaluation — ${ratingLabels[rating]}`, iconURL: interaction.user.displayAvatarURL() })
                  .setTitle(`${stars} ${rating}/5 — Ticket #${ticketId}`)
                  .addFields(
                    { name: '👤 Client',   value: `<@${ticket.user_id}>`, inline: true },
                    { name: '⭐ Note',     value: `**${rating}/5**`,      inline: true },
                    { name: '🎫 Ticket',  value: `\`#${ticketId}\``,     inline: true },
                  )
                  .setFooter({ text: ratingMessages[rating] })
                  .setTimestamp()
                ]
              }).catch(() => {});
            }
          }
        } catch {}

        await interaction.update({
          embeds: [new EmbedBuilder()
            .setColor(ratingColors[rating])
            .setTitle(`${stars} ${rating}/5 — Merci pour ton évaluation !`)
            .setDescription(
              `**${ratingLabels[rating]}**\n\n` +
              `> ${ratingMessages[rating]}\n\n` +
              `Ce salon va être supprimé dans **3 secondes**...`
            )
            .setFooter({ text: `${interaction.guild.name} • Merci d'avoir utilisé notre support !` })
          ],
          components: [],
        }).catch(() => {});

        setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
        return;
      }
    }

    // ── MENUS CONTEXTUELS (clic droit) ───────────────────
    if (interaction.isUserContextMenuCommand() || interaction.isMessageContextMenuCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error(`[MENU] Erreur "${interaction.commandName}":`, error);
        const reply = { content: '❌ Une erreur est survenue.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply(reply).catch(() => {});
        } else {
          await interaction.reply(reply).catch(() => {});
        }
      }
      return;
    }

    // ── MODALS ────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      const db = require('../database/db');
      const customId = interaction.customId;

      // Signalement de message
      if (customId.startsWith('report_msg_')) {
        const msgId = customId.replace('report_msg_', '');
        const raison = interaction.fields.getTextInputValue('raison');
        const cfg = db.getConfig(interaction.guildId);
        const logCh = cfg.log_channel ? interaction.guild.channels.cache.get(cfg.log_channel) : null;
        const ticketCh = cfg.ticket_log_channel ? interaction.guild.channels.cache.get(cfg.ticket_log_channel) : null;
        const targetCh = logCh || ticketCh;

        const { EmbedBuilder } = require('discord.js');
        const reportEmbed = new EmbedBuilder()
          .setColor('Red')
          .setTitle('🚨 Signalement de message')
          .addFields(
            { name: '👤 Signalé par', value: `<@${interaction.user.id}>`, inline: true },
            { name: '📋 Raison', value: raison, inline: true },
            { name: '🆔 ID Message', value: msgId, inline: true },
            { name: '💬 Salon', value: `<#${interaction.channelId}>`, inline: true },
          )
          .setTimestamp();

        if (targetCh) await targetCh.send({ embeds: [reportEmbed] }).catch(() => {});
        return interaction.reply({ content: '✅ Ton signalement a été transmis aux modérateurs. Merci !', ephemeral: true });
      }

      // Don de coins via context menu
      if (customId.startsWith('give_coins_ctx_')) {
        const targetId = customId.replace('give_coins_ctx_', '');
        const montant = parseInt(interaction.fields.getTextInputValue('montant'));
        if (isNaN(montant) || montant <= 0) return interaction.reply({ content: '❌ Montant invalide.', ephemeral: true });

        const u = db.getUser(interaction.user.id, interaction.guildId);
        if (u.balance < montant) {
          const cfg = db.getConfig(interaction.guildId);
          return interaction.reply({ content: `❌ Tu n'as pas assez de ${cfg.currency_emoji || '🪙'}.`, ephemeral: true });
        }

        db.addCoins(interaction.user.id, interaction.guildId, -montant);
        db.addCoins(targetId, interaction.guildId, montant);
        const cfg = db.getConfig(interaction.guildId);
        return interaction.reply({
          content: `✅ Tu as donné **${montant} ${cfg.currency_emoji || '🪙'}** à <@${targetId}> !`,
          ephemeral: true
        });
      }
    }
  }
};
