"""Search fictional tourism spots using averaged pretrained Word2Vec vectors."""
import argparse
import csv
import json
import os
import re
import time
from collections import Counter
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent
MODEL_NAME = 'word2vec-google-news-300'
STOP_WORDS = set(
    'a an the i me my we our to for of in on at and or with where can want somewhere place'.split()
)


def spot_texts(spots):
    return [spot['name'] + ' ' + spot['description'] for spot in spots]


def tokens(text):
    """Lowercase the text and remove common filler words."""
    return [word for word in re.findall('[a-z]+', text.lower()) if word not in STOP_WORDS]


def load_data(directory):
    """Read our fixed CSV fixtures."""
    with (directory / 'spots.csv').open(encoding='utf-8', newline='') as file:
        spots = list(csv.DictReader(file))
    with (directory / 'queries.csv').open(encoding='utf-8', newline='') as file:
        queries = list(csv.DictReader(file))
    return spots, queries


def load_word_vectors(path=None):
    """Load an existing binary file, or download/cache Google News Word2Vec."""
    if path is not None:
        from gensim.models import KeyedVectors
        return KeyedVectors.load_word2vec_format(str(path), binary=True)

    os.environ.setdefault('GENSIM_DATA_DIR', str(ROOT / 'models'))
    import gensim.downloader as downloader
    print(f'Loading {MODEL_NAME} (first download is about 1.7 GB)...')
    return downloader.load(MODEL_NAME)


def encode(text, word_vectors):
    """Average known word vectors and normalize for cosine similarity."""
    known_words = [word for word in tokens(text) if word in word_vectors]
    if not known_words:
        return np.zeros(word_vectors.vector_size, dtype=np.float32)

    vector = np.mean([word_vectors[word] for word in known_words], axis=0)
    length = np.linalg.norm(vector)
    return vector / length if length else vector


def score_query(query, word_vectors, documents):
    """Compare a query with the cached spot vectors. Reject unknown-only text."""
    query_vector = encode(query, word_vectors)
    if not np.any(query_vector):
        return np.full(len(documents), -np.inf)

    scores = documents @ query_vector
    scores[~documents.any(axis=1)] = -np.inf
    return scores


def lexical_vectors(texts, vocabulary, idf):
    vectors = np.zeros((len(texts), len(vocabulary)))
    for i, text in enumerate(texts):
        counts = Counter(tokens(text))
        for word, count in counts.items():
            if word in vocabulary:
                vectors[i, vocabulary[word]] = (1 + np.log(count)) * idf[vocabulary[word]]
    return vectors / np.maximum(np.linalg.norm(vectors, axis=1, keepdims=True), 1e-12)


def baseline(spots, queries):
    """Compare against TF-IDF keyword search fitted only on spot text."""
    texts = spot_texts(spots)
    words = sorted({word for text in texts for word in tokens(text)})
    vocabulary = {word: index for index, word in enumerate(words)}
    document_frequency = Counter(word for text in texts for word in set(tokens(text)))
    idf = np.array([
        np.log((1 + len(texts)) / (1 + document_frequency[word])) + 1
        for word in vocabulary
    ])
    documents = lexical_vectors(texts, vocabulary, idf)
    elapsed = []
    scores = []
    for query in queries:
        start = time.perf_counter()
        query_vector = lexical_vectors([query['query']], vocabulary, idf)[0]
        values = documents @ query_vector
        if not np.any(query_vector):
            values[:] = -np.inf
        else:
            values[~documents.any(axis=1)] = -np.inf
        scores.append(values)
        elapsed.append(1000 * (time.perf_counter() - start))
    return np.array(scores), float(np.mean(elapsed))


