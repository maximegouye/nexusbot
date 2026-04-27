'use strict';

const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, PermissionFlagsBits,
  ChannelType, StringSelectMenuBuilder, AttachmentBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const db = require('../../database/db');

// ── Migrations ────────────────────────────────────────────────────────────────
try {
  const tc = db.db.prepare('PRAGMA table_info(tickets)').all().map(c => c.name);
  if (!tc.includes('category'))          db.db.prepare("ALTER TABLE tickets ADD COLUMN category TEXT DEFAULT 'support'").run();
  if (!tc.includes('claimed_by'))        db.db.prepare("ALTER TABLE tickets ADD COLUMN claimed_by TEXT").run();
  if (!tc.includes('close_reason'))      db.db.prepare("ALTER TABLE tickets ADD COLUMN close_reason TEXT").run();
  if (!tc.includes('rating'))            db.db.prepare("ALTER TABLE tickets ADD COLUMN rating INTEGER").run();
  if (!tc.includes('priority'))          db.db.prepare("ALTER TABLE tickets ADD COLUMN priority TEXT DEFAULT 'normale'").run();
  if (!tc.includes('warn_sent'))         db.db.prepare('ALTER TABLE tickets ADD COLUMN warn_sent INTEGER DEFAULT 0').run();
  if (!tc.includes('closed_at'))         db.db.prepare('ALTER TABLE tickets ADD COLUMN closed_at INTEGER').run();
  if (!tc.includes('tags'))              db.db.prepare("ALTER TABLE tickets ADD COLUMN tags TEXT DEFAULT '[]'").run();
  if (!tc.includes('first_response_at')) db.db.prepare('ALTER TABLE tickets ADD COLUMN first_response_at INTEGER').run();
  if (!tc.includes('form_data'))         db.db.prepare("ALTER TABLE tickets ADD COLUMN form_data TEXT DEFAULT '{}'").run();
  if (!tc.includes('locked'))            db.db.prepare('ALTER TABLE tickets ADD COLUMN locked INTEGER DEFAULT 0').run();
  if (!tc.includes('last_activity'))     db.db.prepare('ALTER TABLE tickets ADD COLUMN last_activity INTEGER').run();
} catch {}
try {
  const gc = db.db.prepare('PRAGMA table_info(guild_config)').all().map(c => c.name);
  if (!gc.includes('ticket_log_channel'))  db.db.prepare("ALTER TABLE guild_config ADD COLUMN ticket_log_channel TEXT").run();
  if (!gc.includes('ticket_welcome_msg'))  db.db.prepare("ALTER TABLE guild_config ADD COLUMN ticket_welcome_msg TEXT").run();
  if (!gc.includes('ticket_max_open'))     db.db.prepare("ALTER TABLE guild_config ADD COLUMN ticket_max_open INTEGER DEFAULT 1").run();
} catch {}
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS ticket_blacklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL,
    reason TEXT, banned_by TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, user_id)
  )`).run();
} catch {}
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS ticket_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL, author_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS ticket_quick_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL,
    created_by TEXT, created_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, title)
  )`).run();
} catch {}

// ── Constantes ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { value: 'support',     label: '💬 Support Général',    description: 'Question ou aide générale',          emoji: '💬', color: '#5865F2' },
  { value: 'bug',         label: '🐛 Problème Technique',  description: 'Bug ou dysfonctionnement',            emoji: '🐛', color: '#E74C3C' },
  { value: 'partenariat', label: '🤝 Partenariat',         description: 'Demande de partenariat',              emoji: '🤝', color: '#2ECC71' },
  { value: 'signalement', label: '🚨 Signalement',         description: 'Signaler un membre/comportement',     emoji: '🚨', color: '#E67E22' },
  { value: 'achat',       label: '💰 Achat / Premium',     description: 'Question sur un achat ou abonnement', emoji: '💰', color: '#F1C40F' },
  { value: 'recrutement', label: '🎯 Recrutement',          description: 'Suivi de candidature ou question staff', emoji: '🎯', color: '#9B59B6' },
  { value: 'autre',       label: '📋 Autre',               description: 'Toute autre demande',                 emoji: '📋', color: '#95A5A6' },
];

const PRIORITIES = [
  { value: 'faible',  label: '🟢 Faible',  color: '#2ECC71' },
  { value: 'normale', label: '🟡 Normale', color: '#F1C40F' },
  { value: 'elevee',  label: '🟠 Élevée',  color: '#E67E22' },
  { value: 'urgente', label: '🔴 Urgente', color: '#E74C3C' },
];

// Formulaires par catégorie (max 5 champs par modal Discord)
const FORMS = {
  support: [
    { id: 'subject',     label: '📌 Résumé de ta demande',    style: TextInputStyle.Short,     placeholder: 'Ex: Je ne peux pas accéder au salon VIP',    required: true,  max: 100  },
    { id: 'description', label: '📝 Description détaillée',   style: TextInputStyle.Paragraph, placeholder: 'Décris ton problème en détail...',             required: true,  max: 1000 },
  ],
  bug: [
    { id: 'subject',     label: '🐛 Titre du problème',             style: TextInputStyle.Short,     placeholder: 'Ex: Le bot ne répond pas à /casino',      required: true,  max: 100 },
    { id: 'steps',       label: '🔁 Étapes pour reproduire',        style: TextInputStyle.Paragraph, placeholder: '1. Je fais... 2. Je clique... 3. Il se passe...', required: true,  max: 500 },
    { id: 'error',       label: '⚠️ Message d\'erreur (si dispo)',   style: TextInputStyle.Short,     placeholder: 'Colle le message d\'erreur exact ici',    required: false, max: 200 },
  ],
  partenariat: [
    { id: 'server_name',   label: '🏷️ Nom de ton serveur',       style: TextInputStyle.Short,     placeholder: 'Ex: Zone Gaming',            required: true,  max: 100 },
    { id: 'member_count',  label: '👥 Nombre de membres',         style: TextInputStyle.Short,     placeholder: 'Ex: 1500',                   required: true,  max: 20  },
    { id: 'invite',        label: '🔗 Lien d\'invitation',        style: TextInputStyle.Short,     placeholder: 'discord.gg/...',             required: true,  max: 100 },
    { id: 'description',   label: '📝 Présentation de ton serveur', style: TextInputStyle.Paragraph, placeholder: 'Thématique, activités, ce que tu proposes...', required: true, max: 500 },
  ],
  signalement: [
    { id: 'accused',   label: '👤 Pseudo du membre signalé',       style: TextInputStyle.Short,     placeholder: 'Pseudo#tag ou ID Discord',          required: true,  max: 100 },
    { id: 'reason',    label: '📋 Raison du signalement',          style: TextInputStyle.Paragraph, placeholder: 'Décris les faits précisément...',   required: true,  max: 500 },
    { id: 'evidence',  label: '🖼️ Preuves (liens, descriptions)',  style: TextInputStyle.Paragraph, placeholder: 'Screenshots, liens, horodatage...', required: false, max: 500 },
  ],
  achat: [
    { id: 'product',     label: '🛒 Produit / Offre concerné',          style: TextInputStyle.Short,     placeholder: 'Ex: VIP Gold, Pass Premium',    required: true,  max: 100 },
    { id: 'order_id',    label: '🔢 Numéro de commande (si applicable)', style: TextInputStyle.Short,     placeholder: 'Ex: ORDER-12345',               required: false, max: 50  },
    { id: 'description', label: '📝 Description du problème',           style: TextInputStyle.Paragraph, placeholder: "Qu'est-ce qui ne fonctionne pas ?", required: true, max: 500 },
  ],
  recrutement: [
    { id: 'poste',       label: '🎯 Poste visé',                    style: TextInputStyle.Short,     placeholder: 'Ex: Modérateur, Graphiste, Helper...', required: true,  max: 100 },
    { id: 'subject',     label: '📌 Objet de ta demande',           style: TextInputStyle.Short,     placeholder: 'Ex: Suivi candidature, question staff', required: true,  max: 100 },
    { id: 'description', label: '📝 Détails de ta demande',         style: TextInputStyle.Paragraph, placeholder: 'Explique ta question ou demande...',    required: true,  max: 500 },
  ],
  autre: [
    { id: 'subject',     label: '📌 Sujet de ta demande',      style: TextInputStyle.Short,     placeholder: 'Résume ta demande en quelques mots', required: true,  max: 100  },
    { id: 'description', label: '📝 Description complète',     style: TextInputStyle.Paragraph, placeholder: 'Explique ta demande en détail...',   required: true,  max: 1000 },
  ],
};

const getCat = v => CATEGORIES.find(c => c.value === v) || CATEGORIES[0];
const getPri = v => PRIORITIES.find(p => p.value === v) || PRIORITIES[1];
const ts = () => Math.floor(Date.now() / 1000);

