-- Födelsedatum för privatpersoner. Samlas in vid registrering och används för att
-- visa ålder i profilen. Nullbar med flit: befintliga konton har inget värde och får
-- då alder = null (döljs i gränssnittet).
alter table "användare" add column if not exists fodelsedatum date;
