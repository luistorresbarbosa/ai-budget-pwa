# syntax=docker/dockerfile:1.6

# Etapa de instalação de dependências
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# Etapa de build
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Etapa final com nginx para servir a PWA
FROM nginx:1.27-alpine AS runner
COPY --from=build /app/dist /usr/share/nginx/html
# Copiar manifestos PWA e ficheiros estáticos adicionais
COPY public /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
