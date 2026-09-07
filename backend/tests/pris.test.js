// Enhetstester för faktureringsuträkningarna i utils/pris.js – den enda källan till
// sanning för vad företaget faktureras och vad personen får ut. Körs med Nodes inbyggda
// testrunner: `node --test` (se package.json). Inga externa beroenden.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PÅSLAG_PRO,
  PÅSLAG_GRATIS,
  beräknaFakturapris,
  påslagEller40,
  beräknaObBelopp,
  beräknaBelopp,
  beräknaAvdragFörPass,
  summeraAvdrag,
  valideraObTillagg,
} = require('../utils/pris');

// Flyttalsjämförelse – uträkningarna avrundas med flit inte till ören, så exakt likhet
// går inte att kräva.
function nära(faktiskt, förväntat, eps = 1e-9) {
  assert.ok(
    Math.abs(faktiskt - förväntat) < eps,
    `förväntade ~${förväntat}, fick ${faktiskt}`
  );
}

test('beräknaFakturapris: dokumenterade faktorer 1.65984 (Pro) och 1.93968 (gratis)', () => {
  // belopp * 1.38 + belopp * 1.32 * 1.06 * paslag
  nära(beräknaFakturapris(1, PÅSLAG_PRO), 1.65984);
  nära(beräknaFakturapris(1, PÅSLAG_GRATIS), 1.93968);
  nära(beräknaFakturapris(100, PÅSLAG_PRO), 165.984);
  nära(beräknaFakturapris(250, PÅSLAG_GRATIS), 484.92);
});

test('beräknaFakturapris: saknat påslag faller tillbaka på 40 %', () => {
  // Default-argumentet är PÅSLAG_GRATIS.
  nära(beräknaFakturapris(100), beräknaFakturapris(100, PÅSLAG_GRATIS));
});

test('påslagEller40: null/undefined -> 0.40, annat värde behålls', () => {
  assert.equal(påslagEller40(null), PÅSLAG_GRATIS);
  assert.equal(påslagEller40(undefined), PÅSLAG_GRATIS);
  assert.equal(påslagEller40(PÅSLAG_PRO), 0.20);
  // 0 är inte null/undefined och ska INTE ersättas (?? behåller 0).
  assert.equal(påslagEller40(0), 0);
});

test('beräknaObBelopp: tom lista, saknad lön eller saknat OB ger 0', () => {
  assert.equal(beräknaObBelopp([], 100), 0);
  assert.equal(beräknaObBelopp(null, 100), 0);
  assert.equal(beräknaObBelopp([{ start: '18:00', slut: '22:00', typ: 'fast', värde: 25 }], 0), 0);
});

test('beräknaObBelopp: procent räknas på timlön, fast räknas per timme', () => {
  // 4 timmar (18–22), 50 % av 100 kr/h = 4 * 100 * 0.5 = 200
  nära(beräknaObBelopp([{ start: '18:00', slut: '22:00', typ: 'procent', värde: 50 }], 100), 200);
  // 4 timmar, 25 kr/h fast = 4 * 25 = 100 (oberoende av timlön)
  nära(beräknaObBelopp([{ start: '18:00', slut: '22:00', typ: 'fast', värde: 25 }], 100), 100);
});

test('beräknaObBelopp: intervall med noll eller negativ längd hoppas över', () => {
  assert.equal(beräknaObBelopp([{ start: '20:00', slut: '18:00', typ: 'fast', värde: 25 }], 100), 0);
  assert.equal(beräknaObBelopp([{ start: '18:00', slut: '18:00', typ: 'fast', värde: 25 }], 100), 0);
});

test('beräknaObBelopp: flera tillägg summeras', () => {
  const belopp = beräknaObBelopp(
    [
      { start: '18:00', slut: '20:00', typ: 'fast', värde: 25 },   // 2 * 25 = 50
      { start: '20:00', slut: '22:00', typ: 'procent', värde: 50 }, // 2 * 100 * 0.5 = 100
    ],
    100
  );
  nära(belopp, 150);
});

test('beräknaBelopp: brutto = timmar*timlön + OB, utbetalning = brutto - avdrag', () => {
  const r = beräknaBelopp({ timmar: 8, timlon: 150, obBelopp: 200, avdragBelopp: 300 });
  nära(r.brutto, 8 * 150 + 200); // 1400
  nära(r.avdrag, 300);
  nära(r.utbetalning, 1400 - 300); // 1100
});

