const express = require('express');
const { ObjectId } = require('mongodb');

module.exports = (db) => {
    const router = express.Router();

    router.post('/', async (req, res) => {
        if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
        const { spotId, reason } = req.body ?? {};
        if (typeof spotId !== 'string' || !spotId.trim()) return res.status(400).json({ error: 'Spot id is required.' });
        if (typeof reason !== 'string' || !reason.trim()) return res.status(400).json({ error: 'Report reason is required.' });

        const spot = await db.collection('spots').findOne({ id: spotId });
        if (!spot) return res.status(404).json({ error: 'Spot not found.' });
        const result = await db.collection('reports').insertOne({
            spotId: spot.id,
            reason: reason.trim(),
            reporterId: new ObjectId(req.session.userId),
            createdAt: new Date(),
        });
        res.status(201).json({ message: 'Spot reported.', reportId: result.insertedId });
    });

    router.get('/', async (req, res) => {
        if (req.session.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
        res.json(await db.collection('reports').find({}).toArray());
    });

    router.delete('/:id', async (req, res) => {
        if (req.session.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
        if (!ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'Report not found.' });
        const result = await db.collection('reports').deleteOne({ _id: new ObjectId(req.params.id) });
        if (!result.deletedCount) return res.status(404).json({ error: 'Report not found.' });
        res.json({ message: 'Report ignored.' });
    });

    router.delete('/:id/spot', async (req, res) => {
        if (req.session.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
        if (!ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'Report not found.' });
        const reports = db.collection('reports');
        const report = await reports.findOne({ _id: new ObjectId(req.params.id) });
        if (!report) return res.status(404).json({ error: 'Report not found.' });

        const spot = await db.collection('spots').findOne({ id: report.spotId });
        if (spot) {
            await db.collection('spots').deleteOne({ _id: spot._id });
            await db.collection('cities').updateOne({ name: spot.city }, { $pull: { spots: spot.id } });
            await db.collection('users').updateMany({}, { $pull: { bookmarks: spot.id, recentlyViewed: spot.id } });
        }
        await reports.deleteMany({ spotId: report.spotId });
        res.json({ message: spot ? 'Report reviewed and spot removed.' : 'Report removed; spot was already missing.' });
    });

    return router;
};
