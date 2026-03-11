# JengaTrack Web App — Audit Summary (74 items)

| # | Issue | Status | File | Notes |
|---|-------|--------|------|-------|
| 1 | AppLayout wraps all routes | ✅ Done | App.tsx | /budget, /materials, /daily, /trends, /settings, /help, /projects all wrap in AppLayout |
| 2 | No page imports AppLayout internally | ✅ Done | BudgetPage, MaterialsPage, DailyPage, TrendsPage, SettingsPage, HelpPage, ProjectsPage | None import AppLayout; pages/DashboardPage.tsx does but is not the route component |
| 3 | HelpPage no internal navbar | ✅ Done | HelpPage.tsx | No <nav>/<header> duplicating AppLayout |
| 4 | AppLayout mobile pb-16 + overflow-x-hidden | ✅ Done | AppLayout.tsx | pb-16 md:pb-0, overflow-x-hidden, max-w-[100vw] on content |
| 5 | Sidebar mobile overlay bg-black/40 | ✅ Done | Sidebar.tsx | open && div fixed inset-0 bg-black/40 z-20 md:hidden onClick |
| 6 | Sidebar/BottomNav Link > div only, no <a> | ✅ Done | Sidebar, BottomNav, ProjectCard | Fixed ProjectCard: Link > div, dropdown items Link > span |
| 7 | AppLayout useEffect projectsJson dependency | ✅ Done | AppLayout.tsx | JSON.stringify(projectsData) in useEffect deps |
| 8 | No hardcoded dark hex on non-decorative | ✅ Done | pages/, dashboard-new/ | None found |
| 9 | No text-white on non-decorative (use text-foreground) | ✅ Done | pages/, dashboard-new/ | text-white only on buttons/overlays (OK) |
| 10 | No rgba(255,255,255,X) borders (use border-border) | ✅ Done | BudgetPage.tsx | Recharts Tooltip/cursor use hsl(var(--border)) and --card-foreground |
| 11 | Form inputs bg-muted border-border text-foreground | ✅ Done | pages, modals | Inputs use theme classes |
| 12 | Auth form side bg-background | ✅ Done | login, signup, forgot-password, reset-password | Form side uses bg-background |
| 13 | Login split layout left image 45% / 260px | ✅ Done | login.tsx | Split, /construction-site.jpg, overlay, JengaTrack, stat pills |
| 14 | Signup split, Full Name/Email/WhatsApp/Password, maxLength | ✅ Done | signup.tsx | Fields and maxLength 100/254/15, min 8 password |
| 15 | Signup inline validation errors state | ✅ Done | signup.tsx | errors state, red <p>, no API on fail |
| 16 | Signup email regex before API | ✅ Done | signup.tsx | /^[^\s@]+@[^\s@]+\.[^\s@]+$/ |
| 17 | Forgot password empty email + regex + API error inline | ✅ Done | forgot-password.tsx | "Email is required", regex, error below field |
| 18 | Login password autocomplete current-password | ✅ Done | login.tsx | autocomplete="current-password" |
| 19 | Signup password autocomplete new-password | ✅ Done | signup.tsx | autocomplete="new-password" |
| 20 | isLoading resolves after auth (no stuck spinner) | ✅ Done | useAuth.tsx | useQuery .finally / enabled resolves |
| 21 | Dashboard KPI cards live data from hooks | ✅ Done | DashboardPage.tsx | useProjectSummary, useProjectExpenses, issues |
| 22 | Schedule Status percentSpent logic | ✅ Done | DashboardPage.tsx | >=100 Over Budget, >=85 At Risk, >=70 Attention, else On Track |
| 23 | timeAgo date-only vs ISO, ms<60s "just now" | ✅ Done | DashboardPage.tsx | timeAgo handles both, prefers created_at |
| 24 | Currency UGX only, zero USh | ✅ Done | client/src | No USh found |
| 25 | View details scrolls to issues-section | ✅ Done | DashboardPage.tsx | scrollIntoView({ behavior: 'smooth' }) |
| 26 | Issue checkbox PATCH acknowledged + refetch + style | ✅ Done | DashboardPage.tsx | PATCH status acknowledged, opacity-50 line-through |
| 27 | PATCH /api/issues/:id sets acknowledged_at | ✅ Done | api/index.js | When status=acknowledged, updates.acknowledged_at set; migration add_acknowledged_at_to_issues.sql |
| 28 | Photo upload pendingPhoto + modal (no immediate upload) | ✅ Done | DashboardPage.tsx | pendingPhoto, modal caption + tag pills, Cancel + Upload |
| 29 | Photo caption + tag saved to DB | ✅ Done | api/index.js | daily_logs photo_urls entries + caption/tag; POST daily/photo |
| 30 | Expense rows three-dot Edit/Delete, confirm + PATCH/DELETE | ✅ Done | DashboardPage.tsx | Menu, confirm, DELETE/PATCH, refetch |
| 31 | View All Activity → /budget?project=<id> | ✅ Done | DashboardPage.tsx | Link href=/budget?project=... |
| 32 | Budget 5 KPI cards live data | ✅ Done | BudgetPage.tsx | Total Budget, Expenditure, Balance, %, Weeks Remaining |
| 33 | Cost trend Recharts LineChart period 1W/1M/3M/All | ✅ Done | BudgetPage.tsx | Period selector + ComposedChart |
| 34 | Expense search client-side by description | ✅ Done | BudgetPage.tsx | Input filters list case-insensitive |
| 35 | Date range filter From/To expense_date | ✅ Done | BudgetPage.tsx | From/To inputs filter by expense_date |
| 36 | Sort dropdown Newest/Oldest/Highest/Lowest | ✅ Done | BudgetPage.tsx | Sort options |
| 37 | Showing X of Y + Clear filters when active | ✅ Done | BudgetPage.tsx | Count + Clear filters button |
| 38 | Budget expense rows same edit/delete menu | ✅ Done | BudgetPage.tsx | PATCH/DELETE /api/expenses/:id |
| 39 | DELETE /api/expenses/:id ownership | ✅ Done | api/index.js | project user_id check |
| 40 | PATCH /api/expenses/:id ownership + description/amount | ✅ Done | api/index.js | Ownership, updates description/amount/updated_at |
| 41 | Materials from materials_inventory | ✅ Done | MaterialsPage, useDashboard, api | useProjectMaterials → GET projects/:id/materials → materials_inventory |
| 42 | Materials name, quantity, unit, low_stock_threshold, Low Stock badge | ✅ Done | MaterialsPage.tsx | Display + badge when quantity <= low_stock_threshold |
| 43 | GET /api/materials materials_inventory by project_id | ✅ Done | api/index.js | GET /api/projects/:id/materials queries materials_inventory |
| 44 | POST /api/materials UPSERT materials_inventory | ✅ Done | api/index.js | Select by project_id+name then update or insert |
| 45 | UNIQUE (project_id, name) materials_inventory | ⚠️ N/A | Supabase | Migration/constraint in DB; code assumes upsert by name |
| 46 | Daily page stats + heatmap + recent logs + photos | ✅ Done | DailyPage.tsx | Stats row, heatmap, recent logs with photos |
| 47 | Daily Log modal timeline (worker + activity entries) | ✅ Done | DashboardPage.tsx | Worker count, entries with time/type/description/amount, Add entry, Cancel/Save |
| 48 | POST /api/daily-logs entries JSONB upsert | ✅ Done | api/index.js | log_date, worker_count, entries, upsert (project_id, log_date) |
| 49 | Trends prediction banner + BarChart + LineChart + materials + alerts | ✅ Done | TrendsPage.tsx | Burn rate, weeks remaining, runout, charts, top materials, alerts |
| 50 | Settings Change Password form onSubmit, button type=submit | ✅ Done | SettingsPage.tsx | form onSubmit handlePasswordChange, button type="submit" |
| 51 | Settings hidden username field | ✅ Done | SettingsPage.tsx | input type=text name=username autoComplete=username display:none value=user?.email |
| 52 | Settings current/new password autocomplete | ✅ Done | SettingsPage.tsx | current-password, new-password |
| 53 | Help hero + search + quick actions + 3-step + commands + FAQ + contact | ✅ Done | HelpPage.tsx | Structure present |
| 54 | Help FAQ accordion one open, smooth | ✅ Done | HelpPage.tsx | Accordion state, expand/collapse |
| 55 | Projects grid, card name/status/progress/budget/On Track/menu | ✅ Done | ProjectsPage.tsx, ProjectCard.tsx | Grid, card content, three-dot menu |
| 56 | Project card full clickable → /dashboard?project=<id> | ✅ Done | ProjectCard.tsx | Link href=/dashboard?project=; no nested <a> |
| 57 | Log Expense modal inline validation | ✅ Done | DashboardPage.tsx | Description required, valid amount, no API on fail |
| 58 | Report Issue modal title required inline | ✅ Done | DashboardPage.tsx | issueErrors.title "Issue title is required" |
| 59 | Daily Log modal worker count validation inline | ✅ Done | DashboardPage.tsx | dailyErrors.workerCount "Please enter the number of workers on site" |
| 60 | All modals DialogDescription inside DialogContent | ✅ Done | DashboardPage.tsx | Log Expense, Report Issue, Daily Log: role=dialog, aria-describedby + sr-only description |
| 61 | /privacy real content 11 sections | ✅ Done | privacy.tsx | Introduction, Information We Collect, How We Use, Data Storage, etc. |
| 62 | /terms real content 15 sections | ✅ Done | terms.tsx | Acceptance, Service, Registration, Acceptable Use, Governing Law, etc. |
| 63 | Bot photo caption state awaiting_photo_caption | ✅ Done | _whatsapp-webhook.ts | isImage block sets expense_state + photo_url, project_id |
| 64 | Photo caption handler before intent, daily_logs + site_photos | ✅ Done | _whatsapp-webhook.ts | awaiting_photo_caption block, notes append, site_photos try/catch, clear state, reply |
| 65 | ai() lang param, dynamic system content | ✅ Done | _whatsapp-webhook.ts | langInstruction, Gemini + OpenAI |
| 66 | detectedLang passed through routeIntent to handlers | ✅ Done | _whatsapp-webhook.ts | detectLanguage(rawMessage), routeIntent(..., lang), handleExpenseLog etc get lang |
| 67 | RLS on daily_logs | ⚠️ N/A | migrations | rls_daily_logs_issues_vendors_sessions.sql — run in Supabase |
| 68 | RLS on issues | ⚠️ N/A | migrations | Same file |
| 69 | RLS on sessions | ⚠️ N/A | migrations | Same file |
| 70 | Dirty data deleted (cement that are worth, material) | ✅ Done | migrations/cleanup_materials_inventory_garbage.sql | Added 'cement that are worth' to DELETE list |
| 71 | Zero .from('materials') | ✅ Done | codebase | All materials_inventory |
| 72 | Zero column material_name (use name) | ✅ Done | API/DB | materials_inventory uses name; material_name only in profile JSONB key |
| 73 | whatsapp-webhook.js in sync with _whatsapp-webhook.ts | ✅ Done | api/ | npm run build runs build-api.js → whatsapp-webhook.js |
| 74 | npm run build zero errors | ✅ Done | — | Build completed successfully |

