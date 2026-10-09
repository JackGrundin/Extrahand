'use client';

// Auth-context för webben – speglar frontend/src/context/AuthContext.js.
// Token lagras i localStorage. Vid sidladdning återställs sessionen via GET /users/profil;
// ett 401 från ett autentiserat anrop loggar ut centralt (via lyssnaPåAuthFel).
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react';
import {
  api,
  sparaToken,
  rensaToken,
  hämtaToken,
  lyssnaPåAuthFel,
} from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [användare, setAnvändare] = useState(null);
  const [laddar, setLaddar] = useState(true);

  const loggaUt = useCallback(() => {
    rensaToken();
    setAnvändare(null);
  }, []);

  // Återställ sessionen vid sidladdning. Ta INTE bort token vid tillfälligt fel –
  // bara ett riktigt 401 (via lyssnaren nedan) ska logga ut.
  useEffect(() => {
    async function kontrolleraToken() {
      try {
        if (hämtaToken()) {
          const profil = await api.hämtaProfil();
          setAnvändare(profil);
        }
      } catch {
        // Lämna token orörd vid nät-/serverfel; 401 hanteras centralt.
      } finally {
        setLaddar(false);
      }
    }
    kontrolleraToken();
  }, []);

  // Central utloggning när ett autentiserat anrop avvisas med 401.
  useEffect(() => lyssnaPåAuthFel(() => loggaUt()), [loggaUt]);

  async function loggaIn(email, lösenord) {
    const svar = await api.loggaIn({ email, lösenord });
    sparaToken(svar.token);
    setAnvändare(svar.användare);
    return svar;
  }

  // Registrering loggar inte in direkt – backend svarar { väntarVerifiering: true }
  // och användaren måste ange e-postkoden först. Returneras uppåt så sidan kan routa
  // vidare till verifieringssteget.
  async function registrera(data) {
    return api.registrera(data);
  }

  // Verifierar e-postkoden och loggar in (svaret innehåller token + användare).
  async function verifieraKod(email, kod) {
    const svar = await api.verifieraKod({ email, kod });
    sparaToken(svar.token);
    setAnvändare(svar.användare);
    return svar;
  }

  const värde = useMemo(
    () => ({
      användare,
      laddar,
      inloggad: Boolean(användare),
      loggaIn,
      registrera,
      verifieraKod,
      loggaUt,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [användare, laddar, loggaUt]
  );

  return <AuthContext.Provider value={värde}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
