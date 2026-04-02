module.exports = function examMode(options = {}) {
  return async function(req, res, next) {
    try {
      const user = req.session?.user;
      const exam = req.session?.exam;

      // 1) Utente non loggato
      if (!user) {
        return res.redirect('/esami/login?auth=1');
      }

      // 2) Nessun esame attivo
      if (!exam) {
        return res.redirect('/esami/dashboard?noexam=1');
      }

      // 3) Tempo scaduto
      const now = Date.now();
      if (exam.endTime && now > exam.endTime) {
        req.session.exam = null;
        return res.redirect('/esami/dashboard?timeout=1');
      }

      // 4) Tentativo non valido
      if (!exam.attemptId) {
        return res.redirect('/esami/dashboard?attempt=invalid');
      }

      // 5) Tutto ok → continua
      next();

    } catch (err) {
      console.error('ExamMode error:', err);
      return res.redirect('/esami/dashboard?error=1');
    }
  };
};
