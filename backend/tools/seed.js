// Creates a city (Fort Smith by default) and fills it with OpenStreetMap spots.
// Run: npm run seed            (in Docker: docker compose exec backend npm run seed)
require('dotenv').config();
const { MongoClient } = require('mongodb');
const { seedCity } = require('../routes/spots');

const CITY = process.argv[2] || 'Fort Smith';

async function main() {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db('hotspots');

    // Same upsert createAccount uses: add the city only if it isn't there yet.
    await db.collection('cities').updateOne({ name: CITY }, { $setOnInsert: { name: CITY, spots: [] } }, { upsert: true });

    const ids = await seedCity(db, CITY);
    console.log(ids ? `Added ${ids.length} spots to ${CITY}.` : `${CITY} already has spots, nothing to do.`);
    await client.close();
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});