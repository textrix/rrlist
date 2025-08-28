# RRList

*English | [한국어](README.ko.md)*

Cloud Storage File Browser with Authentication & Real-time Monitoring

## Project Overview

**RRList** is a web-based file browser built on rclone that provides secure cloud storage management with user authentication and real-time storage monitoring.

### Key Features
- **Multi-Cloud Support**: Browse files across 70+ cloud storage providers via rclone
- **File Download**: Single file download with optimized streaming performance
- **User Authentication**: Secure login system with NextAuth.js
- **Real-time Monitoring**: Live storage usage updates via Server-Sent Events
- **Permission Management**: User roles and access control system
- **Docker Ready**: Containerized deployment with automatic setup

### Technology Stack
- **Next.js 15** with App Router - Full-stack React framework
- **TypeScript** - Static type checking for type safety
- **Tailwind CSS** - Utility-first CSS framework
- **Prisma** with SQLite - Type-safe ORM and database
- **NextAuth.js** - Authentication and session management
- **rclone** - Multi-cloud storage backend
- **Docker** - Containerized deployment

## Quick Start with Docker

### Prerequisites
- Docker & Docker Compose
- rclone configuration file at `~/.config/rclone/rclone.conf`

### Development Setup

1. Clone the repository
```bash
git clone <repository-url>
cd rrlist
```

2. Start development container
```bash
docker compose up rrlist-dev
```

3. Access the application
- Web UI: http://localhost:3003
- Default admin credentials will be displayed in container logs on first startup

### Production Deployment

```bash
# Build and start production container
docker compose up rrlist -d
```

## Architecture

### Services
- **rrlist-dev**: Development container with hot reload
- **rrlist**: Production container with optimized build
- **Automatic Setup**: Admin user creation with secure random password

### Container Features
- **User Management**: Proper UID/GID matching for file permissions
- **rclone Integration**: Background daemon with health monitoring
- **Auto Storage Monitoring**: Automatic background storage collection on startup
- **Config Sync**: Automatic token refresh synchronization
- **Log Rotation**: Size-limited logging (10MB × 3 files)
- **Timezone Support**: Configurable via `TZ` environment variable

## Configuration

### Environment Variables (.env)
```env
# Database
DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_URL="http://localhost:3003"
NEXTAUTH_SECRET="your-nextauth-secret-key"

# rclone configuration
RCLONE_RC_URL="http://127.0.0.1:5572"
RCLONE_RC_USER=""
RCLONE_RC_PASS=""
```

### Docker Compose Services

#### Development (rrlist-dev)
- Node.js 18 Alpine base image
- Volume mounting for live code changes
- Automatic admin user creation
- rclone daemon with health checks

#### Production (rrlist)
- Multi-stage Docker build
- Optimized Next.js standalone output
- Read-only rclone.conf mounting
- Restart policies and health checks

## Project Structure

```
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/           # Authentication endpoints
│   │   │   └── rclone/         # rclone RC API proxy
│   │   │       ├── files/      # File operations
│   │   │       ├── download/   # File download endpoint
│   │   │       ├── remotes/    # Remote storage listing
│   │   │       ├── storage/    # Storage usage monitoring
│   │   │       └── check/      # Health checks
│   │   ├── auth/               # Authentication pages
│   │   │   ├── login/          # Login page
│   │   │   └── change-password/ # Password change
│   │   └── page.tsx            # Main file browser
│   ├── components/
│   │   └── file-browser/       # File browser components
│   ├── lib/
│   │   └── auth.ts             # NextAuth configuration
│   └── prisma/
│       └── schema.prisma       # Database schema
├── entrypoint.sh               # Container initialization
├── Dockerfile                  # Container build instructions
├── compose.yml                 # Docker Compose configuration
└── next.config.js              # Next.js configuration
```

## Features Implemented

### ✅ Authentication System
- Secure user authentication with NextAuth.js
- Automatic admin user creation with random password
- Forced password change on first login
- Session management and protection

### ✅ File Browser
- Multi-cloud storage support via rclone
- Real-time file listing and navigation
- Single file download with streaming support
- Storage usage monitoring with live updates
- Health status checking for all remotes

### ✅ Real-time Monitoring
- Server-Sent Events for live storage updates
- Automatic background storage polling on server startup
- Background storage polling (5-minute intervals)
- Automatic error detection and reporting
- Connection status indicators

### ✅ Container Optimization
- Proper UID/GID handling for file permissions
- rclone.conf token refresh synchronization
- Atomic write detection with inotify
- Health check endpoints for monitoring

### ✅ Security Features
- Environment-based configuration
- Secure session handling
- Input validation and sanitization
- Proper error handling and logging

## Development

### Local Development
```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Start development server
npm run dev
```

### Database Management
```bash
# Push schema changes
npx prisma db push

# Reset database (development only)
rm dev.db && npx prisma db push
```

### Container Development
```bash
# View logs
docker logs rrlist-dev -f

# Execute commands in container
docker exec -it rrlist-dev sh

# Restart container
docker restart rrlist-dev
```

## Monitoring & Logs

### Storage Monitoring
- Automatic startup background storage collection
- Real-time storage usage via `/api/rclone/storage/stream`
- Background polling every 5 minutes with retry logic
- Concurrent storage checks (5 remotes at once)
- Error detection and reporting

### Log Management
- Rotating logs: 10MB max size, 3 files retained
- Structured logging with timestamps
- Container health monitoring
- rclone daemon status tracking

## Security Considerations

- **Authentication Required**: All endpoints protected
- **Session Security**: Secure JWT tokens with NextAuth.js
- **File Permissions**: Proper UID/GID handling in containers
- **Config Protection**: rclone.conf with 600 permissions
- **Input Validation**: All user inputs sanitized
- **Error Handling**: Secure error messages without information disclosure

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with proper testing
4. Update documentation as needed
5. Submit a pull request

## License

[License information to be added]

---

For Korean documentation, see [README.ko.md](README.ko.md)