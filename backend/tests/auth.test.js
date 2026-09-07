// Enhetstester för behörighetskontrollerna i middleware/auth.js: kräverInloggning (giltig
// JWT krävs) och kräverTyp (rätt roll krävs). Körs med `node --test`.
//
// JWT_SECRET sätts INNAN middlewaren laddas: utils/jwt.js cachar hemligheten vid require,
// och samma hemlighet används sedan för att signera testtokens.

process.env.JWT_SECRET = 'test-hemlighet-for-enhetstester';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { kräverInloggning, kräverTyp } = require('../middleware/auth');

// Minimal Express-liknande res: fångar status + json så vi kan verifiera svaret.
function skapaRes() {
  return {
    statusCode: null,
    body: null,
    status(kod) { this.statusCode = kod; return this; },
    json(kropp) { this.body = kropp; return this; },
  };
}

// next-spion: räknar hur många gånger den anropats.
function skapaNext() {
  const next = () => { next.anrop += 1; };
  next.anrop = 0;
  return next;
}

function giltigToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
}

test('kräverInloggning: utan Authorization-header -> 401, next körs inte', () => {
  const req = { headers: {} };
  const res = skapaRes();
  const next = skapaNext();

  kräverInloggning(req, res, next);

  assert.equal(res.statusCode, 401);
  assert.equal(next.anrop, 0);
  assert.match(res.body.fel, /token/i);
});

test('kräverInloggning: header utan token efter "Bearer" -> 401', () => {
  const req = { headers: { authorization: 'Bearer' } };
  const res = skapaRes();
  const next = skapaNext();

  kräverInloggning(req, res, next);

  assert.equal(res.statusCode, 401);
  assert.equal(next.anrop, 0);
});

test('kräverInloggning: ogiltig/manipulerad token -> 401', () => {
  const req = { headers: { authorization: 'Bearer inte.en.giltig.token' } };
  const res = skapaRes();
  const next = skapaNext();

  kräverInloggning(req, res, next);

  assert.equal(res.statusCode, 401);
  assert.equal(next.anrop, 0);
});

test('kräverInloggning: token signerad med FEL hemlighet -> 401', () => {
  const token = jwt.sign({ id: 1, typ: 'företag' }, 'annan-hemlighet');
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = skapaRes();
  const next = skapaNext();

  kräverInloggning(req, res, next);

  assert.equal(res.statusCode, 401);
  assert.equal(next.anrop, 0);
});

test('kräverInloggning: utgången token -> 401', () => {
  const token = jwt.sign({ id: 1, typ: 'företag' }, process.env.JWT_SECRET, { expiresIn: -10 });
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = skapaRes();
  const next = skapaNext();

  kräverInloggning(req, res, next);

  assert.equal(res.statusCode, 401);
  assert.equal(next.anrop, 0);
});

test('kräverInloggning: giltig token -> next körs och req.användare fylls i', () => {
  const token = giltigToken({ id: 42, typ: 'privatperson', email: 'a@b.se' });
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = skapaRes();
  const next = skapaNext();

  kräverInloggning(req, res, next);

  assert.equal(next.anrop, 1);
  assert.equal(res.statusCode, null); // inget felsvar skickades
  assert.equal(req.användare.id, 42);
  assert.equal(req.användare.typ, 'privatperson');
  assert.equal(req.användare.email, 'a@b.se');
});

test('kräverTyp: rätt roll -> next körs', () => {
  const middleware = kräverTyp('företag');
  const req = { användare: { typ: 'företag' } };
  const res = skapaRes();
  const next = skapaNext();

  middleware(req, res, next);

  assert.equal(next.anrop, 1);
  assert.equal(res.statusCode, null);
});

test('kräverTyp: fel roll -> 403, next körs inte', () => {
  const middleware = kräverTyp('företag');
  const req = { användare: { typ: 'privatperson' } };
  const res = skapaRes();
  const next = skapaNext();

  middleware(req, res, next);

  assert.equal(res.statusCode, 403);
  assert.equal(next.anrop, 0);
  assert.match(res.body.fel, /roll/i);
});

test('kräverTyp: flera tillåtna roller släpper igenom endera', () => {
  const middleware = kräverTyp('företag', 'privatperson');

  for (const typ of ['företag', 'privatperson']) {
    const req = { användare: { typ } };
    const res = skapaRes();
    const next = skapaNext();
    middleware(req, res, next);
    assert.equal(next.anrop, 1, `roll ${typ} skulle släppas igenom`);
  }
});

test('kräverTyp: saknad användare (odefinierad typ) -> 403', () => {
  const middleware = kräverTyp('företag');
  const req = {}; // ingen req.användare
  const res = skapaRes();
  const next = skapaNext();

  middleware(req, res, next);

  assert.equal(res.statusCode, 403);
  assert.equal(next.anrop, 0);
});
