/* Dictionario Neolatino — search, filters, A–Z browse, conjugations.
 * Plain JS, no build step. Data is the same public Google Sheet the current
 * Flutter app reads; a local snapshot (data/dictionario.csv) is used as fallback.
 * The interface follows the Interslavic dictionary (interslavic.forum/slovnik).
 */
(function () {
  "use strict";

  // Shared namespace: community.js and share.js plug in through NL.hooks
  const NL = (window.NL = window.NL || {});
  const hooks = (NL.hooks = {
    entryActions: [], // (entry, opts) => html of buttons placed before the tabs (☆, share)
    panels: [], // { key, label(entry), icon, available(entry), render(entry, el, ctx) }
    panelFooters: {}, // panel key → [(entry, ctx) => html] (e.g. "share as image")
    routes: {}, // page name → (parts, params, info) => void
    afterResults: [], // (containerEl, entries) after word cards are shown (counts)
    onOpen: [], // (entry, what) when a word page or a tab is opened ("preview": shown in the side pane)
    onUi: [], // after the interface language changes
    onRoute: [], // (name) after every page change
    menu: [], // { name, icon, label: () => text, href, order }
  });

  // ------------------------------------------------------------------ config
  // the version is the ?v= of app.js in index.html ("20261023" → 2026-10-23), shown on the About page
  const APP_VERSION = (() => {
    try {
      const v = new URL(document.currentScript.src).searchParams.get("v") || "";
      const m = v.match(/^(\d{4})(\d\d)(\d\d)(.*)$/);
      return m ? `${m[1]}-${m[2]}-${m[3]}${m[4] ? " " + m[4] : ""}` : v;
    } catch { return ""; }
  })();
  const CONFIG = {
    dataUrls: [
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vSGCRUv8z5VSCk7lBy_4gtH2PkFvMH5ny65qauUmYzqWinGEw23IAQT_1seyBGfqw/pub?gid=1315031947&single=true&output=csv",
      "data/dictionario.csv",
    ],
    cacheKey: "nl-dict-csv-v1",
    browsePageSize: 200,
    resultStep: 50,
  };
  // Optional overrides: set window.NL_CONFIG = { dataUrls: [...], cacheKey: null } in a script loaded before app.js
  if (window.NL_CONFIG) Object.assign(CONFIG, window.NL_CONFIG);

  // Spreadsheet columns (see header row of the sheet)
  const COL = { id: 0, sem: 1, cat: 2, t1: 3, t2: 4, t3: 5, ess: 6, bas: 7 };
  const LANGS = [
    { code: "lat", col: 8, nl: "Neolatino", en: "Neolatino" },
    { code: "iro", col: 9, nl: "Interromànico", en: "Inter-Romance" },
    { code: "por", col: 10, nl: "Portughese", en: "Portuguese" },
    { code: "spa", col: 11, nl: "Castellano", en: "Spanish" },
    { code: "cat", col: 12, nl: "Catalano", en: "Catalan" },
    { code: "oci", col: 13, nl: "Occitano", en: "Occitan" },
    { code: "fra", col: 14, nl: "Francese", en: "French" },
    { code: "srd", col: 15, nl: "Sardo", en: "Sardinian" },
    { code: "ita", col: 16, nl: "Italiano", en: "Italian" },
    { code: "rum", col: 17, nl: "Rumeno", en: "Romanian" },
    { code: "eng", col: 18, nl: "Anglese", en: "English" },
    { code: "fol", col: 19, nl: "Folksprak", en: "Folkspraak" },
    { code: "fre", col: 20, nl: "Frenkisch", en: "Frenkisch" },
    { code: "sla", col: 21, nl: "Interslavo", en: "Interslavic" },
  ];
  const LANG_INDEX = Object.fromEntries(LANGS.map((l, i) => [l.code, i]));

  const POS = [
    ["noun", "substantivo", "noun"],
    ["verb", "vèrbo", "verb"],
    ["adj", "adjectivo", "adjective"],
    ["adv", "advèrbio", "adverb"],
    ["part", "participio", "participle"],
    ["pron", "pronome", "pronoun"],
    ["prep", "prepositione", "preposition"],
    ["conj", "conjuntione", "conjunction"],
    ["inter", "interjectione", "interjection"],
    ["art", "artículo", "article"],
    ["num", "numerale", "numeral"],
    ["name", "nome pròprio", "proper noun"],
    ["other", "altro", "other"],
  ];

  // ------------------------------------------------------------------ i18n
  // NL strings: please have a fluent Neolatino speaker review these.
  const STR = {
    nl: {
      navSearch: "Dictionario", navBrowse: "Alphabeto", navVerb: "Conjugatore",
      skip: "Saltare al contento", home: "Dictionario Neolatino — inítio",
      themeToDark: "Tèma obscuro", themeToLight: "Tèma claro", menu: "Menu",
      footData: "Datos", footConj: "Conjugatore officiale",
      from: "De", toNeo: "Neolatino", allLangs: "Totas las lenguas",
      placeholder: "Escrive una paraula…",
      inputLang: "Lengua de entrata",
      category: "Categoría", theme: "Tèma", subtheme: "Subtèma", level: "Vocabulario",
      any: "Toto", essential: "Essentiale", basic: "Bàsico",
      mode: "Coincidèntia", modeStart: "Initio", modeContains: "Contenere", modeExact: "Exacto",
      reset: "Netejjare filtros", filters: "Filtros", clear: "Netejjare", close: "Clàudere",
      results: (n) => (n === 1 ? "1 resultato" : `${fmt(n)} resultados`),
      noResults: "Non se han tropato coincidèntias",
      noResultsHint: "Pròva una altra lengua de entrata, la coincidèntia «Contenere», aut netejja los filtros.",
      translations: "Traductiones", conjugation: "Conjugatione", showMore: "Monstrare plus",
      synonyms: "Mesmo significato", homonyms: "Altros significatos",
      backToResults: "Retornare",
      loading: "Carrecando lo dictionario…",
      loadError: "Non se ha potuto carrecare lo dictionario. Verifica la connexione et carreca de nòvo la pàgina.",
      entries: (n) => `${fmt(n)} paraulas`,
      updated: (d) => `actualizzato ${d}`,
      cached: "copia locale",
      browseWords: (n) => (n === 1 ? "1 paraula" : `${fmt(n)} paraulas`),
      browseIn: "Ordenare per",
      page: "Pàgina",
      essentialBadge: "ess.", basicBadge: "bàs.",
      essentialTitle: "Vocabulario essentiale", basicTitle: "Vocabulario bàsico",
      swapDir: "Cambiare la directione", outputLang: "Lengua de las traductiones",
      tryThese: "Pròva:",
      verbPlaceholder: "Infinitivo, p. ex. «fàcere»",
      conjugate: "Conjugare",
      verbNotFound: "Non pòsso conjugare esta forma. Escrive l'infinitivo (-are, -ere, -ire).",
      srcOfficial: "Formas del conjugatore officiale de neolatino.eu.",
      srcDerived: (b) => `Formas derivatas de «${b}», vèrbo del conjugatore officiale. Verifica-las.`,
      srcRegular: "Formas generatas con lo modèllo regulare: lo vèrbo non èst en lo conjugatore officiale. Lo participio passato et las vocales apèrtas (è, ò) pòten differire.",
      reflexive: "Vèrbo reflexivo: se usa con me, te, se, nos, vos, se.",
      openInConj: "Aperir en lo conjugatore",
      nonfinite: { inf: "infinitivo", ger: "gerundio", pp: "particip. pres.", pa: "particip. pass." },
      moods: { indicativo: "indicativo", subjunctivo: "subjunctivo", conditionale: "conditionale", imperativo: "imperativo" },
      tenses: { p_i: "presènte", pi_i: "pass. imperf.", pr_i: "pass. remoto", f_i: "futuro", p_s: "presènte", pi_s: "pass. imperf.", p1_c: "presènte I", p2_c: "presènte II", imp: "" },
      pos: Object.fromEntries(POS.map((p) => [p[0], p[1]])),
      // translations → Wiktionary
      dictsExternal: "Dictionarios extèrnos", openNewTab: "Aprire en nòva fenèstra", isvDict: "Dictionario interslavo",
      // compare words
      compareWith: "Comparare con…", compareAdd: "Ajjóngere paraula…", compareLayout: "Comparatione",
      compareSideBySide: "Ad lato", compareStacked: "Una sobto l'altra", compareRemove: "Eliminare de la comparatione",
      compareScrollLeft: "A senestra", compareScrollRight: "A dèstera", compareNoConj: "Sene conjugatione.",
      // about
      navAbout: "Sopre la app", aboutTitle: "Sopre la app",
      aboutLead: "Dictionario de la lengua neolatina: paraulas en 13 lenguas, conjugatione de los vèrbos, intelligibilitate et commèntos de la communitate.",
      aboutDeveloper: "Desveloppato per", aboutBasedOn: "Basato sopre", aboutFork: "uno fork del Dictionario Interslavo",
      aboutSource: "Còdice fònte", aboutData: "Datos", aboutOriginal: "Dictionario originale", aboutVersion: "Versione",
      // install
      installApp: "Installare lo dictionario", installNow: "Installare",
      installIntro: "Pòne lo dictionario sopre lo escrano de inítio: se apre en una fenèstra pròpria, como una applicatione, et functiona inclusive sene connexione.",
      installTabIos: "iPhone / iPad", installTabAndroid: "Android", installTabDesktop: "Computatore",
      installSteps: {
        ios: [
          "Tocca lo bottone Compartire (uno quadrato con una flèccîa ↑). En Safari èst abbasso en lo escrano aut en lo menu •••.",
          "Descènde et elège «Add to Home Screen» (en la lengua de too telèfono).",
          "Tocca «Add»: la icòna del dictionario appare sopre lo escrano de inítio.",
        ],
        android: [
          "Apri lo menu ⋮ del navigatore (en alto a la dèstera en Chrome).",
          "Elège «Install app» aut «Add to Home screen».",
          "Confirma: lo dictionario appare entre las applicationes.",
        ],
        desktop: [
          "Chrome aut Edge: clicca la icòna de installatione a la dèstera de la barra de addrèsses, aut apri lo menu ⋮ et elège «Install».",
          "Safari en Mac: File → «Add to Dock».",
          "Firefox non pòte installare sitos como applicationes: apri esta pàgina en Chrome, Edge aut Safari.",
        ],
      },
    },
    en: {
      navSearch: "Dictionary", navBrowse: "A–Z", navVerb: "Conjugator",
      skip: "Skip to content", home: "Neolatino dictionary — home",
      themeToDark: "Dark theme", themeToLight: "Light theme", menu: "Menu",
      footData: "Data", footConj: "Official conjugator",
      from: "From", toNeo: "Neolatino", allLangs: "All languages",
      placeholder: "Type a word…",
      inputLang: "Input language",
      category: "Part of speech", theme: "Topic", subtheme: "Subtopic", level: "Vocabulary",
      any: "Any", essential: "Essential", basic: "Basic",
      mode: "Match", modeStart: "Starts with", modeContains: "Contains", modeExact: "Exact match",
      reset: "Clear filters", filters: "Filters", clear: "Clear", close: "Close",
      results: (n) => (n === 1 ? "1 result" : `${fmt(n)} results`),
      noResults: "No matches found",
      noResultsHint: "Try another input language, the “Contains” match, or clear the filters.",
      translations: "Translations", conjugation: "Conjugation", showMore: "Show more",
      synonyms: "Same meaning", homonyms: "Other meanings",
      backToResults: "Back",
      loading: "Loading the dictionary…",
      loadError: "The dictionary couldn't be loaded. Check your connection and reload the page.",
      entries: (n) => `${fmt(n)} entries`,
      updated: (d) => `updated ${d}`,
      cached: "local copy",
      browseWords: (n) => (n === 1 ? "1 word" : `${fmt(n)} words`),
      browseIn: "Sort by",
      page: "Page",
      essentialBadge: "ess.", basicBadge: "basic",
      essentialTitle: "Essential vocabulary", basicTitle: "Basic vocabulary",
      swapDir: "Swap direction", outputLang: "Translation language",
      tryThese: "Try:",
      verbPlaceholder: "Infinitive, e.g. “fàcere”",
      conjugate: "Conjugate",
      verbNotFound: "This form can't be conjugated. Type the infinitive (-are, -ere, -ire).",
      srcOfficial: "Forms from the official neolatino.eu conjugator.",
      srcDerived: (b) => `Forms derived from “${b}”, a verb in the official conjugator. Please verify.`,
      srcRegular: "Forms generated from the regular pattern: this verb isn't in the official conjugator. The past participle and open vowels (è, ò) may differ.",
      reflexive: "Reflexive verb: used with me, te, se, nos, vos, se.",
      openInConj: "Open in conjugator",
      nonfinite: { inf: "infinitive", ger: "gerund", pp: "present participle", pa: "past participle" },
      moods: { indicativo: "indicative", subjunctivo: "subjunctive", conditionale: "conditional", imperativo: "imperative" },
      tenses: { p_i: "present", pi_i: "imperfect", pr_i: "preterite", f_i: "future", p_s: "present", pi_s: "imperfect", p1_c: "conditional I", p2_c: "conditional II", imp: "" },
      pos: Object.fromEntries(POS.map((p) => [p[0], p[2]])),
      // translations → Wiktionary
      dictsExternal: "External dictionaries", openNewTab: "Open in new tab", isvDict: "Interslavic dictionary",
      // compare words
      compareWith: "Compare with…", compareAdd: "Add word…", compareLayout: "Comparison layout",
      compareSideBySide: "Side by side", compareStacked: "One below another", compareRemove: "Remove from comparison",
      compareScrollLeft: "Scroll left", compareScrollRight: "Scroll right", compareNoConj: "No conjugation.",
      // about
      navAbout: "About the app", aboutTitle: "About the app",
      aboutLead: "Dictionary of the Neolatino language: words in 13 languages, verb conjugations, intelligibility and community comments.",
      aboutDeveloper: "Developed by", aboutBasedOn: "Based on", aboutFork: "a fork of the Interslavic dictionary",
      aboutSource: "Source code", aboutData: "Data", aboutOriginal: "Original dictionary", aboutVersion: "Version",
      // install
      installApp: "Install dictionary", installNow: "Install",
      installIntro: "Put the dictionary on your home screen: it opens in its own window like an app and works offline too.",
      installTabIos: "iPhone / iPad", installTabAndroid: "Android", installTabDesktop: "Computer",
      installSteps: {
        ios: [
          "Tap the Share button (a square with an arrow ↑). In Safari it is at the bottom of the screen or in the ••• menu.",
          "Scroll down and choose “Add to Home Screen”.",
          "Tap “Add” — the dictionary icon appears on your home screen.",
        ],
        android: [
          "Open the browser menu ⋮ (top right in Chrome).",
          "Choose “Install app” or “Add to Home screen”.",
          "Confirm — the dictionary appears among your apps.",
        ],
        desktop: [
          "Chrome or Edge: click the install icon at the right end of the address bar, or open the menu ⋮ and choose “Install”.",
          "Safari on a Mac: File → “Add to Dock”.",
          "Firefox cannot install websites as apps — open this page in Chrome, Edge or Safari.",
        ],
      },
    },
  };

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage full or blocked */ } },
  };

  let ui = store.get("nl-ui", "nl") === "en" ? "en" : "nl";
  const t = (k) => STR[ui][k];
  const fmt = (n) => n.toLocaleString(ui === "en" ? "en-US" : "it-IT");

  // ------------------------------------------------------------------ text helpers
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const SOFT = /­/g;
  function norm(s) {
    return String(s || "").replace(SOFT, "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  }
  function terms(value) {
    if (!value) return [];
    const out = [];
    for (let part of value.split(/[,;\/]/)) {
      part = part.trim();
      if (!part) continue;
      if (/[()]/.test(part)) {
        out.push(norm(part.replace(/[()]/g, "")));
        out.push(norm(part.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ")));
      } else out.push(norm(part));
    }
    return [...new Set(out.filter(Boolean))];
  }
  function sortKey(s) {
    return String(s || "").replace(SOFT, "").replace(/[()]/g, "").replace(/^[^\p{L}\p{N}]+/u, "").trim();
  }
  const collator = new Intl.Collator("it", { sensitivity: "base", ignorePunctuation: true });

  /** Highlight q (accent-insensitive) inside original string s. */
  function highlight(s, q) {
    s = String(s || "");
    if (!q) return esc(s);
    let n = "", map = [];
    for (let i = 0; i < s.length; i++) {
      const c = norm(s[i]);
      for (let j = 0; j < c.length; j++) { n += c[j]; map.push(i); }
    }
    const at = n.indexOf(q);
    if (at < 0) return esc(s);
    const a = map[at], b = map[at + q.length - 1] + 1;
    return esc(s.slice(0, a)) + "<mark>" + esc(s.slice(a, b)) + "</mark>" + esc(s.slice(b));
  }

  function posGroups(cat) {
    const g = new Set();
    const parts = String(cat || "").toLowerCase().split(/,|\bet\b|\be\b/).map((p) => p.trim()).filter(Boolean);
    for (const p of parts) {
      if (/^npr/.test(p)) g.add("name");
      else if (/^(s\.|s$|m\.|f\.|pl\.)/.test(p)) g.add("noun");
      else if (/^adj/.test(p)) { g.add(/num/.test(p) ? "num" : "adj"); }
      else if (/^v\s?\.|^v$/.test(p)) g.add("verb");
      else if (/^p\.\s?(pass|pres)/.test(p)) g.add("part");
      else if (/^(avv|adv)/.test(p)) g.add("adv");
      else if (/^pron/.test(p)) g.add("pron");
      else if (/^prep/.test(p)) g.add("prep");
      else if (/^conj/.test(p)) g.add("conj");
      else if (/^inter/.test(p)) g.add("inter");
      else if (/^art/.test(p)) g.add("art");
      else if (/num/.test(p)) g.add("num");
      else if (/^(agg)/.test(p)) g.add("adj");
      else g.add("other");
    }
    if (!g.size) g.add("other");
    return g;
  }

  function letterOf(key) {
    const c = norm(key)[0] || "";
    return /[a-z]/.test(c) ? c : "#";
  }

  // ------------------------------------------------------------------ data
  const D = {
    entries: [], byId: new Map(), bySem: new Map(), byLemma: new Map(),
    themes: new Map(), // t1 -> Set(t2)
    loaded: false, error: null, source: "", when: null,
    sorted: {}, // lang code -> entries sorted by that language
  };

  function parseCSV(text) {
    const rows = []; let row = [], f = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(f); f = ""; }
      else if (c === "\n") { row.push(f.replace(/\r$/, "")); rows.push(row); row = []; f = ""; }
      else f += c;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    return rows;
  }

  function index(text) {
    // the row of totals under the header ("11.937") is not a word
    const rows = parseCSV(text).filter((r) => /^\d+$/.test(r[COL.id] || "") && (r[8] || "").trim() && !/^[\d.,%\s]+$/.test(r[8]));
    const entries = [];
    const byId = new Map(), bySem = new Map(), byLemma = new Map(), themes = new Map();
    for (const r of rows) {
      const v = LANGS.map((l) => (r[l.col] || "").replace(SOFT, "").trim());
      const e = {
        id: r[COL.id], sem: (r[COL.sem] || "").trim(), cat: (r[COL.cat] || "").trim(),
        t1: (r[COL.t1] || "").trim(), t2: (r[COL.t2] || "").trim(), t3: (r[COL.t3] || "").trim(),
        ess: (r[COL.ess] || "").trim() === "e", bas: (r[COL.bas] || "").trim() === "b",
        v, terms: v.map(terms),
      };
      e.pos = posGroups(e.cat);
      e.key = sortKey(v[0]);
      e.letter = letterOf(e.key);
      e.isVerb = e.pos.has("verb");
      entries.push(e);
      byId.set(e.id, e);
      if (e.sem) { if (!bySem.has(e.sem)) bySem.set(e.sem, []); bySem.get(e.sem).push(e); }
      const lk = norm(e.key);
      if (!byLemma.has(lk)) byLemma.set(lk, []);
      byLemma.get(lk).push(e);
      if (e.t1) {
        if (!themes.has(e.t1)) themes.set(e.t1, new Set());
        if (e.t2) themes.get(e.t1).add(e.t2);
      }
    }
    Object.assign(D, { entries, byId, bySem, byLemma, themes, sorted: {}, loaded: true, error: null });
  }

  function sortedFor(code) {
    if (D.sorted[code]) return D.sorted[code];
    const i = LANG_INDEX[code];
    const list = [];
    for (const e of D.entries) {
      const val = e.v[i];
      if (!val) continue;
      const k = i === 0 ? e.key : sortKey(val.split(/[,;\/]/)[0]);
      if (!k) continue;
      list.push({ e, k, letter: letterOf(k) });
    }
    list.sort((a, b) => collator.compare(a.k, b.k) || collator.compare(a.e.key, b.e.key));
    return (D.sorted[code] = list);
  }

  async function load() {
    const cached = CONFIG.cacheKey ? store.get(CONFIG.cacheKey, null) : null;
    if (cached) {
      try {
        const { text, when, source } = JSON.parse(cached);
        index(text); D.when = new Date(when); D.source = source + " (" + t("cached") + ")";
        renderStatus(); route();
      } catch { /* ignore broken cache */ }
    }
    for (const url of CONFIG.dataUrls) {
      try {
        const res = await fetch(url, { cache: "no-cache" });
        if (!res.ok) throw new Error(res.status);
        const text = await res.text();
        if (!/^ID,/.test(text)) throw new Error("unexpected format");
        const prevCount = D.entries.length;
        const changed = !cached || JSON.parse(cached).text !== text;
        D.source = /docs\.google/.test(url) ? "Google Sheets" : url;
        D.when = new Date();
        if (changed || !D.loaded) {
          index(text);
          if (CONFIG.cacheKey) store.set(CONFIG.cacheKey, JSON.stringify({ text, when: D.when.toISOString(), source: D.source }));
          renderStatus();
          if (!prevCount || changed) route(true);
        } else renderStatus();
        return;
      } catch (err) {
        console.warn("Data source failed:", url, err);
      }
    }
    if (!D.loaded) { D.error = true; route(); }
  }

  function renderStatus() {
    const el = document.getElementById("data-status");
    if (!el || !D.loaded) return;
    const when = D.when ? D.when.toLocaleString(ui === "en" ? "en-US" : "it-IT", { dateStyle: "medium", timeStyle: "short" }) : "";
    el.textContent = `${t("entries")(D.entries.length)}, ${D.source}${when ? ", " + t("updated")(when) : ""}.`;
  }

  // ------------------------------------------------------------------ search
  function passesFilters(e, f) {
    if (f.pos && !e.pos.has(f.pos)) return false;
    if (f.th && e.t1 !== f.th) return false;
    if (f.sub && e.t2 !== f.sub) return false;
    if (f.lvl === "e" && !e.ess) return false;
    if (f.lvl === "b" && !e.bas) return false;
    return true;
  }

  function scoreTerms(list, q, mode) {
    let best = 9;
    for (const term of list) {
      let s = 9;
      if (term === q) s = 0;
      else if (mode !== "exact") {
        if (term.startsWith(q)) s = 1;
        else if ((" " + term).includes(" " + q) || term.includes("-" + q)) s = 2;
        else if (mode === "contains" && term.includes(q)) s = 3;
      }
      if (s < best) best = s;
      if (best === 0) break;
    }
    return best;
  }

  function search(f) {
    let q = norm(f.q);
    // English verbs are stored bare ("speak"), so "to speak" should still match
    if (!f.rev && (f.l === "eng" || f.l === "all") && /^to\s+\S/.test(q)) q = q.replace(/^to\s+/, "");
    const hasFilter = f.pos || f.th || f.sub || f.lvl;
    if (!q && !hasFilter) return [];
    // f.rev: Neolatino → language, so only the Neolatino words are searched
    const langIdx = f.rev ? [0] : f.l === "all" ? LANGS.map((_, i) => i) : [LANG_INDEX[f.l] ?? 0];
    const out = [];
    for (const e of D.entries) {
      if (!passesFilters(e, f)) continue;
      if (!q) { out.push({ e, s: 0, li: langIdx[0], len: e.key.length }); continue; }
      let best = 9, bestLi = langIdx[0], len = 99;
      for (const i of langIdx) {
        const s = scoreTerms(e.terms[i], q, f.m);
        if (s < best || (s === best && i === 0)) { best = s; bestLi = i; len = (e.v[i] || "").length; }
      }
      if (best < 9) out.push({ e, s: best, li: bestLi, len });
    }
    out.sort((a, b) =>
      a.s - b.s || (b.e.ess - a.e.ess) || (b.e.bas - a.e.bas) || a.len - b.len || collator.compare(a.e.key, b.e.key)
    );
    return out;
  }

  // ------------------------------------------------------------------ icons (from the Interslavic dictionary)
  const ICONS = {
    share: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M5 7L11 4" stroke="currentColor" stroke-width="2"/><path d="M5 9L11 12" stroke="currentColor" stroke-width="2"/><circle cx="13" cy="13" r="2" stroke="currentColor" stroke-width="2"/><circle cx="3" cy="8" r="2" stroke="currentColor" stroke-width="2"/><circle cx="13" cy="3" r="2" stroke="currentColor" stroke-width="2"/></svg>',
    translations: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><line x1="1" y1="9" x2="1" y2="4" stroke="currentColor" stroke-width="2"/><line y1="-1" x2="12.6" y2="-1" transform="matrix(0.304776 -0.952424 0.968968 0.247186 8.32 15)" stroke="currentColor" stroke-width="2"/><line y1="-1" x2="12.6" y2="-1" transform="matrix(-0.304776 -0.952424 0.968968 -0.247186 16 15)" stroke="currentColor" stroke-width="2"/><line x1="8" y1="11.14" x2="14.4" y2="11.14" stroke="currentColor" stroke-width="2"/><path d="M0 4H8.5L7.84 6H0V4Z" fill="currentColor"/><path d="M6 0V11.54L5.17 14H4V0H6Z" fill="currentColor"/></svg>',
    forms: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M1 8L5 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M13.19 12C13.08 11.8 13.01 11.54 12.96 11.24C12.41 11.85 11.7 12.16 10.83 12.16C10 12.16 9.31 11.92 8.77 11.44C8.22 10.96 7.95 10.35 7.95 9.63C7.95 8.73 8.28 8.04 8.95 7.56C9.61 7.08 10.57 6.84 11.83 6.84H12.87V6.35C12.87 5.96 12.77 5.65 12.56 5.41C12.36 5.18 12.05 5.06 11.62 5.06C11.24 5.06 10.94 5.15 10.72 5.34C10.51 5.52 10.4 5.77 10.4 6.09H8.14C8.14 5.6 8.29 5.14 8.59 4.73C8.9 4.31 9.32 3.98 9.88 3.75C10.43 3.51 11.05 3.39 11.73 3.39C12.78 3.39 13.6 3.65 14.21 4.18C14.83 4.7 15.13 5.43 15.13 6.38V10.05C15.14 10.85 15.25 11.46 15.47 11.87V12H13.19ZM11.32 10.43C11.65 10.43 11.96 10.36 12.24 10.21C12.52 10.06 12.73 9.86 12.87 9.61V8.16H12.02C10.89 8.16 10.29 8.55 10.22 9.33L10.21 9.46C10.21 9.74 10.31 9.97 10.51 10.16C10.71 10.34 10.98 10.43 11.32 10.43Z" fill="currentColor"/></svg>',
    stats: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="1.5" y="9" width="3" height="5.5" rx="0.8" fill="currentColor"/><rect x="6.5" y="5" width="3" height="9.5" rx="0.8" fill="currentColor"/><rect x="11.5" y="1.5" width="3" height="13" rx="0.8" fill="currentColor"/></svg>',
    comments: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.5 2.5h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7.2L4 14.2V11.5H2.5a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M4.5 6h7M4.5 8.6h4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    image: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="10" r="2" fill="currentColor"/><path d="M4 18l5-5 3 3 3-3 5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    swap: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 9l7 7 7-7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  };

  // ------------------------------------------------------------------ small shared UI
  function toast(message) {
    const box = document.getElementById("toast");
    if (!box) return;
    box.textContent = message;
    box.classList.add("show");
    clearTimeout(box._timer);
    box._timer = setTimeout(() => box.classList.remove("show"), 2400);
  }

  /** A dialog over the page (backdrop, Escape and × close it). */
  function openModal(innerHTML, { className = "", label = "", onClose } = {}) {
    const box = document.createElement("div");
    box.className = "modal-container";
    box.innerHTML = `<div class="modal-back" data-modal-close></div>
      <div class="dialog ${className}" role="dialog" aria-modal="true"${label ? ` aria-label="${esc(label)}"` : ""} tabindex="-1">${innerHTML}</div>`;
    document.body.appendChild(box);
    const before = document.activeElement;
    const dialog = box.querySelector(".dialog");
    const onKey = (ev) => { if (ev.key === "Escape") close(); };
    function close() {
      if (!box.isConnected) return;
      box.remove();
      document.removeEventListener("keydown", onKey);
      if (onClose) onClose();
      if (before && before.isConnected && before.focus) before.focus({ preventScroll: true });
    }
    document.addEventListener("keydown", onKey);
    box.addEventListener("click", (ev) => { if (ev.target.closest("[data-modal-close]")) close(); });
    setTimeout(() => (dialog.querySelector("[autofocus]") || dialog.querySelector(".dialog__close") || dialog).focus(), 0);
    return { el: dialog, close };
  }
  const dialogHeader = (titleHTML) => `<header class="dialog__header"><div class="dialog__title">${titleHTML}</div>
    <button type="button" class="dialog__close" data-modal-close aria-label="${esc(t("close"))}" title="${esc(t("close"))}">&times;</button></header>`;

  /** One sliding pill over 2–4 options (match mode, vocabulary level…). */
  function lineSelector(name, value, items, label) {
    const at = Math.max(0, items.findIndex(([v]) => v === value));
    return `<div class="line-selector" role="group" aria-label="${esc(label)}" data-seg="${esc(name)}" style="--length:${items.length};--index:${at}">
      <span class="slide" aria-hidden="true"></span>${items.map(([v, l]) =>
        `<button type="button" data-v="${esc(v)}" aria-pressed="${v === value}">${esc(l)}</button>`).join("")}</div>`;
  }
  function pickLine(group, button) {
    const buttons = [...group.querySelectorAll("button")];
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
    group.style.setProperty("--index", String(buttons.indexOf(button)));
  }

  // ------------------------------------------------------------------ header: menu, theme, back
  const PAGE_OF = { search: "search", word: "search", browse: "browse", verb: "verb", activity: "activity", users: "users", user: "users", profile: "profile", lookups: "lookups", about: "about" };
  let currentPage = "search";

  hooks.menu.push(
    { name: "search", icon: "📖", label: () => t("navSearch"), href: "#/", order: 10 },
    { name: "browse", icon: "🔤", label: () => t("navBrowse"), href: "#/browse/a", order: 20 },
    { name: "verb", icon: "📝", label: () => t("navVerb"), href: "#/verb", order: 30 },
    { name: "about", icon: "❓", label: () => t("navAbout"), href: "#/about", order: 90 },
  );

  function renderMenu() {
    const menu = document.getElementById("menu");
    if (!menu) return;
    const items = [...hooks.menu].sort((a, b) => a.order - b.order);
    menu.innerHTML = items.map((m) =>
      `<a class="menu-item" href="${esc(m.href)}" data-nav="${esc(m.name)}"${m.name === currentPage ? ' aria-current="page"' : ""}>
        <span class="menu-item-icon" aria-hidden="true">${m.icon}</span><span class="menu-item-text">${esc(m.label())}</span></a>`).join("") +
      `<a class="menu-item" href="https://neolatino.eu/" target="_blank" rel="noopener">
        <span class="menu-item-icon" aria-hidden="true">🌍</span><span class="menu-item-text">neolatino.eu</span><span class="menu-item-external" aria-hidden="true">↗</span></a>
      ${isStandalone() ? "" : `<button type="button" class="menu-item menu-item--install" data-install>
        <span class="menu-item-icon" aria-hidden="true">📲</span><span class="menu-item-text">${esc(t("installApp"))}</span></button>`}
      <div class="menu-sep" role="separator"></div>
      <div class="menu-lang"><span aria-hidden="true">🌐</span>
        <span class="seg-toggle" role="group" aria-label="Interface language">
          <button type="button" data-ui="nl" aria-pressed="${ui === "nl"}" title="Interfacie in neolatino">NL</button>
          <button type="button" data-ui="en" aria-pressed="${ui === "en"}" title="Interface in English">EN</button>
        </span></div>`;
    const active = items.find((m) => m.name === currentPage) || items[0];
    const trigger = document.getElementById("menu-button");
    trigger.querySelector(".dropdown-trigger-icon").textContent = active.icon;
    trigger.querySelector(".dropdown-trigger-text").textContent = active.label();
    trigger.setAttribute("aria-label", `${t("menu")}: ${active.label()}`);
  }

  function setMenuOpen(open) {
    const menu = document.getElementById("menu");
    const trigger = document.getElementById("menu-button");
    if (!menu) return;
    menu.classList.toggle("active", open);
    trigger.setAttribute("aria-expanded", String(open));
  }

  function setNav(name) {
    currentPage = PAGE_OF[name] || name || "search";
    document.querySelectorAll(".header__feeds [data-nav]").forEach((a) => {
      if (a.dataset.nav === currentPage) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    const back = document.getElementById("back-button");
    if (back) { back.hidden = currentPage === "search" && name !== "word"; back.href = lastSearchHash; }
    document.getElementById("logo")?.classList.toggle("active", currentPage === "search");
    renderMenu();
    hooks.onRoute.forEach((fn) => fn(name));
  }

  function currentTheme() { return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"; }
  function renderThemeToggle() {
    const button = document.getElementById("theme-toggle");
    if (!button) return;
    const dark = currentTheme() === "dark";
    const label = dark ? t("themeToLight") : t("themeToDark");
    button.innerHTML = dark ? ICONS.sun : ICONS.moon;
    button.title = label;
    button.setAttribute("aria-label", label);
  }

  function initHeader() {
    document.getElementById("theme-toggle")?.addEventListener("click", () => {
      const next = currentTheme() === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      store.set("nl-theme", next);
      renderThemeToggle();
    });
    document.getElementById("menu-button")?.addEventListener("click", (ev) => {
      ev.stopPropagation();
      setMenuOpen(!document.getElementById("menu").classList.contains("active"));
    });
    document.addEventListener("click", (ev) => {
      if (!ev.target.closest("#menu")) setMenuOpen(false);
      else if (ev.target.closest("a")) setMenuOpen(false);
      if (ev.target.closest("[data-install]")) { setMenuOpen(false); install(); }
      const lang = ev.target.closest("[data-ui]");
      if (lang) {
        ui = lang.dataset.ui; store.set("nl-ui", ui);
        setMenuOpen(false);
        applyUI(); hooks.onUi.forEach((fn) => fn(ui)); route();
      }
    });
    document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") setMenuOpen(false); });

    // touch screens have no hover: the first tap on the logo shows the neolatino.eu link
    const logo = document.getElementById("logo");
    const touch = matchMedia("(hover: none), (pointer: coarse)");
    const syncTouch = () => logo && logo.classList.toggle("touch-mode", touch.matches);
    syncTouch();
    touch.addEventListener?.("change", syncTouch);
    logo?.querySelector(".logo-flag").addEventListener("click", (ev) => {
      if (touch.matches && !logo.classList.contains("expanded")) { ev.preventDefault(); logo.classList.add("expanded"); }
      else logo.classList.remove("expanded");
    });
    document.addEventListener("pointerdown", (ev) => { if (logo && !logo.contains(ev.target)) logo.classList.remove("expanded"); });
  }

  // ------------------------------------------------------------------ routing
  function parseHash() {
    const h = location.hash.replace(/^#\/?/, "");
    const [path, qs] = h.split("?");
    const params = Object.fromEntries(new URLSearchParams(qs || ""));
    const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
    return { parts, params };
  }
  function buildHash(path, params) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== "" && v != null) p.set(k, v);
    const s = p.toString();
    return "#/" + path + (s ? "?" + s : "");
  }

  const view = () => document.getElementById("view");
  let lastSearchHash = "#/";

  function route(dataRefresh) {
    const { parts, params } = parseHash();
    const name = parts[0] || "search";
    // Avoid wiping a search box the user is typing in when fresh data arrives
    if (dataRefresh && name === "search" && document.getElementById("f-q")) { runSearch(); return; }
    if (D.error && !D.loaded) { view().innerHTML = `<p class="loading">${esc(t("loadError"))}</p>`; return; }
    if (name === "verb") { setNav("verb"); return renderVerbPage(parts[1] || params.v || ""); }
    if (hooks.routes[name]) { setNav(name); return hooks.routes[name](parts, params, { dataRefresh: !!dataRefresh }); }
    if (!D.loaded) { view().innerHTML = `<p class="loading" role="status">${esc(t("loading"))}</p>`; setNav(name); return; }
    if (name === "browse") { setNav("browse"); return renderBrowse(parts[1] || "a", params); }
    if (name === "word") { setNav("word"); return renderWord(parts[1], params); }
    setNav("search");
    renderSearch(params);
  }

  // ------------------------------------------------------------------ shared rendering
  function optionList(items, selected) {
    return items.map(([v, label]) => `<option value="${esc(v)}"${v === selected ? " selected" : ""}>${esc(label)}</option>`).join("");
  }
  function langOptions(selected, withAll) {
    const items = (withAll ? [["all", t("allLangs")]] : []).concat(LANGS.map((l) => [l.code, l[ui]]));
    return optionList(items, selected);
  }
  function posOptions(selected) {
    return optionList([["", t("any")]].concat(POS.map((p) => [p[0], t("pos")[p[0]]])), selected);
  }
  function themeOptions(selected) {
    const th = [...D.themes.keys()].sort(collator.compare);
    return optionList([["", t("any")]].concat(th.map((x) => [x, x])), selected);
  }
  function subOptions(theme, selected) {
    const subs = theme && D.themes.has(theme) ? [...D.themes.get(theme)].sort(collator.compare) : [];
    return optionList([["", t("any")]].concat(subs.map((x) => [x, x])), selected);
  }
  function levelBadges(e) {
    if (e.ess) return `<span class="word-status word-status--e" title="${esc(t("essentialTitle"))}">${esc(t("essentialBadge"))}</span>`;
    if (e.bas) return `<span class="word-status word-status--b" title="${esc(t("basicTitle"))}">${esc(t("basicBadge"))}</span>`;
    return "";
  }
  const themeText = (e) => [e.t1, e.t2, e.t3].filter(Boolean).join(" › ");
  const posTitle = (e) => [...e.pos].map((p) => t("pos")[p]).join(", ");
  const availablePanels = (e) => hooks.panels.filter((p) => !p.available || p.available(e));

  /** The line under the word: the input-language match, or the chosen translation (else English). */
  function glossHTML(e, show, q, matched) {
    const i = show != null && show > 0 && e.v[show] ? show : LANG_INDEX.eng;
    if (!e.v[i]) return "";
    return `<span class="lang-tag">${esc(LANGS[i][ui])}</span><span>${i === matched ? highlight(e.v[i], q) : esc(e.v[i])}</span>`;
  }

  function tabButtonHTML(p, e) {
    return `<button type="button" class="action-button" data-tab="${p.key}" data-id="${esc(e.id)}" aria-pressed="false">
      <span class="action-button__icon">${p.icon || ""}</span><span class="action-button__label">${esc(p.label(e))}</span><span class="action-button__count" data-count="${p.key}"></span></button>`;
  }

  /** One result card: the Neolatino word, its category, the match, the buttons. */
  function cardHTML(e, opts = {}) {
    // li: the column the search matched; show: the column shown under the word (the translation in Neolatino → language)
    const { q = "", li = null, page = false, target = false } = opts;
    const show = opts.show === undefined ? li : opts.show;
    const word = page
      ? `<h1 class="results-card__word">${esc(e.v[0])}</h1>`
      : `<a class="results-card__word" href="#/word/${encodeURIComponent(e.id)}">${li === 0 ? highlight(e.v[0], q) : esc(e.v[0])}</a>`;
    const extra = hooks.entryActions.map((fn) => fn(e, opts)).join("");
    const gloss = glossHTML(e, show, q, li);
    return `<div class="results-card" data-id="${esc(e.id)}" data-li="${show ?? -1}">
      <div class="results-card__main">
        <div class="results-card__text translate">${word}${levelBadges(e)}</div>
        <div class="results-card__pos">${e.cat ? `<span class="pos-hint" title="${esc(posTitle(e))}">${esc(e.cat)}</span>` : ""}${themeText(e) ? `<span class="results-card__theme">${esc(themeText(e))}</span>` : ""}</div>
        ${gloss ? `<div class="results-card__text original${target ? " is-target" : ""}">${gloss}</div>` : ""}
        <div class="results-card-actions" role="toolbar">${extra}${availablePanels(e).map((p) => tabButtonHTML(p, e)).join("")}</div>
      </div>
      <div class="results-card__details" hidden></div>
    </div>`;
  }

  /** Extra buttons under a panel (e.g. "share as image"), from add-ons. */
  function panelFooter(key, e, ctx) {
    const parts = (hooks.panelFooters[key] || []).map((fn) => fn(e, ctx)).filter(Boolean);
    return parts.length ? `<div class="panel-footer">${parts.join("")}</div>` : "";
  }

  /** Fill a details box with one tab (translations, conjugation, statistics, comments). */
  async function renderDetails(e, key, el, ctx, { explicit = true } = {}) {
    const def = hooks.panels.find((p) => p.key === key);
    if (!def) return;
    el.dataset.id = e.id;
    el.dataset.panel = key;
    if (key !== "tr" && key !== "cj") compares.delete(e.id); // only translations and conjugation compare words
    setComparing(el, false);
    el.innerHTML = "";
    try {
      await def.render(e, el, ctx);
    } catch (err) {
      console.error(err);
      if (el.dataset.id === e.id && el.dataset.panel === key) el.innerHTML = `<p class="muted">${esc(String(err.message || err))}</p>`;
    }
    if (explicit) hooks.onOpen.forEach((fn) => fn(e, key));
  }

  // built-in tabs: translations and (for verbs) conjugation
  hooks.panels.push({
    key: "tr",
    icon: ICONS.translations,
    label: () => t("translations"),
    render(e, el, ctx) { renderCompare(e, el, ctx, "tr"); },
  });
  hooks.panels.push({
    key: "cj",
    icon: ICONS.forms,
    label: () => t("conjugation"),
    available: (e) => e.isVerb && !!NLConj.conjugate(e.v[0]),
    render(e, el, ctx) { renderCompare(e, el, ctx, "cj"); },
  });

  // ------------------------------------------------------------------ compare words (as in the Interslavic dictionary)
  // "Comparare con…" above the translations or the conjugation: up to three more words next to
  // the open one (four in all), side by side (the row scrolls sideways) or one below another.
  const COMPARE_MAX = 3;
  const compares = new Map(); // id of the open word → { ids: [compared ids], layout: "h" | "v" }
  let compareDir = null; // { rev, l }: the compare box searches like the main box until changed

  function compareDirection() {
    if (!compareDir) {
      const rev = S ? S.rev : store.get("nl-dir", "") === "nl";
      const l = S ? S.l : store.get(rev ? "nl-output-lang" : "nl-input-lang", rev ? "eng" : "all");
      compareDir = { rev, l: rev && (!(l in LANG_INDEX) || l === "lat") ? "eng" : l };
    }
    return compareDir;
  }

  const compareContent = (x, mode, li) => {
    if (mode === "tr") return `<div class="word-section">${translationsHTML(x, li)}</div>`;
    const c = x.isVerb ? NLConj.conjugate(x.v[0]) : null;
    return c ? conjHTML(c) : `<p class="muted">${esc(t("compareNoConj"))}</p>`;
  };

  function compareLangsHTML() {
    const dir = compareDirection();
    const others = LANGS.filter((l) => l.code !== "lat").map((l) => [l.code, l[ui]]);
    const select = `<select class="select select--small" data-compare-lang aria-label="${esc(dir.rev ? t("outputLang") : t("inputLang"))}">${
      optionList(dir.rev ? others : [["all", t("allLangs")], ...others], dir.l)}</select>`;
    const neo = `<span class="lang-selector__neo compare-search__neo">${esc(t("toNeo"))}</span>`;
    const swap = `<button type="button" class="lang-selector__swap compare-search__swap${dir.rev ? " rotate" : ""}" data-compare-swap aria-label="${esc(t("swapDir"))}" title="${esc(t("swapDir"))}">${ICONS.swap}</button>`;
    return dir.rev ? neo + swap + select : select + swap + neo;
  }

  function renderCompare(e, el, ctx, mode) {
    el._ctx = ctx;
    el._compareObserver?.disconnect();
    const state = compares.get(e.id) || { ids: [], layout: "h" };
    const others = state.ids.map((id) => D.byId.get(id)).filter(Boolean);
    const n = others.length;
    const layout = n ? (state.layout === "v" ? "vertical" : "horizontal") : "single";
    const header = (x, i) => `<div class="column-header"><a href="#/word/${encodeURIComponent(x.id)}">${esc(x.v[0])}</a>${i >= 0
      ? `<button type="button" class="column-close" data-compare-remove="${i}" aria-label="${esc(`${t("compareRemove")}: ${x.v[0]}`)}" title="${esc(t("compareRemove"))}">&times;</button>` : ""}</div>`;
    const search = n < COMPARE_MAX ? `<div class="compare-search">
        <div class="compare-search__controls">
          <input class="compare-search__input" type="search" autocomplete="off" spellcheck="false" autocapitalize="off"
            placeholder="${esc(n ? t("compareAdd") : t("compareWith"))}" aria-label="${esc(n ? t("compareAdd") : t("compareWith"))}"
            role="combobox" aria-expanded="false" aria-autocomplete="list">
          <div class="compare-search__langs">${compareLangsHTML()}</div>
        </div>
        <ul class="compare-search__suggestions" role="listbox" hidden></ul>
      </div>` : "";
    const toggle = n ? `<div class="layout-toggle" role="group" aria-label="${esc(t("compareLayout"))}">${[["h", "↔", "compareSideBySide"], ["v", "↕", "compareStacked"]].map(([v, icon, k]) =>
      `<button type="button" class="layout-toggle-btn" data-compare-layout="${v}" aria-pressed="${state.layout === v}" title="${esc(t(k))}" aria-label="${esc(t(k))}">${icon}</button>`).join("")}</div>` : "";
    el.innerHTML = `<div class="compare-root" data-mode="${mode}">
        <div class="compare-header">${search}${toggle}</div>
        <div class="compare-scroller">
          <div class="compare-columns compare-columns--${layout} compare-columns--${mode}">
            <div class="compare-column">${n ? header(e, -1) : ""}${compareContent(e, mode, ctx.li)}</div>
            ${others.map((x, i) => `<div class="compare-column">${header(x, i)}${compareContent(x, mode, ctx.li)}</div>`).join("")}
          </div>
          <button type="button" class="compare-scroller__arrow compare-scroller__arrow--start" data-compare-scroll="-1" aria-label="${esc(t("compareScrollLeft"))}" title="${esc(t("compareScrollLeft"))}">‹</button>
          <button type="button" class="compare-scroller__arrow compare-scroller__arrow--end" data-compare-scroll="1" aria-label="${esc(t("compareScrollRight"))}" title="${esc(t("compareScrollRight"))}">›</button>
        </div>
      </div>${n ? "" : panelFooter(mode, e, ctx)}`; // "share as image" for the word alone
    setComparing(el, n > 0);
    // side by side: faded edges and arrows when the columns don't fit
    const row = el.querySelector(".compare-columns--horizontal");
    if (row) {
      const box = row.parentElement;
      const update = () => {
        const max = row.scrollWidth - row.clientWidth;
        box.classList.toggle("compare-scroller--start", row.scrollLeft > 2);
        box.classList.toggle("compare-scroller--end", row.scrollLeft < max - 2);
      };
      row.addEventListener("scroll", update, { passive: true });
      if (typeof ResizeObserver !== "undefined") {
        el._compareObserver = new ResizeObserver(update);
        el._compareObserver.observe(row);
        [...row.children].forEach((c) => el._compareObserver.observe(c));
      }
      requestAnimationFrame(update);
    }
  }

  /** While comparing, the card (narrow screens) or the side pane (wide) takes more room. */
  function setComparing(el, on) {
    const card = el.closest(".results-card");
    if (el.closest("#word-panel")) el.closest(".dictionary-page")?.classList.toggle("dictionary-page--comparing", on);
    else card?.classList.toggle("comparing", on);
  }

  function rerenderCompare(el) {
    const e = D.byId.get(el.dataset.id);
    if (e) renderCompare(e, el, el._ctx || {}, el.dataset.panel);
  }

  function compareSuggestions(input) {
    const root = input.closest(".compare-root");
    const el = root.closest(".results-card__details");
    const list = root.querySelector(".compare-search__suggestions");
    const q = input.value.trim();
    const close = () => { list.hidden = true; list.innerHTML = ""; input.setAttribute("aria-expanded", "false"); };
    if (q.length < 2) { close(); return; }
    const dir = compareDirection();
    const mode = root.dataset.mode;
    const taken = new Set([el.dataset.id, ...((compares.get(el.dataset.id) || {}).ids || [])]);
    const found = [];
    for (const r of search({ q, rev: dir.rev, l: dir.l, m: "start" })) {
      if (taken.has(r.e.id)) continue;
      if (mode === "cj" && !(r.e.isVerb && NLConj.conjugate(r.e.v[0]))) continue;
      found.push(r);
      if (found.length >= 20) break;
    }
    if (!found.length) { close(); return; }
    const qn = norm(q);
    // the same word more than once: show what tells the rows apart (category, else topic)
    const groups = new Map();
    for (const r of found) groups.set(r.e.v[0], [...(groups.get(r.e.v[0]) || []), r.e]);
    const metaOf = (x) => {
      const twins = groups.get(x.v[0]);
      if (twins.length < 2) return "";
      const key = ["cat", "t3", "t2", "t1"].find((k) => new Set(twins.map((y) => y[k])).size > 1);
      return key ? x[key] : "";
    };
    list.innerHTML = found.map((r, i) => {
      const gi = dir.rev ? LANG_INDEX[dir.l] : (r.li > 0 ? r.li : LANG_INDEX.eng);
      const meta = metaOf(r.e);
      return `<li role="option" id="cmp-${el.dataset.id}-${i}" class="compare-search__item" data-compare-add="${esc(r.e.id)}" aria-selected="${i === 0}">
        <span class="compare-search__word">${r.li === 0 ? highlight(r.e.v[0], qn) : esc(r.e.v[0])}${meta ? `<span class="compare-search__meta">${esc(meta)}</span>` : ""}</span>
        <span class="compare-search__translate">${r.li === gi ? highlight(r.e.v[gi] || "", qn) : esc(r.e.v[gi] || "")}</span></li>`;
    }).join("");
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function addCompare(el, id) {
    const state = compares.get(el.dataset.id) || { ids: [], layout: "h" };
    if (state.ids.length >= COMPARE_MAX || state.ids.includes(id) || id === el.dataset.id) return;
    state.ids.push(id);
    compares.set(el.dataset.id, state);
    rerenderCompare(el);
    // keep typing: the next word goes in the same box
    el.querySelector(".compare-search__input")?.focus({ preventScroll: true });
  }

  let compareTimer = null;
  document.addEventListener("input", (ev) => {
    const input = ev.target.closest(".compare-search__input");
    if (!input) return;
    clearTimeout(compareTimer);
    compareTimer = setTimeout(() => compareSuggestions(input), 150);
  });
  document.addEventListener("change", (ev) => {
    const select = ev.target.closest("[data-compare-lang]");
    if (!select) return;
    compareDirection().l = select.value;
    compareSuggestions(select.closest(".compare-root").querySelector(".compare-search__input"));
  });
  document.addEventListener("keydown", (ev) => {
    const input = ev.target.closest(".compare-search__input");
    if (!input) return;
    const list = input.closest(".compare-search").querySelector(".compare-search__suggestions");
    const items = [...list.querySelectorAll("[data-compare-add]")];
    const at = items.findIndex((x) => x.getAttribute("aria-selected") === "true");
    if ((ev.key === "ArrowDown" || ev.key === "ArrowUp") && items.length && !list.hidden) {
      ev.preventDefault();
      const next = (at + (ev.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items.forEach((x, i) => x.setAttribute("aria-selected", String(i === next)));
      items[next].scrollIntoView({ block: "nearest" });
      input.setAttribute("aria-activedescendant", items[next].id);
    } else if (ev.key === "Enter" && items.length && !list.hidden) {
      ev.preventDefault();
      addCompare(input.closest(".results-card__details"), (items[at] || items[0]).dataset.compareAdd);
    } else if (ev.key === "Escape" && !list.hidden) {
      ev.stopPropagation();
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("mousedown", (ev) => {
    // a click outside the box closes its suggestions
    document.querySelectorAll(".compare-search__suggestions:not([hidden])").forEach((list) => {
      if (!list.closest(".compare-search").contains(ev.target)) { list.hidden = true; list.previousElementSibling?.querySelector("input")?.setAttribute("aria-expanded", "false"); }
    });
  });
  document.addEventListener("click", (ev) => {
    const root = ev.target.closest(".compare-root");
    if (!root) return;
    const el = root.closest(".results-card__details");
    const add = ev.target.closest("[data-compare-add]");
    if (add) { addCompare(el, add.dataset.compareAdd); return; }
    const remove = ev.target.closest("[data-compare-remove]");
    if (remove) {
      const state = compares.get(el.dataset.id);
      if (state) state.ids.splice(Number(remove.dataset.compareRemove), 1);
      if (state && !state.ids.length) compares.delete(el.dataset.id);
      rerenderCompare(el);
      return;
    }
    const layout = ev.target.closest("[data-compare-layout]");
    if (layout) {
      const state = compares.get(el.dataset.id);
      if (state) { state.layout = layout.dataset.compareLayout; rerenderCompare(el); }
      return;
    }
    if (ev.target.closest("[data-compare-swap]")) {
      const dir = compareDirection();
      if (dir.rev) dir.l = dir.l || "all";
      else if (dir.l === "all") dir.l = "eng";
      dir.rev = !dir.rev;
      root.querySelector(".compare-search__langs").innerHTML = compareLangsHTML();
      compareSuggestions(root.querySelector(".compare-search__input"));
      return;
    }
    const arrow = ev.target.closest("[data-compare-scroll]");
    if (arrow) {
      // to the next / previous column that isn't fully visible
      const row = root.querySelector(".compare-columns--horizontal");
      if (!row) return;
      const dirn = Number(arrow.dataset.compareScroll);
      const left = row.getBoundingClientRect().left;
      const view = { start: row.scrollLeft, end: row.scrollLeft + row.clientWidth };
      const cols = [...row.children].map((c) => { const r = c.getBoundingClientRect(); const start = r.left - left + row.scrollLeft; return { start, end: start + r.width }; });
      let target;
      if (dirn > 0) target = cols.find((c) => c.end > view.end + 2)?.start;
      else { const prev = [...cols].reverse().find((c) => c.start < view.start - 2); target = prev && Math.min(prev.start, prev.end - row.clientWidth); }
      row.scrollTo({ left: target ?? row.scrollLeft + dirn * row.clientWidth * 0.8, behavior: "smooth" });
    }
  });

  function translationsHTML(e, li) {
    const proper = /^npr/i.test(e.cat);
    const rows = LANGS.map((l, i) => (i === 0 || !e.v[i]) ? "" :
      `<tr${i === li ? ' class="is-input"' : ""}><th scope="row">${esc(l[ui])}</th><td>${wordLinksHTML(e.v[i], l.code, proper)}</td></tr>`).join("");
    return `<div class="table-shell"><table class="table translations-table"><tbody>${rows}</tbody></table></div>`;
  }

  // ------------------------------------------------------------------ translations → Wiktionary (as in the Interslavic dictionary)
  // Every word of a natural language opens a small menu; "Wiktionary" shows the word's page
  // from the Wiktionary in that language under the table. Interslavic opens the Interslavic dictionary.
  const WIKI = { por: "pt", spa: "es", cat: "ca", oci: "oc", fra: "fr", srd: "sc", ita: "it", rum: "ro", eng: "en", sla: "isv" };

  /** "colar, pegar" → two words; Sardinian "melingiana/melinzana" → two; "a/in/dae cuddae" stays one. */
  function splitCell(value) {
    value = String(value || "").trim();
    const parts = (sep) => value.split(sep).map((p) => p.trim()).filter(Boolean);
    if (value.includes(";")) return [parts(";"), "; "];
    if (value.includes(",")) return [parts(","), ", "];
    if (value.includes("/") && !/\s/.test(value)) return [parts("/"), " / "];
    return [value ? [value] : [], ""];
  }

  /** The Wiktionary page name: no notes in brackets, English verbs without "to", Romanian without "a",
   *  common words in lower case (page names are case-sensitive), proper nouns capitalized. */
  function wikiTitle(word, wiki, proper) {
    let s = String(word).replace(/\*/g, "");
    s = s.startsWith("(") ? s.replace(/[()]/g, "") : s.replace(/\s*[(\[][^)\]]*[)\]]\s*/g, " ");
    s = s.replace(/\s+/g, " ").replace(/^[\s.;:]+|[\s.;:]+$/g, "");
    if (wiki === "en") s = s.replace(/^to\s+/, "");
    if (wiki === "ro") s = s.replace(/^a\s+(?=\S)/, "");
    if (!s) return "";
    return (proper ? s[0].toLocaleUpperCase() : s[0].toLocaleLowerCase()) + s.slice(1);
  }

  function wikiUrl(word, wiki, proper) {
    if (wiki === "isv") {
      const clean = String(word).replace(/\*/g, "").replace(/\s*\([^)]*\)/g, "").trim();
      return clean ? `https://interslavic.forum/slovnik/?text=${encodeURIComponent(clean)}&lang=isv-en` : "";
    }
    const title = wikiTitle(word, wiki, proper);
    return title ? `https://${wiki}.wiktionary.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}` : "";
  }

  function wordLinksHTML(value, code, proper) {
    const wiki = WIKI[code];
    if (!wiki) return esc(value); // Inter-Romance, Folkspraak, Frenkisch: no Wiktionary
    const [words, sep] = splitCell(value);
    if (!words.length) return esc(value);
    return words.map((w) => {
      const url = wikiUrl(w, wiki, proper);
      return url
        ? `<a class="wiktionary-word-link" href="${esc(url)}" target="_blank" rel="noopener" data-wlang="${esc(code)}" data-word="${esc(w)}"${proper ? " data-proper" : ""}>${esc(w)}</a>`
        : esc(w);
    }).join(esc(sep));
  }

  let wordMenu = null; // { el, link, rect: where the word was when the menu was placed }

  function closeWordMenu() {
    if (!wordMenu) return;
    wordMenu.el.remove();
    wordMenu.link.removeAttribute("aria-expanded");
    wordMenu = null;
  }

  function openWordMenu(link, x, y) {
    const same = wordMenu && wordMenu.link === link;
    closeWordMenu();
    if (same) return; // the same word again closes the menu
    const code = link.dataset.wlang;
    const wiki = WIKI[code];
    const word = link.dataset.word;
    const url = link.href;
    const lang = LANGS[LANG_INDEX[code]][ui];
    const items = wiki === "isv"
      ? `<a class="dict-word-menu__item" href="${esc(url)}" target="_blank" rel="noopener" data-menu-close>
          <span class="dict-word-menu__item-name">${esc(t("isvDict"))}</span><span class="dict-word-menu__item-kind">↗</span></a>`
      : `<button type="button" class="dict-word-menu__item" data-wiktionary>
          <span class="dict-word-menu__item-name">Wiktionary</span><span class="dict-word-menu__item-kind">⧉</span></button>
        <a class="dict-word-menu__item" href="${esc(url)}" target="_blank" rel="noopener" data-menu-close>
          <span class="dict-word-menu__item-name">${esc(t("openNewTab"))}</span><span class="dict-word-menu__item-kind">↗</span></a>`;
    const el = document.createElement("div");
    el.className = "dict-word-menu";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", `${lang}: ${word}`);
    el.innerHTML = `<div class="dict-word-menu__header"><strong>${esc(word)}</strong><span>${esc(lang)}</span>
        <button type="button" class="dict-word-menu__close" data-menu-close aria-label="${esc(t("close"))}" title="${esc(t("close"))}">&times;</button></div>
      <div class="dict-word-menu__list"><div class="dict-word-menu__section">${esc(t("dictsExternal"))}</div>${items}</div>`;
    document.body.appendChild(el);
    wordMenu = { el, link, rect: link.getBoundingClientRect() };
    link.setAttribute("aria-expanded", "true");
    // below the click; above it when there is no room below; always inside the window
    const box = el.getBoundingClientRect();
    let top = y + 18;
    if (top + box.height > innerHeight - 8) top = y - box.height - 12;
    el.style.left = `${Math.max(8, Math.min(x, innerWidth - box.width - 8))}px`;
    el.style.top = `${Math.max(8, top)}px`;
    el.addEventListener("click", (ev) => {
      if (ev.target.closest("[data-wiktionary]")) {
        // the table was redrawn meanwhile: open the page in a new tab instead
        if (link.isConnected) showWiktionary(link, { url, word, lang }); else window.open(url, "_blank", "noopener");
        closeWordMenu();
      } else if (ev.target.closest("[data-menu-close]")) closeWordMenu();
    });
    (el.querySelector("[data-wiktionary]") || el.querySelector(".dict-word-menu__item")).focus({ preventScroll: true });
  }

  /** The Wiktionary page inside the word's details, under the translations. */
  function showWiktionary(link, { url, word, lang }) {
    const details = link.closest(".results-card__details") || link.closest(".word-section");
    if (!details) { window.open(url, "_blank", "noopener"); return; }
    details.querySelector(".wiktionary-expansion")?.remove();
    const box = document.createElement("div");
    box.className = "wiktionary-expansion";
    box.innerHTML = `<div class="wiktionary-expansion__header">
        <span class="wiktionary-expansion__title">${esc(lang)}: <strong>${esc(word)}</strong></span>
        <div class="wiktionary-expansion__actions">
          <a class="wiktionary-expansion__external" href="${esc(url)}" target="_blank" rel="noopener">${esc(t("openNewTab"))} →</a>
          <button type="button" class="wiktionary-expansion__close" aria-label="${esc(t("close"))}" title="${esc(t("close"))}">&times;</button>
        </div></div>
      <div class="wiktionary-expansion__content"><iframe class="wiktionary-expansion__iframe" src="${esc(url)}" title="Wiktionary: ${esc(word)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
    const section = link.closest(".word-section");
    if (section) section.after(box); else details.appendChild(box);
    box.querySelector(".wiktionary-expansion__close").addEventListener("click", () => box.remove());
    box.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  document.addEventListener("click", (ev) => {
    const link = ev.target.closest(".wiktionary-word-link");
    if (link) {
      // ctrl / ⌘ / middle click: straight to Wiktionary in a new tab
      if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button) return;
      ev.preventDefault();
      const r = link.getBoundingClientRect();
      // keyboard (Enter) gives no pointer position: use the word itself
      const x = ev.detail ? ev.clientX : r.left;
      const y = ev.detail ? ev.clientY : r.bottom - 12;
      openWordMenu(link, x, y);
      return;
    }
    if (wordMenu && !wordMenu.el.contains(ev.target)) closeWordMenu();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && wordMenu) { const link = wordMenu.link; closeWordMenu(); link.focus(); }
  });
  // the menu follows its word when the page scrolls (or a phone's address bar slides away),
  // and closes when the word leaves the screen
  function followWord() {
    if (!wordMenu) return;
    const { el, link } = wordMenu;
    if (!link.isConnected) { closeWordMenu(); return; }
    const r = link.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) { closeWordMenu(); return; }
    const dx = r.left - wordMenu.rect.left, dy = r.top - wordMenu.rect.top;
    if (!dx && !dy) return;
    wordMenu.rect = r;
    el.style.left = `${Math.max(8, Math.min(parseFloat(el.style.left) + dx, innerWidth - el.offsetWidth - 8))}px`;
    el.style.top = `${parseFloat(el.style.top) + dy}px`;
  }
  addEventListener("scroll", (ev) => { if (wordMenu && !wordMenu.el.contains(ev.target)) followWord(); }, true);
  addEventListener("resize", followWord);
  addEventListener("hashchange", () => closeWordMenu());

  function conjHTML(c) {
    const tb = NLConj.table(c.forms);
    const S = STR[ui];
    let note = "";
    if (c.source === "official") note = `<p class="conj-note">${esc(S.srcOfficial)}</p>`;
    else if (c.source === "derived") note = `<p class="conj-note warn">${esc(S.srcDerived(c.base))}</p>`;
    else note = `<p class="conj-note warn">${esc(S.srcRegular)}</p>`;
    if (c.reflexive) note += `<p class="conj-note">${esc(S.reflexive)}</p>`;
    if (tb.comment) note += `<p class="conj-note">${esc(tb.comment)}</p>`;
    const row = (label, value) => `<tr><th scope="row">${esc(label)}</th><td>${esc(value)}</td></tr>`;
    const nonfinite = `<div class="word-section"><div class="table-shell"><table class="table"><tbody>
      ${row(S.nonfinite.inf, tb.infinitive)}${row(S.nonfinite.ger, tb.gerund)}${row(S.nonfinite.pp, tb.presentParticiple)}${row(S.nonfinite.pa, tb.pastParticiple)}
      </tbody></table></div></div>`;
    const moods = {};
    for (const sec of tb.sections) (moods[sec.mood] = moods[sec.mood] || []).push(sec);
    // phones: at most two tenses side by side, so the tables fit without scrolling
    const perTable = matchMedia("(max-width: 560px)").matches ? 2 : 4;
    const table = (secs, imperative) => {
      const persons = imperative ? NLConj.IMP_PERSONS : NLConj.PERSONS;
      const head = imperative ? "" : `<thead><tr><th></th>${secs.map((sec) => `<th scope="col">${esc(S.tenses[sec.key])}</th>`).join("")}</tr></thead>`;
      const rows = persons.map((p, i) => `<tr><th scope="row">${esc(p)}</th>${secs.map((sec) => `<td>${esc(sec.forms[i])}</td>`).join("")}</tr>`).join("");
      return `<div class="table-shell"><table class="table conj-table">${head}<tbody>${rows}</tbody></table></div>`;
    };
    const body = Object.entries(moods).map(([mood, secs]) => {
      const imperative = mood === "imperativo";
      const groups = [];
      for (let i = 0; i < secs.length; i += perTable) groups.push(secs.slice(i, i + perTable));
      return `<div class="word-section"><h3 class="word-section__title">${esc(S.moods[mood])}</h3>${groups.map((g) => table(g, imperative)).join("")}</div>`;
    }).join("");
    return `${note}<div class="conj-tables">${nonfinite}${body}</div>`;
  }

  // ------------------------------------------------------------------ cards: inline tabs (narrow) / side pane (wide)
  const WIDE = matchMedia("(min-width: 1100px)");
  const isWide = () => WIDE.matches;
  WIDE.addEventListener?.("change", () => route());

  let sel = { id: null, tab: "tr", explicit: false };
  const liById = new Map(); // which input language matched, for the side pane
  let previewTimer = null;

  function toggleCardTab(card, key, forceOpen) {
    const e = D.byId.get(card.dataset.id);
    const details = card.querySelector(".results-card__details");
    if (!e || !details) return;
    const open = forceOpen ?? card.dataset.open !== key;
    card.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-pressed", String(open && b.dataset.tab === key)));
    if (!open) {
      compares.delete(card.dataset.id);
      card.classList.remove("comparing");
      delete card.dataset.open;
      details.hidden = true;
      details.innerHTML = "";
      card.classList.remove("expanded");
      return;
    }
    card.dataset.open = key;
    details.hidden = false;
    card.classList.add("expanded");
    renderDetails(e, key, details, { li: Number(card.dataset.li ?? -1), card });
  }

  function select(id, tab, explicit) {
    clearTimeout(previewTimer);
    if (sel.id && sel.id !== id) compares.delete(sel.id); // another word in the pane: compare afresh
    sel = { id, tab: tab || "tr", explicit: !!explicit };
    renderPanel();
    syncCards();
  }

  function syncCards() {
    document.querySelectorAll(".dictionary-page__main .results-card").forEach((card) => {
      const on = card.dataset.id === sel.id;
      card.classList.toggle("active-word", on);
      card.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-pressed", String(on && sel.explicit && b.dataset.tab === sel.tab)));
    });
  }

  function renderPanel() {
    const panel = document.getElementById("word-panel");
    if (!panel) return;
    const e = sel.id ? D.byId.get(sel.id) : null;
    if (!e) {
      panel.closest(".dictionary-page")?.classList.remove("dictionary-page--comparing");
      panel.className = "word-panel word-panel--empty";
      const query = document.getElementById("f-q")?.value.trim();
      panel.innerHTML = `<div class="word-panel__placeholder"><span class="word-panel__placeholder-icon" aria-hidden="true">📖</span><p>${esc(query ? t("noResults") : t("placeholder"))}</p></div>`;
      return;
    }
    const tabs = availablePanels(e);
    if (!tabs.some((p) => p.key === sel.tab)) sel.tab = "tr";
    const li = liById.has(e.id) ? liById.get(e.id) : null;
    const gloss = glossHTML(e, li, "", null);
    panel.className = "word-panel";
    panel.innerHTML = `<div class="results-card" data-id="${esc(e.id)}" data-li="${li ?? -1}">
      <div class="word-panel__head">
        <div class="word-panel__word"><a href="#/word/${encodeURIComponent(e.id)}">${esc(e.v[0])}</a>${levelBadges(e)}</div>
        <div class="word-panel__meta">${e.cat ? `<span class="pos-hint" title="${esc(posTitle(e))}">${esc(e.cat)}</span>` : ""}${themeText(e) ? `<span>${esc(themeText(e))}</span>` : ""}${gloss ? `<span class="word-panel__match">${gloss}</span>` : ""}</div>
        <div class="tabs-pill" role="tablist">${tabs.map((p) =>
          `<button type="button" role="tab" class="tabs-pill__tab" data-ptab="${p.key}" aria-selected="${p.key === sel.tab}">${esc(p.label(e))}<span class="action-button__count" data-count="${p.key}"></span></button>`).join("")}</div>
      </div>
      <div class="results-card__details"></div>
    </div>`;
    const details = panel.querySelector(".results-card__details");
    renderDetails(e, sel.tab, details, { li, card: panel }, { explicit: sel.explicit });
    hooks.afterResults.forEach((fn) => fn(panel, [e]));
    // the first result shown here counts as looked up once it has been on screen a moment
    if (!sel.explicit) {
      const id = e.id;
      previewTimer = setTimeout(() => { if (sel.id === id) hooks.onOpen.forEach((fn) => fn(e, "preview")); }, 2500);
    }
  }

  document.addEventListener("click", (ev) => {
    const ptab = ev.target.closest("[data-ptab]");
    if (ptab) { select(sel.id, ptab.dataset.ptab, true); return; }
    const btn = ev.target.closest(".results-card [data-tab]");
    if (!btn) return;
    const card = btn.closest(".results-card");
    if (isWide() && document.getElementById("word-panel")) select(card.dataset.id, btn.dataset.tab, true);
    else toggleCardTab(card, btn.dataset.tab);
  });

  /** Counts on the comment / statistics buttons (from community.js). */
  function setCount(id, key, n) {
    document.querySelectorAll(`[data-id="${CSS.escape(String(id))}"] [data-count="${key}"], [data-tab="${key}"][data-id="${CSS.escape(String(id))}"] [data-count="${key}"]`)
      .forEach((badge) => { badge.textContent = n ? String(n) : ""; });
  }

  // ------------------------------------------------------------------ search page
  let S = null; // current search state
  let shown = 0, lastResults = [];

  function pageShell(mainHTML) {
    const wide = isWide();
    return `<div class="dictionary-page${wide ? " dictionary-page--wide" : ""}">
      <div class="dictionary-page__main">${mainHTML}</div>
      ${wide ? `<aside class="word-panel" id="word-panel" aria-live="polite"></aside>` : ""}
    </div>`;
  }

  function renderSearch(params) {
    // direction: language → Neolatino (default), or Neolatino → language (d=nl)
    const rev = params.d === "nl" || params.l === "lat" || (!params.q && !params.l && params.d === undefined && store.get("nl-dir", "") === "nl");
    S = {
      q: params.q || "",
      rev,
      l: params.l || (rev ? store.get("nl-output-lang", "eng") : store.get("nl-input-lang", "all")),
      pos: params.pos || "", th: params.th || "", sub: params.sub || "",
      lvl: params.lvl || "", m: params.m || "start",
    };
    if (S.rev && (!(S.l in LANG_INDEX) || S.l === "lat")) S.l = store.get("nl-output-lang", "eng");
    if (S.rev && (!(S.l in LANG_INDEX) || S.l === "lat")) S.l = "eng";
    if (!S.rev && S.l !== "all" && (!(S.l in LANG_INDEX) || S.l === "lat")) S.l = "all";
    const filtersActive = !!(S.pos || S.th || S.sub || S.lvl || S.m !== "start");
    const expanded = filtersActive || store.get("nl-options-open", "") === "1";
    view().innerHTML = pageShell(`
      <form class="controls" role="search" onsubmit="return false">
        <div class="lang-selector">${langSelectorHTML()}</div>
        <div class="input-text">
          <input class="input-text__input" id="f-q" type="search" autocomplete="off" spellcheck="false" autocapitalize="off"
            value="${esc(S.q)}" aria-label="${esc(t("placeholder"))}">
          <div class="input-text__prompt" aria-hidden="true"${S.q ? " hidden" : ""}><span class="input-text__prompt-icon">🔍</span><span class="input-text__prompt-text">${esc(t("placeholder"))}</span></div>
          <button type="button" class="input-text__clear-button" aria-label="${esc(t("clear"))}"${S.q ? "" : " hidden"}>&times;</button>
        </div>
        <div class="expand${expanded ? " expanded" : ""}">
          <div class="expand__container" id="search-options">
            <div class="search-options">
              ${lineSelector("m", S.m, [["start", t("modeStart")], ["exact", t("modeExact")], ["contains", t("modeContains")]], t("mode"))}
              <label class="search-options__row"><span class="search-options__label">${esc(t("category"))}</span><select class="select" id="f-pos">${posOptions(S.pos)}</select></label>
              <label class="search-options__row"><span class="search-options__label">${esc(t("theme"))}</span><select class="select" id="f-th">${themeOptions(S.th)}</select></label>
              <label class="search-options__row"><span class="search-options__label">${esc(t("subtheme"))}</span><select class="select" id="f-sub" ${S.th ? "" : "disabled"}>${subOptions(S.th, S.sub)}</select></label>
              <div class="search-options__row"><span class="search-options__label">${esc(t("level"))}</span>${lineSelector("lvl", S.lvl, [["", t("any")], ["e", t("essential")], ["b", t("basic")]], t("level"))}</div>
              <div class="search-options__foot"><button type="button" class="text-btn" id="f-reset">${esc(t("reset"))}</button></div>
            </div>
          </div>
          <button type="button" class="expand__button" aria-expanded="${expanded}" aria-controls="search-options" aria-label="${esc(t("filters"))}" title="${esc(t("filters"))}">${ICONS.chevron}${filtersActive && !expanded ? '<span class="dot"></span>' : ""}</button>
        </div>
      </form>
      <div class="results-list" id="results" aria-live="polite"></div>`);

    const $ = (id) => document.getElementById(id);
    const q = $("f-q");
    const prompt = view().querySelector(".input-text__prompt");
    const promptText = prompt.querySelector(".input-text__prompt-text");
    const clear = view().querySelector(".input-text__clear-button");
    let timer, typing;
    const syncInput = () => {
      const has = q.value.length > 0;
      clear.hidden = !has;
      prompt.hidden = has;
    };
    q.addEventListener("input", () => { syncInput(); clearTimeout(timer); timer = setTimeout(() => { S.q = q.value; runSearch(); }, 120); });
    // the hint erases itself letter by letter when the box gets the focus (as in the Interslavic dictionary)
    q.addEventListener("focus", () => {
      clearInterval(typing);
      typing = setInterval(() => {
        if (!promptText.textContent.length || q.value) { clearInterval(typing); return; }
        promptText.textContent = promptText.textContent.slice(0, -1);
      }, 18);
    });
    q.addEventListener("blur", () => { clearInterval(typing); promptText.textContent = t("placeholder"); });
    clear.addEventListener("click", () => { q.value = ""; syncInput(); S.q = ""; runSearch(); q.focus(); });
    const langBox = view().querySelector(".lang-selector");
    langBox.addEventListener("change", (ev) => {
      if (ev.target.id !== "f-l") return;
      S.l = ev.target.value;
      store.set(S.rev ? "nl-output-lang" : "nl-input-lang", S.l);
      runSearch();
      q.focus();
    });
    // ⇄ language → Neolatino / Neolatino → language (the other language changes sides)
    langBox.addEventListener("click", (ev) => {
      if (!ev.target.closest(".lang-selector__swap")) return;
      if (S.rev) S.l = S.l || "all";
      else if (S.l === "all") S.l = store.get("nl-output-lang", "eng");
      S.rev = !S.rev;
      if (S.rev && (!(S.l in LANG_INDEX) || S.l === "lat")) S.l = "eng";
      store.set("nl-dir", S.rev ? "nl" : "");
      store.set(S.rev ? "nl-output-lang" : "nl-input-lang", S.l);
      langBox.innerHTML = langSelectorHTML();
      runSearch();
      q.focus();
    });
    $("f-pos").addEventListener("change", (ev) => { S.pos = ev.target.value; runSearch(); });
    $("f-th").addEventListener("change", (ev) => {
      S.th = ev.target.value; S.sub = "";
      $("f-sub").innerHTML = subOptions(S.th, ""); $("f-sub").disabled = !S.th; runSearch();
    });
    $("f-sub").addEventListener("change", (ev) => { S.sub = ev.target.value; runSearch(); });
    view().querySelectorAll("[data-seg]").forEach((g) => g.addEventListener("click", (ev) => {
      const b = ev.target.closest("button"); if (!b) return;
      S[g.dataset.seg] = b.dataset.v;
      pickLine(g, b);
      runSearch();
    }));
    $("f-reset").addEventListener("click", () => {
      Object.assign(S, { pos: "", th: "", sub: "", lvl: "", m: "start" });
      location.hash = buildHash("", { q: S.q, d: S.rev ? "nl" : "", l: S.l });
    });
    view().querySelector(".expand__button").addEventListener("click", (ev) => {
      const box = ev.currentTarget.closest(".expand");
      const open = !box.classList.contains("expanded");
      box.classList.toggle("expanded", open);
      ev.currentTarget.setAttribute("aria-expanded", String(open));
      ev.currentTarget.querySelector(".dot")?.remove();
      store.set("nl-options-open", open ? "1" : "");
    });
    runSearch();
  }

  /** [input language ▾] ⇄ [Neolatino]  or  [Neolatino] ⇄ [translation language ▾] */
  function langSelectorHTML() {
    const others = LANGS.filter((l) => l.code !== "lat").map((l) => [l.code, l[ui]]);
    const select = S.rev
      ? `<select class="select" id="f-l" aria-label="${esc(t("outputLang"))}" title="${esc(t("outputLang"))}">${optionList(others, S.l)}</select>`
      : `<select class="select" id="f-l" aria-label="${esc(t("inputLang"))}" title="${esc(t("inputLang"))}">${optionList([["all", t("allLangs")], ...others], S.l)}</select>`;
    const neo = `<div class="lang-selector__neo">${esc(t("toNeo"))}</div>`;
    const swap = `<button type="button" class="lang-selector__swap${S.rev ? " rotate" : ""}" aria-label="${esc(t("swapDir"))}" title="${esc(t("swapDir"))}">${ICONS.swap}</button>`;
    return S.rev ? neo + swap + select : select + swap + neo;
  }

  function runSearch() {
    if (!S) return;
    const hash = buildHash("", { q: S.q, d: S.rev ? "nl" : "", l: S.l, pos: S.pos, th: S.th, sub: S.sub, lvl: S.lvl, m: S.m === "start" ? "" : S.m });
    if (location.hash !== hash && (location.hash || hash !== "#/")) history.replaceState(null, "", hash);
    lastSearchHash = hash;
    const back = document.getElementById("back-button");
    if (back) back.href = hash;
    const box = document.getElementById("results");
    if (!box) return;
    liById.clear();
    if (!S.q.trim() && !(S.pos || S.th || S.sub || S.lvl)) {
      box.innerHTML = "";
      select(null, "tr", false);
      return;
    }
    lastResults = search(S);
    shown = 0;
    // narrow screens: the cards are drawn again, closed; wide: the pane keeps its word and comparison
    for (const id of [...compares.keys()]) if (!isWide() || id !== sel.id) compares.delete(id);
    if (!lastResults.length) {
      box.innerHTML = `<div class="results-empty"><h2>${esc(t("noResults"))}</h2><p>${esc(t("noResultsHint"))}</p></div>`;
      select(null, "tr", false);
      return;
    }
    box.innerHTML = `<p class="status-line">${esc(t("results")(lastResults.length))}</p><div id="entries"></div><div class="results-more" id="more"></div>`;
    showMore();
    // wide screens: keep the open word if it is still among the results, else preview the first one
    if (isWide()) {
      if (sel.id && lastResults.some((r) => r.e.id === sel.id)) select(sel.id, sel.tab, sel.explicit);
      else select(lastResults[0].e.id, "tr", false);
    }
  }

  function showMore() {
    const list = document.getElementById("entries");
    let q = norm(S.q);
    if (!S.rev && (S.l === "eng" || S.l === "all") && /^to\s+\S/.test(q)) q = q.replace(/^to\s+/, "");
    const next = lastResults.slice(shown, shown + CONFIG.resultStep);
    const target = S.rev ? LANG_INDEX[S.l] : null;
    next.forEach((r) => liById.set(r.e.id, S.rev ? target : r.li));
    list.insertAdjacentHTML("beforeend", next.map((r) => cardHTML(r.e, S.rev ? { q, li: r.li, show: target, target: true } : { q, li: r.li })).join(""));
    shown += next.length;
    hooks.afterResults.forEach((fn) => fn(list, next.map((r) => r.e)));
    if (isWide()) syncCards();
    const more = document.getElementById("more");
    more.innerHTML = shown < lastResults.length ? `<button type="button" class="pill-btn">${esc(t("showMore"))} (${fmt(lastResults.length - shown)})</button>` : "";
    const b = more.querySelector("button");
    if (b) b.addEventListener("click", showMore);
  }

  // ------------------------------------------------------------------ word page
  function renderWord(id, params = {}) {
    const e = D.byId.get(id);
    if (!e) { view().innerHTML = `<div class="results-empty"><h2>${esc(t("noResults"))}</h2></div>`; return; }
    compares.clear(); // a word page starts without comparisons
    const syn = (D.bySem.get(e.sem) || []).filter((x) => x !== e);
    const hom = (D.byLemma.get(norm(e.key)) || []).filter((x) => x !== e && !syn.includes(x));
    const li = S && S.l && S.l !== "all" && S.l !== "lat" ? LANG_INDEX[S.l] : null;
    liById.clear();
    liById.set(e.id, li);
    const item = (x) => `<li><a class="word-list__item" href="#/word/${encodeURIComponent(x.id)}"><span class="word-list__word">${esc(x.v[0])}</span>
      <span class="word-list__meta">${esc([x.cat, themeText(x)].filter(Boolean).join(" · "))}</span></a></li>`;
    view().innerHTML = pageShell(`
      <div class="page-back"><a class="pill-btn" href="${esc(lastSearchHash)}">← ${esc(t("backToResults"))}</a></div>
      <div class="results-list word-page-list">${cardHTML(e, { li: null, show: li, page: true, target: !!(S && S.rev) })}</div>
      ${syn.length ? `<section class="siblings"><h2>${esc(t("synonyms"))}</h2><ul class="word-list">${syn.map(item).join("")}</ul></section>` : ""}
      ${hom.length ? `<section class="siblings"><h2>${esc(t("homonyms"))}</h2><ul class="word-list">${hom.map(item).join("")}</ul></section>` : ""}`);
    document.title = `${e.v[0]} — Dictionario Neolatino`;
    NL.pageParams = params;
    const tab = params.c ? "cm" : (params.t && availablePanels(e).some((p) => p.key === params.t) ? params.t : "tr");
    const card = view().querySelector(".results-card");
    hooks.afterResults.forEach((fn) => fn(card.parentElement, [e]));
    hooks.onOpen.forEach((fn) => fn(e, "word"));
    if (isWide()) select(e.id, tab, true);
    else toggleCardTab(card, tab, true);
    if (!params.c) window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------------ browse page
  function renderBrowse(letter, params) {
    letter = norm(letter)[0] || "a";
    const code = params.l && params.l in LANG_INDEX ? params.l : "lat";
    const f = { pos: params.pos || "", lvl: params.lvl || "" };
    const all = sortedFor(code).filter((x) => passesFilters(x.e, f));
    const counts = {};
    for (const x of all) counts[x.letter] = (counts[x.letter] || 0) + 1;
    const list = all.filter((x) => x.letter === letter);
    const size = CONFIG.browsePageSize;
    const pages = Math.max(1, Math.ceil(list.length / size));
    let page = Math.min(pages, Math.max(1, parseInt(params.p, 10) || 1));

    // two-letter sub-index → page + anchor
    const sub = [];
    const seen = new Set();
    list.forEach((x, i) => {
      const two = norm(x.k).replace(/[^a-z]/g, "").slice(0, 2) || letter;
      if (!seen.has(two)) { seen.add(two); sub.push({ two, i, page: Math.floor(i / size) + 1 }); }
    });
    if (params.at) { const s = sub.find((s) => s.two === params.at); if (s) page = s.page; }

    const keep = { l: code === "lat" ? "" : code, pos: f.pos, lvl: f.lvl };
    const letters = "abcdefghijklmnopqrstuvwxyz".split("");
    const slice = list.slice((page - 1) * size, page * size);
    const firstIdx = new Map(sub.map((s) => [s.i, s.two]));
    const langLabel = LANGS[LANG_INDEX[code]][ui];

    view().innerHTML = `<div class="page page--wide browse-page">
      <ul class="letter-strip" aria-label="${esc(t("navBrowse"))}">${letters.map((c) => counts[c]
        ? `<li><a href="${buildHash("browse/" + c, keep)}" ${c === letter ? 'aria-current="page"' : ""} title="${esc(t("browseWords")(counts[c]))}">${c.toUpperCase()}</a></li>`
        : `<li><span aria-hidden="true">${c.toUpperCase()}</span></li>`).join("")}</ul>
      <div class="card browse-head">
        <div class="browse-head__letter" aria-hidden="true">${letter.toUpperCase()}</div>
        <div class="browse-head__meta">
          <h1 class="page-title">${esc(langLabel)}: ${letter.toUpperCase()}</h1>
          <p class="browse-head__count">${esc(t("browseWords")(list.length))}${pages > 1 ? ` · ${esc(t("page"))} ${page} / ${pages}` : ""}</p>
          <div class="browse-opts">
            <select class="select select--small" id="b-l" aria-label="${esc(t("browseIn"))}" title="${esc(t("browseIn"))}">${langOptions(code, false)}</select>
            <select class="select select--small" id="b-pos" aria-label="${esc(t("category"))}" title="${esc(t("category"))}">${posOptions(f.pos)}</select>
            ${lineSelector("lvl", f.lvl, [["", t("any")], ["e", t("essential")], ["b", t("basic")]], t("level"))}
          </div>
        </div>
      </div>
      ${sub.length > 1 ? `<ul class="subindex">${sub.map((s) =>
        `<li><a class="chip${pages > 1 && s.page === page ? " here" : ""}" href="${buildHash("browse/" + letter, { ...keep, at: s.two })}">${esc(s.two)}</a></li>`).join("")}</ul>` : ""}
      <div class="card"><ul class="wordcols">${slice.map((x, j) => {
        const idx = (page - 1) * size + j;
        const anchor = firstIdx.has(idx) ? ` id="g-${esc(firstIdx.get(idx))}" class="group-start"` : "";
        const href = `#/word/${encodeURIComponent(x.e.id)}`;
        // Same headword next to itself: show the topic so the senses can be told apart
        const twin = (slice[j - 1] && slice[j - 1].k === x.k) || (slice[j + 1] && slice[j + 1].k === x.k);
        const hint = twin && x.e.t1 ? `<span class="th">${esc(x.e.t2 || x.e.t1)}</span>` : "";
        if (code === "lat") return `<li${anchor}><a href="${href}">${esc(x.e.v[0])}</a><span class="c">${esc(x.e.cat)}</span>${hint}</li>`;
        return `<li${anchor}><a href="${href}">${esc(x.e.v[LANG_INDEX[code]])}</a> <span class="t">→ <b>${esc(x.e.v[0])}</b></span></li>`;
      }).join("")}</ul></div>
      ${pagerHTML(letter, page, pages, list, size, keep)}
    </div>`;

    document.getElementById("b-l").addEventListener("change", (ev) => {
      location.hash = buildHash("browse/" + letter, { ...keep, l: ev.target.value === "lat" ? "" : ev.target.value });
    });
    document.getElementById("b-pos").addEventListener("change", (ev) => {
      location.hash = buildHash("browse/" + letter, { ...keep, pos: ev.target.value });
    });
    view().querySelector("[data-seg]").addEventListener("click", (ev) => {
      const b = ev.target.closest("button"); if (!b) return;
      location.hash = buildHash("browse/" + letter, { ...keep, lvl: b.dataset.v });
    });
    if (params.at) {
      const el = document.getElementById("g-" + params.at);
      if (el) requestAnimationFrame(() => el.scrollIntoView({ block: "start" }));
    } else window.scrollTo(0, 0);
  }

  function pagerHTML(letter, page, pages, list, size, keep) {
    if (pages <= 1) return "";
    const short = (s) => norm(s).replace(/[^a-z]/g, "").slice(0, 4);
    let html = `<nav class="pager" aria-label="${esc(t("page"))}">`;
    for (let p = 1; p <= pages; p++) {
      const a = list[(p - 1) * size], b = list[Math.min(list.length, p * size) - 1];
      const label = `${short(a.k)}–${short(b.k)}`;
      html += p === page
        ? `<span class="pill-btn" aria-current="page" title="${esc(a.k)} – ${esc(b.k)}">${esc(label)}</span>`
        : `<a class="pill-btn" href="${buildHash("browse/" + letter, { ...keep, p })}" title="${esc(a.k)} – ${esc(b.k)}">${esc(label)}</a>`;
    }
    return html + `</nav>`;
  }

  // ------------------------------------------------------------------ verb page
  function renderVerbPage(verb) {
    view().innerHTML = `<div class="page verb-page">
      <form class="controls verb-form" id="vf">
        <div class="input-text">
          <input class="input-text__input" id="v-q" type="search" autocomplete="off" spellcheck="false" autocapitalize="off" list="verb-list"
            placeholder="${esc(t("verbPlaceholder"))}" aria-label="${esc(t("verbPlaceholder"))}" value="${esc(verb)}">
        </div>
        <button class="pill-btn pill-btn--primary" type="submit">${esc(t("conjugate"))}</button>
        <datalist id="verb-list">${[...NLConj.VERBS.keys()].map((v) => `<option value="${esc(v)}">`).join("")}</datalist>
      </form>
      <p class="verb-suggest">${esc(t("tryThese"))} ${["èssere", "havere", "fàcere", "vàdere", "potere", "volere", "dícere", "venire", "amare", "finire"]
        .map((v) => `<a class="chip" href="#/verb/${encodeURIComponent(v)}">${esc(v)}</a>`).join("")}</p>
      <div id="v-out"></div>
    </div>`;
    const out = document.getElementById("v-out");
    if (verb) {
      const c = NLConj.conjugate(verb);
      out.innerHTML = c
        ? `<div class="results-card verb-card"><h1 class="verb-card__title">${esc(c.infinitive.split(" / ")[0])}</h1><div class="results-card__details">${conjHTML(c)}</div></div>`
        : `<div class="results-empty"><h2>${esc(t("verbNotFound"))}</h2></div>`;
    }
    document.getElementById("vf").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const v = document.getElementById("v-q").value.trim();
      location.hash = "#/verb/" + encodeURIComponent(v);
    });
  }

  // ------------------------------------------------------------------ about
  const INTERSLAVIC_REPO = "https://github.com/l3monardo/interslavic-hub";
  const SOURCE_REPO = "https://github.com/l3monardo/neolatino-dictionary";
  const ext = (href, text) => `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(text)}<span class="ext" aria-hidden="true">&nbsp;↗</span></a>`;

  hooks.routes.about = () => {
    view().innerHTML = `<div class="page about-page">
      <h1 class="page-title">❓ ${esc(t("aboutTitle"))}</h1>
      <div class="card about-card">
        <div class="about-card__head">
          <img src="favicon.svg" width="56" height="56" alt="">
          <div><h2 class="about-card__name">Dictionario Neolatino</h2><p class="about-card__lead">${esc(t("aboutLead"))}</p></div>
        </div>
        <dl class="about-list">
          <div><dt>${esc(t("aboutDeveloper"))}</dt><dd><strong>Glěb Dyndar</strong> · ${ext("https://gleb.onl/", "gleb.onl")}</dd></div>
          <div><dt>${esc(t("aboutBasedOn"))}</dt><dd>${esc(t("aboutFork"))} · ${ext(INTERSLAVIC_REPO, "GitHub")} · ${ext("https://interslavic.forum/slovnik/", "interslavic.forum/slovnik")}</dd></div>
          <div><dt>${esc(t("aboutSource"))}</dt><dd>${ext(SOURCE_REPO, "github.com/l3monardo/neolatino-dictionary")}</dd></div>
          <div><dt>${esc(t("aboutData"))}</dt><dd>${ext("https://neolatino.eu/", "Vía Neolatina — neolatino.eu")} · ${ext("https://neolatino.github.io/dictionario/", t("aboutOriginal"))}</dd></div>
        </dl>
        <div class="about-card__foot">
          ${isStandalone() ? "" : `<button type="button" class="pill-btn pill-btn--primary" data-install>📲 ${esc(t("installApp"))}</button>`}
          ${APP_VERSION ? `<span class="muted">${esc(t("aboutVersion"))} ${esc(APP_VERSION)}</span>` : ""}
        </div>
      </div>
    </div>`;
    window.scrollTo(0, 0);
  };

  // ------------------------------------------------------------------ install (web app)
  // Chrome, Edge and Samsung Internet fire beforeinstallprompt once the page qualifies (manifest +
  // service worker): it is kept and replayed from the menu. Safari and Firefox have no install API:
  // there the button shows short instructions instead.
  let installPrompt = null;
  function isStandalone() {
    try {
      return matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: window-controls-overlay)").matches || navigator.standalone === true;
    } catch { return false; }
  }
  addEventListener("beforeinstallprompt", (ev) => { ev.preventDefault(); installPrompt = ev; });
  addEventListener("appinstalled", () => { installPrompt = null; renderMenu(); });

  function installPlatform() {
    const ua = navigator.userAgent || "";
    // iPadOS says it is a Mac: tell them apart by the touch screen
    if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1)) return "ios";
    return /Android/i.test(ua) ? "android" : "desktop";
  }

  async function install() {
    if (installPrompt) {
      const prompt = installPrompt;
      installPrompt = null; // a prompt can be shown only once
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice && choice.outcome === "accepted") renderMenu();
        return;
      } catch { /* fall back to the instructions */ }
    }
    let platform = installPlatform();
    const tabs = [["ios", "installTabIos"], ["android", "installTabAndroid"], ["desktop", "installTabDesktop"]];
    const steps = () => {
      const list = t("installSteps")[platform];
      const tag = platform === "desktop" ? "ul" : "ol";
      return `<${tag} class="install-dialog__steps">${list.map((s) => `<li>${esc(s)}</li>`).join("")}</${tag}>`;
    };
    const { el } = openModal(`${dialogHeader(`<img src="favicon.svg" alt=""><span>${esc(t("installApp"))}</span>`)}
      <div class="install-dialog__body">
        <p class="install-dialog__intro">${esc(t("installIntro"))}</p>
        <div class="tabs-row install-dialog__tabs" role="tablist">${tabs.map(([v, k]) =>
          `<button type="button" role="tab" data-platform="${v}" aria-selected="${v === platform}">${esc(t(k))}</button>`).join("")}</div>
        <div class="install-dialog__steps-box">${steps()}</div>
      </div>`, { className: "install-dialog", label: t("installApp") });
    el.querySelectorAll("[data-platform]").forEach((b) => b.addEventListener("click", () => {
      platform = b.dataset.platform;
      el.querySelectorAll("[data-platform]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      el.querySelector(".install-dialog__steps-box").innerHTML = steps();
    }));
  }

  // the service worker makes the site installable and keeps a copy for when there is no connection
  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || !window.isSecureContext || CONFIG.serviceWorker === false) return;
    const go = () => navigator.serviceWorker.register("sw.js").catch((err) => console.warn("Service worker:", err));
    if (document.readyState === "complete") go(); else addEventListener("load", go);
  }

  // ------------------------------------------------------------------ UI language
  function applyUI() {
    document.documentElement.lang = ui === "en" ? "en" : "art-x-neolatino";
    document.querySelectorAll("[data-i18n]").forEach((el) => { const v = t(el.dataset.i18n); if (typeof v === "string") el.textContent = v; });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const v = t(el.dataset.i18nTitle);
      if (typeof v === "string") { el.title = v; el.setAttribute("aria-label", v); }
    });
    renderThemeToggle();
    renderMenu();
    renderStatus();
  }

  window.addEventListener("hashchange", () => {
    document.title = "Dictionario Neolatino";
    setMenuOpen(false);
    route();
    const name = parseHash().parts[0] || "search";
    if (name !== "search" && name !== "verb") document.getElementById("main").focus({ preventScroll: true });
  });

  /** Strings from add-ons: NL.addStrings({ nl: {...}, en: {...} }) */
  function addStrings(more) {
    Object.assign(STR.nl, more.nl || {});
    Object.assign(STR.en, more.en || {});
  }

  Object.assign(NL, {
    CONFIG, LANGS, LANG_INDEX, POS, D, ICONS,
    t, ui: () => ui, esc, norm, fmt, highlight, store, collator,
    addStrings, buildHash, parseHash, route, view, setNav, renderMenu,
    cardHTML, conjHTML, translationsHTML, themeText, levelBadges, panelFooter, renderDetails,
    posGroups, sortedFor, search, setCount, isWide, select, wikiUrl, splitCell, isStandalone, APP_VERSION,
    toast, openModal, dialogHeader, lineSelector, pickLine,
    lastSearchHash: () => lastSearchHash,
  });

  // community.js / share.js register their hooks before the first render
  function start() {
    registerServiceWorker();
    initHeader();
    applyUI();
    route();
    load();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else setTimeout(start, 0);

  // exposed for debugging / tests
  window.NLDict = { D, search, posGroups, sortedFor };
})();
