/**
 * JengaTrack WhatsApp Webhook — Complete Implementation
 *
 * Required Supabase table:
 * CREATE TABLE IF NOT EXISTS tasks (
 *   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
 *   title text NOT NULL,
 *   status text DEFAULT 'pending',
 *   completed_at timestamptz,
 *   created_at timestamptz DEFAULT now()
 * );
 *
 * Features:
 * - Two operating modes: Group Chat (Mode A) & Direct Tracker (Mode B)
 * - GPT-4o intent classification
 * - Receipt OCR (OpenAI Vision)
 * - Voice note transcription (Whisper)
 * - Confirmation loop before saving
 * - Price anomaly detection
 * - Unusual worker count alerts
 * - Vendor extraction & tracking
 * - Low stock alerts
 * - Daily heartbeat to owner (called externally via /api/daily-heartbeat)
 * - Budget queries, materials, labor, progress, weather delay
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fetch from 'node-fetch';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

const gemini = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://build-monitor-lac.vercel.app';

// ─── Rate limiting (max 10 AI calls per phone per hour) ───────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// ─── Duplicate prevention (same message within 30 seconds) ─────────────────────
const recentMessagesMap = new Map<string, number>();
const DEDUP_WINDOW_MS = 30_000;

function checkDuplicateMessage(phoneNumber: string, message: string): boolean {
  const key = `${phoneNumber}:${message.trim().toLowerCase().substring(0, 100)}`;
  const now = Date.now();
  const last = recentMessagesMap.get(key) ?? 0;
  if (now - last < DEDUP_WINDOW_MS) return true;
  recentMessagesMap.set(key, now);
  if (recentMessagesMap.size > 1000) {
    const oldest = Math.min(...recentMessagesMap.values());
    for (const [k, v] of recentMessagesMap) {
      if (v < oldest + DEDUP_WINDOW_MS) recentMessagesMap.delete(k);
    }
  }
  return false;
}

function checkRateLimit(phoneNumber: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const maxCalls = 10;
  const key = phoneNumber;
  const record = rateLimitMap.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + windowMs;
  }
  record.count++;
  rateLimitMap.set(key, record);
  return record.count <= maxCalls;
}

// ─── Types ────────────────────────────────────────────────────────────────────

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

type ExpenseState = null | 'awaiting_price' | 'awaiting_confirmation' | 'awaiting_project_selection' | 'awaiting_photo_caption';

interface ExpensePendingData {
  quantity?: number;
  item?: string;
  unit?: string;
  amount?: number;
  unit_price?: number;
  description?: string;
  project_id?: string;
  vendor?: string;
  project_options?: { id: string; name: string; location?: string }[];
  /** Multi-item: [{ item, quantity, unit, amount }] */
  items?: Array<{ item: string; quantity: number; unit?: string; amount: number }>;
  /** Photo caption flow */
  photo_url?: string;
}

interface PendingMaterialUpdate {
  project_id: string;
  material_name: string;
  quantity: number;
  unit?: string;
}

const MATERIAL_KEYWORDS = [
  'cement', 'sand', 'gravel', 'bricks', 'iron bars', 'steel', 'timber', 'wood',
  'poles', 'tiles', 'paint', 'roofing', 'pipes', 'wire', 'aggregate', 'ballast',
  'blocks', 'stone',
];

// Labor/service — log as expense only, never add to materials_inventory
const SKIP_KEYWORDS = [
  'labor', 'labour', 'transport', 'service', 'rent', 'wage', 'salary', 'fee',
  'fuel', 'petrol', 'diesel', 'machine', 'machinery', 'equipment', 'hire',
];

const GARBAGE_MATERIAL_NAMES = ['material', 'item', 'thing', 'stuff', 'goods', 'product', 'units'];

function parseQuantityFromDescription(desc: string): { quantity: number; unit?: string } | null {
  const m = desc.match(/(\d+)\s*(bags?|tonnes?|pieces?|bars?|sheets?|litres?|rolls?)?/i);
  if (!m) return null;
  const quantity = parseInt(m[1], 10);
  const unit = m[2] || undefined;
  return { quantity: isNaN(quantity) ? 1 : quantity, unit };
}

interface ParsedExpense {
  amount?: number;
  description?: string;
  quantity?: number;
  item?: string;
  unit?: string;
  unit_price?: number;
  vendor?: string;
  needsPrice?: boolean;
}

type IntentType =
  | 'EXPENSE_LOG'
  | 'MATERIAL_LOG'
  | 'LABOR_LOG'
  | 'PROGRESS_UPDATE'
  | 'BUDGET_QUERY'
  | 'MATERIAL_QUERY'
  | 'WEATHER_DELAY'
  | 'SMART_QUERY'
  | 'SWITCH_PROJECT'
  | 'LIST_PROJECTS'
  | 'BUDGET_UPDATE'
  | 'ISSUE_REPORT'
  | 'PROJECT_QUERY'
  | 'GREETING';

interface IntentResult {
  intent: IntentType;
  extracted: Record<string, unknown>;
}

// ─── Messaging ────────────────────────────────────────────────────────────────

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

async function sendOptions(to: string, message: string, options: string[]): Promise<void> {
  let text = message + '\n\n';
  options.forEach((opt, idx) => { text += `${idx + 1}. ${opt}\n`; });
  await sendMessage(to, text);
}

const fmt = (n: number) => new Intl.NumberFormat('en-UG').format(Math.round(n));

/** Parse amount from text: handles 150K, 1.5M, 2B, million, billion, and plain numbers. */
function parseAmount(text: string): number {
  const clean = text.replace(/,/g, '').trim();
  const bMatch = clean.match(/(\d+(?:\.\d+)?)\s*[Bb](?:illion)?/i);
  const mMatch = clean.match(/(\d+(?:\.\d+)?)\s*[Mm](?:illion)?/i);
  const kMatch = clean.match(/(\d+(?:\.\d+)?)\s*[Kk](?:$|\b)/);
  const wordBillion = clean.match(/(\d+(?:\.\d+)?)\s*billion/i);
  const wordMillion = clean.match(/(\d+(?:\.\d+)?)\s*million/i);
  const numMatch = clean.match(/(\d+(?:\.\d+)?)/);
  if (bMatch || wordBillion) return parseFloat((bMatch || wordBillion)![1]) * 1_000_000_000;
  if (mMatch || wordMillion) return parseFloat((mMatch || wordMillion)![1]) * 1_000_000;
  if (kMatch) return parseFloat(kMatch[1]) * 1_000;
  if (numMatch) return parseFloat(numMatch[1]);
  return 0;
}

function detectLanguage(text: string): string {
  const t = text.toLowerCase();
  if (/mpa|nze|nno|sseminti|emisumaali|okulunda|nsimba|abasajja|bajja|nfunyeyo|mugezi|hali|jangu|genda|kola|nkola|leeta|sente|eggulo|enkya/i.test(t)) return 'Luganda';
  if (/habari|asante|karibu|ndio|hapana|bei|kazi|wafanyakazi/i.test(t)) return 'Swahili';
  return 'en';
}

async function ai(prompt: string, fallback: string, maxTokens = 200, lang?: string): Promise<string> {
  const langInstruction = lang && lang !== 'en'
    ? `The user wrote in ${lang}. You MUST respond in ${lang}, not English.`
    : 'Respond in English unless the user wrote in another language.';
  const systemContent = `You are JengaTrack, a WhatsApp construction assistant for African building projects. Be warm, practical, and concise. Plain text only. No markdown. Under 4 lines. ${langInstruction}`;

  if (gemini && process.env.GEMINI_API_KEY) {
    try {
      const model = gemini.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
      const result = await model.generateContent(
        `${systemContent}\n\n${prompt}`
      );
      const text = result.response.text().trim();
      if (text) return text;
    } catch (err: any) {
      console.error('[AI Helper] Gemini failed:', err?.message);
    }
  }
  if (process.env.OPENAI_API_KEY) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: maxTokens,
      });
      const text = completion.choices[0]?.message?.content?.trim();
      if (text) return text;
    } catch (err: any) {
      console.error('[AI Helper] OpenAI failed:', err?.message);
    }
  }
  return fallback;
}

// ─── User Profile ─────────────────────────────────────────────────────────────

async function getUserProfile(phoneNumber: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, active_project_id, active_project_set_at')
    .eq('whatsapp_number', phoneNumber)
    .single();
  if (error && error.code !== 'PGRST116') console.error('[Supabase Error]', error);
  return data;
}

async function createUserProfile(phoneNumber: string) {
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      whatsapp_number: phoneNumber,
      email: `${phoneNumber.replace('+', '')}@whatsapp.local`,
      full_name: 'WhatsApp User',
      default_currency: 'UGX',
      preferred_language: 'en',
      onboarding_state: null,
      onboarding_data: {},
    })
    .select()
    .single();
  if (error) { console.error('[Create Profile Error]', error); throw error; }
  return data;
}

async function updateOnboardingState(
  userId: string,
  state: OnboardingState,
  data?: Partial<OnboardingData>
) {
  const { data: profile } = await supabase
    .from('profiles').select('onboarding_data').eq('id', userId).single();
  const current = (profile?.onboarding_data as OnboardingData) || {};
  const updated = { ...current, ...data };
  const payload: any = {
    onboarding_state: state,
    onboarding_data: updated,
    updated_at: new Date().toISOString(),
  };
  if (state === 'completed') payload.onboarding_completed_at = new Date().toISOString();
  const { error } = await supabase.from('profiles').update(payload).eq('id', userId);
  if (error) { console.error('[Update State Error]', error); throw error; }
}

async function updateExpenseState(userId: string, state: ExpenseState, data?: ExpensePendingData) {
  const { error } = await supabase.from('profiles').update({
    expense_state: state,
    expense_pending_data: data || {},
    updated_at: new Date().toISOString(),
  }).eq('id', userId);
  if (error) { console.error('[Update Expense State Error]', error); throw error; }
}

async function clearPendingMaterialUpdate(userId: string) {
  const { error } = await supabase.from('profiles').update({
    pending_material_update: null,
    updated_at: new Date().toISOString(),
  }).eq('id', userId);
  if (error) console.error('[Clear Pending Material Error]', error);
}

async function setPendingMaterialUpdate(userId: string, data: PendingMaterialUpdate) {
  const { error } = await supabase.from('profiles').update({
    pending_material_update: data,
    updated_at: new Date().toISOString(),
  }).eq('id', userId);
  if (error) { console.error('[Set Pending Material Error]', error); throw error; }
}

// ─── Active Project (multi-project selection) ─────────────────────────────────