def metrics(scores, queries, spots):
    """Measure rankings against the labeled relevant spots for each query."""
    spot_ids = [spot['spot_id'] for spot in spots]
    rows = []
    for values, query in zip(scores, queries):
        ranking = np.argsort(-values, kind='stable')
        ranked = [spot_ids[i] for i in ranking if np.isfinite(values[i])]
        relevant_ids = set(query['relevant_ids'].split('|'))
        hits = len(set(ranked[:3]) & relevant_ids)
        rank = next((i + 1 for i, sid in enumerate(ranked) if sid in relevant_ids), None)
        rows.append({
            'query_id': query['query_id'],
            'query': query['query'],
            'relevant_ids': sorted(relevant_ids),
            'top3': ranked[:3],
            'precision_at_3': hits / 3,
            'recall_at_3': hits / len(relevant_ids),
            'hit_at_1': float(bool(ranked) and ranked[0] in relevant_ids),
            'reciprocal_rank': 1 / rank if rank else 0.0,
        })
    keys = ['precision_at_3', 'recall_at_3', 'hit_at_1', 'reciprocal_rank']
    averages = {key: float(np.mean([row[key] for row in rows])) for key in keys}
    return averages, rows


def run(args):
    """Evaluate Word2Vec and keyword search on the existing test queries."""
    spots, queries = load_data(args.data)
    test_queries = [query for query in queries if query['split'] == 'test']
    word_vectors = load_word_vectors(args.vectors)
    documents = np.array([encode(text, word_vectors) for text in spot_texts(spots)])

    scores = []
    elapsed = []
    for query in test_queries:
        start = time.perf_counter()
        scores.append(score_query(query['query'], word_vectors, documents))
        elapsed.append(1000 * (time.perf_counter() - start))
    semantic_metrics, semantic_rows = metrics(scores, test_queries, spots)
    keyword_scores, keyword_ms = baseline(spots, test_queries)
    keyword_metrics, keyword_rows = metrics(keyword_scores, test_queries, spots)

    report = {
        'model': str(args.vectors.resolve()) if args.vectors else MODEL_NAME,
        'vector_size': word_vectors.vector_size,
        'spots': len(spots),
        'test_queries': len(test_queries),
        'data_notice': 'Assistant-authored fictional fixtures, not independent user judgments.',
        'word2vec': {**semantic_metrics, 'mean_query_ms': float(np.mean(elapsed))},
        'keyword': {**keyword_metrics, 'mean_query_ms': keyword_ms},
    }
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / 'metrics.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    rows = [
        {'method': method, **row}
        for method, method_rows in [('word2vec', semantic_rows), ('keyword', keyword_rows)]
        for row in method_rows
    ]
    with (args.output / 'rankings.csv').open('w', newline='', encoding='utf-8') as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0]))
        writer.writeheader()
        for row in rows:
            writer.writerow({
                key: '|'.join(value) if isinstance(value, list) else value
                for key, value in row.items()
            })
    print(json.dumps(report, indent=2))


def search(args):
    """Print the three closest spots for a search."""
    # Search needs only the spot catalog, not the evaluation query fixtures.
    with (args.data / 'spots.csv').open(encoding='utf-8', newline='') as file:
        spots = list(csv.DictReader(file))
    word_vectors = load_word_vectors(args.vectors)
    documents = np.array([encode(text, word_vectors) for text in spot_texts(spots)])
    scores = score_query(args.query, word_vectors, documents)
    if not np.isfinite(scores).any():
        print('No recognized search words or searchable spots. Try another search.')
        return

    ranking = np.argsort(-scores, kind='stable')
    matches = [index for index in ranking if np.isfinite(scores[index])][:3]
    for index in matches:
        spot = spots[index]
        print(f"{scores[index]:.3f}  {spot['name']}: {spot['description']}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    run_parser = commands.add_parser('run', help='Compare Word2Vec with keyword search')
    run_parser.add_argument('--output', type=Path, default=ROOT / 'results-word2vec')
    search_parser = commands.add_parser('search', help='Search the spot catalog')
    search_parser.add_argument('query')
    for command in [run_parser, search_parser]:
        command.add_argument('--data', type=Path, default=ROOT / 'data')
        command.add_argument('--vectors', type=Path, help='Optional Word2Vec binary (.bin or .bin.gz)')
    args = parser.parse_args()
    if args.command == 'run':
        run(args)
    else:
        search(args)


if __name__ == '__main__':
    main()
