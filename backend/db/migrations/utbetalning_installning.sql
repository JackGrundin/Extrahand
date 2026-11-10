-- Utbetalningsinställning för privatpersoner: hur lönen betalas ut.
--   'direkt' = en arbetsdag efter att personen godkänt tidrapporten (standard)
--   '25'     = alla godkända tidrapporter under samma månad slås ihop till en
--              utbetalning den 25:e
alter table användare
  add column if not exists utbetalning_installning text default 'direkt'
  check (utbetalning_installning in ('direkt', '25'));

-- Tidsstämpel för när en tidrapport godkändes. Lönedatumet härleds ur denna och
-- fanns inte tidigare (uppdateraTidrapportStatus skrev bara status). Gamla godkända
-- rader saknar värdet; backend faller tillbaka på created_at vid beräkning.
alter table tidrapporter
  add column if not exists godkand_at timestamptz;
