# CASEV — Portale Guardia Costiera
> Centro Addestramento Equipaggi di Volo

---

## 📁 Struttura Progetto

```
casev/
├── server.js              # Entry point Node.js
├── package.json
├── .env.example           # Template configurazione
├── setup.js               # Script setup iniziale
├── config/
│   └── db.js              # Pool connessione MySQL
├── middleware/
│   └── auth.js            # Autenticazione e ruoli
├── routes/
│   ├── home.js
│   ├── auth.js            # Login / logout
│   ├── news.js
│   ├── pubblicazioni.js
│   ├── personale.js       # Database equipaggi
│   ├── archivio.js        # Browser cartelle server
│   └── admin.js           # Pannello admin
├── views/
│   ├── layouts/           # Layout Handlebars
│   ├── partials/          # Sidebar, topbar, footer...
│   ├── home.hbs
│   ├── auth/login.hbs
│   ├── personale/
│   ├── archivio/
│   └── admin/
├── public/
│   ├── css/style.css
│   └── js/main.js
└── database/
    └── schema.sql         # Schema completo DB
```

---

## 🚀 Installazione Passo-Passo

### 1. Prerequisiti sul server

```bash
# Node.js 18+ (già installato sul tuo server)
node --version

# MySQL
mysql --version

# Git (opzionale)
git --version
```

### 2. Copia il progetto sul server

Copia la cartella `casev/` sul tuo server, ad esempio in `/var/www/casev/`

```bash
# Oppure via SCP dal tuo PC:
scp -r casev/ utente@10.142.3.123:/var/www/
```

### 3. Configura il Database MySQL

```bash
# Accedi a MySQL come root
mysql -u root -p

# Crea database e utente
CREATE DATABASE casev_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'casev_user'@'localhost' IDENTIFIED BY 'PASSWORD_SICURA';
GRANT ALL PRIVILEGES ON casev_db.* TO 'casev_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# Importa lo schema
mysql -u casev_user -p casev_db < /var/www/casev/database/schema.sql
```

### 4. Configura le variabili d'ambiente

```bash
cd /var/www/casev
cp .env.example .env
nano .env   # Modifica con i tuoi dati
```

Valori da impostare in `.env`:
```
DB_HOST=localhost
DB_NAME=casev_db
DB_USER=casev_user
DB_PASSWORD=PASSWORD_SICURA
SESSION_SECRET=UnaStringaLungaERandom123!
ARCHIVIO_PATH=/percorso/alle/tue/cartelle/condivise
```

### 5. Installa le dipendenze

```bash
cd /var/www/casev
npm install
```

### 6. Crea utente Admin

```bash
node setup.js
```
Segui la guida interattiva per creare il primo utente admin.

### 7. Avvia il portale

```bash
# Sviluppo (con auto-reload)
npm run dev

# Produzione
npm start
```

Il portale sarà disponibile su: **http://10.142.3.123:3000**

---

## 🔄 Avvio automatico con PM2 (produzione)

```bash
# Installa PM2
npm install -g pm2

# Avvia l'app
pm2 start server.js --name casev

# Avvio automatico al riavvio del server
pm2 startup
pm2 save

# Comandi utili
pm2 status
pm2 logs casev
pm2 restart casev
```

---

## 👥 Ruoli Utenti

| Ruolo | Accesso |
|-------|---------|
| **Admin** | Tutto: gestione utenti, archivio, personale, admin dashboard |
| **Gestore** | Archivio, personale, news, pubblicazioni |
| **Allievo** | Solo esami on-line (applicazione esterna) |
| **Pubblico** | Home, news pubbliche, pubblicazioni in vigore |

---

## 📂 Configurazione Archivio

L'archivio punta alle cartelle condivise già presenti sul server.
Imposta `ARCHIVIO_PATH` nel file `.env` con il percorso reale:

```
ARCHIVIO_PATH=/mnt/archivio-condiviso
```

La struttura consigliata delle cartelle:
```
archivio-condiviso/
├── pratiche-piloti/
├── pratiche-operatori/
├── pratiche-tecnici/
├── pubblicazioni-in-vigore/
├── normative/
└── manualistica/
```

---

## 🔗 Link Applicazione Esami

L'app esami esiste già sul server. Per collegarla, in `views/partials/sidebar.hbs` 
modifica il link `href` con l'URL corretto della tua app esami esistente.

---

## 💡 Editor Consigliati

| Editor | Note |
|--------|-------|
| **VS Code** | Già in uso. Ottimo. Aggiungi estensioni: ESLint, Prettier, Handlebars |
| **Cursor** | VS Code + AI integrata. Molto utile per sviluppo assistito |
| **Zed** | Veloce, moderno, con supporto AI |
| **WebStorm** | IDE completo JetBrains, eccellente per Node.js (a pagamento) |

---

## 🔒 Note di Sicurezza

- Cambia `SESSION_SECRET` con una stringa random lunga (es: `openssl rand -hex 32`)
- Cambia la password DB con qualcosa di sicuro
- Il portale è già progettato per uso intranet, non esporre su internet senza HTTPS
- I log di accesso (riusciti e falliti) sono tracciati in `log_accessi`
