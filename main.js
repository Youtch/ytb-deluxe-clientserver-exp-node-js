// nouveau main.js

// =================================================================================================
// Utiliser OAuth 2.0 pour les applications de serveur Web
//
// Source : https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps?hl=fr#example
// =================================================================================================
// DEBUG Note : CF package.json qui défini un raccourci de lancement "startbrowser" qui fournit un devTool spécifique à Node.js, affichage des console.log dans la vue "Console" (ex : déplier les objets, les array, etc) 
//
//
// Méthode : 
// 1. lancer le serveur 
// 2. lancer le navigateur sur http://localhost:²/
//
// Source : https://stackoverflow.com/a/44352544/221532
// =====================================================
require('dotenv').config()// Indispensable pour lire process.env !  
const express = require('express');
const session = require('express-session');
const http = require('http');

const api = require('./api/routes.module.js')

/**
 * Pour utiliser l'authentification OAuth2, nous avons besoin d'accéder à un client_id, client_secret et redirect_uri.
 * Pour plus d'infos concernant les autorisation d'identification (=credentials) CF https://console.cloud.google.com/apis/credentials.
 */

const LISTENING_PORT = 8080
const REDIRECT_URL_END = "oauth2callback" // Règles des URI de redirections acceptées : https://developers.google.com/identity/protocols/oauth2/web-server?hl=fr#uri-validation#---------------------
api.initOAuth2Client(LISTENING_PORT, REDIRECT_URL_END) // Initialiser l'objet OAuth2Client en transmettant les paramètres nécessaires 
const app = express();

// Configurez le middleware de session pour stocker les sessions utilisateur
app.use(session({
  refresh_token: null, // On prépare la sauvegarde du refresh_token non récupérable lors des reconnexions si le token est encore valide (s'il n'est pas expiré il est réattribué identique)
  secret: 'FDdgdo%jfdogùj4349459-4grGER', // secret "robuste"
  resave: false, // Cette option détermine si la session doit être enregistrée dans le magasin à chaque demande.La définition de cette option sur FALSE peut améliorer les performances.
  saveUninitialized: false, // Cette option détermine s'il faut enregistrer des séances non initialisées. La définition de cette option sur FALSE peut améliorer les performances. 
  cookie: { maxAge: 86400000 } // session timeout = 24 heures
  // **maxAge** définit le délai d'expiration de la session lors de l'initialisation du middleware de session. L'option Maxage est exprimée en millisecondes et détermine l'âge maximum d'une session.
}));

// TOOD myApp.load(LISTENING_PORT);
// Charger les routes de l'API : ce qui ne surcharge pas le main.js avec les routes de l'API. Le module api/routes.module.js contient toutes les routes de l'API.
api.loadRoutes(app, LISTENING_PORT)

const server = http.createServer(app);
server.listen(LISTENING_PORT);
console.log(`Serveur en écoute sur ${LISTENING_PORT}`)

