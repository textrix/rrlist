#!/bin/sh
set -e

# Package installation and setup (as root)

# Install dependencies
apk add --no-cache curl unzip inotify-tools

# Install rclone with architecture detection
ARCH=$(uname -m)
case $ARCH in
  x86_64) RCLONE_ARCH='amd64' ;;
  aarch64) RCLONE_ARCH='arm64' ;;
  armv7l) RCLONE_ARCH='arm' ;;
  *) echo "Unsupported architecture: $ARCH" && exit 1 ;;
esac

# Install rclone if not already installed
if [ ! -f /usr/local/bin/rclone ]; then
  curl -O "https://downloads.rclone.org/rclone-current-linux-${RCLONE_ARCH}.zip"
  unzip -o "rclone-current-linux-${RCLONE_ARCH}.zip"
  RCLONE_DIR=$(find . -name "rclone-*-linux-${RCLONE_ARCH}" -type d | head -1)
  cp "${RCLONE_DIR}/rclone" /usr/local/bin/
  chmod +x /usr/local/bin/rclone
  rm -rf rclone-*
fi

# Ensure config directory exists
mkdir -p /config

# Create user with matching UID/GID for app execution
TARGET_UID=1001
TARGET_GID=1001

# Create group and user if they don't exist
addgroup -g $TARGET_GID appgroup 2>/dev/null || true
adduser -D -u $TARGET_UID -G appgroup appuser 2>/dev/null || true

# Change ownership of app directory to the app user
chown -R appuser:appgroup /app

# Copy rclone.conf to /tmp for internal use (to allow token refresh)
cp /config/rclone.conf /tmp/rclone.conf
chown appuser:appgroup /tmp/rclone.conf
chmod 600 /tmp/rclone.conf

# Start rclone daemon in background as appuser using /tmp config with file serving
su appuser -c "rclone rcd --rc-addr=127.0.0.1:5572 --rc-no-auth --rc-serve --config=/tmp/rclone.conf" &

# Wait for rclone daemon to be ready
echo "Waiting for rclone daemon to start..."
for i in $(seq 1 30); do
  if curl -s --connect-timeout 1 --max-time 2 http://127.0.0.1:5572/core/version >/dev/null 2>&1; then
    echo "✅ rclone daemon is ready"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "❌ rclone daemon failed to start after 30 seconds"
    exit 1
  fi
  echo "Waiting for rclone daemon... ($i/30)"
  sleep 1
done

# Start background process to sync /tmp/rclone.conf back to /config/rclone.conf when modified
su appuser -c '
echo "Starting inotify watcher for /tmp/rclone.conf"
inotifywait -m -e modify,close_write,moved_to /tmp/ --format "%e %w%f" | while read event file; do
  if [[ "$file" == "/tmp/rclone.conf" ]]; then
    echo "$(date): File change detected ($event), syncing to /config/rclone.conf"
    cat /tmp/rclone.conf > /config/rclone.conf
    echo "$(date): Synced /tmp/rclone.conf to /config/rclone.conf"
  fi
done
' &

# Install npm dependencies
npm install

# Generate Prisma client
npx prisma generate

# Check if database exists, if not create it and seed
if [ ! -f "./dev.db" ]; then
  echo "🗄️  Database not found, creating and seeding..."
  npx prisma db push
  
  # Create admin user with random password
  ADMIN_PASSWORD=$(node -e "
    function generateRandomPassword(length = 12) {
      const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const lowercase = 'abcdefghijklmnopqrstuvwxyz';
      const numbers = '0123456789';
      const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const allChars = uppercase + lowercase + numbers + symbols;

      let password = '';
      password += uppercase[Math.floor(Math.random() * uppercase.length)];
      password += lowercase[Math.floor(Math.random() * lowercase.length)];
      password += numbers[Math.floor(Math.random() * numbers.length)];
      password += symbols[Math.floor(Math.random() * symbols.length)];

      for (let i = 4; i < length; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
      }

      console.log(password.split('').sort(() => Math.random() - 0.5).join(''));
    }
    generateRandomPassword(12);
  ")
  
  # Create admin user in database
  export ADMIN_PASSWORD="$ADMIN_PASSWORD"
  node -e "
    const { PrismaClient } = require('@prisma/client');
    const bcrypt = require('bcryptjs');
    const prisma = new PrismaClient();

    async function createAdmin() {
      try {
        // Check if admin user already exists
        const existingAdmin = await prisma.user.findUnique({
          where: { username: 'admin' }
        });

        if (existingAdmin) {
          console.log('✅ Admin user already exists, skipping initialization');
          await prisma.\$disconnect();
          return;
        }

        // Create new admin user only if it doesn't exist
        const adminPassword = process.env.ADMIN_PASSWORD;
        const hashedPassword = await bcrypt.hash(adminPassword, 12);

        const adminUser = await prisma.user.create({
          data: {
            username: 'admin',
            email: 'admin@rrlist.local',
            password: hashedPassword,
            name: 'System Administrator',
            isFirstLogin: true,
            mustChangePassword: true,
          },
        });

        console.log('');
        console.log('🎉 RRList - Initial Setup Complete!');
        console.log('=====================================');
        console.log('🔐 ADMIN LOGIN CREDENTIALS');
        console.log('=====================================');
        console.log('👤 Username: admin');
        console.log('📧 Email: admin@rrlist.local');
        console.log('🔑 Password: ' + adminPassword);
        console.log('=====================================');
        console.log('⚠️  IMPORTANT SECURITY NOTES:');
        console.log('• Save this password immediately!');
        console.log('• You must change password on first login');
        console.log('• This information will not be shown again');
        console.log('=====================================');
        console.log('🌐 Access your RRList at: http://localhost:3003');
        console.log('');

        await prisma.\$disconnect();
      } catch (error) {
        console.error('❌ Error creating admin user:', error);
        process.exit(1);
      }
    }

    createAdmin();
  "
else
  echo "✅ Database already exists, skipping initialization"
fi

# Run appropriate command based on environment as the app user
if [ "$NODE_ENV" = "production" ]; then
  su appuser -c "npm run build"
  su appuser -c "npm start"
else
  su appuser -c "npm run dev"
fi