import Svg, { Circle, Rect, Path, G, Line, Polygon, Text as SvgText } from 'react-native-svg';

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

// ---- Illustrationer för företagsguiden ----
// Samma geometriska stil och palett som ovan, men metaforerna beskriver företagets resa:
// publicera → få ansökningar → godkänn → fakturera.

// 5. Publicera jobb – en megafon med ljudvågor (annonsera ut ett pass).
export function PubliceraJobbBild({ storlek = 200 }) {
  return (
    <Svg width={storlek} height={storlek} viewBox="0 0 200 200">
      <Circle cx="100" cy="100" r="92" fill={LJUSBLÅ} />
      {/* Megafonens tratt och kropp */}
      <Polygon points="60,88 112,64 112,136 60,112" fill={BLÅ} />
      <Rect x="44" y="88" width="18" height="24" rx="4" fill={MÖRK} />
      {/* Handtag */}
      <Rect x="82" y="124" width="12" height="28" rx="4" fill={MÖRK} />
      {/* Ljudvågor */}
      <Path d="M126 74 q18 26 0 52" fill="none" stroke={GUL} strokeWidth="7" strokeLinecap="round" />
      <Path d="M140 62 q30 38 0 76" fill="none" stroke={GUL} strokeWidth="7" strokeLinecap="round" />
    </Svg>
  );
}

// 6. Hitta personal – två personer (sökande som vill ta passet).
export function HittaPersonalBild({ storlek = 200 }) {
  return (
    <Svg width={storlek} height={storlek} viewBox="0 0 200 200">
      <Circle cx="100" cy="100" r="92" fill={LJUSBLÅ} />
      {/* Bakre person (nedtonad) */}
      <Circle cx="130" cy="84" r="17" fill={MÖRK} opacity="0.35" />
      <Path d="M104 142 C104 118 156 118 156 142 Z" fill={MÖRK} opacity="0.35" />
      {/* Främre person */}
      <Circle cx="86" cy="90" r="22" fill={BLÅ} />
      <Path d="M54 150 C54 118 118 118 118 150 Z" fill={BLÅ} />
    </Svg>
  );
}

// 7. Godkänn ansökningar – ett personkort med en grön bekräftelsebricka.
export function GodkännBild({ storlek = 200 }) {
  return (
    <Svg width={storlek} height={storlek} viewBox="0 0 200 200">
      <Circle cx="100" cy="100" r="92" fill={LJUSBLÅ} />
      {/* Kort */}
      <Rect x="48" y="60" width="104" height="80" rx="12" fill="#fff" stroke={BLÅ} strokeWidth="4" />
      {/* Avatar i kortet */}
      <Circle cx="78" cy="90" r="13" fill={BLÅ} />
      <Path d="M62 124 C62 106 94 106 94 124 Z" fill={BLÅ} />
      {/* Textrader */}
      <Line x1="106" y1="86" x2="138" y2="86" stroke={LJUSBLÅ} strokeWidth="6" strokeLinecap="round" />
      <Line x1="106" y1="102" x2="130" y2="102" stroke={LJUSBLÅ} strokeWidth="6" strokeLinecap="round" />
      {/* Grön check-bricka */}
      <Circle cx="138" cy="130" r="22" fill={GRÖN} />
      <Path d="M128 130 l7 7 l13 -15" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// 8. Avsluta & fakturera – ett kvitto med ett gult kr-mynt.
export function FaktureraBild({ storlek = 200 }) {
  return (
    <Svg width={storlek} height={storlek} viewBox="0 0 200 200">
      <Circle cx="100" cy="100" r="92" fill={LJUSBLÅ} />
      {/* Kvitto/underlag */}
      <Rect x="52" y="48" width="78" height="104" rx="10" fill="#fff" stroke={BLÅ} strokeWidth="4" />
      <Line x1="66" y1="72" x2="116" y2="72" stroke={BLÅ} strokeWidth="6" strokeLinecap="round" />
      <Line x1="66" y1="92" x2="116" y2="92" stroke={LJUSBLÅ} strokeWidth="6" strokeLinecap="round" />
      <Line x1="66" y1="110" x2="100" y2="110" stroke={LJUSBLÅ} strokeWidth="6" strokeLinecap="round" />
      {/* kr-mynt */}
      <Circle cx="134" cy="132" r="26" fill={GUL} />
      <SvgText x="134" y="141" fill="#fff" fontSize="22" fontWeight="bold" textAnchor="middle">kr</SvgText>
    </Svg>
  );
}