test('beräknaBelopp: avdrag klampas till [0, brutto] så utbetalningen aldrig blir negativ', () => {
  const stort = beräknaBelopp({ timmar: 2, timlon: 150, obBelopp: 0, avdragBelopp: 5000 });
  nära(stort.brutto, 300);
  nära(stort.avdrag, 300);       // klampat till bruttot
  nära(stort.utbetalning, 0);    // aldrig negativt

  const negativt = beräknaBelopp({ timmar: 2, timlon: 150, avdragBelopp: -100 });
  nära(negativt.avdrag, 0);      // negativt avdrag klampas till 0
  nära(negativt.utbetalning, 300);
});

test('beräknaBelopp: strängar tvingas till tal, saknade fält blir 0', () => {
  const r = beräknaBelopp({ timmar: '8', timlon: '150' });
  nära(r.brutto, 1200);
  const tomt = beräknaBelopp({});
  nära(tomt.brutto, 0);
  nära(tomt.utbetalning, 0);
});

test('beräknaAvdragFörPass: per_dag lägger hela beloppet på passet', () => {
  const { rader, summa } = beräknaAvdragFörPass(
    [{ id: 1, namn: 'Kost', belopp: 120, typ: 'per_dag' }],
    14
  );
  assert.equal(rader.length, 1);
  assert.equal(rader[0].typ, 'per_dag');
  assert.equal(rader[0].avdraget, 120);
  assert.equal(rader[0].antalPass, undefined); // bara totalt-rader bär antalPass
  nära(summa, 120);
});

test('beräknaAvdragFörPass: totalt fördelas jämnt och avrundas ALDRIG', () => {
  const { rader, summa } = beräknaAvdragFörPass(
    [{ id: 2, namn: 'Boende', belopp: 5000, typ: 'totalt' }],
    14
  );
  // 5000 / 14 = 357,142857... får inte avrundas till 357,14 (annars blir summan 4999,96)
  nära(rader[0].avdraget, 5000 / 14);
  assert.equal(rader[0].antalPass, 14);
  nära(summa, 5000 / 14);
  // Summerat över alla 14 pass ska det bli exakt det inskrivna beloppet.
  nära(rader[0].avdraget * 14, 5000);
});

test('beräknaAvdragFörPass: antalPass klampas till minst 1 (ingen division med noll)', () => {
  const { rader } = beräknaAvdragFörPass([{ belopp: 800, typ: 'totalt' }], 0);
  nära(rader[0].avdraget, 800); // 800 / 1
  assert.equal(rader[0].antalPass, 1);
});

test('beräknaAvdragFörPass: icke-array ger tomma rader och summa 0', () => {
  const { rader, summa } = beräknaAvdragFörPass(null, 5);
  assert.deepEqual(rader, []);
  assert.equal(summa, 0);
});

test('summeraAvdrag: summerar avdraget-fältet, icke-array ger 0', () => {
  nära(summeraAvdrag([{ avdraget: 100 }, { avdraget: 50.5 }]), 150.5);
  assert.equal(summeraAvdrag(null), 0);
  assert.equal(summeraAvdrag([{ belopp: 100 }]), 0); // inget avdraget-fält
});

test('valideraObTillagg: null är giltigt (betyder inget OB), icke-array avvisas', () => {
  assert.equal(valideraObTillagg(null), null);
  assert.equal(valideraObTillagg(undefined), null);
  assert.match(valideraObTillagg('nej'), /lista/);
});

test('valideraObTillagg: giltigt tillägg ger null', () => {
  assert.equal(
    valideraObTillagg([{ start: '18:00', slut: '22:00', typ: 'procent', värde: 50 }]),
    null
  );
});

test('valideraObTillagg: avvisar trasig indata som annars kastar i beräknaObBelopp', () => {
  assert.match(valideraObTillagg([{ slut: '22:00', typ: 'fast', värde: 5 }]), /starttid/);
  assert.match(valideraObTillagg([{ start: '18:00', typ: 'fast', värde: 5 }]), /sluttid/);
  assert.match(valideraObTillagg([{ start: '25:00', slut: '26:00', typ: 'fast', värde: 5 }]), /Ogiltig tid/);
  assert.match(valideraObTillagg([{ start: '18:00', slut: '22:00', typ: 'annat', värde: 5 }]), /procent eller fast/);
  assert.match(valideraObTillagg([{ start: '18:00', slut: '22:00', typ: 'fast', värde: 0 }]), /större än noll/);
  assert.match(valideraObTillagg([{ start: '22:00', slut: '18:00', typ: 'fast', värde: 5 }]), /efter starttiden/);
});
