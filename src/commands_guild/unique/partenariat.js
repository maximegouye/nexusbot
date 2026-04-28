// ============================================================
// partenariat.js — Système de partenariats v4
// Emplacement : src/commands_guild/admin/partenariat.js
// ============================================================
// FLUX :
//  1. Un représentant tape /partenariat demander
//  2. Un modal s'ouvre (nom serveur, lien, description, pub à poster, nb membres)
//  3. La demande arrive dans le salon demandes (admin)
//  4. Admin clique ✅ Valider →
//     - La pub du partenaire est postée automatiquement dans le salon partenaires
//     - La pub de NexusBot est envoyée en DM au représentant
//     - Le rôle partenaire est donné
//  5. Admin clique ❌ Refuser → DM de refus envoyé
// ============================================================

const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  PermissionFlagsBits, ChannelType,
} = require('discord.js');
const fs   = require('fs');
const path = require('path');

// ─── Stockage JSON ────────────────────────────────────────────
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
    data[guildId] = {
      requestChannelId:  null,  // salon où arrivent les demandes
      partnerChannelId:  null,  // salon où sont postées les pubs des partenaires
      pubChannelId:      null,  // salon pour les pubs ponctuelles des partenaires
      partnerRoleId:     null,  // rôle attribué aux partenaires
      notrePub:          null,  // notre pub à envoyer aux partenaires acceptés
      partners:          [],
      requests:          [],
      pubCooldowns:      {},
    };
    saveData(data);
  }
  return data[guildId];
}

function updateGuild(guildId, update) {
  const data = loadData();
  if (!data[guildId]) getGuild(guildId);
  const fresh = loadData();
  Object.assign(fresh[guildId], update);
  saveData(fresh);
}

function genId() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }
function isAdmin(member) { return member.permissions.has(PermissionFlagsBits.Administrator) || member.permissions.has(PermissionFlagsBits.ManageGuild); }
function getPartnerByUser(userId, guildId) { return getGuild(guildId).partners.find(p => p.repUserId === userId) || null; }

const C_MAIN  = 0x5865F2;
const C_GREEN = 0x57F287;
const C_RED   = 0xED4245;
const C_GOLD  = 0xFEE75C;
const C_ADMIN = 0xEB459E;
const C_DARK  = 0x2C2F33;

// ─── Embed visuel de la pub d'un partenaire ───────────────────
function buildPartnerPubEmbed(partner) {
  return new EmbedBuilder()
    .setColor(C_MAIN)
    .setTitle(`🤝 ${partner.nom}`)
    .setDescription(partner.pub || partner.description || '*Aucune description.*')
    .addFields(
      { name: '🔗 Rejoindre', value: partner.invite, inline: true },
      { name: '👥 Membres',   value: partner.membres || 'Non précisé', inline: true },
    )
    .setFooter({ text: `Partenaire officiel · Ajouté le ${new Date(partner.addedAt).toLocaleDateString('fr-FR')}` })
    .setTimestamp();
}

// ─── Embed de la demande (pour admins) ────────────────────────
function buildRequestEmbed(req, status = 'pending') {
  const colors = { pending: C_GOLD, accepted: C_GREEN, refused: C_RED };
  const labels = { pending: '⏳ En attente', accepted: '✅ Acceptée', refused: '❌ Refusée' };
  return new EmbedBuilder()
    .setColor(colors[status] || C_GOLD)
    .setTitle(`📨 Demande \`${req.id}\` — ${req.nom}`)
    .setDescription([
      '**📢 Publication proposée :**',
      req.pub || req.description || '*Aucune pub fournie.*',
      '',
      '**📝 Description :**',
      req.description || '*Aucune.*',
    ].join('\n'))
    .addFields(
      { name: '🔗 Invitation',  value: req.invite,  inline: true },
      { name: '👤 Soumis par',  value: `<@${req.submittedBy}>`, inline: true },
      { name: '👥 Membres',     value: req.membres || 'Non précisé', inline: true },
      { name: '📅 Date',        value: `<t:${Math.floor(req.submittedAt / 1000)}:R>`, inline: true },
      { name: '🏷️ Statut',     value: labels[status], inline: true },
    )
    .setFooter({ text: `ID: ${req.id} · /partenariat admin-valider ou admin-refuser` })
    .setTimestamp();
}

