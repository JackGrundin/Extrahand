-- Prestandaindex på de vanligaste filterkolumnerna.
-- Körs manuellt i Supabase SQL-editorn (samma procedur som övriga migrationer).

-- Ansökningar: de vanligaste filtren (jobb_id/anvandare_id saknar index idag)
create index if not exists idx_ansokningar_jobb_id on ansokningar(jobb_id);
create index if not exists idx_ansokningar_anvandare_id on ansokningar(anvandare_id);
create index if not exists idx_ansokningar_status on ansokningar(status);

-- Jobb: uppslag av pass-jobb per schema_pass (passbyte, materialisering)
create index if not exists idx_jobb_schema_pass_id on "Jobb"(schema_pass_id);

-- Tidrapporter: admin-vyns tidsfilter + fakturaunderlagets status-filter
create index if not exists idx_tidrapporter_status on tidrapporter(status);
create index if not exists idx_tidrapporter_datum on tidrapporter(datum);

-- Meddelanden: chattladdning sorterad per ansökan. Composite i stället för två
-- fristående index – meddelanden hämtas alltid per ansokan_id, ofta sorterade på tid.
create index if not exists idx_meddelanden_ansokan_created on meddelanden(ansokan_id, created_at);

-- Schemapass: datumuppslag (schema_id + datum finns redan via schema_pass_schema_idx)
create index if not exists idx_schema_pass_datum on schema_pass(datum);
