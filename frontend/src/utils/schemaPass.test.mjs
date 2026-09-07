// Enhetstester för schemafunktionerna i schemaPass.js – den rena passlist-logiken bakom
// det stegvisa schemaflödet. Ligger med flit utanför React Native och kan därför köras med
// Nodes inbyggda testrunner: `node --test src/utils/schemaPass.test.mjs`.
//
// Reglerna här är enligt kommentarerna i källan "lätta att få subtilt fel", så testerna
// vaktar just de fällorna: bevarade tider vid återbesök, id-baserad utpekning, ingen
// nollning vid massredigering och pass över midnatt.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  nyttPassId,
  sorteraPass,
  synkaPassMotDatum,
  antalPassEfterSynk,
  uppdateraFält,
  tillämpaPåMarkerade,
  hittaKrockar,
  harNolltid,
  ärKomplett,
  tillPayload,
} from './schemaPass.js';

test('nyttPassId: unika, uppräknande id', () => {
  const a = nyttPassId();
  const b = nyttPassId();
  assert.notEqual(a, b);
  assert.match(a, /^p\d+$/);
});

test('sorteraPass: sorterar på datum, sedan starttid, utan att mutera indata', () => {
  const indata = [
    { id: '1', datum: '2026-07-02', starttid: '08:00' },
    { id: '2', datum: '2026-07-01', starttid: '12:00' },
    { id: '3', datum: '2026-07-01', starttid: '08:00' },
  ];
  const kopia = JSON.parse(JSON.stringify(indata));
  const ut = sorteraPass(indata);

  assert.deepEqual(ut.map(p => p.id), ['3', '2', '1']);
  assert.deepEqual(indata, kopia); // originalet orört
});

test('synkaPassMotDatum: nytt datum får tomt pass, befintligt bevaras oförändrat', () => {
  const befintliga = [
    { id: 'p1', datum: '2026-07-01', starttid: '08:00', sluttid: '16:00', kategori: 'Liftvärd', ob_tillagg: [] },
  ];
  const ut = synkaPassMotDatum(['2026-07-01', '2026-07-02'], befintliga);

  assert.equal(ut.length, 2);
  const bevarad = ut.find(p => p.datum === '2026-07-01');
  // Ifyllda tider och roll överlever en tur tillbaka till datumsteget.
  assert.equal(bevarad.starttid, '08:00');
  assert.equal(bevarad.sluttid, '16:00');
  assert.equal(bevarad.kategori, 'Liftvärd');

  const ny = ut.find(p => p.datum === '2026-07-02');
  assert.equal(ny.starttid, '');
  assert.equal(ny.sluttid, '');
});

test('synkaPassMotDatum: avmarkerat datum faller bort', () => {
  const befintliga = [
    { id: 'p1', datum: '2026-07-01', starttid: '08:00', sluttid: '16:00' },
    { id: 'p2', datum: '2026-07-02', starttid: '08:00', sluttid: '16:00' },
  ];
  const ut = synkaPassMotDatum(['2026-07-02'], befintliga);
  assert.equal(ut.length, 1);
  assert.equal(ut[0].datum, '2026-07-02');
});

test('synkaPassMotDatum: en dag med två pass behåller båda', () => {
  const befintliga = [
    { id: 'p1', datum: '2026-07-01', starttid: '08:00', sluttid: '12:00', kategori: 'Liftvärd' },
    { id: 'p2', datum: '2026-07-01', starttid: '18:00', sluttid: '23:00', kategori: 'Garderob' },
  ];
  const ut = synkaPassMotDatum(new Set(['2026-07-01']), befintliga);
  assert.equal(ut.length, 2);
});

test('antalPassEfterSynk: räknar utan att skapa pass, en dag kan ha flera pass', () => {
  const befintliga = [
    { id: 'p1', datum: '2026-07-01', starttid: '08:00' },
    { id: 'p2', datum: '2026-07-01', starttid: '18:00' }, // två pass, ett datum
  ];
  // 2 valda datum, men det ena har redan 2 pass -> 2 (bevarade) + 1 (nytt datum) = 3
  const antal = antalPassEfterSynk(['2026-07-01', '2026-07-02'], befintliga);
  assert.equal(antal, 3);
  // Måste stämma överens med vad synkaPassMotDatum faktiskt ger.
  assert.equal(antal, synkaPassMotDatum(['2026-07-01', '2026-07-02'], befintliga).length);
});

test('uppdateraFält: skriver ett fält till målade pass, lämnar övriga orörda', () => {
  const pass = [
    { id: 'p1', datum: '2026-07-01', starttid: '', sluttid: '' },
    { id: 'p2', datum: '2026-07-02', starttid: '', sluttid: '' },
  ];
  const ut = uppdateraFält(pass, ['p1'], 'starttid', '08:00');
  assert.equal(ut.find(p => p.id === 'p1').starttid, '08:00');
  assert.equal(ut.find(p => p.id === 'p2').starttid, ''); // orört
});