// ── Boutons valider/refuser ────────────────────────────────────
function buildReviewButtons(reqId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`part_valider_${reqId}`)
      .setLabel('✅ Valider le partenariat')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`part_refuser_${reqId}`)
      .setLabel('❌ Refuser')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
  );
}

// ============================================================
// SLASH COMMAND
// ============================================================
module.exports = {
  data: new SlashCommandBuilder()
    .setName('partenariat')
    .setDescription('🤝 Système de partenariats')

    // ── Utilisateurs ──────────────────────────────────────────
    .addSubcommand(s => s
      .setName('liste')
      .setDescription('📋 Voir tous les serveurs partenaires'))
    .addSubcommand(s => s
      .setName('demander')
      .setDescription('📥 Soumettre une demande de partenariat (ouvre un formulaire)'))
    .addSubcommand(s => s
      .setName('statut')
      .setDescription('🔍 Voir le statut de ma demande de partenariat'))
    .addSubcommand(s => s
      .setName('pub')
      .setDescription('📢 Envoyer une pub ponctuelle (partenaires uniquement, 1×/24h)'))

    // ── Configuration Admin ────────────────────────────────────
    .addSubcommand(s => s
      .setName('config-salon-demandes')
      .setDescription('⚙️ [ADMIN] Salon où arrivent les demandes')
      .addChannelOption(o => o.setName('salon').setDescription('Salon texte').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(s => s
      .setName('config-salon-partenaires')
      .setDescription('⚙️ [ADMIN] Salon où les pubs des partenaires sont postées automatiquement')
      .addChannelOption(o => o.setName('salon').setDescription('Salon texte').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(s => s
      .setName('config-salon-pub')
      .setDescription('⚙️ [ADMIN] Salon pour les pubs ponctuelles (commande /partenariat pub)')
      .addChannelOption(o => o.setName('salon').setDescription('Salon texte').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(s => s
      .setName('config-role')
      .setDescription('⚙️ [ADMIN] Rôle donné automatiquement aux partenaires')
      .addRoleOption(o => o.setName('role').setDescription('Rôle à attribuer').setRequired(true)))
    .addSubcommand(s => s
      .setName('config-notre-pub')
      .setDescription('⚙️ [ADMIN] Définir notre pub à envoyer aux nouveaux partenaires'))
    .addSubcommand(s => s
      .setName('config-voir')
      .setDescription('⚙️ [ADMIN] Voir toute la configuration actuelle'))

    // ── Gestion Admin ──────────────────────────────────────────
    .addSubcommand(s => s
      .setName('admin-demandes')
      .setDescription('📨 [ADMIN] Voir les demandes en attente'))
    .addSubcommand(s => s
      .setName('admin-valider')
      .setDescription('✅ [ADMIN] Valider une demande par son ID')
      .addStringOption(o => o.setName('id').setDescription('ID de la demande').setRequired(true)))
    .addSubcommand(s => s
      .setName('admin-refuser')
      .setDescription('❌ [ADMIN] Refuser une demande')
      .addStringOption(o => o.setName('id').setDescription('ID de la demande').setRequired(true))
      .addStringOption(o => o.setName('raison').setDescription('Raison du refus').setRequired(false)))
    .addSubcommand(s => s
      .setName('admin-ajouter')
      .setDescription('➕ [ADMIN] Ajouter un partenaire directement (sans demande)'))
    .addSubcommand(s => s
      .setName('admin-retirer')
      .setDescription('➖ [ADMIN] Retirer un partenaire')
      .addStringOption(o => o.setName('id').setDescription('ID du partenaire').setRequired(true)))
    .addSubcommand(s => s
      .setName('admin-liste')
      .setDescription('📋 [ADMIN] Liste complète des partenaires avec leurs IDs')),

  // ============================================================
  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false });
    }
    const sub = interaction.options.getSubcommand();
    const g   = getGuild(interaction.guildId);

    const ADMIN_SUBS = [
      'config-salon-demandes','config-salon-partenaires','config-salon-pub',
      'config-role','config-notre-pub','config-voir',
      'admin-demandes','admin-valider','admin-refuser','admin-ajouter','admin-retirer','admin-liste',
    ];
    if (ADMIN_SUBS.includes(sub) && !isAdmin(interaction.member)) {
      return await interaction.editReply({ content: '🔒 Cette commande est réservée aux administrateurs.', ephemeral: true });
    }

    // ── /partenariat liste ────────────────────────────────────
    if (sub === 'liste') {
      if (!g.partners.length) {
        return await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(C_GOLD)
            .setTitle('🤝 Partenaires')
            .setDescription('Aucun serveur partenaire pour l\'instant.\n\nTu veux nous rejoindre ? Utilise `/partenariat demander` !')
            .setTimestamp()],
          ephemeral: true,
        });
      }
      const lines = g.partners.map((p, i) =>
        `\`${String(i + 1).padStart(2, '0')}\` **${p.nom}** — ${p.membres || '?'} membres\n> 🔗 ${p.invite}\n> *${(p.description || '').slice(0, 80)}*`
      ).join('\n\n');
      return await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(C_MAIN)
          .setTitle(`🤝 Serveurs Partenaires (${g.partners.length})`)
          .setDescription(lines.slice(0, 4000))
          .setFooter({ text: 'Pour devenir partenaire : /partenariat demander' })
          .setTimestamp()],
        ephemeral: true,
      });
    }

    // ── /partenariat demander ─────────────────────────────────
    if (sub === 'demander') {
      const existing = getPartnerByUser(interaction.user.id, interaction.guildId);
      if (existing) {
        return await interaction.editReply({ content: `✅ Tu es déjà partenaire via **${existing.nom}** ! Utilise \`/partenariat pub\` pour une pub.`, ephemeral: true });
      }
      const pending = g.requests.find(r => r.submittedBy === interaction.user.id && r.status === 'pending');
      if (pending) {
        return await interaction.editReply({ content: `⏳ Tu as déjà une demande en cours (\`${pending.id}\`). Vérifie avec \`/partenariat statut\`.`, ephemeral: true });
      }

      const modal = new ModalBuilder()
        .setCustomId('part_modal_demande')
        .setTitle('📥 Demande de Partenariat')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('nom')
              .setLabel('📛 Nom de votre serveur Discord')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setMaxLength(100)
              .setPlaceholder('Ex: Gaming Paradise'),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('invite')
              .setLabel('🔗 Lien d\'invitation (discord.gg/...)')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setPlaceholder('https://discord.gg/monserveur'),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('pub')
              .setLabel('📢 Publicité à poster sur notre serveur')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setMaxLength(500)
              .setPlaceholder('Rédigez ici la pub qui sera postée sur notre serveur si votre demande est acceptée...'),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('description')
              .setLabel('📝 Description courte de votre serveur')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setMaxLength(200)
              .setPlaceholder('Thème, activités, communauté...'),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('membres')
              .setLabel('👥 Nombre de membres approximatif')
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
              .setPlaceholder('Ex: 500'),
          ),
        );
      return await interaction.showModal(modal);
    }

    // ── /partenariat statut ───────────────────────────────────
    if (sub === 'statut') {
      const partner = getPartnerByUser(interaction.user.id, interaction.guildId);
      if (partner) {
        return await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(C_GREEN)
            .setTitle('✅ Tu es partenaire !')
            .setDescription(`Tu représentes **${partner.nom}**.\n🔗 ${partner.invite}\n\n📢 Tu peux envoyer une pub via \`/partenariat pub\` (1 fois / 24h).`)
            .setTimestamp()],
          ephemeral: true,
        });
      }
      const req = g.requests
        .filter(r => r.submittedBy === interaction.user.id)
        .sort((a, b) => b.submittedAt - a.submittedAt)[0];
      if (!req) {
        return await interaction.editReply({ content: '📋 Aucune demande trouvée. Fais une demande avec `/partenariat demander` !', ephemeral: true });
      }
      const statMap = {
        pending:  { emoji: '⏳', label: 'En attente de traitement', color: C_GOLD },
        accepted: { emoji: '✅', label: 'Acceptée — tu es partenaire !', color: C_GREEN },
        refused:  { emoji: '❌', label: 'Refusée', color: C_RED },
      };
      const s = statMap[req.status] || statMap.pending;
      return await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(s.color)
          .setTitle('🔍 État de ma demande')
          .addFields(
            { name: '🏷️ Serveur',  value: req.nom,  inline: true },
            { name: '📊 Statut',   value: `${s.emoji} ${s.label}`, inline: true },
            { name: '🆔 ID',       value: `\`${req.id}\``, inline: true },
            { name: '📅 Soumise',  value: `<t:${Math.floor(req.submittedAt / 1000)}:R>`, inline: true },
          )
          .setDescription(req.refusRaison ? `**Raison du refus :** ${req.refusRaison}` : '')
          .setTimestamp()],
        ephemeral: true,
      });
    }

    // ── /partenariat pub ──────────────────────────────────────
    if (sub === 'pub') {
      const partner = getPartnerByUser(interaction.user.id, interaction.guildId);
      if (!partner) {
        return await interaction.editReply({ content: '❌ Tu dois être un représentant partenaire pour utiliser cette commande.', ephemeral: true });
      }
      if (!g.pubChannelId) {
        return await interaction.editReply({ content: '❌ Aucun salon de pub configuré. Contacte un administrateur.', ephemeral: true });
      }
      const lastPub = g.pubCooldowns?.[interaction.user.id] || 0;
      const diff    = Date.now() - lastPub;
      if (diff < 86400000) {
        const heures = Math.ceil((86400000 - diff) / 3600000);
        return await interaction.editReply({ content: `⏳ Prochain envoi disponible dans **${heures}h**.`, ephemeral: true });
      }
      const modal = new ModalBuilder()
        .setCustomId('part_modal_pub')
        .setTitle('📢 Envoyer une publication')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('message')
              .setLabel('Votre message (événements, nouveautés...)')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setMaxLength(1000)
              .setPlaceholder('Parlez de vos événements, nouveautés, offres spéciales...'),
          ),
        );
      return await interaction.showModal(modal);
    }

    // ── Config : salons & rôle ────────────────────────────────
    if (sub === 'config-salon-demandes') {
      const ch = interaction.options.getChannel('salon');
      updateGuild(interaction.guildId, { requestChannelId: ch.id });
      return await interaction.editReply({ embeds: [new EmbedBuilder().setColor(C_GREEN).setTitle('✅ Configuré').setDescription(`📨 Les demandes arriveront dans <#${ch.id}>.`).setTimestamp()], ephemeral: true });
    }
    if (sub === 'config-salon-partenaires') {
      const ch = interaction.options.getChannel('salon');
      updateGuild(interaction.guildId, { partnerChannelId: ch.id });
      return await interaction.editReply({ embeds: [new EmbedBuilder().setColor(C_GREEN).setTitle('✅ Configuré').setDescription(`🤝 Les pubs des partenaires seront postées dans <#${ch.id}> à chaque validation.`).setTimestamp()], ephemeral: true });
    }
    if (sub === 'config-salon-pub') {
      const ch = interaction.options.getChannel('salon');
      updateGuild(interaction.guildId, { pubChannelId: ch.id });
      return await interaction.editReply({ embeds: [new EmbedBuilder().setColor(C_GREEN).setTitle('✅ Configuré').setDescription(`📢 Les pubs ponctuelles (\`/partenariat pub\`) iront dans <#${ch.id}>.`).setTimestamp()], ephemeral: true });
    }
    if (sub === 'config-role') {
      const role = interaction.options.getRole('role');
      updateGuild(interaction.guildId, { partnerRoleId: role.id });
      return await interaction.editReply({ embeds: [new EmbedBuilder().setColor(C_GREEN).setTitle('✅ Configuré').setDescription(`🎭 Le rôle <@&${role.id}> sera attribué aux nouveaux partenaires.`).setTimestamp()], ephemeral: true });
    }

    if (sub === 'config-notre-pub') {
      const modal = new ModalBuilder()
        .setCustomId('part_modal_notre_pub')
        .setTitle('📢 Notre Publicité')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('pub')
              .setLabel('Notre pub à envoyer aux nouveaux partenaires')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setMaxLength(1000)
              .setValue(g.notrePub || '')
              .setPlaceholder('Rédigez ici la pub que les partenaires acceptés recevront par DM pour la poster sur leur serveur...'),
          ),
        );
      return await interaction.showModal(modal);
    }

    if (sub === 'config-voir') {
      const pendingCount = g.requests.filter(r => r.status === 'pending').length;
      return await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(C_ADMIN)
          .setTitle('⚙️ Configuration — Partenariats')
          .addFields(
            { name: '📨 Salon demandes',    value: g.requestChannelId  ? `<#${g.requestChannelId}>`  : '❌ Non configuré → `/partenariat config-salon-demandes`',   inline: false },
            { name: '🤝 Salon partenaires', value: g.partnerChannelId  ? `<#${g.partnerChannelId}>` : '❌ Non configuré → `/partenariat config-salon-partenaires`', inline: false },
            { name: '📢 Salon pub ponct.',  value: g.pubChannelId      ? `<#${g.pubChannelId}>`     : '❌ Non configuré → `/partenariat config-salon-pub`',         inline: false },
            { name: '🎭 Rôle partenaire',   value: g.partnerRoleId     ? `<@&${g.partnerRoleId}>`   : '❌ Non configuré → `/partenariat config-role`',             inline: false },
            { name: '📢 Notre pub',         value: g.notrePub ? `✅ Définie (${g.notrePub.length} car.)` : '❌ Non définie → `/partenariat config-notre-pub`', inline: false },
            { name: '📊 Stats',             value: `🤝 **${g.partners.length}** partenaire(s) actif(s) | ⏳ **${pendingCount}** demande(s) en attente`, inline: false },
          )
          .setTimestamp()],
        ephemeral: true,
      });
    }

    // ── Admin : demandes en attente ────────────────────────────
    if (sub === 'admin-demandes') {
      const pending = g.requests.filter(r => r.status === 'pending');
      if (!pending.length) {
        return await interaction.editReply({ embeds: [new EmbedBuilder().setColor(C_GREEN).setTitle('📨 Demandes').setDescription('✅ Aucune demande en attente !').setTimestamp()], ephemeral: true });
      }
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true });
      }
      for (const req of pending.slice(0, 5)) {
        await interaction.followUp({ embeds: [buildRequestEmbed(req)], components: [buildReviewButtons(req.id)], ephemeral: true });
      }
      if (pending.length > 5) {
        await interaction.followUp({ content: `📌 *${pending.length - 5} demande(s) supplémentaire(s) non affichée(s).*`, ephemeral: true });
      }
      return;
    }

    if (sub === 'admin-valider') {
      return validerDemande(interaction, interaction.options.getString('id').toUpperCase().trim());
    }
    if (sub === 'admin-refuser') {
      return refuserDemande(interaction, interaction.options.getString('id').toUpperCase().trim(), interaction.options.getString('raison') || null);
    }

    if (sub === 'admin-ajouter') {
      const modal = new ModalBuilder()
        .setCustomId('part_modal_ajouter')
        .setTitle('➕ Ajouter un partenaire direct')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('nom').setLabel('Nom du serveur').setStyle(TextInputStyle.Short).setRequired(true),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('invite').setLabel('Lien d\'invitation').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('discord.gg/...'),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('pub').setLabel('Pub à poster sur notre serveur').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(200),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('representant_id').setLabel('ID Discord du représentant (optionnel)').setStyle(TextInputStyle.Short).setRequired(false),
          ),
        );
      return await interaction.showModal(modal);
    }

    if (sub === 'admin-retirer') {
      const pid   = interaction.options.getString('id').toUpperCase().trim();
      const fresh = getGuild(interaction.guildId);
      const idx   = fresh.partners.findIndex(p => p.id === pid);
      if (idx === -1) return interaction.editReply({ content: `❌ Partenaire \`${pid}\` introuvable.`, ephemeral: true });
      const [removed] = fresh.partners.splice(idx, 1);
      updateGuild(interaction.guildId, { partners: fresh.partners });
      if (fresh.partnerRoleId && removed.repUserId) {
        const m = await interaction.guild.members.fetch(removed.repUserId).catch(() => null);
        if (m) await m.roles.remove(fresh.partnerRoleId).catch(() => {});
      }
      return await interaction.editReply({ embeds: [new EmbedBuilder().setColor(C_RED).setTitle('➖ Partenaire retiré').setDescription(`**${removed.nom}** a été retiré des partenaires.`).setTimestamp()], ephemeral: true });
    }

    if (sub === 'admin-liste') {
      const fresh = getGuild(interaction.guildId);
      if (!fresh.partners.length) {
        return await interaction.editReply({ embeds: [new EmbedBuilder().setColor(C_GOLD).setTitle('📋 Partenaires').setDescription('Aucun partenaire.').setTimestamp()], ephemeral: true });
      }
      const lines = fresh.partners.map((p, i) =>
        `\`${String(i + 1).padStart(2, '0')}\` **${p.nom}** | ID: \`${p.id}\` | Rep: ${p.repUserId ? `<@${p.repUserId}>` : '*aucun*'}\n> 🔗 ${p.invite}`
      ).join('\n');
      return await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(C_ADMIN).setTitle(`📋 Partenaires Admin (${fresh.partners.length})`).setDescription(lines.slice(0, 4000)).setFooter({ text: 'Retirer : /partenariat admin-retirer id:<ID>' }).setTimestamp()],
        ephemeral: true,
      });
    }
  },

  // ============================================================
  // HANDLER BOUTONS & MODALS (routé par interactionCreate)
  // ============================================================
  async handleComponent(interaction) {
    const id = interaction.customId;

    // Bouton valider/refuser
    if (interaction.isButton()) {
      if (!isAdmin(interaction.member)) {
        return await interaction.editReply({ content: '🔒 Admins uniquement.', ephemeral: true });
      }
      if (id.startsWith('part_valider_')) {
        return validerDemande(interaction, id.replace('part_valider_', ''));
      }
      if (id.startsWith('part_refuser_')) {
        return refuserDemande(interaction, id.replace('part_refuser_', ''), null);
      }
    }

    // Modals
    if (interaction.isModalSubmit()) {
      if (id === 'part_modal_demande')   return submitDemande(interaction);
      if (id === 'part_modal_ajouter')   return submitAjouter(interaction);
      if (id === 'part_modal_pub')       return submitPub(interaction);
      if (id === 'part_modal_notre_pub') return submitNotrePub(interaction);
    }
  },

  name: 'partenariat',
  aliases: ['partner', 'partners', 'part'],
  async run(message) {
    const g = getGuild(message.guildId);
    if (!g.partners.length) return message.reply('📋 Aucun partenaire pour l\'instant. Utilise `/partenariat demander` !');
    const lines = g.partners.map((p, i) => `**${i + 1}.** ${p.nom} — ${p.invite}`).join('\n');
    await message.reply({ embeds: [new EmbedBuilder().setColor(C_MAIN).setTitle('🤝 Partenaires').setDescription(lines).setTimestamp()] });
  },
};

