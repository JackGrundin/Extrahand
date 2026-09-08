// Enhetstester för behörighetskravlogiken i utils/behorighet.js – reglerna för de formella
// krav företaget ställer på den som söker. Ren logik som används från fyra håll
// (ansökningsspärr, återbekräftelse, sökandekort, Mina ansökningar-varning), så subtila fel
// slår brett. Körs med Nodes inbyggda testrunner: `node --test`.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MAX_ANTAL_KRAV,
  MAX_LÄNGD_KRAV,
  normaliseraKrav,
  valideraBehorighetsKrav,
  saknadeKrav,
} = require('../utils/behorighet');

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

test('valideraBehorighetsKrav: null/undefined är giltigt (inga krav)', () => {
  assert.equal(valideraBehorighetsKrav(null), null);
  assert.equal(valideraBehorighetsKrav(undefined), null);
});

test('valideraBehorighetsKrav: giltig lista ger null', () => {
  assert.equal(valideraBehorighetsKrav(['Körkort', 'Truckkort']), null);
  assert.equal(valideraBehorighetsKrav([]), null);
});

test('valideraBehorighetsKrav: sträng och andra icke-arrayer avvisas', () => {
  assert.match(valideraBehorighetsKrav('Körkort'), /lista/);
  assert.match(valideraBehorighetsKrav({ krav: [] }), /lista/);
});

test('valideraBehorighetsKrav: för många krav avvisas, exakt gränsen tillåts', () => {
  const påGränsen = Array.from({ length: MAX_ANTAL_KRAV }, (_, i) => `Krav ${i}`);
  assert.equal(valideraBehorighetsKrav(påGränsen), null);

  const förMånga = Array.from({ length: MAX_ANTAL_KRAV + 1 }, (_, i) => `Krav ${i}`);
  assert.match(valideraBehorighetsKrav(förMånga), new RegExp(String(MAX_ANTAL_KRAV)));
});

test('valideraBehorighetsKrav: icke-strängvärde i listan avvisas', () => {
  assert.match(valideraBehorighetsKrav(['Körkort', 123]), /text/);
});

test('valideraBehorighetsKrav: för långt krav avvisas, exakt gränsen tillåts', () => {
  const påGränsen = 'a'.repeat(MAX_LÄNGD_KRAV);
  assert.equal(valideraBehorighetsKrav([påGränsen]), null);

  const förLångt = 'a'.repeat(MAX_LÄNGD_KRAV + 1);
  assert.match(valideraBehorighetsKrav([förLångt]), new RegExp(String(MAX_LÄNGD_KRAV)));
});

test('valideraBehorighetsKrav: längden mäts på trimmad text', () => {
  // 80 tecken plus omgivande blanksteg är fortfarande giltigt.
  const medBlanksteg = `  ${'a'.repeat(MAX_LÄNGD_KRAV)}  `;
  assert.equal(valideraBehorighetsKrav([medBlanksteg]), null);
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
  // Blanksteg spelar ingen roll (normaliseras bort på båda sidor)...
  assert.deepEqual(saknadeKrav(['  Körkort  '], ['Körkort']), []);
  // ...men en omformulering är ett nytt, ännu ej intygat krav.
  assert.deepEqual(saknadeKrav(['Körkort klass B'], ['Körkort']), ['Körkort klass B']);
});

test('saknadeKrav: borttaget krav ger aldrig utslag (itererar jobbets krav)', () => {
  // Personen intygade ett krav som företaget sedan tog bort – inget saknas.
  assert.deepEqual(saknadeKrav(['Körkort'], ['Körkort', 'Truckkort']), []);
});

test('saknadeKrav: tål JSON-strängar på båda sidor', () => {
  assert.deepEqual(
    saknadeKrav('["Körkort","Truckkort"]', '["Körkort"]'),
    ['Truckkort']
  );
});
