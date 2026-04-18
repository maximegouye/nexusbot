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

  -- Commandes personnalisées (texte OU embed JSON)
  CREATE TABLE IF NOT EXISTS custom_commands (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id         TEXT NOT NULL,
    trigger          TEXT NOT NULL,
    response         TEXT NOT NULL,
    response_type    TEXT DEFAULT 'text',     -- 'text' | 'embed' | 'reaction'
    embed_json       TEXT,                     -- JSON de l'embed si response_type='embed'
    cooldown         INTEGER DEFAULT 0,        -- cooldown en secondes, 0 = aucun
    required_role    TEXT,                     -- rôle requis (optionnel)
    required_perm    TEXT,                     -- permission Discord requise (optionnel)
    allowed_channels TEXT DEFAULT '[]',        -- JSON array de channel IDs (vide = tous)
    enabled          INTEGER DEFAULT 1,
    uses             INTEGER DEFAULT 0,
    delete_trigger   INTEGER DEFAULT 0,        -- supprimer le message déclencheur
    created_by       TEXT NOT NULL,
    updated_at       INTEGER DEFAULT (strftime('%s','now')),
    created_at       INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, trigger)
  );

  -- Aliases de commandes (&r → &role etc.)
  CREATE TABLE IF NOT EXISTS command_aliases (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id   TEXT NOT NULL,
    alias      TEXT NOT NULL,
    target     TEXT NOT NULL,
    created_by TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, alias)
  );

  -- Overrides de cooldown par commande (per-guild)
  CREATE TABLE IF NOT EXISTS cooldown_overrides (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id   TEXT NOT NULL,
    command    TEXT NOT NULL,
    seconds    INTEGER NOT NULL,
    updated_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, command)
  );

  -- Overrides d'activation par commande (activer/désactiver individuellement)
  CREATE TABLE IF NOT EXISTS command_toggles (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id   TEXT NOT NULL,
    command    TEXT NOT NULL,
    enabled    INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, command)
  );

  -- Templates d'embeds réutilisables (éditeur visuel)
  CREATE TABLE IF NOT EXISTS embed_templates (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id   TEXT NOT NULL,
    name       TEXT NOT NULL,
    data_json  TEXT NOT NULL,
    created_by TEXT,
    updated_at INTEGER DEFAULT (strftime('%s','now')),
    created_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, name)
  );

  -- Messages système configurables (welcome, leave, levelup, boost, etc.)
  CREATE TABLE IF NOT EXISTS system_messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id   TEXT NOT NULL,
    event      TEXT NOT NULL,
    enabled    INTEGER DEFAULT 1,
    mode       TEXT DEFAULT 'text',       -- 'text' | 'embed' | 'both'
    content    TEXT,
    embed_json TEXT,
    channel_id TEXT,
    updated_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, event)
  );

  -- Store clé/valeur libre pour TOUT paramètre futur (évite les migrations)
  CREATE TABLE IF NOT EXISTS guild_kv (
    guild_id   TEXT NOT NULL,
    key        TEXT NOT NULL,
    value      TEXT,
    updated_at INTEGER DEFAULT (strftime('%s','now')),
    PRIMARY KEY (guild_id, key)
  );

  -- Portefeuille crypto par utilisateur
  CREATE TABLE IF NOT EXISTS crypto_wallet (
    user_id    TEXT NOT NULL,
    guild_id   TEXT NOT NULL,
    crypto     TEXT NOT NULL,
    amount     REAL DEFAULT 0,
    avg_buy    REAL DEFAULT 0,
    updated_at INTEGER DEFAULT (strftime('%s','now')),
    PRIMARY KEY (user_id, guild_id, crypto)
  );

  -- Marché crypto (prix courants + tendance)
  CREATE TABLE IF NOT EXISTS crypto_market (
    symbol     TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    emoji      TEXT DEFAULT '🪙',
    price      REAL NOT NULL,
    prev_price REAL NOT NULL,
    volatility REAL DEFAULT 0.02,
    updated_at INTEGER DEFAULT (strftime('%s','now'))
  );

  -- Statistiques de jeux par user
  CREATE TABLE IF NOT EXISTS game_stats (
    user_id    TEXT NOT NULL,
    guild_id   TEXT NOT NULL,
    game       TEXT NOT NULL,
    played     INTEGER DEFAULT 0,
    won        INTEGER DEFAULT 0,
    lost       INTEGER DEFAULT 0,
    total_bet  INTEGER DEFAULT 0,
    total_won  INTEGER DEFAULT 0,
    biggest_win INTEGER DEFAULT 0,
    biggest_loss INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, guild_id, game)
  );

  -- Sessions de jeux persistées (blackjack, etc.)
  -- Survivent aux redémarrages Railway
  CREATE TABLE IF NOT EXISTS game_sessions (
    message_id TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    guild_id   TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    game       TEXT NOT NULL,    -- 'blackjack' | ...
    state_json TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    expires_at INTEGER NOT NULL
  );

  -- Sessions transitoires (éditeur d'embed en cours, etc.)
  CREATE TABLE IF NOT EXISTS edit_sessions (
    session_id TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    guild_id   TEXT NOT NULL,
    type       TEXT NOT NULL,
    data_json  TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );

  -- Messages programmés (cron)
  CREATE TABLE IF NOT EXISTS scheduled_messages (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id     TEXT NOT NULL,
    channel_id   TEXT NOT NULL,
    cron         TEXT NOT NULL,       -- ex: '0 9 * * *' = tous les jours 9h
    content      TEXT,
    embed_json   TEXT,                -- alternative: embed
    enabled      INTEGER DEFAULT 1,
    last_sent_at INTEGER DEFAULT 0,
    created_by   TEXT,
    created_at   INTEGER DEFAULT (strftime('%s','now'))
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
  // custom_commands — nouvelles colonnes v3 (rendu riche)
  { table: 'custom_commands', column: 'response_type',    sql: "ALTER TABLE custom_commands ADD COLUMN response_type TEXT DEFAULT 'text'" },
  { table: 'custom_commands', column: 'embed_json',       sql: "ALTER TABLE custom_commands ADD COLUMN embed_json TEXT" },
  { table: 'custom_commands', column: 'cooldown',         sql: "ALTER TABLE custom_commands ADD COLUMN cooldown INTEGER DEFAULT 0" },
  { table: 'custom_commands', column: 'required_role',    sql: "ALTER TABLE custom_commands ADD COLUMN required_role TEXT" },
  { table: 'custom_commands', column: 'required_perm',    sql: "ALTER TABLE custom_commands ADD COLUMN required_perm TEXT" },
  { table: 'custom_commands', column: 'allowed_channels', sql: "ALTER TABLE custom_commands ADD COLUMN allowed_channels TEXT DEFAULT '[]'" },
  { table: 'custom_commands', column: 'enabled',          sql: "ALTER TABLE custom_commands ADD COLUMN enabled INTEGER DEFAULT 1" },
  { table: 'custom_commands', column: 'uses',             sql: "ALTER TABLE custom_commands ADD COLUMN uses INTEGER DEFAULT 0" },
  { table: 'custom_commands', column: 'delete_trigger',   sql: "ALTER TABLE custom_commands ADD COLUMN delete_trigger INTEGER DEFAULT 0" },
  { table: 'custom_commands', column: 'updated_at',       sql: "ALTER TABLE custom_commands ADD COLUMN updated_at INTEGER DEFAULT 0" },
  // ── guild_config — mode EXPERT : toutes les limites configurables ──
  // Économie avancée
  { table: 'guild_config', column: 'work_min',              sql: "ALTER TABLE guild_config ADD COLUMN work_min INTEGER DEFAULT 10" },
  { table: 'guild_config', column: 'work_max',              sql: "ALTER TABLE guild_config ADD COLUMN work_max INTEGER DEFAULT 100" },
  { table: 'guild_config', column: 'work_cooldown',         sql: "ALTER TABLE guild_config ADD COLUMN work_cooldown INTEGER DEFAULT 3600" },
  { table: 'guild_config', column: 'crime_min',             sql: "ALTER TABLE guild_config ADD COLUMN crime_min INTEGER DEFAULT 50" },
  { table: 'guild_config', column: 'crime_max',             sql: "ALTER TABLE guild_config ADD COLUMN crime_max INTEGER DEFAULT 500" },
  { table: 'guild_config', column: 'crime_cooldown',        sql: "ALTER TABLE guild_config ADD COLUMN crime_cooldown INTEGER DEFAULT 7200" },
  { table: 'guild_config', column: 'crime_fail_rate',       sql: "ALTER TABLE guild_config ADD COLUMN crime_fail_rate INTEGER DEFAULT 40" },
  { table: 'guild_config', column: 'rob_max_percent',       sql: "ALTER TABLE guild_config ADD COLUMN rob_max_percent INTEGER DEFAULT 30" },
  { table: 'guild_config', column: 'rob_fail_penalty',      sql: "ALTER TABLE guild_config ADD COLUMN rob_fail_penalty INTEGER DEFAULT 100" },
  { table: 'guild_config', column: 'rob_cooldown',          sql: "ALTER TABLE guild_config ADD COLUMN rob_cooldown INTEGER DEFAULT 14400" },
  { table: 'guild_config', column: 'daily_cooldown',        sql: "ALTER TABLE guild_config ADD COLUMN daily_cooldown INTEGER DEFAULT 86400" },
  { table: 'guild_config', column: 'daily_streak_bonus',    sql: "ALTER TABLE guild_config ADD COLUMN daily_streak_bonus INTEGER DEFAULT 10" },
  { table: 'guild_config', column: 'bank_interest_rate',    sql: "ALTER TABLE guild_config ADD COLUMN bank_interest_rate INTEGER DEFAULT 0" },
  { table: 'guild_config', column: 'bank_max_deposit',      sql: "ALTER TABLE guild_config ADD COLUMN bank_max_deposit INTEGER DEFAULT -1" },
  { table: 'guild_config', column: 'shop_tax_rate',         sql: "ALTER TABLE guild_config ADD COLUMN shop_tax_rate INTEGER DEFAULT 0" },
  // XP avancé
  { table: 'guild_config', column: 'xp_cooldown_ms',        sql: "ALTER TABLE guild_config ADD COLUMN xp_cooldown_ms INTEGER DEFAULT 60000" },
  { table: 'guild_config', column: 'xp_voice_rate',         sql: "ALTER TABLE guild_config ADD COLUMN xp_voice_rate INTEGER DEFAULT 5" },
  { table: 'guild_config', column: 'xp_voice_enabled',      sql: "ALTER TABLE guild_config ADD COLUMN xp_voice_enabled INTEGER DEFAULT 1" },
  { table: 'guild_config', column: 'xp_weekend_bonus',      sql: "ALTER TABLE guild_config ADD COLUMN xp_weekend_bonus INTEGER DEFAULT 0" },
  { table: 'guild_config', column: 'xp_stack_roles',        sql: "ALTER TABLE guild_config ADD COLUMN xp_stack_roles INTEGER DEFAULT 1" },
  { table: 'guild_config', column: 'xp_min_level_msg',      sql: "ALTER TABLE guild_config ADD COLUMN xp_min_level_msg INTEGER DEFAULT 1" },
  // Modération avancée
  { table: 'guild_config', column: 'auto_escalate_warns',   sql: "ALTER TABLE guild_config ADD COLUMN auto_escalate_warns INTEGER DEFAULT 0" },
  { table: 'guild_config', column: 'escalate_mute_count',   sql: "ALTER TABLE guild_config ADD COLUMN escalate_mute_count INTEGER DEFAULT 3" },
  { table: 'guild_config', column: 'escalate_kick_count',   sql: "ALTER TABLE guild_config ADD COLUMN escalate_kick_count INTEGER DEFAULT 5" },
  { table: 'guild_config', column: 'escalate_ban_count',    sql: "ALTER TABLE guild_config ADD COLUMN escalate_ban_count INTEGER DEFAULT 10" },
  { table: 'guild_config', column: 'default_mute_duration', sql: "ALTER TABLE guild_config ADD COLUMN default_mute_duration INTEGER DEFAULT 3600" },
  { table: 'guild_config', column: 'warn_expire_days',      sql: "ALTER TABLE guild_config ADD COLUMN warn_expire_days INTEGER DEFAULT 30" },
  // Logs granulaires (toggles par event)
  { table: 'guild_config', column: 'log_message_delete',    sql: "ALTER TABLE guild_config ADD COLUMN log_message_delete INTEGER DEFAULT 1" },
  { table: 'guild_config', column: 'log_message_edit',      sql: "ALTER TABLE guild_config ADD COLUMN log_message_edit INTEGER DEFAULT 1" },
  { table: 'guild_config', column: 'log_member_join',       sql: "ALTER TABLE guild_config ADD COLUMN log_member_join INTEGER DEFAULT 1" },
  { table: 'guild_config', column: 'log_member_leave',      sql: "ALTER TABLE guild_config ADD COLUMN log_member_leave INTEGER DEFAULT 1" },
  { table: 'guild_config', column: 'log_role_changes',      sql: "ALTER TABLE guild_config ADD COLUMN log_role_changes INTEGER DEFAULT 1" },
  { table: 'guild_config', column: 'log_voice',             sql: "ALTER TABLE guild_config ADD COLUMN log_voice INTEGER DEFAULT 0" },
  { table: 'guild_config', column: 'log_channel_changes',   sql: "ALTER TABLE guild_config ADD COLUMN log_channel_changes INTEGER DEFAULT 1" },
  { table: 'guild_config', column: 'log_bans',              sql: "ALTER TABLE guild_config ADD COLUMN log_bans INTEGER DEFAULT 1" },

  // autoresponder — enrichissement v3
  { table: 'autoresponder', column: 'enabled',          sql: "ALTER TABLE autoresponder ADD COLUMN enabled INTEGER DEFAULT 1" },
  { table: 'autoresponder', column: 'required_role',    sql: "ALTER TABLE autoresponder ADD COLUMN required_role TEXT" },
  { table: 'autoresponder', column: 'allowed_channels', sql: "ALTER TABLE autoresponder ADD COLUMN allowed_channels TEXT DEFAULT '[]'" },
  { table: 'autoresponder', column: 'response_type',    sql: "ALTER TABLE autoresponder ADD COLUMN response_type TEXT DEFAULT 'text'" },
  { table: 'autoresponder', column: 'embed_json',       sql: "ALTER TABLE autoresponder ADD COLUMN embed_json TEXT" },
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

  // ── Commandes perso — CRUD avancé (texte, embed, cooldowns, rôles, salons) ──
  upsertCustomCommand(guildId, trigger, data) {
    // data: { response, response_type, embed_json, cooldown, required_role,
    //         required_perm, allowed_channels, enabled, delete_trigger, created_by }
    const now = Math.floor(Date.now() / 1000);
    const t   = String(trigger).toLowerCase().trim().replace(/^&+/, '');
    db.prepare(`
      INSERT INTO custom_commands
        (guild_id, trigger, response, response_type, embed_json, cooldown,
         required_role, required_perm, allowed_channels, enabled, delete_trigger,
         created_by, updated_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(guild_id, trigger) DO UPDATE SET
        response         = excluded.response,
        response_type    = excluded.response_type,
        embed_json       = excluded.embed_json,
        cooldown         = excluded.cooldown,
        required_role    = excluded.required_role,
        required_perm    = excluded.required_perm,
        allowed_channels = excluded.allowed_channels,
        enabled          = excluded.enabled,
        delete_trigger   = excluded.delete_trigger,
        updated_at       = excluded.updated_at
    `).run(
      guildId, t,
      data.response ?? '',
      data.response_type ?? 'text',
      data.embed_json ?? null,
      data.cooldown ?? 0,
      data.required_role ?? null,
      data.required_perm ?? null,
      JSON.stringify(data.allowed_channels ?? []),
      data.enabled === 0 ? 0 : 1,
      data.delete_trigger ? 1 : 0,
      data.created_by ?? '0',
      now, now,
    );
    return helpers.getCustomCommand(guildId, t);
  },

  deleteCustomCommand(guildId, trigger) {
    const t = String(trigger).toLowerCase().trim().replace(/^&+/, '');
    return db.prepare('DELETE FROM custom_commands WHERE guild_id = ? AND LOWER(trigger) = LOWER(?)').run(guildId, t).changes;
  },

  incrementCustomCommandUses(guildId, trigger) {
    try {
      db.prepare('UPDATE custom_commands SET uses = uses + 1 WHERE guild_id = ? AND LOWER(trigger) = LOWER(?)').run(guildId, trigger);
    } catch {}
  },

  // ── Aliases ──
  getAlias(guildId, alias) {
    return db.prepare('SELECT * FROM command_aliases WHERE guild_id = ? AND LOWER(alias) = LOWER(?)').get(guildId, alias);
  },

  getAliases(guildId) {
    return db.prepare('SELECT * FROM command_aliases WHERE guild_id = ?').all(guildId);
  },

  setAlias(guildId, alias, target, createdBy) {
    db.prepare(`
      INSERT INTO command_aliases (guild_id, alias, target, created_by)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(guild_id, alias) DO UPDATE SET target = excluded.target
    `).run(guildId, String(alias).toLowerCase(), String(target).toLowerCase(), createdBy ?? '0');
  },

  deleteAlias(guildId, alias) {
    return db.prepare('DELETE FROM command_aliases WHERE guild_id = ? AND LOWER(alias) = LOWER(?)').run(guildId, alias).changes;
  },

  // ── Cooldown overrides ──
  getCooldownOverride(guildId, command) {
    const row = db.prepare('SELECT seconds FROM cooldown_overrides WHERE guild_id = ? AND command = ?').get(guildId, command);
    return row ? row.seconds : null;
  },

  getCooldownOverrides(guildId) {
    return db.prepare('SELECT * FROM cooldown_overrides WHERE guild_id = ?').all(guildId);
  },

  setCooldownOverride(guildId, command, seconds) {
    db.prepare(`
      INSERT INTO cooldown_overrides (guild_id, command, seconds, updated_at)
      VALUES (?, ?, ?, strftime('%s','now'))
      ON CONFLICT(guild_id, command) DO UPDATE SET seconds = excluded.seconds, updated_at = strftime('%s','now')
    `).run(guildId, command, Math.max(0, parseInt(seconds, 10) || 0));
  },

  removeCooldownOverride(guildId, command) {
    return db.prepare('DELETE FROM cooldown_overrides WHERE guild_id = ? AND command = ?').run(guildId, command).changes;
  },

  // ── Command toggles (activer/désactiver une commande) ──
  isCommandEnabled(guildId, command) {
    const row = db.prepare('SELECT enabled FROM command_toggles WHERE guild_id = ? AND command = ?').get(guildId, command);
    return row ? !!row.enabled : true; // activé par défaut
  },

  getCommandToggles(guildId) {
    return db.prepare('SELECT * FROM command_toggles WHERE guild_id = ?').all(guildId);
  },

  setCommandEnabled(guildId, command, enabled) {
    db.prepare(`
      INSERT INTO command_toggles (guild_id, command, enabled, updated_at)
      VALUES (?, ?, ?, strftime('%s','now'))
      ON CONFLICT(guild_id, command) DO UPDATE SET enabled = excluded.enabled, updated_at = strftime('%s','now')
    `).run(guildId, command, enabled ? 1 : 0);
  },

  // ── Embed templates ──
  getEmbedTemplate(guildId, name) {
    return db.prepare('SELECT * FROM embed_templates WHERE guild_id = ? AND LOWER(name) = LOWER(?)').get(guildId, name);
  },

  getEmbedTemplates(guildId) {
    return db.prepare('SELECT * FROM embed_templates WHERE guild_id = ? ORDER BY updated_at DESC').all(guildId);
  },

  upsertEmbedTemplate(guildId, name, data, createdBy) {
    const json = typeof data === 'string' ? data : JSON.stringify(data);
    db.prepare(`
      INSERT INTO embed_templates (guild_id, name, data_json, created_by, updated_at)
      VALUES (?, ?, ?, ?, strftime('%s','now'))
      ON CONFLICT(guild_id, name) DO UPDATE SET data_json = excluded.data_json, updated_at = strftime('%s','now')
    `).run(guildId, name, json, createdBy ?? '0');
    return helpers.getEmbedTemplate(guildId, name);
  },

  deleteEmbedTemplate(guildId, name) {
    return db.prepare('DELETE FROM embed_templates WHERE guild_id = ? AND LOWER(name) = LOWER(?)').run(guildId, name).changes;
  },

  // ── Messages système (welcome, leave, levelup, boost, daily, work, ...) ──
  getSystemMessage(guildId, event) {
    return db.prepare('SELECT * FROM system_messages WHERE guild_id = ? AND event = ?').get(guildId, event);
  },

  getSystemMessages(guildId) {
    return db.prepare('SELECT * FROM system_messages WHERE guild_id = ?').all(guildId);
  },

  upsertSystemMessage(guildId, event, data) {
    // data: { enabled, mode, content, embed_json, channel_id }
    db.prepare(`
      INSERT INTO system_messages (guild_id, event, enabled, mode, content, embed_json, channel_id, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s','now'))
      ON CONFLICT(guild_id, event) DO UPDATE SET
        enabled    = excluded.enabled,
        mode       = excluded.mode,
        content    = excluded.content,
        embed_json = excluded.embed_json,
        channel_id = excluded.channel_id,
        updated_at = strftime('%s','now')
    `).run(
      guildId, event,
      data.enabled === 0 ? 0 : 1,
      data.mode ?? 'text',
      data.content ?? null,
      typeof data.embed_json === 'string' ? data.embed_json : (data.embed_json ? JSON.stringify(data.embed_json) : null),
      data.channel_id ?? null,
    );
    return helpers.getSystemMessage(guildId, event);
  },

  // ── KV store libre ──
  kvGet(guildId, key, defaultValue = null) {
    const row = db.prepare('SELECT value FROM guild_kv WHERE guild_id = ? AND key = ?').get(guildId, key);
    if (!row) return defaultValue;
    try { return JSON.parse(row.value); } catch { return row.value; }
  },

  kvSet(guildId, key, value) {
    const v = typeof value === 'string' ? value : JSON.stringify(value);
    db.prepare(`
      INSERT INTO guild_kv (guild_id, key, value, updated_at)
      VALUES (?, ?, ?, strftime('%s','now'))
      ON CONFLICT(guild_id, key) DO UPDATE SET value = excluded.value, updated_at = strftime('%s','now')
    `).run(guildId, key, v);
  },

  kvDelete(guildId, key) {
    db.prepare('DELETE FROM guild_kv WHERE guild_id = ? AND key = ?').run(guildId, key);
  },

  kvList(guildId, prefix) {
    if (prefix) {
      return db.prepare('SELECT * FROM guild_kv WHERE guild_id = ? AND key LIKE ?').all(guildId, prefix + '%');
    }
    return db.prepare('SELECT * FROM guild_kv WHERE guild_id = ?').all(guildId);
  },

  // ── Autoresponder (triggers automatiques dans un message) ──
  getAutoresponders(guildId) {
    return db.prepare('SELECT * FROM autoresponder WHERE guild_id = ? ORDER BY id ASC').all(guildId);
  },

  getAutoresponder(guildId, trigger) {
    return db.prepare('SELECT * FROM autoresponder WHERE guild_id = ? AND LOWER(trigger) = LOWER(?)').get(guildId, trigger);
  },

  getAutoresponderById(guildId, id) {
    return db.prepare('SELECT * FROM autoresponder WHERE guild_id = ? AND id = ?').get(guildId, id);
  },

  upsertAutoresponder(guildId, trigger, data) {
    // data enrichi: response, exact_match, cooldown, enabled, required_role,
    //               allowed_channels[], response_type ('text'|'embed'), embed_json
    db.prepare(`
      INSERT INTO autoresponder
        (guild_id, trigger, response, exact_match, cooldown, enabled,
         required_role, allowed_channels, response_type, embed_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(guild_id, trigger) DO UPDATE SET
        response         = excluded.response,
        exact_match      = excluded.exact_match,
        cooldown         = excluded.cooldown,
        enabled          = excluded.enabled,
        required_role    = excluded.required_role,
        allowed_channels = excluded.allowed_channels,
        response_type    = excluded.response_type,
        embed_json       = excluded.embed_json
    `).run(
      guildId, String(trigger).toLowerCase().trim(),
      data.response ?? '',
      data.exact_match ? 1 : 0,
      Math.max(0, parseInt(data.cooldown, 10) || 0),
      data.enabled === 0 ? 0 : 1,
      data.required_role ?? null,
      JSON.stringify(data.allowed_channels ?? []),
      data.response_type ?? 'text',
      data.embed_json ?? null,
    );
    return helpers.getAutoresponder(guildId, trigger);
  },

  deleteAutoresponder(guildId, trigger) {
    return db.prepare('DELETE FROM autoresponder WHERE guild_id = ? AND LOWER(trigger) = LOWER(?)').run(guildId, trigger).changes;
  },

  deleteAutoresponderById(guildId, id) {
    return db.prepare('DELETE FROM autoresponder WHERE guild_id = ? AND id = ?').run(guildId, id).changes;
  },

  incrementAutoresponderUses(guildId, trigger) {
    try { db.prepare('UPDATE autoresponder SET uses = uses + 1 WHERE guild_id = ? AND LOWER(trigger) = LOWER(?)').run(guildId, trigger); } catch {}
  },

  // ── Shop / Boutique ──
  getShopItems(guildId) {
    return db.prepare('SELECT * FROM shop WHERE guild_id = ? ORDER BY id ASC').all(guildId);
  },

  getShopItem(guildId, id) {
    return db.prepare('SELECT * FROM shop WHERE guild_id = ? AND id = ?').get(guildId, id);
  },

  createShopItem(guildId, data) {
    const info = db.prepare(`
      INSERT INTO shop (guild_id, name, description, emoji, price, stock, role_id, duration_hours, max_per_user, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      guildId,
      data.name,
      data.description ?? null,
      data.emoji ?? '📦',
      Math.max(0, parseInt(data.price, 10) || 0),
      data.stock == null ? -1 : parseInt(data.stock, 10),
      data.role_id ?? null,
      data.duration_hours == null ? null : parseInt(data.duration_hours, 10),
      data.max_per_user == null ? null : parseInt(data.max_per_user, 10),
      data.active === 0 ? 0 : 1,
    );
    return helpers.getShopItem(guildId, info.lastInsertRowid);
  },

  updateShopItem(guildId, id, patch) {
    const fields = [];
    const values = [];
    for (const k of ['name', 'description', 'emoji', 'price', 'stock', 'role_id', 'duration_hours', 'max_per_user', 'active']) {
      if (patch[k] !== undefined) { fields.push(`${k} = ?`); values.push(patch[k]); }
    }
    if (!fields.length) return null;
    values.push(guildId, id);
    db.prepare(`UPDATE shop SET ${fields.join(', ')} WHERE guild_id = ? AND id = ?`).run(...values);
    return helpers.getShopItem(guildId, id);
  },

  deleteShopItem(guildId, id) {
    return db.prepare('DELETE FROM shop WHERE guild_id = ? AND id = ?').run(guildId, id).changes;
  },

  // ── Reaction roles ──
  getReactionRoles(guildId) {
    return db.prepare('SELECT * FROM reaction_roles WHERE guild_id = ?').all(guildId);
  },

  addReactionRole(guildId, messageId, channelId, emoji, roleId) {
    db.prepare(`INSERT OR REPLACE INTO reaction_roles (guild_id, message_id, channel_id, emoji, role_id) VALUES (?, ?, ?, ?, ?)`)
      .run(guildId, messageId, channelId, emoji, roleId);
  },

  removeReactionRole(guildId, id) {
    return db.prepare('DELETE FROM reaction_roles WHERE guild_id = ? AND id = ?').run(guildId, id).changes;
  },

  // ── Role menus (boutons de rôles) ──
  getRoleMenus(guildId) {
    return db.prepare('SELECT * FROM role_menus WHERE guild_id = ? ORDER BY id ASC').all(guildId);
  },

  createRoleMenu(guildId, data) {
    const info = db.prepare(`
      INSERT INTO role_menus (guild_id, channel_id, message_id, title, description, roles, max_choices, required_role)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      guildId,
      data.channel_id ?? null,
      data.message_id ?? null,
      data.title,
      data.description ?? null,
      JSON.stringify(data.roles ?? []),
      parseInt(data.max_choices, 10) || 0,
      data.required_role ?? null,
    );
    return db.prepare('SELECT * FROM role_menus WHERE id = ?').get(info.lastInsertRowid);
  },

  deleteRoleMenu(guildId, id) {
    return db.prepare('DELETE FROM role_menus WHERE guild_id = ? AND id = ?').run(guildId, id).changes;
  },

  // ── AntiRaid ──
  getAntiraidConfig(guildId) {
    let row = db.prepare('SELECT * FROM antiraid_config WHERE guild_id = ?').get(guildId);
    if (!row) {
      db.prepare('INSERT OR IGNORE INTO antiraid_config (guild_id) VALUES (?)').run(guildId);
      row = db.prepare('SELECT * FROM antiraid_config WHERE guild_id = ?').get(guildId);
    }
    return row;
  },

  setAntiraidField(guildId, key, value) {
    const allowed = ['enabled','join_threshold','join_window_secs','action','new_account_days','new_account_action','captcha_enabled','whitelist_roles'];
    if (!allowed.includes(key)) throw new Error('Champ antiraid inconnu: ' + key);
    helpers.getAntiraidConfig(guildId);
    db.prepare(`UPDATE antiraid_config SET ${key} = ? WHERE guild_id = ?`).run(value, guildId);
    return helpers.getAntiraidConfig(guildId);
  },

  // ── YouTube / Twitch subs ──
  getYoutubeSubs(guildId)  { return db.prepare('SELECT * FROM youtube_subs WHERE guild_id = ?').all(guildId); },
  addYoutubeSub(guildId, data) {
    const info = db.prepare(`INSERT OR IGNORE INTO youtube_subs (guild_id, channel_id, yt_channel_id, yt_channel_name, message, role_ping) VALUES (?,?,?,?,?,?)`)
      .run(guildId, data.channel_id, data.yt_channel_id, data.yt_channel_name ?? null, data.message ?? null, data.role_ping ?? null);
    return info.changes;
  },
  removeYoutubeSub(guildId, id) { return db.prepare('DELETE FROM youtube_subs WHERE guild_id = ? AND id = ?').run(guildId, id).changes; },

  getTwitchSubs(guildId)   { return db.prepare('SELECT * FROM twitch_subs WHERE guild_id = ?').all(guildId); },
  addTwitchSub(guildId, data) {
    const info = db.prepare(`INSERT OR IGNORE INTO twitch_subs (guild_id, channel_id, twitch_login, message, role_ping) VALUES (?,?,?,?,?)`)
      .run(guildId, data.channel_id, data.twitch_login, data.message ?? null, data.role_ping ?? null);
    return info.changes;
  },
  removeTwitchSub(guildId, id) { return db.prepare('DELETE FROM twitch_subs WHERE guild_id = ? AND id = ?').run(guildId, id).changes; },

  // ── Giveaways (read / cancel) ──
  listGiveaways(guildId) { return db.prepare('SELECT * FROM giveaways WHERE guild_id = ? ORDER BY ends_at DESC LIMIT 50').all(guildId); },
  endGiveaway(guildId, id) { return db.prepare(`UPDATE giveaways SET status = 'ended' WHERE guild_id = ? AND id = ?`).run(guildId, id).changes; },
  cancelGiveaway(guildId, id) { return db.prepare(`UPDATE giveaways SET status = 'cancelled' WHERE guild_id = ? AND id = ?`).run(guildId, id).changes; },

  // ── Quêtes ──
  listQuests(guildId) { return db.prepare('SELECT * FROM quests WHERE guild_id = ? ORDER BY id DESC').all(guildId); },
  createQuest(guildId, data) {
    const info = db.prepare(`INSERT INTO quests (guild_id, title, description, target, reward, ends_at) VALUES (?,?,?,?,?,?)`)
      .run(guildId, data.title, data.description, parseInt(data.target, 10) || 0, data.reward ?? '', data.ends_at ?? null);
    return db.prepare('SELECT * FROM quests WHERE id = ?').get(info.lastInsertRowid);
  },
  deleteQuest(guildId, id) { return db.prepare('DELETE FROM quests WHERE guild_id = ? AND id = ?').run(guildId, id).changes; },

  // ── Polls (listing) ──
  listPolls(guildId) { return db.prepare('SELECT * FROM polls WHERE guild_id = ? ORDER BY id DESC LIMIT 50').all(guildId); },
  endPoll(guildId, id) { return db.prepare('UPDATE polls SET ended = 1 WHERE guild_id = ? AND id = ?').run(guildId, id).changes; },

  // ── Messages programmés ──
  listScheduledMessages(guildId) { return db.prepare('SELECT * FROM scheduled_messages WHERE guild_id = ? ORDER BY id ASC').all(guildId); },
  createScheduledMessage(guildId, data) {
    const info = db.prepare(`INSERT INTO scheduled_messages (guild_id, channel_id, cron, content, embed_json, enabled, created_by) VALUES (?,?,?,?,?,?,?)`)
      .run(guildId, data.channel_id, data.cron, data.content ?? null, data.embed_json ?? null, data.enabled === 0 ? 0 : 1, data.created_by ?? '0');
    return db.prepare('SELECT * FROM scheduled_messages WHERE id = ?').get(info.lastInsertRowid);
  },
  toggleScheduledMessage(guildId, id) {
    const r = db.prepare('SELECT enabled FROM scheduled_messages WHERE guild_id = ? AND id = ?').get(guildId, id);
    if (!r) return 0;
    db.prepare('UPDATE scheduled_messages SET enabled = ? WHERE guild_id = ? AND id = ?').run(r.enabled ? 0 : 1, guildId, id);
    return 1;
  },
  deleteScheduledMessage(guildId, id) { return db.prepare('DELETE FROM scheduled_messages WHERE guild_id = ? AND id = ?').run(guildId, id).changes; },

  // ── Introspection guild_config : liste les colonnes + valeurs ──
  listGuildConfigColumns() {
    return db.prepare('PRAGMA table_info(guild_config)').all().map(c => ({ name: c.name, type: c.type, notnull: c.notnull }));
  },

  setGuildConfigColumn(guildId, column, value) {
    // Sécurité : whitelist stricte sur les colonnes existantes
    const cols = helpers.listGuildConfigColumns().map(c => c.name);
    if (!cols.includes(column)) throw new Error(`Colonne inconnue: ${column}`);
    if (column === 'guild_id') throw new Error('guild_id est read-only');
    helpers.getConfig(guildId); // ensure row
    db.prepare(`UPDATE guild_config SET ${column} = ? WHERE guild_id = ?`).run(value, guildId);
    return helpers.getConfig(guildId);
  },

  // ── Level roles (déjà getLevelRoles + checkAndAssignLevelRoles, on ajoute add/remove) ──
  addLevelRole(guildId, level, roleId) {
    db.prepare(`
      INSERT INTO level_roles (guild_id, level, role_id) VALUES (?, ?, ?)
      ON CONFLICT(guild_id, level) DO UPDATE SET role_id = excluded.role_id
    `).run(guildId, parseInt(level, 10), roleId);
  },

  removeLevelRole(guildId, level) {
    return db.prepare('DELETE FROM level_roles WHERE guild_id = ? AND level = ?').run(guildId, parseInt(level, 10)).changes;
  },

  // ── Export / Import complet de la config ──
  exportGuildConfig(guildId) {
    return {
      _meta:           { exported_at: Math.floor(Date.now() / 1000), guild_id: guildId, schema: 'nexus-v3' },
      guild_config:    db.prepare('SELECT * FROM guild_config WHERE guild_id = ?').get(guildId) || {},
      custom_commands: db.prepare('SELECT * FROM custom_commands WHERE guild_id = ?').all(guildId),
      command_aliases: db.prepare('SELECT * FROM command_aliases WHERE guild_id = ?').all(guildId),
      cooldown_overrides: db.prepare('SELECT * FROM cooldown_overrides WHERE guild_id = ?').all(guildId),
      command_toggles: db.prepare('SELECT * FROM command_toggles WHERE guild_id = ?').all(guildId),
      embed_templates: db.prepare('SELECT * FROM embed_templates WHERE guild_id = ?').all(guildId),
      system_messages: db.prepare('SELECT * FROM system_messages WHERE guild_id = ?').all(guildId),
      autoresponder:   db.prepare('SELECT * FROM autoresponder WHERE guild_id = ?').all(guildId),
      level_roles:     db.prepare('SELECT * FROM level_roles WHERE guild_id = ?').all(guildId),
      guild_kv:        db.prepare('SELECT * FROM guild_kv WHERE guild_id = ?').all(guildId),
    };
  },

  importGuildConfig(guildId, payload) {
    // payload: résultat de exportGuildConfig()
    // Écrase les tables listées. Ne supprime pas les données existantes, fait des upserts.
    const tx = db.transaction(() => {
      if (payload.guild_config && Object.keys(payload.guild_config).length) {
        const gc = { ...payload.guild_config };
        delete gc.guild_id; delete gc.created_at;
        helpers.getConfig(guildId); // ensure row
        for (const k of Object.keys(gc)) {
          try { db.prepare(`UPDATE guild_config SET ${k} = ? WHERE guild_id = ?`).run(gc[k], guildId); } catch {}
        }
      }
      const upsertAll = (rows, insertSQL) => {
        if (!Array.isArray(rows)) return;
        for (const r of rows) {
          try { db.prepare(insertSQL).run(r); } catch {}
        }
      };
      // Nettoyer puis réinsérer pour une import propre des listes
      for (const tbl of ['custom_commands','command_aliases','cooldown_overrides','command_toggles','embed_templates','system_messages','autoresponder','level_roles','guild_kv']) {
        if (payload[tbl]) db.prepare(`DELETE FROM ${tbl} WHERE guild_id = ?`).run(guildId);
      }
      // Ré-import brut : INSERT OR REPLACE pour chaque
      for (const r of (payload.custom_commands || [])) {
        try {
          db.prepare(`INSERT OR REPLACE INTO custom_commands (guild_id, trigger, response, response_type, embed_json, cooldown, required_role, required_perm, allowed_channels, enabled, uses, delete_trigger, created_by, updated_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
            .run(guildId, r.trigger, r.response, r.response_type ?? 'text', r.embed_json ?? null, r.cooldown ?? 0, r.required_role ?? null, r.required_perm ?? null, r.allowed_channels ?? '[]', r.enabled ?? 1, r.uses ?? 0, r.delete_trigger ?? 0, r.created_by ?? '0', r.updated_at ?? null, r.created_at ?? null);
        } catch {}
      }
      for (const r of (payload.command_aliases || [])) {
        try { db.prepare(`INSERT OR REPLACE INTO command_aliases (guild_id, alias, target, created_by, created_at) VALUES (?,?,?,?,?)`).run(guildId, r.alias, r.target, r.created_by ?? '0', r.created_at ?? null); } catch {}
      }
      for (const r of (payload.cooldown_overrides || [])) {
        try { db.prepare(`INSERT OR REPLACE INTO cooldown_overrides (guild_id, command, seconds, updated_at) VALUES (?,?,?,?)`).run(guildId, r.command, r.seconds, r.updated_at ?? null); } catch {}
      }
      for (const r of (payload.command_toggles || [])) {
        try { db.prepare(`INSERT OR REPLACE INTO command_toggles (guild_id, command, enabled, updated_at) VALUES (?,?,?,?)`).run(guildId, r.command, r.enabled, r.updated_at ?? null); } catch {}
      }
      for (const r of (payload.embed_templates || [])) {
        try { db.prepare(`INSERT OR REPLACE INTO embed_templates (guild_id, name, data_json, created_by, updated_at, created_at) VALUES (?,?,?,?,?,?)`).run(guildId, r.name, r.data_json, r.created_by ?? '0', r.updated_at ?? null, r.created_at ?? null); } catch {}
      }
      for (const r of (payload.system_messages || [])) {
        try { db.prepare(`INSERT OR REPLACE INTO system_messages (guild_id, event, enabled, mode, content, embed_json, channel_id, updated_at) VALUES (?,?,?,?,?,?,?,?)`).run(guildId, r.event, r.enabled ?? 1, r.mode ?? 'text', r.content ?? null, r.embed_json ?? null, r.channel_id ?? null, r.updated_at ?? null); } catch {}
      }
      for (const r of (payload.autoresponder || [])) {
        try { db.prepare(`INSERT OR REPLACE INTO autoresponder (guild_id, trigger, response, exact_match, cooldown, uses, created_at) VALUES (?,?,?,?,?,?,?)`).run(guildId, r.trigger, r.response, r.exact_match ?? 0, r.cooldown ?? 0, r.uses ?? 0, r.created_at ?? null); } catch {}
      }
      for (const r of (payload.level_roles || [])) {
        try { db.prepare(`INSERT OR REPLACE INTO level_roles (guild_id, level, role_id) VALUES (?,?,?)`).run(guildId, r.level, r.role_id); } catch {}
      }
      for (const r of (payload.guild_kv || [])) {
        try { db.prepare(`INSERT OR REPLACE INTO guild_kv (guild_id, key, value, updated_at) VALUES (?,?,?,?)`).run(guildId, r.key, r.value, r.updated_at ?? null); } catch {}
      }
    });
    tx();
  },

  // ── Crypto : marché + portefeuille ──
  seedCryptoMarket() {
    const seeds = [
      { symbol: 'BTC', name: 'Bitcoin',    emoji: '₿',  price: 65000, volatility: 0.02 },
      { symbol: 'ETH', name: 'Ethereum',   emoji: '♦️', price: 3500,  volatility: 0.025 },
      { symbol: 'SOL', name: 'Solana',     emoji: '☀️', price: 150,   volatility: 0.04 },
      { symbol: 'DOGE', name: 'Dogecoin',  emoji: '🐕', price: 0.15,  volatility: 0.06 },
      { symbol: 'NEX', name: 'NexusCoin',  emoji: '💎', price: 42,    volatility: 0.08 },
      { symbol: 'PEPE', name: 'Pepe',      emoji: '🐸', price: 0.00001, volatility: 0.12 },
    ];
    for (const s of seeds) {
      try {
        db.prepare(`INSERT OR IGNORE INTO crypto_market (symbol, name, emoji, price, prev_price, volatility)
                    VALUES (?, ?, ?, ?, ?, ?)`)
          .run(s.symbol, s.name, s.emoji, s.price, s.price, s.volatility);
      } catch {}
    }
  },

  getCryptoMarket() {
    return db.prepare('SELECT * FROM crypto_market ORDER BY price DESC').all();
  },

  getCryptoPrice(symbol) {
    return db.prepare('SELECT * FROM crypto_market WHERE symbol = ?').get(symbol.toUpperCase());
  },

  // Simulation de fluctuation — appelée par un worker cron
  tickCryptoPrices() {
    const rows = helpers.getCryptoMarket();
    const tx = db.transaction(() => {
      for (const r of rows) {
        const drift = (Math.random() - 0.5) * 2 * (r.volatility || 0.02);
        const newPrice = Math.max(0.0000001, r.price * (1 + drift));
        db.prepare(`UPDATE crypto_market SET prev_price = price, price = ?, updated_at = strftime('%s','now') WHERE symbol = ?`)
          .run(newPrice, r.symbol);
      }
    });
    tx();
  },

  getWallet(userId, guildId) {
    return db.prepare('SELECT * FROM crypto_wallet WHERE user_id = ? AND guild_id = ? AND amount > 0').all(userId, guildId);
  },

  getWalletItem(userId, guildId, symbol) {
    return db.prepare('SELECT * FROM crypto_wallet WHERE user_id = ? AND guild_id = ? AND crypto = ?').get(userId, guildId, symbol);
  },

  buyCrypto(userId, guildId, symbol, amountCoins) {
    const market = helpers.getCryptoPrice(symbol);
    if (!market) throw new Error('Crypto introuvable');
    const user = helpers.getUser(userId, guildId);
    if (user.balance < amountCoins) throw new Error('Solde insuffisant');
    const qty = amountCoins / market.price;
    const existing = helpers.getWalletItem(userId, guildId, symbol.toUpperCase());
    if (existing) {
      const totalQty = existing.amount + qty;
      const avgBuy = ((existing.avg_buy * existing.amount) + (market.price * qty)) / totalQty;
      db.prepare(`UPDATE crypto_wallet SET amount = ?, avg_buy = ?, updated_at = strftime('%s','now')
                  WHERE user_id = ? AND guild_id = ? AND crypto = ?`)
        .run(totalQty, avgBuy, userId, guildId, symbol.toUpperCase());
    } else {
      db.prepare(`INSERT INTO crypto_wallet (user_id, guild_id, crypto, amount, avg_buy) VALUES (?, ?, ?, ?, ?)`)
        .run(userId, guildId, symbol.toUpperCase(), qty, market.price);
    }
    helpers.removeCoins(userId, guildId, amountCoins);
    return { qty, price: market.price, symbol: market.symbol };
  },

  sellCrypto(userId, guildId, symbol, quantity) {
    const market = helpers.getCryptoPrice(symbol);
    if (!market) throw new Error('Crypto introuvable');
    const item = helpers.getWalletItem(userId, guildId, symbol.toUpperCase());
    if (!item || item.amount < quantity) throw new Error('Quantité insuffisante');
    const coins = Math.floor(quantity * market.price);
    const newQty = item.amount - quantity;
    if (newQty < 0.0000001) {
      db.prepare('DELETE FROM crypto_wallet WHERE user_id = ? AND guild_id = ? AND crypto = ?').run(userId, guildId, symbol.toUpperCase());
    } else {
      db.prepare(`UPDATE crypto_wallet SET amount = ?, updated_at = strftime('%s','now') WHERE user_id = ? AND guild_id = ? AND crypto = ?`)
        .run(newQty, userId, guildId, symbol.toUpperCase());
    }
    helpers.addCoins(userId, guildId, coins);
    return { coins, price: market.price, qtySold: quantity };
  },

  // ── Stats jeux ──
  addGameStat(userId, guildId, game, { won, bet, payout }) {
    helpers.ensureGameStatRow(userId, guildId, game);
    const w = won ? 1 : 0, l = won ? 0 : 1;
    const net = (payout || 0) - (bet || 0);
    db.prepare(`
      UPDATE game_stats SET
        played = played + 1,
        won = won + ?, lost = lost + ?,
        total_bet = total_bet + ?,
        total_won = total_won + ?,
        biggest_win = CASE WHEN ? > biggest_win THEN ? ELSE biggest_win END,
        biggest_loss = CASE WHEN ? > biggest_loss THEN ? ELSE biggest_loss END
      WHERE user_id = ? AND guild_id = ? AND game = ?
    `).run(w, l, bet || 0, payout || 0, net > 0 ? net : 0, net > 0 ? net : 0, net < 0 ? -net : 0, net < 0 ? -net : 0, userId, guildId, game);
  },

  ensureGameStatRow(userId, guildId, game) {
    db.prepare(`INSERT OR IGNORE INTO game_stats (user_id, guild_id, game) VALUES (?, ?, ?)`).run(userId, guildId, game);
  },

  getGameStats(userId, guildId) {
    return db.prepare('SELECT * FROM game_stats WHERE user_id = ? AND guild_id = ?').all(userId, guildId);
  },

  // ── Sessions de jeu persistées (survivent aux redémarrages) ──
  saveGameSession(messageId, userId, guildId, channelId, game, state, ttlSeconds = 1800) {
    const json = typeof state === 'string' ? state : JSON.stringify(state);
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    db.prepare(`INSERT OR REPLACE INTO game_sessions
                (message_id, user_id, guild_id, channel_id, game, state_json, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(messageId, userId, guildId, channelId, game, json, expiresAt);
  },

  getGameSession(messageId) {
    const row = db.prepare('SELECT * FROM game_sessions WHERE message_id = ?').get(messageId);
    if (!row) return null;
    if (row.expires_at < Math.floor(Date.now() / 1000)) {
      db.prepare('DELETE FROM game_sessions WHERE message_id = ?').run(messageId);
      return null;
    }
    try { row.state = JSON.parse(row.state_json); } catch { row.state = {}; }
    return row;
  },

  deleteGameSession(messageId) {
    db.prepare('DELETE FROM game_sessions WHERE message_id = ?').run(messageId);
  },

  cleanExpiredGameSessions() {
    db.prepare('DELETE FROM game_sessions WHERE expires_at < ?').run(Math.floor(Date.now() / 1000));
  },

  // ── Sessions d'édition (éditeur d'embed, etc.) ──
  createEditSession(userId, guildId, type, data, ttlSeconds = 1800) {
    const sessionId = `${userId}:${type}:${Date.now().toString(36)}`;
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    const json = typeof data === 'string' ? data : JSON.stringify(data);
    db.prepare(`INSERT OR REPLACE INTO edit_sessions (session_id, user_id, guild_id, type, data_json, expires_at)
                VALUES (?, ?, ?, ?, ?, ?)`).run(sessionId, userId, guildId, type, json, expiresAt);
    return sessionId;
  },

  getEditSession(sessionId) {
    const row = db.prepare('SELECT * FROM edit_sessions WHERE session_id = ?').get(sessionId);
    if (!row) return null;
    if (row.expires_at < Math.floor(Date.now() / 1000)) {
      db.prepare('DELETE FROM edit_sessions WHERE session_id = ?').run(sessionId);
      return null;
    }
    try { row.data = JSON.parse(row.data_json); } catch { row.data = {}; }
    return row;
  },

  updateEditSession(sessionId, data) {
    const json = typeof data === 'string' ? data : JSON.stringify(data);
    db.prepare('UPDATE edit_sessions SET data_json = ? WHERE session_id = ?').run(json, sessionId);
  },

  deleteEditSession(sessionId) {
    db.prepare('DELETE FROM edit_sessions WHERE session_id = ?').run(sessionId);
  },

  cleanExpiredEditSessions() {
    db.prepare('DELETE FROM edit_sessions WHERE expires_at < ?').run(Math.floor(Date.now() / 1000));
  },
};

module.exports = helpers;
