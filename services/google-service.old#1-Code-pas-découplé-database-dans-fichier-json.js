// google.service.js : credentials sans base de données

/* 
La différence principale, c’est la durabilité, la sécurité et la gestion des données.

Avec un fichier chiffré
simple à mettre en place
pratique pour un dev local ou un petit prototype
les credentials sont stockés sur le disque
ça reste relativement fragile :
un accès au serveur suffit pour récupérer le fichier
si la clé est perdue, les données sont inutilisables
pas de recherche, pas d’index, pas de concurrence, pas de nettoyage automatique
Avec une base de données
plus robuste
meilleure gestion des accès et des permissions
possible de stocker plusieurs utilisateurs, plusieurs sessions, et de faire des mises à jour proprement
plus adapté si tu veux une vraie app multi-utilisateurs ou un système sécurisé à long terme
En résumé
fichier chiffré = bon compromis pour apprendre, tester, ou faire un petit outil local
base de données = meilleur choix pour une application réelle, maintenable et sûre
En pratique, un fichier chiffré est une solution “simple”, alors qu’une base de données est une solution “propre et scalable”.
*/



const path = require('path');
const Database = require('better-sqlite3');
const { google } = require('googleapis');

class GoogleService {
  constructor() {
    this.oauth2Client = null;
    this.userCredential = null;
    this.dbPath = path.join(__dirname, '..', 'data', 'google-credentials.sqlite');
    this.db = null;
    this.initDatabase();
  }

  initOAuth2Client(listeningPort, redirectUrlEnd) {
    console.log('Initialisation de l\'objet OAuth2Client avec les paramètres :');
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `http://localhost:${listeningPort}/${redirectUrlEnd}`,
    );

    this.restoreStoredCredentials();
    return this.oauth2Client;
  }

  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const key = crypto.createHash('sha256').update(String(this.encryptionKey)).digest();
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([cipher.update(Buffer.from(text, 'utf8')), cipher.final()]);
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(text) {
    const [ivHex, encryptedHex] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const key = crypto.createHash('sha256').update(String(this.encryptionKey)).digest();
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }

  restoreStoredCredentials() {
    try {
      if (!fs.existsSync(this.credentialsFilePath)) {
        return false;
      }

      const encryptedPayload = fs.readFileSync(this.credentialsFilePath, 'utf8');
      const decryptedPayload = this.decrypt(encryptedPayload);
      const savedCredentials = JSON.parse(decryptedPayload);
      if (!savedCredentials || (!savedCredentials.access_token && !savedCredentials.refresh_token)) {
        return false;
      }

      this.oauth2Client.setCredentials(savedCredentials);
      this.userCredential = savedCredentials;
      console.log('Credentials Google restaurées depuis le stockage local chiffré.');
      return true;
    } catch (error) {
      console.error('Impossible de restaurer les credentials Google :', error.message);
      return false;
    }
  }

  saveCredentials(tokens) {
    try {
      fs.mkdirSync(path.dirname(this.credentialsFilePath), { recursive: true });
      const payload = JSON.stringify(tokens, null, 2);
      fs.writeFileSync(this.credentialsFilePath, this.encrypt(payload));
      this.userCredential = tokens;
      console.log('Credentials Google sauvegardées localement de façon chiffrée.');
      return true;
    } catch (error) {
      console.error('Impossible de sauvegarder les credentials Google :', error.message);
      return false;
    }
  }

  clearStoredCredentials() {
    try {
      if (fs.existsSync(this.credentialsFilePath)) {
        fs.unlinkSync(this.credentialsFilePath);
      }
      this.userCredential = null;
      return true;
    } catch (error) {
      console.error('Impossible de supprimer les credentials Google :', error.message);
      return false;
    }
  }

  hasStoredCredentials() {
    return Boolean(this.userCredential?.access_token || this.userCredential?.refresh_token);
  }
}

module.exports = {
  GoogleService,
};
