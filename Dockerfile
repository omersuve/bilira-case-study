FROM --platform=linux/amd64 node:22-alpine

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json package-lock.json tsconfig.json ./

RUN mkdir -p /app/src
COPY src ./src

RUN npm install
RUN npm run build

# Expose the application port
EXPOSE 3000

# Start the service using npm start
CMD ["npm", "start"]