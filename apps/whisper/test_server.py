import contextlib
import io
import json
import threading
import time
import unittest
import urllib.error
import urllib.request

from server import make_server


class FakeTranscriber:
    model_name = "fake.en"

    def __init__(self, delay=0.0, fail=False):
        self.delay = delay
        self.fail = fail
        self.calls = []

    def transcribe(self, path, language):
        with open(path, "rb") as handle:
            size = len(handle.read())
        self.calls.append((size, language))
        if self.delay:
            time.sleep(self.delay)
        if self.fail:
            raise RuntimeError("boom with secret detail")
        return {
            "language": language or "en",
            "duration": 4.25,
            "model": self.model_name,
            "words": [{"word": "Hello", "start": 0.1, "end": 0.5, "probability": 0.99}],
        }


def request(base, method, path, body=None, headers=None):
    req = urllib.request.Request(base + path, data=body, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            return response.status, dict(response.headers), response.read()
    except urllib.error.HTTPError as error:
        return error.code, dict(error.headers), error.read()


class ServerTest(unittest.TestCase):
    def start(self, transcriber, max_bytes=1024):
        server = make_server("127.0.0.1", 0, transcriber, max_bytes=max_bytes)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(server.shutdown)
        self.addCleanup(server.server_close)
        return "http://127.0.0.1:%d" % server.server_address[1]

    def test_health(self):
        base = self.start(FakeTranscriber())
        status, _, body = request(base, "GET", "/health")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["model"], "fake.en")

    def test_transcribes_posted_audio(self):
        fake = FakeTranscriber()
        base = self.start(fake)
        status, headers, body = request(
            base, "POST", "/transcribe?language=en", b"RIFFdata", {"Content-Type": "audio/wav"}
        )
        self.assertEqual(status, 200)
        self.assertEqual(headers["Cache-Control"], "no-store")
        data = json.loads(body)
        self.assertEqual(data["words"][0]["word"], "Hello")
        self.assertEqual(data["duration"], 4.25)
        self.assertEqual(fake.calls, [(8, "en")])

    def test_rejects_bad_requests(self):
        base = self.start(FakeTranscriber(), max_bytes=10)
        self.assertEqual(request(base, "POST", "/transcribe", b"", {"Content-Type": "audio/wav"})[0], 400)
        self.assertEqual(request(base, "POST", "/transcribe", b"x" * 11, {"Content-Type": "audio/wav"})[0], 413)
        self.assertEqual(request(base, "POST", "/transcribe", b"abc", {"Content-Type": "text/plain"})[0], 415)
        self.assertEqual(request(base, "POST", "/transcribe?language=../../etc", b"abc", {"Content-Type": "audio/wav"})[0], 400)
        self.assertEqual(request(base, "GET", "/transcribe")[0], 405)
        self.assertEqual(request(base, "GET", "/nothing")[0], 404)

    def test_hides_internal_errors(self):
        base = self.start(FakeTranscriber(fail=True))
        status, _, body = request(base, "POST", "/transcribe", b"abc", {"Content-Type": "audio/wav"})
        self.assertEqual(status, 500)
        self.assertNotIn(b"secret", body)

    def test_logs_the_error_type_for_the_operator_but_not_to_the_caller(self):
        base = self.start(FakeTranscriber(fail=True))
        captured = io.StringIO()
        with contextlib.redirect_stderr(captured):
            status, _, body = request(base, "POST", "/transcribe", b"abc", {"Content-Type": "audio/wav"})
        self.assertEqual(status, 500)
        self.assertIn("RuntimeError", captured.getvalue())
        self.assertNotIn(b"RuntimeError", body)

    def test_one_job_at_a_time_and_health_stays_responsive(self):
        base = self.start(FakeTranscriber(delay=0.6))
        results = []

        def first():
            results.append(request(base, "POST", "/transcribe", b"abc", {"Content-Type": "audio/wav"})[0])

        thread = threading.Thread(target=first)
        thread.start()
        time.sleep(0.2)
        status, headers, _ = request(base, "POST", "/transcribe", b"abc", {"Content-Type": "audio/wav"})
        self.assertEqual(status, 429)
        self.assertIn("Retry-After", headers)
        self.assertEqual(request(base, "GET", "/health")[0], 200)
        thread.join()
        self.assertEqual(results, [200])


if __name__ == "__main__":
    unittest.main()
