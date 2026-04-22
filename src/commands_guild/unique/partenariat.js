// ============================================================
// partenariat.js — Système de partenariats v3
// Subcommands clairs + config avec sélecteur de salon/rôle
// ============================================================

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const fs   = require('fs');
const path = require('path');

// ─── Stockage JSON ───────────────────────────────────────────
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
    data[guildId] = { requestChannelId: null, partnerChannelId: null, pubChannelId: null, partnerRoleId: null, partners: [], requests: [], pubCooldowns: {} };
    saveData(data);
  }
  return data[guildId];
}
function updateGuild(guildId, update) {
  const data = loadData();
  if (!data[guildId]) data[guildId] = { requestChannelId: null, partnerChannelId: null, pubChannelId: null, partnerRoleId: null, partners: [], requests: [], pubCooldowns: {} };
  Object.assign(data[guildId], update);
  saveData(data);
}
function genId() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }
function isAdmin(member) { return member.permissions.has(PermissionFlagsBits.Administrator) || member.permissions.has(PermissionFlagsBits.ManageGuild); }
function getPartner(userId, guildId) { return getGuild(guildId).partners.find(p => p.repUserId === userId) || null; }

const C_MAIN = 0x5865F2, C_GREEN = 0x57F287, C_RED = 0xED4245, C_GOLD = 0xFEE75C, C_ADMIN = 0xEB459E;

