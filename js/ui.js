/* ============================================================
   ui.js — the screen
   All pupil-facing text is plain instruction: the task and what
   is needed to do it. No model answer is shown anywhere, so the
   page cannot be used as a translation engine.
   ============================================================ */
(function () {
  'use strict';

  var LEVELS = { 1: ['L1'], 2: ['L1', 'L2'], 3: ['L1', 'L2', 'L3'] };
  var SCOPES = {
    1: {},
    2: { future: 1, pluperfect: 1, passive: 1 },
    3: { future: 1, pluperfect: 1, passive: 1 }
  };

  var state = {
    direction: 'l2e',   // 'l2e' Latin into English, 'e2l' English into Latin
    level: 1,
    depth: 'full',
    mode: 'type',
    lexicon: null,
    rev: null,
    tutor: null,
    steps: null,
    stepIdx: 0,
    log: [],
    parsed: null,
    target: null,
    built: []
  };

  var EXAMPLES = {
    l2e: [
      'puellae in villa laborabant.',
      'dominus iratus servum in agro necavit.',
      'pueri libros bonos legebant quod magister aderat.',
      'nauta ad insulam cum amico navigavit.',
      'filius domini epistulam scripsit.',
      'magistrum audite, pueri!'
    ],
    e2l: [
      'The girls were working in the house',
      'the slave carries the food',
      'the master killed the angry slave',
      'the son of the master wrote a letter',
      'the teacher gave the money to the slaves',
      'the farmers used to work in the fields'
    ]
  };

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function rebuildLexicon() {
    state.lexicon = Morph.buildLexicon(CE_VOCAB, LEVELS[state.level], SCOPES[state.level]);
    state.rev = Lat.buildReverse(state.lexicon);
  }

  /* ---------- segmented controls ---------- */
  function wireSeg(containerId, onPick) {
    var c = $(containerId);
    c.addEventListener('click', function (ev) {
      var b = ev.target.closest('button');
      if (!b || b.disabled) return;
      Array.prototype.forEach.call(c.querySelectorAll('button'), function (x) {
        x.setAttribute('aria-pressed', String(x === b));
      });
      onPick(b.dataset.value);
    });
  }

  function renderExamples() {
    var box = $('examples');
    clear(box);
    box.appendChild(el('span', null, 'Or try: '));
    EXAMPLES[state.direction].forEach(function (s) {
      var b = el('button', null, s);
      b.addEventListener('click', function () { $('sentence').value = s; $('sentence').focus(); });
      box.appendChild(b);
    });
  }

  /* ============================================================
     starting a sentence
     ============================================================ */
  function begin() {
    var text = $('sentence').value.trim();
    var warn = $('setupnote');
    warn.textContent = '';
    if (!text) { warn.textContent = 'Type a sentence first.'; return; }
    rebuildLexicon();

    if (state.direction === 'l2e') {
      var parsed = Parse.parse(state.lexicon, text);
      if (parsed.unknowns.length) {
        warn.textContent = 'Not on the Level ' + state.level + ' list: ' + parsed.unknowns.join(', ') +
          '. Change the word, or raise the level.';
        return;
      }
      var hasVerb = parsed.clauses.some(function (c) { return c.info.verbIdx != null; });
      if (!hasVerb) { warn.textContent = 'No verb found in that sentence.'; return; }
      state.parsed = parsed;
      state.tutor = new Socratic.Tutor(parsed, { depth: state.depth, mode: state.mode, scope: SCOPES[state.level] });
      state.steps = state.tutor.steps;
    } else {
      var r = Lat.parseEnglish(state.lexicon, state.rev, text);
      if (!r.ok) { warn.textContent = r.error; return; }
      var tgt = Lat.buildTarget(state.lexicon, r.plan);
      if (!tgt.verb || !tgt.verb.form) {
        warn.textContent = 'That verb form is outside Level ' + state.level + '.';
        return;
      }
      var missing = tgt.pieces.some(function (p) {
        if (p.label === 'verb') return !p.form;
        if (p.np) return !p.np.form;
        return p.form === null || p.form === undefined;
      });
      if (missing) { warn.textContent = 'One of those forms is outside Level ' + state.level + '.'; return; }
      state.target = tgt;
      state.steps = Lat.buildSteps(state.lexicon, r.plan, tgt, { depth: state.depth });
      state.tutor = null;
    }

    state.stepIdx = 0;
    state.log = state.steps.map(function () { return { attempts: 0, hints: 0, table: false, answer: null }; });
    state.built = [];
    $('setup').classList.add('hidden');
    $('session').classList.remove('hidden');
    $('shown').textContent = text;
    renderStep();
  }

  function rec() { return state.log[state.stepIdx]; }
  function step() { return state.steps[state.stepIdx]; }

  /* ============================================================
     rendering one question
     ============================================================ */
  function renderStep() {
    var s = step();
    if (!s) return finish();
    var r = rec();

    $('qgroup').textContent = s.group || '';
    $('qtext').textContent = s.instruction;
    var d = $('qdetail');
    clear(d);
    if (s.detail) {
      if (state.direction === 'l2e' && /^[a-zÀ-ſ ]+$/i.test(s.detail) && s.detail.split(' ').length <= 2) {
        d.appendChild(el('span', 'lat', s.detail));
      } else {
        d.appendChild(document.createTextNode(s.detail));
      }
    }

    $('prog').textContent = 'Step ' + (state.stepIdx + 1) + ' of ' + state.steps.length;
    $('barfill').style.width = Math.round((state.stepIdx / state.steps.length) * 100) + '%';

    clear($('fb'));
    clear($('tablebox'));
    $('tablebox').classList.add('hidden');

    var inputs = $('inputs');
    clear(inputs);
    state.built = [];

    if (s.input === 'choice') renderChoices(inputs, s);
    else if (s.input === 'build') renderBuilder(inputs, s);
    else renderTextInput(inputs, s);

    $('hintbtn').disabled = false;
    $('hintbtn').textContent = 'Hint';
    updateTableButton();
    highlight(s);
  }

  function highlight(s) {
    var box = $('shown');
    if (state.direction !== 'l2e' || !state.parsed) { box.textContent = $('sentence').value.trim(); return; }
    clear(box);
    /* rebuild the sentence with its punctuation in place, marking the word
       the question is about */
    var toks = Parse.tokenize($('sentence').value.trim());
    var wi = 0;
    toks.forEach(function (t, n) {
      if (t.kind === 'punct') {
        box.appendChild(el('span', 'clause-mark', t.raw));
        box.appendChild(document.createTextNode(' '));
        return;
      }
      var w = state.parsed.words[wi++];
      if (n > 0 && toks[n - 1].kind === 'word') box.appendChild(document.createTextNode(' '));
      var span = el('span', 'w', w ? w.raw : t.raw);
      if (s.detail && w && Morph.key(s.detail) === Morph.key(w.raw)) span.classList.add('here');
      box.appendChild(span);
    });
  }

  function renderTextInput(parent, s) {
    var line = el('div', 'answerline' + (s.answerIsLatin ? ' latin' : ''));
    var inp = el('input');
    inp.type = 'text';
    inp.id = 'answer';
    inp.autocomplete = 'off';
    inp.autocapitalize = 'none';
    inp.spellcheck = false;
    inp.setAttribute('aria-label', s.instruction);
    inp.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); submit(inp.value); }
    });
    var go = el('button', 'btn', 'Check');
    go.addEventListener('click', function () { submit(inp.value); });
    line.appendChild(inp);
    line.appendChild(go);
    parent.appendChild(line);
    inp.focus();
  }

  function renderChoices(parent, s) {
    var box = el('div', 'choices');
    s.options.forEach(function (o) {
      var b = el('button', null, o);
      b.addEventListener('click', function () { submit(o); });
      box.appendChild(b);
    });
    parent.appendChild(box);
  }

  function renderBuilder(parent, s) {
    var built = el('div', 'built'); built.id = 'built';
    var bank = el('div', 'bank'); bank.id = 'bank';
    var all = s.tiles.correct.concat(s.tiles.distractors);
    // a fixed shuffle so the order does not change under the pupil
    all = all.slice().sort(function (a, b) {
      return hash(a.text) - hash(b.text);
    });
    function redraw() {
      clear(built); clear(bank);
      state.built.forEach(function (t, i) {
        var b = el('button', 'tile', t.text);
        b.addEventListener('click', function () { state.built.splice(i, 1); redraw(); });
        built.appendChild(b);
      });
      all.forEach(function (t) {
        if (state.built.indexOf(t) >= 0) return;
        var b = el('button', 'tile', t.text);
        b.addEventListener('click', function () { state.built.push(t); redraw(); });
        bank.appendChild(b);
      });
    }
    parent.appendChild(built);
    parent.appendChild(bank);
    var line = el('div', 'actions');
    line.style.marginTop = '14px';
    var go = el('button', 'btn', 'Check');
    go.addEventListener('click', function () {
      submit(state.built.map(function (t) { return t.text; }).join(' '));
    });
    line.appendChild(go);
    parent.appendChild(line);
    redraw();
  }

  function hash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000;
    return h;
  }

  /* ============================================================
     answering
     ============================================================ */
  function submit(answer) {
    var s = step(), r = rec();
    if (!s) return;
    r.attempts++;
    var res = s.check(answer);
    var fb = $('fb');
    clear(fb);
    fb.className = 'fb ' + (res.ok ? 'ok' : 'no');
    fb.textContent = res.feedback;

    if (res.ok) {
      r.answer = answer;
      state.stepIdx++;
      if (state.stepIdx >= state.steps.length) { setTimeout(finish, 450); return; }
      setTimeout(renderStep, 450);
      return;
    }
    if (r.attempts >= 3 && s.table && !r.table) {
      var p = el('div', 'note');
      p.style.marginTop = '8px';
      p.textContent = 'The table is available.';
      fb.appendChild(p);
    }
    updateTableButton();
    var inp = $('answer');
    if (inp) { inp.select(); inp.focus(); }
  }

  function hint() {
    var s = step(), r = rec();
    if (!s) return;
    var list = s.hints || [];
    var fb = $('fb');
    clear(fb);
    fb.className = 'fb hint';
    if (r.hints >= list.length) {
      if (s.table && !r.table) { showTable(); return; }
      fb.textContent = 'No further hints. Work from the endings.';
      $('hintbtn').disabled = true;
      return;
    }
    var h = list[r.hints++];
    fb.textContent = (typeof h === 'function') ? h() : h;
    var left = list.length - r.hints;
    $('hintbtn').textContent = left > 0 ? 'Hint (' + left + ' left)' : (s.table ? 'Show the table' : 'Hint');
    updateTableButton();
  }

  function updateTableButton() {
    var s = step(), r = rec();
    var btn = $('tablebtn');
    if (!s || !s.table) { btn.classList.add('hidden'); return; }
    // the table is the last resort: after two hints, or three attempts
    if (r.hints >= 2 || r.attempts >= 3 || r.table) btn.classList.remove('hidden');
    else btn.classList.add('hidden');
  }

  function showTable() {
    var s = step(), r = rec();
    if (!s || !s.table) return;
    r.table = true;
    var t = s.table();
    var box = $('tablebox');
    clear(box);
    box.classList.remove('hidden');
    if (!t) { box.textContent = 'No table for this word.'; return; }
    box.appendChild(el('div', 'title', t.title));
    var table = el('table');
    var thead = el('thead'), hr = el('tr');
    var cols;
    if (t.kind === 'noun') cols = ['', 'singular', 'plural'];
    else if (t.kind === 'verb') cols = ['', 'present', 'imperfect', 'perfect'];
    else cols = ['', 'm sing', 'f sing', 'n sing', 'm pl', 'f pl', 'n pl'];
    cols.forEach(function (c) { hr.appendChild(el('th', null, c)); });
    thead.appendChild(hr); table.appendChild(thead);
    var tb = el('tbody');
    t.rows.forEach(function (row) {
      var tr = el('tr');
      tr.appendChild(el('td', 'lab', row.label));
      if (t.kind === 'noun') { [row.sg, row.pl].forEach(function (v) { tr.appendChild(el('td', 'form', v || '—')); }); }
      else if (t.kind === 'verb') { [row.pres, row.impf, row.perf].forEach(function (v) { tr.appendChild(el('td', 'form', v || '—')); }); }
      else { ['ms', 'fs', 'ns', 'mp', 'fp', 'np'].forEach(function (k) { tr.appendChild(el('td', 'form', row[k] || '—')); }); }
      tr.appendChild(document.createComment(''));
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    box.appendChild(table);
    $('tablebtn').classList.remove('hidden');
  }

  /* ============================================================
     the end of a sentence
     ============================================================ */
  function finish() {
    $('session').classList.add('hidden');
    $('done').classList.remove('hidden');
    var attempts = 0, hints = 0, tables = 0;
    state.log.forEach(function (l) { attempts += l.attempts; hints += l.hints; if (l.table) tables++; });
    var first = state.log.filter(function (l) { return l.attempts === 1; }).length;

    var sum = $('summary');
    clear(sum);
    [['Steps', state.steps.length], ['Right first time', first],
     ['Hints used', hints], ['Tables opened', tables]].forEach(function (p) {
      var d = el('div');
      d.appendChild(el('b', null, String(p[1])));
      d.appendChild(document.createTextNode(p[0]));
      sum.appendChild(d);
    });

    var rc = $('record');
    clear(rc);
    state.steps.forEach(function (s, i) {
      var l = state.log[i];
      var li = el('li');
      li.appendChild(el('span', 'q', s.instruction));
      li.appendChild(el('span', 'a', l.answer == null ? '—' : l.answer));
      var marks = [];
      if (l.attempts > 1) marks.push(l.attempts + ' tries');
      if (l.hints) marks.push(l.hints + ' hint' + (l.hints > 1 ? 's' : ''));
      if (l.table) marks.push('table');
      li.appendChild(el('span', 'marks', marks.join(', ')));
      rc.appendChild(li);
    });
    $('finaltext').textContent = $('sentence').value.trim();
  }

  function restart() {
    $('done').classList.add('hidden');
    $('session').classList.add('hidden');
    $('setup').classList.remove('hidden');
    $('sentence').value = '';
    $('sentence').focus();
  }

  /* ============================================================
     wiring
     ============================================================ */
  function init() {
    wireSeg('seg-direction', function (v) {
      state.direction = v;
      renderExamples();
      $('sentence').placeholder = (v === 'l2e')
        ? 'Type a Latin sentence.'
        : 'Type an English sentence.';
      $('sentence').value = '';
      $('setupnote').textContent = '';
      $('modefield').classList.toggle('hidden', v === 'e2l');
    });
    wireSeg('seg-level', function (v) { state.level = Number(v); });
    wireSeg('seg-depth', function (v) { state.depth = v; });
    wireSeg('seg-mode', function (v) { state.mode = v; });

    $('beginbtn').addEventListener('click', begin);
    $('sentence').addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); begin(); }
    });
    $('hintbtn').addEventListener('click', hint);
    $('tablebtn').addEventListener('click', showTable);
    $('quitbtn').addEventListener('click', restart);
    $('againbtn').addEventListener('click', restart);

    renderExamples();
    rebuildLexicon();
    $('sentence').focus();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
