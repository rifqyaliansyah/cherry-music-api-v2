const express = require('express');
const router = express.Router();
const upload = require('../config/multer');
const {
    downloadSong,
    uploadSong,
    getAllSongs,
    getSong,
    updateSong,
    deleteSong
} = require('../controllers/songController');

router.post('/download', upload.fields([
    { name: 'cover', maxCount: 1 }
]), downloadSong);

router.post('/upload', upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'cover', maxCount: 1 }
]), uploadSong);


router.get('/', getAllSongs);
router.get('/:id', getSong);

router.put('/:id', upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'cover', maxCount: 1 }
]), updateSong);

router.delete('/:id', deleteSong);

module.exports = router;