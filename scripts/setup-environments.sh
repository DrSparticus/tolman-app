#!/bin/bash
# setup-environments.sh

echo "🚀 Setting up Firebase environments..."

# Create staging project
echo "📦 Creating staging project..."
firebase projects:create tolman-app-staging --display-name "Tolman App - Staging"

# Create development project  
echo "📦 Creating development project..."
firebase projects:create tolman-app-dev --display-name "Tolman App - Development"

# Add projects to .firebaserc
echo "🔗 Adding projects to configuration..."
firebase use --add tolman-app-staging
firebase use --add tolman-app-dev
firebase use --add tolman-app

# Initialize Firestore for staging
echo "🗄️ Setting up Firestore for staging..."
firebase use tolman-app-staging
firebase firestore:rules deploy
firebase firestore:indexes deploy

# Initialize Firestore for development
echo "🗄️ Setting up Firestore for development..."
firebase use tolman-app-dev
firebase firestore:rules deploy
firebase firestore:indexes deploy

# Switch back to production
firebase use tolman-app

echo "✅ Environment setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update .env.staging with your staging Firebase config"
echo "2. Update .env.development with your development Firebase config"
echo "3. Copy production data using: node scripts/firebase-data-copy.js"
echo "4. Deploy staging: npm run deploy:staging"
