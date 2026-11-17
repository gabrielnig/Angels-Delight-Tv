"""Speech recognition behind a tiny interface, so the HTTP layer can be tested without a model."""

import threading


class FasterWhisperTranscriber:
    """faster-whisper on CPU. The model loads on first use and is kept for the life of the process."""

    def __init__(self, model_name="small.en", compute_type="int8", device="cpu", model_dir=None, cpu_threads=0):
        self.model_name = model_name
        self._compute_type = compute_type
        self._device = device
        self._model_dir = model_dir
        self._cpu_threads = cpu_threads
        self._model = None
        self._load_lock = threading.Lock()

    def _load(self):
        with self._load_lock:
            if self._model is None:
                from faster_whisper import WhisperModel  # imported late so tests never need it

                self._model = WhisperModel(
                    self.model_name,
                    device=self._device,
                    compute_type=self._compute_type,
                    download_root=self._model_dir,
                    cpu_threads=self._cpu_threads,
                )
        return self._model

    def transcribe(self, path, language):
        model = self._load()
        segments, info = model.transcribe(
            path,
            language=language or None,
            word_timestamps=True,
            vad_filter=True,
            beam_size=5,
        )
        words = []
        for segment in segments:
            for word in segment.words or []:
                text = word.word.strip()
                if text:
                    words.append(
                        {
                            "word": text,
                            "start": round(word.start, 3),
                            "end": round(word.end, 3),
                            "probability": round(word.probability, 3),
                        }
                    )
        return {
            "language": info.language,
            "duration": round(info.duration, 3),
            "model": self.model_name,
            "words": words,
        }
