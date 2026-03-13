#!/usr/bin/env python3
"""
Import corsisti.csv → MySQL
Database: casev_db  |  Tabella: utenti
Dipendenze: pip install mysql-connector-python bcrypt
"""

import csv
import mysql.connector
from mysql.connector import Error
import bcrypt

# ── Configurazione database ───────────────────────────────────
DB_HOST     = "localhost"
DB_PORT     = 3306
DB_NAME     = "casev_db"
DB_USER     = "root"
DB_PASSWORD = "camilla"
CSV_FILE    = "corsisti.csv"
TEMP_PASSWORD = "12345678"
# ─────────────────────────────────────────────────────────────

INSERT_SQL = """
INSERT INTO utenti (
    username, password_hash, nome, cognome,
    email, ruolo, categoria, grado,
    sede_assegnazione, matricola, auth_type, attivo
)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 1)
ON DUPLICATE KEY UPDATE
    nome              = VALUES(nome),
    cognome           = VALUES(cognome),
    email             = VALUES(email),
    categoria         = VALUES(categoria),
    grado             = VALUES(grado),
    sede_assegnazione = VALUES(sede_assegnazione),
    matricola         = VALUES(matricola),
    auth_type         = VALUES(auth_type);
"""

CATEGORIA_MAP = {
    'Piloti':             'Piloti',
    'Operatori di volo':  'Operatori di volo',
    'Tecnici di volo':    'Tecnici di volo',
    'UFF. TECNICO':       'Tecnici di volo',
}

def main():
    # Genera hash password temporanea
    password_hash = bcrypt.hashpw(TEMP_PASSWORD.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    try:
        conn = mysql.connector.connect(
            host=DB_HOST, port=DB_PORT, database=DB_NAME,
            user=DB_USER, password=DB_PASSWORD, charset="utf8mb4"
        )
        cursor = conn.cursor()
        print(f"✅ Connesso a {DB_NAME}@{DB_HOST}")

        inserted = 0
        skipped  = 0

        with open(CSV_FILE, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f, delimiter=";")
            for row in reader:
                nome    = row["NOME"].strip()
                cognome = row["COGNOME"].strip()

                # username: cognome.nome tutto minuscolo, spazi rimossi
                username = f"{cognome.lower().replace(' ', '')}.{nome.lower().replace(' ', '')}"

                # email: nome.cognome@mit.gov.it
                email = f"{nome.lower().replace(' ', '')}.{cognome.lower().replace(' ', '')}@mit.gov.it"

                categoria = CATEGORIA_MAP.get(row["CATEGORIA"].strip(), None)
                grado     = row["GRADO"].strip()
                sede      = row["COMANDO"].strip()
                matricola = row["MATRICOLA"].strip() or None

                cursor.execute(INSERT_SQL, (
                    username,
                    password_hash,
                    nome,
                    cognome,
                    email,
                    'efv',          # ruolo default
                    categoria,
                    grado,
                    sede,
                    matricola,
                    'ldap'
                ))
                inserted += 1

        conn.commit()
        print(f"✅ Importati {inserted} utenti con successo")
        if skipped:
            print(f"⚠️  Saltati {skipped} record")

    except FileNotFoundError:
        print(f"❌ File non trovato: {CSV_FILE}")
    except Error as e:
        print(f"❌ Errore MySQL: {e}")
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()
            print("🔒 Connessione chiusa")

if __name__ == "__main__":
    main()
