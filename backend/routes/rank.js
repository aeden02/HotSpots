const express = require('express');

// In Docker Compose, AI_URL points at the ai container (http://ai:8000).
const RANKER_URL = `${process.env.AI_URL || 'http://127.0.0.1:8000'}/rank`;

module.exports = (db) => {
    const router = express.Router();

    router.post('/rank', async (req, res) => {
        const { query, city } = req.body ?? {};
        if (typeof query !== 'string' || !query.trim() || typeof city !== 'string' || !city.trim()) {
            return res.status(400).json({ error: 'Query and city are required.' });
        }
        const spots = await db.collection('spots').find({ city }).toArray();

        let matches;
        try {
            const response = await fetch(RANKER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, spots: spots.map(({ id, title, description }) => ({ id, title, description })) }),
                signal: AbortSignal.timeout(10000),
            });
            if (!response.ok) throw new Error(`Ranker responded with ${response.status}`);
            ({ matches } = await response.json());
        } catch (err) {
            console.error('AI ranker unavailable:', err.message);
            return res.status(503).json({ error: 'AI search is unavailable.' });
        }

        const spotsById = new Map(spots.map(spot => [spot.id, spot]));
        res.json(matches.filter(({ id }) => spotsById.has(id)).map(({ id, score }) => ({ ...spotsById.get(id), score })));
    });

    return router;
};
