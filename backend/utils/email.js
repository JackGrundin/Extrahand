const { Resend } = require('resend');

function skapaResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

async function skickaVerifieringsMail(email, kod) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY saknas i miljövariablerna.');
  }
  const resend = skapaResend();
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'FastGig <noreply@fastgig.se>',
    to: email,
    subject: 'Din verifieringskod – FastGig',
    html: `
      <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;">
        <h1 style="color:#2563eb;font-size:24px;margin:0 0 8px;">FastGig</h1>
        <p style="color:#444;font-size:16px;margin:0 0 24px;">Tack för att du registrerade dig! Ange koden nedan i appen för att aktivera ditt konto.</p>
        <div style="background:#eff6ff;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
          <p style="color:#888;font-size:13px;margin:0 0 8px;">Din verifieringskod</p>
          <p style="color:#1e40af;font-size:40px;font-weight:700;letter-spacing:10px;margin:0;">${kod}</p>
        </div>
        <p style="color:#888;font-size:13px;margin:0;">Koden är giltig i 24 timmar. Om du inte registrerade ett konto kan du ignorera detta mail.</p>
      </div>
    `,
  });
  if (error) throw new Error(error.message);
}

// Mejlet med återställningslänken. Länken pekar på backendens egna webbsida
// (/aterstall-losenord), inte in i appen: appen saknar deep link-schema, och en
// webbsida fungerar dessutom oavsett om användaren öppnar mejlet på telefonen
// eller på en dator.
async function skickaÅterställningsMail(email, länk, giltigTimmar) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY saknas i miljövariablerna.');
  }
  const resend = skapaResend();
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'FastGig <noreply@fastgig.se>',
    to: email,
    subject: 'Återställ ditt lösenord – FastGig',
    html: `
      <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;">
        <h1 style="color:#2563eb;font-size:24px;margin:0 0 8px;">FastGig</h1>
        <p style="color:#444;font-size:16px;margin:0 0 24px;">Du har begärt att återställa ditt lösenord. Klicka på knappen nedan för att välja ett nytt.</p>
        <div style="text-align:center;margin-bottom:24px;">
          <a href="${länk}" style="display:inline-block;background:#2563eb;color:#fff;font-size:16px;font-weight:600;text-decoration:none;border-radius:10px;padding:14px 28px;">Välj nytt lösenord</a>
        </div>
        <p style="color:#888;font-size:13px;margin:0 0 16px;">Fungerar inte knappen? Kopiera den här adressen till din webbläsare:<br />
          <span style="color:#2563eb;word-break:break-all;">${länk}</span>
        </p>
        <p style="color:#888;font-size:13px;margin:0;">Länken är giltig i ${giltigTimmar} timme${giltigTimmar === 1 ? '' : 'r'} och kan bara användas en gång. Om du inte begärde en återställning kan du ignorera detta mail – ditt lösenord är oförändrat.</p>
      </div>
    `,
  });
  if (error) throw new Error(error.message);
}

async function testaSmtp(tillEmail) {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, fel: 'RESEND_API_KEY saknas i miljövariablerna.' };
  }
  const resend = skapaResend();
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'FastGig <noreply@fastgig.se>',
    to: tillEmail,
    subject: 'E-posttest – FastGig',
    text: 'Om du ser detta fungerar e-postkonfigurationen.',
  });
  if (error) return { ok: false, fel: error.message };
  return { ok: true };
}

module.exports = { skickaVerifieringsMail, skickaÅterställningsMail, testaSmtp };
