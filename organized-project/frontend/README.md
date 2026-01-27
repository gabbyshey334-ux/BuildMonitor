# Frontend - Construction Monitor Uganda

React + TypeScript frontend with modern UI components and real-time data management.

## 🚀 Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file with:
   ```env
   VITE_API_URL=http://localhost:5000
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   ```

## 📁 File Structure

```
├── src/
│   ├── components/        # React components
│   │   ├── ui/           # Reusable UI components (shadcn/ui)
│   │   └── *.tsx         # Feature components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility functions
│   ├── pages/            # Page components
│   ├── types/            # TypeScript type definitions
│   ├── App.tsx           # Main app component
│   ├── main.tsx          # App entry point
│   └── index.css         # Global styles
├── index.html            # HTML template
└── public/               # Static assets
```

## 🛠️ Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 🎨 UI Components

Built with **shadcn/ui** components:
- Modern, accessible design system
- Customizable with Tailwind CSS
- Dark/light theme support
- Responsive layouts

## 📱 Key Features

- **Project Dashboard** - Overview of all projects
- **Task Management** - Create, assign, and track tasks
- **Financial Tracking** - Budget monitoring and expense tracking
- **Daily Ledgers** - Line-item financial accountability
- **Inventory System** - Material delivery and usage tracking
- **Supplier Management** - Vendor database and purchase tracking
- **Real-time Updates** - Live data with TanStack Query

## 🔗 API Integration

The frontend communicates with the backend via REST API:
- Authentication via Replit OIDC
- Real-time data fetching with TanStack Query
- Form validation with Zod schemas
- Type-safe API calls