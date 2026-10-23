/*
 * Neolatino verb conjugator.
 *
 * TEMPLATES and VERBS are exported verbatim from the official conjugator
 * at https://neolatino.eu/ferramentos.html (scripts/verbos.js + scripts/nt.js).
 * Each template is the output of one generar_XX() function with the roots
 * replaced by placeholders:  1-4 = arrel1..arrel4,  P = participi.
 * Every one of the 441 official verbs regenerates exactly from these.
 *
 * Verbs that are not in the official list are handled in two extra ways:
 *   1. "derived": a prefixed compound of an official verb
 *      (e.g. ab+bàttere, com+portare, abs+tràgere) reuses that verb's class.
 *   2. "regular": the default class for the infinitive ending.
 * Both are marked in the UI so readers know they are not from the official tool.
 */
(function (root) {
  "use strict";

  const TEMPLATES = /*@@TEMPLATES@@*/ {};
  const VERBS_RAW = /*@@VERBS@@*/ "";

  // Order of the 58 slots in every template
  const SLOTS = {
    comment: 0, infinitive: 1, gerund: 2, presentParticiple: 3, pastParticiple: 4,
  };
  const TENSES = [
    // [key, mood, tense label (Neolatino, as in the official conjugator)]
    ["p_i", "indicativo", "presènte"],
    ["pi_i", "indicativo", "passato imperfècto"],
    ["pr_i", "indicativo", "passato remoto"],
    ["f_i", "indicativo", "futuro"],
    ["p_s", "subjunctivo", "presènte"],
    ["pi_s", "subjunctivo", "passato imperfècto"],
    ["p1_c", "conditionale", "presènte I"],
    ["p2_c", "conditionale", "presènte II"],
  ];

  const VERBS = new Map();
  for (const row of VERBS_RAW.split(";")) {
    const f = row.split(",");
    VERBS.set(f[0], { roots: [f[1], f[2], f[3], f[4], f[5]], code: f[6] });
  }

  // Bases usable for compounds: longest first so "tràgere" wins over "ràgere"-like accidents.
  // Short bases (dare, ire…) are excluded: "accordare" and "bendare" are not compounds of "dare".
  const BASES = [...VERBS.keys()]
    .filter((v) => v.length >= 5 && /[1-4]/.test(TEMPLATES[VERBS.get(v).code] || ""))
    .sort((a, b) => b.length - a.length);

  // Latin / Romance verbal prefixes (single or chained, e.g. re+com).
  const PREFIXES = [
    "ab", "abs", "ac", "ad", "af", "ag", "al", "ap", "ar", "as", "at", "a",
    "ante", "circum", "co", "com", "con", "col", "cor", "contra", "de", "des", "dis", "di",
    "e", "em", "en", "entre", "ex", "es", "extra", "in", "im", "il", "ir", "inter", "intro",
    "ob", "oc", "op", "per", "post", "pre", "pro", "re", "retro", "se", "sub", "suc", "suf",
    "sup", "sus", "super", "sopra", "sor", "sur", "sotto", "trans", "tra", "tras", "ultra",
    "mal", "ben", "bene", "male",
  ];
  const PREFIX_SET = new Set(PREFIXES);
  // A single prefix, or a chain of two prefixes of 2+ letters each (re+com+ponere, ap+per+tenere).
  function isPrefix(p) {
    if (PREFIX_SET.has(p)) return true;
    for (let i = 2; i < p.length - 1; i++) {
      if (PREFIX_SET.has(p.slice(0, i)) && PREFIX_SET.has(p.slice(i))) return true;
    }
    return false;
  }

  function render(code, roots) {
    const tpl = TEMPLATES[code];
    if (!tpl) return null;
    return tpl.split("|").map((t) =>
      t.replace(/[1-4P]/g, (m) => (m === "P" ? roots[4] : roots[+m - 1]) || "").trim()
    );
  }

  const STRESS = { "à": "a", "è": "e", "é": "e", "ì": "i", "í": "i", "ò": "o", "ó": "o", "ù": "u", "ú": "u" };
  const unstress = (s) => s.replace(/[àèéìíòóùú]/g, (c) => STRESS[c]);

  function regular(verb) {
    let m;
    if ((m = verb.match(/^(.+[cg])îare$/))) return { code: "F1", roots: [m[1] + "î", m[1], "", "", ""] };
    if ((m = verb.match(/^(.+[cg])are$/))) return { code: "D1", roots: [m[1], "", "", "", ""] };
    if ((m = verb.match(/^(.+)are$/))) return { code: "A1", roots: [m[1], "", "", "", ""] };
    if ((m = verb.match(/^(.+)ire$/))) return { code: "T4", roots: [m[1], "", "", "", ""] };
    if ((m = verb.match(/^(.+)ere$/))) {
      const stem = m[1];
      const palatal = /[cg]$/.test(stem); // -cere / -gere take î-forms
      if (/[àèéìíòóùú]/.test(stem)) {
        const u = unstress(stem);
        const open = /[èò]/.test(stem); // open stressed vowel: stem stress also in present sing.
        if (palatal) return open
          ? { code: "B3E3", roots: [u, stem, u + "î", stem + "î", ""] }
          : { code: "E3", roots: [u, stem, u + "î", "", ""] };
        return open ? { code: "B3", roots: [u, stem, "", "", ""] } : { code: "A3", roots: [u, stem, "", "", ""] };
      }
      if (/c$/.test(stem)) return { code: "V2", roots: [stem, "", "", "", ""] };
      if (/g$/.test(stem)) return { code: "R2", roots: [stem, "", "", "", ""] };
      return { code: "A2", roots: [stem, "", "", "", ""] };
    }
    return null;
  }

  function prefixParticiple(part, prefix) {
    if (!part) return part;
    if (part.includes("/")) return part.replace(/(\/\s*)(\S)/, "$1" + prefix + "$2");
    return prefix + part.trim();
  }

  function derive(verb, exclude) {
    for (const base of BASES) {
      if (base === exclude || base.length >= verb.length || !verb.endsWith(base)) continue;
      const prefix = verb.slice(0, verb.length - base.length);
      if (!isPrefix(prefix)) continue;
      const b = VERBS.get(base);
      const roots = b.roots.map((r, i) =>
        i === 4 ? prefixParticiple(r, prefix) : r ? prefix + r : ""
      );
      return { code: b.code, roots, base };
    }
    return null;
  }

  /**
   * Conjugate a Neolatino verb (as written in the dictionary).
   * @param {string} input e.g. "amare", "absentare-se", "abbàttere"
   * @param {object} [opts] { exclude: verb to ignore in lookups (testing) }
   * @returns {null | {verb, infinitive, source:"official"|"derived"|"regular", base?, code, reflexive, forms}}
   */
  function conjugate(input, opts = {}) {
    if (!input) return null;
    let w = input.toLowerCase().replace(/\u00ad/g, "").trim();
    w = w.split(/[,;(]/)[0].trim();
    const words = w.split(/\s+/);
    let head = words[0];
    const tail = words.slice(1).join(" ");
    let reflexive = false;
    if (/-se$/.test(head)) { reflexive = true; head = head.slice(0, -3); }

    let found = null, source = null, base;
    if (VERBS.has(head) && head !== opts.exclude) {
      found = VERBS.get(head); source = "official";
    } else if ((found = derive(head, opts.exclude))) {
      source = "derived"; base = found.base;
    } else if ((found = regular(head))) {
      source = "regular";
    } else return null;

    const forms = render(found.code, found.roots);
    if (!forms) return null;
    return {
      verb: input,
      head,
      tail,
      infinitive: forms[1],
      source,
      base,
      code: found.code,
      reflexive,
      forms,
    };
  }

  /** Group a forms array into labelled sections for display. */
  function table(forms) {
    const sections = [];
    TENSES.forEach(([key, mood, tense], i) => {
      sections.push({ key, mood, tense, forms: forms.slice(5 + i * 6, 11 + i * 6) });
    });
    sections.push({ key: "imp", mood: "imperativo", tense: "", forms: forms.slice(53, 58) });
    return {
      comment: forms[0],
      infinitive: forms[1],
      gerund: forms[2],
      presentParticiple: forms[3],
      pastParticiple: forms[4],
      sections,
    };
  }

  /** Is a grammatical category string a verb? ("v.tr.", "v.intr. et tr.", "v.r." …) */
  function isVerbCategory(cat) {
    return /(^|[\s,])v\s?\.\s?(tr|intr|r|n|a|pronom)?/i.test(cat || "") && !/^p\.p/.test(cat || "");
  }

  const api = { conjugate, table, isVerbCategory, VERBS, TEMPLATES, PERSONS: ["èo", "tu", "ello / ella", "nós", "vós", "ellos / ellas"], IMP_PERSONS: ["tu", "ello / ella", "nós", "vós", "ellos / ellas"] };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NLConj = api;
})(typeof window !== "undefined" ? window : globalThis);
