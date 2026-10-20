import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OnboardingGuide, { FÖRETAG_KORT } from './OnboardingGuide';

// Varje användartyp har sin egen flagga, så att en privatperson som redan sett sin guide
// inte råkar slippa företagsguiden (och tvärtom). Privatpersonsnyckeln behålls oförändrad
// så att de som redan sett guiden inte får om den.
const NYCKLAR = {
  privatperson: 'fastgig.onboarding.visad',
  företag: 'fastgig.onboarding.foretag.visad',
};

// Bestämmer om onboarding-guiden ska visas. Guiden visas EN gång per användartyp – korten
// beskriver antingen jobbsökarflödet (hitta → ansök → chatta → betyg) eller företagsflödet
// (publicera → hitta personal → godkänn → fakturera).
//
// Tillståndet börjar som null ("vet inte än") så att guiden aldrig blinkar till för den som
// redan sett den medan AsyncStorage läses. Först när nyckeln lästs avgörs om något ritas.
export default function OnboardingGate({ användare }) {
  const [visa, setVisa] = useState(null);
  const typ = användare?.typ;
  const nyckel = NYCKLAR[typ];

  useEffect(() => {
    let aktiv = true;
    async function kontrollera() {
      if (!nyckel) {
        if (aktiv) setVisa(false);
        return;
      }
      try {
        const sedd = await AsyncStorage.getItem(nyckel);
        if (aktiv) setVisa(!sedd);
      } catch {
        // Kan inte läsa flaggan – visa hellre inget än att tvinga guiden varje gång.
        if (aktiv) setVisa(false);
      }
    }
    kontrollera();
    return () => { aktiv = false; };
  }, [nyckel]);

  async function stäng() {
    setVisa(false);
    try { if (nyckel) await AsyncStorage.setItem(nyckel, '1'); } catch {}
  }

  if (!visa) return null;
  return <OnboardingGuide onKlar={stäng} kort={typ === 'företag' ? FÖRETAG_KORT : undefined} />;
}
