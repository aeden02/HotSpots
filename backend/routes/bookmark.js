const express = require('express');
const { ObjectId } = require('mongodb');

module.exports = (db) => {
    const router = express.Router();

    router.post('/:slug', async (req, res) => {
        if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
        const spot = await db.collection('spots').findOne({ id: req.params.slug });
        if (!spot) return res.status(404).json({ error: 'Spot not found.' });
        const result = await db.collection('users').updateOne({ _id: new ObjectId(req.session.userId) }, { $addToSet: { bookmarks: spot.id } });
        if (!result.matchedCount) return res.status(404).json({ error: 'User not found.' });
        res.json({ message: result.modifiedCount ? 'Spot bookmarked.' : 'Spot already bookmarked.' });
    });

    return router;
};
