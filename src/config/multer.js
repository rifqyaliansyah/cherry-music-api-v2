const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    if (file.fieldname === 'audio') {
        const allowedAudioTypes = /mp3|wav|flac|m4a|aac|ogg/;
        const extname = allowedAudioTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedAudioTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed (mp3, wav, flac, m4a, aac, ogg)'));
        }
    } else if (file.fieldname === 'cover') {
        const allowedImageTypes = /jpeg|jpg|png|webp/;
        const extname = allowedImageTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedImageTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed (jpeg, jpg, png, webp)'));
        }
    } else {
        cb(new Error('Unexpected field'));
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024
    },
    fileFilter: fileFilter
});

module.exports = upload;