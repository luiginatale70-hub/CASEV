const nodemailer = require("nodemailer");

function isConfigured() {
  return (
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  );
}

function getTransport() {
  const secure = String(process.env.SMTP_SECURE || "true") === "true";
  const port = Number(process.env.SMTP_PORT || (secure ? 465 : 587));

  const transportOptions = {
    host: process.env.SMTP_HOST, // smtp.guardiacostiera.gov.it
    port: Number(process.env.SMTP_PORT), // 587
    secure: false, // STARTTLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
    // facoltativo: utile in debug se ci sono problemi TLS
    // logger: true,
    // debug: true,
  };

  //const transportOptions = {
  //  host: process.env.SMTP_HOST,
  //  port,
  //  secure,
  //  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  // network hardening
  //  connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 20_000),
  //  greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 20_000),
  //  socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 30_000),
  //};

  // Optional: proxy support (HTTP or SOCKS). See nodemailer docs.
  // Examples:
  //  - HTTP:  http://proxy.local:3128/
  //  - SOCKS: socks5://user:pass@proxy.local:1080/
  const proxyUrl = (process.env.SMTP_PROXY || "").trim();
  if (proxyUrl) transportOptions.proxy = proxyUrl;

  const transporter = nodemailer.createTransport(transportOptions);

  // SOCKS proxy requires the optional 'socks' module.
  if (proxyUrl && /^socks/i.test(proxyUrl)) {
    try {
      // eslint-disable-next-line global-require
      transporter.set("proxy_socks_module", require("socks"));
    } catch (e) {
      console.error(
        '[MAIL] SMTP_PROXY usa SOCKS ma il modulo "socks" non è installato. Esegui: npm i socks',
      );
    }
  }

  if (String(process.env.SMTP_DEBUG || "false") === "true") {
    transporter.set("logger", true);
    transporter.set("debug", true);
  }

  return transporter;
}

async function sendMail({ to, subject, html }) {
  if (!isConfigured()) {
    console.log("[MAIL-DEV] SMTP non configurato. Email simulata:");
    console.log({ to, subject, html });
    return { simulated: true };
  }

  const transporter = getTransport();

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    return info;
  } catch (err) {
    // Non bloccare il portale se l'SMTP fallisce (es. credenziali errate, rete, limiti).
    console.error(
      "[MAIL] Invio fallito:",
      err && err.message ? err.message : err,
    );
    return {
      error: true,
      message: err && err.message ? err.message : String(err),
    };
  }
}

async function verifySmtp() {
  if (!isConfigured()) return { configured: false };
  const transporter = getTransport();
  try {
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err && err.message ? err.message : String(err),
    };
  }
}

module.exports = { sendMail, isConfigured, verifySmtp };
