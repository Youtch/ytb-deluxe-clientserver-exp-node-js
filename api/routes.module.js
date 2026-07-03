// routes.module.js
const dotenv = require('dotenv') 
const https = require('https');
const url = require('url');
const crypto = require('crypto');
const { google } = require('googleapis');
const { debugPort } = require('process');

require('dotenv').config()// Indispensable pour lire process.env !
  
let oauth2Client = {}; // Variable globale pour stocker l'objet OAuth2Client
/** Permet d'initialiser l'objet OAuth2Client avec les paramètres déclarés dans main.js, sinon impossible d'accéder aux valeurs LISTENING_PORT et REDIRECT_URL_END **/
function initOAuth2Client(LISTENING_PORT, REDIRECT_URL_END) {
  console.log("Initialisation de l'objet OAuth2Client avec les paramètres :")
  oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `http://localhost:${LISTENING_PORT}/`+REDIRECT_URL_END,
  );
}
/* Variable globale qui stocke les informations d'identification de l'utilisateur dans cet exemple de code.
  * ACTION ITEM pour les développeurs :
  * Stockez le refresh token (=jeton de rafraîchissement) de l'utilisateur dans votre data store si vous incorporez ce code dans une vrai application !
  * Pour plus d'informations sur les refresh tokens : CF https://github.com/googleapis/google-api-nodejs-client#handling-refresh-tokens
  */
let userCredential = null;


/**
 * 
 * @param {*} app : l'appli express
 * @param {*} LISTENING_PORT 
 */
