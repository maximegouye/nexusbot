const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Sur Railway : DB_PATH=/app/data/nexusbot.db (volume persistant)
// En local : utilise le chemin relatif par défaut
const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/nexusbot.db');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath);

// Optimisations
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

// ================================
// SCHEMA
// ================================
db.exec(`
  -- Config par serveur
  CREATE TABLE IF NOT EXISTS guild_config (
    guild_id            TEXT PRIMARY KEY,
    prefix              TEXT DEFAULT '&',
    lang                TEXT DEFAULT 'fr',
    color               TEXT DEFAULT '#7B2FBE',
    xp_enabled          INTEGER DEFAULT 1,
    xp_multiplier       INTEGER DEFAULT 1,
    eco_enabled         INTEGER DEFAULT 1,
    welcome_channel     TEXT,
    welcome_msg         TEXT,
    leave_channel       TEXT,
    leave_msg           TEXT,
    log_channel         TEXT,
    mod_log_channel     TEXT,
    level_channel       TEXT,
    level_msg           TEXT,
    starboard_channel   TEXT,
    starboard_threshold INTEGER DEFAULT 3,
    automod_enabled     INTEGER DEFAULT 0,
    automod_badwords    TEXT DEFAULT '[]',
    automod_antispam    INTEGER DEFAULT 1,
    automod_antilink    INTEGER DEFAULT 0,
    mute_role           TEXT,
    autorole            TEXT,
    ticket_category     TEXT,
    ticket_log          TEXT,
    ticket_staff_role   TEXT,
    ticket_channel      TEXT,
    currency_name       TEXT DEFAULT 'Euros',
    currency_emoji      TEXT DEFAULT '€',
    daily_amount        INTEGER DEFAULT 25,
    xp_rate             INTEGER DEFAULT 15,
    coins_per_msg       INTEGER DEFAULT 1,
    quest_channel       TEXT,
    birthday_channel    TEXT,
    birthday_role       TEXT,
    health_channel      TEXT,
    tempvoice_creator   TEXT,
    created_at          INTEGER DEFAULT (strftime('%s','now'))
  );

  -- Utilisateurs
  CREATE TABLE IF NOT EXISTS users (
    user_id         TEXT NOT NULL,
    guild_id        TEXT NOT NULL,
    balance         INTEGER DEFAULT 0,
    bank            INTEGER DEFAULT 0,
    total_earned    INTEGER DEFAULT 0,
    xp              INTEGER DEFAULT 0,
    level           INTEGER DEFAULT 1,
    voice_xp        INTEGER DEFAULT 0,
    voice_minutes   INTEGER DEFAULT 0,
    message_count   INTEGER DEFAULT 0,
    reputation      INTEGER DEFAULT 0,
    last_daily      INTEGER DEFAULT 0,
    last_work       INTEGER DEFAULT 0,
    last_crime      INTEGER DEFAULT 0,
    last_rob        INTEGER DEFAULT 0,
    last_message    INTEGER DEFAULT 0,
    streak          INTEGER DEFAULT 0,
    birthday        TEXT,
    birth_year      INTEGER,
    joined_at       INTEGER DEFAULT (strftime('%s','now')),
    timezone        TEXT DEFAULT 'Europe/Paris',
    bio             TEXT,
    background      TEXT DEFAULT 'default',
    created_at      INTEGER DEFAULT (strftime('%s','now')),
    PRIMARY KEY (user_id, guild_id)
  );

  -- Inventaire
  CREATE TABLE IF NOT EXISTS inventory (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT NOT NULL,
    guild_id    TEXT NOT NULL,
    item_id     INTEGER NOT NULL,
    quantity    INTEGER DEFAULT 1,
    expires_at  INTEGER,
    UNIQUE(user_id, guild_id, item_id)
  );

  -- Boutique
  CREATE TABLE IF NOT EXISTS shop (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id        TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    emoji           TEXT DEFAULT '📦',
    price           INTEGER NOT NULL,
    stock           INTEGER DEFAULT -1,
    role_id         TEXT,
    duration_hours  INTEGER,
    max_per_user    INTEGER,
    active          INTEGER DEFAULT 1,
    created_at      INTEGER DEFAULT (strftime('%s','now'))
  );

  -- Transactions
  CREATE TABLE IF NOT EXISTS transactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    from_id     TEXT NOT NULL,
    to_id       TEXT NOT NULL,
    amount      INTEGER NOT NULL,
    reason      TEXT,
    type        TEXT DEFAULT 'transfer',
    created_at  INTEGER DEFAULT (strftime('%s','now'))
  );

  -- Marché P2P (UNIQUE vs concurrents)
  CREATE TABLE IF NOT EXISTS market_listings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    seller_id   TEXT NOT NULL,
    buyer_id    TEXT,
    item_id     INTEGER NOT NULL,
    quantity    INTEGER DEFAULT 1,
    price       INTEGER NOT NULL,
    status      TEXT DEFAULT 'active',
    created_at  INTEGER DEFAULT (strftime('%s','now')),
    expires_at  INTEGER
  );

  -- Avertissements
  CREATE TABLE IF NOT EXISTS warnings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    mod_id      TEXT NOT NULL,
    reason      TEXT NOT NULL,
    created_at  INTEGER DEFAULT (strftime('%s','now'))
  );

  -- Rôles temporaires
  CREATE TABLE IF NOT EXISTS temp_roles (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    role_id     TEXT NOT NULL,
    expires_at  INTEGER NOT NULL
  );

  -- Rappels
  CREATE TABLE IF NOT EXISTS reminders (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT NOT NULL,
    guild_id    TEXT NOT NULL,
    channel_id  TEXT NOT NULL,
    message     TEXT NOT NULL,
    trigger_at  INTEGER NOT NULL,
    triggered   INTEGER DEFAULT 0,
    created_at  INTEGER DEFAULT (strftime('%s','now'))
  );

  -- Giveaways
  CREATE TABLE IF NOT EXISTS giveaways (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id        TEXT NOT NULL,
    channel_id      TEXT NOT NULL,
    message_id      TEXT,
    host_id         TEXT NOT NULL,
    prize           TEXT NOT NULL,
    winners_count   INTEGER DEFAULT 1,
    entries         TEXT DEFAULT '[]',
    winner_ids      TEXT DEFAULT '[]',
    min_level       INTEGER DEFAULT 0,
    min_balance     INTEGER DEFAULT 0,
    bonus_role_id   TEXT,
    status          TEXT DEFAULT 'active',
    ends_at         INTEGER NOT NULL,
    created_at      INTEGER DEFAULT (strftime('%s','now'))
  );

  -- Tickets
  CREATE TABLE IF NOT EXISTS tickets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    channel_id  TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    subject     TEXT,
    status      TEXT DEFAULT 'open',
    assigned_to TEXT,
    created_at  INTEGER DEFAULT (strftime('%s','now')),
    closed_at   INTEGER
  );

  -- Starboard
  CREATE TABLE IF NOT EXISTS starboard (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id         TEXT NOT NULL,
    message_id       TEXT NOT NULL,
    channel_id       TEXT NOT NULL,
    author_id        TEXT NOT NULL,
    starboard_msg_id TEXT,
    stars            INTEGER DEFAULT 0,
    UNIQUE(guild_id, message_id)
  );

  -- Quêtes communautaires (UNIQUE vs concurrents)
  CREATE TABLE IF NOT EXISTS quests (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT NOT NULL,
    target      INTEGER NOT NULL,
    current     INTEGER DEFAULT 0,
    reward      TEXT NOT NULL,
    status      TEXT DEFAULT 'active',
    ends_at     INTEGER,
    created_at  INTEGER DEFAULT (strftime('%s','now'))
  );

  -- Contributions aux quêtes
  CREATE TABLE IF NOT EXISTS quest_contributions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    quest_id    INTEGER NOT NULL,
    guild_id    TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    amount      INTEGER DEFAULT 0,
    created_at  INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(quest_id, user_id),
    FOREIGN KEY (quest_id) REFERENCES quests(id)
  );

  -- Réputation (UNIQUE vs concurrents)
  CREATE TABLE IF NOT EXISTS rep_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    giver_id    TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    message     TEXT,
    created_at  INTEGER DEFAULT (strftime('%s','now'))
  );

  -- Reaction roles
  CREATE TABLE IF NOT EXISTS reaction_roles (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    message_id  TEXT NOT NULL,
    channel_id  TEXT,
    emoji       TEXT NOT NULL,
    role_id     TEXT NOT NULL,
    UNIQUE(guild_id, message_id, emoji)
  );

  -- Sondages
  CREATE TABLE IF NOT EXISTS polls (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    channel_id  TEXT NOT NULL,
    message_id  TEXT,
    creator_id  TEXT NOT NULL,
    question    TEXT NOT NULL,
    choices     TEXT NOT NULL,
    votes       TEXT DEFAULT '{}',
    ends_at     INTEGER,
    ended       INTEGER DEFAULT 0,
    created_at  INTEGER DEFAULT (strftime('%s','now'))
  );

  -- Stats serveur (Rapport de santé hebdo)
  CREATE TABLE IF NOT EXISTS guild_stats (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id        TEXT NOT NULL,
    total_messages  INTEGER DEFAULT 0,
    commands_used   INTEGER DEFAULT 0,
    joined_members  INTEGER DEFAULT 0,
    left_members    INTEGER DEFAULT 0,
    bans            INTEGER DEFAULT 0,
    date            TEXT NOT NULL,
    UNIQUE(guild_id, date)
  );

  -- Sessions vocales
  CREATE TABLE IF NOT EXISTS voice_sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    joined_at   INTEGER NOT NULL,
    channel_id  TEXT NOT NULL
  );

  -- Temporary Voice Channels
  CREATE TABLE IF NOT EXISTS temp_channels (
    channel_id  TEXT PRIMARY KEY,
    guild_id    TEXT NOT NULL,
    owner_id    TEXT NOT NULL,
    created_at  INTEGER DEFAULT (strftime('%s','now'))
  );

  -- Mariages
  CREATE TABLE IF NOT EXISTS marriages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    user1_id    TEXT NOT NULL,
    user2_id    TEXT NOT NULL,
    married_at  INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, user1_id),
    UNIQUE(guild_id, user2_id)
  );

  -- AFK
  CREATE TABLE IF NOT EXISTS afk (
    guild_id    TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    reason      TEXT DEFAULT 'AFK',
    created_at  INTEGER DEFAULT (strftime('%s','now')),
    PRIMARY KEY (guild_id, user_id)
  );

  -- Loto hebdomadaire
  CREATE TABLE IF NOT EXISTS lotto (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    tickets     INTEGER DEFAULT 1,
    amount      INTEGER DEFAULT 0,
    week        TEXT NOT NULL,
    created_at  INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, user_id, week)
  );

  -- Suggestions
  CREATE TABLE IF NOT EXISTS suggestions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id     TEXT NOT NULL,
    channel_id   TEXT NOT NULL,
    message_id   TEXT,
    user_id      TEXT NOT NULL,
    content      TEXT NOT NULL,
    status       TEXT DEFAULT 'pending',
    upvotes      INTEGER DEFAULT 0,
    downvotes    INTEGER DEFAULT 0,
    mod_id       TEXT,
    mod_response TEXT,
    created_at   INTEGER DEFAULT (strftime('%s','now'))
  );

  -- Rôles de niveau
  CREATE TABLE IF NOT EXISTS level_roles (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    level       INTEGER NOT NULL,
    role_id     TEXT NOT NULL,
    UNIQUE(guild_id, level)
  );

  -- Commandes personnalisées
  CREATE TABLE IF NOT EXISTS custom_commands (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    trigger     TEXT NOT NULL,
    response    TEXT NOT NULL,
    created_by  TEXT NOT NULL,
    created_at  INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, trigger)
  );

  -- Notes de modération (modlog silencieux)
  CREATE TABLE IF NOT EXISTS mod_notes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    mod_id      TEXT NOT NULL,
    note        TEXT NOT NULL,
    created_at  INTEGER DEFAULT (strftime('%s','now'))
  );

  -- Tempbans
  CREATE TABLE IF NOT EXISTS tempbans (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    mod_id      TEXT NOT NULL,
    reason      TEXT,
    expires_at  INTEGER NOT NULL,
    unbanned    INTEGER DEFAULT 0,
    created_at  INTEGER DEFAULT (strftime('%s','now'))
  );

  -- Jeu du comptage
  CREATE TABLE IF NOT EXISTS counting (
    guild_id        TEXT PRIMARY KEY,
    channel_id      TEXT,
    current         INTEGER DEFAULT 0,
    last_user_id    TEXT,
    record          INTEGER DEFAULT 0
  );

  -- ══════════════════════════════════════
  -- NOUVELLES TABLES v2.0
  -- ══════════════════════════════════════

  -- Premium serveurs
  CREATE TABLE IF NOT EXISTS premium_servers (
    guild_id        TEXT PRIMARY KEY,
    activated_by    TEXT NOT NULL,
    code            TEXT,
    plan            TEXT DEFAULT 'monthly',
    expires_at      INTEGER,
    activated_at    INTEGER DEFAULT (strftime('%s','now'))
  );

  -- Codes premium
  CREATE TABLE IF NOT EXISTS premium_codes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT UNIQUE NOT NULL,
    plan        TEXT DEFAULT 'monthly',
    duration_days INTEGER DEFAULT 30,
    used        INTEGER DEFAULT 0,
    used_by     TEXT,
    used_at     INTEGER,
    created_at  INTEGER DEFAULT (strftime('%s','now'))
  );

  -- Tracking des invitations
  CREATE TABLE IF NOT EXISTS invite_tracker (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    inviter_id  TEXT NOT NULL,
    invited_id  TEXT NOT NULL,
    code        TEXT,
    joined_at   INTEGER DEFAULT (strftime('%s','now')),
    left        INTEGER DEFAULT 0
  );

  -- Stats invitations par utilisateur
  CREATE TABLE IF NOT EXISTS invite_stats (
    guild_id    TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    total       INTEGER DEFAULT 0,
    left        INTEGER DEFAULT 0,
    fake        INTEGER DEFAULT 0,
    bonus       INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );

  -- Abonnements YouTube
  CREATE TABLE IF NOT EXISTS youtube_subs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    channel_id  TEXT NOT NULL,
    yt_channel_id TEXT NOT NULL,
    yt_channel_name TEXT,
    last_video_id TEXT,
    message     TEXT DEFAULT '🎬 Nouvelle vidéo de {channel} ! {url}',
    role_ping   TEXT,
    created_at  INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, yt_channel_id)
  );

  -- Abonnements Twitch
  CREATE TABLE IF NOT EXISTS twitch_subs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    channel_id  TEXT NOT NULL,
    twitch_login TEXT NOT NULL,
    was_live    INTEGER DEFAULT 0,
    message     TEXT DEFAULT '🔴 {streamer} est EN LIVE ! {url}',
    role_ping   TEXT,
    created_at  INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, twitch_login)
  );

  -- Files d'attente musicales (persistance optionnelle)
  CREATE TABLE IF NOT EXISTS music_queue_persist (
    guild_id    TEXT PRIMARY KEY,
    queue_json  TEXT DEFAULT '[]',
    volume      INTEGER DEFAULT 100,
    loop_mode   TEXT DEFAULT 'none'
  );

  -- Logs d'actions (auto-mod, anti-raid)
  CREATE TABLE IF NOT EXISTS action_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    type        TEXT NOT NULL,
    user_id     TEXT,
    mod_id      TEXT,
    reason      TEXT,
    data        TEXT,
    created_at  INTEGER DEFAULT (strftime('%s','now'))
  );

  -- Anti-raid config
  CREATE TABLE IF NOT EXISTS antiraid_config (
    guild_id            TEXT PRIMARY KEY,
    enabled             INTEGER DEFAULT 0,
    join_threshold      INTEGER DEFAULT 10,
    join_window_secs    INTEGER DEFAULT 30,
    action              TEXT DEFAULT 'kick',
    new_account_days    INTEGER DEFAULT 7,
    new_account_action  TEXT DEFAULT 'kick',
    captcha_enabled     INTEGER DEFAULT 0,
    whitelist_roles     TEXT DEFAULT '[]'
  );

  -- Images de bienvenue custom
  CREATE TABLE IF NOT EXISTS welcome_images (
    guild_id    TEXT PRIMARY KEY,
    bg_color    TEXT DEFAULT '#1a1a2e',
    accent_color TEXT DEFAULT '#7B2FBE',
    text_color  TEXT DEFAULT '#FFFFFF',
    bg_url      TEXT,
    style       TEXT DEFAULT 'card'
  );

  -- Boost tracker
  CREATE TABLE IF NOT EXISTS boosts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    boosted_at  INTEGER DEFAULT (strftime('%s','now')),
    coins_given INTEGER DEFAULT 0
  );

  -- ══════════════════════════════════════
  -- TABLES AUXILIAIRES v2.1
  -- ══════════════════════════════════════

  -- XP exclusions (canaux/rôles sans XP)
  CREATE TABLE IF NOT EXISTS no_xp (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    type        TEXT NOT NULL,
    target_id   TEXT NOT NULL,
    UNIQUE(guild_id, type, target_id)
  );

  -- Multiplicateurs XP par rôle
  CREATE TABLE IF NOT EXISTS xp_multipliers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    role_id     TEXT NOT NULL,
    multiplier  REAL DEFAULT 1.0,
    UNIQUE(guild_id, role_id)
  );

  -- Menus de rôles (boutons)
  CREATE TABLE IF NOT EXISTS role_menus (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id      TEXT NOT NULL,
    channel_id    TEXT NOT NULL,
    message_id    TEXT,
    title         TEXT NOT NULL,
    description   TEXT,
    roles         TEXT DEFAULT '[]',
    max_choices   INTEGER DEFAULT 0,
    required_role TEXT,
    created_at    INTEGER DEFAULT (strftime('%s','now'))
  );

  -- Configuration Starboard avancée
  CREATE TABLE IF NOT EXISTS starboard_config (
    guild_id    TEXT PRIMARY KEY,
    channel_id  TEXT NOT NULL,
    threshold   INTEGER DEFAULT 3,
    emoji       TEXT DEFAULT '⭐',
    selfstar    INTEGER DEFAULT 0
  );

  -- Messages déjà publiés sur le starboard
  CREATE TABLE IF NOT EXISTS starboard_messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id        TEXT NOT NULL,
    original_msg_id TEXT NOT NULL,
    star_msg_id     TEXT,
    channel_id      TEXT,
    stars           INTEGER DEFAULT 0,
    UNIQUE(guild_id, original_msg_id)
  );

  -- Highlights (mots-clés)
  CREATE TABLE IF NOT EXISTS highlights (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    keyword     TEXT NOT NULL,
    UNIQUE(guild_id, user_id, keyword)
  );

  -- AutoResponder
  CREATE TABLE IF NOT EXISTS autoresponder (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    trigger     TEXT NOT NULL,
    response    TEXT NOT NULL,
    exact_match INTEGER DEFAULT 0,
    cooldown    INTEGER DEFAULT 0,
    uses        INTEGER DEFAULT 0,
    created_at  INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, trigger)
  );

  -- Tags (réponses prédéfinies)
  CREATE TABLE IF NOT EXISTS tags (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    name        TEXT NOT NULL,
    content     TEXT NOT NULL,
    author_id   TEXT NOT NULL,
    uses        INTEGER DEFAULT 0,
    created_at  INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, name)
  );

  -- AutoMod config (créée aussi dans automod.js, CREATE IF NOT EXISTS = safe)
  CREATE TABLE IF NOT EXISTS automod_config (
    guild_id        TEXT PRIMARY KEY,
    anti_spam       INTEGER DEFAULT 0,
    spam_threshold  INTEGER DEFAULT 5,
    spam_window     INTEGER DEFAULT 5,
    anti_links      INTEGER DEFAULT 0,
    allowed_links   TEXT DEFAULT '[]',
    anti_invites    INTEGER DEFAULT 0,
    anti_caps       INTEGER DEFAULT 0,
    caps_threshold  INTEGER DEFAULT 70,
    anti_mentions   INTEGER DEFAULT 0,
    mentions_limit  INTEGER DEFAULT 5,
    bad_words       TEXT DEFAULT '[]',
    log_channel     TEXT,
    action          TEXT DEFAULT 'warn',
    updated_at      INTEGER DEFAULT 0
  );

  -- Index de performance
  CREATE INDEX IF NOT EXISTS idx_users_guild    ON users(guild_id);
  CREATE INDEX IF NOT EXISTS idx_users_xp       ON users(guild_id, xp DESC);
  CREATE INDEX IF NOT EXISTS idx_users_balance  ON users(guild_id, balance DESC);
  CREATE INDEX IF NOT EXISTS idx_users_rep      ON users(guild_id, reputation DESC);
  CREATE INDEX IF NOT EXISTS idx_users_voice    ON users(guild_id, voice_minutes DESC);
  CREATE INDEX IF NOT EXISTS idx_users_messages ON users(guild_id, message_count DESC);
  CREATE INDEX IF NOT EXISTS idx_warnings_user  ON warnings(guild_id, user_id);
  CREATE INDEX IF NOT EXISTS idx_giveaways_act  ON giveaways(status, ends_at);
  CREATE INDEX IF NOT EXISTS idx_tickets_guild  ON tickets(guild_id, status);
  CREATE INDEX IF NOT EXISTS idx_reminders_trig ON reminders(trigger_at, triggered);
  CREATE INDEX IF NOT EXISTS idx_market_active  ON market_listings(guild_id, status);
`);