// ── Transcript HTML ───────────────────────────────────────────────────────────
async function generateHTMLTranscript(channel, ticket) {
  let msgs = [];
  let before;
  for (let i = 0; i < 10; i++) {
    const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
    if (!batch || !batch.size) break;
    msgs = msgs.concat([...batch.values()]);
    before = batch.last()?.id;
    if (batch.size < 100) break;
  }
  msgs.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const cat = getCat(ticket.category);
  const pri = getPri(ticket.priority);

  const msgsHtml = msgs.map(m => {
    const av = m.author.displayAvatarURL({ size: 64, extension: 'png' });
    const tag = esc(`${m.author.username}${m.author.bot ? ' [BOT]' : ''}`);
    const color = m.author.bot ? '#5865F2' : '#dcddde';
    let body = '';
    if (m.content) body += `<p class="mc">${esc(m.content)}</p>`;
    for (const e of m.embeds) {
      const bc = e.color ? `#${e.color.toString(16).padStart(6,'0')}` : '#5865F2';
      body += `<div class="emb" style="border-left:4px solid ${bc}">`;
      if (e.author?.name) body += `<div class="ea">${esc(e.author.name)}</div>`;
      if (e.title) body += `<div class="et">${esc(e.title)}</div>`;
      if (e.description) body += `<div class="ed">${esc(e.description.slice(0,500))}</div>`;
      for (const f of e.fields||[]) body += `<div class="ef"><b>${esc(f.name)}</b> ${esc(f.value.slice(0,200))}</div>`;
      body += '</div>';
    }
    for (const [,a] of m.attachments) {
      if (a.contentType?.startsWith('image')) body += `<img src="${esc(a.url)}" class="ai" alt="">`;
      else body += `<a href="${esc(a.url)}" class="al">📎 ${esc(a.name)}</a>`;
    }
    if (!body) return '';
    return `<div class="msg"><img src="${esc(av)}" class="av" alt=""><div class="mb"><div class="mh"><span class="un" style="color:${color}">${tag}</span><span class="tm">${m.createdAt.toLocaleString('fr-FR')}</span></div>${body}</div></div>`;
  }).filter(Boolean).join('\n');

  let fd = {};
  try { fd = JSON.parse(ticket.form_data || '{}'); } catch {}
  const formRows = Object.entries(fd).map(([k,v]) => `<tr><td class="fk">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('');

  return Buffer.from(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Transcript #${ticket.id}</title>
<style>:root{--bg:#1a1b1e;--bg2:#2b2d31;--bg3:#383a40;--txt:#dcddde;--txt2:#949ba4;--ac:#5865F2}
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',sans-serif;background:var(--bg);color:var(--txt)}
.hdr{background:linear-gradient(135deg,#5865F2,#7b2fbe);padding:2rem}.hdr h1{font-size:1.8rem;font-weight:700}.hdr p{color:rgba(255,255,255,.7);margin-top:.4rem}
.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;background:var(--bg2);padding:1.5rem}
.mi{background:var(--bg3);border-radius:8px;padding:1rem}.ml{font-size:.7rem;color:var(--txt2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.3rem}.mv{font-weight:600;font-size:.9rem}
.fs{background:var(--bg2);padding:1.5rem;border-top:1px solid var(--bg3)}.fs h2{margin-bottom:.8rem;color:var(--txt2);font-size:.85rem;text-transform:uppercase}
table{width:100%;border-collapse:collapse}td{padding:.5rem .8rem;border-bottom:1px solid var(--bg3);font-size:.88rem}.fk{font-weight:600;color:var(--txt2);width:160px}
.msgs{padding:1.5rem;max-width:900px;margin:0 auto}
.msg{display:flex;gap:1rem;padding:.8rem 0;border-bottom:1px solid var(--bg3)}.av{width:40px;height:40px;border-radius:50%;flex-shrink:0}.mb{flex:1;min-width:0}
.mh{display:flex;align-items:baseline;gap:.6rem;margin-bottom:.25rem}.un{font-weight:600;font-size:.95rem}.tm{font-size:.72rem;color:var(--txt2)}
.mc{font-size:.9rem;line-height:1.5;white-space:pre-wrap;word-break:break-word}
.emb{background:var(--bg3);border-radius:4px;padding:.6rem .9rem;margin:.3rem 0;max-width:520px}.ea{font-size:.72rem;color:var(--txt2);margin-bottom:.2rem}.et{font-weight:700;margin-bottom:.2rem}.ed{font-size:.85rem;white-space:pre-wrap}.ef{font-size:.82rem;margin-top:.2rem}
.ai{max-width:280px;border-radius:8px;margin:.3rem 0;display:block}.al{color:var(--ac);font-size:.88rem}
.ftr{text-align:center;padding:1.5rem;color:var(--txt2);font-size:.78rem;border-top:1px solid var(--bg3)}
</style></head><body>
<div class="hdr"><h1>🎫 Transcript — #${esc(channel.name)}</h1><p>${esc(channel.guild?.name||'')} • Ticket #${ticket.id} • ${cat.label} • ${pri.label}</p></div>
<div class="meta">
  <div class="mi"><div class="ml">Auteur</div><div class="mv">${ticket.user_id}</div></div>
  <div class="mi"><div class="ml">Catégorie</div><div class="mv">${cat.label}</div></div>
  <div class="mi"><div class="ml">Priorité</div><div class="mv">${pri.label}</div></div>
  <div class="mi"><div class="ml">Ouvert le</div><div class="mv">${new Date(ticket.created_at*1000).toLocaleString('fr-FR')}</div></div>
  <div class="mi"><div class="ml">Fermé le</div><div class="mv">${new Date().toLocaleString('fr-FR')}</div></div>
  ${ticket.claimed_by?`<div class="mi"><div class="ml">Responsable</div><div class="mv">${ticket.claimed_by}</div></div>`:''}
  <div class="mi"><div class="ml">Messages</div><div class="mv">${msgs.length}</div></div>
</div>
${formRows?`<div class="fs"><h2>📋 Formulaire d'ouverture</h2><table>${formRows}</table></div>`:''}
<div class="msgs">${msgsHtml}</div>
<div class="ftr">Généré par NexusBot • ${new Date().toLocaleString('fr-FR')}</div>
</body></html>`, 'utf-8');
}

// ── Boutons staff dans le ticket ──────────────────────────────────────────────
function buildControlRows(ticketId) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ticket_close_${ticketId}`).setLabel('Fermer').setEmoji('🔒').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`ticket_claim_${ticketId}`).setLabel('Claim').setEmoji('✋').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`ticket_pri_${ticketId}`).setLabel('Priorité').setEmoji('🎯').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket_lock_${ticketId}`).setLabel('Verrouiller').setEmoji('🔐').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket_qr_${ticketId}`).setLabel('Réponse rapide').setEmoji('💬').setStyle(ButtonStyle.Primary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ticket_transfer_${ticketId}`).setLabel('Transférer').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket_note_${ticketId}`).setLabel('Note privée').setEmoji('📝').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket_info_${ticketId}`).setLabel('Infos ticket').setEmoji('ℹ️').setStyle(ButtonStyle.Secondary),
  );
  return [row1, row2];
}

// ── Créer un ticket ───────────────────────────────────────────────────────────
async function createTicket(interaction, catValue, formData) {
  const { guild, member } = interaction;
  const guildId = guild.id;
  const cfg = db.getConfig(guildId) || {};
  const cat = getCat(catValue);

  // Blacklist
  const bl = db.db.prepare('SELECT * FROM ticket_blacklist WHERE guild_id=? AND user_id=?').get(guildId, member.id);
  if (bl) {
    return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('🚫 Accès refusé')
      .setDescription(`Tu ne peux pas ouvrir de ticket.\n\n**Raison :** ${bl.reason || 'Non précisée'}`)], ephemeral: true });
  }

  // Limite tickets ouverts — auto-close orphans (salon supprimé manuellement)
  const maxOpen = cfg.ticket_max_open || 1;
  const openTickets = db.db.prepare("SELECT * FROM tickets WHERE guild_id=? AND user_id=? AND status='open'").all(guildId, member.id);
  for (const t of openTickets) {
    const ch = guild.channels.cache.get(t.channel_id);
    if (!ch) {
      // Salon supprimé sans passer par le bot → fermeture automatique en DB
      db.db.prepare("UPDATE tickets SET status='closed', closed_at=? WHERE id=?").run(ts(), t.id);
    }
  }
  const openCount = db.db.prepare("SELECT COUNT(*) as c FROM tickets WHERE guild_id=? AND user_id=? AND status='open'").get(guildId, member.id)?.c || 0;
  if (openCount >= maxOpen) {
    const existing = db.db.prepare("SELECT * FROM tickets WHERE guild_id=? AND user_id=? AND status='open'").get(guildId, member.id);
    const existCh = existing ? guild.channels.cache.get(existing.channel_id) : null;
    return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#E67E22').setTitle('⚠️ Ticket déjà ouvert !')
      .setDescription(`Tu as déjà ${openCount}/${maxOpen} ticket(s) ouvert(s).${existCh ? `\n\nRends-toi dans ${existCh}` : ''}`)], ephemeral: true });
  }

  // Permissions du canal
  const everyone = guild.roles.everyone.id;
  const botMe = guild.members.me;
  const staffRole = cfg.ticket_staff_role ? guild.roles.cache.get(String(cfg.ticket_staff_role)) : null;
  const perms = [
    { id: everyone,    deny:  [PermissionFlagsBits.ViewChannel] },
    { id: member.id,   allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] },
  ];
  if (botMe) perms.push({ id: botMe.id, allow: [
    PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageMessages, PermissionFlagsBits.AttachFiles,
  ]});
  if (staffRole) perms.push({ id: staffRole.id, allow: [
    PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.AttachFiles,
  ]});
  if (guild.ownerId && guild.ownerId !== member.id) perms.push({ id: guild.ownerId, allow: [
    PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.ManageChannels, PermissionFlagsBits.AttachFiles,
  ]});

  const safeName = (member.user.username||'user').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,12)||'user';
  let ch;
  try {
    ch = await guild.channels.create({
      name: `🎫・${catValue}-${safeName}`,
      type: ChannelType.GuildText,
      topic: `ticket:${member.id}`,
      parent: cfg.ticket_category ? String(cfg.ticket_category) : undefined,
      permissionOverwrites: perms,
    });
  } catch (err) {
    console.error('[ticket create] channel.create error:', err?.message, err?.code);
    return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('❌ Erreur de création')
      .setDescription(`Impossible de créer le salon.\n\`\`\`\n${err?.message || 'Erreur inconnue'}\n\`\`\`\nVérifie que j'ai la permission **Gérer les salons**.`)
    ], ephemeral: true }).catch(() => {});
  }

  // Enregistrement DB
  const fd = JSON.stringify(formData || {});
  const ticketId = db.db.prepare(
    'INSERT INTO tickets (guild_id, user_id, channel_id, status, category, priority, created_at, last_activity, form_data) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(guildId, member.id, ch.id, 'open', catValue, 'normale', ts(), ts(), fd).lastInsertRowid;

  // Welcome embed
  const subject = formData?.subject || formData?.server_name || formData?.accused || formData?.product || 'Nouvelle demande';
  const descText = formData?.description || formData?.steps || formData?.reason || '';

  const welcomeEmbed = new EmbedBuilder()
    .setColor(cat.color)
    .setAuthor({ name: `Ticket #${ticketId} — ${cat.label}`, iconURL: guild.iconURL({ size: 128 }) || undefined })
    .setTitle(subject.slice(0, 256))
    .setDescription(
      (descText ? `> *${descText.slice(0,400)}*\n\n` : '') +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `**Comment être aidé rapidement :**\n` +
      `➤ Fournis un **maximum de détails**\n` +
      `➤ **Reste disponible** pour répondre au staff\n` +
      `➤ Un seul ticket à la fois\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    )
    .addFields(
      { name: `${cat.emoji} Catégorie`, value: `\`${cat.label.replace(/^\S+ /,'')}\``, inline: true },
      { name: '🟡 Priorité',            value: '`Normale`',                             inline: true },
      { name: '⏱️ Réponse estimée',     value: '`< 2 heures`',                          inline: true },
    )
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: `${guild.name} • Support Premium & Confidentiel`, iconURL: guild.iconURL() || undefined })
    .setTimestamp();

  // Embed formulaire (champs supplémentaires)
  const formFields = Object.entries(formData || {})
    .filter(([k]) => k !== 'subject')
    .map(([k, v]) => {
      const LABELS = { steps:'🔁 Étapes', error:'⚠️ Erreur', server_name:'🏷️ Serveur',
        member_count:'👥 Membres', invite:'🔗 Lien', description:'📝 Détails',
        accused:'👤 Signalé', reason:'📋 Raison', evidence:'🖼️ Preuves',
        product:'🛒 Produit', order_id:'🔢 Commande' };
      return { name: LABELS[k] || k, value: (v||'*Non renseigné*').slice(0,1024), inline: false };
    });

  const [row1, row2] = buildControlRows(ticketId);
  await ch.send({
    content: `${member}${staffRole ? ' ' + staffRole : ''}`,
    embeds: formFields.length
      ? [welcomeEmbed, new EmbedBuilder().setColor(cat.color).setTitle('📋 Formulaire complété').addFields(...formFields.slice(0,10))]
      : [welcomeEmbed],
    components: [row1, row2],
  });

  // Confirmer à l'utilisateur
  await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2ECC71').setTitle('✅ Ticket ouvert !')
    .setDescription(`Ton ticket a été créé dans ${ch}.\n\nUn membre du staff va te répondre sous peu ! 🚀`)
    .setFooter({ text: 'Tu recevras une mention dès qu\'un staff répond ✨' })
  ], ephemeral: true }).catch(() => {});
}

