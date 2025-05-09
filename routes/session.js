const express = require('express');
const router = express.Router();
const supabase = require('../supabase'); // Import Supabase client

// POST endpoint to create a new session
router.post('/', async (req, res) => {
    const {
        subject,
        sub_topic,
        description,
        max_members,
        start_time,
        end_time,
        required_level,
        location,
        date,
        session_type,
        estimated_duration,
        uuid // Creator's UUID
    } = req.body;

    try {
        // Insert the new session into the session table
        const { data: sessionData, error: sessionError } = await supabase
            .from('session')
            .insert([{
                subject,
                sub_topic,
                description,
                max_members,
                start_time,
                end_time,
                required_level,
                location,
                date,
                session_type,
                estimated_duration,
                uuid // Creator's UUID
            }])
            .select('*') // Return the inserted session
            .single(); // Get the single inserted session

        if (sessionError) throw sessionError;

        const session = sessionData; // Get the created session

        // Add the creator as the owner in the members table
        const { data: memberData, error: memberError } = await supabase
            .from('members')
            .insert([{
                uuid, // Creator's UUID
                session_id: session.id, // Session ID
                role: 'owner', // Role as owner
                status: 'active' // Default status
            }])
            .select('*') // Return the inserted member
            .single(); // Get the single inserted member


        if (memberError) throw memberError;

        res.status(201).json({
            message: 'Session created successfully',
            session,
            member: memberData
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST endpoint to request to join a session
router.post('/:session_id/request', async (req, res) => {
    const { session_id } = req.params;
    const { uuid } = req.body; // User's UUID

    try {
        // Add the user to the members table with a pending status
        const { data, error } = await supabase
            .from('members')
            .insert([{
                uuid,
                session_id,
                role: 'member',
                status: 'pending' // Status is pending until approved
            }])
            .select('*'); // Return the inserted member

        if (error) throw error;

        if (!data || data.length === 0) {
            return res.status(400).json({ error: 'Failed to request to join the session' });
        }

        res.status(201).json({ message: 'Request to join session sent successfully', member: data[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE endpoint to leave a session
router.delete('/:session_id/:uuid/leave', async (req, res) => {
    const { session_id, uuid } = req.params;


    try {
        // Remove the user from the members table
        const { data, error } = await supabase
            .from('members')
            .delete()
            .eq('uuid', uuid)
            .eq('session_id', session_id);

        if (error) throw error;

        res.status(200).json({ message: 'Left the session successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE endpoint to cancel a session (only for the owner)
router.delete('/:session_id/:uuid/cancel', async (req, res) => {
    const { session_id, uuid } = req.params;

    try {
        // Check if the user is the owner of the session
        const { data: sessionData, error: sessionError } = await supabase
            .from('session')
            .select('uuid')
            .eq('id', session_id)
            .single();

        if (sessionError) throw sessionError;

        if (!sessionData) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (sessionData.uuid !== uuid) {
            return res.status(403).json({ error: 'Only the owner can cancel the session' });
        }

        // Delete the session
        const { error: deleteError } = await supabase
            .from('session')
            .delete()
            .eq('id', session_id);

        if (deleteError) throw deleteError;

        // Remove all members from the session
        const { error: memberDeleteError } = await supabase
            .from('members')
            .delete()
            .eq('session_id', session_id);

        if (memberDeleteError) throw memberDeleteError;

        res.status(200).json({ message: 'Session canceled successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE endpoint to kick a member from a session
router.delete('/:session_id/:uuid/:member_uuid/kick', async (req, res) => {
    const { session_id, uuid, member_uuid } = req.params;


    try {
        // Check if the user is the owner of the session
        const { data: sessionData, error: sessionError } = await supabase
            .from('session')
            .select('uuid')
            .eq('id', session_id)
            .single();

        if (sessionError) throw sessionError;

        if (!sessionData) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (sessionData.uuid !== uuid) {
            return res.status(403).json({ error: 'Only the owner can kick members' });
        }

        // Remove the member from the session
        const { data, error } = await supabase
            .from('members')
            .delete()
            .eq('uuid', member_uuid)
            .eq('session_id', session_id);

        if (error) throw error;

        if (!data || data.length === 0) {
            return res.status(404).json({ error: 'Member not found in the session' });
        }

        res.status(200).json({ message: 'Member kicked successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET endpoint to search for sessions with filters
router.get('/search', async (req, res) => {
    const { keyword, onlineSession, required_level, date } = req.query;

    try {
        // Build the query dynamically based on the provided filters
        let query = supabase.from('session').select('*');

        // Keyword search in subject, sub_topic, and description
        if (keyword) {
            query = query.or(
                `subject.ilike.%${keyword}%,sub_topic.ilike.%${keyword}%,description.ilike.%${keyword}%`
            );
        }

        // Filter by session type (Online or In-person)
        if (onlineSession) {
            const sessionType = onlineSession === 'true' ? 'Online' : 'In-person';
            query = query.eq('session_type', sessionType);
        }

        // Filter by required level
        if (required_level) {
            query = query.eq('required_level', required_level);
        }

        // Filter by date
        if (date) {
            query = query.eq('date', date);
        }

        // Execute the query
        const { data: sessions, error } = await query;

        if (error) throw error;

        res.status(200).json({ sessions });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET endpoint to fetch a specific session by ID and user UUID
router.get('/:session_id/:uuid', async (req, res) => {
    const { session_id, uuid } = req.params;

    try {
        // Fetch the session details
        const { data: sessionData, error: sessionError } = await supabase
            .from('session')
            .select('*')
            .eq('id', session_id)
            .single(); // Get a single session

        if (sessionError) throw sessionError;

        if (!sessionData) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Fetch the user's membership details in the session
        const { data: memberData, error: memberError } = await supabase
            .from('members')
            .select('role')
            .eq('uuid', uuid)
            .eq('session_id', session_id)
            .single(); // Get a single member

        if (memberError) throw memberError;

        if (!memberData) {
            return res.status(403).json({ error: 'User is not a member of this session' });
        }

        // Combine session details with the user's role
        const response = {
            session: sessionData,
            user_role: memberData
        };

        res.status(200).json(response);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET endpoint to fetch sessions with members and user details
router.get('/sessions-open', async (req, res) => {
    try {
        // Fetch all sessions
        const { data: sessions, error: sessionError } = await supabase
            .from('session')
            .select('*');

        if (sessionError) throw sessionError;

        if (!sessions || sessions.length === 0) {
            return res.status(404).json({ error: 'No sessions found' });
        }

        // Fetch members and their user details for each session
        const sessionsWithMembers = await Promise.all(
            sessions.map(async (session) => {
                // Fetch members for the session
                const { data: members, error: memberError } = await supabase
                    .from('members')
                    .select('uuid')
                    .eq('session_id', session.id);

                if (memberError) throw memberError;

                // Fetch user details for each member
                const membersWithUserDetails = await Promise.all(
                    members.map(async (member) => {
                        const { data: user, error: userError } = await supabase
                            .from('user')
                            .select('avatar, email, fullname, uuid, bolt')
                            .eq('uuid', member.uuid)
                            .single();

                        if (userError) throw userError;

                        return {
                            uuid: member.uuid,
                            ...user
                        };
                    })
                );

                return {
                    ...session,
                    members: membersWithUserDetails
                };
            })
        );

        res.status(200).json({ sessions: sessionsWithMembers });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;