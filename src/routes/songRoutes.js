const express = require('express');
const router = express.Router();
const {
    downloadSong,
    getAllSongs,
    getSong,
    updateSong,
    deleteSong
} = require('../controllers/songController');

router.post('/download', downloadSong);
router.get('/', getAllSongs);
router.get('/:id', getSong);
router.put('/:id', updateSong);
router.delete('/:id', deleteSong);

module.exports = router;