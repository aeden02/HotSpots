const request = require('supertest');
const { setupTestDb, insertUser, loginAs, makeSpot } = require('./helpers');

jest.mock('../tools/osmSpots', () => jest.fn(async () => []));

describe('bookmark routes', () => {
    const ctx = setupTestDb();

    const bookmarks = async (userId) => (await ctx.db.collection('users').findOne({ _id: userId })).bookmarks;

    describe('POST /bookmark/:slug', () => {
        test('adds the spot to the logged-in user\'s bookmarks', async () => {
            await ctx.db.collection('spots').insertOne(makeSpot({ id: 'cafe' }));
            const user = await insertUser(ctx.db);
            const agent = await loginAs(ctx.app, user);
            const res = await agent.post('/api/v1/bookmark/cafe');
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ message: 'Spot bookmarked.' });
            expect(await bookmarks(user._id)).toEqual(['cafe']);
        });

        test('does not add the same spot twice', async () => {
            await ctx.db.collection('spots').insertOne(makeSpot({ id: 'cafe' }));
            const user = await insertUser(ctx.db);
            const agent = await loginAs(ctx.app, user);
            await agent.post('/api/v1/bookmark/cafe');
            const res = await agent.post('/api/v1/bookmark/cafe');
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ message: 'Spot already bookmarked.' });
            expect(await bookmarks(user._id)).toEqual(['cafe']);
        });

        test('keeps earlier bookmarks', async () => {
            await ctx.db.collection('spots').insertMany([makeSpot({ id: 'a' }), makeSpot({ id: 'b' })]);
            const user = await insertUser(ctx.db);
            const agent = await loginAs(ctx.app, user);
            await agent.post('/api/v1/bookmark/a');
            await agent.post('/api/v1/bookmark/b');
            expect(await bookmarks(user._id)).toEqual(['a', 'b']);
        });

        test('only changes the logged-in user', async () => {
            await ctx.db.collection('spots').insertOne(makeSpot({ id: 'cafe' }));
            const user = await insertUser(ctx.db);
            const other = await insertUser(ctx.db, { username: 'bob', email: 'bob@example.com' });
            const agent = await loginAs(ctx.app, user);
            await agent.post('/api/v1/bookmark/cafe');
            expect(await bookmarks(other._id)).toEqual([]);
        });

        test('returns 401 when not logged in', async () => {
            await ctx.db.collection('spots').insertOne(makeSpot({ id: 'cafe' }));
            const res = await request(ctx.app).post('/api/v1/bookmark/cafe');
            expect(res.status).toBe(401);
        });

        test('returns 404 for an unknown spot', async () => {
            const user = await insertUser(ctx.db);
            const agent = await loginAs(ctx.app, user);
            const res = await agent.post('/api/v1/bookmark/missing');
            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Spot not found.');
            expect(await bookmarks(user._id)).toEqual([]);
        });

        test('returns 404 if the logged-in user no longer exists', async () => {
            await ctx.db.collection('spots').insertOne(makeSpot({ id: 'cafe' }));
            const user = await insertUser(ctx.db);
            const agent = await loginAs(ctx.app, user);
            await ctx.db.collection('users').deleteOne({ _id: user._id });
            const res = await agent.post('/api/v1/bookmark/cafe');
            expect(res.status).toBe(404);
            expect(res.body.error).toBe('User not found.');
        });
    });
});
