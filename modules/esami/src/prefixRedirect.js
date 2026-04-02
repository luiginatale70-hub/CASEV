/**
 * esami/src/prefixRedirect.js
 * Intercetta res.redirect() e aggiunge /esami ai path assoluti interni
 */
const PREFIX  = '/esami';
const EXCLUDE = ['/auth'];

module.exports = function prefixRedirect(req, res, next) {
  const orig = res.redirect.bind(res);

  res.redirect = function (urlOrStatus, url) {
    let status, target;
    if (typeof urlOrStatus === 'number') { status = urlOrStatus; target = url; }
    else { status = 302; target = urlOrStatus; }

    if (
      typeof target === 'string' &&
      target.startsWith('/') &&
      !target.startsWith(PREFIX) &&
      !EXCLUDE.some(e => target.startsWith(e))
    ) {
      target = PREFIX + target;
    }

    return orig(status, target);
  };

  next();
};
