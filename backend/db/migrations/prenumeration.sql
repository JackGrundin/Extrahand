-- Prenumerationssystem (Stripe) samt månadsräknare för antal publicerade pass.
-- Företag får 2 pass per månad med 20% påslag. Från och med det 3:e passet samma
-- månad höjs påslaget till 40%, om de inte har en Pro-prenumeration (299 kr/mån)
-- som alltid ger 20%.
-- Kör i Supabase SQL-editorn.

alter table "användare" add column if not exists stripe_customer_id text;
alter table "användare" add column if not exists prenumeration_status text default 'gratis';
alter table "användare" add column if not exists prenumeration_expires_at timestamptz;
alter table "användare" add column if not exists pass_denna_manad int default 0;

-- Månadsstämpel ('YYYY-MM') för räknaren ovan. Gör räknaren självläkande: om
-- stämpeln inte är innevarande månad behandlas pass_denna_manad som 0, även om
-- cron-jobbet missat att nollställa (t.ex. vid omstart av Railway-processen över
-- ett månadsskifte). Utan detta skulle ett företag kunna faktureras 40% i en ny
-- månad enbart för att servern startats om.
alter table "användare" add column if not exists pass_manad text;

-- Snabb uppslagning från Stripe-webhooken (kund -> användare).
create index if not exists anvandare_stripe_customer_idx on "användare" (stripe_customer_id);

-- Påslaget (0.20 / 0.40) fryses när jobbet publiceras. Faktureringen sker långt
-- senare, då planen kan ha ändrats, så påslaget måste följa med jobbet och kan
-- inte härledas i efterhand. NULL = jobb från före prenumerationssystemet och
-- behandlas som 0.40 i koden.
alter table "Jobb" add column if not exists paslag numeric;

-- Kopieras från jobbet när tidrapporten skapas, precis som timlon redan kopieras.
alter table tidrapporter add column if not exists paslag numeric;

-- Atomisk inkrement + lazy reset i EN update (radlås) så att två samtidiga
-- publiceringar inte kan läsa samma räknarvärde och båda slinka igenom
-- gratisgränsen. Returnerar räknarens nya värde.
create or replace function oka_pass_denna_manad(p_id bigint, p_manad text)
returns int language plpgsql as $$
declare ny int;
begin
  update "användare"
     set pass_denna_manad = case
           when pass_manad is distinct from p_manad then 1
           else coalesce(pass_denna_manad, 0) + 1
         end,
         pass_manad = p_manad
   where id = p_id
   returning pass_denna_manad into ny;
  return ny;
end; $$;
