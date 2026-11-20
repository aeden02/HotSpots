const request = require('supertest');
const bcrypt = require('bcrypt');
const { setupTestDb, insertUser, loginAs, waitFor } = require('./helpers');

jest.mock('../tools/osmSpots', () => jest.fn(async () => []));
const getOsmSpots = require('../tools/osmSpots');

describe('users routes', () => {
    const ctx = setupTestDb();

    describe('POST /users/createAccount', () => {
        const body = { username: 'bob', email: 'bob@example.com', password: 'secret123', city: 'Fort Smith, AR' };

        // createAccount kicks off city seeding in the background; wait for it so it doesn't leak into the next test.
        const waitForSeeding = () => waitFor(async () => {
            const city = await ctx.db.collection('cities').findOne({ name: body.city });
            return city && !city.seeding && getOsmSpots.mock.calls.length > 0;
        });

        beforeEach(() => getOsmSpots.mockClear());

        test('creates a member account with a hashed password', async () => {
            const res = await request(ctx.app).post('/api/v1/users/createAccount').send(body);
            expect(res.status).toBe(201);
            expect(res.body).toEqual({ message: 'Account created.' });

            const user = await ctx.db.collection('users').findOne({ username: 'bob' });
            expect(user).toMatchObject({ email: 'bob@example.com', city: 'Fort Smith, AR', isAdmin: false, bookmarks: [], recentlyViewed: [] });
            expect(user.password).not.toBe('secret123');
            expect(await bcrypt.compare('secret123', user.password)).toBe(true);
            await waitForSeeding();
        });

        test('registers the city and seeds it', async () => {
            await request(ctx.app).post('/api/v1/users/createAccount').send(body);
            await waitForSeeding();
            const city = await ctx.db.collection('cities').findOne({ name: 'Fort Smith, AR' });
            expect(city).toMatchObject({ name: 'Fort Smith, AR', spots: [] });
            expect(getOsmSpots).toHaveBeenCalledWith('Fort Smith, AR');
        });

        test.each(['username', 'email', 'password', 'city'])('returns 400 when %s is missing', async (field) => {
            const res = await request(ctx.app).post('/api/v1/users/createAccount').send({ ...body, [field]: undefined });
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/required/);
        });

        test('returns 400 when a field is only whitespace', async () => {
            const res = await request(ctx.app).post('/api/v1/users/createAccount').send({ ...body, username: '   ' });
            expect(res.status).toBe(400);
        });

        test.each(['not-an-email', 'missing-at.com', 'no-domain@', '@no-user.com', 'no-tld@example', 'has space@example.com'])(
            'returns 401 "Invalid email" for %s and creates nothing', async (email) => {
                const res = await request(ctx.app).post('/api/v1/users/createAccount').send({ ...body, email });
                expect(res.status).toBe(401);
                expect(res.body).toEqual({ error: 'Invalid email' });
                expect(await ctx.db.collection('users').countDocuments()).toBe(0);
                expect(getOsmSpots).not.toHaveBeenCalled();
            });

        test('accepts a normal email like first.last+tag@sub.example.co', async () => {
            const res = await request(ctx.app).post('/api/v1/users/createAccount').send({ ...body, email: 'first.last+tag@sub.example.co' });
            expect(res.status).toBe(201);
            await waitForSeeding();
        });

        test('returns 409 when the username is taken', async () => {
            await insertUser(ctx.db, { username: 'bob', email: 'other@example.com' });
            const res = await request(ctx.app).post('/api/v1/users/createAccount').send(body);
            expect(res.status).toBe(409);
            expect(res.body.error).toBe('Username is already taken.');
        });

        test('returns 409 when the email is taken', async () => {
            await insertUser(ctx.db, { username: 'someone', email: 'bob@example.com' });
            const res = await request(ctx.app).post('/api/v1/users/createAccount').send(body);
            expect(res.status).toBe(409);
            expect(res.body.error).toBe('Email is already taken.');
        });
    });

    describe('POST /users/login', () => {
        test('logs in with correct credentials and starts a session', async () => {
            const user = await insertUser(ctx.db);
            const agent = request.agent(ctx.app);
            const res = await agent.post('/api/v1/users/login').send({ email: user.email, password: user.plainPassword });
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ message: 'Login successful.' });
            expect(res.headers['set-cookie']).toBeDefined();
            const me = await agent.get('/api/v1/users/me');
            expect(me.status).toBe(200);
        });

        test('returns 401 for a wrong password', async () => {
            const user = await insertUser(ctx.db);
            const res = await request(ctx.app).post('/api/v1/users/login').send({ email: user.email, password: 'wrong' });
            expect(res.status).toBe(401);
            expect(res.body.error).toBe('Invalid email or password.');
        });

        test('returns 401 for an unknown email', async () => {
            const res = await request(ctx.app).post('/api/v1/users/login').send({ email: 'nobody@example.com', password: 'x' });
            expect(res.status).toBe(401);
        });
    });

    describe('POST /users/logout', () => {
        test('ends the session', async () => {
            const agent = await loginAs(ctx.app, await insertUser(ctx.db));
            const res = await agent.post('/api/v1/users/logout');
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ message: 'Logout successful.' });
            expect((await agent.get('/api/v1/users/me')).status).toBe(401);
        });

        test('works even when not logged in', async () => {
            const res = await request(ctx.app).post('/api/v1/users/logout');
            expect(res.status).toBe(200);
        });
    });

    describe('GET /users/me', () => {
        test('returns the logged-in user without the password', async () => {
            const user = await insertUser(ctx.db);
            const agent = await loginAs(ctx.app, user);
            const res = await agent.get('/api/v1/users/me');
            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({ username: 'alice', email: 'alice@example.com', _id: user._id.toString() });
            expect(res.body.password).toBeUndefined();
        });

        test('returns 401 when not logged in', async () => {
            const res = await request(ctx.app).get('/api/v1/users/me');
            expect(res.status).toBe(401);
        });
    });

    describe('GET /users/getUser/:username', () => {
        test('returns the user without the password', async () => {
            await insertUser(ctx.db);
            const res = await request(ctx.app).get('/api/v1/users/getUser/alice');
            expect(res.status).toBe(200);
            expect(res.body.username).toBe('alice');
            expect(res.body.password).toBeUndefined();
        });

        test('returns 404 for an unknown user', async () => {
            const res = await request(ctx.app).get('/api/v1/users/getUser/ghost');
            expect(res.status).toBe(404);
            expect(res.body.error).toBe('User not found');
        });
    });

    describe('GET /users/getAllUsers', () => {
        test('returns every user (without passwords) to an admin', async () => {
            const admin = await insertUser(ctx.db, { username: 'admin', email: 'admin@example.com', isAdmin: true });
            await insertUser(ctx.db);
            const agent = await loginAs(ctx.app, admin);
            const res = await agent.get('/api/v1/users/getAllUsers');
            expect(res.status).toBe(200);
            expect(res.body.map(u => u.username).sort()).toEqual(['admin', 'alice']);
            expect(res.body.every(u => u.password === undefined)).toBe(true);
        });

        test('returns 403 to a regular member', async () => {
            const agent = await loginAs(ctx.app, await insertUser(ctx.db));
            const res = await agent.get('/api/v1/users/getAllUsers');
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Admins only.');
        });

        test('returns 403 when not logged in', async () => {
            const res = await request(ctx.app).get('/api/v1/users/getAllUsers');
            expect(res.status).toBe(403);
        });
    });
});
