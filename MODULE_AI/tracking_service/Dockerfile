FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for OpenCV and GStreamer
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Optimize models at build time: OSNet -> ONNX, YOLOv8 -> OpenVINO IR
RUN python scripts/export_onnx.py && python scripts/export_yolo_openvino.py

ENV RELOAD=false

# Run the tracking service
CMD ["python", "run.py"]
