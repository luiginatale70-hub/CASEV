// server.js - CASEV Portale (con modulo Esami integrato)
require('dotenv').config();

// ——— Controllo variabili d'ambiente critiche ————————————————————————————————
if (!process.env.SESSION_SECRET) {
  console.error('\n❌ ERRORE CRITICO: SESSION_SECRET non impostato nel file .env');
  console.error('   Aggiungere: SESSION_SECRET=<stringa-lunga-e-casuale>');
  console.error('   Esempio:    SESSION_SECRET=casev2026-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
  process.exit(1);
}

const express        = require('express');
const session        = require('express-session');
const flash          = require('connect-flash');
const methodOverride = require('method-override');
const path           = require('path');
const { engine }     = require('express-handlebars');
const { injectUser } = require('./middleware/auth');
const MySQLStore     = require('express-mysql-session')(session);
const mysql          = require('mysql2/promise');
const testDB = require('./config/dbTest');
testDB();
const app  = express();
const globalMiddleware = require('./middleware/global');
const PORT = process.env.PORT || 3000;

// ——— Handlebars (view CASEV .hbs) ————————————————————————————————————————
app.engine('hbs', engine({
  extname: '.hbs',
  defaultLayout: 'main',
  layoutsDir:  path.join(__dirname, 'views/layouts'),
  partialsDir: path.join(__dirname, 'views/partials'),
  helpers: {
    eq: (a, b) => a === b,
    ne: (a, b) => a !== b,
    gt: (a, b) => a > b,
    lt: (a, b) => a < b,

    formatDate: (d) =>
      d ? new Date(d).toLocaleDateString('it-IT') : '—',

    formatDateTime: (d) =>
      d
        ? new Date(d).toLocaleString('it-IT', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : '—',

    ifRole(role, check, opts) {
      return role === check ? opts.fn(this) : opts.inverse(this)
    },

    prev_page() {
      return (this.page || 1) - 1
    },
    next_page() {
      return (this.page || 1) + 1
    },

    year: () => new Date().getFullYear(),
  }
}));

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// ——— Middleware globali ————————————————————————————————————————————————
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(globalMiddleware.autoLogout);
app.use(require('./middleware/auditLogger'));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// ——— Session Store MySQL ————————————————————————————————————————————————
const sessionDB = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'casev_db',
};

const sessionStore = new MySQLStore(sessionDB);

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: { maxAge: parseInt(process.env.SESSION_MAX_AGE) || 3600000 }
}));

app.use(flash());

// ——— Auto-logout per inattività ————————————————————————————————————————
const SESSION_TIMEOUT_MS = parseInt(process.env.SESSION_TIMEOUT_MS) || 3600000;

app.use((req, res, next) => {
  const p = req.path;

  const isStatic =
    p.startsWith('/public') ||
    p.startsWith('/uploads') ||
    p.startsWith('/esami/uploads') ||
    p === '/favicon.ico' ||
    /\.(css|js|png|jpg|jpeg|gif|svg|ico|webp)$/i.test(p);

  if (isStatic) return next();

  if (req.session && req.session.user) {
    const now  = Date.now();
    const last = req.session.lastActivity || now;

    if (now - last > SESSION_TIMEOUT_MS) {
      const isEsami = p.startsWith('/esami');
      return req.session.destroy(() => {
        res.redirect(isEsami ? '/esami/login?timeout=1' : '/auth/login?timeout=1');
      });
    }
    req.session.lastActivity = now;
  }
  next();
});

app.use(injectUser);

// Flash → locals
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error   = req.flash('error');
  next();
});

// ——— Routes CASEV ————————————————————————————————————————————————
app.use('/', require('./routes'));
app.use('/esami', require('./modules/esami'));

// ——— Route configurazione percorso pubblicazioni (CORRETTA) ——————————————
app.use('/admin/pubblicazioni-path', require('./routes/admin_pubblicazioni'));

// ——— Fix redirect senza prefisso /esami ————————————————————————————————
app.use((req, res, next) => {
  const p = req.path;
  if (
    p.startsWith('/student/') ||
    p.startsWith('/instructor/') ||
    p === '/student' || p === '/instructor'
  ) {
    return res.redirect('/esami' + p);
  }
  next();
});

// ——— 404 ————————————————————————————————————————————————————————————————
app.use((req, res) => {
  res.status(404).render('error', {
    titolo: '404 – Pagina non trovata',
    msg: 'La risorsa richiesta non esiste.',
    layout: 'main'
  });
});

// ——— Error handler ————————————————————————————————————————————————
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    titolo: 'Errore interno',
    msg: err.message,
    layout: 'main'
  });
});

// ——— Start ————————————————————————————————————————————————————————————————
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 CASEV Portale avviato`);
  console.log(`   URL:    http://localhost:${PORT}`);
  console.log(`   Esami:  http://localhost:${PORT}/esami`);
  console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}\n`);
});
