#!/bin/bash

# TeamFlow Droplet Setup Script
# Automatically configures Node, Nginx, PM2, and your App

echo "⚡ Starting TeamFlow Setup..."

# 1. Update system (non-interactive to avoid stuck prompts)
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update
sudo apt-get -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" upgrade

# 2. Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Install PM2 globally
sudo npm install -g pm2

# 4. Global configurations
mkdir -p ~/data/uploads
export DB_PATH="$HOME/data/kanban.db"
export UPLOADS_PATH="$HOME/data/uploads"
export NODE_ENV="production"
export PORT=3001

# 5. Clone repository (assuming the user has git ready or will be asked)
# If the directory already exists (cloned manually), we use that.
# Otherwise, we ask for the repo URL.
if [ ! -d "teamflow-kanban" ]; then
    read -p "Enter your GitHub Repo URL (e.g. https://github.com/YourUser/repo): " REPO_URL
    git clone $REPO_URL teamflow-kanban
fi

cd teamflow-kanban

# 6. Install dependencies and Build
echo "📦 Installing dependencies..."
npm run build

# 7. Setup Nginx
sudo apt-get install -y nginx
sudo tee /etc/nginx/sites-available/teamflow <<EOF
server {
    listen 80;
    server_name _; # Change this to your domain later

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/teamflow /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

# 8. Start with PM2
pm2 start server/index.js --name teamflow --env production --update-env -- \
  DB_PATH=$DB_PATH UPLOADS_PATH=$UPLOADS_PATH NODE_ENV=production PORT=3001

pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME

echo ""
echo "✅ Setup Complete!"
echo "🌐 Your app should be live at: http://$(curl -s ifconfig.me)"
echo "🚀 To update in the future: 'git pull && npm run build && pm2 restart teamflow'"
