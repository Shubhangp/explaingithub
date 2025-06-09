# Use Node.js LTS version
FROM node:18-slim AS build

# Set working directory
WORKDIR /app

# Accept build argument and set as environment variable
ARG OPENAI_API_KEY
ENV OPENAI_API_KEY=$OPENAI_API_KEY

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy project files
COPY . .

# Build the Next.js app
RUN npm run build

# Production image
FROM node:18-slim

WORKDIR /app

# Copy package.json files for production install
COPY --from=build /app/package*.json ./

# Copy Next.js build output and other necessary files
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.js ./

# Install only production dependencies
RUN npm ci --only=production

# Set environment to production
ENV NODE_ENV=production
ENV PORT=8080

# Expose the port
EXPOSE 8080

# Start the application
CMD ["npm", "run", "start"] 