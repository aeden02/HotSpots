const request = require('supertest');
const { makeApp } = require('./helpers');

jest.mock('../tools/osmSpots', () => jest.fn(async () => []));

describe('ping routes', () => {
    const app = makeApp({ collection: () => { throw new Error('ping should not touch the db'); } });

    test('GET /ping returns pong', async () => {
        const res = await request(app).get('/api/v1/ping');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ message: 'pong' });
    });

    test('GET /ping/give-me-an-error returns a 400 with an error message', async () => {
        const res = await request(app).get('/api/v1/ping/give-me-an-error');
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'This is a test error' });
    });

    test('unknown routes return 404', async () => {
        const res = await request(app).get('/api/v1/ping/nope');
        expect(res.status).toBe(404);
    });
});
