"""Compare the three Python AI endpoints with reproducible lexical baselines."""
import csv
import json
from http.server import HTTPServer
from statistics import mean
from threading import Thread
from urllib.request import Request, urlopen

from experiment import MODEL_NAME, ROOT, baseline, load_data, load_word_vectors
from server import RankHandler, TAG_PROFILES


def catalog(rows):
    return [dict(id=r["spot_id"], title=r["name"], description=r["description"]) for r in rows]


def lexical(query, candidates, limit):
    """Rank positive TF-IDF cosine matches using the existing keyword implementation."""
    docs = [{"name": c["title"], "description": c["description"]} for c in candidates]
    scores, _ = baseline(docs, [{"query": query}])
    order = sorted(range(len(docs)), key=lambda i: scores[0][i], reverse=True)
    return [candidates[i]["id"] for i in order if scores[0][i] > 0][:limit]


def ranked_ids(response):
    return [match["id"] for match in response["matches"]]


def evaluate(post):
    examples, queries = load_data(ROOT / "data")
    fixtures = catalog(examples)
    with (ROOT / "data/fort_smith.csv").open(encoding="utf-8", newline="") as file:
        city = catalog(csv.DictReader(file))
    labels = json.loads((ROOT / "data/evaluation_labels.json").read_text(encoding="utf-8"))
    by_id = {s["id"]: s for s in city}
    if set(by_id) != set(labels["tags"]):
        raise ValueError("Every Fort Smith spot needs tag labels")
    rows = []
    for q in queries:
        if q["split"] == "test":
            text = q["query"]
            rows.append(dict(task="search", case=text, expected=q["relevant_ids"].split("|"),
                             ai=ranked_ids(post("/rank", {"query": text, "spots": fixtures})),
                             keyword=lexical(text, fixtures, 5)))

    profiles = [dict(id=tag, title="", description=text) for tag, text in TAG_PROFILES.items()]
    generated = {}
    for spot in city:
        ai_tags = post("/tags", spot)["tags"]
        keyword_tags = lexical(spot["title"] + " " + spot["description"], profiles, 3)
        generated[spot["id"]] = ai_tags
        rows.append(dict(task="tags", case=spot["id"], expected=labels["tags"][spot["id"]],
                         ai=ai_tags, keyword=keyword_tags))

    for case in labels["recommendations"]:
        seed = case.get("seed")
        interests = case.get("interests", [])
        parts = list(interests)
        tags = set(interests)
        if seed:
            parts.extend([by_id[seed]["title"], by_id[seed]["description"]])
            tags.update(generated[seed])
        query = " ".join(parts)
        candidates = [dict(s, tags=generated[s["id"]]) for s in city if s["id"] != seed]
        if not set(case["relevant"]) <= {s["id"] for s in candidates}:
            raise ValueError(f"Invalid recommendation labels for {case}")
        payload = {"query": query, "tags": sorted(tags), "spots": candidates}
        # Both rankers see the same generated tags. Only the comparison method changes.
        docs = [dict(s, description=" ".join([s["description"], *s["tags"]])) for s in candidates]
        rows.append(dict(task=case["mode"], case=query, expected=case["relevant"],
                         ai=ranked_ids(post("/recommend", payload)),
                         keyword=lexical(" ".join([query, *sorted(tags)]), docs, 5)))
    return rows


def summarize(rows, method):
    if rows[0]["task"] == "tags":
        hits = sum(len(set(r["expected"]) & set(r[method])) for r in rows)
        predicted = sum(len(r[method]) for r in rows)
        expected = sum(len(r["expected"]) for r in rows)
        return dict(precision=hits / predicted if predicted else 0,
                    recall=hits / expected, micro_f1=2 * hits / (predicted + expected))
    return dict(hit_at_1=mean(bool(r[method]) and r[method][0] in r["expected"] for r in rows),
                recall_at_5=mean(len(set(r[method][:5]) & set(r["expected"])) / len(r["expected"])
                                 for r in rows))


def main():
    RankHandler.word_vectors = load_word_vectors()
    with HTTPServer(("127.0.0.1", 0), RankHandler) as server:
        thread = Thread(target=server.serve_forever)
        thread.start()

        def post(path, payload):
            request = Request(f"http://127.0.0.1:{server.server_port}{path}",
                              data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
            with urlopen(request, timeout=30) as response:
                return json.load(response)

        try:
            rows = evaluate(post)
        finally:
            server.shutdown()
            thread.join()

    summary = {}
    for task in dict.fromkeys(r["task"] for r in rows):
        group = [r for r in rows if r["task"] == task]
        summary[task] = {m: summarize(group, m) for m in ("ai", "keyword")}
        summary[task]["cases"] = len(group)
    path = ROOT / "results-word2vec" / "ai_evaluation.json"
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(dict(model=MODEL_NAME, summary=summary, cases=rows), indent=2) + "\n",
                    encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
