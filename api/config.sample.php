<?php
/**
 * Copy this file to config.php (same folder) and fill it in.
 * config.php holds secrets: never share it or commit it anywhere public.
 */
return [
    // hPanel → Databases → MySQL Databases: the database, its user and password
    'db_host' => 'localhost',
    'db_name' => 'u123456789_neolatino',
    'db_user' => 'u123456789_neolatino',
    'db_password' => 'CHANGE-ME',
    // tables get this prefix, so the database can be shared with other apps
    'table_prefix' => 'nl_',

    // a long random string that signs the login sessions (64+ characters).
    // Make one at https://www.random.org/strings/ or with: openssl rand -hex 32
    // Changing it later signs everybody out.
    'auth_secret' => 'CHANGE-ME-TO-A-LONG-RANDOM-STRING',

    // Telegram: the bot from @BotFather. Username without @, and its token.
    // In BotFather: /setdomain → choose the bot → gleb.onl
    'telegram_bot_username' => '',
    'telegram_bot_token' => '',

    // Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application)
    // Authorized JavaScript origins: https://gleb.onl
    'google_client_id' => '',

    // true shows error details in API answers (only while setting up)
    'debug' => false,
];
