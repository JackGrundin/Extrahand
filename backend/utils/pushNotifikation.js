async function skickaNotifikation(token, title, body) {
  if (!token || !token.startsWith('ExponentPushToken')) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: token, title, body, sound: 'default' }),
    });
  } catch (fel) {
    console.error('Push-notifikation misslyckades:', fel);
  }
}

module.exports = { skickaNotifikation };
