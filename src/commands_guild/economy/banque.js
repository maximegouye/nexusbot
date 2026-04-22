// banque.js AMÉLIORÉ — src/commands_guild/economy/banque.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const { checkCooldown, cooldownMessage } = require('../../utils/cooldownManager');
try {
  const cols=db.db.prepare('PRAGMA table_info(users)').all().map(c=>c.name);
  if(!cols.includes('bank')) db.db.prepare('ALTER TABLE users ADD COLUMN bank INTEGER DEFAULT 0').run();
} catch {}
try { db.db.prepare(`CREATE TABLE IF NOT EXISTS bank_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, user_id TEXT, type TEXT, amount INTEGER, created_at INTEGER DEFAULT (strftime('%s','now')))`).run(); } catch {}
const TIERS = {
  bronze:  {name:'Bronze',  emoji:'🟤',color:'#CD7F32',minBank:0,      interest:0.02,maxMult:10},
  silver:  {name:'Argent',  emoji:'⚪',color:'#C0C0C0',minBank:5000,   interest:0.03,maxMult:15},
  gold:    {name:'Or',      emoji:'🟡',color:'#FFD700',minBank:25000,  interest:0.04,maxMult:20},
  platinum:{name:'Platine', emoji:'💠',color:'#00CED1',minBank:100000, interest:0.05,maxMult:30},
  diamond: {name:'Diamant', emoji:'💎',color:'#B9F2FF',minBank:500000, interest:0.07,maxMult:50},
};
function getTier(b){return Object.values(TIERS).sort((a,c)=>c.minBank-a.minBank).find(t=>b>=t.minBank)||TIERS.bronze;}
function fmt(n){return n.toLocaleString('fr-FR');}
module.exports = {
  data: new SlashCommandBuilder().setName('banque').setDescription('🏦 Banque VIP avec intérêts composés')
    .addSubcommand(s=>s.setName('solde').setDescription('💰 Voir votre solde et tier VIP'))
    .addSubcommand(s=>s.setName('interets').setDescription('📈 Réclamer intérêts quotidiens'))
    .addSubcommand(s=>s.setName('historique').setDescription('📋 10 dernières transactions'))
    .addSubcommand(s=>s.setName('tiers').setDescription('🏆 Voir les tiers VIP')),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const sub=interaction.options.getSubcommand(); const {guildId}=interaction; const userId=interaction.user.id;
    const cfg=db.getConfig(guildId); const coin=cfg.currency_emoji||'€';
    const u=db.getUser(userId,guildId); const bank=u.bank||0; const tier=getTier(bank);
    if(sub==='solde'){
      const cap=u.balance*tier.maxMult;
      const nextTier=Object.values(TIERS).sort((a,b)=>a.minBank-b.minBank).find(t=>t.minBank>bank);
      const embed=new EmbedBuilder().setColor(tier.color).setTitle(`${tier.emoji} Banque — Tier ${tier.name}`).setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
          {name:'💼 Portefeuille',value:`**${fmt(u.balance)} ${coin}**`,inline:true},
          {name:'🏦 Banque',value:`**${fmt(bank)} ${coin}**`,inline:true},
          {name:'💎 Total',value:`**${fmt(u.balance+bank)} ${coin}**`,inline:true},
          {name:'📈 Taux/jour',value:`**${tier.interest*100}%**`,inline:true},
          {name:'📊 Plafond',value:`**${fmt(cap)} ${coin}**`,inline:true},
          {name:`${tier.emoji} Tier`,value:`**${tier.name}**`,inline:true}
        ).setFooter({text:'/banque interets — disponible 1x/jour'});
      if(nextTier) embed.addFields({name:`⬆️ Prochain: ${nextTier.emoji} ${nextTier.name}`,value:`Encore **${fmt(nextTier.minBank-bank)} ${coin}** en banque (taux → **${nextTier.interest*100}%**)`});
      return interaction.editReply({embeds:[embed],ephemeral:true});
    }
    if(sub==='deposer'){
      const m=parseInt(interaction.options.getString('montant'));
      if(m>u.balance) return interaction.editReply({content:`❌ Solde insuffisant (**${fmt(u.balance)} ${coin}**).`,ephemeral:true});
      const cap=u.balance*tier.maxMult; if(bank>=cap) return interaction.editReply({content:`❌ Banque pleine (plafond ${fmt(cap)} ${coin}).`,ephemeral:true});
      const allowed=Math.min(m,cap-bank);
      db.addCoins(userId,guildId,-allowed);
      db.db.prepare('UPDATE users SET bank=COALESCE(bank,0)+? WHERE user_id=? AND guild_id=?').run(allowed,userId,guildId);
      db.db.prepare('INSERT INTO bank_transactions(guild_id,user_id,type,amount) VALUES(?,?,?,?)').run(guildId,userId,'depot',allowed);
      return interaction.editReply({embeds:[new EmbedBuilder().setColor('#2ECC71').setTitle('📥 Dépôt effectué').addFields({name:'💰 Déposé',value:`**+${fmt(allowed)} ${coin}**`,inline:true},{name:'🏦 Banque',value:`**${fmt(bank+allowed)} ${coin}**`,inline:true})]});
    }
    if(sub==='retirer'){
      const m=parseInt(interaction.options.getString('montant'));
      if(m>bank) return interaction.editReply({content:`❌ Seulement **${fmt(bank)} ${coin}** en banque.`,ephemeral:true});
      db.addCoins(userId,guildId,m);
      db.db.prepare('UPDATE users SET bank=bank-? WHERE user_id=? AND guild_id=?').run(m,userId,guildId);
      db.db.prepare('INSERT INTO bank_transactions(guild_id,user_id,type,amount) VALUES(?,?,?,?)').run(guildId,userId,'retrait',m);
      return interaction.editReply({embeds:[new EmbedBuilder().setColor('#E74C3C').setTitle('📤 Retrait effectué').addFields({name:'💰 Retiré',value:`**-${fmt(m)} ${coin}**`,inline:true},{name:'🏦 Banque',value:`**${fmt(bank-m)} ${coin}**`,inline:true})]});
    }
    if(sub==='interets'){
      const cd=checkCooldown(userId,'banque_interets',22*3600);
      if(cd.onCooldown) return interaction.editReply({content:cooldownMessage(cd.remaining),ephemeral:true});
      if(bank===0) return interaction.editReply({content:'❌ Aucun argent en banque.',ephemeral:true});
      const interet=Math.floor(bank*tier.interest);
      db.db.prepare('UPDATE users SET bank=bank+? WHERE user_id=? AND guild_id=?').run(interet,userId,guildId);
      db.db.prepare('INSERT INTO bank_transactions(guild_id,user_id,type,amount) VALUES(?,?,?,?)').run(guildId,userId,'interets',interet);
      return interaction.editReply({embeds:[new EmbedBuilder().setColor(tier.color).setTitle(`${tier.emoji} Intérêts réclamés !`).setDescription(`Tier **${tier.name}** → **${tier.interest*100}%/jour**`).addFields({name:'💰 Gagnés',value:`**+${fmt(interet)} ${coin}**`,inline:true},{name:'🏦 Nouveau solde',value:`**${fmt(bank+interet)} ${coin}**`,inline:true}).setFooter({text:'Prochain intérêt dans ~22h'})]});
    }
    if(sub==='historique'){
      const txs=db.db.prepare('SELECT * FROM bank_transactions WHERE user_id=? AND guild_id=? ORDER BY created_at DESC LIMIT 10').all(userId,guildId);
      if(!txs.length) return interaction.editReply({content:'📋 Aucune transaction.',ephemeral:true});
      const em={'depot':'📥','retrait':'📤','interets':'📈','virement_in':'💸','virement_out':'💸'};
      const lines=txs.map(t=>{const d=new Date(t.created_at*1000).toLocaleDateString('fr-FR');const s=['retrait','virement_out'].includes(t.type)?'-':'+';return `${em[t.type]||'💰'} \`${d}\` **${s}${fmt(t.amount)} ${coin}** — ${t.type}`;}).join('\n');
      return interaction.editReply({embeds:[new EmbedBuilder().setColor('#3498DB').setTitle('📋 10 dernières transactions').setDescription(lines)],ephemeral:true});
    }
    if(sub==='virer'){
      const target=interaction.options.getUser('membre'); const m=parseInt(interaction.options.getString('montant'));
      if(target.id===userId) return interaction.editReply({content:'❌ Impossible de vous virer à vous-même.',ephemeral:true});
      if(m>bank) return interaction.editReply({content:'❌ Solde bancaire insuffisant.',ephemeral:true});
      db.db.prepare('UPDATE users SET bank=bank-? WHERE user_id=? AND guild_id=?').run(m,userId,guildId);
      db.db.prepare('UPDATE users SET bank=COALESCE(bank,0)+? WHERE user_id=? AND guild_id=?').run(m,target.id,guildId);
      db.db.prepare('INSERT INTO bank_transactions(guild_id,user_id,type,amount) VALUES(?,?,?,?)').run(guildId,userId,'virement_out',m);
      db.db.prepare('INSERT INTO bank_transactions(guild_id,user_id,type,amount) VALUES(?,?,?,?)').run(guildId,target.id,'virement_in',m);
      return interaction.editReply({embeds:[new EmbedBuilder().setColor('#2ECC71').setTitle('💸 Virement effectué').setDescription(`**${fmt(m)} ${coin}** viré à ${target}.`)]});
    }
    if(sub==='tiers'){
      const fields=Object.values(TIERS).sort((a,b)=>a.minBank-b.minBank).map(t=>({name:`${t.emoji} ${t.name}`,value:`Min: **${fmt(t.minBank)} ${coin}**\nTaux: **${t.interest*100}%/j**\nPlafond: **x${t.maxMult}**`,inline:true}));
      return interaction.editReply({embeds:[new EmbedBuilder().setColor('#FFD700').setTitle('🏆 Tiers VIP Bancaires').setDescription(`Votre tier: ${tier.emoji} **${tier.name}** — intérêts **${tier.interest*100}%/jour**`).addFields(fields).setFooter({text:'Plus vous déposez, plus vous gagnez !'})],ephemeral:true});
    }
  }
};
