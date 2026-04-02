// routes/archivio.js
const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const { isGestoreOrAdmin } = require('../middleware/auth');

const ARCHIVIO_ROOT = process.env.ARCHIVIO_PATH || '/srv/archivio-casev';

// Protezione: solo admin/gestore
router.use(isGestoreOrAdmin);

// Naviga cartelle
router.get('/', (req, res) => {
  const rel = req.query.path || '';
  // Sicurezza: impedire path traversal
  const safePath = path.normalize(rel).replace(/^(\.\.[\/\\])+/, '');
  const fullPath = path.join(ARCHIVIO_ROOT, safePath);

  if (!fullPath.startsWith(ARCHIVIO_ROOT)) {
    return res.status(400).render('error', { titolo: 'Percorso non valido', msg: 'Accesso negato.', layout: 'main' });
  }

  try {
    if (!fs.existsSync(fullPath)) {
      return res.render('archivio/index', {
        title: 'Archivio', percorso: safePath, voci: [], errore: 'Cartella non trovata.'
      });
    }

    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    const voci = entries
      .filter(e => !e.name.startsWith('.'))
      .map(e => ({
        nome: e.name,
        isDir: e.isDirectory(),
        path: path.join(safePath, e.name),
        ext: path.extname(e.name).toLowerCase()
      }))
      .sort((a, b) => (b.isDir - a.isDir) || a.nome.localeCompare(b.nome));

    // Breadcrumb
    const parti = safePath ? safePath.split(path.sep).filter(Boolean) : [];
    const breadcrumb = [{ nome: 'Root', path: '' }];
    parti.forEach((p, i) => {
      breadcrumb.push({ nome: p, path: parti.slice(0, i+1).join('/') });
    });

    res.render('archivio/index', { title: 'Archivio', percorso: safePath, voci, breadcrumb });
  } catch (err) {
    res.render('archivio/index', { title: 'Archivio', percorso: safePath, voci: [], errore: err.message });
  }
});

// Download file
router.get('/download', (req, res) => {
  const rel = req.query.path || '';
  const safePath = path.normalize(rel).replace(/^(\.\.[\/\\])+/, '');
  const fullPath = path.join(ARCHIVIO_ROOT, safePath);

  if (!fullPath.startsWith(ARCHIVIO_ROOT) || !fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    return res.status(404).send('File non trovato.');
  }
  res.download(fullPath, path.basename(fullPath));
});

module.exports = router;
