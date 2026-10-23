/*
 * Paste this into the browser console on https://neolatino.eu/ferramentos.html
 * when the official conjugator gets new verbs or classes. It runs the site's own
 * generar_XX() functions with placeholder roots and prints two blocks:
 *   1. tpl.json   (one template per verb class)
 *   2. verbs.txt  (the official verb list)
 * Save them into tools/ and run: node tools/build-conjugator.js
 */
(() => {
  const S = ["⓵", "⓶", "⓷", "⓸", "Ⓟ"], R = ["1", "2", "3", "4", "P"];
  const persons = ["P1s", "P2s", "P3s", "P1p", "P2p", "P3p"];
  const tenses = ["p_i", "pi_i", "pr_i", "f_i", "p_s", "pi_s", "p1_c", "p2_c"];
  let captured = null;
  const orig = window.construir_taula;
  window.construir_taula = function () {
    const o = ["comentari", "infinitivo", "gerundio", "partpres", "partpas"].map((k) => eval(k));
    for (const t of tenses) for (const p of persons) o.push(eval(p + "_" + t));
    for (const v of ["P2s_i", "P3s_i", "P1p_i", "P2p_i", "P3p_i"]) o.push(eval(v));
    captured = o;
  };
  const fnFor = (c) => window["generar_" + c] || window["generar_" + c.normalize("NFD").replace(/[̀-ͯ]/g, "")];
  const tpl = {}, problems = [];
  for (const c of [...new Set(verbosConst.map((v) => v.codi))]) {
    const fn = fnFor(c);
    if (!fn) { problems.push("no function for " + c); continue; }
    [window.arrel1, window.arrel2, window.arrel3, window.arrel4, window.participi] = S;
    captured = null; fn();
    tpl[c] = captured.map((x) => { let y = x; S.forEach((s, i) => (y = y.replaceAll(s, R[i]))); return y; }).join("|");
  }
  window.construir_taula = orig;
  const verbs = verbosConst.map((v) => [v.verbo, v.arrel1, v.arrel2, v.arrel3, v.arrel4, v.participi, v.codi].join(",")).join(";");
  console.log("---- tpl.json ----\n" + JSON.stringify(tpl));
  console.log("---- verbs.txt ----\n" + verbs);
  if (problems.length) console.warn(problems);
})();
