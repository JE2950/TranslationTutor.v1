var VOCAB = require('../data/vocab.js');
var M = require('../js/morph.js');
var P = require('../js/parse.js');
var E = require('../js/english.js');
var L = M.buildLexicon(VOCAB, ['L1'], {});

var pass=0, fail=0, fails=[];
function mark(sent, answer, expectOk, expectProblem){
  var p = P.parse(L, sent);
  var r = E.markTranslation(p, answer);
  var okMatch = (r.ok === expectOk);
  var probMatch = true;
  if (expectProblem) {
    var fp = r.firstProblem;
    probMatch = !!(fp && fp.problem && fp.problem.type === expectProblem) || r.orderProblem === expectProblem;
  }
  if (okMatch && probMatch) pass++;
  else { fail++; fails.push('"'+sent+'" ← "'+answer+'"  ok='+r.ok+' (want '+expectOk+')'+
    (expectProblem ? ' problem='+(r.firstProblem&&r.firstProblem.problem.type)+'/'+r.orderProblem+' (want '+expectProblem+')' : '')); }
}

console.log('--- model translations ---');
[ 'puella cantat.',
  'puellae in villa laborabant.',
  'dominus iratus servum in agro necavit.',
  'pueri libros bonos legebant quod magister aderat.',
  'nauta ad insulam cum amico navigavit.',
  'servus discedere cupit.',
  'filius domini epistulam scripsit.',
  'magistrum audite, pueri!',
  'puellae pecuniam dat.',
  'templa sunt alta.',
  'dominus servis cibum dedit.'
].forEach(function(s){
  var p = P.parse(L, s);
  console.log('  ' + s + '\n    → ' + E.model(p));
});

/* generous acceptance */
mark('puellae in villa laborabant.', 'The girls were working in the house', true);
mark('puellae in villa laborabant.', 'the girls used to work in the villa', true);
mark('puellae in villa laborabant.', 'In the villa the girls were working', true);
mark('puellae in villa laborabant.', 'The girls worked in the house', true);
mark('puellae in villa laborabant.', 'girls were working in a house', true);
/* wrong number diagnosed */
mark('puellae in villa laborabant.', 'The girl was working in the house', false, 'number');
/* wrong tense diagnosed */
mark('puella cantat.', 'the girl was singing', false, 'tense');
mark('puella cantabat.', 'the girl sings', false, 'tense');
mark('servus epistulam scripsit.', 'the slave writes a letter', false, 'tense');
/* perfect accepted several ways */
mark('servus epistulam scripsit.', 'the slave wrote a letter', true);
mark('servus epistulam scripsit.', 'The slave has written the letter', true);
mark('servus epistulam scripsit.', 'the slave did write a letter', true);
/* preposition case diagnosed */
mark('puellae in villam ambulabant.', 'the girls were walking into the house', true);
mark('puellae in villam ambulabant.', 'the girls were walking in the house', false, 'case');
/* missing word */
mark('dominus iratus servum necavit.', 'the master killed the slave', false, 'missing');
mark('dominus iratus servum necavit.', 'the angry master killed the slave', true);
mark('dominus iratus servum necavit.', 'The angry master has killed the slave', true);
/* word order */
mark('puella poetam amat.', 'the poet loves the girl', false, 'subject-after-verb');
mark('puella poetam amat.', 'the girl loves the poet', true);
/* synonyms */
mark('puella poetam amat.', 'the girl likes the poet', true);
mark('magister pueros monet.', 'the teacher warns the boys', true);
mark('magister pueros monet.', 'the master advises the boys', true);
mark('magister pueros monet.', 'the teacher was warning the boys', false, 'tense');
/* dative */
mark('dominus servis cibum dedit.', 'the master gave food to the slaves', true);
mark('dominus servis cibum dedit.', 'the master gave the slaves the food', true);
/* genitive */
mark('filius domini currit.', "the master's son runs", true);
mark('filius domini currit.', 'the son of the master is running', true);
/* sum */
mark('templa sunt alta.', 'the temples are high', true);
mark('dominus est bonus.', 'the master is good', true);
/* prolative infinitive */
mark('servus discedere cupit.', 'the slave wants to leave', true);
mark('servus discedere cupit.', 'the slave desires to depart', true);
/* imperative + vocative */
mark('magistrum audite, pueri!', 'listen to the teacher, boys', true);
/* implied subject from the ending */
mark('puellam amamus.', 'we love the girl', true);
mark('cibum portat.', 'he carries the food', true);
mark('cibum portat.', 'she is carrying the food', true);

console.log('\nmarking: ' + pass + ' passed, ' + fail + ' failed');
fails.forEach(function(f){ console.log('  FAIL ' + f); });

console.log('\n--- tiles for build-it mode ---');
var p2 = P.parse(L, 'puellae in villa laborabant.');
var t = E.tiles(p2);
console.log('  correct: ' + t.correct.map(function(c){return '['+c.text+']';}).join(' '));
console.log('  wrong:   ' + t.distractors.map(function(c){return '['+c.text+' ('+c.why+')]';}).join(' '));
