const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const { isAdmin } = require('../../middleware/auth');
const config = require('../../config/manuali');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.basePath);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

router.get('/', isAdmin, (req, res) => {
  res.render('admin/manuali-upload');
});

router.post('/', isAdmin, upload.single('file'), (req, res) => {
  res.redirect('/manuali');
});

module.exports = router;
