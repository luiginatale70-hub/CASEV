# CASEV Project

## Setup iniziale

1. Clona repo
```
git clone URL_REPO
cd casev-final
```

2. Installa dipendenze
```
npm install
```

3. Configura `.env`
- crea file `.env`
- inserisci credenziali DB

---

## Database Sync (IMPORTANTE)

### Import database (quando arrivi in ufficio / altro PC)
```
git pull
mysql -u root -p casev_db < dump.sql
```

---

### Export database (quando fai modifiche DB)
```
mysqldump -u root -p casev_db > dump.sql
git add dump.sql
git commit -m "db update"
git push
```

---

## Workflow quotidiano

### Prima di lavorare
```
git pull
```

### Dopo modifiche codice
```
git add .
git commit -m "update"
git push
```

---

## Regole importanti

- NON modificare `.env` nel repo
- NON caricare file sensibili
- Il database NON è sincronizzato automaticamente
- Usa sempre `dump.sql` per allineare i DB
- Fai commit piccoli e frequenti

---

## Struttura base

- `routes/` → rotte
- `controllers/` → logica
- `models/` → DB
- `views/` → frontend
- `public/` → statici

---

## Problemi comuni

### DB non aggiornato
```
mysql -u root -p casev_db < dump.sql
```

### Repo non aggiornato
```
git pull
```

### Conflitti
- risolvi manualmente
- poi:
```
git add .
git commit -m "fix conflict"
git push
```

---

## Script utili

### Linux / Mac
```
mysqldump -u root -p casev_db > dump.sql
git add dump.sql
git commit -m "db sync"
git push
```

### Windows
```
mysqldump -u root -p casev_db > dump.sql
git add dump.sql
git commit -m "db sync"
git push
```

