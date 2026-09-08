// Spegeltester för frontend-kopian av behörighetskravlogiken. Speglar de relevanta testerna
// i backend/tests/behorighet.test.js – frontend-kopian saknar med flit valideraBehorighetsKrav
// (backend är sista försvaret), så bara normaliseraKrav och saknadeKrav testas här.
//
// Poängen: reglerna MÅSTE vara identiska på båda ställena. Divergerar de släpper formuläret
// igenom krav som servern avvisar, eller låser upp knappen fast backend anser att något
// saknas. Körs med `node --test src/utils/behorighet.test.mjs`.

import test from 'node:test';
import assert from 'node:assert/strict';

import { MAX_ANTAL_KRAV, MAX_LÄNGD_KRAV, normaliseraKrav, saknadeKrav } from './behorighet.js';

test('konstanterna speglar backend (15 krav, 80 tecken)', () => {
  assert.equal(MAX_ANTAL_KRAV, 15);
  assert.equal(MAX_LÄNGD_KRAV, 80);
});

test('normaliseraKrav: trimmar, slänger tomma och bevarar ordningen', () => {
  assert.deepEqual(
    normaliseraKrav(['  Körkort ', 'Truckkort', '   ', '']),
    ['Körkort', 'Truckkort']
  );
});

test('normaliseraKrav: deduplicerar på trimmad sträng, första förekomsten vinner', () => {
  assert.deepEqual(
    normaliseraKrav(['Körkort', 'körkort', ' Körkort ', 'Truckkort']),
    ['Körkort', 'körkort', 'Truckkort'] // skiftläge skiljer, men trim-dubblett faller bort
  );
});

test('normaliseraKrav: tål en JSON-sträng (samma form som jsonb kan komma i)', () => {
  assert.deepEqual(normaliseraKrav('["Körkort", "Truckkort"]'), ['Körkort', 'Truckkort']);
});

test('normaliseraKrav: trasig JSON-sträng ger tom lista i stället för att kasta', () => {
  assert.deepEqual(normaliseraKrav('inte json'), []);
  assert.deepEqual(normaliseraKrav('{oavslutad'), []);
});

test('normaliseraKrav: icke-array (null, objekt, tal) ger tom lista', () => {
  assert.deepEqual(normaliseraKrav(null), []);
  assert.deepEqual(normaliseraKrav(undefined), []);
  assert.deepEqual(normaliseraKrav({ krav: 'Körkort' }), []);
  assert.deepEqual(normaliseraKrav(42), []);
});

test('normaliseraKrav: icke-strängar i listan hoppas över', () => {
  assert.deepEqual(normaliseraKrav(['Körkort', 5, null, { x: 1 }, 'Truckkort']), ['Körkort', 'Truckkort']);
});

test('saknadeKrav: inga krav på jobbet ger tom lista', () => {
  assert.deepEqual(saknadeKrav([], ['Körkort']), []);
  assert.deepEqual(saknadeKrav(null, null), []);
});

test('saknadeKrav: returnerar de krav som inte intygats', () => {
  assert.deepEqual(
    saknadeKrav(['Körkort', 'Truckkort', 'HLR'], ['Körkort', 'HLR']),
    ['Truckkort']
  );
});

test('saknadeKrav: allt intygat ger tom lista', () => {
  assert.deepEqual(saknadeKrav(['Körkort', 'Truckkort'], ['Truckkort', 'Körkort']), []);
});

test('saknadeKrav: jämförelsen är trimmad men exakt – omskrivet krav räknas som nytt', () => {
  assert.deepEqual(saknadeKrav(['  Körkort  '], ['Körkort']), []);
  assert.deepEqual(saknadeKrav(['Körkort klass B'], ['Körkort']), ['Körkort klass B']);
});

test('saknadeKrav: borttaget krav ger aldrig utslag (itererar jobbets krav)', () => {
  assert.deepEqual(saknadeKrav(['Körkort'], ['Körkort', 'Truckkort']), []);
});

test('saknadeKrav: tål JSON-strängar på båda sidor', () => {
  assert.deepEqual(
    saknadeKrav('["Körkort","Truckkort"]', '["Körkort"]'),
    ['Truckkort']
  );
});