// ============================================================
// SLASH COMMAND
// ============================================================
module.exports = {
  data: new SlashCommandBuilder()
    .setName('partenariat')
    .setDescription('🤝 Système de partenariats du serveur')

    // ── Utilisateurs ─────────────────────────────────────────
    .addSubcommand(s => s.setName('liste').setDescription('📋 Voir tous les serveurs partenaires'))
    .addSubcommand(s => s.setName('demander').setDescription('📥 Soumettre une demande de partenariat'))
    .addSubcommand(s => s.setName('statut').setDescription('🔍 Voir l\'état de ma demande de partenariat'))
    .addSubcommand(s => s.setName('pub').setDescription('📢 Envoyer une publication (partenaires uniquement)'))

    // ── Config Admin (salon sélectionnable directement) ───────
    .addSubcommand(s => s
      .setName('config-salon-demandes')
      .setDescription('⚙️ [ADMIN] Salon où arrivent les demandes de partenariat')
      .addChannelOption(o => o.setName('salon').setDescription('Choisir le salon').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(s => s
      .setName('config-salon-partenaires')
      .setDescription('⚙️ [ADMIN] Salon où sont annoncés les nouveaux partenaires')
      .addChannelOption(o => o.setName('salon').setDescription('Choisir le salon').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(s => s
      .setName('config-salon-pub')
      .setDescription('⚙️ [ADMIN] Salon pour les publications des partenaires')
      .addChannelOption(o => o.setName('salon').setDescription('Choisir le salon').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(s => s
      .setName('config-role')
      .setDescription('⚙️ [ADMIN] Rôle attribué automatiquement aux partenaires')
      .addRoleOption(o => o.setName('role').setDescription('Choisir le rôle').setRequired(true)))
    .addSubcommand(s => s.setName('config-voir').setDescription('⚙️ [ADMIN] Voir toute la configuration actuelle'))

    // ── Admin : gérer demandes ────────────────────────────────
    .addSubcommand(s => s.setName('admin-demandes').setDescription('📨 [ADMIN] Voir les demandes en attente'))
    .addSubcommand(s => s
      .setName('admin-valider')
      .setDescription('✅ [ADMIN] Accepter une demande')
      .addStringOption(o => o.setName('id').setDescription('ID de la demande').setRequired(true)))
    .addSubcommand(s => s
      .setName('admin-refuser')
      .setDescription('❌ [ADMIN] Refuser une demande')
      .addStringOption(o => o.setName('id').setDescription('ID de la demande').setRequired(true))
      .addStringOption(o => o.setName('raison').setDescription('Raison du refus (optionnel)').setRequired(false)))
    .addSubcommand(s => s.setName('admin-ajouter').setDescription('➕ [ADMIN] Ajouter un partenaire directement (sans demande)'))
    .addSubcommand(s => s
      .setName('admin-retirer')
      .setDescription('➖ [ADMIN] Retirer un partenaire')
      .addStringOption(o => o.setName('id').setDescription('ID du partenaire (voir /partenariat admin-liste)').setRequired(true)))
    .addSubcommand(s => s.setName('admin-liste').setDescription('📋 [ADMIN] Liste des partenaires avec leurs IDs')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const g = getGuild(interaction.guildId);
    const adminSubs = ['config-salon-demandes','config-salon-partenaires','config-salon-pub','config-role','config-voir','admin-demandes','admin-valider','admin-refuser','admin-ajouter','admin-retirer','admin-liste'];

    if (adminSubs.includes(sub) && !isAdmin(interaction.member)) {
      return interaction.editReply({ content: '🔒 Cette commande est réservée aux administrateurs.', ephemeral: true });
    }

    // ── /partenariat liste ────────────────────────────────────
    if (sub === 'liste') {
      if (!g.partners.length) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(C_GOLD).setTitle('📋 Partenaires').setDescription('Aucun serveur partenaire pour le moment.\n\nUtilise `/partenariat demander` pour faire une demande !').setTimestamp()], ephemeral: true });
      }
      const lines = g.partners.map((p, i) => `\`${String(i+1).padStart(2,'0')}\` **${p.nom}**\n> 🔗 ${p.invite}\n> ${p.description?.slice(0,80) || 'Aucune description'}`).join('\n\n');
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(C_MAIN).setTitle(`🤝 Serveurs Partenaires — ${g.partners.length}`).setDescription(lines.slice(0,4000)).setFooter({ text: 'Pour rejoindre : /partenariat demander' }).setTimestamp()], ephemeral: true });
    }

    // ── /partenariat demander ─────────────────────────────────
    if (sub === 'demander') {
      const pending = g.requests.find(r => r.submittedBy === interaction.user.id && r.status === 'pending');
      if (pending) return interaction.editReply({ content: `⏳ Tu as déjà une demande en attente (\`${pending.id}\`). Utilise \`/partenariat statut\` pour la suivre.`, ephemeral: true });
      const already = getPartner(interaction.user.id, interaction.guildId);
      if (already) return interaction.editReply({ content: `✅ Tu représentes déjà **${already.nom}** ! Utilise \`/partenariat pub\` pour envoyer une pub.`, ephemeral: true });

      const modal = new ModalBuilder().setCustomId('part_modal_demande').setTitle('📥 Demande de partenariat').addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nom').setLabel('📛 Nom de votre serveur').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100).setPlaceholder('Ex: Gaming Paradise')),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('invite').setLabel('🔗 Lien d\'invitation (discord.gg/...)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('https://discord.gg/monserveur')),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('📝 Description de votre serveur (max 300 chars)').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(300).setPlaceholder('Parlez de votre communauté, thème, activités...')),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('membres').setLabel('👥 Nombre de membres approximatif').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('Ex: 500 membres')),
      );
      return interaction.showModal(modal);
    }

    // ── /partenariat statut ───────────────────────────────────
    if (sub === 'statut') {
      const partner = getPartner(interaction.user.id, interaction.guildId);
      if (partner) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(C_GREEN).setTitle('✅ Tu es partenaire !').setDescription(`Tu représentes **${partner.nom}**.\n🔗 ${partner.invite}\n\n📢 Envoie une pub avec \`/partenariat pub\` (1 fois/24h).`).setTimestamp()], ephemeral: true });
      }
      const req = g.requests.filter(r => r.submittedBy === interaction.user.id).sort((a,b) => b.submittedAt - a.submittedAt)[0];
      if (!req) return interaction.editReply({ content: '📋 Aucune demande en cours. Utilise `/partenariat demander` !', ephemeral: true });

      const statusMap = {
        pending:  { emoji: '⏳', label: 'En attente de traitement', color: C_GOLD },
        accepted: { emoji: '✅', label: 'Acceptée', color: C_GREEN },
        refused:  { emoji: '❌', label: 'Refusée',  color: C_RED },
      };
      const s = statusMap[req.status];
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(s.color).setTitle('🔍 État de ta demande')
          .addFields(
            { name: 'Serveur', value: req.nom,                                       inline: true },
            { name: 'Statut',  value: `${s.emoji} ${s.label}`,                       inline: true },
            { name: 'ID',      value: `\`${req.id}\``,                               inline: true },
            { name: 'Soumise', value: `<t:${Math.floor(req.submittedAt/1000)}:R>`,   inline: true },
          )
          .setDescription(req.refusRaison ? `**Raison du refus :** ${req.refusRaison}` : '')
          .setTimestamp()],
        ephemeral: true,
      });
    }

    // ── /partenariat pub ──────────────────────────────────────
    if (sub === 'pub') {
      const partner = getPartner(interaction.user.id, interaction.guildId);
      if (!partner) return interaction.editReply({ content: '❌ Seuls les représentants partenaires peuvent envoyer une pub. Fais une demande avec `/partenariat demander`.', ephemeral: true });
      if (!g.pubChannelId) return interaction.editReply({ content: '❌ Aucun salon pub configuré. Contacte un administrateur.', ephemeral: true });

      const lastPub = g.pubCooldowns[interaction.user.id] || 0;
      const diff = Date.now() - lastPub;
      if (diff < 86400000) {
        const heures = Math.ceil((86400000 - diff) / 3600000);
        return interaction.editReply({ content: `⏳ Tu peux envoyer une nouvelle pub dans **${heures}h**.`, ephemeral: true });
      }

      const modal = new ModalBuilder().setCustomId('part_modal_pub').setTitle('📢 Envoyer une publication').addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('message').setLabel('Votre message (événements, nouveautés, etc.)').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000).setPlaceholder('Parlez de votre serveur, vos événements du moment...')),
      );
      return interaction.showModal(modal);
    }

    // ── Config admins ─────────────────────────────────────────
    if (sub === 'config-salon-demandes') {
      const ch = interaction.options.getChannel('salon');
      updateGuild(interaction.guildId, { requestChannelId: ch.id });
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(C_GREEN).setTitle('✅ Salon configuré').setDescription(`📨 Les demandes arriveront dans <#${ch.id}>.`).setTimestamp()], ephemeral: true });
    }
    if (sub === 'config-salon-partenaires') {
      const ch = interaction.options.getChannel('salon');
      updateGuild(interaction.guildId, { partnerChannelId: ch.id });
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(C_GREEN).setTitle('✅ Salon configuré').setDescription(`🤝 Les nouveaux partenaires seront annoncés dans <#${ch.id}>.`).setTimestamp()], ephemeral: true });
    }
    if (sub === 'config-salon-pub') {
      const ch = interaction.options.getChannel('salon');
      updateGuild(interaction.guildId, { pubChannelId: ch.id });
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(C_GREEN).setTitle('✅ Salon configuré').setDescription(`📢 Les pubs partenaires iront dans <#${ch.id}>.`).setTimestamp()], ephemeral: true });
    }
    if (sub === 'config-role') {
      const role = interaction.options.getRole('role');
      updateGuild(interaction.guildId, { partnerRoleId: role.id });
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(C_GREEN).setTitle('✅ Rôle configuré').setDescription(`🎭 Le rôle <@&${role.id}> sera donné à chaque nouveau partenaire accepté.`).setTimestamp()], ephemeral: true });
    }
    if (sub === 'config-voir') {
      const pending = g.requests.filter(r => r.status === 'pending').length;
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(C_ADMIN).setTitle('⚙️ Configuration Partenariats').setDescription('Configuration actuelle du système :')
          .addFields(
            { name: '📨 Salon Demandes',    value: g.requestChannelId ? `<#${g.requestChannelId}>`  : '❌ Non configuré — `/partenariat config-salon-demandes`',   inline: false },
            { name: '🤝 Salon Partenaires', value: g.partnerChannelId ? `<#${g.partnerChannelId}>` : '❌ Non configuré — `/partenariat config-salon-partenaires`', inline: false },
            { name: '📢 Salon Pub',         value: g.pubChannelId     ? `<#${g.pubChannelId}>`     : '❌ Non configuré — `/partenariat config-salon-pub`',         inline: false },
            { name: '🎭 Rôle Partenaire',   value: g.partnerRoleId    ? `<@&${g.partnerRoleId}>`   : '❌ Non configuré — `/partenariat config-role`',             inline: false },
            { name: '📊 Stats',             value: `🤝 ${g.partners.length} partenaire(s) | ⏳ ${pending} demande(s) en attente`, inline: false },
          ).setTimestamp()],
        ephemeral: true,
      });
    }

    // ── Admin : demandes ──────────────────────────────────────
    if (sub === 'admin-demandes') {
      const pending = g.requests.filter(r => r.status === 'pending');
      if (!pending.length) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(C_GREEN).setTitle('📨 Demandes').setDescription('✅ Aucune demande en attente !').setTimestamp()], ephemeral: true });

      await interaction.deferReply({ ephemeral: true });
      for (const req of pending.slice(0, 5)) {
        const embed = new EmbedBuilder().setColor(C_GOLD)
          .setTitle(`📨 Demande \`${req.id}\` — ${req.nom}`)
          .setDescription(req.description || 'Aucune description')
          .addFields(
            { name: '🔗 Invitation', value: req.invite, inline: true },
            { name: '👤 Soumis par', value: `<@${req.submittedBy}>`, inline: true },
            { name: '👥 Membres',    value: req.membres || 'Non précisé', inline: true },
            { name: '📅 Date',       value: `<t:${Math.floor(req.submittedAt/1000)}:R>`, inline: true },
          )
          .setFooter({ text: `Valider: /partenariat admin-valider id:${req.id}  |  Refuser: /partenariat admin-refuser id:${req.id}` }).setTimestamp();
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`part_valider_${req.id}`).setLabel('✅ Valider').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`part_refuser_${req.id}`).setLabel('❌ Refuser').setStyle(ButtonStyle.Danger),
        );
        await interaction.followUp({ embeds: [embed], components: [row], ephemeral: true });
      }
      if (pending.length > 5) await interaction.followUp({ content: `📌 *${pending.length - 5} demande(s) supplémentaire(s). Traitez d'abord les 5 premières.*`, ephemeral: true });
      return;
    }

    if (sub === 'admin-valider') {
      return validerDemande(interaction, interaction.options.getString('id').toUpperCase().trim(), g);
    }
    if (sub === 'admin-refuser') {
      return refuserDemande(interaction, interaction.options.getString('id').toUpperCase().trim(), interaction.options.getString('raison') || null, g);
    }

    if (sub === 'admin-ajouter') {
      const modal = new ModalBuilder().setCustomId('part_modal_ajouter').setTitle('➕ Ajouter un partenaire').addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nom').setLabel('Nom du serveur').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('invite').setLabel('Lien d\'invitation').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(300)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('representant_id').setLabel('ID Discord du représentant (optionnel)').setStyle(TextInputStyle.Short).setRequired(false)),
      );
      return interaction.showModal(modal);
    }

    if (sub === 'admin-retirer') {
      const partnerId = interaction.options.getString('id').toUpperCase().trim();
      const idx = g.partners.findIndex(p => p.id === partnerId);
      if (idx === -1) return interaction.editReply({ content: `❌ Partenaire \`${partnerId}\` introuvable. Voir \`/partenariat admin-liste\`.`, ephemeral: true });
      const [removed] = g.partners.splice(idx, 1);
      updateGuild(interaction.guildId, { partners: g.partners });
      if (g.partnerRoleId && removed.repUserId) {
        try { const m = await interaction.guild.members.fetch(removed.repUserId).catch(() => null); if (m) await m.roles.remove(g.partnerRoleId).catch(() => {}); } catch {}
      }
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(C_RED).setTitle('➖ Partenaire retiré').setDescription(`**${removed.nom}** retiré.${removed.repUserId ? ` Rôle retiré de <@${removed.repUserId}>.` : ''}`).setTimestamp()], ephemeral: true });
    }

    if (sub === 'admin-liste') {
      if (!g.partners.length) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(C_GOLD).setTitle('📋 Partenaires').setDescription('Aucun partenaire.').setTimestamp()], ephemeral: true });
      const lines = g.partners.map((p, i) => `\`${String(i+1).padStart(2,'0')}\` **${p.nom}** | ID: \`${p.id}\` | Rep: ${p.repUserId ? `<@${p.repUserId}>` : '*aucun*'}\n> 🔗 ${p.invite}`).join('\n');
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(C_ADMIN).setTitle(`📋 Partenaires Admin — ${g.partners.length}`).setDescription(lines.slice(0,4000)).setFooter({ text: 'Retirer: /partenariat admin-retirer id:<ID>' }).setTimestamp()], ephemeral: true });
    }
  },

  // ── Handler boutons & modals ──────────────────────────────
  async handleComponent(interaction) {
    const id = interaction.customId;

    if (id.startsWith('part_valider_')) {
      if (!isAdmin(interaction.member)) return interaction.editReply({ content: '🔒 Admins uniquement.', ephemeral: true });
      return validerDemande(interaction, id.replace('part_valider_', ''), getGuild(interaction.guildId));
    }
    if (id.startsWith('part_refuser_')) {
      if (!isAdmin(interaction.member)) return interaction.editReply({ content: '🔒 Admins uniquement.', ephemeral: true });
      return refuserDemande(interaction, id.replace('part_refuser_', ''), null, getGuild(interaction.guildId));
    }

    if (interaction.isModalSubmit()) {
      if (id === 'part_modal_demande') return submitDemande(interaction);
      if (id === 'part_modal_ajouter') return submitAjouter(interaction);
      if (id === 'part_modal_pub')     return submitPub(interaction);
    }
  },

  name: 'partenariat',
  aliases: ['partner', 'partners', 'part'],
  async run(message) {
    const g = getGuild(message.guildId);
    const lines = g.partners.map((p, i) => `\`${i+1}.\` **${p.nom}** — ${p.invite}`).join('\n') || 'Aucun partenaire.';
    await message.reply({ embeds: [new EmbedBuilder().setColor(C_MAIN).setTitle('🤝 Partenaires').setDescription(lines).setTimestamp()] });
  },
};

