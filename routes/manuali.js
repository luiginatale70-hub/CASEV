const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const { isLoggedIn } = require('../middleware/auth');
const config = require('../config/manuali');

function getDirContent(basePath, relative = '') {
  const dir = path.resolve(basePath, relative);
  const items = fs.readdirSync(dir, { withFileTypes: true });

  return items.map(item => {
    const relPath = path.join(relative, item.name);

    return {
      name: item.name,
      isDir: item.isDirectory(),
      url: item.isDirectory()
        ? '/manuali?dir=' + encodeURIComponent(relPath)
        : '/manuali/file?file=' + encodeURIComponent(relPath)
    };
  });
}

router.get('/', isLoggedIn, async (req, res) => {
  const basePath = await config.getPath();
  const subDir = req.query.dir ? decodeURIComponent(req.query.dir) : '';

  const currentPath = path.join(basePath, subDir);

  let items = [];
  let safeDir = subDir;

  try {
   if (!currentPath.toLowerCase().startsWith(basePath.toLowerCase())) {
  throw new Error('Invalid path');
}
    if (!fs.existsSync(currentPath)) throw new Error('Path non esiste');

    items = getDirContent(basePath, subDir);
  } catch (e) {
    console.log('ERRORE:', e.message);
console.log("BASEPATH:", basePath);
console.log("CURRENTPATH:", currentPath);
console.log("COMPARE:", currentPath.toLowerCase(), basePath.toLowerCase());
    // fallback root
    safeDir = '';
    try {
      items = getDirContent(basePath, '');
    } catch (e2) {
      items = [];
    }
  }

  res.render('manuali/index', {
    items,
    currentDir: safeDir
  });
});

router.get('/file', isLoggedIn, async (req, res) => {
  const basePath = path.resolve(await config.getPath());
  const relFile = decodeURIComponent(req.query.file);

 const filePath = path.join(basePath, relFile);

 if (!filePath.toLowerCase().startsWith(basePath.toLowerCase())) {
    return res.status(400).send('Invalid path');
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File non trovato');
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline');

  res.sendFile(filePath);
});

module.exports = router;