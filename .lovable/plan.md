

# Field Operations Management App

## Overview
A modern React application with Supabase authentication, user profiles, and a comprehensive sidebar navigation for managing field operations including inventory, equipment, job assignments, and team locations.

---

## Phase 1: Authentication Foundation

### Auth Page (`/auth`)
- Clean login/signup form with email and password
- Toggle between Login and Sign Up modes
- Modern styling with accent colors and subtle gradients
- Error handling with user-friendly messages
- Automatic redirect to `/dashboard` after successful login

### User Profiles Database
- Create `profiles` table linked to Supabase auth users
- Fields: id, email, full_name, avatar_url, phone, role, created_at
- Row-Level Security policies for user data protection
- Automatic profile creation on signup via database trigger

---

## Phase 2: App Layout & Navigation

### Sidebar Navigation
Modern, bold sidebar with the following sections:
- **Dashboard** - Main overview (home icon)
- **Inventory** - Stock and supplies management
- **Checklists** - Task and inspection lists
- **Equipment** - Asset tracking
- **Calls** - Job calls and requests
- **Job Map** - Geographic view of jobs
- **Users Locations** - Team member tracking
- **Settings** - Account and app configuration

### Layout Features
- Collapsible sidebar (full width ↔ icon-only mini mode)
- Active route highlighting
- User avatar and name in sidebar footer
- Logout button
- Responsive design for mobile devices

---

## Phase 3: Protected Routes & Pages

### Route Protection
- Auth context provider to manage user session
- Protected route wrapper component
- Automatic redirect to `/auth` for unauthenticated users
- Session persistence across page refreshes

### Placeholder Pages
Each page will have:
- Page title and description
- Empty state with icon
- "Coming soon" or placeholder content
- Consistent header layout

---

## Visual Design

### Modern & Bold Theme
- Primary accent color (blue/purple gradient)
- Bold headings with good contrast
- Card-based layouts with subtle shadows
- Rounded corners and modern spacing
- Gradient accents on key UI elements
- Light mode with option for dark mode later

---

## Technical Implementation

### Database Structure
1. **profiles** - User information
2. RLS policies for secure data access

### Key Components
- `AuthProvider` - Session management context
- `ProtectedRoute` - Route guard component  
- `AppSidebar` - Main navigation
- `DashboardLayout` - Wrapper with sidebar
- Individual page components for each route

### Navigation Routes
- `/auth` - Login/Signup
- `/dashboard` - Main dashboard
- `/inventory` - Inventory management
- `/checklists` - Checklist management
- `/equipment` - Equipment tracking
- `/calls` - Call management
- `/job-map` - Map view
- `/users-locations` - Team locations
- `/settings` - User settings

