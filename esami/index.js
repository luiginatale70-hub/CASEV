/**
 * esami/index.js
 * Modulo esami montato in CASEV sotto /esami
 * Le view EJS vengono cercate in casev/esami/views/ (path originale del portale esami)
 */
const express        = require('express');
const path           = require('path');
const ejs            = require('ejs');
const prefixRedirect = require('./src/prefixRedirect');

const router = express.Router();

// Cartella view EJS — è la cartella views originale del portale esami
// copiata dentro casev/esami/views/
const VIEWS_DIR = path.join(__dirname, 'views');

// ── Sovrascrive res.render per usare EJS con path assoluto ──
router.use((req, res, next) => {
  res.render = function(viewName, options, callback) {
    const viewPath = path.join(VIEWS_DIR, viewName + '.ejs');
    const locals   = Object.assign({}, res.locals, options || {});

    ejs.renderFile(viewPath, locals, {
      views: VIEWS_DIR  // necessario per i partial <%- include() %>
    }, (err, html) => {
      if (err) {
        console.error('EJS render error:', viewName, err.message);
        return res.status(500).send('Errore rendering: ' + err.message);
      }
      if (callback) return callback(null, html);
      res.send(html);
    });
  };
  next();
});

// ── Inject locals ───────────────────────────────────────────
router.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.user        = res.locals.currentUser;
  res.locals.flash = {
    success: req.flash ? req.flash('success') : [],
    error:   req.flash ? req.flash('error')   : [],
    info:    req.flash ? req.flash('info')     : []
  };
  res.locals.formatDateIT = (dateStr) => {
    if (!dateStr) return '';
    const d  = new Date(dateStr);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}.${mm}.${d.getFullYear()}`;
  };
  next();
});

// ── Prefix redirect ─────────────────────────────────────────
router.use(prefixRedirect);

// ── Routes ──────────────────────────────────────────────────
router.use('/',           require('./routes/auth'));
router.use('/student',    require('./routes/student'));
router.use('/instructor', require('./routes/instructor'));
router.use('/admin',      require('./routes/admin'));

// ── Home: redirect in base al ruolo ─────────────────────────
router.get('/', (req, res) => {
  if (!req.session.user) return res.redirect('/esami/login');
  const role = req.session.user.role;
  if (role === 'student')    return res.redirect('/esami/student');
  if (role === 'instructor') return res.redirect('/esami/instructor');
  if (role === 'admin')      return res.redirect('/esami/admin');
  res.redirect('/esami/login');
});

module.exports = router;
