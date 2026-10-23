<?php
/**
 * Shared helpers for the Neolatino dictionary API:
 * configuration, database, schema, JSON responses, sessions.
 *
 * A PHP + MySQL port of the Interslavic hub's Vercel API (interslavic-api),
 * so both dictionaries behave the same. Requires PHP 8.0+ and MySQL 5.7+ /
 * MariaDB 10.3+ (Hostinger has both).
 */
declare(strict_types=1);

if (!defined('NL_API')) {
    http_response_code(404);
    exit;
}

const SCHEMA_VERSION = 1;
const SESSION_DAYS = 30;

/* ── configuration ─────────────────────────────────────────────── */

function cfg(string $key, $default = null)
{
    static $config = null;

    if ($config === null) {
        $file = __DIR__ . '/config.php';
        $config = is_file($file) ? require $file : [];
        $config = is_array($config) ? $config : [];
    }

    return $config[$key] ?? $default;
}

/* ── responses ─────────────────────────────────────────────────── */

function send_json($data, int $status = 200, string $cache = 'no-store'): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: ' . $cache);
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $message, int $status, array $extra = []): void
{
    send_json(['error' => $message] + $extra, $status);
}

/** The request body as an array (JSON), or [] when there is none. */
function body(): array
{
    static $parsed = null;

    if ($parsed === null) {
        $raw = file_get_contents('php://input') ?: '';
        $parsed = json_decode($raw, true);
        $parsed = is_array($parsed) ? $parsed : [];
    }

    return $parsed;
}

/** GET or POST, plus PUT / PATCH / DELETE sent as POST with ?m= (some hosts block those verbs). */
function method(): string
{
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $override = strtoupper((string) ($_GET['m'] ?? ''));

    if ($method === 'POST' && in_array($override, ['PUT', 'PATCH', 'DELETE'], true)) {
        return $override;
    }

    return $method;
}

/* ── database ──────────────────────────────────────────────────── */

