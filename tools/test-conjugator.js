// Leave-one-out check: conjugate each official verb as if it were missing from the list
// and compare with the official forms. Usage: node tools/test-conjugator.js
const C = require("../conjugator.js");
const r = {};
for (const [v] of C.VERBS) {
  const real = C.conjugate(v), guess = C.conjugate(v, { exclude: v });
  if (!guess) continue;
  const diff = real.forms.filter((f, i) => f !== guess.forms[i]).length;
  const k = `${guess.source} ${diff === 0 ? "exact" : diff === 1 && real.forms[4] !== guess.forms[4] ? "participle only" : "differs"}`;
  r[k] = (r[k] || 0) + 1;
}
console.table(r);
