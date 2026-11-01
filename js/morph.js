/* ============================================================
   morph.js — CE Latin morphology engine
   Generates and recognises every form of every word in the
   CE vocabulary. No network, no API. Deterministic.
   Exposes window.Morph (browser) or module.exports (node).
   ============================================================ */
(function (root) {
  'use strict';

  var CASES = ['nom', 'voc', 'acc', 'gen', 'dat', 'abl'];
  var PERSONS = ['1s', '2s', '3s', '1p', '2p', '3p'];

  /* ---------- helpers ---------- */
  function strip(s) { return (s || '').trim(); }
  function parts(info) { return strip(info).split(',').map(strip).filter(Boolean); }
  function lower(s) { return (s || '').toLowerCase(); }

  // Latin letter normalisation: j/i and v/u are the same letter for lookup,
  // macrons are not used in CE but strip them anyway.
  function key(s) {
    return lower(s)
      .replace(/[āĂăÁáÀà]/g, 'a').replace(/[ēĔĕÉéÈè]/g, 'e')
      .replace(/[īĬĭÍíÌì]/g, 'i').replace(/[ōŎŏÓóÒò]/g, 'o')
      .replace(/[ūŬŭÚúÙù]/g, 'u').replace(/ÿ|ý/g, 'y')
      .replace(/j/g, 'i').replace(/v/g, 'u');
  }

  /* ---------- noun paradigm endings ---------- */
  var NOUN_ENDINGS = {
    'd1': { sg: ['a', 'a', 'am', 'ae', 'ae', 'a'], pl: ['ae', 'ae', 'as', 'arum', 'is', 'is'] },
    'd2m': { sg: ['us', 'e', 'um', 'i', 'o', 'o'], pl: ['i', 'i', 'os', 'orum', 'is', 'is'] },
    'd2er': { sg: [null, null, 'um', 'i', 'o', 'o'], pl: ['i', 'i', 'os', 'orum', 'is', 'is'] },
    'd2n': { sg: ['um', 'um', 'um', 'i', 'o', 'o'], pl: ['a', 'a', 'a', 'orum', 'is', 'is'] },
    // 3rd-5th are declared for L2/L3 extension; unused at L1
    'd3c': { sg: [null, null, 'em', 'is', 'i', 'e'], pl: ['es', 'es', 'es', 'um', 'ibus', 'ibus'] },
    'd3i': { sg: [null, null, 'em', 'is', 'i', 'e'], pl: ['es', 'es', 'es', 'ium', 'ibus', 'ibus'] },
    'd3n': { sg: [null, null, null, 'is', 'i', 'e'], pl: ['a', 'a', 'a', 'um', 'ibus', 'ibus'] },
    'd3ni': { sg: [null, null, null, 'is', 'i', 'i'], pl: ['ia', 'ia', 'ia', 'ium', 'ibus', 'ibus'] },
    'd4m': { sg: ['us', 'us', 'um', 'us', 'ui', 'u'], pl: ['us', 'us', 'us', 'uum', 'ibus', 'ibus'] },
    'd4n': { sg: ['u', 'u', 'u', 'us', 'u', 'u'], pl: ['ua', 'ua', 'ua', 'uum', 'ibus', 'ibus'] },
    'd5': { sg: ['es', 'es', 'em', 'ei', 'ei', 'e'], pl: ['es', 'es', 'es', 'erum', 'ebus', 'ebus'] }
  };

  /* ---------- verb paradigms ---------- */
  // present-system endings
  var PRES_ACT = ['o', 's', 't', 'mus', 'tis', 'nt'];
  var IMPF_ACT = ['bam', 'bas', 'bat', 'bamus', 'batis', 'bant'];
  var PERF_ACT = ['i', 'isti', 'it', 'imus', 'istis', 'erunt'];
  var PERF_ACT_ALT = { '3p': 'ere' };

  // Level 2/3 (declared, generated only when level allows)
  var PLUPF_ACT = ['eram', 'eras', 'erat', 'eramus', 'eratis', 'erant'];
  var FUTPERF_ACT = ['ero', 'eris', 'erit', 'erimus', 'eritis', 'erint'];
  var PRES_PASS = ['or', 'ris', 'tur', 'mur', 'mini', 'ntur'];
  var IMPF_PASS = ['bar', 'baris', 'batur', 'bamur', 'bamini', 'bantur'];

  /* ---------- irregular verbs, fully written out ---------- */
  var IRREG_VERBS = {
    'sum': {
      pres: ['sum', 'es', 'est', 'sumus', 'estis', 'sunt'],
      impf: ['eram', 'eras', 'erat', 'eramus', 'eratis', 'erant'],
      perf: ['fui', 'fuisti', 'fuit', 'fuimus', 'fuistis', 'fuerunt'],
      fut: ['ero', 'eris', 'erit', 'erimus', 'eritis', 'erunt'],
      plupf: ['fueram', 'fueras', 'fuerat', 'fueramus', 'fueratis', 'fuerant'],
      inf: 'esse', imp: ['es', 'este']
    },
    'absum': {
      pres: ['absum', 'abes', 'abest', 'absumus', 'abestis', 'absunt'],
      impf: ['aberam', 'aberas', 'aberat', 'aberamus', 'aberatis', 'aberant'],
      perf: ['afui', 'afuisti', 'afuit', 'afuimus', 'afuistis', 'afuerunt'],
      fut: ['abero', 'aberis', 'aberit', 'aberimus', 'aberitis', 'aberunt'],
      plupf: ['afueram', 'afueras', 'afuerat', 'afueramus', 'afueratis', 'afuerant'],
      inf: 'abesse', imp: ['abes', 'abeste']
    },
    'adsum': {
      pres: ['adsum', 'ades', 'adest', 'adsumus', 'adestis', 'adsunt'],
      impf: ['aderam', 'aderas', 'aderat', 'aderamus', 'aderatis', 'aderant'],
      perf: ['adfui', 'adfuisti', 'adfuit', 'adfuimus', 'adfuistis', 'adfuerunt'],
      fut: ['adero', 'aderis', 'aderit', 'aderimus', 'aderitis', 'aderunt'],
      plupf: ['adfueram', 'adfueras', 'adfuerat', 'adfueramus', 'adfueratis', 'adfuerant'],
      inf: 'adesse', imp: ['ades', 'adeste']
    },
    'possum': {
      pres: ['possum', 'potes', 'potest', 'possumus', 'potestis', 'possunt'],
      impf: ['poteram', 'poteras', 'poterat', 'poteramus', 'poteratis', 'poterant'],
      perf: ['potui', 'potuisti', 'potuit', 'potuimus', 'potuistis', 'potuerunt'],
      fut: ['potero', 'poteris', 'poterit', 'poterimus', 'poteritis', 'poterunt'],
      plupf: ['potueram', 'potueras', 'potuerat', 'potueramus', 'potueratis', 'potuerant'],
      inf: 'posse', imp: null
    },
    'eo': {
      pres: ['eo', 'is', 'it', 'imus', 'itis', 'eunt'],
      impf: ['ibam', 'ibas', 'ibat', 'ibamus', 'ibatis', 'ibant'],
      perf: ['ii', 'isti', 'iit', 'iimus', 'istis', 'ierunt'],
      fut: ['ibo', 'ibis', 'ibit', 'ibimus', 'ibitis', 'ibunt'],
      plupf: ['ieram', 'ieras', 'ierat', 'ieramus', 'ieratis', 'ierant'],
      inf: 'ire', imp: ['i', 'ite']
    },
    'volo': {
      pres: ['volo', 'vis', 'vult', 'volumus', 'vultis', 'volunt'],
      impf: ['volebam', 'volebas', 'volebat', 'volebamus', 'volebatis', 'volebant'],
      perf: ['volui', 'voluisti', 'voluit', 'voluimus', 'voluistis', 'voluerunt'],
      fut: ['volam', 'voles', 'volet', 'volemus', 'voletis', 'volent'],
      plupf: ['volueram', 'volueras', 'voluerat', 'volueramus', 'volueratis', 'voluerant'],
      inf: 'velle', imp: null
    },
    'nolo': {
      pres: ['nolo', 'non vis', 'non vult', 'nolumus', 'non vultis', 'nolunt'],
      impf: ['nolebam', 'nolebas', 'nolebat', 'nolebamus', 'nolebatis', 'nolebant'],
      perf: ['nolui', 'noluisti', 'noluit', 'noluimus', 'noluistis', 'noluerunt'],
      fut: ['nolam', 'noles', 'nolet', 'nolemus', 'noletis', 'nolent'],
      plupf: ['nolueram', 'nolueras', 'noluerat', 'nolueramus', 'nolueratis', 'noluerant'],
      inf: 'nolle', imp: ['noli', 'nolite']
    },
    'fero': {
      pres: ['fero', 'fers', 'fert', 'ferimus', 'fertis', 'ferunt'],
      impf: ['ferebam', 'ferebas', 'ferebat', 'ferebamus', 'ferebatis', 'ferebant'],
      perf: ['tuli', 'tulisti', 'tulit', 'tulimus', 'tulistis', 'tulerunt'],
      fut: ['feram', 'feres', 'feret', 'feremus', 'feretis', 'ferent'],
      plupf: ['tuleram', 'tuleras', 'tulerat', 'tuleramus', 'tuleratis', 'tulerant'],
      inf: 'ferre', imp: ['fer', 'ferte']
    }
  };

  // irregular singular imperatives
  var IRREG_IMP = { 'dico': 'dic', 'duco': 'duc', 'facio': 'fac', 'fero': 'fer' };

  /* ---------- pronouns ---------- */
  var PRONOUNS = {
    'ego': { forms: { 'nom-s': 'ego', 'acc-s': 'me', 'gen-s': 'mei', 'dat-s': 'mihi', 'abl-s': 'me' }, person: '1s', eng: 'I' },
    'nos': { forms: { 'nom-p': 'nos', 'acc-p': 'nos', 'gen-p': 'nostrum', 'dat-p': 'nobis', 'abl-p': 'nobis' }, person: '1p', eng: 'we' },
    'tu': { forms: { 'nom-s': 'tu', 'acc-s': 'te', 'gen-s': 'tui', 'dat-s': 'tibi', 'abl-s': 'te' }, person: '2s', eng: 'you (singular)' },
    'vos': { forms: { 'nom-p': 'vos', 'acc-p': 'vos', 'gen-p': 'vestrum', 'dat-p': 'vobis', 'abl-p': 'vobis' }, person: '2p', eng: 'you (plural)' }
  };
  // L1 scope: nominative and accusative only
  var PRONOUN_L1_CASES = { 'nom': 1, 'acc': 1 };

  /* ---------- numerals ---------- */
  var NUM_DECL = {
    'unus': { m: ['unus', 'une', 'unum', 'unius', 'uni', 'uno'], f: ['una', 'una', 'unam', 'unius', 'uni', 'una'], n: ['unum', 'unum', 'unum', 'unius', 'uni', 'uno'], num: 's' },
    'duo': { m: ['duo', 'duo', 'duos', 'duorum', 'duobus', 'duobus'], f: ['duae', 'duae', 'duas', 'duarum', 'duabus', 'duabus'], n: ['duo', 'duo', 'duo', 'duorum', 'duobus', 'duobus'], num: 'p' },
    'tres': { m: ['tres', 'tres', 'tres', 'trium', 'tribus', 'tribus'], f: ['tres', 'tres', 'tres', 'trium', 'tribus', 'tribus'], n: ['tria', 'tria', 'tria', 'trium', 'tribus', 'tribus'], num: 'p' }
  };

  /* ============================================================
     LEXICON BUILD
     ============================================================ */

  function classifyNoun(entry) {
    var t = entry.type, lat = lower(entry.lat), gen = lower(parts(entry.info)[0] || '');
    var g = /2n|3n|4n/.test(t) ? 'n' : (/1f|3f|5f/.test(t) ? 'f' : (/m\/f/.test(t) ? 'c' : 'm'));
    var decl, stem = null, nomSg = lat, pluralOnly = false;

    if (/noun 1/.test(t)) { decl = 'd1'; stem = gen.replace(/ae$/, ''); }
    else if (/noun 2n/.test(t)) { decl = 'd2n'; stem = gen.replace(/i$/, ''); }
    else if (/noun 2/.test(t)) {
      stem = gen.replace(/i$/, '');
      decl = /us$/.test(lat) ? 'd2m' : 'd2er';
    }
    else if (/noun 3n/.test(t)) { decl = 'd3n'; stem = gen.replace(/is$/, ''); }
    else if (/noun 3/.test(t)) { decl = 'd3c'; stem = gen.replace(/is$/, ''); }
    else if (/noun 4n/.test(t)) { decl = 'd4n'; stem = gen.replace(/us$/, ''); }
    else if (/noun 4/.test(t)) { decl = 'd4m'; stem = gen.replace(/us$/, ''); }
    else if (/noun 5/.test(t)) { decl = 'd5'; stem = gen.replace(/ei$/, ''); }
    else { decl = null; }

    // plural-only nouns (arma, copiae, liberi) are given with a genitive plural
    if (/arum$|orum$/.test(gen)) {
      pluralOnly = true;
      if (/arum$/.test(gen)) { decl = 'd1'; stem = gen.replace(/arum$/, ''); }
      else { decl = /2n/.test(t) ? 'd2n' : 'd2m'; stem = gen.replace(/orum$/, ''); }
    }
    return { decl: decl, stem: stem, gender: g, nomSg: nomSg, pluralOnly: pluralOnly };
  }

  function classifyVerb(entry) {
    var t = entry.type, lat = lower(entry.lat), p = parts(entry.info);
    var inf = lower(p[0] || '').replace(/\s*\(.*$/, '');
    var perf1 = lower(p[1] || '').replace(/\s*\(.*$/, '');
    var ppp = lower(p[2] || '').replace(/\s*\(.*$/, '');
    if (IRREG_VERBS[lat]) return { conj: 'irreg', irreg: lat, inf: inf, ppp: ppp };
    var conj = null, presStem = null;
    if (/verb 1/.test(t)) { conj = 1; presStem = inf.replace(/re$/, ''); }
    else if (/verb 2/.test(t)) { conj = 2; presStem = inf.replace(/re$/, ''); }
    else if (/verb 3/.test(t)) { conj = 3; presStem = inf.replace(/ere$/, ''); }
    else if (/verb 4/.test(t)) { conj = 4; presStem = inf.replace(/re$/, ''); }
    else if (/verb 5|mixed/.test(t)) { conj = 5; presStem = inf.replace(/ere$/, 'i'); }
    var perfStem = perf1 ? perf1.replace(/i$/, '') : null;
    return { conj: conj, presStem: presStem, perfStem: perfStem, inf: inf, ppp: ppp, irreg: null };
  }

  function classifyAdj(entry) {
    var lat = lower(entry.lat), p = parts(entry.info);
    var fem = lower(p[0] || '');
    if (/adjective 2-1-2/.test(entry.type)) {
      var stem = fem ? fem.replace(/a$/, '') : lat.replace(/us$/, '');
      return { kind: '212', stem: stem, erType: !/us$/.test(lat), nomSgM: lat };
    }
    /* 3rd declension adjectives come in three shapes, and the word list
       gives each differently:
         three terminations — celer | celeris, celere
         two terminations   — fortis | forte        (lemma ends -is)
         one termination    — ingens | ingentis     (info is the genitive) */
    var stem, neutNom;
    if (p.length >= 2) {                      // celer, celeris, celere
      stem = lower(p[0]).replace(/is$/, '');
      neutNom = lower(p[1]);
    } else if (/e$/.test(lower(p[0] || ''))) { // fortis, forte
      stem = lat.replace(/is$/, '');
      neutNom = lower(p[0]);
    } else if (/is$/.test(lower(p[0] || ''))) { // ingens, ingentis
      stem = lower(p[0]).replace(/is$/, '');
      neutNom = lat;
    } else {
      stem = lat.replace(/is$/, '');
      neutNom = lat;
    }
    return { kind: '3rd', stem: stem, nomSgM: lat, neutNom: neutNom };
  }

  /* ---------- form generation ---------- */

  function nounForms(lex) {
    var out = [], c = lex.noun, E = NOUN_ENDINGS[c.decl];
    if (!E || c.stem == null) return out;
    var nums = c.pluralOnly ? ['pl'] : ['sg', 'pl'];
    nums.forEach(function (n) {
      E[n].forEach(function (end, i) {
        var form;
        if (end === null) {
          // nom/voc/acc supplied by the lemma itself (2nd -er, 3rd decl)
          if (c.decl === 'd3n' && i === 2) form = c.nomSg; // neuter acc = nom
          else form = c.nomSg;
        } else {
          form = c.stem + end;
        }
        if (!form) return;
        out.push({ form: form, tags: { pos: 'noun', 'case': CASES[i], num: n === 'sg' ? 's' : 'p', gender: c.gender } });
      });
    });
    // -ius / -ium nouns: contracted vocative/genitive variants seen in texts
    if (/i$/.test(c.stem) && c.decl === 'd2m') {
      out.push({ form: c.stem, tags: { pos: 'noun', 'case': 'voc', num: 's', gender: c.gender } });
    }
    if (lex.lat === 'deus') {
      ['dii', 'di'].forEach(function (f) {
        out.push({ form: f, tags: { pos: 'noun', 'case': 'nom', num: 'p', gender: 'm' } });
        out.push({ form: f, tags: { pos: 'noun', 'case': 'voc', num: 'p', gender: 'm' } });
      });
      ['diis', 'dis'].forEach(function (f) {
        out.push({ form: f, tags: { pos: 'noun', 'case': 'dat', num: 'p', gender: 'm' } });
        out.push({ form: f, tags: { pos: 'noun', 'case': 'abl', num: 'p', gender: 'm' } });
      });
    }
    return out;
  }

  function adjForms(lex) {
    var out = [], a = lex.adj;
    if (a.kind === '212') {
      var map = { m: 'd2m', f: 'd1', n: 'd2n' };
      ['m', 'f', 'n'].forEach(function (g) {
        var E = NOUN_ENDINGS[map[g]];
        ['sg', 'pl'].forEach(function (n) {
          E[n].forEach(function (end, i) {
            var form = a.stem + end;
            if (g === 'm' && n === 'sg' && i === 0 && a.erType) form = a.nomSgM;
            if (g === 'm' && n === 'sg' && i === 1 && a.erType) form = a.nomSgM;
            out.push({ form: form, tags: { pos: 'adj', 'case': CASES[i], num: n === 'sg' ? 's' : 'p', gender: g } });
          });
        });
      });
    } else {
      // 3rd declension adjective (L2+)
      var sgMF = { nom: a.nomSgM, voc: a.nomSgM, acc: a.stem + 'em', gen: a.stem + 'is', dat: a.stem + 'i', abl: a.stem + 'i' };
      var sgN = { nom: a.neutNom, voc: a.neutNom, acc: a.neutNom, gen: a.stem + 'is', dat: a.stem + 'i', abl: a.stem + 'i' };
      var plMF = { nom: a.stem + 'es', voc: a.stem + 'es', acc: a.stem + 'es', gen: a.stem + 'ium', dat: a.stem + 'ibus', abl: a.stem + 'ibus' };
      var plN = { nom: a.stem + 'ia', voc: a.stem + 'ia', acc: a.stem + 'ia', gen: a.stem + 'ium', dat: a.stem + 'ibus', abl: a.stem + 'ibus' };
      CASES.forEach(function (cs) {
        ['m', 'f'].forEach(function (g) {
          out.push({ form: sgMF[cs], tags: { pos: 'adj', 'case': cs, num: 's', gender: g } });
          out.push({ form: plMF[cs], tags: { pos: 'adj', 'case': cs, num: 'p', gender: g } });
        });
        out.push({ form: sgN[cs], tags: { pos: 'adj', 'case': cs, num: 's', gender: 'n' } });
        out.push({ form: plN[cs], tags: { pos: 'adj', 'case': cs, num: 'p', gender: 'n' } });
      });
    }
    return out;
  }

  function verbForms(lex, scope) {
    var out = [], v = lex.verb;
    var allowFuture = scope && scope.future;
    var allowPlupf = scope && scope.pluperfect;
    var allowPassive = scope && scope.passive;

    function push(form, tags) { if (form) out.push({ form: form, tags: tags }); }

    if (v.irreg) {
      var I = IRREG_VERBS[v.irreg];
      ['pres', 'impf', 'perf'].forEach(function (t) {
        (I[t] || []).forEach(function (f, i) {
          push(f, { pos: 'verb', tense: t, person: PERSONS[i][0], num: PERSONS[i][1], mood: 'ind', voice: 'act' });
        });
      });
      if (allowFuture) (I.fut || []).forEach(function (f, i) {
        push(f, { pos: 'verb', tense: 'fut', person: PERSONS[i][0], num: PERSONS[i][1], mood: 'ind', voice: 'act' });
      });
      if (allowPlupf) (I.plupf || []).forEach(function (f, i) {
        push(f, { pos: 'verb', tense: 'plupf', person: PERSONS[i][0], num: PERSONS[i][1], mood: 'ind', voice: 'act' });
      });
      push(I.inf, { pos: 'verb', tense: 'pres', mood: 'inf', voice: 'act' });
      if (I.imp) {
        push(I.imp[0], { pos: 'verb', mood: 'imp', num: 's', voice: 'act' });
        push(I.imp[1], { pos: 'verb', mood: 'imp', num: 'p', voice: 'act' });
      }
      return out;
    }

    var ps = v.presStem, pf = v.perfStem, c = v.conj;
    if (!ps || !c) return out;

    // present indicative active
    PERSONS.forEach(function (p, i) {
      var f;
      if (c === 1) f = (i === 0) ? ps.replace(/a$/, '') + 'o' : ps + PRES_ACT[i];
      else if (c === 2) f = ps + PRES_ACT[i];
      else if (c === 3) f = (i === 0) ? ps + 'o' : ps + (i === 5 ? 'unt' : (i === 1 ? 'is' : i === 2 ? 'it' : i === 3 ? 'imus' : 'itis'));
      else if (c === 4) f = (i === 5) ? ps + 'unt' : ps + PRES_ACT[i];
      else if (c === 5) f = (i === 5) ? ps + 'unt' : ps + PRES_ACT[i];
      push(f, { pos: 'verb', tense: 'pres', person: p[0], num: p[1], mood: 'ind', voice: 'act' });
    });

    // imperfect indicative active
    // 3rd, 4th and mixed conjugations insert -e- before the -ba- tense sign
    // (regebat, audiebat, capiebat); 1st and 2nd do not (amabat, monebat).
    var impfStem = (c === 3 || c === 4 || c === 5) ? ps + 'e' : ps;
    PERSONS.forEach(function (p, i) {
      push(impfStem + IMPF_ACT[i], { pos: 'verb', tense: 'impf', person: p[0], num: p[1], mood: 'ind', voice: 'act' });
    });

    // perfect indicative active
    if (pf) {
      PERSONS.forEach(function (p, i) {
        push(pf + PERF_ACT[i], { pos: 'verb', tense: 'perf', person: p[0], num: p[1], mood: 'ind', voice: 'act' });
      });
      push(pf + PERF_ACT_ALT['3p'], { pos: 'verb', tense: 'perf', person: '3', num: 'p', mood: 'ind', voice: 'act' });
    }

    // future (L2)
    if (allowFuture) {
      PERSONS.forEach(function (p, i) {
        var f;
        if (c === 1 || c === 2) f = ps + ['bo', 'bis', 'bit', 'bimus', 'bitis', 'bunt'][i];
        else f = ps + ['am', 'es', 'et', 'emus', 'etis', 'ent'][i];
        push(f, { pos: 'verb', tense: 'fut', person: p[0], num: p[1], mood: 'ind', voice: 'act' });
      });
    }
    // pluperfect (L2)
    if (allowPlupf && pf) {
      PERSONS.forEach(function (p, i) {
        push(pf + PLUPF_ACT[i], { pos: 'verb', tense: 'plupf', person: p[0], num: p[1], mood: 'ind', voice: 'act' });
      });
      PERSONS.forEach(function (p, i) {
        push(pf + FUTPERF_ACT[i], { pos: 'verb', tense: 'futperf', person: p[0], num: p[1], mood: 'ind', voice: 'act' });
      });
    }
    // present/imperfect passive (L2)
    if (allowPassive) {
      PERSONS.forEach(function (p, i) {
        var f;
        if (c === 1) f = (i === 0) ? ps.replace(/a$/, '') + 'or' : ps + PRES_PASS[i];
        else if (c === 2) f = ps + PRES_PASS[i];
        else if (c === 3) f = (i === 0) ? ps + 'or' : ps + ['', 'eris', 'itur', 'imur', 'imini', 'untur'][i];
        else f = (i === 5) ? ps + 'untur' : ps + PRES_PASS[i];
        push(f, { pos: 'verb', tense: 'pres', person: p[0], num: p[1], mood: 'ind', voice: 'pass' });
      });
      PERSONS.forEach(function (p, i) {
        push(impfStem + IMPF_PASS[i], { pos: 'verb', tense: 'impf', person: p[0], num: p[1], mood: 'ind', voice: 'pass' });
      });
    }

    // present infinitive active
    push(v.inf, { pos: 'verb', tense: 'pres', mood: 'inf', voice: 'act' });

    // imperatives
    var impSg, impPl;
    if (c === 1) { impSg = ps; impPl = ps + 'te'; }
    else if (c === 2) { impSg = ps; impPl = ps + 'te'; }
    else if (c === 3) { impSg = ps + 'e'; impPl = ps + 'ite'; }
    else if (c === 4) { impSg = ps; impPl = ps + 'te'; }
    else if (c === 5) { impSg = ps.replace(/i$/, 'e'); impPl = ps + 'te'; }
    if (IRREG_IMP[lex.lat]) impSg = IRREG_IMP[lex.lat];
    push(impSg, { pos: 'verb', mood: 'imp', num: 's', voice: 'act' });
    push(impPl, { pos: 'verb', mood: 'imp', num: 'p', voice: 'act' });

    return out;
  }

  function pronounForms(lex) {
    var out = [], P = PRONOUNS[lex.lat];
    if (!P) return out;
    Object.keys(P.forms).forEach(function (k) {
      var bits = k.split('-');
      out.push({
        form: P.forms[k],
        tags: { pos: 'pronoun', 'case': bits[0], num: bits[1], person: P.person[0], inL1: !!PRONOUN_L1_CASES[bits[0]] }
      });
    });
    return out;
  }

  function numeralForms(lex) {
    var out = [], D = NUM_DECL[lex.lat];
    if (!D) {
      out.push({ form: lower(lex.lat), tags: { pos: 'numeral', indecl: true } });
      return out;
    }
    ['m', 'f', 'n'].forEach(function (g) {
      D[g].forEach(function (f, i) {
        out.push({ form: f, tags: { pos: 'numeral', 'case': CASES[i], num: D.num, gender: g } });
      });
    });
    return out;
  }

  /* ============================================================
     LEXICON + INDEX
     ============================================================ */

  function buildLexicon(vocab, levels, scope) {
    var lex = [], index = {};
    var allowed = {};
    (levels || ['L1']).forEach(function (l) { allowed[l] = 1; });

    vocab.forEach(function (e, n) {
      if (!allowed[e.level]) return;
      var t = e.type;
      var item = {
        id: n, lat: lower(e.lat), display: e.lat, info: e.info,
        eng: e.eng, type: t, level: e.level, pos: null
      };
      if (/^noun/.test(t)) { item.pos = 'noun'; item.noun = classifyNoun(e); }
      else if (/^verb/.test(t)) { item.pos = 'verb'; item.verb = classifyVerb(e); }
      else if (/^adjective/.test(t)) { item.pos = 'adj'; item.adj = classifyAdj(e); }
      else if (/^preposition/.test(t)) {
        item.pos = 'prep';
        item.prepCase = /ablative/i.test(e.info) ? 'abl' : 'acc';
      }
      else if (/^adverb/.test(t)) item.pos = 'adv';
      else if (/^conjunction/.test(t)) item.pos = 'conj';
      else if (/^pronoun/.test(t)) { item.pos = 'pronoun'; }
      else if (/^cardinal|ordinal/.test(t)) item.pos = 'numeral';
      else if (/question word/.test(t)) item.pos = 'question';
      else item.pos = 'other';
      lex.push(item);
    });

    function add(form, item, tags) {
      if (!form) return;
      var k = key(form);
      if (!k) return;
      (index[k] = index[k] || []).push({ lex: item, form: lower(form), tags: tags });
    }

    lex.forEach(function (item) {
      var fs = [];
      if (item.pos === 'noun') fs = nounForms(item);
      else if (item.pos === 'verb') fs = verbForms(item, scope || {});
      else if (item.pos === 'adj') fs = adjForms(item);
      else if (item.pos === 'pronoun') fs = pronounForms(item);
      else if (item.pos === 'numeral') fs = numeralForms(item);
      else {
        // invariable words. a/ab and e/ex are alternates on one entry.
        lower(item.lat).replace(/\?$/, '').split('/').forEach(function (v) {
          fs.push({ form: v.trim(), tags: { pos: item.pos, indecl: true } });
        });
      }
      item.forms = fs;
      fs.forEach(function (f) { add(f.form, item, f.tags); });
    });

    return { entries: lex, index: index };
  }

  /* ---------- analysis ---------- */

  function analyse(lexicon, word) {
    var raw = lower(word).replace(/[^a-zà-ſA-Z-]/g, '');
    if (!raw) return { word: word, readings: [], unknown: true };
    var k = key(raw);
    var hits = (lexicon.index[k] || []).slice();
    var enclitic = null;

    // enclitic -ne (direct question particle)
    if (!hits.length && /ne$/.test(k) && k.length > 3) {
      var base = k.replace(/ne$/, '');
      var h2 = lexicon.index[base] || [];
      if (h2.length) { hits = h2.slice(); enclitic = 'ne'; }
    }
    // enclitic -que
    if (!hits.length && /que$/.test(k) && k.length > 4) {
      var b3 = k.replace(/que$/, '');
      var h3 = lexicon.index[b3] || [];
      if (h3.length) { hits = h3.slice(); enclitic = 'que'; }
    }

    return {
      word: raw,
      enclitic: enclitic,
      unknown: hits.length === 0,
      readings: hits.map(function (h) {
        return { lemma: h.lex.lat, display: h.lex.display, eng: h.lex.eng, type: h.lex.type, level: h.lex.level, lex: h.lex, tags: h.tags, form: h.form };
      })
    };
  }

  /* ---------- paradigm tables, for the "show the table" hint ---------- */

  function paradigm(lexItem) {
    if (!lexItem) return null;
    if (lexItem.pos === 'noun') {
      var rows = [];
      CASES.forEach(function (cs) {
        var sg = null, pl = null;
        lexItem.forms.forEach(function (f) {
          if (f.tags['case'] === cs && f.tags.num === 's' && !sg) sg = f.form;
          if (f.tags['case'] === cs && f.tags.num === 'p' && !pl) pl = f.form;
        });
        rows.push({ label: cs, sg: sg, pl: pl });
      });
      return { kind: 'noun', title: lexItem.display + ', ' + lexItem.info, rows: rows };
    }
    if (lexItem.pos === 'verb') {
      var tenses = ['pres', 'impf', 'perf'];
      var cols = {};
      tenses.forEach(function (t) { cols[t] = {}; });
      lexItem.forms.forEach(function (f) {
        if (f.tags.mood !== 'ind' || f.tags.voice !== 'act') return;
        if (!cols[f.tags.tense]) return;
        var kk = f.tags.person + f.tags.num;
        if (!cols[f.tags.tense][kk]) cols[f.tags.tense][kk] = f.form;
      });
      var prows = PERSONS.map(function (p) {
        return {
          label: ({ '1s': 'I', '2s': 'you (sg)', '3s': 'he/she/it', '1p': 'we', '2p': 'you (pl)', '3p': 'they' })[p],
          pres: cols.pres[p[0] + p[1]], impf: cols.impf[p[0] + p[1]], perf: cols.perf[p[0] + p[1]]
        };
      });
      return { kind: 'verb', title: lexItem.display + ', ' + lexItem.info, rows: prows };
    }
    if (lexItem.pos === 'adj') {
      var arows = [];
      CASES.forEach(function (cs) {
        var r = { label: cs };
        ['m', 'f', 'n'].forEach(function (g) {
          ['s', 'p'].forEach(function (n) {
            var got = null;
            lexItem.forms.forEach(function (f) {
              if (f.tags['case'] === cs && f.tags.num === n && f.tags.gender === g && !got) got = f.form;
            });
            r[g + n] = got;
          });
        });
        arows.push(r);
      });
      return { kind: 'adj', title: lexItem.display + ', ' + lexItem.info, rows: arows };
    }
    return null;
  }

  var API = {
    CASES: CASES, PERSONS: PERSONS,
    buildLexicon: buildLexicon,
    analyse: analyse,
    paradigm: paradigm,
    key: key,
    IRREG_VERBS: IRREG_VERBS
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Morph = API;
})(typeof window !== 'undefined' ? window : this);
