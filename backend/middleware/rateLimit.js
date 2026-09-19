const rateLimit = require('express-rate-limit');

// Rate limiting för de känsliga auth-endpointsen. Utan detta går det att brute-force:a
// lösenord på /logga-in och missbruka mejlutskicken (glömt lösenord, verifiering).
// Räknas per IP – server.js sätter 'trust proxy' så att Railways proxy-IP inte gör
// att alla klienter delar samma räknare.

const svensktSvar = { fel: 'För många försök. Vänta en stund och försök igen.' };

// Strikt gräns för inloggning: skydd mot lösenords-brute-force utan att låsa ute en
// vanlig användare som råkar skriva fel några gånger.
const inloggningsGräns = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuter
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: svensktSvar,
});

// Gräns för övriga känsliga endpoints som triggar mejlutskick eller skapar konton.
// Snålare än inloggningen eftersom varje anrop kostar ett mejl eller en ny rad.
const känsligGräns = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuter
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: svensktSvar,
});

module.exports = { inloggningsGräns, känsligGräns };
