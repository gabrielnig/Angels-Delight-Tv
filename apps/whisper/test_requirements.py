import os
import re
import unittest


class RequirementsTest(unittest.TestCase):
    def names(self):
        path = os.path.join(os.path.dirname(__file__), "requirements.txt")
        with open(path, encoding="utf-8") as handle:
            lines = [line.strip() for line in handle if line.strip() and not line.startswith("#")]
        return {re.split(r"[=<>~! \[]", line, maxsplit=1)[0].lower() for line in lines}

    def test_requests_is_installed_because_faster_whisper_imports_it_at_load_time(self):
        # faster-whisper 1.1.1 does `import requests` in faster_whisper/utils.py but newer huggingface_hub no longer
        # brings it in, so the model failed to load in the image with ModuleNotFoundError and every caption job failed.
        self.assertIn("requests", self.names())
        self.assertIn("faster-whisper", self.names())


if __name__ == "__main__":
    unittest.main()
