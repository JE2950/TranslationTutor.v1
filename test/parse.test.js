var VOCAB = require('../data/vocab.js');
var M = require('../js/morph.js');
var P = require('../js/parse.js');

var L = M.buildLexicon(VOCAB, ['L1'], {});
var pass = 0, fail = 0, fails = [];

function show(s) {
  var r = P.parse(L, s);
  var bits = r.words.map(function (w) {
    var c = w.chosen;
    if (!c) return w.raw + '[?]';
    var t = c.tags, d;
    if (t.pos === 'verb' && t.mood === 'ind') d = t.tense + ' ' + t.person + t.num;
    else if (t.pos === 'verb') d = t.mood;
    else if (t['case']) d = t['case'] + ' ' + t.num + (t.gender ? ' ' + t.gender : '');
    else d = t.pos;
    return w.raw + '[' + (w.role || '-') + ':' + d + ']';
  });
  return bits.join('  ');
}

/* expect: word → role */
function check(sentence, expect) {
  var r = P.parse(L, sentence);
  var bad = [];
  Object.keys(expect).forEach(function (word) {
    var w = null;
    r.words.forEach(function (x) { if (x.norm === word.toLowerCase()) w = x; });
    if (!w) { bad.push(word + ' not found'); return; }
    var want = expect[word];
    if (want.role && w.role !== want.role) bad.push(word + ' role=' + w.role + ' want ' + want.role);
    if (want.lemma && (!w.chosen || w.chosen.lemma !== want.lemma)) bad.push(word + ' lemma=' + (w.chosen && w.chosen.lemma) + ' want ' + want.lemma);
    if (want['case'] && (!w.chosen || w.chosen.tags['case'] !== want['case'])) bad.push(word + ' case=' + (w.chosen && w.chosen.tags['case']) + ' want ' + want['case']);
    if (want.num && (!w.chosen || w.chosen.tags.num !== want.num)) bad.push(word + ' num=' + (w.chosen && w.chosen.tags.num) + ' want ' + want.num);
    if (want.tense && (!w.chosen || w.chosen.tags.tense !== want.tense)) bad.push(word + ' tense=' + (w.chosen && w.chosen.tags.tense) + ' want ' + want.tense);
  });
  if (!bad.length) pass++;
  else { fail++; fails.push('"' + sentence + '"\n       ' + bad.join('; ') + '\n       got: ' + show(sentence)); }
}

/* --- simple subject + verb --- */
check('puella cantat.', {
  puella: { role: 'subject', 'case': 'nom', num: 's' },
  cantat: { role: 'verb', tense: 'pres' }
});
check('pueri currunt.', {
  pueri: { role: 'subject', 'case': 'nom', num: 'p' },
  currunt: { role: 'verb', tense: 'pres' }
});

/* --- subject + object + verb --- */
check('puella poetam amat.', {
  puella: { role: 'subject', 'case': 'nom', num: 's' },
  poetam: { role: 'object', 'case': 'acc', num: 's' },
  amat: { role: 'verb', tense: 'pres' }
});
check('servus cibum portat.', {
  servus: { role: 'subject' }, cibum: { role: 'object', 'case': 'acc' }, portat: { role: 'verb' }
});
check('dominus servos vocabat.', {
  dominus: { role: 'subject', num: 's' },
  servos: { role: 'object', 'case': 'acc', num: 'p' },
  vocabat: { role: 'verb', tense: 'impf' }
});

/* --- the puellae ambiguity resolved by the verb's number --- */
check('puellae in villa laborabant.', {
  puellae: { role: 'subject', 'case': 'nom', num: 'p' },
  villa: { role: 'prepobj', 'case': 'abl', num: 's' },
  laborabant: { role: 'verb', tense: 'impf' }
});
check('puellae pecuniam dat.', {
  puellae: { role: 'dat', 'case': 'dat', num: 's' },
  pecuniam: { role: 'object', 'case': 'acc' },
  dat: { role: 'verb' }
});