// ============================================================
// FONCTIONS INTERNES
// ============================================================

async function submitDemande(interaction) {
  const nom         = interaction.fields.getTextInputValue('nom').trim();
  const invite      = interaction.fields.getTextInputValue('invite').trim();
  const description = interaction.fields.getTextInputValue('description').trim();
  const membres     = interaction.fields.getTextInputValue('membres')?.trim() || null;

  if (!invite.includes('discord.gg/') && !invite.includes('discord.com/invite/')) {
    return interaction.editReply({ content: '❌ Le lien doit être un lien Discord valide (discord.gg/...).', ephemeral: true });
  }

  const g = getGuild(interaction.guildId);
  if (g.requests.find(r => r.submittedBy === interaction.user.id && r.status === 'pending')) {
    return interaction.editReply({ content: '⏳ Tu as déjà une demande en attente.', ephemeral: true });
  }
  if (g.partners.some(p => p.nom.toLowerCase() === nom.toLowerCase())) {
    return interaction.editReply({ content: `❌ **${nom}** est déjà partenaire !`, ephemeral: true });
  }

  const id = genId();
  g.requests.push({ id, nom, invite, description, membres, submittedBy: interaction.user.id, submittedAt: Date.now(), status: 'pending', refusRaison: null });
  updateGuild(interaction.guildId, { requests: g.requests });

  if (g.requestChannelId) {
    const chan = interaction.guild.channels.cache.get(g.requestChannelId);
    if (chan) {
      const embed = new EmbedBuilder().setColor(C_GOLD).setTitle(`📨 Nouvelle demande \`${id}\` — ${nom}`).setDescription(description)
        .addFields(
          { name: '🔗 Invitation', value: invite, inline: true },
          { name: '👤 Soumis par', value: `<@${interaction.user.id}>`, inline: true },
          { name: '👥 Membres',    value: membres || 'Non précisé', inline: true },
        )
        .setFooter({ text: `Valider: /partenariat admin-valider id:${id}  |  Refuser: /partenariat admin-refuser id:${id}` }).setTimestamp();
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`part_valider_${id}`).setLabel('✅ Valider').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`part_refuser_${id}`).setLabel('❌ Refuser').setStyle(ButtonStyle.Danger),
      );
      await chan.send({ embeds: [embed], components: [row] }).catch(() => {});
    }
  }

  return interaction.editReply({
    embeds: [new EmbedBuilder().setColor(C_GREEN).setTitle('✅ Demande envoyée !').setDescription(`Demande pour **${nom}** soumise avec succès !\n**ID :** \`${id}\`\n\nSuivi : \`/partenariat statut\` 🙏`).setTimestamp()],
    ephemeral: true,
  });
}

