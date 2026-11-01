/* Morphology checks against forms a CE teacher would expect. */
var VOCAB = require('../data/vocab.js');
var M = require('../js/morph.js');

var L = M.buildLexicon(VOCAB, ['L1'], {});
var pass = 0, fail = 0, fails = [];

function has(word, lemma, want) {
  var a = M.analyse(L, word);
  var ok = a.readings.some(function (r) {
    if (r.lemma !== lemma) return false;
    return Object.keys(want).every(function (k) { return String(r.tags[k]) === String(want[k]); });
  });
  if (ok) pass++; else { fail++; fails.push(word + ' → ' + lemma + ' ' + JSON.stringify(want) + '  got: ' + JSON.stringify(a.readings.map(function (r) { return r.lemma + ':' + JSON.stringify(r.tags); }))); }
}
function unknown(word) {
  var a = M.analyse(L, word);
  if (a.unknown) pass++; else { fail++; fails.push(word + ' should be unknown at L1, got ' + a.readings.map(function (r) { return r.lemma; }).join(',')); }
}
function countReadings(word, n) {
  var a = M.analyse(L, word);
  var uniq = {};
  a.readings.forEach(function (r) { uniq[r.lemma + '|' + r.tags['case'] + r.tags.num + (r.tags.gender || '')] = 1; });
  var c = Object.keys(uniq).length;
  if (c === n) pass++; else { fail++; fails.push(word + ' expected ' + n + ' distinct readings, got ' + c + ' (' + Object.keys(uniq).join(' / ') + ')'); }
}

/* ---- 1st declension nouns ---- */
has('puella', 'puella', { 'case': 'nom', num: 's' });
has('puellam', 'puella', { 'case': 'acc', num: 's' });
has('puellae', 'puella', { 'case': 'nom', num: 'p' });
has('puellae', 'puella', { 'case': 'gen', num: 's' });
has('puellae', 'puella', { 'case': 'dat', num: 's' });
has('puellas', 'puella', { 'case': 'acc', num: 'p' });
has('puellarum', 'puella', { 'case': 'gen', num: 'p' });
has('puellis', 'puella', { 'case': 'abl', num: 'p' });
has('nauta', 'nauta', { 'case': 'nom', num: 's', gender: 'm' });
has('nautas', 'nauta', { 'case': 'acc', num: 'p', gender: 'm' });

/* ---- 2nd declension ---- */
has('dominus', 'dominus', { 'case': 'nom', num: 's' });
has('domine', 'dominus', { 'case': 'voc', num: 's' });
has('dominum', 'dominus', { 'case': 'acc', num: 's' });
has('domini', 'dominus', { 'case': 'nom', num: 'p' });
has('domini', 'dominus', { 'case': 'gen', num: 's' });
has('dominos', 'dominus', { 'case': 'acc', num: 'p' });
has('dominis', 'dominus', { 'case': 'dat', num: 'p' });
// -er nouns: ager drops the e, puer keeps it
has('ager', 'ager', { 'case': 'nom', num: 's' });
has('agrum', 'ager', { 'case': 'acc', num: 's' });
has('agri', 'ager', { 'case': 'nom', num: 'p' });
has('puer', 'puer', { 'case': 'nom', num: 's' });
has('puerum', 'puer', { 'case': 'acc', num: 's' });
has('pueri', 'puer', { 'case': 'nom', num: 'p' });
has('pueros', 'puer', { 'case': 'acc', num: 'p' });
has('magister', 'magister', { 'case': 'nom', num: 's' });
has('magistrum', 'magister', { 'case': 'acc', num: 's' });
has('liber', 'liber', { 'case': 'nom', num: 's' });
has('libros', 'liber', { 'case': 'acc', num: 'p' });
has('vir', 'vir', { 'case': 'nom', num: 's' });
has('viri', 'vir', { 'case': 'nom', num: 'p' });
// -ius / -ium
has('filius', 'filius', { 'case': 'nom', num: 's' });
has('filii', 'filius', { 'case': 'gen', num: 's' });
has('gladios', 'gladius', { 'case': 'acc', num: 'p' });
has('consilium', 'consilium', { 'case': 'nom', num: 's', gender: 'n' });
has('consilia', 'consilium', { 'case': 'acc', num: 'p', gender: 'n' });
// neuter
has('templum', 'templum', { 'case': 'nom', num: 's', gender: 'n' });
has('templum', 'templum', { 'case': 'acc', num: 's', gender: 'n' });
has('templa', 'templum', { 'case': 'nom', num: 'p', gender: 'n' });
has('templa', 'templum', { 'case': 'acc', num: 'p', gender: 'n' });
has('templi', 'templum', { 'case': 'gen', num: 's', gender: 'n' });
has('bella', 'bellum', { 'case': 'acc', num: 'p', gender: 'n' });

