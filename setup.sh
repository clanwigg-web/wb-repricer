#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  WB Repricer - Setup Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${BLUE}📄 Creating .env from .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✅ .env created${NC}"
    echo -e "${RED}⚠️  Please edit .env file with your settings!${NC}"
    echo ""
else
    echo -e "${GREEN}✅ .env already exists${NC}"
    echo ""
fi

# Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Start Docker
echo -e "${BLUE}🐳 Starting Docker containers...${NC}"
docker-compose -f docker-compose.dev.yml up -d
echo -e "${GREEN}✅ Docker containers started${NC}"
echo ""

# Wait for PostgreSQL to be ready
echo -e "${BLUE}⏳ Waiting for PostgreSQL...${NC}"
sleep 5
echo -e "${GREEN}✅ PostgreSQL ready${NC}"
echo ""

# Generate Prisma Client
echo -e "${BLUE}🔧 Generating Prisma Client...${NC}"
cd backend && npm run prisma:generate
echo -e "${GREEN}✅ Prisma Client generated${NC}"
echo ""

# Run migrations
echo -e "${BLUE}🗄️  Running database migrations...${NC}"
npm run prisma:migrate
echo -e "${GREEN}✅ Migrations applied${NC}"
echo ""

# Seed database (optional)
read -p "Do you want to seed the database with test data? (y/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}🌱 Seeding database...${NC}"
    npm run prisma:seed
    echo -e "${GREEN}✅ Database seeded${NC}"
    echo ""
fi

cd ..

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ✅ Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Next steps:"
echo -e "  1. Edit ${BLUE}.env${NC} file with your settings"
echo -e "  2. Run ${BLUE}npm run dev${NC} to start development server"
echo -e "  3. Open ${BLUE}http://localhost:3000${NC} in your browser"
echo ""
echo -e "Useful commands:"
echo -e "  ${BLUE}docker-compose -f docker-compose.dev.yml logs -f${NC} - View Docker logs"
echo -e "  ${BLUE}cd backend && npm run prisma:studio${NC} - Open database GUI"
echo ""
