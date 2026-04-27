'use strict';
// ============================================================
// ready.js — Initialisation du bot
// ============================================================
const { REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, ActivityType } = require('discord.js');

// ── Statuts rotatifs du bot ────────────────────────────────
const ACTIVITIES = [
  { name: '🎰 /casino — 15+ jeux exclusifs',        type: ActivityType.Playing   },
  { name: '🏇 /hippodrome — Course de chevaux',     type: ActivityType.Competing },
  { name: '💰 /daily — Récompense quotidienne',     type: ActivityType.Watching  },
  { name: '🎯 /aide — Toutes les commandes',        type: ActivityType.Listening },
  { name: '⚔️ /duel — Défie tes amis',             type: ActivityType.Playing   },
  { name: '🏆 /classement — Top joueurs',           type: ActivityType.Watching  },
  { name: '🎁 /giveaway — Crée un giveaway',        type: ActivityType.Playing   },
  { name: '🎫 /ticket — Support & aide',            type: ActivityType.Watching  },
  { name: '📈 /bourse — Trading virtuel',           type: ActivityType.Playing   },
  { name: '🌀 /crash — Multiplie tes gains',        type: ActivityType.Competing },
  { name: '🤖 NexusBot — Le bot tout-en-un',        type: ActivityType.Competing },
  { name: '🛡️ /ban /kick /clear — Staff tools',    type: ActivityType.Watching  },
];

let activityIndex = 0;

function rotateActivity(client) {
  const act = ACTIVITIES[activityIndex % ACTIVITIES.length];
  client.user.setPresence({
    status: 'online',
    activities: [{ name: act.name, type: act.type }],
  });
  activityIndex++;
}
const { checkBumpReminders } = require('../utils/bumpReminderCheck');
const {
  autoInit:             casinoMusicAutoInit,
  startBackgroundRetry: casinoMusicBackgroundRetry,
  onShardResume:        casinoMusicOnShardResume,
} = require('../utils/casinoMusicManager');

// ── Postes recrutement (miroir de recrutement.js) ──────────
const POSTES = {
  moderateur:  { label: 'Modérateur',          emoji: '🛡️', desc: 'Assure le respect des règles et la bonne ambiance du serveur.' },
  technicien:  { label: 'Technicien Bots',     emoji: '⚙️', desc: 'Développe, configure et maintient les bots du serveur.' },
  animateur:   { label: 'Animateur Events',    emoji: '🎉', desc: 'Organise et anime des événements pour faire vivre la communauté.' },
  helper:      { label: 'Helper Support',      emoji: '🤝', desc: 'Aide et oriente les membres qui ont besoin d\'assistance.' },
  partenariat: { label: 'Chargé Partenariats', emoji: '🌐', desc: 'Développe et gère les partenariats avec d\'autres serveurs.' },
  contenu:     { label: 'Responsable Contenu', emoji: '📝', desc: 'Crée et gère le contenu éditorial et les annonces du serveur.' },
  graphiste:   { label: 'Graphiste',           emoji: '🎨', desc: 'Conçoit l\'identité visuelle et les assets graphiques du serveur.' },
};

