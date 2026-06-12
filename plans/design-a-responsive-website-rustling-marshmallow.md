# Plan: Fun Features Collection Website (趣味功能集合主站)

## Context

Build the main site framework for an expandable "fun features collection" website. The site will house many small tools/games over time. Current goal: a polished, responsive shell with navigation, home page, feature hall, settings, and login/register — no real backend, mock data only.

## Aesthetic Stance

**Warm-Playful Minimalist** — light creamy-white background, bold orange (#FF6B2B) as primary accent, rounded cards, soft shadows. Feels like a friendly indie product, not enterprise SaaS.

- **Display font**: Nunito (Google Fonts) — geometric, rounded, friendly
- **Body font**: Inter — clean, readable
- **Primary color**: `#FF6B2B` (vivid warm orange)
- **Background**: `#FFFAF6` (warm off-white)
- **Card surface**: `#FFFFFF`
- **Secondary surface**: `#FFF3EB` (light peach tint)
- **Muted text**: `#8C7B72`
- **Border**: `rgba(255, 107, 43, 0.15)`
- **Radius**: `1rem`

## Architecture

### Files to create / modify

| File | Action |
|------|--------|
| `src/styles/theme.css` | Update tokens to match warm-playful palette |
| `src/styles/fonts.css` | Add Nunito + Inter Google Fonts imports |
| `src/app/App.tsx` | Main layout shell: sidebar + router |
| `src/app/components/Sidebar.tsx` | Collapsible left sidebar |
| `src/app/components/HomePage.tsx` | Hero, feature preview cards, about section |
| `src/app/components/FeatureHall.tsx` | Search, filter tabs, feature card grid |
| `src/app/components/SettingsPage.tsx` | User profile, theme toggle, logout |
| `src/app/components/AuthModal.tsx` | Login/Register modal with tab switch |

### Routing

Use `react-router` (already installed v7.13.0). Routes: `/` (Home), `/features` (Feature Hall), `/settings` (Settings). Login/Register is a modal triggered from the sidebar.

### State management

Simple `useState` in App.tsx for:
- `currentPage` — active route
- `sidebarCollapsed` — sidebar open/closed
- `isLoggedIn` — mock auth state (toggled via login modal)
- `isDarkMode` — theme toggle

## Page Details

### 1. Sidebar
- Top: Logo icon + "趣站" site name (collapsed: icon only)
- User zone: logged-out shows Login/Register button; logged-in shows avatar + nickname + welcome text
- Nav items: 首页, 功能大厅, 设置 (with lucide-react icons)
- Bottom: "更多功能即将加入 ✨" coming-soon text
- Collapse toggle button on the edge
- Mobile: sidebar becomes a bottom tab bar or hamburger overlay

### 2. Home Page
- **Hero**: large gradient banner, site title "趣站 · Fun Hub", tagline, CTA button "进入功能大厅"
- **Quick access**: 3-4 most popular feature cards (horizontal scroll on mobile)
- **About strip**: short description of the site concept
- **Featured / Coming Soon**: 6 feature placeholder cards (grid)
- **Recent updates**: simple timeline/list of "new feature" announcements

### 3. Feature Hall
- Page header + search input
- Category filter tabs: 全部 / 工具 / 娱乐 / 生活 / 实验
- Responsive card grid (3-col desktop, 2-col tablet, 1-col mobile)
- Each card: emoji icon, name, one-line description, status badge (可用 / Coming Soon), enter button
- 12 placeholder cards across categories

### 4. Settings Page
- Logged-in view: avatar upload placeholder, nickname/email/bio fields, password change, theme toggle, logout
- Logged-out view: "请先登录" empty state with login CTA

### 5. Auth Modal
- Slide-up modal, tab between 登录 / 注册
- Login: email + password + submit
- Register: nickname + email + password + confirm password + submit
- Email verification code input view (for password reset / email change)
- Friendly copy, orange CTA buttons

## Theme Token Changes (theme.css)

```css
--background: #FFFAF6;
--foreground: #2D1F18;
--card: #FFFFFF;
--card-foreground: #2D1F18;
--primary: #FF6B2B;
--primary-foreground: #FFFFFF;
--secondary: #FFF3EB;
--secondary-foreground: #2D1F18;
--muted: #F5EDE6;
--muted-foreground: #8C7B72;
--accent: #FFD4B8;
--accent-foreground: #2D1F18;
--border: rgba(255, 107, 43, 0.15);
--ring: #FF6B2B;
--radius: 1rem;
```

## Verification

1. Check all four pages render without errors
2. Sidebar collapse/expand works
3. Login modal opens, tabs switch between login/register
4. Toggling login state changes sidebar user zone
5. Feature Hall filter tabs filter cards
6. Settings page shows correct view based on login state
7. Dark mode toggle applies `.dark` class
8. Mobile view: sidebar collapses to hamburger/overlay, grids reflow to 1-col
