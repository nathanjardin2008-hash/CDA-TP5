FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

# L'API ne tourne plus en root
USER node

CMD ["npm", "start"]
