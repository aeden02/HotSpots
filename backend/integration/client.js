const { MongoClient } = require('mongodb');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173/api/v1';
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';

function newSession() {
    let cookie = '';
    return async function call(method, path, body) {
        const res = await fetch(BASE_URL + path, {
            method,
            headers: { 'Content-Type': 'application/json', ...(cookie && { cookie }) },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        const setCookie = res.headers.getSetCookie?.()[0];
        if (setCookie) cookie = setCookie.split(';')[0];
        const text = await res.text();
        let json;
        try { json = JSON.parse(text); } catch { json = text; }
        return { status: res.status, body: json };
    };
}

async function connectDb() {
    const client = new MongoClient(MONGO_URL, { runtimeAdapters: { os: require('os') } });
    await client.connect();
    return { client, db: client.db('hotspots') };
}

module.exports = { BASE_URL, newSession, connectDb };
