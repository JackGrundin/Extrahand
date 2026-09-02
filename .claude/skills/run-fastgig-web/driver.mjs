#!/usr/bin/env node
// Driver för FastGig-appen körd som webb (expo start --web) via Playwright.
//
// Maskinen saknar Xcode och Android-SDK, så webbmålet är enda sättet att köra appen
// automatiserat. React Native Web renderar riktiga DOM-noder, så vanliga Playwright-
// selektorer fungerar – texter och placeholders är samma strängar som i JSX:en.
//
// Läser kommandon från stdin, ett per rad, och skriver resultatet till stdout. Byggd som
// REPL i stället för ett fast flöde eftersom varje genomgång vill klicka på olika saker.
//
//   node .claude/skills/run-fastgig-web/driver.mjs <<'EOF'
//   login uitest-priv@example.invalid Testlosen123
//   click UITEST Lagerarbete
//   ss detalj
//   text Behörighetskrav 400
//   EOF
//
// Kommandon:
//   goto [url]                 – ladda appen (default http://localhost:8082)
//   login <email> <lösenord>   – goto + fyll i och skicka inloggningsformuläret
//   click <text>               – klicka på FÖRSTA elementet med exakt den texten
//   clicklast <text>           – klicka på SISTA (flikfältet dubblerar ofta texter)
//   fill <placeholder> = <text>– skriv i fältet med den placeholdern
//   text [nyckelord] [antal]   – dumpa synlig text, ev. från och med ett nyckelord
//   ss <namn>                  – skärmbild till skott/<namn>.png
//   ssfull <namn>              – hela sidan, inte bara vyporten
//   wait <ms>                  – pausa
//   quit                       – stäng
//
// Alla kommandon skriver "OK <kommando>" eller "FEL <kommando>: <orsak>" så att en
// agent kan läsa av resultatet utan att gissa.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { createInterface } from 'node:readline';

const BAS = process.env.FASTGIG_WEB_URL ?? 'http://localhost:8082';
const SKOTT = process.env.FASTGIG_SKOTT ?? 'skott';
// React Native Web monterar hela trädet i JS. networkidle betyder inte "klar att klicka",
// så varje navigering följs av en fast paus – utan den missar selektorerna konsekvent.
const RITPAUS = Number(process.env.FASTGIG_RITPAUS ?? 3500);

mkdirSync(SKOTT, { recursive: true });

const browser = await chromium.launch();
const sida = await browser.newPage({ viewport: { width: 420, height: 900 } });

const sidfel = [];
sida.on('pageerror', e => sidfel.push(e.message.slice(0, 300)));
sida.on('console', m => { if (m.type() === 'error') sidfel.push('console: ' + m.text().slice(0, 200)); });

async function goto(url = BAS) {
  await sida.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await sida.waitForTimeout(RITPAUS);
}

async function login(email, lösenord) {
  await goto();
  // Inloggningsskärmen har exakt två inputs. getByPlaceholder är sprödare här eftersom
  // fälten byter placeholder mellan versioner.
  const fält = sida.locator('input');
  await fält.nth(0).fill(email);
  await fält.nth(1).fill(lösenord);
  // "Logga in" står både som rubrik och på knappen – knappen är den sista.
  await sida.getByText('Logga in', { exact: true }).last().click();
  await sida.waitForTimeout(5000);
}

async function hämtaText(nyckelord, antal = 500) {
  const kropp = await sida.locator('body').innerText();
  if (!nyckelord) return kropp.slice(0, antal);
  const i = kropp.indexOf(nyckelord);
  return i === -1 ? `(hittade inte "${nyckelord}")` : kropp.slice(i, i + antal);
}

// Delar "vänster = höger" på det FÖRSTA mellanslagsomgärdade likhetstecknet. En vanlig
// split('=') går sönder på CSS-selektorer som input[type=date], som själva innehåller ett
// likhetstecken.
function delaPåLikhetstecken(arg) {
  const rad = arg.join(' ');
  const i = rad.indexOf(' = ');
  if (i === -1) return [rad.trim(), ''];
  return [rad.slice(0, i).trim(), rad.slice(i + 3).trim()];
}

