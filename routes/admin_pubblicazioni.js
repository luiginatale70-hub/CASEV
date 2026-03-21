const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAdmin } = require('../middleware/auth');

router.use(isAdmin);

// Mostra form
router.get('/', async (req, res) => {
  const [[row]] = await db.query(
    "SELECT valore FROM config WHERE chiave='pubblicazioni_path'"
  );
  res.render('admin/pubblicazioni_path', {
    title: 'Percorso Pubblicazioni',
    path: row ? row.valore : ''
  });
});

// Salva percorso
router.post('/', async (req, res) => {
  const nuovo = req.body.path.trim();
  await db.query(`
    INSERT INTO config (chiave, valore)
    VALUES ('pubblicazioni_path', ?)
    ON DUPLICATE KEY UPDATE valore=VALUES(valore)
  `, [nuovo]);

  req.flash('success', 'Percorso Pubblicazioni aggiornato.');
  res.redirect('/admin/pubblicazioni-path');
});

module.exports = router;
