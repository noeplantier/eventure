#!/bin/bash
echo "🚀 Setup nouvelle app depuis template Universe"
read -p "Nom de l'app : " APP_NAME
read -p "Supabase URL : " SUPABASE_URL
read -p "Supabase Anon Key : " SUPABASE_KEY

# Remplace dans app.json
sed -i '' "s/universe-streaming-app/$APP_NAME/g" app.json

# Crée le .env.local
cat > .env.local << ENVEOF
EXPO_PUBLIC_SUPABASE_URL=$SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_KEY
ENVEOF

npm install
echo "✅ App $APP_NAME prête !"
