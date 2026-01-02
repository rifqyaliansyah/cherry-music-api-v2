const cloudinary = require('../config/cloudinary');
const { parseFile } = require('music-metadata');
const fs = require('fs');

async function uploadAudio(filePath) {
    try {
        console.log('Uploading audio to Cloudinary...');

        const result = await cloudinary.uploader.upload(filePath, {
            resource_type: 'video',
            folder: 'music-player/audio',
            format: 'mp3'
        });

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        return {
            url: result.secure_url,
            publicId: result.public_id,
            duration: Math.round(result.duration)
        };
    } catch (error) {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        throw new Error(`Upload audio failed: ${error.message}`);
    }
}

async function uploadCover(filePath) {
    try {
        console.log('Uploading cover to Cloudinary...');

        const result = await cloudinary.uploader.upload(filePath, {
            resource_type: 'image',
            folder: 'music-player/covers'
        });

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        return {
            url: result.secure_url,
            publicId: result.public_id
        };
    } catch (error) {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        throw new Error(`Upload cover failed: ${error.message}`);
    }
}

async function getAudioDuration(filePath) {
    try {
        const metadata = await parseFile(filePath);
        return Math.round(metadata.format.duration);
    } catch (error) {
        console.error('Failed to extract duration:', error.message);
        return 0;
    }
}

async function deleteAudio(publicId) {
    try {
        await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
        console.log('Audio deleted from Cloudinary');
    } catch (error) {
        console.error('Failed to delete audio:', error.message);
    }
}

async function deleteCover(publicId) {
    try {
        await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
        console.log('Cover deleted from Cloudinary');
    } catch (error) {
        console.error('Failed to delete cover:', error.message);
    }
}

module.exports = {
    uploadAudio,
    uploadCover,
    getAudioDuration,
    deleteAudio,
    deleteCover
};