// ============================================================
// FONCTIONS INTERNES
// ============================================================

// Soumission de demande via modal
async function submitDemande(interaction) {
  const nom         = interaction.fields.getTextInputValue('nom').trim();
  const invite      = interaction.fields.getTextInputValue('invite').trim();
  const pub         = interaction.fields.getTextInputValue('pub').trim();
  const description = interaction.fields.getTextInputValue('description').trim();
  const membres     = interaction.fields.getTextInputValue('membres')?.trim() || null;

  if (!invite.includes('discord.gg/') && !invite.includes('discord.com/invite/')) {
    return interaction.editReply({ content: '❌ Le lien doit être un lien Discord valide (discord.gg/...).', ephemeral: true });
  }

  const g = getGuild(interaction.guildId);
  if (g.requests.find(r => r.submittedBy === interaction.user.id && r.status === 'pending')) {
    return interaction.editReply({ content: '⏳ Tu as déjà une demande en attente. Vérifie avec `/partenariat statut`.', ephemeral: true });
  }
  if (g.partners.some(p => p.nom.toLowerCase() === nom.toLowerCase())) {
    return interaction.editReply({ content: `❌ **${nom}** est déjà partenaire !`, ephemeral: true });
  }

  const id = genId();
  const req = { id, nom, invite, pub, description, membres, submittedBy: interaction.user.id, submittedAt: Date.now(), status: 'pending', refusRaison: null };
  g.requests.push(req);
  updateGuild(interaction.guildId, { requests: g.requests });

  // Poster dans le salon de demandes (si configuré)
  if (g.requestChannelId) {
    const chan = interaction.guild.channels.cache.get(g.requestChannelId);
    if (chan) {
      await chan.send({
        embeds: [buildRequestEmbed(req)],
        components: [buildReviewButtons(id)],
      }).catch(() => {});
    }
  }

  return interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(C_GREEN)
      .setTitle('✅ Demande envoyée !')
      .setDescription([
        `Votre demande pour **${nom}** a été soumise avec succès !`,
        '',
        `🆔 **ID de suivi :** \`${id}\``,
        '',
        'Un administrateur va l\'examiner. Tu recevras une notification par DM.',
        'Suivi : \`/partenariat statut\`',
      ].join('\n'))
      .setTimestamp()],
    ephemeral: true,
  });
}

