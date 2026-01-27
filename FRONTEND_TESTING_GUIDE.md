# 🧪 Frontend Testing Guide - Dashboard Home Page

## Quick Start Testing

### 1. **Start the Backend Server**

```bash
cd /Users/cipher/Downloads/BuildMonitor
npm run dev
```

Expected output:
```
✅ Twilio client initialized for WhatsApp number: whatsapp:+14155238886
✅ Database connected successfully
🚀 Server running on http://localhost:5000
📡 API routes mounted at /api
📱 WhatsApp webhook mounted at /webhook
```

### 2. **Start the Frontend Dev Server**

In a new terminal:

```bash
cd /Users/cipher/Downloads/BuildMonitor
npm run dev
```

Expected output:
```
  VITE v5.x.x  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### 3. **Open in Browser**

Navigate to: `http://localhost:5173/`

---

## 🔐 Login Credentials (MVP Hardcoded)

```
Username: owner
Password: owner123
```

On first login, the system will:
1. Create a profile for "Owner User"
2. Create a default project: "Default Project" (10M UGX budget)
3. Create 5 default categories: Materials, Labor, Equipment, Transport, Miscellaneous

---

## 📋 Dashboard Testing Checklist

### **Budget Overview Section**

- [ ] **Total Budget Card**
  - Shows "UGX 10,000,000" (default)
  - Shows project name "Default Project"
  - Has blue dollar sign icon

- [ ] **Total Spent Card**
  - Shows "UGX 0" initially (no expenses yet)
  - Shows "0.0% of budget used"
  - Has yellow trending up icon

- [ ] **Remaining Balance Card**
  - Shows "UGX 10,000,000" initially
  - Shows "Budget on track" in green
  - Has green dollar sign icon

- [ ] **Budget Progress Bar**
  - Shows 0% progress initially
  - Updates when expenses are added
  - Shows "0 expenses recorded" and "0 active tasks"

### **Recent Expenses Section**

- [ ] **Empty State**
  - Shows dollar sign icon
  - Message: "No expenses recorded yet"
  - Subtitle: "Start tracking by sending a WhatsApp message or adding manually"

- [ ] **With Data** (after adding expenses via WhatsApp or API)
  - Each expense card shows:
    - Description (truncated if long)
    - Category badge with color
    - Amount in UGX (bold, white)
    - Date (formatted as "Jan 25, 2026")
    - Source (whatsapp, dashboard, api)
  - "View All" link navigates to Financials tab

### **Active Tasks Section**

- [ ] **Empty State**
  - Shows check square icon
  - Message: "No active tasks"

- [ ] **With Data** (after adding tasks)
  - Each task card shows:
    - Title (truncated if long)
    - Priority badge (low/medium/high with colors)
    - Due date (with calendar icon)
    - Status badge (pending, in_progress)
  - "View All" link navigates to Tasks tab

### **WhatsApp Quick Log Card**

- [ ] Shows green gradient background
- [ ] Displays WhatsApp number from user profile
- [ ] Shows 3 example messages with emojis
- [ ] "Add Expense Manually" button opens dialog
- [ ] Dialog shows placeholder message about using WhatsApp

---

## 🔄 Testing Data Flow

### **Test 1: Add Expense via WhatsApp Simulation**

Since we can't test Twilio webhooks locally without ngrok, we'll test the API directly:

```bash
# 1. Login and get session cookie
curl -c cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"owner","password":"owner123"}'

# 2. Add an expense
curl -b cookies.txt -X POST http://localhost:5000/api/expenses \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Cement for foundation",
    "amount": 150000,
    "expense_date": "2026-01-25T00:00:00Z"
  }'

# 3. Refresh dashboard - should show:
# - Total Spent: UGX 150,000
# - Remaining: UGX 9,850,000
# - 1.5% budget used (green)
# - 1 expense in Recent Expenses
```

### **Test 2: Add Multiple Expenses**

```bash
# Add more expenses
curl -b cookies.txt -X POST http://localhost:5000/api/expenses \
  -H "Content-Type: application/json" \
  -d '{"description":"Bricks for walls","amount":250000,"expense_date":"2026-01-25T00:00:00Z"}'

curl -b cookies.txt -X POST http://localhost:5000/api/expenses \
  -H "Content-Type: application/json" \
  -d '{"description":"Labor payment","amount":500000,"expense_date":"2026-01-25T00:00:00Z"}'

# Dashboard should now show:
# - Total Spent: UGX 900,000
# - Remaining: UGX 9,100,000
# - 9.0% budget used (green)
# - 3 expenses in Recent Expenses
```

