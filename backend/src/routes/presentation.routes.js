const router = require('express').Router();
const presentation = require('../controllers/presentation.controller');

// Public taklif sahifasi — auth yo'q, link'dagi token o'zi kalit.
// GET  — faqat o'qish (SSR/link-preview), ochilish HISOBLANMAYDI.
// POST /open — haqiqiy brauzer sahifani yuklagach chaqiradi (botlar hisoblanmaydi).
router.get('/:token', presentation.publicPresentation);
router.post('/:token/open', presentation.trackOpen);
router.post('/:token/interest', presentation.markInterest);

module.exports = router;
