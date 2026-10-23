<?php
/**
 * Neolatino dictionary API — one entry point: api/?r=<route>
 * (no URL rewriting needed on the host). See _community.php for the list.
 */
declare(strict_types=1);

define('NL_API', true);

require __DIR__ . '/_lib.php';
require __DIR__ . '/_account.php';
require __DIR__ . '/_community.php';

// the client always uses GET / POST; PUT, PATCH and DELETE arrive as POST ?m=…
set_exception_handler(function (Throwable $e) {
    error_log('[neolatino api] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    send_json(['error' => cfg('debug') ? $e->getMessage() : 'server error'], 500);
});

$routes = [
    'config' => 'route_config',
    'auth/telegram' => 'route_auth_telegram',
    'auth/google' => 'route_auth_google',
    'me' => 'route_me',
    'favourites' => 'route_favourites',
    'history' => 'route_history',
    'community/languages' => 'route_languages',
    'community/intelligibility' => 'route_intelligibility',
    'community/comments' => 'route_comments',
    'community/commentvote' => 'route_comment_vote',
    'community/users' => 'route_users',
    'community/recentvotes' => 'route_recent_votes',
    'community/about' => 'route_about',
    'community/avatar' => 'route_avatar',
    'community/lookup' => 'route_lookup',
    'community/counts' => 'route_counts',
];

$route = (string) ($_GET['r'] ?? '');

if (!isset($routes[$route])) {
    fail('not found', 404);
}

if ($route !== 'config' && !is_file(__DIR__ . '/config.php')) {
    fail('the API is not set up yet: copy api/config.sample.php to api/config.php and fill it in', 503);
}

if ($route !== 'config' && !in_array($route, ['auth/telegram', 'auth/google'], true)) {
    ensure_schema();
}

$routes[$route]();
