# syntax=docker/dockerfile:1
# Build from the repository root: docker build -f apps/whisper/Dockerfile apps/whisper
FROM python:3.12-slim AS runtime
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 \
    WHISPER_MODEL=small.en WHISPER_COMPUTE_TYPE=int8 WHISPER_MODEL_DIR=/models
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY server.py transcriber.py ./
# The model is downloaded on first start into the /models volume, so the image stays small and the model survives restarts.
RUN useradd --system --uid 10001 whisper && mkdir /models && chown whisper /models
USER whisper
VOLUME ["/models"]
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status == 200 else 1)"
CMD ["python", "server.py"]
