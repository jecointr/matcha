# matcha

Matcha - Dating Application 💕

A modern dating web application built with Node.js, React, PostgreSQL, and Docker.

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Git

### Installation

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd matcha

# 2. Create environment file
cp .env.example .env

# 3. ⚠️ IMPORTANT: Edit .env with your own secure values!
#    - Change DB_PASSWORD
#    - Change JWT_SECRET (must be 64+ characters)

# 4. Start all services
docker-compose up --build

# 5. Wait for all services to start, then seed the database
docker exec -it matcha_backend npm run seed
docker exec -it matcha_backend npm run seed:photos
```

### Access the application
| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | Main application |
| API | http://localhost:3000 | Backend API |
| Nginx | http://localhost | Production reverse proxy |
| MailDev | http://localhost:1080 | Email testing interface |

### Test Credentials
After running the seed, you can log in with any seeded user:
- **Username**: Any username from the database (check via pgAdmin or logs)
- **Password**: `Password123!`

Or create your own account via the registration form.

## 📁 Project Structure

```
matcha/
├── backend/                 # Node.js/Express API
│   ├── src/
│   │   ├── config/         # Database & Socket.io config
│   │   ├── routes/         # API routes
│   │   ├── middlewares/    # Auth, upload middlewares
│   │   ├── lib/            # Utilities (JWT, mailer, password)
│   │   └── utils/          # Validators
│   └── seeds/              # Database seeders
├── frontend/               # React/Vite application
│   └── src/
│       ├── components/     # Reusable UI components
│       ├── pages/          # Page components
│       ├── context/        # React contexts (Auth, Socket)
│       └── services/       # API services
├── nginx/                  # Reverse proxy config
├── database/               # SQL init scripts
├── docker-compose.yml
├── .env.example
└── README.md
```

## 🛠 Development Commands

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

# Access database CLI
docker exec -it matcha_db psql -U matcha_user -d matcha_db

# Run database seed (500 profiles)
docker exec -it matcha_backend npm run seed

# Generate profile photos
docker exec -it matcha_backend npm run seed:photos

# Run both seeds
docker exec -it matcha_backend npm run seed:all
```

## ✨ Features

### Authentication
- ✅ Registration with email verification
- ✅ Login with JWT tokens
- ✅ Password reset via email
- ✅ Secure password hashing (bcrypt)

### User Profile
- ✅ Profile completion wizard
- ✅ Photo upload (up to 5 photos)
- ✅ GPS location with consent
- ✅ Manual location entry
- ✅ Interests/tags system
- ✅ Fame rating

### Matching
- ✅ Smart profile suggestions
- ✅ Sexual preference matching
- ✅ Location-based matching
- ✅ Common interests matching
- ✅ Advanced search filters
- ✅ Sort by distance, age, fame, tags

### Interactions
- ✅ Like/Unlike profiles
- ✅ Mutual like detection (Match!)
- ✅ Block users
- ✅ Report fake accounts
- ✅ Profile visit history

### Real-time
- ✅ Live chat with Socket.io
- ✅ Typing indicators
- ✅ Real-time notifications
- ✅ Online status
- ✅ Unread message badges

## 🔒 Security Features

- ✅ Password hashing with bcrypt (12 rounds)
- ✅ JWT authentication
- ✅ SQL injection protection (parameterized queries)
- ✅ XSS protection (input sanitization)
- ✅ Rate limiting
- ✅ CORS configuration
- ✅ Helmet security headers
- ✅ File upload validation
- ✅ Image processing (strip EXIF)
- ✅ No plain-text passwords

## 🛡 Security Checklist (for evaluation)

| Requirement | Status |
|-------------|--------|
| No plain-text passwords in DB | ✅ bcrypt hash |
| SQL injection protection | ✅ Parameterized queries |
| Form validation | ✅ Server + client side |
| XSS protection | ✅ Input sanitization |
| File upload validation | ✅ Type, size, content check |
| Authentication required | ✅ JWT middleware |
| HTTPS ready | ✅ Nginx configured |

## 🗄 Database Schema

Main tables:
- `users` - User accounts and profiles
- `photos` - User photos
- `tags` - Interest tags
- `user_tags` - User-tag associations
- `likes` - Like relationships
- `blocks` - Block relationships
- `reports` - Fake account reports
- `profile_visits` - Visit history
- `conversations` - Chat conversations
- `messages` - Chat messages
- `notifications` - User notifications

## 📱 Responsive Design

The application is fully responsive and works on:
- ✅ Desktop browsers
- ✅ Tablets
- ✅ Mobile devices (iOS/Android)

Tested on latest Chrome and Firefox.

## 🔧 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, TailwindCSS |
| Backend | Node.js, Express (micro-framework) |
| Database | PostgreSQL (manual SQL queries) |
| Real-time | Socket.io |
| Reverse Proxy | Nginx |
| Containerization | Docker, Docker Compose |
| Email | Nodemailer (MailDev for dev) |

## 📝 API Endpoints

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/verify-email` - Verify email
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `GET /api/auth/me` - Get current user

### Users
- `PUT /api/users/profile` - Update profile
- `PUT /api/users/location` - Update location
- `POST /api/users/photos` - Upload photo
- `DELETE /api/users/photos/:id` - Delete photo
- `PUT /api/users/tags` - Update tags

### Profiles
- `GET /api/profiles/browse` - Get suggestions
- `GET /api/profiles/search` - Advanced search
- `GET /api/profiles/:id` - Get profile
- `POST /api/profiles/:id/like` - Like user
- `DELETE /api/profiles/:id/like` - Unlike user
- `POST /api/profiles/:id/block` - Block user
- `POST /api/profiles/:id/report` - Report user

### Matches
- `GET /api/matches` - Get matches
- `GET /api/matches/likes` - Get received likes
- `GET /api/matches/visits` - Get profile visitors

### Chat
- `GET /api/chat/conversations` - Get conversations
- `GET /api/chat/:id/messages` - Get messages
- `POST /api/chat/:id/messages` - Send message

### Notifications
- `GET /api/notifications` - Get notifications
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/read-all` - Mark all as read

## 📄 License

This project is part of the 42 curriculum.

## 👨‍💻 Author

Built with ❤️ for the Matcha project.
