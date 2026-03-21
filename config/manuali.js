const db = require('./db');

async function getPath() {
  try {
    const [[row]] = await db.query(
      "SELECT valore FROM config WHERE chiave='manuali_path'"
    );
    return row ? row.valore : process.env.MANUALI_PATH;
  } catch (e) {
    return process.env.MANUALI_PATH;
  }
}

module.exports = {
  getPath
};