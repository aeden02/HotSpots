const request = require('supertest');
const { ObjectId } = require('mongodb');
const { setupTestDb, insertUser, loginAs, makeSpot } = require('./helpers');

jest.mock('../tools/osmSpots', () => jest.fn());
const getOsmSpots = require('../tools/osmSpots');
const { seedCity } = require('../routes/spots');

const CITY = 'Fort Smith, AR';

describe('spots routes', () => {
    const ctx = setupTestDb();

    beforeEach(() => getOsmSpots.mockReset());
    afterEach(() => jest.restoreAllMocks());

    const addCity = (overrides = {}) => ctx.db.collection('cities').insertOne({ name: CITY, spots: [], ...overrides });

    describe('seedCity()', () => {
        test('inserts the OSM spots and links them to the city', async () => {
            await addCity();
            getOsmSpots.mockResolvedValue([
                { title: 'Café Rose', description: 'coffee', banner: null, category: 'Generated', address: 'x', tags: [] },
                { title: 'Big Park', description: 'grass', banner: null, category: 'Generated', address: 'y', tags: [] },
            ]);
            const ids = await seedCity(ctx.db, CITY);
            expect(ids).toHaveLength(2);
            expect(ids[0]).toMatch(/^cafe-rose-[a-z0-9]{6}$/);

            const spots = await ctx.db.collection('spots').find({}).toArray();
            expect(spots).toHaveLength(2);
            expect(spots[0]).toMatchObject({ city: CITY, createdBy: null, ratings: [], events: [] });

            const city = await ctx.db.collection('cities').findOne({ name: CITY });
            expect(city.spots).toEqual(ids);
            expect(city.seeding).toBeUndefined();
        });

        test('returns null for a city that does not exist', async () => {
            expect(await seedCity(ctx.db, 'Nowhere')).toBeNull();
            expect(getOsmSpots).not.toHaveBeenCalled();
        });

        test('returns null for a city that already has spots', async () => {
            await addCity({ spots: ['existing'] });
            expect(await seedCity(ctx.db, CITY)).toBeNull();
            expect(getOsmSpots).not.toHaveBeenCalled();
        });

        test('returns null while the city is already being seeded', async () => {
            await addCity({ seeding: true });
            expect(await seedCity(ctx.db, CITY)).toBeNull();
        });

        test('clears the seeding flag even if OSM fails', async () => {
            await addCity();
            getOsmSpots.mockRejectedValue(new Error('OSM down'));
            await expect(seedCity(ctx.db, CITY)).rejects.toThrow('OSM down');
            const city = await ctx.db.collection('cities').findOne({ name: CITY });
            expect(city.seeding).toBeUndefined();
        });
    });

    describe('POST /spots/seedCity', () => {
        test('seeds an empty city and returns 201 with the new ids', async () => {
            await addCity();
            getOsmSpots.mockResolvedValue([{ title: 'Museum', description: 'art', tags: [] }]);
            const res = await request(ctx.app).post('/api/v1/spots/seedCity').send({ city: CITY });
            expect(res.status).toBe(201);
            expect(res.body.message).toBe('Added 1 spots.');
            expect(res.body.ids).toHaveLength(1);
        });

        test('returns 400 without a city', async () => {
            const res = await request(ctx.app).post('/api/v1/spots/seedCity').send({});
            expect(res.status).toBe(400);
        });

        test('returns 404 for an unknown city', async () => {
            const res = await request(ctx.app).post('/api/v1/spots/seedCity').send({ city: 'Nowhere' });
            expect(res.status).toBe(404);
        });

        test('returns 409 if the city already has spots', async () => {
            await addCity({ spots: ['existing'] });
            const res = await request(ctx.app).post('/api/v1/spots/seedCity').send({ city: CITY });
            expect(res.status).toBe(409);
        });

        test('returns 502 if OpenStreetMap fails', async () => {
            await addCity();
            getOsmSpots.mockRejectedValue(new Error('OSM down'));
            const res = await request(ctx.app).post('/api/v1/spots/seedCity').send({ city: CITY });
            expect(res.status).toBe(502);
            expect(res.body.error).toBe('OSM down');
        });
    });

    describe('GET /spots/getSpot/:slug', () => {
        test('returns the spot', async () => {
            const spot = makeSpot({ id: 'the-spot' });
            await ctx.db.collection('spots').insertOne(spot);
            const res = await request(ctx.app).get('/api/v1/spots/getSpot/the-spot');
            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({ id: 'the-spot', title: 'Test Spot' });
        });

        test('returns 404 for an unknown slug', async () => {
            const res = await request(ctx.app).get('/api/v1/spots/getSpot/missing');
            expect(res.status).toBe(404);
        });

        test('does not fail when not logged in', async () => {
            await ctx.db.collection('spots').insertOne(makeSpot({ id: 'a' }));
            const res = await request(ctx.app).get('/api/v1/spots/getSpot/a');
            expect(res.status).toBe(200);
        });

        describe('recentlyViewed', () => {
            const recent = async (userId) => (await ctx.db.collection('users').findOne({ _id: userId })).recentlyViewed;

            test('adds the viewed slug to the front for a logged-in user', async () => {
                await ctx.db.collection('spots').insertMany([makeSpot({ id: 'a' }), makeSpot({ id: 'b' })]);
                const user = await insertUser(ctx.db);
                const agent = await loginAs(ctx.app, user);
                await agent.get('/api/v1/spots/getSpot/a');
                await agent.get('/api/v1/spots/getSpot/b');
                expect(await recent(user._id)).toEqual(['b', 'a']);
            });

            test('moves a re-viewed spot to the front without duplicating it', async () => {
                await ctx.db.collection('spots').insertMany(['a', 'b', 'c'].map(id => makeSpot({ id })));
                const user = await insertUser(ctx.db);
                const agent = await loginAs(ctx.app, user);
                for (const id of ['a', 'b', 'c', 'a']) await agent.get(`/api/v1/spots/getSpot/${id}`);
                expect(await recent(user._id)).toEqual(['a', 'c', 'b']);
            });

            test('keeps only the 5 most recent', async () => {
                const ids = ['s1', 's2', 's3', 's4', 's5', 's6', 's7'];
                await ctx.db.collection('spots').insertMany(ids.map(id => makeSpot({ id })));
                const user = await insertUser(ctx.db);
                const agent = await loginAs(ctx.app, user);
                for (const id of ids) await agent.get(`/api/v1/spots/getSpot/${id}`);
                expect(await recent(user._id)).toEqual(['s7', 's6', 's5', 's4', 's3']);
            });

            test('works for older users that have no recentlyViewed field', async () => {
                await ctx.db.collection('spots').insertOne(makeSpot({ id: 'a' }));
                const user = await insertUser(ctx.db);
                await ctx.db.collection('users').updateOne({ _id: user._id }, { $unset: { recentlyViewed: '' } });
                const agent = await loginAs(ctx.app, user);
                await agent.get('/api/v1/spots/getSpot/a');
                expect(await recent(user._id)).toEqual(['a']);
            });

            test('does not record a missing spot', async () => {
                const user = await insertUser(ctx.db);
                const agent = await loginAs(ctx.app, user);
                await agent.get('/api/v1/spots/getSpot/missing');
                expect(await recent(user._id)).toEqual([]);
            });
        });
    });

    describe('GET /spots/getSpotsByCity/:city', () => {
        test('returns only spots in that city', async () => {
            await ctx.db.collection('spots').insertMany([
                makeSpot({ id: 'a' }), makeSpot({ id: 'b' }), makeSpot({ id: 'c', city: 'Tulsa, OK' }),
            ]);
            const res = await request(ctx.app).get(`/api/v1/spots/getSpotsByCity/${encodeURIComponent(CITY)}`);
            expect(res.status).toBe(200);
            expect(res.body.map(s => s.id).sort()).toEqual(['a', 'b']);
        });

        test('returns an empty array for a city with no spots', async () => {
            const res = await request(ctx.app).get('/api/v1/spots/getSpotsByCity/Nowhere');
            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });
    });

    describe('POST /spots/createSpot', () => {
        const body = { title: 'New Café', description: 'nice', banner: null, category: 'food', address: '2 Main St', tags: ['coffee'] };

        test('creates a spot in the user\'s city', async () => {
            await addCity();
            const user = await insertUser(ctx.db);
            const agent = await loginAs(ctx.app, user);
            const res = await agent.post('/api/v1/spots/createSpot').send(body);
            expect(res.status).toBe(201);
            expect(res.body.id).toMatch(/^new-cafe-[a-z0-9]{6}$/);

            const spot = await ctx.db.collection('spots').findOne({ id: res.body.id });
            expect(spot).toMatchObject({ ...body, city: CITY, ratings: [], events: [] });
            expect(spot.createdBy).toEqual(user._id);
            const city = await ctx.db.collection('cities').findOne({ name: CITY });
            expect(city.spots).toContain(res.body.id);
        });

        test('defaults tags to an empty array when they are not an array', async () => {
            await addCity();
            const agent = await loginAs(ctx.app, await insertUser(ctx.db));
            const res = await agent.post('/api/v1/spots/createSpot').send({ ...body, tags: 'coffee' });
            const spot = await ctx.db.collection('spots').findOne({ id: res.body.id });
            expect(spot.tags).toEqual([]);
        });

        test('returns 401 when not logged in', async () => {
            const res = await request(ctx.app).post('/api/v1/spots/createSpot').send(body);
            expect(res.status).toBe(401);
        });

        test('returns 400 without a title', async () => {
            await addCity();
            const agent = await loginAs(ctx.app, await insertUser(ctx.db));
            const res = await agent.post('/api/v1/spots/createSpot').send({ ...body, title: '  ' });
            expect(res.status).toBe(400);
        });

        test('returns 403 when the user\'s city is not registered', async () => {
            const agent = await loginAs(ctx.app, await insertUser(ctx.db, { city: 'Nowhere' }));
            const res = await agent.post('/api/v1/spots/createSpot').send(body);
            expect(res.status).toBe(403);
        });
    });

    describe('GET /spots/getCities', () => {
        test('returns every city', async () => {
            await ctx.db.collection('cities').insertMany([{ name: 'A', spots: [] }, { name: 'B', spots: [] }]);
            const res = await request(ctx.app).get('/api/v1/spots/getCities');
            expect(res.status).toBe(200);
            expect(res.body.map(c => c.name).sort()).toEqual(['A', 'B']);
        });
    });

    describe('GET /spots/getCityById/:id', () => {
        test('returns the city', async () => {
            const { insertedId } = await addCity();
            const res = await request(ctx.app).get(`/api/v1/spots/getCityById/${insertedId}`);
            expect(res.status).toBe(200);
            expect(res.body.name).toBe(CITY);
        });

        test('returns 404 for an invalid id', async () => {
            const res = await request(ctx.app).get('/api/v1/spots/getCityById/not-an-id');
            expect(res.status).toBe(404);
        });

        test('returns 404 for a valid but unknown id', async () => {
            const res = await request(ctx.app).get(`/api/v1/spots/getCityById/${new ObjectId()}`);
            expect(res.status).toBe(404);
        });
    });

    describe('GET /spots/searchSpots', () => {
        test('returns the ranked spots with scores from the AI server', async () => {
            await ctx.db.collection('spots').insertMany([makeSpot({ id: 'a' }), makeSpot({ id: 'b' })]);
            const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
                new Response(JSON.stringify({ matches: [{ id: 'b', score: 0.9 }, { id: 'a', score: 0.5 }] }), { status: 200 })
            );
            const res = await request(ctx.app).get('/api/v1/spots/searchSpots').query({ query: 'coffee', city: CITY });
            expect(res.status).toBe(200);
            expect(res.body.map(s => [s.id, s.score])).toEqual([['b', 0.9], ['a', 0.5]]);
            expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8000/rank', expect.objectContaining({ method: 'POST' }));
        });

        test('returns 400 without a query or city', async () => {
            const res = await request(ctx.app).get('/api/v1/spots/searchSpots').query({ query: 'coffee' });
            expect(res.status).toBe(400);
        });

        test('returns 500 when the AI server responds with an error', async () => {
            jest.spyOn(global, 'fetch').mockResolvedValue(new Response('oops', { status: 500 }));
            const res = await request(ctx.app).get('/api/v1/spots/searchSpots').query({ query: 'coffee', city: CITY });
            expect(res.status).toBe(500);
        });
    });
});
