// ============================================================
// partenariat.js — Système de partenariats COMPLET v2
// Menus interactifs, Modal de demande, Panel Admin animé
// ============================================================

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const fs   = require('fs');
const path = require('path');

// ─── Stockage JSON ──────────────────────────────────────────
const DATA_DIR  = path.join(__dirname, '../../../data');
const DATA_FILE = path.join(DATA_DIR, 'partenariats.json');

function loadData() {
  if (!fs.existsSync(DATA_DIR))  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '{}', 'utf8');
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return {}; }
}
function saveData(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8'); }

function getGuild(guildId) {
  const data = loadData();
  if (!data[guildId]) {
    data[guildId] = { requestChannelId: null, partnerChannelId: null, pubChannelId: null, partners: [], requests: [], pubCooldowns: {} };
    saveData(data);
  }
  return data[guildId];
}
function updateGuild(guildId, update) {
  const data = loadData();
  if (!data[guildId]) data[guildId] = { requestChannelId: null, partnerChannelId: null, pubChannelId: null, partners: [], requests: [], pubCooldowns: {} };
  Object.assign(data[guildId], update);
  saveData(data);
}
function genId() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }
function isAdmin(member) { return member.permissions.has(PermissionFlagsBits.Administrator); }
function isPartner(userId, guildId) {
  const g = getGuild(guildId);
  return g.partners.some(p => p.repUserId === userId);
}

// ─── Couleurs & emojis ───────────────────────────────────────
const COLOR_MAIN  = 0x5865F2; // bleu Discord
const COLOR_GREEN = 0x57F287;
const COLOR_RED   = 0xED4245;
const COLOR_GOLD  = 0xFEE75C;
const COLOR_ADMIN = 0xEB459E; // rose admin

// ─── Embeds ──────────────────────────────────────────────────
function embedMain(g) {
  const nb = g.partners.length;
  return new EmbedBuilder()
    .setColor(COLOR_MAIN)
    .setTitle('🤝 Système de Partenariats')
    .setDescription(
      '> Bienvenue dans le gestionnaire de partenariats !\n\n' +
      `📋 **${nb}** serveur${nb !== 1 ? 's' : ''} partenaire${nb !== 1 ? 's' : ''} actif${nb !== 1 ? 's' : ''}\n` +
      '📥 Soumettez votre demande via le menu ci-dessous\n' +
      '📢 Les partenaires peuvent envoyer une pub dans le salon dédié'
    )
    .setFooter({ text: 'Utilisez le menu pour naviguer' })
    .setTimestamp();
}

function embedAdmin(g) {
  const pending = g.requests.filter(r => r.status === 'pending').length;
  return new EmbedBuilder()
    .setColor(COLOR_ADMIN)
    .setTitle('⚙️ Panel Administrateur — Partenariats')
    .setDescription(
      `> Gérez les partenariats de votre serveur\n\n` +
      `📨 Demandes en attente : **${pending}**\n` +
      `🤝 Partenaires actifs : **${g.partners.length}**\n\n` +
      '**Salons configurés :**\n' +
      `• Demandes : ${g.requestChannelId ? `<#${g.requestChannelId}>` : '❌ Non défini'}\n` +
      `• Partenaires : ${g.partnerChannelId ? `<#${g.partnerChannelId}>` : '❌ Non défini'}\n` +
      `• Pub : ${g.pubChannelId ? `<#${g.pubChannelId}>` : '❌ Non défini'}`
    )
    .setFooter({ text: 'Panel Admin — Partenariats' })
    .setTimestamp();
}

// ─── Menus & boutons ────────────────────────────────────────
function rowUserMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('part_menu_user')
      .setPlaceholder('📋 Que souhaitez-vous faire ?')
      .addOptions([
        { label: '📋 Voir les partenaires', value: 'liste',    description: 'Liste de tous nos serveurs partenaires', emoji: '📋' },
        { label: '🔍 Info sur un partenaire', value: 'info',   description: 'Détails d\'un serveur partenaire',        emoji: '🔍' },
        { label: '📥 Faire une demande',      value: 'demander', description: 'Soumettre une demande de partenariat',  emoji: '📥' },
        { label: '📢 Envoyer une pub',         value: 'pub',   description: 'Partenaires uniquement',                  emoji: '📢' },
      ])
  );
}

