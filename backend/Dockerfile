# Use official lightweight Python image
FROM python:3.11-slim

# Set environment variables to run Python securely
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=off \
    PIP_DISABLE_PIP_VERSION_CHECK=on \
    PORT=7860

# Install system dependencies needed for compilation (e.g. gcc, git)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set working directory inside the container
WORKDIR /app

# Copy dependencies first to leverage Docker layer caching
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy all backend source files
COPY . .

# Expose port 7860 (Hugging Face default)
EXPOSE 7860

# Start FastAPI server on port 7860 using Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