// ── handleComponent ───────────────────────────────────────────────────────────
async function handleComponent(interaction, customId) {

  // ─── ticket_cat_{cat} → Afficher le modal formulaire ────────────────────────
  if (customId.startsWith('ticket_cat_')) {
    const catValue = customId.replace('ticket_cat_', '');
    const cat = getCat(catValue);
    const fields = FORMS[catValue] || FORMS.autre;
    const modal = new ModalBuilder()
      .setCustomId(`ticket_form_${catValue}`)
      .setTitle(`${cat.emoji} ${cat.label.replace(/^\S+ /,'')} — Ouvrir un ticket`);
    for (const f of fields.slice(0, 5)) {
      const ti = new TextInputBuilder()
        .setCustomId(f.id).setLabel(f.label).setStyle(f.style)
        .setRequired(f.required).setMaxLength(f.max || 1000);
      if (f.placeholder) ti.setPlaceholder(f.placeholder);
      modal.addComponents(new ActionRowBuilder().addComponents(ti));
    }
    await interaction.showModal(modal);
    return true;
  }

  // ─── ticket_form_{cat} (modal submit) → Créer le ticket ─────────────────────
  if (customId.startsWith('ticket_form_')) {
    const catValue = customId.replace('ticket_form_', '');
    const fields = FORMS[catValue] || FORMS.autre;
    const formData = {};
    for (const f of fields) {
      try { formData[f.id] = interaction.fields.getTextInputValue(f.id) || ''; } catch {}
    }
    await createTicket(interaction, catValue, formData);
    return true;
  }

  // ─── ticket_close_{id} → Modal de raison de fermeture ────────────────────────
  if (customId.startsWith('ticket_close_') && !customId.startsWith('ticket_close_confirm_')) {
    try {
      const ticketId = customId.replace('ticket_close_', '');
      const ticket = db.db.prepare('SELECT * FROM tickets WHERE id=?').get(ticketId);
      if (!ticket || ticket.status !== 'open') {
        return interaction.editReply({ content: '❌ Ce ticket est déjà fermé.', ephemeral: true });
      }
      const cfg = db.getConfig(interaction.guildId) || {};
      const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)
        || (cfg.ticket_staff_role && interaction.member.roles.cache.has(cfg.ticket_staff_role));
      if (!isStaff && interaction.user.id !== ticket.user_id) {
        return interaction.editReply({ content: '❌ Tu ne peux pas fermer ce ticket.', ephemeral: true });
      }
      await interaction.showModal(new ModalBuilder()
        .setCustomId(`ticket_close_confirm_${ticketId}`)
        .setTitle('🔒 Fermer ce ticket')
        .addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('reason').setLabel('Raison de fermeture')
            .setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(200)
            .setPlaceholder('Ex: Problème résolu, Demande satisfaite...')
        )));
    } catch (err) {
      console.error('[ticket_close] error:', err?.message);
      if (!interaction.replied && !interaction.deferred) await interaction.editReply({ content: '❌ Erreur.', ephemeral: true }).catch(() => {});
    }
    return true;
  }

  // ─── ticket_close_confirm_{id} (modal) → Fermer + Transcript ─────────────────
  if (customId.startsWith('ticket_close_confirm_')) {
    try {
      await interaction.deferReply();
      const ticketId = customId.replace('ticket_close_confirm_', '');
      const ticket = db.db.prepare('SELECT * FROM tickets WHERE id=?').get(ticketId);
      if (!ticket) return interaction.editReply({ content: '❌ Ticket introuvable.' });

      let reason = '';
      try { reason = interaction.fields.getTextInputValue('reason') || ''; } catch {}

      const { guild, member } = interaction;
      const cat = getCat(ticket.category);
      const pri = getPri(ticket.priority);
      const cfg = db.getConfig(guild.id) || {};

      // Transcript HTML
      let transcriptBuf = null;
      try { transcriptBuf = await generateHTMLTranscript(interaction.channel, ticket); } catch(e) { console.error('[transcript] error:', e.message); }

      // Mise à jour DB
      db.db.prepare("UPDATE tickets SET status='closed', closed_at=?, close_reason=? WHERE id=?")
        .run(ts(), reason || `Fermé par ${member.user.username}`, ticket.id);

      // Log channel
      const logCh = cfg.ticket_log_channel ? guild.channels.cache.get(cfg.ticket_log_channel) : null;
      const ageS = ts() - ticket.created_at;
      const ageStr = ageS < 60 ? `${ageS}s` : ageS < 3600 ? `${Math.floor(ageS/60)}min` : `${Math.floor(ageS/3600)}h${Math.floor((ageS%3600)/60)}m`;

      const logEmbed = new EmbedBuilder().setColor('#ED4245')
        .setTitle(`📁 Ticket #${ticket.id} fermé — ${cat.label}`)
        .addFields(
          { name: '👤 Auteur',     value: `<@${ticket.user_id}>`, inline: true },
          { name: '🛡️ Fermé par', value: `<@${member.id}>`,      inline: true },
          { name: `${cat.emoji} Catégorie`, value: cat.label, inline: true },
          { name: '🎯 Priorité',   value: pri.label,              inline: true },
          { name: '⏱️ Durée',      value: ageStr,                 inline: true },
          { name: '✋ Responsable', value: ticket.claimed_by ? `<@${ticket.claimed_by}>` : '`Non assigné`', inline: true },
          { name: '📝 Raison',     value: reason || '*Non spécifiée*', inline: false },
        )
        .setFooter({ text: `${guild.name} • Ticket #${ticket.id}` }).setTimestamp();

      const files = transcriptBuf ? [new AttachmentBuilder(transcriptBuf, { name: `transcript-${ticket.id}.html` })] : [];
      if (logCh) await logCh.send({ embeds: [logEmbed], files }).catch(() => {});

      // DM à l'auteur
      if (transcriptBuf) {
        try {
          const u = await guild.client.users.fetch(ticket.user_id).catch(() => null);
          if (u) await u.send({
            embeds: [new EmbedBuilder().setColor('#5865F2')
              .setTitle(`📁 Ton ticket #${ticket.id} a été fermé`)
              .addFields(
                { name: '🏠 Serveur', value: guild.name, inline: true },
                { name: `${cat.emoji} Catégorie`, value: cat.label, inline: true },
                { name: '⏱️ Durée', value: ageStr, inline: true },
              )
              .setDescription('Le transcript de ta conversation est joint ci-dessous.')
              .setFooter({ text: 'Merci d\'avoir utilisé notre support ✨' })
            ],
            files: [new AttachmentBuilder(transcriptBuf, { name: `transcript-${ticket.id}.html` })],
          }).catch(() => {});
        } catch {}
      }

      // Note privée rating → channel
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor('#5865F2')
          .setTitle('🌟 Évalue notre support !')
          .setDescription(
            `<@${ticket.user_id}> — Ticket **#${ticket.id}** fermé avec succès.\n\n` +
            `**Comment as-tu trouvé notre support ?**\n` +
            `Clique sur le nombre d'étoiles pour noter.`
          )
          .setFooter({ text: 'Ce salon sera supprimé dans 30 secondes' })
        ],
        components: [new ActionRowBuilder().addComponents(
          [1,2,3,4,5].map(n => new ButtonBuilder()
            .setCustomId(`ticket_rate_${ticket.id}_${n}`)
            .setLabel(`${n} ${'⭐'.repeat(Math.min(n,3))}`)
            .setStyle(n >= 4 ? ButtonStyle.Success : n === 3 ? ButtonStyle.Primary : ButtonStyle.Secondary)
          )
        )],
      });

      setTimeout(() => interaction.channel?.delete().catch(() => {}), 30000);
    } catch (err) {
      console.error('[ticket_close_confirm] CRASH:', err?.stack || err?.message);
      try { await interaction.editReply({ content: `❌ Erreur fermeture: ${err?.message}` }); } catch {}
    }
    return true;
  }

  // ─── ticket_claim_{id} ────────────────────────────────────────────────────────
  if (customId.startsWith('ticket_claim_')) {
    try {
      const ticketId = customId.replace('ticket_claim_', '');
      const ticket = db.db.prepare('SELECT * FROM tickets WHERE id=?').get(ticketId);
      if (!ticket) return interaction.editReply({ content: '❌ Ticket introuvable.', ephemeral: true });
      const cfg = db.getConfig(interaction.guildId) || {};
      const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)
        || (cfg.ticket_staff_role && interaction.member.roles.cache.has(cfg.ticket_staff_role));
      if (!isStaff) return interaction.editReply({ content: '❌ Réservé au staff.', ephemeral: true });
      if (ticket.claimed_by) return interaction.editReply({ content: `⚠️ Déjà pris en charge par <@${ticket.claimed_by}>.`, ephemeral: true });
      db.db.prepare('UPDATE tickets SET claimed_by=?, last_activity=? WHERE id=?').run(interaction.user.id, ts(), ticket.id);
      await interaction.channel.setTopic(`ticket:${ticket.user_id} | ✋ ${interaction.user.username}`).catch(() => {});
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2ECC71')
        .setDescription(`✋ **${interaction.member.displayName}** a pris en charge ce ticket.\n<@${ticket.user_id}>, tu vas être aidé rapidement ! 🎯`)
        .setAuthor({ name: interaction.member.displayName, iconURL: interaction.user.displayAvatarURL() }).setTimestamp()
      ]});
    } catch (err) {
      console.error('[ticket_claim] error:', err?.message);
      if (!interaction.replied && !interaction.deferred) await interaction.editReply({ content: '❌ Erreur.', ephemeral: true }).catch(() => {});
    }
    return true;
  }

  // ─── ticket_pri_{id} → Sélecteur de priorité ────────────────────────────────
  if (customId.startsWith('ticket_pri_') && !customId.startsWith('ticket_pri_select_')) {
    try {
      const ticketId = customId.replace('ticket_pri_', '');
      const cfg = db.getConfig(interaction.guildId) || {};
      const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)
        || (cfg.ticket_staff_role && interaction.member.roles.cache.has(cfg.ticket_staff_role));
      if (!isStaff) return interaction.editReply({ content: '❌ Réservé au staff.', ephemeral: true });
      await interaction.editReply({
        components: [new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder().setCustomId(`ticket_pri_select_${ticketId}`)
            .setPlaceholder('Sélectionner une priorité')
            .addOptions(PRIORITIES.map(p => ({ label: p.label, value: p.value })))
        )],
        ephemeral: true,
      });
    } catch (err) {
      if (!interaction.replied && !interaction.deferred) await interaction.editReply({ content: '❌ Erreur.', ephemeral: true }).catch(() => {});
    }
    return true;
  }

  // ─── ticket_pri_select_{id} → Appliquer la priorité ─────────────────────────
  if (customId.startsWith('ticket_pri_select_')) {
    try {
      const ticketId = customId.replace('ticket_pri_select_', '');
      const pv = interaction.values?.[0] || 'normale';
      const pri = getPri(pv);
      db.db.prepare('UPDATE tickets SET priority=? WHERE id=?').run(pv, ticketId);
      await interaction.update({ content: `✅ Priorité : **${pri.label}**`, components: [] });
      await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(pri.color)
        .setDescription(`🎯 Priorité changée en **${pri.label}** par <@${interaction.user.id}>`).setTimestamp()
      ]}).catch(() => {});
    } catch (err) {
      if (!interaction.replied && !interaction.deferred) await interaction.editReply({ content: '❌ Erreur.', ephemeral: true }).catch(() => {});
    }
    return true;
  }

  // ─── ticket_lock_{id} → Verrouiller / Déverrouiller ─────────────────────────
  if (customId.startsWith('ticket_lock_')) {
    try {
      const ticketId = customId.replace('ticket_lock_', '');
      const ticket = db.db.prepare('SELECT * FROM tickets WHERE id=?').get(ticketId);
      if (!ticket) return interaction.editReply({ content: '❌ Ticket introuvable.', ephemeral: true });
      const cfg = db.getConfig(interaction.guildId) || {};
      const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)
        || (cfg.ticket_staff_role && interaction.member.roles.cache.has(cfg.ticket_staff_role));
      if (!isStaff) return interaction.editReply({ content: '❌ Réservé au staff.', ephemeral: true });
      const newLocked = ticket.locked ? 0 : 1;
      db.db.prepare('UPDATE tickets SET locked=? WHERE id=?').run(newLocked, ticketId);
      await interaction.channel.permissionOverwrites.edit(ticket.user_id, { SendMessages: !newLocked }).catch(() => {});
      await interaction.editReply({ embeds: [new EmbedBuilder()
        .setColor(newLocked ? '#E74C3C' : '#2ECC71')
        .setDescription(`${newLocked ? '🔐 Ticket **verrouillé**' : '🔓 Ticket **déverrouillé**'} par <@${interaction.user.id}>\n${newLocked ? "L'utilisateur ne peut plus envoyer de messages." : "L'utilisateur peut de nouveau écrire."}`)
        .setTimestamp()
      ]});
    } catch (err) {
      if (!interaction.replied && !interaction.deferred) await interaction.editReply({ content: '❌ Erreur.', ephemeral: true }).catch(() => {});
    }
    return true;
  }

  // ─── ticket_qr_{id} → Menu réponses rapides ──────────────────────────────────
  if (customId.startsWith('ticket_qr_') && !customId.startsWith('ticket_qr_select_')) {
    try {
      const ticketId = customId.replace('ticket_qr_', '');
      const cfg = db.getConfig(interaction.guildId) || {};
      const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)
        || (cfg.ticket_staff_role && interaction.member.roles.cache.has(cfg.ticket_staff_role));
      if (!isStaff) return interaction.editReply({ content: '❌ Réservé au staff.', ephemeral: true });
      const BASE = [
        { label: '👋 Bienvenue / Prise en charge', value: 'qr_welcome', description: 'Accueillir et se présenter' },
        { label: '⏳ Merci de patienter',           value: 'qr_wait',    description: 'Demander de patienter' },
        { label: '📷 Demander des captures',        value: 'qr_screen',  description: 'Demander des preuves visuelles' },
        { label: '🔄 Besoin de plus d\'infos',      value: 'qr_info',    description: 'Demander des détails supplémentaires' },
        { label: '✅ Problème résolu',               value: 'qr_ok',      description: 'Confirmer la résolution' },
        { label: '🔒 Fermeture imminente',           value: 'qr_close',   description: 'Avertir avant fermeture' },
        { label: '📋 Envoyer les logs',              value: 'qr_logs',    description: 'Demander les logs d\'erreur' },
        { label: '💡 Reformuler la demande',         value: 'qr_reword',  description: 'Demander une reformulation' },
      ];
      const custom = db.db.prepare('SELECT * FROM ticket_quick_replies WHERE guild_id=? ORDER BY title LIMIT 15').all(interaction.guildId);
      const opts = [...BASE, ...custom.map(r => ({ label: `✏️ ${r.title}`.slice(0,100), value: `qr_c_${r.id}`, description: r.content.slice(0,100) }))].slice(0,25);
      await interaction.editReply({
        components: [new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder().setCustomId(`ticket_qr_select_${ticketId}`).setPlaceholder('💬 Réponse rapide...').addOptions(opts)
        )],
        ephemeral: true,
      });
    } catch (err) {
      if (!interaction.replied && !interaction.deferred) await interaction.editReply({ content: '❌ Erreur.', ephemeral: true }).catch(() => {});
    }
    return true;
  }

  // ─── ticket_qr_select_{id} → Envoyer réponse ────────────────────────────────
  if (customId.startsWith('ticket_qr_select_')) {
    try {
      const sel = interaction.values?.[0];
      const { member } = interaction;
      const QR = {
        qr_welcome: `👋 **Bonjour !** Je suis **${member.displayName}**, je prends ta demande en charge dès maintenant ! 🎯`,
        qr_wait:    `⏳ **Merci pour ta patience !** On analyse ta situation et on revient très rapidement. 🔍`,
        qr_screen:  `📷 **Peux-tu nous envoyer des captures d'écran ?** Ça nous aidera à résoudre ton problème plus vite. 🖼️`,
        qr_info:    `🔄 **Nous avons besoin de plus d'informations.** Peux-tu décrire étape par étape le contexte et l'erreur exacte ? 📋`,
        qr_ok:      `✅ **Ton problème est résolu !** N'hésite pas à nous recontacter si besoin. On ferme ce ticket. 🎉`,
        qr_close:   `🔒 **Ce ticket sera bientôt fermé** faute de réponse. Reviens vers nous si ton problème persiste. 👋`,
        qr_logs:    `📋 **Peux-tu envoyer tes logs d'erreur ?** Ouvre la console (F12 → Console) et copie les erreurs en rouge. 🐛`,
        qr_reword:  `💡 **Peux-tu reformuler ta demande ?** Explique étape par étape ce que tu veux faire et où tu bloques. 🤔`,
      };
      let content;
      if (sel?.startsWith('qr_c_')) {
        const r = db.db.prepare('SELECT * FROM ticket_quick_replies WHERE id=?').get(parseInt(sel.replace('qr_c_','')));
        if (!r) { await interaction.update({ content: '❌ Réponse introuvable.', components: [] }); return true; }
        const ownerId = db.db.prepare('SELECT user_id FROM tickets WHERE channel_id=?').get(interaction.channelId)?.user_id;
        content = r.content.replace(/\{user\}/g, ownerId ? `<@${ownerId}>` : 'utilisateur').replace(/\{staff\}/g, member.displayName);
      } else {
        content = QR[sel] || '✅ Message envoyé.';
      }
      await interaction.update({ content: '✅ Réponse envoyée.', components: [] }).catch(() => {});
      await interaction.channel.send({ embeds: [new EmbedBuilder().setColor('#7B2FBE')
        .setDescription(content)
        .setAuthor({ name: `${member.displayName} — Staff`, iconURL: member.user.displayAvatarURL() })
        .setTimestamp()
      ]}).catch(() => {});
    } catch (err) {
      console.error('[ticket_qr_select] error:', err?.message);
    }
    return true;
  }

  // ─── ticket_transfer_{id} → Modal pour ID staff ──────────────────────────────
  if (customId.startsWith('ticket_transfer_') && !customId.startsWith('ticket_transfer_confirm_')) {
    try {
      const ticketId = customId.replace('ticket_transfer_', '');
      const cfg = db.getConfig(interaction.guildId) || {};
      const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)
        || (cfg.ticket_staff_role && interaction.member.roles.cache.has(cfg.ticket_staff_role));
      if (!isStaff) return interaction.editReply({ content: '❌ Réservé au staff.', ephemeral: true });
      await interaction.showModal(new ModalBuilder()
        .setCustomId(`ticket_transfer_confirm_${ticketId}`)
        .setTitle('🔄 Transférer le ticket')
        .addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('staff_id').setLabel('ID Discord du nouveau responsable')
            .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(20).setPlaceholder('ID Discord (18-19 chiffres)')
        )));
    } catch (err) {
      if (!interaction.replied && !interaction.deferred) await interaction.editReply({ content: '❌ Erreur.', ephemeral: true }).catch(() => {});
    }
    return true;
  }

  // ─── ticket_transfer_confirm_{id} → Appliquer transfert ─────────────────────
  if (customId.startsWith('ticket_transfer_confirm_')) {
    try {
      await interaction.deferReply({ ephemeral: true });
      const ticketId = customId.replace('ticket_transfer_confirm_', '');
      let staffId = '';
      try { staffId = interaction.fields.getTextInputValue('staff_id').trim(); } catch {}
      const target = await interaction.guild.members.fetch(staffId).catch(() => null);
      if (!target) return interaction.editReply({ content: `❌ Membre introuvable : \`${staffId}\`` });
      db.db.prepare('UPDATE tickets SET claimed_by=? WHERE id=?').run(staffId, ticketId);
      await interaction.channel.permissionOverwrites.edit(target, {
        ViewChannel: true, SendMessages: true, ReadMessageHistory: true, ManageMessages: true,
      }).catch(() => {});
      await interaction.editReply({ content: `✅ Ticket transféré à **${target.displayName}**.` });
      await interaction.channel.send({ embeds: [new EmbedBuilder().setColor('#3498DB')
        .setDescription(`🔄 Ticket transféré à **${target.displayName}** par <@${interaction.user.id}>`)
        .setTimestamp()
      ]}).catch(() => {});
    } catch (err) {
      console.error('[ticket_transfer_confirm]', err?.message);
      try { await interaction.editReply({ content: '❌ Erreur.' }); } catch {}
    }
    return true;
  }

  // ─── ticket_note_{id} → Modal note privée ───────────────────────────────────
  if (customId.startsWith('ticket_note_') && !customId.startsWith('ticket_note_sub_')) {
    try {
      const ticketId = customId.replace('ticket_note_', '');
      const cfg = db.getConfig(interaction.guildId) || {};
      const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)
        || (cfg.ticket_staff_role && interaction.member.roles.cache.has(cfg.ticket_staff_role));
      if (!isStaff) return interaction.editReply({ content: '❌ Réservé au staff.', ephemeral: true });
      await interaction.showModal(new ModalBuilder()
        .setCustomId(`ticket_note_sub_${ticketId}`)
        .setTitle('📝 Ajouter une note privée')
        .addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('note').setLabel('Note (visible staff uniquement)')
            .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000)
            .setPlaceholder('Informations internes, suivi, contexte...')
        )));
    } catch (err) {
      if (!interaction.replied && !interaction.deferred) await interaction.editReply({ content: '❌ Erreur.', ephemeral: true }).catch(() => {});
    }
    return true;
  }

  // ─── ticket_note_sub_{id} → Sauvegarder note ────────────────────────────────
  if (customId.startsWith('ticket_note_sub_')) {
    try {
      const ticketId = customId.replace('ticket_note_sub_', '');
      let note = '';
      try { note = interaction.fields.getTextInputValue('note'); } catch {}
      if (!note.trim()) return interaction.editReply({ content: '❌ Note vide.', ephemeral: true });
      db.db.prepare('INSERT INTO ticket_notes (ticket_id, author_id, content, created_at) VALUES (?,?,?,?)').run(parseInt(ticketId), interaction.user.id, note, ts());
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#F39C12')
        .setTitle('📝 Note privée enregistrée')
        .setDescription(`> *${note.slice(0,500)}*`)
        .setAuthor({ name: interaction.member.displayName, iconURL: interaction.user.displayAvatarURL() })
        .setFooter({ text: '🔒 Visible uniquement par le staff' }).setTimestamp()
      ], ephemeral: true });
    } catch (err) {
      if (!interaction.replied && !interaction.deferred) await interaction.editReply({ content: '❌ Erreur.', ephemeral: true }).catch(() => {});
    }
    return true;
  }

  // ─── ticket_info_{id} → Infos ticket ────────────────────────────────────────
  if (customId.startsWith('ticket_info_')) {
    try {
      const ticketId = customId.replace('ticket_info_', '');
      const ticket = db.db.prepare('SELECT * FROM tickets WHERE id=?').get(ticketId);
      if (!ticket) return interaction.editReply({ content: '❌ Ticket introuvable.', ephemeral: true });
      const cat = getCat(ticket.category);
      const pri = getPri(ticket.priority);
      const ageS = ts() - ticket.created_at;
      const ageStr = ageS < 60 ? `${ageS}s` : ageS < 3600 ? `${Math.floor(ageS/60)}min` : `${Math.floor(ageS/3600)}h${Math.floor((ageS%3600)/60)}m`;
      const notes = db.db.prepare('SELECT * FROM ticket_notes WHERE ticket_id=? ORDER BY created_at DESC LIMIT 5').all(ticket.id);
      let fd = {}; try { fd = JSON.parse(ticket.form_data||'{}'); } catch {}
      const fields = [
        { name: '👤 Auteur',     value: `<@${ticket.user_id}>`,    inline: true },
        { name: `${cat.emoji} Catégorie`, value: cat.label,        inline: true },
        { name: '🎯 Priorité',   value: pri.label,                  inline: true },
        { name: '✋ Responsable', value: ticket.claimed_by ? `<@${ticket.claimed_by}>` : '`Non assigné`', inline: true },
        { name: '⏱️ Ouvert depuis', value: ageStr,                  inline: true },
        { name: '🔐 Verrouillé', value: ticket.locked ? '`Oui`' : '`Non`', inline: true },
      ];
      if (Object.keys(fd).length) {
        const sum = Object.entries(fd).slice(0,3).map(([k,v]) => `**${k}:** ${String(v).slice(0,60)}`).join('\n');
        fields.push({ name: '📋 Formulaire', value: sum, inline: false });
      }
      if (notes.length) {
        const ns = notes.map(n => `> <@${n.author_id}>: *${n.content.slice(0,80)}*`).join('\n');
        fields.push({ name: `📝 Notes (${notes.length})`, value: ns, inline: false });
      }
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(cat.color)
        .setTitle(`ℹ️ Ticket #${ticket.id}`)
        .addFields(...fields).setTimestamp()
      ], ephemeral: true });
    } catch (err) {
      if (!interaction.replied && !interaction.deferred) await interaction.editReply({ content: '❌ Erreur.', ephemeral: true }).catch(() => {});
    }
    return true;
  }

  // ─── ticket_rate_{id}_{n} → Notation ────────────────────────────────────────
  if (customId.startsWith('ticket_rate_')) {
    try {
      const parts = customId.split('_');
      const n = parseInt(parts[parts.length - 1]);
      const ticketId = parts[2];
      if (n >= 1 && n <= 5) {
        db.db.prepare('UPDATE tickets SET rating=? WHERE id=?').run(n, ticketId);
        const cfg = db.getConfig(interaction.guildId) || {};
        const logCh = cfg.ticket_log_channel ? interaction.guild?.channels.cache.get(cfg.ticket_log_channel) : null;
        if (logCh) {
          await logCh.send({ embeds: [new EmbedBuilder()
            .setColor(n >= 4 ? '#2ECC71' : n >= 3 ? '#F39C12' : '#E74C3C')
            .setDescription(`⭐ **Note Ticket #${ticketId}** : **${n}/5** ${'⭐'.repeat(n)}${'☆'.repeat(5-n)}\nPar <@${interaction.user.id}>`)
            .setTimestamp()
          ]}).catch(() => {});
        }
      }
      const emoji = ['😞','😐','🙂','😊','🤩'][n-1] || '😊';
      await interaction.update({
        embeds: [new EmbedBuilder()
          .setColor(n >= 4 ? '#2ECC71' : n >= 3 ? '#F39C12' : '#E74C3C')
          .setTitle('✨ Merci pour ta note !')
          .setDescription(`${emoji} Tu nous as donné **${n}/5** ${'⭐'.repeat(n)}${'☆'.repeat(5-n)}\n*Ton avis nous aide à nous améliorer !*`)
        ],
        components: [],
      });
    } catch (err) { console.error('[ticket_rate]', err?.message); }
    return true;
  }

  return false;
}