async function getActiveProject(
  userId: string,
  profile: any
): Promise<{
  project: any | null;
  needsSelection: boolean;
  projects: any[];
}> {
  const { data: ownedProjects } = await supabase
    .from('projects')
    .select('id, name, description, status, channel_type, manager_id, user_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  const { data: managedProjects } = await supabase
    .from('projects')
    .select('id, name, description, status, channel_type, manager_id, user_id')
    .eq('manager_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  const allProjects = [...(ownedProjects || []), ...(managedProjects || [])]
    .filter((p, i, self) => i === self.findIndex((t) => t.id === p.id));

  // Strict: only return projects owned or managed by userId; never query across projects.
  if (allProjects.length === 0) {
    return { project: null, needsSelection: false, projects: [] };
  }
  if (allProjects.length === 1) {
    if (profile.active_project_id !== allProjects[0].id) {
      await supabase.from('profiles').update({
        active_project_id: allProjects[0].id,
        active_project_set_at: new Date().toISOString(),
      }).eq('id', userId);
    }
    return { project: allProjects[0], needsSelection: false, projects: allProjects };
  }
  if (profile.active_project_id) {
    const activeProject = allProjects.find((p) => p.id === profile.active_project_id);
    if (activeProject) {
      return { project: activeProject, needsSelection: false, projects: allProjects };
    }
  }
  return { project: null, needsSelection: true, projects: allProjects };
}

async function sendProjectSelectionMenu(
  to: string,
  userId: string,
  projects: any[]
): Promise<void> {
  await supabase
    .from('profiles')
    .update({
      expense_state: 'awaiting_project_selection',
      expense_pending_data: {
        project_options: projects.map((p) => ({
          id: p.id,
          name: p.name,
          location: p.description || 'No location',
        })),
      },
    })
    .eq('id', userId);

  const projectList = projects
    .map((p, i) => `${i + 1}. ${p.name}` + (p.description ? ` — ${p.description}` : ''))
    .join('\n');

  const msg = await ai(
    `Ask the user which project they are working on today. List these projects:\n${projectList}\nTell them to reply with the number.`,
    `You have ${projects.length} active projects:\n\n${projectList}\n\nWhich one are you updating today? Reply with the number.`
  );
  await sendMessage(to, msg);
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

async function sendWelcomeMessage(to: string, name?: string) {
  const greeting = name && name !== 'WhatsApp User' ? name.split(' ')[0] : null;
  const msg = await ai(
    `Welcome a new user named ${greeting || 'a new user'} to JengaTrack. Tell them JengaTrack helps track construction expenses, materials, workers and progress via WhatsApp. Ask them what kind of project they are building. Give 3 short project type options numbered 1-3: residential home, commercial building, other.`,
    `Hey${greeting ? ' ' + greeting : ''}! Welcome to JengaTrack. I help you track your construction project via WhatsApp.\n\nWhat kind of build is this?\n\n1. Residential home\n2. Commercial building\n3. Other`
  );
  await sendMessage(to, msg);
}

async function handleProjectTypeSelection(userId: string, to: string, msg: string) {
  let projectType = 'btn_other';
  if (msg.includes('1') || /residential|home/i.test(msg)) projectType = 'btn_residential';
  else if (msg.includes('2') || /commercial|office|shop/i.test(msg)) projectType = 'btn_commercial';
  await updateOnboardingState(userId, 'awaiting_location', { project_type: projectType });
  const out = await ai(
    'Ask the user where their construction site is located. Keep it casual and short. Examples: Kampala Road, Plot 24 Mukono. Tell them they can skip.',
    'Great choice! Where is the site? (e.g. Kampala Road, Entebbe — or type "skip")'
  );
  await sendMessage(to, out);
}

async function handleLocationInput(userId: string, to: string, body: string) {
  const location = /skip/i.test(body) ? undefined : body.trim();
  await updateOnboardingState(userId, 'awaiting_start_date', { location });
  const out = await ai(
    'Ask the user when their construction project started. Keep it casual. Examples: Today, 15 Feb 2026. Tell them they can skip.',
    'When did the project start? (e.g. Today, 15 Feb 2026 — or "skip")'
  );
  await sendMessage(to, out);
}

async function handleStartDateInput(userId: string, to: string, body: string) {
  const start_date = /skip/i.test(body) ? undefined : body.trim();
  await updateOnboardingState(userId, 'awaiting_budget', { start_date });
  const out = await ai(
    'Ask the user what their total project budget is in UGX. Keep it casual. Examples: 150,000,000 or 150M. Tell them they can skip.',
    'What is the total project budget? (e.g. 150M UGX — or "skip")'
  );
  await sendMessage(to, out);
}

async function handleBudgetInput(userId: string, to: string, body: string) {
  let budget: number | undefined;
  if (!/skip/i.test(body)) {
    budget = parseAmount(body);
  }
  await updateOnboardingState(userId, 'confirmation', { budget });

  // Clear any expense state so "1" / "Yes" is only treated as project confirmation, not expense
  await supabase
    .from('profiles')
    .update({
      expense_state: null,
      expense_pending_data: {},
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  const { data: profile } = await supabase.from('profiles').select('onboarding_data').eq('id', userId).single();
  const d = (profile?.onboarding_data as OnboardingData) || {};
  const typeLabel = d.project_type === 'btn_residential' ? 'Residential home'
    : d.project_type === 'btn_commercial' ? 'Commercial building' : 'Construction Project';

  const summaryPrompt = `Present this project summary to the user and ask them to confirm:
  Type: ${typeLabel}
  Location: ${d.location || 'TBD'}
  Started: ${d.start_date || 'TBD'}
  Budget: ${budget ? fmt(budget) + ' UGX' : 'TBD'}
  Ask them to reply 1 to confirm and create the project, 2 to edit, or 3 to skip. Keep it friendly and concise.`;
  const summary = await ai(summaryPrompt,
    `Here's your project summary:\n\nType: ${typeLabel}\nLocation: ${d.location || 'TBD'}\nBudget: ${budget ? fmt(budget) + ' UGX' : 'TBD'}\n\n1. Create project\n2. Edit\n3. Skip`
  );
  await sendOptions(to, summary, ['1. Yes – Create project', '2. Edit', '3. Skip']);
}

async function createProjectFromOnboarding(userId: string): Promise<string> {
  console.log('[CreateProject] Starting...');
  console.log('[CreateProject] userId:', userId);

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, onboarding_data')
    .eq('id', userId)
    .single();

  if (!profile) {
    console.error('[CreateProject] Profile not found:', userId);
    throw new Error('User profile not found. Please try again.');
  }

  const onboardingData = (profile.onboarding_data as OnboardingData) || {};
  console.log('[CreateProject] onboardingData:', JSON.stringify(onboardingData));

  const typeLabel =
    onboardingData.project_type === 'btn_residential'
      ? 'Residential home'
      : onboardingData.project_type === 'btn_commercial'
        ? 'Commercial building'
        : 'Construction Project';
  const projectName =
    onboardingData.location
      ? `${typeLabel} - ${onboardingData.location}`
      : onboardingData.location || typeLabel;
  const budgetNum = parseFloat(String(onboardingData.budget || 0));
  const startDate =
    onboardingData.start_date ||
    new Date().toISOString().split('T')[0];

  const { data: newProject, error } = await supabase
    .from('projects')
    .insert({
      name: projectName,
      description: onboardingData.location
        ? `Started: ${startDate}. Created via WhatsApp.`
        : 'Created via WhatsApp.',
      budget: budgetNum,
      user_id: userId,
      status: 'active',
      currency: 'UGX',
      channel_type: 'direct',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[CreateProject] FAILED:', error);
    throw error;
  }

  if (!newProject || !newProject.id) {
    console.error('[CreateProject] No data returned from insert');
    throw new Error('Project was not saved. No data returned.');
  }

  console.log('[CreateProject] SUCCESS:', newProject.id, newProject.name);

  await supabase
    .from('profiles')
    .update({
      active_project_id: newProject.id,
      onboarding_completed_at: new Date().toISOString(),
      onboarding_state: 'completed',
      onboarding_data: {},
      expense_state: null,
      expense_pending_data: {},
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  return newProject.id;
}

async function sendPostCreationMessage(to: string, projectId: string) {
  const msg = await ai(
    `Tell the user their construction project has been created and their dashboard is live at this URL: ${DASHBOARD_URL}/dashboard?project=${projectId}. Then briefly explain they can now log expenses, materials, workers and progress just by chatting. Give 3-4 short examples naturally. End by saying they can send a receipt photo or voice note too.`,
    `Project created! Dashboard: ${DASHBOARD_URL}/dashboard?project=${projectId}\n\nJust chat updates to me anytime:\n• "Bought cement for 400,000"\n• "6 workers on site"\n• "Foundation 80% done"\n• Send receipt photos or voice notes`
  );
  await sendMessage(to, msg);
}

/** Route message to onboarding flow (e.g. when "1" was meant to confirm project, not expense). */
async function handleOnboardingMessage(from: string, profile: any, message: string): Promise<void> {
  const state = profile.onboarding_state as OnboardingState;
  if (state === 'confirmation' && (message.includes('1') || /yes|create|confirm/i.test(message))) {
    try {
      const projectId = await createProjectFromOnboarding(profile.id);
      await sendPostCreationMessage(from, projectId);
    } catch (err: any) {
      console.error('[Onboarding] Project creation failed (handleOnboardingMessage):', err);
      await sendMessage(from, await ai(
        `Tell the user the project could not be created. Error: ${err.message}. Tell them to type "start over" to try again.`,
        `Could not create the project. Error: ${err.message}. Type "start over" to try again.`
      ));
    }
    return;
  }
  await sendMessage(from, await ai(
    'Tell the user to confirm their project first by replying 1, or type "start over" to begin again.',
    'Please confirm your project first (reply 1), or type "start over" to begin again.'
  ));
}

// ─── OCR: Receipt Photo ───────────────────────────────────────────────────────

async function processReceiptPhoto(
  from: string,
  userId: string,
  projectId: string,
  mediaUrl: string
): Promise<void> {
  await sendMessage(from, await ai(
    'Tell the user you received their receipt and are scanning it. One short line.',
    'Receipt received! Scanning it now...'
  ));

  const receiptPrompt = `This is a construction receipt. Extract all details and return ONLY valid JSON:
{
  "vendor": "shop or supplier name",
  "date": "date on receipt or null",
  "items": [{"name": "item name", "quantity": number_or_null, "unit": "unit_or_null", "amount": number_in_UGX}],
  "total": total_amount_in_UGX,
  "notes": "any other relevant info"
}
If amounts are in another currency, convert to UGX (1 USD ≈ 3700 UGX, 1 KES ≈ 28 UGX).`;

  async function applyOcrResult(content: string): Promise<boolean> {
    try {
      let jsonStr = content.trim();
    const codeMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeMatch) jsonStr = codeMatch[1].trim();
    const ocrData = JSON.parse(jsonStr);
    const total = ocrData.total || 0;
    const vendor = ocrData.vendor || 'Unknown vendor';
    const itemsList = (ocrData.items || [])
      .map((i: any) => `  • ${i.name}${i.quantity ? ` x${i.quantity}` : ''}: ${fmt(i.amount || 0)} UGX`)
      .join('\n');

    // Update materials_inventory with line items
    if (ocrData.items && ocrData.items.length > 0) {
      for (const item of ocrData.items) {
        if (!item.name) continue;
        const materialName = String(item.name).toLowerCase().trim();
        const qty = parseFloat(String(item.quantity || 0));
        if (qty <= 0) continue;
        const itemUnitCost = parseFloat(String(item.amount || 0)) / (qty || 1);
        const itemTotalCost = parseFloat(String(item.amount || 0));
        const now = new Date().toISOString();

        const { data: existing } = await supabase
          .from('materials_inventory')
          .select('id, quantity, unit_cost, total_cost')
          .eq('project_id', projectId)
          .eq('name', materialName)
          .maybeSingle();

        const newQty = parseFloat(String(existing?.quantity || 0)) + qty;

        if (existing) {
          const newTotalCost = parseFloat(String(existing.total_cost || 0)) + itemTotalCost;
          await supabase.from('materials_inventory')
            .update({
              quantity: newQty,
              unit_cost: itemUnitCost || parseFloat(String(existing.unit_cost || 0)),
              total_cost: newTotalCost,
              last_purchased_at: now,
              updated_at: now,
            })
            .eq('id', existing.id);
          await supabase.from('material_transactions').insert({
            material_id: existing.id,
            project_id: projectId,
            user_id: userId,
            transaction_type: 'purchase',
            quantity: qty,
            unit_cost: itemUnitCost,
            total_cost: itemTotalCost,
            description: `Receipt: ${materialName} +${qty}`,
            source: 'whatsapp',
          });
        } else {
          const { data: inserted } = await supabase.from('materials_inventory').insert({
            project_id: projectId,
            user_id: userId,
            name: materialName,
            quantity: qty,
            unit: item.unit || 'units',
            unit_cost: itemUnitCost,
            total_cost: itemTotalCost,
            source: 'whatsapp',
            last_purchased_at: now,
            updated_at: now,
          })
            .select('id')
            .single();
          if (inserted?.id) {
            await supabase.from('material_transactions').insert({
              material_id: inserted.id,
              project_id: projectId,
              user_id: userId,
              transaction_type: 'purchase',
              quantity: qty,
              unit_cost: itemUnitCost,
              total_cost: itemTotalCost,
              description: `Receipt: ${materialName}`,
              source: 'whatsapp',
            });
          }
        }
        console.log('[OCR Materials] Inventory updated:', materialName, '+', qty);
      }
    }

    const summary = await ai(
      `Summarise this receipt scan result naturally and ask the user to confirm saving it:
    Vendor: ${vendor}
    Date: ${ocrData.date || 'Not visible'}
    Items: ${itemsList || '(unable to read items)'}
    Total: ${fmt(total)} UGX
    End with: reply 1 to save, 2 to edit, 3 to cancel.`,
      `Receipt scanned!\n\nVendor: ${vendor}\nDate: ${ocrData.date || 'Not visible'}\nTotal: ${fmt(total)} UGX\n\nSave it?\n1. Yes\n2. Edit\n3. Cancel`
    );
    await updateExpenseState(userId, 'awaiting_confirmation', {
      amount: total,
      description: `Receipt: ${vendor}${ocrData.items?.length ? ` (${ocrData.items.map((i: any) => i.name).join(', ')})` : ''}`,
      vendor,
      project_id: projectId,
    });
    await sendOptions(from, summary, ['✅ Yes – Save it', '✏️ Edit details', '❌ Cancel']);
      return true;
    } catch {
      return false;
    }
  }

  try {
    const response = await fetch(mediaUrl, {
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
        ).toString('base64')}`,
      },
    });
    const buffer = await response.buffer();
    const base64Image = buffer.toString('base64');
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // Try Gemini vision first
    if (gemini && process.env.GEMINI_API_KEY) {
      try {
        const model = gemini.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
        const imagePart = {
          inlineData: {
            data: base64Image,
            mimeType: contentType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
          },
        };
        const result = await model.generateContent([receiptPrompt, imagePart]);
        const content = result.response.text().trim();
        if (content && (await applyOcrResult(content))) {
          console.log('[OCR] Gemini success');
          return;
        }
      } catch (err: any) {
        console.error('[OCR] Gemini failed:', err?.message);
      }
    }

    // OpenAI Vision fallback
    if (process.env.OPENAI_API_KEY) {
      try {
        const ocrResult = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: { url: `data:${contentType};base64,${base64Image}` },
                },
                { type: 'text', text: receiptPrompt },
              ],
            },
          ],
          max_tokens: 500,
        });
        const content = ocrResult.choices[0]?.message?.content?.trim() || '';
        if (content && (await applyOcrResult(content))) {
          console.log('[OCR] OpenAI success');
          return;
        }
      } catch (err: any) {
        console.error('[OCR] OpenAI failed:', err?.message);
      }
    }

    await sendMessage(from, await ai(
      'Tell the user you could not read the receipt clearly. Suggest better lighting, laying it flat, or typing the details manually with an example.',
      'Could not read that receipt clearly. Try better lighting or type: "Bought [item] for [amount] from [vendor]"'
    ));
  } catch (err: any) {
    console.error('[OCR Error]', err);
    await sendMessage(from, await ai(
      'Tell the user you could not read the receipt clearly. Suggest better lighting, laying it flat, or typing the details manually with an example.',
      'Could not read that receipt clearly. Try better lighting or type: "Bought [item] for [amount] from [vendor]"'
    ));
  }
}

// ─── Voice Notes (Whisper) ────────────────────────────────────────────────────

async function processVoiceNote(mediaUrl: string): Promise<string | null> {
  try {
    const response = await fetch(mediaUrl, {
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
        ).toString('base64')}`,
      },
    });
    const buffer = await response.buffer();

    // Try Gemini transcription first
    if (gemini && process.env.GEMINI_API_KEY) {
      try {
        const model = gemini.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
        const audioPart = {
          inlineData: {
            data: buffer.toString('base64'),
            mimeType: 'audio/ogg',
          },
        };
        const result = await model.generateContent([
          'Transcribe this voice note exactly. Return only the transcribed text, nothing else.',
          audioPart,
        ]);
        const text = result.response.text()?.trim();
        if (text) {
          console.log('[Voice] Gemini success');
          return text;
        }
      } catch (err: any) {
        console.error('[Voice] Gemini failed:', err?.message);
      }
    }

    // OpenAI Whisper fallback
    if (process.env.OPENAI_API_KEY) {
      try {
    const blob = new Blob([new Uint8Array(buffer)], { type: 'audio/ogg' });
    const file = new File([blob], 'voice.ogg', { type: 'audio/ogg' });
    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file,
      language: 'en',
    });
        if (transcription.text) {
          console.log('[Voice] OpenAI Whisper success');
          return transcription.text;
        }
      } catch (err: any) {
        console.error('[Voice] OpenAI Whisper failed:', err?.message);
      }
    }

    return null;
  } catch (err: any) {
    console.error('[Voice Error]', err);
    return null;
  }
}

// ─── Intent Classification (GPT-4o) ──────────────────────────────────────────

async function translateToEnglish(text: string): Promise<string> {
  const hasLugandaIndicators = /mpa|nze|nno|sseminti|emisumaali|okulunda|nsimba|abasajja|bajja|nfunyeyo|mugezi|hali|jangu|genda|kola|nkola|leeta|sente|eggulo|enkya/i.test(text);
  if (!hasLugandaIndicators) return text;
  console.log('[Translate] Detected Luganda, translating...');
  try {
    if (gemini && process.env.GEMINI_API_KEY) {
      const model = gemini.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
      const result = await model.generateContent(
        `Translate this Luganda construction site message to English. Return ONLY the English translation, nothing else: "${text}"`
      );
      const translated = result.response.text().trim();
      console.log('[Translate] Result:', translated);
      return translated || text;
    }
  } catch (err: any) {
    console.error('[Translate] Failed:', err?.message);
  }
  return text;
}

function preClassifyIntent(message: string): IntentResult | null {
  const m = message.toLowerCase().trim();

  // BUDGET_UPDATE — must be at top so "add 10M to budget" is caught before other budget patterns
  if (/edit.*budget|update.*budget|add.*budget|increase.*budget|change.*budget|set.*budget|new.*budget/i.test(m)) {
    const amount = parseAmount(message);
    const isAdd = /add|increase|plus|more/i.test(m);
    return { intent: 'BUDGET_UPDATE', extracted: { amount, action: isAdd ? 'add' : 'set' } };
  }

  // Force EXPENSE_LOG when user explicitly says log/add/record expense
  if (/log\s+this\s+expense|add\s+expense|record\s+expense|log\s+expense/i.test(m)) {
    return { intent: 'EXPENSE_LOG', extracted: { description: message.trim() } };
  }

  // MATERIAL_QUERY — inventory/stock questions; exclude worker-related and require material context
  if (
    /how much|how many|do (i|we) have|in.*inventory|current stock|stock.*left|remaining.*material/i.test(m) &&
    !/budget|spent|expense|cost/i.test(m) &&
    !/worker|staff|people|men|mason|labourer|laborer|came|on site|show up/i.test(m) &&
    (MATERIAL_KEYWORDS.some(k => m.includes(k)) || /inventory|stock|material|supply|supplies/i.test(m))
  ) {
    return { intent: 'MATERIAL_QUERY', extracted: {} };
  }

  // SWITCH_PROJECT — must be before greeting check so it's always caught
  if (/switch|change project|other project|different project|wanna switch|want to switch/i.test(m)) {
    return { intent: 'SWITCH_PROJECT', extracted: {} };
  }

  if (/list.*project|my project|show.*project|all.*project|project.*list|what project/i.test(m)) {
    return { intent: 'LIST_PROJECTS', extracted: {} };
  }
  if (/which project|what project.*(?:am i|working on|tracking)|current project|active project/i.test(m) && !/list|show all/i.test(m)) {
    return { intent: 'PROJECT_QUERY', extracted: {} };
  }
  if (/update.*dashboard|log.*expense|add.*expense|record|log something|what can|what do/i.test(m)) {
    return { intent: 'GREETING', extracted: {} };
  }

  // EXPENSE patterns — use parseAmount so 150K → 150000
  if (/bought|paid|spent|purchased|cost|price|buying|pay|expense/i.test(m) && /\d/.test(m)) {
    const amountMatches = message.match(/(\d+(?:\.\d+)?\s*[KkMmBb]?|\d{1,3}(?:,\d{3})*(?:\.\d+)?)/g);
    const amounts = amountMatches ? amountMatches.map((a) => parseAmount(a)) : [];
    const amount = amounts.length > 0 ? Math.max(...amounts) : 0;

    const itemMatch = message.match(/(?:bought|paid|spent|purchased)\s+(?:\d+\s+\w+\s+)?(?:of\s+)?([a-z\s]+?)(?:\s+for|\s+at|\s+from|\s*$)/i);
    const item = itemMatch ? itemMatch[1].trim() : '';

    const qtyMatch = message.match(/(\d+)\s*(bags?|kg|tons?|pieces?|trips?|units?|rolls?|sheets?)/i);
    const quantity = qtyMatch ? parseFloat(qtyMatch[1]) : 0;
    const unit = qtyMatch ? qtyMatch[2].toLowerCase() : '';

    const vendorMatch = message.match(/from\s+([A-Za-z\s]+?)(?:\s+for|\s*$)/i);
    const vendor = vendorMatch ? vendorMatch[1].trim() : '';

    return {
      intent: 'EXPENSE_LOG',
      extracted: { item, amount, quantity, unit, vendor },
    };
  }

  // MATERIAL used patterns — also match "today we used 4 bricks" / "used 4 bricks"
  if (/used|consumed|applied|finished\s+using/i.test(m) && /\d/.test(m)) {
    const qtyMatch = message.match(/(\d+)\s*(bags?|kg|tons?|pieces?|trips?|units?|bricks?|rods?|bars?)/i);
    const itemMatch = message.match(/(?:used|consumed)\s+\d+\s+\w+\s+(?:of\s+)?([a-z\s]+?)(?:\s+for|\s+on|\s*$)/i);
    const usedEndMatch = message.match(/(?:used|consumed|update)\s+.*?(\d+)\s+(bags?|kg|bricks?|pieces?|units?|rods?|bars?|sheets?)\s*[,.]?\s*$/i);
    const qty = qtyMatch ? parseFloat(qtyMatch[1]) : (usedEndMatch ? parseFloat(usedEndMatch[1]) : 0);
    const unit = (qtyMatch ? qtyMatch[2] : usedEndMatch ? usedEndMatch[2] : '').toLowerCase();
    let item = itemMatch ? itemMatch[1].trim() : '';
    if (!item && usedEndMatch) item = usedEndMatch[2].toLowerCase(); // e.g. "4 bricks" -> bricks
    return {
      intent: 'MATERIAL_LOG',
      extracted: {
        action: 'used',
        quantity: qty,
        unit,
        item: item || (usedEndMatch ? usedEndMatch[2].toLowerCase() : ''),
      },
    };
  }

  // MATERIAL received patterns
  if (/received|delivered|got|arrived|brought/i.test(m) && /\d/.test(m)) {
    return {
      intent: 'MATERIAL_LOG',
      extracted: { action: 'bought' },
    };
  }

  // LABOR patterns (workers, men, guys, casuals, etc.)
  if (/(\d+)\s*(workers?|casuals?|labou?rers?|men|guys?|people|staff|on\s+site)/i.test(m) || /(we\s+have\s+)?(about\s+)?(\d+)\s*(guys?|workers?|men)/i.test(m)) {
    const match = message.match(/(\d+)\s*(workers?|casuals?|labou?rers?|men|guys?|people|staff|on\s+site)/i)
      || message.match(/(?:we\s+have\s+)?(?:about\s+)?(\d+)\s*(?:guys?|workers?|men)/i);
    return {
      intent: 'LABOR_LOG',
      extracted: { worker_count: match ? parseInt(match[1], 10) : 0 },
    };
  }

  // BUDGET query patterns
  if (/how much|budget|spent|remaining|left|balance|total cost/i.test(m) && /spent|budget|left|remaining|balance/i.test(m)) {
    return { intent: 'BUDGET_QUERY', extracted: {} };
  }

  // ISSUE_REPORT patterns (problem, crack, damage, leak, etc.)
  if (/there is|there's|we have|we've got|foundation crack|wall crack|crack|leak|damage|broken|problem|issue|defect|structural|safety concern/i.test(m) && /crack|leak|damage|broken|problem|issue|defect|structural/i.test(m)) {
    const severity = /emergency|critical|urgent|serious|dangerous|immediate/i.test(m) ? 'critical' : /major|severe|significant/i.test(m) ? 'high' : 'medium';
    return { intent: 'ISSUE_REPORT', extracted: { description: message, severity } };
  }

  // WEATHER/DELAY patterns
  if (/rain|flood|weather|delay|couldn't work|no work|storm/i.test(m)) {
    return {
      intent: 'WEATHER_DELAY',
      extracted: { reason: message },
    };
  }

  // PROGRESS patterns
  if (/finished|completed|done|\d+%|percent|progress|milestone/i.test(m)) {
    return {
      intent: 'PROGRESS_UPDATE',
      extracted: { note: message },
    };
  }

  return null;
}

/** Parse multi-item expense message (e.g. "10 bags cement at 30k each, 10kg nails at 4k per kg"). Returns items array or null. */
function parseMultiItemMessage(message: string): Array<{ item: string; quantity: number; unit: string; amount: number }> | null {
  const hasMultipleItems = (message.match(/,/g) || []).length >= 2 ||
    /\band\b.*\band\b/i.test(message) ||
    /\d+\s*\w+\s+at\s+\d+.*,.*\d+\s*\w+\s+at\s+\d+/i.test(message);
  if (!hasMultipleItems) return null;

  const items: Array<{ item: string; quantity: number; unit: string; amount: number }> = [];
  const parts = message.split(/,(?!\s*\d{3})/);
  for (const part of parts) {
    const p = part.trim();
    const m1 = p.match(/(\d+(?:\.\d+)?)\s*(bags?|kg|kgs?|tonnes?|pieces?|pcs?|rods?|bars?|sheets?|poles?|litres?|rolls?|units?)?\s+(?:of\s+)?([a-z][a-z\s]+?)\s+(?:at\s+|[-–]\s*)?(\d[\d,.]*[KkMmBb]?)\s*(?:each|per\s+\w+)?/i);
    if (m1) {
      const qty = parseFloat(m1[1]);
      const unit = (m1[2] || 'units').toLowerCase();
      const item = m1[3].trim();
      const unitPrice = parseAmount(m1[4]);
      if (qty > 0 && unitPrice > 0 && item.length > 1) {
        items.push({ item, quantity: qty, unit, amount: qty * unitPrice });
        continue;
      }
    }
    const m2 = p.match(/(\d+(?:\.\d+)?)\s*(bags?|kg|kgs?|pieces?|pcs?|poles?|units?)?\s+(?:of\s+)?([a-z][a-z\s]+?)\s*[-–:]\s*(\d[\d,.]*[KkMmBb]?)/i);
    if (m2) {
      const qty = parseFloat(m2[1]);
      const unit = (m2[2] || 'units').toLowerCase();
      const item = m2[3].trim();
      const total = parseAmount(m2[4]);
      if (qty > 0 && total > 0 && item.length > 1) {
        items.push({ item, quantity: qty, unit, amount: total });
      }
    }
  }
  return items.length >= 2 ? items : null;
}

async function classifyIntent(message: string, phoneNumber: string): Promise<IntentResult> {
  const translatedMessage = await translateToEnglish(message);
  const preClassified = preClassifyIntent(translatedMessage);
  if (preClassified) {
    console.log('[Intent] Regex match:', preClassified.intent);
    return preClassified;
  }

  if (!checkRateLimit(phoneNumber)) {
    console.log('[Rate Limit] Hit for:', phoneNumber);
    return { intent: 'GREETING', extracted: {} };
  }

  const systemPrompt = `You are a construction site assistant for African building projects.

IMPORTANT: Be aggressive about classifying expense and material messages. When in doubt between EXPENSE_LOG and GREETING, choose EXPENSE_LOG if there are numbers involved.
Amounts: 150K means 150,000 UGX, 1.5M means 1,500,000 UGX, 2B means 2,000,000,000 UGX. Always use these conversions in extracted.amount.

Common patterns you MUST classify correctly:

EXPENSE_LOG examples (always has numbers):
- "10 masons worked today and I paid each 20k" → EXPENSE_LOG, amount: 200000, description: "Labour - 10 masons", quantity: 10
- "I just bought 10 bags cement at 30k each, 10kg nails at 4k per kg, 2 timber poles 30k" → EXPENSE_LOG with items array: [{item:"cement",quantity:10,unit:"bags",amount:300000},{item:"nails",quantity:10,unit:"kg",amount:40000},{item:"timber poles",quantity:2,unit:"pieces",amount:30000}]
- "log this expense: Bought cement for 400,000" → EXPENSE_LOG
- "add this expense: Paid labour 150K" → EXPENSE_LOG
- Any message with quantities AND prices → EXPENSE_LOG, never GREETING or SMART_QUERY
- "Bought 50 bags cement for 1,900,000"
- "Bought cement 1900000"
- "Paid plumber 150k"
- "Spent 500k on iron rods"
- "200000 for sand"
- "cement 38000 per bag"
- "purchased tiles 450,000"
- MULTI-ITEM: "I bought 10 bags cement at 30k each and 5 wood poles at 10k each" → return items: [{item:"cement",quantity:10,unit:"bags",amount:300000},{item:"wood poles",quantity:5,unit:"pieces",amount:50000}]
CRITICAL: For multi-item messages with commas listing different things each with a price, ALWAYS return intent EXPENSE_LOG with items array. Parse each item separately. 30k = 30000, 4k = 4000, 150k = 150000.

MATERIAL_LOG examples:
- "Received 50 bags cement from Hima"
- "Used 5 bags for foundation"
- "2 trips of sand delivered"
- "consumed 10 bags cement today"

LABOR_LOG examples:
- "6 workers today"
- "8 casuals on site"
- "5 men working"

PROGRESS_UPDATE examples:
- "Foundation 80% done"
- "Finished ring beam today"
- "Roofing complete"

BUDGET_QUERY examples (simple totals only):
- "How much spent?"
- "What's left in budget?"
- "Show me expenses"

SMART_QUERY — use for free-form analytical questions about historical data:
- "How much did I spend on cement last month?"
- "What was my biggest expense in January?"
- "Compare spending this month vs last month"
- "Which vendor have I paid the most?"
- "How many workers on site last week?"
- "Break down my spending by category"
Use BUDGET_QUERY only for simple "how much spent / what's left" questions. Use SMART_QUERY when the user asks about specific items, time ranges, comparisons, or vendors.

WEATHER_DELAY examples:
- "Heavy rain today"
- "No work, flooding"

ISSUE_REPORT — use when user reports a problem, defect, or safety concern:
- "log this alert issue - The rain ruined 10 bags cement" → ISSUE_REPORT, description: "The rain ruined 10 bags cement" (strip the command prefix)
- "There is a foundation crack"
- "We have a leak in the roof"
- "Structural damage on the wall"
- "Safety concern: loose scaffolding"
Return severity: "critical" for emergency/urgent, "high" for major/severe, "medium" otherwise. In extracted.description strip any leading "log this alert issue - " type prefix.

PROJECT_QUERY — use when user asks which project they are on:
- "Which project am I working on?"
- "What project am I tracking?"

GREETING - ONLY use this for:
- Pure greetings with NO numbers or construction context ("hello", "hi", "good morning")
- Completely unclear messages

NEVER classify a message with numbers AND construction materials as GREETING.

Return ONLY valid JSON:
{
  "intent": "INTENT_NAME",
  "extracted": {
    "item": "material name",
    "amount": number_in_UGX,
    "quantity": number,
    "unit": "bags/kg/etc",
    "action": "bought|used|received",
    "vendor": "vendor name if mentioned",
    "worker_count": number,
    "note": "for progress updates",
    "reason": "for weather delays"
  }
}`;

  const validIntents: IntentType[] = [
    'EXPENSE_LOG', 'MATERIAL_LOG', 'LABOR_LOG', 'PROGRESS_UPDATE',
    'BUDGET_QUERY', 'MATERIAL_QUERY', 'BUDGET_UPDATE', 'WEATHER_DELAY', 'SMART_QUERY', 'LIST_PROJECTS',
    'ISSUE_REPORT', 'PROJECT_QUERY', 'GREETING',
  ];

  function parseIntentResponse(content: string): IntentResult | null {
    try {
      const jsonStr = content.replace(/```(?:json)?\s*([\s\S]*?)```/, '$1').trim();
      const parsed = JSON.parse(jsonStr) as IntentResult;
      return validIntents.includes(parsed.intent) ? parsed : null;
    } catch {
      return null;
    }
  }

    // Try Gemini first
    if (gemini && process.env.GEMINI_API_KEY) {
      try {
        console.log('[Intent] Trying Gemini...');
        const model = gemini.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
        const prompt = `${systemPrompt}\n\nMessage to classify: "${translatedMessage}"\n\nReturn ONLY the JSON object, no other text.`;
        const result = await model.generateContent(prompt);
        const content = result.response.text().trim();
        const parsed = parseIntentResponse(content);
        if (parsed) {
          console.log('[Intent] Gemini success:', parsed.intent);
          return parsed;
        }
      } catch (err: any) {
        console.error('[Intent] Gemini failed:', err?.message);
      }
    }

  // Try OpenAI as fallback
  if (process.env.OPENAI_API_KEY) {
    try {
      console.log('[Intent] Trying OpenAI...');
    const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: translatedMessage },
      ],
      temperature: 0.1,
      max_tokens: 300,
    });
    const content = completion.choices[0]?.message?.content?.trim() || '';
      const parsed = parseIntentResponse(content);
      if (parsed) {
        console.log('[Intent] OpenAI success:', parsed.intent);
        return parsed;
      }
    } catch (err: any) {
      console.error('[Intent] OpenAI failed:', err?.message);
    }
  }

  console.log('[Intent] All AI failed, defaulting to GREETING');
  return { intent: 'GREETING', extracted: {} };
}

