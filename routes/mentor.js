const express = require('express');
const router = express.Router();
import supabase from '../supabase';


// Endpoint pour récupérer tous les mentors et leurs utilisateurs associés
router.get('/', async (req, res) => {
  try {
    // Récupérer tous les mentors depuis la table "mentor"
    const { data: mentors, error: mentorError } = await supabase
      .from('mentor')
      .select('*');

    if (mentorError) {
      return res.status(500).json({ error: 'Erreur lors de la récupération des mentors', details: mentorError });
    }

    // Récupérer les utilisateurs associés pour chaque mentor
    const mentorsWithUsers = await Promise.all(
      mentors.map(async (mentor) => {
        const { data: user, error: userError } = await supabase
          .from('user')
          .select('*')
          .eq('uuid', mentor.uuid)
          .single();

        if (userError) {
          return { ...mentor, user: null, userError };
        }

        return { ...mentor, user };
      })
    );

    res.status(200).json(mentorsWithUsers);
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

module.exports = router;