// ── Auto-setup du système de recrutement ──────────────────
async function autoSetupRecrutement(client, guildId) {
  try {
    const db = require('../database/db');

    // Créer les tables si elles n'existent pas encore
    try {
      db.db.exec(`
        CREATE TABLE IF NOT EXISTS rec_config (
          guild_id    TEXT PRIMARY KEY,
          log_channel TEXT,
          roles       TEXT DEFAULT '{}',
          status      TEXT DEFAULT '{}',
          ping_role   TEXT
        );
      `);
    } catch (_) {}

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    // ─ Chercher ou créer le canal de candidatures ─────────
    let panelChannel = guild.channels.cache.find(c =>
      c.type === ChannelType.GuildText &&
      (c.name.includes('candidature') || c.name.includes('recrutement') || c.name.includes('postul'))
    );

    // Si le canal existe déjà ET contient déjà un message du bot → skip
    if (panelChannel) {
      const msgs = await panelChannel.messages.fetch({ limit: 5 }).catch(() => null);
      const hasPanel = msgs?.some(m => m.author.id === client.user.id && m.embeds.length > 0);
      if (hasPanel) {
        console.log('[Recrutement] Auto-setup : panneau déjà présent dans #' + panelChannel.name + ', skip.');
        return;
      }
    }

    if (!panelChannel) {
      panelChannel = await guild.channels.create({
        name: '📋・candidatures',
        type: ChannelType.GuildText,
        topic: 'Postulez pour rejoindre l\'équipe staff ! Cliquez sur le bouton du poste souhaité.',
        reason: 'Auto-setup système de recrutement NexusBot',
      }).catch(e => {
        console.error('[Recrutement] Erreur création canal:', e.message);
        return null;
      });

      // Fallback : si on ne peut pas créer le canal, on utilise #gestion-tickets
      if (!panelChannel) {
        const FALLBACK_ID = '1494390992290054154'; // #gestion-tickets
        panelChannel = guild.channels.cache.get(FALLBACK_ID) || null;
        if (panelChannel) console.log('[Recrutement] ⚠️  Fallback → panneau posté dans #gestion-tickets');
      }
    }

    if (!panelChannel) return;

    // ─ Configurer rec_config (INSERT OR IGNORE = ne pas écraser une config existante) ──
    const LOG_CHANNEL_ID = process.env.REC_LOG_CHANNEL || '1494390992290054154';

    db.db.prepare('INSERT OR IGNORE INTO rec_config (guild_id, log_channel, status, roles) VALUES (?,?,?,?)').run(
      guildId, LOG_CHANNEL_ID, JSON.stringify({}), JSON.stringify({})
    );

    // ─ Construire et poster le panneau (design premium) ──
    const iconURL   = guild.iconURL({ size: 256, dynamic: true });
    const bannerURL = guild.bannerURL({ size: 1024, forceStatic: false });

    const panelEmbed = new EmbedBuilder()
      .setColor('#5865F2')
      .setAuthor({ name: `${guild.name} — Recrutement Staff`, iconURL: iconURL ?? undefined })
      .setTitle('✨  Rejoins l\'équipe qui fait vivre le serveur !')
      .setDescription(
        `> *Nous cherchons des personnes motivées et investies pour renforcer notre équipe.*\n\n` +
        `**📌 Comment postuler ?**\n` +
        `Clique sur le bouton du poste qui t'intéresse, remplis le formulaire et soumets ta candidature.\n` +
        `Notre équipe te répondra sous **48–72h**.\n\n` +
        `**📋 Postes disponibles — \`${Object.keys(POSTES).length}/${Object.keys(POSTES).length} ouverts\`**\n` +
        Object.entries(POSTES).map(([, p]) => `${p.emoji} **${p.label}** — 🟢 Ouvert`).join('\n') + '\n\n' +
        `**⚠️ Règles importantes**\n` +
        `— Remplis chaque champ avec soin et honnêteté\n` +
        `— Une seule candidature active à la fois\n` +
        `— Toute candidature bâclée sera refusée automatiquement`
      )
      .setThumbnail(iconURL ?? null)
      .setFooter({ text: `${guild.name}  •  Répond sous 48–72h  •  Bonne chance ! 🍀`, iconURL: iconURL ?? undefined })
      .setTimestamp();

    if (bannerURL) panelEmbed.setImage(bannerURL);

    // Boutons bleus Primary (4 max par rangée)
    const entries = Object.entries(POSTES);
    const rows = [];
    for (let i = 0; i < entries.length; i += 4) {
      const row = new ActionRowBuilder();
      for (const [key, p] of entries.slice(i, i + 4)) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`rec_apply_${key}`)
            .setLabel(p.label)
            .setEmoji(p.emoji)
            .setStyle(ButtonStyle.Primary)
        );
      }
      rows.push(row);
    }

    await panelChannel.send({ embeds: [panelEmbed], components: rows }).catch(e => {
      console.error('[Recrutement] Erreur envoi panneau:', e.message);
    });

    console.log(`[Recrutement] ✅ Auto-setup terminé — panneau posté dans #${panelChannel.name} (${panelChannel.id})`);
    console.log(`[Recrutement]    Log channel : ${LOG_CHANNEL_ID}`);

  } catch (err) {
    console.error('[Recrutement] Erreur auto-setup:', err.message);
  }
}

