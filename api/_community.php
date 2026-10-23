<?php
/**
 * Community features, mirroring the Interslavic hub's api/community/[type].ts:
 *
 * GET    community/languages                    own language profile
 * PUT    community/languages                    { native, others: [{lang, level}], foreign: [...] }
 * GET    community/intelligibility?id=123       statistics (+ own vote)
 * POST   community/intelligibility              { id, word, vote }   (vote null = withdraw)
 * GET    community/comments?id=123              comments on a word, oldest first
 * GET    community/comments?id=123&count=1      just how many
 * GET    community/comments?latest=1[&before=]  newest comments on all words, 30 per page
 * POST   community/comments                     { id, word, body }  (≤ 2000 characters)
 * PATCH  community/comments                     { cid, body }       edit one's own
 * DELETE community/comments?cid=7               delete one's own
 * POST   community/commentvote                  { cid, vote: 1 | -1 | 0 }
 * GET    community/users[?q=&offset=]           everyone who signed in, most active first
 * GET    community/users?id=5                   one user: languages, favourites, votes, comments
 * GET    community/recentvotes[?before=]        newest intelligibility votes of all users
 * PUT    community/about                        { bio?, links? }
 * GET    community/avatar?id=5[&v=]             a user's picture
 * PUT    community/avatar                       { image: base64 JPEG / PNG / WebP, ≤ 200 KB }
 * DELETE community/avatar
 * POST   community/lookup                       { items: [{ id, word }] }  count opened words (anyone)
 * GET    community/wordstats[?period=30|7]      the 50 newest lookups + the 50 most looked-up words (public)
 * GET    community/counts?ids=1,2,3             comment and vote counts for a page of results
 */
declare(strict_types=1);

if (!defined('NL_API')) {
    http_response_code(404);
    exit;
}

/** Romance languages a profile can name as native or as "other Romance". */
const ROMANCE_LANGS = [
    'pt', 'gl', 'mwl', 'ast', 'es', 'an', 'ca', 'oc', 'fr', 'frp', 'wa', 'pcd', 'it', 'vec', 'lmo', 'pms',
    'lij', 'nap', 'scn', 'co', 'sc', 'fur', 'lld', 'rm', 'ro', 'rup', 'lad',
];
/** Widely spoken / relevant non-Romance languages (incl. Latin, Interslavic, Esperanto). */
const NON_ROMANCE_LANGS = [
    'en', 'de', 'nl', 'sv', 'da', 'no', 'is', 'fi', 'et', 'lv', 'lt', 'hu', 'el', 'sq', 'mt', 'eu', 'br', 'cy',
    'ga', 'ru', 'uk', 'be', 'pl', 'cs', 'sk', 'sl', 'hr', 'sr', 'bs', 'mk', 'bg', 'isv', 'eo', 'ia', 'la',
    'tr', 'ar', 'he', 'fa', 'hi', 'zh', 'ja', 'ko', 'vi', 'ka', 'hy', 'kk', 'id', 'tl', 'sw',
];
const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const VOTES = ['understand', 'context', 'nonNative', 'unknown', 'falseFriend', 'notUnderstand'];

const COMMENT_MAX = 2000;
const COMMENTS_PER_PAGE = 30;
const COMMENT_BURST = 10; // per user per 10 minutes
const USERS_PER_PAGE = 50;
const VOTES_PER_PAGE = 30;
const BIO_MAX = 300;
const AVATAR_MAX_BYTES = 204800;
const LOOKUP_BATCH = 20;
const LOOKUP_REPEAT_MINUTES = 30;
const LOOKUP_HOURLY_CAP = 300;
const STATS_LIST = 50;

/* ── language profile ─────────────────────────────────────────── */

function language_profile(int $userId): ?array
{
    $found = row('SELECT native, others, foreign_langs FROM ' . t('language_profiles') . ' WHERE user_id = ?', [$userId]);

    return $found ? [
        'native' => $found['native'],
        'others' => json_decode($found['others'], true) ?: [],
        'foreign' => json_decode($found['foreign_langs'], true) ?: [],
    ] : null;
}

/** A list of { lang, level } from $allowed, without repeats (already-seen languages are skipped). */
function level_list($input, array $allowed, array &$seen): ?array
{
    $result = [];

    foreach (is_array($input) ? $input : [] as $entry) {
        $lang = (string) ($entry['lang'] ?? '');
        $level = strtoupper((string) ($entry['level'] ?? ''));

        if (!in_array($lang, $allowed, true) || !in_array($level, CEFR_LEVELS, true)) {
            return null;
        }

        if (!isset($seen[$lang])) {
            $seen[$lang] = true;
            $result[] = ['lang' => $lang, 'level' => $level];
        }
    }

    return $result;
}