function rowAdminButtons() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('part_admin_demandes').setLabel('📨 Demandes en attente').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('part_admin_liste').setLabel('🤝 Voir les partenaires').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('part_admin_config').setLabel('⚙️ Configurer les salons').setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('part_admin_ajouter').setLabel('➕ Ajouter directement').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('part_admin_retirer').setLabel('➖ Retirer un partenaire').setStyle(ButtonStyle.Danger),
    ),
  ];
}

// ─── Slash Command ───────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('partenariat')
    .setDescription('🤝 Système de partenariats du serveur'),

  async execute(interaction) {
    const g = getGuild(interaction.guildId);
    const admin = isAdmin(interaction.member);

    const rows = [rowUserMenu()];
    if (admin) {
      rows.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('part_open_admin')
            .setLabel('⚙️ Panel Administrateur')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🛠️')
        )
      );
    }

    await interaction.reply({
      embeds: [embedMain(g)],
      components: rows,
      ephemeral: true,
    });
  },

  // ─── Handler global des composants ────────────────────────
  async handleComponent(interaction) {
    const id = interaction.customId;

    // ── Menu utilisateur ────────────────────────────────────
    if (id === 'part_menu_user') {
      const val = interaction.values[0];
      const guild = interaction.guild;
      const guildId = interaction.guildId;
      const g = getGuild(guildId);

      if (val === 'liste') {
        await showListe(interaction, g);
      } else if (val === 'info') {
        await showInfoPrompt(interaction, g);
      } else if (val === 'demander') {
        await showDemandeModal(interaction);
      } else if (val === 'pub') {
        await handlePubPrompt(interaction, g);
      }
      return;
    }

    // ── Ouvrir panel admin ──────────────────────────────────
    if (id === 'part_open_admin') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({ content: '🔒 Accès administrateur requis.', ephemeral: true });
      }
      const g = getGuild(interaction.guildId);
      await interaction.reply({
        embeds: [embedAdmin(g)],
        components: rowAdminButtons(),
        ephemeral: true,
      });
      return;
    }

    // ── Boutons admin ────────────────────────────────────────
    if (id.startsWith('part_admin_')) {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({ content: '🔒 Accès administrateur requis.', ephemeral: true });
      }
      const g = getGuild(interaction.guildId);
      const action = id.replace('part_admin_', '');

      if (action === 'demandes')      await showDemandesAdmin(interaction, g);
      else if (action === 'liste')    await showListeAdmin(interaction, g);
      else if (action === 'config')   await showConfigAdmin(interaction, g);
      else if (action === 'ajouter')  await showAjouterModal(interaction);
      else if (action === 'retirer')  await showRetirerMenu(interaction, g);
      return;
    }

    // ── Valider demande ──────────────────────────────────────
    if (id.startsWith('part_valider_')) {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({ content: '🔒 Accès administrateur requis.', ephemeral: true });
      }
      await validerDemande(interaction, id.replace('part_valider_', ''));
      return;
    }

    // ── Refuser demande ──────────────────────────────────────
    if (id.startsWith('part_refuser_')) {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({ content: '🔒 Accès administrateur requis.', ephemeral: true });
      }
      await refuserDemande(interaction, id.replace('part_refuser_', ''));
      return;
    }

    // ── Retirer partenaire sélectionné ───────────────────────
    if (id === 'part_select_retirer') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({ content: '🔒 Accès administrateur requis.', ephemeral: true });
      }
      await retirerPartenaire(interaction, interaction.values[0]);
      return;
    }

    // ── Config select salon ───────────────────────────────────
    if (id === 'part_config_type') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({ content: '🔒 Accès administrateur requis.', ephemeral: true });
      }
      await showConfigSalonModal(interaction, interaction.values[0]);
      return;
    }

    // ── Modals ────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      if (id === 'part_modal_demande') {
        await submitDemande(interaction);
      } else if (id === 'part_modal_ajouter') {
        await submitAjouter(interaction);
      } else if (id.startsWith('part_modal_config_')) {
        await submitConfig(interaction, id.replace('part_modal_config_', ''));
      } else if (id === 'part_modal_pub') {
        await submitPub(interaction);
      }
    }
  },

  // ─── Handler prefix ────────────────────────────────────────
  name: 'partenariat',
  aliases: ['partner', 'partners', 'part'],
  async run(message, args) {
    const sub = (args[0] || 'liste').toLowerCase();
    const g = getGuild(message.guildId);

    if (sub === 'liste' || sub === 'list') {
      const lines = g.partners.map((p, i) => `\`${i + 1}.\` **${p.nom}** — ${p.invite}`).join('\n') || 'Aucun partenaire.';
      await message.reply({ embeds: [new EmbedBuilder().setColor(COLOR_MAIN).setTitle('🤝 Partenaires').setDescription(lines).setTimestamp()] });
    } else if (sub === 'admin') {
      if (!isAdmin(message.member)) return message.reply({ content: '🔒 Accès administrateur requis.' });
      await message.reply({ content: '🛠️ Utilisez `/partenariat` pour accéder au panel admin.' });
    } else {
      await message.reply({ content: '📋 Utilisez `/partenariat` pour accéder au système complet.' });
    }
  },
};

