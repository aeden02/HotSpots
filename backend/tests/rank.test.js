const request = require('supertest');
const { setupTestDb, makeSpot } = require('./helpers');

jest.mock('../tools/osmSpots', () => jest.fn(async () => []));

const CITY = 'Fort Smith, AR';
const aiResponse = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('rank routes', () => {
    const ctx = setupTestDb();

    beforeEach(async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        await ctx.db.collection('spots').insertMany([
            makeSpot({ id: 'library', title: 'Library', description: 'quiet books' }),
            makeSpot({ id: 'bar', title: 'Bar', description: 'loud drinks' }),
            makeSpot({ id: 'tulsa-cafe', title: 'Cafe', description: 'quiet', city: 'Tulsa, OK' }),
        ]);
    });

    afterEach(() => jest.restoreAllMocks());

    describe('POST /rank/rank', () => {
        test('sends only the city\'s spots (id, title, description) and the query to the AI server', async () => {
            const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(aiResponse({ matches: [] }));
            await request(ctx.app).post('/api/v1/rank/rank').send({ query: 'quiet place to study', city: CITY });

            expect(fetchMock).toHaveBeenCalledTimes(1);
            const [url, options] = fetchMock.mock.calls[0];
            expect(url).toBe('http://127.0.0.1:8000/rank');
            expect(options.method).toBe('POST');
            const sent = JSON.parse(options.body);
            expect(sent.query).toBe('quiet place to study');
            expect(sent.spots).toEqual(expect.arrayContaining([
                { id: 'library', title: 'Library', description: 'quiet books' },
                { id: 'bar', title: 'Bar', description: 'loud drinks' },
            ]));
            expect(sent.spots).toHaveLength(2);
        });

        test('returns the full spots in the AI server\'s order with their scores', async () => {
            jest.spyOn(global, 'fetch').mockResolvedValue(aiResponse({ matches: [{ id: 'library', score: 0.8 }, { id: 'bar', score: 0.5 }] }));
            const res = await request(ctx.app).post('/api/v1/rank/rank').send({ query: 'quiet', city: CITY });
            expect(res.status).toBe(200);
            expect(res.body.map(s => [s.id, s.score])).toEqual([['library', 0.8], ['bar', 0.5]]);
            expect(res.body[0]).toMatchObject({ title: 'Library', description: 'quiet books', city: CITY });
        });

        test('returns an empty array when the AI server finds no matches', async () => {
            jest.spyOn(global, 'fetch').mockResolvedValue(aiResponse({ matches: [] }));
            const res = await request(ctx.app).post('/api/v1/rank/rank').send({ query: 'skydiving', city: CITY });
            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });

        test('drops matches whose id is not one of the city\'s spots', async () => {
            jest.spyOn(global, 'fetch').mockResolvedValue(aiResponse({ matches: [{ id: 'ghost', score: 0.9 }, { id: 'bar', score: 0.5 }] }));
            const res = await request(ctx.app).post('/api/v1/rank/rank').send({ query: 'drinks', city: CITY });
            expect(res.body.map(s => s.id)).toEqual(['bar']);
        });

        test('returns 503 when the AI server cannot be reached', async () => {
            jest.spyOn(global, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
            const res = await request(ctx.app).post('/api/v1/rank/rank').send({ query: 'quiet', city: CITY });
            expect(res.status).toBe(503);
            expect(res.body).toEqual({ error: 'AI search is unavailable.' });
        });

        test('returns 503 when the AI server responds with an error', async () => {
            jest.spyOn(global, 'fetch').mockResolvedValue(aiResponse({ error: 'Route not found' }, 404));
            const res = await request(ctx.app).post('/api/v1/rank/rank').send({ query: 'quiet', city: CITY });
            expect(res.status).toBe(503);
        });

        test.each([
            ['no body', undefined],
            ['missing query', { city: CITY }],
            ['missing city', { query: 'quiet' }],
            ['blank query', { query: '   ', city: CITY }],
            ['non-string city', { query: 'quiet', city: 42 }],
        ])('returns 400 for %s without calling the AI server', async (_, body) => {
            const fetchMock = jest.spyOn(global, 'fetch');
            const res = await request(ctx.app).post('/api/v1/rank/rank').send(body);
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Query and city are required.');
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });
});
