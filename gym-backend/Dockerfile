FROM node:20-alpine

# Prisma needs a real OpenSSL on Alpine to detect the libssl version correctly
# (otherwise it just warns and defaults to 1.1.x, which still works, but this
# silences the warning and avoids relying on an assumed fallback).
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 8004

CMD ["npm", "run", "start"]
