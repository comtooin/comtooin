# Stage 1: Build Frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN chmod +x node_modules/.bin/react-scripts
RUN npm run build

# Stage 2: Build Backend
FROM node:18-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./
RUN chmod +x node_modules/.bin/tsc
RUN npm run build

# Stage 3: Final Production Image
FROM node:18-alpine
WORKDIR /app

# Copy backend dependencies and built code
COPY --from=backend-builder /app/backend/package*.json ./
RUN npm install --production
COPY --from=backend-builder /app/backend/dist ./dist

# Copy frontend build from the frontend-builder stage
COPY --from=frontend-builder /app/frontend/build ./build

# Copy other necessary backend assets
COPY backend/db ./db
COPY backend/uploads ./uploads

# Expose the port the app runs on
EXPOSE 3001

# Set environment variables for Cloud Run
ENV PORT 3001
ENV HOST 0.0.0.0

# Start the server
CMD [ "node", "dist/index.js" ]
