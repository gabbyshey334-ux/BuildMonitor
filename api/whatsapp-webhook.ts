/**
 * WhatsApp Webhook with Complete Onboarding Flow
 * 
 * Handles:
 * 1. New user onboarding with interactive buttons
 * 2. State management via Supabase profiles table
 * 3. Project creation after onboarding
 * 4. Natural language expense logging after onboarding
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://build-monitor-lac.vercel.app';

// Onboarding states
type OnboardingState = 
  | null
  | 'welcome_sent'
  | 'awaiting_project_type'
  | 'awaiting_location'
  | 'awaiting_start_date'
  | 'awaiting_budget'
  | 'confirmation'
  | 'completed';

interface OnboardingData {
  project_type?: string;
  location?: string;
  start_date?: string;
  budget?: number;
}

/**
 * Send WhatsApp message via Twilio
 */
async function sendMessage(to: string, message: string): Promise<void> {
  try {
    const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    await twilioClient.messages.create({
      from: TWILIO_WHATSAPP_NUMBER,
      to: toNumber,
      body: message,
    });
  } catch (error: any) {
    console.error('[Twilio Send Error]', error);
    throw error;
  }
}

/**
 * Send message with numbered options (for WhatsApp sandbox)
 */
async function sendOptions(to: string, message: string, options: string[]): Promise<void> {
  let optionsText = message + '\n\n';
  options.forEach((opt, idx) => {
    optionsText += `${idx + 1}. ${opt}\n`;
  });
  await sendMessage(to, optionsText);
}

/**
 * Get user profile by WhatsApp number
 */
async function getUserProfile(phoneNumber: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('whatsapp_number', phoneNumber)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    console.error('[Supabase Error]', error);
  }
  
  return data;
}

/**
 * Create user profile if doesn't exist
 */
async function createUserProfile(phoneNumber: string, email?: string) {
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      whatsapp_number: phoneNumber,
      email: email || `${phoneNumber}@whatsapp.local`,
      full_name: 'WhatsApp User',
      default_currency: 'UGX',
      preferred_language: 'en',
      onboarding_state: null,
      onboarding_data: {},
    })
    .select()
    .single();
  
  if (error) {
    console.error('[Create Profile Error]', error);
    throw error;
  }
  
  return data;
}

/**
 * Update onboarding state
 */
async function updateOnboardingState(
  userId: string,
  state: OnboardingState,
  data?: Partial<OnboardingData>
) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_data')
    .eq('id', userId)
    .single();
  
  const currentData = (profile?.onboarding_data as OnboardingData) || {};
  const updatedData = { ...currentData, ...data };
  
  const updatePayload: any = {
    onboarding_state: state,
    onboarding_data: updatedData,
    updated_at: new Date().toISOString(),
  };
  
  if (state === 'completed') {
    updatePayload.onboarding_completed_at = new Date().toISOString();
  }
  
  const { error } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('id', userId);
  
  if (error) {
    console.error('[Update State Error]', error);
    throw error;
  }
}

/**
 * Send welcome message with project type options
 */
async function sendWelcomeMessage(whatsappNumber: string, userName?: string) {
  const greeting = userName ? `Hey ${userName}! 👋` : 'Hey! 👋';
  const message = `${greeting} Welcome to JengaTrack 🚀\n\nReady to create your first project?\n\nWhat kind of project is this?`;
  
  await sendOptions(whatsappNumber, message, [
    'Residential home',
    'Commercial building',
    'Other / Skip for now'
  ]);
}

/**
 * Handle project type selection
 */
async function handleProjectTypeSelection(
  userId: string,
  whatsappNumber: string,
  selection: string
) {
  let projectType = 'btn_other';
  
  if (selection.includes('1') || selection.toLowerCase().includes('residential')) {
    projectType = 'btn_residential';
  } else if (selection.includes('2') || selection.toLowerCase().includes('commercial')) {
    projectType = 'btn_commercial';
  }
  
  await updateOnboardingState(userId, 'awaiting_location', { project_type: projectType });
  await sendMessage(whatsappNumber, `Cool! Where's the site? (e.g., Kampala Road, Entebbe, or even plot number)\n\nJust type it – or type "skip"`);
}

/**
 * Handle location input
 */
async function handleLocationInput(userId: string, whatsappNumber: string, location: string) {
  if (location.toLowerCase().includes('skip')) {
    await updateOnboardingState(userId, 'awaiting_start_date', { location: undefined });
  } else {
    await updateOnboardingState(userId, 'awaiting_start_date', { location });
  }
  
  await sendMessage(whatsappNumber, `Nice! Rough start date?\n\n(Type like: Today, 15 Feb 2026, or "skip" for now)`);
}

/**
 * Handle start date input
 */
