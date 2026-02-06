# WhatsApp Onboarding Flow - Implementation Summary

## Overview

This document summarizes the implementation of the WhatsApp onboarding flow and AI-powered natural language processing for JengaTrack.

## What Was Implemented

### Phase 1: New User Onboarding (Button-Driven) ✅

#### Database Schema Updates
- **Migration**: `migrations/add_onboarding_fields.sql`
  - Added `onboarding_state`, `onboarding_data`, and `onboarding_completed_at` fields to `profiles` table
  - Created index on `onboarding_state` for efficient queries

- **Schema**: `shared/schema.ts`
  - Updated `profiles` table definition to include onboarding fields

#### Onboarding Service
- **File**: `server/services/onboardingService.ts`
  - `getOnboardingState()` - Get current onboarding state and data
  - `updateOnboardingState()` - Update onboarding state and data
  - `sendWelcomeMessage()` - Send welcome message with project type buttons
  - `handleProjectTypeSelection()` - Handle project type selection
  - `handleLocationInput()` - Handle location input
  - `handleStartDateInput()` - Handle start date input
  - `handleBudgetInput()` - Handle budget input and show confirmation
  - `createProjectFromOnboarding()` - Create project from onboarding data
  - `sendPostCreationMessage()` - Send post-creation message with next steps
  - `needsOnboarding()` - Check if user needs onboarding

#### Onboarding Flow States
1. `null` - Not started
2. `awaiting_project_type` - Waiting for project type selection
3. `awaiting_location` - Waiting for location input
4. `awaiting_start_date` - Waiting for start date
5. `awaiting_budget` - Waiting for budget
6. `confirmation` - Showing confirmation, awaiting approval
7. `completed` - Onboarding completed

#### Integration with WhatsApp Webhook
- **File**: `server/routes/whatsapp.ts`
  - Added onboarding flow handler: `handleOnboardingFlow()`
  - Integrated onboarding check before intent parsing
  - Handles button responses and state transitions
  - Supports greeting triggers ("hey Jenga", "hi", "hello", etc.)

### Phase 2: AI-Powered Natural Language Processing ✅

#### AI Update Parser Service
- **File**: `server/services/aiUpdateParser.ts`
  - `parseUpdateWithAI()` - Parse user messages using OpenAI
  - `getProjectContext()` - Get project context for AI prompt
  - `generateClarificationMessage()` - Generate clarification questions

#### Features
- Extracts structured data from natural language:
  - Expenses (amount, category, date, description)
  - Progress updates (percentage, milestones)
  - Tasks (title, description)
  - Issues (problems, delays)
  - Photos (with captions)
- Confidence scoring (0-100)
- Automatic clarification when confidence < 70%
- Project context awareness

#### Integration
- Integrated into WhatsApp webhook handler
- Can be enabled with `USE_AI_PARSING=true` environment variable
- Falls back to rule-based parser if AI is not available

### Phase 3: Enhanced Twilio Service ✅

#### Interactive Buttons
- **File**: `server/twilio.ts`
  - `sendInteractiveButtons()` - Send messages with numbered button options
  - `parseButtonResponse()` - Parse user responses to buttons
  - Supports up to 3 buttons (WhatsApp Business API limit)
  - Works in Twilio sandbox mode (numbered options)
  - Ready for WhatsApp Business API upgrade

## User Journey

### New User Onboarding

1. **User sends greeting** ("hey Jenga", "hi", etc.)
   - Bot sends welcome message with project type buttons:
     - Residential home
     - Commercial building
     - Other / Skip for now

2. **User selects project type**
   - Bot asks for location (free text or skip)

3. **User provides location**
   - Bot asks for start date (free text or skip)

4. **User provides start date**
   - Bot asks for budget (free text or skip)

5. **User provides budget**
   - Bot shows confirmation with:
     - Project type
     - Location
     - Start date
     - Budget
   - Buttons: "Yes – Create project! 🎉", "Edit something", "Add more details later"

