// TODO : renommer cette classe en OAuth2CredentialsStore ou GoogleOAuth2CredentialsStore pour plus de clarté, car elle gère les credentials OAuth2 de Google.

const path = require('path');
const fs = require('fs');

/**
 * Pourquoi on essaie d'utiliser deux backend sqlite ?
 * 
 * En effet Le backend natif de Node est souvent plus simple à maintenir dans votre cas, car :
 * - il évite les bindings natifs à compiler
 * - il fonctionne mieux avec une installation Node “standard”
 * - il réduit les points de casse liés à better-sqlite3
 * 
 * En revanche l’avantage de garder un fallback vers better-sqlite3 est surtout:
 * - compatibilité avec des environnements où le support natif n’est pas encore disponible ou n’est pas activé
 * - possibilité d’utiliser une implémentation plus mature si elle est déjà présente dans l’environnement
 *
 *  En pratique :
 * si vous voulez la solution la plus simple et la plus robuste pour votre projet actuel, le natif est probablement le meilleur choix
 * le fallback ne sert que comme sécurité supplémentaire, pas comme besoin fonctionnel principal
 */
function resolveDatabaseImplementation() {
  try {
    const { DatabaseSync } = require('node:sqlite');
    return { implementation: DatabaseSync, source: 'node:sqlite' };
  } catch (error) {
    try {
      return { implementation: require('better-sqlite3'), source: 'better-sqlite3' };
    } catch (nativeError) {
      throw new Error(`Aucun backend SQLite disponible : ${nativeError.message}`);
    }
  }
}

const { implementation: DatabaseImpl, source: databaseSource } = resolveDatabaseImplementation();
console.log(`Utilisation du backend SQLite : ${databaseSource}.`);

class GoogleCredentialsStore {
  constructor(dbPath = path.join(__dirname, '..', 'data', 'google-credentials.sqlite')) {
    this.dbPath = dbPath;
    this.db = null;
    this.initDatabase();
  }

  initDatabase() {
    try {
      if (!DatabaseImpl) {
        throw new Error('Aucun backend SQLite disponible pour créer la base de données.');
      }

      fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
      this.db = new DatabaseImpl(this.dbPath);
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

  load() {
    try {
      const row = this.db?.prepare('SELECT payload FROM google_credentials WHERE id = 1').get();
      if (!row?.payload) {
        return null;
      }

      const savedCredentials = JSON.parse(row.payload);
      if (!savedCredentials || (!savedCredentials.access_token && !savedCredentials.refresh_token)) {
        return null;
      }

      return savedCredentials;
    } catch (error) {
      console.error('Impossible de restaurer les credentials Google :', error.message);
      return null;
    }
  }

  save(tokens) {
    try {
      const payload = JSON.stringify(tokens, null, 2);
      const now = new Date().toISOString();
      this.db.prepare(`
        INSERT INTO google_credentials (id, payload, updated_at)
        VALUES (1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
      `).run(payload, now);
      console.log('Credentials Google sauvegardées dans SQLite.');
      return true;
    } catch (error) {
      console.error('Impossible de sauvegarder les credentials Google :', error.message);
      return false;
    }
  }

  clear() {
    try {
      this.db?.prepare('DELETE FROM google_credentials WHERE id = 1').run();
      return true;
    } catch (error) {
      console.error('Impossible de supprimer les credentials Google :', error.message);
      return false;
    }
  }
}

module.exports = {
  GoogleCredentialsStore,
};