### **Test 3: Approach Budget Limit (Test Color Changes)**

```bash
# Add a large expense to trigger yellow warning (50%+)
curl -b cookies.txt -X POST http://localhost:5000/api/expenses \
  -H "Content-Type: application/json" \
  -d '{"description":"Roofing materials","amount":6000000,"expense_date":"2026-01-25T00:00:00Z"}'

# Dashboard should show:
# - Total Spent: UGX 6,900,000
# - Remaining: UGX 3,100,000 (YELLOW)
# - 69.0% budget used (YELLOW)
# - No warning yet (< 80%)

# Add another to trigger red warning (80%+)
curl -b cookies.txt -X POST http://localhost:5000/api/expenses \
  -H "Content-Type: application/json" \
  -d '{"description":"Electrical wiring","amount":2000000,"expense_date":"2026-01-25T00:00:00Z"}'

# Dashboard should show:
# - Total Spent: UGX 8,900,000
# - Remaining: UGX 1,100,000 (RED)
# - 89.0% budget used (RED)
# - Warning: "Warning: Near limit" (red alert icon)

# Add one more to go over budget (90%+)
curl -b cookies.txt -X POST http://localhost:5000/api/expenses \
  -H "Content-Type: application/json" \
  -d '{"description":"Plumbing fixtures","amount":1500000,"expense_date":"2026-01-25T00:00:00Z"}'

# Dashboard should show:
# - Total Spent: UGX 10,400,000
# - Remaining: UGX -400,000 (RED)
# - 104.0% budget used (RED)
# - Critical: "Critical: Over budget!" (red alert icon)
```

### **Test 4: Add Tasks**

```bash
# Add a pending task
curl -b cookies.txt -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Inspect foundation quality",
    "description": "Check for cracks and proper curing",
    "priority": "high",
    "dueDate": "2026-01-30T00:00:00Z"
  }'

# Add another task
curl -b cookies.txt -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Order roofing materials",
    "priority": "medium",
    "dueDate": "2026-02-01T00:00:00Z"
  }'

# Dashboard should show:
# - 2 active tasks
# - Each with priority badge and due date
# - "View All" link to Tasks tab
```

---

## 🎨 Visual Testing (Manual)

### **Responsive Design**

1. **Desktop (1920x1080)**
   - [ ] 3 budget cards side-by-side
   - [ ] Expenses take 2/3 width, tasks + WhatsApp take 1/3
   - [ ] All text is readable
   - [ ] No horizontal scroll

2. **Tablet (768x1024)**
   - [ ] 3 budget cards side-by-side (smaller)
   - [ ] Main content stacks vertically
   - [ ] Cards are full-width

3. **Mobile (375x667)**
   - [ ] All cards stack vertically
   - [ ] Budget cards are full-width
   - [ ] Text is readable (no overflow)
   - [ ] Touch targets are at least 44x44px

### **Color-Coded Alerts**

1. **Green (Healthy < 50%)**
   - [ ] Remaining balance is green
   - [ ] Message: "Budget on track"
   - [ ] Green dollar sign icon

2. **Yellow (Caution 50-80%)**
   - [ ] Remaining balance is yellow
   - [ ] Percentage is yellow
   - [ ] No warning message yet

3. **Red (Warning 80-90%)**
   - [ ] Remaining balance is red
   - [ ] Percentage is red
   - [ ] Message: "Warning: Near limit"
   - [ ] Red alert icon

4. **Red (Critical 90%+)**
   - [ ] Remaining balance is red
   - [ ] Percentage is red
   - [ ] Message: "Critical: Over budget!"
   - [ ] Red alert icon
   - [ ] Trending down icon instead of dollar sign

### **Loading States**

To test loading states:

1. Throttle network in browser DevTools:
   - Open DevTools (F12)
   - Go to Network tab
   - Set throttling to "Slow 3G"
   - Refresh page

2. Verify:
   - [ ] Budget cards show skeleton loaders
   - [ ] Expenses section shows 3 skeleton cards
   - [ ] Tasks section shows 3 skeleton cards
   - [ ] Skeletons animate (shimmer effect)

### **Error States**

To test error states:

1. Stop the backend server
2. Refresh the dashboard
3. Verify:
   - [ ] Toast notification appears: "Error loading dashboard"
   - [ ] Budget cards show "Error loading" text in red
   - [ ] Expenses and tasks show empty states

---

## 🐛 Known Issues / Edge Cases

### **Issue 1: WhatsApp Number Not Set**

