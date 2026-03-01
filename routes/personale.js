// routes/personale.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { isGestoreOrAdmin } = require('../middleware/auth');

// Tutti protetti da login
router.use(isGestoreOrAdmin);

// Lista personale
router.get('/', async (req, res, next) => {
  try {
    const { cerca, categoria, stato } = req.query;
    let query = 'SELECT * FROM personale WHERE 1=1';
    const params = [];

    if (cerca) {
      query += ' AND (cognome LIKE ? OR nome LIKE ? OR matricola LIKE ?)';
      const s = `%${cerca}%`;
      params.push(s, s, s);
    }
    if (categoria) { query += ' AND categoria=?'; params.push(categoria); }
    if (stato)     { query += ' AND stato=?'; params.push(stato); }

    query += ' ORDER BY cognome, nome';
    const [personale] = await db.query(query, params);
    res.render('personale/index', { title: 'Personale Equipaggi', personale, filtri: req.query });
  } catch (e) { next(e); }
});

// Scheda personale
router.get('/:id', async (req, res, next) => {
  try {
    const [[persona]] = await db.query('SELECT * FROM personale WHERE id=?', [req.params.id]);
    if (!persona) return res.status(404).render('error', { titolo: 'Non trovato', msg: 'Personale non trovato.', layout: 'main' });
    const [pratiche] = await db.query(
      'SELECT * FROM pratiche WHERE personale_id=? ORDER BY data_scadenza ASC', [req.params.id]
    );
    res.render('personale/scheda', { title: `${persona.cognome} ${persona.nome}`, persona, pratiche });
  } catch (e) { next(e); }
});

// Form nuovo
router.get('/gestione/nuovo', (req, res) => {
  res.render('personale/form', { title: 'Nuovo Personale', action: '/personale/gestione', method: 'POST' });
});

// Salva nuovo
router.post('/gestione', async (req, res, next) => {
  try {
    const { matricola, cognome, nome, grado, categoria, specializzazione,
            data_nascita, luogo_nascita, sede_assegnazione, reparto,
            data_immissione, stato, email_istituzionale, telefono, note } = req.body;

    await db.query(
      `INSERT INTO personale (matricola, cognome, nome, grado, categoria, specializzazione,
       data_nascita, luogo_nascita, sede_assegnazione, reparto, data_immissione,
       stato, email_istituzionale, telefono, note)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [matricola, cognome, nome, grado, categoria, specializzazione,
       data_nascita||null, luogo_nascita, sede_assegnazione, reparto,
       data_immissione||null, stato||'attivo', email_istituzionale, telefono, note]
    );
    req.flash('success', 'Personale aggiunto con successo.');
    res.redirect('/personale');
  } catch (e) { next(e); }
});

// Aggiungi pratica
router.post('/:id/pratiche', async (req, res, next) => {
  try {
    const { tipo, titolo, descrizione, numero_pratica, data_emissione, data_scadenza,
            ente_emittente, percorso_file, nome_file, stato } = req.body;
    await db.query(
      `INSERT INTO pratiche (personale_id, tipo, titolo, descrizione, numero_pratica,
       data_emissione, data_scadenza, ente_emittente, percorso_file, nome_file, stato, inserito_da)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [req.params.id, tipo, titolo, descrizione, numero_pratica,
       data_emissione||null, data_scadenza||null, ente_emittente,
       percorso_file, nome_file, stato||'valida', req.session.user.id]
    );
    req.flash('success', 'Pratica aggiunta.');
    res.redirect(`/personale/${req.params.id}`);
  } catch (e) { next(e); }
});

module.exports = router;
