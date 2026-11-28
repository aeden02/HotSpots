const express = require('express');

const AI_URL = (process.env.AI_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');

async function requestAi(endpoint, body, timeout) {
    const response = await fetch(`${AI_URL}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeout),
    });
    if (!response.ok) throw new Error(`AI ${endpoint} service responded with ${response.status}`);
    return response.json();
}

module.exports = (db) => {
    const router = express.Router();

    router.post('/tags', async (req, res) => {
        const { title, description } = req.body ?? {};
        if ((title !== undefined && typeof title !== 'string')
            || (description !== undefined && typeof description !== 'string')
            || ![title, description].some(value => typeof value === 'string' && value.trim())) {
            return res.status(400).json({ error: 'A title or description is required.' });
        }

        try {
            res.json(await requestAi('tags', { title, description }, 10000));
        } catch (err) {
            console.error('AI tagger unavailable:', err.message);
            res.status(503).json({ error: 'AI tagging is unavailable.' });
        }
    });

    router.post('/themes', async (req, res) => {
        const { city } = req.body ?? {};
        if (typeof city !== 'string' || !city.trim()) {
            return res.status(400).json({ error: 'City is required.' });
        }

        const spots = await db.collection('spots').find({ city }).toArray();
        const catalog = spots.map(({ id, title, description, tags }) => ({ id, title, description, tags }));
        try {
            res.json(await requestAi('themes', { spots: catalog }, 65000));
        } catch (err) {
            console.error('AI theme generator unavailable:', err.message);
            res.status(503).json({ error: 'AI themes are unavailable.' });
        }
    });

    return router;
};
