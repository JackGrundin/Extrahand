-- Kategori och OB-tillägg flyttas från schemat till det enskilda passet, och löneavdrag
-- införs. Ett säsongsuppdrag har olika roller olika dagar (liftvärd en dag, garderob nästa)
-- och olika OB på dag- respektive kvällspass, vilket den tidigare modellen med ETT värde per
-- schema inte klarade.
--
-- Kör i Supabase SQL-editorn. Framåtkompatibel: gammal kod läser aldrig de nya kolumnerna,
-- så SQL:en kan köras före deployen.

-- ------------------------------------------------------------------------ schema_pass

-- Kategori per pass är FRI TEXT och läses inte ur KATEGORIER-listan i frontend – företaget
-- namnger sina egna avdelningar. Schemats egen kategori (scheman.kategori) är oförändrat en
-- listkategori: den går vidare till annons-jobbets Kategori och därmed till jobbfiltret.
--
-- NULL betyder "ärv schemats värde" – därför varken default eller not null. Alla befintliga
-- pass blir NULL, vilket är precis vad passMedArv() i db/scheman.js letar efter, så inget
-- backfill behövs.
alter table schema_pass add column if not exists kategori text;

-- OB per pass. OBS: NULL-bar och UTAN default, till skillnad från scheman.ob_tillagg som är
-- not null default '[]'. Skillnaden är avsiktlig och bärande:
--   NULL  = ärv schemats OB
--   '[]'  = det här passet har medvetet inget OB
-- Med default '[]' skulle alla redan publicerade scheman tyst tappa sitt OB-tillägg, och
-- företaget skulle aldrig kunna ta bort OB för ett enskilt pass – det skulle poppa tillbaka
-- från schemat vid varje läsning.
alter table schema_pass add column if not exists ob_tillagg jsonb;

-- ---------------------------------------------------------------------- schema_avdrag

-- Löneavdrag knutna till ett schema, t.ex. boende eller kost som företaget står för.
--
-- Avdraget påverkar INTE faktureringsbeloppet: företaget faktureras på bruttot precis som
-- förut, och avdraget reglerar bara vad personen får ut. Se beräknaBelopp i utils/pris.js.
--
-- Rader raderas aldrig hårt, bara avaktiveras: en tidrapport från juni måste gå att förklara
-- i november, och det här är lön.
create table if not exists schema_avdrag (
  id uuid primary key default gen_random_uuid(),
  schema_id uuid not null references scheman(id) on delete cascade,
  namn text not null,
  belopp numeric not null check (belopp > 0),
  -- per_dag: dras på varje rapporterat pass. OBS att det i praktiken är PER PASS – två pass
  --          samma datum ger två avdrag. UI-texten säger det rakt ut.
  -- totalt:  engångsbelopp som fördelas jämnt över schemats pass (belopp / antal pass).
  typ text not null default 'per_dag' check (typ in ('per_dag', 'totalt')),
  aktiv boolean not null default true,
  skapad_datum timestamptz not null default now()
);

-- Cron-jobbets uppslag: aktiva avdrag för ett schema. Partiellt index så att avaktiverade
-- avdrag aldrig läses.
create index if not exists schema_avdrag_schema_idx on schema_avdrag (schema_id) where aktiv;

-- ----------------------------------------------------------------------- tidrapporter

-- Avdragen FRYSES på tidrapporten, precis som timlon, ob_tillagg och paslag redan gör.
-- Faktureringsunderlaget produceras uteslutande ur tidrapporter (hämtaFaktureringsunderlag
-- rör varken Jobb eller scheman), så utan frysning skulle en redigering av schema_avdrag i
-- september kunna ändra en faktura som skickades i juli.
--
-- Arrayen bär det belopp som FAKTISKT drogs på just den här rapporten, inte bara
-- konfigurationen, så att raden går att förklara i efterhand utan att räkna om något:
--   [{"avdrag_id":"...","namn":"Boende","typ":"per_dag","belopp":200,"avdraget":200},
--    {"avdrag_id":"...","namn":"Utrustning","typ":"totalt","belopp":6000,"antalPass":20,"avdraget":300}]
alter table tidrapporter add column if not exists avdrag jsonb not null default '[]'::jsonb;

-- Summan av avdrag-arrayen. Redundant men avsiktligt: fakturering och adminvyer ska aldrig
-- behöva reducera JSON, och beloppet ska gå att summera i ren SQL. default 0 är rätt svar
-- för alla gamla rapporter.
alter table tidrapporter add column if not exists avdrag_belopp numeric not null default 0;

-- Inget do $$-block behövs här: schema_avdrag har främmande nyckel enbart mot scheman(id),
-- som skapades som uuid i scheman.sql. De två tidrapporter-kolumnerna är rena add column
-- utan typberoende.
