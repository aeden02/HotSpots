"""Create original, fictional fixtures. These are NOT verified Fort Smith places."""
import csv
from pathlib import Path

# Each group has two deliberately relevant fictional spots and ten distinct queries.
# Six queries train, two select the checkpoint, and two are held out for testing.
GROUPS = [
('study', [
 ('Study Cafe', 'Quiet cafe with coffee, wifi, power outlets and tables for studying or reading.'),
 ('Reading Room', 'Silent library room with desks, internet and space to concentrate on homework.')], [
 'quiet place to study', 'coffee and wifi for homework', 'a silent room to read',
 'somewhere to concentrate with internet', 'tables and outlets for my laptop', 'peaceful space for school work',
 'a calm room for studying with wifi', 'where can I read without noise',
 'finish homework over a cup of coffee', 'a peaceful desk where I can focus']),
('music', [
 ('Stage Cafe', 'Lively cafe with live bands, loud music and coffee in the evening.'),
 ('Evening Venue', 'Indoor venue for concerts, dancing and local musicians performing at night.')], [
 'live music tonight', 'a place to dance', 'hear a local band', 'loud lively evening entertainment',
 'coffee while musicians perform', 'somewhere for a concert',
 'night entertainment with live bands', 'listen to musicians in a lively cafe',
 'watch a band while drinking coffee', 'an evening of dancing and songs']),
('playground', [
 ('Play Meadow', 'Family park with playground swings, slides, picnic tables and grass for children.'),
 ('Kids Garden', 'Outdoor play area with climbing equipment and picnic benches for families with kids.')], [
 'take children to a playground', 'swings and slides for kids', 'outdoor family play area',
 'a picnic with young children', 'somewhere kids can climb and play', 'family park with benches',
 'children want to play on swings', 'a park for a family picnic and play',
 'let the kids burn off energy on slides', 'eat outdoors while children use climbing equipment']),
('hiking', [
 ('Ridge Trail', 'Long wooded hiking trail with steep hills, forest paths and scenic overlooks.'),
 ('Forest Loop', 'Nature walking route through trees with challenging climbs and views of the valley.')], [
 'go hiking in the woods', 'challenging nature walk', 'a long forest trail', 'steep hills to climb',
 'scenic overlooks on foot', 'walking paths through trees',
 'hike up hills for a valley view', 'a challenging wooded walking route',
 'spend the afternoon trekking through forest', 'exercise on a steep path surrounded by trees']),
('history', [
 ('Heritage House', 'History museum with exhibits about the city, early settlers and historic buildings.'),
 ('Old Town Exhibit', 'Indoor collection of historical documents and artifacts explaining local life in the past.')], [
 'learn local history', 'museum about early settlers', 'historic artifacts and documents',
 'how did people live in the past', 'exhibits about old buildings', 'understand the history of this city',
 'see historical documents in a museum', 'discover stories about early local life',
 'explore the city past through artifacts', 'learn about settlers and the old town']),
('art', [
 ('Canvas Gallery', 'Art gallery showing paintings, sculpture and contemporary work by local artists.'),
 ('Color Studio', 'Indoor exhibition of drawings, pottery and visual art with rotating artist displays.')], [
 'look at local paintings', 'visit an art gallery', 'see sculpture indoors',
 'contemporary visual art exhibition', 'drawings and pottery on display', 'discover work by artists',
 'paintings and sculpture from local artists', 'an indoor display of visual artwork',
 'browse colorful artwork and pottery', 'see creative drawings in a gallery']),
('antiques', [
 ('Attic Shop', 'Antique shop selling vintage furniture, old collectibles and secondhand decorations.'),
 ('Past Finds', 'Store with retro household items, used ornaments and collectible objects from earlier decades.')], [
 'shop for antiques', 'find vintage furniture', 'buy old collectibles', 'browse retro household items',
 'secondhand decorations for my house', 'used ornaments from the past',
 'a store selling vintage household decorations', 'old furniture and retro collectibles',
 'hunt for secondhand treasures and ornaments', 'buy a retro chair for my home']),
('crafts', [
 ('Makers Market', 'Shop selling handmade gifts, jewelry, candles and crafts made by local makers.'),
 ('Gift Workshop', 'Small store with handcrafted souvenirs, woven goods and locally produced accessories.')], [
 'buy handmade gifts', 'locally made souvenirs', 'shop for handcrafted jewelry',
 'crafts from local makers', 'find woven goods and candles', 'small store for handmade accessories',
 'gifts made by local craftspeople', 'handcrafted souvenirs and candles',
 'take home something made by a local maker', 'purchase handmade jewelry as a present']),
('budgetfood', [
 ('Taco Counter', 'Budget food counter serving inexpensive tacos and quick filling meals.'),
 ('Noodle Stand', 'Casual takeaway stall with low priced noodles and affordable lunch portions.')], [
 'cheap place to eat', 'inexpensive lunch', 'affordable quick meal', 'budget tacos',
 'low priced noodles to take away', 'filling food without spending much',
 'a quick lunch on a small budget', 'inexpensive takeaway food',
 'grab a filling meal for little money', 'save money on tacos or noodles']),
('patio', [
 ('Patio Kitchen', 'Restaurant with outdoor patio tables serving dinner in an open air courtyard.'),
 ('Terrace Bistro', 'Dining terrace with outdoor seating, lunch service and tables under the sky.')], [
 'eat dinner outside', 'restaurant with a patio', 'outdoor seating for lunch',
 'open air dining', 'a meal on a terrace', 'courtyard restaurant tables',
 'dinner at outdoor patio tables', 'lunch on an open air terrace',
 'sit under the sky while eating', 'have a meal outside in a courtyard']),
('rain', [
 ('Puzzle Room', 'Indoor escape room with puzzles and team challenges for rainy day activities.'),
 ('Game Hall', 'Indoor board game lounge with tabletop games and group entertainment sheltered from rain.')], [
 'indoor fun on a rainy day', 'solve puzzles with friends', 'play board games indoors',
 'escape room team challenge', 'group entertainment away from the rain', 'tabletop game lounge',
 'a rainy afternoon playing games with friends', 'indoor team puzzle activities',
 'stay dry while solving a group challenge', 'friends want tabletop entertainment when it rains']),
('water', [
 ('Paddle Dock', 'Waterfront rental for kayaks and canoes with paddling trips along the river.'),
 ('Lake Launch', 'Lakeside boat launch offering canoe hire and kayaking on calm water.')], [
 'rent a kayak', 'go canoeing on the river', 'paddle on a lake', 'waterfront boat rental',
 'hire a canoe for a trip', 'kayaking on calm water',
 'rent a canoe for river paddling', 'a lakeside place to launch a kayak',
 'spend time on the water in a small boat', 'hire paddling equipment by the lake']),
]

def main():
    root = Path(__file__).resolve().parent / 'data'
    root.mkdir(exist_ok=True)
    with (root/'spots.csv').open('w', newline='', encoding='utf-8') as sf, (root/'queries.csv').open('w', newline='', encoding='utf-8') as qf:
        sw, qw = csv.writer(sf), csv.writer(qf)
        sw.writerow(['spot_id', 'name', 'description'])
        qw.writerow(['query_id', 'query', 'relevant_ids', 'split', 'intent'])
        for group, spots, queries in GROUPS:
            ids = [group+'1', group+'2']
            for sid, (name, desc) in zip(ids, spots): sw.writerow([sid, name, desc])
            for i, query in enumerate(queries):
                split = 'train' if i < 6 else 'validation' if i < 8 else 'test'
                qw.writerow([f'{group}-{i+1}', query, '|'.join(ids), split, group])
    print('Wrote 24 fictional spots and 120 authored queries (72 train / 24 validation / 24 test).')

if __name__ == '__main__': main()
