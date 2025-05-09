const express = require('express');
const router = express.Router();
const supabase = require('../supabase'); // Import Supabase client



// Real-time subscription to the message table for specific sessions
router.get('/subscribe/:uuid', async (req, res) => {
    const { uuid } = req.params; // User's UUID

    try {
        // Fetch all sessions the user is a member of
        const { data: memberData, error: memberError } = await supabase
            .from('members')
            .select('session_id')
            .eq('uuid', uuid);

        if (memberError) throw memberError;

        if (!memberData || memberData.length === 0) {
            return res.status(404).json({ error: 'User is not a member of any sessions' });
        }

        // Extract session IDs
        const sessionIds = memberData.map((member) => member.session_id);

        // Set up a real-time subscription to the message table for specific sessions
        const messageSubscription = supabase
            .channel('realtime:public:message')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'message',
                    filter: `session=in.(${sessionIds.join(',')})` // Filter messages by session IDs
                },
                (payload) => {
                    console.log('Real-time message received:', payload.new);
                    // Send the new message to the client
                    res.write(`data: ${JSON.stringify(payload.new)}\n\n`);
                }
            )
            .subscribe();

        // Keep the connection open for real-time updates
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Handle client disconnection
        req.on('close', () => {
            console.log('Client disconnected');
            supabase.removeChannel(messageSubscription);
            res.end();
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET endpoint to fetch all messages for a specific session
router.get('/:session_id', async (req, res) => {
    const { session_id } = req.params; // Session ID

    try {
        // Fetch all messages for the given session
        const { data: messages, error } = await supabase
            .from('message')
            .select('*')
            .eq('session', session_id)
            .order('created_at', { ascending: true }); // Order messages by creation time

        if (error) throw error;

        if (!messages || messages.length === 0) {
            return res.status(404).json({ error: 'No messages found for this session' });
        }

        res.status(200).json({ messages });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST endpoint to send a message and insert it into the database
router.post('/', async (req, res) => {
    const { content, uuid, session } = req.body; // Extract message content, user UUID, and session ID from the request body

    try {
        // Insert the new message into the database
        const { data, error } = await supabase
            .from('message')
            .insert([{ content, uuid, session }])
            .select('*') // Return the inserted message
            .single(); // Get the inserted message as a single object
            
        if (error) throw error;

        res.status(201).json({ message: 'Message sent successfully', data: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;