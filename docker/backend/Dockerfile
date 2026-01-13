# 聲聲慢 Backend Dockerfile
# Sherpa-ONNX based ASR service

FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements-web.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements-web.txt

# Copy application code
COPY sherpa_server.py .
COPY sherpa_web_server.py .

# Copy models directory (if exists)
# Models should be mounted as volume in production
COPY models/ ./models/ 2>/dev/null || true

# Environment variables
ENV HOST=0.0.0.0
ENV PORT=8765
ENV PYTHONUNBUFFERED=1

# Expose port
EXPOSE 8765

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8765/health')" || exit 1

# Run the server
CMD ["python", "sherpa_web_server.py"]
