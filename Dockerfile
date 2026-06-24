# Використовуємо офіційний Node.js образ
FROM node:20-alpine

# Встановлюємо робочу директорію
WORKDIR /app

# Копіюємо package.json з кореня (він запустить install в backend/)
COPY package*.json ./
COPY backend/package*.json ./backend/

# Встановлюємо залежності (включаючи python/make для better-sqlite3 якщо потрібно)
RUN apk add --no-cache python3 make g++ && \
    npm install && \
    cd backend && npm install

# Копіюємо всі інші файли проекту
COPY . .

# Вказуємо порт, який буде слухати контейнер
EXPOSE 3000

# Задаємо змінні середовища за замовчуванням
ENV NODE_ENV=production
ENV PORT=3000
# Шлях до бази даних всередині контейнера
ENV DB_PATH=./data/skycamp.db

# Запускаємо сервер
CMD ["npm", "start"]
