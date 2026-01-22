FROM node:24-alpine

WORKDIR /app

# Install dependencies for node-gyp (needed for some packages)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Create uploads directory
RUN mkdir -p uploads && chmod 755 uploads

# Expose port
EXPOSE 3000

# Start command (nodemon for development)
CMD ["npm", "run", "dev"]
