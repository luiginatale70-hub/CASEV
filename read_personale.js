import mysql from 'mysql2/promise';

async function main() {
  // Connessione al database
  const db = await mysql.createConnection({
    host: 'localhost',
    user: 'root',          // cambia se usi un altro utente
    password: 'camilla',  // metti la tua password
    database: 'casev_db'
  });

  // Query per leggere tutti i dati dalla tabella "personale"
  const [rows] = await db.query('SELECT * FROM personale');

  console.log('Dati trovati nella tabella personale:');
  console.log(rows);

  await db.end();
}

main();
