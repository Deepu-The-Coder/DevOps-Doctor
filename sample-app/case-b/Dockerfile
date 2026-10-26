FROM node:20-alpine
WORKDIR /app
ARG DATABASE_URL
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src
ENV PORT=8080
EXPOSE 8080
CMD ["npm", "start"]
