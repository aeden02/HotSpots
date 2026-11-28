const request = require('supertest');
const { setupTestDb, makeSpot } = require('./helpers');

const CITY = 'Fort Smith, AR';
const aiResponse = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
});

describe('AI routes', () => {
    const ctx = setupTestDb();

    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => jest.restoreAllMocks());

    describe('POST /ai/tags', () => {
        test('forwards a spot title and description and returns suggested tags', async () => {
            const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(aiResponse({ tags: ['food-and-drink'] }));
            const res = await request(ctx.app).post('/api/v1/ai/tags').send({
                title: 'Corner Cafe',
                description: 'Coffee and pastries',
            });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ tags: ['food-and-drink'] });
            expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8000/tags', expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ title: 'Corner Cafe', description: 'Coffee and pastries' }),
            }));
        });

        test('rejects empty or invalid spot text', async () => {
            const fetchMock = jest.spyOn(global, 'fetch');
            const res = await request(ctx.app).post('/api/v1/ai/tags').send({ title: '  ' });

            expect(res.status).toBe(400);
            expect(fetchMock).not.toHaveBeenCalled();
        });

        test('returns 503 when the AI service is unavailable', async () => {
            jest.spyOn(global, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
            const res = await request(ctx.app).post('/api/v1/ai/tags').send({ title: 'Corner Cafe' });

            expect(res.status).toBe(503);
            expect(res.body).toEqual({ error: 'AI tagging is unavailable.' });
        });
    });

    describe('POST /ai/themes', () => {
        test('sends only the requested city catalog to the AI service', async () => {
            await ctx.db.collection('spots').insertMany([
                makeSpot({ id: 'cafe', city: CITY, tags: ['food-and-drink'] }),
                makeSpot({ id: 'other-city', city: 'Tulsa, OK' }),
            ]);
            const result = { source: 'ai', themes: [{ name: 'Local', description: 'Nearby spots', spotIds: ['cafe'] }] };
            const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(aiResponse(result));
            const res = await request(ctx.app).post('/api/v1/ai/themes').send({ city: CITY });

            expect(res.status).toBe(200);
            expect(res.body).toEqual(result);
            const [url, options] = fetchMock.mock.calls[0];
            expect(url).toBe('http://127.0.0.1:8000/themes');
            expect(JSON.parse(options.body)).toEqual({
                spots: [{ id: 'cafe', title: 'Test Spot', description: 'A test spot', tags: ['food-and-drink'] }],
            });
        });

        test('rejects requests without a city', async () => {
            const fetchMock = jest.spyOn(global, 'fetch');
            const res = await request(ctx.app).post('/api/v1/ai/themes').send({});

            expect(res.status).toBe(400);
            expect(fetchMock).not.toHaveBeenCalled();
        });

        test('returns 503 when the AI service responds with an error', async () => {
            jest.spyOn(global, 'fetch').mockResolvedValue(aiResponse({ error: 'unavailable' }, 500));
            const res = await request(ctx.app).post('/api/v1/ai/themes').send({ city: CITY });

            expect(res.status).toBe(503);
            expect(res.body).toEqual({ error: 'AI themes are unavailable.' });
        });
    });
});
