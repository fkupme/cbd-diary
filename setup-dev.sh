#!/bin/bash

# CBD Diary Development Setup Script
set -e

echo "🚀 CBD Diary Development Setup"
echo "==============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check dependencies
check_dependencies() {
    print_status "Checking dependencies..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18 or higher."
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18 or higher is required. Current version: $(node -v)"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed."
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_warning "Docker is not installed. Some features may not work."
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_warning "Docker Compose is not installed. Some features may not work."
    fi
    
    print_success "Dependencies check completed"
}

# Setup environment files
setup_environment() {
    print_status "Setting up environment files..."
    
    # Copy development environment file
    if [ ! -f ".env.local" ]; then
        cp .env.development .env.local
        print_success "Created .env.local from .env.development"
    else
        print_warning ".env.local already exists, skipping..."
    fi
    
    # Setup backend environment
    cd cbd.web-api
    if [ ! -f ".env" ]; then
        ln -s ../.env.local .env
        print_success "Linked backend .env file"
    else
        print_warning "Backend .env already exists, skipping..."
    fi
    cd ..
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Install root dependencies
    npm install
    
    # Install backend dependencies
    print_status "Installing backend dependencies..."
    cd cbd.web-api
    npm install
    cd ..
    
    # Install mobile app dependencies
    print_status "Installing mobile app dependencies..."
    cd cbd.mobile-app
    npm install
    cd ..
    
    print_success "All dependencies installed"
}

# Setup database
setup_database() {
    print_status "Setting up database..."
    
    # Start database services
    if command -v docker-compose &> /dev/null; then
        print_status "Starting PostgreSQL and Redis with Docker..."
        docker-compose up -d postgres redis
        
        # Wait for database to be ready
        print_status "Waiting for database to be ready..."
        sleep 10
        
        # Run migrations
        print_status "Running database migrations..."
        cd cbd.web-api
        npx prisma migrate deploy || npm run db:migrate
        
        # Generate Prisma client
        print_status "Generating Prisma client..."
        npx prisma generate
        
        # Seed database
        print_status "Seeding database..."
        npm run db:seed || print_warning "Database seeding failed - this is normal for first run"
        
        cd ..
        
        print_success "Database setup completed"
    else
        print_warning "Docker not available. Please setup PostgreSQL manually:"
        print_warning "1. Install PostgreSQL 15+"
        print_warning "2. Create database 'cbd_diary_dev'"
        print_warning "3. Update DATABASE_URL in .env.local"
        print_warning "4. Run: npm run db:migrate"
        print_warning "5. Run: npm run db:seed"
    fi
}

# Create development scripts
create_scripts() {
    print_status "Creating development scripts..."
    
    # Create start script
    cat > start-dev.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting CBD Diary Development Environment"

# Start database services
docker-compose up -d postgres redis

# Wait for services to be ready
sleep 5

# Start development servers
npm run start:dev
EOF
    chmod +x start-dev.sh
    
    # Create stop script
    cat > stop-dev.sh << 'EOF'
#!/bin/bash
echo "🛑 Stopping CBD Diary Development Environment"

# Stop all services
docker-compose down

echo "✅ All services stopped"
EOF
    chmod +x stop-dev.sh
    
    print_success "Development scripts created"
}

# Main setup function
main() {
    echo
    print_status "Starting CBD Diary development setup..."
    echo
    
    check_dependencies
    echo
    
    setup_environment
    echo
    
    install_dependencies
    echo
    
    setup_database
    echo
    
    create_scripts
    echo
    
    print_success "🎉 Setup completed successfully!"
    echo
    echo "To start development:"
    echo "  ./start-dev.sh    - Start all services"
    echo "  npm run start:dev - Start development servers"
    echo "  npm run db:studio - Open database admin"
    echo
    echo "To stop development:"
    echo "  ./stop-dev.sh     - Stop all services"
    echo
    echo "Useful commands:"
    echo "  npm run backend:dev  - Start only backend"
    echo "  npm run mobile:dev   - Start only mobile app"
    echo "  npm run db:migrate   - Run database migrations"
    echo "  npm run lint         - Run linting"
    echo
}

# Run main function
main "$@"