// ─── Price Anomaly Detection ──────────────────────────────────────────────────

async function checkPriceAnomaly(
  projectId: string,
  item: string,
  amount: number,
  quantity: number
): Promise<string | null> {
  if (!quantity || quantity <= 0) return null;
  const unitPrice = amount / quantity;

  // Get historical prices for this item on this project
  const { data: history } = await supabase
    .from('expenses')
    .select('amount, quantity_logged')
    .eq('project_id', projectId)
    .ilike('description', `%${item}%`)
    .not('quantity_logged', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!history || history.length < 2) return null; // Not enough history

  const historicalUnitPrices = history
    .filter((e: any) => e.quantity_logged && parseFloat(e.quantity_logged) > 0)
    .map((e: any) => parseFloat(e.amount) / parseFloat(e.quantity_logged));

  if (historicalUnitPrices.length < 2) return null;

  const avg = historicalUnitPrices.reduce((a, b) => a + b, 0) / historicalUnitPrices.length;
  const pctDiff = ((unitPrice - avg) / avg) * 100;

  if (pctDiff > 15) {
    return `⚠️ *Price Alert:* ${item} at ${fmt(unitPrice)} UGX/unit is *${Math.round(pctDiff)}% above* your recent average of ${fmt(avg)} UGX/unit.\n\nMarket increase or possible overcharge? Reply "ok" to log anyway or "cancel" to discard.`;
  }
  if (pctDiff < -20) {
    return `✅ *Good deal:* ${item} at ${fmt(unitPrice)} UGX/unit is *${Math.round(Math.abs(pctDiff))}% below* your recent average of ${fmt(avg)} UGX/unit.`;
  }
  return null;
}

// ─── Vendor Tracking ──────────────────────────────────────────────────────────

async function upsertVendor(projectId: string, vendorName: string, amount: number): Promise<void> {
  if (!vendorName || vendorName.toLowerCase() === 'unknown vendor') return;
  const name = vendorName.trim().toLowerCase();

  const { data: existing } = await supabase
    .from('vendors')
    .select('id, total_transactions, total_spent')
    .eq('project_id', projectId)
    .eq('name', name)
    .maybeSingle();

  if (existing) {
    await supabase.from('vendors').update({
      total_transactions: (existing.total_transactions || 0) + 1,
      total_spent: (parseFloat(existing.total_spent) || 0) + amount,
    }).eq('id', existing.id);
  } else {
    await supabase.from('vendors').insert({
      project_id: projectId,
      name,
      total_transactions: 1,
      total_spent: amount,
    });
  }
}

// ─── Daily Logs ───────────────────────────────────────────────────────────────

async function upsertDailyLog(
  projectId: string,
  data: { worker_count?: number; notes?: string; weather_condition?: string; photo_urls?: string[]; activity_entries?: Array<{ log_time: string; activity_type: string; description: string; amount?: number }> }
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const { data: existing } = await supabase
    .from('daily_logs')
    .select('id, notes, photo_urls, activity_entries')
    .eq('project_id', projectId)
    .eq('log_date', today)
    .maybeSingle();

  if (existing) {
    const updateData: any = { ...data };
    // Append notes instead of overwriting
    if (data.notes && existing.notes) {
      updateData.notes = `${existing.notes}\n${data.notes}`;
    }
    // Append photos
    if (data.photo_urls && existing.photo_urls) {
      updateData.photo_urls = [...(existing.photo_urls || []), ...data.photo_urls];
    }
    // Append activity_entries
    if (data.activity_entries && data.activity_entries.length > 0) {
      const existingEntries = Array.isArray(existing.activity_entries) ? existing.activity_entries : [];
      updateData.activity_entries = [...existingEntries, ...data.activity_entries];
    }
    await supabase.from('daily_logs').update(updateData).eq('id', existing.id);
  } else {
    const insertData: any = { project_id: projectId, log_date: today, ...data };
    if (data.activity_entries && data.activity_entries.length > 0) {
      insertData.activity_entries = data.activity_entries;
    }
    await supabase.from('daily_logs').insert(insertData);
  }
}

