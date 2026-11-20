// Shared test setup: an in-memory MongoDB and an Express app wired up the same way index.js does it
// (session + JSON body + every routes/*.js file mounted at /api/v1/<filename>), but without
// connecting to the real database or starting the Python ranker.
const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const request = require('supertest');
const { MongoClient } = require('mongodb');
const { MongoMemoryServer } = require('mongodb-memory-server');

const routesDir = path.join(__dirname, '..', 'routes');

function makeApp(db) {
    const app = express();
    app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
    app.use(express.json());
    for (const file of fs.readdirSync(routesDir)) {
        if (!file.endsWith('.js')) continue;
        app.use(`/api/v1/${path.basename(file, '.js')}`, require(path.join(routesDir, file))(db));
    }
    app.use((req, res) => res.status(404).json({ error: 'Not found' }));
    return app;
}

// Call inside a describe() block. Returns an object whose db/app fields are filled in before each test.
function setupTestDb() {
    const ctx = {};
    let mongod;
    let client;

    beforeAll(async () => {
        mongod = await MongoMemoryServer.create();
        // MongoDB driver 7 loads `os` with a dynamic import(), which Jest blocks; hand it the module directly.
        client = new MongoClient(mongod.getUri(), { runtimeAdapters: { os: require('os') } });
        await client.connect();
        ctx.db = client.db('hotspots-test');
        ctx.app = makeApp(ctx.db);
    });

    afterEach(async () => {
        const collections = await ctx.db.collections();
        await Promise.all(collections.map(c => c.deleteMany({})));
    });

    afterAll(async () => {
        await client?.close();
        await mongod?.stop();
    });

    return ctx;
}

async function insertUser(db, overrides = {}) {
    const password = overrides.password ?? 'password123';
    const user = {
        username: 'alice',
        email: 'alice@example.com',
        city: 'Fort Smith, AR',
        bookmarks: [],
        recentlyViewed: [],
        isAdmin: false,
        ...overrides,
        password: await bcrypt.hash(password, 4),
    };
    const { insertedId } = await db.collection('users').insertOne(user);
    return { ...user, _id: insertedId, plainPassword: password };
}

// Returns a supertest agent that keeps the session cookie, already logged in as the given user.
async function loginAs(app, user) {
    const agent = request.agent(app);
    const res = await agent.post('/api/v1/users/login').send({ email: user.email, password: user.plainPassword });
    if (res.status !== 200) throw new Error(`Login failed in test setup: ${res.status} ${JSON.stringify(res.body)}`);
    return agent;
}

function makeSpot(overrides = {}) {
    return {
        id: 'spot-' + Math.random().toString(36).slice(2, 8),
        title: 'Test Spot',
        description: 'A test spot',
        banner: null,
        category: 'food',
        address: '1 Main St',
        tags: [],
        city: 'Fort Smith, AR',
        createdBy: null,
        ratings: [],
        events: [],
        ...overrides,
    };
}

async function waitFor(check, timeoutMs = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (await check()) return;
        await new Promise(r => setTimeout(r, 20));
    }
    throw new Error('waitFor timed out');
}

module.exports = { makeApp, setupTestDb, insertUser, loginAs, makeSpot, waitFor };
