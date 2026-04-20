// ============================================================
// partenariat.js — Système de partenariats complet
// Emplacement : src/commands_guild/unique/partenariat.js
// ============================================================

const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const fs   = require('fs');
const path = require('path');

const DATA_DIR  = path.join(__dirname, '../../../data');
const DATA_FILE = path.join(DATA_DIR, 'partenariats.json');

function loadData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '{}', 'utf8');
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return {}; }
}
function saveData(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8'); }
function getGuild(guildId) {
  const data = loadData();
  if (!data[guildId]) { data[guildId] = { requestChannelId: null, partnerChannelId: null, pubChannelId: null, partners: [], requests: [], pubCooldowns: {} }; saveData(data); }
  return data[guildId];
}
function updateGuild(guildId, update) {
  const data = loadData();
  if (!data[guildId]) data[guildId] = getGuild(guildId);
  Object.assign(data[guildId], update); saveData(data);
}
function genId() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }
function isAdmin(member) { return member.permissions.has(PermissionFlagsBits.Administrator); }
function isPartner(userId, guildId) { const g = getGuild(guildId); return g.partners.some(p => p.repUserId === userId); }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('partenariat')
    .setDescription('🤝 Système de partenariats du serveur')
    .addSubcommand(s => s.setName('demander').setDescription('📩 Soumettre une demande')
      .addStringOption(o => o.setName('invite').setDescription('Lien discord.gg/...').setRequired(true))
      .addStringOption(o => o.setName('nom').setDescription('Nom du serveur').setRequired(true))
      .addStringOption(o => o.setName('description').setDescription('Description (max 300 chars)').setRequired(true))
      .addStringOption(o => o.setName('banniere').setDescription('URL bannière (optionnel)').setRequired(false)))
    .addSubcommand(s => s.setName('liste').setDescription('📋 Voir tous les partenaires'))
    .addSubcommand(s => s.setName('info').setDescription('🔍 Infos sur un partenaire')
      .addStringOption(o => o.setName('nom').setDescription('Nom du serveur').setRequired(true)))
    .addSubcommand(s => s.setName('pub').setDescription('📢 Envoyer votre promo (partenaires only)')
      .addStringOption(o => o.setName('message').setDescription('Message promotionnel').setRequired(true)))
    .addSubcommand(s => s.setName('config').setDescription('⚙️ [ADMIN] Configurer les salons')
      .addStringOption(o => o.setName('type').setDescription('Type de salon').setRequired(true)
        .addChoices({name:'📩 Demandes',value:'requests'},{name:'🤝 Partenaires',value:'partners'},{name:'📢 Pub',value:'pub'}))
      .addChannelOption(o => o.setName('salon').setDescription('Salon').setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(s => s.setName('valider').setDescription('✅ [ADMIN] Accepter une demande')
      .addStringOption(o => o.setName('id').setDescription('ID demande').setRequired(true)))
    .addSubcommand(s => s.setName('refuser').setDescription('❌ [ADMIN] Refuser une demande')
      .addStringOption(o => o.setName('id').setDescription('ID demande').setRequired(true))
      .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false)))
    .addSubcommand(s => s.setName('ajouter').setDescription('➕ [ADMIN] Ajouter directement')
      .addStringOption(o => o.setName('nom').setDescription('Nom').setRequired(true))
      .addStringOption(o => o.setName('invite').setDescription('Invite').setRequired(true))
      .addStringOption(o => o.setName('description').setDescription('Description').setRequired(true))
      .addUserOption(o => o.setName('representant').setDescription('Rep').setRequired(false))
      .addStringOption(o => o.setName('banniere').setDescription('Banniere').setRequired(false)))
    .addSubcommand(s => s.setName('retirer').setDescription('➖ [ADMIN] Retirer un partenaire')
      .addStringOption(o => o.setName('nom').setDescription('Nom').setRequired(true)))
    .addSubcommand(s => s.setName('demandes').setDescription('📬 [ADMIN] Voir demandes en attente')),

  async execute(interaction) {
    await handlePartenariat(interaction, interaction.options.getSubcommand(), { userId: interaction.user.id, member: interaction.member, guildId: interaction.guildId, guild: interaction.guild, args: {}, slash: true });
  },

  name: 'partenariat',
  aliases: ['partner', 'partners', 'part'],
  async run(message, args) {
    const sub = (args[0] || 'liste').toLowerCase();
    const r = args.slice(1);
    const parsed = {};
    if (sub === 'demander') { parsed.invite = r[0]||null; parsed.nom = r[1]||null; parsed.description = r.slice(2).join(' ')||null; }
    else if (sub === 'info') { parsed.nom = r.join(' ')||null; }
    else if (sub === 'pub') { parsed.message = r.join(' ')||null; }
    else if (sub === 'valider') { parsed.id = r[0]||null; }
    else if (sub === 'refuser') { parsed.id = r[0]||null; parsed.raison = r.slice(1).join(' ')||null; }
    else if (sub === 'ajouter') { parsed.invite = r[0]||null; parsed.nom = r[1]||null; parsed.description = r.slice(2).join(' ')||null; }
    else if (sub === 'retirer') { parsed.nom = r.join(' ')||null; }
    else if (sub === 'config') { parsed.type = r[0]||null; parsed.salon = message.mentions.channels.first()||null; }
    await handlePartenariat(message, sub, { userId: message.author.id, member: message.member, guildId: message.guildId, guild: message.guild, args: parsed, slash: false });
  },
};