const kommandon = {
  goto: async a => { await goto(a[0] || BAS); },
  login: async a => { await login(a[0], a[1]); },
  click: async a => {
    await sida.getByText(a.join(' '), { exact: true }).locator('visible=true').first().click();
    await sida.waitForTimeout(1200);
  },
  clicklast: async a => {
    await sida.getByText(a.join(' '), { exact: true }).locator('visible=true').last().click();
    await sida.waitForTimeout(1200);
  },
  // Bara SYNLIGA fält. Publicera-fliken monterar både jobb- och schemaformuläret
  // samtidigt och döljer det ena med CSS, så en ren placeholder-matchning träffar två
  // element och Playwright vägrar med "strict mode violation".
  fill: async a => {
    const [ph, värde] = delaPåLikhetstecken(a);
    await sida.getByPlaceholder(ph).locator('visible=true').first().fill(värde);
    await sida.waitForTimeout(400);
  },
  // Datum- och tidfälten renderas på webb som <input type="date"|"time"> och har ingen
  // placeholder att peka på. Formatet är detsamma som appen använder internt:
  // 'YYYY-MM-DD' respektive 'HH:MM'.
  //   fillsel input[type=date] 0 = 2026-09-01
  fillsel: async a => {
    const [vänster, värde] = delaPåLikhetstecken(a);
    const delar = vänster.split(/\s+/);
    const index = /^\d+$/.test(delar[delar.length - 1]) ? Number(delar.pop()) : 0;
    await sida.locator(delar.join(' ')).nth(index).fill(värde);
    await sida.waitForTimeout(400);
  },
  // Hur många element en selektor matchar – för att veta hur många fält som finns.
  count: async a => {
    console.log(`${a.join(' ')}: ${await sida.locator(a.join(' ')).count()}`);
  },
  text: async a => {
    const sista = a[a.length - 1];
    const antal = /^\d+$/.test(sista ?? '') ? Number(a.pop()) : 500;
    console.log(await hämtaText(a.join(' ') || null, antal));
  },
  // Kör godtycklig JS i sidkontexten och skriver ut returvärdet. Främst för att inspektera
  // och manipulera AsyncStorage (localStorage på webb) – t.ex. simulera en död session
  // genom att nolla eller förvanska token.
  //   eval localStorage.getItem('token')
  //   eval localStorage.setItem('token','ogiltig')
  eval: async a => { console.log('EVAL:', JSON.stringify(await sida.evaluate(a.join(' ')))); },
  ss: async a => { await sida.screenshot({ path: `${SKOTT}/${a[0] ?? 'skott'}.png` }); },
  ssfull: async a => { await sida.screenshot({ path: `${SKOTT}/${a[0] ?? 'skott'}.png`, fullPage: true }); },
  wait: async a => { await sida.waitForTimeout(Number(a[0] ?? 1000)); },
};

const rader = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const rå of rader) {
  const rad = rå.trim();
  if (!rad || rad.startsWith('#')) continue;
  if (rad === 'quit') break;

  const [namn, ...arg] = rad.split(/\s+/);
  const fn = kommandon[namn];
  if (!fn) { console.log(`FEL ${namn}: okänt kommando`); continue; }
  try {
    await fn(arg);
    console.log(`OK ${rad}`);
  } catch (fel) {
    console.log(`FEL ${rad}: ${String(fel.message).split('\n')[0]}`);
  }
}

// Sidfel rapporteras sist och inte löpande – ett React-varningsflöde mitt i utskriften
// gör resultatet oläsbart.
console.log(sidfel.length ? `\nSIDFEL (${sidfel.length}):\n - ${[...new Set(sidfel)].join('\n - ')}` : '\nSIDFEL: inga');
await browser.close();
