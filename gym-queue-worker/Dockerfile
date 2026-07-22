FROM node:20-alpine

# Prisma needs a real OpenSSL on Alpine to detect the libssl version correctly.
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

CMD ["npm", "run", "start"]
