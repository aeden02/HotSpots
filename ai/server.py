import json
from http.server import BaseHTTPRequestHandler, HTTPServer

from experiment import load_word_vectors, search


class RankHandler(BaseHTTPRequestHandler):
    def send_json(self, status, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != "/rank":
            self.send_json(404, {"error": "Route not found"})
            return

        length = int(self.headers["Content-Length"])
        data = json.loads(self.rfile.read(length))
        query = data["query"]
        spots = data["spots"]

        spot_profiles = [
            " ".join((spot.get("title") or "", spot.get("description") or ""))
            for spot in spots
        ]

        min_score = .45 #tune this threshold to get more/less results
        ranked = search(query, spot_profiles, self.word_vectors)

        strong_matches = [(index, score) for index, score in ranked if score >= min_score]
        matches = [
            {"id": spots[index]["id"], "score": score}
            for index, score in strong_matches[:5]
        ]
        self.send_json(200, {"matches": matches})


if __name__ == "__main__":
    RankHandler.word_vectors = load_word_vectors()
    with HTTPServer(("127.0.0.1", 8000), RankHandler) as server:
        print("Rank endpoint listening on http://127.0.0.1:8000/rank")
        server.serve_forever()
