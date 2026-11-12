# Word2Vec feasibility results

These results describe the current pretrained Word2Vec experiment, replacing the
previous PyTorch report. The source measurements are in
[metrics.json](results-word2vec/metrics.json) and the individual query results are in
[rankings.csv](results-word2vec/rankings.csv).

## What was tested

We compared averaged **Google News Word2Vec** vectors (`word2vec-google-news-300`,
300 dimensions) with a **TF-IDF keyword search** baseline. Both methods search the
same 24 fictional spot names and descriptions using the same tokenizer.

Evaluation uses the 24 queries labeled `test` in `data/queries.csv`. Each query has
two labeled relevant spots, giving 48 expected query-to-spot matches. The other
train/validation rows are unused. No model is trained or fine-tuned in this version:
Word2Vec supplies pretrained vectors, and TF-IDF fits only on the spot text.

## Measured results

| Metric | Word2Vec | TF-IDF keyword search |
|---|---:|---:|
| Top-1 accuracy | 100% (24/24 queries) | 95.83% (23/24 queries) |
| Recall@3 | 95.83% (46/48 relevant matches) | 72.92% (35/48 relevant matches) |
| Precision@3 | 63.89% (46/72 result slots) | 48.61% (35/72 result slots) |
| Mean reciprocal rank | 1.000 | 0.958 |
| Mean query time | 0.040 ms | 0.031 ms |

Top-1 accuracy measures whether the first result is relevant. Recall@3 measures
how many expected relevant spots appear in the top three. Precision@3 measures
how many of the three result slots are relevant. Its maximum here is 66.67%,
because only two spots are labeled relevant per query.

Reciprocal rank is 1 divided by the position of the first relevant result, averaged
across queries. Rejected searches score zero on all four quality metrics. Keyword
search rejected one query; every other keyword query had a relevant first result.

The times include query encoding and scoring against prepared spot vectors. They
exclude model download, model loading, and spot-vector preparation. The small
24-spot corpus and tiny measured times do not establish production latency or a
meaningful speed advantage for either method.

## Examples from the saved rankings

- **"finish homework over a cup of coffee"**: Word2Vec returns Study Cafe, Reading
  Room, and Stage Cafe. The first two are labeled relevant: Recall@3 is 100%,
  Precision@3 is 66.67%, and the first result is correct.
- **"a peaceful desk where I can focus"**: Word2Vec returns both relevant study
  spots. Keyword search returns no results because its spot-text vocabulary
  contains none of the query's remaining tokens.
- **"sit under the sky while eating"**: Word2Vec finds one of the two relevant
  patio spots in its top three, giving Recall@3 of 50%.
- **"friends want tabletop entertainment when it rains"**: Word2Vec also finds
  one of the two relevant spots, giving Recall@3 of 50%.

The last two searches account for Word2Vec's two missing relevant matches.
These examples explain the saved run; they were not used to tune this implementation.

## What we can conclude

On these fixtures, pretrained Word2Vec found **11 more relevant matches** in the top
three than keyword search, improving Recall@3 by **22.92 percentage points**. It
also returned a relevant first result for every test query.

This is encouraging evidence for a pretrained semantic-search baseline on this
small catalog. It does not establish real-tourist search quality or prove that a
model trained from scratch would achieve the same results. Word2Vec brings word
relationships learned from a large external news corpus; our fixtures did not teach
it those relationships.

The spots and queries are assistant-authored scaffolding, not verified businesses
or independently judged tourist searches. Related intents and wording make this a
limited evaluation. Averaging ignores word order and handles negation poorly;
unknown words are ignored. Search similarity scores are not probabilities of
relevance, even though the evaluation metrics can be expressed as percentages.

## Next steps

Collect a larger verified catalog and independently written queries, review their
relevance labels, and reserve a fresh test set. If the project requires training
from random weights, build that model and compare it with Word2Vec and keyword
search using the same held-out evaluation. Use a separate development set for
tuning rather than repeatedly adjusting the model to these test queries.

## Reproducing the evaluation

From an environment with the dependencies in `requirements.txt` installed:

```powershell
python -m unittest -v
python experiment.py run
```

The first evaluation downloads the roughly 1.7 GB pretrained model if it is not
cached. Evaluation writes `metrics.json` and `rankings.csv` to `results-word2vec/`.
Use `--output results-new` to preserve the current output files.

The six offline tests check fixture loading, vector averaging and normalization,
unknown-word handling, scoring, metrics, and the model-loading/search/evaluation
paths using controlled vectors. They check implementation behavior, not real-world
search quality.

This report summarizes the currently saved measurements. Update it when the model,
data, or evaluation protocol changes; `run` regenerates the JSON and CSV files,
but does not rewrite this report automatically.
