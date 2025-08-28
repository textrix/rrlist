FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy the entrypoint script
COPY entrypoint.sh ./
RUN chmod +x /app/entrypoint.sh

# Copy source code
COPY . .

# Set production environment
ENV NODE_ENV=production
ENV PORT=3003

# Create config directory
RUN mkdir -p /config

EXPOSE 3003

# Use the shared entrypoint script
ENTRYPOINT ["sh", "/app/entrypoint.sh"]
