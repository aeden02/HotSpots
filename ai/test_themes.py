import io
import json
import unittest
from unittest.mock import patch

from themes import generate_themes


class ThemeTests(unittest.TestCase):
    def setUp(self):
        self.spots = [
            {"id": "cafe", "title": "Corner Cafe", "tags": ["coffee", "quiet", "coffee"]},
            {"id": "park", "title": "City Park", "tags": ["outdoors"]},
            {"id": "library", "title": "Library"},
        ]

    @patch("themes.urlopen")
    def test_ollama_output_is_grounded_in_the_supplied_catalog(self, urlopen):
        names = ["Coffee Break", "Fresh Air", "Quiet Afternoon", "Read Local", "A Walk and a Sip"]
        model_themes = [
            {"name": name, "description": "A short outing.", "spotIds": ids}
            for name, ids in zip(names, [
                ["cafe", "made-up", "cafe"], ["park"], ["library", "cafe"],
                ["library"], ["park", "cafe"],
            ])
        ]
        urlopen.return_value = io.BytesIO(json.dumps({
            "message": {"content": json.dumps({"themes": model_themes})},
        }).encode())

        result = generate_themes(self.spots)

        self.assertEqual(result["source"], "ai")
        self.assertEqual([theme["name"] for theme in result["themes"]], names)
        self.assertEqual(result["themes"][0]["spotIds"], ["cafe"])
        request = urlopen.call_args.args[0]
        body = json.loads(request.data)
        self.assertFalse(body["stream"])
        self.assertEqual(body["format"]["properties"]["themes"]["minItems"], 5)
        self.assertEqual(json.loads(body["messages"][1]["content"]), self.spots)

    @patch("themes.request_themes", side_effect=TimeoutError)
    def test_timeout_groups_by_tags_and_keeps_untagged_spots(self, request_themes):
        result = generate_themes(self.spots)
        self.assertEqual(result["source"], "tags")
        self.assertEqual({theme["name"]: theme["spotIds"] for theme in result["themes"]}, {
            "coffee": ["cafe"], "quiet": ["cafe"], "outdoors": ["park"], "Untagged spots": ["library"],
        })

    @patch("themes.request_themes")
    def test_duplicate_and_invalid_collections_trigger_fallback(self, request_themes):
        request_themes.return_value = {"themes": [
            {"name": name, "description": "Take a break.", "spotIds": ids}
            for name, ids in [
                ("Coffee", ["cafe"]), (" coffee ", ["cafe"]), ("Walk", ["park"]),
                ("Read", ["library"]), ("Invented", ["unknown"]),
            ]
        ]}
        self.assertEqual(generate_themes(self.spots)["source"], "tags")

    @patch("themes.request_themes")
    def test_empty_catalog_skips_the_model(self, request_themes):
        self.assertEqual(generate_themes([]), {"source": "tags", "themes": []})
        request_themes.assert_not_called()

    @patch("themes.request_themes", side_effect=TimeoutError)
    def test_fallback_lists_each_spot_once_per_tag(self, request_themes):
        result = generate_themes([self.spots[0], self.spots[0]])
        self.assertEqual(result["themes"][0]["spotIds"], ["cafe"])
