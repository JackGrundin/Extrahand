-- Soft-avböj för inbjudningar: privatpersonen kan ta bort en inkommen inbjudan från
-- Förfrågningar-fliken utan att raden raderas (samma radaldrig-raderas-princip som
-- resten av systemet). NULL = ej avböjd; en tidsstämpel = borttagen av mottagaren.
--
-- hämtaMinaInbjudningar filtrerar bort rader med avbojd_at satt, så en avböjd inbjudan
-- försvinner ur listan överallt (till skillnad från en lokal döljning i webbläsaren).
--
-- Kör i Supabase SQL-editorn.

alter table schema_inbjudningar
  add column if not exists avbojd_at timestamptz;
