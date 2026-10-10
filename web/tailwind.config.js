/** @type {import('tailwindcss').Config} */
// Tailwind-temat är seedat ur src/styles/tema.js så att webben använder exakt samma
// premium-indigo-palett som mobilappen. Håll värdena i synk med tema.js.
const { FÄRG, RADIE, SKUGGA } = require('./src/styles/tema');

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      // Extra liten brytpunkt för de smalaste telefonerna (de flesta är 360–430px breda).
      // Används bl.a. för att visa/dölja sekundära navknappar.
      screens: {
        xs: '380px',
      },
      colors: {
        primär: FÄRG.primär,
        'primär-djup': FÄRG.primärDjup,
        'primär-mjuk': FÄRG.primärMjuk,
        'primär-kant': FÄRG.primärKant,
        accent: FÄRG.accent,
        bakgrund: FÄRG.bakgrund,
        yta: FÄRG.yta,
        'yta-dämpad': FÄRG.ytaDämpad,
        text: FÄRG.text,
        'text-dämpad': FÄRG.textDämpad,
        'text-svag': FÄRG.textSvag,
        kant: FÄRG.kant,
        'kant-stark': FÄRG.kantStark,
        framgång: FÄRG.framgång,
        'framgång-mjuk': FÄRG.framgångMjuk,
        fel: FÄRG.fel,
        'fel-mjuk': FÄRG.felMjuk,
        varning: FÄRG.varning,
        'varning-text': FÄRG.varningText,
        'varning-mjuk': FÄRG.varningMjuk,
        'varning-kant': FÄRG.varningKant,
        stjärna: FÄRG.stjärna,
        // Lekfulla extrafärger för färgband och doodles (tints/toner).
        cream: '#fffdf8',
        korall: '#ea580c',
        mint: '#dcfce7',
        persika: '#fff7ed',
        himmel: '#e0f2fe',
        lavendel: '#eef2ff',
      },
      borderRadius: {
        sm: RADIE.sm,
        md: RADIE.md,
        lg: RADIE.lg,
        pill: RADIE.pill,
      },
      boxShadow: {
        mjuk: SKUGGA.mjuk,
        lyft: SKUGGA.lyft,
        // Hård offset-skugga (ingen blur) för den lekfulla, handgjorda looken.
        hard: '6px 6px 0 #0f172a',
        'hard-sm': '4px 4px 0 #0f172a',
      },
      backgroundImage: {
        'gradient-primär': FÄRG.gradient,
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      maxWidth: {
        innehåll: '1120px',
      },
    },
  },
  plugins: [],
};
