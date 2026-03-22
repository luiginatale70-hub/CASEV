const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const path    = require('path');
const db      = require('../config/db');

// Recupera percorso da DB
async function getPubDir() {
  const [[row]] = await db.query(
    "SELECT valore FROM config WHERE chiave='pubblicazioni_path'"
  );

  if (row && row.valore) return row.valore;

  return path.join(__dirname, '..', 'public', 'Pubblicazioni');
}

// Lista directory corrente
router.get('/', async (req, res, next) => {
  try {
    const PUB_DIR = await getPubDir();
    const current = req.query.path || '';
    const currentPath = path.join(PUB_DIR, current);

    if (!fs.existsSync(currentPath)) {
      return res.render('pubblicazioni/index', { pubs: [], current });
    }

   const list = fs.readdirSync(currentPath).map(name => {
  const full = path.join(currentPath, name);
  const stat = fs.statSync(full);

  if (stat.isDirectory()) {
    return {
      tipo: 'dir',
      nome: name,
      path: path.join(current, name).replace(/\\/g,'/')
    };
  }

  if (name.toLowerCase().endsWith('.pdf')) {
    return {
      tipo: 'file',
      nome: name,
      path: path.join(current, name).replace(/\\/g,'/')
    };
  }

  return null;
}).filter(Boolean);

    res.render('pubblicazioni/index', {
      pubs: list,
      current
    });

  } catch (e) { next(e); }
});

// Visualizza PDF
router.get('/view/:file(*)', async (req, res, next) => {
  try {
    const PUB_DIR = await getPubDir();
    const filePath = path.join(PUB_DIR, req.params.file);

    if (!fs.existsSync(filePath)) 
      return res.status(404).send('File non trovato');

    res.setHeader('Content-Type', 'application/pdf');
    res.sendFile(filePath);

  } catch (e) { next(e); }
});

// Download PDF
router.get('/download/:file(*)', async (req, res, next) => {
  try {
    const PUB_DIR = await getPubDir();
    const filePath = path.join(PUB_DIR, req.params.file);

    if (!fs.existsSync(filePath)) 
      return res.status(404).send('File non trovato');

    res.download(filePath);

  } catch (e) { next(e); }
});

module.exports = router;rts = router;