async function loadRoutes(app, LISTENING_PORT){

  
  // Exemple sur la redirection de l'utilisateur vers le serveur OAuth 2.0 de Google.
  app.get('/', async (req, res) => {
    // TODO : récupérer le code erreur, pour voir si l'utilisateur est autorisé ?
    // ... Testé NOK en connectant un utilisateur non inscrit comme développeur : le catch n'est pas déclenché car res.redirect(authorizationUrl) est bien lancé !
    // ... Logique OK : si pas connecté alors pas de redirection, mais cette partie doit rester gérée par le provider OAUTH !
    // try{
      console.log(`Route demandée : '/'`)

      console.log("req.session = ", req.session)// Vérifier le vidage de la session si redémarrage hard du serveur
      
      // Scopes : URL définissant l'étendu des droit d'accès sur l'API YouTube
      const scopes = [
        'https://www.googleapis.com/auth/youtube.force-ssl'
      ];    
      // Générer une valeur d'état (=state) aléatoire sécurisée.
      const state = crypto.randomBytes(32).toString('hex');
      // Stocker l'état en session
      req.session.state = state;

      // Générer une URL qui demande des permissions pour l'activité du Drive ou du scope de Google Calendar
      const authorizationUrl = oauth2Client.generateAuthUrl({
        // 'online' (default) or 'offline' (obtient refresh_token)
        access_type: 'offline', // NB : Une fois qu'un utilisateur a accordé un accès hors connexion aux champs d'application demandés, vous pouvez continuer à utiliser le client de l'API pour accéder aux API Google au nom de l'utilisateur lorsqu'il est hors connexion. L'objet client actualisera le jeton d'accès si nécessaire.
        
        /** Passer dans le tableau des scopes définies ci-dessus.
          * Alternativement, si une seule scope est nécessaire, vous pouvez passer une URL de portée en tant que chaîne */
        scope: scopes,
        // Activer l'autorisation incrémentielle. Recommandé comme bonne pratique
        include_granted_scopes: true,
        // Inclure le paramètre d'état pour réduire le risque d'attaques CSRF.
        state: state
      });

      // console.log("authorizationUrl = " + authorizationUrl)
      res.redirect(authorizationUrl);
    /*}
    catch(error){
      console.log("Route '/' > error = ",error)
    }*/
  });

  // Recevevoir le callback du serveur OAuth 2.0 de Google.
  app.get('/oauth2callback', async (req, res) => {
    console.log(`Route demandée : '/oauth2callback'`)
    // Gérer la REPONSE du serveur OAuth 2.0
    let q = url.parse(req.url, true).query;
    console.log("query = "+JSON.stringify(q))// Afficher TOUS les éléments du querystring contenu dans cette requete (type GET)
    // Attention : cela est impossible (= exception) : 
    // console.log("req ="+JSON.stringify(req))
    // console.log("res ="+JSON.stringify(res))
    
    console.log("req.session = ", req.session)
    if (q.error) { // Une réponse d'erreur, par ex. error=access_denied
      console.log('Error:' + q.error);
    } else if (q.state !== req.session.state) { //vérifier la veleur de 'state'
      console.log('State mismatch. Possible CSRF attack');
      res.end('State mismatch. Possible CSRF attack');
    } else { // Obtenez des access tokens et refresh tokens (si access_type est offline)
      
      // Les jetons d'accès expirent. Cette bibliothèque réalise automatiquement un refresh token (=jeton d'actualisation) pour obtenir un nouveau access token (=jeton d'accès) s'il est sur le point d'expirer. Pour vous assurer de toujours stocker les jetons les plus récents, utilisez l'événement "tokens" :
      /*oauth2Client.on('tokens', (tokens) => {
        if (tokens.refresh_token) {// S'il n'existe pas !
          // Attention de stocker le refresh_token dans une databes persistante, sinon il ne sera pas récupérable, il faudra révoquer la session pour recréer un access_token et un refresh_token (affiché seulement lors de la création DES TOKENS) !
          console.log("tokens.refresh_token = ",tokens.refresh_token);
        }
        console.log("tokens.refresh_token = ",tokens.access_token);
      });*/
      
      let { tokens } = await oauth2Client.getToken(q.code);
      
      
      // Essai de conservation en données persistantes du refresh_token
      // En prod, chiffrer la session de express en utilisant connect-memcached (https://github.com/balor/connect-memcached)
      // TODO : comment bien utiliser app.use(...) pour sauvegarder une valeur ?
      console.log("ANCIEN session.refresh_token = ", req.session.refresh_token)
      
      req.session.access_token = tokens.access_token;// TODO : A supprimer si non utilisé plus tard
      
      req.session.expiry_date = tokens.expiry_date;// Format = ms accepté par new Date(...) ; 
      // TODO : A supprimer si non utilisé plus tard
      
      ////////////////////////////////// FIN : enregistrer les data de refresh_token en session
      if (tokens.refresh_token!=undefined){
        req.session.refresh_token = tokens.refresh_token;
        
        // NOK : 
        // express-session deprecated undefined resave option; provide resave option main.js:118:11
        // express - session deprecated undefined saveUninitialized option; provide saveUninitialized option main.js: 118: 11
        // express - session deprecated req.secret; provide secret option main.js: 118: 11
        // De plus : pas une bonne pratique, car si le serveur est redémarré :
        // - le refresh_token est perdu sur le serveur
        // - les tokens seront conservées du coté de Google
        // => résultat : il faudrait le connecter puis les révoquer pour recevoir le refresh_token !
      }

      console.log("NOUVEAU session.refresh_token = ", req.session.refresh_token)
      console.log("DEBUG > tokens = ", tokens)
      ////////////////////////////////// FIN : enregistrer les data de refresh_token en session
      console.log("DEBUG > req.session = ", req.session)// Vérifier contenu de session : qui est conservée jusqu'à expiration de la session, ou redémarrage du serveur
      /** Notes de développeur :  
       * - Sécurité : il est crucial de sécuriser les données de session pour empêcher l'accès ou la falsification non autorisée. Vous pouvez sécuriser les données de session en utilisant des cookies sécurisés, en chiffrant les données de session et en implémentant le chiffrement HTTPS.
       */

      oauth2Client.setCredentials(tokens);

      /** Enregistrer les credential sur la variable globale au cas où l'access token a été actualisé.
        * ACTION ITEM: Dans une application de production, vous souhaitez probablement enregistrer le refresh token
        *              dans une database persistante et sécurisée. */
      userCredential = tokens;
      
      // Exemple d'utilisation de l'API YouTube pour lister les playlists 
      let service = google.youtube('v3');
      service.playlists.list({
        auth: oauth2Client,
        part: 'snippet,contentDetails',
        maxResults: 25,
        mine: true,
      }, function (err, response) {
        if (err) {
          console.log('The API returned an error: ' + err);
          return;
        }
        let playlists = response.data.items;
        if (playlists.length == 0) {
          console.log('No playlist found.');
          //console.log('No channel found.');
        } else {
          console.log("Nombre de playlists =",playlists.length) 
          console.log("Toutes les playlists =",playlists)
          console.log('Voici la première des playlists ID : %s. Son titre est \'%s',
            playlists[0].id,
            playlists[0].snippet.title);
          /*console.log('This channel\'s ID is %s. Its title is \'%s\', and ' +
            'it has %s views.',
            channels[0].id,
            channels[0].snippet.title,
            channels[0].statistics.viewCount);
            */

          res.redirect(`https://www.youtube.com/playlist?list=${playlists[0].id}`); 
          // Rédiriger vers la page d'accueil, avec les paramètre :
          // - données ressources YoutTube déjà récupéres
          // - données de token pour interroger à nouveau des ressources YoutTube
          // EN PLUS : Ajouter dans l'API une route pour renouveler (refresh) le token au besoin peu de temps avant son expiration !

          // Exemple d'URL avec un autre serveur lancé sur le port régulier 80 :
          // http://localhost/video-play.html?currentPlyalist=PLhWtBcRmFDhcYqxNDABX2iol1sDBpDSi5&access_token=ya29.a0AeXRPp5iH_knZuZyXs8LuzYogXpuuBlEw3b1AHxYCawNaaRWew-V6m1BbSrb1oOgKlu0XRxdsD3lRNLOzzH1e0RC3O0ULGwS7FITFDR6dr4V4hl8KmoNVf3DvjjinS6YfE5kLKICSI5sdeKtNEnrCmk_o3Pob3jjzI1iNJkC2QaCgYKAbUSARISFQHGX2Mi806Z8ygvYokJN8_g2k1-RA0177&expiry_date=1741694565783
        }
      });
    }
  });

  // Exmple de revocation (=revoking) un token
  // Résultat : le token est révoqué, mais il n'est pas supprimé de la session. Il faudra donc supprimer la session pour que l'utilisateur soit obligé de se reconnecter pour obtenir un nouveau token.
  app.get('/revoke', async (req, res) => {
    console.log(`Route demandée : '/revoke'`);
    // Construisez le string pour la requête POST
    console.log("userCredential = "+JSON.stringify(userCredential))
    if (userCredential!=null){
      let postData = "token=" + userCredential.access_token;

      // Options de requête POST sur (le serveur) OAuth 2.0 de Google pour révoquer un token
      let postOptions = {
        host: 'oauth2.googleapis.com',
        port: '443',
        path: '/revoke',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      // Configurer la requete
      const postReq = https.request(postOptions, function (res) {
        res.setEncoding('utf8');
        res.on('data', d => {
          console.log('Response: ' + d);
        });
      });

      postReq.on('error', error => {
        console.log(error)
      });

      // Envoyer la requete avec ses données
      postReq.write(postData);
      postReq.end();

      // ---------- TODO : vérifier cette partie de Copilot -------------------
      // ---------- Sauf la l'action de redirection --------------------------- 
      // Supprimer les données de session pour forcer l'utilisateur à se reconnecter
      req.session.destroy(err => {
        if (err) {
          console.error('Error destroying session:', err);
        }
        // Rediriger !
        res.redirect(`http://localhost:${LISTENING_PORT}/`)
      });
      // ------------------------------------------------------------------------ 
    }
    else{
      console.log("Revocation impossible : aucun token enregistré !")
    }
  });
  
  
}

module.exports = {
  initOAuth2Client: initOAuth2Client,
  loadRoutes: loadRoutes
}