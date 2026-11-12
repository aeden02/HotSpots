const express = require('express');
const bcrypt = require('bcrypt');
const { ObjectId } = require('mongodb');

module.exports = (db) => {
    const router = express.Router();

    router.post('/createAccount', async (req, res) => {
        const { username, email, password, city } = req.body;
        if (![username, email, password, city].every(v => typeof v === 'string' && v.trim())) {
            return res.status(400).json({ error: 'Username, email, password, and city are required.' });
        }
        const users = db.collection('users');
        const existing = await users.findOne({ $or: [{ username }, { email }] });
        if (existing) {
            const field = existing.username === username ? 'Username' : 'Email';
            return res.status(409).json({ error: `${field} is already taken.` });
        }
        await users.insertOne({username,email,city,bookmarks: [],isAdmin: false,password: await bcrypt.hash(password, 10)});
        await db.collection('cities').updateOne({ name: city }, { $setOnInsert: { name: city, spots: [] } }, { upsert: true });
        res.status(201).json({ message: 'Account created.' });
    });

    router.post('/login', async (req, res) => {
        const { email, password } = req.body;
        const user = await db.collection('users').findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Invalid email or password.' });
        req.session.userId = user._id.toString();
        req.session.role = user.isAdmin ? 'admin' : 'user';
        res.json({ message: 'Login successful.' });
    });

    router.post('/logout', (req, res) => {
        req.session.destroy(() => res.json({
            message: 'Logout successful.'
        }));
    });

    router.get('/me', async (req, res) => {
        if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
        const user = await db.collection('users').findOne({ _id: new ObjectId(req.session.userId) },{ projection: { password: 0 } });
        res.json(user);
    });

    router.get('/getUser/:username', async (req, res) => {
        const user = await db.collection('users').findOne(
            { username: req.params.username },
            { projection: { password: 0 } }
        );
        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }
        res.json(user);
    });

    router.get('/getAllUsers', async (req, res) => {
        if (req.session.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
        const users = await db.collection('users').find({}, { projection: { password: 0 } }).toArray();
        res.json(users);
    });

    return router;
};