const router = require('express').Router();
const { isAdmin } = require('../../middleware/auth');

let currentPath = process.env.MANUALI_PATH;

router.get('/', isAdmin, (req, res) => {
  res.render('admin/manuali-path', {
    path: currentPath
  });
});

router.post('/', isAdmin, (req, res) => {
  currentPath = req.body.path;
  process.env.MANUALI_PATH = currentPath;
  res.redirect('/admin/manuali-path');
});

module.exports = router;
