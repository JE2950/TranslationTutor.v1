var VOCAB=require('../data/vocab.js'),M=require('../js/morph.js'),P=require('../js/parse.js'),E=require('../js/english.js'),S=require('../js/socratic.js');
var L=M.buildLexicon(VOCAB,['L1'],{});

function run(sentence, script, opts){
  var p = P.parse(L, sentence);
  var t = new S.Tutor(p, opts||{});
  console.log('\n======== ' + sentence + ' ========');
  console.log('(model answer, teacher only: ' + E.model(p) + ')');
  var guard = 0;
  while (!t.finished() && guard++ < 60) {
    var st = t.step();
    console.log('\n[' + (t.i+1) + '/' + t.steps.length + '] ' + st.instruction + (st.detail ? '   — ' + st.detail : ''));
    if (st.input === 'choice') console.log('        options: ' + st.options.join(' / '));
    if (st.input === 'build') console.log('        tiles: ' + st.tiles.correct.concat(st.tiles.distractors).map(function(x){return '['+x.text+']';}).join(' '));
    var answers = script[st.id];
    if (!answers) { console.log('        !! no scripted answer for step id ' + st.id); break; }
    if (!Array.isArray(answers)) answers = [answers];
    for (var k=0;k<answers.length;k++){
      var a = answers[k];
      if (a === '?') { var h = t.hint(); console.log('   > (asks for a hint)'); console.log('     hint: ' + (h.text || JSON.stringify(h.table && h.table.title))); continue; }
      if (a === 'TABLE') { var tb = t.showTable(); console.log('   > (asks for the table)'); console.log('     table: ' + (tb?tb.title:'none')); continue; }
      console.log('   > ' + a);
      var r = t.submit(a);
      console.log('     ' + (r.ok?'OK  ':'NO  ') + r.feedback + (r.offerTable?'   [table offered]':''));
      if (r.ok) break;
    }
  }
  console.log('\n   summary: ' + JSON.stringify(t.summary()));
  return t;
}

/* a boy who gets things wrong, asks for help, then works it out */
run('puellae in villa laborabant.', {
  'c0-findverb':   ['villa', 'laborabant'],
  'c0-person':     ['he, she or it', 'they'],
  'c0-tense':      ['present', '?', 'imperfect'],
  'c0-vmean':      ['works', 'were working'],
  'c0-subject':    ['puellae'],
  'c0-amb-0':      ['genitive', 'nominative'],
  'c0-prep-1':     ['into the house', 'in the house'],
  'whole':         ['the girl was working in the house', 'the girls were working in the house']
});

/* object, adjective agreement, perfect tense */
run('dominus iratus servum in agro necavit.', {
  'c0-findverb':   ['necavit'],
  'c0-person':     ['he, she or it'],
  'c0-tense':      ['imperfect', '?', '?', 'perfect'],
  'c0-vmean':      ['killed'],
  'c0-subject':    ['dominus'],
  'c0-object':     ['agro', 'servum'],
  'c0-adj-1':      ['servum', 'dominus'],
  'c0-prep-3':     ['in the field'],
  'whole':         ['the angry master killed the slave in the field']
});

/* genitive, and the ambiguity of domini */
run('filius domini epistulam scripsit.', {
  'c0-findverb':   ['scripsit'],
  'c0-person':     ['he, she or it'],
  'c0-tense':      ['perfect'],
  'c0-vmean':      ['wrote'],
  'c0-subject':    ['filius'],
  'c0-object':     ['epistulam'],
  'c0-amb-2':      ['accusative'],
  'c0-case-1':     ['the master', 'of the master'],
  'whole':         ["the master's son wrote a letter"]
});

/* two clauses */
run('pueri libros legebant quod magister aderat.', {
  'c0-findverb':['legebant'],'c0-person':['they'],'c0-tense':['imperfect'],'c0-vmean':['were reading'],
  'c0-subject':['pueri'],'c0-amb-0':['nominative'],'c0-object':['libros'],
  'c1-findverb':['aderat'],'c1-person':['he, she or it'],'c1-tense':['imperfect'],'c1-vmean':['was present'],
  'c1-subject':['magister'],
  'whole':['the boys were reading the books because the teacher was present']
});

/* build-it mode */
run('puellae in villa laborabant.', {
  'c0-findverb':['laborabant'],'c0-person':['they'],'c0-tense':['imperfect'],'c0-vmean':['were working'],
  'c0-subject':['puellae'],'c0-amb-0':['nominative'],'c0-prep-1':['in the house'],
  'whole':['the girls were working in the house']
}, { mode:'build' });

/* core depth: fewer steps */
run('servus cibum portat.', {
  'c0-findverb':['portat'],'c0-person':['he, she or it'],'c0-tense':['present'],
  'c0-subject':['servus'],'c0-object':['cibum'],
  'whole':['the slave carries the food']
}, { depth:'core' });
