-- Punkt 17: Eskalera bestridande efter 24 timmar.
-- Ett obesvarat bestridande ska eskaleras till admin (inte godkännas automatiskt).
-- Körs manuellt i Supabase SQL-editorn (ingen runner).

ALTER TABLE tidrapporter
  -- Cron stämplar true när ett bestridande passerat 24 h. Claimas atomiskt så att
  -- samma rad aldrig notifierar två gånger (se cron/godkannBestridande.js).
  ADD COLUMN IF NOT EXISTS eskalerad boolean DEFAULT false,
  -- Sätts true när admin skickat en korrigering, så den ursprungliga bestridda raden
  -- lämnar bestridande-listan utan att av-eskaleras. ("Godkänn ursprunglig" byter i
  -- stället status till 'godkänd' och faller bort av statusfiltret.)
  ADD COLUMN IF NOT EXISTS eskalering_hanterad boolean DEFAULT false,
  -- Stämplas när status blir 'bestridd'. Cronens 24h-gräns mäts mot den.
  -- Backfillas MEDVETET inte: befintliga öppna bestridanden har bestridd_at = NULL och
  -- eskaleras aldrig retroaktivt (annars skulle de översvämma admin direkt vid migreringen).
  ADD COLUMN IF NOT EXISTS bestridd_at timestamptz;