// ═══════════════════════════════════════════════════════════
// ─── Sous-fonctions utilisateur ────────────────────────────
// ═══════════════════════════════════════════════════════════

async function showListe(interaction, g) {
  if (!g.partners.length) {
    return interaction.update({
      embeds: [new EmbedBuilder().setColor(COLOR_GOLD).setTitle('📋 Partenaires').setDescription('Aucun serveur partenaire pour le moment.\n\nUtilisez 📥 **Faire une demande** pour rejoindre !').setTimestamp()],
      components: [rowUserMenu()],
    });
  }
  const lines = g.partners.map((p, i) =>
    `\`${String(i + 1).padStart(2, '0')}\` **${p.nom}**\n> 🔗 ${p.invite}${p.description ? `\n> ${p.description.slice(0, 80)}` : ''}`
  ).join('\n\n');

  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setColor(COLOR_MAIN)
        .setTitle(`🤝 Serveurs Partenaires (${g.partners.length})`)
        .setDescription(lines.slice(0, 4000))
        .setFooter({ text: 'Utilisez /partenariat info <nom> pour plus de détails' })
        .setTimestamp(),
    ],
    components: [rowUserMenu()],
  });
}

async function showInfoPrompt(interaction, g) {
  if (!g.partners.length) {
    return interaction.update({
      embeds: [new EmbedBuilder().setColor(COLOR_GOLD).setTitle('🔍 Info partenaire').setDescription('Aucun partenaire enregistré.').setTimestamp()],
      components: [rowUserMenu()],
    });
  }
  const options = g.partners.slice(0, 25).map(p => ({
    label: p.nom.slice(0, 100),
    value: p.id,
    description: (p.description || 'Pas de description').slice(0, 100),
  }));
  await interaction.update({
    embeds: [new EmbedBuilder().setColor(COLOR_MAIN).setTitle('🔍 Choisissez un partenaire').setDescription('Sélectionnez le serveur dont vous voulez voir les infos :').setTimestamp()],
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('part_info_select').setPlaceholder('Choisir un partenaire...').addOptions(options)
      ),
    ],
  });
}

async function showDemandeModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('part_modal_demande')
    .setTitle('📥 Demande de partenariat');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('invite').setLabel('🔗 Lien d\'invitation Discord (discord.gg/...)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('https://discord.gg/...')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('nom').setLabel('📛 Nom de votre serveur').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('description').setLabel('📝 Description (max 300 caractères)').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(300).setPlaceholder('Décrivez votre serveur...')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('banniere').setLabel('🖼️ URL bannière/logo (optionnel)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('https://...')
    ),
  );

  await interaction.showModal(modal);
}

