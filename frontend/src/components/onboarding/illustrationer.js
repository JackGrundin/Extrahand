import Svg, { Circle, Rect, Path, G, Line, Polygon } from 'react-native-svg';

// Enkla, geometriska illustrationer för onboarding-korten. Ritas med react-native-svg i
// stället för bildfiler så att de skalar knivskarpt på alla skärmar och följer appens
// färger (blå #2563eb med varma accenter). Varje komponent tar en storlek och fyller en
// kvadratisk 200×200-vy.
//
// Färgpaletten hålls avsiktligt liten och samstämmig med resten av appen.
const BLÅ = '#2563eb';
const LJUSBLÅ = '#dbeafe';
const GUL = '#f59e0b';
const GRÖN = '#16a34a';
const MÖRK = '#1e3a8a';

// 1. Hitta jobb – en portfölj med ett förstoringsglas över.
export function HittaJobbBild({ storlek = 200 }) {
  return (
    <Svg width={storlek} height={storlek} viewBox="0 0 200 200">
      <Circle cx="100" cy="100" r="92" fill={LJUSBLÅ} />
      {/* Portfölj */}
      <Rect x="46" y="78" width="82" height="60" rx="10" fill={BLÅ} />
      <Rect x="72" y="66" width="30" height="16" rx="5" fill={MÖRK} />
      <Rect x="46" y="98" width="82" height="8" fill={MÖRK} opacity="0.25" />
      {/* Förstoringsglas */}
      <Circle cx="132" cy="118" r="26" fill="#fff" stroke={GUL} strokeWidth="7" />
      <Line x1="150" y1="136" x2="166" y2="152" stroke={GUL} strokeWidth="9" strokeLinecap="round" />
    </Svg>
  );
}

// 2. Ansök – ett dokument med rader och en grön bekräftelsebricka.
export function AnsökBild({ storlek = 200 }) {
  return (
    <Svg width={storlek} height={storlek} viewBox="0 0 200 200">
      <Circle cx="100" cy="100" r="92" fill={LJUSBLÅ} />
      <Rect x="62" y="46" width="76" height="96" rx="10" fill="#fff" stroke={BLÅ} strokeWidth="4" />
      <Line x1="76" y1="72" x2="124" y2="72" stroke={BLÅ} strokeWidth="6" strokeLinecap="round" />
      <Line x1="76" y1="90" x2="124" y2="90" stroke={LJUSBLÅ} strokeWidth="6" strokeLinecap="round" />
      <Line x1="76" y1="108" x2="110" y2="108" stroke={LJUSBLÅ} strokeWidth="6" strokeLinecap="round" />
      {/* Bekräftelsebricka */}
      <Circle cx="132" cy="132" r="24" fill={GRÖN} />
      <Path d="M121 132 l8 8 l14 -16" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// 3. Chatta med företag – två överlappande pratbubblor.
export function ChattaBild({ storlek = 200 }) {
  return (
    <Svg width={storlek} height={storlek} viewBox="0 0 200 200">
      <Circle cx="100" cy="100" r="92" fill={LJUSBLÅ} />
      {/* Bakre bubbla */}
      <G>
        <Rect x="56" y="58" width="76" height="52" rx="14" fill={BLÅ} />
        <Polygon points="72,108 72,128 92,108" fill={BLÅ} />
      </G>
      {/* Främre bubbla */}
      <G>
        <Rect x="92" y="96" width="60" height="44" rx="13" fill="#fff" stroke={BLÅ} strokeWidth="4" />
        <Polygon points="134,138 134,154 118,138" fill="#fff" />
      </G>
      <Circle cx="108" cy="118" r="4" fill={BLÅ} />
      <Circle cx="122" cy="118" r="4" fill={BLÅ} />
      <Circle cx="136" cy="118" r="4" fill={BLÅ} />
    </Svg>
  );
}

// 4. Få betyg – en stor stjärna med mindre gnistrande stjärnor omkring.
// Ritas som Path (inte Polygon): react-native-svg-webb renderade den beräknade
// Polygon-punktsträngen som en självkorsande klump i stället för en stjärna.
function stjärnaPath(cx, cy, r) {
  // Number() är kritiskt: får funktionen strängar (t.ex. cx="100") blir cx + tal en
  // strängkonkatenering i stället för addition, och koordinaterna blir skräp.
  const mx = Number(cx), my = Number(cy), radie0 = Number(r);
  const punkter = [];
  for (let i = 0; i < 10; i++) {
    const radie = i % 2 === 0 ? radie0 : radie0 * 0.42;
    const vinkel = (Math.PI / 5) * i - Math.PI / 2;
    punkter.push(`${(mx + radie * Math.cos(vinkel)).toFixed(2)},${(my + radie * Math.sin(vinkel)).toFixed(2)}`);
  }
  return `M${punkter.join(' L')} Z`;
}

function Stjärna({ cx, cy, r, fill }) {
  return <Path d={stjärnaPath(cx, cy, r)} fill={fill} />;
}

export function BetygBild({ storlek = 200 }) {
  return (
    <Svg width={storlek} height={storlek} viewBox="0 0 200 200">
      <Circle cx="100" cy="100" r="92" fill={LJUSBLÅ} />
      <Stjärna cx={100} cy={98} r={46} fill={GUL} />
      <Stjärna cx={150} cy={66} r={14} fill={BLÅ} />
      <Stjärna cx={52} cy={70} r={11} fill={GRÖN} />
      <Stjärna cx={60} cy={140} r={9} fill={BLÅ} />
    </Svg>
  );
}
