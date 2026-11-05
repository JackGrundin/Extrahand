'use client';

// Admin-dashboard: statistik-kort i ett anrop (api.adminStatistik). Visar antal användare
// (företag/privat), godkända pass, jobbade timmar, ekonomi (fakturerat/bruttolön/
// påslagsintäkt/Pro) och nya användare senaste 30 dagarna.
import { useCallback, useEffect, useState } from 'react';
import Besked from '@/components/ui/Besked';
import { api, felText } from '@/lib/api';

// Heltal med svenskt tusentalsavgränsning (samma formatering som appens admin-vy).
function kr(belopp) {
  return `${Math.round(Number(belopp) || 0).toLocaleString('sv-SE')} kr`;
}
function antal(n) {
  return (Math.round(Number(n) || 0)).toLocaleString('sv-SE');
}

function Kort({ etikett, värde, under, accent }) {
  return (
    <div
      className={`flex h-full flex-col rounded-lg border border-kant border-t-[3px] bg-yta p-6 shadow-mjuk ${
        accent === 'primär' ? 'border-t-primär' : 'border-t-kant'
      }`}
    >
      <p className="text-[12px] font-semibold uppercase tracking-wider text-text-svag">{etikett}</p>
      <p className="mt-3 text-[30px] font-bold leading-none text-text">{värde}</p>
      {under && <p className="mt-auto pt-3 text-[13px] text-text-dämpad">{under}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [fel, setFel] = useState('');

  const hämta = useCallback(async () => {
    setFel('');
    try {
      setData(await api.adminStatistik());
    } catch (f) {
      setFel(felText(f));
    }
  }, []);

  useEffect(() => {
    hämta();
  }, [hämta]);

  return (
    <div>
      <h1 className="rubrik-l text-text">Dashboard</h1>
      <p className="mt-1 text-[14px] text-text-dämpad">Överblick över plattformen</p>

      {fel && <div className="mt-6"><Besked typ="fel">{fel}</Besked></div>}

      {!data && !fel ? (
        <div className="flex justify-center py-20">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-kant border-t-primär" />
        </div>
      ) : data ? (
        <>
          <h2 className="mb-4 mt-8 text-[17px] font-bold text-text">Användare</h2>
          <div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kort etikett="Totalt antal användare" värde={antal(data.antalAnvändare)} accent="primär" />
            <Kort etikett="Företag" värde={antal(data.antalFöretag)} />
            <Kort etikett="Privatpersoner" värde={antal(data.antalPrivatpersoner)} />
            <Kort
              etikett="Nya (30 dagar)"
              värde={antal(data.nyaAnvändare30d)}
              under="Registrerade senaste 30 dagarna"
            />
          </div>

          <h2 className="mb-4 mt-10 text-[17px] font-bold text-text">Aktivitet</h2>
          <div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kort etikett="Godkända pass" värde={antal(data.godkändaPass)} />
            <Kort
              etikett="Totalt jobbade timmar"
              värde={`${(Number(data.totaltTimmar) || 0).toLocaleString('sv-SE')} h`}
              under="Från godkända tidrapporter"
            />
            <Kort etikett="Pro-prenumeranter" värde={antal(data.proPrenumeranter)} accent="primär" />
          </div>

          <h2 className="mb-4 mt-10 text-[17px] font-bold text-text">Ekonomi</h2>
          <p className="mb-4 -mt-2 text-[13px] text-text-dämpad">
            Baserat på godkända tidrapporter. Fakturerat räknas med samma formel som
            faktureringsvyn (bruttolön + sociala avgifter + semester + påslag).
          </p>
          <div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Kort etikett="Total fakturerad summa" värde={kr(data.fakturerat)} accent="primär" />
            <Kort etikett="Total bruttolön" värde={kr(data.bruttolön)} under="Arbetskostnad till personer" />
            <Kort
              etikett="Påslagsintäkt (FastGig)"
              värde={kr(data.påslagsintäkt)}
              under="Fakturerat − arbetskostnad inkl. avgifter"
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
