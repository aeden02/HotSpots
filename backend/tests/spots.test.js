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

    describe('POST /spots/getSpotsByCategory', () => {
        beforeEach(async () => {
            await ctx.db.collection('spots').insertMany([
                makeSpot({ id: 'diner', category: 'food' }),
                makeSpot({ id: 'park', category: 'outdoors' }),
                makeSpot({ id: 'tulsa-diner', category: 'food', city: 'Tulsa, OK' }),
            ]);
        });

        test('returns spots in the city with that category', async () => {
            const res = await request(ctx.app).post('/api/v1/spots/getSpotsByCategory').send({ category: 'food', city: CITY });
            expect(res.status).toBe(200);
            expect(res.body.map(s => s.id)).toEqual(['diner']);
        });

        test('returns an empty array when nothing matches', async () => {
            const res = await request(ctx.app).post('/api/v1/spots/getSpotsByCategory').send({ category: 'shops', city: CITY });
            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });

        test.each([
            ['no body', undefined],
            ['missing category', { city: CITY }],
            ['missing city', { category: 'food' }],
            ['blank category', { category: ' ', city: CITY }],
        ])('returns 400 for %s', async (_, body) => {
            const res = await request(ctx.app).post('/api/v1/spots/getSpotsByCategory').send(body);
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Category and city are required.');
        });
    });

    describe('POST /spots/createSpot', () => {
        const body = { title: 'New Café', description: 'nice', banner: null, category: 'food', address: '2 Main St', lat: 35.3859, lng: -94.3985, tags: ['coffee'] };

        test('creates a spot in the user\'s city', async () => {
            await addCity();
            const user = await insertUser(ctx.db);
            const agent = await loginAs(ctx.app, user);
            const res = await agent.post('/api/v1/spots/createSpot').send(body);
            expect(res.status).toBe(201);
            expect(res.body.id).toMatch(/^new-cafe-[a-z0-9]{6}$/);

            const spot = await ctx.db.collection('spots').findOne({ id: res.body.id });
            expect(spot).toMatchObject({ ...body, city: CITY, ratings: [], reviews: [], events: [] });
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

    describe('POST /spots/addReview', () => {
        test('lets a signed-in user add a review which is returned with the spot', async () => {
            const user = await insertUser(ctx.db);
            const agent = await loginAs(ctx.app, user);
            await ctx.db.collection('spots').insertOne(makeSpot({ id: 'reviewed', reviews: [] }));

            const res = await agent.post('/api/v1/spots/addReview').send({ slug: 'reviewed', review: 'A lovely place.' });
            expect(res.status).toBe(201);
            expect(res.body.review).toMatchObject({ review: 'A lovely place.', author: user.username, userId: user._id.toString() });
            expect(res.body.review.createdAt).toBeDefined();

            const spot = await ctx.db.collection('spots').findOne({ id: 'reviewed' });
            expect(spot.reviews).toHaveLength(1);
            expect(spot.reviews[0]).toMatchObject({ review: 'A lovely place.', author: user.username, userId: user._id });
            const fetched = await request(ctx.app).get('/api/v1/spots/getSpot/reviewed');
            expect(fetched.body.reviews).toHaveLength(1);
            expect(fetched.body.reviews[0].review).toBe('A lovely place.');
        });

        test('requires login and non-empty review text', async () => {
            await ctx.db.collection('spots').insertOne(makeSpot({ id: 'reviewed' }));
            const anonymous = await request(ctx.app).post('/api/v1/spots/addReview').send({ slug: 'reviewed', review: 'Review' });
            expect(anonymous.status).toBe(401);

            const agent = await loginAs(ctx.app, await insertUser(ctx.db));
            const empty = await agent.post('/api/v1/spots/addReview').send({ slug: 'reviewed', review: '  ' });
            expect(empty.status).toBe(400);
        });
    });

    describe('editing and deleting posts', () => {
        let owner;
        let ownerAgent;
        let spot;

        beforeEach(async () => {
            await addCity({ spots: ['mine', 'osm'] });
            owner = await insertUser(ctx.db);
            ownerAgent = await loginAs(ctx.app, owner);
            spot = makeSpot({ id: 'mine', title: 'Old Title', tags: ['a'], createdBy: owner._id });
            await ctx.db.collection('spots').insertMany([spot, makeSpot({ id: 'osm', createdBy: null })]);
        });

        const stored = (id) => ctx.db.collection('spots').findOne({ id });
        const otherUserAgent = async () => loginAs(ctx.app, await insertUser(ctx.db, { username: 'mallory', email: 'mallory@example.com' }));

        describe('PATCH /spots/updatePost', () => {
            test('lets the creator change fields and returns the updated spot', async () => {
                const res = await ownerAgent.patch('/api/v1/spots/updatePost').send({ slug: 'mine', title: 'New Title', tags: ['b', 'c'], lat: 35.3859, lng: -94.3985 });
                expect(res.status).toBe(200);
                expect(res.body.message).toBe('Spot updated.');
                expect(res.body.spot).toMatchObject({ id: 'mine', title: 'New Title', tags: ['b', 'c'], lat: 35.3859, lng: -94.3985 });
                expect(await stored('mine')).toMatchObject({ title: 'New Title', tags: ['b', 'c'], description: spot.description, lat: 35.3859, lng: -94.3985 });
            });

            test('ignores fields that are not editable', async () => {
                await ownerAgent.patch('/api/v1/spots/updatePost').send({ slug: 'mine', description: 'new', city: 'Elsewhere', createdBy: 'x', id: 'hijack' });
                const s = await stored('mine');
                expect(s).toMatchObject({ description: 'new', city: CITY, id: 'mine' });
                expect(s.createdBy).toEqual(owner._id);
            });

            test('returns 403 for someone who did not post it', async () => {
                const agent = await otherUserAgent();
                const res = await agent.patch('/api/v1/spots/updatePost').send({ slug: 'mine', title: 'Hacked' });
                expect(res.status).toBe(403);
                expect((await stored('mine')).title).toBe('Old Title');
            });

            test('returns 403 even if the body claims to be the creator', async () => {
                const agent = await otherUserAgent();
                const res = await agent.patch('/api/v1/spots/updatePost').send({ slug: 'mine', userId: owner._id.toString(), createdBy: owner._id.toString(), title: 'Hacked' });
                expect(res.status).toBe(403);
            });

            test('returns 403 for imported spots with no creator', async () => {
                const res = await ownerAgent.patch('/api/v1/spots/updatePost').send({ slug: 'osm', title: 'Mine now' });
                expect(res.status).toBe(403);
            });

            test('returns 401 when not logged in', async () => {
                const res = await request(ctx.app).patch('/api/v1/spots/updatePost').send({ slug: 'mine', title: 'x' });
                expect(res.status).toBe(401);
            });

            test('returns 404 for an unknown slug', async () => {
                const res = await ownerAgent.patch('/api/v1/spots/updatePost').send({ slug: 'missing', title: 'x' });
                expect(res.status).toBe(404);
            });

            test.each([
                ['no slug', { title: 'x' }],
                ['empty title', { slug: 'mine', title: '  ' }],
                ['tags not an array', { slug: 'mine', tags: 'a' }],
                ['nothing to change', { slug: 'mine' }],
            ])('returns 400 for %s', async (_, body) => {
                const res = await ownerAgent.patch('/api/v1/spots/updatePost').send(body);
                expect(res.status).toBe(400);
                expect((await stored('mine')).title).toBe('Old Title');
            });
        });

        test('a spot made with createSpot can be edited and deleted by its creator only', async () => {
            const created = await ownerAgent.post('/api/v1/spots/createSpot').send({ title: 'Fresh Spot', description: 'd', category: 'food', tags: [] });
            expect(created.status).toBe(201);
            const slug = created.body.id;
            expect((await stored(slug)).createdBy).toEqual(owner._id);

            const intruder = await otherUserAgent();
            expect((await intruder.patch('/api/v1/spots/updatePost').send({ slug, title: 'Nope' })).status).toBe(403);
            expect((await intruder.delete(`/api/v1/spots/deletePost/${slug}`)).status).toBe(403);

            expect((await ownerAgent.patch('/api/v1/spots/updatePost').send({ slug, description: 'edited' })).status).toBe(200);
            expect((await stored(slug)).description).toBe('edited');
            expect((await ownerAgent.delete(`/api/v1/spots/deletePost/${slug}`)).status).toBe(200);
            expect(await stored(slug)).toBeNull();
            expect(await stored('mine')).not.toBeNull(); // other spots untouched
        });

        describe('DELETE /spots/deletePost/:slug', () => {
            test('lets the creator delete it and cleans up references', async () => {
                const fan = await insertUser(ctx.db, { username: 'fan', email: 'fan@example.com', bookmarks: ['mine', 'osm'], recentlyViewed: ['osm', 'mine'] });
                const res = await ownerAgent.delete('/api/v1/spots/deletePost/mine');
                expect(res.status).toBe(200);
                expect(res.body).toEqual({ message: 'Spot deleted.' });
                expect(await stored('mine')).toBeNull();
                expect((await ctx.db.collection('cities').findOne({ name: CITY })).spots).toEqual(['osm']);
                const after = await ctx.db.collection('users').findOne({ _id: fan._id });
                expect(after.bookmarks).toEqual(['osm']);
                expect(after.recentlyViewed).toEqual(['osm']);
            });

            test('returns 403 for someone who did not post it', async () => {
                const agent = await otherUserAgent();
                const res = await agent.delete('/api/v1/spots/deletePost/mine');
                expect(res.status).toBe(403);
                expect(await stored('mine')).not.toBeNull();
            });

            test('returns 403 for imported spots with no creator', async () => {
                const res = await ownerAgent.delete('/api/v1/spots/deletePost/osm');
                expect(res.status).toBe(403);
                expect(await stored('osm')).not.toBeNull();
            });

            test('returns 401 when not logged in', async () => {
                const res = await request(ctx.app).delete('/api/v1/spots/deletePost/mine');
                expect(res.status).toBe(401);
            });

            test('returns 404 for an unknown slug', async () => {
                const res = await ownerAgent.delete('/api/v1/spots/deletePost/missing');
                expect(res.status).toBe(404);
            });
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
