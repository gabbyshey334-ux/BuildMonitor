# Construction Monitor Uganda

## Overview

Construction Monitor Uganda is a comprehensive project management system specifically designed for construction companies. The application provides tools for tracking budgets, managing tasks, monitoring suppliers, handling inventory, and ensuring daily financial accountability. It features a modern web interface with authentication through Replit's OIDC system and integrates with PostgreSQL for data persistence. The system supports multi-user access with role-based functionality for project owners and managers.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **UI Library**: shadcn/ui components built on Radix UI primitives for consistent design
- **Styling**: Tailwind CSS with custom CSS variables for brand theming
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation for type-safe form management

### Backend Architecture
- **Framework**: Express.js with TypeScript for API endpoints
- **Database ORM**: Drizzle ORM for type-safe database operations
- **File Uploads**: Support for Uppy with AWS S3 and Google Cloud Storage integrations
- **Session Management**: Express sessions with PostgreSQL store for persistent user sessions

### Authentication System
- **Provider**: Replit OIDC integration using Passport.js
- **Strategy**: OpenID Connect with automatic user provisioning
- **Session Storage**: PostgreSQL-backed sessions with configurable TTL

### Database Design
- **Primary Database**: PostgreSQL with Neon Database integration
- **Schema Management**: Drizzle migrations with schema definitions in TypeScript
- **Key Entities**: Users, Projects, Tasks, Updates, Advances, Suppliers, Inventory, Milestones, Daily Ledgers, Cash Deposits
- **Relationships**: Foreign key constraints with proper cascading for data integrity

### Project Management Features
- **Task Management**: Create, assign, and track project tasks with priority levels and due dates
- **Financial Tracking**: Budget monitoring, expense categorization, and cash flow management
- **Supplier Management**: Vendor database with purchase tracking and payment methods
- **Inventory System**: Material delivery tracking with usage monitoring
- **Daily Ledgers**: Line-item financial accountability with cash/supplier payment tracking
- **Milestone Management**: Project phase tracking with progress indicators

### File Handling
- **Upload Strategy**: Multiple provider support (AWS S3, Google Cloud Storage)
- **Frontend Integration**: Uppy dashboard for drag-and-drop file management
- **Attachment Support**: Project updates and task documentation

## Integration Capabilities

### WhatsApp/N8N Integration (Implemented)
- **Messaging Platform**: WhatsApp for project manager communication via n8n middleware
- **AI-Powered Responses**: OpenAI integration with RAG (Retrieval-Augmented Generation) for intelligent Q&A
- **Message History**: Full conversation tracking with database persistence
- **Project Scoping**: Messages can be linked to specific projects for context
- **User Management**: Automatic user provisioning based on WhatsApp numbers
- **Multi-modal Support**: Text, voice transcriptions, images, PDFs, and documents
- **Contextual Replies**: Smart confirmation messages and project-aware responses

#### Security Architecture
- **Webhook Authentication**: Bearer token authentication (N8N_WEBHOOK_SECRET) for all webhook endpoints
- **Project Authorization**: Users can only access projects they own (ownerId verification)
- **User Verification**: AI endpoints reject unrecognized WhatsApp numbers to prevent spoofing
- **Concurrent Safety**: Defensive upsert logic handles race conditions in user creation
- **Rate Limiting**: Recommended for production to prevent abuse (not currently implemented)
- **Data Scoping**: RAG queries limited to 10 results per source to prevent memory exhaustion

#### API Endpoints
- `POST /api/webhooks/whatsapp` - Receive and process WhatsApp messages
- `POST /api/rag/query` - Retrieve project context for AI responses
- `POST /api/ai/answer` - Generate AI-powered answers using OpenAI
- `GET /api/messages` - Retrieve message history (authenticated)
- `GET /api/users/:id/history` - Get user conversation history (authenticated)
- `GET /api/health` - System health check (public)

#### Database Tables
- `whatsapp_messages` - Stores all incoming/outgoing messages with metadata
- `users.whatsapp_number` - Links WhatsApp numbers to user accounts

See N8N_INTEGRATION_GUIDE.md for complete setup instructions.

## External Dependencies

- **Database**: Neon Database (PostgreSQL) for primary data storage
- **Authentication**: Replit OIDC service for user management
- **File Storage**: Google Cloud Storage and AWS S3 for document/image uploads
- **UI Components**: Radix UI primitives for accessible component foundation
- **Validation**: Zod for runtime type checking and form validation
- **Development**: Replit-specific plugins for development environment integration
- **Messaging Integration**: WhatsApp via N8N for external communication (future implementation)