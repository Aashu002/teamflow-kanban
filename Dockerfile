# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Prepare the Node.js backend
FROM node:20-alpine
WORKDIR /app

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm install --production

# Copy server code
COPY server/ ./server/

# Copy built frontend assets from Stage 1
COPY --from=frontend-builder /app/client/dist ./client/dist

# Expose port (corresponds to server/index.js default or PORT env)
EXPOSE 3001

# Set production environment
ENV NODE_ENV=production

# Start the application
CMD ["node", "server/index.js"]
