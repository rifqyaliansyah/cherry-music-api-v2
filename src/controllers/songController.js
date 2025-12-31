const pool = require('../config/database');
const { downloadAudio, getThumbnail } = require('../utils/downloader');
const { uploadAudio, getAudioDuration, deleteAudio } = require('../utils/uploader');

async function downloadSong(req, res) {
    const client = await pool.connect();

    try {
        const { youtube_url, title, artist, cover_url, lyrics } = req.body;

        if (!youtube_url || !title || !artist) {
            return res.status(400).json({
                success: false,
                message: 'youtube_url, title, and artist are required'
            });
        }

        const { filePath } = await downloadAudio(youtube_url);
        const duration = await getAudioDuration(filePath);
        const { url: audio_url, publicId } = await uploadAudio(filePath);

        let finalCoverUrl = cover_url;
        if (!finalCoverUrl) {
            finalCoverUrl = await getThumbnail(youtube_url);
        }
        if (!finalCoverUrl) {
            finalCoverUrl = "https://placehold.co/300x300/333/fff?text=No+Cover"; 
        }
        await client.query('BEGIN');

        const songResult = await client.query(
            `INSERT INTO songs (title, artist, cover_url, audio_url, duration, youtube_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
            [title, artist, finalCoverUrl, audio_url, duration, youtube_url]
        );

        const song = songResult.rows[0];

        if (lyrics && Array.isArray(lyrics) && lyrics.length > 0) {
            const lyricValues = lyrics.map((lyric, index) =>
                `(${song.id}, ${lyric.time}, '${lyric.text.replace(/'/g, "''")}', ${index})`
            ).join(',');

            await client.query(
                `INSERT INTO lyrics (song_id, timestamp, text, line_order)
         VALUES ${lyricValues}`
            );
        }

        await client.query('COMMIT');

        const completeSong = await getSongById(song.id);

        res.status(201).json({
            success: true,
            message: 'Song downloaded successfully',
            data: completeSong
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Download error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to download song'
        });
    } finally {
        client.release();
    }
}

async function getAllSongs(req, res) {
    try {
        const result = await pool.query(
            'SELECT * FROM songs ORDER BY created_at DESC'
        );

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Get songs error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch songs'
        });
    }
}

async function getSongById(songId) {
    const songResult = await pool.query(
        'SELECT * FROM songs WHERE id = $1',
        [songId]
    );

    if (songResult.rows.length === 0) {
        return null;
    }

    const song = songResult.rows[0];

    const lyricsResult = await pool.query(
        'SELECT timestamp as time, text FROM lyrics WHERE song_id = $1 ORDER BY line_order ASC',
        [songId]
    );

    return {
        ...song,
        lyrics: lyricsResult.rows
    };
}

async function getSong(req, res) {
    try {
        const { id } = req.params;
        const song = await getSongById(id);

        if (!song) {
            return res.status(404).json({
                success: false,
                message: 'Song not found'
            });
        }

        res.json({
            success: true,
            data: song
        });
    } catch (error) {
        console.error('Get song error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch song'
        });
    }
}

async function updateSong(req, res) {
    const client = await pool.connect();

    try {
        const { id } = req.params;
        const { title, artist, cover_url, lyrics } = req.body;

        await client.query('BEGIN');

        const updateFields = [];
        const values = [];
        let paramIndex = 1;

        if (title) {
            updateFields.push(`title = $${paramIndex++}`);
            values.push(title);
        }
        if (artist) {
            updateFields.push(`artist = $${paramIndex++}`);
            values.push(artist);
        }
        if (cover_url) {
            updateFields.push(`cover_url = $${paramIndex++}`);
            values.push(cover_url);
        }

        if (updateFields.length > 0) {
            values.push(id);
            await client.query(
                `UPDATE songs SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
                values
            );
        }

        if (lyrics && Array.isArray(lyrics)) {
            await client.query('DELETE FROM lyrics WHERE song_id = $1', [id]);

            if (lyrics.length > 0) {
                const lyricValues = lyrics.map((lyric, index) =>
                    `(${id}, ${lyric.time}, '${lyric.text.replace(/'/g, "''")}', ${index})`
                ).join(',');

                await client.query(
                    `INSERT INTO lyrics (song_id, timestamp, text, line_order)
           VALUES ${lyricValues}`
                );
            }
        }

        await client.query('COMMIT');

        const updatedSong = await getSongById(id);

        res.json({
            success: true,
            message: 'Song updated successfully',
            data: updatedSong
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Update error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update song'
        });
    } finally {
        client.release();
    }
}

async function deleteSong(req, res) {
    try {
        const { id } = req.params;

        const song = await getSongById(id);

        if (!song) {
            return res.status(404).json({
                success: false,
                message: 'Song not found'
            });
        }

        const urlParts = song.audio_url.split('/');
        const publicIdWithExt = urlParts.slice(-2).join('/');
        const publicId = publicIdWithExt.replace('.mp3', '');

        await deleteAudio(publicId);

        await pool.query('DELETE FROM songs WHERE id = $1', [id]);

        res.json({
            success: true,
            message: 'Song deleted successfully'
        });

    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete song'
        });
    }
}

module.exports = {
    downloadSong,
    getAllSongs,
    getSong,
    updateSong,
    deleteSong
};