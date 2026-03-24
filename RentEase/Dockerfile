# Use official Python image
FROM python:3.11

# Prevent Python from writing pyc files
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1


# Set work directory
WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Copy project
COPY . /app/

# Expose port
EXPOSE 8000

# Start server
CMD ["gunicorn", "RentEase.wsgi:application", "--bind", "0.0.0.0:8000"]
