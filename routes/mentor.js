const express = require('express');
const router = express.Router();
const supabase = require('../supabase'); // Import Supabase client

// GET endpoint to fetch all mentor sessions with user data
router.get('/', async (req, res) => {
    try {
        // Fetch all mentor sessions
        const { data: mentorSessions, error: mentorError } = await supabase
            .from('mentor')
            .select(`
                *,
                user:uuid (
                    fullname,
                    avatar,
                    email
                )
            `);

        if (mentorError) throw mentorError;

        if (!mentorSessions || mentorSessions.length === 0) {
            return res.status(404).json({ error: 'No mentor sessions found' });
        }

        res.status(200).json({ mentorSessions });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;