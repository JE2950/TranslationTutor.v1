/* ============================================================
   socratic.js — the questioning engine
   Turns a parsed sentence into an ordered sequence of questions.
   Every answer is checked against the parse. Hints narrow the
   field; none of them states the answer. The last resort is the
   paradigm table, which the pupil must read for himself.

   Pupil-facing text here is plain instruction only.
   ============================================================ */
(function (root) {
  'use strict';

  var Morph = (typeof require !== 'undefined') ? require('./morph.js') : root.Morph;
  var Eng = (typeof require !== 'undefined') ? require('./english.js') : root.Eng;

  var CASE_FULL = {
    nom: 'nominative', voc: 'vocative', acc: 'accusative',
    gen: 'genitive', dat: 'dative', abl: 'ablative'
  };
  var TENSE_FULL = { pres: 'present', impf: 'imperfect', perf: 'perfect', fut: 'future', plupf: 'pluperfect' };
  var PERSON_FULL = {
    '1s': 'I', '2s': 'you (singular)', '3s': 'he, she or it',
    '1p': 'we', '2p': 'you (plural)', '3p': 'they'
  };

  function norm(s) {
    return String(s || '').toLowerCase().trim()
      .replace(/[^a-z0-9\s'-]/g, '').replace(/\s+/g, ' ');
  }
  function latinNorm(s) { return Morph.key(norm(s)); }

  /* a typed answer may name a case in several ways */
  var CASE_WORDS = {
    nom: ['nominative', 'nom', 'subject'], voc: ['vocative', 'voc'],
    acc: ['accusative', 'acc', 'object'], gen: ['genitive', 'gen'],
    dat: ['dative', 'dat'], abl: ['ablative', 'abl']
  };
  var TENSE_WORDS = {
    pres: ['present', 'pres'], impf: ['imperfect', 'impf', 'imperf'],
    perf: ['perfect', 'perf'], fut: ['future', 'fut'], plupf: ['pluperfect', 'plupf']
  };
  /* Exact matching only. "imperfect" contains "perf", so a substring test
     would accept the imperfect as the perfect. */
  function matchesCase(ans, cs) {
    var a = norm(ans);
    return (CASE_WORDS[cs] || []).some(function (w) { return a === w; });
  }
  function matchesTense(ans, tn) {
    var a = norm(ans);
    return (TENSE_WORDS[tn] || []).some(function (w) { return a === w; });
  }

  /* ============================================================
     step builders
     ============================================================ */

  function stepFindVerb(ctx) {
    var cl = ctx.clause, vi = cl.info.verbIdx;
    var verbWord = cl.words[vi];
    var others = cl.words.filter(function (w, i) { return i !== vi && !w.unknown; });
    return {
      id: ctx.key + '-findverb',
      group: ctx.groupLabel,
      instruction: 'Type the verb.',
      detail: null,
      input: 'text',
      answerIsLatin: true,
      check: function (ans) {
        var a = latinNorm(ans);
        if (!a) return { ok: false, feedback: 'Type one word.' };
        if (a === latinNorm(verbWord.raw)) return { ok: true, feedback: 'Correct.' };
        var hit = null;
        cl.words.forEach(function (w, i) { if (latinNorm(w.raw) === a) hit = { w: w, i: i }; });
        if (!hit) return { ok: false, feedback: 'That word is not in the sentence.' };
        var r = hit.w.chosen;
        if (r && (r.tags.pos === 'noun' || r.tags.pos === 'adj')) {
          return { ok: false, feedback: hit.w.raw + ' has a case ending, so it is not the verb. Which word has a person ending?' };
        }
        if (r && r.tags.pos === 'prep') {
          return { ok: false, feedback: hit.w.raw + ' is a preposition. It governs a noun; it does not do anything.' };
        }
        if (r && r.tags.mood === 'inf') {
          return { ok: false, feedback: hit.w.raw + ' is an infinitive. It has no person ending, so another word carries the person.' };
        }
        return { ok: false, feedback: 'Not that one. Which word tells you who is doing something?' };
      },
      hints: [
        'In Latin the verb usually comes at the end of its clause.',
        'A verb ends with a person ending: -o, -s, -t, -mus, -tis or -nt.',
        function () {
          var cands = cl.words.filter(function (w) {
            return w.readings.some(function (r) { return r.tags.pos === 'verb'; });
          }).map(function (w) { return w.raw; });
          if (cands.length > 1) return 'It is one of these: ' + cands.join(', ') + '.';
          return 'Only one word in this clause has a person ending. Read the last letters of each word.';
        }
      ],
      table: null
    };
  }

  function stepVerbPersonNumber(ctx) {
    var cl = ctx.clause, vi = cl.info.verbIdx, V = cl.pick[vi];
    var pk = V.tags.person + V.tags.num;
    return {
      id: ctx.key + '-person',
      group: ctx.groupLabel,
      instruction: 'Who is doing it?',
      detail: cl.words[vi].raw,
      input: 'choice',
      options: ['I', 'you (singular)', 'he, she or it', 'we', 'you (plural)', 'they'],
      check: function (ans) {
        var want = PERSON_FULL[pk];
        if (norm(ans) === norm(want)) return { ok: true, feedback: 'Correct.' };
        var chosen = norm(ans);
        var singularPicked = /^(i|you \(singular\)|he, she or it)$/.test(chosen);
        var wantSingular = V.tags.num === 's';
        if (singularPicked !== wantSingular) {
          return {
            ok: false,
            feedback: 'Check singular against plural first. ' + cl.words[vi].raw +
              ' ends in -' + endingOf(cl.words[vi].raw, V) + '. Is that one person or more than one?'
          };
        }
        return { ok: false, feedback: 'The number is right; the person is not. Count: -o and -mus are first person, -s and -tis second, -t and -nt third.' };
      },
      hints: [
        'Cover the stem and read only the ending.',
        '-o and -mus are first person, -s and -tis second person, -t and -nt third person. The plural endings are -mus, -tis and -nt.',
        'Read the ending against the table.'
      ],
      table: function () { return Morph.paradigm(V.lex); }
    };
  }

  function endingOf(word, reading) {
    var w = String(word).toLowerCase();
    var ends = ['mus', 'tis', 'nt', 'runt', 'isti', 'istis', 'bam', 'bas', 'bat', 't', 's', 'o', 'i', 'it'];
    for (var i = 0; i < ends.length; i++) {
      if (w.length > ends[i].length && w.slice(-ends[i].length) === ends[i]) return ends[i];
    }
    return w.slice(-2);
  }

  function stepVerbTense(ctx) {
    var cl = ctx.clause, vi = cl.info.verbIdx, V = cl.pick[vi];
    var tn = V.tags.tense;
    var opts = ['present', 'imperfect', 'perfect'];
    if (ctx.scope && ctx.scope.future) opts.push('future');
    if (ctx.scope && ctx.scope.pluperfect) opts.push('pluperfect');
    return {
      id: ctx.key + '-tense',
      group: ctx.groupLabel,
      instruction: 'Which tense?',
      detail: cl.words[vi].raw,
      input: 'choice',
      options: opts,
      check: function (ans) {
        if (matchesTense(ans, tn)) return { ok: true, feedback: 'Correct.' };
        if (matchesTense(ans, 'pres') && tn === 'impf') {
          return { ok: false, feedback: 'Look again at the letters between the stem and the ending.' };
        }
        if (matchesTense(ans, 'impf') && tn === 'pres') {
          return { ok: false, feedback: 'The imperfect has -ba- before the ending. Is it there?' };
        }
        if (tn === 'perf') {
          return { ok: false, feedback: 'Compare the stem of ' + cl.words[vi].raw + ' with the first dictionary form, ' + V.lex.display + '. Has the stem changed?' };
        }
        return { ok: false, feedback: 'Not that one. Look at the stem and at the letters before the person ending.' };
      },
      hints: [
        'The tense is carried between the stem and the person ending.',
        'The imperfect puts -ba- there. The perfect changes the stem itself and uses -i, -isti, -it, -imus, -istis, -erunt.',
        'Find ' + cl.words[vi].raw + ' in the table.'
      ],
      table: function () { return Morph.paradigm(V.lex); }
    };
  }

  function stepVerbMeaning(ctx) {
    var cl = ctx.clause, vi = cl.info.verbIdx, V = cl.pick[vi];
    var accept = Eng.verbEnglish(V);
    var wrongT = {}, wrongN = {};
    ['pres', 'impf', 'perf'].forEach(function (t) {
      if (t === V.tags.tense) return;
      var fake = { lemma: V.lemma, eng: V.eng, display: V.display, tags: { pos: 'verb', mood: 'ind', tense: t, person: V.tags.person, num: V.tags.num } };
      Eng.verbEnglish(fake).forEach(function (f) { wrongT[f] = t; });
    });
    var other = V.tags.num === 's' ? 'p' : 's';
    var fakeN = { lemma: V.lemma, eng: V.eng, display: V.display, tags: { pos: 'verb', mood: 'ind', tense: V.tags.tense, person: V.tags.person, num: other } };
    Eng.verbEnglish(fakeN).forEach(function (f) { wrongN[f] = other; });

    return {
      id: ctx.key + '-vmean',
      group: ctx.groupLabel,
      instruction: 'Translate the verb.',
      detail: cl.words[vi].raw,
      input: 'text',
      check: function (ans) {
        var a = norm(ans);
        if (!a) return { ok: false, feedback: 'Type the verb in English.' };
        var hit = accept.some(function (f) { return a === norm(f) || a.indexOf(norm(f)) >= 0; });
        if (hit) return { ok: true, feedback: 'Correct.' };
        var wt = null;
        Object.keys(wrongT).forEach(function (f) { if (!wt && a.indexOf(norm(f)) >= 0) wt = wrongT[f]; });
        if (wt) return { ok: false, feedback: 'That is the ' + TENSE_FULL[wt] + '. You said this verb is ' + TENSE_FULL[V.tags.tense] + '. Put it in that tense.' };
        var wn = null;
        Object.keys(wrongN).forEach(function (f) { if (!wn && a.indexOf(norm(f)) >= 0) wn = wrongN[f]; });
        if (wn) return { ok: false, feedback: 'Check the number. The ending told you ' + PERSON_FULL[V.tags.person + V.tags.num] + '.' };
        return { ok: false, feedback: 'Not the meaning of this verb. The dictionary form is ' + V.lex.display + '.' };
      },
      hints: [
        'The dictionary form is ' + V.lex.display + ', ' + V.lex.info + '.',
        'It means "' + Eng.splitGloss(V.eng)[0] + '". Now put it in the ' + TENSE_FULL[V.tags.tense] + ', ' + PERSON_FULL[V.tags.person + V.tags.num] + '.',
        V.tags.tense === 'impf'
          ? 'The imperfect can be "was ...-ing", "used to ...", or "began to ...". Choose whichever reads best.'
          : 'Say it as you would in English.'
      ],
      table: null
    };
  }

  function stepAmbiguousCase(ctx, idx, label) {
    var cl = ctx.clause, w = cl.words[idx], r = cl.pick[idx];
    var all = {};
    w.readings.forEach(function (rr) {
      if (rr.tags['case'] && rr.lemma === r.lemma) all[rr.tags['case']] = 1;
    });
    /* The vocative is only in play when someone is being addressed, and it
       has a step of its own. Listing it here turns every nominative into a
       question not worth asking. */
    if (r.tags['case'] !== 'voc') delete all.voc;
    var list = Object.keys(all);
    if (list.length < 2) return null;
    return {
      id: ctx.key + '-amb-' + idx,
      group: ctx.groupLabel,
      instruction: 'Which case is ' + w.raw + ' here?',
      detail: w.raw + ' could be ' + list.map(function (c) { return CASE_FULL[c]; }).join(', ') + '.',
      input: 'choice',
      options: list.map(function (c) { return CASE_FULL[c]; }),
      check: function (ans) {
        if (matchesCase(ans, r.tags['case'])) return { ok: true, feedback: 'Correct.' };
        var V = cl.info.verbIdx != null ? cl.pick[cl.info.verbIdx] : null;
        if (label === 'subject' && V) {
          return { ok: false, feedback: 'The verb is ' + PERSON_FULL[V.tags.person + V.tags.num] + '. Which case does a subject take?' };
        }
        return { ok: false, feedback: 'Not here. Work out what this word is doing in the sentence first.' };
      },
      hints: [
        'The ending alone cannot decide it. Look at what the word is doing.',
        'A subject is nominative. A direct object is accusative. After a preposition the preposition fixes the case.',
        'Read ' + w.raw + ' against the table and see which lines it could be.'
      ],
      table: function () { return Morph.paradigm(r.lex); }
    };
  }

  function stepSubject(ctx) {
    var cl = ctx.clause, si = cl.info.subjIdx, vi = cl.info.verbIdx;
    var V = vi != null ? cl.pick[vi] : null;
    if (si != null && si >= 0 && cl.info.roles[si] === 'subject') {
      var w = cl.words[si];
      return {
        id: ctx.key + '-subject',
        group: ctx.groupLabel,
        instruction: 'Type the subject.',
        detail: null,
        input: 'text',
        answerIsLatin: true,
        check: function (ans) {
          var a = latinNorm(ans);
          if (a === latinNorm(w.raw)) return { ok: true, feedback: 'Correct.' };
          var hit = null;
          cl.words.forEach(function (x, i) { if (latinNorm(x.raw) === a) hit = { w: x, i: i }; });
          if (!hit) return { ok: false, feedback: 'That word is not in the sentence.' };
          var rr = hit.w.chosen;
          if (rr && rr.tags['case'] === 'acc') return { ok: false, feedback: hit.w.raw + ' is accusative. A subject is nominative.' };
          if (rr && rr.tags['case'] === 'abl') return { ok: false, feedback: hit.w.raw + ' is ablative, governed by the preposition. Look for a nominative.' };
          if (rr && rr.tags.pos === 'verb') return { ok: false, feedback: 'That is the verb. The subject is the word doing it.' };
          return { ok: false, feedback: 'Not that one. Find a nominative that matches the verb for number.' };
        },
        hints: [
          'The subject is nominative.',
          V ? 'The verb is ' + PERSON_FULL[V.tags.person + V.tags.num] + ', so the subject must be ' + (V.tags.num === 's' ? 'singular' : 'plural') + '.' : 'Find the nominative.',
          'Check each word against its own table and find the nominative.'
        ],
        table: null
      };
    }
    if (V && V.tags.mood === 'ind') {
      return {
        id: ctx.key + '-subject-ending',
        group: ctx.groupLabel,
        instruction: 'There is no separate subject word. Give the subject in English.',
        detail: cl.words[vi].raw,
        input: 'text',
        check: function (ans) {
          var a = norm(ans);
          var pk = V.tags.person + V.tags.num;
          var ok = { '1s': ['i'], '2s': ['you'], '3s': ['he', 'she', 'it'], '1p': ['we'], '2p': ['you'], '3p': ['they'] }[pk] || [];
          if (ok.some(function (x) { return a === x || a.indexOf(x) >= 0; })) return { ok: true, feedback: 'Correct.' };
          return { ok: false, feedback: 'The ending of ' + cl.words[vi].raw + ' carries the subject. You said it was ' + PERSON_FULL[pk] + '.' };
        },
        hints: [
          'Latin does not need a separate word for the subject. The verb ending supplies it.',
          'You have already parsed the ending. Use that answer.',
          'Read the ending against the table.'
        ],
        table: function () { return Morph.paradigm(V.lex); }
      };
    }
    return null;
  }

  function stepObject(ctx) {
    var cl = ctx.clause, oi = cl.info.objIdx;
    if (oi == null || oi < 0 || cl.info.roles[oi] !== 'object') return null;
    var w = cl.words[oi];
    return {
      id: ctx.key + '-object',
      group: ctx.groupLabel,
      instruction: 'Type the object.',
      detail: null,
      input: 'text',
      answerIsLatin: true,
      check: function (ans) {
        var a = latinNorm(ans);
        if (a === latinNorm(w.raw)) return { ok: true, feedback: 'Correct.' };
        var hit = null;
        cl.words.forEach(function (x, i) { if (latinNorm(x.raw) === a) hit = { w: x, i: i }; });
        if (!hit) return { ok: false, feedback: 'That word is not in the sentence.' };
        var rr = hit.w.chosen;
        if (rr && rr.tags['case'] === 'nom') return { ok: false, feedback: hit.w.raw + ' is nominative, so it is the subject. An object is accusative.' };
        if (cl.info.roles[hit.i] === 'prepobj') return { ok: false, feedback: hit.w.raw + ' belongs to the preposition in front of it. Look for an accusative with no preposition.' };
        return { ok: false, feedback: 'Not that one. An object is accusative and has no preposition in front of it.' };
      },
      hints: [
        'The object is accusative.',
        'Accusative singular ends -am, -um or -em. Accusative plural ends -as, -os or -es.',
        'Check each word against its own table.'
      ],
      table: null
    };
  }

  function stepAdjAgreement(ctx, idx) {
    var cl = ctx.clause, w = cl.words[idx], r = cl.pick[idx];
    var headIdx = cl.info.agree[idx];
    if (headIdx == null) return null;
    var head = cl.words[headIdx];
    return {
      id: ctx.key + '-adj-' + idx,
      group: ctx.groupLabel,
      instruction: w.raw + ' is an adjective. Type the noun it agrees with.',
      detail: null,
      input: 'text',
      answerIsLatin: true,
      check: function (ans) {
        var a = latinNorm(ans);
        if (a === latinNorm(head.raw)) return { ok: true, feedback: 'Correct.' };
        var hit = null;
        cl.words.forEach(function (x, i) { if (latinNorm(x.raw) === a) hit = { w: x, i: i }; });
        if (!hit) return { ok: false, feedback: 'That word is not in the sentence.' };
        var rr = hit.w.chosen;
        if (rr && rr.tags['case']) {
          var bits = [];
          if (rr.tags['case'] !== r.tags['case']) bits.push('case');
          if (rr.tags.num !== r.tags.num) bits.push('number');
          if (rr.tags.gender !== r.tags.gender) bits.push('gender');
          if (bits.length) return { ok: false, feedback: 'An adjective must match its noun in case, number and gender. Those two differ in ' + bits.join(' and ') + '.' };
        }
        return { ok: false, feedback: 'Not that one.' };
      },
      hints: [
        'An adjective agrees with its noun in case, number and gender. It need not stand next to it.',
        w.raw + ' is ' + CASE_FULL[r.tags['case']] + ' ' + (r.tags.num === 's' ? 'singular' : 'plural') + '. Find a noun that is the same.',
        'Check each noun against its own table.'
      ],
      table: function () { return Morph.paradigm(r.lex); }
    };
  }

  function stepPrepPhrase(ctx, prepIdx, objIdx) {
    var cl = ctx.clause, pw = cl.words[prepIdx], ow = cl.words[objIdx];
    var pr = cl.pick[prepIdx], orr = cl.pick[objIdx];
    var wantCase = pr.lex.prepCase;
    var sameLemmaOther = null;
    pw.readings.forEach(function (rr) {
      if (rr.tags.pos === 'prep' && rr.lex.prepCase !== wantCase) sameLemmaOther = rr;
    });
    var slot = null;
    Eng.buildSlots({ clauses: [cl], isQuestion: false }).forEach(function (s) {
      if (s.kind === 'prep-phrase' && s.wordIdx === prepIdx) slot = s;
    });
    return {
      id: ctx.key + '-prep-' + prepIdx,
      group: ctx.groupLabel,
      instruction: 'Translate the phrase ' + pw.raw + ' ' + ow.raw + '.',
      detail: sameLemmaOther
        ? pw.raw + ' takes the accusative or the ablative. The case of ' + ow.raw + ' decides which.'
        : pw.raw + ' takes the ' + CASE_FULL[wantCase] + '.',
      input: 'text',
      check: function (ans) {
        var a = norm(ans);
        if (!a) return { ok: false, feedback: 'Type the phrase in English.' };
        if (slot && slot.accept.some(function (f) { return a === norm(f) || a.indexOf(norm(f)) >= 0; })) {
          return { ok: true, feedback: 'Correct.' };
        }
        if (slot && slot.wrongCase) {
          var w2 = null;
          Object.keys(slot.wrongCase).forEach(function (f) { if (!w2 && a.indexOf(norm(f)) >= 0) w2 = slot.wrongCase[f]; });
          if (w2) {
            return {
              ok: false,
              feedback: 'That is ' + pw.raw + ' with the ' + CASE_FULL[w2] + '. ' + ow.raw +
                ' is ' + CASE_FULL[wantCase] + ' here, which changes the meaning.'
            };
          }
        }
        var nounOk = Eng.nounEnglish(orr).some(function (f) { return a.indexOf(norm(f)) >= 0; });
        if (!nounOk) return { ok: false, feedback: 'Check the noun first. What does ' + orr.lex.display + ' mean?' };
        return { ok: false, feedback: 'The noun is right. Check the preposition.' };
      },
      hints: [
        sameLemmaOther
          ? 'What case is ' + ow.raw + '? That tells you which meaning of ' + pw.raw + ' to use.'
          : pw.raw + ' means "' + (Eng.PREP_ENG[pr.lemma + '|' + wantCase] || [pr.eng])[0] + '".',
        'Translate the noun, then put the preposition in front of it.',
        'Read ' + ow.raw + ' against the table to fix its case.'
      ],
      table: function () { return Morph.paradigm(orr.lex); }
    };
  }

  function stepCaseUse(ctx, idx, role) {
    var cl = ctx.clause, w = cl.words[idx], r = cl.pick[idx];
    var slot = null;
    Eng.buildSlots({ clauses: [cl], isQuestion: false }).forEach(function (s) {
      if (s.wordIdx === idx && (s.kind === 'genitive' || s.kind === 'dative' || s.kind === 'ablative' || s.kind === 'voc')) slot = s;
    });
    if (!slot) return null;
    var what = { gen: 'genitive', dat: 'dative', abl: 'ablative', voc: 'vocative' }[role];
    var howto = {
      gen: 'The genitive is "of ..." in English.',
      dat: 'The dative is "to ..." or "for ..." in English.',
      abl: 'The ablative here is "by", "with" or "in" depending on sense.',
      voc: 'The vocative is the person being spoken to.'
    }[role];
    return {
      id: ctx.key + '-case-' + idx,
      group: ctx.groupLabel,
      instruction: 'Translate ' + w.raw + '.',
      detail: w.raw + ' is ' + what + ' ' + (r.tags.num === 's' ? 'singular' : 'plural') + '.',
      input: 'text',
      check: function (ans) {
        var a = norm(ans);
        if (!a) return { ok: false, feedback: 'Type it in English.' };
        if (slot.accept.some(function (f) { return a === norm(f) || a.indexOf(norm(f)) >= 0; })) return { ok: true, feedback: 'Correct.' };
        var bare = Eng.nounEnglish(r).some(function (f) { return a.indexOf(norm(f)) >= 0; });
        if (bare) return { ok: false, feedback: 'The noun is right. Now show the case. ' + howto };
        return { ok: false, feedback: 'Not the meaning of this word. The dictionary form is ' + r.lex.display + '.' };
      },
      hints: [howto, 'The noun means "' + Eng.splitGloss(r.eng)[0] + '".', 'Read ' + w.raw + ' against the table.'],
      table: function () { return Morph.paradigm(r.lex); }
    };
  }

  function stepWholeTranslation(parsed, mode) {
    var slots = Eng.buildSlots(parsed);
    return {
      id: 'whole',
      group: 'The whole sentence',
      instruction: mode === 'build' ? 'Build the English translation.' : 'Translate the whole sentence.',
      detail: null,
      input: mode === 'build' ? 'build' : 'text',
      tiles: mode === 'build' ? Eng.tiles(parsed) : null,
      check: function (ans) {
        var r = Eng.markTranslation(parsed, ans);
        if (r.ok) return { ok: true, feedback: 'Correct.' };
        if (r.orderProblem === 'subject-after-verb') {
          return { ok: false, feedback: 'The words are right; the order is not. In English the subject comes before the verb.' };
        }
        if (r.orderProblem === 'object-first') {
          return { ok: false, feedback: 'The words are right; the order is not. In English the object follows the verb.' };
        }
        var fp = r.firstProblem;
        if (fp) {
          var s = fp.slot, p = fp.problem;
          if (p.type === 'tense') {
            return { ok: false, feedback: 'Check the tense of ' + s.latin + '. You have written it as ' + TENSE_FULL[p.was] + '.' };
          }
          if (p.type === 'number') {
            return { ok: false, feedback: 'Check whether ' + s.latin + ' is singular or plural.' };
          }
          if (p.type === 'case') {
            return { ok: false, feedback: 'Check the case after ' + s.latin.split(' ')[0] + '. That changes the meaning of the phrase.' };
          }
          return { ok: false, feedback: 'You have not translated ' + s.latin + '.' };
        }
        return { ok: false, feedback: 'Not yet. Check each word against the answers you have already given.' };
      },
      hints: [
        'Use the answers you have already given, in English order.',
        'English order is subject, verb, object. Phrases can go at the start or the end.',
        'Work through the sentence word by word and write what each one gave you.'
      ],
      table: null
    };
  }

  /* ============================================================
     assembling the sequence
     ============================================================ */

  function buildSteps(parsed, opts) {
    opts = opts || {};
    var depth = opts.depth || 'full';     // 'full' | 'core'
    var mode = opts.mode || 'type';       // 'type' | 'build'
    var steps = [];

    parsed.clauses.forEach(function (cl, ci) {
      if (cl.info.verbIdx == null) return;
      var label = parsed.clauses.length > 1
        ? 'Clause ' + (ci + 1) + ': ' + cl.words.map(function (w) { return w.raw; }).join(' ')
        : 'The sentence';
      var ctx = { clause: cl, key: 'c' + ci, groupLabel: label, scope: opts.scope };

      steps.push(stepFindVerb(ctx));
      steps.push(stepVerbPersonNumber(ctx));
      steps.push(stepVerbTense(ctx));
      if (depth === 'full') steps.push(stepVerbMeaning(ctx));

      var si = cl.info.subjIdx;
      if (depth === 'full' && si != null && si >= 0 && cl.info.roles[si] === 'subject') {
        var amb = stepAmbiguousCase(ctx, si, 'subject');
        var sub = stepSubject(ctx);
        if (sub) steps.push(sub);
        if (amb) steps.push(amb);
      } else {
        var sub2 = stepSubject(ctx);
        if (sub2) steps.push(sub2);
      }

      var ob = stepObject(ctx);
      if (ob) {
        steps.push(ob);
        if (depth === 'full') {
          var ambO = stepAmbiguousCase(ctx, cl.info.objIdx, 'object');
          if (ambO) steps.push(ambO);
        }
      }

      /* adjectives, prepositional phrases, other cases */
      cl.words.forEach(function (w, i) {
        if (!cl.pick[i]) return;
        var role = cl.info.roles[i];
        if (role === 'adj') {
          var a = stepAdjAgreement(ctx, i);
          if (a) steps.push(a);
        }
      });
      cl.words.forEach(function (w, i) {
        if (cl.info.roles[i] !== 'prep') return;
        var oi = -1;
        cl.words.forEach(function (x, j) { if (cl.info.roles[j] === 'prepobj' && j > i && oi < 0) oi = j; });
        if (oi >= 0) steps.push(stepPrepPhrase(ctx, i, oi));
      });
      if (depth === 'full') {
        cl.words.forEach(function (w, i) {
          var role = cl.info.roles[i];
          if (role === 'gen' || role === 'dat' || role === 'abl' || role === 'voc') {
            var s = stepCaseUse(ctx, i, role);
            if (s) steps.push(s);
          }
        });
      }
    });

    steps.push(stepWholeTranslation(parsed, mode));
    return steps.filter(Boolean);
  }

  /* ============================================================
     the tutor state machine
     ============================================================ */

  function Tutor(parsed, opts) {
    this.parsed = parsed;
    this.opts = opts || {};
    this.steps = buildSteps(parsed, this.opts);
    this.i = 0;
    this.log = this.steps.map(function () { return { attempts: 0, hints: 0, table: false, done: false }; });
  }

  Tutor.prototype.step = function () { return this.steps[this.i] || null; };
  Tutor.prototype.record = function () { return this.log[this.i]; };
  Tutor.prototype.finished = function () { return this.i >= this.steps.length; };
  Tutor.prototype.progress = function () {
    return { index: this.i, total: this.steps.length };
  };

  Tutor.prototype.submit = function (answer) {
    var s = this.step();
    if (!s) return { ok: false, feedback: '' };
    var rec = this.record();
    rec.attempts++;
    var r = s.check(answer);
    if (r.ok) {
      rec.done = true;
      this.i++;
      return { ok: true, feedback: r.feedback, advanced: true, finished: this.finished() };
    }
    /* after three wrong attempts, offer the table rather than the answer */
    if (rec.attempts >= 3 && s.table && !rec.table) {
      r.offerTable = true;
    }
    return { ok: false, feedback: r.feedback, advanced: false };
  };

  Tutor.prototype.hint = function () {
    var s = this.step(); if (!s) return null;
    var rec = this.record();
    var list = s.hints || [];
    if (rec.hints >= list.length) {
      if (s.table && !rec.table) { rec.table = true; return { kind: 'table', table: s.table() }; }
      return { kind: 'none', text: 'No further hints. Work from the table and the endings.' };
    }
    var h = list[rec.hints++];
    return { kind: 'hint', text: (typeof h === 'function') ? h() : h, remaining: list.length - rec.hints };
  };

  Tutor.prototype.showTable = function () {
    var s = this.step(); if (!s || !s.table) return null;
    this.record().table = true;
    return s.table();
  };

  Tutor.prototype.summary = function () {
    var attempts = 0, hints = 0, tables = 0;
    this.log.forEach(function (l) { attempts += l.attempts; hints += l.hints; if (l.table) tables++; });
    return { steps: this.steps.length, attempts: attempts, hints: hints, tables: tables };
  };

  var API = {
    Tutor: Tutor, buildSteps: buildSteps,
    CASE_FULL: CASE_FULL, TENSE_FULL: TENSE_FULL, PERSON_FULL: PERSON_FULL
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Socratic = API;
})(typeof window !== 'undefined' ? window : this);
