// ============================================================
// partenariat.js — Système de partenariats complet
// Emplacement : src/commands_guild/unique/partenariat.js
// ============================================================
// Fonctionnalités :
//   /partenariat demander  → soumettre une demande (invite + description)
//   /partenariat liste     → voir tous les partenaires
//   /partenariat info      → détails d'un partenaire
//   /partenariat pub       → envoyer sa promo (partenaires uniquement)
//   /partenariat config    → admin : configurer les salons
//   /partenariat valider   → admin : accepter une demande
//   /partenariat refuser   → admin : refuser une demande
//   /partenariat ajouter   → admin : ajouter directement
//   /partenariat retirer   → admin : retirer un partenaire
//
// Stockage : ./data/partenariats.json (relatif à la racine du bot)
// ============================================================

const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const fs   = require('fs');
const path = require('path');

// ─── Stockage JSON ─────────────────────────────────────────
const DATA_DIR  = path.join(__dirname, '../../../data');
const DATA_FILE = path.join(DATA_DIR, 'partenariats.json');

function loadData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '{}', 'utf8');
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return {}; }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function getGuild(guildId) {
  const data = loadData();
  if (!data[guildId]) {
    data[guildId] = {
      requestChannelId: null,
      partnerChannelId: null,
      pubChannelId: null,
      partners: [],
      requests: [],
      pubCooldowns: {},
    };
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

function genId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ─── Vérifications ─────────────────────────────────────────
function isAdmin(member) {
  return member.permissions.has(PermissionFlagsBits.Administrator);
}

function isPartner(userId, guildId) {
  const g = getGuild(guildId);
  return g.partners.some(p => p.repUserId === userId);
}

// ─── Slash Command ─────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('partenariat')
    .setDescription('🤝 Système de partenariats du serveur')

    // demander
    .addSubcommand(s => s
      .setName('demander')
      .setDescription('📩 Soumettre une demande de partenariat')
      .addStringOption(o => o.setName('invite').setDescription('Lien d\'invitation Discord (discord.gg/...)').setRequired(true))
      .addStringOption(o => o.setName('description').setDescription('Description de votre serveur (max 300 caractères)').setRequired(true))
      .addStringOption(o => o.setName('nom').setDescription('Nom de votre serveur').setRequired(true))
      .addStringOption(o => o.setName('banniere').setDescription('URL de la bannière/logo (optionnel)').setRequired(false))
    )

    // liste
    .addSubcommand(s => s
      .setName('liste')
      .setDescription('📋 Voir tous les serveurs partenaires')
    )

    // info
    .addSubcommand(s => s
      .setName('info')
      .setDescription('🔍 Informations sur un partenaire')
      .addStringOption(o => o.setName('nom').setDescription('Nom du serveur partenaire').setRequired(true))
    )

    // pub
    .addSubcommand(s => s
      .setName('pub')
      .setDescription('📢 Envoyer votre publicité dans le salon partenaires (partenaires uniquement)')
      .addStringOption(o => o.setName('message').setDescription('Votre message promotionnel').setRequired(true))
    )

    // config (admin)
    .addSubcommand(s => s
      .setName('config')
      .setDescription('⚙️ [ADMIN] Configurer les salons du système')
      .addStringOption(o => o
        .setName('type')
        .setDescription('Quel salon configurer')
        .setRequired(true)
        .addChoices(
          { name: '📩 Demandes (reçoit les nouvelles demandes)', value: 'requests' },
          { name: '🤝 Partenaires (liste publique)', value: 'partners' },
          { name: '📢 Pub (promos des partenaires)', value: 'pub' },
        )
      )
      .addChannelOption(o => o.setName('salon').setDescription('Salon à utiliser').setRequired(true).addChannelTypes(ChannelType.GuildText))
    )

    // valider (admin)
    .addSubcommand(s => s
      .setName('valider')
      .setDescription('✅ [ADMIN] Accepter une demande de partenariat')
      .addStringOption(o => o.setName('id').setDescription('ID de la demande').setRequired(true))
    )

    // refuser (admin)
    .addSubcommand(s => s
      .setName('refuser')
      .setDescription('❌ [ADMIN] Refuser une demande de partenariat')
      .addStringOption(o => o.setName('id').setDescription('ID de la demande').setRequired(true))
      .addStringOption(o => o.setName('raison').setDescription('Raison du refus (optionnel)').setRequired(false))
    )

    // ajouter (admin)
    .addSubcommand(s => s
      .setName('ajouter')
      .setDescription('➕ [ADMIN] Ajouter un partenaire directement')
      .addStringOption(o => o.setName('nom').setDescription('Nom du serveur').setRequired(true))
      .addStringOption(o => o.setName('invite').setDescription('Lien d\'invitation').setRequired(true))
      .addStringOption(o => o.setName('description').setDescription('Description').setRequired(true))
      .addUserOption(o => o.setName('representant').setDescription('Représentant du serveur partenaire').setRequired(false))
      .addStringOption(o => o.setName('banniere').setDescription('URL bannière/logo').setRequired(false))
    )

    // retirer (admin)
    .addSubcommand(s => s
      .setName('retirer')
      .setDescription('➖ [ADMIN] Retirer un partenaire')
      .addStringOption(o => o.setName('nom').setDescription('Nom du serveur à retirer').setRequired(true))
    )

    // demandes (admin)
    .addSubcommand(s => s
      .setName('demandes')
      .setDescription('📬 [ADMIN] Voir les demandes en attente')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    await handlePartenariat(interaction, sub, {
      userId:  interaction.user.id,
      member:  interaction.member,
      guildId: interaction.guildId,
      guild:   interaction.guild,
      args:    {},
      slash:   true,
    });
  },

  // ─── Préfixe ─────────────────────────────────────────────
  name: 'partenariat',
  aliases: ['partner', 'partners', 'part'],

  async run(message, args) {
    const sub = (args[0] || 'liste').toLowerCase();
    const restArgs = args.slice(1);

    const parsed = {};

    if (sub === 'demander') {
      parsed.invite      = restArgs[0] || null;
      parsed.nom         = restArgs[1] || null;
      parsed.description = restArgs.slice(2).join(' ') || null;
    } else if (sub === 'info') {
      parsed.nom = restArgs.join(' ') || null;
    } else if (sub === 'pub') {
      parsed.message = restArgs.join(' ') || null;
    } else if (sub === 'valider') {
      parsed.id = restArgs[0] || null;
    } else if (sub === 'refuser') {
      parsed.id     = restArgs[0] || null;
      parsed.raison = restArgs.slice(1).join(' ') || null;
    } else if (sub === 'ajouter') {
      parsed.invite      = restArgs[0] || null;
      parsed.nom         = restArgs[1] || null;
      parsed.description = restArgs.slice(2).join(' ') || null;
    } else if (sub === 'retirer') {
      parsed.nom = restArgs.join(' ') || null;
    } else if (sub === 'config') {
      parsed.type  = restArgs[0] || null;
      parsed.salon = message.mentions.channels.first() || null;
    }

    await handlePartenariat(message, sub, {
      userId:  message.author.id,
      member:  message.member,
      guildId: message.guildId,
      guild:   message.guild,
      args:    parsed,
      slash:   false,
    });
  },
};

// ─── Réponse unifiée ───────────────────────────────────────
async function reply(source, isSlash, payload) {
  if (isSlash) {
    if (source.replied || source.deferred) return source.followUp(payload).catch(() => {});
    return source.reply(payload).catch(() => {});
  }
  const embed = payload.embeds?.[0];
  if (embed) return source.channel.send({ embeds: [embed] }).catch(() => {});
  return source.channel.send(payload.content || '❌ Erreur').catch(() => {});
}

// ─── Handler principal ─────────────────────────────────────
async function handlePartenariat(source, sub, ctx) {
  const { userId, member, guildId, guild, args, slash } = ctx;
  const g = getGuild(guildId);

  // ── LISTE ─────────────────────────────────────────────────
  if (sub === 'liste') {
    if (!g.partners.length) {
      return reply(source, slash, {
        embeds: [new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('🤝 Partenaires')
          .setDescription('Aucun serveur partenaire pour le moment.\nUtilise `/partenariat demander` pour candidater !')
          .setTimestamp()
        ],
      });
    }

    const lines = g.partners.map((p, i) =>
      `**${i + 1}.** [${p.nom}](${p.invite})\n${p.description.slice(0, 80)}${p.description.length > 80 ? '…' : ''}`
    ).join('\n\n');

    return reply(source, slash, {
      embeds: [new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🤝 Serveurs Partenaires (${g.partners.length})`)
        .setDescription(lines)
        .setFooter({ text: 'Utilisez /partenariat info <nom> pour plus de détails' })
        .setTimestamp()
      ],
    });
  }

  // ── INFO ──────────────────────────────────────────────────
  if (sub === 'info') {
    const nomRecherche = slash
      ? source.options.getString('nom')
      : args.nom;

    if (!nomRecherche) return reply(source, slash, { content: '❌ Précise le nom du serveur.', ephemeral: true });

    const partner = g.partners.find(p =>
      p.nom.toLowerCase().includes(nomRecherche.toLowerCase())
    );

    if (!partner) return reply(source, slash, { content: `❌ Aucun partenaire nommé **${nomRecherche}**.`, ephemeral: true });

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`🤝 ${partner.nom}`)
      .setDescription(partner.description)
      .addFields(
        { name: '🔗 Invitation', value: partner.invite, inline: true },
        { name: '📅 Partenaire depuis', value: `<t:${Math.floor(partner.addedAt / 1000)}:D>`, inline: true },
      )
      .setTimestamp();

    if (partner.banniere) embed.setImage(partner.banniere);

    return reply(source, slash, { embeds: [embed] });
  }

  // ── DEMANDER ──────────────────────────────────────────────
  if (sub === 'demander') {
    const invite      = slash ? source.options.getString('invite')      : args.invite;
    const nom         = slash ? source.options.getString('nom')          : args.nom;
    const description = slash ? source.options.getString('description')  : args.description;
    const banniere    = slash ? source.options.getString('banniere')     : null;

    if (!invite || !nom || !description) {
      const usage = slash
        ? '`/partenariat demander` avec tous les champs requis.'
        : '`&partenariat demander <invite> <nom> <description>`';
      return reply(source, slash, { content: `❌ Manque des informations. Usage : ${usage}`, ephemeral: true });
    }

    const existing = g.requests.find(r => r.submittedBy === userId && r.status === 'pending');
    if (existing) {
      return reply(source, slash, {
        content: `⏳ Tu as déjà une demande en attente (ID: \`${existing.id}\`). Attends qu'elle soit traitée.`,
        ephemeral: true,
      });
    }

    if (g.partners.some(p => p.nom.toLowerCase() === nom.toLowerCase())) {
      return reply(source, slash, { content: `❌ **${nom}** est déjà partenaire !`, ephemeral: true });
    }

    if (!invite.includes('discord.gg/') && !invite.includes('discord.com/invite/')) {
      return reply(source, slash, { content: '❌ Le lien d\'invitation doit être un lien Discord valide (discord.gg/...).', ephemeral: true });
    }

    const descTrunc = description.slice(0, 300);
    const id = genId();
    const request = {
      id,
      nom,
      invite,
      description: descTrunc,
      banniere: banniere || null,
      submittedBy: userId,
      submittedAt: Date.now(),
      status: 'pending',
    };

    const data = loadData();
    data[guildId].requests.push(request);
    saveData(data);

    if (g.requestChannelId) {
      const reqChannel = guild.channels.cache.get(g.requestChannelId);
      if (reqChannel) {
        const embed = new EmbedBuilder()
          .setColor('#F39C12')
          .setTitle('📩 Nouvelle demande de partenariat')
          .addFields(
            { name: 'Serveur', value: nom, inline: true },
            { name: 'Demandé par', value: `<@${userId}>`, inline: true },
            { name: 'ID', value: `\`${id}\``, inline: true },
            { name: 'Invitation', value: invite, inline: false },
            { name: 'Description', value: descTrunc, inline: false },
          )
          .setFooter({ text: `Valider: /partenariat valider ${id}  |  Refuser: /partenariat refuser ${id}` })
          .setTimestamp();

        if (banniere) embed.setThumbnail(banniere);
        await reqChannel.send({ embeds: [embed] }).catch(() => {});
      }
    }

    return reply(source, slash, {
      embeds: [new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('✅ Demande envoyée !')
        .setDescription(`Ta demande de partenariat pour **${nom}** a été soumise.\nID : \`${id}\`\n\nUn admin va la traiter prochainement.`)
        .setTimestamp()
      ],
      ephemeral: true,
    });
  }

  // ── PUB ───────────────────────────────────────────────────
  if (sub === 'pub') {
    if (!isPartner(userId, guildId)) {
      return reply(source, slash, {
        content: '❌ Seuls les serveurs partenaires peuvent envoyer une pub.\nFais une demande avec `/partenariat demander` !',
        ephemeral: true,
      });
    }

    const msgPub = slash ? source.options.getString('message') : args.message;
    if (!msgPub) return reply(source, slash, { content: '❌ Précise le message à envoyer.', ephemeral: true });

    const lastPub = g.pubCooldowns[userId] || 0;
    const diff    = Date.now() - lastPub;
    const COOLDOWN = 24 * 60 * 60 * 1000;

    if (diff < COOLDOWN) {
      const reste = Math.ceil((COOLDOWN - diff) / 3600000);
      return reply(source, slash, {
        content: `⏳ Tu peux renvoyer une pub dans **${reste}h**.`,
        ephemeral: true,
      });
    }

    const partner = g.partners.find(p => p.repUserId === userId);

    const embed = new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle(`📢 ${partner?.nom || 'Serveur partenaire'}`)
      .setDescription(msgPub)
      .addFields({ name: '🔗 Rejoindre', value: partner?.invite || '—', inline: true })
      .setFooter({ text: `Pub envoyée par ${slash ? source.user.tag : source.author.tag}` })
      .setTimestamp();

    if (partner?.banniere) embed.setThumbnail(partner.banniere);

    const pubChannel = g.pubChannelId
      ? guild.channels.cache.get(g.pubChannelId)
      : (slash ? source.channel : source.channel);

    if (!pubChannel) return reply(source, slash, { content: '❌ Salon pub introuvable. Demande à un admin de le configurer.', ephemeral: true });

    await pubChannel.send({ embeds: [embed] }).catch(() => {});

    const data = loadData();
    if (!data[guildId].pubCooldowns) data[guildId].pubCooldowns = {};
    data[guildId].pubCooldowns[userId] = Date.now();
    saveData(data);

    return reply(source, slash, { content: `✅ Pub envoyée dans <#${pubChannel.id}> !`, ephemeral: true });
  }

  // ══ COMMANDES ADMIN ════════════════════════════════════════

  if (!isAdmin(member)) {
    return reply(source, slash, {
      content: '🔒 Cette commande est réservée aux administrateurs.',
      ephemeral: true,
    });
  }

  // ── CONFIG ────────────────────────────────────────────────
  if (sub === 'config') {
    const type   = slash ? source.options.getString('type')    : args.type;
    const salon  = slash ? source.options.getChannel('salon')  : args.salon;

    if (!type || !salon) {
      return reply(source, slash, {
        content: '❌ Usage: `/partenariat config <requests|partners|pub> <#salon>`',
        ephemeral: true,
      });
    }

    const data = loadData();
    if (!data[guildId]) data[guildId] = getGuild(guildId);

    const MAP = { requests: 'requestChannelId', partners: 'partnerChannelId', pub: 'pubChannelId' };
    const key = MAP[type];
    if (!key) return reply(source, slash, { content: '❌ Type invalide. Utilise `requests`, `partners` ou `pub`.', ephemeral: true });

    data[guildId][key] = salon.id;
    saveData(data);

    const labels = { requests: '📩 Demandes', partners: '🤝 Partenaires', pub: '📢 Pub' };
    return reply(source, slash, {
      embeds: [new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('⚙️ Configuration mise à jour')
        .setDescription(`Salon **${labels[type]}** → <#${salon.id}>`)
        .setTimestamp()
      ],
      ephemeral: true,
    });
  }

  // ── DEMANDES ─────────────────────────────────────────────
  if (sub === 'demandes') {
    const pending = g.requests.filter(r => r.status === 'pending');

    if (!pending.length) {
      return reply(source, slash, {
        embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('📬 Demandes en attente')
          .setDescription('Aucune demande en attente ✅')
          .setTimestamp()
        ],
        ephemeral: true,
      });
    }

    const lines = pending.map(r =>
      `• **[${r.id}]** ${r.nom} — demandé par <@${r.submittedBy}> le <t:${Math.floor(r.submittedAt / 1000)}:d>\n  └ ${r.description.slice(0, 60)}…`
    ).join('\n');

    return reply(source, slash, {
      embeds: [new EmbedBuilder()
        .setColor('#F39C12')
        .setTitle(`📬 Demandes en attente (${pending.length})`)
        .setDescription(lines)
        .setFooter({ text: 'Valider : /partenariat valider <ID> | Refuser : /partenariat refuser <ID>' })
        .setTimestamp()
      ],
      ephemeral: true,
    });
  }

  // ── VALIDER ───────────────────────────────────────────────
  if (sub === 'valider') {
    const id = slash ? source.options.getString('id') : args.id;
    if (!id) return reply(source, slash, { content: '❌ Précise l\'ID de la demande.', ephemeral: true });

    const data    = loadData();
    const gData   = data[guildId];
    const reqIdx  = gData.requests.findIndex(r => r.id === id.toUpperCase() && r.status === 'pending');

    if (reqIdx === -1) return reply(source, slash, { content: `❌ Aucune demande en attente avec l'ID \`${id}\`.`, ephemeral: true });

    const req = gData.requests[reqIdx];
    req.status = 'accepted';

    const partner = {
      id:         genId(),
      nom:        req.nom,
      invite:     req.invite,
      description: req.description,
      banniere:   req.banniere || null,
      repUserId:  req.submittedBy,
      addedAt:    Date.now(),
      addedBy:    userId,
    };
    gData.partners.push(partner);
    saveData(data);

    try {
      const user = await guild.members.fetch(req.submittedBy);
      await user.send({
        embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('🎉 Demande de partenariat acceptée !')
          .setDescription(`Votre serveur **${req.nom}** est maintenant partenaire de **${guild.name}** !`)
          .setTimestamp()
        ],
      }).catch(() => {});
    } catch {}

    if (gData.partnerChannelId) {
      const partChannel = guild.channels.cache.get(gData.partnerChannelId);
      if (partChannel) {
        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('🤝 Nouveau partenaire !')
          .setDescription(`**[${req.nom}](${req.invite})**\n${req.description}`)
          .addFields(
            { name: '🔗 Rejoindre', value: req.invite, inline: true },
            { name: '👤 Représentant', value: `<@${req.submittedBy}>`, inline: true },
          )
          .setTimestamp();

        if (req.banniere) embed.setImage(req.banniere);
        await partChannel.send({ embeds: [embed] }).catch(() => {});
      }
    }

    return reply(source, slash, {
      embeds: [new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('✅ Partenariat accepté')
        .setDescription(`**${req.nom}** est maintenant partenaire ! (<@${req.submittedBy}> notifié)`)
        .setTimestamp()
      ],
      ephemeral: true,
    });
  }

  // ── REFUSER ───────────────────────────────────────────────
  if (sub === 'refuser') {
    const id     = slash ? source.options.getString('id')     : args.id;
    const raison = slash ? source.options.getString('raison') : args.raison;

    if (!id) return reply(source, slash, { content: '❌ Précise l\'ID de la demande.', ephemeral: true });

    const data   = loadData();
    const gData  = data[guildId];
    const reqIdx = gData.requests.findIndex(r => r.id === id.toUpperCase() && r.status === 'pending');

    if (reqIdx === -1) return reply(source, slash, { content: `❌ Aucune demande en attente avec l'ID \`${id}\`.`, ephemeral: true });

    const req = gData.requests[reqIdx];
    req.status = 'refused';
    req.refuseReason = raison || null;
    saveData(data);

    try {
      const user = await guild.members.fetch(req.submittedBy);
      await user.send({
        embeds: [new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('❌ Demande de partenariat refusée')
          .setDescription(
            `Votre demande pour **${req.nom}** sur **${guild.name}** a été refusée.` +
            (raison ? `\n\n**Raison :** ${raison}` : '')
          )
          .setTimestamp()
        ],
      }).catch(() => {});
    } catch {}

    return reply(source, slash, {
      content: `✅ Demande \`${id}\` refusée.${raison ? ` Raison : ${raison}` : ''}`,
      ephemeral: true,
    });
  }

  // ── AJOUTER ───────────────────────────────────────────────
  if (sub === 'ajouter') {
    const nom         = slash ? source.options.getString('nom')         : args.nom;
    const invite      = slash ? source.options.getString('invite')      : args.invite;
    const description = slash ? source.options.getString('description') : args.description;
    const repUser     = slash ? source.options.getUser('representant')  : null;
    const banniere    = slash ? source.options.getString('banniere')    : null;

    if (!nom || !invite || !description) {
      return reply(source, slash, {
        content: '❌ Usage: `/partenariat ajouter <nom> <invite> <description> [representant] [banniere]`',
        ephemeral: true,
      });
    }

    if (g.partners.some(p => p.nom.toLowerCase() === nom.toLowerCase())) {
      return reply(source, slash, { content: `❌ **${nom}** est déjà partenaire !`, ephemeral: true });
    }

    const data = loadData();
    data[guildId].partners.push({
      id:          genId(),
      nom,
      invite,
      description: description.slice(0, 300),
      banniere:    banniere || null,
      repUserId:   repUser?.id || null,
      addedAt:     Date.now(),
      addedBy:     userId,
    });
    saveData(data);

    if (data[guildId].partnerChannelId) {
      const partChannel = guild.channels.cache.get(data[guildId].partnerChannelId);
      if (partChannel) {
        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('🤝 Nouveau partenaire !')
          .setDescription(`**[${nom}](${invite})**\n${description.slice(0, 300)}`)
          .addFields({ name: '🔗 Rejoindre', value: invite, inline: true })
          .setTimestamp();

        if (banniere) embed.setImage(banniere);
        await partChannel.send({ embeds: [embed] }).catch(() => {});
      }
    }

    return reply(source, slash, {
      embeds: [new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('✅ Partenaire ajouté')
        .setDescription(`**${nom}** a été ajouté comme partenaire.`)
        .setTimestamp()
      ],
      ephemeral: true,
    });
  }

  // ── RETIRER ───────────────────────────────────────────────
  if (sub === 'retirer') {
    const nom = slash ? source.options.getString('nom') : args.nom;
    if (!nom) return reply(source, slash, { content: '❌ Précise le nom du partenaire.', ephemeral: true });

    const data  = loadData();
    const gData = data[guildId];
    const idx   = gData.partners.findIndex(p => p.nom.toLowerCase() === nom.toLowerCase());

    if (idx === -1) return reply(source, slash, { content: `❌ Aucun partenaire nommé **${nom}**.`, ephemeral: true });

    const removed = gData.partners.splice(idx, 1)[0];
    saveData(data);

    return reply(source, slash, {
      embeds: [new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('➖ Partenaire retiré')
        .setDescription(`**${removed.nom}** a été retiré des partenaires.`)
        .setTimestamp()
      ],
      ephemeral: true,
    });
  }

  // Sous-commande inconnue
  return reply(source, slash, { content: '❌ Sous-commande inconnue.', ephemeral: true });
}