// ── Topics des canaux ──────────────────────────────────────
const CHANNEL_TOPICS = {
  'changelog':      '📋 Dernières mises à jour du serveur et de NexusBot — lis avant de poser des questions !',
  'info-serveur':   'ℹ️ Règles, informations importantes et présentation du serveur — lecture obligatoire',
  'roadmap':        '🗺️ Ce qui arrive bientôt — Fonctionnalités à venir pour le serveur et NexusBot',
  'partenariats':   '🌐 Nos partenaires officiels — Pour proposer un partenariat : /partenariat',
  'giveaways':      '🎁 Giveaways actifs — Réagis pour participer ! Crée le tien avec /giveaway',
  'événements':     '🎉 Événements, concours et animations — reste actif pour ne rien rater !',
  'ticket':         '🎫 Besoin d\'aide ? Ouvre un ticket avec /ticket — réponse sous 24h',
  'bump':           '🔔 Aide-nous à grandir ! Bumpez avec /bump — récompenses automatiques à la clé',
  'général':        '💬 Discussion générale — Bienvenue ! Présente-toi et discute avec la communauté',
  'commandes':      '🤖 Espace dédié aux commandes — NexusBot, Carl-bot, DISBOARD et plus',
  'mèmes':          '😂 Partage tes meilleurs mèmes — humour bienvenu, contenu choquant interdit',
  'médias':         '📸 Photos, vidéos, clips et créations — montre-nous ce que tu as !',
  'off-topic':      '🌐 Discussion hors-sujet — tout est permis dans le respect des règles',
  'idées':          '💡 Suggère des améliorations pour le serveur — les meilleures idées sont appliquées !',
  'candidatures':   '📋 Postule pour rejoindre l\'équipe staff — remplis le formulaire avec soin',
  'économie':       '💰 Gère ton argent, travaille et fais-toi une fortune — /daily /work /aide',
  'classement':     '🏆 Top joueurs — meilleur XP, meilleur solde, meilleures stats — /classement',
  'récompenses':    '🎁 Tes missions, récompenses quotidiennes et cadeaux — /missions /daily',
  'boutique':       '🛍️ Dépense tes coins — items exclusifs, rôles premium et avantages — /shop',
  'casino':         '🎰 Zone casino — 15+ jeux : /slots /blackjack /crash /hippodrome et bien plus !',
};