// Validation d'une demande
async function validerDemande(interaction, reqId) {
  const g   = getGuild(interaction.guildId);
  const idx = g.requests.findIndex(r => r.id === reqId && r.status === 'pending');
  if (idx === -1) {
    return interaction.editReply({ content: `❌ Demande \`${reqId}\` introuvable ou déjà traitée.`, ephemeral: true });
  }

  const req = g.requests[idx];
  req.status = 'accepted';

  const partnerId = genId();
  const partner = {
    id:         partnerId,
    nom:        req.nom,
    invite:     req.invite,
    pub:        req.pub,
    description: req.description,
    membres:    req.membres,
    repUserId:  req.submittedBy,
    addedAt:    Date.now(),
    addedBy:    interaction.user.id,
  };
  g.partners.push(partner);
  updateGuild(interaction.guildId, { requests: g.requests, partners: g.partners });

  // 1. Donner le rôle partenaire
  if (g.partnerRoleId) {
    const m = await interaction.guild.members.fetch(req.submittedBy).catch(() => null);
    if (m) await m.roles.add(g.partnerRoleId).catch(() => {});
  }

  // 2. Poster la pub du partenaire dans le salon partenaires (AUTOMATIQUEMENT)
  if (g.partnerChannelId) {
    const chan = interaction.guild.channels.cache.get(g.partnerChannelId);
    if (chan) {
      await chan.send({ embeds: [buildPartnerPubEmbed(partner)] }).catch(() => {});
    }
  }

  // 3. Envoyer notre pub au représentant en DM
  try {
    const user = await interaction.client.users.fetch(req.submittedBy).catch(() => null);
    if (user) {
      const dmLines = [
        `🎉 **Votre demande de partenariat pour ${req.nom} a été acceptée !**`,
        '',
        `Bienvenue dans notre réseau de partenaires !`,
        '',
      ];
      if (g.notrePub) {
        dmLines.push('**📢 Voici notre publicité à poster sur votre serveur :**');
        dmLines.push('');
        dmLines.push(g.notrePub);
      } else {
        dmLines.push('*Un administrateur vous contactera pour l\'échange de pub.*');
      }
      dmLines.push('');
      dmLines.push(`Vous pouvez maintenant envoyer une pub sur notre serveur avec \`/partenariat pub\` (1 fois / 24h).`);

      await user.send({ embeds: [new EmbedBuilder()
        .setColor(C_GREEN)
        .setTitle(`🎉 Partenariat accepté — ${interaction.guild.name}`)
        .setDescription(dmLines.join('\n'))
        .setTimestamp()] }).catch(() => {});
    }
  } catch {}

  // 4. Désactiver les boutons sur le message de demande (si bouton)
  if (interaction.message) {
    await interaction.message.edit({ components: [buildReviewButtons(reqId, true)] }).catch(() => {});
  }

  return interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(C_GREEN)
      .setTitle('✅ Partenariat validé !')
      .setDescription([
        `**${req.nom}** est maintenant partenaire ! 🎉`,
        '',
        '✅ Pub postée automatiquement dans le salon partenaires',
        '✅ Notre pub envoyée en DM au représentant',
        g.partnerRoleId ? '✅ Rôle partenaire attribué' : '⚠️ Aucun rôle configuré',
      ].join('\n'))
      .setTimestamp()],
    ephemeral: true,
  });
}

