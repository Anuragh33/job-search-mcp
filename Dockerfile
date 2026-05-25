FROM node:20-slim

# Chromium dependencies for Playwright
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Tell Playwright to use the system Chromium instead of downloading its own
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/bin
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV CRAWLEE_HEADLESS=1

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# Install playwright browsers (uses system chromium path above)
RUN npx playwright install chromium --with-deps 2>/dev/null || true

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

EXPOSE 3001

CMD ["node", "dist/server.js"]
