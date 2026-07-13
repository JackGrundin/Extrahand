-- Planvals-popupen ska bara visas EN gång per månad. Har företaget redan valt att
-- fortsätta utan abonnemang ska de få publicera fritt resten av månaden utan att bli
-- tillfrågade igen.
-- Kör i Supabase SQL-editorn.

-- Månaden ('YYYY-MM') då företaget senast valde att fortsätta utan abonnemang. Samma
-- självläkande mönster som pass_manad: stämmer stämpeln inte med innevarande månad
-- räknas valet som ogjort, så popupen kommer tillbaka automatiskt vid månadsskifte
-- utan att något cron-jobb behöver nollställa fältet.
alter table "användare" add column if not exists planval_manad text;
