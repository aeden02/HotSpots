FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
# Test tools (jest, supertest, mongodb-memory-server) aren't needed to run the server.
RUN npm ci --omit=dev
COPY . .
EXPOSE 4000
CMD ["npm", "start"]
