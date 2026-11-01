# Translation Tutor — Latin

A Socratic translation tutor for ISEB Common Entrance Latin. A pupil types a
sentence and the page questions him through it a step at a time: find the verb,
parse it, find the subject, resolve the ambiguous ending, translate the phrase,
then put the whole thing together.

It will not translate for him. There is no reveal-the-answer button anywhere in
the page, by design. When a boy is stuck the help narrows the field — a hint,
then a sharper hint, then the paradigm table for that word, which he has to read
for himself.

Works in both directions: Latin into English, and English into Latin.

## Running it

Static files, no build step and no server-side anything. Open `index.html`, or
serve the folder. On GitHub Pages, point Pages at the branch root.

Everything runs in the browser. There is no API, no key, and nothing to pay for,
so a full class can use it at once and it works with the wi-fi down.

## How it decides what to ask

`js/morph.js` generates every form of every word on the Common Entrance list —
declines the nouns and adjectives, conjugates the verbs — and recognises any form
it is given back. Nothing is guessed: the stems come from the genitives and
principal parts in the word list.

`js/parse.js` takes a sentence, finds every possible reading of every word, and
searches for the combination that makes a coherent clause. It scores candidate
analyses on real grammar — prepositions govern their case, adjectives agree,
the subject matches the verb for number, *sum* takes a complement rather than an
attributive adjective — and keeps the best. It also records which endings were
genuinely ambiguous, because those are the questions worth asking.

`js/socratic.js` turns that analysis into the sequence of questions, checks each
answer against the parse, and supplies the hint ladder. `js/english.js` builds the
acceptable English and marks a typed translation generously: *the girls were
working*, *used to work* and *worked* all pass, while a wrong tense or a singular
for a plural is named rather than simply failed.

`js/latin.js` does the reverse — reads a controlled English sentence, works out
the Latin it requires, and checks the finished Latin by parsing it, so word order
stays free as Latin word order is.

## The vocabulary

`data/vocab.js` is generated from the CE Word List reference (rebuilt from the
ISEB Common Entrance & CASE Classics specification): 413 entries across Levels
1–3, each with its principal parts or genitive, part of speech and level. Do not
hand-edit it; regenerate it from the source list.

Level 1 is scoped to the specification: 1st and 2nd declension nouns and
adjectives, present, imperfect and perfect indicative active, infinitives and
imperatives, the eleven Level 1 prepositions, and *ego/tu/nos/vos* in the
nominative and accusative only. The future tense is **not** Level 1.

### Accepted English

`SYNONYMS` in `js/english.js` widens what a pupil may write without changing what
is taught — *leave* for *discedo*, *advise* for *moneo*. Add to it freely.

## Levels 2 and 3

The buttons are disabled. The vocabulary is already loaded and the engine
generates the future, pluperfect, present and imperfect passive, 3rd, 4th and 5th
declension nouns and 3rd declension adjectives, so simple Level 2 sentences
already parse and translate correctly.

What is still missing before Level 2 can be switched on honestly:

- participles (present active, perfect passive)
- the ablative absolute
- indirect statement (accusative and infinitive)
- purpose and result clauses, and the subjunctive generally

Level 3 needs all of the above plus the full subjunctive range, gerunds and
gerundives. Switching a level on is one `disabled` attribute in `index.html`
once the constructions are in.

## Tests

```
node test/morph.test.js      # 151 checks on generated and recognised forms
node test/parse.test.js      # 30 sentences, role by role
node test/english.test.js    # 35 marking cases, generous and strict
node test/latin.test.js      # 16 English-into-Latin checks
node test/bass.test.js       # 203 real sentences from Prep School Latin
node test/socratic.test.js   # scripted pupil sessions, printed as dialogue
node test/browser.test.js    # full sessions driven in a headless browser
```

The last two need `playwright` and a copy of the Bass text respectively.

## A note on the pupil-facing wording

Every line a boy sees is plain instruction: the task and what he needs to do it.
No encouragement, no commentary on the task, nothing anticipating how he will get
on. If a sentence carries no information needed to answer the question, it is not
there.
