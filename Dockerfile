# syntax=docker/dockerfile:1

# --- Build stage: compile the Vite site into static files ---
FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies against the lockfile for reproducible builds.
COPY package.json package-lock.json ./
RUN npm ci

# Build the static site into /app/dist (see vite.config.js).
COPY . .
RUN npm run build

# --- Runtime stage: serve the static files with nginx ---
FROM nginx:1.27-alpine AS runtime

# Custom config: clean URLs for the multi-page build, asset caching.
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
