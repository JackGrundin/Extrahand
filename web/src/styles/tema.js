// Central designpalett för webben – speglar frontend/src/utils/tema.js i mobilappen.
// Samma premium-indigo-palett, radier, skuggor och typografiskala. Ändras något här
// ska det också ändras i mobilappens tema.js (och tvärtom) så att app och webb ser
// identiska ut. Tailwind-konfigurationen (tailwind.config.js) läser dessa värden.

export const FÄRG = {
  primär: '#1d4ed8',
  primärDjup: '#4f46e5',
  primärMjuk: '#eef2ff',
  primärKant: '#c7d2fe',
  accent: '#0ea5e9',

  bakgrund: '#f8fafc',
  yta: '#ffffff',
  ytaDämpad: '#f1f5f9',

  text: '#0f172a',
  textDämpad: '#64748b',
  textSvag: '#94a3b8',

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

  // CSS-gradient (motsvarar LinearGradient colors={['#1d4ed8', '#4f46e5']} i appen).
  gradient: 'linear-gradient(135deg, #1d4ed8 0%, #4f46e5 100%)',
};

export const RADIE = { sm: '10px', md: '14px', lg: '18px', pill: '999px' };

export const SKUGGA = {
  mjuk: '0 4px 12px rgba(15, 23, 42, 0.06)',
  lyft: '0 8px 20px rgba(15, 23, 42, 0.12)',
};

export const AVSTÅND = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

const tema = { FÄRG, RADIE, SKUGGA, AVSTÅND };
export default tema;
