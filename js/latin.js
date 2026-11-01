/* ============================================================
   latin.js — English into Latin
   Reads a controlled English sentence built from CE vocabulary,
   works out the Latin it requires, and questions the pupil
   through the choices: which word, what job, which case, which
   ending. The final Latin is checked by parsing it, so word
   order stays free, as Latin word order is.
   ============================================================ */
(function (root) {
  'use strict';

  var Morph = (typeof require !== 'undefined') ? require('./morph.js') : root.Morph;
  var Parse = (typeof require !== 'undefined') ? require('./parse.js') : root.Parse;
  var Eng = (typeof require !== 'undefined') ? require('./english.js') : root.Eng;

  var ARTICLES = { 'the': 1, 'a': 1, 'an': 1, 'some': 1 };
  var CASE_FULL = {
    nom: 'nominative', voc: 'vocative', acc: 'accusative',
    gen: 'genitive', dat: 'dative', abl: 'ablative'
  };
  var TENSE_FULL = { pres: 'present', impf: 'imperfect', perf: 'perfect', fut: 'future', plupf: 'pluperfect' };
  var PERSON_FULL = {
    '1s': 'I', '2s': 'you (singular)', '3s': 'he, she or it',
    '1p': 'we', '2p': 'you (plural)', '3p': 'they'
  };

  /* English preposition → Latin preposition and the case it takes */
  var PREP_MAP = {
    'into': ['in', 'acc'], 'onto': ['in', 'acc'],
    'in': ['in', 'abl'], 'on': ['in', 'abl'],
    'to': ['ad', 'acc'], 'towards': ['ad', 'acc'], 'toward': ['ad', 'acc'],
    'from': ['a/ab', 'abl'], 'away from': ['a/ab', 'abl'], 'by': ['a/ab', 'abl'],
    'out of': ['e/ex', 'abl'], 'down from': ['de', 'abl'], 'about': ['de', 'abl'],
    'with': ['cum', 'abl'],
    'through': ['per', 'acc'], 'along': ['per', 'acc'],
    'near': ['prope', 'acc'], 'across': ['trans', 'acc'], 'against': ['contra', 'acc']
  };
  var MULTIWORD_PREPS = ['away from', 'out of', 'down from'];

  /* Latin usually puts a descriptive adjective after its noun (servum
     iratum). Quantity, size and number come first (multi libri, unus
     servus), which is also how Bass sets them out. */
  var ADJ_FIRST = {
    'multus': 1, 'magnus': 1, 'parvus': 1, 'unus': 1, 'duo': 1, 'tres': 1,
    'primus': 1, 'secundus': 1, 'tertius': 1, 'quartus': 1, 'quintus': 1,
    'sextus': 1, 'septimus': 1, 'octavus': 1, 'nonus': 1, 'decimus': 1,
    'omnis': 1, 'totus': 1
  };

  var SUBJ_PRON = {
    'i': '1s', 'we': '1p', 'you': '2s', 'he': '3s', 'she': '3s', 'it': '3s', 'they': '3p'
  };
  var OBJ_PRON = { 'me': ['ego', 's'], 'us': ['nos', 'p'], 'you': ['tu', 's'] };

  function norm(s) {
    return String(s || '').toLowerCase().replace(/[’']/g, "'")
      .replace(/[^a-z0-9'\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /* ============================================================
     reverse index: English → lexicon entries
     ============================================================ */
  function buildReverse(lexicon) {
    var idx = {};
    function add(text, entry, kind) {
      var k = norm(text);
      if (!k) return;
      (idx[k] = idx[k] || []).push({ entry: entry, kind: kind, gloss: text });
    }
    lexicon.entries.forEach(function (e) {
      var fake = { lemma: e.lat, eng: e.eng, display: e.display, lex: e, tags: {} };
      var glosses = Eng.glossesFor(fake);
      glosses.forEach(function (g) {
        if (e.pos === 'verb') {
          var st = Eng.verbStem(g);
          add(st, e, 'verb');
          add(Eng.v3s(st), e, 'verb');
          add(Eng.ving(st), e, 'verb');
          add(Eng.vpast(st, false), e, 'verb');
          add(Eng.vpp(st), e, 'verb');
        } else if (e.pos === 'noun') {
          add(g, e, 'noun');
          add(Eng.pluraliseWord(g), e, 'noun');
        } else if (e.pos === 'adj') {
          add(g, e, 'adj');
        } else if (e.pos === 'adv') {
          add(g, e, 'adv');
        } else if (e.pos === 'conj') {
          add(g, e, 'conj');
        }
      });
    });
    return idx;
  }

  function look(idx, words, kind) {
    // try the longest phrase first: "country house", "look at"
    for (var n = Math.min(3, words.length); n >= 1; n--) {
      var phrase = words.slice(0, n).join(' ');
      var hits = (idx[norm(phrase)] || []).filter(function (h) { return !kind || h.kind === kind; });
      if (hits.length) return { hits: hits, used: n, phrase: phrase };
    }
    return null;
  }

  /* ============================================================
     parse a controlled English sentence
     ============================================================ */
  function parseEnglish(lexicon, revIdx, text) {
    var toks = norm(text).split(' ').filter(Boolean);
    if (!toks.length) return { ok: false, error: 'Type an English sentence.' };

    var i = 0, plan = { subject: null, verb: null, object: null, preps: [], dative: null, genitive: null, adverbs: [], unknown: [] };

    /* ---- find the verb phrase anywhere in the sentence ---- */
    var vb = null;
    for (var s = 0; s < toks.length && !vb; s++) {
      var rest = toks.slice(s);
      var w = rest[0];

      /* auxiliary patterns */
      if (/^(was|were)$/.test(w) && rest.length > 1) {
        var h = look(revIdx, rest.slice(1), 'verb');
        if (h) {
          var isIng = /ing$/.test(rest[1]);
          vb = { at: s, len: 1 + h.used, tense: 'impf', entry: h.hits[0].entry, plural: w === 'were', cont: isIng };
        }
      } else if (/^(used)$/.test(w) && rest[1] === 'to') {
        var h2 = look(revIdx, rest.slice(2), 'verb');
        if (h2) vb = { at: s, len: 2 + h2.used, tense: 'impf', entry: h2.hits[0].entry };
      } else if (/^(has|have)$/.test(w) && rest.length > 1) {
        var h3 = look(revIdx, rest.slice(1), 'verb');
        if (h3) vb = { at: s, len: 1 + h3.used, tense: 'perf', entry: h3.hits[0].entry };
      } else if (/^(did|do|does)$/.test(w) && rest.length > 1) {
        var h4 = look(revIdx, rest.slice(1), 'verb');
        if (h4) vb = { at: s, len: 1 + h4.used, tense: w === 'did' ? 'perf' : 'pres', entry: h4.hits[0].entry };
      } else if (/^(is|are|am)$/.test(w) && rest.length > 1 && /ing$/.test(rest[1])) {
        var h5 = look(revIdx, rest.slice(1), 'verb');
        if (h5) vb = { at: s, len: 1 + h5.used, tense: 'pres', entry: h5.hits[0].entry };
      } else if (/^(will|shall)$/.test(w) && rest.length > 1) {
        var h6 = look(revIdx, rest.slice(1), 'verb');
        if (h6) vb = { at: s, len: 1 + h6.used, tense: 'fut', entry: h6.hits[0].entry, outOfScope: 'the future tense' };
      } else if (/^(began|started)$/.test(w) && rest[1] === 'to') {
        var h7 = look(revIdx, rest.slice(2), 'verb');
        if (h7) vb = { at: s, len: 2 + h7.used, tense: 'impf', entry: h7.hits[0].entry };
      } else if (/^(is|are|am|was|were)$/.test(w)) {
        // the verb "to be" on its own
        var sumE = null;
        lexicon.entries.forEach(function (e) { if (e.lat === 'sum') sumE = e; });
        if (sumE) vb = { at: s, len: 1, tense: /^(was|were)$/.test(w) ? 'impf' : 'pres', entry: sumE, plural: /^(were|are)$/.test(w), copula: true };
      } else {
        var h8 = look(revIdx, rest, 'verb');
        if (h8) {
          var form = h8.phrase;
          var ent = h8.hits[0].entry;
          var tense = 'pres';
          // a simple past form means the perfect
          var stems = Eng.glossesFor({ lemma: ent.lat, eng: ent.eng, display: ent.display, lex: ent, tags: {} }).map(Eng.verbStem);
          var isPast = stems.some(function (st) { return norm(Eng.vpast(st, false)) === norm(form) && norm(st) !== norm(form); });
          var isBase = stems.some(function (st) { return norm(st) === norm(form) || norm(Eng.v3s(st)) === norm(form); });
          if (isPast && !isBase) tense = 'perf';
          vb = { at: s, len: h8.used, tense: tense, entry: ent, third: stems.some(function (st) { return norm(Eng.v3s(st)) === norm(form); }) };
        }
      }
    }
    if (!vb) {
      return { ok: false, error: 'No verb recognised. Use a verb from the Common Entrance list.' };
    }

    /* ---- noun phrase reader ---- */
    function readNP(list, start) {
      var j = start, adjs = [], det = null;
      while (j < list.length && ARTICLES[list[j]]) { det = list[j]; j++; }
      // adjectives before the noun
      var guard = 0;
      while (j < list.length && guard++ < 4) {
        var ha = look(revIdx, list.slice(j), 'adj');
        var hn = look(revIdx, list.slice(j), 'noun');
        if (ha && !hn) { adjs.push({ entry: ha.hits[0].entry, words: ha.phrase }); j += ha.used; continue; }
        break;
      }
      var hNoun = look(revIdx, list.slice(j), 'noun');
      if (!hNoun) {
        // a pronoun?
        var pw = list[j];
        if (pw && (SUBJ_PRON[pw] || OBJ_PRON[pw])) {
          return { kind: 'pronoun', word: pw, adjs: adjs, end: j + 1, text: list.slice(start, j + 1).join(' ') };
        }
        // an adjective used as a noun
        if (adjs.length) {
          var last = adjs.pop();
          return { kind: 'adjAsNoun', entry: last.entry, adjs: adjs, end: j, plural: false, det: det, text: list.slice(start, j).join(' ') };
        }
        return null;
      }
      var nounWord = hNoun.phrase, entry = hNoun.hits[0].entry;
      var plural = isPluralForm(entry, nounWord);
      return {
        kind: 'noun', entry: entry, adjs: adjs, plural: plural, det: det,
        end: j + hNoun.used, text: list.slice(start, j + hNoun.used).join(' ')
      };
    }

    function isPluralForm(entry, word) {
      var fake = { lemma: entry.lat, eng: entry.eng, display: entry.display, lex: entry, tags: {} };
      var gl = Eng.glossesFor(fake);
      var sing = gl.some(function (g) { return norm(g) === norm(word); });
      var plur = gl.some(function (g) { return norm(Eng.pluraliseWord(g)) === norm(word); });
      if (plur && !sing) return true;
      if (sing) return false;
      return false;
    }

    /* ---- before the verb: the subject ---- */
    var before = toks.slice(0, vb.at);
    if (before.length) {
      var np = readNP(before, 0);
      if (np) {
        plan.subject = np;
        /* "the son of the master wrote ..." — the genitive sits in front of
           the verb, attached to the subject */
        var tail = before.slice(np.end);
        if (tail.length && tail[0] === 'of') {
          var npG0 = readNP(tail, 1);
          if (npG0) plan.genitive = npG0;
          else plan.unknown.push(tail.join(' '));
        } else if (tail.length) {
          plan.unknown.push(tail.join(' '));
        }
      } else plan.unknown.push(before.join(' '));
    }

    /* ---- after the verb ---- */
    var after = toks.slice(vb.at + vb.len);
    var k = 0, loops = 0;
    while (k < after.length && loops++ < 12) {
      var w2 = after[k];
      if (ARTICLES[w2] && k + 1 >= after.length) { k++; continue; }

      /* a preposition? check two-word ones first */
      var prepKey = null, prepLen = 0;
      for (var m = 0; m < MULTIWORD_PREPS.length; m++) {
        var mp = MULTIWORD_PREPS[m].split(' ');
        if (after.slice(k, k + mp.length).join(' ') === MULTIWORD_PREPS[m]) { prepKey = MULTIWORD_PREPS[m]; prepLen = mp.length; break; }
      }
      if (!prepKey && PREP_MAP[w2]) { prepKey = w2; prepLen = 1; }

      if (prepKey) {
        var spec = PREP_MAP[prepKey];
        var npP = readNP(after, k + prepLen);
        if (!npP) { plan.unknown.push(after.slice(k).join(' ')); break; }
        /* "to the slaves" after a giving verb is the dative, not ad */
        var dativeVerb = /^(do|dico|ostendo|respondeo)$/.test(vb.entry.lat);
        if ((prepKey === 'to' || prepKey === 'for') && dativeVerb && !plan.dative) {
          plan.dative = npP;
        } else {
          plan.preps.push({ prep: spec[0], 'case': spec[1], english: prepKey, np: npP });
        }
        k = npP.end;
        continue;
      }

      /* "of the master" → genitive */
      if (w2 === 'of') {
        var npG = readNP(after, k + 1);
        if (npG) { plan.genitive = npG; k = npG.end; continue; }
      }

      /* an adverb? */
      var hAdv = look(revIdx, after.slice(k), 'adv');
      if (hAdv) { plan.adverbs.push({ entry: hAdv.hits[0].entry, text: hAdv.phrase }); k += hAdv.used; continue; }

      /* otherwise a noun phrase: the object, or the complement after "to be" */
      var npO = readNP(after, k);
      if (npO) {
        if (!plan.object) plan.object = npO;
        else plan.preps.push({ prep: null, 'case': 'acc', english: null, np: npO });
        k = npO.end;
        continue;
      }

      /* possessive: "the master's son" handled as genitive */
      if (/'s$/.test(w2)) {
        var bare = w2.replace(/'s$/, '');
        var hP = look(revIdx, [bare], 'noun');
        if (hP) {
          plan.genitive = { kind: 'noun', entry: hP.hits[0].entry, adjs: [], plural: false, end: k + 1, text: w2 };
          k++; continue;
        }
      }

      plan.unknown.push(w2);
      k++;
    }

    /* a possessive before the verb: "the master's son wrote" */
    if (!plan.genitive && before.length) {
      for (var b = 0; b < before.length; b++) {
        if (/'s$/.test(before[b])) {
          var bare2 = before[b].replace(/'s$/, '');
          var hB = look(revIdx, [bare2], 'noun');
          if (hB) {
            plan.genitive = { kind: 'noun', entry: hB.hits[0].entry, adjs: [], plural: false, end: b + 1, text: before[b] };
            var rest2 = before.slice(b + 1);
            var npS = readNP(rest2, 0);
            if (npS) plan.subject = npS;
          }
        }
      }
    }

    /* ---- person and number of the verb ---- */
    var person = '3', number = 's';
    if (plan.subject) {
      if (plan.subject.kind === 'pronoun') {
        var pk = SUBJ_PRON[plan.subject.word] || '3s';
        person = pk[0]; number = pk[1];
      } else {
        person = '3'; number = plan.subject.plural ? 'p' : 's';
      }
    } else if (vb.plural) { number = 'p'; }

    plan.verb = {
      entry: vb.entry, tense: vb.tense, person: person, num: number,
      copula: !!vb.copula, outOfScope: vb.outOfScope || null,
      english: toks.slice(vb.at, vb.at + vb.len).join(' ')
    };

    if (plan.unknown.length) {
      return { ok: false, error: 'Not recognised: ' + plan.unknown.join(', ') + '. Use words from the Common Entrance list.', plan: plan };
    }
    return { ok: true, plan: plan, tokens: toks };
  }

  /* ============================================================
     the Latin the plan requires
     ============================================================ */
  function formOf(lexicon, entry, want) {
    var best = null;
    (entry.forms || []).forEach(function (f) {
      if (best) return;
      var t = f.tags, ok = true;
      Object.keys(want).forEach(function (kk) {
        if (String(t[kk]) !== String(want[kk])) ok = false;
      });
      if (ok) best = f.form;
    });
    return best;
  }

  function genderOf(entry) {
    if (entry.pos !== 'noun' || !entry.noun) return 'm';
    return entry.noun.gender === 'c' ? 'm' : entry.noun.gender;
  }

  function buildTarget(lexicon, plan) {
    var pieces = [];

    function nominal(np, cs, label) {
      if (!np) return null;
      if (np.kind === 'pronoun') {
        var pr = SUBJ_PRON[np.word];
        var lemma = null;
        if (cs === 'nom') lemma = { 'i': 'ego', 'we': 'nos', 'you': 'tu', 'he': null, 'she': null, 'it': null, 'they': null }[np.word];
        else { var o = OBJ_PRON[np.word]; lemma = o ? o[0] : null; }
        if (!lemma) return null; // he/she/it/they live in the verb ending
        var pe = null;
        lexicon.entries.forEach(function (e) { if (e.lat === lemma) pe = e; });
        if (!pe) return null;
        /* ego, nos, tu and vos as subjects are optional in Latin — the verb
           ending already carries the person. Required as an object. */
        return {
          label: label, english: np.text, entry: pe, 'case': cs,
          num: /^(we|they)$/.test(np.word) ? 'p' : 's',
          form: formOf(lexicon, pe, { 'case': cs }),
          optional: cs === 'nom'
        };
      }
      var entry = np.entry, num = np.plural ? 'p' : 's', g = genderOf(entry);
      var form = formOf(lexicon, entry, { 'case': cs, num: num });
      var adjs = (np.adjs || []).map(function (a) {
        return {
          entry: a.entry, english: a.words,
          form: formOf(lexicon, a.entry, { 'case': cs, num: num, gender: g }),
          'case': cs, num: num, gender: g
        };
      });
      return { label: label, english: np.text, entry: entry, 'case': cs, num: num, gender: g, form: form, adjs: adjs };
    }

    var subj = nominal(plan.subject, 'nom', 'subject');
    var obj = nominal(plan.object, plan.verb.copula ? 'nom' : 'acc', plan.verb.copula ? 'complement' : 'object');
    var dat = nominal(plan.dative, 'dat', 'dative');
    var gen = nominal(plan.genitive, 'gen', 'genitive');

    var V = plan.verb;
    var vform = formOf(lexicon, V.entry, { tense: V.tense, person: V.person, num: V.num, mood: 'ind', voice: 'act' });

    var preps = plan.preps.map(function (p) {
      var pe = null;
      lexicon.entries.forEach(function (e) { if (e.pos === 'prep' && e.lat === p.prep && e.prepCase === p['case']) pe = e; });
      var np = nominal(p.np, p['case'], 'prepobj');
      return { prepEntry: pe, prep: p.prep, 'case': p['case'], english: p.english, np: np };
    });

    var advs = plan.adverbs.map(function (a) {
      return { entry: a.entry, english: a.text, form: a.entry.lat };
    });

    /* Latin word order: subject, (genitive), dative, phrases, object, verb */
    if (subj && !subj.optional) { pieces.push(subj); if (gen) pieces.push(gen); }
    else if (gen) pieces.push(gen);
    if (dat) pieces.push(dat);
    preps.forEach(function (p) { pieces.push(p); });
    advs.forEach(function (a) { pieces.push(a); });
    if (obj) pieces.push(obj);
    pieces.push({ label: 'verb', english: V.english, entry: V.entry, tense: V.tense, person: V.person, num: V.num, form: vform });

    var sentence = pieces.map(function (p) {
      if (p.label === 'prepobj' || p.prep) {
        var bits = [p.prepEntry ? p.prepEntry.lat.split('/')[0] : p.prep];
        var pre2 = [], post2 = [];
        (p.np && p.np.adjs || []).forEach(function (a) {
          (ADJ_FIRST[a.entry.lat] ? pre2 : post2).push(a.form);
        });
        if (p.np) bits = bits.concat(pre2).concat([p.np.form]).concat(post2);
        return bits.filter(Boolean).join(' ');
      }
      var pre = [], post = [];
      (p.adjs || []).forEach(function (a) {
        (ADJ_FIRST[a.entry.lat] ? pre : post).push(a.form);
      });
      return pre.concat([p.form]).concat(post).filter(Boolean).join(' ');
    }).filter(Boolean).join(' ');

    return { subject: subj, object: obj, dative: dat, genitive: gen, preps: preps, adverbs: advs, verb: pieces[pieces.length - 1], pieces: pieces, sentence: sentence };
  }

  /* ============================================================
     checking a whole Latin sentence by parsing it
     ============================================================ */
  function checkLatin(lexicon, target, attempt) {
    var p = Parse.parse(lexicon, attempt);
    if (p.unknowns.length) {
      return { ok: false, reason: 'unknown', words: p.unknowns, feedback: 'Not Latin words from the list: ' + p.unknowns.join(', ') + '.' };
    }
    var cl = p.clauses[0];
    if (!cl || cl.info.verbIdx == null) {
      return { ok: false, reason: 'noverb', feedback: 'There is no finite verb in what you have written.' };
    }
    var V = cl.pick[cl.info.verbIdx];
    var tv = target.verb;
    if (V.lemma !== tv.entry.lat) {
      return { ok: false, reason: 'verblemma', feedback: 'That is not the verb the English needs. Which Latin verb means "' + Eng.splitGloss(tv.entry.eng)[0] + '"?' };
    }
    if (V.tags.tense !== tv.tense) {
      return { ok: false, reason: 'verbtense', feedback: 'The verb is in the ' + TENSE_FULL[V.tags.tense] + '. The English needs the ' + TENSE_FULL[tv.tense] + '.' };
    }
    if (V.tags.person !== tv.person || V.tags.num !== tv.num) {
      return { ok: false, reason: 'verbperson', feedback: 'Check the person and number of the verb. The English needs ' + PERSON_FULL[tv.person + tv.num] + '.' };
    }

    /* every nominal the target needs must appear in the right case and number */
    var needed = [];
    ['subject', 'object', 'dative', 'genitive'].forEach(function (kk) {
      if (target[kk] && !target[kk].optional) {
        needed.push({ label: kk, entry: target[kk].entry, 'case': target[kk]['case'], num: target[kk].num, adjs: target[kk].adjs || [] });
      }
    });
    target.preps.forEach(function (pp) {
      if (pp.np) needed.push({ label: 'prepobj', entry: pp.np.entry, 'case': pp.np['case'], num: pp.np.num, adjs: pp.np.adjs || [], prep: pp.prep });
    });

    var have = [];
    p.words.forEach(function (w) {
      if (!w.chosen) return;
      have.push({ lemma: w.chosen.lemma, tags: w.chosen.tags, raw: w.raw, role: w.role });
    });

    for (var n = 0; n < needed.length; n++) {
      var nd = needed[n];
      var found = have.filter(function (h) { return h.lemma === nd.entry.lat; });
      if (!found.length) {
        return { ok: false, reason: 'missing', feedback: 'You have not included a word for "' + Eng.splitGloss(nd.entry.eng)[0] + '".' };
      }
      var right = found.filter(function (h) { return h.tags['case'] === nd['case'] && h.tags.num === nd.num; });
      if (!right.length) {
        var g = found[0];
        var bits = [];
        if (g.tags['case'] !== nd['case']) bits.push('case');
        if (g.tags.num !== nd.num) bits.push('number');
        return {
          ok: false, reason: 'form',
          feedback: g.raw + ' is ' + CASE_FULL[g.tags['case']] + ' ' + (g.tags.num === 's' ? 'singular' : 'plural') +
            '. Check the ' + bits.join(' and ') + ': as the ' + nd.label + ' it needs the ' + CASE_FULL[nd['case']] + ' ' + (nd.num === 's' ? 'singular' : 'plural') + '.'
        };
      }
      for (var ai = 0; ai < nd.adjs.length; ai++) {
        var ad = nd.adjs[ai];
        var fa = have.filter(function (h) { return h.lemma === ad.entry.lat; });
        if (!fa.length) return { ok: false, reason: 'missingadj', feedback: 'You have not included a word for "' + ad.english + '".' };
        var ra = fa.filter(function (h) { return h.tags['case'] === ad['case'] && h.tags.num === ad.num && h.tags.gender === ad.gender; });
        if (!ra.length) {
          return { ok: false, reason: 'adjagree', feedback: fa[0].raw + ' does not agree with its noun. An adjective matches its noun in case, number and gender.' };
        }
      }
      if (nd.prep) {
        var fp = have.filter(function (h) { return h.tags.pos === 'prep' && h.lemma === nd.prep; });
        if (!fp.length) return { ok: false, reason: 'missingprep', feedback: 'The phrase needs the preposition ' + nd.prep.split('/')[0] + '.' };
      }
    }
    return { ok: true, feedback: 'Correct.', parsed: p };
  }

  /* ============================================================
     the questions
     ============================================================ */
  function buildSteps(lexicon, plan, target, opts) {
    opts = opts || {};
    var steps = [];
    var depth = opts.depth || 'full';

    function latinWordStep(id, englishWord, entry, label) {
      return {
        id: id, group: label, instruction: 'Which Latin word means "' + englishWord + '"?',
        detail: null, input: 'text', answerIsLatin: true,
        check: function (ans) {
          var a = Morph.key(norm(ans));
          if (!a) return { ok: false, feedback: 'Type a Latin word.' };
          if (a === Morph.key(entry.lat.split('/')[0]) || a === Morph.key(entry.lat)) return { ok: true, feedback: 'Correct.' };
          var got = Morph.analyse(lexicon, ans);
          if (got.unknown) return { ok: false, feedback: 'That is not a word on the list.' };
          if (got.readings[0].lemma === entry.lat) {
            return { ok: false, feedback: 'Right word, but give the dictionary form: ' + (entry.pos === 'verb' ? 'the first person singular' : 'the nominative singular') + '.' };
          }
          return { ok: false, feedback: got.readings[0].display + ' means "' + Eng.splitGloss(got.readings[0].eng)[0] + '".' };
        },
        hints: [
          'It is on the Common Entrance ' + (entry.pos === 'verb' ? 'verb' : 'vocabulary') + ' list.',
          'It begins with "' + entry.lat.charAt(0) + '".',
          'The dictionary entry is ' + entry.display + ', ' + entry.info + '.'
        ],
        table: null
      };
    }

    function jobStep(id, englishPhrase, wantCase, label, why) {
      var jobs = ['subject', 'object', 'after a preposition', 'possessive ("of")', 'indirect object ("to" or "for")'];
      var wantJob = {
        nom: 'subject', acc: wantCase === 'acc' && label === 'prepobj' ? 'after a preposition' : 'object',
        gen: 'possessive ("of")', dat: 'indirect object ("to" or "for")', abl: 'after a preposition'
      }[wantCase];
      if (label === 'prepobj') wantJob = 'after a preposition';
      if (label === 'complement') wantJob = 'subject';
      return {
        id: id, group: label, instruction: 'What job does "' + englishPhrase + '" do in the sentence?',
        detail: null, input: 'choice', options: jobs,
        check: function (ans) {
          if (norm(ans) === norm(wantJob)) return { ok: true, feedback: 'Correct.' };
          return { ok: false, feedback: why || 'Not that. Read the English again and ask what the word is doing.' };
        },
        hints: [
          'The subject does the verb. The object has the verb done to it.',
          'A word after a preposition takes whatever case that preposition governs.',
          'Read the English sentence aloud and find the word this one depends on.'
        ],
        table: null
      };
    }

    function caseStep(id, englishPhrase, entry, wantCase, wantNum, label) {
      return {
        id: id, group: label,
        instruction: 'Which case and number does "' + englishPhrase + '" need?',
        detail: null, input: 'choice',
        options: ['nominative singular', 'nominative plural', 'accusative singular', 'accusative plural',
          'genitive singular', 'genitive plural', 'dative singular', 'dative plural',
          'ablative singular', 'ablative plural'],
        check: function (ans) {
          var want = CASE_FULL[wantCase] + ' ' + (wantNum === 's' ? 'singular' : 'plural');
          if (norm(ans) === norm(want)) return { ok: true, feedback: 'Correct.' };
          var a = norm(ans);
          var gotCase = null;
          Object.keys(CASE_FULL).forEach(function (c) { if (a.indexOf(CASE_FULL[c]) === 0) gotCase = c; });
          var gotNum = /plural/.test(a) ? 'p' : 's';
          if (gotCase === wantCase && gotNum !== wantNum) {
            return { ok: false, feedback: 'The case is right. Is the English one or more than one?' };
          }
          if (gotCase !== wantCase && gotNum === wantNum) {
            return { ok: false, feedback: 'The number is right. You settled its job already; which case goes with that job?' };
          }
          return { ok: false, feedback: 'Not that one. Settle the job first, then the number.' };
        },
        hints: [
          'The job decides the case. The English decides the number.',
          'Subject is nominative, object accusative, "of" genitive, "to" or "for" dative.',
          'Read the noun against its table.'
        ],
        table: function () { return Morph.paradigm(entry); }
      };
    }

    function formStep(id, entry, wantForm, wantCase, wantNum, label, isVerb, vinfo) {
      return {
        id: id, group: label,
        instruction: isVerb
          ? 'Write ' + entry.display + ' in the ' + TENSE_FULL[vinfo.tense] + ', ' + PERSON_FULL[vinfo.person + vinfo.num] + '.'
          : 'Write ' + entry.display + ' in the ' + CASE_FULL[wantCase] + ' ' + (wantNum === 's' ? 'singular' : 'plural') + '.',
        detail: null, input: 'text', answerIsLatin: true,
        check: function (ans) {
          var a = Morph.key(norm(ans));
          if (!a) return { ok: false, feedback: 'Write the form.' };
          if (a === Morph.key(wantForm)) return { ok: true, feedback: 'Correct.' };
          var got = Morph.analyse(lexicon, ans);
          if (got.unknown) return { ok: false, feedback: 'That is not a form of any word on the list. Check the ending.' };
          var same = got.readings.filter(function (r) { return r.lemma === entry.lat; });
          if (!same.length) {
            return { ok: false, feedback: 'That is a form of ' + got.readings[0].display + ', not ' + entry.display + '.' };
          }
          var r0 = same[0];
          if (isVerb) {
            var bits = [];
            if (r0.tags.tense !== vinfo.tense) bits.push('tense');
            if (r0.tags.person !== vinfo.person || r0.tags.num !== vinfo.num) bits.push('person or number');
            return { ok: false, feedback: 'That is the ' + TENSE_FULL[r0.tags.tense] + ', ' + PERSON_FULL[r0.tags.person + r0.tags.num] + '. Check the ' + (bits.join(' and ') || 'ending') + '.' };
          }
          return {
            ok: false,
            feedback: 'That is ' + CASE_FULL[r0.tags['case']] + ' ' + (r0.tags.num === 's' ? 'singular' : 'plural') + '. You need the ' + CASE_FULL[wantCase] + ' ' + (wantNum === 's' ? 'singular' : 'plural') + '.'
          };
        },
        hints: isVerb
          ? ['The stem comes from ' + entry.info.split(',')[0] + '.',
            vinfo.tense === 'impf' ? 'The imperfect puts -ba- between the stem and the ending.' : (vinfo.tense === 'perf' ? 'The perfect uses the third dictionary form as its stem.' : 'The present adds the person ending straight onto the stem.'),
            'Read it off the table.']
          : ['The stem comes from the genitive, ' + entry.info + '.',
            'Find the line for the ' + CASE_FULL[wantCase] + ' ' + (wantNum === 's' ? 'singular' : 'plural') + '.',
            'Read it off the table.'],
        table: function () { return Morph.paradigm(entry); }
      };
    }

    /* ---- verb first, as in reading ---- */
    var V = target.verb;
    steps.push(latinWordStep('e-vword', Eng.splitGloss(V.entry.eng)[0].replace(/^I\s+/, ''), V.entry, 'The verb'));
    steps.push({
      id: 'e-vtense', group: 'The verb', instruction: 'Which tense does "' + V.english + '" need?',
      detail: null, input: 'choice', options: ['present', 'imperfect', 'perfect'],
      check: function (ans) {
        if (norm(ans) === TENSE_FULL[V.tense]) return { ok: true, feedback: 'Correct.' };
        return { ok: false, feedback: 'Not that one. Look at the English: is it happening now, going on in the past, or finished?' };
      },
      hints: [
        '"works" is present. "was working" or "used to work" is imperfect. "worked" or "has worked" is perfect.',
        'The English here is "' + V.english + '".',
        'Decide whether the action is going on or finished.'
      ],
      table: null
    });
    steps.push({
      id: 'e-vperson', group: 'The verb', instruction: 'Which person and number does the verb need?',
      detail: null, input: 'choice',
      options: ['I', 'you (singular)', 'he, she or it', 'we', 'you (plural)', 'they'],
      check: function (ans) {
        if (norm(ans) === norm(PERSON_FULL[V.person + V.num])) return { ok: true, feedback: 'Correct.' };
        return { ok: false, feedback: 'The subject decides this. Who or what is doing the verb, and is it one or more than one?' };
      },
      hints: ['Find the subject in the English first.', 'A noun subject is third person.', 'Count: one or more than one.'],
      table: null
    });
    steps.push(formStep('e-vform', V.entry, V.form, null, null, 'The verb', true, V));

    /* ---- each nominal ---- */
    function nominalSteps(n, tag, why) {
      if (!n || !n.entry) return;
      var base = 'e-' + tag;
      steps.push(latinWordStep(base + '-word', stripArticles(n.english), n.entry, labelFor(tag)));
      if (depth === 'full') steps.push(jobStep(base + '-job', stripArticles(n.english), n['case'], labelFor(tag), why));
      steps.push(caseStep(base + '-case', stripArticles(n.english), n.entry, n['case'], n.num, labelFor(tag)));
      steps.push(formStep(base + '-form', n.entry, n.form, n['case'], n.num, labelFor(tag), false, null));
      (n.adjs || []).forEach(function (a, ai) {
        steps.push(latinWordStep(base + '-adjword' + ai, a.english, a.entry, labelFor(tag)));
        steps.push(formStep(base + '-adjform' + ai, a.entry, a.form, a['case'], a.num, labelFor(tag), false, null));
      });
    }
    function labelFor(tag) {
      return { subject: 'The subject', object: 'The object', complement: 'The complement', dative: 'The dative', genitive: 'The genitive' }[tag] || tag;
    }
    function stripArticles(s) { return String(s || '').replace(/^(the|a|an|some)\s+/, ''); }

    nominalSteps(target.subject, 'subject', 'The subject is the one doing the verb.');
    nominalSteps(target.object, target.object && target.object.label === 'complement' ? 'complement' : 'object', 'The object has the verb done to it.');
    nominalSteps(target.dative, 'dative', '"to" or "for" someone is the dative.');
    nominalSteps(target.genitive, 'genitive', '"of" something is the genitive.');

    /* ---- prepositional phrases ---- */
    target.preps.forEach(function (p, pi) {
      if (!p.np || !p.np.entry) return;
      var g = 'The phrase "' + p.english + ' ' + p.np.english + '"';
      steps.push({
        id: 'e-prep' + pi, group: g,
        instruction: 'Which Latin preposition means "' + p.english + '", and which case does it take here?',
        detail: null, input: 'text', answerIsLatin: true,
        check: function (ans) {
          var a = norm(ans);
          var want = p.prep.split('/');
          var hasPrep = want.some(function (x) { return a.indexOf(x) >= 0; });
          var hasCase = a.indexOf(CASE_FULL[p['case']]) >= 0 || a.indexOf(p['case']) >= 0;
          if (hasPrep && hasCase) return { ok: true, feedback: 'Correct.' };
          if (hasPrep && !hasCase) return { ok: false, feedback: 'Right preposition. Name the case it takes here as well.' };
          if (!hasPrep && hasCase) return { ok: false, feedback: 'Right case. Which Latin preposition means "' + p.english + '"?' };
          return { ok: false, feedback: 'Not that. Give the preposition and its case.' };
        },
        hints: [
          'Write the preposition and then the case, for example "ad + accusative".',
          p.prep === 'in' ? 'in takes the accusative for motion into, and the ablative for rest in or on.' : 'Look the preposition up on the list; its case is given with it.',
          'The preposition begins with "' + p.prep.charAt(0) + '".'
        ],
        table: null
      });
      steps.push(latinWordStep('e-prep' + pi + '-noun', stripArticles(p.np.english), p.np.entry, g));
      steps.push(formStep('e-prep' + pi + '-form', p.np.entry, p.np.form, p.np['case'], p.np.num, g, false, null));
      (p.np.adjs || []).forEach(function (a, ai) {
        steps.push(formStep('e-prep' + pi + '-adj' + ai, a.entry, a.form, a['case'], a.num, g, false, null));
      });
    });

    /* ---- the whole sentence ---- */
    steps.push({
      id: 'e-whole', group: 'The whole sentence',
      instruction: 'Write the whole sentence in Latin.',
      detail: 'Word order is free. The endings carry the meaning.',
      input: 'text', answerIsLatin: true,
      check: function (ans) {
        var r = checkLatin(lexicon, target, ans);
        return { ok: r.ok, feedback: r.feedback };
      },
      hints: [
        'Use the forms you have already worked out.',
        'Latin normally puts the verb at the end.',
        'Check every ending once more before you submit.'
      ],
      table: null
    });

    return steps;
  }

  var API = {
    buildReverse: buildReverse, parseEnglish: parseEnglish,
    buildTarget: buildTarget, buildSteps: buildSteps, checkLatin: checkLatin,
    PREP_MAP: PREP_MAP, formOf: formOf
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Lat = API;
})(typeof window !== 'undefined' ? window : this);
