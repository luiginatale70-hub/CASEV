// middleware/auth.js

function isLoggedIn(req, res, next) {
  if (req.session && req.session.user) return next();
  req.flash('error', 'Accesso richiesto. Effettua il login.');
  res.redirect('/login');
}

function isAdmin(req, res, next) {
  if (req.session?.user?.ruolo === 'admin') return next();
  res.status(403).render('error', { titolo: 'Accesso Negato', msg: 'Area riservata agli amministratori.', layout: 'main' });
}

function isGestoreOrAdmin(req, res, next) {
  const ruolo = req.session?.user?.ruolo;
  if (ruolo === 'admin' || ruolo === 'gestore') return next();
  res.status(403).render('error', { titolo: 'Accesso Negato', msg: 'Area riservata al personale autorizzato.', layout: 'main' });
}

function injectUser(req, res, next) {
  res.locals.user = req.session?.user || null;
  res.locals.isAdmin = req.session?.user?.ruolo === 'admin';
  res.locals.isGestore = ['admin','gestore'].includes(req.session?.user?.ruolo);
  next();
}

module.exports = { isLoggedIn, isAdmin, isGestoreOrAdmin, injectUser };