// ─── Intent Handlers ──────────────────────────────────────────────────────────

async function handleBudgetQuery(from: string, projectId: string, lang?: string): Promise<void> {
  const { data: project } = await supabase
    .from('projects').select('budget, name').eq('id', projectId).single();
  const { data: expenses } = await supabase
    .from('expenses').select('amount').eq('project_id', projectId);

  const totalSpent = (expenses || []).reduce((s, e) => s + parseFloat(String(e.amount || 0)), 0);
  const budget = parseFloat(String(project?.budget || 0));
  const pct = budget > 0 ? Math.round((totalSpent / budget) * 100) : 0;
  const remaining = budget > 0 ? Math.max(0, budget - totalSpent) : 0;

  // Estimate weeks remaining based on weekly burn rate
  const { data: recentExpenses } = await supabase
    .from('expenses').select('amount, created_at')
    .eq('project_id', projectId)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
  const weeklyBurn = recentExpenses && recentExpenses.length > 0
    ? (recentExpenses.reduce((s, e) => s + parseFloat(String(e.amount || 0)), 0) / 4.3)
    : 0;
  const weeksLeft = weeklyBurn > 0 ? Math.round(remaining / weeklyBurn) : null;

  const msg = await ai(
    `Give the user a natural budget summary for their project:
    Total spent: ${fmt(totalSpent)} UGX
    Budget: ${fmt(budget)} UGX
    Used: ${pct}%
    Remaining: ${fmt(remaining)} UGX
    ${weeksLeft !== null ? 'At current rate: ~' + weeksLeft + ' weeks of budget left' : ''}
    ${pct > 80 ? 'IMPORTANT: Warn them they have used over 80% of budget!' : ''}
    Be conversational, not just a list of numbers.`,
    `Budget summary: Spent: ${fmt(totalSpent)} UGX | Budget: ${fmt(budget)} UGX | Used: ${pct}% | Remaining: ${fmt(remaining)} UGX`,
    300,
    lang
  );
  await sendMessage(from, msg);
}

async function handleGreeting(
  from: string,
  profile: any,
  currentProject?: any,
  allProjects?: any[],
  rawMessage?: string,
  lang?: string
): Promise<void> {
  const firstName =
    profile?.full_name && profile.full_name !== 'WhatsApp User'
      ? profile.full_name.split(' ')[0]
      : null;

  let recentActivity = '';
  if (currentProject) {
    const { data: recentExpenses } = await supabase
      .from('expenses')
      .select('description, amount, created_at')
      .eq('project_id', currentProject.id)
      .order('created_at', { ascending: false })
      .limit(3);

    const { data: todayLog } = await supabase
      .from('daily_logs')
      .select('worker_count, notes')
      .eq('project_id', currentProject.id)
      .eq('log_date', new Date().toISOString().split('T')[0])
      .maybeSingle();

    if (recentExpenses?.length) {
      recentActivity += `Recent expenses: ${recentExpenses.map((e: any) =>
        `${e.description} (UGX ${Number(e.amount).toLocaleString()})`
      ).join(', ')}. `;
    }
    if (todayLog?.worker_count) recentActivity += `Today: ${todayLog.worker_count} workers. `;
    if (todayLog?.notes) recentActivity += `Notes: ${todayLog.notes}.`;
  }

  const langInstruction = lang && lang !== 'en'
    ? `The user wrote in ${lang}. You MUST respond in ${lang}, not English.`
    : 'Respond in English unless the user wrote in another language.';
  const systemPrompt = `You are JengaTrack, a smart WhatsApp assistant for construction site management in Uganda/Africa. ${langInstruction}

User: ${firstName || 'Site manager'}
Active project: ${currentProject?.name || 'None set'}
Budget: UGX ${Number(currentProject?.budget || 0).toLocaleString()}
${recentActivity ? 'Recent activity: ' + recentActivity : ''}

Your personality:
- Warm, practical, concise — like a knowledgeable site supervisor
- You understand English, Luganda, and Swahili construction terms
- Never show numbered menus unless user explicitly asks for options
- Never say "I am an AI"
- Keep replies under 5 lines
- Plain text only, no markdown asterisks or bold

What you can do:
- Log expenses, materials received/used, daily workers, progress
- Answer budget questions and data queries
- Update project budget
- Analyse spending patterns and vendor history
- Understand voice notes and receipt photos

If the user asks what you can do, explain your capabilities naturally in 3-4 lines: Log expenses, materials, workers, and progress via chat; answer questions about their project budget and spending; scan receipts and transcribe voice notes; understand English, Luganda, and Swahili.

If the user asks a general construction question (how to mix concrete, best practices etc), answer it helpfully and briefly from your construction expertise. You are a knowledgeable site supervisor, not just a data entry bot.

If user wants to log something, confirm naturally and tell them you're saving it. If they ask a question, answer it directly.`;

  let reply: string | null = null;

  if (gemini && process.env.GEMINI_API_KEY) {
    try {
      const model = gemini.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
      const result = await model.generateContent(`${systemPrompt}\n\nUser: ${rawMessage || 'Hello'}`);
      reply = result.response.text().trim();
    } catch (err: any) {
      console.error('[Greeting] Gemini failed:', err?.message);
    }
  }

  if (!reply && process.env.OPENAI_API_KEY) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: rawMessage || 'Hello' },
        ],
        temperature: 0.7,
        max_tokens: 300,
      });
      reply = completion.choices[0]?.message?.content?.trim() || null;
    } catch (err: any) {
      console.error('[Greeting] OpenAI failed:', err?.message);
    }
  }

  if (!reply) {
    reply = firstName
      ? `Hey ${firstName}! What would you like to update on ${currentProject?.name || 'your project'} today?`
      : `Hey! What would you like to update today?`;
  }

  await sendMessage(from, reply);
}

async function handleBudgetUpdate(from: string, projectId: string, extracted: Record<string, unknown>): Promise<void> {
  const { data: project } = await supabase
    .from('projects').select('budget, name').eq('id', projectId).single();

  const currentBudget = parseFloat(String(project?.budget || 0));
  const amount = typeof extracted.amount === 'number' ? extracted.amount : 0;
  const action = extracted.action as string;

  if (!amount || amount <= 0) {
    await sendMessage(from, await ai(
      'Ask the user what the new budget should be. Give examples: "Set budget to 200M" or "Add 10M to budget".',
      'What should the new budget be? Try: "Set budget to 200M" or "Add 10M to budget"'
    ));
    return;
  }

  const newBudget = action === 'add' ? currentBudget + amount : amount;

  await supabase.from('projects')
    .update({ budget: newBudget, updated_at: new Date().toISOString() })
    .eq('id', projectId);

  console.log('[BudgetUpdate] Old:', currentBudget, '→ New:', newBudget);

  const msg = await ai(
    `Tell the user their budget was updated. Previous: ${fmt(currentBudget)} UGX. ${action === 'add' ? 'Added' : 'New budget'}: ${fmt(amount)} UGX. New total: ${fmt(newBudget)} UGX. Tell them to refresh their dashboard.`,
    `Budget updated! Previous: ${fmt(currentBudget)} UGX. New total: ${fmt(newBudget)} UGX. Refresh your dashboard to see the update.`
  );
  await sendMessage(from, msg);
}

async function handleExpenseLog(
  from: string,
  userId: string,
  projectId: string,
  extracted: Record<string, unknown>,
  rawMessage: string,
  lang?: string
): Promise<void> {
  // Multi-item expense: "10 bags cement at 30k each and 5 wood poles at 10k each"
  const rawItems = extracted.items as Array<{ item?: string; quantity?: number; unit?: string; amount?: number }> | undefined;
  if (Array.isArray(rawItems) && rawItems.length > 1) {
    const items = rawItems
      .map((x) => ({
        item: String(x.item || '').trim(),
        quantity: typeof x.quantity === 'number' ? x.quantity : parseFloat(String(x.quantity || 0)) || 1,
        unit: String(x.unit || 'units').trim(),
        amount: typeof x.amount === 'number' ? x.amount : parseFloat(String(x.amount || 0)) || 0,
      }))
      .filter((x) => x.item && x.amount > 0);
    if (items.length > 1) {
      const total = items.reduce((s, x) => s + x.amount, 0);
      const lines = items.map((x) => `• ${x.quantity} ${x.unit} of ${x.item} — UGX ${fmt(x.amount)}`).join('\n');
      await updateExpenseState(userId, 'awaiting_confirmation', {
        project_id: projectId,
        items,
        amount: total,
        description: items.map((x) => `${x.quantity} ${x.unit} of ${x.item}`).join(' and '),
      });
      await sendMessage(from, `✅ Confirm expense:\n${lines}\n\nTotal: UGX ${fmt(total)}\n\n1. Yes — Log it\n2. Edit\n3. Cancel`);
      return;
    }
  }

  let amount = typeof extracted.amount === 'number' ? extracted.amount : 0;
  let item = String(extracted.item || '').trim();
  let quantity = typeof extracted.quantity === 'number' ? extracted.quantity : 0;
  let unit = String(extracted.unit || '').trim();
  let vendor = String(extracted.vendor || '').trim();

  if (!amount || amount <= 0) amount = parseAmount(rawMessage);

  // Regex fallback for quantity
  if (!quantity) {
    const qm = rawMessage.match(/(\d+(?:,\d{3})*)\s*(bags?|kg|tons?|pieces?|trips?|units?)/i);
    if (qm) { quantity = parseFloat(qm[1].replace(/,/g, '')); unit = unit || qm[2].toLowerCase(); }
  }

  // If quantity + item but no price → ask for price
  if ((!amount || amount <= 0) && quantity > 0 && item) {
    await updateExpenseState(userId, 'awaiting_price', { quantity, item, unit: unit || 'units', project_id: projectId, vendor });
    const msg = await ai(
      `Tell the user you got it: ${quantity} ${unit || 'units'} of ${item}${vendor ? ' from ' + vendor : ''}. Ask them what the total cost was. Give an example: 1,900,000 UGX.`,
      `Got it! ${quantity} ${unit || 'units'} of ${item}${vendor ? ' from ' + vendor : ''}. What was the total cost? (e.g. 1,900,000 UGX)`,
      200,
      lang
    );
    await sendMessage(from, msg);
    return;
  }

  if (!amount || amount <= 0) {
    await sendMessage(from, await ai(
      'Tell the user you need the amount. Give examples: Bought cement for 200,000 UGX, Paid plumber 150k, Spent 500,000 on steel rods.',
      'I need the amount. Try: "Bought cement for 200,000 UGX" or "Paid plumber 150k"',
      200,
      lang
    ));
    return;
  }

  const description = item ? `${quantity > 0 ? `${quantity} ${unit || 'units'} of ` : ''}${item}` : `Expense: ${fmt(amount)} UGX`;

  // Check for price anomaly before confirming
  const anomalyAlert = quantity > 0 && item
    ? await checkPriceAnomaly(projectId, item, amount, quantity)
    : null;

  await updateExpenseState(userId, 'awaiting_confirmation', {
    amount, description, project_id: projectId, quantity, unit, item, vendor,
    unit_price: quantity > 0 ? Math.round(amount / quantity) : undefined,
  });

  const msg = await ai(
    `Confirm this expense with the user and ask if it looks correct:
    Item: ${description}
    Total: ${fmt(amount)} UGX
    ${vendor ? 'From: ' + vendor : ''}
    ${quantity > 0 ? 'Per ' + (unit || 'unit') + ': ' + fmt(amount / quantity) + ' UGX' : ''}
    ${anomalyAlert ? 'Note: ' + anomalyAlert : ''}
    End with: reply 1 to save, 2 to edit, 3 to cancel.`,
    `${description} — ${fmt(amount)} UGX${vendor ? ' from ' + vendor : ''}. Save it?\n\n1. Yes\n2. Edit\n3. Cancel`,
    200,
    lang
  );
  const confirmMsg = anomalyAlert ? `${anomalyAlert}\n\n${msg}` : msg;
  await sendMessage(from, confirmMsg);
}