/* ---- adjectives ---- */
has('bonus', 'bonus', { 'case': 'nom', num: 's', gender: 'm' });
has('bona', 'bonus', { 'case': 'nom', num: 's', gender: 'f' });
has('bona', 'bonus', { 'case': 'nom', num: 'p', gender: 'n' });
has('bonum', 'bonus', { 'case': 'acc', num: 's', gender: 'm' });
has('bonum', 'bonus', { 'case': 'nom', num: 's', gender: 'n' });
has('bonae', 'bonus', { 'case': 'gen', num: 's', gender: 'f' });
has('bonis', 'bonus', { 'case': 'abl', num: 'p', gender: 'm' });
has('pulcher', 'pulcher', { 'case': 'nom', num: 's', gender: 'm' });
has('pulchra', 'pulcher', { 'case': 'nom', num: 's', gender: 'f' });
has('pulchrum', 'pulcher', { 'case': 'acc', num: 's', gender: 'm' });
has('miser', 'miser', { 'case': 'nom', num: 's', gender: 'm' });
has('misera', 'miser', { 'case': 'nom', num: 's', gender: 'f' });
has('miserum', 'miser', { 'case': 'acc', num: 's', gender: 'm' });
has('sacer', 'sacer', { 'case': 'nom', num: 's', gender: 'm' });
has('sacra', 'sacer', { 'case': 'nom', num: 's', gender: 'f' });
has('noster', 'noster', { 'case': 'nom', num: 's', gender: 'm' });
has('nostri', 'noster', { 'case': 'nom', num: 'p', gender: 'm' });

/* ---- verbs: present ---- */
has('amo', 'amo', { tense: 'pres', person: '1', num: 's' });
has('amas', 'amo', { tense: 'pres', person: '2', num: 's' });
has('amat', 'amo', { tense: 'pres', person: '3', num: 's' });
has('amamus', 'amo', { tense: 'pres', person: '1', num: 'p' });
has('amatis', 'amo', { tense: 'pres', person: '2', num: 'p' });
has('amant', 'amo', { tense: 'pres', person: '3', num: 'p' });
has('moneo', 'moneo', { tense: 'pres', person: '1', num: 's' });
has('monent', 'moneo', { tense: 'pres', person: '3', num: 'p' });
has('rego', 'rego', { tense: 'pres', person: '1', num: 's' });
has('regis', 'rego', { tense: 'pres', person: '2', num: 's' });
has('regit', 'rego', { tense: 'pres', person: '3', num: 's' });
has('regimus', 'rego', { tense: 'pres', person: '1', num: 'p' });
has('regunt', 'rego', { tense: 'pres', person: '3', num: 'p' });
has('audio', 'audio', { tense: 'pres', person: '1', num: 's' });
has('audit', 'audio', { tense: 'pres', person: '3', num: 's' });
has('audiunt', 'audio', { tense: 'pres', person: '3', num: 'p' });
has('capio', 'capio', { tense: 'pres', person: '1', num: 's' });
has('capis', 'capio', { tense: 'pres', person: '2', num: 's' });
has('capiunt', 'capio', { tense: 'pres', person: '3', num: 'p' });
has('facit', 'facio', { tense: 'pres', person: '3', num: 's' });

/* ---- verbs: imperfect ---- */
has('amabam', 'amo', { tense: 'impf', person: '1', num: 's' });
has('amabat', 'amo', { tense: 'impf', person: '3', num: 's' });
has('amabant', 'amo', { tense: 'impf', person: '3', num: 'p' });
has('laborabant', 'laboro', { tense: 'impf', person: '3', num: 'p' });
has('monebat', 'moneo', { tense: 'impf', person: '3', num: 's' });
has('regebat', 'rego', { tense: 'impf', person: '3', num: 's' });
has('regebant', 'rego', { tense: 'impf', person: '3', num: 'p' });
has('audiebat', 'audio', { tense: 'impf', person: '3', num: 's' });
has('capiebat', 'capio', { tense: 'impf', person: '3', num: 's' });
has('mittebat', 'mitto', { tense: 'impf', person: '3', num: 's' });

