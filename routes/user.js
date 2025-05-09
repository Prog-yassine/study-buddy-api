const express = require('express');
const router = express.Router();
const supabase = require('../supabase'); // Import Supabase client

router.get('/:uuid', async (req, res) => {
    const userId = req.params.uuid;

    try {
        // Fetch user information
        const { data: userData, error: userError } = await supabase
            .from('user')
            .select('*')
            .eq('uuid', userId);
        
        if (userError) throw userError;

        if (!userData || userData.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userData[0];

        // Fetch sessions where the user is a member
        const { data: memberData, error: memberError } = await supabase
            .from('members')
            .select('session_id')
            .eq('uuid', userId);

        if (memberError) throw memberError;

        if (!memberData || memberData.length === 0) {
            return res.status(200).json({
                user: user,
                sessions: [],
            });
        }

        const sessionIds = memberData.map((member) => member.session_id);
        const { data: sessionData, error: sessionError } = await supabase
            .from('session')
            .select('*')
            .in('id', sessionIds);

        if (sessionError) throw sessionError;

        const sessionsWithRoles = sessionData.map((session) => {
            return {
                ...session,
                role: session.uuid === userId ? 'owner' : 'member',
            };
        });

        const response = {
            user: user,
            sessions: sessionsWithRoles,
        };

        res.status(200).json(response);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:uuid', async (req, res) => {
    const userId = req.params.uuid;
    const { first_name, last_name, bio } = req.body;

    try {
        // Update user information
        const { data, error } = await supabase
            .from('user')
            .update({ first_name, last_name, bio })
            .eq('uuid', userId)
            .select()

        if (error) throw error;

        if (!data || data.length === 0) {
            return res.status(404).json({ error: 'User not found or no changes made' });
        }

        res.status(200).json({ message: 'Profile updated successfully', user: data[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;