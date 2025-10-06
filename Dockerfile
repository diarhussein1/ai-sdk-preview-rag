FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat

COPY package*.json ./
RUN npm ci

COPY . .

RUN SKIP_DB=1 DATABASE_URL="postgres://dummy" npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev
RUN npm install -g tsx

COPY --from=builder /app ./

EXPOSE 3000
CMD ["npm", "run", "start"]