async function setupChannelTopics(client, guildId) {
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    const channels = guild.channels.cache.filter(c => c.type === 0); // TextChannel
    let updated = 0;
    for (const [, channel] of channels) {
      const cleanName = channel.name.replace(/[^a-z0-9\-éèêëàâùûüîïôç]/gi, '').toLowerCase();
      // Cherche une correspondance par nom exact ou partiel
      const topic = CHANNEL_TOPICS[channel.name] ||
        Object.entries(CHANNEL_TOPICS).find(([k]) => channel.name.includes(k))?.[1];
      if (topic && channel.topic !== topic) {
        await channel.setTopic(topic, 'NexusBot — mise à jour automatique des descriptions').catch(() => {});
        updated++;
        await new Promise(r => setTimeout(r, 600)); // Rate limit safety
      }
    }
    if (updated > 0) console.log(`✅ Topics canaux : ${updated} canal(aux) mis à jour`);
  } catch (e) {
    console.error('[Topics] Erreur:', e.message);
  }
}

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`✅ Bot connecté: ${client.user.tag} (${client.user.id})`);

    // ── Présence initiale + rotation toutes les 30s ────────
    rotateActivity(client);
    setInterval(() => rotateActivity(client), 30_000);
    console.log('✅ Présence : statuts rotatifs activés (30s interval)');

    // ── Nom du bot & avatar via API ───────────────────────
    // (décommente pour forcer la mise à jour du username)
    // client.user.setUsername('NexusBot').catch(() => {});

    // ── Bump Reminder — vérification toutes les 60 secondes ─
    checkBumpReminders(client).catch(() => {});
    setInterval(() => checkBumpReminders(client).catch(() => {}), 60_000);
    console.log('✅ Bump Reminder : checker démarré (60s interval, persistant DB)');

    // ── Migration : désactiver les messages de départ (leave_channel = NULL) ──
    try {
      const db = require('../database/db');
      db.db.prepare('UPDATE guild_config SET leave_channel = NULL WHERE leave_channel IS NOT NULL').run();
      console.log('✅ Migration : leave_channel réinitialisé à NULL pour tous les guilds');
    } catch (_) {}

    const guildId = process.env.HOME_GUILD_ID || '1492886135159128227';

    // ── Auto-setup recrutement (15s après démarrage pour laisser le cache se remplir)
    setTimeout(() => autoSetupRecrutement(client, guildId).catch(() => {}), 15_000);

    // ── Topics des canaux (30s pour laisser le cache se remplir)
    setTimeout(() => setupChannelTopics(client, guildId).catch(() => {}), 30_000);

    // ── Musique casino — auto-démarrage (20s pour que le cache vocal soit prêt)
    casinoMusicAutoInit(client, guildId).catch(() => {});

    // ── Musique casino — background retry (relance si connexion tombe)
    casinoMusicBackgroundRetry(client, guildId).catch(() => {});

    // ── Musique casino — listener shard RESUMED (reconnexion après drop WS)
    client.ws.on('RESUMED', () => {
      casinoMusicOnShardResume(client, guildId).catch(() => {});
    });
    client.on('shardResume', () => {
      casinoMusicOnShardResume(client, guildId).catch(() => {});
    });

    const token = process.env.TOKEN || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
    if (!token) {
      console.error('❌ TOKEN non défini — skip enregistrement commandes');
      return;
    }

    const rest  = new REST({ version: '10' }).setToken(token);
    const appId = client.user.id;

    // ── Validation locale ──────────────────────────────────
    function validateCommands(cmds, label) {
      const issues = [];
      function checkNode(node, path) {
        if (node.description && node.description.length > 100)
          issues.push(`${path}.description trop longue (${node.description.length} chars)`);
        if (node.name && node.name.length > 32)
          issues.push(`${path}.name trop long (${node.name.length} chars)`);
        if (node.choices) node.choices.forEach((ch, i) => {
          if (typeof ch.name  === 'string' && ch.name.length  > 100) issues.push(`${path}.choices[${i}].name trop long`);
          if (typeof ch.value === 'string' && ch.value.length > 100) issues.push(`${path}.choices[${i}].value trop long`);
        });
        if (node.options) node.options.forEach((opt, i) => checkNode(opt, `${path}.options[${i}]`));
      }
      cmds.forEach((cmd, i) => checkNode(cmd, `${label}[${i}](${cmd.name})`));
      return issues;
    }

    const globalCmds = (client.globalCommandsList || [])
      .filter(d => d && typeof d.toJSON === 'function')
      .map(d => d.toJSON());

    const guildCmds = (client.guildCommandsList || [])
      .filter(d => d && typeof d.toJSON === 'function')
      .map(d => d.toJSON());

    console.log(`📦 Global: ${globalCmds.length} | Guild: ${guildCmds.length} commandes`);

    const issues = [
      ...validateCommands(globalCmds, 'global'),
      ...validateCommands(guildCmds,  'guild'),
    ];
    if (issues.length > 0) {
      console.error('❌ Validation — problèmes:');
      issues.forEach(i => console.error('  •', i));
    } else {
      console.log('✅ Validation OK');
    }

    // ── Enregistrement GUILD commands ──────────────────────
    try {
      await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: guildCmds });
      console.log(`✅ ${guildCmds.length} guild commands enregistrées`);
    } catch (error) {
      console.error('❌ Guild registration:', error.message);
    }

    // ── Enregistrement GLOBAL commands ─────────────────────
    try {
      await rest.put(Routes.applicationCommands(appId), { body: globalCmds });
      console.log(`✅ ${globalCmds.length} global commands enregistrées`);
    } catch (error) {
      console.error('❌ Global registration:', error.message);
    }
  },
};
