'use client';

// Dokumentlista för webben – speglar frontend/src/components/DokumentLista.js.
// Privatpersonen kan ladda upp (PDF/JPG/PNG), öppna och ta bort egna dokument (CV, intyg,
// körkort). onÄndrad körs efter lyckad uppladdning/radering så att föräldern hämtar om
// profilen. Gränsvärdena speglar backend/routes/användare.js (max 10 dokument, max 10 MB).
import { useRef, useState } from 'react';
import Knapp from '@/components/ui/Knapp';
import Besked from '@/components/ui/Besked';
import { api, felText } from '@/lib/api';

const MAX_DOKUMENT = 10;
const MAX_BYTE = 10 * 1024 * 1024;
// MIME-typ → filändelse. Speglar TILLÅTNA_DOKUMENTTYPER i backend.
const TILLÅTNA = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };

function formateraStorlek(byte) {
  if (!byte) return '';
  if (byte < 1024 * 1024) return `${Math.round(byte / 1024)} kB`;
  return `${(byte / (1024 * 1024)).toFixed(1)} MB`;
}

// Härleder en tillåten MIME-typ från filen; faller tillbaka på filändelsen när
// webbläsaren inte ger någon type. Returnerar null för otillåtna typer.
function härledMimeType(fil) {
  if (fil.type && TILLÅTNA[fil.type]) return fil.type;
  const ext = (fil.name.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  return null;
}

export default function DokumentLista({ dokument = [], onÄndrad }) {
  const filInput = useRef(null);
  const [laddarUpp, setLaddarUpp] = useState(false);
  const [fel, setFel] = useState('');

  async function väljFil(e) {
    const fil = e.target.files?.[0];
    if (filInput.current) filInput.current.value = '';
    if (!fil) return;

    setFel('');
    if (dokument.length >= MAX_DOKUMENT) {
      setFel(`Du kan ha max ${MAX_DOKUMENT} dokument.`);
      return;
    }
    const mime = härledMimeType(fil);
    if (!mime) {
      setFel('Otillåten filtyp. Välj en PDF-, JPG- eller PNG-fil.');
      return;
    }
    if (fil.size > MAX_BYTE) {
      setFel('Filen är för stor (max 10 MB).');
      return;
    }

    // Föreslå filnamnet utan ändelse; användaren får ange ett namn.
    const förslag = fil.name.replace(/\.[^.]+$/, '') || 'Dokument';
    const namn = window.prompt('Namnge dokumentet (t.ex. B-körkort):', förslag);
    if (namn === null) return; // avbrutet
    const rensatNamn = namn.trim();
    if (!rensatNamn) {
      setFel('Dokumentet behöver ett namn.');
      return;
    }

    setLaddarUpp(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const läsare = new FileReader();
        läsare.onload = () => resolve(läsare.result);
        läsare.onerror = () => reject(new Error('Kunde inte läsa filen'));
        läsare.readAsDataURL(fil);
      });
      await api.laddaUppDokument({ namn: rensatNamn, fil: dataUrl, mimeType: mime });
      onÄndrad?.();
    } catch (f) {
      setFel(felText(f));
    } finally {
      setLaddarUpp(false);
    }
  }

  async function taBort(dok) {
    if (!window.confirm(`Vill du ta bort "${dok.namn}"?`)) return;
    setFel('');
    try {
      await api.raderaDokument(dok.id);
      onÄndrad?.();
    } catch (f) {
      setFel(felText(f));
    }
  }

  return (
    <section>
      <h2 className="överlinje mb-2">Dokument</h2>

      {fel && <Besked typ="fel">{fel}</Besked>}

      <div className="flex flex-col gap-2">
        {dokument.map((dok) => (
          <div
            key={dok.id}
            className="flex items-center gap-3 rounded-md border border-kant px-3 py-2.5"
          >
            <a
              href={dok.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <span className="text-[18px] text-primär" aria-hidden="true">
                {dok.mime_type === 'application/pdf' ? '📄' : '🖼️'}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-medium text-text">
                  {dok.namn}
                </span>
                {dok.storlek ? (
                  <span className="text-[12px] text-text-svag">
                    {formateraStorlek(dok.storlek)}
                  </span>
                ) : null}
              </span>
            </a>
            <button
              type="button"
              onClick={() => taBort(dok)}
              aria-label={`Ta bort dokument ${dok.namn}`}
              className="shrink-0 px-2 py-1 text-[13px] font-semibold text-fel hover:underline"
            >
              Ta bort
            </button>
          </div>
        ))}
      </div>

      {dokument.length === 0 && (
        <p className="mb-3 text-[14px] text-text-svag">
          Ladda upp CV, körkort eller intyg så att företag kan se dina meriter.
        </p>
      )}

      {dokument.length < MAX_DOKUMENT && (
        <div className="mt-3">
          <input
            ref={filInput}
            type="file"
            accept=".pdf,image/jpeg,image/png,application/pdf"
            onChange={väljFil}
            className="hidden"
          />
          <Knapp
            variant="kontur"
            storlek="liten"
            laddar={laddarUpp}
            onClick={() => filInput.current?.click()}
          >
            Lägg till dokument
          </Knapp>
          <p className="mt-1 text-[12px] text-text-svag">PDF, JPG eller PNG, max 10 MB</p>
        </div>
      )}
    </section>
  );
}
