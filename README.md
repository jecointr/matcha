# Matcha - Dating Application

A modern dating web application built with Node.js, React, PostgreSQL, and Docker.

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Git

### Installation

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd matcha
```

2. **Create environment file**
```bash
cp .env.example .env
# Edit .env with your own secure values!
```

3. **Start all services**
```bash
docker-compose up --build
```

4. **Access the application**
- Frontend: http://localhost:5173
- API: http://localhost:3000
- Nginx (production): http://localhost:80
- MailDev (email testing): http://localhost:1080

### Development Commands

```bash
# Start all services
docker-compose up

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Stop all services
docker-compose down

# Rebuild containers
docker-compose up --build

# Access database
docker exec -it matcha_db psql -U matcha_user -d matcha_db

# Run database seed (500 profiles)
docker exec -it matcha_backend npm run seed
```

## 📁 Project Structure

```
matcha/
├── backend/           # Node.js/Express API
│   ├── src/
│   │   ├── config/    # Database & Socket.io config
│   │   ├── routes/    # API routes
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── lib/       # Utilities (DB queries, mailer, etc.)
│   │   └── utils/     # Validators
│   └── seeds/         # Database seeders
├── frontend/          # React/Vite application
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       ├── services/
│       └── context/
├── nginx/             # Reverse proxy config
├── database/          # SQL init scripts
└── docker-compose.yml
```

## 🔒 Security Features

- Password hashing with bcrypt
- JWT authentication
- SQL injection protection (parameterized queries)
- XSS protection (input sanitization)
- Rate limiting
- CORS configuration
- Helmet security headers
- File upload validation

## 🛠 Tech Stack

- **Backend**: Node.js, Express (micro-framework)
- **Frontend**: React, Vite, TailwindCSS
- **Database**: PostgreSQL (manual SQL queries)
- **Real-time**: Socket.io
- **Reverse Proxy**: Nginx
- **Containerization**: Docker

## 📝 License

This project is part of the 42 curriculum.