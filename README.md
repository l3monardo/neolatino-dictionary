# Dictionario Neolatino (new web version)

A rewrite of [neolatino.github.io/dictionario](https://neolatino.github.io/dictionario/) as a plain
HTML/CSS/JS site with a small PHP + MySQL backend for the community features. It reads the **same
public Google Sheet** as the current Flutter app, so editors keep working in the sheet.

The community features mirror the Interslavic hub (interslavic.forum/slovnik): same login methods,
same rules for comments and votes, same profile fields. The hub's API runs on Vercel + Postgres; this
one is a PHP port that runs on ordinary Hostinger hosting next to the site.

The Telegram bot that answers from the same sheet is in its own repository:
[neolatino-telegram-bot](https://github.com/l3monardo/neolatino-telegram-bot).

## Features

**Interface** — the same layout and components as the Interslavic dictionary, in Neolatino red:
sticky header (logo, *Alphabeto*, *Últimas consultationes* and *Última activitate* buttons,
light/dark switch, account button, page menu with *Sopre la app*, *Installare lo dictionario* and the
NL/EN interface switch), the search box with input language → Neolatino and folding options, result
cards with pill buttons, and on screens 1100 px and wider the open word in a pane on the right.
Light or dark follows the system until the visitor picks one (remembered). Checked from 320 px phones
to 1920 px screens: nothing scrolls sideways, and the header buttons shrink or lose their labels
instead of overlapping.

**Dictionary** (works with or without the backend)

- Two directions, switched with ⇄: any of 13 languages (or all) → Neolatino, or Neolatino → a chosen
  language (only Neolatino words are searched; the translation shows under each word). `#/?d=nl&l=spa&q=…`
- Filters: part of speech, topic › subtopic, essential/basic vocabulary, match mode.
- A–Z browsing (`#/browse/a`), word pages (`#/word/<ID>`), verb conjugations for every verb.
- Share a word's link: the share sheet on phones, copied to the clipboard on computers.
- Share as image (1080 px PNG with a QR code): translations, conjugation, intelligibility.
- **Comparare con…**, as in the Interslavic dictionary: a search box above a word's translations or
  conjugation adds up to three more words (four in all), each in its own column with × to remove
  it. The box searches like the main one (any language → Neolatino, or ⇄ Neolatino → a language),
  with arrow keys and Enter; in the conjugation only verbs are offered. Side by side (↔) the row
  scrolls sideways with arrows when it doesn't fit; one below another (↕) suits phones. While
  comparing, the card widens (on wide screens the result list narrows and the side pane takes the
  rest). The comparison stays when switching between translations and conjugation, and ends with
  another tab, another word or a new search.
- **Translations link to Wiktionary**, as in the Interslavic dictionary: each word of a natural
  language opens a small menu (*Dictionarios extèrnos*) → *Wiktionary* shows the word's page from the
  Wiktionary in that language under the table (Portuguese → pt.wiktionary.org, Sardinian →
  sc.wiktionary.org…), or *Aprire en nòva fenèstra*. Interslavic words open the Interslavic
  dictionary. Inter-Romance, Folkspraak and Frenkisch have no Wiktionary, so they stay plain text.
  Page names follow Wiktionary: no notes in brackets, English verbs without "to", Romanian without
  "a", common words in lower case, proper nouns capitalized.
- **Installable** (`manifest.json`, `sw.js`, `icons/`): *Installare lo dictionario* in the menu and
  on the About page. Chrome, Edge and Samsung Internet show their install dialog; Safari and Firefox
  get step-by-step instructions (iPhone / iPad, Android, computer). The installed app opens in its own
  window and works offline: the service worker keeps the last copy of the site, the dictionary keeps
  its copy of the sheet. Online, it always loads the newest files first.
- **Sopre la app** (`#/about`): developed by Glěb Dyndar (gleb.onl), based on a fork of the
  Interslavic dictionary, links to the source code and the data, version.

**Community** (needs the backend in `api/`)

- Sign in with **Telegram** or **Google**.
- **☆ Favourites**: stars work for everyone (kept in the browser); signed in, they sync to the
  account and show on the public profile.
- **Search history** of signed-in users (private, last 1000, can be cleared).
- **Intelligibility**: signed-in users with a native Romance language vote one of six answers
  (Comprèndo / … en contèxto / … gratias ad una lengua non nativa / Non sapio / Falso amico /
  Non comprèndo). Statistics are public: totals, a bar per native language, a table, lookup count.
- **Comments** on every word: ▲ / ▼ (not on your own), edit (marked *modificato*), delete,
  link to one comment, `**bold**`, `*italic*`, `> quote` (toolbar + Ctrl+B / Ctrl+I, Ctrl+Enter sends).
  At most 2000 characters, 10 per 10 minutes, no duplicates.
- **Profile** (`#/profile`): photo (framed in the browser, saved as 256 px JPEG), bio (300
  characters), links (Facebook, Instagram, Telegram, Discord, Reddit, Wikipedia, YouTube, TikTok —
  only each network's own site is accepted), languages (native Romance, other Romance and
  non-Romance with CEFR levels A1–C2), favourites, search history. Reputation = upvotes from others.
- **Public pages**: `#/user/<id>` (languages, favourites, votes, comments), `#/users` (searchable).
- **Last activity** (`#/activity`): newest comments and newest votes of everyone.
- **Word statistics** (`#/lookups`, *Últimas consultationes* in the header): the *50 últimas
  consultationes* and *Las paraulas mais cercatas* (all time, 30 days or 7 days), counted for every
  visitor without names. Side by side on wide screens, two tabs on phones.

## Files

```
index.html, styles.css, favicon.svg
manifest.json   web app manifest (name, icons, colours, screenshots for the install dialog)
sw.js           service worker: installable + offline copy (never touches api/)
icons/          app icons (192, 512, maskable 512, Apple touch 180)
screenshots/    shown by Chrome's install dialog
app.js          dictionary: data, search, filters, browse, word pages, panels, Wiktionary menu,
                About page, install, routing
community.js    sign-in, favourites, history, intelligibility, comments, profiles, activity,
                word statistics
share.js        share link + share as image
conjugator.js   conjugation engine + official data (generated from tools/)
vendor/qrcode.js  QR code generator (Kazuhiko Arase, MIT licence)
api/            PHP backend (PHP 8.0+, MySQL 5.7+ / MariaDB 10.3+)
  index.php           the only public entry point: api/?r=<route>
  _lib.php            config, database, schema, sessions
  _account.php        sign-in, me, favourites, history
  _community.php      languages, votes, comments, users, activity, bio/links, avatars, lookups
  config.sample.php   copy to config.php and fill in
  .htaccess           blocks direct access to config.php and _*.php
tools/          conjugation data export and tests (not needed on the server)
```

## Setting it up on Hostinger (gleb.onl/neolatino)

1. **Upload** everything except `tools/`, `README.md` and `.gitignore` into `public_html/neolatino/`
   (keep the `api/`, `vendor/`, `icons/` and `screenshots/` folders; if the bot's folder sits next to
   these files, leave it out too). Make sure both `.htaccess` files (`neolatino/.htaccess`
   and `api/.htaccess`) are uploaded: they're hidden files, so turn on "show hidden files" in the
   file manager or your FTP client.
2. **PHP version**: hPanel → Advanced → PHP Configuration → 8.1 or newer.
3. **Database**: hPanel → Databases → MySQL Databases → create a database and a user
   (Hostinger names them like `u123456789_neolatino`). Note the name, user and password.
4. **Config**: in `api/`, copy `config.sample.php` to `config.php` and fill in:
   - `db_name`, `db_user`, `db_password` (`db_host` stays `localhost`)
   - `auth_secret`: a random string of 64+ characters (for example from
     random.org/strings, or `openssl rand -hex 32`). It signs the sign-in sessions.
5. **Check**: open `https://gleb.onl/neolatino/api/?r=config` — you should see
   `{"telegramBot":null,"googleClientId":null}`. Then open
   `https://gleb.onl/neolatino/api/?r=community/users` — `{"users":[],"more":false}` means the
   database works (the tables were just created). `https://gleb.onl/neolatino/api/config.php`
   must **not** show anything (403 or 404).
6. **Telegram sign-in**: in Telegram, @BotFather → `/newbot` (e.g. *Dictionario Neolatino*,
   username like `NeolatinoDictionarioBot`), then `/setdomain` → choose the bot → `gleb.onl`.
   Put the username (without @) and the token into `telegram_bot_username` and
   `telegram_bot_token`. (You could instead add `gleb.onl` to the allowed domains of the
   Interslavic bot, but the sign-in prompt would then say "MedzuslovjanskyBot".)
7. **Google sign-in**: Google Cloud Console → APIs & Services → Credentials. Either add
   `https://gleb.onl` to *Authorized JavaScript origins* of the OAuth client the Interslavic hub
   already uses, or create a new *OAuth client ID* (type *Web application*) with that origin.
   Put the client ID into `google_client_id`. No client secret is needed.
8. Open `https://gleb.onl/neolatino/#/profile` — both sign-in buttons should appear.

**Updating later:** Hostinger's CDN tells browsers to keep CSS and JS for a week. `index.html` loads
them as `app.js?v=20261023b` etc.: after uploading changed files, change that `v=` value (all five
places) and upload `index.html` too — every browser then loads the new files at once, and the About
page shows the new version. The `neolatino/.htaccess` asks browsers to check for newer files on each
visit as well. `sw.js` needs no change: installed apps pick up the new files the next time they open
with a connection.

Without `api/config.php` the dictionary still works; the community buttons say the server isn't
set up yet. Set `'debug' => true` in config.php to see error details while setting up.

## Notes

- **Word identity**: comments, votes and favourites are filed under the sheet's `ID` column. Keep
  IDs stable in the sheet; if rows are renumbered, comments move to other words.
- **Who can vote**: like the Slavic rule in the hub, a voter's *native* language must be Romance;
  non-Romance languages are listed as known languages. Change `ROMANCE_LANGS` in
  `api/_community.php` (and the same list in `community.js`) to widen this.
- **Privacy**: e-mail addresses from Google are stored but never shown. Search history is private.
  Languages, votes, comments, favourites, bio and links are public on the user's page. Anonymous
  lookup counting stores only a daily-changing hash, kept 90 days.
- **Methods**: the site sends PUT/PATCH/DELETE as `POST ?m=…` and the token in an `X-Auth-Token`
  header, because some shared hosts block those verbs or strip `Authorization`.

## How conjugation works

The official conjugator at neolatino.eu (`scripts/verbos.js` + `scripts/nt.js`) has **442 verbs**,
each with roots and a class code. `tools/export-from-neolatino.js` runs its `generar_XX()` functions
with placeholder roots and saves one template per class (62 classes); all 441 conjugable official
verbs regenerate exactly. Other dictionary verbs are conjugated as **derived** (prefixed compounds of
an official verb, e.g. *re+prèndere*, marked "verify") or **regular** (default pattern for the
ending, with a note). `node tools/build-conjugator.js` rebuilds `conjugator.js`;
`node tools/test-conjugator.js` runs the accuracy check.

## To review

- **Neolatino interface strings** (`STR.nl` in `app.js`, the `nl:` blocks in `community.js` and
  `share.js`), especially the newest: the install steps (*Pòne lo dictionario sopre lo escrano de
  inítio…*, *Tocca lo bottone Compartire…*), *Sopre la app* (*Desveloppato per*, *Basato sopre uno
  fork del Dictionario Interslavo*, *Còdice fònte*), *Estatística de las paraulas*, *Comparare con… / Ajjóngere paraula… / Una sobto l'altra*, *Dictionarios
  extèrnos*, *Aprire en nòva fenèstra*, and the older *Tèma claro / Tèma obscuro*, *Actualizzare*, *Votare*,
  *Cambiare voto*, *Voto salvato / retirato*, *Tuos votos se contan per toa lengua nativa*,
  *Non pòtes votare tuo commènto*. The vocabulary was checked against the dictionary (*paraula*, *commènto*, *voto*,
  *usuario*, *compartire*, *legàmine*, *preferito*…) and verb forms against the official conjugator
  (*comprèndo*, *sapio*, *escrive*…), but a fluent speaker should read them.
- Part-of-speech groups come from the free-text `cat. gram.` column; an entry can be in several.
