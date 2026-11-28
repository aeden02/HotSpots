const request = require('supertest');
const { ObjectId } = require('mongodb');
const { setupTestDb, insertUser, loginAs, makeSpot } = require('./helpers');

const CITY = 'Fort Smith, AR';

describe('report routes', () => {
    const ctx = setupTestDb();

    afterEach(() => jest.restoreAllMocks());

    const addSpotAndCity = async (spot = makeSpot({ id: 'reported' })) => {
        await ctx.db.collection('cities').insertOne({ name: CITY, spots: [spot.id] });
        await ctx.db.collection('spots').insertOne(spot);
    };

    const addReport = (spotId = 'reported') => ctx.db.collection('reports').insertOne({
        spotId,
        reason: 'Inaccurate information',
        reporterId: new ObjectId(),
        createdAt: new Date(),
    });

    test('requires a logged-in user and valid spot/reason to create a report', async () => {
        await addSpotAndCity();
        const anonymous = await request(ctx.app).post('/api/v1/report').send({ spotId: 'reported', reason: 'Reason' });
        expect(anonymous.status).toBe(401);

        const agent = await loginAs(ctx.app, await insertUser(ctx.db));
        expect((await agent.post('/api/v1/report').send({ spotId: 'reported', reason: '  ' })).status).toBe(400);
        expect((await agent.post('/api/v1/report').send({ spotId: 'missing', reason: 'Reason' })).status).toBe(404);
    });

    test('creates a report with its reporter and reason', async () => {
        await addSpotAndCity();
        const user = await insertUser(ctx.db);
        const agent = await loginAs(ctx.app, user);
        const res = await agent.post('/api/v1/report').send({ spotId: 'reported', reason: 'Outdated address' });

        expect(res.status).toBe(201);
        expect(res.body.message).toBe('Spot reported.');
        const report = await ctx.db.collection('reports').findOne({});
        expect(report).toMatchObject({ spotId: 'reported', reason: 'Outdated address', reporterId: user._id });
        expect(report.createdAt).toBeInstanceOf(Date);
    });

    test('only admins can list and ignore reports', async () => {
        const { insertedId } = await addReport();
        const user = await insertUser(ctx.db);
        const agent = await loginAs(ctx.app, user);
        expect((await agent.get('/api/v1/report')).status).toBe(403);
        expect((await agent.delete(`/api/v1/report/${insertedId}`)).status).toBe(403);

        const admin = await loginAs(ctx.app, await insertUser(ctx.db, { username: 'admin', email: 'admin@example.com', isAdmin: true }));
        const list = await admin.get('/api/v1/report');
        expect(list.status).toBe(200);
        expect(list.body).toHaveLength(1);
        expect(list.body[0].spotId).toBe('reported');

        const ignored = await admin.delete(`/api/v1/report/${insertedId}`);
        expect(ignored.status).toBe(200);
        expect(await ctx.db.collection('reports').countDocuments({})).toBe(0);
    });

    test('taking action removes the spot, related reports, and references', async () => {
        const fan = await insertUser(ctx.db, { bookmarks: ['reported'], recentlyViewed: ['reported'] });
        const { insertedId } = await addReport();
        await addReport();
        await addSpotAndCity();
        const admin = await loginAs(ctx.app, await insertUser(ctx.db, { username: 'admin', email: 'admin@example.com', isAdmin: true }));

        const res = await admin.delete(`/api/v1/report/${insertedId}/spot`);
        expect(res.status).toBe(200);
        expect(await ctx.db.collection('spots').findOne({ id: 'reported' })).toBeNull();
        expect(await ctx.db.collection('reports').countDocuments({ spotId: 'reported' })).toBe(0);
        expect((await ctx.db.collection('cities').findOne({ name: CITY })).spots).toEqual([]);
        const updatedFan = await ctx.db.collection('users').findOne({ _id: fan._id });
        expect(updatedFan.bookmarks).toEqual([]);
        expect(updatedFan.recentlyViewed).toEqual([]);
    });
});
