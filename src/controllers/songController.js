const pool = require('../config/database');
const { downloadAudio, getThumbnail } = require('../utils/downloader');
const { uploadAudio, uploadCover, getAudioDuration, deleteAudio, deleteCover } = require('../utils/uploader');
const fs = require('fs');

async function downloadSong(req, res) {
    const client = await pool.connect();

    try {
        const { youtube_url, title, artist, lyrics } = req.body;
        const coverFile = req.files?.cover?.[0];

        if (!youtube_url || !title || !artist) {
            return res.status(400).json({
                success: false,
                message: 'youtube_url, title, and artist are required'
            });
        }

        const { filePath } = await downloadAudio(youtube_url);
        const duration = await getAudioDuration(filePath);
        const { url: audio_url, publicId } = await uploadAudio(filePath);

        let finalCoverUrl;

        if (coverFile) {
            const coverResult = await uploadCover(coverFile.path);
            finalCoverUrl = coverResult.url;
        } else {
            finalCoverUrl = await getThumbnail(youtube_url);
            if (!finalCoverUrl) {
                finalCoverUrl = "https://placehold.co/300x300/333/fff?text=No+Cover";
            }
        }

        await client.query('BEGIN');

        const songResult = await client.query(
            `INSERT INTO songs (title, artist, cover_url, audio_url, duration, youtube_url)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [title, artist, finalCoverUrl, audio_url, duration, youtube_url]
        );

        const song = songResult.rows[0];

        if (lyrics) {
            let parsedLyrics;
            try {
                parsedLyrics = typeof lyrics === 'string' ? JSON.parse(lyrics) : lyrics;
            } catch (e) {
                throw new Error('Invalid lyrics format. Must be a valid JSON array.');
            }

            if (Array.isArray(parsedLyrics) && parsedLyrics.length > 0) {
                const lyricValues = parsedLyrics.map((lyric, index) =>
                    `(${song.id}, ${lyric.time}, '${lyric.text.replace(/'/g, "''")}', ${index})`
                ).join(',');

                await client.query(
                    `INSERT INTO lyrics (song_id, timestamp, text, line_order)
                     VALUES ${lyricValues}`
                );
            }
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

