/* ============================================================
   english.js — English generation and marking
   Builds the acceptable English for a parsed Latin sentence as
   ordered slots, then marks a typed translation generously:
   any fair version passes, and a wrong tense or number is named
   rather than simply failed.
   ============================================================ */
(function (root) {
  'use strict';

  /* ---------- English irregular verbs ----------
     Keyed on the head word of the gloss. past = simple past,
     pp = past participle where it differs from the past.        */
  var IRREG = {
    'am': { s: 'is', ing: 'being', past: 'was', pastPl: 'were', pp: 'been' },
    'build': { past: 'built' }, 'sing': { past: 'sang', pp: 'sung' },
    'give': { past: 'gave', pp: 'given' }, 'stand': { past: 'stood' },
    'have': { s: 'has', past: 'had' }, 'hold': { past: 'held' },
    'see': { past: 'saw', pp: 'seen' }, 'drink': { past: 'drank', pp: 'drunk' },
    'eat': { past: 'ate', pp: 'eaten' }, 'run': { past: 'ran', ing: 'running' },
    'say': { past: 'said' }, 'lead': { past: 'led' }, 'read': { past: 'read' },
    'choose': { past: 'chose', pp: 'chosen' }, 'send': { past: 'sent' },
    'put': { past: 'put', ing: 'putting' }, 'write': { past: 'wrote', pp: 'written' },
    'hear': { past: 'heard' }, 'sleep': { past: 'slept' }, 'come': { past: 'came', pp: 'come' },
    'take': { past: 'took', pp: 'taken' }, 'do': { s: 'does', past: 'did', pp: 'done' },
    'make': { past: 'made' }, 'throw': { past: 'threw', pp: 'thrown' },
    'fight': { past: 'fought' }, 'sit': { past: 'sat', ing: 'sitting' },
    'go': { s: 'goes', past: 'went', pp: 'gone' }, 'bring': { past: 'brought' },
    'carry': { s: 'carries', past: 'carried' }, 'hurry': { s: 'hurries', past: 'hurried' },
    'try': { s: 'tries', past: 'tried' }, 'reply': { s: 'replies', past: 'replied' },
    'buy': { past: 'bought' }, 'catch': { s: 'catches', past: 'caught' },
    'teach': { s: 'teaches', past: 'taught' }, 'seek': { past: 'sought' },
    'leave': { past: 'left' }, 'lose': { past: 'lost' }, 'find': { past: 'found' },
    'win': { past: 'won', ing: 'winning' }, 'begin': { past: 'began', ing: 'beginning', pp: 'begun' },
    'become': { past: 'became', ing: 'becoming', pp: 'become' },
    'set out': { past: 'set out', ing: 'setting out' }, 'know': { past: 'knew', pp: 'known' },
    'flee': { past: 'fled', ing: 'fleeing' }, 'fall': { past: 'fell', pp: 'fallen' },
    'drive': { past: 'drove', ing: 'driving', pp: 'driven' },
    'die': { past: 'died', ing: 'dying' }, 'kill': { past: 'killed' },
    'sell': { past: 'sold' }, 'wish': { s: 'wishes', past: 'wished' },
    'watch': { s: 'watches', past: 'watched' }, 'push': { s: 'pushes', past: 'pushed' },
    'rush': { s: 'rushes', past: 'rushed' }, 'cross': { s: 'crosses', past: 'crossed' },
    'praise': { past: 'praised', ing: 'praising' }, 'love': { past: 'loved', ing: 'loving' },
    'like': { past: 'liked', ing: 'liking' }, 'live': { past: 'lived', ing: 'living' },
    'move': { past: 'moved', ing: 'moving' }, 'prepare': { past: 'prepared', ing: 'preparing' },
    'arrive': { past: 'arrived', ing: 'arriving' }, 'decide': { past: 'decided', ing: 'deciding' },
    'destroy': { past: 'destroyed' }, 'enter': { past: 'entered' },
    'overcome': { past: 'overcame', ing: 'overcoming', pp: 'overcome' },
    'understand': { past: 'understood' }, 'hide': { past: 'hid', ing: 'hiding', pp: 'hidden' }
  };

  var IRREG_PLURAL = {
    'man': 'men', 'woman': 'women', 'child': 'children', 'foot': 'feet',
    'tooth': 'teeth', 'wife': 'wives', 'life': 'lives', 'knife': 'knives',
    'person': 'people', 'mouse': 'mice', 'goose': 'geese', 'ox': 'oxen',
    'sheep': 'sheep', 'fish': 'fish', 'deer': 'deer', 'money': 'money',
    'gold': 'gold', 'water': 'water', 'food': 'food', 'help': 'help',
    'anger': 'anger', 'wine': 'wine', 'advice': 'advice', 'news': 'news'
  };

  /* ---------- extra accepted English ----------
     The word list's own gloss is the primary meaning. These are the
     further renderings an ISEB marker would tick, so a boy is not told
     he is wrong for writing "leave" for discedo. Add to this table
     freely; it only ever widens what is accepted, never what is taught. */
  var SYNONYMS = {
    'moneo': ['advise'], 'discedo': ['leave', 'go away', 'depart from'],
    'specto': ['look at', 'watch', 'gaze at'], 'consumo': ['eat up', 'consume'],
    'neco': ['slay', 'put to death'], 'supero': ['defeat', 'beat', 'surpass'],
    'oppugno': ['assault', 'attack'], 'constituo': ['determine', 'establish', 'decide'],
    'cupio': ['wish', 'long for', 'be eager'], 'festino': ['hasten'],
    'habito': ['dwell', 'inhabit'], 'intro': ['go into', 'go in'],
    'iubeo': ['command', 'tell'], 'maneo': ['wait', 'await'],
    'ostendo': ['point out', 'reveal'], 'paro': ['get ready'],
    'rogo': ['ask for', 'request'], 'teneo': ['keep', 'grasp'],
    'terreo': ['terrify', 'scare'], 'timeo': ['be afraid of', 'be afraid', 'am afraid of'],
    'video': ['catch sight of'], 'voco': ['summon'], 'duco': ['take', 'march'],
    'pono': ['place', 'set'], 'rego': ['guide', 'govern'], 'lego': ['pick', 'gather'],
    'dico': ['speak', 'tell'], 'facio': ['make', 'do'], 'capio': ['seize', 'capture', 'take'],
    'iacio': ['hurl', 'cast'], 'ambulo': ['go for a walk'],
    'respondeo': ['reply', 'answer'], 'rideo': ['smile'], 'clamo': ['cry out', 'yell'],
    'laboro': ['toil'], 'aedifico': ['construct'],
    /* nouns and adjectives */
    'villa': ['villa', 'house', 'country house', 'farmhouse'],
    'dominus': ['lord', 'owner'], 'domina': ['lady', 'mistress'],
    'ancilla': ['slave-girl', 'maid', 'servant'], 'servus': ['slave', 'servant'],
    'magister': ['master', 'teacher', 'schoolmaster'],
    'nuntius': ['messenger', 'message', 'news'],
    'oppidum': ['town'], 'via': ['way', 'street', 'road'],
    'forum': ['market place', 'marketplace'], 'cena': ['dinner', 'meal', 'supper'],
    'liber': ['book'], 'puer': ['boy', 'child'], 'vir': ['man', 'husband'],
    'turba': ['mob', 'throng'], 'incola': ['inhabitant', 'native'],
    'patria': ['fatherland', 'native land', 'homeland', 'country'],
    'consilium': ['plan', 'advice', 'idea'], 'auxilium': ['help', 'aid'],
    'periculum': ['danger', 'peril'], 'proelium': ['battle', 'fight'],
    'laetus': ['glad', 'cheerful'], 'iratus': ['furious'], 'saevus': ['fierce', 'cruel'],
    'fessus': ['weary', 'exhausted'], 'notus': ['famous', 'known', 'well-known'],
    'clarus': ['bright', 'clear', 'famous'], 'magnus': ['large', 'great'],
    'parvus': ['little', 'small'], 'malus': ['evil', 'wicked', 'bad'],
    'altus': ['tall', 'deep'], 'validus': ['healthy', 'sturdy'],
    'perterritus': ['terrified', 'very frightened'],
    'pulcher': ['handsome', 'lovely', 'pretty'], 'miser': ['unhappy', 'miserable', 'poor'],
    'tutus': ['secure'], 'novus': ['fresh']
  };

  /* adjectives that behave as determiners in English and so come before
     the article: "all the soldiers", "many of the books" */
  var DETERMINERS = { 'all': 1, 'many': 1, 'much': 1, 'every': 1, 'both': 1, 'half': 1 };

  function splitGloss(eng) {
    return String(eng || '').split(/[,;/]/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  /* gloss list for a reading: the word list first, then the extras */
  function glossesFor(reading) {
    var base = splitGloss(reading.eng).map(function (b) {
      return b.replace(/\s*\([^)]*\)/g, '').trim();
    }).filter(Boolean);
    var extra = SYNONYMS[reading.lemma] || [];
    var seen = {}, out = [];
    base.concat(extra).forEach(function (g) {
      var k = g.toLowerCase();
      if (!k || seen[k]) return; seen[k] = 1; out.push(g);
    });
    return out;
  }

  /* strip the dictionary "I " from a verb gloss: "I love" → "love" */
  function verbStem(g) { return g.replace(/^i\s+/i, '').trim(); }

  function headAndTail(phrase) {
    var m = String(phrase).trim().split(/\s+/);
    return { head: m[0], tail: m.slice(1).join(' ') };
  }
  function join(head, tail) { return tail ? head + ' ' + tail : head; }

  function v3s(phrase) {
    var ht = headAndTail(phrase), h = ht.head, I = IRREG[h] || IRREG[phrase];
    var s;
    if (I && I.s) s = I.s;
    else if (/(s|sh|ch|x|z|o)$/.test(h)) s = h + 'es';
    else if (/[^aeiou]y$/.test(h)) s = h.slice(0, -1) + 'ies';
    else s = h + 's';
    return join(s, ht.tail);
  }
  function ving(phrase) {
    var ht = headAndTail(phrase), h = ht.head, I = IRREG[h] || IRREG[phrase];
    var s;
    if (I && I.ing) s = I.ing;
    else if (/ie$/.test(h)) s = h.slice(0, -2) + 'ying';
    else if (/e$/.test(h) && h.length > 2) s = h.slice(0, -1) + 'ing';
    else s = h + 'ing';
    return join(s, ht.tail);
  }
  function vpast(phrase, plural) {
    var ht = headAndTail(phrase), h = ht.head, I = IRREG[h] || IRREG[phrase];
    var s;
    if (I && plural && I.pastPl) s = I.pastPl;
    else if (I && I.past) s = I.past;
    else if (/e$/.test(h)) s = h + 'd';
    else if (/[^aeiou]y$/.test(h)) s = h.slice(0, -1) + 'ied';
    else s = h + 'ed';
    return join(s, ht.tail);
  }
  function vpp(phrase) {
    var ht = headAndTail(phrase), h = ht.head, I = IRREG[h] || IRREG[phrase];
    if (I && I.pp) return join(I.pp, ht.tail);
    return vpast(phrase, false);
  }

  function pluralise(noun) {
    var w = String(noun).trim();
    // pluralise the head noun of "slave-girl" / "country house"
    var bits = w.split(' ');
    var last = bits[bits.length - 1];
    if (IRREG_PLURAL[w]) return IRREG_PLURAL[w];
    var p;
    if (IRREG_PLURAL[last]) p = IRREG_PLURAL[last];
    else if (/(s|sh|ch|x|z)$/.test(last)) p = last + 'es';
    else if (/[^aeiou]y$/.test(last)) p = last.slice(0, -1) + 'ies';
    else if (/f$/.test(last)) p = last.slice(0, -1) + 'ves';
    else p = last + 's';
    bits[bits.length - 1] = p;
    return bits.join(' ');
  }

  /* ---------- pronoun English ---------- */
  var PRON_ENG = {
    'ego': { nom: ['i'], acc: ['me'] },
    'nos': { nom: ['we'], acc: ['us'] },
    'tu': { nom: ['you'], acc: ['you'] },
    'vos': { nom: ['you', 'you all'], acc: ['you', 'you all'] }
  };

  /* subject words supplied by a verb ending with no noun subject */
  var PERSON_SUBJ = {
    '1s': ['i'], '2s': ['you'], '3s': ['he', 'she', 'it'],
    '1p': ['we'], '2p': ['you'], '3p': ['they']
  };

  /* ---------- preposition English by case ---------- */
  var PREP_ENG = {
    'in|acc': ['into', 'onto', 'in to'],
    'in|abl': ['in', 'on'],
    'a/ab|abl': ['from', 'away from', 'by'],
    'e/ex|abl': ['out of', 'from', 'out from'],
    'ad|acc': ['to', 'towards', 'at'],
    'cum|abl': ['with'],
    'de|abl': ['down from', 'from', 'about', 'concerning'],
    'per|acc': ['through', 'along'],
    'prope|acc': ['near', 'near to'],
    'trans|acc': ['across', 'over'],
    'contra|acc': ['against']
  };

  /* ============================================================
     noun / adjective / verb English for a chosen reading
     ============================================================ */

  function nounEnglish(reading, opts) {
    opts = opts || {};
    var plural = reading.tags.num === 'p';
    var lemma = reading.lemma;
    if (PRON_ENG[lemma]) {
      var cs = reading.tags['case'] === 'acc' ? 'acc' : 'nom';
      return PRON_ENG[lemma][cs].slice();
    }
    var base = glossesFor(reading);
    var out = [];
    base.forEach(function (b) {
      if (!b) return;
      var n = plural ? pluralise(b) : b;
      var proper = /^[A-Z]/.test(reading.display);
      if (proper) { out.push(n); return; }
      out.push('the ' + n);
      if (!plural) { out.push('a ' + n); out.push('an ' + n); }
      out.push(n);
      if (plural) out.push('some ' + n);
    });
    return out;
  }

  function adjEnglish(reading) { return glossesFor(reading); }

  /* every English rendering of a verb reading that a marker would tick */
  function verbEnglish(reading) {
    var t = reading.tags, out = [];
    var stems = glossesFor(reading).map(verbStem).filter(Boolean);
    var plural = t.num === 'p';
    var third = t.person === '3';

    stems.forEach(function (st) {
      if (t.mood === 'inf') { out.push('to ' + st); out.push(st); return; }
      if (t.mood === 'imp') { out.push(st); return; }

      /* glosses built on the verb "to be": "I am", "I am present",
         "I am away", "I am afraid". The copula inflects and whatever
         follows it stays put — "was present", never "was being present". */
      var ht = headAndTail(st);
      if (ht.head === 'am') {
        var tail = ht.tail;
        var be;
        if (t.tense === 'pres') be = (t.person === '1' && !plural) ? 'am' : ((third && !plural) ? 'is' : 'are');
        else if (t.tense === 'impf' || t.tense === 'perf') be = (plural || t.person === '2') ? 'were' : 'was';
        else if (t.tense === 'fut') be = 'will be';
        else be = 'had been';
        out.push(join(be, tail));
        if (t.tense === 'perf') out.push(join((third && !plural) ? 'has been' : 'have been', tail));
        if (t.tense === 'impf' && tail) out.push(join('used to be', tail));
        return;
      }

      /* the passive (Level 2): "is punished", "was being punished" */
      if (t.voice === 'pass') {
        var be, beCont;
        if (t.tense === 'pres') {
          be = (t.person === '1' && !plural) ? 'am' : ((third && !plural) ? 'is' : 'are');
          beCont = be + ' being';
        } else if (t.tense === 'impf') {
          be = (plural || t.person === '2') ? 'were' : 'was';
          beCont = be + ' being';
        } else if (t.tense === 'fut') { be = 'will be'; beCont = 'will be being'; }
        else { be = (third && !plural) ? 'has been' : 'have been'; beCont = be; }
        out.push(be + ' ' + vpp(st));
        if (beCont !== be) out.push(beCont + ' ' + vpp(st));
        if (t.tense === 'impf') out.push('used to be ' + vpp(st));
        return;
      }

      if (t.tense === 'pres') {
        if (third && !plural) { out.push(v3s(st)); out.push('is ' + ving(st)); out.push('does ' + st); }
        else { out.push(st); out.push('are ' + ving(st)); out.push('am ' + ving(st)); out.push('do ' + st); }
      } else if (t.tense === 'impf') {
        var wasWere = plural ? 'were' : 'was';
        if (t.person === '2') wasWere = 'were';
        out.push(wasWere + ' ' + ving(st));   // continuous
        out.push('used to ' + st);            // habitual
        out.push('would ' + st);              // repeated
        out.push('began to ' + st);           // inceptive
        out.push('started to ' + st);
        out.push('kept ' + ving(st));
        out.push(vpast(st, plural));          // simple past, often acceptable
      } else if (t.tense === 'perf') {
        out.push(vpast(st, plural));
        out.push((third && !plural ? 'has ' : 'have ') + vpp(st));
        out.push('did ' + st);
      } else if (t.tense === 'fut') {
        out.push('will ' + st); out.push('shall ' + st); out.push('is going to ' + st);
      } else if (t.tense === 'plupf') {
        out.push('had ' + vpp(st));
      }
    });
    return out;
  }

  /* the same verb in the WRONG tense — used to say "check the tense"
     rather than only "wrong" */
  function verbWrongTense(reading) {
    var t = reading.tags, map = {};
    ['pres', 'impf', 'perf', 'fut', 'plupf'].forEach(function (tn) {
      if (tn === t.tense) return;
      var fake = { lemma: reading.lemma, eng: reading.eng, display: reading.display, tags: { pos: 'verb', mood: 'ind', tense: tn, person: t.person, num: t.num } };
      verbEnglish(fake).forEach(function (f) { map[f] = tn; });
    });
    return map;
  }
  function verbWrongNumber(reading) {
    var t = reading.tags, map = {};
    var other = t.num === 's' ? 'p' : 's';
    var fake = { lemma: reading.lemma, eng: reading.eng, display: reading.display, tags: { pos: 'verb', mood: 'ind', tense: t.tense, person: t.person, num: other } };
    verbEnglish(fake).forEach(function (f) { map[f] = other; });
    return map;
  }
  function nounWrongNumber(reading) {
    var other = reading.tags.num === 's' ? 'p' : 's';
    var fake = { lemma: reading.lemma, eng: reading.eng, display: reading.display, tags: { pos: reading.tags.pos, 'case': reading.tags['case'], num: other, gender: reading.tags.gender } };
    var map = {};
    nounEnglish(fake).forEach(function (f) { map[f] = other; });
    return map;
  }

  /* ============================================================
     SLOTS — the acceptable English, in English order
     ============================================================ */

  var TENSE_NAME = { pres: 'present', impf: 'imperfect', perf: 'perfect', fut: 'future', plupf: 'pluperfect' };
  var CASE_NAME = { nom: 'nominative', voc: 'vocative', acc: 'accusative', gen: 'genitive', dat: 'dative', abl: 'ablative' };

  function slotsForClause(cl) {
    var slots = [], words = cl.words, pick = cl.pick, info = cl.info;
    var taken = {};

    function adjsFor(idx) {
      var out = [];
      words.forEach(function (w, i) {
        if (i === idx) return;
        if (info.agree[i] === idx && pick[i] && pick[i].tags.pos === 'adj') { out.push(i); taken[i] = 1; }
      });
      return out;
    }
    function nounPhrase(idx, kind) {
      var adjIdx = adjsFor(idx);
      /* an adjective filling a noun's place — a predicate ("the temples are
         high") or a substantive ("the Greeks") — takes no article */
      if (pick[idx].tags.pos === 'adj') {
        taken[idx] = 1;
        var forms = adjEnglish(pick[idx]);
        if (pick[idx].tags.num === 'p' && kind !== 'complement') {
          forms = forms.concat(forms.map(function (f) { return 'the ' + pluralise(f); }))
            .concat(forms.map(function (f) { return pluralise(f); }));
        }
        return {
          kind: kind, wordIdx: idx, adjIdx: [], latin: words[idx].raw,
          accept: dedupeStrings(forms), wrongNumber: {}, required: true,
          caseName: CASE_NAME[pick[idx].tags['case']], num: pick[idx].tags.num,
          isAdj: true
        };
      }
      var nounForms = nounEnglish(pick[idx]);
      var accept = [];
      if (!adjIdx.length) accept = nounForms.slice();
      else {
        var adjForms = adjIdx.map(function (i) { return adjEnglish(pick[i]); });
        // "the happy girl" / "happy girl" / "the girl, happy"
        nounForms.forEach(function (nf) {
          var m = nf.match(/^(the |a |an |some )?(.*)$/);
          var art = m[1] || '', core = m[2];
          function build(list, before, after) {
            if (!list.length) {
              accept.push((before + art + after + core).replace(/\s+/g, ' ').trim());
              return;
            }
            list[0].forEach(function (a) {
              /* "all the soldiers", not "the all soldiers" */
              if (DETERMINERS[a]) build(list.slice(1), before + a + ' ', after);
              else build(list.slice(1), before, after + a + ' ');
            });
          }
          build(adjForms, '', '');
        });
      }
      taken[idx] = 1;
      return {
        kind: kind, wordIdx: idx, adjIdx: adjIdx,
        latin: words[idx].raw,
        accept: dedupeStrings(accept),
        wrongNumber: nounWrongNumber(pick[idx]),
        required: true,
        caseName: CASE_NAME[pick[idx].tags['case']],
        num: pick[idx].tags.num
      };
    }

    /* opening conjunction */
    words.forEach(function (w, i) {
      if (taken[i] || !pick[i]) return;
      if (pick[i].tags.pos === 'conj' || (pick[i].tags.pos === 'question')) {
        taken[i] = 1;
        slots.push({ kind: 'conj', wordIdx: i, latin: w.raw, accept: splitGloss(pick[i].eng).map(function (s) { return s.replace(/\?/g, '').trim(); }), required: true, lead: true });
      }
    });

    /* person addressed */
    words.forEach(function (w, i) {
      if (taken[i] || info.roles[i] !== 'voc') return;
      taken[i] = 1;
      slots.push({ kind: 'voc', wordIdx: i, latin: w.raw, accept: nounEnglish(pick[i]), required: false });
    });

    /* subject */
    var V = info.verbIdx != null ? pick[info.verbIdx] : null;
    if (info.subjIdx != null && info.subjIdx >= 0 && pick[info.subjIdx]) {
      slots.push(nounPhrase(info.subjIdx, 'subject'));
    } else if (V && V.tags.mood === 'ind') {
      var pk = V.tags.person + V.tags.num;
      slots.push({
        kind: 'subject-in-verb', wordIdx: info.verbIdx, latin: words[info.verbIdx].raw,
        accept: PERSON_SUBJ[pk] || [], required: true, fromEnding: true
      });
    }

    /* verb */
    if (info.verbIdx != null && V) {
      taken[info.verbIdx] = 1;
      slots.push({
        kind: 'verb', wordIdx: info.verbIdx, latin: words[info.verbIdx].raw,
        accept: dedupeStrings(verbEnglish(V)),
        wrongTense: V.tags.mood === 'ind' ? verbWrongTense(V) : {},
        wrongNumber: V.tags.mood === 'ind' ? verbWrongNumber(V) : {},
        required: true,
        tenseName: TENSE_NAME[V.tags.tense],
        person: V.tags.person, num: V.tags.num, mood: V.tags.mood
      });
    }

    /* object, then complement. Only if the role was actually granted —
       an intransitive verb leaves a stray accusative unassigned. */
    if (info.objIdx != null && info.objIdx >= 0 && pick[info.objIdx] &&
      info.roles[info.objIdx] === 'object' && !taken[info.objIdx]) {
      slots.push(nounPhrase(info.objIdx, 'object'));
    }
    words.forEach(function (w, i) {
      if (taken[i] || info.roles[i] !== 'complement') return;
      slots.push(nounPhrase(i, 'complement'));
    });

    /* dative — "to the slaves" reads better than the bare noun, so it leads */
    words.forEach(function (w, i) {
      if (taken[i] || info.roles[i] !== 'dat') return;
      var np = nounPhrase(i, 'dative');
      var bare = np.accept.slice();
      np.accept = dedupeStrings(
        bare.map(function (s) { return 'to ' + s; })
          .concat(bare.map(function (s) { return 'for ' + s; }))
          .concat(bare)
      );
      slots.push(np);
    });

    /* prepositional phrases */
    words.forEach(function (w, i) {
      if (taken[i] || info.roles[i] !== 'prep') return;
      var objI = -1;
      words.forEach(function (x, j) { if (info.roles[j] === 'prepobj' && j > i && objI < 0) objI = j; });
      if (objI < 0) return;
      var pr = pick[i], pc = pr.lex.prepCase;
      var preps = (PREP_ENG[pr.lemma + '|' + pc] || splitGloss(pr.eng)).slice();
      /* with a passive verb, a/ab marks the agent: "by the master" */
      var Vp = info.verbIdx != null ? pick[info.verbIdx] : null;
      if (pr.lemma === 'a/ab' && Vp && Vp.tags.voice === 'pass') {
        preps = ['by'].concat(preps.filter(function (x) { return x !== 'by'; }));
      }
      var np = nounPhrase(objI, 'prepobj');
      var accept = [];
      preps.forEach(function (p) { np.accept.forEach(function (n) { accept.push(p + ' ' + n); }); });
      taken[i] = 1;
      slots.push({
        kind: 'prep-phrase', wordIdx: i, objIdx: objI,
        latin: words[i].raw + ' ' + words[objI].raw,
        accept: dedupeStrings(accept), required: true,
        prepLemma: pr.lemma, prepCase: pc,
        wrongCase: wrongPrepCase(pr, np)
      });
    });

    /* genitive. It belongs beside the noun it depends on, so record which
       one and move it there in the ordering pass below. */
    words.forEach(function (w, i) {
      if (taken[i] || info.roles[i] !== 'gen') return;
      var np = nounPhrase(i, 'genitive');
      var acc = [];
      np.accept.forEach(function (s) {
        acc.push('of ' + s);
        var bare = s.replace(/^(the |a |an |some )/, '');
        acc.push(bare + "'s"); acc.push('of the ' + bare);
      });
      np.accept = dedupeStrings(acc);
      var head = -1, dist = 99;
      words.forEach(function (x, j) {
        if (j === i || !pick[j]) return;
        var rj = info.roles[j];
        if (rj !== 'subject' && rj !== 'object' && rj !== 'complement' && rj !== 'prepobj') return;
        var d = Math.abs(i - j);
        if (d < dist) { dist = d; head = j; }
      });
      np.attachTo = head;
      slots.push(np);
    });

    /* ablative on its own */
    words.forEach(function (w, i) {
      if (taken[i] || info.roles[i] !== 'abl') return;
      var np = nounPhrase(i, 'ablative');
      var acc = [];
      np.accept.forEach(function (s) { acc.push(s); acc.push('by ' + s); acc.push('with ' + s); acc.push('in ' + s); });
      np.accept = dedupeStrings(acc);
      np.required = false;
      slots.push(np);
    });

    /* infinitive */
    words.forEach(function (w, i) {
      if (taken[i] || info.roles[i] !== 'inf') return;
      taken[i] = 1;
      slots.push({ kind: 'infinitive', wordIdx: i, latin: w.raw, accept: dedupeStrings(verbEnglish(pick[i])), required: true });
    });

    /* adverbs and numerals */
    words.forEach(function (w, i) {
      if (taken[i] || !pick[i]) return;
      var role = info.roles[i];
      if (role === 'adv' || role === 'num') {
        taken[i] = 1;
        slots.push({ kind: role === 'adv' ? 'adverb' : 'numeral', wordIdx: i, latin: w.raw, accept: splitGloss(pick[i].eng), required: true });
      }
    });

    /* ---- ordering pass ----
       A genitive sits beside the noun it depends on; the person addressed
       by an order comes after the order itself ("Listen to the teacher,
       boys!" not "Boys listen to the teacher"). */
    var gens = slots.filter(function (s) { return s.kind === 'genitive' && s.attachTo >= 0; });
    gens.forEach(function (g) {
      var from = slots.indexOf(g);
      slots.splice(from, 1);
      var at = -1;
      slots.forEach(function (s, i) { if (s.wordIdx === g.attachTo) at = i; });
      if (at >= 0) slots.splice(at + 1, 0, g); else slots.push(g);
    });
    if (info.imperative) {
      var vocs = slots.filter(function (s) { return s.kind === 'voc'; });
      vocs.forEach(function (v) {
        slots.splice(slots.indexOf(v), 1);
        slots.push(v);
      });
    }

    return slots;
  }

  function wrongPrepCase(prepReading, np) {
    // "in + ablative" misread as "in + accusative" is the classic slip
    var other = prepReading.lex.prepCase === 'acc' ? 'abl' : 'acc';
    var key = prepReading.lemma + '|' + other;
    var alt = PREP_ENG[key];
    if (!alt) return {};
    var map = {};
    alt.forEach(function (p) {
      np.accept.forEach(function (n) { map[p + ' ' + n] = other; });
    });
    return map;
  }

  function dedupeStrings(a) {
    var seen = {}, out = [];
    a.forEach(function (s) {
      s = String(s).replace(/\s+/g, ' ').trim().toLowerCase();
      if (!s || seen[s]) return; seen[s] = 1; out.push(s);
    });
    return out;
  }

  function buildSlots(parsed) {
    var all = [];
    parsed.clauses.forEach(function (cl, ci) {
      slotsForClause(cl).forEach(function (s) { s.clause = ci; all.push(s); });
    });
    return all;
  }

  /* a single model translation, for the teacher view only */
  function model(parsed) {
    var slots = buildSlots(parsed);
    var out = '';
    slots.forEach(function (s, i) {
      var piece = s.accept[0] || '';
      if (!piece) return;
      if (out) out += (s.kind === 'voc' && i > 0) ? ', ' : ' ';
      out += piece;
    });
    out = out.replace(/\s+/g, ' ').trim();
    out = out.charAt(0).toUpperCase() + out.slice(1);
    return out + (parsed.isQuestion ? '?' : '.');
  }

  /* ============================================================
     MARKING
     ============================================================ */

  function normalise(s) {
    return ' ' + String(s || '').toLowerCase()
      .replace(/[’']/g, "'")
      .replace(/[^a-z0-9'\s]/g, ' ')
      .replace(/\s+/g, ' ').trim() + ' ';
  }

  function findIn(hay, needle) {
    var n = ' ' + String(needle).toLowerCase().replace(/\s+/g, ' ').trim() + ' ';
    var i = hay.indexOf(n);
    if (i >= 0) return i;
    // allow a missing or extra article inside the phrase
    var loose = n.replace(/ (the|a|an|some) /g, ' ');
    if (loose !== n) {
      var j = hay.replace(/ (the|a|an|some) /g, ' ').indexOf(loose);
      if (j >= 0) return j;
    }
    return -1;
  }

  function markTranslation(parsed, answer) {
    var hay = normalise(answer);
    var slots = buildSlots(parsed);
    var results = [], allOk = true, firstProblem = null;

    slots.forEach(function (s) {
      var at = -1, matched = null;
      for (var i = 0; i < s.accept.length; i++) {
        var p = findIn(hay, s.accept[i]);
        if (p >= 0 && (at < 0 || p < at)) { at = p; matched = s.accept[i]; }
      }
      var r = { slot: s, at: at, matched: matched, ok: at >= 0, problem: null };

      if (at < 0) {
        // right word, wrong form?
        var wt = s.wrongTense || {}, wn = s.wrongNumber || {}, wc = s.wrongCase || {};
        var found = null;
        Object.keys(wt).forEach(function (f) { if (!found && findIn(hay, f) >= 0) found = { type: 'tense', was: wt[f], text: f }; });
        if (!found) Object.keys(wn).forEach(function (f) { if (!found && findIn(hay, f) >= 0) found = { type: 'number', was: wn[f], text: f }; });
        if (!found) Object.keys(wc).forEach(function (f) { if (!found && findIn(hay, f) >= 0) found = { type: 'case', was: wc[f], text: f }; });
        r.problem = found || { type: 'missing' };
        if (s.required) { allOk = false; if (!firstProblem) firstProblem = r; }
        else r.ok = true;
      }
      results.push(r);
    });

    /* word order on the core triple */
    var core = {}, orderProblem = null;
    results.forEach(function (r) {
      if (r.ok && r.at >= 0 && (r.slot.kind === 'subject' || r.slot.kind === 'verb' || r.slot.kind === 'object')) {
        if (core[r.slot.kind] == null || r.at < core[r.slot.kind]) core[r.slot.kind] = r.at;
      }
    });
    if (core.subject != null && core.verb != null && core.subject > core.verb) {
      orderProblem = 'subject-after-verb';
    } else if (core.verb != null && core.object != null && core.object < core.verb &&
      core.subject != null && core.object < core.subject) {
      orderProblem = 'object-first';
    }
    if (orderProblem) allOk = false;

    return { ok: allOk, slots: results, firstProblem: firstProblem, orderProblem: orderProblem, model: model(parsed) };
  }

  /* ---------- tiles for the build-it mode ---------- */
  function tiles(parsed) {
    var slots = buildSlots(parsed).filter(function (s) { return s.accept.length; });
    var correct = slots.map(function (s, i) {
      return { id: 'c' + i, text: s.accept[0], slotKind: s.kind, latin: s.latin, order: i };
    });
    var distractors = [];
    slots.forEach(function (s, i) {
      function add(text, why) {
        if (!text) return;
        if (correct.some(function (c) { return c.text === text; })) return;
        if (distractors.some(function (d) { return d.text === text; })) return;
        distractors.push({ id: 'd' + distractors.length, text: text, why: why, slotKind: s.kind, latin: s.latin });
      }
      var wt = s.wrongTense || {}, wn = s.wrongNumber || {}, wc = s.wrongCase || {};
      var kt = Object.keys(wt); if (kt.length) add(kt[0], 'tense');
      var kn = Object.keys(wn); if (kn.length) add(kn[0], 'number');
      var kc = Object.keys(wc); if (kc.length) add(kc[0], 'case');
    });
    // keep the board honest: at most four wrong tiles
    distractors = distractors.slice(0, 4);
    return { correct: correct, distractors: distractors };
  }

  var API = {
    buildSlots: buildSlots, model: model, markTranslation: markTranslation,
    nounEnglish: nounEnglish, verbEnglish: verbEnglish, adjEnglish: adjEnglish,
    pluralise: pluralise, tiles: tiles, normalise: normalise,
    TENSE_NAME: TENSE_NAME, CASE_NAME: CASE_NAME, PREP_ENG: PREP_ENG,
    splitGloss: splitGloss, verbStem: verbStem, glossesFor: glossesFor,
    SYNONYMS: SYNONYMS, pluraliseWord: pluralise, v3s: v3s, ving: ving, vpast: vpast, vpp: vpp
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Eng = API;
})(typeof window !== 'undefined' ? window : this);