// ================================
// MIGRATIONS (colonnes ajoutées après création)
// ================================
const migrations = [
  // quests.status
  { table: 'quests', column: 'status', sql: "ALTER TABLE quests ADD COLUMN status TEXT DEFAULT 'active'" },
  { table: 'quests', column: 'ends_at', sql: "ALTER TABLE quests ADD COLUMN ends_at INTEGER" },
  // guild_config champs ajoutés v2
  { table: 'guild_config', column: 'boost_channel',   sql: "ALTER TABLE guild_config ADD COLUMN boost_channel TEXT" },
  { table: 'guild_config', column: 'quest_channel',   sql: "ALTER TABLE guild_config ADD COLUMN quest_channel TEXT" },
  { table: 'guild_config', column: 'xp_rate',         sql: "ALTER TABLE guild_config ADD COLUMN xp_rate INTEGER DEFAULT 15" },
  { table: 'guild_config', column: 'coins_per_msg',   sql: "ALTER TABLE guild_config ADD COLUMN coins_per_msg INTEGER DEFAULT 5" },
  { table: 'guild_config', column: 'stats_members_ch',sql: "ALTER TABLE guild_config ADD COLUMN stats_members_ch TEXT" },
  { table: 'guild_config', column: 'stats_bots_ch',   sql: "ALTER TABLE guild_config ADD COLUMN stats_bots_ch TEXT" },
  { table: 'guild_config', column: 'stats_boosts_ch', sql: "ALTER TABLE guild_config ADD COLUMN stats_boosts_ch TEXT" },
  { table: 'guild_config', column: 'stats_channels_ch',sql:"ALTER TABLE guild_config ADD COLUMN stats_channels_ch TEXT" },
  // users
  { table: 'users', column: 'last_message', sql: "ALTER TABLE users ADD COLUMN last_message INTEGER DEFAULT 0" },
  // shop (active peut manquer sur des DBs anciennes)
  { table: 'shop', column: 'active', sql: "ALTER TABLE shop ADD COLUMN active INTEGER DEFAULT 1" },
  { table: 'shop', column: 'max_per_user', sql: "ALTER TABLE shop ADD COLUMN max_per_user INTEGER" },
  { table: 'shop', column: 'duration_hours', sql: "ALTER TABLE shop ADD COLUMN duration_hours INTEGER" },
  { table: 'shop', column: 'role_id', sql: "ALTER TABLE shop ADD COLUMN role_id TEXT" },
  // shop_items (colonnes manquantes sur les DBs sans migration préalable)
  { table: 'shop_items', column: 'active', sql: "ALTER TABLE shop_items ADD COLUMN active INTEGER DEFAULT 1" },
  { table: 'shop_items', column: 'max_per_user', sql: "ALTER TABLE shop_items ADD COLUMN max_per_user INTEGER DEFAULT -1" },
  // guild_config champs supplémentaires
  { table: 'guild_config', column: 'birthday_channel', sql: "ALTER TABLE guild_config ADD COLUMN birthday_channel TEXT" },
  { table: 'guild_config', column: 'birthday_role', sql: "ALTER TABLE guild_config ADD COLUMN birthday_role TEXT" },
  { table: 'guild_config', column: 'health_channel', sql: "ALTER TABLE guild_config ADD COLUMN health_channel TEXT" },
  { table: 'guild_config', column: 'boost_channel', sql: "ALTER TABLE guild_config ADD COLUMN boost_channel TEXT" },
  // guild_stats — colonne new_members manquante sur les DBs déployées
  { table: 'guild_stats', column: 'new_members', sql: "ALTER TABLE guild_stats ADD COLUMN new_members INTEGER DEFAULT 0" },
  // guild_config — tempvoice_creator utilisé par tempvoice mais absent des migrations
  { table: 'guild_config', column: 'tempvoice_creator', sql: "ALTER TABLE guild_config ADD COLUMN tempvoice_creator TEXT" },
  // ticket colonnes (backup si ticket.js ne les crée pas en premier)
  { table: 'guild_config', column: 'ticket_log_channel', sql: "ALTER TABLE guild_config ADD COLUMN ticket_log_channel TEXT" },
  { table: 'guild_config', column: 'ticket_welcome_msg', sql: "ALTER TABLE guild_config ADD COLUMN ticket_welcome_msg TEXT" },
  // automod colonnes avancées
  { table: 'guild_config', column: 'automod_spam',           sql: "ALTER TABLE guild_config ADD COLUMN automod_spam INTEGER DEFAULT 0" },
  { table: 'guild_config', column: 'automod_spam_threshold', sql: "ALTER TABLE guild_config ADD COLUMN automod_spam_threshold INTEGER DEFAULT 5" },
  { table: 'guild_config', column: 'automod_caps',           sql: "ALTER TABLE guild_config ADD COLUMN automod_caps INTEGER DEFAULT 0" },
  { table: 'guild_config', column: 'automod_invites',        sql: "ALTER TABLE guild_config ADD COLUMN automod_invites INTEGER DEFAULT 0" },
  { table: 'guild_config', column: 'automod_links',          sql: "ALTER TABLE guild_config ADD COLUMN automod_links INTEGER DEFAULT 0" },
  { table: 'guild_config', column: 'automod_words',          sql: "ALTER TABLE guild_config ADD COLUMN automod_words TEXT" },
  { table: 'guild_config', column: 'automod_log',            sql: "ALTER TABLE guild_config ADD COLUMN automod_log TEXT" },
  // users — work_streak
  { table: 'users', column: 'work_streak', sql: "ALTER TABLE users ADD COLUMN work_streak INTEGER DEFAULT 0" },
  // users — colonnes marché noir (bm_*) utilisées par marche_noir.js et eco.js prefix
  { table: 'users', column: 'bm_steal_kit',         sql: "ALTER TABLE users ADD COLUMN bm_steal_kit INTEGER DEFAULT 0" },
  { table: 'users', column: 'bm_protected_until',   sql: "ALTER TABLE users ADD COLUMN bm_protected_until INTEGER DEFAULT 0" },
  { table: 'users', column: 'bm_boost_xp_until',    sql: "ALTER TABLE users ADD COLUMN bm_boost_xp_until INTEGER DEFAULT 0" },
  { table: 'users', column: 'bm_casino_bonus',       sql: "ALTER TABLE users ADD COLUMN bm_casino_bonus INTEGER DEFAULT 0" },
  { table: 'users', column: 'bm_fishing_bait',       sql: "ALTER TABLE users ADD COLUMN bm_fishing_bait INTEGER DEFAULT 0" },
  { table: 'users', column: 'bm_mine_tnt',           sql: "ALTER TABLE users ADD COLUMN bm_mine_tnt INTEGER DEFAULT 0" },
  // Activités (pêche, chasse, mine, mendicité, braquage, creuser)
  { table: 'users', column: 'last_fish',   sql: "ALTER TABLE users ADD COLUMN last_fish INTEGER DEFAULT 0" },
  { table: 'users', column: 'last_hunt',   sql: "ALTER TABLE users ADD COLUMN last_hunt INTEGER DEFAULT 0" },
  { table: 'users', column: 'last_mine',   sql: "ALTER TABLE users ADD COLUMN last_mine INTEGER DEFAULT 0" },
  { table: 'users', column: 'last_beg',    sql: "ALTER TABLE users ADD COLUMN last_beg INTEGER DEFAULT 0" },
  { table: 'users', column: 'last_heist',  sql: "ALTER TABLE users ADD COLUMN last_heist INTEGER DEFAULT 0" },
  { table: 'users', column: 'last_dig',            sql: "ALTER TABLE users ADD COLUMN last_dig INTEGER DEFAULT 0" },
  { table: 'users', column: 'last_farm',           sql: "ALTER TABLE users ADD COLUMN last_farm INTEGER DEFAULT 0" },
  { table: 'users', column: 'last_lotto',          sql: "ALTER TABLE users ADD COLUMN last_lotto INTEGER DEFAULT 0" },
  { table: 'users', column: 'last_activity',       sql: "ALTER TABLE users ADD COLUMN last_activity INTEGER DEFAULT 0" },
  { table: 'users', column: 'last_battle',         sql: "ALTER TABLE users ADD COLUMN last_battle INTEGER DEFAULT 0" },
  { table: 'users', column: 'last_claim',          sql: "ALTER TABLE users ADD COLUMN last_claim INTEGER DEFAULT 0" },
  { table: 'users', column: 'last_collect',        sql: "ALTER TABLE users ADD COLUMN last_collect INTEGER DEFAULT 0" },
  { table: 'users', column: 'last_collect_artisan',sql: "ALTER TABLE users ADD COLUMN last_collect_artisan INTEGER DEFAULT 0" },
  { table: 'users', column: 'last_draw',           sql: "ALTER TABLE users ADD COLUMN last_draw INTEGER DEFAULT 0" },
  { table: 'users', column: 'last_fed',            sql: "ALTER TABLE users ADD COLUMN last_fed INTEGER DEFAULT 0" },
  { table: 'users', column: 'last_mission',        sql: "ALTER TABLE users ADD COLUMN last_mission INTEGER DEFAULT 0" },
  { table: 'users', column: 'last_paid',           sql: "ALTER TABLE users ADD COLUMN last_paid INTEGER DEFAULT 0" },
  { table: 'users', column: 'last_played',         sql: "ALTER TABLE users ADD COLUMN last_played INTEGER DEFAULT 0" },
  { table: 'users', column: 'last_quest',          sql: "ALTER TABLE users ADD COLUMN last_quest INTEGER DEFAULT 0" },
  { table: 'users', column: 'last_rep',            sql: "ALTER TABLE users ADD COLUMN last_rep INTEGER DEFAULT 0" },
  { table: 'users', column: 'last_run',            sql: "ALTER TABLE users ADD COLUMN last_run INTEGER DEFAULT 0" },
  { table: 'users', column: 'last_visit_reward',   sql: "ALTER TABLE users ADD COLUMN last_visit_reward INTEGER DEFAULT 0" },
  { table: 'users', column: 'last_bump',           sql: "ALTER TABLE users ADD COLUMN last_bump INTEGER DEFAULT 0" },
  // Paramètres jeux
  { table: 'guild_config', column: 'game_enabled',  sql: "ALTER TABLE guild_config ADD COLUMN game_enabled INTEGER DEFAULT 1" },
  { table: 'guild_config', column: 'game_min_bet',       sql: "ALTER TABLE guild_config ADD COLUMN game_min_bet INTEGER DEFAULT 10" },
  { table: 'guild_config', column: 'game_max_bet',       sql: "ALTER TABLE guild_config ADD COLUMN game_max_bet INTEGER DEFAULT 1000000" },
  { table: 'guild_config', column: 'boost_channel',      sql: "ALTER TABLE guild_config ADD COLUMN boost_channel TEXT" },
  // Paramètres supplémentaires v3
  { table: 'guild_config', column: 'rob_enabled',        sql: "ALTER TABLE guild_config ADD COLUMN rob_enabled INTEGER DEFAULT 1" },
  { table: 'guild_config', column: 'transfer_fee',       sql: "ALTER TABLE guild_config ADD COLUMN transfer_fee INTEGER DEFAULT 5" },
  { table: 'guild_config', column: 'prefix',             sql: "ALTER TABLE guild_config ADD COLUMN prefix TEXT DEFAULT '&'" },
  { table: 'guild_config', column: 'level_msg',          sql: "ALTER TABLE guild_config ADD COLUMN level_msg TEXT" },
  { table: 'guild_config', column: 'ticket_welcome_msg', sql: "ALTER TABLE guild_config ADD COLUMN ticket_welcome_msg TEXT" },
  { table: 'guild_config', column: 'starboard_channel',  sql: "ALTER TABLE guild_config ADD COLUMN starboard_channel TEXT" },
  { table: 'guild_config', column: 'starboard_threshold',sql: "ALTER TABLE guild_config ADD COLUMN starboard_threshold INTEGER DEFAULT 3" },
];

