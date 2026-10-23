<?php
/**
 * Sign-in (Telegram, Google), the current user, favourites, search history.
 */
declare(strict_types=1);

if (!defined('NL_API')) {
    http_response_code(404);
    exit;
}

/** Public settings the page needs to show the sign-in buttons. */
function route_config(): void
{
    send_json([
        'telegramBot' => cfg('telegram_bot_username') ?: null,
        'googleClientId' => cfg('google_client_id') ?: null,
    ], 200, 'public, max-age=300');
}

/**
 * Telegram Login Widget: https://core.telegram.org/bots/login#checking-authorization
 * Body: the widget's fields (id, first_name, last_name, username, photo_url, auth_date, hash).
 */
function route_auth_telegram(): void
{
    if (method() !== 'POST') {
        fail('method not allowed', 405);
    }

    $botToken = (string) cfg('telegram_bot_token', '');

    if ($botToken === '') {
        fail('Telegram sign-in is not configured yet', 503);
    }

    $fields = body();
    $hash = (string) ($fields['hash'] ?? '');
    unset($fields['hash']);

    if ($hash === '' || empty($fields['id']) || empty($fields['auth_date'])) {
        fail('missing telegram fields', 400);
    }

    ksort($fields, SORT_STRING);
    $lines = [];

    foreach ($fields as $key => $value) {
        if (!is_scalar($value)) {
            fail('invalid telegram fields', 400);
        }

        $lines[] = $key . '=' . (is_bool($value) ? ($value ? 'true' : 'false') : (string) $value);
    }

    $secretKey = hash('sha256', $botToken, true);
    $computed = hash_hmac('sha256', implode("\n", $lines), $secretKey);

    if (!hash_equals($computed, strtolower($hash))) {
        fail('invalid telegram signature', 401);
    }

    if (time() - (int) $fields['auth_date'] > 86400) {
        fail('stale telegram sign-in, please try again', 401);
    }

    ensure_schema();

    $name = trim(implode(' ', array_filter([(string) ($fields['first_name'] ?? ''), (string) ($fields['last_name'] ?? '')])))
        ?: (string) ($fields['username'] ?? '')
        ?: 'tg:' . $fields['id'];
    $user = upsert_user('telegram', (string) $fields['id'], $name);

    send_json(['user' => ['id' => (int) $user['id'], 'name' => $user['name'], 'provider' => 'telegram'], 'token' => make_token($user)]);
}

/**
 * Google Identity Services. Body: { credential } — the ID token from the button's callback,
 * checked with Google's tokeninfo endpoint (audience = our client id).
 */
function route_auth_google(): void
{
    if (method() !== 'POST') {
        fail('method not allowed', 405);
    }

    $clientId = (string) cfg('google_client_id', '');

    if ($clientId === '') {
        fail('Google sign-in is not configured yet', 503);
    }

    $credential = (string) (body()['credential'] ?? '');

    if ($credential === '' || strlen($credential) > 4096) {
        fail('missing credential', 400);
    }

    $endpoint = (string) cfg('google_tokeninfo_url', 'https://oauth2.googleapis.com/tokeninfo');
    $response = http_get($endpoint . '?id_token=' . rawurlencode($credential));
    $info = $response ? json_decode($response, true) : null;

    if (!is_array($info) || ($info['aud'] ?? '') !== $clientId || empty($info['sub'])
        || !in_array($info['iss'] ?? '', ['accounts.google.com', 'https://accounts.google.com'], true)) {
        fail('invalid google token', 401);
    }

    ensure_schema();

    $email = !empty($info['email']) ? (string) $info['email'] : null;
    $name = (string) ($info['name'] ?? '') ?: ($email ? strstr($email, '@', true) : '') ?: 'Google user';
    $user = upsert_user('google', (string) $info['sub'], $name, $email);

    send_json(['user' => ['id' => (int) $user['id'], 'name' => $user['name'], 'provider' => 'google'], 'token' => make_token($user)]);
}

