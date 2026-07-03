const { google } = require('googleapis');

class YoutubeService {
  async getPlaylists(oauth2Client) {
    return new Promise((resolve, reject) => {
      const service = google.youtube('v3');
      service.playlists.list(
        {
          auth: oauth2Client,
          part: 'snippet,contentDetails',
          maxResults: 25,
          mine: true,
        },
        (err, response) => {
          if (err) {
            reject(err);
            return;
          }

          const playlists = (response?.data?.items || []).map((item) => ({
            id: item.id,
            title: item.snippet?.title || 'Sans titre',
            description: item.snippet?.description || 'Aucune description.',
            url: `https://www.youtube.com/playlist?list=${item.id}`,
            videoCount: item.contentDetails?.itemCount || 0,
          }));

          resolve(playlists);
        },
      );
    });
  }
}

module.exports = {
  YoutubeService,
};
