// Stadsvalidering för webben. I mobilappen bor ärGiltigStad i komponenten StadInput.js,
// men validatorerna (jobbValidering/schemaValidering) ska inte behöva importera en
// komponent – därför ligger helpern här på webben. Logiken är identisk: staden måste
// väljas ur SVENSKA_ORTER, annars splittras stadsmatchningen i backend.
import { SVENSKA_ORTER } from './svenskaOrter';

export function ärGiltigStad(värde) {
  return SVENSKA_ORTER.includes((värde ?? '').trim());
}
