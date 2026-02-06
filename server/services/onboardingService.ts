/**
 * WhatsApp Onboarding Service
 * 
 * Handles the button-driven onboarding flow for new WhatsApp users
 */

import { db } from '../db';
import { profiles, projects } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { sendWhatsAppMessage, sendInteractiveButtons } from '../twilio';

export type OnboardingState = 
  | null
  | 'welcome_sent'
  | 'awaiting_project_type'
  | 'awaiting_location'
  | 'awaiting_start_date'
  | 'awaiting_budget'
  | 'confirmation'
  | 'completed';

export interface OnboardingData {
  project_type?: string;
  location?: string;
  start_date?: string;
  budget?: number;
}

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://build-monitor-lac.vercel.app';

/**
 * Get user's current onboarding state
 */
export async function getOnboardingState(userId: string): Promise<{
  state: OnboardingState;
  data: OnboardingData;
}> {
  const user = await db.select({
    onboardingState: profiles.onboardingState,
    onboardingData: profiles.onboardingData,
  })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (!user || user.length === 0) {
    return { state: null, data: {} };
  }

  return {
    state: (user[0].onboardingState as OnboardingState) || null,
    data: (user[0].onboardingData as OnboardingData) || {},
  };
}

/**
 * Update user's onboarding state
 */
export async function updateOnboardingState(
  userId: string,
  state: OnboardingState,
  data?: Partial<OnboardingData>
): Promise<void> {
  const current = await getOnboardingState(userId);
  const updatedData = {
    ...current.data,
    ...data,
  };

  await db.update(profiles)
    .set({
      onboardingState: state,
      onboardingData: updatedData,
      onboardingCompletedAt: state === 'completed' ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, userId));
}

/**
 * Send welcome message with project type buttons
 */
export async function sendWelcomeMessage(whatsappNumber: string, userName?: string): Promise<void> {
  const greeting = userName ? `Hey ${userName}! 👋` : 'Hey! 👋';
  
  const message = `${greeting} Welcome to JengaTrack 🚀\n\nReady to create your first project?\n\nWhat kind of project is this?`;

  await sendInteractiveButtons(whatsappNumber, message, [
    { id: 'btn_residential', title: 'Residential home' },
    { id: 'btn_commercial', title: 'Commercial building' },
    { id: 'btn_other', title: 'Other / Skip for now' },
  ]);
}

/**
 * Handle project type selection
 */
export async function handleProjectTypeSelection(
  userId: string,
  whatsappNumber: string,
  projectType: string
): Promise<void> {
  await updateOnboardingState(userId, 'awaiting_location', { project_type: projectType });

  const typeLabel = projectType === 'btn_residential' ? 'Residential home' 
    : projectType === 'btn_commercial' ? 'Commercial building'
    : 'Other';

  await sendWhatsAppMessage(
    whatsappNumber,
    `Cool! Where's the site? (e.g., Kampala Road, Entebbe, or even plot number)\n\nJust type it – or tap Skip`
  );
}

/**
 * Handle location input
 */
export async function handleLocationInput(
  userId: string,
  whatsappNumber: string,
  location: string
): Promise<void> {
  if (location.toLowerCase().includes('skip')) {
    await updateOnboardingState(userId, 'awaiting_start_date', { location: undefined });
  } else {
    await updateOnboardingState(userId, 'awaiting_start_date', { location });
  }

  await sendWhatsAppMessage(
    whatsappNumber,
    `Nice! Rough start date?\n\n(Type like: Today, 15 Feb 2026, or skip for now)`
  );
}

/**
 * Handle start date input
 */
export async function handleStartDateInput(
  userId: string,
  whatsappNumber: string,
  startDate: string
): Promise<void> {
  if (startDate.toLowerCase().includes('skip')) {
    await updateOnboardingState(userId, 'awaiting_budget', { start_date: undefined });
  } else {
    await updateOnboardingState(userId, 'awaiting_budget', { start_date: startDate });
  }

  await sendWhatsAppMessage(
    whatsappNumber,
    `Almost done! Any rough total budget? (UGX – e.g., 150,000,000 or skip)\n\nThis helps us set up your budget tracker right away.`
  );
}

