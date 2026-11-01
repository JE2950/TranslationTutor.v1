/* Robustness run over real sentences from Bass, Prep School Latin. */
var fs = require('fs');
var VOCAB = require('../data/vocab.js');
var M = require('../js/morph.js');
var P = require('../js/parse.js');

var LALL = M.buildLexicon(VOCAB, ['L1','L2','L3'], { future:1, pluperfect:1, passive:1 });
var L1   = M.buildLexicon(VOCAB, ['L1'], {});

/* Point this at a plain-text copy of Prep School Latin (Bass). Without it
   there is nothing to run against, so the check is skipped rather than failed. */
var SOURCE = process.env.BASS_TEXT || '/mnt/user-data/uploads/LATIN/Prep School Latin - Chapters 48-73.txt';
if (!fs.existsSync(SOURCE)) {
  console.log('bass: skipped (set BASS_TEXT to a plain-text copy of Prep School Latin)');
  process.exit(0);
}
var txt = fs.readFileSync(SOURCE,'utf8');
// sentence-split, then keep sentences where most words are in the Latin lexicon
var raw = txt.replace(/\s+/g,' ').split(/(?<=[.?!])\s+/);
var sents = [];
raw.forEach(function(s){
  s = s.trim();
  if (s.length < 10 || s.length > 120) return;
  var ws = s.match(/[A-Za-z]+/g) || [];
  if (ws.length < 3 || ws.length > 12) return;
  var known = ws.filter(function(w){ return !M.analyse(LALL, w).unknown; }).length;
  // proper names (Marcus, Flavia, Orbilius) won't be in the list, so allow 70%
  if (known / ws.length >= 0.7) sents.push(s);
});
var seen={}, uniq=[];
sents.forEach(function(s){ var k=s.toLowerCase(); if(!seen[k]){seen[k]=1;uniq.push(s);} });

console.log('real sentences found: ' + uniq.length);

var crashed = 0, parsedAll = 0, noVerb = 0;
var examples = [];
uniq.forEach(function(s, i){
  var r;
  try { r = P.parse(LALL, s); }
  catch (e) { crashed++; console.log('  CRASH on "'+s+'": '+e.message); return; }
  var hasVerb = r.clauses.some(function(c){ return c.info.verbIdx != null; });
  if (!hasVerb) noVerb++;
  if (r.unknowns.length === 0) parsedAll++;
  if (i < 14) examples.push(s + '\n   ' + r.words.map(function(w){
    var c=w.chosen; if(!c) return w.raw+'[?]';
    var t=c.tags, d;
    if (t.pos==='verb' && t.mood==='ind') d=t.tense+' '+t.person+t.num+(t.voice==='pass'?' pass':'');
    else if (t.pos==='verb') d=t.mood;
    else if (t['case']) d=t['case']+' '+t.num;
    else d=t.pos;
    return w.raw+'['+(w.role||'-')+':'+d+']';
  }).join('  '));
});
console.log('crashes: ' + crashed);
console.log('every word recognised: ' + parsedAll + '/' + uniq.length);
console.log('no finite verb found: ' + noVerb);
console.log('\n--- real Bass sentences, parsed ---');
examples.forEach(function(e){ console.log(e); });
