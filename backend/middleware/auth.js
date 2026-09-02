const jwt = require('jsonwebtoken');

const JWT_HEMLIG_NYCKEL = process.env.JWT_SECRET || 'hemlig-nyckel-byt-i-produktion';

function kräverInloggning(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ fel: 'Åtkomst nekad – ingen token' });
  }

  try {
    const avkodad = jwt.verify(token, JWT_HEMLIG_NYCKEL);
    req.användare = avkodad;
    next();
  } catch {
    // 401 (inte 403): en ogiltig eller utgången token betyder att användaren inte är
    // autentiserad – samma klass som "ingen token". Klienten loggar ut och skickar till
    // inloggning på just 401 med token. 403 reserveras för behörighetsnekanden (fel roll,
    // annans resurs) där användaren ska förbli inloggad.
    res.status(401).json({ fel: 'Ogiltig eller utgången token' });
  }
}

function kräverTyp(...typer) {
  return (req, res, next) => {
    if (!typer.includes(req.användare?.typ)) {
      return res.status(403).json({ fel: `Åtkomst nekad – kräver roll: ${typer.join(' eller ')}` });
    }
    next();
  };
}

module.exports = { kräverInloggning, kräverTyp };