async function handlePubPrompt(interaction, g) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  if (!isPartner(userId, guildId)) {
    return interaction.update({
      embeds: [new EmbedBuilder().setColor(COLOR_RED).setTitle('📢 Pub partenaire').setDescription('❌ Seuls les représentants des serveurs partenaires peuvent envoyer une pub.\n\nFaites une demande de partenariat via 📥 **Faire une demande**.').setTimestamp()],
      components: [rowUserMenu()],
    });
  }

  const modal = new ModalBuilder()
    .setCustomId('part_modal_pub')
    .setTitle('📢 Envoyer une publication');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('message').setLabel('Votre message promotionnel').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000).setPlaceholder('Parlez de votre serveur, événements, nouveautés...')
    ),
  );

  await interaction.showModal(modal);
}

// ═══════════════════════════════════════════════════════════
// ─── Sous-fonctions admin ───────────────────────────────────
// ═══════════════════════════════════════════════════════════

async function showDemandesAdmin(interaction, g) {
  const pending = g.requests.filter(r => r.status === 'pending');

  if (!pending.length) {
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLOR_GREEN).setTitle('📨 Demandes en attente').setDescription('✅ Aucune demande en attente !').setTimestamp()],
      ephemeral: true,
    });
  }

  // Afficher les 5 premières demandes avec boutons valider/refuser
  for (const req of pending.slice(0, 5)) {
    const embed = new EmbedBuilder()
      .setColor(COLOR_GOLD)
      .setTitle(`📨 Demande — ${req.nom}`)
      .setDescription(req.description || 'Pas de description')
      .addFields(
        { name: '🔗 Invitation', value: req.invite,                         inline: true },
        { name: '👤 Soumis par', value: `<@${req.submittedBy}>`,             inline: true },
        { name: '🆔 ID',         value: `\`${req.id}\``,                    inline: true },
        { name: '📅 Date',       value: `<t:${Math.floor(req.submittedAt / 1000)}:R>`, inline: true },
      )
      .setTimestamp();

    if (req.banniere) embed.setThumbnail(req.banniere);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`part_valider_${req.id}`).setLabel('✅ Valider').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`part_refuser_${req.id}`).setLabel('❌ Refuser').setStyle(ButtonStyle.Danger),
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }

  if (pending.length > 5) {
    await interaction.followUp({ content: `📌 *Il y a encore ${pending.length - 5} demande(s) supplémentaire(s).*`, ephemeral: true });
  }
}

async function showListeAdmin(interaction, g) {
  if (!g.partners.length) {
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLOR_GOLD).setTitle('🤝 Partenaires').setDescription('Aucun partenaire enregistré.').setTimestamp()],
      ephemeral: true,
    });
  }
  const lines = g.partners.map((p, i) =>
    `\`${i + 1}.\` **${p.nom}** | Rep: <@${p.repUserId || '?'}> | ID: \`${p.id}\``
  ).join('\n');

  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(COLOR_ADMIN).setTitle(`🤝 Partenaires (${g.partners.length})`).setDescription(lines.slice(0, 4000)).setTimestamp()],
    ephemeral: true,
  });
}

async function showConfigAdmin(interaction, g) {
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('part_config_type')
      .setPlaceholder('Quel salon configurer ?')
      .addOptions([
        { label: '📨 Salon des demandes',    value: 'requests',  description: 'Où arrivent les demandes de partenariat' },
        { label: '🤝 Salon des partenaires', value: 'partners',  description: 'Où s\'affiche la liste des partenaires' },
        { label: '📢 Salon pub',             value: 'pub',       description: 'Où les partenaires envoient leur pub' },
      ])
  );

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(COLOR_ADMIN)
        .setTitle('⚙️ Configuration des salons')
        .setDescription(
          '**Salons actuels :**\n' +
          `• 📨 Demandes : ${g.requestChannelId ? `<#${g.requestChannelId}>` : '❌ Non défini'}\n` +
          `• 🤝 Partenaires : ${g.partnerChannelId ? `<#${g.partnerChannelId}>` : '❌ Non défini'}\n` +
          `• 📢 Pub : ${g.pubChannelId ? `<#${g.pubChannelId}>` : '❌ Non défini'}\n\n` +
          'Sélectionnez le type de salon à configurer :'
        )
        .setTimestamp(),
    ],
    components: [row],
    ephemeral: true,
  });
}

