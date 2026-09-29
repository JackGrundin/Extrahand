import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OnboardingGuide from './OnboardingGuide';

const NYCKEL = 'fastgig.onboarding.visad';

// Bestämmer om onboarding-guiden ska visas. Guiden visas EN gång, bara för privatpersoner
// – korten beskriver jobbsökarflödet (hitta → ansök → chatta → betyg), medan företag
// publicerar jobb och inte har någon nytta av den.
//
// Tillståndet börjar som null ("vet inte än") så att guiden aldrig blinkar till för den som
// redan sett den medan AsyncStorage läses. Först när nyckeln lästs avgörs om något ritas.
export default function OnboardingGate({ användare }) {
  const [visa, setVisa] = useState(null);

  useEffect(() => {
    let aktiv = true;
    async function kontrollera() {
      if (användare?.typ !== 'privatperson') {
        if (aktiv) setVisa(false);
        return;
      }
      try {
        const sedd = await AsyncStorage.getItem(NYCKEL);
        if (aktiv) setVisa(!sedd);
      } catch {
        // Kan inte läsa flaggan – visa hellre inget än att tvinga guiden varje gång.
        if (aktiv) setVisa(false);
      }
    }
    kontrollera();
    return () => { aktiv = false; };
  }, [användare?.typ]);

  async function stäng() {
    setVisa(false);
    try { await AsyncStorage.setItem(NYCKEL, '1'); } catch {}
  }

  if (!visa) return null;
  return <OnboardingGuide onKlar={stäng} />;
}