If `user.whatsappNumber` is null/undefined:
- [ ] Shows "Not set" in WhatsApp card
- [ ] Dialog shows "your number" as placeholder

### **Issue 2: Very Long Expense Descriptions**

- [ ] Description truncates with ellipsis (`truncate` class)
- [ ] Hover doesn't show tooltip (feature to add later)

### **Issue 3: Date Formatting Edge Cases**

- [ ] Past dates show correctly
- [ ] Future dates show correctly
- [ ] Today's date shows correctly

### **Issue 4: Large Budget Numbers**

Test with budget of 100,000,000,000 UGX (100 billion):
- [ ] Formats correctly: "UGX 100,000,000,000"
- [ ] No overflow in cards
- [ ] Responsive on mobile

---

## 📊 Performance Testing

### **Metrics to Check**

1. **Initial Page Load**
   - Open DevTools → Performance tab
   - Record page load
   - Check:
     - [ ] First Contentful Paint < 1s
     - [ ] Time to Interactive < 2s
     - [ ] React Query cache hits after first load

2. **Re-renders**
   - Install React DevTools
   - Enable "Highlight updates"
   - Change tabs and come back to Overview
   - Check:
     - [ ] No unnecessary re-renders
     - [ ] Data fetches from cache (not network)

3. **Memory Leaks**
   - Open DevTools → Memory tab
   - Take heap snapshot
   - Navigate away and back
   - Take another heap snapshot
   - Compare:
     - [ ] No significant memory increase
     - [ ] Event listeners are cleaned up

---

## ✅ Final Checklist

### **Functionality**

- [ ] Dashboard loads without errors
- [ ] All 3 budget cards show correct data
- [ ] Progress bar reflects budget percentage
- [ ] Recent expenses display (or empty state)
- [ ] Active tasks display (or empty state)
- [ ] WhatsApp card shows user's number
- [ ] "View All" links navigate correctly
- [ ] "Add Expense Manually" button works

### **Visual Design**

- [ ] Glassmorphism cards look good
- [ ] Color-coded alerts are clear
- [ ] Icons are properly aligned
- [ ] Spacing is consistent
- [ ] Typography hierarchy is clear

### **Responsive**

- [ ] Works on mobile (375px)
- [ ] Works on tablet (768px)
- [ ] Works on desktop (1920px)
- [ ] No horizontal scroll
- [ ] Touch targets are adequate

### **Loading & Error States**

- [ ] Loading skeletons appear
- [ ] Error toast notifications work
- [ ] Empty states are helpful

### **Accessibility**

- [ ] All interactive elements are keyboard accessible
- [ ] Color contrast meets WCAG AA
- [ ] Screen reader can navigate (test with NVDA/VoiceOver)

---

## 🚀 Next: Testing WhatsApp Integration

Once the dashboard works, test the WhatsApp webhook:

1. **Install ngrok:**
   ```bash
   npm install -g ngrok
   ```

2. **Start ngrok:**
   ```bash
   ngrok http 5000
   ```

3. **Configure Twilio:**
   - Go to Twilio Console
   - Set webhook URL to: `https://YOUR_NGROK_URL.ngrok.io/webhook/webhook`

4. **Send Test Messages:**
   - "spent 50000 on cement"
   - "task: inspect foundation"
   - "how much did I spend?"

5. **Verify Dashboard Updates:**
   - Refresh dashboard
   - New expenses appear in Recent Expenses
   - Budget cards update
   - Task count updates

---

## 📝 Reporting Issues

If you find bugs, document them with:

1. **Steps to reproduce**
2. **Expected behavior**
3. **Actual behavior**
4. **Screenshots** (if UI issue)
5. **Browser & version**
6. **Console errors** (F12 → Console)

Example:

```markdown
**Bug:** Budget progress bar shows incorrect percentage

**Steps:**
1. Login as owner
2. Add expense of 5,000,000 UGX
3. Observe progress bar

**Expected:** 50% progress (5M / 10M)
**Actual:** 0% progress

**Console Error:** `NaN` in progress calculation
```

---

## 🎉 Success Criteria

The dashboard update is successful if:

✅ All budget metrics load and display correctly  
✅ Recent expenses show with proper formatting  
✅ Active tasks display with priorities  
✅ WhatsApp card shows user info  
✅ Loading states work  
✅ Error handling works  
✅ Responsive on all screen sizes  
✅ Color-coded alerts trigger correctly  
✅ No console errors  
✅ No linter warnings  

**If all checkboxes are ✅, the dashboard is production-ready!** 🚀

