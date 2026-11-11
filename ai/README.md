# HotSpots semantic search experiment

A small tourism search prototype using **pretrained Google News Word2Vec**.
There is no custom neural network or training loop, and PyTorch is no longer needed.

## Setup

Use Python 3.12, from this repository's root:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m unittest -v
python experiment.py search "finish homework over a cup of coffee"
python experiment.py run
```

The first search or evaluation downloads `word2vec-google-news-300` through Gensim.
The download is about **1.7 GB**, with several GB of RAM needed when loaded.
It is cached in `models/` (ignored by Git); later runs reuse it but still need time
and memory to load it. If `GENSIM_DATA_DIR` is already set, that directory is used.

If you already have a pretrained Word2Vec binary, skip the download:

```powershell
python experiment.py search "rent a kayak" --vectors models/GoogleNews-vectors-negative300.bin.gz
python experiment.py run --vectors models/GoogleNews-vectors-negative300.bin.gz
```

`--vectors` accepts binary Word2Vec format, including gzip-compressed files.
These are not the previous PyTorch `.pt` checkpoints.

## How it works

1. Combine each spot's name and description.
2. Lowercase the text, extract alphabetic words, and remove `STOP_WORDS`.
3. Look up each known word's pretrained vector.
4. Average those vectors and normalize the result.
5. Do the same for the query and rank spots by cosine similarity.

Word2Vec supplies its own vocabulary and 300-dimensional word vectors. We no longer
build numeric word IDs, pad inputs, train embeddings, or select checkpoints.
Unknown words are ignored. Text with no known words has a zero vector; an unknown-only
search returns a message, and spots with zero vectors are excluded from search results.
The lowercase tokenizer uses exact word lookup, so capitalized-only vocabulary entries
and multiword phrase entries in Google News are not used.

## Evaluation

`python experiment.py run` compares averaged Word2Vec with a TF-IDF keyword baseline
on the 24 queries labeled `test` in `data/queries.csv`. Neither method trains on the
query labels. The existing train/validation rows are kept as fixtures but are unused.
TF-IDF fits only on spot names and descriptions.

Outputs go to `results-word2vec/`:

- `metrics.json`: model source, corpus size, ranking metrics, and mean query time.
- `rankings.csv`: each test query's top three matches for both methods.

Use `--output another-folder` to choose a different output directory.
Metrics are top-1 accuracy, Recall@3, Precision@3, and mean reciprocal rank.
Rejected queries get zero for all four metrics. With two relevant spots per query,
Precision@3 has a maximum of 2/3. Ties use CSV order.
Timings include query encoding and scoring against cached spot vectors, excluding
model loading and spot preparation. This tiny corpus is not a production latency benchmark.

[RESULTS.md](RESULTS.md) summarizes the current Word2Vec findings, examples, and
limitations. The measured scores and output columns are also explained below.

## What the current results mean

The saved [metrics.json](results-word2vec/metrics.json) evaluates **24 test queries
against 24 fictional spots**, with two labeled relevant spots per query. These are
evaluation results; running the experiment does not train or update Word2Vec.

| Metric | Word2Vec | Keyword (TF-IDF) | Meaning |
|---|---:|---:|---|
| Top-1 accuracy (`hit_at_1`) | 100% | 95.83% | How often the first result is relevant. Word2Vec succeeded on 24/24 queries; keyword search on 23/24. |
| Recall@3 (`recall_at_3`) | 95.83% | 72.92% | How many of the expected relevant spots appear in the top three. Word2Vec found 46/48 query-to-spot matches; keyword search found 35/48. |
| Precision@3 (`precision_at_3`) | 63.89% | 48.61% | How many of the three result slots contain relevant spots. Word2Vec filled 46/72 slots correctly; keyword search filled 35/72. |
| Mean reciprocal rank (`reciprocal_rank`) | 1.000 | 0.958 | Average of 1 divided by the position of the first relevant result; a rejected search gets 0. Higher is better. |
| Mean query time (`mean_query_ms`) | 0.040 ms | 0.031 ms | Average query encoding and scoring time, excluding model loading and spot preparation. Lower is faster. |

**Why isn't Precision@3 close to 100%?** Each query has only two relevant spots.
Even a perfect top three contains one spot labeled irrelevant, so the maximum is
2/3, or 66.67%. For example, finding both relevant spots gives Recall@3 = 100%
and Precision@3 = 66.67%.

**Why can top-1 accuracy be 100% while recall is lower?** The first result can be
correct while the second relevant spot is missing from the top three. Word2Vec
missed one relevant spot for each of these searches:

- `patio-9`: "sit under the sky while eating"
- `rain-10`: "friends want tabletop entertainment when it rains"

Keyword search rejected "a peaceful desk where I can focus" because none of its
remaining tokens appeared in the spot-text vocabulary. That query scores zero
on all four quality metrics. For every other keyword query, the first result was
relevant, which is why its top-1 accuracy and mean reciprocal rank have the same
numeric value here; those metrics need not match in other runs.

### Reading rankings.csv

[rankings.csv](results-word2vec/rankings.csv) contains one row per test query for
each method: 48 rows in this run. It explains the individual searches behind the averages.

| Column | Meaning |
|---|---|
| `method` | `word2vec` or `keyword`. |
| `query_id`, `query` | The query's identifier and search text. |
| `relevant_ids` | The expected relevant spot IDs, separated by `\|`. |
| `top3` | Returned spot IDs in best-first order, separated by `\|`. Empty means the search was rejected. Look up IDs in `data/spots.csv`. |
| `precision_at_3`, `recall_at_3`, `hit_at_1`, `reciprocal_rank` | That individual query's scores, whose averages appear in `metrics.json`. |

For example, "finish homework over a cup of coffee" expects `study1` and `study2`.
Word2Vec returns `study1`, `study2`, then `music1`. Both expected spots are present,
and the first result is correct: precision is 2/3, recall is 1, top-1 is 1, and
reciprocal rank is 1.

The quality metrics are proportions: `0.9583` corresponds to 95.83%. **The cosine
similarity scores printed by the search command are not percentages or probabilities.**
They describe vector similarity, not the chance a result is correct.

### What this says about feasibility

On these fixtures, averaged pretrained Word2Vec retrieves more labeled relevant
spots than keyword search, with a **22.92 percentage-point improvement in Recall@3**.
Both methods score this small catalog quickly; the tiny timing difference does not
establish a meaningful production speed advantage.

This supports using pretrained word vectors as a search baseline. It does not prove
real-tourist search quality or that a model trained from scratch would perform as
well. The dataset is small and assistant-authored, and Word2Vec brings knowledge
learned from a much larger external corpus. A stronger feasibility study needs
independently written queries, reviewed relevance labels, and a larger real catalog.
Compare any future custom-trained model against these baselines on the same held-out
queries, without tuning to those test queries.

These numbers describe the currently saved run. If you change the data or model and
rerun evaluation, the output files will change and this table should be updated.

## Files

- `experiment.py`: text processing, Word2Vec search, keyword baseline, and evaluation.
- `RESULTS.md`: current measured findings and feasibility conclusions.
- `test_experiment.py`: offline checks using tiny controlled word vectors, without model downloads.
- `data/spots.csv`: 24 fictional spots.
- `data/queries.csv`: 120 authored queries with relevance labels and fixed splits.
- `make_sample_data.py`: recreates and overwrites the CSV fixtures.
- `requirements.txt`: Gensim and NumPy dependencies.

## Limits

The fixtures are assistant-authored scaffolding, not verified businesses or independently
judged tourist searches. Replace them before drawing project-level conclusions.
Averaging ignores word order and cannot reliably handle negation. Similarity is not
confidence: even a recognized query can return irrelevant spots. Pretrained knowledge
comes from news text and is not tailored to tourism or these relevance labels.

## Sources

- [Gensim Word2Vec model catalog](https://github.com/piskvorky/gensim-data):
  Google News vectors, 3 million word/phrase entries, 300 dimensions.
- [Original Word2Vec project](https://code.google.com/archive/p/word2vec/).
- [Gensim](https://github.com/piskvorky/gensim) (LGPL-2.1) and
  [NumPy](https://numpy.org/about/) (BSD).

Gensim's catalog lists the Google News model license as "not found"; it does not
establish redistribution rights. Model weights are downloaded separately, not bundled here.
