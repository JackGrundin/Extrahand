// data (valfritt) följer med i Expo-notisen och läses av appen vid tryck för att navigera
// (t.ex. { typ: 'schema_inbjudan', schemaId }). Utelämnas data skickas ingen data-nyckel,
// så alla befintliga anrop beter sig precis som förut.
async function skickaNotifikation(token, title, body, data) {
  if (!token || !token.startsWith('ExponentPushToken')) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: token,
        title,
        body,
        sound: 'default',
        ...(data ? { data } : {}),
      }),
    });
  } catch (fel) {
    console.error('Push-notifikation misslyckades:', fel);
  }
}

module.exports = { skickaNotifikation };
