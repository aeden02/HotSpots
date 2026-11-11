"""Offline checks with controlled word vectors; no pretrained download needed."""
import contextlib
import io
import json
import os
import tempfile
import unittest
from argparse import Namespace
from pathlib import Path
from unittest.mock import patch

import numpy as np
from gensim.models import KeyedVectors

from experiment import ROOT, encode, load_data, load_word_vectors, metrics, run, score_query, search


class ExperimentTests(unittest.TestCase):
    def setUp(self):
        self.vectors = KeyedVectors(vector_size=2)
        self.vectors.add_vectors(
            ['quiet', 'cafe', 'coffee'],
            np.array([[1, 0], [0, 1], [0, 1]], dtype=np.float32),
        )

    def test_data(self):
        spots, queries = load_data(ROOT / 'data')
        self.assertEqual(len(spots), 24)
        self.assertEqual(len(queries), 120)

    def test_average_and_normalization_ignore_unknown_words(self):
        actual = encode('I want a QUIET cafe spaceship!', self.vectors)
        np.testing.assert_allclose(actual, [1 / np.sqrt(2), 1 / np.sqrt(2)])
        np.testing.assert_array_equal(encode('spaceship', self.vectors), [0, 0])
        np.testing.assert_array_equal(encode('', self.vectors), [0, 0])

    def test_scoring_rejects_unknowns_and_excludes_empty_documents(self):
        documents = np.array([[0, 1], [1, 0], [0, 0]], dtype=np.float32)
        scores = score_query('coffee', self.vectors, documents)
        np.testing.assert_array_equal(scores[:2], [1, 0])
        self.assertEqual(scores[2], -np.inf)
        self.assertTrue(np.isneginf(score_query('spaceship', self.vectors, documents)).all())

    def test_metrics_include_rejected_queries(self):
        spots = [{'spot_id': str(i)} for i in range(4)]
        queries = [
            {'query_id': 'q1', 'query': 'coffee', 'relevant_ids': '1|2'},
            {'query_id': 'q2', 'query': 'spaceship', 'relevant_ids': '1|2'},
        ]
        scores = np.array([[0, 3, 2, 1], [-np.inf] * 4])
        result, rows = metrics(scores, queries, spots)
        self.assertAlmostEqual(result['precision_at_3'], 1 / 3)
        self.assertEqual(result['recall_at_3'], 0.5)
        self.assertEqual(result['hit_at_1'], 0.5)
        self.assertEqual(result['reciprocal_rank'], 0.5)
        self.assertEqual(rows[1]['top3'], [])

    def test_binary_loader_and_commands(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            binary = directory / 'tiny.bin'
            self.vectors.save_word2vec_format(str(binary), binary=True)
            loaded = load_word_vectors(binary)
            np.testing.assert_array_equal(loaded['coffee'], [0, 1])
            output = directory / 'results'
            args = Namespace(data=ROOT / 'data', vectors=binary, output=output, query='coffee')
            with contextlib.redirect_stdout(io.StringIO()) as stream:
                run(args)
                search(args)
            self.assertIn('Cafe', stream.getvalue())
            report = json.loads((output / 'metrics.json').read_text())
            self.assertEqual(report['test_queries'], 24)
            self.assertEqual(report['vector_size'], 2)
            self.assertTrue((output / 'rankings.csv').is_file())
            args.query = 'zzzzzz'
            with contextlib.redirect_stdout(io.StringIO()) as stream:
                search(args)
            self.assertIn('No recognized search words', stream.getvalue())

    @patch.dict(os.environ, {'GENSIM_DATA_DIR': str(ROOT / 'models')})
    def test_default_model_loader(self):
        with patch('gensim.downloader.load', return_value=self.vectors) as download:
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertIs(load_word_vectors(), self.vectors)
            download.assert_called_once_with('word2vec-google-news-300')


if __name__ == '__main__':
    unittest.main()