async function showAjouterModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('part_modal_ajouter')
    .setTitle('➕ Ajouter un partenaire');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('nom').setLabel('Nom du serveur').setStyle(TextInputStyle.Short).setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('invite').setLabel('Lien d\'invitation').setStyle(TextInputStyle.Short).setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(300)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('representant_id').setLabel('ID Discord du représentant').setStyle(TextInputStyle.Short).setRequired(false)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('banniere').setLabel('URL bannière (optionnel)').setStyle(TextInputStyle.Short).setRequired(false)
    ),
  );

  await interaction.showModal(modal);
}

async function showRetirerMenu(interaction, g) {
  if (!g.partners.length) {
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLOR_GOLD).setTitle('➖ Retirer un partenaire').setDescription('Aucun partenaire à retirer.').setTimestamp()],
      ephemeral: true,
    });
  }

  const options = g.partners.slice(0, 25).map(p => ({
    label: p.nom.slice(0, 100),
    value: p.id,
    description: p.invite.slice(0, 100),
  }));

  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(COLOR_RED).setTitle('➖ Retirer un partenaire').setDescription('Sélectionnez le partenaire à retirer :').setTimestamp()],
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('part_select_retirer').setPlaceholder('Choisir...').addOptions(options)
      ),
    ],
    ephemeral: true,
  });
}

async function showConfigSalonModal(interaction, type) {
  const labels = { requests: '📨 Salon des demandes', partners: '🤝 Salon des partenaires', pub: '📢 Salon pub' };
  const modal = new ModalBuilder()
    .setCustomId(`part_modal_config_${type}`)
    .setTitle(`⚙️ ${labels[type]}`);

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('channel_id')
        .setLabel('ID du salon (clic droit → Copier l\'ID)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Ex: 1234567890123456789')
    ),
  );

  await interaction.showModal(modal);
}

// ═══════════════════════════════════════════════════════════
// ─── Handlers Modal Submit ─────────────────────────────────
// ═══════════════════════════════════════════════════════════

async function submitDemande(interaction) {
  const invite      = interaction.fields.getTextInputValue('invite').trim();
  const nom         = interaction.fields.getTextInputValue('nom').trim();
  const description = interaction.fields.getTextInputValue('description').trim();
  const banniere    = interaction.fields.getTextInputValue('banniere')?.trim() || null;

  if (!invite.includes('discord.gg/') && !invite.includes('discord.com/invite/')) {
    return interaction.reply({ content: '❌ Le lien d\'invitation doit être un lien Discord valide (discord.gg/...).', ephemeral: true });
  }

  const guildId = interaction.guildId;
  const g = getGuild(guildId);

  const existing = g.requests.find(r => r.submittedBy === interaction.user.id && r.status === 'pending');
  if (existing) {
    return interaction.reply({ content: `⏳ Tu as déjà une demande en attente (ID : \`${existing.id}\`). Attends qu'elle soit traitée.`, ephemeral: true });
  }

  if (g.partners.some(p => p.nom.toLowerCase() === nom.toLowerCase())) {
    return interaction.reply({ content: `❌ **${nom}** est déjà partenaire !`, ephemeral: true });
  }

  const id = genId();
  const request = { id, nom, invite, description, banniere, submittedBy: interaction.user.id, submittedAt: Date.now(), status: 'pending' };
  g.requests.push(request);
  updateGuild(guildId, { requests: g.requests });

  // Notification dans salon demandes si configuré
  if (g.requestChannelId) {
    const reqChannel = interaction.guild.channels.cache.get(g.requestChannelId);
    if (reqChannel) {
      const embed = new EmbedBuilder()
        .setColor(COLOR_GOLD)
        .setTitle(`📨 Nouvelle demande — ${nom}`)
        .setDescription(description)
        .addFields(
          { name: '🔗 Invitation',   value: invite,                inline: true },
          { name: '👤 Soumis par',   value: `<@${interaction.user.id}>`, inline: true },
          { name: '🆔 ID',           value: `\`${id}\``,           inline: true },
        )
        .setFooter({ text: 'Répondez depuis le Panel Admin (/partenariat → ⚙️ Panel Admin)' })
        .setTimestamp();

      if (banniere) embed.setThumbnail(banniere);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`part_valider_${id}`).setLabel('✅ Valider').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`part_refuser_${id}`).setLabel('❌ Refuser').setStyle(ButtonStyle.Danger),
      );

      await reqChannel.send({ embeds: [embed], components: [row] }).catch(() => {});
    }
  }

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(COLOR_GREEN)
        .setTitle('✅ Demande envoyée !')
        .setDescription(`Ta demande de partenariat pour **${nom}** a bien été soumise.\nID : \`${id}\`\n\nUn administrateur va la traiter prochainement. 🙏`)
        .setTimestamp(),
    ],
    ephemeral: true,
  });
}

