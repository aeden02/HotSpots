// Fetches random points of interest for a city from OpenStreetMap and shapes them
// like the body POST /api/v1/spots/createSpot expects:
//   { title, description, banner, category, address, tags }
//
// Usage as a module:   const getOsmSpots = require('./tools/osmSpots');
//                      const spots = await getOsmSpots('Fort Smith, AR');
// Usage from the CLI:  node tools/osmSpots.js "Fort Smith, AR" [count]

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
// Public Overpass servers are often busy; try each in turn.
const OVERPASS_URLS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
// Nominatim and Overpass both require an identifying User-Agent.
const USER_AGENT = 'HotSpots-class-project/1.0';

// Which OSM places to fetch: tag key -> tag values we care about.
const OSM_FILTERS = {
    amenity: ['restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'ice_cream', 'biergarten', 'food_court',
        'theatre', 'cinema', 'arts_centre', 'library', 'nightclub', 'community_centre'],
    tourism: ['attraction', 'museum', 'gallery', 'zoo', 'theme_park', 'aquarium', 'artwork',
        'viewpoint', 'picnic_site', 'camp_site'],
    leisure: ['park', 'garden', 'nature_reserve', 'playground', 'dog_park', 'golf_course', 'marina',
        'stadium', 'sports_centre', 'bowling_alley', 'amusement_arcade', 'water_park', 'escape_game'],
    shop: ['books', 'second_hand', 'gift', 'art', 'antiques', 'music', 'clothes', 'bakery', 'deli', 'craft', 'farm', 'toys', 'games'],
    historic: ['monument', 'memorial', 'castle', 'fort', 'building', 'ruins', 'archaeological_site', 'battlefield'],
};

const pretty = (s) => s.replace(/_/g, ' ');

// Readable nouns for OSM values that aren't nouns on their own (mostly shop=*).
const LABELS = {
    books: 'bookstore', second_hand: 'thrift store', gift: 'gift shop', art: 'art shop', antiques: 'antique shop',
    music: 'music store', clothes: 'clothing store', craft: 'craft store', farm: 'farm shop', toys: 'toy store',
    games: 'game store', deli: 'deli', bakery: 'bakery', fast_food: 'fast food spot', ice_cream: 'ice cream shop',
    building: 'historic building', ruins: 'historic ruin', archaeological_site: 'archaeological site',
    attraction: 'attraction', artwork: 'public artwork', theme_park: 'theme park', camp_site: 'campground',
};
const label = (value) => LABELS[value] || pretty(value);
const article = (word) => (/^[aeiou]/i.test(word) ? 'An' : 'A');

async function fetchJson(url, options = {}) {
    const res = await fetch(url, { ...options, headers: { 'User-Agent': USER_AGENT, ...options.headers } });
    if (!res.ok) throw new Error(`Request to ${new URL(url).host} failed: ${res.status} ${res.statusText}`);
    return res.json();
}

// Resolve a city string to an Overpass area filter (or a bbox fallback).
async function locateCity(city) {
    const params = new URLSearchParams({ q: city, format: 'json', limit: '1', featureType: 'city' });
    let [place] = await fetchJson(`${NOMINATIM_URL}?${params}`);
    if (!place) {
        params.delete('featureType');
        [place] = await fetchJson(`${NOMINATIM_URL}?${params}`);
    }
    if (!place) throw new Error(`City not found on OpenStreetMap: "${city}"`);

    if (place.osm_type === 'relation') {
        return { name: place.name, filter: '(area.city)', setup: `area(id:${3600000000 + Number(place.osm_id)})->.city;` };
    }
    const [south, north, west, east] = place.boundingbox;
    return { name: place.name, filter: `(${south},${west},${north},${east})`, setup: '' };
}

function buildQuery({ filter, setup }) {
    const clauses = Object.entries(OSM_FILTERS).map(([key, values]) =>
        `nwr${filter}["${key}"~"^(${values.join('|')})$"]["name"];`);
    return `[out:json][timeout:60];${setup}(${clauses.join('')});out center tags;`;
}

// Find the OSM place type (e.g. amenity=restaurant), used only for the description.
function classify(tags) {
    for (const [key, values] of Object.entries(OSM_FILTERS)) {
        if (values.includes(tags[key])) return { key, value: tags[key] };
    }
    return null;
}

function formatAddress(tags, cityName) {
    const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
    const locality = tags['addr:city'] || cityName;
    const region = [tags['addr:state'], tags['addr:postcode']].filter(Boolean).join(' ');
    return [street, locality, region].filter(Boolean).join(', ');
}

function bannerFrom(tags) {
    if (tags.image && /^https?:\/\//.test(tags.image)) return tags.image;
    const commons = tags.wikimedia_commons;
    if (commons && commons.startsWith('File:')) {
        return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(commons.slice(5))}?width=1200`;
    }
    return null;
}

function buildDescription(tags, kind, cityName) {
    if (tags.description) return tags.description;
    const noun = label(kind.value);
    let text = `${article(noun)} ${noun} in ${cityName}.`;
    if (tags.cuisine) text += ` Cuisine: ${tags.cuisine.split(';').map(c => pretty(c.trim())).join(', ')}.`;
    if (tags.opening_hours) text += ` Hours: ${tags.opening_hours}.`;
    if (tags.website) text += ` Website: ${tags.website}`;
    return text;
}

function toSpot(element, cityName) {
    const tags = element.tags || {};
    const kind = classify(tags);
    if (!kind || !tags.name) return null;
    return {
        title: tags.name,
        description: buildDescription(tags, kind, cityName),
        banner: bannerFrom(tags),
        category: 'Generated',
        address: formatAddress(tags, cityName),
        tags: [],
    };
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Get `count` random spots for a city from OpenStreetMap.
 * @param {string} city  e.g. "Fort Smith, AR"
 * @param {number} [count=20]
 * @returns {Promise<Array<{title, description, banner, category, address, tags}>>}
 */
async function getOsmSpots(city, count = 20) {
    if (typeof city !== 'string' || !city.trim()) throw new Error('City is required.');
    const location = await locateCity(city.trim());
    const query = buildQuery(location);
    let data, lastError;
    for (const url of OVERPASS_URLS) {
        try {
            data = await fetchJson(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ data: query }),
            });
            break;
        } catch (err) {
            lastError = err;
        }
    }
    if (!data) throw lastError;

    // De-duplicate by name (OSM often has the same place as a node and a way).
    const byTitle = new Map();
    for (const el of data.elements || []) {
        const spot = toSpot(el, location.name);
        if (spot && !byTitle.has(spot.title.toLowerCase())) byTitle.set(spot.title.toLowerCase(), spot);
    }

    // Prefer spots that have a street address; fill with the rest if needed.
    const all = shuffle([...byTitle.values()]);
    const hasStreet = (s) => s.address !== location.name && !s.address.startsWith(`${location.name},`);
    return [...all.filter(hasStreet), ...all.filter(s => !hasStreet(s))].slice(0, count);
}

module.exports = getOsmSpots;

if (require.main === module) {
    const [city, count] = process.argv.slice(2);
    if (!city) {
        console.error('Usage: node tools/osmSpots.js "<city>" [count]');
        process.exit(1);
    }
    getOsmSpots(city, count ? Number(count) : 20)
        .then(spots => console.log(JSON.stringify(spots, null, 2)))
        .catch(err => { console.error(err.message); process.exit(1); });
}
