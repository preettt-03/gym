FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# VITE_* vars are inlined into the browser bundle at build time, so this
# must be a build arg (passed via docker-compose's `args:`), not just a
# runtime environment variable.
ARG VITE_API_URL=http://localhost:8004/api/v1
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
