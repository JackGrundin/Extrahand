-- Fakturerad-flagga + tidsstämpel på tidrapporter. Admin markerar ett godkänt
-- underlag som fakturerat utan att radera raden, och fakturerad_at visar NÄR det
-- gjordes. Kolumnen fakturerad användes redan i koden (db/fakturering.js) men
-- saknade en egen migration; fakturerad_at är ny. Kör i Supabase SQL-editorn.

alter table tidrapporter add column if not exists fakturerad boolean not null default false;
alter table tidrapporter add column if not exists fakturerad_at timestamptz;

-- Snabbare filtrering av adminens faktureringsunderlag (ej fakturerade rapporter)
create index if not exists tidrapporter_fakturerad_idx on tidrapporter (fakturerad);
