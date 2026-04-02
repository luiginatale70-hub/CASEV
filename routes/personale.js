// routes/personale.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { isGestoreOrAdmin } = require('../middleware/auth');

router.use(isGestoreOrAdmin);

router.get('/', async (req, res, next) => {
  try {
    const { cerca, categoria, stato } = req.query;
    let where = "ruolo IN ('efv','istruttore','gestore')";
    const params = [];
    if (cerca) {
      where += ' AND (cognome LIKE ? OR nome LIKE ? OR matricola LIKE ? OR email LIKE ?)';
      const s = '%' + cerca + '%'; params.push(s,s,s,s);
    }
    if (categoria) { where += ' AND categoria=?'; params.push(categoria); }
    if (stato)     { where += ' AND stato=?';     params.push(stato); }
    const [personale] = await db.query('SELECT * FROM utenti WHERE ' + where + ' ORDER BY cognome, nome', params);
    res.render('personale/index', { title: 'Personale EFV', personale, filtri: req.query });
  } catch (e) { next(e); }
});

router.get('/:id(\\d+)', async (req, res, next) => {
  try {
    const [[persona]] = await db.query('SELECT * FROM utenti WHERE id=?', [req.params.id]);
    if (!persona) return res.status(404).render('error', { titolo: 'Non trovato', msg: 'Personale non trovato.', layout: 'main' });
    const [[pRecord]] = await db.query(
      'SELECT id FROM personale WHERE utente_id=? OR email_istituzionale=? LIMIT 1',
      [persona.id, persona.email]
    );
    const pratiche = pRecord
      ? (await db.query('SELECT * FROM pratiche WHERE personale_id=? ORDER BY data_scadenza ASC', [pRecord.id]))[0]
      : [];
    res.render('personale/scheda', {
      title: persona.cognome + ' ' + persona.nome,
      persona: { ...persona, email_istituzionale: persona.email },
      pratiche,
      personaleId: pRecord ? pRecord.id : null
    });
  } catch (e) { next(e); }
});

router.get('/:id(\\d+)/modifica', async (req, res, next) => {
  try {
    const [[persona]] = await db.query('SELECT * FROM utenti WHERE id=?', [req.params.id]);
    if (!persona) return res.status(404).render('error', { titolo: 'Non trovato', msg: 'Non trovato.', layout: 'main' });
    const [gradi] = await db.query('SELECT * FROM gradi WHERE attivo=1 ORDER BY ordine, descrizione');
    res.render('personale/form', {
      title: 'Modifica — ' + persona.cognome + ' ' + persona.nome,
      action: '/personale/' + persona.id + '/modifica',
      persona: { ...persona, email_istituzionale: persona.email },
      gradi,
      isEdit: true
    });
  } catch (e) { next(e); }
});

router.post('/:id(\\d+)/modifica', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { cognome, nome, grado, categoria, qualifica, data_nascita,
            luogo_nascita, sede_assegnazione, stato, email_istituzionale,
            telefono, note, matricola } = req.body;
    await db.query(
      `UPDATE utenti SET cognome=?,nome=?,grado=?,categoria=?,qualifica=?,data_nascita=?,
       luogo_nascita=?,sede_assegnazione=?,stato=?,email=?,matricola=?,telefono=?,note=? WHERE id=?`,
      [cognome,nome,grado||null,categoria||null,qualifica||null,data_nascita||null,
       luogo_nascita||null,sede_assegnazione||null,stato||'attivo',
       email_istituzionale||null,matricola||null,telefono||null,note||null,id]
    );
    await db.query(
      `UPDATE personale SET cognome=?,nome=?,grado=?,matricola=?,sede_assegnazione=?,
       qualifica=?,data_nascita=?,luogo_nascita=?,stato=?,email_istituzionale=?,telefono=?,note=?
       WHERE utente_id=? OR email_istituzionale=?`,
      [cognome,nome,grado||null,matricola||null,sede_assegnazione||null,
       qualifica||null,data_nascita||null,luogo_nascita||null,stato||'attivo',
       email_istituzionale||null,telefono||null,note||null,id,email_istituzionale||'']
    );
    await db.query('UPDATE esami_students SET `rank`=?,name=?,surname=?,email=? WHERE user_id=?',
      [grado||'',nome,cognome,email_istituzionale||'',id]);
    req.flash('success', 'Dati aggiornati.');
    res.redirect('/personale/' + id);
  } catch (e) { next(e); }
});

router.post('/:id(\\d+)/pratiche', async (req, res, next) => {
  try {
    const utente_id = Number(req.params.id);
    const [[pRecord]] = await db.query('SELECT id FROM personale WHERE utente_id=? LIMIT 1', [utente_id]);
    if (!pRecord) { req.flash('error', 'Record personale non trovato.'); return res.redirect('/personale/' + utente_id); }
    const { tipo, titolo, descrizione, numero_pratica, data_emissione,
            data_scadenza, ente_emittente, percorso_file, nome_file, stato } = req.body;
    await db.query(
      `INSERT INTO pratiche (personale_id,tipo,titolo,descrizione,numero_pratica,
       data_emissione,data_scadenza,ente_emittente,percorso_file,nome_file,stato,inserito_da)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [pRecord.id,tipo,titolo,descrizione,numero_pratica,data_emissione||null,
       data_scadenza||null,ente_emittente,percorso_file,nome_file,stato||'valida',req.session.user.id]
    );
    req.flash('success', 'Pratica aggiunta.');
    res.redirect('/personale/' + utente_id);
  } catch (e) { next(e); }
});

module.exports = router;
