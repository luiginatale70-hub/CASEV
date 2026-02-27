// server.js - CASEV Portale
require('dotenv').config();
const express       = require('express');
const session       = require('express-session');
const flash         = require('connect-flash');
const methodOverride = require('method-override');
const path          = require('path');
const { engine }    = require('express-handlebars');
const { injectUser } = require('./middleware/auth');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Template Engine: Handlebars ──────────────────────────────
app.engine('hbs', engine({
  extname: '.hbs',
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, 'views/layouts'),
  partialsDir: path.join(__dirname, 'views/partials'),
  helpers: {
    eq: (a, b) => a === b,
    formatDate: (d) => d ? new Date(d).toLocaleDateString('it-IT') : '-',
    formatDateTime: (d) => d ? new Date(d).toLocaleString('it-IT') : '-',
    ifRole: function(role, check, opts) {
      return role === check ? opts.fn(this) : opts.inverse(this);
    }
  }
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// ── Middleware ───────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'casev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: parseInt(process.env.SESSION_MAX_AGE) || 86400000 }
}));

app.use(flash());
app.use(injectUser);

// Flash messages → locals
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error   = req.flash('error');
  next();
});

// ── Routes ───────────────────────────────────────────────────
app.use('/',          require('./routes/home'));
app.use('/auth',      require('./routes/auth'));
app.use('/news',      require('./routes/news'));
app.use('/pubblicazioni', require('./routes/pubblicazioni'));
app.use('/personale', require('./routes/personale'));
app.use('/archivio',  require('./routes/archivio'));
app.use('/admin',     require('./routes/admin'));

// 404
app.use((req, res) => {
  res.status(404).render('error', { titolo: '404 – Pagina non trovata', msg: 'La risorsa richiesta non esiste.', layout: 'main' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { titolo: 'Errore interno', msg: err.message, layout: 'main' });
});

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 CASEV Portale avviato`);
  console.log(`   URL: http://10.142.3.123:${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}\n`);
});
