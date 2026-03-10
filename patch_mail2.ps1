# CASEV — Aggiornamento mail con username + primo accesso
# Uso: cd C:\Users\Administrator\PROGETTI-NAAF\CASEV && .\patch_mail2.ps1

$file = "esami\routes\instructor.js"
$content = Get-Content $file -Raw -Encoding UTF8

# 1. Aggiungi require db principale per leggere utenti (dopo require('../src/db'))
$oldRequire = "const { run, get, all } = require('../src/db');"
$newRequire = "const { run, get, all } = require('../src/db');
const mysql = require('../config/db');"
$content = $content.Replace($oldRequire, $newRequire)

# 2. Sostituisci il blocco sendMail con versione che include username
$oldSendMail = 'sendMail({ to: student.email, subject: ' + "'" + 'CASEV - NAAF - Assegnazione Test Teorico' + "'"

$newBlock = @'
    // Recupera username dal DB principale
    let studentUsername = student.email;
    try {
      const [[uRow]] = await mysql.query('SELECT username FROM utenti WHERE email=? LIMIT 1', [student.email]);
      if (uRow) studentUsername = uRow.username;
    } catch(e) {}

    sendMail({ to: student.email, subject: 'CASEV - NAAF - Assegnazione Test Teorico',
'@

$content = $content.Replace("    " + $oldSendMail, $newBlock + "    sendMail({ to: student.email, subject: 'CASEV - NAAF - Assegnazione Test Teorico',")

# 3. Aggiorna l'HTML della mail per includere username
$oldHtml = "html: '<div style=""font-family:sans-serif;max-width:600px""><div style=""background:#0b1727;padding:20px 30px""><h2 style=""color:#fff;margin:0"">CASEV</h2><p style=""color:#27bcfd;margin:4px 0 0;font-size:12px"">Centro Addestramento Equipaggi di Volo</p></div><div style=""padding:24px;border:1px solid #e5e7eb""><p>Gentile <strong>' + student.name + ' ' + student.surname + '</strong>,</p><p>Ti e stato assegnato un test teorico:</p><table style=""width:100%;border-collapse:collapse;margin:16px 0""><tr><td style=""padding:8px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600"">Tipo</td><td style=""padding:8px;border:1px solid #e5e7eb"">' + examType + '</td></tr><tr><td style=""padding:8px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600"">Domande</td><td style=""padding:8px;border:1px solid #e5e7eb"">' + num + '</td></tr><tr><td style=""padding:8px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600"">Durata</td><td style=""padding:8px;border:1px solid #e5e7eb"">' + duration + ' minuti</td></tr></table><p style=""margin:24px 0 8px"">Accedi al portale per svolgere il test:</p><a href=""http://10.142.3.123/esami/auth/login"" style=""display:inline-block;background:#2c7be5;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600"">Accedi al Test</a><hr style=""margin:24px 0;border:none;border-top:1px solid #e5e7eb""><p style=""color:#748194;font-size:12px"">CASEV - Portale Intranet GC</p></div></div>'"

$newHtml = "html: '<div style=""font-family:sans-serif;max-width:600px""><div style=""background:#0b1727;padding:20px 30px""><h2 style=""color:#fff;margin:0"">CASEV</h2><p style=""color:#27bcfd;margin:4px 0 0;font-size:12px"">Centro Addestramento Equipaggi di Volo</p></div><div style=""padding:24px;border:1px solid #e5e7eb""><p>Gentile <strong>' + student.name + ' ' + student.surname + '</strong>,</p><p>Ti e stato assegnato un test teorico:</p><table style=""width:100%;border-collapse:collapse;margin:16px 0""><tr><td style=""padding:8px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600"">Tipo</td><td style=""padding:8px;border:1px solid #e5e7eb"">' + examType + '</td></tr><tr><td style=""padding:8px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600"">Domande</td><td style=""padding:8px;border:1px solid #e5e7eb"">' + num + '</td></tr><tr><td style=""padding:8px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600"">Durata</td><td style=""padding:8px;border:1px solid #e5e7eb"">' + duration + ' minuti</td></tr></table><hr style=""margin:16px 0;border:none;border-top:1px solid #e5e7eb""><p><strong>Credenziali di accesso:</strong></p><table style=""width:100%;border-collapse:collapse;margin:8px 0 16px""><tr><td style=""padding:8px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600"">Username</td><td style=""padding:8px;border:1px solid #e5e7eb;font-family:monospace"">' + studentUsername + '</td></tr><tr><td style=""padding:8px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600"">Password</td><td style=""padding:8px;border:1px solid #e5e7eb"">Usa la password assegnata. Se e il primo accesso clicca <a href=""http://10.142.3.123/esami/auth/reset-request"">Reimposta password</a></td></tr></table><p style=""margin:24px 0 8px"">Accedi al portale per svolgere il test:</p><a href=""http://10.142.3.123/esami/auth/login"" style=""display:inline-block;background:#2c7be5;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600"">Accedi al Test</a><hr style=""margin:24px 0;border:none;border-top:1px solid #e5e7eb""><p style=""color:#748194;font-size:12px"">CASEV - Portale Intranet GC</p></div></div>'"

$content = $content.Replace($oldHtml, $newHtml)

Set-Content $file $content -Encoding UTF8
Write-Host "✅ Mail aggiornata con username" -ForegroundColor Green
Write-Host ""
Write-Host "Ora esegui patch_reset.ps1 per aggiungere la funzione reset password" -ForegroundColor Yellow
