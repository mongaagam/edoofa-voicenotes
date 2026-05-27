FROM node:18-slim

# Install latest chrome dev package and fonts to support major charsets
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Setup application directory
WORKDIR /app

# Copy package files and install dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm install --production

# Copy application code
COPY . .

# Set to production mode
ENV NODE_ENV=production
ENV PORT=5002

# Expose the server port
EXPOSE 5002

# Start the application
CMD ["node", "backend/server.js"]
