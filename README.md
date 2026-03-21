# CASEV — Portale Gestione Personale di Volo

**Repository:** github.com/luiginatale70-hub/CASEV  
**Server intranet:** http://10.142.3.123:3000  
**Stack:** Node.js + Express + MySQL + EJS/Handlebars

---

## Avvio rapido
```bash
npm install
cp .env.example .env   # poi editare .env con le credenziali reali
npm start
```

---

## Workflow Git — a casa (Linux)
```bash
# Prima di iniziare
git pull origin main

# Dopo aver lavorato
git add .
git commit -m "tipo: descrizione"
git push origin main
```

---

## Workflow Git — in ufficio (server)
```bash
ssh luigi@10.142.3.123
cd /percorso/progetto/CASEV
git pull origin main
pm2 restart casev        # oppure: npm start
```

---

## Database casev_db
```bash
# Backup
mysqldump -u root -p casev_db > backup/backup_$(date +%d-%m-%Y).sql

# Ripristino
mysql -u root -p casev_db < backup/backup_21-03-2026.sql
```

> La cartella backup/ è nel .gitignore — i backup non vanno nel repo.

---

## Regole d'oro

- Fare sempre `git pull` prima di iniziare
- Non committare mai `.env`
- Non committare mai file `.sql`
- Fare backup del DB prima di modifiche importanti
- Un commit = una cosa sola
