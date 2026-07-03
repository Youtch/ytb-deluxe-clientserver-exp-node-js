const https = require('https');
const url = require('url');
const crypto = require('crypto');

function createAuthController(googleService, youtubeService) {
  const escapeHtml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const renderPlaylistsPage = (playlists) => {
    const rows = playlists.map((playlist) => `
      <tr>
        <td>${escapeHtml(playlist.title)}</td>
        <td><a href="${escapeHtml(playlist.url)}" target="_blank" rel="noreferrer">Ouvrir</a></td>
        <td>${playlist.videoCount}</td>
        <td>${escapeHtml(playlist.description)}</td>
      </tr>
    `).join('');

    return `<!doctype html>
      <html lang="fr">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Mes playlists YouTube</title>
          <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
          <link href="https://cdn.datatables.net/1.13.6/css/dataTables.bootstrap5.min.css" rel="stylesheet">
        </head>
        <body class="bg-light">
          <main class="container py-5">
            <div class="card shadow-sm">
              <div class="card-body">
                <h1 class="h3 mb-3">Mes playlists YouTube</h1>
                <p class="text-muted">Voici les playlists récupérées depuis votre compte Google.</p>
                <table id="playlistTable" class="table table-striped table-hover align-middle">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>URL</th>
                      <th>Vidéos</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows}
                  </tbody>
                </table>
              </div>
            </div>
          </main>

          <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
          <script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
          <script src="https://cdn.datatables.net/1.13.6/js/dataTables.bootstrap5.min.js"></script>
          <script>
            $(document).ready(function () {
              $('#playlistTable').DataTable({
                language: {
                  url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/fr-FR.json'
                },
                pageLength: 10,
                order: [[0, 'asc']]
              });
            });
          </script>
        </body>
      </html>`;
  };

  return {
    async login(req, res) {
      console.log("Route demandée : '/'");
      console.log('req.session = ', req.session);

      if (!googleService.oauth2Client) {
        return res.status(500).send('OAuth2 client non initialisé.');
      }

      if (googleService.hasStoredCredentials()) {
        try {
          const playlists = await youtubeService.getPlaylists(googleService.oauth2Client);
          if (!playlists.length) {
            return res.status(404).send('Aucune playlist trouvée.');
          }

          const html = renderPlaylistsPage(playlists);
          return res.send(html);
        } catch (error) {
          console.log('Impossible d’utiliser les credentials sauvegardés :', error);
        }
      }

      const scopes = ['https://www.googleapis.com/auth/youtube.force-ssl'];
      const state = crypto.randomBytes(32).toString('hex');
      req.session.state = state;

      const authorizationUrl = googleService.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        include_granted_scopes: true,
        state,
      });

      res.redirect(authorizationUrl);
    },

    async oauthCallback(req, res) {
      console.log("Route demandée : '/oauth2callback'");
      const query = url.parse(req.url, true).query;
      console.log('query = ' + JSON.stringify(query));
      console.log('req.session = ', req.session);

      if (!googleService.oauth2Client) {
        return res.status(500).send('OAuth2 client non initialisé.');
      }

      if (query.error) {
        console.log('Error:' + query.error);
        return res.status(400).send(`Erreur OAuth : ${query.error}`);
      }

      if (query.state !== req.session.state) {
        console.log('State mismatch. Possible CSRF attack');
        return res.status(400).send('State mismatch. Possible CSRF attack');
      }

      try {
        const { tokens } = await googleService.oauth2Client.getToken(query.code);

        console.log('ANCIEN session.refresh_token = ', req.session.refresh_token);
        req.session.access_token = tokens.access_token;
        req.session.expiry_date = tokens.expiry_date;

        if (tokens.refresh_token !== undefined) {
          req.session.refresh_token = tokens.refresh_token;
        }

        console.log('NOUVEAU session.refresh_token = ', req.session.refresh_token);
        console.log('DEBUG > tokens = ', tokens);
        console.log('DEBUG > req.session = ', req.session);

        googleService.oauth2Client.setCredentials(tokens);
        googleService.userCredential = tokens;
        googleService.saveCredentials(tokens);

        try {
          const playlists = await youtubeService.getPlaylists(googleService.oauth2Client);

          if (!playlists.length) {
            console.log('No playlist found.');
            return res.status(404).send('Aucune playlist trouvée.');
          }

          const html = renderPlaylistsPage(playlists);
          return res.send(html);
        } catch (error) {
          console.log('The API returned an error: ' + error);
          return res.status(500).send('Impossible de récupérer les playlists YouTube.');
        }
      } catch (error) {
        console.log('Erreur lors de l\'échange du code OAuth :', error);
        res.status(500).send('Échec de l\'authentification Google.');
      }
    },

    async revoke(req, res) {
      console.log("Route demandée : '/revoke'");
      console.log('userCredential = ' + JSON.stringify(googleService.userCredential));

      if (googleService.userCredential !== null) {
        const postData = 'token=' + googleService.userCredential.access_token;
        const postOptions = {
          host: 'oauth2.googleapis.com',
          port: '443',
          path: '/revoke',
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData),
          },
        };

        const postReq = https.request(postOptions, (response) => {
          response.setEncoding('utf8');
          response.on('data', (d) => {
            console.log('Response: ' + d);
          });
        });

        postReq.on('error', (error) => {
          console.log(error);
        });

        postReq.write(postData);
        postReq.end();

        googleService.clearStoredCredentials();

        req.session.destroy((err) => {
          if (err) {
            console.error('Error destroying session:', err);
          }
          res.redirect('http://localhost:8080/');
        });
      } else {
        console.log('Revocation impossible : aucun token enregistré !');
        res.status(400).send('Aucun token enregistré à révoquer.');
      }
    },
  };
}

module.exports = {
  createAuthController,
};
