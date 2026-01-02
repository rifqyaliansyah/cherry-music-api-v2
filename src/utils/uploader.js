const cloudinary = require('../config/cloudinary');
const mm = require('music-metadata');

const uploadAudio = (buffer) =>
    new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
            {
                resource_type: 'video',
                folder: 'music-player/audio'
            },
            async (err, result) => {
                if (err) return reject(err);

                const metadata = await mm.parseBuffer(buffer);
                resolve({
                    url: result.secure_url,
                    publicId: result.public_id,
                    duration: Math.round(metadata.format.duration)
                });
            }
        ).end(buffer);
    });

const uploadCover = (buffer) =>
    new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
            {
                resource_type: 'image',
                folder: 'music-player/covers'
            },
            (err, result) => {
                if (err) reject(err);
                else resolve({
                    url: result.secure_url,
                    publicId: result.public_id
                });
            }
        ).end(buffer);
    });

const deleteAudio = (publicId) =>
    cloudinary.uploader.destroy(publicId, { resource_type: 'video' });

const deleteCover = (publicId) =>
    cloudinary.uploader.destroy(publicId, { resource_type: 'image' });

module.exports = {
    uploadAudio,
    uploadCover,
    deleteAudio,
    deleteCover
};
