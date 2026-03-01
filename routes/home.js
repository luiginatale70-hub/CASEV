// routes/home.js — CASEV
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');

router.get('/', async (req, res, next) => {
  try {
    const [news] = await db.query(
      'SELECT * FROM news WHERE pubblica=1 ORDER BY published_at DESC LIMIT 5'
    );
    const [pubs] = await db.query(
      'SELECT * FROM pubblicazioni WHERE pubblica=1 ORDER BY data_vigenza DESC LIMIT 6'
    );
    const [[{ totPersonale }]] = await db.query(
      'SELECT COUNT(*) as totPersonale FROM personale WHERE stato="attivo"'
    );
    const [[{ totPratiche }]] = await db.query(
      'SELECT COUNT(*) as totPratiche FROM pratiche WHERE stato="valida"'
    );
    const [[{ totScadenze }]] = await db.query(
      'SELECT COUNT(*) as totScadenze FROM pratiche WHERE data_scadenza BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) AND stato="valida"'
    );

    res.render('home', {
      title: 'Home',
      news,
      pubs,
      stats: { totPersonale, totPratiche, totScadenze }
    });
  } catch (err) {
    next(err);  // FIX: era mancante "next" come parametro
  }
});

module.exports = router;
