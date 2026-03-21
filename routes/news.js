// routes/news.js
const express = require('express');
const router = express.Router();

// Pagina News (vuota per ora)
router.get('/', (req, res) => {
  res.render('news/index', {
    title: 'News & Comunicati',
    news: []
  });
});

module.exports = router;