function db(): PDO
{
    static $pdo = null;

    if ($pdo === null) {
        $dsn = cfg('db_dsn') ?: sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
            cfg('db_host', 'localhost'),
            (int) cfg('db_port', 3306),
            cfg('db_name', '')
        );

        try {
            $pdo = new PDO($dsn, (string) cfg('db_user', ''), (string) cfg('db_password', ''), [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        } catch (PDOException $e) {
            fail('the database is not reachable — check db_* in api/config.php', 503);
        }

        $pdo->exec("SET time_zone = '+00:00'");
        $pdo->exec('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
    }

    return $pdo;
}

/** Table name with the configured prefix (letters, digits and _ only). */
function t(string $name): string
{
    $prefix = (string) cfg('table_prefix', 'nl_');

    return (preg_match('/^[A-Za-z0-9_]*$/', $prefix) ? $prefix : 'nl_') . $name;
}

function q(string $sql, array $params = []): PDOStatement
{
    $statement = db()->prepare($sql);
    $statement->execute($params);

    return $statement;
}

function rows(string $sql, array $params = []): array
{
    return q($sql, $params)->fetchAll();
}

function row(string $sql, array $params = []): ?array
{
    $found = q($sql, $params)->fetch();

    return $found === false ? null : $found;
}

/** Placeholders "?, ?, ?" for a list. */
function marks(array $list): string
{
    return implode(', ', array_fill(0, max(1, count($list)), '?'));
}

/** MySQL DATETIME (UTC) → ISO 8601 with Z, or null. */
function iso(?string $value): ?string
{
    if (!$value) {
        return null;
    }

    $date = DateTime::createFromFormat('Y-m-d H:i:s.u', $value, new DateTimeZone('UTC'))
        ?: DateTime::createFromFormat('Y-m-d H:i:s', $value, new DateTimeZone('UTC'));

    return $date ? $date->format('Y-m-d\TH:i:s.v\Z') : null;
}

/**
 * Tables are created on first use and upgraded when SCHEMA_VERSION grows
 * (the hub's ensureSchema() idea, but checked with one cheap query).
 */
function ensure_schema(): void
{
    try {
        $current = (int) (row('SELECT v FROM ' . t('meta') . " WHERE k = 'schema'")['v'] ?? 0);
    } catch (PDOException $e) {
        $current = 0;
    }

    if ($current >= SCHEMA_VERSION) {
        return;
    }

    $engine = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    $users = t('users');
    $comments = t('comments');

    $statements = [
        'CREATE TABLE IF NOT EXISTS ' . t('meta') . " (
            k VARCHAR(32) PRIMARY KEY,
            v VARCHAR(255) NOT NULL
        ) $engine",
        "CREATE TABLE IF NOT EXISTS $users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            provider VARCHAR(16) NOT NULL,
            provider_id VARCHAR(64) NOT NULL,
            email VARCHAR(255) NULL,
            name VARCHAR(200) NOT NULL,
            created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            UNIQUE KEY provider_user (provider, provider_id)
        ) $engine",
        // starred words ("Preferitos"), public on the profile
        'CREATE TABLE IF NOT EXISTS ' . t('favourites') . " (
            user_id INT NOT NULL,
            word_id VARCHAR(16) NOT NULL,
            word VARCHAR(200) NOT NULL,
            added_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            PRIMARY KEY (user_id, word_id),
            FOREIGN KEY (user_id) REFERENCES $users(id) ON DELETE CASCADE
        ) $engine",
        // the signed-in user's own searches (private, capped at 1000)
        'CREATE TABLE IF NOT EXISTS ' . t('history') . " (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            word_id VARCHAR(16) NOT NULL,
            word VARCHAR(200) NOT NULL,
            translation VARCHAR(300) NULL,
            lang VARCHAR(12) NULL,
            created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            KEY user_time (user_id, created_at),
            FOREIGN KEY (user_id) REFERENCES $users(id) ON DELETE CASCADE
        ) $engine",
        // native Romance language + other Romance / non-Romance languages with a CEFR level
        'CREATE TABLE IF NOT EXISTS ' . t('language_profiles') . " (
            user_id INT PRIMARY KEY,
            native VARCHAR(12) NOT NULL,
            others TEXT NOT NULL,
            foreign_langs TEXT NOT NULL,
            updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            FOREIGN KEY (user_id) REFERENCES $users(id) ON DELETE CASCADE
        ) $engine",
        // one intelligibility vote per user and word; `native` mirrors the voter's profile
        'CREATE TABLE IF NOT EXISTS ' . t('votes') . " (
            user_id INT NOT NULL,
            word_id VARCHAR(16) NOT NULL,
            word VARCHAR(200) NOT NULL,
            vote VARCHAR(16) NOT NULL,
            native VARCHAR(12) NOT NULL,
            created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            PRIMARY KEY (user_id, word_id),
            KEY word (word_id),
            KEY time (updated_at),
            KEY user_time (user_id, updated_at),
            FOREIGN KEY (user_id) REFERENCES $users(id) ON DELETE CASCADE
        ) $engine",
        "CREATE TABLE IF NOT EXISTS $comments (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            word_id VARCHAR(16) NOT NULL,
            word VARCHAR(200) NOT NULL,
            user_id INT NOT NULL,
            body TEXT NOT NULL,
            created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            edited_at DATETIME(6) NULL,
            KEY word_time (word_id, created_at),
            KEY user_time (user_id, created_at),
            FOREIGN KEY (user_id) REFERENCES $users(id) ON DELETE CASCADE
        ) $engine",
        // ▲ / ▼ on comments, one per user and comment
        'CREATE TABLE IF NOT EXISTS ' . t('comment_votes') . " (
            comment_id BIGINT NOT NULL,
            user_id INT NOT NULL,
            value TINYINT NOT NULL,
            created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            PRIMARY KEY (comment_id, user_id),
            FOREIGN KEY (comment_id) REFERENCES $comments(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES $users(id) ON DELETE CASCADE
        ) $engine",
        // bio (≤ 300 characters), profile links, avatar (base64, ≤ 200 KB)
        'CREATE TABLE IF NOT EXISTS ' . t('profiles') . " (
            user_id INT PRIMARY KEY,
            bio TEXT NOT NULL,
            links TEXT NOT NULL,
            avatar_data MEDIUMTEXT NULL,
            avatar_type VARCHAR(16) NULL,
            avatar_at DATETIME(6) NULL,
            updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            FOREIGN KEY (user_id) REFERENCES $users(id) ON DELETE CASCADE
        ) $engine",
        // every counted lookup (kept 90 days; `visitor` is a daily-changing hash, no names) …
        'CREATE TABLE IF NOT EXISTS ' . t('lookups') . " (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            word_id VARCHAR(16) NOT NULL,
            visitor VARCHAR(32) NOT NULL,
            created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            KEY time (created_at),
            KEY visitor_time (visitor, created_at)
        ) $engine",
        // … and the running total per word
        'CREATE TABLE IF NOT EXISTS ' . t('word_stats') . " (
            word_id VARCHAR(16) PRIMARY KEY,
            word VARCHAR(200) NOT NULL,
            lookups INT NOT NULL DEFAULT 0,
            last_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            KEY top (lookups),
            KEY last (last_at)
        ) $engine",
    ];

    foreach ($statements as $sql) {
        db()->exec($sql);
    }

    q('INSERT INTO ' . t('meta') . " (k, v) VALUES ('schema', ?) ON DUPLICATE KEY UPDATE v = VALUES(v)",
        [(string) SCHEMA_VERSION]);
}

