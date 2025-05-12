# Dockerfile for AVI Translator Service

FROM python:3.11-slim

WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on (e.g., 8004)
EXPOSE 8004

# Command to run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8004"]

