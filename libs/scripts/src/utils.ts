import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

export function createPackageJson(
  dir: string,
  packageName: string,
  version: string,
  dependencies: Record<string, string>,
  extra?: Record<string, unknown>
) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(
    resolve(dir, 'package.json'),
    JSON.stringify(
      {
        name: `${packageName}-compiled`,
        version,
        dependencies,
        ...extra,
      },
      null,
      2
    )
  );
}

export function createServerDockerfile(dir: string) {
  const content = `
ARG IMAGE=node:22.9.0-alpine3.20
FROM $IMAGE
WORKDIR /app
COPY ./package.json ./
RUN npm i --omit=dev
COPY ./ ./
CMD ["node","index.js"]
`.trim()
  writeFileSync(
    resolve(dir, 'Dockerfile'),
    content
  )
}

export function createStaticServerDockerfile (dir: string) {
  const content = `
ARG IMAGE=nginx:stable-alpine-slim
FROM $IMAGE
RUN rm -rf /usr/share/nginx/html/*
COPY ./ /usr/share/nginx/html/

COPY <<EOF /etc/nginx/conf.d/default.conf
server {
  listen 80;
  server_name _;

  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files \$uri \$uri/ /index.html;
  }
}
EOF

EXPOSE 80
CMD ["nginx","-g","daemon off;"]
`.trim()
  writeFileSync(
    resolve(dir, 'Dockerfile'),
    content
  )
}