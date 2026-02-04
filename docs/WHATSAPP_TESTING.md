# WhatsApp Integration Testing Guide

## Overview

This guide provides comprehensive test cases for verifying WhatsApp functionality in JengaTrack.

## Test Setup

1. **Prerequisites:**
   - Twilio WhatsApp Sandbox configured
   - User account registered with WhatsApp number
   - At least one project created in dashboard

2. **Access Debug Logs:**
   - GET `/api/webhook/debug?limit=50` - View recent WhatsApp interaction logs

## Test Cases

### 1. Expense Logging (English)

#### Test Case 1.1: Basic Expense
**Message:** `Spent 500000 on cement`

**Expected Response:**
```
✅ *Expense Logged*

📝 *cement*
💰 *UGX 500,000*
📊 Project: [Your Project Name]

📈 *Today's Total:* UGX [amount]
💵 *Remaining Budget:* UGX [amount]
📊 *Budget Used:* [percentage]%
```

**Verification:**
- ✅ Expense appears in dashboard
- ✅ Amount is correct (500,000 UGX)
- ✅ Description is "cement"
- ✅ Today's total is updated
- ✅ Remaining budget is calculated correctly

#### Test Case 1.2: Alternative Format
**Message:** `paid 200000 for bricks`

**Expected:** Similar format, amount 200,000 UGX, description "bricks"

#### Test Case 1.3: Bought Format
**Message:** `bought sand 150000`

**Expected:** Amount 150,000 UGX, description "sand"

### 2. Expense Logging (Luganda)

#### Test Case 2.1: Luganda Expense
**Message:** `Nimaze 300 ku sand`

**Expected Response:**
```
✅ *Expense Logged*

📝 *sand*
💰 *UGX 300*
📊 Project: [Your Project Name]

📈 *Today's Total:* UGX [amount]
💵 *Remaining Budget:* UGX [amount]
📊 *Budget Used:* [percentage]%
```

**Verification:**
- ✅ Parses Luganda correctly
- ✅ Amount and description extracted
- ✅ Response in English (standardized)

#### Test Case 2.2: Alternative Luganda
**Message:** `naguze cement 500`

**Expected:** Amount 500 UGX, description "cement"

### 3. Task Creation

#### Test Case 3.1: Basic Task
**Message:** `Add task: inspect foundation`

**Expected Response:**
```
✅ *Task Added*

📋 *inspect foundation*
📊 Project: [Your Project Name]
⚡ Priority: medium
📝 Status: Pending

📌 You have *[count]* pending tasks
```

**Verification:**
- ✅ Task appears in dashboard
- ✅ Status is "pending"
- ✅ Priority is "medium"
- ✅ Task count is updated

#### Test Case 3.2: Task with Priority
**Message:** `urgent: fix leak`

**Expected:** Priority should be "high"

#### Test Case 3.3: Todo Format
**Message:** `todo: buy materials`

**Expected:** Task created with title "buy materials"

### 4. Budget Setting

#### Test Case 4.1: Set Budget
**Message:** `Set budget 5000000`

**Expected Response:**
```
✅ *Budget Updated*

📊 Project: [Your Project Name]
💰 *New Budget:* UGX 5,000,000
💵 *Already Spent:* UGX [amount]
💸 *Remaining:* UGX [amount]
📊 *Used:* [percentage]%
```

**Verification:**
- ✅ Project budget updated in database
- ✅ Dashboard reflects new budget
- ✅ Remaining amount recalculated

#### Test Case 4.2: Alternative Format
**Message:** `budget is 10000000`

**Expected:** Budget set to 10,000,000 UGX

### 5. Expense Queries

#### Test Case 5.1: Basic Query
**Message:** `How much have I spent?`

**Expected Response:**
```
📊 *[Project Name] - Expense Report*

💰 *Budget:* UGX [amount]
💵 *Spent:* UGX [amount] ([percentage]%)
💸 *Remaining:* UGX [amount]
📝 *Total Expenses:* [count]

🔝 *Top Categories:*
1. [Category]: UGX [amount]
2. [Category]: UGX [amount]
3. [Category]: UGX [amount]
```

**Verification:**
- ✅ All amounts are accurate
- ✅ Percentage calculation is correct
- ✅ Top categories are listed
- ✅ Warning shown if over budget

#### Test Case 5.2: Alternative Queries
- `show expenses` - Same format
- `report` - Same format
- `ssente zmeka` (Luganda) - Same format

### 6. Image Upload

#### Test Case 6.1: Image with Caption
**Action:** Send image with caption "Construction progress"

**Expected Response:**
```
✅ *Image Received*

📸 Construction progress
📊 Project: [Your Project Name]

💡 *Tip:* Send an expense amount to link this image to an expense.
Example: "spent 50000 on cement"
```

