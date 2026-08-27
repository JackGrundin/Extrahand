-- Skiljer ett avhopp från ett nekande.
--
-- När en privatperson hoppar av ett schema sätts hens ansökningar till 'avvisad' – exakt
-- samma värde som när företaget nekar någon. I appen blev båda "Avvisad", vilket är fel
-- besked till den som själv valde att lämna uppdraget.
--
-- En nullbar tidsstämpel i stället för ett fjärde statusvärde: ansokningar.status styr ett
-- dussin filter i både backend (avvisaAllaUtomEn, frigörFramtidaPass, filtreraAktivaJobb)
-- och frontend (STATUSFÄRGER_ANSÖKAN). Ett nytt statusvärde måste speglas överallt och
-- riskerar dessutom en check-constraint vi inte ser – tabellen skapades utanför
-- migrationerna. Kolumnen är ren presentationsdata ovanpå 'avvisad'.
alter table ansokningar add column if not exists avhoppad_at timestamptz;

-- Dubblettspärren för betyg fanns bara i applikationslagret (finnsDublettBetyg i
-- db/betyg.js), så två samtidiga anrop kunde skapa två betyg på samma uppdrag. Nu när
-- betygsprompten kan dyka upp i flera sessioner samtidigt behövs spärren i databasen.
create unique index if not exists betyg_ansokan_av_uniq on betyg (ansokan_id, av_anvandare_id);
