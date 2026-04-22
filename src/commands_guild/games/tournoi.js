// tournoi.js — src/commands_guild/games/tournoi.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const eng = require('../../utils/tournamentEngine');
module.exports = {
  data: new SlashCommandBuilder().setName('tournoi').setDescription('🏆 Tournois par élimination')
    .addSubcommand(s=>s.setName('rejoindre').setDescription('✅ Rejoindre le tournoi'))
    .addSubcommand(s=>s.setName('demarrer').setDescription('▶️ Démarrer (hôte)'))
    .addSubcommand(s=>s.setName('jouer').setDescription('⚔️ Résoudre les matchs (hôte)'))
    .addSubcommand(s=>s.setName('statut').setDescription('📊 Statut du tournoi'))
    .addSubcommand(s=>s.setName('annuler').setDescription('❌ Annuler (hôte)')),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const sub=interaction.options.getSubcommand(); const {guildId}=interaction; const userId=interaction.user.id;
    const cfg=db.getConfig(guildId); const coin=cfg.currency_emoji||'€';
    if(sub==='creer'){
      if(eng.getActiveTournament(guildId)) return interaction.editReply({content:'❌ Tournoi déjà en cours.',ephemeral:true});
      const nom=interaction.options.getString('nom'); const fee=parseInt(interaction.options.getString('mise'))||0; const max=parseInt(interaction.options.getString('max'))||8;
      const tId=eng.createTournament({guildId,name:nom,entryFee:fee,maxPlayers:max,hostId:userId});
      eng.joinTournament(tId,userId,guildId);
      return interaction.editReply({embeds:[new EmbedBuilder().setColor('#F1C40F').setTitle(`🏆 Tournoi "${nom}" créé !`).setDescription('Ouvert aux inscriptions ! `/tournoi rejoindre`').addFields({name:'💰 Mise',value:fee>0?`**${fee} ${coin}**`:'Gratuit',inline:true},{name:'👥 Max',value:`**${max}**`,inline:true},{name:'👑 Hôte',value:`${interaction.user}`,inline:true}).setFooter({text:'/tournoi demarrer pour lancer'})]});
    }
    if(sub==='rejoindre'){
      const t=eng.getActiveTournament(guildId);
      if(!t) return interaction.editReply({content:'❌ Aucun tournoi ouvert.',ephemeral:true});
      if(t.status!=='open') return interaction.editReply({content:'❌ Tournoi déjà lancé.',ephemeral:true});
      const r=eng.joinTournament(t.id,userId,guildId);
      if(!r.ok) return interaction.editReply({content:`❌ ${r.reason}`,ephemeral:true});
      const nb=eng.getAllPlayers(t.id).length;
      return interaction.editReply({embeds:[new EmbedBuilder().setColor('#2ECC71').setTitle(`✅ Inscrit !`).setDescription(`**${nb}/${t.max_players}** joueurs inscrits.`)]});
    }
    if(sub==='demarrer'){
      const t=eng.getActiveTournament(guildId);
      if(!t||t.host_id!==userId) return interaction.editReply({content:'❌ Pas de tournoi / pas l\'hôte.',ephemeral:true});
      if(t.status!=='open') return interaction.editReply({content:'❌ Déjà lancé.',ephemeral:true});
      const r=eng.startTournament(t.id); if(!r.ok) return interaction.editReply({content:`❌ ${r.reason}`,ephemeral:true});
      const matches=eng.getPendingMatches(t.id);
      const list=matches.map((m,i)=>`Match ${i+1}: <@${m.player1}> ⚔️ ${m.player2==='BYE'?'🤖 BYE':`<@${m.player2}>`}`).join('\n');
      return interaction.editReply({embeds:[new EmbedBuilder().setColor('#E74C3C').setTitle(`⚔️ Tournoi "${t.name}" lancé !`).addFields({name:'🥊 Matchs Round 1',value:list||'—'},{name:'💰 Prize Pool',value:`**${t.prize_pool} ${coin}**`,inline:true}).setFooter({text:'/tournoi jouer pour résoudre'})]});
    }
    if(sub==='jouer'){
      const t=eng.getActiveTournament(guildId);
      if(!t||t.status!=='running'||t.host_id!==userId) return interaction.editReply({content:'❌ Pas de tournoi en cours / pas l\'hôte.',ephemeral:true});
      const pending=eng.getPendingMatches(t.id); if(!pending.length) return interaction.editReply({content:'❌ Aucun match en attente.',ephemeral:true});
      const results=[];
      for(const m of pending){if(m.player2==='BYE')continue;const res=eng.resolveMatch(m.id);if(res)results.push({m,...res});}
      const adv=eng.advanceRound(t.id);
      const lines=results.map(r=>`⚔️ <@${r.m.player1}> **${r.s1}**-**${r.s2}** <@${r.m.player2}> → 🏆 <@${r.winner}>`).join('\n');
      const embed=new EmbedBuilder().setColor('#9B59B6').setTitle(`🏆 Résultats`).setDescription(lines||'Avancement automatique.');
      if(adv.finished){embed.addFields({name:'🥇 GAGNANT',value:`<@${adv.winner}>`,inline:true},{name:'💰 Prix',value:`**${adv.prize} ${coin}**`,inline:true}).setColor('#FFD700');}
      else if(adv.ok){const next=eng.getPendingMatches(t.id).filter(m=>m.player2!=='BYE').map((m,i)=>`Match ${i+1}: <@${m.player1}> ⚔️ <@${m.player2}>`).join('\n');embed.addFields({name:`⚔️ Round ${adv.round}`,value:next||'—'});}
      return interaction.editReply({embeds:[embed]});
    }
    if(sub==='statut'){
      const t=eng.getActiveTournament(guildId); if(!t) return interaction.editReply({content:'❌ Aucun tournoi actif.',ephemeral:true});
      const all=eng.getAllPlayers(t.id); const act=all.filter(p=>!p.eliminated); const el=all.filter(p=>p.eliminated);
      const statusMap={open:'🟡 Ouvert',running:'🟢 En cours',ended:'🔴 Terminé'};
      const embed=new EmbedBuilder().setColor('#3498DB').setTitle(`📊 Tournoi "${t.name}"`)
        .addFields({name:'📌 Statut',value:statusMap[t.status]||t.status,inline:true},{name:'💰 Prize Pool',value:`**${t.prize_pool} ${coin}**`,inline:true},{name:'👑 Hôte',value:`<@${t.host_id}>`,inline:true},{name:`✅ En lice (${act.length})`,value:act.map(p=>`<@${p.user_id}>`).join('\n')||'—'});
      if(el.length) embed.addFields({name:`❌ Éliminés (${el.length})`,value:el.map(p=>`<@${p.user_id}>`).join('\n')});
      return interaction.editReply({embeds:[embed]});
    }
    if(sub==='annuler'){
      const t=eng.getActiveTournament(guildId);
      if(!t||t.host_id!==userId) return interaction.editReply({content:'❌ Pas de tournoi / pas l\'hôte.',ephemeral:true});
      if(t.entry_fee>0){const pl=eng.getAllPlayers(t.id);for(const p of pl)db.addCoins(p.user_id,guildId,t.entry_fee);}
      db.db.prepare('UPDATE tournaments SET status="cancelled" WHERE id=?').run(t.id);
      return interaction.editReply({embeds:[new EmbedBuilder().setColor('#E74C3C').setTitle('❌ Tournoi annulé').setDescription(`Tournoi **${t.name}** annulé.${t.entry_fee>0?` Joueurs remboursés (${t.entry_fee} ${coin}).`:''}`)]}); 
    }
  }
};