async function submitAjouter(interaction) {
  const nom           = interaction.fields.getTextInputValue('nom').trim();
  const invite        = interaction.fields.getTextInputValue('invite').trim();
  const description   = interaction.fields.getTextInputValue('description').trim();
  const repId         = interaction.fields.getTextInputValue('representant_id')?.trim() || null;
  const banniere      = interaction.fields.getTextInputValue('banniere')?.trim() || null;

  const guildId = interaction.guildId;
  const g = getGuild(guildId);

  if (g.partners.some(p => p.nom.toLowerCase() === nom.toLowerCase())) {
    return interaction.reply({ content: `❌ **${nom}** est déjà partenaire.`, ephemeral: true });
  }

  const id = genId();
  const partner = { id, nom, invite, description, banniere, repUserId: repId, addedAt: Date.now(), addedBy: interaction.user.id };
  g.partners.push(partner);
  updateGuild(guildId, { partners: g.partners });

  // Post dans salon partenaires si configuré
  if (g.partnerChannelId) {
    const chan = interaction.guild.channels.cache.get(g.partnerChannelId);
    if (chan) {
      const embed = new EmbedBuilder()
        .setColor(COLOR_GREEN)
        .setTitle(`🎉 Nouveau partenaire — ${nom}`)
        .setDescription(description)
        .addFields({ name: '🔗 Rejoindre', value: invite, inline: true })
        .setTimestamp();
      if (banniere) embed.setThumbnail(banniere);
      await chan.send({ embeds: [embed] }).catch(() => {});
    }
  }

  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(COLOR_GREEN).setTitle('✅ Partenaire ajouté !').setDescription(`**${nom}** a été ajouté comme partenaire. 🎉`).setTimestamp()],
    ephemeral: true,
  });
}

async function submitConfig(interaction, type) {
  const channelId = interaction.fields.getTextInputValue('channel_id').trim();
  const chan = interaction.guild.channels.cache.get(channelId);

  if (!chan) {
    return interaction.reply({ content: `❌ Salon introuvable. Vérifie l'ID (clic droit sur le salon → Copier l'ID).`, ephemeral: true });
  }

  const MAP = { requests: 'requestChannelId', partners: 'partnerChannelId', pub: 'pubChannelId' };
  const labels = { requests: '📨 Demandes', partners: '🤝 Partenaires', pub: '📢 Pub' };
  updateGuild(interaction.guildId, { [MAP[type]]: channelId });

  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(COLOR_GREEN).setTitle('✅ Salon configuré !').setDescription(`**${labels[type]}** → <#${channelId}>`).setTimestamp()],
    ephemeral: true,
  });
}

