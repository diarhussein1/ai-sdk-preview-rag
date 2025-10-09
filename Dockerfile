FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package*.json ./
RUN npm install

# Copy source files (excluding .next, node_modules via .dockerignore)
COPY . .

# Clean any cached build artifacts
RUN rm -rf .next .swc

EXPOSE 3000

# Use dev mode instead of production build to avoid SWC compilation issues
CMD ["npm", "run", "dev"]