// ── Panel embed ───────────────────────────────────────────────────────────────
function buildPanelEmbed(guild, openCount, totalCount) {
  const ratingRows = db.db.prepare("SELECT AVG(rating) as avg FROM tickets WHERE guild_id=? AND rating IS NOT NULL").get(guild.id);
  const avg = ratingRows?.avg ? Math.round(ratingRows.avg * 10) / 10 : 5.0;
  const stars = '⭐'.repeat(Math.round(avg));

  return new EmbedBuilder()
    .setColor('#2B2D31')
    .setAuthor({ name: `${guild.name} — Assistance officielle`, iconURL: guild.iconURL({ size: 128 }) || undefined })
    .setTitle("🌟  CENTRE D'ASSISTANCE OFFICIEL  🌟")
    .setDescription(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Vous méritez une aide **rapide**, **personnelle** et **de qualité**.\n` +
      `Chaque demande est traitée avec le plus grand soin, dans un cadre **entièrement confidentiel**.\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `**📋 Sélectionnez la nature de votre demande :**\n\n` +
      CATEGORIES.map(c =>
        `${c.emoji}  **${c.label.replace(/^\S+ /,'')}**\n` +
        `┗ *${c.description}*`
      ).join('\n\n') +
      `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `⏱️  Réponse garantie en **moins de 2h**\n` +
      `🔒  Espace privé — **Confidentialité totale**\n` +
      `⭐  Satisfaction : **${stars} ${avg}/5**\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Cliquez sur le bouton correspondant à votre demande pour ouvrir un ticket.`
    )
    .addFields(
      { name: '📬 Tickets ouverts',  value: `\`${openCount}\``,  inline: true },
      { name: '📊 Tickets traités',  value: `\`${totalCount}\``, inline: true },
      { name: '🕐 Disponibilité',    value: '`7j/7 — 24h/24`',  inline: true },
    )
    .setThumbnail(guild.iconURL({ size: 256 }) || null)
    .setFooter({ text: `${guild.name} • Support Premium & Confidentiel`, iconURL: guild.iconURL() || undefined })
    .setTimestamp();
}

