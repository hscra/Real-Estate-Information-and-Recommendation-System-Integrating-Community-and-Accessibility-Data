FROM node:20-alpine AS deps
WORKDIR /app
COPY frontend/property-search/package.json frontend/property-search/package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app

ARG NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
ENV BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL

ENV NEXTJS_IGNORE_ESLINT_ERRORS=1

COPY --from=deps /app/node_modules ./node_modules
COPY frontend/property-search ./
RUN npm run build


FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production

ARG NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
ENV BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL

COPY --from=build /app ./
EXPOSE 3000
CMD ["npm", "run", "start"]


