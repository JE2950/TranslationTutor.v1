/* ============================================================
   parse.js — CE Latin sentence parser
   Chooses one reading per word by constraint search, records
   every ambiguity, and reports the clause structure the
   questioning will walk through.
   ============================================================ */
(function (root) {
  'use strict';

  var Morph = (typeof require !== 'undefined') ? require('./morph.js') : root.Morph;

  /* verbs that commonly take a following infinitive (prolative) */
  var PROLATIVE = { 'cupio': 1, 'constituo': 1, 'iubeo': 1, 'possum': 1, 'debeo': 1, 'volo': 1, 'nolo': 1, 'timeo': 1, 'paro': 1 };
  /* verbs taking a dative at CE */
  var DATIVE_VERBS = { 'do': 1, 'dico': 1, 'ostendo': 1, 'respondeo': 1, 'appropinquo': 1, 'persuadeo': 1, 'credo': 1, 'faveo': 1, 'impero': 1, 'placeo': 1, 'noceo': 1, 'pareo': 1 };
  /* verbs that are normally intransitive — an accusative near them is suspicious */
  var INTRANSITIVE = { 'sum': 1, 'adsum': 1, 'absum': 1, 'ambulo': 1, 'curro': 1, 'dormio': 1, 'festino': 1, 'venio': 1, 'discedo': 1, 'maneo': 1, 'rideo': 1, 'sedeo': 1, 'sto': 1, 'navigo': 1, 'laboro': 1, 'habito': 1, 'pugno': 1 };
  /* subordinating conjunctions open a new clause */
  var SUBORDINATORS = { 'quod': 1, 'ubi': 1, 'quamquam': 1, 'dum': 1, 'postquam': 1, 'si': 1, 'cum': 1, 'nisi': 1, 'antequam': 1, 'priusquam': 1 };
  var COORDINATORS = { 'et': 1, 'sed': 1, 'tamen': 1, 'itaque': 1, 'igitur': 1, 'deinde': 1, 'aut': 1, 'nam': 1, 'enim': 1 };

  function tokenize(text) {
    var out = [], re = /([A-Za-zÀ-ſ]+)|([?!.,;:])/g, m;
    while ((m = re.exec(text)) !== null) {
      if (m[1]) out.push({ raw: m[1], kind: 'word' });
      else out.push({ raw: m[2], kind: 'punct' });
    }
    return out;
  }

  /* collapse readings that are identical for teaching purposes */
  function signature(r) {
    var t = r.tags;
    if (t.pos === 'verb' && t.mood === 'ind') return ['v', r.lemma, t.tense, t.person, t.num].join('|');
    if (t.pos === 'verb') return ['v', r.lemma, t.mood, t.num || '', t.tense || ''].join('|');
    if (t.pos === 'noun' || t.pos === 'adj' || t.pos === 'pronoun' || t.pos === 'numeral') {
      return [t.pos, r.lemma, t['case'], t.num, t.gender || ''].join('|');
    }
    /* "in" is two words: in + accusative (into) and in + ablative (in).
       They must stay separate readings, or the case question disappears. */
    if (t.pos === 'prep') return ['prep', r.lemma, r.lex.prepCase].join('|');
    return [t.pos, r.lemma].join('|');
  }

  function dedupe(readings) {
    var seen = {}, out = [];
    readings.forEach(function (r) {
      var s = signature(r);
      if (seen[s]) return;
      seen[s] = 1; out.push(r);
    });
    return out;
  }

  /* ---------- clause splitting ---------- */
  function splitClauses(words) {
    var clauses = [], cur = { start: 0, words: [], marker: null };
    words.forEach(function (w, i) {
      var lem = w.readings.length ? w.readings[0].lemma : null;
      var isSub = w.readings.some(function (r) {
        return (r.tags.pos === 'conj' || r.tags.pos === 'adv') && SUBORDINATORS[r.lemma];
      });
      var isCoord = w.readings.some(function (r) {
        return (r.tags.pos === 'conj') && COORDINATORS[r.lemma];
      });
      // a subordinator starts a new clause; so does 'et'/'sed' when a finite
      // verb has already been seen in the current clause
      var hasVerb = cur.words.some(function (x) {
        return x.readings.some(function (r) { return r.tags.pos === 'verb' && r.tags.mood === 'ind'; });
      });
      if ((isSub && cur.words.length) || (isCoord && hasVerb)) {
        clauses.push(cur);
        cur = { start: i, words: [], marker: w };
        if (isSub) { cur.subordinator = lem; }
        cur.words.push(w);
        return;
      }
      cur.words.push(w);
    });
    if (cur.words.length) clauses.push(cur);

    /* A clause holding more than one unmistakable finite verb is really two
       clauses with no punctuation between them ("ubi dominus venit servi
       laborabant"). Split after each finite verb but the last. Only words
       whose every reading is a finite verb count, so an ambiguous noun/verb
       never triggers a split. */
    function definitelyFinite(w) {
      return w.readings.length > 0 && w.readings.every(function (r) {
        return r.tags.pos === 'verb' && (r.tags.mood === 'ind' || r.tags.mood === 'imp');
      });
    }
    var out = [];
    clauses.forEach(function (cl) {
      var vi = [];
      cl.words.forEach(function (w, i) { if (definitelyFinite(w)) vi.push(i); });
      if (vi.length < 2) { out.push(cl); return; }
      var from = 0;
      for (var k = 0; k < vi.length - 1; k++) {
        out.push({
          subordinator: from === 0 ? cl.subordinator : null,
          words: cl.words.slice(from, vi[k] + 1)
        });
        from = vi[k] + 1;
      }
      out.push({ subordinator: null, words: cl.words.slice(from) });
    });
    return out.filter(function (c) { return c.words.length; });
  }

  /* ---------- scoring a complete role assignment for one clause ----------
     Roles are assigned in the order a reader resolves them: prepositional
     phrases first (a preposition fixes its noun's case), then adjective
     agreement, then the person addressed, then subject, then object, then
     the remaining case uses. An adjective that agrees with nothing is
     treated as a noun in its own right (Graecos = "the Greeks").          */
  function scoreClause(words, pick) {
    var score = 0, notes = [], used = {}, agree = {};
    var verbIdx = [], prepIdx = [], N = words.length;

    function isNominal(r) {
      return r && (r.tags.pos === 'noun' || r.tags.pos === 'pronoun' || r.tags.pos === 'numeral' || r.tags.pos === 'adj');
    }
    function isNoun(r) {
      return r && (r.tags.pos === 'noun' || r.tags.pos === 'pronoun' || r.tags.pos === 'numeral');
    }

    for (var i = 0; i < N; i++) {
      var r = pick[i];
      if (!r) { score -= 6; continue; }
      if (r.tags.pos === 'verb' && (r.tags.mood === 'ind' || r.tags.mood === 'imp')) verbIdx.push(i);
      else if (r.tags.pos === 'prep') prepIdx.push(i);
    }

    if (verbIdx.length === 1) score += 14;
    else if (verbIdx.length === 0) score -= 12;
    else score -= 6 * (verbIdx.length - 1);

    var V = verbIdx.length ? pick[verbIdx[0]] : null;
    var imperative = !!(V && V.tags.mood === 'imp');
    var secondPerson = imperative || !!(V && V.tags.mood === 'ind' && V.tags.person === '2');

    /* 1. prepositional phrases */
    prepIdx.forEach(function (pi) {
      var want = pick[pi].lex.prepCase, found = -1;
      for (var j = pi + 1; j < N && j <= pi + 3; j++) {
        var rr = pick[j];
        if (!rr) continue;
        if (rr.tags.pos === 'verb' || rr.tags.pos === 'prep') break;
        if (isNoun(rr) && rr.tags['case'] === want) { found = j; break; }
        if (rr.tags.pos === 'adj' && rr.tags['case'] === want) continue; // adjective ahead of its noun
        break;
      }
      if (found >= 0) {
        score += 12; used[found] = 'prepobj'; used[pi] = 'prep';
        for (var k = pi + 1; k < found; k++) {
          var ar = pick[k];
          if (ar && ar.tags.pos === 'adj' && ar.tags['case'] === want &&
            ar.tags.num === pick[found].tags.num && ar.tags.gender === pick[found].tags.gender) {
            score += 5; used[k] = 'adj'; agree[k] = found;
          }
        }
      } else {
        score -= 10;
        notes.push('the preposition ' + pick[pi].display + ' has no noun in the ' + want + ' after it');
      }
    });

    /* 2. adjective agreement. With sum, a nominative adjective is the
       complement, not a description attached to the subject:
       "dominus est bonus" is "the master is good", never "the good
       master is". Leave those for step 6. */
    var copula = !!(V && V.lemma === 'sum' && V.tags.mood === 'ind');
    /* Exactly one nominative adjective becomes the complement — the last
       one, nearest the verb. Any others still describe their noun:
       "omnes milites fortes erant" is "all the soldiers were brave". */
    var reservedAdj = -1;
    if (copula) {
      for (var ri = 0; ri < N; ri++) {
        var rr2 = pick[ri];
        if (rr2 && rr2.tags.pos === 'adj' && rr2.tags['case'] === 'nom' && !used[ri]) reservedAdj = ri;
      }
    }
    for (var z = 0; z < N; z++) {
      var rz = pick[z];
      if (!rz || rz.tags.pos !== 'adj' || used[z]) continue;
      if (z === reservedAdj) continue;
      var best = -1, bestDist = 99;
      for (var y = 0; y < N; y++) {
        var ry = pick[y];
        if (!ry || y === z || used[y] === 'adj' || ry.tags.pos === 'adj') continue;
        if (!isNoun(ry)) continue;
        if (ry.tags['case'] === rz.tags['case'] && ry.tags.num === rz.tags.num &&
          (ry.tags.gender === rz.tags.gender || ry.tags.gender === 'c')) {
          var d = Math.abs(y - z);
          if (d < bestDist) { bestDist = d; best = y; }
        }
      }
      if (best >= 0) {
        score += 7 + (bestDist === 1 ? 3 : 0);
        used[z] = 'adj'; agree[z] = best;
      }
      // no agreeing noun: left free to serve as a noun itself, scored below
    }

    /* 3. the person addressed, where a comma marks it. A bare neuter noun is
       a thing, not someone addressed, so anything unmarked waits until the
       subject and object have been settled (step 7). */
    for (var vi2 = 0; vi2 < N; vi2++) {
      var rv = pick[vi2];
      if (!rv || used[vi2] || !isNominal(rv) || rv.tags['case'] !== 'voc') continue;
      if (!(words[vi2].commaBefore || words[vi2].commaAfter)) continue;
      score += secondPerson ? 15 : 7;
      used[vi2] = 'voc';
    }

    /* 4. subject */
    var subj = -1;
    if (V && V.tags.mood === 'ind') {
      var cands = [];
      for (var n = 0; n < N; n++) {
        if (used[n]) continue;
        var rn = pick[n];
        if (!isNominal(rn) || rn.tags['case'] !== 'nom') continue;
        if (rn.tags.num !== V.tags.num) continue;
        cands.push(n);
      }
      // a real noun outranks an adjective standing in for one
      cands.sort(function (a, b) {
        var aN = isNoun(pick[a]) ? 0 : 1, bN = isNoun(pick[b]) ? 0 : 1;
        return aN - bN || a - b;
      });
      if (cands.length) {
        subj = cands[0];
        var pr = pick[subj].tags.person;
        if (V.tags.person === '3' || (pr && pr === V.tags.person)) {
          score += 12; used[subj] = 'subject';
          if (!isNoun(pick[subj])) score -= 2; // substantive: slightly less expected
        } else {
          score -= 8; notes.push('the subject does not match the person of the verb');
        }
      } else if (V.tags.person === '3') score += 4;  // subject inside the verb ending
      else score += 6;                               // I / we / you: no noun needed
    }

    /* 5. direct object */
    var obj = -1;
    var ocands = [];
    for (var a = 0; a < N; a++) {
      if (used[a]) continue;
      var ra = pick[a];
      if (!isNominal(ra) || ra.tags['case'] !== 'acc') continue;
      ocands.push(a);
    }
    ocands.sort(function (x, b) {
      var xN = isNoun(pick[x]) ? 0 : 1, bN = isNoun(pick[b]) ? 0 : 1;
      return xN - bN || x - b;
    });
    if (ocands.length) {
      obj = ocands[0];
      if (V && INTRANSITIVE[V.lemma]) { score -= 4; notes.push(V.display + ' does not usually take an object'); }
      else if (V) {
        score += 11; used[obj] = 'object';
        if (!isNoun(pick[obj])) score -= 2;
      } else score -= 8;
    }

    /* 6. complement after sum */
    if (V && V.lemma === 'sum') {
      for (var c2 = 0; c2 < N; c2++) {
        if (used[c2]) continue;
        var rc = pick[c2];
        if (isNominal(rc) && rc.tags['case'] === 'nom') { score += 9; used[c2] = 'complement'; break; }
      }
    }

    /* 7. everything else */
    for (var g = 0; g < N; g++) {
      var rg = pick[g];
      if (!rg || used[g] || g === verbIdx[0]) continue;
      var cs = rg.tags['case'];
      if (cs === 'gen') { score += 5; used[g] = 'gen'; }
      else if (cs === 'dat') { score += (V && DATIVE_VERBS[V.lemma]) ? 8 : 4; used[g] = 'dat'; }
      else if (cs === 'abl') { score += 4; used[g] = 'abl'; }
      else if (cs === 'voc') {
        var neuter = rg.tags.gender === 'n';
        score += (secondPerson && !neuter) ? 8 : 1;
        used[g] = 'voc';
      }
      else if (rg.tags.pos === 'adv') { score += 5; used[g] = 'adv'; }
      else if (rg.tags.pos === 'conj') { score += 5; used[g] = 'conj'; }
      else if (rg.tags.pos === 'question') { score += 6; used[g] = 'question'; }
      else if (rg.tags.mood === 'inf') { score += (V && PROLATIVE[V.lemma]) ? 10 : 2; used[g] = 'inf'; }
      else if (rg.tags.pos === 'adj') { score -= 2; notes.push(rg.display + ' does not agree with any noun here'); }
    }

    /* verb-final is the Latin norm — a mild preference only */
    if (verbIdx.length === 1 && verbIdx[0] === N - 1) score += 3;

    for (var u = 0; u < N; u++) if (pick[u] && !used[u] && u !== verbIdx[0]) score -= 3;

    return {
      score: score, roles: used, notes: notes, agree: agree,
      verbIdx: verbIdx.length ? verbIdx[0] : null,
      allVerbs: verbIdx, subjIdx: subj, objIdx: obj, imperative: imperative
    };
  }

  /* ---------- depth-first search over readings ---------- */
  function solveClause(words) {
    var best = null, nodes = 0, CAP = 60000;
    var choices = words.map(function (w) { return w.readings.length ? w.readings : [null]; });
    var pick = new Array(words.length);

    (function dfs(i) {
      if (nodes > CAP) return;
      if (i === words.length) {
        nodes++;
        var s = scoreClause(words, pick);
        if (!best || s.score > best.score) best = { score: s.score, pick: pick.slice(), info: s };
        return;
      }
      var opts = choices[i];
      for (var j = 0; j < opts.length; j++) {
        pick[i] = opts[j];
        dfs(i + 1);
        if (nodes > CAP) return;
      }
    })(0);

    if (!best) best = { score: 0, pick: words.map(function (w) { return w.readings[0] || null; }), info: scoreClause(words, words.map(function (w) { return w.readings[0] || null; })) };
    return best;
  }

  /* ---------- public parse ---------- */
  function parse(lexicon, text) {
    var toks = tokenize(text);
    var words = [], punct = [];
    var marked = /\?/.test(text);
    var pendingComma = false;
    toks.forEach(function (t) {
      if (t.kind === 'punct') {
        punct.push(t.raw);
        if (t.raw === ',' || t.raw === ';' || t.raw === ':') {
          if (words.length) words[words.length - 1].commaAfter = true;
          pendingComma = true;
        }
        return;
      }
      var a = Morph.analyse(lexicon, t.raw);
      var rs = dedupe(a.readings);
      /* "ubi" is both "where?" and "when". Without a question mark, take the
         conjunction. Words that are only question words (quis, quid) stay. */
      if (!marked && rs.length > 1) {
        var kept = rs.filter(function (r) { return r.tags.pos !== 'question'; });
        if (kept.length) rs = kept;
      }
      words.push({
        raw: t.raw,
        norm: a.word,
        enclitic: a.enclitic,
        unknown: a.unknown,
        commaBefore: pendingComma,
        commaAfter: false,
        readings: rs
      });
      pendingComma = false;
    });

    var unknowns = words.filter(function (w) { return w.unknown; }).map(function (w) { return w.raw; });

    var clauses = splitClauses(words);
    var solved = clauses.map(function (c) {
      var s = solveClause(c.words);
      return {
        subordinator: c.subordinator || null,
        words: c.words,
        pick: s.pick,
        score: s.score,
        info: s.info
      };
    });

    // write the chosen reading and role back onto each word
    solved.forEach(function (cl) {
      cl.words.forEach(function (w, i) {
        w.chosen = cl.pick[i];
        w.role = cl.info.roles[i] || null;
        if (i === cl.info.verbIdx) w.role = 'verb';
        else if (cl.info.allVerbs.indexOf(i) >= 0) w.role = 'verb';
        if (cl.info.agree[i] != null) w.agreesWith = cl.words[cl.info.agree[i]];
        w.clause = cl;
      });
    });

    var isQuestion = punct.indexOf('?') >= 0 ||
      words.some(function (w) {
        return w.enclitic === 'ne' || (w.chosen && w.chosen.tags.pos === 'question');
      });

    return {
      text: text,
      words: words,
      clauses: solved,
      unknowns: unknowns,
      isQuestion: isQuestion,
      punct: punct,
      ok: unknowns.length === 0 && solved.some(function (c) { return c.info.verbIdx != null; })
    };
  }

  /* ---------- ambiguity report, for the questioning ---------- */
  function ambiguity(word) {
    var byCase = {}, byTense = {}, lemmas = {};
    word.readings.forEach(function (r) {
      lemmas[r.lemma] = 1;
      if (r.tags['case']) byCase[r.tags['case'] + ' ' + (r.tags.num === 's' ? 'singular' : 'plural')] = 1;
      if (r.tags.tense && r.tags.mood === 'ind') byTense[r.tags.tense] = 1;
    });
    return {
      cases: Object.keys(byCase),
      tenses: Object.keys(byTense),
      lemmas: Object.keys(lemmas),
      ambiguousCase: Object.keys(byCase).length > 1,
      ambiguousLemma: Object.keys(lemmas).length > 1
    };
  }

  var API = { parse: parse, tokenize: tokenize, ambiguity: ambiguity, signature: signature, PROLATIVE: PROLATIVE, INTRANSITIVE: INTRANSITIVE };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Parse = API;
})(typeof window !== 'undefined' ? window : this);
