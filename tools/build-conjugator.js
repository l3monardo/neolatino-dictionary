// Rebuilds ../conjugator.js from conjugator.src.js + tpl.json + verbs.txt
// Usage: node tools/build-conjugator.js
const fs = require("fs"), path = require("path");
const here = __dirname;
const tpl = JSON.stringify(JSON.parse(fs.readFileSync(path.join(here, "tpl.json"), "utf8")));
const verbs = fs.readFileSync(path.join(here, "verbs.txt"), "utf8").trim();
let src = fs.readFileSync(path.join(here, "conjugator.src.js"), "utf8");
src = src.replace("/*@@TEMPLATES@@*/ {}", tpl).replace('/*@@VERBS@@*/ ""', JSON.stringify(verbs));
fs.writeFileSync(path.join(here, "..", "conjugator.js"), src);
console.log("conjugator.js written:", src.length, "bytes,", verbs.split(";").length, "official verbs");
