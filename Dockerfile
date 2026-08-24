FROM node:20-alpine
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Install all deps so `npm run build` can use Vite / React Router.
ENV NODE_ENV=development
COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "run", "docker-start"]