test('uppdateraFält: ob_tillagg djupkopieras, inte delad referens', () => {
  const ob = [{ start: '18:00', slut: '22:00', typ: 'fast', värde: 25 }];
  const pass = [{ id: 'p1', datum: '2026-07-01', ob_tillagg: [] }];
  const ut = uppdateraFält(pass, new Set(['p1']), 'ob_tillagg', ob);

  assert.deepEqual(ut[0].ob_tillagg, ob);
  assert.notEqual(ut[0].ob_tillagg[0], ob[0]); // ny objektreferens
});

test('uppdateraFält: tomt målset returnerar listan oförändrad', () => {
  const pass = [{ id: 'p1', datum: '2026-07-01', starttid: '' }];
  assert.equal(uppdateraFält(pass, [], 'starttid', '08:00'), pass);
});

test('tillämpaPåMarkerade: bara ifyllda fält skrivs, redan ifyllda tider nollas inte', () => {
  const pass = [
    { id: 'p1', datum: '2026-07-01', starttid: '08:00', sluttid: '16:00', kategori: null },
    { id: 'p2', datum: '2026-07-02', starttid: '09:00', sluttid: '17:00', kategori: null },
  ];
  // Sätt BARA rollen på båda – tiderna ska överleva.
  const ut = tillämpaPåMarkerade(pass, ['p1', 'p2'], { starttid: '', sluttid: '', kategori: 'Liftvärd' });

  for (const p of ut) {
    assert.equal(p.kategori, 'Liftvärd');
  }
  assert.equal(ut.find(p => p.id === 'p1').starttid, '08:00'); // inte nollad
  assert.equal(ut.find(p => p.id === 'p2').sluttid, '17:00');
});

test('tillämpaPåMarkerade: rensaOb tar bort OB, annars lämnas OB orört av tom lista', () => {
  const pass = [{ id: 'p1', datum: '2026-07-01', ob_tillagg: [{ start: '18:00', slut: '22:00', typ: 'fast', värde: 25 }] }];

  // Tomt utkast utan rensaOb -> OB orört.
  const orört = tillämpaPåMarkerade(pass, ['p1'], { ob_tillagg: [] });
  assert.equal(orört[0].ob_tillagg.length, 1);

  // rensaOb -> OB tömt.
  const rensat = tillämpaPåMarkerade(pass, ['p1'], {}, { rensaOb: true });
  assert.deepEqual(rensat[0].ob_tillagg, []);
});

test('tillämpaPåMarkerade: tomt målset är en no-op', () => {
  const pass = [{ id: 'p1', datum: '2026-07-01', starttid: '08:00' }];
  assert.equal(tillämpaPåMarkerade(pass, new Set(), { starttid: '10:00' }), pass);
});

test('hittaKrockar: två pass med samma datum+starttid flaggas, annars tomt', () => {
  const pass = [
    { id: 'p1', datum: '2026-07-01', starttid: '08:00' },
    { id: 'p2', datum: '2026-07-01', starttid: '08:00' }, // krock med p1
    { id: 'p3', datum: '2026-07-01', starttid: '18:00' }, // olika starttid, ok
  ];
  const krockar = hittaKrockar(pass);
  assert.deepEqual([...krockar].sort(), ['p1', 'p2']);

  const utanKrock = hittaKrockar([
    { id: 'p1', datum: '2026-07-01', starttid: '08:00' },
    { id: 'p2', datum: '2026-07-02', starttid: '08:00' },
  ]);
  assert.equal(utanKrock.size, 0);
});

test('harNolltid: identiska tider = true, midnattspass = false', () => {
  assert.equal(harNolltid({ starttid: '08:00', sluttid: '08:00' }), true);
  // Pass över midnatt är giltigt och får ALDRIG flaggas som nolltid.
  assert.equal(harNolltid({ starttid: '22:00', sluttid: '06:00' }), false);
  assert.equal(harNolltid({ starttid: '', sluttid: '' }), false);
  assert.equal(harNolltid(null), false);
});

test('ärKomplett: kräver datum + start + slut, rollen är frivillig', () => {
  assert.equal(ärKomplett({ datum: '2026-07-01', starttid: '08:00', sluttid: '16:00' }), true);
  assert.equal(ärKomplett({ datum: '2026-07-01', starttid: '08:00' }), false);
  assert.equal(ärKomplett({ starttid: '08:00', sluttid: '16:00' }), false);
});

test('tillPayload: strippar lokalt id, trimmar kategori och gör tomt till null', () => {
  const pass = [
    { id: 'p2', datum: '2026-07-02', starttid: '08:00', sluttid: '16:00', kategori: '  Liftvärd  ' },
    { id: 'p1', datum: '2026-07-01', starttid: '08:00', sluttid: '16:00', kategori: '   ' },
  ];
  const ut = tillPayload(pass);

  // Sorterat på datum, id borta.
  assert.equal(ut[0].datum, '2026-07-01');
  assert.equal(ut[0].id, undefined);
  assert.equal(ut[1].id, undefined);
  // Kategori trimmad respektive nollad.
  assert.equal(ut[1].kategori, 'Liftvärd');
  assert.equal(ut[0].kategori, null);
});
