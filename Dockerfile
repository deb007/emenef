FROM node:18-alpine
WORKDIR /app
RUN apk add --no-cache python3 py3-pip make g++
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8080
CMD ["npm", "start"]