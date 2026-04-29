// tournamentEngine.js — src/utils/tournamentEngine.js
const db = require('../database/db');
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, name TEXT, type TEXT DEFAULT 'coins',
    entry_fee INTEGER DEFAULT 0, prize_pool INTEGER DEFAULT 0, max_players INTEGER DEFAULT 8,
    status TEXT DEFAULT 'open', host_id TEXT, winner_id TEXT,
    created_at TEXT DEFAULT (strftime('%s','now')), started_at TEXT, ended_at TEXT)`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS tournament_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT, tournament_id INTEGER, user_id TEXT, guild_id TEXT,
    eliminated INTEGER DEFAULT 0, placement INTEGER, UNIQUE(tournament_id, user_id))`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS tournament_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT, tournament_id INTEGER, round INTEGER,
    player1 TEXT, player2 TEXT, winner TEXT, score_p1 INTEGER DEFAULT 0, score_p2 INTEGER DEFAULT 0,
    played INTEGER DEFAULT 0, played_at TEXT)`).run();
} catch {}
function getTournament(id) { return db.db.prepare('SELECT * FROM tournaments WHERE id=?').get(id); }
function getActiveTournament(guildId) { return db.db.prepare('SELECT * FROM tournaments WHERE guild_id=? AND status IN ("open","running") ORDER BY id DESC LIMIT 1').get(guildId); }
function getPlayers(tId) { return db.db.prepare('SELECT * FROM tournament_players WHERE tournament_id=? AND eliminated=0').all(tId); }
function getAllPlayers(tId) { return db.db.prepare('SELECT * FROM tournament_players WHERE tournament_id=?').all(tId); }
function getPendingMatches(tId) { return db.db.prepare('SELECT * FROM tournament_matches WHERE tournament_id=? AND played=0').all(tId); }
function getCurrentRound(tId) { const r = db.db.prepare('SELECT MAX(round) as r FROM tournament_matches WHERE tournament_id=?').get(tId); return r ? r.r : 1; }
function createTournament({guildId, name, type, entryFee, maxPlayers, hostId}) {
  const r = db.db.prepare('INSERT INTO tournaments (guild_id,name,type,entry_fee,max_players,host_id) VALUES (?,?,?,?,?,?)').run(guildId, name, type||'coins', entryFee||0, maxPlayers||8, hostId);
  return r.lastInsertRowid;
}
function joinTournament(tId, userId, guildId) {
  const t = getTournament(tId);
  if (!t || t.status!=='open') return {ok:false, reason:'Tournoi non disponible.'};
  const players = getAllPlayers(tId);
  if (players.length >= t.max_players) return {ok:false, reason:'Tournoi complet.'};
  if (players.find(p => p.user_id===userId)) return {ok:false, reason:'Déjà inscrit.'};
  if (t.entry_fee > 0) { const u = db.getUser(userId, guildId); if (!u || u.balance < t.entry_fee) return {ok:false, reason:`Solde insuffisant.`}; db.addCoins(userId, guildId, -t.entry_fee); db.db.prepare('UPDATE tournaments SET prize_pool=prize_pool+? WHERE id=?').run(t.entry_fee, tId); }
  db.db.prepare('INSERT INTO tournament_players (tournament_id,user_id,guild_id) VALUES (?,?,?)').run(tId, userId, guildId);
  return {ok:true};
}
function startTournament(tId) {
  const players = getPlayers(tId);
  if (players.length < 2) return {ok:false, reason:'Pas assez de joueurs.'};
  const shuffled = players.sort(() => Math.random()-0.5);
  for (let i=0; i<shuffled.length; i+=2) {
    const p1=shuffled[i], p2=shuffled[i+1]||null;
    db.db.prepare('INSERT INTO tournament_matches (tournament_id,round,player1,player2) VALUES (?,1,?,?)').run(tId, p1.user_id, p2?p2.user_id:'BYE');
    if (!p2) db.db.prepare('UPDATE tournament_matches SET winner=?,played=1 WHERE tournament_id=? AND round=1 AND player1=?').run(p1.user_id, tId, p1.user_id);
  }
  db.db.prepare("UPDATE tournaments SET status='running',started_at=strftime('%s','now') WHERE id=?").run(tId);
  return {ok:true, matches:getPendingMatches(tId)};
}
function resolveMatch(matchId) {
  const m = db.db.prepare('SELECT * FROM tournament_matches WHERE id=?').get(matchId);
  if (!m || m.played) return null;
  let winner, s1, s2;
  if (m.player2==='BYE') { winner=m.player1; s1=1; s2=0; }
  else {
    const u1=db.getUser(m.player1, null), u2=db.getUser(m.player2, null);
    const xp1=(u1&&u1.xp)?u1.xp:1, xp2=(u2&&u2.xp)?u2.xp:1;
    if (Math.random() < xp1/(xp1+xp2)) { winner=m.player1; s1=Math.floor(Math.random()*5)+3; s2=Math.floor(Math.random()*s1); }
    else { winner=m.player2; s2=Math.floor(Math.random()*5)+3; s1=Math.floor(Math.random()*s2); }
  }
  const loser = m.player1===winner ? m.player2 : m.player1;
  db.db.prepare('UPDATE tournament_matches SET winner=?,score_p1=?,score_p2=?,played=1,played_at=strftime("%s","now") WHERE id=?').run(winner,s1,s2,matchId);
  if (loser!=='BYE') db.db.prepare('UPDATE tournament_players SET eliminated=1 WHERE tournament_id=? AND user_id=?').run(m.tournament_id, loser);
  return {winner, loser, s1, s2};
}
function advanceRound(tId) {
  if (getPendingMatches(tId).length > 0) return {ok:false};
  const active = getPlayers(tId);
  if (active.length===1) {
    const t=getTournament(tId), prize=Math.floor(t.prize_pool*0.9);
    db.db.prepare("UPDATE tournaments SET status='ended', winner_id=?, ended_at=strftime('%s','now') WHERE id=?").run(active[0].user_id, tId);
    if (prize>0) db.addCoins(active[0].user_id, t.guild_id, prize);
    return {ok:true, finished:true, winner:active[0].user_id, prize};
  }
  const nr=getCurrentRound(tId)+1, sh=active.sort(()=>Math.random()-0.5);
  for (let i=0;i<sh.length;i+=2) {
    const p1=sh[i], p2=sh[i+1]||null;
    db.db.prepare('INSERT INTO tournament_matches (tournament_id,round,player1,player2) VALUES (?,?,?,?)').run(tId,nr,p1.user_id,p2?p2.user_id:'BYE');
    if (!p2) db.db.prepare('UPDATE tournament_matches SET winner=?,played=1 WHERE tournament_id=? AND round=? AND player1=?').run(p1.user_id,tId,nr,p1.user_id);
  }
  return {ok:true, finished:false, round:nr, matches:getPendingMatches(tId)};
}
module.exports = {createTournament,joinTournament,startTournament,resolveMatch,advanceRound,getTournament,getActiveTournament,getPlayers,getAllPlayers,getPendingMatches,getCurrentRound};
