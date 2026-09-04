-- Favoritmarkering av en ansökan från företagets sida. Företaget kan stjärnmarkera
-- en sökande i ansökningslistan så att kortet fästs överst. NOT NULL + default false
-- gör att alla befintliga rader blir omarkerade utan att behöva hantera NULL i UI:t.
ALTER TABLE ansokningar ADD COLUMN favorit boolean NOT NULL DEFAULT false;
