-- Blockering av företagskonton. Ett blockerat företag spärras från att publicera jobb och
-- scheman (spärren sitter i POST-routerna; backend är sista försvaret). Admin togglar
-- flaggan via PATCH /api/admin/foretag/:userId/blockera. NULL/false = ej blockerad.
alter table "användare" add column if not exists blockerad boolean default false;
