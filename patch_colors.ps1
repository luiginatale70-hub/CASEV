# CASEV — Aggiornamento colori CSS (PowerShell)
# Uso: cd C:\Users\Administrator\PROGETTI-NAAF\CASEV && .\patch_colors.ps1

$css = "public\css\style.css"
$main = "views\layouts\main.hbs"

Write-Host "Aggiornamento colori CSS..." -ForegroundColor Cyan

$content = Get-Content $css -Raw -Encoding UTF8

# Colori navbar/sidebar
$content = $content -replace '--navy:\s+#003882', '--navy:        #2c7be5'
$content = $content -replace '--navy-dark:\s+#002560', '--navy-dark:   #0b1727'
$content = $content -replace '--navy-light:\s+#1a5099', '--navy-light:  #1657af'
$content = $content -replace '--navy-accent:\s+#2d70c8', '--navy-accent: #2c7be5'

# Colori accent (verde GC al posto del gold)
$content = $content -replace '--gold:\s+#c8a84b', '--gold:        #00d27a'
$content = $content -replace '--gold-light:\s*#e8c96a', '--gold-light:  #27bcfd'

# Sfondo
$content = $content -replace '--bg:\s+#f0f2f5', '--bg: #edf2f9'

# Font
$content = $content -replace "'DM Sans', sans-serif", "'Open Sans', sans-serif"
$content = $content -replace "'DM Mono', monospace", "'SFMono-Regular', monospace"

Set-Content $css $content -Encoding UTF8
Write-Host "✅ style.css aggiornato" -ForegroundColor Green

# Aggiorna font Google in main.hbs
$hbs = Get-Content $main -Raw -Encoding UTF8
$hbs = $hbs -replace 'family=DM\+Sans[^"]*', 'family=Open+Sans:wght@400;600&family=Poppins:wght@400;500;600;700'
Set-Content $main $hbs -Encoding UTF8
Write-Host "✅ main.hbs aggiornato" -ForegroundColor Green

Write-Host ""
Write-Host "Fatto! Riavvia il server con: npm run dev" -ForegroundColor Yellow