/* ---- verbs: perfect ---- */
has('amavi', 'amo', { tense: 'perf', person: '1', num: 's' });
has('amavit', 'amo', { tense: 'perf', person: '3', num: 's' });
has('amaverunt', 'amo', { tense: 'perf', person: '3', num: 'p' });
has('monui', 'moneo', { tense: 'perf', person: '1', num: 's' });
has('vidit', 'video', { tense: 'perf', person: '3', num: 's' });
has('viderunt', 'video', { tense: 'perf', person: '3', num: 'p' });
has('misit', 'mitto', { tense: 'perf', person: '3', num: 's' });
has('dixit', 'dico', { tense: 'perf', person: '3', num: 's' });
has('cucurrit', 'curro', { tense: 'perf', person: '3', num: 's' });
has('cepit', 'capio', { tense: 'perf', person: '3', num: 's' });
has('fecit', 'facio', { tense: 'perf', person: '3', num: 's' });
has('venit', 'venio', { tense: 'perf', person: '3', num: 's' });
has('dedit', 'do', { tense: 'perf', person: '3', num: 's' });
has('steti', 'sto', { tense: 'perf', person: '1', num: 's' });
has('iussit', 'iubeo', { tense: 'perf', person: '3', num: 's' });

/* ---- sum ---- */
has('sum', 'sum', { tense: 'pres', person: '1', num: 's' });
has('est', 'sum', { tense: 'pres', person: '3', num: 's' });
has('sunt', 'sum', { tense: 'pres', person: '3', num: 'p' });
has('erat', 'sum', { tense: 'impf', person: '3', num: 's' });
has('erant', 'sum', { tense: 'impf', person: '3', num: 'p' });
has('fuit', 'sum', { tense: 'perf', person: '3', num: 's' });
has('esse', 'sum', { mood: 'inf' });
has('adest', 'adsum', { tense: 'pres', person: '3', num: 's' });
has('aberat', 'absum', { tense: 'impf', person: '3', num: 's' });

/* ---- infinitives and imperatives ---- */
has('amare', 'amo', { mood: 'inf' });
has('monere', 'moneo', { mood: 'inf' });
has('mittere', 'mitto', { mood: 'inf' });
has('audire', 'audio', { mood: 'inf' });
has('capere', 'capio', { mood: 'inf' });
has('ama', 'amo', { mood: 'imp', num: 's' });
has('amate', 'amo', { mood: 'imp', num: 'p' });
has('mitte', 'mitto', { mood: 'imp', num: 's' });
has('mittite', 'mitto', { mood: 'imp', num: 'p' });
has('audi', 'audio', { mood: 'imp', num: 's' });
has('cape', 'capio', { mood: 'imp', num: 's' });
has('dic', 'dico', { mood: 'imp', num: 's' });
has('duc', 'duco', { mood: 'imp', num: 's' });
has('fac', 'facio', { mood: 'imp', num: 's' });

/* ---- pronouns, prepositions, particles ---- */
has('ego', 'ego', { 'case': 'nom' });
has('me', 'ego', { 'case': 'acc' });
has('nos', 'nos', { 'case': 'nom' });
has('te', 'tu', { 'case': 'acc' });
has('in', 'in', { pos: 'prep' });
has('ad', 'ad', { pos: 'prep' });
has('trans', 'trans', { pos: 'prep' });
has('ab', 'a/ab', { pos: 'prep' });
has('a', 'a/ab', { pos: 'prep' });
has('ex', 'e/ex', { pos: 'prep' });
has('e', 'e/ex', { pos: 'prep' });

/* ---- out of scope at L1 ---- */
unknown('milites');      // 3rd declension, L2
unknown('fortis');       // 3rd declension adj, L2
unknown('amabit');       // future, L2 (Jonny's correction: L1 stops at perfect)
unknown('amaverat');     // pluperfect, L2
unknown('amatur');       // passive, L2
unknown('potest');       // possum, L2
unknown('eunt');         // eo, L3
unknown('hanc');         // hic pronoun, L3
unknown('quem');         // qui, L3

/* ---- ambiguity, the pedagogical payload ---- */
countReadings('puellae', 4);          // gen sg, dat sg, nom pl, voc pl
countReadings('dominis', 4);          // dat/abl pl of BOTH domina and dominus
countReadings('templa', 3);           // nom pl, voc pl, acc pl
countReadings('amat', 1);
countReadings('bona', 6);             // f nom/voc/abl sg, n nom/voc/acc pl

console.log('morphology: ' + pass + ' passed, ' + fail + ' failed');
if (fails.length) { fails.forEach(function (f) { console.log('  FAIL ' + f); }); process.exit(1); }