async function handleMaterialLog(
  from: string,
  userId: string,
  projectId: string,
  extracted: Record<string, unknown>,
  rawMessage: string,
  lang?: string
): Promise<void> {
  let item = String(extracted.item || '').trim();
  let qty = typeof extracted.quantity === 'number' ? extracted.quantity : parseFloat(String(extracted.quantity || '0')) || 0;
  let unit = String(extracted.unit || 'units').trim();
  const action = String(extracted.action || 'bought').toLowerCase();
  const vendor = String(extracted.vendor || '').trim();
  const amount = typeof extracted.amount === 'number' ? extracted.amount : parseFloat(String(extracted.amount || '0')) || 0;
  const unitCost = amount && qty > 0 ? amount / qty : 0;
  const totalCost = amount || (qty * unitCost);

  const qm = rawMessage.match(/(\d+(?:,\d+)*)\s*(bags?|kg|tons?|pieces?|trips?|units?)\s+(?:of\s+)?([a-z\s]+)/i);
  if (qm) {
    if (!qty) qty = parseFloat(qm[1].replace(/,/g, ''));
    if (!item) item = qm[3].trim();
    if (!unit || unit === 'units') unit = qm[2].toLowerCase();
  }
  const effectiveAction = /used|consumed|for\s+foundation|for\s+/i.test(rawMessage) ? 'used' : action;

  // BUG 8: Alternative extraction for "today we used 4 bricks" / "used 4 bricks, update the inventory"
  if ((!item || item === 'material') && effectiveAction === 'used') {
    const altMatch = rawMessage.match(/(\d+)\s+(bags?|kg|tonnes?|pieces?|bricks?|rods?|bars?|sheets?|poles?|litres?|rolls?|units?)\s+(?:of\s+)?([a-z\s]+?)(?:\s+(?:from|for|to|update|inventory)|[,.]|$)/i);
    if (altMatch) {
      if (!qty || qty <= 0) qty = parseFloat(altMatch[1]);
      if (!unit || unit === 'units') unit = altMatch[2].toLowerCase();
      if (!item) item = altMatch[3].trim();
    }
    const simpleMatch = rawMessage.match(/(?:used?|consumed?|update|deduct)\s+.*?(\d+)\s+(bricks?|cement|sand|gravel|timber|wood|steel|iron|tiles|paint|pipes?|wire|blocks?|poles?|nails?|aggregate|ballast)/i);
    if (simpleMatch && (!item || item === 'material')) {
      if (!qty || qty <= 0) qty = parseFloat(simpleMatch[1]);
      if (!item) item = simpleMatch[2].toLowerCase();
      if (!unit || unit === 'units') unit = /bricks?|blocks?|pieces?|poles?|sheets?|rolls?|pipes?|rods?/.test(simpleMatch[2]) ? 'pieces' : /cement|sand|gravel|aggregate|ballast/.test(simpleMatch[2]) ? 'bags' : 'units';
    }
  }

  // Fallback quantity extraction for natural language (e.g. "I have just used 5 bricks")
  if (!qty || qty <= 0) {
    const naturalMatch = rawMessage.match(
      /(\d+)\s*(bricks?|bags?|kg|tons?|pieces?|rods?|bars?|sheets?|units?|rolls?)/i
    );
    if (naturalMatch) {
      qty = parseFloat(naturalMatch[1]);
      if (!unit || unit === 'units') unit = naturalMatch[2].toLowerCase();
    }
  }

  if (!item || item === 'material') {
    const itemMatch = rawMessage.match(
      /(\d+)\s+(?:bags?\s+of\s+|pieces?\s+of\s+|units?\s+of\s+)?([a-z\s]+?)(?:\s*$|\s+for|\s+from)/i
    );
    if (itemMatch) item = itemMatch[2].trim();
  }
  if (!item) item = 'material';
  if (!unit || unit === 'units') unit = 'units';

  // BUG 8: Single material name with no quantity — prompt for full phrase
  const singleWord = rawMessage.trim().toLowerCase().replace(/[.?!,]/g, '');
  const isSingleMaterialName = singleWord.length < 30 && !/\d/.test(singleWord) &&
    (MATERIAL_KEYWORDS.some(k => singleWord === k || singleWord.includes(k)) || ['bricks', 'cement', 'sand', 'gravel', 'timber', 'wood', 'steel', 'iron', 'tiles', 'paint', 'pipes', 'wire', 'blocks', 'poles', 'nails', 'aggregate', 'ballast'].some(k => singleWord === k));
  if (isSingleMaterialName && (!qty || qty <= 0) && !extracted.quantity) {
    const materialLabel = item && item !== 'material' ? item : singleWord;
    await sendMessage(from, `How many ${materialLabel} were used? e.g. "4 bricks" or "today we used 4 bricks"`);
    return;
  }

  if (!qty || qty <= 0) qty = 1;

  // Garbage data prevention
  const nameNormCheck = item.toLowerCase().trim();
  if (nameNormCheck.length < 2) {
    await sendMessage(from, 'Please provide a valid material name (at least 2 characters).');
    return;
  }
  if (GARBAGE_MATERIAL_NAMES.includes(nameNormCheck)) {
    await sendMessage(from, 'Please specify the actual material name (e.g. cement, bricks, sand).');
    return;
  }

  // Get all existing materials for fuzzy matching
  const { data: allMaterials } = await supabase
    .from('materials_inventory')
    .select('id, name, quantity, unit, low_stock_threshold')
    .eq('project_id', projectId);

  let materialName = item.toLowerCase().trim() || 'material';

  if (allMaterials && allMaterials.length > 0 && materialName !== 'material') {
    const fuzzyMatch = allMaterials.find((m: any) =>
      m.name === materialName ||
      m.name.includes(materialName) ||
      materialName.includes(m.name) ||
      materialName.split(' ').some((word: string) =>
        word.length > 3 && m.name.includes(word)
      )
    );
    if (fuzzyMatch) {
      console.log('[MaterialLog] Fuzzy matched:', materialName, '→', fuzzyMatch.name);
      materialName = fuzzyMatch.name;
    }
  }

  const now = new Date().toISOString();

  if (effectiveAction === 'used') {
    const { data: existing } = await supabase
      .from('materials_inventory')
      .select('id, quantity, unit, low_stock_threshold')
      .eq('project_id', projectId)
      .ilike('name', materialName)
      .maybeSingle();

    if (!existing) {
      await sendMessage(from, `No material matching "${materialName}" in inventory. Add it first by logging a purchase.`);
      return;
    }

    const usedQty = Math.abs(qty);
    const currentQty = parseFloat(String(existing.quantity || 0));
    const newQty = Math.max(0, currentQty - usedQty);
    const lowThreshold = existing.low_stock_threshold != null ? parseFloat(String(existing.low_stock_threshold)) : 5;

    await supabase
      .from('materials_inventory')
      .update({
        quantity: newQty,
        last_used_at: now,
        updated_at: now,
      })
      .eq('id', existing.id);

    await supabase.from('material_transactions').insert({
      material_id: existing.id,
      project_id: projectId,
      user_id: userId,
      transaction_type: 'usage',
      quantity: -usedQty,
      unit_cost: 0,
      total_cost: 0,
      description: `Used ${usedQty} ${unit} of ${materialName}`,
      source: 'whatsapp',
    });

    let reply = `✅ Updated! Used ${usedQty} ${unit} of ${materialName}. Remaining stock: ${newQty} ${unit}.`;
    if (newQty <= lowThreshold) {
      reply += ` ⚠️ Low stock (threshold: ${lowThreshold}). Consider restocking.`;
    }
    await sendMessage(from, reply);
    return;
  }

  // Purchase: UPSERT on (project_id, name)
  const { data: existing } = await supabase
    .from('materials_inventory')
    .select('id, quantity, unit_cost, total_cost')
    .eq('project_id', projectId)
    .eq('name', materialName)
    .maybeSingle();

  let materialId: string;
  if (existing) {
    const newQty = parseFloat(String(existing.quantity || 0)) + qty;
    const newTotalCost = parseFloat(String(existing.total_cost || 0)) + totalCost;
    await supabase
      .from('materials_inventory')
      .update({
        quantity: newQty,
        unit_cost: unitCost || parseFloat(String(existing.unit_cost || 0)),
        total_cost: newTotalCost,
        last_purchased_at: now,
        updated_at: now,
      })
      .eq('id', existing.id);
    materialId = existing.id;
  } else {
    const { data: inserted } = await supabase
      .from('materials_inventory')
      .insert({
        project_id: projectId,
        user_id: userId,
        name: materialName,
        quantity: qty,
        unit: unit || 'units',
        unit_cost: unitCost,
        total_cost: totalCost,
        source: 'whatsapp',
        last_purchased_at: now,
        updated_at: now,
      })
      .select('id')
      .single();
    materialId = inserted?.id;
  }

  if (materialId) {
    const { data: row } = await supabase
      .from('materials_inventory')
      .select('quantity')
      .eq('id', materialId)
      .single();
    const newTotal = row ? parseFloat(String(row.quantity || 0)) : qty;
    await supabase.from('material_transactions').insert({
      material_id: materialId,
      project_id: projectId,
      user_id: userId,
      transaction_type: 'purchase',
      quantity: qty,
      unit_cost: unitCost,
      total_cost: totalCost,
      description: `Added ${qty} ${unit} of ${materialName}`,
      source: 'whatsapp',
    });
    const reply = `✅ Logged! Added ${qty} ${unit} of ${materialName} to your Materials & Supplies. Current stock: ${newTotal} ${unit}.`;
    await sendMessage(from, reply);
  }

  if (vendor) await upsertVendor(projectId, vendor, 0);
}

async function handleLaborLog(
  from: string,
  projectId: string,
  extracted: Record<string, unknown>,
  rawMessage: string,
  lang?: string
): Promise<void> {
  let workerCount = typeof extracted.worker_count === 'number'
    ? extracted.worker_count
    : parseInt(String(extracted.worker_count || '0'), 10) || 0;

  if (workerCount <= 0) {
    const m = rawMessage.match(/(\d+)\s*(workers?|people|men|casuals?|labou?rers?)/i);
    workerCount = m ? parseInt(m[1], 10) : 0;
  }

  if (workerCount <= 0) {
    await sendMessage(from, await ai(
      'Ask the user how many workers were on site today. Give an example: "6 workers on site".',
      'How many workers were on site today? e.g. "6 workers on site"',
      200,
      lang
    ));
    return;
  }

  // Check for unusual worker count
  const { data: recentLogs } = await supabase
    .from('daily_logs')
    .select('worker_count')
    .eq('project_id', projectId)
    .not('worker_count', 'is', null)
    .order('log_date', { ascending: false })
    .limit(7);

  let anomalyMsg = '';
  if (recentLogs && recentLogs.length >= 3) {
    const avg = recentLogs.reduce((s, l) => s + (l.worker_count || 0), 0) / recentLogs.length;
    if (workerCount > avg * 1.5) {
      anomalyMsg = `\n\n🔔 *Note:* ${workerCount} workers is more than usual (avg: ${Math.round(avg)}). Special task today?`;
    } else if (workerCount < avg * 0.5) {
      anomalyMsg = `\n\n🔔 *Note:* ${workerCount} workers is fewer than usual (avg: ${Math.round(avg)}). Is everything okay on site?`;
    }
  }

  await upsertDailyLog(projectId, { worker_count: workerCount });
  const msg = await ai(
    `Confirm to the user that ${workerCount} workers were logged for today.
    ${anomalyMsg ? 'Also note: ' + anomalyMsg : ''}
    Tell them to check Daily Accountability page.
    Keep it brief.`,
    `${workerCount} workers logged for today. Check Daily Accountability page.`,
    200,
    lang
  );
  await sendMessage(from, msg);
}

async function handleProgressUpdate(
  from: string,
  projectId: string,
  extracted: Record<string, unknown>,
  rawMessage: string,
  lang?: string
): Promise<void> {
  const taskLines = rawMessage
    .split('\n')
    .map((l: string) => l.replace(/^[\d\.\-\*\•]\s*/, '').trim())
    .filter((l: string) =>
      l.length > 5 &&
      !/^(i completed|following tasks|tasks today|completed today)/i.test(l)
    );

  const today = new Date().toISOString().split('T')[0];

  const activityEntry = {
    log_time: new Date().toISOString().split('T')[1]?.substring(0, 5) || '12:00',
    activity_type: 'Milestone',
    description: rawMessage.trim(),
  };

  if (taskLines.length > 1) {
    for (const taskText of taskLines) {
      const { error } = await supabase.from('tasks').insert({
        project_id: projectId,
        title: taskText,
        status: 'completed',
        completed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
      if (error) console.error('[Task Insert Error]', error.message);
    }
    await upsertDailyLog(projectId, { notes: taskLines.join('\n'), activity_entries: [activityEntry] });
    const msg = await ai(
      `Tell the user their progress update was logged: ${taskLines.length} tasks: ${taskLines.join(', ')}. Tell them it will appear on their dashboard timeline. Keep it brief and encouraging.`,
      `Logged ${taskLines.length} completed tasks. Check your dashboard timeline.`,
      200,
      lang
    );
    await sendMessage(from, msg);
  } else {
    const note = String(extracted.note || rawMessage).trim();
    await upsertDailyLog(projectId, { notes: note, activity_entries: [activityEntry] });

    if (/finished|completed|done|built|laid|poured|installed/i.test(note)) {
      await supabase.from('tasks').insert({
        project_id: projectId,
        title: note,
        status: 'completed',
        completed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
    }
    const msg = await ai(
      `Tell the user their progress update was logged: "${note}". Tell them it will appear on their dashboard timeline. Keep it brief and encouraging.`,
      `Progress logged: "${note}". Check your dashboard timeline.`,
      200,
      lang
    );
    await sendMessage(from, msg);
  }
}

async function handleProjectQuery(from: string, projectId: string, projectName: string): Promise<void> {
  await sendMessage(from, `You are currently working on: ${projectName}`);
}

async function handleIssueReport(
  from: string,
  userId: string,
  projectId: string,
  extracted: Record<string, unknown>,
  rawMessage: string,
  lang?: string
): Promise<void> {
  const rawDesc = String(extracted.description || rawMessage).trim();
  const cleanedDesc = rawDesc
    .replace(/^(log\s+)?(this\s+)?(alert\s+)?(issue|problem|bug|report)[:\s\-]*/i, '')
    .trim();
  const description = cleanedDesc || rawDesc;
  const title = description.length > 80 ? description.substring(0, 77) + '...' : description;
  const severity = (extracted.severity as string) || 'medium';

  const { data: inserted, error } = await supabase
    .from('issues')
    .insert({
      project_id: projectId,
      title: title || 'Reported issue',
      description: description || null,
      severity: ['low', 'medium', 'high', 'critical'].includes(severity) ? severity : 'medium',
      status: 'open',
      type: 'general',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Issue Report]', error.message);
    await sendMessage(from, 'Sorry, I had trouble logging that issue. Please try again or report from the dashboard.');
    return;
  }

  const msg = await ai(
    `Tell the user their issue was logged with ID ${inserted?.id}. Confirm it was recorded and they can view it on the Issues & Risks page.`,
    `Issue logged. You can view it on the Issues & Risks page.`,
    200,
    lang
  );
  await sendMessage(from, msg);
}

async function handleWeatherDelay(
  from: string,
  projectId: string,
  extracted: Record<string, unknown>,
  rawMessage: string
): Promise<void> {
  const reason = String(extracted.reason || rawMessage).trim();
  await upsertDailyLog(projectId, { weather_condition: reason, notes: `Delay: ${reason}` });
  const msg = await ai(
    `Tell the user their weather delay has been noted: "${reason}". Tell them it has been added to their project timeline. Express brief empathy about the delay.`,
    `Delay noted: "${reason}". Added to your project timeline.`
  );
  await sendMessage(from, msg);
}

async function handleMaterialQuery(from: string, projectId: string, message: string): Promise<void> {
  // Try to extract a specific material name (e.g. "how many bricks do I have" -> "bricks")
  const materialKeyword = message
    .replace(/how (?:much|many)|do (?:i|we) have|in (?:my )?inventory|current stock|stock (?:left|of)|remaining/i, '')
    .replace(/\?|\./g, '')
    .trim()
    .toLowerCase();
  const words = materialKeyword.split(/\s+/).filter((w) => w.length > 2 && !/^(the|and|for|have|has|get)$/.test(w));
  const keyword = words.length > 0 ? words.join(' ') : null;

  if (keyword) {
    const { data: materials } = await supabase
      .from('materials_inventory')
      .select('name, quantity, unit, last_purchased_at, last_used_at')
      .eq('project_id', projectId)
      .ilike('name', `%${keyword}%`)
      .limit(5);

    if (materials && materials.length > 0) {
      const m = materials[0];
      const qty = parseFloat(String(m.quantity || 0));
      const unit = m.unit || 'units';
      const lastPurchased = m.last_purchased_at
        ? new Date(m.last_purchased_at).toLocaleDateString(undefined, { dateStyle: 'medium' })
        : 'not recorded';
      const reply = `You have ${qty} ${unit} of ${m.name}. Last purchased: ${lastPurchased}.`;
      await sendMessage(from, reply);
      return;
    }
  }

  // List all materials
  const { data: materials } = await supabase
    .from('materials_inventory')
    .select('name, quantity, unit, last_purchased_at')
    .eq('project_id', projectId)
    .order('name');

  if (!materials || materials.length === 0) {
    const msg = await ai(
      'Tell the user there are no materials in inventory yet. Give an example: "Received 50 bags cement from Hima".',
      'No materials in inventory yet. Log received stock like: "Received 50 bags cement from Hima"'
    );
    await sendMessage(from, msg);
    return;
  }

  const lines = materials.map((m: any) =>
    `• ${m.name}: ${m.quantity} ${m.unit || 'units'}`
  ).join('\n');

  const msg = await ai(
    `Show the user their current inventory:\n${lines}\nThen tell them they can send "Used X bags cement" to update stock. Be brief.`,
    `Current inventory:\n\n${lines}\n\nSend "Used X bags cement" to update stock.`
  );
  await sendMessage(from, msg);
}

// ─── SMART_QUERY: free-form questions over historical data ─────────────────────

async function handleSmartQuery(from: string, projectId: string, question: string): Promise<void> {
  // BUG 7: Workers on a specific date — query daily_logs directly
  const workerDateMatch = question.match(/worker|staff|people|men|mason|came|on site/i);
  const dateMatch = question.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)|(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})|(\d{4})-(\d{2})-(\d{2})/i);
  if (workerDateMatch && dateMatch) {
    let logDate: string;
    const months: Record<string, number> = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
    if (dateMatch[5] && dateMatch[6] && dateMatch[7]) {
      logDate = `${dateMatch[5]}-${dateMatch[6]}-${dateMatch[7]}`;
    } else if (dateMatch[1] && dateMatch[2]) {
      const month = months[dateMatch[2].toLowerCase()];
      const day = parseInt(dateMatch[1], 10);
      const year = new Date().getFullYear();
      logDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    } else if (dateMatch[3] && dateMatch[4]) {
      const month = months[dateMatch[3].toLowerCase()];
      const day = parseInt(dateMatch[4], 10);
      const year = new Date().getFullYear();
      logDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    } else {
      logDate = '';
    }
    if (logDate) {
      const { data: log } = await supabase
        .from('daily_logs')
        .select('log_date, worker_count, notes')
        .eq('project_id', projectId)
        .eq('log_date', logDate)
        .maybeSingle();
      if (log) {
        const wc = log.worker_count != null ? log.worker_count : 'not recorded';
        const dateFormatted = new Date(log.log_date + 'T12:00:00').toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' });
        const reply = wc !== 'not recorded'
          ? `On ${dateFormatted}: ${wc} workers on site.${log.notes ? ` Notes: ${log.notes}` : ''}`
          : `On ${dateFormatted}: No worker count recorded.${log.notes ? ` Notes: ${log.notes}` : ''}`;
        await sendMessage(from, reply);
        return;
      }
      const dateFormatted = new Date(logDate + 'T12:00:00').toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' });
      await sendMessage(from, `I don't have a log for ${dateFormatted}. Check your Daily Accountability page at ${DASHBOARD_URL}/daily`);
      return;
    }
  }

  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const fromDate = twoYearsAgo.toISOString().split('T')[0];

  const { data: project } = await supabase
    .from('projects')
    .select('name, budget')
    .eq('id', projectId)
    .single();

  const { data: expenses } = await supabase
    .from('expenses')
    .select('description, amount, expense_date, created_at')
    .eq('project_id', projectId)
    .gte('expense_date', fromDate)
    .order('expense_date', { ascending: false })
    .limit(500);

  const { data: dailyLogs } = await supabase
    .from('daily_logs')
    .select('log_date, worker_count, notes')
    .eq('project_id', projectId)
    .gte('log_date', fromDate)
    .order('log_date', { ascending: false })
    .limit(500);

  const { data: materials } = await supabase
    .from('materials_inventory')
    .select('name, quantity, unit, last_updated, updated_at')
    .eq('project_id', projectId);

  let vendors: { name: string; total_spent: number }[] = [];
  try {
    const { data: vendorsData } = await supabase
      .from('vendors')
      .select('name, total_spent')
      .eq('project_id', projectId)
      .order('total_spent', { ascending: false })
      .limit(100);
    vendors = (vendorsData || []).map((v: any) => ({
      name: v.name,
      total_spent: parseFloat(String(v.total_spent || 0)),
    }));
  } catch {
    // vendors table may not exist in some deployments
  }

  const dataContext = {
    project: project ? { name: project.name, budget: project.budget } : null,
    expenses: (expenses || []).map((e: any) => ({
      description: e.description,
      amount: parseFloat(String(e.amount || 0)),
      date: e.expense_date,
    })),
    dailyLogs: (dailyLogs || []).map((l: any) => ({
      date: l.log_date,
      worker_count: l.worker_count,
      notes: l.notes,
    })),
    vendors,
    materialsInventory: (materials || []).map((m: any) => ({
      name: m.name,
      currentStock: m.quantity,
      unit: m.unit || 'units',
      lastUpdated: m.updated_at || m.last_updated,
    })),
  };

  const systemPrompt = `You are a construction project financial assistant for JengaTrack. Answer the user's question using the provided project data where relevant. If the question is about general construction knowledge, techniques, materials, or best practices, answer from your own expertise as a construction professional. Only say you cannot find information if the question requires specific project data (like exact amounts or dates) that is not in the provided data. Use UGX for all amounts. Be concise and friendly (2-4 short paragraphs max). For inventory questions use materialsInventory.currentStock. For purchase history check expenses descriptions. Always give a direct answer with the number if data exists. Never say you cannot find information if it is in the data. Do not make up numbers. Format numbers with commas (e.g. 1,500,000 UGX).`;

  const userMessage = `Project data (JSON):\n${JSON.stringify(dataContext)}\n\nUser question: "${question}"\n\nProvide a direct, helpful answer based on the data above.`;

  let answer: string | null = null;

  if (gemini && process.env.GEMINI_API_KEY) {
    try {
      const model = gemini.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
      const result = await model.generateContent([systemPrompt, userMessage]);
      answer = result.response.text()?.trim() || null;
      if (answer) console.log('[SmartQuery] Gemini success');
    } catch (err: any) {
      console.error('[SmartQuery] Gemini failed:', err?.message);
    }
  }

  if (!answer && process.env.OPENAI_API_KEY) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });
      answer = completion.choices[0]?.message?.content?.trim() || null;
      if (answer) console.log('[SmartQuery] OpenAI success');
    } catch (err: any) {
      console.error('[SmartQuery] OpenAI failed:', err?.message);
    }
  }

  if (answer) {
    await sendMessage(from, answer);
  } else {
    await sendMessage(from, await ai(
      'Tell the user you could not generate an answer right now. Suggest they try asking something like: How much did I spend on cement last month? Compare spending this month vs last month. Be brief.',
      'Could not generate an answer right now. Try: "How much did I spend on cement last month?" or "Compare spending this month vs last month"'
    ));
  }
}

