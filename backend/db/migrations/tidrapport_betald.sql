-- Lägger till en "betald"-flagga på tidrapporter så att admin kan markera
-- en rapport som betald utan att radera den. Tidigare raderades raden, vilket
-- förstörde företagets och privatpersonens historik över genomförda pass.
-- Kör i Supabase SQL-editorn.

alter table tidrapporter add column if not exists betald boolean not null default false;

-- Snabbare filtrering av admins att-göra-lista (ej betalda rapporter)
create index if not exists tidrapporter_betald_idx on tidrapporter (betald);
