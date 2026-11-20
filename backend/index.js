const express = require('express');
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
const app = express();
require('dotenv').config();
const session = require('express-session');
const { spawn } = require('node:child_process');

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

const client = new MongoClient(process.env.MONGODB_URI);
const db = client.db('hotspots');

// When AI_URL is set (e.g. in Docker Compose), the ranker runs in its own container.
// Otherwise start it locally from ai/.venv.
if (!process.env.AI_URL) {
    const aiDirectory = path.resolve(__dirname, '../ai');
    const python = path.join(aiDirectory, '.venv', 'Scripts', 'python.exe');
    const ranker = spawn(python, ['-u', path.join(aiDirectory, 'server.py')], {
        cwd: aiDirectory,
        stdio: 'inherit',
    });

    ranker.on('error', (error) => {
        console.error('Could not start the Python ranker:', error.message);
    });

    process.on('exit', () => {
        if (ranker.pid && ranker.exitCode === null) {
            ranker.kill();
        }
    });
}


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
    const port = process.env.PORT || 4000;
    app.listen(port, () => {
        console.log(`Server running on http://localhost:${port}`);
    });
});


async function shutdown() {
    await client.close();
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);