6. **User confirms**
   - Project is created
   - Bot sends post-creation message with:
     - Dashboard link
     - Instructions for sending updates
     - Next step buttons

### Ongoing Updates (Natural Chat)

1. **User sends natural language message**
   - "Used 50 bags cement"
   - "Foundation 80% done"
   - "Paid workers 2M today"

2. **AI parses message**
   - Extracts structured data
   - Checks confidence level

3. **If confidence ≥ 70%**
   - Automatically logs to database
   - Sends confirmation: "✅ Logged: 50 bags cement (Materials)"

4. **If confidence < 70%**
   - Sends clarification question with Yes/No buttons
   - Waits for confirmation before logging

5. **If off-topic**
   - Sends brief helpful reply
   - Redirects to project updates

## Configuration

### Environment Variables

```bash
# Required
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# Optional - AI Features
OPENAI_API_KEY=your_openai_api_key
USE_AI_PARSING=true  # Enable AI-powered parsing (default: false, uses rule-based)

# Optional - Dashboard URL
DASHBOARD_URL=https://jengatrack.app
```

## Database Migration

Run the migration to add onboarding fields:

```sql
-- Run in Supabase SQL Editor or your PostgreSQL client
\i migrations/add_onboarding_fields.sql
```

Or manually:

```sql
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS onboarding_state TEXT,
ADD COLUMN IF NOT EXISTS onboarding_data JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_state 
ON profiles(onboarding_state) 
WHERE onboarding_state IS NOT NULL;
```

## Testing

### Test Onboarding Flow

1. Send "hey Jenga" to your Twilio WhatsApp number
2. Follow the button prompts
3. Verify project is created in database
4. Check onboarding state is set to 'completed'

### Test AI Parsing

1. Enable AI parsing: `USE_AI_PARSING=true`
2. Send natural language updates:
   - "Used 50 bags cement"
   - "Foundation 80% done"
   - "Paid workers 2 million today"
3. Verify updates are logged correctly
4. Test clarification flow with ambiguous messages

## Next Steps

### Phase 4: Production Enhancements (Pending)

1. **WhatsApp Business API Integration**
   - Upgrade from Twilio sandbox to WhatsApp Business API
   - Implement proper interactive buttons (not numbered lists)
   - Message template approval process

2. **Dashboard Integration**
   - Add WhatsApp connection prompt on signup
   - QR code generation for WhatsApp linking
   - Show onboarding status in dashboard

3. **Advanced Features**
   - Photo handling and auto-attachment
   - Progress tracking visualizations
   - Team invitations via WhatsApp
   - Budget alerts and nudges
   - Multi-project support

## Files Modified/Created

### Created
- `server/services/aiUpdateParser.ts` - AI-powered update parser
- `WHATSAPP_ONBOARDING_IMPLEMENTATION.md` - This document

### Modified
- `migrations/add_onboarding_fields.sql` - Updated to use `profiles` table
- `shared/schema.ts` - Added onboarding fields to profiles table
- `server/services/onboardingService.ts` - Fixed to use `profiles` table
- `server/routes/whatsapp.ts` - Integrated onboarding and AI parsing
- `server/twilio.ts` - Enhanced interactive buttons support

## Known Limitations

1. **Twilio Sandbox**
   - Interactive buttons are sent as numbered lists
   - Limited to sandbox participants
   - For production, upgrade to WhatsApp Business API

2. **AI Parsing**
   - Requires OpenAI API key
   - Costs ~$0.01-0.03 per conversation turn
   - Falls back to rule-based parser if not configured

3. **Single Project**
   - Currently supports one project per user
   - Multi-project support planned for Phase 4

## Support

For issues or questions:
- Check logs: `server.log` or console output
- Verify environment variables are set
- Ensure database migration has been run
- Test with Twilio sandbox first before production


