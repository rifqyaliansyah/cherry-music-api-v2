const yt = require('@vreden/youtube_scraper');
const https = require('https');

async function downloadAudio(youtubeUrl) {
    const data = await yt.ytmp3(youtubeUrl, 320);

    if (!data?.download?.url) {
        throw new Error('Download link not available');
    }

    const buffer = await downloadToBuffer(data.download.url);

    return {
        buffer,
        metadata: data
    };
}

function downloadToBuffer(url) {
    return new Promise((resolve, reject) => {
        const chunks = [];

        https.get(url, (res) => {
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', reject);
    });
}

async function getThumbnail(youtubeUrl) {
    try {
        const data = await yt.metadata(youtubeUrl);
        return data.image || data.thumbnail || null;
    } catch {
        return null;
    }
}

module.exports = { downloadAudio, getThumbnail };
