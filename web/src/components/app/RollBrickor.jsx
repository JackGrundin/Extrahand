// Rollbrickor för ett schema. Visar de tre första rollerna (kategorier, vanligast först
// från API:t) med deterministisk färg via rollFärg, och faller tillbaka på en neutral
// "Schema"-bricka när schemat saknar roller. Färgen är aldrig enda signalen – namnet står
// alltid i klartext.
import { rollFärg, ROLL_UTAN_NAMN } from '@/utils/konstanter';

function Bricka({ namn, färg }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-[12px] font-bold"
      style={{ color: färg, backgroundColor: `${färg}1a` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: färg }} />
      {namn}
    </span>
  );
}

export default function RollBrickor({ kategorier = [] }) {
  const roller = (Array.isArray(kategorier) ? kategorier : []).filter(Boolean);

  if (roller.length === 0) {
    return (
      <div className="flex flex-wrap gap-1.5">
        <Bricka namn="Schema" färg={ROLL_UTAN_NAMN} />
      </div>
    );
  }

  const visade = roller.slice(0, 3);
  const kvar = roller.length - visade.length;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visade.map((roll) => (
        <Bricka key={roll} namn={roll} färg={rollFärg(roll)} />
      ))}
      {kvar > 0 && <span className="text-[12px] font-semibold text-text-svag">+{kvar}</span>}
    </div>
  );
}
