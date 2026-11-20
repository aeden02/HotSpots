const request = require('supertest');
const { setupTestDb, makeSpot } = require('./helpers');

jest.mock('../tools/osmSpots', () => jest.fn(async () => []));

const CITY = 'Fort Smith, AR';

describe('filter routes', () => {
    const ctx = setupTestDb();

    beforeEach(async () => {
        await ctx.db.collection('spots').insertMany([
            makeSpot({ id: 'diner', category: 'food', tags: ['breakfast', 'cheap'] }),
            makeSpot({ id: 'cafe', category: 'food', tags: ['coffee', 'quiet'] }),
            makeSpot({ id: 'park', category: 'outdoors', tags: ['quiet', 'dogs'] }),
            makeSpot({ id: 'tulsa-diner', category: 'food', tags: ['coffee'], city: 'Tulsa, OK' }),
        ]);
    });

    describe('POST /filter/category', () => {
        test('returns spots in the city with that category', async () => {
            const res = await request(ctx.app).post('/api/v1/filter/category').send({ city: CITY, category: 'food' });
            expect(res.status).toBe(200);
            expect(res.body.map(s => s.id).sort()).toEqual(['cafe', 'diner']);
        });

        test('does not return spots from other cities', async () => {
            const res = await request(ctx.app).post('/api/v1/filter/category').send({ city: 'Tulsa, OK', category: 'food' });
            expect(res.body.map(s => s.id)).toEqual(['tulsa-diner']);
        });

        test('returns an empty array when nothing matches', async () => {
            const res = await request(ctx.app).post('/api/v1/filter/category').send({ city: CITY, category: 'shops' });
            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });

        test.each([
            ['no body', undefined],
            ['missing city', { category: 'food' }],
            ['missing category', { city: CITY }],
            ['blank category', { city: CITY, category: '  ' }],
            ['non-string category', { city: CITY, category: 5 }],
        ])('returns 400 for %s', async (_, body) => {
            const res = await request(ctx.app).post('/api/v1/filter/category').send(body);
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('City and category are required.');
        });
    });

    describe('POST /filter/tags', () => {
        test('returns spots in the city with at least one of the tags', async () => {
            const res = await request(ctx.app).post('/api/v1/filter/tags').send({ city: CITY, tags: ['quiet', 'cheap'] });
            expect(res.status).toBe(200);
            expect(res.body.map(s => s.id).sort()).toEqual(['cafe', 'diner', 'park']);
        });

        test('does not return spots from other cities', async () => {
            const res = await request(ctx.app).post('/api/v1/filter/tags').send({ city: CITY, tags: ['coffee'] });
            expect(res.body.map(s => s.id)).toEqual(['cafe']);
        });

        test('trims tags and ignores non-string or blank ones', async () => {
            const res = await request(ctx.app).post('/api/v1/filter/tags').send({ city: CITY, tags: ['  dogs ', '', 7, null] });
            expect(res.status).toBe(200);
            expect(res.body.map(s => s.id)).toEqual(['park']);
        });

        test('returns an empty array when nothing matches', async () => {
            const res = await request(ctx.app).post('/api/v1/filter/tags').send({ city: CITY, tags: ['nightlife'] });
            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });

        test.each([
            ['no body', undefined],
            ['missing city', { tags: ['quiet'] }],
            ['missing tags', { city: CITY }],
            ['empty tags', { city: CITY, tags: [] }],
            ['tags not an array', { city: CITY, tags: 'quiet' }],
            ['only invalid tags', { city: CITY, tags: ['', ' ', 3] }],
        ])('returns 400 for %s', async (_, body) => {
            const res = await request(ctx.app).post('/api/v1/filter/tags').send(body);
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('City and at least one tag are required.');
        });
    });
});
