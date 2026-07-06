FROM python:3.10-slim

WORKDIR /app

# Install python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Run the analytics service
CMD ["python", "main.py"]
