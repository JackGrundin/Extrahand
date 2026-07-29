// Svenska städer, tätorter och kommunhuvudorter, grupperade per län.
//
// Listan används av StadInput för autocomplete och av ärGiltigStad för att tvinga fram
// ett val ur listan. Värdet sparas som användarens/jobbets stad och matchas sedan mot
// varandra i backend (hämtaPrivatpersonerIStad), så STAVNINGEN MÅSTE VARA KONSEKVENT –
// varje namn får förekomma i exakt en form, alltid med korrekta svenska tecken.
//
// Sök utan diakriter ("malmo", "vaxjo") fungerar ändå: StadInput jämför via normalisera()
// från konstanter.js. Lägg därför ALDRIG till ASCII-varianter som 'Malmo' eller 'Eslov'
// som egna poster – då blir de valbara, sparas i databasen och splittrar stadsmatchningen
// så att jobbnotiser missar folk.
//
// Grupperingen per län är till för underhåll: det är lättare att se vad som saknas.
// Ordningen spelar ingen roll, listan sorteras med svensk kollation nedan.
export const SVENSKA_ORTER = dedupeOchSortera([
  // ---------------------------------------------------------------- Stockholms län
  'Stockholm', 'Södertälje', 'Solna', 'Sundbyberg', 'Nacka', 'Huddinge', 'Järfälla',
  'Täby', 'Sollentuna', 'Danderyd', 'Lidingö', 'Botkyrka', 'Haninge', 'Tyresö',
  'Upplands Väsby', 'Upplands-Bro', 'Vallentuna', 'Österåker', 'Värmdö', 'Ekerö',
  'Nynäshamn', 'Norrtälje', 'Sigtuna', 'Salem', 'Vaxholm', 'Nykvarn',
  'Åkersberga', 'Märsta', 'Jakobsberg', 'Kungsängen', 'Bro', 'Tumba', 'Tullinge',
  'Norsborg', 'Alby', 'Fittja', 'Hallunda', 'Handen', 'Västerhaninge', 'Jordbro',
  'Brandbergen', 'Tungelsta', 'Ösmo', 'Segeltorp', 'Stuvsta', 'Vårby', 'Skogås',
  'Trångsund', 'Länna', 'Gustavsberg', 'Hemmesta', 'Ingarö', 'Djurö', 'Stavsnäs',
  'Saltsjöbaden', 'Fisksätra', 'Älta', 'Orminge', 'Boo', 'Djursholm', 'Stocksund',
  'Enebyberg', 'Näsbypark', 'Gribbylund', 'Rönninge', 'Rotebro', 'Viksjö',
  'Barkarby', 'Kallhäll', 'Stenhamra', 'Adelsö', 'Munsö', 'Rimbo', 'Hallstavik',
  'Grisslehamn', 'Älmsta', 'Edsbro', 'Gräddö', 'Rosersberg', 'Vendelsö',
  'Brottby', 'Lindholmen', 'Svinninge', 'Resarö', 'Rindö', 'Sorunda', 'Grödinge',
  'Bromma', 'Farsta', 'Spånga', 'Skärholmen', 'Bredäng', 'Vällingby', 'Hässelby',
  'Kista', 'Åkeshov', 'Älvsjö', 'Bandhagen', 'Årsta', 'Enskede', 'Sköndal',

  // ---------------------------------------------------------------- Uppsala län
  'Uppsala', 'Enköping', 'Bålsta', 'Knivsta', 'Tierp', 'Östhammar', 'Älvkarleby',
  'Heby', 'Skutskär', 'Öregrund', 'Gimo', 'Alunda', 'Österbybruk', 'Örbyhus',
  'Skärplinge', 'Karlholmsbruk', 'Söderfors', 'Björklinge', 'Storvreta', 'Vattholma',
  'Knutby', 'Almunge', 'Gunsta', 'Lövstalöt', 'Bälinge', 'Fjärdhundra', 'Örsundsbro',
  'Grillby', 'Skokloster', 'Morgongåva', 'Harbo', 'Tärnsjö', 'Vittinge', 'Hallstavik',

  // ---------------------------------------------------------------- Södermanlands län
  'Eskilstuna', 'Nyköping', 'Katrineholm', 'Strängnäs', 'Flen', 'Trosa', 'Gnesta',
  'Oxelösund', 'Vingåker', 'Mariefred', 'Malmköping', 'Torshälla', 'Hälleforsnäs',
  'Sparreholm', 'Bettna', 'Stjärnhov', 'Björnlunda', 'Åkers Styckebruk', 'Stallarholmen',
  'Hällbybrunn', 'Kvicksund', 'Skogstorp', 'Vagnhärad', 'Nävekvarn', 'Jönåker',
  'Tystberga', 'Julita', 'Valla', 'Björkvik',

  // ---------------------------------------------------------------- Östergötlands län
  'Linköping', 'Norrköping', 'Motala', 'Mjölby', 'Finspång', 'Söderköping',
  'Åtvidaberg', 'Vadstena', 'Kisa', 'Skänninge', 'Boxholm', 'Ödeshög', 'Valdemarsvik',
  'Ydre', 'Österbymo', 'Borensberg', 'Ljungsbro', 'Vikingstad', 'Linghem', 'Malmslätt',
  'Sturefors', 'Ekängen', 'Berg', 'Skärblacka', 'Kimstad', 'Norsholm', 'Åby',
  'Krokek', 'Kolmården', 'Svärtinge', 'Vikbolandet', 'Mantorp', 'Skeppsås',
  'Ringarum', 'Gusum', 'Rejmyre', 'Hällestad', 'Brokind', 'Ulrika', 'Grebo',
  'Väderstad', 'Fornåsa', 'Klockrike', 'Tjällmo', 'Godegård',

  // ---------------------------------------------------------------- Jönköpings län
  'Jönköping', 'Värnamo', 'Nässjö', 'Tranås', 'Vetlanda', 'Eksjö', 'Gislaved',
  'Sävsjö', 'Vaggeryd', 'Gnosjö', 'Aneby', 'Mullsjö', 'Habo', 'Huskvarna',
  'Bankeryd', 'Norrahammar', 'Taberg', 'Tenhult', 'Barnarp', 'Gränna', 'Ölmstad',
  'Anderstorp', 'Smålandsstenar', 'Reftele', 'Burseryd', 'Hestra', 'Skillingaryd',
  'Hok', 'Bodafors', 'Forserum', 'Malmbäck', 'Anneberg', 'Landsbro', 'Korsberga',
  'Ekenässjön', 'Holsbybrunn', 'Kvillsfors', 'Myresjö', 'Stockaryd', 'Rörvik',
  'Bruzaholm', 'Mariannelund', 'Ingatorp', 'Hjältevad', 'Lekeryd', 'Ödestugu',
  'Bredaryd', 'Forsheda', 'Rydaholm', 'Horda', 'Lanna', 'Bor', 'Åseda',

  // ---------------------------------------------------------------- Kronobergs län
  'Växjö', 'Ljungby', 'Älmhult', 'Alvesta', 'Tingsryd', 'Markaryd', 'Lessebo',
  'Uppvidinge', 'Lammhult', 'Moheda', 'Vislanda', 'Grimslöv', 'Rottne', 'Braås',
  'Gemla', 'Ingelstad', 'Åryd', 'Lenhovda', 'Norrhult', 'Klavreström', 'Kosta',
  'Hovmantorp', 'Skruv', 'Ryd', 'Urshult', 'Väckelsång', 'Linneryd', 'Konga',
  'Strömsnäsbruk', 'Traryd', 'Lagan', 'Ryssby', 'Agunnaryd', 'Liatorp', 'Diö',
  'Eneryda', 'Delary', 'Hallaryd', 'Vittaryd', 'Lidhult', 'Torpsbruk',

  // ---------------------------------------------------------------- Kalmar län
  'Kalmar', 'Västervik', 'Oskarshamn', 'Nybro', 'Vimmerby', 'Hultsfred', 'Emmaboda',
  'Mönsterås', 'Mörbylånga', 'Borgholm', 'Torsås', 'Högsby', 'Färjestaden',
  'Lindsdal', 'Smedby', 'Rinkabyholm', 'Trekanten', 'Läckeby', 'Ljungbyholm',
  'Påryd', 'Söderåkra', 'Bergkvara', 'Ålem', 'Blomstermåla', 'Timmernabben',
  'Fliseryd', 'Påskallavik', 'Kristdala', 'Figeholm', 'Bockara', 'Målilla',
  'Virserum', 'Silverdalen', 'Mörlunda', 'Järnforsen', 'Vena', 'Södra Vi',
  'Storebro', 'Gullringen', 'Frödinge', 'Gamleby', 'Ankarsrum', 'Överum',
  'Loftahammar', 'Blankaholm', 'Orrefors', 'Alsterbro', 'Alstermo', 'Åkerby',
  'Löttorp', 'Köpingsvik', 'Degerhamn', 'Grönhögen',

  // ---------------------------------------------------------------- Gotlands län
  'Visby', 'Slite', 'Hemse', 'Klintehamn', 'Roma', 'Fårösund', 'Burgsvik',
  'Havdhem', 'Ljugarn', 'Katthammarsvik', 'Lärbro', 'Tingstäde', 'Väskinde',
  'Vibble', 'Västerhejde', 'Stånga', 'Garda', 'Fårö',

  // ---------------------------------------------------------------- Blekinge län
  'Karlskrona', 'Karlshamn', 'Ronneby', 'Sölvesborg', 'Olofström', 'Asarum',
  'Mörrum', 'Svängsta', 'Jämjö', 'Rödeby', 'Nättraby', 'Lyckeby', 'Hasslö',
  'Sturkö', 'Torhamn', 'Kallinge', 'Bräkne-Hoby', 'Johannishus', 'Listerby',
  'Backaryd', 'Hallabro', 'Kyrkhult', 'Jämshög', 'Vilshult', 'Mjällby',
  'Hällevik', 'Nogersund', 'Hörvik', 'Kristianopel', 'Fågelmara', 'Holmsjö',
  'Nävragöl', 'Eringsboda', 'Drottningskär', 'Rödeby',

  // ---------------------------------------------------------------- Skåne län
  'Malmö', 'Helsingborg', 'Lund', 'Kristianstad', 'Landskrona', 'Trelleborg',
  'Ängelholm', 'Hässleholm', 'Eslöv', 'Ystad', 'Höganäs', 'Staffanstorp',
  'Kävlinge', 'Lomma', 'Svedala', 'Vellinge', 'Burlöv', 'Simrishamn', 'Sjöbo',
  'Skurup', 'Tomelilla', 'Åstorp', 'Bjuv', 'Klippan', 'Örkelljunga', 'Perstorp',
  'Osby', 'Östra Göinge', 'Bromölla', 'Hörby', 'Höör', 'Båstad', 'Svalöv',
  'Arlöv', 'Åkarp', 'Bunkeflostrand', 'Limhamn', 'Oxie', 'Klagshamn', 'Tygelsjö',
  'Höllviken', 'Skanör', 'Falsterbo', 'Ljunghusen', 'Anderslöv', 'Smygehamn',
  'Klagstorp', 'Beddingestrand', 'Abbekås', 'Löddeköpinge', 'Furulund', 'Dösjebro',
  'Hjärup', 'Genarp', 'Veberöd', 'Dalby', 'Södra Sandby', 'Revingeby', 'Flyinge',
  'Stångby', 'Bjärred', 'Billeberga', 'Teckomatorp', 'Kågeröd', 'Röstånga',
  'Marieholm', 'Löberöd', 'Harlösa', 'Stehag', 'Tjörnarp', 'Sösdala', 'Vinslöv',
  'Hästveda', 'Bjärnum', 'Vittsjö', 'Tyringe', 'Sösdala', 'Broby', 'Knislinge',
  'Sibbhult', 'Hanaskog', 'Glimåkra', 'Lönsboda', 'Näsum', 'Åhus', 'Degeberga',
  'Tollarp', 'Önnestad', 'Fjälkinge', 'Everöd', 'Yngsjö', 'Arkelstorp',
  'Kivik', 'Sankt Olof', 'Borrby', 'Löderup', 'Skillinge', 'Brantevik',
  'Gärsnäs', 'Hammenhög', 'Rydsgård', 'Lövestad', 'Blentarp', 'Veberöd',
  'Södra Sandby', 'Genarp', 'Bara', 'Klågerup', 'Skegrie', 'Alstad',
  'Kvidinge', 'Hyllinge', 'Munka-Ljungby', 'Strövelstorp', 'Hjärnarp', 'Vejbystrand',
  'Torekov', 'Grevie', 'Förslöv', 'Viken', 'Jonstorp', 'Mjöhult', 'Nyhamnsläge',
  'Mölle', 'Arild', 'Ödåkra', 'Mörarp', 'Påarp', 'Rydebäck', 'Råå', 'Vallåkra',
  'Ekeby', 'Billesholm', 'Kvidinge', 'Stidsvig', 'Ljungbyhed', 'Riseberga',
  'Skromberga', 'Gantofta', 'Hittarp', 'Domsten', 'Lerberget', 'Väsby',
  'Barsebäckshamn', 'Häljarp', 'Glumslöv', 'Asmundtorp', 'Annelöv', 'Kvärlöv',
  'Hörby', 'Ludvigsborg', 'Äspinge', 'Önneköp', 'Killeberg', 'Loshult',
  'Immeln', 'Kyrkhult', 'Olseröd', 'Vä', 'Färlöv', 'Skepparslöv', 'Norra Åsum',

  // ---------------------------------------------------------------- Hallands län
  'Halmstad', 'Varberg', 'Falkenberg', 'Kungsbacka', 'Laholm', 'Hylte', 'Hyltebruk',
  'Oskarström', 'Getinge', 'Harplinge', 'Steninge', 'Haverdal', 'Åled', 'Simlångsdalen',
  'Trönninge', 'Eldsberga', 'Gullbrandstorp', 'Kvibille', 'Slöinge', 'Vinberg',
  'Ullared', 'Ätran', 'Fegen', 'Vessigebro', 'Glommen', 'Morup', 'Långaveka',
  'Tvååker', 'Träslövsläge', 'Bua', 'Väröbacka', 'Veddige', 'Kungsäter', 'Rolfstorp',
  'Åsa', 'Frillesås', 'Fjärås', 'Onsala', 'Vallda', 'Särö', 'Anneberg',
  'Kullavik', 'Lerkil', 'Mellbystrand', 'Skummeslövsstrand', 'Våxtorp', 'Knäred',
  'Veinge', 'Genevad', 'Hasslöv', 'Torup', 'Landeryd', 'Rydöbruk', 'Unnaryd',

  // ---------------------------------------------------------------- Västra Götalands län
  'Göteborg', 'Borås', 'Trollhättan', 'Uddevalla', 'Skövde', 'Mölndal', 'Kungälv',
  'Vänersborg', 'Lidköping', 'Alingsås', 'Partille', 'Mariestad', 'Falköping',
  'Lerum', 'Ulricehamn', 'Stenungsund', 'Vårgårda', 'Åmål', 'Mölnlycke', 'Härryda',
  'Kungsbacka', 'Ale', 'Nödinge', 'Älvängen', 'Nol', 'Surte', 'Bohus', 'Alafors',
  'Skara', 'Tidaholm', 'Vara', 'Töreboda', 'Karlsborg', 'Hjo', 'Tibro', 'Gullspång',
  'Mellerud', 'Bengtsfors', 'Dals-Ed', 'Färgelanda', 'Munkedal', 'Lysekil',
  'Sotenäs', 'Kungshamn', 'Smögen', 'Hunnebostrand', 'Tanum', 'Tanumshede',
  'Fjällbacka', 'Grebbestad', 'Hamburgsund', 'Strömstad', 'Orust', 'Henån',
  'Ellös', 'Svanesund', 'Tjörn', 'Skärhamn', 'Rönnäng', 'Kållekärr', 'Myggenäs',
  'Öckerö', 'Hönö', 'Björkö', 'Bohus-Björkö', 'Torslanda', 'Säve', 'Angered',
  'Kortedala', 'Bergsjön', 'Frölunda', 'Askim', 'Billdal', 'Hovås', 'Lindome',
  'Kållered', 'Landvetter', 'Härryda', 'Hindås', 'Rävlanda', 'Hällingsjö',
  'Bollebygd', 'Olsfors', 'Sandared', 'Sjömarken', 'Fristad', 'Dalsjöfors',
  'Viskafors', 'Kinna', 'Skene', 'Horred', 'Fritsla', 'Sätila', 'Hyssna',
  'Svenljunga', 'Tranemo', 'Länghem', 'Limmared', 'Dalstorp', 'Grimsås',
  'Herrljunga', 'Ljung', 'Annelund', 'Gråbo', 'Floda', 'Stenkullen', 'Sollebrunn',
  'Nossebro', 'Essunga', 'Grästorp', 'Vedum', 'Kvänum', 'Larv', 'Trädet', 'Åsarp',
  'Floby', 'Stenstorp', 'Axvall', 'Varnhem', 'Götene', 'Källby', 'Hällekis',
  'Lundsbrunn', 'Vinninga', 'Järpås', 'Vara', 'Kvänum', 'Emtunga', 'Hova',
  'Moholm', 'Väring', 'Timmersdala', 'Igelstorp', 'Tidan', 'Undenäs', 'Forsvik',
  'Brålanda', 'Frändefors', 'Vargön', 'Sjuntorp', 'Upphärad', 'Lilla Edet',
  'Göta', 'Nygård', 'Ljungskile', 'Uddevalla', 'Skällinge', 'Hjälmared',
  'Ödsmål', 'Spekeröd', 'Jörlanda', 'Ucklum', 'Svenshögen', 'Hjärtum',
  'Dingle', 'Hedekas', 'Rabbalshede', 'Dals Långed', 'Dals Rostock', 'Ed',
  'Åsensbruk', 'Håverud', 'Billingsfors', 'Skållerud', 'Brastad', 'Bovallstrand',
  'Marstrand', 'Kode', 'Kärna', 'Ytterby', 'Diseröd', 'Romelanda', 'Kareby',

  // ---------------------------------------------------------------- Värmlands län
  'Karlstad', 'Kristinehamn', 'Arvika', 'Säffle', 'Filipstad', 'Hagfors', 'Sunne',
  'Torsby', 'Forshaga', 'Grums', 'Kil', 'Munkfors', 'Storfors', 'Årjäng', 'Eda',
  'Charlottenberg', 'Åmotfors', 'Koppom', 'Skoghall', 'Molkom', 'Deje', 'Vålberg',
  'Edsvalla', 'Hammarö', 'Väse', 'Kristinehamn', 'Björneborg', 'Nykroppa',
  'Lesjöfors', 'Persberg', 'Ekshärad', 'Uddeholm', 'Råda', 'Sysslebäck', 'Stöllet',
  'Höljes', 'Torsby', 'Likenäs', 'Gräsmark', 'Lysvik', 'Rottneros', 'Klässbol',
  'Glava', 'Gunnarskog', 'Mangskog', 'Slottsbron', 'Segmon', 'Svanskog', 'Nysäter',
  'Långserud', 'Töcksfors', 'Lennartsfors', 'Sillerud', 'Bograngen', 'Ransäter',

  // ---------------------------------------------------------------- Örebro län
  'Örebro', 'Karlskoga', 'Kumla', 'Lindesberg', 'Hallsberg', 'Askersund', 'Nora',
  'Degerfors', 'Laxå', 'Fjugesta', 'Kopparberg', 'Hällefors', 'Grythyttan',
  'Frövi', 'Fellingsbro', 'Guldsmedshyttan', 'Storå', 'Stråssa', 'Vedevåg',
  'Odensbacken', 'Stora Mellösa', 'Glanshammar', 'Ödeby', 'Ervalla', 'Garphyttan',
  'Latorp', 'Vintrosa', 'Mullhyttan', 'Svartå', 'Åsbro', 'Hammar', 'Olshammar',
  'Hovsta', 'Lillån', 'Marieberg', 'Kvismare', 'Pålsboda', 'Sköllersta',
  'Hjortkvarn', 'Rockhammar', 'Skinnskatteberg', 'Hällabrottet', 'Kumla',

  // ---------------------------------------------------------------- Västmanlands län
  'Västerås', 'Köping', 'Sala', 'Fagersta', 'Hallstahammar', 'Arboga', 'Surahammar',
  'Kungsör', 'Norberg', 'Skinnskatteberg', 'Kolbäck', 'Ramnäs', 'Virsbo',
  'Skultuna', 'Tillberga', 'Irsta', 'Dingtuna', 'Tortuna', 'Barkarö', 'Munktorp',
  'Kolsva', 'Valskog', 'Ransta', 'Sätrabrunn', 'Möklinta', 'Heby', 'Västerfärnebo',
  'Karbenning', 'Ängelsberg', 'Hallstahammar', 'Strömsholm',

  // ---------------------------------------------------------------- Dalarnas län
  'Falun', 'Borlänge', 'Ludvika', 'Avesta', 'Mora', 'Hedemora', 'Leksand',
  'Rättvik', 'Säter', 'Smedjebacken', 'Malung', 'Vansbro', 'Orsa', 'Älvdalen',
  'Gagnef', 'Djurås', 'Insjön', 'Grängesberg', 'Fredriksberg', 'Sunnansjö',
  'Nyhammar', 'Grangärde', 'Blötberget', 'Saxdalen', 'Sälen', 'Lima', 'Transtrand',
  'Malungsfors', 'Idre', 'Särna', 'Furudal', 'Bjursås', 'Svärdsjö', 'Enviken',
  'Grycksbo', 'Sundborn', 'Vika', 'Krylbo', 'Horndal', 'Långshyttan', 'Stjärnsund',
  'Garpenberg', 'Vikmanshyttan', 'Mockfjärd', 'Björbo', 'Dala-Floda', 'Nås',
  'Dala-Järna', 'Äppelbo', 'Siljansnäs', 'Tällberg', 'Vikarbyn', 'Boda', 'Sollerön',
  'Venjan', 'Våmhus', 'Söderbärke', 'Norrbärke', 'Ornäs', 'Torsång', 'Romme',
  'Amsberg', 'Gustafs', 'Stora Skedvi', 'Åsgarn', 'Fors', 'By', 'Rönnäng',

  // ---------------------------------------------------------------- Gävleborgs län
  'Gävle', 'Sandviken', 'Hudiksvall', 'Bollnäs', 'Söderhamn', 'Ljusdal', 'Ockelbo',
  'Hofors', 'Nordanstig', 'Bergsjö', 'Gnarp', 'Harmånger', 'Jättendal', 'Hassela',
  'Delsbo', 'Näsviken', 'Iggesund', 'Enånger', 'Njutånger', 'Forsa', 'Friggesund',
  'Järvsö', 'Färila', 'Los', 'Ramsjö', 'Hennan', 'Korskrogen', 'Kilafors',
  'Arbrå', 'Vallsta', 'Edsbyn', 'Alfta', 'Rengsjö', 'Segersta', 'Ljusne',
  'Marmaverken', 'Bergvik', 'Söderala', 'Vallvik', 'Skärplinge', 'Storvik',
  'Kungsgården', 'Järbo', 'Åshammar', 'Årsunda', 'Österfärnebo', 'Hedesunda',
  'Valbo', 'Forsbacka', 'Hamrånge', 'Bergby', 'Norrsundet', 'Axmar', 'Skutskär',
  'Furuvik', 'Bomhus', 'Hille', 'Trödje', 'Lingbo', 'Hamra', 'Voxna',

  // ---------------------------------------------------------------- Västernorrlands län
  'Sundsvall', 'Örnsköldsvik', 'Härnösand', 'Sollefteå', 'Kramfors', 'Timrå',
  'Ånge', 'Alnö', 'Njurunda', 'Kvissleby', 'Sundsbruk', 'Matfors', 'Stöde',
  'Liden', 'Indal', 'Bergeforsen', 'Söråker', 'Fagervik', 'Ljustorp', 'Torpshammar',
  'Fränsta', 'Erikslund', 'Östavall', 'Alby', 'Bjästa', 'Husum', 'Köpmanholmen',
  'Gideå', 'Björna', 'Bredbyn', 'Mellansel', 'Anundsjö', 'Skorped', 'Sidensjö',
  'Nätra', 'Docksta', 'Ullånger', 'Nordingrå', 'Bollstabruk', 'Nyland', 'Lunde',
  'Sandöverken', 'Väja', 'Utansjö', 'Härnösand', 'Älandsbro', 'Ramvik', 'Nyadal',
  'Junsele', 'Näsåker', 'Ramsele', 'Långsele', 'Graninge', 'Helgum', 'Undrom',

  // ---------------------------------------------------------------- Jämtlands län
  'Östersund', 'Åre', 'Strömsund', 'Sveg', 'Krokom', 'Bräcke', 'Ragunda', 'Berg',
  'Härjedalen', 'Frösön', 'Brunflo', 'Lit', 'Häggenås', 'Nälden', 'Ås', 'Krokom',
  'Föllinge', 'Hammerdal', 'Hoting', 'Gäddede', 'Backe', 'Rossön', 'Duved',
  'Järpen', 'Undersåker', 'Mörsil', 'Hallen', 'Storlien', 'Åsarna', 'Svenstavik',
  'Hackås', 'Myrviken', 'Rätan', 'Klövsjö', 'Vemdalen', 'Hede', 'Funäsdalen',
  'Tännäs', 'Ytterhogdal', 'Lofsdalen', 'Stugun', 'Hammarstrand', 'Kälarne',
  'Pilgrimstad', 'Gällö', 'Bräcke', 'Nyhem', 'Fåker', 'Orrviken', 'Tandsbyn',

  // ---------------------------------------------------------------- Västerbottens län
  'Umeå', 'Skellefteå', 'Lycksele', 'Vännäs', 'Vindeln', 'Robertsfors', 'Nordmaling',
  'Bjurholm', 'Åsele', 'Dorotea', 'Vilhelmina', 'Storuman', 'Sorsele', 'Malå',
  'Norsjö', 'Holmsund', 'Obbola', 'Sävar', 'Hörnefors', 'Täfteå', 'Ersmark',
  'Röbäck', 'Bureå', 'Burträsk', 'Boliden', 'Byske', 'Kåge', 'Skelleftehamn',
  'Ursviken', 'Bergsbyn', 'Jörn', 'Bastuträsk', 'Kusmark', 'Lövånger', 'Bygdsiljum',
  'Ånäset', 'Bygdeå', 'Sikeå', 'Rundvik', 'Hörnsjö', 'Tvärålund', 'Granö',
  'Ammarnäs', 'Tärnaby', 'Hemavan', 'Klimpfjäll', 'Saxnäs', 'Dikanäs', 'Örträsk',
  'Rusksele', 'Kristineberg', 'Adak', 'Moskosel', 'Bäsksjö', 'Vojmån',

  // ---------------------------------------------------------------- Norrbottens län
  'Luleå', 'Piteå', 'Boden', 'Kiruna', 'Gällivare', 'Kalix', 'Haparanda',
  'Älvsbyn', 'Arvidsjaur', 'Jokkmokk', 'Arjeplog', 'Överkalix', 'Övertorneå',
  'Pajala', 'Malmberget', 'Koskullskulle', 'Svappavaara', 'Vittangi', 'Karesuando',
  'Abisko', 'Björkliden', 'Riksgränsen', 'Porjus', 'Vuollerim', 'Murjek',
  'Harads', 'Sävast', 'Unbyn', 'Gammelstad', 'Råneå', 'Antnäs', 'Måttsund',
  'Sunderbyn', 'Bergnäset', 'Rosvik', 'Hortlax', 'Öjebyn', 'Norrfjärden',
  'Roknäs', 'Sjulnäs', 'Bergsviken', 'Munksund', 'Jävre', 'Töre', 'Morjärv',
  'Sangis', 'Nikkala', 'Seskarö', 'Hedenäset', 'Korpilombolo', 'Junosuando',
  'Kangos', 'Tärendö', 'Moskosel', 'Glommersträsk', 'Kvikkjokk', 'Nattavaara',
  'Hakkas', 'Ullatti', 'Kaunisvaara',
  // ---------------------------------------------------------------- Övriga orter
  // Mindre orter, byar och stadsdelar som fanns i listan sedan tidigare och som
  // användare kan ha valt. Ligger samlade här i stället för per län eftersom flera
  // är för små för att entydigt höra till en kommunhuvudort.
  'Agnesberg', 'Ala', 'Alberga', 'Algutsrum', 'Alhamn', 'Almedal',
  'Alsen', 'Alsike', 'Altersbruk', 'Altuna', 'Alva', 'Alvik',
  'Annas', 'Annerstad', 'Aplared', 'Ardala', 'Arnäsvall', 'Arnö',
  'Arontorp', 'Arrie', 'Arsby', 'Askeby', 'Askerön', 'Asunden',
  'Augerum', 'Auneby', 'Axamo', 'Balingslöv', 'Barsebäck', 'Barsebäcksstrand',
  'Bavern', 'Berghem', 'Bergshamra', 'Bergsåker', 'Bjärtrå', 'Björksele',
  'Björköby', 'Blidsberg', 'Blåsmark', 'Bondstorp', 'Borgsjö', 'Borgstena',
  'Borgunda', 'Bosarp', 'Botildenborg', 'Brunn', 'Brunnby', 'Brännebrona',
  'Budskär', 'Bullaren', 'Bydalen', 'Byviken', 'Dalarö', 'Dalum',
  'Edsele', 'Ektjärn', 'Eriksberg', 'Eriksmåla', 'Espe', 'Espelunda',
  'Fagerberg', 'Fagerhult', 'Fiskeby', 'Fiskebäckskil', 'Floran', 'Folkaryd',
  'Forshem', 'Forsnäs', 'Forssa', 'Fosdalen', 'Fröjered', 'Fröslunda',
  'Furuby', 'Gassel', 'Gistad', 'Gotland', 'Gottröra', 'Grundsund',
  'Gräsberg', 'Gudmuntorp', 'Gunnebo', 'Gunnilse', 'Gustafsberg', 'Gyllebo',
  'Gysinge', 'Hammarby', 'Hanebo', 'Harg', 'Harriröd', 'Heden',
  'Hedeskoga', 'Hillared', 'Hjorted', 'Hjuvik', 'Hjärtsila', 'Holmsveden',
  'Holo', 'Hovslätt', 'Hultafors', 'Håbol', 'Håkantorp', 'Hällevadsholm',
  'Härlöv', 'Hässleby', 'Hökerum', 'Höstveda', 'Järeda',
  'Järna', 'Karleby', 'Karlholm', 'Karungi', 'Kattarp', 'Klockaretorpet',
  'Kvistgård', 'Kvännum', 'Källstorp', 'Källunda', 'Köpingebro', 'Lindberget',
  'Locknevi', 'Lorensberg', 'Lovene', 'Luspen', 'Lycke', 'Lönashult',
  'Lövekulle', 'Mankarbo', 'Margretetorp', 'Morkarlby', 'Mölltorp', 'Norrala', 'Nymölla', 'Pellarne', 'Pixbo', 'Rantorp', 'Rekarne',
  'Rinkaby', 'Roja', 'Rombodal', 'Rubblarp', 'Rudskoga', 'Runhällen',
  'Rydbo', 'Ryssa', 'Rådasjön', 'Ränneslöv', 'Rölanda',
  'Rött', 'Sand', 'Sandemar', 'Sandhem', 'Sanne', 'Saröd',
  'Sikhall', 'Simsala', 'Skarbygden', 'Skee', 'Skivarp', 'Smygehuk',
  'Solberg', 'Solberga', 'Solvik', 'Sorbybruk', 'Stenberga', 'Stenby',
  'Stenkvista', 'Stockvik', 'Stolpen', 'Strömma', 'Strömsberg', 'Sunnanå',
  'Svensbyn', 'Svenstorp', 'Svinnegarnshed', 'Tunnelberga', 'Ungsberg', 'Vissefärda',
  'Voxtorp', 'Vätö', 'Åsby', 'Åsbyggeby', 'Åsen',
  'Åskloster', 'Åsle', 'Åstol', 'Öjersjö', 'Ölanda', 'Ölme',
  'Ölsremma', 'Ör', 'Össlöv', 'Österhaninge',
]);

// Dedupe + svensk sortering. Set i stället för indexOf-filter: listan är stor och
// körs vid varje appstart, och indexOf gör det till O(n²). localeCompare('sv') ger
// korrekt svensk ordning där å, ä och ö hamnar sist i stället för mitt bland vokalerna.
function dedupeOchSortera(orter) {
  return [...new Set(orter)].sort((a, b) => a.localeCompare(b, 'sv'));
}
