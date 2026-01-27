# Construction Management App Design Guidelines

## Design Approach
**Material Design System** adapted for mobile-first construction workflows. Prioritizes touch accessibility, clear hierarchy, and quick data entry for field conditions.

## Typography
- **Primary Font**: Inter or Roboto via Google Fonts CDN
- **Hierarchy**:
  - Page Titles: 28px/bold
  - Section Headers: 20px/semibold  
  - Card Titles: 16px/medium
  - Body Text: 14px/regular
  - Buttons: 16px/medium
  - Labels/Metadata: 12px/regular

## Layout System
**Spacing**: Use Tailwind units of **4, 6, 8** exclusively (p-4, gap-6, mb-8)
- Mobile: Single column, p-4 container padding
- Desktop: max-w-6xl centered container, can use 2-column grids
- Card spacing: gap-4 on mobile, gap-6 on desktop
- Section padding: py-8 on mobile, py-12 on desktop

## Touch Targets & Navigation
- **Minimum Size**: 48px height for all interactive elements
- **Hamburger Menu**: Top-left, opens overlay drawer with full navigation
- **Bottom Navigation Bar**: 64px height, 4-5 primary actions (Dashboard, Expenses, Tasks, Ledger, Profile)
- **Floating Action Button**: 56px circle, bottom-right for primary actions (Add Expense, New Task)

## Component Library

### Cards (Primary Data Container)
- Rounded corners (rounded-lg)
- Elevated shadow (shadow-md)
- p-4 internal padding
- Each card shows: Title, metadata row, primary content, action buttons
- Tap entire card for details, swipe left for quick actions

### Forms & Inputs
- Input fields: h-12 minimum, p-4 padding
- Labels above inputs (not floating)
- Large date/time pickers optimized for touch
- Number pads auto-appear for expense amounts
- Dropdowns with 48px items minimum

### Buttons
- Primary: h-12, px-6, rounded-lg, full-width on mobile
- Secondary: Same size, outlined style
- Icon buttons: 48px × 48px minimum
- Buttons on images: Backdrop blur with semi-transparent background

### Data Display
- **Lists**: Card-based with spacing
- **Stats Dashboard**: 2×2 grid of metric cards on mobile
- **Expense Items**: Card per transaction with category icon, amount, date
- **Daily Ledger**: Expandable date cards with nested transaction lists

## Images

**Dashboard Hero Section**: 
- Mobile: 200px height banner image
- Desktop: 300px height
- Shows construction site/workers in action
- Overlaid with blurred-background greeting card: "Good Morning, [Name]" + quick stats
- Use high-quality stock photos from construction sites

**Empty States**:
- Illustration placeholders when no expenses/tasks exist
- Simple line drawings of construction equipment/documents

## Navigation Structure
**Bottom Bar Icons** (with labels):
1. Dashboard - Home icon
2. Expenses - Receipt icon  
3. Tasks - Checklist icon
4. Reports - Chart icon
5. More - Menu dots

**Hamburger Drawer** (secondary items):
- Projects
- Team Members
- Settings
- Help & Support
- Logout

## Mobile-Specific Patterns
- Pull-to-refresh on list views
- Infinite scroll for ledger history
- Sticky section headers when scrolling
- Quick-add expense from camera (receipt photo)
- Offline-first indicators with sync status
- Toast notifications at top (not blocking bottom nav)

## Animations
Minimal: 200ms transitions for card reveals, drawer slides, and bottom sheet appearances only.