function route_languages(): void
{
    $session = require_session();

    if (method() === 'GET') {
        send_json(['profile' => language_profile($session['uid'])]);
    }

    if (method() !== 'PUT') {
        fail('method not allowed', 405);
    }

    $input = body();
    $native = (string) ($input['native'] ?? '');

    if (!in_array($native, ROMANCE_LANGS, true)) {
        fail('choose your native Romance language', 400);
    }

    $seen = [$native => true];
    $others = level_list($input['others'] ?? [], ROMANCE_LANGS, $seen);
    $foreign = level_list($input['foreign'] ?? [], NON_ROMANCE_LANGS, $seen);

    if ($others === null || $foreign === null) {
        fail('every other language needs a level from A1 to C2', 400);
    }

    q('INSERT INTO ' . t('language_profiles') . ' (user_id, native, others, foreign_langs, updated_at)
       VALUES (?, ?, ?, ?, UTC_TIMESTAMP(6))
       ON DUPLICATE KEY UPDATE native = VALUES(native), others = VALUES(others),
           foreign_langs = VALUES(foreign_langs), updated_at = UTC_TIMESTAMP(6)',
        [$session['uid'], $native, json_encode($others), json_encode($foreign)]);

    // earlier votes follow a corrected mother tongue
    q('UPDATE ' . t('votes') . ' SET native = ? WHERE user_id = ? AND native <> ?', [$native, $session['uid'], $native]);

    send_json(['profile' => language_profile($session['uid'])]);
}

/* ── intelligibility ──────────────────────────────────────────── */

function statistics(string $id, ?array $session): array
{
    $counts = [];
    $byLang = [];
    $total = 0;

    foreach (rows('SELECT native, vote, COUNT(*) AS n FROM ' . t('votes') . ' WHERE word_id = ? GROUP BY native, vote', [$id]) as $group) {
        $n = (int) $group['n'];
        $total += $n;
        $counts[$group['vote']] = ($counts[$group['vote']] ?? 0) + $n;
        $byLang[$group['native']] ??= ['total' => 0, 'counts' => []];
        $byLang[$group['native']]['total'] += $n;
        $byLang[$group['native']]['counts'][$group['vote']] = ($byLang[$group['native']]['counts'][$group['vote']] ?? 0) + $n;
    }

    $mine = null;

    if ($session) {
        $mine = row('SELECT vote FROM ' . t('votes') . ' WHERE user_id = ? AND word_id = ?', [$session['uid'], $id])['vote'] ?? null;
    }

    $looked = row('SELECT lookups FROM ' . t('word_stats') . ' WHERE word_id = ?', [$id]);

    return [
        'id' => $id,
        'total' => $total,
        'counts' => $counts ?: (object) [],
        'byLang' => $byLang ?: (object) [],
        'mine' => $mine,
        'lookups' => (int) ($looked['lookups'] ?? 0),
    ];
}

function route_intelligibility(): void
{
    $session = session();

    if (method() === 'GET') {
        $id = word_id($_GET['id'] ?? '');

        if (!$id) {
            fail('missing word id', 400);
        }

        send_json(statistics($id, $session));
    }

    if (method() !== 'POST') {
        fail('method not allowed', 405);
    }

    $session = require_session();
    $input = body();
    $id = word_id($input['id'] ?? '');
    $word = clean_word($input['word'] ?? '');
    $vote = $input['vote'] ?? null;

    if (!$id || $word === '') {
        fail('missing word', 400);
    }

    if ($vote === null) {
        q('DELETE FROM ' . t('votes') . ' WHERE user_id = ? AND word_id = ?', [$session['uid'], $id]);
        send_json(statistics($id, $session));
    }

    if (!in_array($vote, VOTES, true)) {
        fail('unknown vote', 400);
    }

    $native = language_profile($session['uid'])['native'] ?? null;

    if (!$native) {
        fail('set your native language first', 409, ['code' => 'NO_PROFILE']);
    }

    q('INSERT INTO ' . t('votes') . ' (user_id, word_id, word, vote, native) VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE vote = VALUES(vote), word = VALUES(word), native = VALUES(native), updated_at = UTC_TIMESTAMP(6)',
        [$session['uid'], $id, $word, $vote, $native]);

    send_json(statistics($id, $session));
}

/* ── comments ─────────────────────────────────────────────────── */

const COMMENT_SELECT = 'SELECT c.id, c.word_id, c.word, c.body, c.created_at, c.edited_at,
           u.name AS author, u.id AS author_id, p.avatar_at';

function comment_from(): string
{
    return ' FROM ' . t('comments') . ' c JOIN ' . t('users') . ' u ON u.id = c.user_id
             LEFT JOIN ' . t('profiles') . ' p ON p.user_id = c.user_id AND p.avatar_data IS NOT NULL';
}

