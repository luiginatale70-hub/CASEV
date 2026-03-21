module.exports = {
  autoLogout(req, res, next) {
    const p = req.path;

    const isStatic =
      p.startsWith('/public') ||
      p.startsWith('/uploads') ||
      p.startsWith('/esami/uploads') ||
      p === '/favicon.ico' ||
      /\.(css|js|png|jpg|jpeg|gif|svg|ico|webp)$/i.test(p);

    if (isStatic) return next();

    if (req.session && req.session.user) {
      const now  = Date.now();
      const last = req.session.lastActivity || now;

      const timeout = parseInt(process.env.SESSION_TIMEOUT_MS) || 3600000;

      if (now - last > timeout) {
        const isEsami = p.startsWith('/esami');
        return req.session.destroy(() => {
          res.redirect(isEsami ? '/esami/login?timeout=1' : '/auth/login?timeout=1');
        });
      }

      req.session.lastActivity = now;
    }

    next();
  }
};
