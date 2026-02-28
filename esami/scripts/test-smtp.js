/**
 * Test SMTP configuration.
 * Usage:
 *   node scripts/test-smtp.js recipient@example.com
 */
require('dotenv').config();

const { verifySmtp, sendMail } = require('../src/mailer');

async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error('Uso: node scripts/test-smtp.js destinatario@example.com');
    process.exit(2);
  }

  const v = await verifySmtp();
  if (!v.ok) {
    console.error('[SMTP] verify fallita:', v);
    process.exit(1);
  }

  const info = await sendMail({
    to,
    subject: 'Test Portale NAAF - SMTP OK',
    html: `<p>Se leggi questa mail, l'SMTP è configurato correttamente.</p>
           <p><b>Timestamp:</b> ${new Date().toISOString()}</p>`,
  });

  if (info && info.error) {
    console.error('[SMTP] invio fallito:', info);
    process.exit(1);
  }

  console.log('[SMTP] invio OK:', info && (info.messageId || info.response || info));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