/* --- prepositions --- */
check('nauta ad insulam navigat.', {
  nauta: { role: 'subject', 'case': 'nom' },
  ad: { role: 'prep' },
  insulam: { role: 'prepobj', 'case': 'acc' },
  navigat: { role: 'verb' }
});
check('agricola in agro laborat.', {
  agro: { role: 'prepobj', 'case': 'abl' }, laborat: { role: 'verb' }
});
check('servi per vias ambulabant.', {
  vias: { role: 'prepobj', 'case': 'acc', num: 'p' }, ambulabant: { role: 'verb', tense: 'impf' }
});
check('milites trans flumen.', {}); // out of scope words → unknown, must not crash

/* --- adjective agreement --- */
check('puella laeta cantat.', {
  laeta: { role: 'adj', 'case': 'nom', num: 's' },
  puella: { role: 'subject' }, cantat: { role: 'verb' }
});
check('magnus dominus servum malum punit.', {}); // punit not on list; must not crash
check('dominus iratus servum necavit.', {
  iratus: { role: 'adj', 'case': 'nom' },
  servum: { role: 'object', 'case': 'acc' },
  necavit: { role: 'verb', tense: 'perf' }
});
check('pueri libros bonos legebant.', {
  pueri: { role: 'subject', 'case': 'nom', num: 'p' },
  libros: { role: 'object', 'case': 'acc', num: 'p' },
  bonos: { role: 'adj', 'case': 'acc', num: 'p' },
  legebant: { role: 'verb', tense: 'impf' }
});

/* --- sum + complement --- */
check('dominus est bonus.', {
  dominus: { role: 'subject', 'case': 'nom' },
  est: { role: 'verb' },
  bonus: { 'case': 'nom' }
});
check('puellae erant laetae.', {
  puellae: { role: 'subject', 'case': 'nom', num: 'p' },
  erant: { role: 'verb', tense: 'impf' }
});

/* --- perfect tense --- */
check('servus epistulam scripsit.', {
  scripsit: { role: 'verb', tense: 'perf' }, epistulam: { role: 'object' }
});
check('pueri in horto luserunt.', {
  luserunt: { role: 'verb', tense: 'perf' }, horto: { role: 'prepobj', 'case': 'abl' }
});

/* --- subordinate clauses --- */
check('puer currit quod magistrum timet.', {
  currit: { role: 'verb' }, magistrum: { role: 'object', 'case': 'acc' }, timet: { role: 'verb' }
});
check('ubi dominus venit servi laborabant.', {
  venit: { role: 'verb' }, laborabant: { role: 'verb', tense: 'impf' }
});

/* --- prolative infinitive --- */
check('servus discedere cupit.', {
  discedere: { role: 'inf' }, cupit: { role: 'verb' }
});

/* --- imperative and vocative --- */
check('audi, serve!', { audi: { role: 'verb' } });

/* --- questions --- */
check('cur pueri clamant?', { clamant: { role: 'verb' } });
check('estne dominus in villa?', {});

/* --- 1st and 2nd person --- */
check('ego sum dominus.', { ego: { 'case': 'nom' }, sum: { role: 'verb' } });
check('puellam amamus.', { puellam: { role: 'object' }, amamus: { role: 'verb' } });

/* --- genitive --- */
check('filius domini currit.', {
  filius: { role: 'subject', 'case': 'nom' },
  domini: { role: 'gen', 'case': 'gen', num: 's' },
  currit: { role: 'verb' }
});

/* --- neuter subject/object disambiguation --- */
check('bellum oppidum delevit.', { delevit: { role: 'verb', tense: 'perf' } });
check('templa sunt alta.', { templa: { role: 'subject', 'case': 'nom', num: 'p' }, sunt: { role: 'verb' } });

console.log('parser: ' + pass + ' passed, ' + fail + ' failed');
fails.forEach(function (f) { console.log('  FAIL ' + f); });

console.log('\n--- sample parses ---');
[
  'puellae in villa laborabant.',
  'dominus iratus servum in agro necavit.',
  'pueri libros bonos legebant quod magister aderat.',
  'nauta ad insulam cum amico navigavit.',
  'servus discedere cupit.',
  'filius domini epistulam scripsit.'
].forEach(function (s) { console.log(s + '\n   ' + show(s)); });