// Refus d'une demande
async function refuserDemande(interaction, reqId, raison) {
  const g   = getGuild(interaction.guildId);
  const idx = g.requests.findIndex(r => r.id === reqId && r.status === 'pending');
  if (idx === -1) {
    return interaction.editReply({ content: `❌ Demande \`${reqId}\` introuvable ou déjà traitée.`, ephemeral: true });
  }

  g.requests[idx].status      = 'refused';
  g.requests[idx].refusRaison = raison || null;
  updateGuild(interaction.guildId, { requests: g.requests });

  try {
    const user = await interaction.client.users.fetch(g.requests[idx].submittedBy).catch(() => null);
    if (user) {
      await user.send({ embeds: [new EmbedBuilder()
        .setColor(C_RED)
        .setTitle('❌ Demande de partenariat refusée')
        .setDescription([
          `Votre demande pour **${g.requests[idx].nom}** sur **${interaction.guild.name}** a été refusée.`,
          raison ? `\n**Raison :** ${raison}` : '',
          '',
          '*Vous pouvez soumettre une nouvelle demande après avoir apporté les modifications nécessaires.*',
        ].join('\n'))
        .setTimestamp()] }).catch(() => {});
    }
  } catch {}

  if (interaction.message) {
    await interaction.message.edit({ components: [buildReviewButtons(reqId, true)] }).catch(() => {});
  }

  return interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(C_RED)
      .setTitle('❌ Demande refusée')
      .setDescription(`Demande de **${g.requests[idx].nom}** refusée.${raison ? `\n**Raison :** ${raison}` : ''}\n\nLe demandeur a été notifié par DM.`)
      .setTimestamp()],
    ephemeral: true,
  });
}

