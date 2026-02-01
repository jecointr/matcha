# Matcha - Dating Web Application

## Project Overview
Matcha is a fullstack dating web application built for the 42 curriculum. It enables users to create profiles, discover matches based on preferences and location, and communicate in real-time.

## Tech Stack

### Frontend
- **React 19** with Vite
- **TailwindCSS** for styling
- **React Router v7** for routing
- **Socket.io-client** for real-time features
- **Axios** for API calls
- **Leaflet** for maps

### Backend
- **Node.js** with Express.js
- **PostgreSQL 18** database
- **Socket.io** for WebSocket support
- **JWT** for authentication
- **Bcryptjs** for password hashing
- **Multer + Sharp** for image processing

### Infrastructure
- **Docker & Docker Compose**
- **Nginx** as reverse proxy
- **MailDev** for email testing

## Directory Structure
```
matcha/
├── backend/
│   └── src/
│       ├── config/       # DB & Socket.io config
│       ├── routes/       # API routes
│       ├── controllers/  # Business logic
│       ├── middlewares/  # Auth, upload, validation
│       ├── lib/          # JWT, mailer, password utils
│       └── utils/        # Validators
├── frontend/
│   └── src/
│       ├── pages/        # Page components
│       ├── components/   # Reusable UI
│       ├── context/      # Auth, Socket, Call contexts
│       ├── services/     # API client
│       └── utils/        # Helpers
├── database/
│   └── init.sql          # PostgreSQL schema
└── nginx/                # Reverse proxy config
```

## Commands

### Development
```bash
# Start all services with Docker
docker compose up

# Start only backend (with hot reload)
cd backend && npm run dev

# Start only frontend
cd frontend && npm run dev
```

### Database
```bash
# Seed database with test data (500 profiles)
cd backend && npm run seed
```

### Build
```bash
# Build frontend for production
cd frontend && npm run build
```

## Key Features
- User registration with email verification
- Profile creation with photos (up to 5)
- GPS-based location matching
- Like/unlike system with mutual match detection
- Real-time chat with Socket.io
- Online status and typing indicators
- Block and report functionality
- Fame rating system

## Database Tables
`users`, `photos`, `tags`, `user_tags`, `likes`, `blocks`, `reports`, `profile_visits`, `conversations`, `messages`, `notifications`

## API Structure
All API routes are prefixed with `/api`:
- `/api/auth` - Authentication (login, register, verify, reset)
- `/api/users` - User profiles and preferences
- `/api/photos` - Photo upload and management
- `/api/tags` - Interest tags
- `/api/likes` - Like/unlike actions
- `/api/chat` - Conversations and messages
- `/api/notifications` - User notifications

## Coding Conventions
- Use parameterized SQL queries (prevent SQL injection)
- Validate and sanitize all user inputs
- Use JWT tokens for authenticated routes
- Keep controllers focused on business logic
- Use middlewares for cross-cutting concerns