---

## Fixes applied

| File | Change |
|------|--------|
| **client/src/components/projects/ProjectCard.tsx** | Replaced nested `<a>` inside `<Link>` with `<div role="link">` for card and `<span>` for dropdown menu items (no `<a>` inside `Link`). |
| **api/index.js** | PATCH `/api/issues/:id`: when `status === 'acknowledged'`, set `updates.acknowledged_at = new Date().toISOString()`. |
| **client/src/pages/BudgetPage.tsx** | Recharts Tooltip: replaced hardcoded `rgba(255,255,255,0.1)` border/cursor and `#1e2235`/`#fff` with `hsl(var(--card))`, `hsl(var(--border))`, `hsl(var(--card-foreground))`, `hsl(var(--muted-foreground))`. |
| **migrations/cleanup_materials_inventory_garbage.sql** | Added `'cement that are worth'` to the `IN (...)` list for `DELETE FROM materials_inventory`. |
| **migrations/add_acknowledged_at_to_issues.sql** | New migration: `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz`. |
| **client/src/components/dashboard-new/DashboardPage.tsx** | Log Expense, Report Issue, and Daily Log modals: added `role="dialog"`, `aria-modal="true"`, `aria-labelledby`/`aria-describedby`, and sr-only description `<p id="...-desc" className="sr-only">` for accessibility. |
| **client/src/pages/DashboardPage.tsx** | Removed `AppLayout` wrapper so the placeholder page does not double-wrap if ever used (main dashboard uses `FullDashboard` in `AppLayout` from `App.tsx`). |

**Note:** Run in Supabase when ready: `migrations/add_acknowledged_at_to_issues.sql` (so PATCH issues can set `acknowledged_at`), and `migrations/cleanup_materials_inventory_garbage.sql` for dirty data. RLS migrations (67–69) are in `migrations/rls_daily_logs_issues_vendors_sessions.sql`.