// ─── Natural language fallback: unrecognized messages → AI with project context (no menu) ───

async function handleNaturalLanguageQuery(
  from: string,
  userId: string,
  projectId: string | null,
  rawMessage: string
): Promise<string> {
  if (!projectId) {
    return "Please select a project first. Reply with the project number from your list, or say \"list projects\" to see options.";
  }

  // BUG 1/4/5: If message looks like expense-log (number + action words), don't query DB — suggest format instead
  const hasNumber = /\d/.test(rawMessage);
  const hasExpenseHint = /paid|spent|bought|masons|workers|labour|labor|each|per/i.test(rawMessage);
  if (hasNumber && hasExpenseHint) {
    return "It looks like you want to log an expense. Try: 'Paid 10 masons 20k each' or 'Bought cement for 300,000 UGX'";
  }

  // Strict: only use project that belongs to this user (owner or manager).
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, budget, user_id, manager_id')
    .eq('id', projectId)
    .single();

  if (!project || (project.user_id !== userId && project.manager_id !== userId)) {
    return "Project not found. Say \"list projects\" to switch.";
  }

  // "When did I buy [material]?" / "When did I last buy [item]?" — direct expense lookup
  const whenDidIBuyMatch = rawMessage.match(/when\s+did\s+I\s+(?:last\s+)?buy\s+(.+?)(?:\?|$)/i);
  if (whenDidIBuyMatch) {
    const material = whenDidIBuyMatch[1].trim();
    if (material) {
      const { data: lastPurchase } = await supabase
        .from('expenses')
        .select('description, amount, expense_date, created_at')
        .eq('project_id', projectId)
        .ilike('description', `%${material}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastPurchase) {
        const dateStr = lastPurchase.expense_date || (lastPurchase.created_at || '').split('T')[0];
        const dateFormatted = dateStr ? new Date(dateStr + 'T12:00:00').toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' }) : dateStr;
        const amount = parseFloat(String(lastPurchase.amount || 0));
        return `You last bought ${lastPurchase.description || 'it'} on ${dateFormatted} for ${fmt(amount)} UGX.`;
      }
      return `I couldn't find a purchase of ${material} in this project's expense history.`;
    }
  }

  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const fromDate = twoYearsAgo.toISOString().split('T')[0];

  const { data: expenses } = await supabase
    .from('expenses')
    .select('description, amount, expense_date, created_at')
    .eq('project_id', projectId)
    .gte('expense_date', fromDate)
    .order('expense_date', { ascending: false })
    .limit(200);

  const { data: materials } = await supabase
    .from('materials_inventory')
    .select('name, quantity, unit, last_updated, updated_at')
    .eq('project_id', projectId);

  const { data: allExpenses } = await supabase
    .from('expenses')
    .select('amount')
    .eq('project_id', projectId);
  const totalSpent = (allExpenses || []).reduce((s: number, e: any) => s + parseFloat(String(e.amount || 0)), 0);
  const budget = parseFloat(String(project.budget || 0));
  const remaining = Math.max(0, budget - totalSpent);

  const context = {
    projectName: project.name,
    budgetUgx: budget,
    spentUgx: totalSpent,
    remainingUgx: remaining,
    recentExpenses: (expenses || []).slice(0, 10).map((e: any) => ({
      description: e.description,
      amount: parseFloat(String(e.amount || 0)),
      date: e.expense_date,
    })),
    materials: (materials || []).map((m: any) => ({
      name: m.name,
      quantity: m.quantity,
      unit: m.unit || 'units',
    })),
  };

  const systemPrompt = `You are JengaTrack, a construction assistant for this project. Answer the user naturally and helpfully.

Project: ${context.projectName}
Budget: ${fmt(context.budgetUgx)} UGX
Spent: ${fmt(context.spentUgx)} UGX
Remaining: ${fmt(context.remainingUgx)} UGX
Recent expenses (use only if relevant): ${JSON.stringify(context.recentExpenses)}
Materials inventory: ${JSON.stringify(context.materials)}

Rules:
- You are an ACTION-TAKING construction assistant, not just a data viewer.
- If the user wants to LOG something (expense, material, workers, issue) but you received this message as a fallback — tell them clearly what format to use and give a direct example. Never say "I don't have functionality to log". Never say "I cannot do that". Always either take the action or give the exact format needed.
- If the user asks a DATA QUESTION about something not in the provided context (e.g. workers on a specific date), say: "I don't have that specific record. Check your Daily Accountability page at ${DASHBOARD_URL}/daily"
- Never respond with inventory data when the user asked about workers or expenses.
- Use ONLY the project data above when answering data questions. Never invent amounts, dates, or facts not in the data.
- Be warm, concise, plain text, no markdown. Under 5 lines.
- For amounts use UGX and format with commas (e.g. 1,500,000 UGX).`;

  const userPrompt = `User asked: "${rawMessage}"\n\nAnswer using only the project data provided.`;

  if (gemini && process.env.GEMINI_API_KEY) {
    try {
      const model = gemini.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
      const result = await model.generateContent([systemPrompt, userPrompt]);
      const text = result.response.text()?.trim();
      if (text) return text;
    } catch (err: any) {
      console.error('[NaturalLanguage] Gemini failed:', err?.message);
    }
  }
  if (process.env.OPENAI_API_KEY) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 300,
      });
      const text = completion.choices[0]?.message?.content?.trim();
      if (text) return text;
    } catch (err: any) {
      console.error('[NaturalLanguage] OpenAI failed:', err?.message);
    }
  }
  return "I couldn't process that right now. Try asking something like: How much have I spent? What's my remaining budget?";
}

// ─── Daily Heartbeat (called by a scheduled job at /api/daily-heartbeat) ──────
// Export this so it can be called from a separate serverless cron endpoint

export async function sendDailyHeartbeat(): Promise<void> {
  // Get all active projects
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, budget, user_id')
    .eq('status', 'active');

  if (!projects) return;

  for (const project of projects) {
    // Get owner's WhatsApp number
    const { data: owner } = await supabase
      .from('profiles')
      .select('whatsapp_number')
      .eq('id', project.user_id)
      .single();

    if (!owner?.whatsapp_number) continue;

    const today = new Date().toISOString().split('T')[0];

    // Today's log
    const { data: todayLog } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('project_id', project.id)
      .eq('log_date', today)
      .maybeSingle();

    // Today's expenses
    const { data: todayExpenses } = await supabase
      .from('expenses')
      .select('amount')
      .eq('project_id', project.id)
      .gte('created_at', `${today}T00:00:00`);

    const dailySpend = (todayExpenses || []).reduce((s, e) => s + parseFloat(String(e.amount || 0)), 0);

    // Total spend
    const { data: allExpenses } = await supabase
      .from('expenses').select('amount').eq('project_id', project.id);
    const totalSpent = (allExpenses || []).reduce((s, e) => s + parseFloat(String(e.amount || 0)), 0);
    const budget = parseFloat(String(project.budget || 0));
    const pct = budget > 0 ? Math.round((totalSpent / budget) * 100) : 0;

    const hadActivity = todayLog !== null;

    const heartbeatMsg = await ai(
      `Generate a daily site update summary for the project owner:
    Project: ${project.name}
    Site active today: ${hadActivity ? 'Yes' : 'No updates received'}
    ${todayLog?.worker_count ? 'Workers: ' + todayLog.worker_count : ''}
    ${dailySpend > 0 ? 'Spent today: ' + fmt(dailySpend) + ' UGX' : ''}
    ${todayLog?.notes ? 'Update: ' + todayLog.notes : ''}
    Total spent: ${fmt(totalSpent)} UGX of ${fmt(budget)} UGX (${pct}%)
    Dashboard: ${DASHBOARD_URL}
    ${!hadActivity ? 'Mention no updates were received and suggest following up with site manager.' : ''}
    Be professional but brief. Include the dashboard URL.`,
      `Daily update — ${project.name}\n\nActive today: ${hadActivity ? 'Yes' : 'No'}\nTotal spent: ${fmt(totalSpent)}/${fmt(budget)} UGX (${pct}%)\n\n${DASHBOARD_URL}`
    );
    await sendMessage(`whatsapp:${owner.whatsapp_number}`, heartbeatMsg);
  }
}

// ─── Main Webhook Handler ─────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const twimlOk = `<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>`;

  try {
    // Parse body
    let body: any = {};
    if (req.body && typeof req.body === 'object') body = req.body;
    else if (req.body && typeof req.body === 'string') body = Object.fromEntries(new URLSearchParams(req.body));
    else body = req.query || {};

    const { From = '', Body = '', MessageSid, NumMedia = '0', MediaUrl0 = '', MediaContentType0 = '' } = body;
    const phoneNumber = (From || '').replace('whatsapp:', '').trim();
    const rawMessage = (Body || '').trim();
    const message = rawMessage.toLowerCase();
    const hasMedia = parseInt(NumMedia, 10) > 0;
    const isVoiceNote = MediaContentType0.startsWith('audio/');
    const isImage = MediaContentType0.startsWith('image/');

    console.log('✅ Webhook called:', { phoneNumber, message: message.substring(0, 80), hasMedia, MediaContentType0 });

    // ── STEP 1: User profile ──────────────────────────────────────────────────
    let profile = await getUserProfile(phoneNumber);

    if (!profile) {
      profile = await createUserProfile(phoneNumber);
    }

    const userId = profile.id;
    const onboardingState = profile.onboarding_state as OnboardingState;
    const needsOnboarding = !profile.onboarding_completed_at;
    console.log('[webhook] userId:', userId, 'projectId:', profile.active_project_id ?? 'none');

    // Duplicate prevention: same message within 30 seconds
    if (rawMessage.trim().length > 5 && !hasMedia) {
      if (checkDuplicateMessage(phoneNumber, rawMessage)) {
        await sendMessage(From, 'This looks like a duplicate — did you mean to send this again?');
        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(twimlOk);
      }
    }

    // "Start over" — reset onboarding cleanly without creating duplicate profile
    if (/start\s*over|startover/i.test(rawMessage.trim())) {
      await supabase.from('profiles').update({
        onboarding_state: null,
        onboarding_data: {},
        onboarding_completed_at: null,
        expense_state: null,
        expense_pending_data: {},
        pending_material_update: null,
        updated_at: new Date().toISOString(),
      }).eq('id', userId);
      await sendWelcomeMessage(From, profile.full_name);
      res.setHeader('Content-Type', 'text/xml');
      return res.status(200).send(twimlOk);
    }

    // ── STEP 2: Onboarding flow ───────────────────────────────────────────────
    if (needsOnboarding) {
      switch (onboardingState) {
        case null:
          await updateOnboardingState(userId, 'welcome_sent');
          await sendWelcomeMessage(From, profile.full_name);
          break;
        case 'welcome_sent':
          await handleProjectTypeSelection(userId, From, message);
          break;
        case 'awaiting_project_type':
          await handleProjectTypeSelection(userId, From, message);
          break;
        case 'awaiting_location':
          await handleLocationInput(userId, From, rawMessage);
          break;
        case 'awaiting_start_date':
          await handleStartDateInput(userId, From, rawMessage);
          break;
        case 'awaiting_budget':
          await handleBudgetInput(userId, From, rawMessage);
          break;
        case 'confirmation':
          if (message.includes('1') || /yes|create|confirm/i.test(message)) {
            try {
              const projectId = await createProjectFromOnboarding(userId);
              await sendPostCreationMessage(From, projectId);
            } catch (err: any) {
              console.error('[Onboarding] Project creation failed:', err);
              await sendMessage(From, await ai(
                `Tell the user the project could not be created. Error: ${err.message}. Tell them to type "start over" to try again.`,
                `Could not create the project. Error: ${err.message}. Type "start over" to try again.`
              ));
            }
          } else if (message.includes('2') || /edit/i.test(message)) {
            await updateOnboardingState(userId, 'welcome_sent', {});
            await sendWelcomeMessage(From, profile.full_name);
          } else {
            await updateOnboardingState(userId, 'completed');
            await sendMessage(From, await ai(
              'Tell the user no problem — they can create a project from the dashboard anytime. Say they can still send you updates and you will log them.',
              'No problem! Create a project from the dashboard anytime. You can still send me updates and I will log them.'
            ));
          }
          break;
        default:
          await sendWelcomeMessage(From, profile.full_name);
      }
      res.setHeader('Content-Type', 'text/xml');
      return res.status(200).send(twimlOk);
    }

    // ── STEP 3: Expense state & project ───────────────────────────────────────
    const expenseState = (profile.expense_state as ExpenseState) ?? null;
    const pendingData = (profile.expense_pending_data as ExpensePendingData) || {};

    // ── STEP 3.5: Handle pending material confirmation (YES/NO) ─────────────────
    const pendingMaterial = profile.pending_material_update as PendingMaterialUpdate | null;
    if (pendingMaterial && pendingMaterial.project_id) {
      const trimmed = rawMessage.trim().toLowerCase();
      const isYes = /^(yes|y)$/.test(trimmed);
      const isNo = /^(no|n)$/.test(trimmed);
      if (isYes || isNo) {
        if (isYes) {
          try {
            const { data: existing } = await supabase
              .from('materials_inventory')
              .select('id, quantity, unit')
              .eq('project_id', pendingMaterial.project_id)
              .ilike('name', `%${pendingMaterial.material_name}%`)
              .maybeSingle();
            if (existing) {
              const newQty = parseFloat(String(existing.quantity || 0)) + pendingMaterial.quantity;
              const now = new Date().toISOString();
              await supabase
                .from('materials_inventory')
                .update({
                  quantity: newQty,
                  unit: pendingMaterial.unit || existing.unit,
                  last_purchased_at: now,
                  updated_at: now,
                })
                .eq('id', existing.id);
              console.log(`[Materials] Updated ${existing.id}: +${pendingMaterial.quantity} → ${newQty}`);
              await supabase.from('material_transactions').insert({
                material_id: existing.id,
                project_id: pendingMaterial.project_id,
                user_id: userId,
                transaction_type: 'purchase',
                quantity: pendingMaterial.quantity,
                unit_cost: 0,
                total_cost: 0,
                source: 'whatsapp',
                description: `Added ${pendingMaterial.quantity} ${pendingMaterial.unit || 'units'} via WhatsApp`,
              });
            } else {
              const now = new Date().toISOString();
              const { data: inserted } = await supabase
                .from('materials_inventory')
                .insert({
                  project_id: pendingMaterial.project_id,
                  user_id: userId,
                  name: pendingMaterial.material_name,
                  quantity: pendingMaterial.quantity,
                  unit: pendingMaterial.unit || 'units',
                  last_purchased_at: now,
                  updated_at: now,
                })
                .select('id')
                .single();
              console.log(`[Materials] Created ${pendingMaterial.material_name}: ${pendingMaterial.quantity}`);
              if (inserted?.id) {
                await supabase.from('material_transactions').insert({
                  material_id: inserted.id,
                  project_id: pendingMaterial.project_id,
                  user_id: userId,
                  transaction_type: 'purchase',
                  quantity: pendingMaterial.quantity,
                  unit_cost: 0,
                  total_cost: 0,
                  source: 'whatsapp',
                  description: `Added ${pendingMaterial.quantity} ${pendingMaterial.unit || 'units'} via WhatsApp`,
                });
              }
            }
            await sendMessage(From, await ai(
              `Tell the user you added ${pendingMaterial.quantity} ${pendingMaterial.unit || 'units'} of ${pendingMaterial.material_name} to their Materials & Supplies inventory. Be brief.`,
              `Added ${pendingMaterial.quantity} ${pendingMaterial.unit || 'units'} of ${pendingMaterial.material_name} to Materials & Supplies.`
            ));
          } catch (err: any) {
            console.error('[Materials] Insert/update failed:', err?.message);
            await sendMessage(From, 'Could not add to inventory. Please try again from the dashboard.');
          }
        } else {
          await sendMessage(From, await ai(
            'Tell the user you skipped adding to materials. Be brief.',
            'Skipped. Send another update anytime.'
          ));
        }
        await clearPendingMaterialUpdate(userId);
        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(twimlOk);
      } else {
        await sendMessage(From, 'Please reply YES to add to Materials & Supplies, or NO to skip.');
        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(twimlOk);
      }
    }

    // Handle photo caption reply (after photo saved, before intent routing)
    if (expenseState === 'awaiting_photo_caption' && pendingData.photo_url) {
      const caption = rawMessage.trim();
      const today = new Date().toISOString().split('T')[0];

      // Append caption to today's daily log notes
      const { data: todayLog } = await supabase
        .from('daily_logs')
        .select('id, notes')
        .eq('project_id', pendingData.project_id)
        .eq('log_date', today)
        .maybeSingle();

      if (todayLog) {
        const updatedNotes = todayLog.notes
          ? `${todayLog.notes}\nPhoto: ${caption}`
          : `Photo: ${caption}`;
        await supabase.from('daily_logs')
          .update({ notes: updatedNotes })
          .eq('id', todayLog.id);
      }

      // Try inserting into site_photos table (may not exist — wrap in try/catch)
      try {
        await supabase.from('site_photos').insert({
          project_id: pendingData.project_id,
          user_id: userId,
          photo_url: pendingData.photo_url,
          caption: caption,
          tag: 'Other',
          source: 'whatsapp',
          created_at: new Date().toISOString(),
        });
      } catch (err: any) {
        // site_photos table may not exist — caption is still saved to daily_logs above
        console.log('[Photo Caption] site_photos insert skipped:', err?.message);
      }

      await updateExpenseState(userId, null, {});
      await sendMessage(From, await ai(
        `Tell the user their photo caption was saved: "${caption}". It has been added to today's Daily Accountability log. Be brief.`,
        `Caption saved! "${caption}" added to today's Daily Accountability.`
      ));
      res.setHeader('Content-Type', 'text/xml');
      return res.status(200).send(twimlOk);
    }

    // Handle reply to "Which project?" menu (BEFORE intent classification)
    if (expenseState === 'awaiting_project_selection') {
      if (/list.*project|my project|show.*project|all.*project|project.*list|what project/i.test(message)) {
        await handleListProjects(From, userId);
        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(twimlOk);
      }
      const options = pendingData.project_options || [];
      const selection = parseInt(rawMessage.trim(), 10);
      const nameMatch = options.findIndex(
        (p: any) =>
          message.toLowerCase().includes(String(p.name).toLowerCase().split(' ')[0]) ||
          String(p.name).toLowerCase().includes(message.toLowerCase().trim())
      );

      let selectedProject: { id: string; name: string; location?: string } | null = null;
      if (!isNaN(selection) && selection >= 1 && selection <= options.length) {
        selectedProject = options[selection - 1];
      } else if (nameMatch !== -1) {
        selectedProject = options[nameMatch];
      }

      if (selectedProject) {
        await supabase
          .from('profiles')
          .update({
            active_project_id: selectedProject.id,
            active_project_set_at: new Date().toISOString(),
            expense_state: null,
            expense_pending_data: {},
          })
          .eq('id', userId);

        const msg = await ai(
          `Tell the user you are now tracking updates for their project called "${selectedProject.name}". Be brief and encouraging. Tell them to send their first update.`,
          `Got it! Tracking updates for ${selectedProject.name}. Send your first update anytime.`
        );
        await sendMessage(From, msg);
        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(twimlOk);
      } else {
        const projectList = options.map((p: any, i: number) => `${i + 1}. ${p.name}`).join('\n');
        await sendMessage(From, await ai(
          `Ask the user to reply with a number. List: ${projectList}`,
          `Please reply with a number:\n\n${projectList}`
        ));
        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(twimlOk);
      }
    }

    // Get active project (or require selection for multi-project users)
    // STRICT: Only use project from getActiveProject — never query across projects without explicit switching.
    const { project, needsSelection, projects } = await getActiveProject(userId, profile);
    const currentProjectId = project?.id ?? null;
    console.log('[webhook] userId:', userId, 'projectId:', currentProjectId);

    if (needsSelection) {
      await sendProjectSelectionMenu(From, userId, projects);
      res.setHeader('Content-Type', 'text/xml');
      return res.status(200).send(twimlOk);
    }

    // Check for "switch project" command (before classifyIntent)
    if (/switch\s*project|change\s*project|select\s*project/i.test(rawMessage)) {
      if (projects.length <= 1) {
        await sendMessage(From, await ai(
          `Tell the user they only have one active project: ${projects[0]?.name}. They cannot switch because there is nothing to switch to.`,
          `You only have one active project: ${projects[0]?.name}`
        ));
      } else {
        await supabase
          .from('profiles')
          .update({ active_project_id: null, active_project_set_at: null })
          .eq('id', userId);
        await sendProjectSelectionMenu(From, userId, projects);
      }
      res.setHeader('Content-Type', 'text/xml');
      return res.status(200).send(twimlOk);
    }

    // Help / menu — AI-powered overview
    if (/^(help|menu|commands)$/i.test(rawMessage.trim())) {
      await handleGreeting(From, profile, project, projects || [],
        'Give me a quick overview of everything you can help me with on this project.',
        detectLanguage(rawMessage));
      res.setHeader('Content-Type', 'text/xml');
      return res.status(200).send(twimlOk);
    }

    // ── STEP 4: Group mode dispute handling ───────────────────────────────────
    const channelType = (project?.channel_type as string) || 'direct';
    if (channelType === 'group' && project) {
      const isOwner = project.user_id === userId;
      const isManager = project.manager_id === userId;
      const isDispute = /that\s*seems?\s*expensive|too\s*expensive|dispute|flag|overcharge/i.test(rawMessage);
      if (isOwner && isDispute) {
        const { data: lastExpense } = await supabase.from('expenses')
          .select('id, description, amount').eq('project_id', project.id)
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (lastExpense) {
          await supabase.from('expenses').update({ disputed: true }).eq('id', lastExpense.id);
          await sendMessage(From, await ai(
            `Tell the user that the expense "${lastExpense.description}" for ${fmt(parseFloat(lastExpense.amount))} UGX has been flagged as disputed on the dashboard.`,
            `Flagged "${lastExpense.description}" as disputed on the dashboard.`
          ));
        } else {
          await sendMessage(From, await ai(
            'Tell the user there is no recent expense to dispute.',
            'No recent expense to dispute.'
          ));
        }
        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(twimlOk);
      }
      if (!isManager && !isOwner) {
        await sendMessage(From, await ai(
          'Tell the user politely that only the project manager can log updates in this group.',
          'Only the project manager can log updates in this group.'
        ));
        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(twimlOk);
      }
    }

    // ── STEP 5: Handle media ──────────────────────────────────────────────────
    if (hasMedia && MediaUrl0) {
      if (isVoiceNote) {
        await sendMessage(From, await ai(
          'Tell the user you received their voice note and are transcribing it. One short line.',
          'Voice note received! Transcribing now...'
        ));
        const transcribed = await processVoiceNote(MediaUrl0);
        if (transcribed) {
          await sendMessage(From, await ai(
            `Tell the user you transcribed their voice note as: "${transcribed}" and you are processing it now.`,
            `Got it: "${transcribed}"\nProcessing now...`
          ));
          const { intent, extracted } = await classifyIntent(transcribed, phoneNumber);
          if (!project) {
            await sendMessage(From, await ai(
              'Tell the user they need a project first. Tell them to type "hey jenga" to create one.',
              'You need a project first. Type "hey jenga" to create one.'
            ));
          } else {
            const voiceLang = detectLanguage(transcribed);
            await routeIntent(intent, extracted, transcribed, From, userId, project, profile, projects || [], voiceLang);
          }
        } else {
          await sendMessage(From, await ai(
            'Tell the user you could not transcribe their voice note clearly. Ask them to try again with clearer audio or type their update instead.',
            'Could not transcribe that voice note clearly. Try again or type your update.'
          ));
        }
        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(twimlOk);
      }

      if (isImage && project) {
        try {
          const mediaResponse = await fetch(MediaUrl0, {
            headers: {
              Authorization: `Basic ${Buffer.from(
                `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
              ).toString('base64')}`,
            },
          });
          const buffer = await (mediaResponse as any).buffer();
          const contentType = mediaResponse.headers.get('content-type') || 'image/jpeg';
          const ext = contentType.includes('png') ? 'png' : 'jpg';
          const fileName = `${project.id}/${Date.now()}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from('site-photos')
            .upload(fileName, buffer, { contentType, upsert: false });

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from('site-photos')
            .getPublicUrl(fileName);

          const permanentUrl = urlData?.publicUrl || MediaUrl0;
          console.log('[Photo] Saved to Supabase:', permanentUrl);

          await upsertDailyLog(project.id, { photo_urls: [permanentUrl] });

          // BUG 3: Check if Body (rawMessage) contains an inline caption
          const captionPatterns = [
            /save (?:the )?note as[:\s]+"?([^"]+)"?/i,
            /caption[:\s]+"?([^"]+)"?/i,
            /note[:\s]+"?([^"]+)"?/i,
            /tag[:\s]+"?([^"]+)"?/i,
          ];
          let inlineCaption: string | null = null;
          for (const pattern of captionPatterns) {
            const match = rawMessage.match(pattern);
            if (match) {
              inlineCaption = match[1].trim();
              break;
            }
          }

          if (inlineCaption) {
            const today = new Date().toISOString().split('T')[0];
            const { data: todayLog } = await supabase
              .from('daily_logs')
              .select('id, notes')
              .eq('project_id', project.id)
              .eq('log_date', today)
              .maybeSingle();
            if (todayLog) {
              const updatedNotes = todayLog.notes
                ? `${todayLog.notes}\nPhoto: ${inlineCaption}`
                : `Photo: ${inlineCaption}`;
              await supabase.from('daily_logs')
                .update({ notes: updatedNotes })
                .eq('id', todayLog.id);
            }
            try {
              await supabase.from('site_photos').insert({
                project_id: project.id,
                user_id: userId,
                photo_url: permanentUrl,
                caption: inlineCaption,
                tag: 'Other',
                source: 'whatsapp',
                created_at: new Date().toISOString(),
              });
            } catch (err: any) {
              console.log('[Photo Caption] site_photos insert skipped:', err?.message);
            }
            await sendMessage(From, `Photo saved with caption: '${inlineCaption}'`);
          } else {
            await sendMessage(From, await ai(
              'Tell the user their photo was saved. Ask them to add a caption by replying with a description.',
              'Photo saved! What caption would you like to add?'
            ));
            await updateExpenseState(userId, 'awaiting_photo_caption', {
              photo_url: permanentUrl,
              project_id: project.id,
            });
          }
        } catch (err: any) {
          console.error('[Photo Upload Error]', err?.message);
          await upsertDailyLog(project.id, { photo_urls: [MediaUrl0] });
          await sendMessage(From, await ai(
            'Tell the user their photo was saved. Tell them to view it on their dashboard.',
            'Photo saved! View it on your dashboard.'
          ));
        }
        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(twimlOk);
      }

      // Video or other media — save as progress photo
      if (project) {
        await upsertDailyLog(project.id, { photo_urls: [MediaUrl0] });
        await sendMessage(From, await ai(
          'Tell the user their photo or video was saved to their progress feed on the dashboard. One short line.',
          'Photo/video saved to your progress feed on the dashboard!'
        ));
      }
      res.setHeader('Content-Type', 'text/xml');
      return res.status(200).send(twimlOk);
    }

    // ── STEP 5.5: Re-check onboarding before any expense confirmation ─────────
    // When user sends "1", they might be confirming PROJECT creation (onboarding)
    // not expense. Use fresh profile so we never wrongly run expense insert.
    const { data: freshProfile } = await supabase
      .from('profiles')
      .select('onboarding_state, onboarding_completed_at')
      .eq('id', userId)
      .single();

    const isConfirmingProject =
      freshProfile?.onboarding_state === 'confirmation' &&
      !freshProfile?.onboarding_completed_at &&
      (message.includes('1') || /yes|create|confirm/i.test(message));

    if (isConfirmingProject) {
      try {
        const projectId = await createProjectFromOnboarding(userId);
        await sendPostCreationMessage(From, projectId);
      } catch (err: any) {
        console.error('[Onboarding] Project creation failed (from re-check):', err);
        await sendMessage(From, await ai(
          `Tell the user the project could not be created. Error: ${err.message}. Tell them to type "start over" to try again.`,
          `Could not create the project. Error: ${err.message}. Type "start over" to try again.`
        ));
      }
      res.setHeader('Content-Type', 'text/xml');
      return res.status(200).send(twimlOk);
    }

    // ── STEP 6: Handle awaiting_confirmation ──────────────────────────────────
    if (expenseState === 'awaiting_confirmation' && pendingData.project_id) {
      const isConfirmationResponse =
        /^[123]$/.test(rawMessage.trim()) ||
        /^(yes|ok|no|log it|confirm|edit|cancel|save)$/i.test(rawMessage.trim());

      const newIntent = preClassifyIntent(rawMessage);
      const looksLikeNewIntent = newIntent !== null && newIntent.intent !== 'GREETING';

      if (!isConfirmationResponse && looksLikeNewIntent) {
        console.log('[AutoClear] Stale confirmation cleared, processing new intent');
        await updateExpenseState(userId, null, {});
        // Fall through to intent routing below
      } else {
      // CRITICAL: Do not process expense confirmation during onboarding
      if (!profile.onboarding_completed_at) {
        console.log('[Expense Confirm] Blocked - user still onboarding');
        await handleOnboardingMessage(From, profile, message);
        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(twimlOk);
      }

      if (message.includes('1') || /yes|ok|✅|log it|confirm/i.test(message)) {
        const toInsert = pendingData.items && pendingData.items.length > 1
          ? pendingData.items.map((x) => ({ ...x, description: `${x.quantity} ${x.unit || 'units'} of ${x.item}` }))
          : [{ item: pendingData.item, quantity: pendingData.quantity, unit: pendingData.unit, amount: pendingData.amount, description: pendingData.description || 'Expense' }];

        console.log('[Expense Insert] Attempting:', {
          user_id: userId,
          project_id: pendingData.project_id,
          count: toInsert.length,
          supabaseUrl: process.env.SUPABASE_URL?.substring(0, 30),
        });

        let insertError: any = null;
        let insertedExpense: any = null;

        for (const entry of toInsert) {
          const desc = entry.description || (entry.item ? `${entry.quantity || 0} ${entry.unit || 'units'} of ${entry.item}` : 'Expense');
          const amt = entry.amount ?? pendingData.amount ?? 0;
          const { data: ins, error: err } = await supabase
            .from('expenses')
            .insert({
              user_id: userId,
              project_id: pendingData.project_id,
              description: desc,
              amount: String(amt),
              quantity_logged: entry.quantity ? String(entry.quantity) : null,
              currency: 'UGX',
              expense_date: new Date().toISOString().split('T')[0],
              source: 'whatsapp',
            })
            .select()
            .single();
          if (err) insertError = err;
          if (ins && !insertedExpense) insertedExpense = ins;
        }

        console.log('[Expense Insert] Result:', insertedExpense ? { id: insertedExpense.id, amount: insertedExpense.amount } : null);
        console.log('[Expense Insert] Error:', insertError ? { message: insertError.message, code: insertError.code, details: insertError.details } : null);

        if (insertError) {
          console.error('[Expense Insert] FAILED:', insertError.message, insertError.code, insertError.details);
          await sendMessage(From, await ai(
            `Tell the user there was an error saving their expense and ask them to try again. Error details: ${insertError.message}`,
            `Could not save that expense. Please try again.`
          ));
          res.setHeader('Content-Type', 'text/xml');
          return res.status(200).send(twimlOk);
        }

        if (!insertedExpense || !insertedExpense.id) {
          console.error('[Expense Insert] No data returned from insert');
          await sendMessage(From, await ai(
            'Tell the user the expense failed to save and ask them to try again.',
            'Failed to save expense. Please try again.'
          ));
          res.setHeader('Content-Type', 'text/xml');
          return res.status(200).send(twimlOk);
        }

        console.log('[Expense Insert] SUCCESS:', {
          project_id: pendingData.project_id,
          amount: pendingData.amount,
          description: pendingData.description,
        });

        if (pendingData.vendor && pendingData.amount) {
          await upsertVendor(pendingData.project_id, pendingData.vendor, pendingData.amount);
        }

        // Auto-add to materials_inventory when expense looks like material (skip labor/transport etc)
        const materialEntries = toInsert.map((e) => ({
          materialName: (e.item || e.description || '').trim(),
          quantity: (e.quantity && e.quantity > 0) ? e.quantity : 0,
          unit: e.unit || 'units',
          amount: e.amount ?? 0,
          description: e.description || '',
        }));
        if (materialEntries.length === 1 && (!materialEntries[0].quantity || !materialEntries[0].materialName)) {
          const parsed = parseQuantityFromDescription(pendingData.description || '');
          if (parsed) {
            materialEntries[0].quantity = parsed.quantity;
            materialEntries[0].unit = parsed.unit || materialEntries[0].unit;
          }
          materialEntries[0].materialName = (pendingData.item || pendingData.description || '').trim();
        }

        const materialLines: string[] = [];
        for (const ent of materialEntries) {
          const descLower = (ent.description || ent.materialName).toLowerCase();
          const isSkipType = SKIP_KEYWORDS.some((k) => descLower.includes(k));
          const isMaterial = ent.materialName && ent.quantity > 0 && !isSkipType && MATERIAL_KEYWORDS.some((k) => descLower.includes(k));

        if (isMaterial && ent.materialName && ent.quantity > 0) {
          const nameNorm = ent.materialName.toLowerCase().trim();
          if (nameNorm.length >= 2 && !GARBAGE_MATERIAL_NAMES.includes(nameNorm)) {
            const now = new Date().toISOString();
            const unitCost = ent.amount && ent.quantity > 0 ? ent.amount / ent.quantity : 0;
            const totalCost = ent.amount || ent.quantity * unitCost;
            const { data: existing } = await supabase
              .from('materials_inventory')
              .select('id, quantity, unit_cost, total_cost')
              .eq('project_id', pendingData.project_id!)
              .eq('name', nameNorm)
              .maybeSingle();
            if (existing) {
              const newQty = parseFloat(String(existing.quantity || 0)) + ent.quantity;
              const newTotalCost = parseFloat(String(existing.total_cost || 0)) + totalCost;
              await supabase.from('materials_inventory').update({
                quantity: newQty,
                unit_cost: unitCost || parseFloat(String(existing.unit_cost || 0)),
                total_cost: newTotalCost,
                last_purchased_at: now,
                updated_at: now,
              }).eq('id', existing.id);
              await supabase.from('material_transactions').insert({
                material_id: existing.id,
                project_id: pendingData.project_id!,
                user_id: userId,
                transaction_type: 'purchase',
                quantity: ent.quantity,
                unit_cost: unitCost,
                total_cost: totalCost,
                description: `Added ${ent.quantity} ${ent.unit} via WhatsApp expense`,
                source: 'whatsapp',
              });
              materialLines.push(`📦 ${ent.quantity} ${ent.unit} of ${ent.materialName} added. Total stock: ${newQty} ${ent.unit}.`);
            } else {
              const { data: inserted } = await supabase.from('materials_inventory').insert({
                project_id: pendingData.project_id!,
                user_id: userId,
                name: nameNorm,
                quantity: ent.quantity,
                unit: ent.unit,
                unit_cost: unitCost,
                total_cost: totalCost,
                source: 'whatsapp',
                last_purchased_at: now,
                updated_at: now,
              }).select('id').single();
              if (inserted?.id) {
                await supabase.from('material_transactions').insert({
                  material_id: inserted.id,
                  project_id: pendingData.project_id!,
                  user_id: userId,
                  transaction_type: 'purchase',
                  quantity: ent.quantity,
                  unit_cost: unitCost,
                  total_cost: totalCost,
                  description: `Added ${ent.quantity} ${ent.unit} via WhatsApp expense`,
                  source: 'whatsapp',
                });
                materialLines.push(`📦 ${ent.quantity} ${ent.unit} of ${ent.materialName} added. Total stock: ${ent.quantity} ${ent.unit}.`);
              }
            }
          }
        }
        }

        const materialsUpdateLine = materialLines.length
          ? '\n📦 Materials updated:\n• ' + materialLines.join('\n• ')
          : '';

        await updateExpenseState(userId, null, {});

        // Budget alert: proactive warning when >= 80% or exceeded
        const { data: proj } = await supabase.from('projects').select('budget, name').eq('id', pendingData.project_id!).single();
        const budgetTotal = parseFloat(String(proj?.budget || 0));
        const { data: allEx } = await supabase.from('expenses').select('amount').eq('project_id', pendingData.project_id!);
        const totalSpentNow = (allEx || []).reduce((s, e) => s + parseFloat(String(e.amount || 0)), 0);
        const pctNow = budgetTotal > 0 ? (totalSpentNow / budgetTotal) * 100 : 0;
        let budgetAlert = '';
        if (pctNow >= 100) {
          budgetAlert = `\n\n🚨 Budget exceeded! You've spent more than your total budget for ${proj?.name || 'this project'}.`;
        } else if (pctNow >= 80) {
          budgetAlert = `\n\n⚠️ Budget alert: You've used ${Math.round(pctNow)}% of your budget for ${proj?.name || 'this project'}.`;
        }

        const baseMsg = `✅ Logged! ${pendingData.description} — ${fmt(pendingData.amount!)} UGX.${materialsUpdateLine}${budgetAlert}`;
        const msg = (materialsUpdateLine || budgetAlert)
          ? baseMsg
          : await ai(
          `Tell the user their expense was saved successfully: ${pendingData.description} — ${fmt(pendingData.amount!)} UGX. Tell them their dashboard and budget have been updated. Keep it short and friendly. Tell them to check Budgets & Costs page.`,
          `Saved! ${pendingData.description} — ${fmt(pendingData.amount!)} UGX logged. Check Budgets & Costs to see the update.`
        );
        await sendMessage(From, msg);
      } else if (message.includes('2') || /edit|✏️/i.test(message)) {
        await updateExpenseState(userId, null, {});
        await sendMessage(From, await ai(
          'Tell the user to send the corrected expense details.',
          'No problem! Send the corrected details.'
        ));
      } else if (message.includes('3') || /cancel|❌/i.test(message)) {
        await updateExpenseState(userId, null, {});
        await sendMessage(From, await ai(
          'Tell the user the expense was cancelled. Keep it very brief.',
          'Cancelled. Send a new update anytime.'
        ));
      } else {
        const stillMsg = await ai(
          `Tell the user you are still waiting for their reply on this pending expense: ${pendingData.description} — ${fmt(pendingData.amount || 0)} UGX. Ask them to reply 1 to save, 2 to edit, or 3 to cancel.`,
          `Still waiting: ${pendingData.description} — ${fmt(pendingData.amount || 0)} UGX\n\n1. Save\n2. Edit\n3. Cancel`
        );
        await sendOptions(From, stillMsg, ['1. Yes – Log it', '2. Edit', '3. Cancel']);
      }
      res.setHeader('Content-Type', 'text/xml');
      return res.status(200).send(twimlOk);
      }
    }

    // ── STEP 7: Handle awaiting_price ─────────────────────────────────────────
    if (expenseState === 'awaiting_price' && pendingData.quantity && pendingData.item) {
      const price = parseAmount(rawMessage);

      if (price > 0) {
        const { quantity, unit, item, vendor } = pendingData;
        const unitPrice = Math.round(price / quantity!);
        const description = `${quantity} ${unit || 'units'} of ${item}`;

        const anomalyAlert = await checkPriceAnomaly(pendingData.project_id!, item!, price, quantity!);

        await updateExpenseState(userId, 'awaiting_confirmation', {
          ...pendingData, amount: price, unit_price: unitPrice, description,
        });

        const confirmMsg = await ai(
          `Confirm this expense with the user and ask if it looks correct:
          Item: ${description}
          Total: ${fmt(price)} UGX
          ${vendor ? 'From: ' + vendor : ''}
          Per ${unit || 'unit'}: ${fmt(unitPrice)} UGX
          ${anomalyAlert ? 'Note: ' + anomalyAlert : ''}
          End with: reply 1 to save, 2 to edit, 3 to cancel.`,
          `${description} — ${fmt(price)} UGX${vendor ? ' from ' + vendor : ''}. Save it?\n\n1. Yes\n2. Edit\n3. Cancel`
        );
        const finalMsg = anomalyAlert ? `${anomalyAlert}\n\n${confirmMsg}` : confirmMsg;
        await sendOptions(From, finalMsg, ['1. Yes – Log it', '2. Edit', '3. Cancel']);
      } else {
        await sendMessage(From, await ai(
          'Tell the user to send the total cost as a number. Give examples: 1,900,000 or 1.9M.',
          'Send the total cost as a number (e.g. 1,900,000 or 1.9M).'
        ));
      }
      res.setHeader('Content-Type', 'text/xml');
      return res.status(200).send(twimlOk);
    }

    // ── STEP 8: No project → prompt ───────────────────────────────────────────
    if (!project) {
      await sendMessage(From, await ai(
        'Tell the user they need to create a project first before logging updates. Tell them to say "hey jenga" or "start" to create one.',
        'You need a project first. Say "hey jenga" or "start" to create one!'
      ));
      res.setHeader('Content-Type', 'text/xml');
      return res.status(200).send(twimlOk);
    }

    // ── STEP 9: GPT-4o-mini intent classification + routing ───────────────────
    const detectedLang = detectLanguage(rawMessage);

    // BUG 9: Multi-item expense — parse before classifyIntent and route directly
    const multiItems = parseMultiItemMessage(rawMessage);
    if (multiItems && multiItems.length >= 2) {
      const totalAmount = multiItems.reduce((s, i) => s + i.amount, 0);
      await handleExpenseLog(From, userId, project.id, { items: multiItems, amount: totalAmount }, rawMessage, detectedLang);
      res.setHeader('Content-Type', 'text/xml');
      return res.status(200).send(twimlOk);
    }

    const { intent, extracted } = await classifyIntent(rawMessage, phoneNumber);
    console.log('[Intent]', intent, JSON.stringify(extracted));

    const lines = rawMessage.split('\n')
      .map((l: string) => l.replace(/^[•\-\*\d\.]\s*/, '').trim())
      .filter((l: string) => l.length > 5);

    if (lines.length > 1) {
      let processedCount = 0;
      for (const line of lines) {
        const lineResult = preClassifyIntent(line);
        if (lineResult && lineResult.intent !== 'GREETING') {
          const lineLang = detectLanguage(line);
          await routeIntent(lineResult.intent, lineResult.extracted, line, From, userId, project, profile, projects || [], lineLang);
          processedCount++;
        }
      }
      if (processedCount > 0) {
        console.log('[MultiIntent] Processing', processedCount, 'lines');
        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(twimlOk);
      }
    }

    await routeIntent(intent, extracted, rawMessage, From, userId, project, profile, projects || [], detectedLang);

    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(twimlOk);

  } catch (error: any) {
    console.error('❌ Webhook error:', error.message, error.stack);
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Message>Sorry, something went wrong. Please try again.</Message></Response>`);
  }
}

// ─── Route Intent ─────────────────────────────────────────────────────────────

async function handleListProjects(from: string, userId: string): Promise<void> {
  const { data: ownedProjects } = await supabase
    .from('projects')
    .select('id, name, description, budget, status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const { data: managedProjects } = await supabase
    .from('projects')
    .select('id, name, description, budget, status')
    .eq('manager_id', userId)
    .order('created_at', { ascending: false });

  const all = [...(ownedProjects || []), ...(managedProjects || [])]
    .filter((p, i, self) => i === self.findIndex((t) => t.id === p.id));

  if (all.length === 0) {
    await sendMessage(from, await ai(
      'Tell the user they have no projects yet. Tell them to type "start" to create their first project.',
      'You do not have any projects yet. Type "start" to create your first project.'
    ));
    return;
  }

  const lines = all.map((p, i) => {
    const budget = parseFloat(String(p.budget || 0));
    const budgetStr = budget > 0 ? ` — Budget: ${fmt(budget)} UGX` : '';
    return `${i + 1}. ${p.name}${budgetStr}`;
  }).join('\n');

  const msg = await ai(
    `List the user's projects and tell them they can say "switch project" to change their active project. Here are the projects:\n${lines}`,
    `Your projects (${all.length}):\n\n${lines}\n\nSay "switch project" to change your active project.`
  );
  await sendMessage(from, msg);
}

