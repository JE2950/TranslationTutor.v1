var VOCAB=require('../data/vocab.js'),M=require('../js/morph.js'),P=require('../js/parse.js'),E=require('../js/english.js'),Lat=require('../js/latin.js');
var L=M.buildLexicon(VOCAB,['L1'],{});
var R=Lat.buildReverse(L);

function target(en){
  var r = Lat.parseEnglish(L, R, en);
  if(!r.ok) return {err:r.error};
  return {t: Lat.buildTarget(L, r.plan), plan:r.plan};
}

console.log('--- English → Latin targets ---');
[ 'The girls were working in the house',
  'the slave carries the food',
  'the master killed the angry slave',
  'the boys were reading the good books',
  'the sailor sailed to the island',
  'the teacher gave the money to the slaves',
  'the son of the master wrote a letter',
  'we love the girl',
  'the master is good',
  'the farmers used to work in the fields',
  'the boy has written a letter',
  'the queen walked through the street'
].forEach(function(s){
  var o = target(s);
  if (o.err) { console.log('  ' + s + '\n      ERROR: ' + o.err); return; }
  console.log('  ' + s + '\n      → ' + o.t.sentence);
});

console.log('\n--- checking a pupil\'s Latin (word order free) ---');
var pass=0,fail=0,fails=[];
function chk(en, attempt, expectOk, expectIn){
  var o = target(en);
  if (o.err){ fail++; fails.push(en+' → parse error: '+o.err); return; }
  var r = Lat.checkLatin(L, o.t, attempt);
  var ok = (r.ok===expectOk) && (!expectIn || (r.feedback||'').toLowerCase().indexOf(expectIn)>=0);
  if(ok) pass++; else { fail++; fails.push('"'+en+'" ← "'+attempt+'" ok='+r.ok+' (want '+expectOk+') fb='+r.feedback); }
}
chk('the slave carries the food','servus cibum portat',true);
chk('the slave carries the food','cibum servus portat',true);      // order free
chk('the slave carries the food','portat servus cibum',true);
chk('the slave carries the food','servus cibum portabat',false,'imperfect');
chk('the slave carries the food','servum cibum portat',false,'case');
chk('the slave carries the food','servus cibus portat',false,'case');
chk('the slave carries the food','servi cibum portant',false,'person');
chk('the girls were working in the house','puellae in villa laborabant',true);
chk('the girls were working in the house','in villa puellae laborabant',true);
chk('the girls were working in the house','puellae in villam laborabant',false,'case');
chk('the girls were working in the house','puella in villa laborabat',false);
chk('the master killed the angry slave','dominus servum iratum necavit',true);
chk('the master killed the angry slave','dominus servum iratus necavit',false,'agree');
chk('we love the girl','puellam amamus',true);
chk('the son of the master wrote a letter','filius domini epistulam scripsit',true);
chk('the teacher gave the money to the slaves','magister servis pecuniam dedit',true);
console.log('\nEnglish→Latin: '+pass+' passed, '+fail+' failed');
fails.forEach(function(f){console.log('  FAIL '+f);});

console.log('\n--- a scripted session ---');
var o = target('The girls were working in the house');
var steps = Lat.buildSteps(L, o.plan, o.t, {});
console.log('steps: ' + steps.length);
steps.forEach(function(s,i){
  console.log('  ['+(i+1)+'] ('+s.group+') '+s.instruction + (s.options? '   {'+s.options.slice(0,4).join(' / ')+(s.options.length>4?' …':'')+'}':''));
});
