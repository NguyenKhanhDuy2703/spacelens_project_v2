FROM python:3.10-slim-bookworm

WORKDIR /app

# Fix OS-level CVEs: perl, gzip, sqlite, pcre2 (all have fixed versions in Debian repo)
RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Fix Python vendor CVEs: upgrade pip + setuptools to get latest jaraco.context & wheel
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools \
    && pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Run the analytics service
CMD ["python", "main.py"]