async function handleStartDateInput(userId: string, whatsappNumber: string, startDate: string) {
  if (startDate.toLowerCase().includes('skip')) {
    await updateOnboardingState(userId, 'awaiting_budget', { start_date: undefined });
  } else {
    await updateOnboardingState(userId, 'awaiting_budget', { start_date: startDate });
  }
  
  await sendMessage(whatsappNumber, `Almost done! Any rough total budget? (UGX – e.g., 150,000,000 or "skip")\n\nThis helps us set up your budget tracker right away.`);
}

/**
 * Handle budget input and show confirmation
 */
async function handleBudgetInput(userId: string, whatsappNumber: string, budgetText: string) {
  let budget: number | undefined;
  
  if (!budgetText.toLowerCase().includes('skip')) {
    const match = budgetText.match(/(\d+(?:,\d{3})*(?:\.\d{2})?)/);
    if (match) {
      budget = parseFloat(match[1].replace(/,/g, ''));
    }
  }
  
  await updateOnboardingState(userId, 'confirmation', { budget });
  
  // Get current state to show confirmation
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_data')
    .eq('id', userId)
    .single();
  
  const onboardingData = (profile?.onboarding_data as OnboardingData) || {};
  const { project_type, location, start_date, budget: finalBudget } = onboardingData;
  
  const typeLabel = project_type === 'btn_residential' ? 'Residential home'
    : project_type === 'btn_commercial' ? 'Commercial building'
    : 'Other';
  
  const confirmationMessage = `Perfect! Here's what we have:\n\n` +
    `• Project: ${typeLabel} in ${location || 'TBD'}\n` +
    `• Started around: ${start_date || 'TBD'}\n` +
    `• Budget: ${finalBudget ? new Intl.NumberFormat('en-UG').format(finalBudget) + ' UGX' : 'TBD'}\n\n` +
    `Looks good?`;
  
  await sendOptions(whatsappNumber, confirmationMessage, [
    'Yes – Create project! 🎉',
    'Edit something',
    'Add more details later'
  ]);
}

/**
 * Create project from onboarding data
 */
async function createProjectFromOnboarding(userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_data')
    .eq('id', userId)
    .single();
  
  const onboardingData = (profile?.onboarding_data as OnboardingData) || {};
  const { project_type, location, start_date, budget } = onboardingData;
  
  const typeLabel = project_type === 'btn_residential' ? 'Residential home'
    : project_type === 'btn_commercial' ? 'Commercial building'
    : project_type === 'btn_other' ? 'Construction Project'
    : 'Construction Project';
  
  const projectName = location 
    ? `${typeLabel} - ${location}`
    : typeLabel;
  
  const description = start_date 
    ? `Project created via WhatsApp onboarding. Started: ${start_date}`
    : 'Project created via WhatsApp onboarding';
  
  // Prepare project data with correct column names (snake_case for database)
  const projectData: any = {
    user_id: userId,  // Database column name
    name: projectName,
    description: description,
    status: 'active',
  };
  
  // Add budget if provided (as string for decimal column)
  if (budget && budget > 0) {
    projectData.budget_amount = budget.toString();
  }
  
  // created_at and updated_at are auto-set by database defaults, but we can set them explicitly
  const now = new Date().toISOString();
  projectData.created_at = now;
  projectData.updated_at = now;
  
  console.log('[Create Project] Inserting project with data:', {
    ...projectData,
    budget_amount: projectData.budget_amount || '0',
  });
  
  const { data: project, error } = await supabase
    .from('projects')
    .insert(projectData)
    .select()
    .single();
  
  if (error) {
    console.error('[Create Project Error]', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      fullError: error,
    });
    throw error;
  }
  
  console.log('[Create Project] ✅ Project created successfully:', project.id);
  
  // Mark onboarding as completed
  await updateOnboardingState(userId, 'completed');
  
  return project.id;
}

/**
 * Send post-creation message
 */
async function sendPostCreationMessage(whatsappNumber: string, projectId: string) {
  const message = `Project created! 🎉 Your dashboard is ready on the web (link: ${DASHBOARD_URL}/dashboard?project=${projectId}).\n\n` +
    `Now the fun part: Just chat updates here anytime (e.g., 'Used 50 bags cement', 'Foundation 80% done', or send site photos). I'll organize everything automatically.\n\n` +
    `Quick tips:\n` +
    `• Text 'help' anytime\n` +
    `• Invite team: share this number\n\n` +
    `What would you like to do next?`;
  
  await sendOptions(whatsappNumber, message, [
    'Send first update now',
    'Invite team',
    'Go to dashboard'
  ]);
}

/**
 * Parse expense from natural language
 */
function parseExpense(message: string): { amount?: number; description?: string } | null {
  // Pattern: "spent 500 on cement", "used 50 bags", "500 cement"
  const patterns = [
    /(?:spent|used|paid)\s+(\d+(?:,\d{3})*(?:\.\d{2})?)\s+(?:on|for)?\s*(.+)/i,
    /(\d+(?:,\d{3})*(?:\.\d{2})?)\s+(.+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      const description = match[2].trim();
      if (amount > 0 && description) {
        return { amount, description };
      }
    }
  }
  
  return null;
}

