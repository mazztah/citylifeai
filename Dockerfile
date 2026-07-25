# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
# Inject production API URL if needed, or use relative paths
# For a unified deployment, we can serve frontend from the same origin as backend
RUN npm run build

# Stage 2: Final Image
FROM python:3.12-slim
WORKDIR /app

# Install system dependencies for psycopg2 and static file serving
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Backend dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Install Telegram Bot dependencies
COPY telegram-bot/requirements.txt ./telegram-bot/
RUN pip install --no-cache-dir -r telegram-bot/requirements.txt

# Copy all source code
COPY . .

# Copy built frontend assets to a directory the backend can serve
COPY --from=frontend-builder /app/frontend/dist ./static

# Expose port
EXPOSE 8000

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Start script to run both backend and bot if desired, 
# but Fly.io usually prefers one process per app.
# We will default to running the backend and provide instructions for the bot.
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
