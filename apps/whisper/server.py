"""Small HTTP service around faster-whisper.

POST /transcribe?language=en   body: audio/wav bytes   ->  JSON with word timestamps
GET  /health                                          ->  JSON status

It runs one transcription at a time (answering 429 with Retry-After while busy), has no storage credentials and
is meant to be reachable only from the worker on the private network.
"""

import json
import os
import re
import sys
import tempfile
import threading
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

DEFAULT_MAX_BYTES = 200 * 1024 * 1024
LANGUAGE = re.compile(r"^[a-z]{2,3}(-[A-Za-z]{2,4})?$")
CHUNK = 1024 * 1024


class State:
    def __init__(self, transcriber, max_bytes):
        self.transcriber = transcriber
        self.max_bytes = max_bytes
        self.lock = threading.Lock()


def make_handler(state):
    class Handler(BaseHTTPRequestHandler):
        server_version = "ad-whisper"
        protocol_version = "HTTP/1.1"

        def log_message(self, fmt, *args):  # no request lines in logs, they may carry query values
            return

        def _send(self, status, payload, extra=None):
            body = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            for name, value in (extra or {}).items():
                self.send_header(name, value)
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            path = urlparse(self.path).path
            if path == "/health":
                self._send(200, {"status": "ok", "model": state.transcriber.model_name, "busy": state.lock.locked()})
            elif path == "/transcribe":
                self._send(405, {"error": "use POST"}, {"Allow": "POST"})
            else:
                self._send(404, {"error": "not found"})

        def do_POST(self):
            parsed = urlparse(self.path)
            if parsed.path != "/transcribe":
                self._send(404, {"error": "not found"})
                return
            language = parse_qs(parsed.query).get("language", ["en"])[0]
            if not LANGUAGE.match(language):
                self._send(400, {"error": "invalid language"})
                return
            if self.headers.get("Content-Type", "").split(";")[0].strip() not in ("audio/wav", "audio/x-wav"):
                self._send(415, {"error": "send audio/wav"})
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                length = 0
            if length <= 0:
                self._send(400, {"error": "empty body"})
                return
            if length > state.max_bytes:
                self.close_connection = True
                self._send(413, {"error": "audio too large"})
                return
            if not state.lock.acquire(blocking=False):
                self._send(429, {"error": "busy"}, {"Retry-After": "30"})
                return
            path = None
            try:
                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as handle:
                    path = handle.name
                    remaining = length
                    while remaining > 0:
                        chunk = self.rfile.read(min(CHUNK, remaining))
                        if not chunk:
                            break
                        handle.write(chunk)
                        remaining -= len(chunk)
                if remaining > 0:
                    self._send(400, {"error": "body ended early"})
                    return
                result = state.transcriber.transcribe(path, language)
                self._send(200, result)
            except Exception:  # never leak internals to the caller, but tell the operator what broke
                print("transcription failed:\n" + traceback.format_exc(), file=sys.stderr, flush=True)
                self._send(500, {"error": "transcription failed"})
            finally:
                if path and os.path.exists(path):
                    os.unlink(path)
                state.lock.release()

    return Handler


def make_server(host, port, transcriber, max_bytes=DEFAULT_MAX_BYTES):
    state = State(transcriber, max_bytes)
    return ThreadingHTTPServer((host, port), make_handler(state))


def main():
    from transcriber import FasterWhisperTranscriber

    transcriber = FasterWhisperTranscriber(
        model_name=os.environ.get("WHISPER_MODEL", "small.en"),
        compute_type=os.environ.get("WHISPER_COMPUTE_TYPE", "int8"),
        model_dir=os.environ.get("WHISPER_MODEL_DIR") or None,
        cpu_threads=int(os.environ.get("WHISPER_CPU_THREADS", "0")),
    )
    host = os.environ.get("WHISPER_HOST", "0.0.0.0")
    port = int(os.environ.get("WHISPER_PORT", "8000"))
    max_bytes = int(os.environ.get("WHISPER_MAX_BYTES", str(DEFAULT_MAX_BYTES)))
    server = make_server(host, port, transcriber, max_bytes)
    print("whisper service listening on %s:%d with model %s" % (host, port, transcriber.model_name), flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