/**
 * Handle budget input
 */
export async function handleBudgetInput(
  userId: string,
  whatsappNumber: string,
  budgetText: string
): Promise<void> {
  let budget: number | undefined;
  
  if (!budgetText.toLowerCase().includes('skip')) {
    // Extract number from text
    const match = budgetText.match(/(\d+(?:,\d{3})*(?:\.\d{2})?)/);
    if (match) {
      budget = parseFloat(match[1].replace(/,/g, ''));
    }
  }

  await updateOnboardingState(userId, 'confirmation', { budget });

  const state = await getOnboardingState(userId);
  const { project_type, location, start_date, budget: finalBudget } = state.data;

  const typeLabel = project_type === 'btn_residential' ? 'Residential home'
    : project_type === 'btn_commercial' ? 'Commercial building'
    : project_type === 'btn_other' ? 'Other'
    : 'Not specified';

  const confirmationMessage = `Perfect! Here's what we have:\n\n` +
    `• Project: ${typeLabel} in ${location || 'TBD'}\n` +
    `• Started around: ${start_date || 'TBD'}\n` +
    `• Budget: ${finalBudget ? new Intl.NumberFormat('en-UG').format(finalBudget) + ' UGX' : 'TBD'}\n\n` +
    `Looks good?`;

  await sendInteractiveButtons(whatsappNumber, confirmationMessage, [
    { id: 'btn_confirm', title: 'Yes – Create project! 🎉' },
    { id: 'btn_edit', title: 'Edit something' },
    { id: 'btn_later', title: 'Add more details later' },
  ]);
}

/**
 * Create project from onboarding data
 */
export async function createProjectFromOnboarding(userId: string): Promise<string> {
  const state = await getOnboardingState(userId);
  const { project_type, location, start_date, budget } = state.data;

  const typeLabel = project_type === 'btn_residential' ? 'Residential home'
    : project_type === 'btn_commercial' ? 'Commercial building'
    : project_type === 'btn_other' ? 'Construction Project'
    : 'Construction Project';

  const projectName = location 
    ? `${typeLabel} - ${location}`
    : typeLabel;

  const [project] = await db.insert(projects)
    .values({
      userId: userId,
      name: projectName,
      description: `Project created via WhatsApp onboarding`,
      budgetAmount: budget ? budget.toString() : '0',
      status: 'active',
    })
    .returning();

  // Mark onboarding as completed
  await updateOnboardingState(userId, 'completed');

  return project.id;
}

/**
 * Send post-creation message
 */
export async function sendPostCreationMessage(
  whatsappNumber: string,
  projectId: string
): Promise<void> {
  const message = `Project created! 🎉 Your dashboard is ready on the web (link: ${DASHBOARD_URL}/dashboard?project=${projectId}).\n\n` +
    `Now the fun part: Just chat updates here anytime (e.g., 'Used 50 bags cement', 'Foundation 80% done', or send site photos). I'll organize everything automatically.\n\n` +
    `Quick tips:\n` +
    `• Text 'help' anytime\n` +
    `• Invite team: share this number\n\n` +
    `What would you like to do next?`;

  await sendInteractiveButtons(whatsappNumber, message, [
    { id: 'btn_first_update', title: 'Send first update now' },
    { id: 'btn_invite_team', title: 'Invite team' },
    { id: 'btn_dashboard', title: 'Go to dashboard' },
  ]);
}

/**
 * Check if user needs onboarding
 */
export async function needsOnboarding(userId: string): Promise<boolean> {
  // Check if user has any projects
  const userProjects = await db.select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .limit(1);

  // If no projects, check onboarding state
  if (userProjects.length === 0) {
    const state = await getOnboardingState(userId);
    return state.state !== 'completed';
  }

  return false;
}


