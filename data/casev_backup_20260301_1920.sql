-- MySQL dump 10.13  Distrib 8.0.25, for macos11 (x86_64)
--
-- Host: localhost    Database: casev_db
-- ------------------------------------------------------
-- Server version	8.0.25

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `log_accessi`
--

DROP TABLE IF EXISTS `log_accessi`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `log_accessi` (
  `id` int NOT NULL AUTO_INCREMENT,
  `utente_id` int DEFAULT NULL,
  `username_tentato` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `esito` enum('successo','fallito') COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `utente_id` (`utente_id`),
  CONSTRAINT `log_accessi_ibfk_1` FOREIGN KEY (`utente_id`) REFERENCES `utenti` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `log_accessi`
--

LOCK TABLES `log_accessi` WRITE;
/*!40000 ALTER TABLE `log_accessi` DISABLE KEYS */;
INSERT INTO `log_accessi` VALUES (1,NULL,'francesco.basile@mit.gov.it','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Safari/605.1.15','fallito','2026-02-28 12:25:13'),(2,NULL,'francesco.basile@mit.gov.it','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Safari/605.1.15','fallito','2026-02-28 13:19:14'),(3,NULL,'francesco.basile@mit.gov.it','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Safari/605.1.15','fallito','2026-02-28 13:19:57'),(4,NULL,'francesco.basile@mit.gov.it','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Safari/605.1.15','fallito','2026-02-28 13:20:02'),(5,NULL,'admin.naaf','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Safari/605.1.15','fallito','2026-02-28 13:21:23'),(6,NULL,'admin.naaf','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Safari/605.1.15','fallito','2026-02-28 13:21:32'),(7,NULL,'francesco.basile@mit.gov.it','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Safari/605.1.15','fallito','2026-02-28 13:25:15'),(8,NULL,'francesco.basile@mit.gov.it','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Safari/605.1.15','fallito','2026-02-28 13:25:33'),(9,NULL,'francesco.basile@mit.gov.it','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Safari/605.1.15','fallito','2026-02-28 13:25:44'),(10,NULL,'francesco.basile@mit.gov.it','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Safari/605.1.15','fallito','2026-02-28 13:25:55'),(11,NULL,'luigi.natale1970@gmail.com','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Safari/605.1.15','fallito','2026-02-28 13:27:46'),(12,NULL,'admin.naaf','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Safari/605.1.15','fallito','2026-02-28 13:34:29'),(13,NULL,'admin.naaf','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Safari/605.1.15','fallito','2026-02-28 13:34:37'),(14,NULL,'admin.naaf','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Safari/605.1.15','fallito','2026-02-28 13:34:44'),(15,NULL,'admin.naaf','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Safari/605.1.15','fallito','2026-02-28 13:35:24'),(16,NULL,'admin.naaf','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Safari/605.1.15','fallito','2026-02-28 13:40:24'),(17,NULL,'admin.naaf','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Safari/605.1.15','fallito','2026-02-28 13:40:39'),(18,NULL,'admin.naaf','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Safari/605.1.15','fallito','2026-02-28 13:43:05'),(19,NULL,'admin.naaf','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Safari/605.1.15','fallito','2026-02-28 13:43:14'),(20,NULL,'admin.naaf','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Safari/605.1.15','fallito','2026-02-28 13:43:51'),(21,NULL,'admin.naaf','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Safari/605.1.15','fallito','2026-02-28 13:43:58'),(22,NULL,'admin.naaf','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Safari/605.1.15','fallito','2026-02-28 13:44:06'),(23,NULL,'admin.naaf','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Safari/605.1.15','fallito','2026-02-28 13:59:11'),(24,NULL,'admin.naaf','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Safari/605.1.15','fallito','2026-02-28 13:59:18'),(25,NULL,'admin.naaf','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Safari/605.1.15','fallito','2026-02-28 13:59:55'),(26,NULL,'admin.naaf','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Safari/605.1.15','fallito','2026-02-28 14:00:02'),(27,NULL,'admin.naaf','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Safari/605.1.15','fallito','2026-02-28 14:01:52'),(28,NULL,'admin.naaf','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Safari/605.1.15','fallito','2026-02-28 14:10:46'),(29,NULL,'admin.naaf','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Safari/605.1.15','fallito','2026-02-28 14:10:54'),(30,NULL,'admin.naaf','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Safari/605.1.15','fallito','2026-02-28 14:13:04'),(31,NULL,'admin.naaf','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Safari/605.1.15','fallito','2026-02-28 14:32:43'),(32,NULL,'admin.naaf','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Safari/605.1.15','fallito','2026-02-28 16:18:42');
/*!40000 ALTER TABLE `log_accessi` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `news`
--

DROP TABLE IF EXISTS `news`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `news` (
  `id` int NOT NULL AUTO_INCREMENT,
  `titolo` varchar(300) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contenuto` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `excerpt` varchar(400) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `categoria` enum('normativa','addestramento','circolare','avviso','comunicato','altro') COLLATE utf8mb4_unicode_ci DEFAULT 'comunicato',
  `pubblica` tinyint(1) DEFAULT '1',
  `in_evidenza` tinyint(1) DEFAULT '0',
  `autore_id` int DEFAULT NULL,
  `published_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `autore_id` (`autore_id`),
  KEY `idx_news_pubblica` (`pubblica`,`published_at`),
  CONSTRAINT `news_ibfk_1` FOREIGN KEY (`autore_id`) REFERENCES `utenti` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `news`
--

LOCK TABLES `news` WRITE;
/*!40000 ALTER TABLE `news` DISABLE KEYS */;
/*!40000 ALTER TABLE `news` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `personale`
--

DROP TABLE IF EXISTS `personale`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `personale` (
  `id` int NOT NULL AUTO_INCREMENT,
  `matricola` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cognome` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nome` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `grado` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `categoria` enum('pilota','operatore','tecnico') COLLATE utf8mb4_unicode_ci NOT NULL,
  `specializzazione` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `data_nascita` date DEFAULT NULL,
  `luogo_nascita` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sede_assegnazione` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reparto` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `data_immissione` date DEFAULT NULL,
  `stato` enum('attivo','sospeso','in_quiescenza','trasferito') COLLATE utf8mb4_unicode_ci DEFAULT 'attivo',
  `email_istituzionale` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telefono` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `note` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `matricola` (`matricola`),
  KEY `idx_personale_categoria` (`categoria`),
  KEY `idx_personale_stato` (`stato`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `personale`
--

LOCK TABLES `personale` WRITE;
/*!40000 ALTER TABLE `personale` DISABLE KEYS */;
/*!40000 ALTER TABLE `personale` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pratiche`
--

DROP TABLE IF EXISTS `pratiche`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pratiche` (
  `id` int NOT NULL AUTO_INCREMENT,
  `personale_id` int NOT NULL,
  `tipo` enum('licenza','abilitazione','idoneita_medica','corso','addestramento','sanzione','encomio','altro') COLLATE utf8mb4_unicode_ci NOT NULL,
  `titolo` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descrizione` text COLLATE utf8mb4_unicode_ci,
  `numero_pratica` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `data_emissione` date DEFAULT NULL,
  `data_scadenza` date DEFAULT NULL,
  `ente_emittente` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `percorso_file` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nome_file` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stato` enum('valida','in_rinnovo','scaduta','revocata') COLLATE utf8mb4_unicode_ci DEFAULT 'valida',
  `note` text COLLATE utf8mb4_unicode_ci,
  `inserito_da` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `personale_id` (`personale_id`),
  KEY `inserito_da` (`inserito_da`),
  KEY `idx_pratiche_tipo` (`tipo`),
  KEY `idx_pratiche_scadenza` (`data_scadenza`),
  KEY `idx_pratiche_stato` (`stato`),
  CONSTRAINT `pratiche_ibfk_1` FOREIGN KEY (`personale_id`) REFERENCES `personale` (`id`) ON DELETE CASCADE,
  CONSTRAINT `pratiche_ibfk_2` FOREIGN KEY (`inserito_da`) REFERENCES `utenti` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pratiche`
--

LOCK TABLES `pratiche` WRITE;
/*!40000 ALTER TABLE `pratiche` DISABLE KEYS */;
/*!40000 ALTER TABLE `pratiche` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pubblicazioni`
--

DROP TABLE IF EXISTS `pubblicazioni`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pubblicazioni` (
  `id` int NOT NULL AUTO_INCREMENT,
  `titolo` varchar(300) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tipo` enum('manuale','circolare','decreto','normativa','checklist','altro') COLLATE utf8mb4_unicode_ci NOT NULL,
  `codice` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `edizione` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `revisione` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `data_vigenza` date DEFAULT NULL,
  `data_scadenza` date DEFAULT NULL,
  `percorso_file` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nome_file` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pubblica` tinyint(1) DEFAULT '1',
  `inserito_da` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `inserito_da` (`inserito_da`),
  CONSTRAINT `pubblicazioni_ibfk_1` FOREIGN KEY (`inserito_da`) REFERENCES `utenti` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pubblicazioni`
--

LOCK TABLES `pubblicazioni` WRITE;
/*!40000 ALTER TABLE `pubblicazioni` DISABLE KEYS */;
/*!40000 ALTER TABLE `pubblicazioni` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `utenti`
--

DROP TABLE IF EXISTS `utenti`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `utenti` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nome` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cognome` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ruolo` enum('admin','gestore','allievo') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'allievo',
  `attivo` tinyint(1) DEFAULT '1',
  `ultimo_accesso` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `utenti`
--

LOCK TABLES `utenti` WRITE;
/*!40000 ALTER TABLE `utenti` DISABLE KEYS */;
INSERT INTO `utenti` VALUES (1,'admin','$2a$10$dPFpB7fgseIXBvNqWwRcUuZMsIWgFIJ0xrBg1gdbb/2pDLaiJ1tPO','Amministratore','Sistema',NULL,'admin',1,NULL,'2026-02-27 17:53:49','2026-03-01 18:16:14'),(2,'admin.naaf','$2a$10$3nBNbrEDRJLtkHw7t2uhR.KKnJ5xf186a8NHD29hRZ/vIC1wFljDO','luigi','natale',NULL,'admin',1,NULL,'2026-03-01 18:10:03','2026-03-01 18:10:03');
/*!40000 ALTER TABLE `utenti` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-03-01 19:20:50
