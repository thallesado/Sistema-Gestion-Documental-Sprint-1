FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend frontend
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @nexodocs/frontend build

FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/frontend/dist/nexodocs-frontend/browser /usr/share/nginx/html
EXPOSE 8080
