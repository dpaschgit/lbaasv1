# Dockerfile for Backend API Service

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies that might be needed by some Python packages
# (e.g., for cryptography or other C extensions)
# RUN apt-get update && apt-get install -y --no-install-recommends gcc libffi-dev musl-dev && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY requirements.txt requirements.txt

# Install Python dependencies
# Using --no-cache-dir to reduce image size
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 8000

# Command to run the application
# The backend_api/main.py uses app.on_event("startup") for MongoDB connection.
# Ensure MONGODB_URL environment variable is set in docker-compose.yml to point to the mongo service.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

