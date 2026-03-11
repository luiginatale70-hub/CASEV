// routes/pubblicazioni.js
const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const path    = require('path');

const PUB_DIR = path.join(__dirname, '..', 'Pubblicazioni');

// Assicuro che la cartella esista
if (!fs.existsSync(PUB_DIR)) fs.mkdirSync(PUB_DIR, { recursive: true });

// Lista pubblicazioni dalla cartella
router.get('/', (req, res, next) => {
  try {
    const files = fs.readdirSync(PUB_DIR)
      .filter(f => f.toLowerCase().endsWith('.pdf'))
      .map(f => {
        const stat = fs.statSync(path.join(PUB_DIR, f));
        const nameParts = f.replace('.pdf','').split('_');
        return {
          nome_file: f,
          titolo: nameParts.join(' ').replace(/-/g,' '),
          size_kb: Math.round(stat.size / 1024),
          data: stat.mtime
        };
      })
      .sort((a,b) => b.data - a.data);
    res.render('pubblicazioni/index', { title: 'Pubblicazioni in Vigore', pubs: files });
  } catch (e) { next(e); }
});

// Visualizza PDF nel browser
router.get('/view/:file', (req, res, next) => {
  try {
    const file = path.basename(req.params.file);
    const filePath = path.join(PUB_DIR, file);
    if (!fs.existsSync(filePath)) return res.status(404).send('File non trovato');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="' + file + '"');
    res.sendFile(filePath);
  } catch (e) { next(e); }
});

// Download PDF
router.get('/download/:file', (req, res, next) => {
  try {
    const file = path.basename(req.params.file);
    const filePath = path.join(PUB_DIR, file);
    if (!fs.existsSync(filePath)) return res.status(404).send('File non trovato');
    res.download(filePath, file);
  } catch (e) { next(e); }
});

module.exports = router;
