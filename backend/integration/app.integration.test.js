
const { newSession, connectDb } = require('./client');
const RUN = Date.now().toString(36);
const CITY = `Integration City ${RUN}`;
const PASSWORD = 'integration-pw-123';
const emailFor = (name) => `${name}-${RUN}@integration.test`;

const SEED_SPOTS = [
    { id: `library-${RUN}`, title: 'Riverside Library', description: 'quiet reading rooms to study and read books', category: 'attractions', tags: ['quiet', 'study'] },
    { id: `bar-${RUN}`, title: 'Thunder Bar', description: 'loud live music, dancing and cold beer', category: 'food', tags: ['nightlife'] },
    { id: `park-${RUN}`, title: 'Oak Park', description: 'outdoor walking trails, dogs and picnic tables', category: 'outdoors', tags: ['quiet', 'dogs'] },
].map(s => ({ banner: null, address: '1 Test St', city: CITY, createdBy: null, ratings: [], events: [], ...s }));

let client;
let db;

beforeAll(async () => {
    ({ client, db } = await connectDb());
    await db.collection('spots').insertMany(SEED_SPOTS);
    await db.collection('cities').insertOne({ name: CITY, spots: SEED_SPOTS.map(s => s.id) });
});

afterAll(async () => {
    if (!db) return;
    await db.collection('users').deleteMany({ email: { $regex: `-${RUN}@integration\\.test$` } });
    await db.collection('spots').deleteMany({ city: CITY });
    await db.collection('cities').deleteMany({ name: CITY });
    await client.close();
});

async function registerAndLogin(name) {
    const call = newSession();
    const reg = await call('POST', '/users/createAccount', { username: `${name}-${RUN}`, email: emailFor(name), password: PASSWORD, city: CITY });
    expect(reg.status).toBe(201);
    const login = await call('POST', '/users/login', { email: emailFor(name), password: PASSWORD });
    expect(login.status).toBe(200);
    return call;
}

describe('stack is up', () => {
    test('backend answers through the frontend proxy', async () => {
        const res = await newSession()('GET', '/ping');
        expect(res).toEqual({ status: 200, body: { message: 'pong' } });
    });
});

describe('accounts', () => {
    test('register, sign in, see yourself, sign out', async () => {
        const call = await registerAndLogin('alice');

        const me = await call('GET', '/users/me');
        expect(me.status).toBe(200);
        expect(me.body).toMatchObject({ username: `alice-${RUN}`, city: CITY, isAdmin: false, bookmarks: [], recentlyViewed: [] });
        expect(me.body.password).toBeUndefined();

        expect((await call('POST', '/users/logout')).status).toBe(200);
        expect((await call('GET', '/users/me')).status).toBe(401);
    });

    test('rejects an invalid email', async () => {
        const res = await newSession()('POST', '/users/createAccount', { username: `bad-${RUN}`, email: 'not-an-email', password: PASSWORD, city: CITY });
        expect(res).toEqual({ status: 401, body: { error: 'Invalid email' } });
    });

    test('rejects a duplicate email', async () => {
        await registerAndLogin('dupe');
        const res = await newSession()('POST', '/users/createAccount', { username: `dupe2-${RUN}`, email: emailFor('dupe'), password: PASSWORD, city: CITY });
        expect(res.status).toBe(409);
    });

    test('rejects a wrong password', async () => {
        await registerAndLogin('wrongpw');
        const res = await newSession()('POST', '/users/login', { email: emailFor('wrongpw'), password: 'nope' });
        expect(res.status).toBe(401);
    });

    test('members get 403 from admin routes, admins get through', async () => {
        const member = await registerAndLogin('member');
        expect((await member('GET', '/users/getAllUsers')).status).toBe(403);

        await registerAndLogin('admin');
        await db.collection('users').updateOne({ email: emailFor('admin') }, { $set: { isAdmin: true } });
        const admin = newSession();
        await admin('POST', '/users/login', { email: emailFor('admin'), password: PASSWORD }); // role is read at login
        const res = await admin('GET', '/users/getAllUsers');
        expect(res.status).toBe(200);
        expect(res.body.every(u => u.password === undefined)).toBe(true);
    });
});

