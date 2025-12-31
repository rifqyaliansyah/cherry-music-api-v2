const yt = require('@vreden/youtube_scraper');
const fs = require('fs');
const path = require('path');
const https = require('https');

async function downloadAudio(youtubeUrl) {
    try {
        console.log('⬇Downloading audio...');

        // Get MP3 data
        const data = await yt.ytmp3(youtubeUrl, 320);

        if (!data.download || !data.download.url) {
            throw new Error('Download link not available');
        }

        // Create uploads folder
        const uploadsDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // File name
        const fileName = `${Date.now()}.mp3`;
        const filePath = path.join(uploadsDir, fileName);

        // Download file
        await downloadFile(data.download.url, filePath);

        return {
            filePath,
            fileName,
            metadata: data
        };

    } catch (error) {
        console.error('Download error:', error.message);
        throw error;
    }
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);

        https.get(url, (response) => {
            response.pipe(file);

            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => { });
            reject(err);
        });
    });
}

async function getThumbnail(youtubeUrl) {
    try {
        const data = await yt.metadata(youtubeUrl);
        return data.image || data.thumbnail || null;
    } catch (error) {
        console.error('Thumbnail error:', error.message);
        return null;
    }
}

module.exports = {
    downloadAudio,
    getThumbnail
};