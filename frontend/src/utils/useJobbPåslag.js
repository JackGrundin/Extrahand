import { useEffect, useState } from 'react';
import { api } from '../api/klient';
import { PÅSLAG_GRATIS } from './konstanter';

// Påslaget som ska visas för ett jobb i företagsvyn.
//
// Påslaget fryses först när passet tillsätts (en ansökan godkänns). Innan dess är
// jobbets paslag null och priset är ännu inte avgjort – då visas företagets nuvarande
// påslag, som beror på hur många pass de fått genomförda denna månad. Utan detta skulle
// varje nypublicerat jobb felaktigt visas som 40 %.
export function useJobbPåslag(jobbPaslag, ärFöretag) {
  const [nuvarandePåslag, setNuvarandePåslag] = useState(null);

  useEffect(() => {
    // Är passet redan tillsatt gäller jobbets frysta påslag – hämta inget.
    if (!ärFöretag || jobbPaslag != null) return;

    api.prenumerationStatus()
      .then((status) => setNuvarandePåslag(status.paslag))
      .catch(() => {});
  }, [ärFöretag, jobbPaslag]);

  return jobbPaslag ?? nuvarandePåslag ?? PÅSLAG_GRATIS;
}
