FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for OpenCV and GStreamer
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Run the tracking service
CMD ["python", "run.py"]