/* ── sessions: HMAC-signed stateless tokens (same scheme as the hub) ── */

function b64url(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function b64url_decode(string $data)
{
    return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', (4 - strlen($data) % 4) % 4), true);
}

function auth_secret(): string
{
    $secret = (string) cfg('auth_secret', '');

    if (strlen($secret) < 32 || str_contains($secret, 'CHANGE')) {
        fail('auth_secret is not configured in api/config.php', 500);
    }

    return $secret;
}

function make_token(array $user): string
{
    $payload = b64url(json_encode([
        'uid' => (int) $user['id'],
        'name' => $user['name'],
        'provider' => $user['provider'],
        'exp' => time() + SESSION_DAYS * 86400,
    ], JSON_UNESCAPED_UNICODE));

    return $payload . '.' . b64url(hash_hmac('sha256', $payload, auth_secret(), true));
}

function read_token(string $token): ?array
{
    $parts = explode('.', $token);

    if (count($parts) !== 2 || $parts[0] === '' || $parts[1] === '') {
        return null;
    }

    $expected = b64url(hash_hmac('sha256', $parts[0], auth_secret(), true));

    if (!hash_equals($expected, $parts[1])) {
        return null;
    }

    $data = json_decode((string) b64url_decode($parts[0]), true);

    if (!is_array($data) || empty($data['uid']) || (isset($data['exp']) && $data['exp'] < time())) {
        return null;
    }

    return ['uid' => (int) $data['uid'], 'name' => (string) $data['name'], 'provider' => (string) $data['provider']];
}

/**
 * The signed-in user, from the X-Auth-Token header (the client sends this one:
 * some hosts strip Authorization before PHP sees it) or Authorization: Bearer.
 */
function session(): ?array
{
    static $done = false;
    static $session = null;

    if (!$done) {
        $done = true;
        $token = (string) ($_SERVER['HTTP_X_AUTH_TOKEN'] ?? '');

        if ($token === '') {
            $auth = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');

            if (stripos($auth, 'bearer ') === 0) {
                $token = trim(substr($auth, 7));
            }
        }

        $session = $token !== '' ? read_token($token) : null;
    }

    return $session;
}

function require_session(): array
{
    $session = session();

    if (!$session) {
        fail('not authenticated', 401);
    }

    return $session;
}

/* ── users ─────────────────────────────────────────────────────── */

function upsert_user(string $provider, string $providerId, string $name, ?string $email = null): array
{
    $name = mb_substr(trim($name), 0, 200) ?: $provider . ':' . $providerId;

    q('INSERT INTO ' . t('users') . ' (provider, provider_id, email, name) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), email = COALESCE(VALUES(email), email)',
        [$provider, $providerId, $email, $name]);

    return row('SELECT id, provider, name FROM ' . t('users') . ' WHERE provider = ? AND provider_id = ?',
        [$provider, $providerId]);
}

/** "Reputatione": upvotes other people gave to the user's comments. */
function reputation_of(int $userId): int
{
    $found = row('SELECT COUNT(*) AS n FROM ' . t('comment_votes') . ' cv JOIN ' . t('comments') . ' c ON c.id = cv.comment_id
                  WHERE c.user_id = ? AND cv.value = 1 AND cv.user_id <> c.user_id', [$userId]);

    return (int) ($found['n'] ?? 0);
}

/** Avatar version = milliseconds of its upload time, part of the picture's URL. */
function avatar_version(?string $at): ?string
{
    if (!$at) {
        return null;
    }

    $date = DateTime::createFromFormat('Y-m-d H:i:s.u', $at, new DateTimeZone('UTC'))
        ?: DateTime::createFromFormat('Y-m-d H:i:s', $at, new DateTimeZone('UTC'));

    return $date ? $date->format('Uv') : null;
}

/* ── small validators ─────────────────────────────────────────── */

/** Dictionary word ids are the sheet's numeric ids. */
function word_id($value): ?string
{
    $id = trim((string) $value);

    return preg_match('/^\d{1,10}$/', $id) ? $id : null;
}

function clean_word($value): string
{
    return mb_substr(trim((string) $value), 0, 200);
}

function http_get(string $url, int $timeout = 8): ?string
{
    if (function_exists('curl_init')) {
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_FOLLOWLOCATION => false,
        ]);
        $response = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);

        return ($response !== false && $status === 200) ? (string) $response : null;
    }

    $context = stream_context_create(['http' => ['timeout' => $timeout, 'ignore_errors' => true]]);
    $response = @file_get_contents($url, false, $context);

    return ($response !== false && str_contains($http_response_header[0] ?? '', ' 200')) ? $response : null;
}