function comment_out(array $row, ?int $uid): array
{
    return [
        'id' => (int) $row['id'],
        'wordId' => $row['word_id'],
        'word' => $row['word'],
        'author' => $row['author'],
        'authorId' => (int) $row['author_id'],
        'authorAvatar' => avatar_version($row['avatar_at'] ?? null),
        'body' => $row['body'],
        'at' => iso($row['created_at']),
        'editedAt' => iso($row['edited_at'] ?? null),
        'mine' => $uid !== null && (int) $row['author_id'] === $uid,
        'up' => 0,
        'down' => 0,
        'myVote' => 0,
    ];
}

/** Up / down counts and the reader's own vote for a list of comments. */
function with_votes(array $rows, ?int $uid): array
{
    $comments = array_map(fn ($row) => comment_out($row, $uid), $rows);

    if (!$comments) {
        return [];
    }

    $ids = array_column($comments, 'id');
    $votes = rows('SELECT comment_id,
                          SUM(value = 1) AS up, SUM(value = -1) AS down,
                          COALESCE(MAX(CASE WHEN user_id = ? THEN value END), 0) AS mine
                   FROM ' . t('comment_votes') . ' WHERE comment_id IN (' . marks($ids) . ') GROUP BY comment_id',
        array_merge([$uid ?? 0], $ids));
    $byId = [];

    foreach ($votes as $vote) {
        $byId[(int) $vote['comment_id']] = $vote;
    }

    foreach ($comments as &$comment) {
        if (isset($byId[$comment['id']])) {
            $comment['up'] = (int) $byId[$comment['id']]['up'];
            $comment['down'] = (int) $byId[$comment['id']]['down'];
            $comment['myVote'] = (int) $byId[$comment['id']]['mine'];
        }
    }

    return $comments;
}

/** Trimmed text with normalised line ends, and its length in characters. */
function comment_text($value): array
{
    $text = trim(str_replace(["\r\n", "\r"], "\n", (string) $value));

    return [$text, mb_strlen($text)];
}

