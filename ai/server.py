import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

from experiment import load_word_vectors, search
from themes import generate_themes


TAG_PROFILES = {
    "outdoors": "An outdoor setting, such as a park or open space, where visitors spend time outside.",
    "food-and-drink": "Places where people eat, drink, or share a prepared meal.",
    "shopping": "shopping, stores, retail, boutiques, clothing, gifts, markets",
    "entertainment": "entertainment, games, arcades, bowling, cinemas, amusement",
    "arts-and-culture": "Places where people create, perform, or experience art and culture. Music, theater, and galleries.",
    "history": "history, historic landmarks, heritage, museums, monuments",
    "sports-and-fitness": "Places for physical exercise, athletic training, and competitive sports.",
    "nightlife": "nightlife, bars, pubs, cocktails, nightclubs, dancing",
    "education": "Places where people learn, study, read, or develop new skills. Libraries, classes, and workshops.",
    "wellness": "spas, massage therapy, meditation, relaxation, wellness retreats",
    "lodging": "hotels, hostels, guesthouses, overnight stays, vacation rentals",
    "family-activities": "Places where children and families play and explore together. Playgrounds, playrooms, and children's attractions.",
}
MIN_TAG_SCORE = 0.425
MIN_TAG_SCORE_RATIO = 0.60


def generate_spot_tags(title, description, word_vectors):
    """Suggest up to three predefined tags using semantic similarity."""
    spot_text = " ".join(
        field for field in (title, description) if isinstance(field, str)
    )
    tags = list(TAG_PROFILES)
    ranked = search(spot_text, list(TAG_PROFILES.values()), word_vectors)
    if not ranked:
        return []

    print(f"\nTag scores for {title!r}:", flush=True)
    for index, score in ranked:
        print(f"  {tags[index]}: {score:.3f}", flush=True)

    cutoff = max(MIN_TAG_SCORE, ranked[0][1] * MIN_TAG_SCORE_RATIO)
    return [tags[index] for index, score in ranked if score >= cutoff][:3]


class RankHandler(BaseHTTPRequestHandler):
    def send_json(self, status, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path not in ("/rank", "/tags", "/recommend", "/themes"):
            self.send_json(404, {"error": "Route not found"})
            return

        if self.path == "/themes":
            try:
                length = int(self.headers.get("Content-Length", 0))
                if length <= 0:
                    raise ValueError("A JSON request body is required")
                data = json.loads(self.rfile.read(length))
                spots = data.get("spots") if isinstance(data, dict) else None
                if not isinstance(spots, list):
                    raise ValueError("spots must be an array")
                if any(
                    not isinstance(spot, dict)
                    or not isinstance(spot.get("id"), str)
                    or not spot["id"].strip()
                    for spot in spots
                ):
                    raise ValueError("Each spot must have a nonempty string id")
            except ValueError as error:
                self.send_json(400, {"error": str(error)})
                return
            self.send_json(200, generate_themes(spots))
            return

        length = int(self.headers["Content-Length"])
        data = json.loads(self.rfile.read(length))

        if self.path == "/tags":
            tags = generate_spot_tags(data.get("title"), data.get("description"), self.word_vectors)
            self.send_json(200, {"tags": tags})
            return

        query = data["query"]
        spots = data["spots"]

        spot_profiles = [
            " ".join((spot.get("title") or "", spot.get("description") or ""))
            for spot in spots
        ]

        ranked = search(query, spot_profiles, self.word_vectors)

        #when you call /recommend. If you are doing similar spots:
        #query: the description of the spot you're looking at,
        #if you are using "Recommended for you",
        #query: builds query from user's selected interests and title and description of their bookmarked spots
        if self.path == "/recommend":
            semantic = dict(ranked)
            interests = set(data["tags"])
            matches = []

            for i, spot in enumerate(spots):
                spot_tags = set(spot.get("tags") or [])
                shared = interests & spot_tags
                overlap = len(shared) / len(interests | spot_tags) if shared else 0
                similarity = semantic.get(i, 0)
                if shared or similarity >= 0.45:
                    matches.append({"id": spot["id"], "score": similarity + 0.30 * overlap})
            matches.sort(key=lambda match: match["score"], reverse=True)
            self.send_json(200, {"matches": matches[:5]})
            return

        min_score = 0.45

        strong_matches = [(index, score) for index, score in ranked if score >= min_score]
        matches = [
            {"id": spots[index]["id"], "score": score}
            for index, score in strong_matches[:5]
        ]
        self.send_json(200, {"matches": matches})


if __name__ == "__main__":
    host = os.environ.get("HOST", "127.0.0.1")
    RankHandler.word_vectors = load_word_vectors()
    with HTTPServer((host, 8000), RankHandler) as server:
        print(f"Rank endpoint listening on http://{host}:8000/rank")
        server.serve_forever()
