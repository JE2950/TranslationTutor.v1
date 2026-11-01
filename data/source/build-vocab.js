/* Regenerates data/vocab.js from data/source/ce-vocab.json.
   The JSON is extracted from the CE Word List reference, which is itself
   rebuilt from the ISEB Common Entrance & CASE Classics specification.
   Run:  node data/source/build-vocab.js                                   */
var fs = require('fs'), path = require('path');
var root = path.join(__dirname, '..', '..');
var raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'ce-vocab.json'), 'utf8'));
var rows = raw.map(function (e) {
  return '{l:' + JSON.stringify(e.lat || e.latin) +
    ',i:' + JSON.stringify(e.info) +
    ',e:' + JSON.stringify(e.eng || e.english) +
    ',t:' + JSON.stringify(e.type) +
    ',v:' + JSON.stringify(e.level) + '}';
});
var js = '/* data/vocab.js — CE Latin vocabulary, extracted from the CE Word List\n' +
  '   reference (rebuilt from the ISEB CE & CASE Classics specification).\n' +
  '   l=latin, i=info/principal parts, e=english, t=type, v=CE level.\n' +
  '   Do not hand-edit: regenerate with node data/source/build-vocab.js */\n' +
  '(function (root) {\n  var RAW = [\n' + rows.join(',\n') + '\n  ];\n' +
  '  var VOCAB = RAW.map(function (r) {\n' +
  '    return { lat: r.l, info: r.i, eng: r.e, type: r.t, level: r.v };\n  });\n' +
  '  if (typeof module !== \'undefined\' && module.exports) module.exports = VOCAB;\n' +
  '  else root.CE_VOCAB = VOCAB;\n})(typeof window !== \'undefined\' ? window : this);\n';
fs.writeFileSync(path.join(root, 'data', 'vocab.js'), js);
console.log('wrote data/vocab.js — ' + rows.length + ' entries');
