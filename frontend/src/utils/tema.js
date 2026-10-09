// Central designpalett och tokens för hela appen. Tidigare hade varje skärm sin egen
// StyleSheet med hårdkodade färger (#2563eb överallt), svaga skuggor och en egen
// typografi – det gjorde knappar, kort och inputs subtilt olika mellan skärmar. All
// visuell stil utgår numera härifrån så att en ändring slår igenom konsekvent.
//
// OBS: logiska färger (status- och rollfärger) bor fortfarande i konstanter.js eftersom de
// styr semantik (godkänd/avvisad/bestridd). tema.js handlar om UTSEENDE, inte betydelse.

// Premium indigo-palett. Primärfärgen är en gradient (blå → indigo) för knappar och
// profilbanner; FÄRG.primär är den solida varianten som används för text, ikoner och kanter.
export const FÄRG = {
  primär: '#1d4ed8',
  primärDjup: '#4f46e5',
  primärMjuk: '#eef2ff',   // ljus indigo-bakgrund för sekundärknappar och chips
  primärKant: '#c7d2fe',
  accent: '#0ea5e9',

  bakgrund: '#f8fafc',     // skärmbakgrund (varm, ljus slate)
  yta: '#ffffff',          // kort och fält ovanpå bakgrunden
  ytaDämpad: '#f1f5f9',    // inputfält, nedtonade ytor

  text: '#0f172a',         // primär text
  textDämpad: '#64748b',   // sekundär text, etiketter
  textSvag: '#94a3b8',     // hjälptext, inaktiva ikoner

  kant: '#e2e8f0',
  kantStark: '#cbd5e1',

  framgång: '#16a34a',
  framgångMjuk: '#dcfce7',
  fel: '#dc2626',
  felMjuk: '#fee2e2',
  varning: '#ea580c',
  varningText: '#b45309',
  varningMjuk: '#fff7ed',
  varningKant: '#fed7aa',
  stjärna: '#f59e0b',

  // Används med expo-linear-gradient (LinearGradient colors={FÄRG.gradient}).
  gradient: ['#1d4ed8', '#4f46e5'],
};

// Typografiskala. Färgen sätts av konsumenten (lägg till color: FÄRG.text t.ex.), utom
// överlinjen som har en förvald dämpad ton. Systemfonten behålls – ingen custom font laddas.
export const TEXT = {
  rubrikXL: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  rubrikL:  { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  rubrikM:  { fontSize: 17, fontWeight: '700' },
  titel:    { fontSize: 16, fontWeight: '700' },
  brödtext:      { fontSize: 15, fontWeight: '400' },
  brödtextLiten: { fontSize: 14, fontWeight: '400' },
  etikett:  { fontSize: 13, fontWeight: '600' },
  överlinje: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: '#64748b' },
  mikro:    { fontSize: 11, fontWeight: '700' },
};

export const AVSTÅND = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const RADIE = { sm: 10, md: 14, lg: 18, pill: 999 };

// Mjuka, moderna skuggor. Ersätter den gamla shadowOpacity 0.05-skuggan som knappt syntes.
export const SKUGGA = {
  mjuk: {
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  lyft: {
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
};

// Färdiga delade stilobjekt. Importeras av kort, inputs m.fl. så att grundlooken är
// identisk utan att varje fil upprepar samma värden.
export const STIL = {
  kort: {
    backgroundColor: FÄRG.yta,
    borderRadius: RADIE.md,
    padding: AVSTÅND.lg,
    ...SKUGGA.mjuk,
  },
  input: {
    borderWidth: 1,
    borderColor: FÄRG.kant,
    borderRadius: RADIE.sm,
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontSize: 15,
    color: FÄRG.text,
    backgroundColor: FÄRG.ytaDämpad,
  },
  // Appliceras ovanpå input vid fokus (onFocus/onBlur).
  inputFokus: {
    borderColor: FÄRG.primär,
    borderWidth: 1.5,
    backgroundColor: FÄRG.yta,
  },
  inputFel: {
    borderColor: FÄRG.fel,
    borderWidth: 1.5,
    backgroundColor: '#fef2f2',
  },
};

export default { FÄRG, TEXT, AVSTÅND, RADIE, SKUGGA, STIL };