// Modal pub ponctuelle
async function submitPub(interaction) {
  const g       = getGuild(interaction.guildId);
  const partner = getPartnerByUser(interaction.user.id, interaction.guildId);
  const pubChan = interaction.guild.channels.cache.get(g.pubChannelId);
  if (!partner || !pubChan) return interaction.editReply({ content: '❌ Impossible d\'envoyer la pub.', ephemeral: true });

  const message = interaction.fields.getTextInputValue('message').trim();
  await pubChan.send({ embeds: [new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle(`📢 ${partner.nom}`)
    .setDescription(message)
    .addFields({ name: '🔗 Rejoindre', value: partner.invite, inline: true })
    .setFooter({ text: `Pub partenaire · ${interaction.user.username}` })
    .setTimestamp()] }).catch(() => {});

  g.pubCooldowns = g.pubCooldowns || {};
  g.pubCooldowns[interaction.user.id] = Date.now();
  updateGuild(interaction.guildId, { pubCooldowns: g.pubCooldowns });

  return interaction.editReply({ content: `✅ Pub envoyée dans <#${g.pubChannelId}> !`, ephemeral: true });
}

// Modal pour définir notre pub
async function submitNotrePub(interaction) {
  const pub = interaction.fields.getTextInputValue('pub').trim();
  updateGuild(interaction.guildId, { notrePub: pub });
  return interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(C_GREEN)
      .setTitle('✅ Notre pub mise à jour !')
      .setDescription(`La pub suivante sera envoyée en DM aux prochains partenaires acceptés :\n\n${pub}`)
      .setTimestamp()],
    ephemeral: true,
  });
}