async function submitAjouter(interaction) {
  const nom   = interaction.fields.getTextInputValue('nom').trim();
  const invite = interaction.fields.getTextInputValue('invite').trim();
  const description = interaction.fields.getTextInputValue('description').trim();
  const repId = interaction.fields.getTextInputValue('representant_id')?.trim() || null;

  const g = getGuild(interaction.guildId);
  if (g.partners.some(p => p.nom.toLowerCase() === nom.toLowerCase())) {
    return interaction.editReply({ content: `❌ **${nom}** est déjà partenaire.`, ephemeral: true });
  }

  const id = genId();
  g.partners.push({ id, nom, invite, description, repUserId: repId, addedAt: Date.now(), addedBy: interaction.user.id });
  updateGuild(interaction.guildId, { partners: g.partners });

  if (g.partnerRoleId && repId) {
    try { const m = await interaction.guild.members.fetch(repId).catch(() => null); if (m) await m.roles.add(g.partnerRoleId).catch(() => {}); } catch {}
  }
  if (g.partnerChannelId) {
    const chan = interaction.guild.channels.cache.get(g.partnerChannelId);
    if (chan) await chan.send({ embeds: [new EmbedBuilder().setColor(C_GREEN).setTitle(`🎉 Nouveau Partenaire — ${nom}`).setDescription(`${description}\n\n🔗 **Rejoindre :** ${invite}`).setTimestamp()] }).catch(() => {});
  }

  return interaction.editReply({ embeds: [new EmbedBuilder().setColor(C_GREEN).setTitle('✅ Partenaire ajouté !').setDescription(`**${nom}** ajouté. 🎉${repId ? ` Rôle donné à <@${repId}>.` : ''}`).setTimestamp()], ephemeral: true });
}

