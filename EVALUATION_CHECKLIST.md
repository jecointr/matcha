# Matcha - Evaluation Checklist ✅

## General Instructions

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| No errors/warnings server-side | ✅ | Try-catch everywhere, proper error handling |
| No errors/warnings client-side | ✅ | Error boundaries, console clean |
| Micro-framework used | ✅ | Express (no ORM, no validators, no User Account Manager) |
| Manual SQL queries | ✅ | All queries in routes using `pg` driver |
| 500+ distinct profiles | ✅ | Run `npm run seed` |
| Works on Firefox & Chrome | ✅ | Tested |
| Header, main section, footer | ✅ | In App.jsx Layout component |
| Mobile responsive | ✅ | TailwindCSS responsive classes |

## Security Requirements

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| No plain-text passwords | ✅ | bcrypt with 12 rounds |
| SQL injection protected | ✅ | Parameterized queries ($1, $2...) |
| Form validation | ✅ | Server + client-side validation |
| XSS protected | ✅ | `xss` library + sanitization |
| File upload validated | ✅ | Type, size, content validation in upload.js |
| Credentials in .env | ✅ | All secrets in .env, excluded from git |

### Run Security Check
```bash
docker exec -it matcha_backend npm run security:check
```

## Registration & Sign-in

| Feature | Status | Test |
|---------|--------|------|
| Register with email, username, name, password | ✅ | /register |
| Password strength validation | ✅ | No common words, uppercase, lowercase, number, special |
| Email verification link | ✅ | Check MailDev at :1080 |
| Login with username/password | ✅ | /login |
| Password reset by email | ✅ | /forgot-password |
| Logout from any page | ✅ | Logout button in header |

## User Profile

| Feature | Status | Test |
|---------|--------|------|
| Gender selection | ✅ | Profile completion step 1 |
| Sexual preferences | ✅ | Profile completion step 1 |
| Biography | ✅ | Profile completion step 2 |
| Interest tags (reusable) | ✅ | Profile completion step 5 |
| Up to 5 photos | ✅ | Profile completion step 3 |
| Profile picture selection | ✅ | Star icon on photos |
| Modify all info anytime | ✅ | /profile edit mode |
| See who viewed profile | ✅ | /visitors |
| See who liked profile | ✅ | /likes |
| Fame rating | ✅ | Calculated from likes/views/matches |
| GPS location with consent | ✅ | Profile completion step 4 |
| Manual location fallback | ✅ | City input if GPS denied |
| Modify location | ✅ | /profile > Location tab |

## Browsing

| Feature | Status | Test |
|---------|--------|------|
| Suggested profiles list | ✅ | /browse |
| Preference-based matching | ✅ | Gender + sexual preference filter |
| Bisexual default | ✅ | sexual_preference = 'both' default |
| Match by location | ✅ | Distance calculation + sort |
| Match by common tags | ✅ | Common tags count |
| Match by fame rating | ✅ | Fame in algorithm |
| Sort by age | ✅ | Sort dropdown |
| Sort by location | ✅ | Sort dropdown |
| Sort by fame rating | ✅ | Sort dropdown |
| Sort by common tags | ✅ | Sort dropdown |
| Filter by age | ✅ | Filter panel |
| Filter by location | ✅ | Filter panel |
| Filter by fame rating | ✅ | Filter panel |
| Filter by tags | ✅ | Filter panel |

## Research (Advanced Search)

| Feature | Status | Test |
|---------|--------|------|
| Search by age range | ✅ | /search |
| Search by fame rating range | ✅ | /search |
| Search by location | ✅ | /search |
| Search by tags | ✅ | /search |
| Sortable results | ✅ | Sort dropdown |
| Filterable results | ✅ | Filter panel |

## Profile View

| Feature | Status | Test |
|---------|--------|------|
| View all info (except email/password) | ✅ | /profile/:userId |
| Visit recorded in history | ✅ | profile_visits table |
| Like profile picture | ✅ | Heart button |
| Mutual like = connected | ✅ | Match detection + conversation created |
| No like without profile picture | ✅ | Error message if no photo |
| Unlike user | ✅ | Click liked heart |
| Unlike removes notifications | ✅ | Unlike stops future notifs |
| Unlike disables chat | ✅ | Conversation blocked |
| See fame rating | ✅ | Star icon with number |
| See online status | ✅ | Green dot + "Online" |
| See last connection time | ✅ | "X hours ago" |
| Report as fake | ✅ | Flag button |
| Block user | ✅ | Block button |
| Blocked = no search/notif/chat | ✅ | Excluded from all queries |
| See if profile liked you | ✅ | "Liked your profile" indicator |
| See if connected | ✅ | "Connected" badge |

## Chat

| Feature | Status | Test |
|---------|--------|------|
| Chat only when connected | ✅ | Requires mutual like |
| Real-time messages | ✅ | Socket.io, <10s delay |
| See new messages from any page | ✅ | Badge in header |

## Notifications

| Feature | Status | Test |
|---------|--------|------|
| Notification on like received | ✅ | Real-time + stored |
| Notification on profile view | ✅ | Real-time + stored |
| Notification on message | ✅ | Real-time + stored |
| Notification on mutual like | ✅ | "It's a match!" |
| Notification on unlike | ✅ | Real-time + stored |
| See unread from any page | ✅ | Badge in header |

## Commands for Testing

```bash
# Start application
docker-compose up --build

# Seed 500 profiles
docker exec -it matcha_backend npm run seed

# Generate profile photos
docker exec -it matcha_backend npm run seed:photos

# Run security checks
docker exec -it matcha_backend npm run security:check

# Check database
docker exec -it matcha_db psql -U matcha_user -d matcha_db

# View email verification (MailDev)
open http://localhost:1080

# Access application
open http://localhost:5173
```

## Test Users (after seed)

- **Password for all seeded users**: `Password123!`
- Usernames follow pattern: `firstname_lastname_index`

## Notes for Defense

1. **No ORM**: We use raw SQL with `pg` library
2. **No validators library**: Custom validation in `utils/validators.js`
3. **Micro-framework**: Express is just router + middleware
4. **Security first**: Check `security-check.js` output
5. **500 profiles**: Run seed to verify count in database