// routes/news.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { isGestoreOrAdmin } = require('../middleware/auth');

// Lista news pubbliche
router.get('/', async (req, res, next) => {
  try {
    const [news] = await db.query(
      'SELECT n.*, u.nome, u.cognome FROM news n LEFT JOIN utenti u ON n.autore_id=u.id WHERE n.pubblica=1 ORDER BY n.published_at DESC'
    );
    res.render('news/index', { title: 'News — CASEV', news });
  } catch (e) { next(e); }
});

// Singola news
router.get('/:id', async (req, res, next) => {
  try {
    const [[news]] = await db.query(
      'SELECT n.*, u.nome, u.cognome FROM news n LEFT JOIN utenti u ON n.autore_id=u.id WHERE n.id=? AND n.pubblica=1', [req.params.id]
    );
    if (!news) return res.status(404).render('error', { titolo: 'Non trovata', msg: 'News non trovata.', layout: 'main' });
    res.render('news/show', { title: news.titolo, news });
  } catch (e) { next(e); }
});

// ── GESTIONE (solo gestore/admin) ────────────────────────────

// Form nuova news
router.get('/gestione/nuova', isGestoreOrAdmin, (req, res) => {
  res.render('news/form', { title: 'Nuova News', action: '/news/gestione', method: 'POST' });
});

// Salva nuova news
router.post('/gestione', isGestoreOrAdmin, async (req, res, next) => {
  try {
    const { titolo, contenuto, categoria, pubblica, in_evidenza } = req.body;
    const excerpt = contenuto.replace(/<[^>]+>/g,'').substring(0, 200);
    await db.query(
      'INSERT INTO news (titolo, contenuto, excerpt, categoria, pubblica, in_evidenza, autore_id) VALUES (?,?,?,?,?,?,?)',
      [titolo, contenuto, excerpt, categoria, pubblica?1:0, in_evidenza?1:0, req.session.user.id]
    );
    req.flash('success', 'News pubblicata con successo.');
    res.redirect('/news');
  } catch (e) { next(e); }
});

// Elimina news
router.delete('/gestione/:id', isGestoreOrAdmin, async (req, res, next) => {
  try {
    await db.query('DELETE FROM news WHERE id=?', [req.params.id]);
    req.flash('success', 'News eliminata.');
    res.redirect('/news');
  } catch (e) { next(e); }
});

module.exports = router;
