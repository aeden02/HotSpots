const express = require('express');
const { ObjectId } = require('mongodb');
const crypto = require('crypto');

const SLUG_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

function makeSlug(title) {
    const base = title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'spot';
    let suffix = '';
    for (let i = 0; i < 6; i++) suffix += SLUG_CHARS[crypto.randomInt(SLUG_CHARS.length)];
    return `${base}-${suffix}`;
}

module.exports = (db) => {
    const router = express.Router();

    router.get('/getSpot/:slug', async (req, res) => {
        const spot = await db.collection('spots').findOne({ id: req.params.slug });
        if (!spot) return res.status(404).json({ error: 'Spot not found.' });
        res.json(spot);
    });

    router.get('/getSpotsByCity/:city', async (req, res) => {
        const spots = await db.collection('spots').find({ city: req.params.city }).toArray();
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

    return router;
};
