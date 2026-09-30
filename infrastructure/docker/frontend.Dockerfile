# Build stage
FROM node:22-alpine AS build
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/
COPY frontend/ ./frontend/
RUN pnpm install --frozen-lockfile
RUN cd frontend && pnpm run build

# Run stage
FROM nginx:alpine
COPY --from=build /app/frontend/dist/nexodocs-frontend/browser /usr/share/nginx/html
COPY infrastructure/docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
