const yt = require('@vreden/youtube_scraper');
const axios = require('axios');

async function getAudioStream(youtubeUrl) {
    const data = await yt.ytmp3(youtubeUrl, 320);

    if (!data?.download?.url) {
        throw new Error('Download link not available');
    }

    const response = await axios({
        method: 'GET',
        url: data.download.url,
        responseType: 'stream'
    });

    return {
        stream: response.data,
        metadata: data
    };
}

async function getThumbnail(youtubeUrl) {
    try {
        const data = await yt.metadata(youtubeUrl);
        return data.image || data.thumbnail || null;
    } catch {
        return null;
    }
}

module.exports = {
    getAudioStream,
    getThumbnail
};