describe('spots', () => {
    test('lists the city and its spots', async () => {
        const call = newSession();
        const cities = await call('GET', '/spots/getCities');
        expect(cities.body.map(c => c.name)).toContain(CITY);

        const spots = await call('GET', `/spots/getSpotsByCity/${encodeURIComponent(CITY)}`);
        expect(spots.body.map(s => s.id).sort()).toEqual(SEED_SPOTS.map(s => s.id).sort());
    });

    test('viewing spots fills recently viewed, newest first', async () => {
        const call = await registerAndLogin('viewer');
        for (const s of SEED_SPOTS) expect((await call('GET', `/spots/getSpot/${s.id}`)).status).toBe(200);
        await call('GET', `/spots/getSpot/${SEED_SPOTS[0].id}`); // view the first again
        const me = await call('GET', '/users/me');
        expect(me.body.recentlyViewed).toEqual([SEED_SPOTS[0].id, SEED_SPOTS[2].id, SEED_SPOTS[1].id]);
    });

    test('a member can submit a spot, then bookmark and filter it', async () => {
        const call = await registerAndLogin('creator');
        const created = await call('POST', '/spots/createSpot', {
            title: 'Integration Cafe', description: 'coffee and pastries', category: 'food', address: '2 Test St', tags: ['coffee'],
        });
        expect(created.status).toBe(201);
        const { id } = created.body;

        const fetched = await call('GET', `/spots/getSpot/${id}`);
        expect(fetched.body).toMatchObject({ title: 'Integration Cafe', city: CITY });

        expect((await call('POST', `/bookmark/${id}`)).body).toEqual({ message: 'Spot bookmarked.' });
        expect((await call('POST', `/bookmark/${id}`)).body).toEqual({ message: 'Spot already bookmarked.' });
        expect((await call('GET', '/users/me')).body.bookmarks).toEqual([id]);

        const food = await call('POST', '/filter/category', { city: CITY, category: 'food' });
        expect(food.body.map(s => s.id).sort()).toEqual([id, `bar-${RUN}`].sort());

        const coffee = await call('POST', '/filter/tags', { city: CITY, tags: ['coffee'] });
        expect(coffee.body.map(s => s.id)).toEqual([id]);
    });

    test('logged-out users cannot submit spots or bookmark', async () => {
        const call = newSession();
        expect((await call('POST', '/spots/createSpot', { title: 'Nope' })).status).toBe(401);
        expect((await call('POST', `/bookmark/${SEED_SPOTS[0].id}`)).status).toBe(401);
    });

    test('tag filter only returns spots in the requested city', async () => {
        const res = await newSession()('POST', '/filter/tags', { city: CITY, tags: ['quiet'] });
        expect(res.body.map(s => s.id).sort()).toEqual([`library-${RUN}`, `park-${RUN}`].sort());
    });
});

describe('AI search (real Python ranker)', () => {
    test('ranks the library first for "quiet place to study"', async () => {
        const res = await newSession()('POST', '/rank/rank', { query: 'quiet place to study', city: CITY });
        expect(res.status).toBe(200);
        expect(res.body.length).toBeGreaterThan(0);
        expect(res.body[0]).toMatchObject({ id: `library-${RUN}`, title: 'Riverside Library' });
        expect(typeof res.body[0].score).toBe('number');
        // Scores come back sorted, best first.
        const scores = res.body.map(s => s.score);
        expect(scores).toEqual([...scores].sort((a, b) => b - a));
    });

    test('only searches the requested city', async () => {
        const res = await newSession()('POST', '/rank/rank', { query: 'quiet place to study', city: CITY });
        expect(res.body.every(s => s.city === CITY)).toBe(true);
    });

    test('validates input before calling the ranker', async () => {
        const res = await newSession()('POST', '/rank/rank', { city: CITY });
        expect(res.status).toBe(400);
    });
});
