const express = require('express');
const { ObjectId } = require('mongodb');
const crypto = require('crypto');
const getOsmSpots = require('../tools/osmSpots');

const SLUG_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

function makeSlug(title) {
    const base = title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'spot';
    let suffix = '';
    for (let i = 0; i < 6; i++) suffix += SLUG_CHARS[crypto.randomInt(SLUG_CHARS.length)];
    return `${base}-${suffix}`;
}

async function seedCity(db, cityName) {
    const cities = db.collection('cities');
    const city = await cities.findOneAndUpdate({ name: cityName, spots: { $size: 0 }, seeding: { $ne: true } },{ $set: { seeding: true } });
    if (!city) return null;
    try {
        const osmSpots = await getOsmSpots(city.name);
        const docs = osmSpots.map(s => ({ id: makeSlug(s.title), ...s, city: city.name, createdBy: null, ratings: [], events: [] }));
        if (docs.length) await db.collection('spots').insertMany(docs);
        await cities.updateOne({ _id: city._id }, { $push: { spots: { $each: docs.map(d => d.id) } } });
        return docs.map(d => d.id);
    } finally {
        await cities.updateOne({ _id: city._id }, { $unset: { seeding: '' } });
    }
}

module.exports = (db) => {
    const router = express.Router();

    router.post('/seedCity', async (req, res) => {
        const { city } = req.body;
        if (typeof city !== 'string' || !city.trim()) return res.status(400).json({ error: 'City is required.' });
        const existing = await db.collection('cities').findOne({ name: city });
        if (!existing) return res.status(404).json({ error: 'City not found.' });
        try {
            const ids = await seedCity(db, city);
            if (!ids) return res.status(409).json({ error: 'City already has spots.' });
            res.status(201).json({ message: `Added ${ids.length} spots.`, ids });
        } catch (err) {
            res.status(502).json({ error: err.message });
        }
    });

    router.get('/getSpot/:slug', async (req, res) => {
        const spot = await db.collection('spots').findOne({ id: req.params.slug });
        if (!spot) return res.status(404).json({ error: 'Spot not found.' });
        if (req.session.userId) {
            await db.collection('users').updateOne({ _id: new ObjectId(req.session.userId) }, [{$set: {recentlyViewed: {$slice: [{ $concatArrays: [[spot.id], { $filter: { input: { $ifNull: ['$recentlyViewed', []] }, cond: { $ne: ['$$this', spot.id] } } }] }, 5]}}}]);
        }
        res.json(spot);
    });

    router.get('/getSpotsByCity/:city', async (req, res) => {
        const spots = await db.collection('spots').find({ city: req.params.city }).toArray();
        res.json(spots);
    });

    router.post('/getSpotsByCategory', async (req, res) => {
        const { category, city } = req.body ?? {};
        if (typeof category !== 'string' || !category.trim() || typeof city !== 'string' || !city.trim()) {
            return res.status(400).json({ error: 'Category and city are required.' });
        }
        const spots = await db.collection('spots').find({ city, category }).toArray();
        res.json(spots);
    });

    router.post('/createSpot', async (req, res) => {
        if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
        const { title, description, banner, category, address } = req.body;
        const tags = Array.isArray(req.body.tags) ? req.body.tags : [];
        if (typeof title !== 'string' || !title.trim()) return res.status(400).json({ error: 'Title is required.' });
        const user = await db.collection('users').findOne({ _id: new ObjectId(req.session.userId) });
        const cities = db.collection('cities');
        const city = await cities.findOne({ name: user.city });
        if (!city) return res.status(403).json({ error: 'Your city is not a registered city.' });
        const id = makeSlug(title);
        await db.collection('spots').insertOne({id,title,description,banner,category,address,tags,city: city.name,createdBy: user._id,ratings: [],events: []});
        await cities.updateOne({ _id: city._id }, { $push: { spots: id } });
        res.status(201).json({ message: 'Spot created.', id });
    });

    router.patch('/updatePost', async (req, res) => {
        if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
        const body = req.body ?? {};
        if (typeof body.slug !== 'string' || !body.slug.trim()) return res.status(400).json({ error: 'Spot slug is required.' });
        const spot = await db.collection('spots').findOne({ id: body.slug });
        if (!spot) return res.status(404).json({ error: 'Spot not found.' });
        if (!spot.createdBy || spot.createdBy.toString() !== req.session.userId) return res.status(403).json({ error: 'You can only change spots you posted.' });
        const updates = {};
        for (const field of ['title', 'description', 'banner', 'category', 'address']) {
            if (body[field] !== undefined) updates[field] = body[field];
        }
        if (body.tags !== undefined) {
            if (!Array.isArray(body.tags)) return res.status(400).json({ error: 'Tags must be an array.' });
            updates.tags = body.tags;
        }
        if ('title' in updates && (typeof updates.title !== 'string' || !updates.title.trim())) {
            return res.status(400).json({ error: 'Title cannot be empty.' });
        }
        if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update.' });
        await db.collection('spots').updateOne({ _id: spot._id }, { $set: updates });
        res.json({ message: 'Spot updated.', spot: { ...spot, ...updates } });
    });

    router.delete('/deletePost/:slug', async (req, res) => {
        if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
        const spot = await db.collection('spots').findOne({ id: req.params.slug });
        if (!spot) return res.status(404).json({ error: 'Spot not found.' });
        if (!spot.createdBy || spot.createdBy.toString() !== req.session.userId) return res.status(403).json({ error: 'You can only change spots you posted.' });
        await db.collection('spots').deleteOne({ _id: spot._id });
        await db.collection('cities').updateOne({ name: spot.city }, { $pull: { spots: spot.id } });
        await db.collection('users').updateMany({}, { $pull: { bookmarks: spot.id, recentlyViewed: spot.id } });
        res.json({ message: 'Spot deleted.' });
    });

    router.get('/getCities', async (req, res) => {
        const cities = await db.collection('cities').find({}).toArray();
        res.json(cities);
    });

    router.get('/getCityById/:id', async (req, res) => {
        if (!ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'City not found.' });
        const city = await db.collection('cities').findOne({ _id: new ObjectId(req.params.id) });
        if (!city) return res.status(404).json({ error: 'City not found.' });
        res.json(city);
    });

    router.get('/searchSpots', async (req,res) => {
        const { query, city } = req.query;
        if (!query || !city) return res.status(400).json({ error: 'Query and city are required.' });
        const spots = await db.collection('spots').find({city}).toArray();
        const aiUrl = process.env.AI_URL || "http://127.0.0.1:8000";
        const rankedSpots = await fetch(`${aiUrl}/rank`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ query, spots: spots.map(({ id, title, description }) => ({ id, title, description })) })});
        if (!rankedSpots.ok) return res.status(500).json({ error: 'Failed to rank spots.' });
        const {matches} = await rankedSpots.json();
        const spotsById = new Map(spots.map(spot => [spot.id, spot]));
        res.json(matches.map( ({id,score}) => ({...spotsById.get(id), score}) ));
    });

    return router;
};

module.exports.seedCity = seedCity;