for (const m of migrations) {
  try {
    const cols = db.prepare(`PRAGMA table_info(${m.table})`).all().map(c => c.name);
    if (!cols.includes(m.column)) {
      db.prepare(m.sql).run();
      console.log(`[DB] Migration: ajout colonne ${m.table}.${m.column}`);
    }
  } catch (e) { /* ignore */ }
}

// ================================
// HELPERS
// ================================

const helpers = {
  db,

  // ── Config ──
  getConfig(guildId) {
    let cfg = db.prepare('SELECT * FROM guild_config WHERE guild_id = ?').get(guildId);
    if (!cfg) {
      db.prepare('INSERT OR IGNORE INTO guild_config (guild_id) VALUES (?)').run(guildId);
      cfg = db.prepare('SELECT * FROM guild_config WHERE guild_id = ?').get(guildId);
    }
    return cfg;
  },

  setConfig(guildId, key, value) {
    helpers.getConfig(guildId); // ensure row exists
    db.prepare(`UPDATE guild_config SET ${key} = ? WHERE guild_id = ?`).run(value, guildId);
  },

  // ── Utilisateurs ──
  getUser(userId, guildId) {
    let user = db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
    if (!user) {
      db.prepare('INSERT OR IGNORE INTO users (user_id, guild_id) VALUES (?, ?)').run(userId, guildId);
      user = db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
    }
    return user;
  },

  updateUser(userId, guildId, data) {
    const keys   = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(data), userId, guildId];
    db.prepare(`UPDATE users SET ${keys} WHERE user_id = ? AND guild_id = ?`).run(...values);
  },

  // ── Économie ──
  addCoins(userId, guildId, amount) {
    helpers.getUser(userId, guildId);
    db.prepare('UPDATE users SET balance = balance + ?, total_earned = total_earned + ? WHERE user_id = ? AND guild_id = ?')
      .run(Math.max(0, amount), amount > 0 ? amount : 0, userId, guildId);
  },

  removeCoins(userId, guildId, amount) {
    helpers.getUser(userId, guildId);
    db.prepare('UPDATE users SET balance = MAX(0, balance - ?) WHERE user_id = ? AND guild_id = ?')
      .run(amount, userId, guildId);
  },

  // ── XP ──
  addXP(userId, guildId, amount) {
    helpers.getUser(userId, guildId);
    const cfg = helpers.getConfig(guildId);
    if (cfg.xp_enabled === 0) return null;
    const multi = cfg.xp_multiplier || 1;
    db.prepare('UPDATE users SET xp = xp + ?, message_count = message_count + 1 WHERE user_id = ? AND guild_id = ?')
      .run(amount * multi, userId, guildId);
    return db.prepare('SELECT xp, level FROM users WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
  },

  getXPForLevel: (level) => Math.floor(100 * Math.pow(1.35, level - 1)),

  // Calcule le niveau à partir d'une quantité d'XP
  getLevel(xp) {
    let level = 1;
    while (helpers.getXPForLevel(level + 1) <= xp) level++;
    return level;
  },

  checkLevelUp(userId, guildId) {
    const user     = helpers.getUser(userId, guildId);
    const needed   = helpers.getXPForLevel(user.level + 1);
    if (user.xp >= needed) {
      db.prepare('UPDATE users SET level = level + 1 WHERE user_id = ? AND guild_id = ?').run(userId, guildId);
      return user.level + 1;
    }
    return null;
  },

  // ── Inventaire ──
  addItem(userId, guildId, itemId, qty = 1, expiresAt = null) {
    helpers.getUser(userId, guildId);
    db.prepare(`
      INSERT INTO inventory (user_id, guild_id, item_id, quantity, expires_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, guild_id, item_id) DO UPDATE SET quantity = quantity + ?, expires_at = COALESCE(excluded.expires_at, expires_at)
    `).run(userId, guildId, itemId, qty, expiresAt, qty);
  },

  removeItem(userId, guildId, itemId, qty = 1) {
    const item = db.prepare('SELECT * FROM inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?').get(userId, guildId, itemId);
    if (!item) return false;
    if (item.quantity <= qty) {
      db.prepare('DELETE FROM inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?').run(userId, guildId, itemId);
    } else {
      db.prepare('UPDATE inventory SET quantity = quantity - ? WHERE user_id = ? AND guild_id = ? AND item_id = ?').run(qty, userId, guildId, itemId);
    }
    return true;
  },

  // ── Leaderboard ──
  getLeaderboard(guildId, type = 'xp', limit = 10) {
    const colMap = { xp: 'xp', coins: 'balance + bank', voice: 'voice_minutes', messages: 'message_count', rep: 'reputation' };
    const col    = colMap[type] || 'xp';
    return db.prepare(`SELECT * FROM users WHERE guild_id = ? ORDER BY ${col} DESC LIMIT ?`).all(guildId, limit);
  },

  // ── Giveaways ──
  getActiveGiveaways(guildId = null) {
    const now = Math.floor(Date.now() / 1000);
    if (guildId) return db.prepare("SELECT * FROM giveaways WHERE guild_id = ? AND status = 'active' AND ends_at <= ?").all(guildId, now);
    return db.prepare("SELECT * FROM giveaways WHERE status = 'active' AND ends_at <= ?").all(now);
  },

  // ── Stats ──
  incrementStat(guildId, key) {
    const today = new Date().toISOString().split('T')[0];
    db.prepare(`
      INSERT INTO guild_stats (guild_id, date, ${key}) VALUES (?, ?, 1)
      ON CONFLICT(guild_id, date) DO UPDATE SET ${key} = ${key} + 1
    `).run(guildId, today);
  },

  getWeeklyStats(guildId) {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const from = d.toISOString().split('T')[0];
    const rows = db.prepare('SELECT * FROM guild_stats WHERE guild_id = ? AND date >= ? ORDER BY date').all(guildId, from);
    return rows.reduce((acc, r) => {
      acc.total_messages  = (acc.total_messages  || 0) + (r.total_messages  || 0);
      acc.joined_members  = (acc.joined_members  || 0) + (r.joined_members  || 0);
      acc.left_members    = (acc.left_members    || 0) + (r.left_members    || 0);
      acc.commands_used   = (acc.commands_used   || 0) + (r.commands_used   || 0);
      return acc;
    }, {});
  },

  // ── Level Roles ──
  getLevelRoles(guildId) {
    return db.prepare('SELECT * FROM level_roles WHERE guild_id = ? ORDER BY level ASC').all(guildId);
  },

  checkAndAssignLevelRoles(member, level) {
    const roles = db.prepare('SELECT * FROM level_roles WHERE guild_id = ? AND level <= ? ORDER BY level DESC').all(member.guild.id, level);
    for (const lr of roles) {
      const role = member.guild.roles.cache.get(lr.role_id);
      if (role && !member.roles.cache.has(lr.role_id)) {
        member.roles.add(role).catch(() => {});
      }
    }
  },

  // ── AFK ──
  getAfk(guildId, userId) {
    return db.prepare('SELECT * FROM afk WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
  },

  setAfk(guildId, userId, reason = 'AFK') {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`INSERT INTO afk (guild_id, user_id, reason, created_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(guild_id, user_id) DO UPDATE SET reason = ?, created_at = ?`)
      .run(guildId, userId, reason, now, reason, now);
  },

  removeAfk(guildId, userId) {
    db.prepare('DELETE FROM afk WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
  },

  // ── Mariage ──
  getMarriage(guildId, userId) {
    return db.prepare('SELECT * FROM marriages WHERE guild_id = ? AND (user1_id = ? OR user2_id = ?)').get(guildId, userId, userId);
  },

  // ── Premium ──
  isPremium(guildId) {
    const row = db.prepare('SELECT * FROM premium_servers WHERE guild_id = ?').get(guildId);
    if (!row) return false;
    if (!row.expires_at) return true; // permanent
    return row.expires_at > Math.floor(Date.now() / 1000);
  },

  getPremium(guildId) {
    return db.prepare('SELECT * FROM premium_servers WHERE guild_id = ?').get(guildId);
  },

  activatePremium(guildId, activatedBy, code, durationDays) {
    const now = Math.floor(Date.now() / 1000);
    const expires = durationDays > 0 ? now + durationDays * 86400 : null;
    db.prepare(`
      INSERT INTO premium_servers (guild_id, activated_by, code, expires_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET
        activated_by = excluded.activated_by,
        code = excluded.code,
        expires_at = CASE WHEN premium_servers.expires_at IS NULL THEN excluded.expires_at
                          ELSE MAX(premium_servers.expires_at, strftime('%s','now')) + ? * 86400 END,
        activated_at = strftime('%s','now')
    `).run(guildId, activatedBy, code, expires, durationDays);
  },

  validatePremiumCode(code) {
    return db.prepare('SELECT * FROM premium_codes WHERE code = ? AND used = 0').get(code);
  },

  usePremiumCode(code, usedBy) {
    db.prepare('UPDATE premium_codes SET used = 1, used_by = ?, used_at = strftime(\'%s\',\'now\') WHERE code = ?').run(usedBy, code);
  },

  createPremiumCode(code, plan, durationDays) {
    db.prepare('INSERT INTO premium_codes (code, plan, duration_days) VALUES (?, ?, ?)').run(code, plan, durationDays);
  },

  // ── Invites ──
  getInviteStats(guildId, userId) {
    let row = db.prepare('SELECT * FROM invite_stats WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
    if (!row) {
      db.prepare('INSERT OR IGNORE INTO invite_stats (guild_id, user_id) VALUES (?, ?)').run(guildId, userId);
      row = db.prepare('SELECT * FROM invite_stats WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
    }
    return row;
  },

  getInviteLeaderboard(guildId, limit = 10) {
    return db.prepare('SELECT *, (total - left - fake + bonus) AS effective FROM invite_stats WHERE guild_id = ? ORDER BY effective DESC LIMIT ?').all(guildId, limit);
  },

  // ── Commandes perso ──
  getCustomCommand(guildId, trigger) {
    return db.prepare('SELECT * FROM custom_commands WHERE guild_id = ? AND LOWER(trigger) = LOWER(?)').get(guildId, trigger);
  },

  getCustomCommands(guildId) {
    return db.prepare('SELECT * FROM custom_commands WHERE guild_id = ?').all(guildId);
  },
};

module.exports = helpers;