async function reply(source, isSlash, payload) {
  if (isSlash) { if (source.replied || source.deferred) return source.followUp(payload).catch(()=>{}); return source.reply(payload).catch(()=>{}); }
  const embed = payload.embeds?.[0];
  if (embed) return source.channel.send({ embeds: [embed] }).catch(()=>{});
  return source.channel.send(payload.content || '❌ Erreur').catch(()=>{});
}

async function handlePartenariat(source, sub, ctx) {
  const { userId, member, guildId, guild, args, slash } = ctx;
  const g = getGuild(guildId);

  if (sub === 'liste') {
    if (!g.partners.length) return reply(source, slash, { embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('🤝 Partenaires').setDescription('Aucun partenaire pour le moment.\nUtilise `/partenariat demander` pour candidater !').setTimestamp()] });
    const lines = g.partners.map((p,i) => `**${i+1}.** [${p.nom}](${p.invite})\n${p.description.slice(0,80)}${p.description.length>80?'…':''}`).join('\n\n');
    return reply(source, slash, { embeds: [new EmbedBuilder().setColor('#5865F2').setTitle(`🤝 Serveurs Partenaires (${g.partners.length})`).setDescription(lines).setFooter({text:'Utilisez /partenariat info <nom> pour plus de détails'}).setTimestamp()] });
  }

  if (sub === 'info') {
    const nom = slash ? source.options.getString('nom') : args.nom;
    if (!nom) return reply(source, slash, { content: '❌ Précise le nom.', ephemeral: true });
    const p = g.partners.find(p => p.nom.toLowerCase().includes(nom.toLowerCase()));
    if (!p) return reply(source, slash, { content: `❌ Aucun partenaire nommé **${nom}**.`, ephemeral: true });
    const embed = new EmbedBuilder().setColor('#5865F2').setTitle(`🤝 ${p.nom}`).setDescription(p.description).addFields({name:'🔗 Invitation',value:p.invite,inline:true},{name:'📅 Depuis',value:`<t:${Math.floor(p.addedAt/1000)}:D>`,inline:true}).setTimestamp();
    if (p.banniere) embed.setImage(p.banniere);
    return reply(source, slash, { embeds: [embed] });
  }

  if (sub === 'demander') {
    const invite = slash ? source.options.getString('invite') : args.invite;
    const nom = slash ? source.options.getString('nom') : args.nom;
    const description = slash ? source.options.getString('description') : args.description;
    const banniere = slash ? source.options.getString('banniere') : null;
    if (!invite||!nom||!description) return reply(source, slash, { content: `❌ Usage: ${slash?'`/partenariat demander` avec tous les champs':'`&partenariat demander <invite> <nom> <description>`'}`, ephemeral: true });
    if (g.requests.find(r => r.submittedBy===userId && r.status==='pending')) return reply(source, slash, { content: '⏳ Tu as déjà une demande en attente.', ephemeral: true });
    if (g.partners.some(p => p.nom.toLowerCase()===nom.toLowerCase())) return reply(source, slash, { content: `❌ **${nom}** est déjà partenaire !`, ephemeral: true });
    if (!invite.includes('discord.gg/')&&!invite.includes('discord.com/invite/')) return reply(source, slash, { content: '❌ Lien Discord invalide.', ephemeral: true });
    const desc = description.slice(0,300);
    const id = genId();
    const data = loadData();
    data[guildId].requests.push({ id, nom, invite, description: desc, banniere: banniere||null, submittedBy: userId, submittedAt: Date.now(), status: 'pending' });
    saveData(data);
    if (g.requestChannelId) {
      const ch = guild.channels.cache.get(g.requestChannelId);
      if (ch) { const e = new EmbedBuilder().setColor('#F39C12').setTitle('📩 Nouvelle demande').addFields({name:'Serveur',value:nom,inline:true},{name:'Par',value:`<@${userId}>`,inline:true},{name:'ID',value:`\`${id}\``,inline:true},{name:'Invite',value:invite},{name:'Description',value:desc}).setFooter({text:`/partenariat valider ${id}  |  /partenariat refuser ${id}`}).setTimestamp(); if(banniere)e.setThumbnail(banniere); await ch.send({embeds:[e]}).catch(()=>{}); }
    }
    return reply(source, slash, { embeds: [new EmbedBuilder().setColor('#2ECC71').setTitle('✅ Demande envoyée !').setDescription(`Demande pour **${nom}** soumise. ID : \`${id}\`\nUn admin va la traiter prochainement.`).setTimestamp()], ephemeral: true });
  }

  if (sub === 'pub') {
    if (!isPartner(userId, guildId)) return reply(source, slash, { content: '❌ Réservé aux partenaires. Fais une demande avec `/partenariat demander` !', ephemeral: true });
    const msg = slash ? source.options.getString('message') : args.message;
    if (!msg) return reply(source, slash, { content: '❌ Précise le message.', ephemeral: true });
    const lastPub = g.pubCooldowns[userId]||0;
    if (Date.now()-lastPub < 86400000) { const h=Math.ceil((86400000-(Date.now()-lastPub))/3600000); return reply(source, slash, { content: `⏳ Cooldown : encore **${h}h**.`, ephemeral: true }); }
    const partner = g.partners.find(p => p.repUserId===userId);
    const embed = new EmbedBuilder().setColor('#9B59B6').setTitle(`📢 ${partner?.nom||'Partenaire'}`).setDescription(msg).addFields({name:'🔗 Rejoindre',value:partner?.invite||'—',inline:true}).setFooter({text:`Pub par ${slash?source.user.tag:source.author.tag}`}).setTimestamp();
    if (partner?.banniere) embed.setThumbnail(partner.banniere);
    const ch = g.pubChannelId ? guild.channels.cache.get(g.pubChannelId) : (slash?source.channel:source.channel);
    if (!ch) return reply(source, slash, { content: '❌ Salon pub non configuré.', ephemeral: true });
    await ch.send({embeds:[embed]}).catch(()=>{});
    const data = loadData(); if(!data[guildId].pubCooldowns)data[guildId].pubCooldowns={}; data[guildId].pubCooldowns[userId]=Date.now(); saveData(data);
    return reply(source, slash, { content: `✅ Pub envoyée dans <#${ch.id}> !`, ephemeral: true });
  }

  if (!isAdmin(member)) return reply(source, slash, { content: '🔒 Réservé aux administrateurs.', ephemeral: true });

  if (sub === 'config') {
    const type = slash ? source.options.getString('type') : args.type;
    const salon = slash ? source.options.getChannel('salon') : args.salon;
    if (!type||!salon) return reply(source, slash, { content: '❌ Usage: `/partenariat config <requests|partners|pub> <#salon>`', ephemeral: true });
    const MAP = { requests:'requestChannelId', partners:'partnerChannelId', pub:'pubChannelId' };
    const key = MAP[type]; if (!key) return reply(source, slash, { content: '❌ Type invalide.', ephemeral: true });
    const data = loadData(); if(!data[guildId])data[guildId]=getGuild(guildId); data[guildId][key]=salon.id; saveData(data);
    const labels = { requests:'📩 Demandes', partners:'🤝 Partenaires', pub:'📢 Pub' };
    return reply(source, slash, { embeds: [new EmbedBuilder().setColor('#2ECC71').setTitle('⚙️ Config mise à jour').setDescription(`Salon **${labels[type]}** → <#${salon.id}>`).setTimestamp()], ephemeral: true });
  }

  if (sub === 'demandes') {
    const pending = g.requests.filter(r => r.status==='pending');
    if (!pending.length) return reply(source, slash, { embeds: [new EmbedBuilder().setColor('#2ECC71').setTitle('📬 Demandes en attente').setDescription('Aucune demande ✅').setTimestamp()], ephemeral: true });
    const lines = pending.map(r => `• **[${r.id}]** ${r.nom} — <@${r.submittedBy}> le <t:${Math.floor(r.submittedAt/1000)}:d>\n  └ ${r.description.slice(0,60)}…`).join('\n');
    return reply(source, slash, { embeds: [new EmbedBuilder().setColor('#F39C12').setTitle(`📬 Demandes (${pending.length})`).setDescription(lines).setFooter({text:'/partenariat valider <ID> | /partenariat refuser <ID>'}).setTimestamp()], ephemeral: true });
  }

  if (sub === 'valider') {
    const id = slash ? source.options.getString('id') : args.id;
    if (!id) return reply(source, slash, { content: '❌ Précise l\'ID.', ephemeral: true });
    const data = loadData(); const gData = data[guildId];
    const idx = gData.requests.findIndex(r => r.id===id.toUpperCase()&&r.status==='pending');
    if (idx===-1) return reply(source, slash, { content: `❌ Aucune demande \`${id}\`.`, ephemeral: true });
    const req = gData.requests[idx]; req.status = 'accepted';
    gData.partners.push({ id:genId(), nom:req.nom, invite:req.invite, description:req.description, banniere:req.banniere||null, repUserId:req.submittedBy, addedAt:Date.now(), addedBy:userId });
    saveData(data);
    try { const u = await guild.members.fetch(req.submittedBy); await u.send({embeds:[new EmbedBuilder().setColor('#2ECC71').setTitle('🎉 Partenariat accepté !').setDescription(`**${req.nom}** est maintenant partenaire de **${guild.name}** !`).setTimestamp()]}).catch(()=>{}); } catch {}
    if (gData.partnerChannelId) { const ch = guild.channels.cache.get(gData.partnerChannelId); if(ch){const e=new EmbedBuilder().setColor('#5865F2').setTitle('🤝 Nouveau partenaire !').setDescription(`**[${req.nom}](${req.invite})**\n${req.description}`).addFields({name:'🔗 Rejoindre',value:req.invite,inline:true},{name:'👤 Rep',value:`<@${req.submittedBy}>`,inline:true}).setTimestamp();if(req.banniere)e.setImage(req.banniere);await ch.send({embeds:[e]}).catch(()=>{});} }
    return reply(source, slash, { embeds: [new EmbedBuilder().setColor('#2ECC71').setTitle('✅ Partenariat accepté').setDescription(`**${req.nom}** ajouté ! (<@${req.submittedBy}> notifié)`).setTimestamp()], ephemeral: true });
  }

  if (sub === 'refuser') {
    const id = slash ? source.options.getString('id') : args.id;
    const raison = slash ? source.options.getString('raison') : args.raison;
    if (!id) return reply(source, slash, { content: '❌ Précise l\'ID.', ephemeral: true });
    const data = loadData(); const gData = data[guildId];
    const idx = gData.requests.findIndex(r => r.id===id.toUpperCase()&&r.status==='pending');
    if (idx===-1) return reply(source, slash, { content: `❌ Aucune demande \`${id}\`.`, ephemeral: true });
    const req = gData.requests[idx]; req.status='refused'; req.refuseReason=raison||null; saveData(data);
    try { const u = await guild.members.fetch(req.submittedBy); await u.send({embeds:[new EmbedBuilder().setColor('#E74C3C').setTitle('❌ Demande refusée').setDescription(`Votre demande pour **${req.nom}** a été refusée.${raison?`\n\n**Raison :** ${raison}`:''}`).setTimestamp()]}).catch(()=>{}); } catch {}
    return reply(source, slash, { content: `✅ Demande \`${id}\` refusée.${raison?` Raison : ${raison}`:''}`, ephemeral: true });
  }

  if (sub === 'ajouter') {
    const nom = slash?source.options.getString('nom'):args.nom;
    const invite = slash?source.options.getString('invite'):args.invite;
    const description = slash?source.options.getString('description'):args.description;
    const repUser = slash?source.options.getUser('representant'):null;
    const banniere = slash?source.options.getString('banniere'):null;
    if (!nom||!invite||!description) return reply(source, slash, { content: '❌ Manque des infos.', ephemeral: true });
    if (g.partners.some(p=>p.nom.toLowerCase()===nom.toLowerCase())) return reply(source, slash, { content: `❌ **${nom}** existe déjà.`, ephemeral: true });
    const data = loadData(); data[guildId].partners.push({id:genId(),nom,invite,description:description.slice(0,300),banniere:banniere||null,repUserId:repUser?.id||null,addedAt:Date.now(),addedBy:userId}); saveData(data);
    if (data[guildId].partnerChannelId) { const ch=guild.channels.cache.get(data[guildId].partnerChannelId); if(ch){const e=new EmbedBuilder().setColor('#5865F2').setTitle('🤝 Nouveau partenaire !').setDescription(`**[${nom}](${invite})**\n${description.slice(0,300)}`).addFields({name:'🔗 Rejoindre',value:invite,inline:true}).setTimestamp();if(banniere)e.setImage(banniere);await ch.send({embeds:[e]}).catch(()=>{});} }
    return reply(source, slash, { embeds: [new EmbedBuilder().setColor('#2ECC71').setTitle('✅ Partenaire ajouté').setDescription(`**${nom}** ajouté avec succès.`).setTimestamp()], ephemeral: true });
  }

  if (sub === 'retirer') {
    const nom = slash?source.options.getString('nom'):args.nom;
    if (!nom) return reply(source, slash, { content: '❌ Précise le nom.', ephemeral: true });
    const data=loadData(); const gData=data[guildId];
    const idx=gData.partners.findIndex(p=>p.nom.toLowerCase()===nom.toLowerCase());
    if (idx===-1) return reply(source, slash, { content: `❌ Aucun partenaire **${nom}**.`, ephemeral: true });
    const removed=gData.partners.splice(idx,1)[0]; saveData(data);
    return reply(source, slash, { embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('➖ Partenaire retiré').setDescription(`**${removed.nom}** retiré.`).setTimestamp()], ephemeral: true });
  }

  return reply(source, slash, { content: '❌ Sous-commande inconnue.', ephemeral: true });
}