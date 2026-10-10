// Dekorativ telefon-mockup för hero-sektionen. Två överlappande skärmar byggda helt i
// CSS (ingen bild): främre = jobblista (speglar JobbScreen), bakre = chatt (ChattScreen).
// Hela illustrationen är aria-hidden – den bär ingen information som inte också står i texten.

// Ett urval roller + deras färger ur appens palett (rollFärg i konstanter.js).
const JOBB = [
  { titel: 'Servitör – lunchpass', stad: 'Stockholm', lon: '185 kr/tim', roll: 'Restaurang', färg: '#2563eb' },
  { titel: 'Lagermedarbetare', stad: 'Göteborg', lon: '172 kr/tim', roll: 'Lager', färg: '#ea580c' },
  { titel: 'Butikssäljare helg', stad: 'Malmö', lon: '168 kr/tim', roll: 'Butik', färg: '#16a34a' },
  { titel: 'Eventvärd', stad: 'Uppsala', lon: '195 kr/tim', roll: 'Event', färg: '#9333ea' },
];

function Telefon({ children, className = '' }) {
  return (
    <div
      className={`w-[248px] rounded-[2.1rem] bg-[#1e293b] p-2.5 shadow-lyft ring-1 ring-white/10 ${className}`}
    >
      <div className="relative h-[512px] overflow-hidden rounded-[1.6rem] bg-bakgrund">
        {/* Notch */}
        <div className="absolute left-1/2 top-2.5 z-20 h-4 w-20 -translate-x-1/2 rounded-full bg-[#1e293b]" />
        {children}
      </div>
    </div>
  );
}

function RollBricka({ roll, färg }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[10px] font-bold"
      style={{ color: färg, backgroundColor: `${färg}1a` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: färg }} />
      {roll}
    </span>
  );
}

function JobblistaSkärm() {
  return (
    <div className="flex h-full flex-col">
      <div className="bg-yta px-4 pb-3 pt-8 shadow-mjuk">
        <p className="text-[15px] font-bold text-text">Jobb</p>
        <p className="text-[11px] text-text-dämpad">12 lediga pass nära dig</p>
      </div>
      <div className="flex-1 space-y-2.5 bg-bakgrund p-3">
        {JOBB.map((j) => (
          <div key={j.titel} className="rounded-xl bg-yta p-3 shadow-mjuk">
            <p className="text-[12px] font-bold leading-tight text-text">{j.titel}</p>
            <div className="mt-1.5">
              <RollBricka roll={j.roll} färg={j.färg} />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-text-dämpad">📍 {j.stad}</span>
              <span className="text-[12px] font-bold text-primär">{j.lon}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Bubbla({ text, utgående = false }) {
  if (utgående) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] rounded-2xl rounded-br-md bg-gradient-primär px-3 py-2 text-[11px] font-medium text-white shadow-mjuk">
          {text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[78%] rounded-2xl rounded-bl-md bg-yta px-3 py-2 text-[11px] font-medium text-text shadow-mjuk">
        {text}
      </div>
    </div>
  );
}

function ChattSkärm() {
  return (
    <div className="flex h-full flex-col bg-bakgrund">
      <div className="flex items-center gap-2.5 bg-yta px-4 pb-3 pt-8 shadow-mjuk">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primär text-[12px] font-bold text-white">
          CN
        </div>
        <div>
          <p className="text-[12px] font-bold leading-tight text-text">Café Nord</p>
          <p className="text-[10px] text-framgång">● Aktiv nu</p>
        </div>
      </div>
      <div className="flex-1 space-y-2 p-3">
        <Bubbla text="Hej! Kan du ta lunchpasset på fredag?" />
        <Bubbla text="Ja, det passar perfekt 🙌" utgående />
        <Bubbla text="Toppen – då ses vi 11:00. Välkommen!" />
        <Bubbla text="Tack! Ser fram emot det." utgående />
      </div>
      <div className="bg-yta p-3 shadow-mjuk">
        <div className="flex h-8 items-center rounded-pill bg-yta-dämpad px-3 text-[11px] text-text-svag">
          Skriv ett meddelande…
        </div>
      </div>
    </div>
  );
}

export default function TelefonMockup() {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto h-[540px] w-[300px] sm:w-[400px]"
    >
      {/* Bakre telefon – chatt (roterad, bakom). Döljs på små skärmar. */}
      <div className="absolute right-0 top-0 z-0 hidden rotate-[7deg] sm:block">
        <Telefon>
          <ChattSkärm />
        </Telefon>
      </div>

      {/* Främre telefon – jobblista. Centrerad på mobil, åt vänster på desktop. */}
      <div className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2 rotate-[-2deg] sm:left-0 sm:translate-x-0">
        <Telefon>
          <JobblistaSkärm />
        </Telefon>
      </div>
    </div>
  );
}