async function routeIntent(
  intent: IntentType,
  extracted: Record<string, unknown>,
  rawMessage: string,
  from: string,
  userId: string,
  project: any,
  profile: any,
  projects: any[],
  lang?: string
): Promise<void> {
  const currentProjectId = project?.id ?? null;
  console.log('[webhook] userId:', userId, 'projectId:', currentProjectId);

  switch (intent) {
    case 'BUDGET_QUERY':
      await handleBudgetQuery(from, project.id, lang);
      break;
    case 'BUDGET_UPDATE':
      await handleBudgetUpdate(from, project.id, extracted);
      break;
    case 'EXPENSE_LOG':
      await handleExpenseLog(from, userId, project.id, extracted, rawMessage, lang);
      break;
    case 'MATERIAL_LOG':
      await handleMaterialLog(from, userId, project.id, extracted, rawMessage, lang);
      break;
    case 'LABOR_LOG':
      await handleLaborLog(from, project.id, extracted, rawMessage, lang);
      break;
    case 'PROGRESS_UPDATE':
      await handleProgressUpdate(from, project.id, extracted, rawMessage, lang);
      break;
    case 'WEATHER_DELAY':
      await handleWeatherDelay(from, project.id, extracted, rawMessage);
      break;
    case 'MATERIAL_QUERY':
      await handleMaterialQuery(from, project.id, rawMessage);
      break;
    case 'SMART_QUERY':
      await handleSmartQuery(from, project.id, rawMessage);
      break;
    case 'LIST_PROJECTS':
      await handleListProjects(from, userId);
      break;
    case 'PROJECT_QUERY':
      await handleProjectQuery(from, project?.id ?? '', project?.name ?? 'Unknown');
      break;
    case 'ISSUE_REPORT':
      await handleIssueReport(from, userId, project.id, extracted, rawMessage, lang);
      break;
    case 'GREETING':
    default: {
      // Route unrecognized messages to AI with project context (no rigid menu)
      const aiResponse = await handleNaturalLanguageQuery(from, userId, project?.id ?? null, rawMessage);
      await sendMessage(from, aiResponse);
      break;
    }
  }
}