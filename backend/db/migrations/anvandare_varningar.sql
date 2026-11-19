-- Antal varningar en privatperson fått för felaktig tidrapportering (fusk). Admin utfärdar en
-- varning när ett eskalerat bestridande hanteras och bedöms som fusk. Vid >= 3 varningar stängs
-- kontot av (aktiv = false). NULL kan inte uppstå – kolumnen är NOT NULL med default 0.
alter table "användare" add column if not exists varningar integer not null default 0;
