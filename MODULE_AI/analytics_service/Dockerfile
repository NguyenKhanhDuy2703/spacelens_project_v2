FROM python:3.10-slim-bookworm

WORKDIR /app

# Upgrade base OS packages to patch known Debian CVEs
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

# Install python packages with latest pip
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Run the analytics service
CMD ["python", "main.py"]
