// Rensar en OB-lista inför skick till servern: släng ofullständiga rader (editorn kan ha
// en tom rad som användaren började på men inte fyllde i) och tvinga värdet till ett tal.
// Backend (valideraObTillagg) avvisar annars hela publiceringen med 400 på en halv rad.
export function saniteraObTillagg(lista) {
  return (Array.isArray(lista) ? lista : [])
    .filter((ob) => ob && ob.start && ob.slut && Number(ob.värde) > 0 && (ob.typ === 'procent' || ob.typ === 'fast'))
    .map((ob) => ({ start: ob.start, slut: ob.slut, typ: ob.typ, värde: Number(ob.värde) }));
}