**Verification:**
- ✅ Image stored in database
- ✅ Caption saved
- ✅ Image appears in dashboard gallery
- ✅ Can be linked to expense later

#### Test Case 6.2: Image with Expense
**Action:** Send image with caption "spent 50000 on cement"

**Expected:** 
- ✅ Expense logged (50000 UGX for cement)
- ✅ Image linked to expense
- ✅ Both appear in dashboard

### 7. Error Handling

#### Test Case 7.1: Unregistered User
**Message:** Send any message from unregistered WhatsApp number

**Expected Response:**
```
👋 Welcome to JengaTrack!

Please register at https://jengatrack.app to get started.

Once registered, you can track expenses, manage tasks, and monitor your construction projects via WhatsApp.
```

**Verification:**
- ✅ Message logged in database
- ✅ No crash or error
- ✅ User-friendly onboarding message

#### Test Case 7.2: No Project
**Setup:** User registered but no project created

**Message:** `Spent 500000 on cement`

**Expected Response:**
```
❌ No active project found.

Please create a project in the dashboard first:
https://jengatrack.app
```

**Verification:**
- ✅ Helpful error message
- ✅ Direct link to dashboard
- ✅ No database errors

#### Test Case 7.3: Invalid Message
**Message:** `asdfghjkl`

**Expected Response:**
```
🤖 *I didn't quite understand that.*

Here's what I can help with:

💰 *Log Expenses:*
"spent 500000 on cement"
"paid 200000 for bricks"
"nimaze 300 ku sand" (Luganda)

📋 *Create Tasks:*
"task: inspect foundation"
"todo: buy materials"

💵 *Set Budget:*
"set budget 5000000"

📊 *Check Expenses:*
"how much did I spend?"
"show expenses"
"ssente zmeka" (Luganda)

Need help? Visit https://jengatrack.app
```

**Verification:**
- ✅ Helpful instructions provided
- ✅ Examples in both languages
- ✅ Link to dashboard

### 8. Edge Cases

#### Test Case 8.1: Large Amounts
**Message:** `Spent 50000000 on materials`

**Expected:** Handles large numbers correctly (50,000,000 UGX)

#### Test Case 8.2: Decimal Amounts
**Message:** `Spent 50000.50 on cement`

**Expected:** Handles decimals correctly

#### Test Case 8.3: Multiple Expenses in One Day
**Action:** Send multiple expense messages in same day

**Expected:** 
- ✅ All expenses logged
- ✅ Today's total accumulates correctly
- ✅ Each gets unique response

#### Test Case 8.4: Rapid Messages
**Action:** Send 5 messages in quick succession

**Expected:**
- ✅ All processed correctly
- ✅ No race conditions
- ✅ Responses sent in order

## Debugging

### View Logs

1. **Console Logs:**
   - Check server console for detailed logs
   - Each interaction has request ID
   - Logs include intent, confidence, and metadata

2. **Database Logs:**
   - Check `whatsapp_messages` table
   - All inbound/outbound messages logged
   - Includes intent, processed status, errors

3. **Debug Endpoint:**
   ```bash
   GET /api/webhook/debug?limit=50
   ```
   Returns recent interaction logs with:
   - Timestamp
   - Phone number
   - Direction (inbound/outbound)
   - Intent
   - Confidence
   - Success/error status
   - Metadata

### Common Issues

1. **Message Not Received:**
   - Check Twilio webhook URL configuration
   - Verify Twilio signature validation
   - Check server logs for webhook errors

2. **Intent Not Detected:**
   - Check message format matches patterns
   - Verify confidence threshold
   - Check debug logs for parsed intent

3. **Database Errors:**
   - Verify user has project
   - Check database connection
   - Review error logs in database

4. **Response Not Sent:**
   - Check Twilio credentials
   - Verify phone number format
   - Check Twilio API logs

## Performance Testing

### Load Test
1. Send 100 messages in 1 minute
2. Verify all processed
3. Check response times < 2 seconds
4. Verify no message loss

### Stress Test
1. Send 1000 messages in 10 minutes
2. Monitor database performance
3. Check memory usage
4. Verify system stability

## Success Criteria

✅ All test cases pass
✅ Responses are professional and formatted correctly
✅ All messages logged in database
✅ Error handling works gracefully
✅ Performance is acceptable (< 2s response time)
✅ No data loss or corruption
✅ Works in both English and Luganda

## Next Steps

1. Run all manual test cases
2. Verify responses match expected format
3. Check database for correct data storage
4. Test error scenarios
5. Monitor performance under load
6. Document any issues found

