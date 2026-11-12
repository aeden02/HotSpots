const express = require('express');
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
const app = express();
require('dotenv').config();
const session = require('express-session');

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

const client = new MongoClient(process.env.MONGODB_URI);
const db = client.db('hotspots');
async function connectToDatabase() {
    try {
        await client.connect();
        console.log("You successfully connected to MongoDB!");
        return client;
    } catch (err) {
        console.dir(err);
    }
}

app.use(express.json());

const routesDir = path.join(__dirname, 'routes');
for (const file of fs.readdirSync(routesDir)) {
    if (!file.endsWith('.js')) continue;
    const name = path.basename(file, '.js');
    app.use(`/api/v1/${name}`, require(path.join(routesDir, file))(db));
}

app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

connectToDatabase().then(() => {
    app.listen(3000, () => {
        console.log(`Server running on http://localhost:3000`);
    });
});


async function shutdown() {
    await client.close();
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);