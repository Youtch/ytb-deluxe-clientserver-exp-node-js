const { GoogleService } = require('../services/google.service');
const { YoutubeService } = require('../services/youtube.service');
const { createAuthController } = require('./auth.controller');

require('dotenv').config();

const googleService = new GoogleService();
const youtubeService = new YoutubeService();
const authController = createAuthController(googleService, youtubeService);

function initOAuth2Client(LISTENING_PORT, REDIRECT_URL_END) {
  googleService.initOAuth2Client(LISTENING_PORT, REDIRECT_URL_END);
}

function loadRoutes(app, LISTENING_PORT) {
  app.get('/', authController.login);
  app.get('/oauth2callback', authController.oauthCallback);
  app.get('/revoke', authController.revoke);
}

module.exports = {
  initOAuth2Client,
  loadRoutes,
};