/** GET me — who is signed in, with profile, languages and favourites. */
function route_me(): void
{
    $session = session();

    if (!$session) {
        send_json(['user' => null]);
    }

    ensure_schema();

    $user = row('SELECT u.id, u.name, u.provider, u.created_at, p.bio, p.links, p.avatar_at
                 FROM ' . t('users') . ' u LEFT JOIN ' . t('profiles') . ' p ON p.user_id = u.id
                 WHERE u.id = ?', [$session['uid']]);

    if (!$user) {
        // the account no longer exists: the client signs out
        fail('not authenticated', 401);
    }

    send_json([
        'user' => [
            'id' => (int) $user['id'],
            'name' => $user['name'],
            'provider' => $user['provider'],
            'since' => iso($user['created_at']),
            'bio' => $user['bio'] ?? '',
            'links' => json_decode($user['links'] ?? '{}', true) ?: (object) [],
            'avatar' => avatar_version($user['avatar_at'] ?? null),
            'reputation' => reputation_of((int) $user['id']),
        ],
        'languages' => language_profile((int) $user['id']),
        'favourites' => favourites_of((int) $user['id']),
    ]);
}

function favourites_of(int $userId): array
{
    return array_map(fn ($fav) => [
        'id' => $fav['word_id'],
        'word' => $fav['word'],
        'addedAt' => iso($fav['added_at']),
    ], rows('SELECT word_id, word, added_at FROM ' . t('favourites') . ' WHERE user_id = ? ORDER BY added_at DESC', [$userId]));
}

/**
 * GET favourites — the list; PUT favourites — replace it with the posted list
 * [{ id, word, addedAt }] (the client merges local and server lists first, like the hub).
 */
function route_favourites(): void
{
    $session = require_session();
    ensure_schema();

    if (method() === 'GET') {
        send_json(['favourites' => favourites_of($session['uid'])]);
    }

    if (method() !== 'PUT') {
        fail('method not allowed', 405);
    }

    $list = body()['favourites'] ?? null;

    if (!is_array($list) || count($list) > 5000) {
        fail('expected a list of at most 5000 favourites', 400);
    }

    $clean = [];

    foreach ($list as $fav) {
        $id = word_id($fav['id'] ?? '');
        $word = clean_word($fav['word'] ?? '');

        if ($id && $word !== '' && !isset($clean[$id])) {
            $at = strtotime((string) ($fav['addedAt'] ?? '')) ?: time();
            $clean[$id] = [$id, $word, gmdate('Y-m-d H:i:s', min($at, time()))];
        }
    }

    $pdo = db();
    $pdo->beginTransaction();
    q('DELETE FROM ' . t('favourites') . ' WHERE user_id = ?', [$session['uid']]);

    foreach (array_chunk(array_values($clean), 200) as $chunk) {
        $values = implode(', ', array_fill(0, count($chunk), '(?, ?, ?, ?)'));
        $params = [];

        foreach ($chunk as [$id, $word, $at]) {
            array_push($params, $session['uid'], $id, $word, $at);
        }

        q('INSERT INTO ' . t('favourites') . " (user_id, word_id, word, added_at) VALUES $values", $params);
    }

    $pdo->commit();

    send_json(['ok' => true, 'count' => count($clean)]);
}

/**
 * Search history of the signed-in user (private).
 * GET — newest 300; POST — append [{ id, word, translation, lang, at }]; DELETE — clear.
 */
function route_history(): void
{
    $session = require_session();
    ensure_schema();
    $uid = $session['uid'];

    if (method() === 'GET') {
        $list = rows('SELECT word_id, word, translation, lang, created_at FROM ' . t('history') . '
                      WHERE user_id = ? ORDER BY created_at DESC LIMIT 300', [$uid]);

        send_json(['history' => array_map(fn ($entry) => [
            'id' => $entry['word_id'],
            'word' => $entry['word'],
            'translation' => $entry['translation'],
            'lang' => $entry['lang'],
            'at' => iso($entry['created_at']),
        ], $list)]);
    }

    if (method() === 'DELETE') {
        q('DELETE FROM ' . t('history') . ' WHERE user_id = ?', [$uid]);
        send_json(['ok' => true]);
    }

    if (method() !== 'POST') {
        fail('method not allowed', 405);
    }

    $list = body()['items'] ?? null;

    if (!is_array($list) || count($list) > 50) {
        fail('expected a list of at most 50 entries', 400);
    }

    $count = 0;

    foreach ($list as $entry) {
        $id = word_id($entry['id'] ?? '');
        $word = clean_word($entry['word'] ?? '');

        if (!$id || $word === '') {
            continue;
        }

        $at = min((int) (($entry['at'] ?? 0) / 1000) ?: time(), time());
        q('INSERT INTO ' . t('history') . ' (user_id, word_id, word, translation, lang, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
            $uid,
            $id,
            $word,
            isset($entry['translation']) ? mb_substr((string) $entry['translation'], 0, 300) : null,
            isset($entry['lang']) && preg_match('/^[a-z]{2,8}$/', (string) $entry['lang']) ? $entry['lang'] : null,
            gmdate('Y-m-d H:i:s', $at),
        ]);
        $count++;
    }

    if ($count) {
        // keep the newest 1000 per user
        $cut = row('SELECT created_at FROM ' . t('history') . ' WHERE user_id = ? ORDER BY created_at DESC LIMIT 1 OFFSET 999', [$uid]);

        if ($cut) {
            q('DELETE FROM ' . t('history') . ' WHERE user_id = ? AND created_at < ?', [$uid, $cut['created_at']]);
        }
    }

    send_json(['ok' => true, 'count' => $count]);
}