// Modal ajout direct par admin
async function submitAjouter(interaction) {
  const nom   = interaction.fields.getTextInputValue('nom').trim();
  const invite = interaction.fields.getTextInputValue('invite').trim();
  const pub   = interaction.fields.getTextInputValue('pub').trim();
  const description = interaction.fields.getTextInputValue('description')?.trim() || '';
  const repId = interaction.fields.getTextInputValue('representant_id')?.trim() || null;

  const g = getGuild(interaction.guildId);
  if (g.partners.some(p => p.nom.toLowerCase() === nom.toLowerCase())) {
    return interaction.editReply({ content: `❌ **${nom}** est déjà partenaire.`, ephemeral: true });
  }

  const id = genId();
  const partner = { id, nom, invite, pub, description, repUserId: repId, addedAt: Date.now(), addedBy: interaction.user.id };
  g.partners.push(partner);
  updateGuild(interaction.guildId, { partners: g.partners });

  // Donner le rôle
  if (g.partnerRoleId && repId) {
    const m = await interaction.guild.members.fetch(repId).catch(() => null);
    if (m) await m.roles.add(g.partnerRoleId).catch(() => {});
  }

  // Poster la pub
  if (g.partnerChannelId) {
    const chan = interaction.guild.channels.cache.get(g.partnerChannelId);
    if (chan) await chan.send({ embeds: [buildPartnerPubEmbed(partner)] }).catch(() => {});
  }

  return interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(C_GREEN)
      .setTitle('✅ Partenaire ajouté !')
      .setDescription(`**${nom}** ajouté avec succès !${repId ? ` <@${repId}> représentant.` : ''}\nPub postée automatiquement si le salon est configuré.`)
      .setTimestamp()],
    ephemeral: true,
  });
}
