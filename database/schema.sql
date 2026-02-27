-- ============================================
--  CASEV - Schema Database MySQL
--  Eseguire: mysql -u root -p < database/schema.sql
-- ============================================

CREATE DATABASE IF NOT EXISTS casev_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE casev_db;

-- ───────────────────────────────────────────
--  UTENTI DEL PORTALE
-- ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS utenti (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nome VARCHAR(100) NOT NULL,
    cognome VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE,
    ruolo ENUM('admin','gestore','allievo') NOT NULL DEFAULT 'allievo',
    attivo BOOLEAN DEFAULT TRUE,
    ultimo_accesso DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Utente admin di default (password: Admin@CASEV2026 - CAMBIARE!)
INSERT INTO utenti (username, password_hash, nome, cognome, ruolo) VALUES 
('admin', '$2b$10$YourHashHere', 'Amministratore', 'Sistema', 'admin');

-- ───────────────────────────────────────────
--  PERSONALE EQUIPAGGI DI VOLO
-- ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS personale (
    id INT AUTO_INCREMENT PRIMARY KEY,
    matricola VARCHAR(20) NOT NULL UNIQUE,
    cognome VARCHAR(100) NOT NULL,
    nome VARCHAR(100) NOT NULL,
    grado VARCHAR(80),
    categoria ENUM('pilota','operatore','tecnico') NOT NULL,
    specializzazione VARCHAR(150),
    data_nascita DATE,
    luogo_nascita VARCHAR(100),
    sede_assegnazione VARCHAR(150),
    reparto VARCHAR(100),
    data_immissione DATE,
    stato ENUM('attivo','sospeso','in_quiescenza','trasferito') DEFAULT 'attivo',
    email_istituzionale VARCHAR(150),
    telefono VARCHAR(30),
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ───────────────────────────────────────────
--  PRATICHE / DOCUMENTI PERSONALI
-- ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pratiche (
    id INT AUTO_INCREMENT PRIMARY KEY,
    personale_id INT NOT NULL,
    tipo ENUM('licenza','abilitazione','idoneita_medica','corso','addestramento','sanzione','encomio','altro') NOT NULL,
    titolo VARCHAR(255) NOT NULL,
    descrizione TEXT,
    numero_pratica VARCHAR(80),
    data_emissione DATE,
    data_scadenza DATE,
    ente_emittente VARCHAR(150),
    percorso_file VARCHAR(500),  -- path relativo in archivio
    nome_file VARCHAR(255),
    stato ENUM('valida','in_rinnovo','scaduta','revocata') DEFAULT 'valida',
    note TEXT,
    inserito_da INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (personale_id) REFERENCES personale(id) ON DELETE CASCADE,
    FOREIGN KEY (inserito_da) REFERENCES utenti(id) ON DELETE SET NULL
);

-- ───────────────────────────────────────────
--  PUBBLICAZIONI IN VIGORE
-- ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pubblicazioni (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titolo VARCHAR(300) NOT NULL,
    tipo ENUM('manuale','circolare','decreto','normativa','checklist','altro') NOT NULL,
    codice VARCHAR(100),
    edizione VARCHAR(50),
    revisione VARCHAR(50),
    data_vigenza DATE,
    data_scadenza DATE,
    percorso_file VARCHAR(500),
    nome_file VARCHAR(255),
    pubblica BOOLEAN DEFAULT TRUE,  -- visibile senza login
    inserito_da INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (inserito_da) REFERENCES utenti(id) ON DELETE SET NULL
);

-- ───────────────────────────────────────────
--  NEWS / COMUNICATI
-- ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS news (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titolo VARCHAR(300) NOT NULL,
    contenuto TEXT NOT NULL,
    excerpt VARCHAR(400),
    categoria ENUM('normativa','addestramento','circolare','avviso','comunicato','altro') DEFAULT 'comunicato',
    pubblica BOOLEAN DEFAULT TRUE,
    in_evidenza BOOLEAN DEFAULT FALSE,
    autore_id INT,
    published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (autore_id) REFERENCES utenti(id) ON DELETE SET NULL
);

-- ───────────────────────────────────────────
--  LOG ACCESSI (audit trail)
-- ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS log_accessi (
    id INT AUTO_INCREMENT PRIMARY KEY,
    utente_id INT,
    username_tentato VARCHAR(50),
    ip_address VARCHAR(45),
    user_agent VARCHAR(300),
    esito ENUM('successo','fallito') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (utente_id) REFERENCES utenti(id) ON DELETE SET NULL
);

-- ───────────────────────────────────────────
--  INDICI
-- ───────────────────────────────────────────
CREATE INDEX idx_personale_categoria ON personale(categoria);
CREATE INDEX idx_personale_stato ON personale(stato);
CREATE INDEX idx_pratiche_tipo ON pratiche(tipo);
CREATE INDEX idx_pratiche_scadenza ON pratiche(data_scadenza);
CREATE INDEX idx_pratiche_stato ON pratiche(stato);
CREATE INDEX idx_news_pubblica ON news(pubblica, published_at);

SELECT 'Schema CASEV creato con successo!' AS msg;
