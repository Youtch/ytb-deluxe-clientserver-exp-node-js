// google.service.js : credentials avec  base de données intégrée dans le fichier

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

  initDatabase() {
    try {
      const dir = path.dirname(this.dbPath);
      require('fs').mkdirSync(dir, { recursive: true });
      this.db = new Database(this.dbPath);
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS google_credentials (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          payload TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `).run();
      console.log('Base SQLite prête pour les credentials Google.');
    } catch (error) {
      console.error('Impossible d\'initialiser la base SQLite :', error.message);
    }
  }

  restoreStoredCredentials() {
    try {
      const row = this.db?.prepare('SELECT payload FROM google_credentials WHERE id = 1').get();
      if (!row?.payload) {
        return false;
      }

      const savedCredentials = JSON.parse(row.payload);
      if (!savedCredentials || (!savedCredentials.access_token && !savedCredentials.refresh_token)) {
        return false;
      }

      this.oauth2Client.setCredentials(savedCredentials);
      this.userCredential = savedCredentials;
      console.log('Credentials Google restaurées depuis SQLite.');
      return true;
    } catch (error) {
      console.error('Impossible de restaurer les credentials Google :', error.message);
      return false;
    }
  }

  saveCredentials(tokens) {
    try {
      const payload = JSON.stringify(tokens, null, 2);
      const now = new Date().toISOString();
      this.db.prepare(`
        INSERT INTO google_credentials (id, payload, updated_at)
        VALUES (1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
      `).run(payload, now);
      this.userCredential = tokens;
      console.log('Credentials Google sauvegardées dans SQLite.');
      return true;
    } catch (error) {
      console.error('Impossible de sauvegarder les credentials Google :', error.message);
      return false;
    }
  }

  clearStoredCredentials() {
    try {
      this.db?.prepare('DELETE FROM google_credentials WHERE id = 1').run();
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
