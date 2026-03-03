// fix_login.js — aggiunge role alla sessione + gestisce returnTo
const fs   = require('fs');
const path = require('path');

const file = path.join(__dirname, 'routes/auth.js');
let src = fs.readFileSync(file, 'utf8');

const ROLE_MAP = {
  admin:       'admin',
  admin_esami: 'admin',
  gestore:     'instructor',
  istruttore:  'instructor',
  allievo:     'student'
};

// 1. Aggiunge role (mappato) alla sessione
const OLD_SESSION = `    req.session.user = {
      id: utente.id,
      username: utente.username,
      nome: utente.nome,
      cognome: utente.cognome,
      ruolo: utente.ruolo
    };

    req.flash('success', \`Benvenuto, \${utente.nome}!\`);
    res.redirect('/');`;

const NEW_SESSION = `    const ROLE_MAP = {
      admin: 'admin', admin_esami: 'admin',
      gestore: 'instructor', istruttore: 'instructor',
      allievo: 'student'
    };

    req.session.user = {
      id:       utente.id,
      username: utente.username,
      nome:     utente.nome,
      cognome:  utente.cognome,
      email:    utente.email || (utente.username + '@casev.local'),
      ruolo:    utente.ruolo,
      role:     ROLE_MAP[utente.ruolo] || 'student'
    };

    req.flash('success', \`Benvenuto, \${utente.nome}!\`);
    const returnTo = req.session.returnTo || '/';
    delete req.session.returnTo;
    res.redirect(returnTo);`;

if (src.includes("ruolo: utente.ruolo") && !src.includes("role:     ROLE_MAP")) {
  src = src.replace(OLD_SESSION, NEW_SESSION);
  fs.writeFileSync(file, src, 'utf8');
  console.log('OK routes/auth.js aggiornato');
} else {
  console.log('SKIP routes/auth.js gia aggiornato');
}

console.log('Fix completato! Riavvia con: npm start');
