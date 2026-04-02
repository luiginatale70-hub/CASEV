const router = require('express').Router();

router.use('/',              require('./home'));
router.use('/auth',          require('./auth'));
router.use('/news',          require('./news'));
router.use('/pubblicazioni', require('../modules/pubblicazioni/pubblicazioni'));
router.use('/personale',     require('./personale'));
router.use('/archivio',      require('./archivio'));
router.use('/admin',         require('./admin'));
router.use('/manuali',       require('./manuali'));
router.use('/admin/manuali-path', require('./manualiPath'));
module.exports = router;
