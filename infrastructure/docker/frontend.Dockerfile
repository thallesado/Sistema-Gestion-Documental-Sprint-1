# Build stage
FROM node:22-alpine AS build
WORKDIR /app
RUN npm install -g pnpm
COPY frontend/package.json ./
RUN pnpm install
COPY frontend/ ./
RUN pnpm run build

# Run stage
FROM nginx:alpine
COPY --from=build /app/frontend/dist/frontend/browser /usr/share/nginx/html
COPY infrastructure/docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
