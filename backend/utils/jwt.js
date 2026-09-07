// En enda källa för JWT-hemligheten. Delas av middleware/auth.js (jwt.verify) och
// routes/auth.js (jwt.sign) så att verifiering och signering garanterat använder
// samma nyckel – tidigare stod fallback-strängen duplicerad på två ställen.
//
// I PRODUKTION måste JWT_SECRET vara satt. Faller signeringen tillbaka på en
// hårdkodad, publikt känd sträng kan vem som helst signera egna giltiga tokens och
// ta över godtyckligt konto. Saknas nyckeln kastar vi därför vid start (require-tid)
// i stället för att tyst köra vidare osäkert – Railway startar om och felet syns i
// loggen. Utanför produktion tillåts ett utvecklingsfallback så att lokal körning
// inte kräver en .env.

const ÄR_PRODUKTION = process.env.NODE_ENV === 'production';
const DEV_FALLBACK = 'hemlig-nyckel-byt-i-produktion';

function hämtaJwtHemlighet() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (ÄR_PRODUKTION) {
    throw new Error('JWT_SECRET saknas i miljövariablerna – vägrar starta i produktion utan en säker nyckel.');
  }
  console.warn('JWT_SECRET saknas – använder osäkert utvecklingsfallback. Sätt JWT_SECRET i produktion.');
  return DEV_FALLBACK;
}

const JWT_HEMLIG_NYCKEL = hämtaJwtHemlighet();

module.exports = { JWT_HEMLIG_NYCKEL };
