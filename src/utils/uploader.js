const cloudinary = require('../config/cloudinary');
const { Readable } = require('stream');

function uploadAudioStream(readableStream) {
    return new Promise((resolve, reject) => {
        const upload = cloudinary.uploader.upload_stream(
            {
                resource_type: 'video',
                folder: 'music-player/audio',
                format: 'mp3'
            },
            (error, result) => {
                if (error) return reject(error);
                resolve({
                    url: result.secure_url,
                    publicId: result.public_id,
                    duration: Math.round(result.duration)
                });
            }
        );

        readableStream.pipe(upload);
    });
}

function uploadCover(buffer) {
    return new Promise((resolve, reject) => {
        const upload = cloudinary.uploader.upload_stream(
            {
                resource_type: 'image',
                folder: 'music-player/covers'
            },
            (error, result) => {
                if (error) return reject(error);
                resolve({
                    url: result.secure_url,
                    publicId: result.public_id
                });
            }
        );

        Readable.from(buffer).pipe(upload);
    });
}

function deleteAudio(publicId) {
    return cloudinary.uploader.destroy(publicId, {
        resource_type: 'video'
    });
}

function deleteCover(publicId) {
    return cloudinary.uploader.destroy(publicId, {
        resource_type: 'image'
    });
}

module.exports = {
    uploadAudioStream,
    uploadCover,
    deleteAudio,
    deleteCover
};