async function submitPub(interaction) {
  const message = interaction.fields.getTextInputValue('message').trim();
  const g = getGuild(interaction.guildId);

  if (!g.pubChannelId) {
    return interaction.reply({ content: '❌ Aucun salon pub configuré. Demandez à un admin.', ephemeral: true });
  }

  const lastPub = g.pubCooldowns[interaction.user.id] || 0;
  const COOLDOWN = 24 * 60 * 60 * 1000;
  const diff = Date.now() - lastPub;
  if (diff < COOLDOWN) {
    const reste = Math.ceil((COOLDOWN - diff) / 3600000);
    return interaction.reply({ content: `⏳ Tu peux renvoyer une pub dans **${reste}h**.`, ephemeral: true });
  }

  const partner = g.partners.find(p => p.repUserId === interaction.user.id);
  const pubChannel = interaction.guild.channels.cache.get(g.pubChannelId);

  if (!pubChannel) {
    return interaction.reply({ content: '❌ Salon pub introuvable. Contactez un admin.', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle(`📢 ${partner?.nom || 'Serveur partenaire'}`)
    .setDescription(message)
    .addFields({ name: '🔗 Rejoindre', value: partner?.invite || '-', inline: true })
    .setFooter({ text: `Pub envoyée par ${interaction.user.tag}` })
    .setTimestamp();

  if (partner?.banniere) embed.setThumbnail(partner.banniere);

  await pubChannel.send({ embeds: [embed] }).catch(() => {});
  g.pubCooldowns[interaction.user.id] = Date.now();
  updateGuild(interaction.guildId, { pubCooldowns: g.pubCooldowns });

  await interaction.reply({ content: `✅ Pub envoyée dans <#${g.pubChannelId}> !`, ephemeral: true });
}

// ─── Valider / Refuser ───────────────────────────────────────
async function validerDemande(interaction, reqId) {
  const guildId = interaction.guildId;
  const g = getGuild(guildId);
  const idx = g.requests.findIndex(r => r.id === reqId && r.status === 'pending');

  if (idx === -1) {
    return interaction.reply({ content: `❌ Demande \`${reqId}\` introuvable ou déjà traitée.`, ephemeral: true });
  }

  const req = g.requests[idx];
  req.status = 'accepted';

  const partner = {
    id: genId(), nom: req.nom, invite: req.invite, description: req.description,
    banniere: req.banniere || null, repUserId: req.submittedBy, addedAt: Date.now(), addedBy: interaction.user.id,
  };
  g.partners.push(partner);
  updateGuild(guildId, { requests: g.requests, partners: g.partners });

  // Post dans salon partenaires
  if (g.partnerChannelId) {
    const chan = interaction.guild.channels.cache.get(g.partnerChannelId);
    if (chan) {
      const embed = new EmbedBuilder()
        .setColor(COLOR_GREEN)
        .setTitle(`🎉 Nouveau partenaire — ${req.nom}`)
        .setDescription(req.description)
        .addFields({ name: '🔗 Rejoindre', value: req.invite, inline: true })
        .setTimestamp();
      if (req.banniere) embed.setThumbnail(req.banniere);
      await chan.send({ embeds: [embed] }).catch(() => {});
    }
  }

  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(COLOR_GREEN).setTitle('✅ Partenariat validé !').setDescription(`**${req.nom}** est maintenant partenaire. 🎉`).setTimestamp()],
    ephemeral: true,
  });
}

async function refuserDemande(interaction, reqId) {
  const g = getGuild(interaction.guildId);
  const idx = g.requests.findIndex(r => r.id === reqId && r.status === 'pending');

  if (idx === -1) {
    return interaction.reply({ content: `❌ Demande \`${reqId}\` introuvable ou déjà traitée.`, ephemeral: true });
  }

  g.requests[idx].status = 'refused';
  updateGuild(interaction.guildId, { requests: g.requests });

  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(COLOR_RED).setTitle('❌ Demande refusée').setDescription(`La demande de **${g.requests[idx].nom}** a été refusée.`).setTimestamp()],
    ephemeral: true,
  });
}

async function retirerPartenaire(interaction, partnerId) {
  const g = getGuild(interaction.guildId);
  const idx = g.partners.findIndex(p => p.id === partnerId);

  if (idx === -1) {
    return interaction.reply({ content: '❌ Partenaire introuvable.', ephemeral: true });
  }

  const [removed] = g.partners.splice(idx, 1);
  updateGuild(interaction.guildId, { partners: g.partners });

  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(COLOR_RED).setTitle('➖ Partenaire retiré').setDescription(`**${removed.nom}** a été retiré des partenaires.`).setTimestamp()],
    ephemeral: true,
  });
}
