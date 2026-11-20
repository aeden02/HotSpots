const express = require('express');

module.exports = (db) => {
    const router = express.Router();

    router.post('/category', async (req, res) => {
        const { city, category } = req.body ?? {};
        if (typeof city !== 'string' || !city.trim() || typeof category !== 'string' || !category.trim()) return res.status(400).json({ error: 'City and category are required.' });
        const spots = await db.collection('spots').find({ city, category }).toArray();
        res.json(spots);
    });

    router.post('/tags', async (req, res) => {
        const { city, tags } = req.body ?? {};
        const cleanTags = Array.isArray(tags) ? tags.filter(t => typeof t === 'string' && t.trim()).map(t => t.trim()) : [];
        if (typeof city !== 'string' || !city.trim() || !cleanTags.length) return res.status(400).json({ error: 'City and at least one tag are required.' });
        const spots = await db.collection('spots').find({ city, tags: { $in: cleanTags } }).toArray();
        res.json(spots);
    });

    return router;
};