/**
 * Main webhook handler
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Parse body
    let body: any = {};
    
    if (req.body && typeof req.body === 'object') {
      body = req.body;
    } else if (req.body && typeof req.body === 'string') {
      const params = new URLSearchParams(req.body);
      body = Object.fromEntries(params.entries());
    } else {
      body = req.query || {};
    }

    const { From = '', Body = '', MessageSid } = body;
    const phoneNumber = (From || '').replace('whatsapp:', '').trim();
    const message = (Body || '').trim().toLowerCase();
    
    console.log('✅ WhatsApp webhook called!', {
      phoneNumber,
      message,
      messageSid: MessageSid
    });
    
    // Get or create user profile
    let profile = await getUserProfile(phoneNumber);
    
    if (!profile) {
      // New user - create profile
      profile = await createUserProfile(phoneNumber);
      console.log('[Onboarding] New user created:', profile.id);
    }
    
    const userId = profile.id;
    const onboardingState = profile.onboarding_state as OnboardingState;
    const onboardingData = (profile.onboarding_data as OnboardingData) || {};
    
    // Check if user needs onboarding
    const needsOnboarding = !profile.onboarding_completed_at && onboardingState !== 'completed';
    
    // Handle onboarding flow
    if (needsOnboarding || message.includes('hey jenga') || message.includes('start')) {
      if (!onboardingState || onboardingState === null) {
        // Start onboarding
        await updateOnboardingState(userId, 'welcome_sent');
        await sendWelcomeMessage(From, profile.full_name);
      } else if (onboardingState === 'welcome_sent' || onboardingState === 'awaiting_project_type') {
        // Handle project type selection
        await handleProjectTypeSelection(userId, From, message);
      } else if (onboardingState === 'awaiting_location') {
        // Handle location input
        await handleLocationInput(userId, From, Body);
      } else if (onboardingState === 'awaiting_start_date') {
        // Handle start date input
        await handleStartDateInput(userId, From, Body);
      } else if (onboardingState === 'awaiting_budget') {
        // Handle budget input
        await handleBudgetInput(userId, From, Body);
      } else if (onboardingState === 'confirmation') {
        // Handle confirmation
        if (message.includes('1') || message.includes('yes') || message.includes('create')) {
          // Create project
          try {
            const projectId = await createProjectFromOnboarding(userId);
            await sendPostCreationMessage(From, projectId);
          } catch (error: any) {
            console.error('[Onboarding] Project creation failed:', error);
            const errorMessage = error.message || 'Unknown error';
            const errorDetails = error.details || error.hint || '';
            
            await sendMessage(From, 
              `⚠️ Oops! Couldn't create the project.\n\nError: ${errorMessage}\n${errorDetails ? `Details: ${errorDetails}\n` : ''}\n\nType "start over" to try again, or contact support.`
            );
            
            // Log detailed error for debugging
            console.error('[Onboarding] Full error details:', {
              userId,
              onboardingData,
              error: {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint,
                stack: error.stack,
              }
            });
          }
        } else if (message.includes('2') || message.includes('edit')) {
          // Restart onboarding
          await updateOnboardingState(userId, 'welcome_sent', {});
          await sendWelcomeMessage(From, profile.full_name);
        } else {
          // Skip for now - mark as completed without project
          await updateOnboardingState(userId, 'completed');
          await sendMessage(From, 'No worries! You can create a project later from the dashboard. For now, you can send me updates anytime!');
        }
      }
    } else {
      // User has completed onboarding - handle natural language
      const expense = parseExpense(Body);
      
      if (expense) {
        // Log expense
        const { data: projects } = await supabase
          .from('projects')
          .select('id')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (projects) {
          await supabase.from('expenses').insert({
            user_id: userId,
            project_id: projects.id,
            description: expense.description,
            amount: expense.amount!.toString(),
            currency: 'UGX',
            expense_date: new Date().toISOString().split('T')[0],
            source: 'whatsapp',
          });
          
          await sendMessage(From, `✅ Logged: ${expense.description} - ${new Intl.NumberFormat('en-UG').format(expense.amount!)} UGX`);
        } else {
          await sendMessage(From, 'You need to create a project first. Type "start" to begin onboarding.');
        }
      } else {
        // Unknown message
        await sendMessage(From, `Got it! To log an expense, just say something like:\n• "Spent 50000 on cement"\n• "Used 100000 for transport"\n\nOr type "help" for more options.`);
      }
    }
    
    // Return TwiML response
    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`);

  } catch (error: any) {
    console.error('❌ Webhook error:', error);
    console.error('❌ Error stack:', error.stack);
    
    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Sorry, there was an error. Please try again.</Message>
</Response>`);
  }
}
