const nodemailer = require('nodemailer');

function skapaTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function skickaVerifieringsMail(email, kod) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('SMTP inte konfigurerat. Sätt SMTP_HOST, SMTP_USER och SMTP_PASS i miljövariablerna.');
  }
  const transporter = skapaTransporter();
  await transporter.sendMail({
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
}

async function testaSmtp(tillEmail) {
  const konfig = {
    SMTP_HOST: process.env.SMTP_HOST || '(saknas)',
    SMTP_PORT: process.env.SMTP_PORT || '587 (standard)',
    SMTP_USER: process.env.SMTP_USER || '(saknas)',
    SMTP_PASS: process.env.SMTP_PASS ? '(finns)' : '(saknas)',
    EMAIL_FROM: process.env.EMAIL_FROM || '(saknas)',
  };

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return { ok: false, fel: 'SMTP-variabler saknas', konfig };
  }

  const transporter = skapaTransporter();
  try {
    await transporter.verify();
  } catch (e) {
    return { ok: false, fel: 'Anslutning misslyckades: ' + e.message, konfig };
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'FastGig <noreply@fastgig.se>',
      to: tillEmail,
      subject: 'SMTP-test – FastGig',
      text: 'Om du ser detta fungerar SMTP-konfigurationen.',
    });
    return { ok: true, konfig };
  } catch (e) {
    return { ok: false, fel: 'Skickning misslyckades: ' + e.message, konfig };
  }
}

module.exports = { skickaVerifieringsMail, testaSmtp };
