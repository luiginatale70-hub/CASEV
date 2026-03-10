# CASEV - Reset password - patch semplice
# Uso: cd C:\Users\Administrator\PROGETTI-NAAF\CASEV && .\patch_reset.ps1

Write-Host "CASEV - Reset password patch..." -ForegroundColor Cyan

# 1. DB - crea tabella token
echo "CREATE TABLE IF NOT EXISTS password_reset_tokens (id INT AUTO_INCREMENT PRIMARY KEY, utente_id INT NOT NULL, token VARCHAR(64) NOT NULL UNIQUE, expires_at DATETIME NOT NULL, used TINYINT(1) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (utente_id) REFERENCES utenti(id) ON DELETE CASCADE);" | mysql -u root -pcamilla casev_db
Write-Host "OK DB" -ForegroundColor Green

# 2. Copia views (i file .hbs sono nella stessa cartella di questo script)
New-Item -ItemType Directory -Force -Path "views\auth" | Out-Null
Copy-Item "reset_request.hbs" "views\auth\reset_request.hbs" -Force
Copy-Item "reset_confirm.hbs" "views\auth\reset_confirm.hbs" -Force
Write-Host "OK views" -ForegroundColor Green

# 3. Inserisci routes in auth.js
$authContent = Get-Content "routes\auth.js" -Raw -Encoding UTF8
if ($authContent -notmatch "reset-password") {
    $snippet = Get-Content "reset_routes.js" -Raw -Encoding UTF8
    $authContent = $authContent -replace "module\.exports = router;", ($snippet + "`n`nmodule.exports = router;")
    Set-Content "routes\auth.js" $authContent -Encoding UTF8
    Write-Host "OK routes/auth.js" -ForegroundColor Green
} else {
    Write-Host "routes/auth.js gia aggiornato" -ForegroundColor Yellow
}

# 4. Aggiungi link nel login
$loginContent = Get-Content "views\auth\login.hbs" -Raw -Encoding UTF8
if ($loginContent -notmatch "reset-password") {
    $loginContent = $loginContent -replace "</form>", "</form>`n<div style='text-align:center;margin-top:12px;'><a href='/auth/reset-password' style='font-size:12px;color:#748194;'>Password dimenticata?</a></div>"
    Set-Content "views\auth\login.hbs" $loginContent -Encoding UTF8
    Write-Host "OK login.hbs" -ForegroundColor Green
}

Write-Host ""
Write-Host "PATCH COMPLETATA - riavvia: npm run dev" -ForegroundColor Green
