# CASEV — Aggiornamento mail assegnazione esame
# Uso: cd C:\Users\Administrator\PROGETTI-NAAF\CASEV && .\patch_mail.ps1

$file = "esami\routes\instructor.js"
$content = Get-Content $file -Raw -Encoding UTF8

$oldMail = "sendMail({ to: student.email, subject: 'CASEV - NAAF - Assegnazione test teorico ', html: '<p>Ti " + [char]0xC3 + [char]0xA8 + " stato assegnato un test teorico: ' + examType + ', ' + num + ' domande, ' + duration + ' min.</p>' }).catch(() => {});"

$newMail = @"
sendMail({
  to: student.email,
  subject: 'CASEV - NAAF - Assegnazione Test Teorico',
  html: '<div style="font-family:Open Sans,sans-serif;max-width:600px;margin:0 auto;">' +
        '<div style="background:#0b1727;padding:20px 30px;border-radius:8px 8px 0 0;">' +
        '<h2 style="color:#fff;margin:0;letter-spacing:2px;">CASEV</h2>' +
        '<p style="color:#27bcfd;margin:4px 0 0;font-size:12px;">Centro Addestramento Equipaggi di Volo</p>' +
        '</div>' +
        '<div style="background:#fff;padding:30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">' +
        '<p>Gentile <strong>' + student.name + ' ' + student.surname + '</strong>,</p>' +
        '<p>Ti e stato assegnato un nuovo test teorico:</p>' +
        '<table style="width:100%;border-collapse:collapse;margin:16px 0;">' +
        '<tr><td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600;width:40%;">Tipo esame</td><td style="padding:8px 12px;border:1px solid #e5e7eb;">' + examType + '</td></tr>' +
        '<tr><td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600;">Numero domande</td><td style="padding:8px 12px;border:1px solid #e5e7eb;">' + num + '</td></tr>' +
        '<tr><td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600;">Durata</td><td style="padding:8px 12px;border:1px solid #e5e7eb;">' + duration + ' minuti</td></tr>' +
        '</table>' +
        '<p style="margin:24px 0 8px;">Clicca il pulsante per accedere al test:</p>' +
        '<a href="http://10.142.3.123/esami/student/exams" style="display:inline-block;background:#2c7be5;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">Accedi al Test</a>' +
        '<hr style="margin:28px 0;border:none;border-top:1px solid #e5e7eb;">' +
        '<p style="color:#748194;font-size:12px;margin:0;">CASEV &mdash; Portale Intranet GC &mdash; <a href="http://10.142.3.123" style="color:#2c7be5;">http://10.142.3.123</a></p>' +
        '</div></div>'
}).catch(() => {});
"@

# Cerca e sostituisce la riga sendMail
$content = $content -replace [regex]::Escape("sendMail({ to: student.email, subject: 'CASEV - NAAF - Assegnazione test teorico ', html: '") + ".*?" + [regex]::Escape("}).catch(() => {});"), $newMail

Set-Content $file $content -Encoding UTF8
Write-Host "✅ Mail aggiornata con link esame" -ForegroundColor Green
