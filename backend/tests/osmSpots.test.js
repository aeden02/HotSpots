const { toSpot } = require('../tools/osmSpots');

describe('OSM spot conversion', () => {
    test('maps node coordinates to lat and lng', () => {
        const spot = toSpot({
            type: 'node',
            lat: 35.3859,
            lon: -94.3985,
            tags: { name: 'Cafe', amenity: 'cafe' },
        }, 'Fort Smith');

        expect(spot).toMatchObject({ lat: 35.3859, lng: -94.3985 });
    });

    test('uses center coordinates for ways and relations', () => {
        const spot = toSpot({
            type: 'way',
            center: { lat: 35.3859, lon: -94.3985 },
            tags: { name: 'Park', leisure: 'park' },
        }, 'Fort Smith');

        expect(spot).toMatchObject({ lat: 35.3859, lng: -94.3985 });
    });
});