async function submitPub(interaction) {
  const message = interaction.fields.getTextInputValue('message').trim();
  const g = getGuild(interaction.guildId);
  const partner = getPartner(interaction.user.id, interaction.guildId);
  const pubChannel = interaction.guild.channels.cache.get(g.pubChannelId);
  if (!pubChannel) return interaction.editReply({ content: '❌ Salon pub introuvable.', ephemeral: true });

  const embed = new EmbedBuilder().setColor(0x9B59B6).setTitle(`📢 ${partner?.nom || 'Serveur Partenaire'}`).setDescription(message)
    .addFields({ name: '🔗 Rejoindre', value: partner?.invite || '-', inline: true })
    .setFooter({ text: `Pub par ${interaction.user.tag}` }).setTimestamp();

  await pubChannel.send({ embeds: [embed] }).catch(() => {});
  g.pubCooldowns[interaction.user.id] = Date.now();
  updateGuild(interaction.guildId, { pubCooldowns: g.pubCooldowns });
  return interaction.editReply({ content: `✅ Pub envoyée dans <#${g.pubChannelId}> !`, ephemeral: true });
}

async function validerDemande(interaction, reqId, g) {
  const idx = g.requests.findIndex(r => r.id === reqId && r.status === 'pending');
  if (idx === -1) return interaction.editReply({ content: `❌ Demande \`${reqId}\` introuvable ou déjà traitée.`, ephemeral: true });

  const req = g.requests[idx];
  req.status = 'accepted';
  const partner = { id: genId(), nom: req.nom, invite: req.invite, description: req.description, repUserId: req.submittedBy, addedAt: Date.now(), addedBy: interaction.user.id };
  g.partners.push(partner);
  updateGuild(interaction.guildId, { requests: g.requests, partners: g.partners });

  if (g.partnerRoleId) {
    try { const m = await interaction.guild.members.fetch(req.submittedBy).catch(() => null); if (m) await m.roles.add(g.partnerRoleId).catch(() => {}); } catch {}
  }
  try {
    const user = await interaction.client.users.fetch(req.submittedBy).catch(() => null);
    if (user) await user.send({ embeds: [new EmbedBuilder().setColor(C_GREEN).setTitle('🎉 Partenariat accepté !').setDescription(`Votre demande pour **${req.nom}** sur **${interaction.guild.name}** a été **acceptée** !\n\nEnvoie une pub avec \`/partenariat pub\`. 📢`).setTimestamp()] }).catch(() => {});
  } catch {}
  if (g.partnerChannelId) {
    const chan = interaction.guild.channels.cache.get(g.partnerChannelId);
    if (chan) await chan.send({ embeds: [new EmbedBuilder().setColor(C_GREEN).setTitle(`🎉 Nouveau Partenaire — ${req.nom}`).setDescription(`${req.description}\n\n🔗 **Rejoindre :** ${req.invite}`).setTimestamp()] }).catch(() => {});
  }
  if (interaction.message) await interaction.message.edit({ components: [] }).catch(() => {});
  return interaction.editReply({ embeds: [new EmbedBuilder().setColor(C_GREEN).setTitle('✅ Partenariat accepté !').setDescription(`**${req.nom}** est maintenant partenaire ! 🎉\nLe demandeur a été notifié par DM.`).setTimestamp()], ephemeral: true });
}

