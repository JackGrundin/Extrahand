-- Behörighetskrav på jobb och scheman.
--
-- Företaget listar formella krav ("Truckkort A", "Livsmedelshygienbevis") som fri text, och
-- den sökande måste kryssa i varje krav och intyga att hen uppfyller dem innan ansökan går
-- att skicka. Tidigare hamnade kraven i bästa fall som en mening i den fria beskrivningen,
-- där de varken syntes i listan eller lämnade något spår av att någon läst dem.
--
-- Kör i Supabase SQL-editorn. Framåtkompatibel: gammal kod läser aldrig de nya kolumnerna,
-- så SQL:en kan köras före deployen.

-- --------------------------------------------------------------------- Jobb och scheman

-- En array av strängar: ["Truckkort A", "B-körkort"].
--
-- not null default '[]' följer scheman.ob_tillagg, inte schema_pass.ob_tillagg. Där bär
-- skillnaden mellan NULL och [] betydelsen "ärv schemats värde"; här finns inget arv, så
-- NULL har ingen egen mening och en default sparar ett villkor i varje läsare.
--
-- Kolumnen finns på BÅDA tabellerna, och scheman.behorighets_krav måste speglas till
-- annons-jobbet av synkaAnnonsJobb i db/scheman.js: ansökningsspärren sitter i
-- POST /api/ansokningar/:jobbId och läser Jobb-raden. Utan speglingen är ett schemas krav
-- helt verkningslösa.
alter table "Jobb"  add column if not exists behorighets_krav jsonb not null default '[]'::jsonb;
alter table scheman add column if not exists behorighets_krav jsonb not null default '[]'::jsonb;

-- ------------------------------------------------------------------------- ansokningar

-- Vad personen faktiskt intygade, och när. Fryses vid ansökningstillfället precis som
-- påslaget fryses på jobbet och avdragen på tidrapporten: företaget kan lägga till krav i
-- efterhand, och då får det inte se ut som om personen intygade något hen aldrig sett.
--
-- NULLBAR UTAN DEFAULT, och den skillnaden är bärande:
--   NULL = ansökan skickades innan funktionen fanns
--   []   = jobbet hade inga krav att intyga
-- Med default '[]' gick de två inte att skilja åt.
--
-- Det är JOBBETS kravlista som skrivs hit, aldrig den lista klienten skickar – annars kunde
-- vem som helst posta en egen lista och få den sparad som "intygad".
alter table ansokningar add column if not exists intygade_krav jsonb;
alter table ansokningar add column if not exists intygat_at timestamptz;