async function uploadSong(req, res) {
    const client = await pool.connect();
    let uploadedAudioUrl = null;
    let uploadedCoverUrl = null;
    let audioPublicId = null;
    let coverPublicId = null;

    try {
        const { title, artist, lyrics } = req.body;
        const audioFile = req.files?.audio?.[0];
        const coverFile = req.files?.cover?.[0];

        if (!title || !artist) {
            return res.status(400).json({
                success: false,
                message: 'title and artist are required'
            });
        }

        if (!audioFile) {
            return res.status(400).json({
                success: false,
                message: 'audio file is required'
            });
        }

        const duration = await getAudioDuration(audioFile.path);

        const audioResult = await uploadAudio(audioFile.path);
        uploadedAudioUrl = audioResult.url;
        audioPublicId = audioResult.publicId;

        let finalCoverUrl = "https://placehold.co/300x300/333/fff?text=No+Cover";

        if (coverFile) {
            const coverResult = await uploadCover(coverFile.path);
            finalCoverUrl = coverResult.url;
            coverPublicId = coverResult.publicId;
        }

        await client.query('BEGIN');

        const songResult = await client.query(
            `INSERT INTO songs (title, artist, cover_url, audio_url, duration)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [title, artist, finalCoverUrl, uploadedAudioUrl, duration]
        );

        const song = songResult.rows[0];

        if (lyrics) {
            let parsedLyrics;
            try {
                parsedLyrics = typeof lyrics === 'string' ? JSON.parse(lyrics) : lyrics;
            } catch (e) {
                throw new Error('Invalid lyrics format. Must be a valid JSON array.');
            }

            if (Array.isArray(parsedLyrics) && parsedLyrics.length > 0) {
                const lyricValues = parsedLyrics.map((lyric, index) =>
                    `(${song.id}, ${lyric.time}, '${lyric.text.replace(/'/g, "''")}', ${index})`
                ).join(',');

                await client.query(
                    `INSERT INTO lyrics (song_id, timestamp, text, line_order)
                     VALUES ${lyricValues}`
                );
            }
        }

        await client.query('COMMIT');

        const completeSong = await getSongById(song.id);

        res.status(201).json({
            success: true,
            message: 'Song uploaded successfully',
            data: completeSong
        });

    } catch (error) {
        await client.query('ROLLBACK');

        if (audioPublicId) {
            await deleteAudio(audioPublicId);
        }
        if (coverPublicId) {
            await deleteCover(coverPublicId);
        }

        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to upload song'
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
    let uploadedAudioUrl = null;
    let uploadedCoverUrl = null;
    let audioPublicId = null;
    let coverPublicId = null;
    let oldAudioPublicId = null;
    let oldCoverPublicId = null;

    try {
        const { id } = req.params;
        const { title, artist, lyrics, youtube_url } = req.body;
        const audioFile = req.files?.audio?.[0];
        const coverFile = req.files?.cover?.[0];

        const existingSong = await getSongById(id);
        if (!existingSong) {
            return res.status(404).json({
                success: false,
                message: 'Song not found'
            });
        }

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

        if (youtube_url) {
            const { filePath } = await downloadAudio(youtube_url);
            const duration = await getAudioDuration(filePath);
            const audioResult = await uploadAudio(filePath);
            uploadedAudioUrl = audioResult.url;
            audioPublicId = audioResult.publicId;

            updateFields.push(`audio_url = $${paramIndex++}`);
            values.push(uploadedAudioUrl);

            updateFields.push(`duration = $${paramIndex++}`);
            values.push(duration);

            updateFields.push(`youtube_url = $${paramIndex++}`);
            values.push(youtube_url);

            if (existingSong.audio_url) {
                const audioUrlParts = existingSong.audio_url.split('/');
                const audioPublicIdWithExt = audioUrlParts.slice(-2).join('/');
                oldAudioPublicId = audioPublicIdWithExt.replace(/\.(mp3|wav|m4a|ogg)$/, '');
            }

            if (!coverFile) {
                const thumbnailUrl = await getThumbnail(youtube_url);
                if (thumbnailUrl) {
                    updateFields.push(`cover_url = $${paramIndex++}`);
                    values.push(thumbnailUrl);

                    if (existingSong.cover_url && !existingSong.cover_url.includes('placehold.co') && !existingSong.cover_url.includes('ytimg.com')) {
                        const coverUrlParts = existingSong.cover_url.split('/');
                        const coverPublicIdWithExt = coverUrlParts.slice(-2).join('/');
                        oldCoverPublicId = coverPublicIdWithExt.split('.')[0];
                    }
                }
            }
        }
        else if (audioFile) {
            const duration = await getAudioDuration(audioFile.path);
            const audioResult = await uploadAudio(audioFile.path);
            uploadedAudioUrl = audioResult.url;
            audioPublicId = audioResult.publicId;

            updateFields.push(`audio_url = $${paramIndex++}`);
            values.push(uploadedAudioUrl);

            updateFields.push(`duration = $${paramIndex++}`);
            values.push(duration);

            updateFields.push(`youtube_url = $${paramIndex++}`);
            values.push(null);

            if (existingSong.audio_url) {
                const audioUrlParts = existingSong.audio_url.split('/');
                const audioPublicIdWithExt = audioUrlParts.slice(-2).join('/');
                oldAudioPublicId = audioPublicIdWithExt.replace(/\.(mp3|wav|m4a|ogg)$/, '');
            }
        }

        if (coverFile) {
            const coverResult = await uploadCover(coverFile.path);
            uploadedCoverUrl = coverResult.url;
            coverPublicId = coverResult.publicId;

            updateFields.push(`cover_url = $${paramIndex++}`);
            values.push(uploadedCoverUrl);

            if (existingSong.cover_url && !existingSong.cover_url.includes('placehold.co') && !existingSong.cover_url.includes('ytimg.com')) {
                const coverUrlParts = existingSong.cover_url.split('/');
                const coverPublicIdWithExt = coverUrlParts.slice(-2).join('/');
                oldCoverPublicId = coverPublicIdWithExt.split('.')[0];
            }
        }

        if (updateFields.length > 0) {
            values.push(id);
            await client.query(
                `UPDATE songs SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
                values
            );
        }

        if (lyrics !== undefined) {
            let parsedLyrics;
            try {
                parsedLyrics = typeof lyrics === 'string' ? JSON.parse(lyrics) : lyrics;
            } catch (e) {
                throw new Error('Invalid lyrics format. Must be a valid JSON array.');
            }

            await client.query('DELETE FROM lyrics WHERE song_id = $1', [id]);

            if (Array.isArray(parsedLyrics) && parsedLyrics.length > 0) {
                const lyricValues = parsedLyrics.map((lyric, index) =>
                    `(${id}, ${lyric.time}, '${lyric.text.replace(/'/g, "''")}', ${index})`
                ).join(',');

                await client.query(
                    `INSERT INTO lyrics (song_id, timestamp, text, line_order)
                     VALUES ${lyricValues}`
                );
            }
        }

        await client.query('COMMIT');

        if (oldAudioPublicId) {
            await deleteAudio(oldAudioPublicId);
        }
        if (oldCoverPublicId) {
            await deleteCover(oldCoverPublicId);
        }

        const updatedSong = await getSongById(id);

        res.json({
            success: true,
            message: 'Song updated successfully',
            data: updatedSong
        });

    } catch (error) {
        await client.query('ROLLBACK');

        if (audioPublicId) {
            await deleteAudio(audioPublicId);
        }
        if (coverPublicId) {
            await deleteCover(coverPublicId);
        }

        console.error('Update error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to update song'
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

        const audioUrlParts = song.audio_url.split('/');
        const audioPublicIdWithExt = audioUrlParts.slice(-2).join('/');
        const audioPublicId = audioPublicIdWithExt.replace(/\.(mp3|wav|m4a|ogg)$/, '');
        await deleteAudio(audioPublicId);

        if (song.cover_url && !song.cover_url.includes('placehold.co') && !song.cover_url.includes('ytimg.com')) {
            const coverUrlParts = song.cover_url.split('/');
            const coverPublicIdWithExt = coverUrlParts.slice(-2).join('/');
            const coverPublicId = coverPublicIdWithExt.split('.')[0];
            await deleteCover(coverPublicId);
        }

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
    uploadSong,
    getAllSongs,
    getSong,
    updateSong,
    deleteSong
};