async function refuserDemande(interaction, reqId, raison, g) {
  const idx = g.requests.findIndex(r => r.id === reqId && r.status === 'pending');
  if (idx === -1) return interaction.editReply({ content: `❌ Demande \`${reqId}\` introuvable ou déjà traitée.`, ephemeral: true });

  g.requests[idx].status = 'refused';
  g.requests[idx].refusRaison = raison;
  updateGuild(interaction.guildId, { requests: g.requests });

  try {
    const user = await interaction.client.users.fetch(g.requests[idx].submittedBy).catch(() => null);
    if (user) await user.send({ embeds: [new EmbedBuilder().setColor(C_RED).setTitle('❌ Demande refusée').setDescription(`Votre demande pour **${g.requests[idx].nom}** sur **${interaction.guild.name}** a été refusée.${raison ? `\n\n**Raison :** ${raison}` : ''}`).setTimestamp()] }).catch(() => {});
  } catch {}
  if (interaction.message) await interaction.message.edit({ components: [] }).catch(() => {});
  return interaction.editReply({ embeds: [new EmbedBuilder().setColor(C_RED).setTitle('❌ Demande refusée').setDescription(`Demande de **${g.requests[idx].nom}** refusée.${raison ? ` Raison : ${raison}` : ''}\nDemandeur notifié par DM.`).setTimestamp()], ephemeral: true });
}
