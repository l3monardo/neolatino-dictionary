/* Dictionario Neolatino — community features.
 *
 * Sign-in (Telegram, Google), favourites (☆), search history, intelligibility
 * votes and statistics, comments with ▲ / ▼, profiles, users, latest activity.
 * Mirrors the Interslavic dictionary (interslavic.forum/slovnik) — same
 * components, same rules; talks to the PHP API in api/ (same site, so no CORS
 * and no third-party cookies).
 */
(function () {
  "use strict";

  const NL = window.NL;
  if (!NL) return;
  const { hooks, esc, store, ICONS } = NL;
  const t = (key, ...args) => {
    const value = NL.t(key);
    return typeof value === "function" ? value(...args) : value ?? key;
  };
  const API = NL.CONFIG.apiBase === undefined ? "api/" : NL.CONFIG.apiBase;

  /* ── strings ───────────────────────────────────────────────── */
  // NL strings use words checked against the dictionary; please have a fluent speaker review them.
  NL.addStrings({
    nl: {
      navActivity: "Última activitate", activityTitle: "Última activitate",
      navLookups: "Últimas consultationes", lookupsMenu: "Consultationes", statsTitle: "Estatística de las paraulas",
      statsHint: "Las paraulas apèrtas en lo dictionario per totos los visitantes, sene nomes.",
      lastLookups: "50 últimas consultationes", topLookups: "Las paraulas mais cercatas",
      periodAll: "Sèmpre", period30: "30 días", period7: "7 días", statsWords: "Paraulas",
      lookupsEmpty: "Ancora sene consultationes.",
      signIn: "Entrar", signOut: "Sortire",
      signInTitle: "Entrar en lo dictionario",
      signInWhy: "Entra per votare la intelligibilitate, commentare et salvare tuos preferitos et toa història en totos tuos apparecclos.",
      signInNotSet: "Lo accèsso non èst ancora configurato.",
      signInFailed: "Non se ha potuto entrar",
      signedInWith: (p) => `Entrato con ${p}`,
      serverDown: "Non se ha potuto connectare con lo servitore.",
      star: "Preferito", starAdd: "Marcare como preferito", starRemove: "Eliminare de los preferitos",
      intelligibility: "Intelligibilitate", comments: "Commèntos",
      statsAll: "Totos los votos", statsVotes: "Votos", statsLookups: "Consultationes",
      statsByNative: "Per lengua nativa", statsTable: "Tabèlla", statsEmpty: "Ancora sene votos.",
      statsQuestion: "Comprèndes esta paraula?", statsYourVote: "Too voto",
      statsWithdraw: "Retirare lo voto", statsSignIn: "Entra per votare.",
      statsNeedLang: "Ante de votare, salva toa lengua nativa.",
      statsVote: "Votare", changeVote: "Cambiare voto", voteSaved: "Voto salvato", voteWithdrawn: "Voto retirato",
      vote_understand: "Comprèndo", vote_context: "Comprèndo en contèxto",
      vote_nonNative: "Comprèndo gratias ad una lengua non nativa", vote_unknown: "Non sapio",
      vote_falseFriend: "Falso amico", vote_notUnderstand: "Non comprèndo",
      commentPlaceholder: "Escrive uno commènto…", commentsEmpty: "Ancora sene commèntos.",
      commentsSignIn: "Entra per commentare.", send: "Enviare", save: "Salvare", cancel: "Annullare",
      edit: "Modificare", del: "Eliminare", confirmDelete: "Confirmare", edited: "modificato",
      upvote: "Votare a favore", downvote: "Votare contra", commentShare: "Compartire",
      commentVoteSignIn: "Entra per votare.", commentVoteOwn: "Non pòtes votare tuo commènto.",
      linkCopied: "Legàmine copiato",
      reputation: "reputatione",
      profile: "Profilo", bio: "Biografía", bioEmpty: "Ancora sene biografía.",
      links: "Legàmines", linksEmpty: "Ancora sene legàmines.",
      linksHint: "Nome de usuario aut legàmine complèto.",
      linksInvalid: (n) => `Legàmine de ${n} non acceptato.`,
      languages: "Lenguas", nativeLang: "Lengua nativa", othersRomance: "Altras lenguas romànicas",
      foreignLangs: "Lenguas non romànicas", addLang: "+ Lengua", chooseLang: "— lengua —",
      langsEmpty: "Ancora sene lenguas.", languagesHint: "Tuos votos se contan per toa lengua nativa.",
      photoAdd: "Ajjóngere fòto", photoChange: "Cambiare fòto", photoRemove: "Eliminare fòto",
      photoTitle: "Fòto de profilo", photoHint: "Mòve la imàgine et usa la barra per ampliare.",
      photoBad: "Esta imàgine non se pòte usare.",
      favouritesTitle: "Paraulas preferitas", favouritesEmpty: "Ancora sene preferitos: usa ☆ en uno resultato.",
      historyTitle: "Paraulas consultatas", historyEmpty: "Ancora sene consultationes.",
      historyClear: "Netejjare la història", historyPrivate: "Solo tu vedes esta lista.",
      publicNote: "Toas lenguas, tuos votos, commèntos et preferitos se mostran en toa pàgina de usuario.",
      viewPublic: "Vedere toa pàgina de usuario",
      usersTitle: "Usuarios", usersSearch: "Cercare usuarios…", usersEmpty: "Necuno usuario.",
      since: (d) => `usuario dès ${d}`,
      latestComments: "Últimos commèntos", latestVotes: "Últimos votos", refresh: "Actualizzare",
      noneYet: "Ancora sene activitate.",
      votesTitle: "Votos", now: "acora",
      ago: (n, unit) => `face ${n} ${{ m: n === 1 ? "minuto" : "minutos", h: n === 1 ? "hora" : "horas", d: n === 1 ? "día" : "días" }[unit]}`,
      error: "Errore",
    },
    en: {
      navActivity: "Latest activity", activityTitle: "Latest activity",
      navLookups: "Last lookups", lookupsMenu: "Lookups", statsTitle: "Word statistics",
      statsHint: "How often words were opened in the dictionary — all visitors, no names.",
      lastLookups: "50 latest lookups", topLookups: "Most looked-up words",
      periodAll: "All time", period30: "30 days", period7: "7 days", statsWords: "Words",
      lookupsEmpty: "No lookups yet.",
      signIn: "Sign in", signOut: "Sign out",
      signInTitle: "Sign in to the dictionary",
      signInWhy: "Sign in to vote on intelligibility, comment, and keep your favourites and history on all your devices.",
      signInNotSet: "Sign-in isn't set up yet.",
      signInFailed: "Sign-in failed",
      signedInWith: (p) => `Signed in with ${p}`,
      serverDown: "Couldn't reach the server.",
      star: "Favourite", starAdd: "Add to favourites", starRemove: "Remove from favourites",
      intelligibility: "Intelligibility", comments: "Comments",
      statsAll: "All voters", statsVotes: "Votes", statsLookups: "Lookups",
      statsByNative: "By native language", statsTable: "Table", statsEmpty: "No votes yet.",
      statsQuestion: "Do you understand this word?", statsYourVote: "Your vote",
      statsWithdraw: "Withdraw vote", statsSignIn: "Sign in to vote.",
      statsNeedLang: "Before voting, save your native language.",
      statsVote: "Vote", changeVote: "Change vote", voteSaved: "Vote saved", voteWithdrawn: "Vote withdrawn",
      vote_understand: "I understand", vote_context: "I understand in context",
      vote_nonNative: "I understand thanks to a non-native language", vote_unknown: "Don't know",
      vote_falseFriend: "False friend", vote_notUnderstand: "I don't understand",
      commentPlaceholder: "Write a comment…", commentsEmpty: "No comments yet — be the first.",
      commentsSignIn: "Sign in to comment.", send: "Send", save: "Save", cancel: "Cancel",
      edit: "Edit", del: "Delete", confirmDelete: "Confirm", edited: "edited",
      upvote: "Upvote", downvote: "Downvote", commentShare: "Share",
      commentVoteSignIn: "Sign in to vote.", commentVoteOwn: "You can't vote on your own comment.",
      linkCopied: "Link copied",
      reputation: "reputation",
      profile: "Profile", bio: "About me", bioEmpty: "Nothing here yet.",
      links: "Links", linksEmpty: "No links yet.",
      linksHint: "Username or full link.",
      linksInvalid: (n) => `Not a valid ${n} address or username.`,
      languages: "Languages", nativeLang: "Native language", othersRomance: "Other Romance languages",
      foreignLangs: "Non-Romance languages", addLang: "+ Language", chooseLang: "— language —",
      langsEmpty: "No languages yet.", languagesHint: "Your votes are grouped by your native language.",
      photoAdd: "Add photo", photoChange: "Change photo", photoRemove: "Remove photo",
      photoTitle: "Profile photo", photoHint: "Drag to move, use the slider to zoom.",
      photoBad: "This picture can't be used.",
      favouritesTitle: "Favourite words", favouritesEmpty: "No favourites yet: use ☆ on a result.",
      historyTitle: "Search history", historyEmpty: "Nothing yet.",
      historyClear: "Clear history", historyPrivate: "Only you can see this list.",
      publicNote: "Your languages, votes, comments and favourites appear on your public page.",
      viewPublic: "View your public page",
      usersTitle: "Users", usersSearch: "Search users…", usersEmpty: "No users.",
      since: (d) => `member since ${d}`,
      latestComments: "Latest comments", latestVotes: "Latest votes", refresh: "Refresh",
      noneYet: "No activity yet.",
      votesTitle: "Votes", now: "just now",
      ago: (n, unit) => new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(-n, { m: "minute", h: "hour", d: "day" }[unit]),
      error: "Error",
    },
  });

  /* ── languages (must match api/_community.php) ─────────────── */
  const ROMANCE = ["pt", "gl", "mwl", "ast", "es", "an", "ca", "oc", "fr", "frp", "wa", "pcd", "it", "vec", "lmo", "pms",
    "lij", "nap", "scn", "co", "sc", "fur", "lld", "rm", "ro", "rup", "lad"];
  const NON_ROMANCE = ["en", "de", "nl", "sv", "da", "no", "is", "fi", "et", "lv", "lt", "hu", "el", "sq", "mt", "eu", "br", "cy",
    "ga", "ru", "uk", "be", "pl", "cs", "sk", "sl", "hr", "sr", "bs", "mk", "bg", "isv", "eo", "ia", "la",
    "tr", "ar", "he", "fa", "hi", "zh", "ja", "ko", "vi", "ka", "hy", "kk", "id", "tl", "sw"];
  const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
  // Neolatino names from the dictionary itself (English column "russian" → "russo", …)
  const NL_NAMES = { pt: "Portughese", es: "Castellano", ca: "Catalano", oc: "Occitano", fr: "Francese", sc: "Sardo",
    it: "Italiano", ro: "Rumeno", en: "Anglese", isv: "Interslavo", de: "Alemanno", nl: "Holandese", sv: "Suedese",
    da: "Danese", fi: "Finlandese", ga: "Irlandese", ru: "Russo", cs: "Cèco", hr: "Croato", sr: "Sèrbo", el: "Grèco",
    tr: "Turco", zh: "Cinese", ja: "Japonese", la: "Latino", eo: "Esperanto", ia: "Interlingua" };
  // smaller Romance languages by their own (Latin-script) name
  const OWN_NAMES = { mwl: "mirandés", ast: "asturianu", an: "aragonés", frp: "arpetan", wa: "walon", pcd: "picard",
    vec: "vèneto", lmo: "lombard", pms: "piemontèis", lij: "ligure", nap: "napulitano", scn: "sicilianu", co: "corsu",
    fur: "furlan", lld: "ladin", rm: "rumantsch", rup: "armãneashti", lad: "djudeo-espanyol", gl: "galego" };
  const EN_NAMES = { mwl: "Mirandese", frp: "Franco-Provençal", pcd: "Picard", vec: "Venetian", lmo: "Lombard",
    pms: "Piedmontese", lij: "Ligurian", nap: "Neapolitan", scn: "Sicilian", fur: "Friulian", lld: "Ladin",
    rup: "Aromanian", lad: "Judaeo-Spanish", isv: "Interslavic", ia: "Interlingua" };
  const capital = (s) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

  function langName(code) {
    if (!code) return "";
    if (NL.ui() === "nl") {
      if (NL_NAMES[code]) return NL_NAMES[code];
      if (OWN_NAMES[code]) return capital(OWN_NAMES[code]);
      // the rest (Polish, Hungarian, Arabic…): the Italian name, readable for every Romance speaker
      try {
        const name = new Intl.DisplayNames(["it"], { type: "language" }).of(code);
        if (name && name !== code) return capital(name);
      } catch { /* unknown to this browser */ }
      return code;
    }
    if (EN_NAMES[code]) return EN_NAMES[code];
    try {
      const name = new Intl.DisplayNames(["en"], { type: "language" }).of(code);
      if (name && name !== code) return name;
    } catch { /* unknown to this browser */ }
    return code;
  }

  /* ── votes ─────────────────────────────────────────────────── */
  const VOTES = ["understand", "context", "nonNative", "unknown", "falseFriend", "notUnderstand"];
  const voteLabel = (v) => t("vote_" + v);
  const swatch = (v) => `<span class="vote-swatch vote-${v}" aria-hidden="true"></span>`;
  const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);

  /* ── time ──────────────────────────────────────────────────── */
  const locale = () => (NL.ui() === "en" ? "en-US" : "it-IT");
  function fullDate(iso) {
    try { return new Date(iso).toLocaleString(locale(), { dateStyle: "medium", timeStyle: "short" }); } catch { return iso; }
  }
  function shortDate(iso) {
    try { return new Date(iso).toLocaleDateString(locale(), { year: "numeric", month: "short", day: "numeric" }); } catch { return iso; }
  }
  function when(iso, className = "") {
    if (!iso) return "";
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    let text;
    if (s < 60) text = t("now");
    else if (s < 3600) text = t("ago", Math.floor(s / 60), "m");
    else if (s < 86400) text = t("ago", Math.floor(s / 3600), "h");
    else if (s < 30 * 86400) text = t("ago", Math.floor(s / 86400), "d");
    else text = shortDate(iso);
    return `<time${className ? ` class="${className}"` : ""} datetime="${esc(iso)}" title="${esc(fullDate(iso))}">${esc(text)}</time>`;
  }

  /* ── API client ────────────────────────────────────────────── */
  class ApiError extends Error {
    constructor(message, status, data) { super(message); this.status = status; this.data = data; }
  }
  const TOKEN_KEY = "nl-auth-token";
  const getToken = () => store.get(TOKEN_KEY, "");

  async function api(route, { method = "GET", body, params = {} } = {}) {
    if (API === null) throw new ApiError(t("serverDown"), 0);
    const query = new URLSearchParams({ r: route, ...params });
    let httpMethod = method;
    // PUT / PATCH / DELETE travel as POST ?m=… (some hosts block those verbs)
    if (["PUT", "PATCH", "DELETE"].includes(method)) { query.set("m", method); httpMethod = "POST"; }
    const headers = {};
    const token = getToken();
    if (token) headers["X-Auth-Token"] = token;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    let res;
    try {
      res = await fetch(`${API}?${query}`, { method: httpMethod, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch {
      throw new ApiError(t("serverDown"), 0);
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      if (res.status === 401 && token) signedOutLocally();
      throw new ApiError((data && data.error) || `${t("error")} ${res.status}`, res.status, data);
    }
    return data;
  }
  const avatarUrl = (id, v) => `${API}?r=community/avatar&id=${encodeURIComponent(id)}&v=${encodeURIComponent(v)}`;

  /* ── session state ─────────────────────────────────────────── */
  const state = { config: null, user: null, languages: null, available: API !== null, booted: false };

  function signedOutLocally() {
    store.set(TOKEN_KEY, "");
    state.user = null;
    state.languages = null;
    // favourites and history live in the account; they come back on the next sign-in
    saveLocalFavourites([]);
    renderAccount();
  }

  async function loadMe() {
    if (!getToken()) return;
    try {
      const me = await api("me");
      if (!me.user) { signedOutLocally(); return; }
      state.user = me.user;
      state.languages = me.languages;
      await mergeFavourites(me.favourites || []);
    } catch (e) {
      if (e.status !== 401) console.warn("me:", e.message);
    }
  }

  async function boot() {
    if (API === null) { state.booted = true; return; }
    try {
      state.config = await api("config");
    } catch {
      state.available = false;
    }
    if (state.available) await loadMe();
    state.booted = true;
    renderAccount();
  }

  async function login(route, payload) {
    const result = await api(route, { method: "POST", body: payload });
    store.set(TOKEN_KEY, result.token);
    await loadMe();
    renderAccount();
    NL.route();
  }

  function logout() {
    flushFavourites();
    signedOutLocally();
    NL.route();
  }

  // signing in or out in another tab: follow it here
  window.addEventListener("storage", async (ev) => {
    if (ev.key !== TOKEN_KEY) return;
    if (ev.newValue) await loadMe();
    else { state.user = null; state.languages = null; }
    renderAccount();
    NL.route();
  });

  /* ── favourites (☆) — local first, synced while signed in ──── */
  const FAV_KEY = "nl-favourites";
  function localFavourites() {
    try { return JSON.parse(store.get(FAV_KEY, "[]")) || []; } catch { return []; }
  }
  function saveLocalFavourites(list) { store.set(FAV_KEY, JSON.stringify(list)); }
  const isFavourite = (id) => localFavourites().some((f) => f.id === String(id));
  let favTimer = null;

  function syncFavourites() {
    if (!state.user) return;
    clearTimeout(favTimer);
    favTimer = setTimeout(flushFavourites, 800);
  }
  function flushFavourites() {
    if (!favTimer || !state.user) return;
    clearTimeout(favTimer);
    favTimer = null;
    api("favourites", { method: "PUT", body: { favourites: localFavourites() } }).catch((e) => console.warn("favourites:", e.message));
  }
  async function mergeFavourites(server) {
    const local = localFavourites();
    const byId = new Map(server.map((f) => [f.id, f]));
    let added = false;
    for (const f of local) if (!byId.has(f.id)) { byId.set(f.id, f); added = true; }
    const merged = [...byId.values()].sort((a, b) => String(b.addedAt).localeCompare(String(a.addedAt)));
    saveLocalFavourites(merged);
    if (added) await api("favourites", { method: "PUT", body: { favourites: merged } }).catch(() => {});
  }
  function toggleFavourite(id, word) {
    const list = localFavourites();
    const at = list.findIndex((f) => f.id === String(id));
    if (at >= 0) list.splice(at, 1);
    else list.unshift({ id: String(id), word, addedAt: new Date().toISOString() });
    saveLocalFavourites(list);
    syncFavourites();
    return at < 0;
  }
  window.addEventListener("pagehide", flushFavourites);

  /* ── search history (signed in) and lookup counts (everyone) ─ */
  const historyQueue = [];
  const historySeen = new Map();
  let historyTimer = null;
  function recordHistory(entry) {
    if (!state.user) return;
    const last = historySeen.get(entry.id) || 0;
    if (Date.now() - last < 10 * 60 * 1000) return;
    historySeen.set(entry.id, Date.now());
    const s = NL.parseHash().params;
    const lang = s.l && s.l !== "all" && s.l !== "lat" ? s.l : null;
    const li = lang ? NL.LANG_INDEX[lang] : null;
    historyQueue.push({ id: entry.id, word: entry.v[0], translation: li ? entry.v[li] : null, lang, at: Date.now() });
    clearTimeout(historyTimer);
    historyTimer = setTimeout(() => {
      const items = historyQueue.splice(0, 50);
      if (items.length) api("history", { method: "POST", body: { items } }).catch(() => {});
    }, 3000);
  }

  const LOOKUP_KEY = "nl-lookups-counted";
  const lookupQueue = new Map();
  let lookupTimer = null;
  function countLookup(entry) {
    if (!state.available || API === null) return;
    let seen = {};
    try { seen = JSON.parse(sessionStorage.getItem(LOOKUP_KEY) || "{}"); } catch { /* private mode */ }
    if (seen[entry.id] && Date.now() - seen[entry.id] < 30 * 60 * 1000) return;
    seen[entry.id] = Date.now();
    try { sessionStorage.setItem(LOOKUP_KEY, JSON.stringify(seen)); } catch { /* private mode */ }
    lookupQueue.set(entry.id, entry.v[0]);
    clearTimeout(lookupTimer);
    lookupTimer = setTimeout(flushLookups, 4000);
  }
  function flushLookups() {
    if (!lookupQueue.size) return;
    const items = [...lookupQueue].map(([id, word]) => ({ id, word }));
    lookupQueue.clear();
    api("community/lookup", { method: "POST", body: { items } }).catch(() => {});
  }
  window.addEventListener("pagehide", flushLookups);

  hooks.onOpen.push((entry, what) => {
    countLookup(entry);
    if (what === "word" || what === "tr" || what === "cj") recordHistory(entry);
  });

  /* ── small shared pieces ───────────────────────────────────── */
  /** A user's picture, or their initial on a coloured circle (a stable hue per person). */
  function avatarHTML(id, name, version, size = 32) {
    if (version && id && API !== null) {
      return `<img class="avatar" src="${esc(avatarUrl(id, version))}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async" style="--size:${size}px">`;
    }
    const initial = ([...String(name || "?").trim()][0] || "?").toUpperCase();
    let hue = 0;
    if (id) hue = Math.round((Number(id) * 137.508) % 360);
    else for (const ch of String(name || "")) hue = (hue * 31 + ch.codePointAt(0)) % 360;
    return `<span class="avatar avatar--initial" style="--size:${size}px;--hue:${hue}" aria-hidden="true">${esc(initial)}</span>`;
  }
  const wordChip = (id, word) => `<a class="word-chip" href="#/word/${encodeURIComponent(id)}">${esc(word)}</a>`;
  const errorText = (e) => (e && e.message) || String(e);
  const toast = (m) => NL.toast(m);
  const reputationHTML = (n) => `<span class="reputation"><span class="reputation__arrow" aria-hidden="true">▲</span><b>${n || 0}</b> ${esc(t("reputation"))}</span>`;

  /** Copy text; falls back to a hidden field when the clipboard is refused. */
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch { ok = false; }
      area.remove();
      return ok;
    }
  }

  Object.assign(NL, { community: { api, state, langName, voteLabel, VOTES, avatarHTML, when, toast, copyText, isFavourite } });

  /* ── header: account button, menu entries ──────────────────── */
  const PERSON = '<svg class="account-button__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  let onProfilePage = false;

  function renderAccount() {
    const box = document.getElementById("account");
    if (!box) return;
    box.hidden = !state.available;
    const u = state.user;
    const active = onProfilePage ? " active" : "";
    box.innerHTML = u
      ? `<a class="account-button signed-in${active}" href="#/profile" title="${esc(`${t("profile")}: ${u.name}`)}" aria-label="${esc(`${t("profile")}: ${u.name}`)}">${avatarHTML(u.id, u.name, u.avatar, 28)}</a>`
      : `<a class="account-button${active}" href="#/profile">${PERSON}<span class="account-button__text">${esc(t("signIn"))}</span></a>`;
    NL.renderMenu();
  }
  hooks.onUi.push(renderAccount);
  hooks.onRoute.push((name) => {
    const was = onProfilePage;
    onProfilePage = name === "profile";
    if (was !== onProfilePage) renderAccount();
  });
  hooks.menu.push(
    { name: "activity", icon: "🕒", label: () => t("activityTitle"), href: "#/activity", order: 40 },
    { name: "lookups", icon: "📊", label: () => t("lookupsMenu"), href: "#/lookups", order: 45 },
    { name: "users", icon: "👥", label: () => t("usersTitle"), href: "#/users", order: 50 },
    { name: "profile", icon: "⭐", label: () => (state.user ? t("profile") : t("signIn")), href: "#/profile", order: 60 },
  );

  /* ── ☆ on every word card ──────────────────────────────────── */
  const starButton = (id, on) =>
    `<button type="button" class="action-button star-button${on ? " starred" : ""}" data-star="${esc(id)}" aria-pressed="${on}" title="${esc(t(on ? "starRemove" : "starAdd"))}">` +
    `<span class="action-button__icon"><span class="action-button__glyph" aria-hidden="true">${on ? "★" : "☆"}</span></span><span class="action-button__label">${esc(t("star"))}</span></button>`;
  hooks.entryActions.push((entry) => starButton(entry.id, isFavourite(entry.id)));
  document.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-star]");
    if (!btn) return;
    const id = btn.dataset.star;
    const entry = NL.D.byId.get(id);
    const known = localFavourites().find((f) => f.id === id);
    const on = toggleFavourite(id, entry ? entry.v[0] : known ? known.word : id);
    document.querySelectorAll(`.action-button[data-star="${CSS.escape(id)}"]`).forEach((b) => {
      b.setAttribute("aria-pressed", String(on));
      b.classList.toggle("starred", on);
      b.title = t(on ? "starRemove" : "starAdd");
      b.querySelector(".action-button__glyph").textContent = on ? "★" : "☆";
    });
    if (btn.classList.contains("word-list__remove")) renderFavouriteList();
  });

  /* ── comment markup: **bold**, *italic*, > quote — escaped first, never raw HTML ── */
  function inline(text) {
    return text
      .replace(/\*\*([^\n]+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, "$1<em>$2</em>");
  }
  function formatComment(raw) {
    const blocks = [];
    for (const line of String(raw).split("\n")) {
      const quote = /^\s*>/.test(line);
      const content = quote ? line.replace(/^\s*>\s?/, "") : line;
      const last = blocks[blocks.length - 1];
      if (last && last.quote === quote) last.lines.push(content);
      else blocks.push({ quote, lines: [content] });
    }
    return blocks.map((b) => {
      const html = b.lines.map((l) => inline(esc(l))).join("<br>");
      return b.quote ? `<blockquote>${html}</blockquote>` : `<p>${html}</p>`;
    }).join("");
  }
  const commentLength = (s) => [...s.trim()].length;
  const COMMENT_MAX = 2000;
  const ARROW = (down) => `<svg viewBox="0 0 16 16" aria-hidden="true" class="comment__arrow${down ? " down" : ""}"><path d="M8 1.5 15 9.5h-4.25V15h-5.5V9.5H1z" fill="currentColor"/></svg>`;
  const LINK_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.5 9.5 9.5 6.5M7 4.5l1.3-1.3a2.5 2.5 0 0 1 3.5 3.5L10.5 8M9 11.5l-1.3 1.3a2.5 2.5 0 0 1-3.5-3.5L5.5 8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

  /** One comment — shared by the word tab, the latest-activity page and user pages. */
  function commentHTML(c, { showWord = false } = {}) {
    const own = c.mine;
    const blocked = !state.user ? "signin" : own ? "own" : "";
    return `<li class="comment${own ? " mine" : ""}" id="comment-${c.id}" data-cid="${c.id}" data-word-id="${esc(c.wordId)}">
      <div class="comment__head">
        ${showWord ? wordChip(c.wordId, c.word) : ""}
        <a class="comment__author" href="#/user/${encodeURIComponent(c.authorId)}">${avatarHTML(c.authorId, c.author, c.authorAvatar, 22)}${esc(c.author)}</a>
        ${when(c.at, "comment__time")}
        ${c.editedAt ? `<span class="comment__edited" title="${esc(fullDate(c.editedAt))}">${esc(t("edited"))}</span>` : ""}
        ${own ? `<span class="comment__tools"><button type="button" class="comment__tool" data-cedit>${esc(t("edit"))}</button><button type="button" class="comment__tool comment__delete" data-cdel>${esc(t("del"))}</button></span>` : ""}
      </div>
      <div class="comment__body">${formatComment(c.body)}</div>
      <div class="comment__foot">
        <div class="comment__votes${blocked ? " blocked" : ""}" data-blocked="${blocked}">
          <button type="button" class="comment__vote up" data-cvote="1" aria-pressed="${c.myVote === 1}" title="${esc(t("upvote"))}">${ARROW(false)}<span>${c.up}</span></button>
          <button type="button" class="comment__vote down" data-cvote="-1" aria-pressed="${c.myVote === -1}" title="${esc(t("downvote"))}">${ARROW(true)}<span>${c.down}</span></button>
          <span class="comment__vote-hint" role="status"></span>
        </div>
        <button type="button" class="comment__share" data-clink>${LINK_ICON}${esc(t("commentShare"))}</button>
      </div>
    </li>`;
  }

  function editorHTML(value = "", { sendLabel = t("send"), cancel = false } = {}) {
    const n = commentLength(value);
    return `<div class="comment-editor">
      <div class="comment-editor__toolbar" role="toolbar" aria-label="${esc(t("comments"))}">
        <button type="button" data-fmt="**" title="**…** (Ctrl+B)"><b>B</b></button>
        <button type="button" data-fmt="*" title="*…* (Ctrl+I)"><i>I</i></button>
        <button type="button" data-fmt=">" title="> …"><span aria-hidden="true">❝</span></button>
      </div>
      <textarea class="comment-editor__input" rows="3" maxlength="4000" placeholder="${esc(t("commentPlaceholder"))}" aria-label="${esc(t("commentPlaceholder"))}">${esc(value)}</textarea>
      <div class="comment-editor__actions">
        <span class="form-error" role="alert"></span>
        <span class="counter${n > COMMENT_MAX ? " over" : ""}">${n} / ${COMMENT_MAX}</span>
        ${cancel ? `<button type="button" class="pill-btn pill-btn--muted" data-ecancel>${esc(t("cancel"))}</button>` : ""}
        <button type="button" class="pill-btn pill-btn--primary" data-esend${n ? "" : " disabled"}>${esc(sendLabel)}</button>
      </div>
    </div>`;
  }

  // bold / italic / quote buttons, counter, Ctrl+B / Ctrl+I / Ctrl+Enter
  function applyFormat(area, marker) {
    const { selectionStart: a, selectionEnd: b, value } = area;
    if (marker === ">") {
      const start = value.lastIndexOf("\n", a - 1) + 1;
      const nextBreak = value.indexOf("\n", b);
      const end = nextBreak === -1 ? value.length : nextBreak;
      const lines = value.slice(start, end).split("\n");
      const quoted = lines.every((l) => /^\s*>/.test(l));
      const changedText = lines.map((l) => (quoted ? l.replace(/^\s*>\s?/, "") : `> ${l}`)).join("\n");
      area.value = value.slice(0, start) + changedText + value.slice(end);
      area.setSelectionRange(start, start + changedText.length);
    } else {
      const before = value.slice(0, a), sel = value.slice(a, b), after = value.slice(b);
      if (before.endsWith(marker) && after.startsWith(marker)) {
        area.value = before.slice(0, -marker.length) + sel + after.slice(marker.length);
        area.setSelectionRange(a - marker.length, b - marker.length);
      } else {
        area.value = before + marker + sel + marker + after;
        area.setSelectionRange(a + marker.length, b + marker.length);
      }
    }
    area.focus();
    area.dispatchEvent(new Event("input", { bubbles: true }));
  }
  document.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".comment-editor [data-fmt]");
    if (btn) applyFormat(btn.closest(".comment-editor").querySelector("textarea"), btn.dataset.fmt);
  });
  document.addEventListener("input", (ev) => {
    const area = ev.target.closest && ev.target.closest(".comment-editor textarea");
    if (!area) return;
    const editor = area.closest(".comment-editor");
    const count = editor.querySelector(".counter");
    const n = commentLength(area.value);
    count.textContent = `${n} / ${COMMENT_MAX}`;
    count.classList.toggle("over", n > COMMENT_MAX);
    editor.querySelector("[data-esend]").disabled = !n || n > COMMENT_MAX;
  });
  document.addEventListener("keydown", (ev) => {
    const area = ev.target.closest && ev.target.closest(".comment-editor textarea");
    if (!area || !(ev.ctrlKey || ev.metaKey)) return;
    const key = ev.key.toLowerCase();
    if (key === "b" || key === "i") { ev.preventDefault(); applyFormat(area, key === "b" ? "**" : "*"); }
    if (key === "enter") { ev.preventDefault(); area.closest(".comment-editor").querySelector("[data-esend]").click(); }
  });

  /* ── the comments tab ──────────────────────────────────────── */
  const commentCache = new Map(); // comment id → comment (for edit / vote updates)

  async function renderComments(entry, el) {
    el.innerHTML = `<div class="word-comments"><p class="word-comments__hint">…</p></div>`;
    if (!state.available) { el.innerHTML = `<div class="word-comments"><p class="word-comments__hint">${esc(t("serverDown"))}</p></div>`; return; }
    const data = await api("community/comments", { params: { id: entry.id } });
    if (el.dataset.id !== entry.id || el.dataset.panel !== "cm") return; // another tab was opened meanwhile
    data.comments.forEach((c) => commentCache.set(c.id, c));
    el.innerHTML = `<div class="word-comments">
      ${data.comments.length
        ? `<ol class="word-comments__list">${data.comments.map((c) => commentHTML(c)).join("")}</ol>`
        : `<p class="word-comments__hint comments-empty">${esc(t("commentsEmpty"))}</p>`}
      ${state.user
        ? `<div class="comment-new" data-word-id="${esc(entry.id)}">${editorHTML()}</div>`
        : `<a class="word-comments__sign-in" href="#/profile">${esc(t("commentsSignIn"))}</a>`}
    </div>`;
    // a shared link to one comment: #/word/<id>?c=<comment id>
    const target = NL.pageParams && NL.pageParams.c;
    if (target) {
      const li = el.querySelector(`#comment-${CSS.escape(String(target))}`);
      if (li) {
        li.classList.add("highlighted");
        requestAnimationFrame(() => li.scrollIntoView({ block: "center" }));
        setTimeout(() => li.classList.remove("highlighted"), 4000);
      }
      NL.pageParams = {};
    }
  }

  function bumpCount(wordId, delta) {
    document.querySelectorAll(`[data-id="${CSS.escape(wordId)}"] [data-count="cm"]`).forEach((badge) => {
      const n = Math.max(0, (parseInt(badge.textContent, 10) || 0) + delta);
      badge.textContent = n ? String(n) : "";
    });
  }
  const showWordFor = (li) => li.closest(".activity-list, .user-detail") !== null;

  document.addEventListener("click", async (ev) => {
    // send a new comment / save an edit
    const send = ev.target.closest("[data-esend]");
    if (send) {
      const editor = send.closest(".comment-editor");
      const area = editor.querySelector("textarea");
      const error = editor.querySelector(".form-error");
      const text = area.value.trim();
      if (!text || commentLength(text) > COMMENT_MAX) { area.focus(); return; }
      send.disabled = true;
      error.textContent = "";
      try {
        const editing = editor.closest(".comment");
        if (editing) {
          const { comment } = await api("community/comments", { method: "PATCH", body: { cid: Number(editing.dataset.cid), body: text } });
          commentCache.set(comment.id, comment);
          editing.outerHTML = commentHTML(comment, { showWord: showWordFor(editing) });
        } else {
          const box = editor.closest(".comment-new");
          const wordId = box.dataset.wordId;
          const entry = NL.D.byId.get(wordId);
          const { comment } = await api("community/comments", { method: "POST", body: { id: wordId, word: entry ? entry.v[0] : wordId, body: text } });
          commentCache.set(comment.id, comment);
          const wrap = box.closest(".word-comments");
          let list = wrap.querySelector(".word-comments__list");
          if (!list) {
            wrap.querySelector(".comments-empty")?.remove();
            list = document.createElement("ol");
            list.className = "word-comments__list";
            wrap.insertBefore(list, box);
          }
          list.insertAdjacentHTML("beforeend", commentHTML(comment));
          area.value = "";
          area.dispatchEvent(new Event("input", { bubbles: true }));
          bumpCount(wordId, 1);
        }
      } catch (e) {
        error.textContent = errorText(e);
        send.disabled = false;
      }
      return;
    }

    const li = ev.target.closest(".comment");
    if (!li) return;
    const cid = Number(li.dataset.cid);
    const c = commentCache.get(cid);

    if (ev.target.closest("[data-ecancel]") && c) {
      li.outerHTML = commentHTML(c, { showWord: showWordFor(li) });
      return;
    }
    if (ev.target.closest("[data-cedit]") && c) {
      li.querySelector(".comment__body").outerHTML = editorHTML(c.body, { sendLabel: t("save"), cancel: true });
      li.querySelector(".comment__foot").hidden = true;
      li.querySelector(".comment__tools").hidden = true;
      const area = li.querySelector("textarea");
      area.focus();
      area.setSelectionRange(area.value.length, area.value.length);
      return;
    }
    const del = ev.target.closest("[data-cdel]");
    if (del) {
      // two steps instead of a confirm() dialog
      if (!del.classList.contains("confirming")) {
        del.classList.add("confirming");
        del.textContent = t("confirmDelete");
        setTimeout(() => { if (del.isConnected) { del.classList.remove("confirming"); del.textContent = t("del"); } }, 4000);
        return;
      }
      try {
        await api("community/comments", { method: "DELETE", params: { cid } });
        bumpCount(li.dataset.wordId, -1);
        li.remove();
      } catch (e) {
        toast(errorText(e));
      }
      return;
    }
    const vote = ev.target.closest("[data-cvote]");
    if (vote && c) {
      const votes = vote.closest(".comment__votes");
      const hint = votes.querySelector(".comment__vote-hint");
      const blocked = votes.dataset.blocked;
      if (blocked) {
        hint.textContent = t(blocked === "own" ? "commentVoteOwn" : "commentVoteSignIn");
        clearTimeout(hint._timer);
        hint._timer = setTimeout(() => { hint.textContent = ""; }, 3000);
        return;
      }
      const value = Number(vote.dataset.cvote);
      const next = c.myVote === value ? 0 : value;
      try {
        const r = await api("community/commentvote", { method: "POST", body: { cid, vote: next } });
        Object.assign(c, { up: r.up, down: r.down, myVote: r.myVote });
        li.querySelector(".comment__vote.up span").textContent = r.up;
        li.querySelector(".comment__vote.down span").textContent = r.down;
        li.querySelector(".comment__vote.up").setAttribute("aria-pressed", String(r.myVote === 1));
        li.querySelector(".comment__vote.down").setAttribute("aria-pressed", String(r.myVote === -1));
      } catch (e) {
        hint.textContent = errorText(e);
      }
      return;
    }
    if (ev.target.closest("[data-clink]")) {
      const url = `${location.origin}${location.pathname}#/word/${encodeURIComponent(li.dataset.wordId)}?c=${cid}`;
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        try { await navigator.share({ url }); return; } catch (e) { if (e && e.name === "AbortError") return; }
      }
      toast(await copyText(url) ? t("linkCopied") : url);
    }
  });

  /* ── language profile form (native Romance + others with CEFR levels) ── */
  function langOptions(list, selected, placeholder) {
    const sorted = [...list].sort((a, b) => NL.collator.compare(langName(a), langName(b)));
    return (placeholder ? `<option value="">${esc(placeholder)}</option>` : "") +
      sorted.map((c) => `<option value="${c}"${c === selected ? " selected" : ""}>${esc(langName(c))}</option>`).join("");
  }
  function langRowHTML(kind, entry = {}) {
    const list = kind === "others" ? ROMANCE : NON_ROMANCE;
    return `<div class="language-form__row">
      <select class="select" name="lang" aria-label="${esc(t(kind === "others" ? "othersRomance" : "foreignLangs"))}">${langOptions(list, entry.lang, t("chooseLang"))}</select>
      <select class="select select--level" name="level" aria-label="CEFR" title="CEFR">${LEVELS.map((l) => `<option${l === (entry.level || "B1") ? " selected" : ""}>${l}</option>`).join("")}</select>
      <button type="button" class="language-form__remove" data-rmlang aria-label="${esc(t("del"))}" title="${esc(t("del"))}">&times;</button>
    </div>`;
  }
  function languageFormHTML(profile, { cancel = false } = {}) {
    const p = profile || { native: "", others: [], foreign: [] };
    const list = (kind) => `<fieldset class="language-form__others" data-kind="${kind}">
      <legend class="language-form__label">${esc(t(kind === "others" ? "othersRomance" : "foreignLangs"))}</legend>
      <div class="lang-rows">${(p[kind] || []).map((e) => langRowHTML(kind, e)).join("")}</div>
      <button type="button" class="language-form__add" data-addlang="${kind}">${esc(t("addLang"))}</button>
    </fieldset>`;
    return `<form class="language-form" novalidate>
      <label class="language-form__field"><span class="language-form__label">${esc(t("nativeLang"))}</span>
        <select class="select" name="native" required>${langOptions(ROMANCE, p.native, t("chooseLang"))}</select></label>
      ${list("others")}${list("foreign")}
      <p class="hint">A1–C2 (CEFR). ${esc(t("publicNote"))}</p>
      <div class="form-actions">
        <span class="form-error" role="alert"></span>
        ${cancel ? `<button type="button" class="pill-btn pill-btn--muted" data-langcancel>${esc(t("cancel"))}</button>` : ""}
        <button type="submit" class="pill-btn pill-btn--primary">${esc(t("save"))}</button>
      </div>
    </form>`;
  }
  function readLanguageForm(form) {
    const rows = (kind) => [...form.querySelectorAll(`[data-kind="${kind}"] .language-form__row`)]
      .map((r) => ({ lang: r.querySelector('[name="lang"]').value, level: r.querySelector('[name="level"]').value }))
      .filter((e) => e.lang);
    const native = form.querySelector('[name="native"]').value;
    return { native, others: rows("others").filter((e) => e.lang !== native), foreign: rows("foreign") };
  }
  document.addEventListener("click", (ev) => {
    const add = ev.target.closest("[data-addlang]");
    if (add) {
      const rows = add.previousElementSibling;
      rows.insertAdjacentHTML("beforeend", langRowHTML(add.dataset.addlang));
      rows.lastElementChild.querySelector("select").focus();
      return;
    }
    const rm = ev.target.closest("[data-rmlang]");
    if (rm) rm.closest(".language-form__row").remove();
    const cancel = ev.target.closest("[data-langcancel]");
    if (cancel) { const form = cancel.closest(".language-form"); if (form._onCancel) form._onCancel(); }
  });
  document.addEventListener("submit", async (ev) => {
    const form = ev.target.closest(".language-form");
    if (!form) return;
    ev.preventDefault();
    const error = form.querySelector(".form-error");
    error.textContent = "";
    const data = readLanguageForm(form);
    if (!data.native) { error.textContent = t("statsNeedLang"); form.querySelector('[name="native"]').focus(); return; }
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const { profile } = await api("community/languages", { method: "PUT", body: data });
      state.languages = profile;
      if (form._onSaved) form._onSaved(profile);
    } catch (e) {
      error.textContent = errorText(e);
      submit.disabled = false;
    }
  });

  function languagesHTML(p, emptyText) {
    if (!p) return `<p class="hint">${esc(emptyText || t("langsEmpty"))}</p>`;
    const chips = (list) => (list && list.length
      ? list.map((e) => `<span class="lang-chip">${esc(langName(e.lang))} <b>${esc(e.level)}</b></span>`).join("")
      : "—");
    return `<dl class="languages-list">
      <dt>${esc(t("nativeLang"))}</dt><dd><strong>${esc(langName(p.native))}</strong></dd>
      <dt>${esc(t("othersRomance"))}</dt><dd>${chips(p.others)}</dd>
      <dt>${esc(t("foreignLangs"))}</dt><dd>${chips(p.foreign)}</dd>
    </dl>`;
  }

  /* ── the intelligibility tab ───────────────────────────────── */
  const statsCache = new Map(); // word id → last statistics

  function stackedBar(counts, total, label, thin) {
    const parts = VOTES.filter((v) => counts[v]);
    const summary = parts.map((v) => `${voteLabel(v)} ${counts[v]}`).join(", ");
    return `<div class="word-stats__bar${thin ? " thin" : ""}" role="img" aria-label="${esc(`${label}: ${summary}`)}">` +
      parts.map((v) => `<span class="word-stats__seg vote-${v}" style="flex-grow:${counts[v]}" tabindex="0">` +
        `<span class="word-stats__tip" role="tooltip"><strong>${esc(voteLabel(v))}</strong> ${counts[v]} · ${pct(counts[v], total)}%</span></span>`).join("") +
      `</div>`;
  }

  function statsHTML(entry, s) {
    const counts = s.counts || {};
    const total = s.total || 0;
    const langs = Object.entries(s.byLang || {}).sort((a, b) => b[1].total - a[1].total);
    const footer = state.user
      ? `<div class="word-stats__footer">
          ${s.mine ? `<span class="word-stats__mine">${esc(t("statsYourVote"))}: ${swatch(s.mine)} ${esc(voteLabel(s.mine))}</span>` : ""}
          <button type="button" class="pill-btn pill-btn--primary" data-open-vote="${esc(entry.id)}">${esc(s.mine ? t("changeVote") : t("statsVote"))}</button>
        </div>`
      : `<p class="word-stats__hint vote-hint"><a href="#/profile">${esc(t("statsSignIn"))}</a></p>`;
    if (!total) {
      return `<div class="word-stats" data-id="${esc(entry.id)}">
        <p class="word-stats__lookups">🔎 ${esc(t("statsLookups"))}: <strong>${s.lookups || 0}</strong></p>
        <p class="word-stats__empty">${esc(t("statsEmpty"))}</p>
        ${footer}
      </div>`;
    }
    return `<div class="word-stats" data-id="${esc(entry.id)}">
      <div class="word-stats__head">
        <span class="word-stats__title">${esc(t("statsAll"))}</span>
        <span class="word-stats__total">🔎 ${esc(t("statsLookups"))}: <strong>${s.lookups || 0}</strong> · ${esc(t("statsVotes"))}: <strong>${total}</strong></span>
      </div>
      ${stackedBar(counts, total, t("statsAll"))}
      <ul class="word-stats__legend">${VOTES.map((v) => `<li class="${counts[v] ? "" : "zero"}">${swatch(v)}<span class="word-stats__legend-label">${esc(voteLabel(v))}</span>` +
        `<span class="word-stats__legend-value">${counts[v] || 0}<span class="word-stats__legend-pct">${pct(counts[v] || 0, total)}%</span></span></li>`).join("")}</ul>
      ${langs.length ? `<section class="word-stats__langs"><h4 class="word-stats__title">${esc(t("statsByNative"))}</h4>${langs.map(([lang, g]) =>
        `<div class="word-stats__lang"><span class="word-stats__lang-name">${esc(langName(lang))}</span>${stackedBar(g.counts, g.total, langName(lang), true)}<span class="word-stats__lang-total">${g.total}</span></div>`).join("")}</section>` : ""}
      <details class="word-stats__table-wrap"><summary>${esc(t("statsTable"))}</summary><div class="word-stats__table-scroll"><table class="word-stats__table">
        <thead><tr><th scope="col">${esc(t("nativeLang"))}</th>${VOTES.map((v) => `<th scope="col">${esc(voteLabel(v))}</th>`).join("")}<th scope="col">Σ</th></tr></thead>
        <tbody>${langs.map(([lang, g]) => `<tr><th scope="row">${esc(langName(lang))}</th>${VOTES.map((v) => `<td>${g.counts[v] || 0}</td>`).join("")}<td>${g.total}</td></tr>`).join("")}
        <tr class="word-stats__table-total"><th scope="row">${esc(t("statsAll"))}</th>${VOTES.map((v) => `<td>${counts[v] || 0}</td>`).join("")}<td>${total}</td></tr></tbody>
      </table></div></details>
      ${NL.panelFooter("st", entry, {})}
      ${footer}
    </div>`;
  }

  async function renderStats(entry, el) {
    if (!state.available) { el.innerHTML = `<p class="word-stats__hint">${esc(t("serverDown"))}</p>`; return; }
    el.innerHTML = `<div class="word-stats"><p class="word-stats__hint">…</p></div>`;
    const s = await api("community/intelligibility", { params: { id: entry.id } });
    if (el.dataset.id !== entry.id || el.dataset.panel !== "st") return;
    statsCache.set(entry.id, s);
    el.innerHTML = statsHTML(entry, s);
  }

  /** After a vote: every open statistics view of that word, and the counts. */
  function showStats(entry, s) {
    statsCache.set(entry.id, s);
    document.querySelectorAll(`.word-stats[data-id="${CSS.escape(entry.id)}"]`).forEach((box) => { box.outerHTML = statsHTML(entry, s); });
    NL.setCount(entry.id, "st", s.total);
  }

  /** "Intelligibilitate": choose one of the six answers (native language first). */
  function openVoteDialog(entry) {
    const dialog = NL.openModal(
      `${NL.dialogHeader(`${esc(t("intelligibility"))}<span class="dialog__word">${esc(entry.v[0])}</span>`)}<div class="dialog__body"></div>`,
      { className: "vote-dialog", label: t("intelligibility") });
    const body = dialog.el.querySelector(".dialog__body");
    let mine = (statsCache.get(entry.id) || {}).mine || null;
    let message = null;

    function showForm(editing) {
      body.innerHTML = `<p class="vote-dialog__text">${esc(editing ? t("languagesHint") : t("statsNeedLang"))}</p>${languageFormHTML(state.languages, { cancel: editing })}`;
      const form = body.querySelector(".language-form");
      form._onSaved = () => draw();
      form._onCancel = () => draw();
      form.querySelector("select").focus();
    }
    function draw() {
      if (!state.user) { body.innerHTML = `<p class="vote-dialog__text"><a href="#/profile">${esc(t("statsSignIn"))}</a></p>`; return; }
      if (!state.languages) { showForm(false); return; }
      body.innerHTML = `<p class="vote-dialog__question">${esc(t("statsQuestion"))}</p>
        <div class="vote-dialog__options" role="radiogroup" aria-label="${esc(t("intelligibility"))}">${VOTES.map((v) =>
          `<button type="button" role="radio" class="vote-dialog__option vote-opt" data-vote="${v}" aria-checked="${mine === v}">${swatch(v)}<span class="vote-dialog__option-label">${esc(voteLabel(v))}</span>${mine === v ? '<span class="vote-dialog__check" aria-hidden="true">✓</span>' : ""}</button>`).join("")}</div>
        <p class="vote-dialog__message${message && message.error ? " error" : ""}" role="status">${message ? esc(message.text) : ""}</p>
        <div class="vote-dialog__footer">
          <span>${esc(t("nativeLang"))}: <strong>${esc(langName(state.languages.native))}</strong> · <button type="button" class="text-btn" data-edit-langs>${esc(t("edit"))}</button></span>
          ${mine ? `<button type="button" class="text-btn" data-vote="">${esc(t("statsWithdraw"))}</button>` : ""}
        </div>`;
    }
    body.addEventListener("click", async (ev) => {
      if (ev.target.closest("[data-edit-langs]")) { showForm(true); return; }
      const btn = ev.target.closest("[data-vote]");
      if (!btn) return;
      const vote = btn.dataset.vote || null;
      body.querySelectorAll("[data-vote]").forEach((b) => (b.disabled = true));
      try {
        const s = await api("community/intelligibility", { method: "POST", body: { id: entry.id, word: entry.v[0], vote } });
        mine = s.mine || null;
        message = { text: vote ? t("voteSaved") : t("voteWithdrawn") };
        showStats(entry, s);
      } catch (e) {
        if (e.data && e.data.code === "NO_PROFILE") { state.languages = null; message = null; }
        else message = { text: errorText(e), error: true };
      }
      draw();
    });
    draw();
  }
  document.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-open-vote]");
    if (!btn) return;
    const entry = NL.D.byId.get(btn.dataset.openVote);
    if (entry) openVoteDialog(entry);
  });

  /* ── the two tabs, and their counts on result cards ────────── */
  hooks.panels.push({ key: "st", icon: ICONS.stats, label: () => t("intelligibility"), render: renderStats });
  hooks.panels.push({ key: "cm", icon: ICONS.comments, label: () => t("comments"), render: renderComments });

  hooks.afterResults.push(async (box, entries) => {
    if (!state.available || !entries.length) return;
    try {
      const { counts } = await api("community/counts", { params: { ids: entries.map((e) => e.id).join(",") } });
      for (const e of entries) {
        NL.setCount(e.id, "cm", counts[e.id]?.comments || 0);
        NL.setCount(e.id, "st", counts[e.id]?.votes || 0);
      }
    } catch { /* counts are a nicety */ }
  });

  /* ── profile links ─────────────────────────────────────────── */
  const NETWORKS = [
    ["facebook", "Facebook", "👥", "facebook.com/…"],
    ["instagram", "Instagram", "📷", "@…"],
    ["telegram", "Telegram", "✈️", "@…"],
    ["discord", "Discord", "🎮", "username"],
    ["reddit", "Reddit", "💬", "u/… · reddit.com/user/…"],
    ["wikipedia", "Wikipedia", "📖", "User name · wikipedia.org/wiki/User:…"],
    ["youtube", "YouTube", "▶️", "@… · youtube.com/@…"],
    ["tiktok", "TikTok", "🎵", "@…"],
  ];
  function linksHTML(links) {
    const items = NETWORKS.filter(([key]) => links && links[key]).map(([key, label, icon]) => {
      const value = String(links[key]);
      return /^https:\/\//.test(value)
        ? `<li><a class="social-links__item" href="${esc(value)}" target="_blank" rel="me noopener noreferrer nofollow ugc" title="${esc(`${label}: ${value.replace(/^https:\/\/(www\.)?/, "")}`)}"><span class="social-links__icon" aria-hidden="true">${icon}</span>${esc(label)}</a></li>`
        : `<li><span class="social-links__item" title="${esc(`${label}: ${value}`)}"><span class="social-links__icon" aria-hidden="true">${icon}</span>${esc(label)}: <b>${esc(value)}</b></span></li>`;
    });
    return items.length ? `<ul class="social-links">${items.join("")}</ul>` : "";
  }
  const bioHTML = (bio, cls) => `<p class="${cls}">${esc(bio)}</p>`;

  /** Favourite words as rows (own profile, with ×) or chips (someone else's page). */
  function favouriteRowsHTML(list, removable) {
    if (!list.length) return `<p class="page-hint">${esc(t("favouritesEmpty"))}</p>`;
    return `<ul class="word-list">${list.map((f) => {
      const e = NL.D.byId.get(String(f.id));
      const meta = e ? [e.cat, NL.themeText(e)].filter(Boolean).join(" · ") : "";
      return `<li class="word-list__row word-list__box"><a class="word-list__item" href="#/word/${encodeURIComponent(f.id)}"><span class="word-list__word">${esc(e ? e.v[0] : f.word)}</span><span class="word-list__meta">${esc(meta)}</span></a>` +
        (removable ? `<button type="button" class="word-list__remove" data-star="${esc(f.id)}" aria-label="${esc(t("starRemove"))}" title="${esc(t("starRemove"))}">&times;</button>` : "") + `</li>`;
    }).join("")}</ul>`;
  }

  /* ── sign-in card ──────────────────────────────────────────── */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const found = document.querySelector(`script[src="${src}"]`);
      if (found && found.dataset.loaded) return resolve();
      const s = found || document.createElement("script");
      s.src = src;
      s.async = true;
      s.addEventListener("load", () => { s.dataset.loaded = "1"; resolve(); }, { once: true });
      s.addEventListener("error", reject, { once: true });
      if (!found) document.head.appendChild(s);
    });
  }

  let profileEl = null;

  function renderLogin(container) {
    const cfg = state.config || {};
    const any = cfg.telegramBot || cfg.googleClientId;
    const favourites = localFavourites();
    container.innerHTML = `<div class="page profile-page">
      <section class="card login-card" id="login">
        <h1 class="login-card__title">${esc(t("signInTitle"))}</h1>
        <p class="login-card__why">${esc(t("signInWhy"))}</p>
        ${state.available ? "" : `<p class="form-error">${esc(t("serverDown"))}</p>`}
        ${state.available && !any ? `<p class="hint">${esc(t("signInNotSet"))}</p>` : ""}
        <div class="login-buttons"><div id="tg-login"></div><div id="google-login"></div></div>
        <p class="form-error" id="login-error" role="alert"></p>
      </section>
      ${favourites.length ? `<h2 class="section-title" style="margin:4px 0 8px">★ ${esc(t("favouritesTitle"))} · ${favourites.length}</h2><div data-section="list">${favouriteRowsHTML(favourites, true)}</div>` : ""}
    </div>`;
    profileEl = container.querySelector(".profile-page");
    const fail = (e) => { document.getElementById("login-error").textContent = `${t("signInFailed")}: ${errorText(e)}`; };

    if (cfg.telegramBot) {
      window.NLTelegramAuth = (user) => login("auth/telegram", user).catch(fail);
      const s = document.createElement("script");
      s.async = true;
      s.src = "https://telegram.org/js/telegram-widget.js?22";
      s.setAttribute("data-telegram-login", cfg.telegramBot);
      s.setAttribute("data-size", "large");
      s.setAttribute("data-radius", "20");
      s.setAttribute("data-onauth", "NLTelegramAuth(user)");
      s.setAttribute("data-request-access", "write");
      document.getElementById("tg-login").appendChild(s);
    }
    if (cfg.googleClientId) {
      loadScript("https://accounts.google.com/gsi/client").then(() => {
        const el = document.getElementById("google-login");
        if (!el || !window.google || !google.accounts) return;
        google.accounts.id.initialize({
          client_id: cfg.googleClientId,
          callback: (response) => login("auth/google", { credential: response.credential }).catch(fail),
        });
        const dark = document.documentElement.getAttribute("data-theme") === "dark";
        google.accounts.id.renderButton(el, { theme: dark ? "filled_black" : "outline", size: "large", shape: "pill", text: "signin_with", locale: NL.ui() === "en" ? "en" : "it" });
      }).catch(() => console.warn("Google sign-in script couldn't load (blocked or offline)"));
    }
  }

  /* ── own profile ───────────────────────────────────────────── */
  let profileTab = "favourites";

  function renderProfileSection(name) {
    if (!profileEl || !profileEl.isConnected) return;
    const u = state.user;
    const box = profileEl.querySelector(`[data-section="${name}"]`);
    if (!box || !u) return;
    const editBtn = (section) => `<button type="button" class="pill-btn" data-edit="${section}">${esc(t("edit"))}</button>`;
    if (name === "head") {
      box.innerHTML = `
        <button type="button" class="profile-card__photo" data-photo title="${esc(t(u.avatar ? "photoChange" : "photoAdd"))}" aria-label="${esc(t(u.avatar ? "photoChange" : "photoAdd"))}">${avatarHTML(u.id, u.name, u.avatar, 76)}<span class="profile-card__photo-badge" aria-hidden="true">📷</span></button>
        <div class="profile-card__who">
          <h1 class="profile-card__name">${esc(u.name)}</h1>
          <span class="profile-card__provider">${esc(t("signedInWith", u.provider === "google" ? "Google" : "Telegram"))}${u.since ? ` · ${esc(t("since", shortDate(u.since)))}` : ""}</span>
          ${reputationHTML(u.reputation)}
          <div class="profile-card__photo-actions">
            <button type="button" class="text-btn" data-photo>${esc(t(u.avatar ? "photoChange" : "photoAdd"))}</button>
            ${u.avatar ? `<button type="button" class="text-btn danger" data-photo-remove>${esc(t("photoRemove"))}</button>` : ""}
          </div>
          <p class="form-error" id="photo-error" role="alert"></p>
        </div>
        <button type="button" class="pill-btn pill-btn--primary profile-card__logout" data-logout>${esc(t("signOut"))}</button>`;
    } else if (name === "bio") {
      box.innerHTML = `<h2 class="section-title">${esc(t("bio"))}</h2><div class="profile-card__view">
        ${u.bio ? bioHTML(u.bio, "profile-card__bio") : `<p class="profile-card__bio empty">${esc(t("bioEmpty"))}</p>`}${editBtn("bio")}</div>`;
    } else if (name === "links") {
      box.innerHTML = `<h2 class="section-title">${esc(t("links"))}</h2><div class="profile-card__view">
        ${linksHTML(u.links) || `<p class="profile-card__bio empty">${esc(t("linksEmpty"))}</p>`}${editBtn("links")}</div>`;
    } else if (name === "languages") {
      box.innerHTML = `<h2 class="section-title">${esc(t("languages"))}</h2><p class="hint">${esc(t("languagesHint"))}</p>
        <div class="languages-section__summary">${languagesHTML(state.languages)}${editBtn("languages")}</div>`;
    } else if (name === "list") {
      renderFavouriteList();
    }
  }

  function renderFavouriteList() {
    if (!profileEl || !profileEl.isConnected) return;
    const box = profileEl.querySelector('[data-section="list"]');
    const count = profileEl.querySelector("[data-fav-count]");
    const list = localFavourites();
    if (count) count.textContent = String(list.length);
    if (!box) return;
    if (!state.user || profileTab === "favourites") box.innerHTML = favouriteRowsHTML(list, true);
    else loadHistory(box);
  }

  function editSection(name) {
    const u = state.user;
    const box = profileEl.querySelector(`[data-section="${name}"]`);
    const actions = (extra) => `<div class="form-actions"><span class="form-error" role="alert"></span>${extra || ""}
        <button type="button" class="pill-btn pill-btn--muted" data-cancel="${name}">${esc(t("cancel"))}</button>
        <button type="button" class="pill-btn pill-btn--primary" data-save="${name}">${esc(t("save"))}</button></div>`;
    if (name === "bio") {
      const n = [...(u.bio || "")].length;
      box.innerHTML = `<h2 class="section-title">${esc(t("bio"))}</h2><textarea class="textarea bio-input" rows="4" maxlength="600" aria-label="${esc(t("bio"))}" placeholder="${esc(t("bioEmpty"))}">${esc(u.bio || "")}</textarea>${actions(`<span class="counter bio-count">${n} / 300</span>`)}`;
      box.querySelector("textarea").focus();
    } else if (name === "links") {
      box.innerHTML = `<h2 class="section-title">${esc(t("links"))}</h2><p class="hint">${esc(t("linksHint"))}</p><div class="link-fields">${NETWORKS.map(([key, label, icon, example]) =>
        `<label class="link-field"><span class="link-field__label"><span aria-hidden="true">${icon}</span> ${esc(label)}</span><input class="text-input" type="text" name="${key}" inputmode="url" autocomplete="off" spellcheck="false" maxlength="200" placeholder="${esc(example)}" value="${esc((u.links || {})[key] || "")}"></label>`).join("")}</div>${actions()}`;
    } else if (name === "languages") {
      box.innerHTML = `<h2 class="section-title">${esc(t("languages"))}</h2>${languageFormHTML(state.languages, { cancel: true })}`;
      const form = box.querySelector(".language-form");
      form._onSaved = () => renderProfileSection("languages");
      form._onCancel = () => renderProfileSection("languages");
    }
  }

  function renderProfile(container) {
    const u = state.user;
    container.innerHTML = `<div class="page profile-page">
        <section class="card profile-card">
          <div class="profile-card__head" data-section="head"></div>
          <div class="profile-card__section" data-section="bio"></div>
          <div class="profile-card__section" data-section="links"></div>
        </section>
        <section class="card languages-section" id="languages" data-section="languages"></section>
        <div class="tabs-row" role="tablist">
          <button type="button" role="tab" data-ptabs="favourites" aria-selected="${profileTab === "favourites"}">★ ${esc(t("favouritesTitle"))} · <span data-fav-count>${localFavourites().length}</span></button>
          <button type="button" role="tab" data-ptabs="history" aria-selected="${profileTab === "history"}">🕘 ${esc(t("historyTitle"))}</button>
        </div>
        <div data-section="list"></div>
        <p class="public-note"><a href="#/user/${u.id}">${esc(t("viewPublic"))}</a><span class="hint" style="display:block">${esc(t("publicNote"))}</span></p>
        <input type="file" accept="image/*" hidden data-photo-file>
      </div>`;
    profileEl = container.querySelector(".profile-page");
    ["head", "bio", "links", "languages", "list"].forEach(renderProfileSection);
    profileEl.addEventListener("click", onProfileClick);
    profileEl.addEventListener("input", (ev) => {
      if (ev.target.classList.contains("bio-input")) {
        const n = [...ev.target.value.trim()].length;
        const c = profileEl.querySelector(".bio-count");
        c.textContent = `${n} / 300`;
        c.classList.toggle("over", n > 300);
      }
    });
    profileEl.querySelector("[data-photo-file]").addEventListener("change", onPhotoFile);
  }

  async function loadHistory(box) {
    box.innerHTML = `<p class="page-hint">…</p>`;
    try {
      const { history } = await api("history");
      if (profileTab !== "history" || !box.isConnected) return;
      if (!history.length) { box.innerHTML = `<p class="page-hint">${esc(t("historyEmpty"))}</p>`; return; }
      const days = new Map();
      for (const h of history) {
        const day = shortDate(h.at);
        if (!days.has(day)) days.set(day, []);
        days.get(day).push(h);
      }
      const time = (iso) => new Date(iso).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
      box.innerHTML = `<div class="history-head"><span class="hint">${esc(t("historyPrivate"))}</span>
          <button type="button" class="pill-btn pill-btn--muted pill-btn--danger" data-history-clear>${esc(t("historyClear"))}</button></div>` +
        [...days].map(([day, list]) => `<section class="history-day"><h3 class="history-date">${esc(day)}</h3><ul class="word-list">${list.map((h) => {
          const lang = h.lang && NL.LANG_INDEX[h.lang] != null ? NL.LANGS[NL.LANG_INDEX[h.lang]][NL.ui()] : "";
          return `<li><a class="word-list__item" href="#/word/${encodeURIComponent(h.id)}"><span class="word-list__word">${esc(h.word)}</span>
            <span class="word-list__meta">${h.translation ? esc(`${lang ? lang + " · " : ""}${h.translation}`) : ""}</span><span class="word-list__end">${esc(time(h.at))}</span></a></li>`;
        }).join("")}</ul></section>`).join("");
    } catch (e) {
      box.innerHTML = `<p class="form-error">${esc(errorText(e))}</p>`;
    }
  }

  async function onProfileClick(ev) {
    const target = ev.target;
    if (target.closest("[data-logout]")) return logout();
    if (target.closest("[data-photo]")) return profileEl.querySelector("[data-photo-file]").click();
    const tab = target.closest("[data-ptabs]");
    if (tab) {
      profileTab = tab.dataset.ptabs;
      profileEl.querySelectorAll("[data-ptabs]").forEach((b) => b.setAttribute("aria-selected", String(b === tab)));
      return renderFavouriteList();
    }
    if (target.closest("[data-photo-remove]")) {
      try {
        await api("community/avatar", { method: "DELETE" });
        state.user.avatar = null;
        renderProfileSection("head");
        renderAccount();
      } catch (e) { profileEl.querySelector("#photo-error").textContent = errorText(e); }
      return;
    }
    if (target.closest("[data-history-clear]")) {
      await api("history", { method: "DELETE" }).catch((e) => toast(errorText(e)));
      return renderFavouriteList();
    }
    const edit = target.closest("[data-edit]");
    if (edit) return editSection(edit.dataset.edit);
    const cancel = target.closest("[data-cancel]");
    if (cancel) return renderProfileSection(cancel.dataset.cancel);
    const save = target.closest("[data-save]");
    if (save) {
      const name = save.dataset.save;
      const box = save.closest("[data-section]");
      const error = box.querySelector(".form-error");
      error.textContent = "";
      save.disabled = true;
      try {
        if (name === "bio") {
          const result = await api("community/about", { method: "PUT", body: { bio: box.querySelector("textarea").value } });
          state.user.bio = result.bio;
        } else if (name === "links") {
          const links = {};
          box.querySelectorAll("input[name]").forEach((input) => { links[input.name] = input.value; });
          const result = await api("community/about", { method: "PUT", body: { links } });
          state.user.links = result.links;
        }
        renderProfileSection(name);
      } catch (e) {
        const network = e.data && e.data.network && NETWORKS.find(([key]) => key === e.data.network);
        error.textContent = network ? t("linksInvalid", network[1]) : errorText(e);
        save.disabled = false;
      }
    }
  }

  /* ── photo framing: drag, zoom, save a 256 px JPEG ─────────── */
  function onPhotoFile(ev) {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => openCropper(img, url);
    img.onerror = () => { URL.revokeObjectURL(url); profileEl.querySelector("#photo-error").textContent = t("photoBad"); };
    img.src = url;
  }

  function openCropper(img, url) {
    const STAGE = 280;
    const OUT = 256;
    const dialog = NL.openModal(`${NL.dialogHeader(esc(t("photoTitle")))}
      <div class="dialog__body avatar-cropper">
        <div class="avatar-cropper__frame"><canvas width="${STAGE * 2}" height="${STAGE * 2}" tabindex="0" aria-label="${esc(t("photoTitle"))}"></canvas><span class="avatar-cropper__circle"></span></div>
        <p class="avatar-cropper__hint">${esc(t("photoHint"))}</p>
        <label class="avatar-cropper__zoom"><span aria-hidden="true">−</span><input type="range" min="1" max="4" step="0.01" value="1" aria-label="zoom"><span aria-hidden="true">+</span></label>
        <div class="form-actions"><span class="form-error" role="alert"></span>
          <button type="button" class="pill-btn pill-btn--muted" data-modal-close>${esc(t("cancel"))}</button>
          <button type="button" class="pill-btn pill-btn--primary" data-crop-save>${esc(t("save"))}</button></div>
      </div>`, { className: "cropper", label: t("photoTitle"), onClose: () => URL.revokeObjectURL(url) });
    const canvas = dialog.el.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const range = dialog.el.querySelector("input[type=range]");
    const base = Math.max(STAGE / img.naturalWidth, STAGE / img.naturalHeight);
    let zoom = 1;
    let cx = img.naturalWidth / 2;
    let cy = img.naturalHeight / 2;
    const scale = () => base * zoom;
    const ratio = () => STAGE / canvas.getBoundingClientRect().width || 1;
    function clamp() {
      const half = STAGE / 2 / scale();
      cx = Math.min(Math.max(cx, half), img.naturalWidth - half);
      cy = Math.min(Math.max(cy, half), img.naturalHeight - half);
    }
    function draw() {
      clamp();
      const s = scale() * 2;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, STAGE - cx * s, STAGE - cy * s, img.naturalWidth * s, img.naturalHeight * s);
    }
    draw();
    let drag = null;
    canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", (e) => {
      if (!drag) return;
      cx -= ((e.clientX - drag.x) * ratio()) / scale();
      cy -= ((e.clientY - drag.y) * ratio()) / scale();
      drag = { x: e.clientX, y: e.clientY };
      draw();
    });
    canvas.addEventListener("pointerup", () => { drag = null; });
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      zoom = Math.min(4, Math.max(1, zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08)));
      range.value = zoom;
      draw();
    }, { passive: false });
    canvas.addEventListener("keydown", (e) => {
      const step = 12 / scale();
      if (e.key === "ArrowLeft") cx -= step; else if (e.key === "ArrowRight") cx += step;
      else if (e.key === "ArrowUp") cy -= step; else if (e.key === "ArrowDown") cy += step;
      else return;
      e.preventDefault();
      draw();
    });
    range.addEventListener("input", () => { zoom = Number(range.value); draw(); });
    dialog.el.querySelector("[data-crop-save]").addEventListener("click", async (e) => {
      const button = e.currentTarget;
      const out = document.createElement("canvas");
      out.width = out.height = OUT;
      const side = STAGE / scale();
      out.getContext("2d").drawImage(img, cx - side / 2, cy - side / 2, side, side, 0, 0, OUT, OUT);
      let quality = 0.88;
      let data = out.toDataURL("image/jpeg", quality);
      while (data.length > 250000 && quality > 0.4) { quality -= 0.1; data = out.toDataURL("image/jpeg", quality); }
      button.disabled = true;
      try {
        const { avatar } = await api("community/avatar", { method: "PUT", body: { image: data } });
        state.user.avatar = avatar;
        dialog.close();
        renderProfileSection("head");
        renderAccount();
      } catch (err) {
        dialog.el.querySelector(".form-error").textContent = errorText(err);
        button.disabled = false;
      }
    });
    canvas.focus();
  }

  /* ── public user page ──────────────────────────────────────── */
  async function renderUser(container, id) {
    container.innerHTML = `<div class="page"><p class="loading">…</p></div>`;
    let data;
    try {
      data = await api("community/users", { params: { id } });
    } catch (e) {
      container.innerHTML = `<div class="results-empty"><h2>${esc(errorText(e))}</h2></div>`;
      return;
    }
    const u = data.user;
    data.comments.forEach((c) => commentCache.set(c.id, c));
    document.title = `${u.name} — Dictionario Neolatino`;
    container.innerHTML = `<div class="page user-detail">
        <a class="pill-btn" href="#/users" style="align-self:flex-start">← ${esc(t("usersTitle"))}</a>
        <header class="user-detail__profile">
          ${avatarHTML(u.id, u.name, u.avatar, 64)}
          <div class="user-detail__text"><h1 class="user-detail__name">${esc(u.name)}</h1>
            <span class="user-detail__since">${esc(t("since", shortDate(u.since)))}</span>
            ${reputationHTML(u.reputation)}</div>
        </header>
        ${linksHTML(u.links)}
        ${u.bio ? `<section class="user-section"><h2 class="user-section__title">${esc(t("bio"))}</h2>${bioHTML(u.bio, "user-detail__bio")}</section>` : ""}
        <section class="card languages-section"><h2 class="section-title">${esc(t("languages"))}</h2>${languagesHTML(u.languages)}</section>
        <section class="user-section"><h2 class="user-section__title">★ ${esc(t("favouritesTitle"))} <span>${u.favourites.length}</span></h2>
          ${u.favourites.length ? `<div class="chips" style="margin:0">${u.favourites.map((f) => wordChip(f.id, f.word)).join("")}</div>` : `<p class="page-hint">—</p>`}</section>
        <section class="user-section"><h2 class="user-section__title">${esc(t("votesTitle"))} <span>${data.votes.length}</span></h2>
          ${data.votes.length ? `<ul class="vote-rows">${data.votes.map((v) => `<li>${wordChip(v.wordId, v.word)}<span class="vote-rows__vote">${swatch(v.vote)} ${esc(voteLabel(v.vote))}</span>${when(v.at, "vote-rows__time")}</li>`).join("")}</ul>` : `<p class="page-hint">${esc(t("noneYet"))}</p>`}</section>
        <section class="user-section"><h2 class="user-section__title">${esc(t("comments"))} <span>${data.comments.length}</span></h2>
          ${data.comments.length ? `<ol class="word-comments__list">${data.comments.map((c) => commentHTML(c, { showWord: true })).join("")}</ol>` : `<p class="page-hint">${esc(t("noneYet"))}</p>`}</section>
      </div>`;
  }

  /* ── users list ────────────────────────────────────────────── */
  async function renderUsers(container) {
    container.innerHTML = `<div class="page users-page">
        <h1 class="page-title">👥 ${esc(t("usersTitle"))}</h1>
        <input class="search-input" type="search" placeholder="${esc(t("usersSearch"))}" aria-label="${esc(t("usersSearch"))}">
        <ul class="user-list"></ul><div class="list-more"></div>
      </div>`;
    const list = container.querySelector(".user-list");
    const more = container.querySelector(".list-more");
    const input = container.querySelector(".search-input");
    let offset = 0;
    let query = "";
    let timer;
    let request = 0;
    async function load(reset) {
      const mine = ++request;
      if (reset) offset = 0;
      try {
        const data = await api("community/users", { params: { q: query, offset } });
        if (mine !== request) return;
        if (reset) list.innerHTML = "";
        offset += data.users.length;
        list.insertAdjacentHTML("beforeend", data.users.map((u) => {
          const langs = u.native
            ? `<strong>${esc(langName(u.native))}</strong>${[...(u.others || []), ...(u.foreign || [])].map((e) => ` · ${esc(langName(e.lang))} ${esc(e.level)}`).join("")}`
            : "—";
          return `<li><a class="user-row" href="#/user/${u.id}">
            ${avatarHTML(u.id, u.name, u.avatar, 40)}
            <span class="user-row__main"><span class="user-row__name">${esc(u.name)}</span>
              ${u.bio ? `<span class="user-row__bio">${esc(u.bio.split("\n")[0])}</span>` : ""}
              <span class="user-row__langs">${langs}</span></span>
            <span class="user-row__stats"><span class="user-row__rep" title="${esc(t("reputation"))}">▲ ${u.reputation}</span>
              <span title="${esc(t("comments"))}">💬 ${u.comments}</span><span title="${esc(t("votesTitle"))}">🗳 ${u.votes}</span>
              ${when(u.active || u.since, "user-row__time")}</span>
          </a></li>`;
        }).join(""));
        if (!list.children.length) list.innerHTML = `<li class="page-hint">${esc(t("usersEmpty"))}</li>`;
        more.innerHTML = data.more ? `<button type="button" class="pill-btn">${esc(t("showMore"))}</button>` : "";
        const b = more.querySelector("button");
        if (b) b.onclick = () => load(false);
      } catch (e) {
        list.innerHTML = `<li class="form-error">${esc(errorText(e))}</li>`;
      }
    }
    input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => { query = input.value.trim(); load(true); }, 250); });
    load(true);
  }

  /* ── latest activity: newest comments | newest votes ───────── */
  let activityColumn = "comments";
  async function renderActivity(container) {
    container.innerHTML = `<div class="page page--wide activity-page">
        <div class="page-head"><h1 class="page-title">🕒 ${esc(t("activityTitle"))}</h1>
          <button type="button" class="pill-btn" data-refresh>↻ ${esc(t("refresh"))}</button></div>
        <div style="display:flex;justify-content:center"><div class="tabs-row activity-tabs" role="tablist">
          <button type="button" role="tab" data-column="comments" aria-selected="${activityColumn === "comments"}">💬 ${esc(t("latestComments"))}</button>
          <button type="button" role="tab" data-column="votes" aria-selected="${activityColumn === "votes"}">🗳 ${esc(t("latestVotes"))}</button>
        </div></div>
        <div class="activity-columns" data-column="${activityColumn}">
          <section class="activity-column activity-column--comments"><h2 class="activity-column__title">💬 ${esc(t("latestComments"))}</h2>
            <ol class="word-comments__list activity-list" data-list="comments"></ol><div class="list-more" data-more="comments"></div></section>
          <section class="activity-column activity-column--votes"><h2 class="activity-column__title">🗳 ${esc(t("latestVotes"))}</h2>
            <ul class="activity-list" data-list="votes"></ul><div class="list-more" data-more="votes"></div></section>
        </div>
      </div>`;
    const comments = container.querySelector('[data-list="comments"]');
    const votes = container.querySelector('[data-list="votes"]');
    let commentCursor = "";
    let voteCursor = "";
    async function loadComments(reset) {
      if (reset) { commentCursor = ""; }
      const data = await api("community/comments", { params: { latest: "1", before: commentCursor } });
      data.comments.forEach((c) => commentCache.set(c.id, c));
      if (reset) comments.innerHTML = "";
      comments.insertAdjacentHTML("beforeend", data.comments.map((c) => commentHTML(c, { showWord: true })).join(""));
      if (data.comments.length) commentCursor = String(data.comments[data.comments.length - 1].id);
      if (!comments.children.length) comments.innerHTML = `<li class="page-hint">${esc(t("noneYet"))}</li>`;
      moreButton("comments", data.more, () => loadComments(false));
    }
    async function loadVotes(reset) {
      if (reset) { voteCursor = ""; }
      const data = await api("community/recentvotes", { params: { before: voteCursor } });
      if (reset) votes.innerHTML = "";
      votes.insertAdjacentHTML("beforeend", data.votes.map((v) => `<li class="activity-vote vote-item">
          <div class="activity-vote__who"><a class="comment__author" href="#/user/${encodeURIComponent(v.userId)}">${avatarHTML(v.userId, v.name, v.avatar, 24)}${esc(v.name)}</a>
            ${v.native ? `<span class="activity-vote__native">${esc(langName(v.native))}</span>` : ""}${when(v.at, "activity-vote__time")}</div>
          <div class="activity-vote__what">${wordChip(v.wordId, v.word)}<span class="activity-vote__arrow" aria-hidden="true">→</span>
            <span class="activity-vote__vote">${swatch(v.vote)} ${esc(voteLabel(v.vote))}</span></div>
        </li>`).join(""));
      if (data.votes.length) voteCursor = data.votes[data.votes.length - 1].cursor;
      if (!votes.children.length) votes.innerHTML = `<li class="page-hint">${esc(t("noneYet"))}</li>`;
      moreButton("votes", data.more, () => loadVotes(false));
    }
    function moreButton(which, more, fn) {
      const box = container.querySelector(`[data-more="${which}"]`);
      box.innerHTML = more ? `<button type="button" class="pill-btn">${esc(t("showMore"))}</button>` : "";
      const b = box.querySelector("button");
      if (b) b.onclick = () => fn().catch((e) => toast(errorText(e)));
    }
    const refresh = (reset) => Promise.all([loadComments(reset), loadVotes(reset)]).catch((e) => {
      container.querySelector(".activity-columns").insertAdjacentHTML("beforebegin", `<p class="form-error">${esc(errorText(e))}</p>`);
    });
    container.querySelector("[data-refresh]").addEventListener("click", () => refresh(true));
    container.querySelectorAll("[data-column]").forEach((b) => b.addEventListener("click", () => {
      activityColumn = b.dataset.column;
      container.querySelector(".activity-columns").dataset.column = activityColumn;
      container.querySelectorAll("button[data-column]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    }));
    await refresh(false);
  }

  /* ── word statistics: 50 latest lookups | most looked-up words ─ */
  let lookupsColumn = "latest";
  let lookupsPeriod = "all";
  async function renderLookups(container) {
    const periods = [["all", "periodAll"], ["30", "period30"], ["7", "period7"]];
    container.innerHTML = `<div class="page page--wide stats-page">
        <div class="page-head"><h1 class="page-title">📊 ${esc(t("statsTitle"))}</h1>
          <button type="button" class="pill-btn" data-refresh>↻ ${esc(t("refresh"))}</button></div>
        <p class="page-hint stats-page__hint">${esc(t("statsHint"))}</p>
        <p class="form-error" data-error></p>
        <div class="stats-page__switch"><div class="tabs-row stats-page__tabs" role="tablist">
          <button type="button" role="tab" data-column="latest" aria-selected="${lookupsColumn === "latest"}">🕘 ${esc(t("lastLookups"))}</button>
          <button type="button" role="tab" data-column="top" aria-selected="${lookupsColumn === "top"}">🏆 ${esc(t("topLookups"))}</button>
        </div></div>
        <div class="stats-page__columns" data-column="${lookupsColumn}">
          <section class="card stats-page__column stats-page__column--latest">
            <h2 class="stats-page__column-title">🕘 ${esc(t("lastLookups"))}</h2>
            <ol class="stats-page__latest" data-list="latest"><li class="page-hint">…</li></ol>
          </section>
          <section class="card stats-page__column stats-page__column--top">
            <h2 class="stats-page__column-title">🏆 ${esc(t("topLookups"))}</h2>
            <div class="seg-toggle stats-page__periods" role="group" aria-label="${esc(t("topLookups"))}">${periods.map(([v, k]) =>
              `<button type="button" data-period="${v}" aria-pressed="${v === lookupsPeriod}">${esc(t(k))}</button>`).join("")}</div>
            <p class="stats-page__totals" data-totals></p>
            <ol class="stats-page__top" data-list="top"></ol>
          </section>
        </div>
      </div>`;
    const latest = container.querySelector('[data-list="latest"]');
    const top = container.querySelector('[data-list="top"]');
    const totals = container.querySelector("[data-totals]");
    const error = container.querySelector("[data-error]");
    // the word as the dictionary writes it now (the server keeps the spelling of the last lookup)
    const wordOf = (entry) => (NL.D.byId.get(String(entry.wordId)) || { v: [entry.word] }).v[0] || entry.word;
    let request = 0;
    async function load() {
      const current = ++request;
      top.classList.add("loading");
      error.textContent = "";
      try {
        const data = await api("community/wordstats", { params: lookupsPeriod === "all" ? {} : { period: lookupsPeriod } });
        if (current !== request) return;
        latest.innerHTML = data.latest.length ? data.latest.map((entry) => `<li>
            ${wordChip(entry.wordId, wordOf(entry))}
            <span class="stats-page__times" title="${esc(t("statsLookups"))}">🔎 ${entry.lookups}</span>
            ${when(entry.at, "stats-page__time")}</li>`).join("") : `<li class="page-hint">${esc(t("lookupsEmpty"))}</li>`;
        const most = Math.max(1, ...data.top.map((entry) => entry.lookups));
        totals.innerHTML = `<span>🔎 ${esc(t("statsLookups"))}: <strong>${NL.fmt(data.totals.lookups)}</strong></span>
          <span>📖 ${esc(t("statsWords"))}: <strong>${NL.fmt(data.totals.words)}</strong></span>`;
        top.innerHTML = data.top.length ? data.top.map((entry, i) => `<li>
            <span class="stats-page__rank${i < 3 ? " medal" : ""}">${i + 1}</span>
            ${wordChip(entry.wordId, wordOf(entry))}
            <span class="stats-page__bar" aria-hidden="true"><span style="width:${Math.max(4, (entry.lookups / most) * 100)}%"></span></span>
            <span class="stats-page__count">${NL.fmt(entry.lookups)}</span></li>`).join("") : `<li class="page-hint">${esc(t("lookupsEmpty"))}</li>`;
      } catch (e) {
        if (current === request) error.textContent = errorText(e);
      } finally {
        if (current === request) top.classList.remove("loading");
      }
    }
    container.querySelector("[data-refresh]").addEventListener("click", load);
    container.querySelectorAll("[data-column]").forEach((b) => b.addEventListener("click", () => {
      lookupsColumn = b.dataset.column;
      container.querySelector(".stats-page__columns").dataset.column = lookupsColumn;
      container.querySelectorAll("button[data-column]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    }));
    container.querySelectorAll("[data-period]").forEach((b) => b.addEventListener("click", () => {
      lookupsPeriod = b.dataset.period;
      container.querySelectorAll("[data-period]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      load();
    }));
    await load();
  }

  /* ── routes ────────────────────────────────────────────────── */
  const ready = boot();
  const page = (fn) => async (parts, params, info) => {
    const v = NL.view();
    if (info && info.dataRefresh && v.querySelector(".profile-page, .user-detail, .users-page, .activity-page, .stats-page")) return;
    if (!state.booted) v.innerHTML = `<p class="loading">…</p>`;
    await ready;
    window.scrollTo(0, 0);
    return fn(v, parts, params);
  };
  hooks.routes.profile = page((v) => (state.user ? renderProfile(v) : renderLogin(v)));
  hooks.routes.user = page((v, parts) => renderUser(v, parts[1]));
  hooks.routes.users = page((v) => renderUsers(v));
  hooks.routes.activity = page((v) => renderActivity(v));
  hooks.routes.lookups = page((v) => renderLookups(v));
})();