function buildPanelRows() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_cat_support').setLabel('Support Général').setEmoji('💬').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ticket_cat_bug').setLabel('Problème Technique').setEmoji('🐛').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket_cat_partenariat').setLabel('Partenariat').setEmoji('🤝').setStyle(ButtonStyle.Success),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_cat_signalement').setLabel('Signalement').setEmoji('🚨').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket_cat_achat').setLabel('Achat / Premium').setEmoji('💰').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket_cat_autre').setLabel('Autre').setEmoji('📋').setStyle(ButtonStyle.Secondary),
  );
  return [row1, row2];
}


// ── SlashCommandBuilder ───────────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('🎫 Système de tickets ultra-avancé')
    .addSubcommand(s => s
      .setName('setup')
      .setDescription('⚙️ Configurer le système de tickets')
      .addChannelOption(o => o.setName('salon').setDescription('Salon où envoyer le panneau').setRequired(true).addChannelTypes(ChannelType.GuildText))
      .addRoleOption(o => o.setName('staff').setDescription('Rôle du staff').setRequired(true))
      .addChannelOption(o => o.setName('categorie').setDescription('Catégorie Discord pour les tickets').setRequired(false).addChannelTypes(ChannelType.GuildCategory))
      .addChannelOption(o => o.setName('logs').setDescription('Salon logs/transcripts').setRequired(false).addChannelTypes(ChannelType.GuildText))
      .addIntegerOption(o => o.setName('max').setDescription('Tickets ouverts max par utilisateur (défaut: 1)').setRequired(false).setMinValue(1).setMaxValue(5))
    )
    .addSubcommand(s => s
      .setName('panel')
      .setDescription('🖼️ Publier le panneau de tickets')
      .addChannelOption(o => o.setName('salon').setDescription('Salon cible (vide = salon configuré)').setRequired(false).addChannelTypes(ChannelType.GuildText))
    )
    .addSubcommand(s => s
      .setName('fermer')
      .setDescription('🔒 Fermer ce ticket')
      .addStringOption(o => o.setName('raison').setDescription('Raison de fermeture').setRequired(false).setMaxLength(200))
    )
    .addSubcommand(s => s.setName('claim').setDescription('✋ Prendre en charge ce ticket (Staff)'))
    .addSubcommand(s => s
      .setName('assign')
      .setDescription('👤 Assigner ce ticket à un membre du staff')
      .addUserOption(o => o.setName('staff').setDescription('Membre du staff à assigner').setRequired(true))
    )
    .addSubcommand(s => s
      .setName('ajouter')
      .setDescription('➕ Ajouter un membre à ce ticket')
      .addUserOption(o => o.setName('membre').setDescription('Membre à ajouter').setRequired(true))
    )
    .addSubcommand(s => s
      .setName('retirer')
      .setDescription('➖ Retirer un membre de ce ticket')
      .addUserOption(o => o.setName('membre').setDescription('Membre à retirer').setRequired(true))
    )
    .addSubcommand(s => s
      .setName('priority')
      .setDescription('🎯 Changer la priorité de ce ticket (Staff)')
      .addStringOption(o => o.setName('niveau').setDescription('Niveau de priorité').setRequired(true)
        .addChoices(
          { name: '🟢 Faible', value: 'faible' },
          { name: '🟡 Normale', value: 'normale' },
          { name: '🟠 Élevée', value: 'elevee' },
          { name: '🔴 Urgente', value: 'urgente' },
        ))
    )
    .addSubcommand(s => s
      .setName('note')
      .setDescription('📝 Ajouter une note privée staff à ce ticket')
      .addStringOption(o => o.setName('texte').setDescription('Contenu de la note').setRequired(true).setMaxLength(1000))
    )
    .addSubcommand(s => s
      .setName('lock')
      .setDescription('🔐 Verrouiller/déverrouiller ce ticket (Staff)')
    )
    .addSubcommand(s => s
      .setName('rename')
      .setDescription('✏️ Renommer ce ticket')
      .addStringOption(o => o.setName('nom').setDescription('Nouveau nom').setRequired(true).setMaxLength(50))
    )
    .addSubcommand(s => s.setName('info').setDescription('ℹ️ Voir les détails de ce ticket'))
    .addSubcommand(s => s.setName('liste').setDescription('📋 Liste des tickets ouverts'))
    .addSubcommand(s => s.setName('stats').setDescription('📊 Statistiques des tickets (Staff only)'))
    .addSubcommand(s => s
      .setName('reopen')
      .setDescription('🔓 Rouvrir le dernier ticket fermé d\'un membre (Staff)')
      .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
    )
    .addSubcommand(s => s
      .setName('blacklist')
      .setDescription('🚫 Blacklist — gérer les accès aux tickets (Staff)')
      .addStringOption(o => o.setName('action').setDescription('Action').setRequired(true)
        .addChoices({ name: '➕ Ajouter', value: 'add' }, { name: '➖ Retirer', value: 'remove' }, { name: '📋 Lister', value: 'list' }))
      .addUserOption(o => o.setName('membre').setDescription('Membre à blacklister').setRequired(false))
      .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false).setMaxLength(200))
    )
    .addSubcommand(s => s
      .setName('qr')
      .setDescription('💬 Gérer les réponses rapides personnalisées (Staff)')
      .addStringOption(o => o.setName('action').setDescription('Action').setRequired(true)
        .addChoices({ name: '➕ Ajouter', value: 'add' }, { name: '➖ Supprimer', value: 'remove' }, { name: '📋 Lister', value: 'list' }))
      .addStringOption(o => o.setName('titre').setDescription('Titre de la réponse').setRequired(false).setMaxLength(50))
      .addStringOption(o => o.setName('contenu').setDescription('Contenu ({user} = mention, {staff} = nom staff)').setRequired(false).setMaxLength(1000))
    ),
  cooldown: 3,

  handleComponent,

  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;
    const sub = interaction.options.getSubcommand();
    const cfg = db.getConfig(interaction.guildId) || {};
    const isStaff = () =>
      interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
      (cfg.ticket_staff_role && interaction.member.roles.cache.has(String(cfg.ticket_staff_role)));
    const reply = (opts) => {
      if (interaction.deferred || interaction.replied) return interaction.editReply(opts);
      return interaction.editReply(opts);
    };

    // ══ SETUP ══════════════════════════════════════════════════════════════════
    if (sub === 'setup') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
        return reply({ content: '❌ Permission insuffisante (Gérer le serveur requis).', ephemeral: true });

      const channel  = interaction.options.getChannel('salon');
      const staff    = interaction.options.getRole('staff');
      const category = interaction.options.getChannel('categorie');
      const logs     = interaction.options.getChannel('logs');
      const max      = interaction.options.getInteger('max') || 1;

      db.setConfig(interaction.guildId, 'ticket_staff_role',   staff.id);
      db.setConfig(interaction.guildId, 'ticket_channel',      channel.id);
      db.setConfig(interaction.guildId, 'ticket_max_open',     max);
      if (category) db.setConfig(interaction.guildId, 'ticket_category',    category.id);
      if (logs)     db.setConfig(interaction.guildId, 'ticket_log_channel', logs.id);

      // Auto-grant permissions bot
      const bot = interaction.guild.members.me;
      try { await channel.permissionOverwrites.edit(bot, { ViewChannel:true, SendMessages:true, EmbedLinks:true, ReadMessageHistory:true, ManageMessages:true }); } catch {}
      if (category) try { await category.permissionOverwrites.edit(bot, { ViewChannel:true, SendMessages:true, EmbedLinks:true, ReadMessageHistory:true, ManageChannels:true, ManageMessages:true, AttachFiles:true }); } catch {}
      if (logs) try { await logs.permissionOverwrites.edit(bot, { ViewChannel:true, SendMessages:true, EmbedLinks:true, ReadMessageHistory:true, AttachFiles:true }); } catch {}

      return reply({ embeds: [new EmbedBuilder().setColor('#2ECC71').setTitle('✅ Système de tickets configuré !')
        .addFields(
          { name: '📍 Salon panel',     value: `${channel}`,                             inline: true },
          { name: '👮 Rôle staff',      value: `${staff}`,                               inline: true },
          { name: '📁 Catégorie',       value: category ? category.name : '`Non définie`', inline: true },
          { name: '📋 Logs',            value: logs ? `${logs}` : '`Non configuré`',       inline: true },
          { name: '🎫 Max tickets/user', value: `\`${max}\``,                             inline: true },
        )
        .setFooter({ text: 'Utilisez /ticket panel pour publier le panneau' })
      ], ephemeral: true });
    }

    // ══ PANEL ══════════════════════════════════════════════════════════════════
    if (sub === 'panel') {
      if (!isStaff() && !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
        return reply({ content: '❌ Permission insuffisante.', ephemeral: true });

      let channel = interaction.options.getChannel('salon');
      if (!channel) {
        const chId = cfg.ticket_channel;
        channel = chId ? interaction.guild.channels.cache.get(String(chId)) : null;
      }
      if (!channel) return reply({ content: '❌ Aucun salon configuré. Fais `/ticket setup` d\'abord ou spécifie un salon.', ephemeral: true });

      await interaction.deferReply({ ephemeral: true });

      const openCount  = db.db.prepare("SELECT COUNT(*) as c FROM tickets WHERE guild_id=? AND status='open'").get(interaction.guildId)?.c || 0;
      const totalCount = db.db.prepare("SELECT COUNT(*) as c FROM tickets WHERE guild_id=?").get(interaction.guildId)?.c || 0;

      // Purger les anciens messages du bot dans ce salon
      try {
        const msgs = await channel.messages.fetch({ limit: 50 });
        const botMsgs = msgs.filter(m => m.author.id === interaction.client.user.id && m.components.length > 0);
        for (const [, m] of botMsgs) await m.delete().catch(() => {});
      } catch {}

      const embed = buildPanelEmbed(interaction.guild, openCount, totalCount);
      const [row1, row2] = buildPanelRows();
      await channel.send({ embeds: [embed], components: [row1, row2] });

      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2ECC71')
        .setDescription(`✅ Panneau publié dans ${channel} avec succès !`)
      ]});
    }

    // ══ FERMER ═════════════════════════════════════════════════════════════════
    if (sub === 'fermer') {
      const ticket = db.db.prepare("SELECT * FROM tickets WHERE guild_id=? AND channel_id=? AND status='open'")
        .get(interaction.guildId, interaction.channelId);
      if (!ticket) return reply({ content: '❌ Ce salon n\'est pas un ticket actif.', ephemeral: true });
      if (!isStaff() && interaction.user.id !== ticket.user_id)
        return reply({ content: '❌ Seul le staff ou le créateur peut fermer ce ticket.', ephemeral: true });

      const raison = interaction.options.getString('raison') || '';
      db.db.prepare('UPDATE tickets SET close_reason=? WHERE id=?').run(raison, ticket.id);

      return reply({
        embeds: [new EmbedBuilder().setColor('#FF6B6B').setTitle('🔒 Fermer ce ticket ?')
          .setDescription('Un transcript HTML sera généré et envoyé dans les logs et en DM à l\'auteur.')
          .addFields({ name: '📝 Raison', value: raison || '*Non spécifiée*' })
        ],
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`ticket_close_confirm_${ticket.id}`).setLabel('Confirmer').setEmoji('🔒').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`ticket_cancel_close_${ticket.id}`).setLabel('Annuler').setStyle(ButtonStyle.Secondary),
        )],
      });
    }

    // ══ CLAIM ══════════════════════════════════════════════════════════════════
    if (sub === 'claim') {
      if (!isStaff()) return reply({ content: '❌ Réservé au staff.', ephemeral: true });
      const ticket = db.db.prepare("SELECT * FROM tickets WHERE guild_id=? AND channel_id=? AND status='open'")
        .get(interaction.guildId, interaction.channelId);
      if (!ticket) return reply({ content: '❌ Ce salon n\'est pas un ticket.', ephemeral: true });
      if (ticket.claimed_by) return reply({ content: `⚠️ Déjà pris en charge par <@${ticket.claimed_by}>.`, ephemeral: true });
      db.db.prepare('UPDATE tickets SET claimed_by=?, last_activity=? WHERE id=?').run(interaction.user.id, ts(), ticket.id);
      await interaction.channel.setTopic(`ticket:${ticket.user_id} | ✋ ${interaction.user.username}`).catch(() => {});
      return reply({ embeds: [new EmbedBuilder().setColor('#2ECC71')
        .setDescription(`✋ **${interaction.member.displayName}** a pris en charge ce ticket.\n<@${ticket.user_id}>, tu seras aidé rapidement !`)
      ]});
    }

    // ══ ASSIGN ═════════════════════════════════════════════════════════════════
    if (sub === 'assign') {
      if (!isStaff()) return reply({ content: '❌ Réservé au staff.', ephemeral: true });
      const ticket = db.db.prepare("SELECT * FROM tickets WHERE guild_id=? AND channel_id=? AND status='open'")
        .get(interaction.guildId, interaction.channelId);
      if (!ticket) return reply({ content: '❌ Ce salon n\'est pas un ticket.', ephemeral: true });
      const target = interaction.options.getMember('staff');
      db.db.prepare('UPDATE tickets SET claimed_by=? WHERE id=?').run(target.id, ticket.id);
      await interaction.channel.permissionOverwrites.edit(target, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, ManageMessages: true }).catch(() => {});
      return reply({ embeds: [new EmbedBuilder().setColor('#2ECC71')
        .setDescription(`👤 Ticket assigné à **${target.displayName}** par <@${interaction.user.id}>.`)
      ]});
    }

    // ══ AJOUTER ════════════════════════════════════════════════════════════════
    if (sub === 'ajouter') {
      if (!isStaff() && !db.db.prepare('SELECT * FROM tickets WHERE channel_id=? AND user_id=?').get(interaction.channelId, interaction.user.id))
        return reply({ content: '❌ Réservé au staff ou au créateur du ticket.', ephemeral: true });
      const target = interaction.options.getMember('membre');
      await interaction.channel.permissionOverwrites.edit(target, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true });
      return reply({ embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription(`✅ **${target.displayName}** ajouté au ticket.`)] });
    }

    // ══ RETIRER ════════════════════════════════════════════════════════════════
    if (sub === 'retirer') {
      if (!isStaff()) return reply({ content: '❌ Réservé au staff.', ephemeral: true });
      const target = interaction.options.getMember('membre');
      await interaction.channel.permissionOverwrites.edit(target, { ViewChannel: false }).catch(() => {});
      return reply({ embeds: [new EmbedBuilder().setColor('#FFA500').setDescription(`✅ **${target.displayName}** retiré du ticket.`)] });
    }

    // ══ PRIORITY ═══════════════════════════════════════════════════════════════
    if (sub === 'priority') {
      if (!isStaff()) return reply({ content: '❌ Réservé au staff.', ephemeral: true });
      const ticket = db.db.prepare("SELECT * FROM tickets WHERE guild_id=? AND channel_id=? AND status='open'").get(interaction.guildId, interaction.channelId);
      if (!ticket) return reply({ content: '❌ Ce salon n\'est pas un ticket actif.', ephemeral: true });
      const pv = interaction.options.getString('niveau');
      const pri = getPri(pv);
      db.db.prepare('UPDATE tickets SET priority=? WHERE id=?').run(pv, ticket.id);
      return reply({ embeds: [new EmbedBuilder().setColor(pri.color)
        .setDescription(`🎯 Priorité changée en **${pri.label}** par <@${interaction.user.id}>`)
      ]});
    }

    // ══ NOTE ═══════════════════════════════════════════════════════════════════
    if (sub === 'note') {
      if (!isStaff()) return reply({ content: '❌ Réservé au staff.', ephemeral: true });
      const ticket = db.db.prepare("SELECT * FROM tickets WHERE guild_id=? AND channel_id=?").get(interaction.guildId, interaction.channelId);
      if (!ticket) return reply({ content: '❌ Ce salon n\'est pas un ticket.', ephemeral: true });
      const texte = interaction.options.getString('texte');
      db.db.prepare('INSERT INTO ticket_notes (ticket_id, author_id, content, created_at) VALUES (?,?,?,?)').run(ticket.id, interaction.user.id, texte, ts());
      return reply({ embeds: [new EmbedBuilder().setColor('#F39C12').setTitle('📝 Note privée enregistrée')
        .setDescription(`> *${texte.slice(0,500)}*`)
        .setFooter({ text: '🔒 Visible uniquement par le staff' }).setTimestamp()
      ], ephemeral: true });
    }

    // ══ LOCK ═══════════════════════════════════════════════════════════════════
    if (sub === 'lock') {
      if (!isStaff()) return reply({ content: '❌ Réservé au staff.', ephemeral: true });
      const ticket = db.db.prepare("SELECT * FROM tickets WHERE guild_id=? AND channel_id=? AND status='open'").get(interaction.guildId, interaction.channelId);
      if (!ticket) return reply({ content: '❌ Ce salon n\'est pas un ticket actif.', ephemeral: true });
      const nl = ticket.locked ? 0 : 1;
      db.db.prepare('UPDATE tickets SET locked=? WHERE id=?').run(nl, ticket.id);
      await interaction.channel.permissionOverwrites.edit(ticket.user_id, { SendMessages: !nl }).catch(() => {});
      return reply({ embeds: [new EmbedBuilder().setColor(nl ? '#E74C3C' : '#2ECC71')
        .setDescription(`${nl ? '🔐 Ticket **verrouillé**' : '🔓 Ticket **déverrouillé**'} par <@${interaction.user.id}>`)
      ]});
    }

    // ══ RENAME ═════════════════════════════════════════════════════════════════
    if (sub === 'rename') {
      if (!isStaff()) return reply({ content: '❌ Réservé au staff.', ephemeral: true });
      const nom = interaction.options.getString('nom');
      const safeName = nom.toLowerCase().replace(/[^a-z0-9\-]/g, '-').slice(0, 50);
      await interaction.channel.setName(`🎫・${safeName}`).catch(() => {});
      return reply({ embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription(`✏️ Ticket renommé en **🎫・${safeName}**`)] });
    }

    // ══ INFO ═══════════════════════════════════════════════════════════════════
    if (sub === 'info') {
      const ticket = db.db.prepare("SELECT * FROM tickets WHERE guild_id=? AND channel_id=?").get(interaction.guildId, interaction.channelId);
      if (!ticket) return reply({ content: '❌ Ce salon n\'est pas un ticket.', ephemeral: true });
      const cat = getCat(ticket.category);
      const pri = getPri(ticket.priority);
      const ageS = ts() - ticket.created_at;
      const ageStr = ageS < 60 ? `${ageS}s` : ageS < 3600 ? `${Math.floor(ageS/60)}min` : `${Math.floor(ageS/3600)}h${Math.floor((ageS%3600)/60)}m`;
      const notes = db.db.prepare('SELECT * FROM ticket_notes WHERE ticket_id=? ORDER BY created_at DESC LIMIT 5').all(ticket.id);
      let fd = {}; try { fd = JSON.parse(ticket.form_data||'{}'); } catch {}
      const fields = [
        { name: '👤 Auteur', value: `<@${ticket.user_id}>`, inline: true },
        { name: `${cat.emoji} Catégorie`, value: cat.label, inline: true },
        { name: '🎯 Priorité', value: pri.label, inline: true },
        { name: '✋ Responsable', value: ticket.claimed_by ? `<@${ticket.claimed_by}>` : '`Non assigné`', inline: true },
        { name: '⏱️ Ouvert depuis', value: ageStr, inline: true },
        { name: '🔐 Verrouillé', value: ticket.locked ? '`Oui`' : '`Non`', inline: true },
      ];
      if (Object.keys(fd).length) fields.push({ name: '📋 Formulaire', value: Object.entries(fd).slice(0,3).map(([k,v]) => `**${k}:** ${String(v).slice(0,80)}`).join('\n'), inline: false });
      if (notes.length) fields.push({ name: `📝 Notes (${notes.length})`, value: notes.map(n => `> <@${n.author_id}>: *${n.content.slice(0,80)}*`).join('\n'), inline: false });
      return reply({ embeds: [new EmbedBuilder().setColor(cat.color).setTitle(`ℹ️ Ticket #${ticket.id}`).addFields(...fields).setTimestamp()], ephemeral: true });
    }

    // ══ LISTE ══════════════════════════════════════════════════════════════════
    if (sub === 'liste') {
      const tickets = isStaff()
        ? db.db.prepare("SELECT * FROM tickets WHERE guild_id=? AND status='open' ORDER BY created_at DESC LIMIT 20").all(interaction.guildId)
        : db.db.prepare("SELECT * FROM tickets WHERE guild_id=? AND user_id=? AND status='open'").all(interaction.guildId, interaction.user.id);
      if (!tickets.length) return reply({ embeds: [new EmbedBuilder().setColor('#5865F2').setDescription('📋 Aucun ticket ouvert.')], ephemeral: true });
      const lines = tickets.map(t => {
        const cat = getCat(t.category);
        const ch = interaction.guild.channels.cache.get(t.channel_id);
        const age = Math.floor((Date.now()/1000 - t.created_at)/60);
        return `${cat.emoji} **#${t.id}** ${ch ? ch.toString() : '`[supprimé]`'} — ${cat.label.replace(/^\S+ /,'')} — <@${t.user_id}> — *${age}min*${t.claimed_by ? ` — ✋ <@${t.claimed_by}>` : ''}`;
      });
      return reply({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle(`📋 Tickets ouverts (${tickets.length})`).setDescription(lines.join('\n')).setTimestamp()], ephemeral: true });
    }

    // ══ STATS ══════════════════════════════════════════════════════════════════
    if (sub === 'stats') {
      if (!isStaff()) return reply({ content: '❌ Réservé au staff.', ephemeral: true });
      await interaction.deferReply({ ephemeral: true });
      const open   = db.db.prepare("SELECT COUNT(*) as c FROM tickets WHERE guild_id=? AND status='open'").get(interaction.guildId)?.c || 0;
      const closed = db.db.prepare("SELECT COUNT(*) as c FROM tickets WHERE guild_id=? AND status='closed'").get(interaction.guildId)?.c || 0;
      const total  = db.db.prepare("SELECT COUNT(*) as c FROM tickets WHERE guild_id=?").get(interaction.guildId)?.c || 0;
      const avgR   = db.db.prepare("SELECT AVG(rating) as r FROM tickets WHERE guild_id=? AND rating IS NOT NULL").get(interaction.guildId)?.r;
      const catStats = CATEGORIES.map(c => {
        const n = db.db.prepare("SELECT COUNT(*) as c FROM tickets WHERE guild_id=? AND category=?").get(interaction.guildId, c.value)?.c || 0;
        return { name: `${c.emoji} ${c.label.replace(/^\S+ /,'')}`, value: `\`${n}\``, inline: true };
      });
      const topStaff = db.db.prepare("SELECT claimed_by, COUNT(*) as c FROM tickets WHERE guild_id=? AND claimed_by IS NOT NULL GROUP BY claimed_by ORDER BY c DESC LIMIT 5").all(interaction.guildId);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#7B2FBE').setTitle('📊 Statistiques tickets')
        .addFields(
          { name: '📬 Ouverts', value: `\`${open}\``, inline: true },
          { name: '📁 Fermés', value: `\`${closed}\``, inline: true },
          { name: '📊 Total', value: `\`${total}\``, inline: true },
          { name: '⭐ Note moy.', value: avgR ? `\`${Math.round(avgR*10)/10}/5\`` : '`N/A`', inline: true },
          ...catStats,
          ...(topStaff.length ? [{ name: '🏆 Top Staff', value: topStaff.map(s => `<@${s.claimed_by}>: \`${s.c}\``).join('\n'), inline: false }] : []),
        ).setTimestamp()
      ]});
    }

    // ══ REOPEN ═════════════════════════════════════════════════════════════════
    if (sub === 'reopen') {
      if (!isStaff()) return reply({ content: '❌ Réservé au staff.', ephemeral: true });
      const target = interaction.options.getMember('membre');
      const lastClosed = db.db.prepare("SELECT * FROM tickets WHERE guild_id=? AND user_id=? AND status='closed' ORDER BY closed_at DESC LIMIT 1")
        .get(interaction.guildId, target.id);
      if (!lastClosed) return reply({ content: `❌ Aucun ticket fermé trouvé pour ${target}.`, ephemeral: true });
      await interaction.deferReply({ ephemeral: true });
      const cat = getCat(lastClosed.category);
      const perms = [
        { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: target.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
      ];
      const bot = interaction.guild.members.me;
      if (bot) perms.push({ id: bot.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages] });
      const staffRole = cfg.ticket_staff_role ? interaction.guild.roles.cache.get(String(cfg.ticket_staff_role)) : null;
      if (staffRole) perms.push({ id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] });
      const safeName = (target.user.username||'user').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,12)||'user';
      let ch;
      try {
        ch = await interaction.guild.channels.create({
          name: `🔓・${lastClosed.category}-${safeName}`,
          type: ChannelType.GuildText,
          topic: `ticket:${target.id}`,
          parent: cfg.ticket_category ? String(cfg.ticket_category) : undefined,
          permissionOverwrites: perms,
        });
      } catch (err) {
        return interaction.editReply({ content: `❌ Impossible de créer le salon: ${err?.message}` });
      }
      const newId = db.db.prepare('INSERT INTO tickets (guild_id, user_id, channel_id, status, category, priority, created_at, last_activity, form_data) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(interaction.guildId, target.id, ch.id, 'open', lastClosed.category, lastClosed.priority||'normale', ts(), ts(), lastClosed.form_data||'{}').lastInsertRowid;
      const [r1, r2] = buildControlRows(newId);
      await ch.send({ content: `${target}${staffRole ? ' '+staffRole : ''}`, embeds: [new EmbedBuilder().setColor(cat.color)
        .setTitle(`🔓 Ticket #${newId} rouvert — ${cat.label}`)
        .setDescription(`Ce ticket a été rouvert par <@${interaction.user.id}>.\nTicket précédent : #${lastClosed.id}`)
        .setThumbnail(target.user.displayAvatarURL({ size: 256 })).setTimestamp()
      ], components: [r1, r2] });
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription(`✅ Ticket rouvert pour ${target} dans ${ch}`)] });
    }

    // ══ BLACKLIST ══════════════════════════════════════════════════════════════
    if (sub === 'blacklist') {
      if (!isStaff()) return reply({ content: '❌ Réservé au staff.', ephemeral: true });
      const action = interaction.options.getString('action');
      if (action === 'list') {
        const bl = db.db.prepare('SELECT * FROM ticket_blacklist WHERE guild_id=? ORDER BY created_at DESC LIMIT 20').all(interaction.guildId);
        if (!bl.length) return reply({ embeds: [new EmbedBuilder().setColor('#5865F2').setDescription('📋 Aucun utilisateur blacklisté.')], ephemeral: true });
        return reply({ embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('🚫 Blacklist tickets')
          .setDescription(bl.map(b => `<@${b.user_id}> — *${b.reason||'Non précisée'}* — par <@${b.banned_by}>`).join('\n'))
        ], ephemeral: true });
      }
      const membre = interaction.options.getMember('membre');
      if (!membre) return reply({ content: '❌ Spécifie un membre.', ephemeral: true });
      if (action === 'add') {
        const raison = interaction.options.getString('raison') || 'Non précisée';
        try {
          db.db.prepare('INSERT OR REPLACE INTO ticket_blacklist (guild_id, user_id, reason, banned_by, created_at) VALUES (?,?,?,?,?)').run(interaction.guildId, membre.id, raison, interaction.user.id, ts());
          return reply({ embeds: [new EmbedBuilder().setColor('#E74C3C').setDescription(`🚫 **${membre.displayName}** ajouté à la blacklist.\nRaison : *${raison}*`)], ephemeral: true });
        } catch { return reply({ content: '❌ Erreur blacklist.', ephemeral: true }); }
      }
      if (action === 'remove') {
        db.db.prepare('DELETE FROM ticket_blacklist WHERE guild_id=? AND user_id=?').run(interaction.guildId, membre.id);
        return reply({ embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription(`✅ **${membre.displayName}** retiré de la blacklist.`)], ephemeral: true });
      }
    }

    // ══ QR (Quick Replies) ═════════════════════════════════════════════════════
    if (sub === 'qr') {
      if (!isStaff()) return reply({ content: '❌ Réservé au staff.', ephemeral: true });
      const action = interaction.options.getString('action');
      if (action === 'list') {
        const qrs = db.db.prepare('SELECT * FROM ticket_quick_replies WHERE guild_id=? ORDER BY title').all(interaction.guildId);
        if (!qrs.length) return reply({ embeds: [new EmbedBuilder().setColor('#5865F2').setDescription('📋 Aucune réponse rapide personnalisée.')], ephemeral: true });
        return reply({ embeds: [new EmbedBuilder().setColor('#7B2FBE').setTitle('💬 Réponses rapides')
          .setDescription(qrs.map(r => `**${r.title}** — *${r.content.slice(0,80)}*`).join('\n'))
        ], ephemeral: true });
      }
      const titre   = interaction.options.getString('titre');
      const contenu = interaction.options.getString('contenu');
      if (action === 'add') {
        if (!titre || !contenu) return reply({ content: '❌ Titre et contenu requis.', ephemeral: true });
        try {
          db.db.prepare('INSERT OR REPLACE INTO ticket_quick_replies (guild_id, title, content, created_by, created_at) VALUES (?,?,?,?,?)').run(interaction.guildId, titre, contenu, interaction.user.id, ts());
          return reply({ embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription(`✅ Réponse rapide **${titre}** ajoutée.`)], ephemeral: true });
        } catch { return reply({ content: '❌ Erreur.', ephemeral: true }); }
      }
      if (action === 'remove') {
        if (!titre) return reply({ content: '❌ Titre requis.', ephemeral: true });
        db.db.prepare('DELETE FROM ticket_quick_replies WHERE guild_id=? AND title=?').run(interaction.guildId, titre);
        return reply({ embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription(`✅ Réponse rapide **${titre}** supprimée.`)], ephemeral: true });
      }
    }

    // ══ Annuler fermeture (via /ticket fermer) ══════════════════════════════════
    if (cid.startsWith('ticket_cancel_close_')) {
      if (!interaction.isButton()) return false;
      await interaction.update({
        embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription('↩️ Fermeture annulée. Le ticket reste ouvert.')],
        components: [],
      }).catch(() => {});
      return true;
    }

    return false;
  },
};
