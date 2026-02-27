// routes/pubblicazioni.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { isGestoreOrAdmin } = require('../middleware/auth');

router.get('/', async (req, res, next) => {
  try {
    const [pubs] = await db.query(
      'SELECT * FROM pubblicazioni WHERE pubblica=1 ORDER BY tipo, data_vigenza DESC'
    );
    res.render('pubblicazioni/index', { title: 'Pubblicazioni in Vigore', pubs });
  } catch (e) { next(e); }
});

router.get('/gestione/nuova', isGestoreOrAdmin, (req, res) => {
  res.render('pubblicazioni/form', { title: 'Nuova Pubblicazione', action: '/pubblicazioni/gestione', method: 'POST' });
});

router.post('/gestione', isGestoreOrAdmin, async (req, res, next) => {
  try {
    const { titolo, tipo, codice, edizione, revisione, data_vigenza, data_scadenza, percorso_file, nome_file, pubblica } = req.body;
    await db.query(
      `INSERT INTO pubblicazioni (titolo, tipo, codice, edizione, revisione, data_vigenza, data_scadenza, percorso_file, nome_file, pubblica, inserito_da)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [titolo, tipo, codice, edizione, revisione, data_vigenza||null, data_scadenza||null, percorso_file, nome_file, pubblica?1:0, req.session.user.id]
    );
    req.flash('success', 'Pubblicazione aggiunta.');
    res.redirect('/pubblicazioni');
  } catch (e) { next(e); }
});

module.exports = router;