function route_comments(): void
{
    $session = session();
    $uid = $session['uid'] ?? null;

    if (method() === 'GET') {
        if (!empty($_GET['latest'])) {
            $before = preg_match('/^\d{1,18}$/', (string) ($_GET['before'] ?? '')) ? (int) $_GET['before'] : null;
            $list = rows(COMMENT_SELECT . comment_from() . ($before ? ' WHERE c.id < ?' : '') .
                ' ORDER BY c.id DESC LIMIT ' . (COMMENTS_PER_PAGE + 1), $before ? [$before] : []);

            send_json([
                'comments' => with_votes(array_slice($list, 0, COMMENTS_PER_PAGE), $uid),
                'more' => count($list) > COMMENTS_PER_PAGE,
            ]);
        }

        $id = word_id($_GET['id'] ?? '');

        if (!$id) {
            fail('missing word id', 400);
        }

        if (!empty($_GET['count'])) {
            send_json(['count' => (int) row('SELECT COUNT(*) AS n FROM ' . t('comments') . ' WHERE word_id = ?', [$id])['n']]);
        }

        send_json(['comments' => with_votes(
            rows(COMMENT_SELECT . comment_from() . ' WHERE c.word_id = ? ORDER BY c.created_at ASC LIMIT 500', [$id]),
            $uid
        )]);
    }

    $session = require_session();
    $uid = $session['uid'];

    if (method() === 'DELETE') {
        $cid = preg_match('/^\d{1,18}$/', (string) ($_GET['cid'] ?? '')) ? (int) $_GET['cid'] : null;

        if (!$cid) {
            fail('missing comment id', 400);
        }

        $deleted = q('DELETE FROM ' . t('comments') . ' WHERE id = ? AND user_id = ?', [$cid, $uid])->rowCount();

        $deleted ? send_json(['ok' => true]) : fail('not found', 404);
    }

    if (method() === 'PATCH') {
        $input = body();
        $cid = preg_match('/^\d{1,18}$/', (string) ($input['cid'] ?? '')) ? (int) $input['cid'] : null;
        [$text, $length] = comment_text($input['body'] ?? '');

        if (!$cid) {
            fail('missing comment id', 400);
        }

        if (!$length || $length > COMMENT_MAX) {
            fail('a comment is 1 to ' . COMMENT_MAX . ' characters long', 400);
        }

        // only a real change counts as an edit
        $changed = q('UPDATE ' . t('comments') . ' SET edited_at = CASE WHEN body = ? THEN edited_at ELSE UTC_TIMESTAMP(6) END, body = ?
                      WHERE id = ? AND user_id = ?', [$text, $text, $cid, $uid]);
        $found = row(COMMENT_SELECT . comment_from() . ' WHERE c.id = ? AND c.user_id = ?', [$cid, $uid]);

        $found ? send_json(['comment' => with_votes([$found], $uid)[0]]) : fail('not found', 404);
    }

    if (method() !== 'POST') {
        fail('method not allowed', 405);
    }

    $input = body();
    $id = word_id($input['id'] ?? '');
    $word = clean_word($input['word'] ?? '');
    [$text, $length] = comment_text($input['body'] ?? '');

    if (!$id || $word === '') {
        fail('missing word', 400);
    }

    if (!$length || $length > COMMENT_MAX) {
        fail('a comment is 1 to ' . COMMENT_MAX . ' characters long', 400);
    }

    $recent = row('SELECT COUNT(*) AS n, COALESCE(SUM(word_id = ? AND body = ?), 0) AS same FROM ' . t('comments') . '
                   WHERE user_id = ? AND created_at > UTC_TIMESTAMP(6) - INTERVAL 10 MINUTE', [$id, $text, $uid]);

    if ((int) $recent['same'] > 0) {
        fail('this comment is already posted', 409);
    }

    if ((int) $recent['n'] >= COMMENT_BURST) {
        fail('too many comments — please wait a few minutes', 429);
    }

    q('INSERT INTO ' . t('comments') . ' (word_id, word, user_id, body) VALUES (?, ?, ?, ?)', [$id, $word, $uid, $text]);
    $found = row(COMMENT_SELECT . comment_from() . ' WHERE c.id = ?', [(int) db()->lastInsertId()]);

    send_json(['comment' => comment_out($found, $uid)], 201);
}

function route_comment_vote(): void
{
    if (method() !== 'POST') {
        fail('method not allowed', 405);
    }

    $session = require_session();
    $input = body();
    $cid = preg_match('/^\d{1,18}$/', (string) ($input['cid'] ?? '')) ? (int) $input['cid'] : null;
    $vote = $input['vote'] ?? null;

    if (!$cid || !in_array($vote, [1, -1, 0], true)) {
        fail('vote is 1, -1 or 0', 400);
    }

    $owner = row('SELECT user_id FROM ' . t('comments') . ' WHERE id = ?', [$cid]);

    if (!$owner) {
        fail('not found', 404);
    }

    if ((int) $owner['user_id'] === $session['uid']) {
        fail('you cannot vote on your own comment', 403);
    }

    if ($vote === 0) {
        q('DELETE FROM ' . t('comment_votes') . ' WHERE comment_id = ? AND user_id = ?', [$cid, $session['uid']]);
    } else {
        q('INSERT INTO ' . t('comment_votes') . ' (comment_id, user_id, value) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE value = VALUES(value), created_at = UTC_TIMESTAMP(6)', [$cid, $session['uid'], $vote]);
    }

    $totals = row('SELECT COALESCE(SUM(value = 1), 0) AS up, COALESCE(SUM(value = -1), 0) AS down
                   FROM ' . t('comment_votes') . ' WHERE comment_id = ?', [$cid]);

    send_json(['cid' => $cid, 'up' => (int) $totals['up'], 'down' => (int) $totals['down'], 'myVote' => $vote]);
}

/* ── users ────────────────────────────────────────────────────── */

function route_users(): void
{
    if (method() !== 'GET') {
        fail('method not allowed', 405);
    }

    $session = session();
    $uid = $session['uid'] ?? null;
    $id = preg_match('/^\d{1,10}$/', (string) ($_GET['id'] ?? '')) ? (int) $_GET['id'] : null;

    if ($id) {
        $user = row('SELECT u.id, u.name, u.created_at, p.bio, p.links, p.avatar_at, p.avatar_data IS NOT NULL AS has_avatar
                     FROM ' . t('users') . ' u LEFT JOIN ' . t('profiles') . ' p ON p.user_id = u.id WHERE u.id = ?', [$id]);

        if (!$user) {
            fail('not found', 404);
        }

        $votes = rows('SELECT word_id, word, vote, updated_at FROM ' . t('votes') . ' WHERE user_id = ? ORDER BY updated_at DESC LIMIT 300', [$id]);

        send_json([
            'user' => [
                'id' => (int) $user['id'],
                'name' => $user['name'],
                'since' => iso($user['created_at']),
                'bio' => $user['bio'] ?? '',
                'links' => json_decode($user['links'] ?? '{}', true) ?: (object) [],
                'avatar' => $user['has_avatar'] ? avatar_version($user['avatar_at']) : null,
                'reputation' => reputation_of((int) $user['id']),
                'languages' => language_profile((int) $user['id']),
                'favourites' => favourites_of((int) $user['id']),
            ],
            'comments' => with_votes(rows(COMMENT_SELECT . comment_from() . ' WHERE c.user_id = ? ORDER BY c.created_at DESC LIMIT 100', [$id]), $uid),
            'votes' => array_map(fn ($vote) => [
                'wordId' => $vote['word_id'], 'word' => $vote['word'], 'vote' => $vote['vote'], 'at' => iso($vote['updated_at']),
            ], $votes),
        ]);
    }

    $search = mb_substr(trim((string) ($_GET['q'] ?? '')), 0, 60);
    $offset = min(max((int) ($_GET['offset'] ?? 0), 0), 100000);
    $params = [];
    $where = '';

    if ($search !== '') {
        $where = 'WHERE u.name LIKE ?';
        $params[] = '%' . addcslashes($search, '\\%_') . '%';
    }

    $list = rows('SELECT u.id, u.name, u.created_at, lp.native, lp.others, lp.foreign_langs, p.bio, p.avatar_at, p.avatar_data IS NOT NULL AS has_avatar,
                         COALESCE(c.n, 0) AS comments, COALESCE(v.n, 0) AS votes, COALESCE(r.n, 0) AS reputation,
                         GREATEST(u.created_at, COALESCE(c.last, u.created_at), COALESCE(v.last, u.created_at),
                                  COALESCE(lp.updated_at, u.created_at), COALESCE(p.updated_at, u.created_at)) AS active
                  FROM ' . t('users') . ' u
                  LEFT JOIN ' . t('language_profiles') . ' lp ON lp.user_id = u.id
                  LEFT JOIN ' . t('profiles') . ' p ON p.user_id = u.id
                  LEFT JOIN (SELECT user_id, COUNT(*) AS n, MAX(created_at) AS last FROM ' . t('comments') . ' GROUP BY user_id) c ON c.user_id = u.id
                  LEFT JOIN (SELECT user_id, COUNT(*) AS n, MAX(updated_at) AS last FROM ' . t('votes') . ' GROUP BY user_id) v ON v.user_id = u.id
                  LEFT JOIN (SELECT c2.user_id, COUNT(*) AS n FROM ' . t('comment_votes') . ' cv JOIN ' . t('comments') . ' c2 ON c2.id = cv.comment_id
                             WHERE cv.value = 1 AND cv.user_id <> c2.user_id GROUP BY c2.user_id) r ON r.user_id = u.id
                  ' . $where . '
                  ORDER BY active DESC, u.id DESC
                  LIMIT ' . (USERS_PER_PAGE + 1) . ' OFFSET ' . $offset, $params);

    send_json([
        'users' => array_map(fn ($user) => [
            'id' => (int) $user['id'],
            'name' => $user['name'],
            'since' => iso($user['created_at']),
            'active' => iso($user['active']),
            'native' => $user['native'],
            'others' => json_decode($user['others'] ?? '[]', true) ?: [],
            'foreign' => json_decode($user['foreign_langs'] ?? '[]', true) ?: [],
            'bio' => $user['bio'] ?? '',
            'avatar' => $user['has_avatar'] ? avatar_version($user['avatar_at']) : null,
            'comments' => (int) $user['comments'],
            'votes' => (int) $user['votes'],
            'reputation' => (int) $user['reputation'],
        ], array_slice($list, 0, USERS_PER_PAGE)),
        'more' => count($list) > USERS_PER_PAGE,
    ]);
}

/* ── newest votes ("Última activitate") ───────────────────────── */

function route_recent_votes(): void
{
    if (method() !== 'GET') {
        fail('method not allowed', 405);
    }

    // cursor: "<updated_at with microseconds>|<user id>" of the last vote shown
    $before = (string) ($_GET['before'] ?? '');
    $params = [];
    $where = '';

    if (preg_match('/^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d{6})\|(\d{1,10})$/', $before, $m)) {
        $where = 'WHERE (v.updated_at < ? OR (v.updated_at = ? AND v.user_id < ?))';
        $params = [$m[1], $m[1], (int) $m[2]];
    }

    $list = rows('SELECT v.word_id, v.word, v.vote, v.native, v.updated_at, u.id AS user_id, u.name, p.avatar_at
                  FROM ' . t('votes') . ' v JOIN ' . t('users') . ' u ON u.id = v.user_id
                  LEFT JOIN ' . t('profiles') . ' p ON p.user_id = v.user_id AND p.avatar_data IS NOT NULL
                  ' . $where . ' ORDER BY v.updated_at DESC, v.user_id DESC LIMIT ' . (VOTES_PER_PAGE + 1), $params);

    send_json([
        'votes' => array_map(fn ($vote) => [
            'userId' => (int) $vote['user_id'],
            'name' => $vote['name'],
            'avatar' => avatar_version($vote['avatar_at'] ?? null),
            'wordId' => $vote['word_id'],
            'word' => $vote['word'],
            'vote' => $vote['vote'],
            'native' => $vote['native'],
            'at' => iso($vote['updated_at']),
            'cursor' => $vote['updated_at'] . '|' . $vote['user_id'],
        ], array_slice($list, 0, VOTES_PER_PAGE)),
        'more' => count($list) > VOTES_PER_PAGE,
    ]);
}

/* ── bio and links ────────────────────────────────────────────── */

/** Trimmed bio: Windows line ends normalised, at most one empty line in a row. */
function clean_bio($value): array
{
    $bio = str_replace(["\r\n", "\r"], "\n", (string) $value);
    $bio = preg_replace('/[ \t]+\n/', "\n", $bio);
    $bio = trim(preg_replace("/\n{3,}/", "\n\n", $bio));

    return [$bio, mb_strlen($bio)];
}

/** Where each network's links may point, and what a bare username becomes. */
function networks(): array
{
    return [
        'facebook' => ['/^(www\.|m\.)?(facebook\.com|fb\.com|fb\.me)$/', '/^[A-Za-z0-9.]{3,64}$/', 'https://www.facebook.com/%s'],
        'instagram' => ['/^(www\.)?instagram\.com$/', '/^[A-Za-z0-9._]{1,30}$/', 'https://www.instagram.com/%s'],
        'telegram' => ['/^(www\.)?(t\.me|telegram\.me)$/', '/^[A-Za-z0-9_]{4,32}$/', 'https://t.me/%s'],
        // Discord usernames have no public address: kept as plain text
        'discord' => ['/^(www\.)?(discord\.com|discord\.gg|discordapp\.com)$/', '/^[a-z0-9_.]{2,32}$/', null],
        'reddit' => ['/^(www\.|old\.|new\.)?reddit\.com$/', '/^[A-Za-z0-9_-]{3,20}$/', 'https://www.reddit.com/user/%s'],
        'wikipedia' => ['/^([a-z-]+\.)?(m\.)?(wikipedia|wikimedia)\.org$/', '/^[\p{L}\p{N} ._-]{1,64}$/u', 'https://meta.wikimedia.org/wiki/User:%s'],
        'youtube' => ['/^(www\.|m\.)?(youtube\.com|youtu\.be)$/', '/^[A-Za-z0-9._-]{3,30}$/', 'https://www.youtube.com/@%s'],
        'tiktok' => ['/^(www\.)?tiktok\.com$/', '/^[A-Za-z0-9._]{2,24}$/', 'https://www.tiktok.com/@%s'],
    ];
}

/**
 * One profile link: a full https address on that network's own site, or a username
 * that becomes one. Anything else (other sites, javascript: …) is refused.
 * Returns the link, null for empty, false for invalid.
 */
function normalize_link(string $network, $input)
{
    [$hosts, $handle, $template] = networks()[$network];
    $value = trim((string) $input);

    if ($value === '') {
        return null;
    }

    if (mb_strlen($value) > 200) {
        return false;
    }

    $looksLikeUrl = preg_match('#^[a-z]+://#i', $value) || preg_match('#^[^\s/@]+\.[a-z]{2,}/#i', $value);

    if ($looksLikeUrl) {
        $parts = parse_url(preg_match('#^[a-z]+://#i', $value) ? $value : 'https://' . $value);

        if (!$parts || !in_array(strtolower($parts['scheme'] ?? ''), ['http', 'https'], true)
            || isset($parts['user']) || isset($parts['pass']) || isset($parts['port'])) {
            return false;
        }

        $host = strtolower($parts['host'] ?? '');
        $path = $parts['path'] ?? '';

        if (!preg_match($hosts, $host) || strlen($path) < 2 || preg_match('/[\s<>"]/', $path . ($parts['query'] ?? ''))) {
            return false;
        }

        return 'https://' . $host . $path . (isset($parts['query']) ? '?' . $parts['query'] : '');
    }

    $name = ltrim($value, '@');
    $name = $network === 'discord' ? strtolower($name) : $name;

    if (!preg_match($handle, $name)) {
        return false;
    }

    return $template ? sprintf($template, $network === 'wikipedia' ? rawurlencode(str_replace(' ', '_', $name)) : $name) : $name;
}

function route_about(): void
{
    $session = require_session();

    if (method() !== 'PUT') {
        fail('method not allowed', 405);
    }

    $input = body();
    $current = row('SELECT bio, links FROM ' . t('profiles') . ' WHERE user_id = ?', [$session['uid']]);
    $bio = $current['bio'] ?? '';
    $links = json_decode($current['links'] ?? '{}', true) ?: [];

    if (array_key_exists('bio', $input)) {
        [$bio, $length] = clean_bio($input['bio']);

        if ($length > BIO_MAX) {
            fail('the bio is at most ' . BIO_MAX . ' characters long', 400);
        }
    }

    if (array_key_exists('links', $input)) {
        $links = [];
        $source = is_array($input['links']) ? $input['links'] : [];

        foreach (array_keys(networks()) as $network) {
            $link = normalize_link($network, $source[$network] ?? '');

            if ($link === false) {
                fail("not a valid $network address or username", 400, ['code' => 'BAD_LINK', 'network' => $network]);
            }

            if ($link) {
                $links[$network] = $link;
            }
        }
    }

    q('INSERT INTO ' . t('profiles') . ' (user_id, bio, links, updated_at) VALUES (?, ?, ?, UTC_TIMESTAMP(6))
       ON DUPLICATE KEY UPDATE bio = VALUES(bio), links = VALUES(links), updated_at = UTC_TIMESTAMP(6)',
        [$session['uid'], $bio, json_encode((object) $links, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)]);

    send_json(['bio' => $bio, 'links' => (object) $links]);
}

/* ── avatar ───────────────────────────────────────────────────── */

/** The picture's real format from its first bytes — never trust the declared type. */
function image_type(string $bytes): ?string
{
    if (strncmp($bytes, "\xFF\xD8\xFF", 3) === 0) {
        return 'image/jpeg';
    }

    if (strncmp($bytes, "\x89PNG\r\n\x1A\n", 8) === 0) {
        return 'image/png';
    }

    if (strlen($bytes) > 12 && substr($bytes, 0, 4) === 'RIFF' && substr($bytes, 8, 4) === 'WEBP') {
        return 'image/webp';
    }

    return null;
}

function route_avatar(): void
{
    if (method() === 'GET') {
        $id = preg_match('/^\d{1,10}$/', (string) ($_GET['id'] ?? '')) ? (int) $_GET['id'] : null;

        if (!$id) {
            fail('missing user id', 400);
        }

        $found = row('SELECT avatar_data, avatar_type, avatar_at FROM ' . t('profiles') . ' WHERE user_id = ? AND avatar_data IS NOT NULL', [$id]);

        if (!$found) {
            fail('no picture', 404);
        }

        // the URL carries the version: a matching one may be cached for good
        $current = ($_GET['v'] ?? '') === avatar_version($found['avatar_at']);

        http_response_code(200);
        header('Content-Type: ' . $found['avatar_type']);
        header('Cache-Control: ' . ($current ? 'public, max-age=31536000, immutable' : 'public, max-age=300'));
        header('X-Content-Type-Options: nosniff');
        header("Content-Security-Policy: default-src 'none'");
        echo base64_decode($found['avatar_data']);
        exit;
    }

    $session = require_session();

    if (method() === 'DELETE') {
        q('UPDATE ' . t('profiles') . ' SET avatar_data = NULL, avatar_type = NULL, avatar_at = NULL, updated_at = UTC_TIMESTAMP(6)
           WHERE user_id = ?', [$session['uid']]);
        send_json(['avatar' => null]);
    }

    if (method() !== 'PUT') {
        fail('method not allowed', 405);
    }

    $encoded = preg_replace('/^data:[^,]*,/', '', (string) (body()['image'] ?? ''));
    $limit = (int) ceil(AVATAR_MAX_BYTES / 3) * 4 + 4;

    if ($encoded === '' || strlen($encoded) > $limit || !preg_match('#^[A-Za-z0-9+/]+=*$#', $encoded)) {
        fail('the picture must be a JPEG, PNG or WebP of at most 200 KB', 400);
    }

    $bytes = base64_decode($encoded, true);
    $type = $bytes !== false ? image_type($bytes) : null;

    if (!$type || strlen($bytes) > AVATAR_MAX_BYTES) {
        fail('the picture must be a JPEG, PNG or WebP of at most 200 KB', 400);
    }

    q('INSERT INTO ' . t('profiles') . ' (user_id, bio, links, avatar_data, avatar_type, avatar_at, updated_at)
       VALUES (?, \'\', \'{}\', ?, ?, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6))
       ON DUPLICATE KEY UPDATE avatar_data = VALUES(avatar_data), avatar_type = VALUES(avatar_type),
           avatar_at = VALUES(avatar_at), updated_at = UTC_TIMESTAMP(6)',
        [$session['uid'], base64_encode($bytes), $type]);

    $saved = row('SELECT avatar_at FROM ' . t('profiles') . ' WHERE user_id = ?', [$session['uid']]);

    send_json(['avatar' => avatar_version($saved['avatar_at'])]);
}

/* ── lookups (how often a word is opened) ─────────────────────── */

/**
 * Who is counting, without knowing who: signed-in users by account, everyone else
 * by a hash of address + browser that changes every day (nothing stored that leads back).
 */
function visitor_of(?array $session): string
{
    if ($session) {
        return 'u' . $session['uid'];
    }

    $ip = trim(explode(',', (string) ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? ''))[0]);
    $hash = hash('sha256', auth_secret() . '|' . gmdate('Y-m-d') . '|' . $ip . '|' . ($_SERVER['HTTP_USER_AGENT'] ?? ''), true);

    return 'a' . substr(b64url($hash), 0, 22);
}

function route_lookup(): void
{
    if (method() !== 'POST') {
        fail('method not allowed', 405);
    }

    $items = [];

    foreach (array_slice(is_array(body()['items'] ?? null) ? body()['items'] : [], 0, LOOKUP_BATCH) as $item) {
        $id = word_id($item['id'] ?? '');
        $word = mb_substr(clean_word($item['word'] ?? ''), 0, 100);

        if ($id && $word !== '') {
            $items[] = [$id, $word];
        }
    }

    if (!$items) {
        send_json(['counted' => 0]);
    }

    $visitor = visitor_of(session());
    $recent = rows('SELECT word_id, created_at > UTC_TIMESTAMP(6) - INTERVAL ' . LOOKUP_REPEAT_MINUTES . ' MINUTE AS fresh
                    FROM ' . t('lookups') . ' WHERE visitor = ? AND created_at > UTC_TIMESTAMP(6) - INTERVAL 1 HOUR', [$visitor]);
    $budget = LOOKUP_HOURLY_CAP - count($recent);
    $seen = [];

    foreach ($recent as $entry) {
        if ($entry['fresh']) {
            $seen[$entry['word_id']] = true;
        }
    }

    $counted = 0;

    foreach ($items as [$id, $word]) {
        if ($budget <= 0 || isset($seen[$id])) {
            continue;
        }

        $seen[$id] = true;
        $budget--;
        $counted++;
        q('INSERT INTO ' . t('lookups') . ' (word_id, visitor) VALUES (?, ?)', [$id, $visitor]);
        q('INSERT INTO ' . t('word_stats') . ' (word_id, word, lookups, last_at) VALUES (?, ?, 1, UTC_TIMESTAMP(6))
           ON DUPLICATE KEY UPDATE lookups = lookups + 1, word = VALUES(word), last_at = UTC_TIMESTAMP(6)', [$id, $word]);
    }

    // now and then, forget old individual lookups (the totals stay)
    if (random_int(1, 100) === 1) {
        q('DELETE FROM ' . t('lookups') . ' WHERE created_at < UTC_TIMESTAMP(6) - INTERVAL 90 DAY');
    }

    send_json(['counted' => $counted]);
}

/**
 * "50 últimas consultationes" and "Las paraulas mais cercatas": the words opened most
 * recently and most often (all time, or the last 30 / 7 days). Counts only, no names.
 */
function route_word_stats(): void
{
    if (method() !== 'GET') {
        fail('method not allowed', 405);
    }

    $period = (string) ($_GET['period'] ?? 'all');
    $days = ['30' => 30, '7' => 7][$period] ?? null;

    $latest = rows('SELECT word_id, word, lookups, last_at FROM ' . t('word_stats') . '
                    ORDER BY last_at DESC LIMIT ' . STATS_LIST);

    if ($days) {
        $top = rows('SELECT l.word_id, s.word, COUNT(*) AS lookups
                     FROM ' . t('lookups') . ' l JOIN ' . t('word_stats') . ' s ON s.word_id = l.word_id
                     WHERE l.created_at > UTC_TIMESTAMP(6) - INTERVAL ' . $days . ' DAY
                     GROUP BY l.word_id, s.word ORDER BY lookups DESC, s.word ASC LIMIT ' . STATS_LIST);
        $totals = row('SELECT COUNT(*) AS lookups, COUNT(DISTINCT word_id) AS words FROM ' . t('lookups') . '
                       WHERE created_at > UTC_TIMESTAMP(6) - INTERVAL ' . $days . ' DAY');
    } else {
        $top = rows('SELECT word_id, word, lookups FROM ' . t('word_stats') . '
                     ORDER BY lookups DESC, word ASC LIMIT ' . STATS_LIST);
        $totals = row('SELECT COALESCE(SUM(lookups), 0) AS lookups, COUNT(*) AS words FROM ' . t('word_stats'));
    }

    send_json([
        'period' => $days ? (string) $days : 'all',
        'latest' => array_map(fn ($entry) => [
            'wordId' => $entry['word_id'], 'word' => $entry['word'],
            'lookups' => (int) $entry['lookups'], 'at' => iso($entry['last_at']),
        ], $latest),
        'top' => array_map(fn ($entry) => [
            'wordId' => $entry['word_id'], 'word' => $entry['word'], 'lookups' => (int) $entry['lookups'],
        ], $top),
        'totals' => ['lookups' => (int) ($totals['lookups'] ?? 0), 'words' => (int) ($totals['words'] ?? 0)],
    ], 200, 'public, max-age=60');
}

/** Comment and vote counts for the words on a results page (one request instead of fifty). */
function route_counts(): void
{
    $ids = array_values(array_unique(array_filter(array_map('word_id', explode(',', (string) ($_GET['ids'] ?? ''))))));
    $ids = array_slice($ids, 0, 100);
    $counts = [];

    if ($ids) {
        foreach (rows('SELECT word_id, COUNT(*) AS n FROM ' . t('comments') . ' WHERE word_id IN (' . marks($ids) . ') GROUP BY word_id', $ids) as $found) {
            $counts[$found['word_id']]['comments'] = (int) $found['n'];
        }

        foreach (rows('SELECT word_id, COUNT(*) AS n FROM ' . t('votes') . ' WHERE word_id IN (' . marks($ids) . ') GROUP BY word_id', $ids) as $found) {
            $counts[$found['word_id']]['votes'] = (int) $found['n'];
        }
    }

    send_json(['counts' => (object) $counts], 200, 'public, max-age=30');
}
