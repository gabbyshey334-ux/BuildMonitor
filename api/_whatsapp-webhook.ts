/**
 * JengaTrack WhatsApp Webhook — Complete Implementation
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

type ExpenseState = null | 'awaiting_price' | 'awaiting_confirmation' | 'awaiting_project_selection';

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

  const allProjects = [
    ...(ownedProjects || []),
    ...(managedProjects || []),
  ].filter((p, index, self) => index === self.findIndex((t) => t.id === p.id));

  if (allProjects.length === 0) {
    return { project: null, needsSelection: false, projects: [] };
  }

  if (allProjects.length === 1) {
    if (profile.active_project_id !== allProjects[0].id) {
      await supabase
        .from('profiles')
        .update({
          active_project_id: allProjects[0].id,
          active_project_set_at: new Date().toISOString(),
        })
        .eq('id', userId);
    }
    return { project: allProjects[0], needsSelection: false, projects: allProjects };
  }

  if (profile.active_project_id) {
    const activeProject = allProjects.find((p) => p.id === profile.active_project_id);
    if (activeProject) {
      const setAt = profile.active_project_set_at
        ? new Date(profile.active_project_set_at)
        : null;
      const today = new Date();
      const isToday = setAt && setAt.toDateString() === today.toDateString();
      if (isToday) {
        return { project: activeProject, needsSelection: false, projects: allProjects };
      }
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

  await sendMessage(
    to,
    `👋 You have ${projects.length} active projects.\n\n` +
      `Which one are you updating today?\n\n` +
      `${projectList}\n\n` +
      `Reply with the number (e.g. "1" or "2")\n\n` +
      `💡 Tip: Say "switch project" anytime to change.`
  );
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

async function sendWelcomeMessage(to: string, name?: string) {
  const greeting = name && name !== 'WhatsApp User' ? `Hey ${name}! 👋` : 'Hey! 👋';
  await sendOptions(to,
    `${greeting} Welcome to *JengaTrack* 🏗️\n\nI help you track your construction project — expenses, materials, workers, progress — all via WhatsApp.\n\nLet's set up your first project. What kind of build is this?`,
    ['🏠 Residential home', '🏢 Commercial building', '🏗️ Other / Skip for now']
  );
}

async function handleProjectTypeSelection(userId: string, to: string, msg: string) {
  let projectType = 'btn_other';
  if (msg.includes('1') || /residential|home/i.test(msg)) projectType = 'btn_residential';
  else if (msg.includes('2') || /commercial|office|shop/i.test(msg)) projectType = 'btn_commercial';
  await updateOnboardingState(userId, 'awaiting_location', { project_type: projectType });
  await sendMessage(to, `Great choice! 📍 Where's the site?\n\n(e.g., Kampala Road, Entebbe, Plot 24 Mukono — or type "skip")`);
}

async function handleLocationInput(userId: string, to: string, body: string) {
  const location = /skip/i.test(body) ? undefined : body.trim();
  await updateOnboardingState(userId, 'awaiting_start_date', { location });
  await sendMessage(to, `Nice! 📅 When did the project start?\n\n(e.g., Today, 15 Feb 2026, January 2026 — or "skip")`);
}

async function handleStartDateInput(userId: string, to: string, body: string) {
  const start_date = /skip/i.test(body) ? undefined : body.trim();
  await updateOnboardingState(userId, 'awaiting_budget', { start_date });
  await sendMessage(to, `Almost done! 💰 What's the total project budget?\n\n(e.g., 150,000,000 UGX or 150M — or "skip")`);
}

async function handleBudgetInput(userId: string, to: string, body: string) {
  let budget: number | undefined;
  if (!/skip/i.test(body)) {
    // Handle "150M", "150 million", "150,000,000", "185 million"
    const mMatch = body.match(/(\d+(?:\.\d+)?)\s*[Mm](?:illion)?/i);
    const bMatch = body.match(/(\d+(?:\.\d+)?)\s*[Bb](?:illion)?/i);
    const wordMillion = body.match(/(\d+(?:\.\d+)?)\s*million/i);
    const wordBillion = body.match(/(\d+(?:\.\d+)?)\s*billion/i);
    const numMatch = body.match(/(\d+(?:,\d{3})*(?:\.\d{2})?)/);
    if (mMatch || wordMillion) budget = parseFloat((mMatch || wordMillion)![1]) * 1_000_000;
    else if (bMatch || wordBillion) budget = parseFloat((bMatch || wordBillion)![1]) * 1_000_000_000;
    else if (numMatch) budget = parseFloat(numMatch[1].replace(/,/g, ''));
  }
  await updateOnboardingState(userId, 'confirmation', { budget });

  const { data: profile } = await supabase.from('profiles').select('onboarding_data').eq('id', userId).single();
  const d = (profile?.onboarding_data as OnboardingData) || {};
  const typeLabel = d.project_type === 'btn_residential' ? 'Residential home'
    : d.project_type === 'btn_commercial' ? 'Commercial building' : 'Construction Project';

  const summary = `Here's your project summary:\n\n` +
    `🏗️ Type: ${typeLabel}\n` +
    `📍 Location: ${d.location || 'TBD'}\n` +
    `📅 Started: ${d.start_date || 'TBD'}\n` +
    `💰 Budget: ${budget ? fmt(budget) + ' UGX' : 'TBD'}\n\n` +
    `Looks good?`;
  await sendOptions(to, summary, ['✅ Yes – Create project!', '✏️ Edit something', '⏭️ Skip for now']);
}

async function createProjectFromOnboarding(userId: string): Promise<string> {
  // Verify profile exists before inserting (projects.user_id references profiles.id)
  const { data: profileExists } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single();

  if (!profileExists) {
    console.error('[Create Project] Profile not found:', userId);
    throw new Error('User profile not found. Please try again.');
  }

  const { data: profile } = await supabase.from('profiles').select('onboarding_data').eq('id', userId).single();
  const d = (profile?.onboarding_data as OnboardingData) || {};
  const typeLabel = d.project_type === 'btn_residential' ? 'Residential home'
    : d.project_type === 'btn_commercial' ? 'Commercial building' : 'Construction Project';
  const projectName = d.location ? `${typeLabel} - ${d.location}` : typeLabel;

  const { data: project, error } = await supabase.from('projects').insert({
    user_id: userId,
    name: projectName,
    description: `Started: ${d.start_date || 'TBD'}. Created via WhatsApp.`,
    budget: d.budget ? d.budget.toString() : '0',
    status: 'active',
    channel_type: 'direct',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).select().single();

  if (error) { console.error('[Create Project Error]', error); throw error; }
  await updateOnboardingState(userId, 'completed');
  console.log('[Create Project] ✅', project.id);
  return project.id;
}

async function sendPostCreationMessage(to: string, projectId: string) {
  await sendMessage(to,
    `🎉 Project created! Your dashboard is live:\n${DASHBOARD_URL}/dashboard?project=${projectId}\n\n` +
    `Now just chat updates to me anytime:\n\n` +
    `• "Bought 50 bags cement for 1,900,000"\n` +
    `• "6 workers on site today"\n` +
    `• "Foundation 80% done"\n` +
    `• "How much have we spent?"\n` +
    `• Send receipt photos 📸\n` +
    `• Send voice notes 🎙️\n\n` +
    `I'll organize everything into your dashboard automatically. Type "help" anytime.`
  );
}

// ─── OCR: Receipt Photo ───────────────────────────────────────────────────────

async function processReceiptPhoto(
  from: string,
  userId: string,
  projectId: string,
  mediaUrl: string
): Promise<void> {
  await sendMessage(from, '📸 Receipt received! Scanning it now...');

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
      const summary = `📋 Receipt scanned!\n\n` +
        `🏪 Vendor: ${vendor}\n` +
        `📅 Date: ${ocrData.date || 'Not visible'}\n` +
        `Items:\n${itemsList || '  • (unable to read items)'}\n` +
        `💰 Total: ${fmt(total)} UGX\n\n` +
        `Save this to your records?`;
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

    // Try OpenAI Vision first
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

    // Gemini vision fallback
    if (gemini && process.env.GEMINI_API_KEY) {
      try {
        const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
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

    await sendMessage(from,
      `Couldn't read that receipt clearly. Try:\n• Better lighting\n• Lay receipt flat\n• Photo straight from above\n\nOr type the details manually: "Bought [item] for [amount] from [vendor]"`
    );
  } catch (err: any) {
    console.error('[OCR Error]', err);
    await sendMessage(from,
      `Couldn't read that receipt clearly. Try:\n• Better lighting\n• Lay receipt flat\n• Photo straight from above\n\nOr type the details manually: "Bought [item] for [amount] from [vendor]"`
    );
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

    // Try OpenAI Whisper first
    if (process.env.OPENAI_API_KEY) {
      try {
        const blob = new Blob([buffer], { type: 'audio/ogg' });
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

    // Gemini audio fallback
    if (gemini && process.env.GEMINI_API_KEY) {
      try {
        const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
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

    return null;
  } catch (err: any) {
    console.error('[Voice Error]', err);
    return null;
  }
}

// ─── Intent Classification (GPT-4o) ──────────────────────────────────────────

function preClassifyIntent(message: string): IntentResult | null {
  const m = message.toLowerCase().trim();

  // EXPENSE patterns
  if (/bought|paid|spent|purchased|cost|price|buying|pay|expense/i.test(m) && /\d/.test(m)) {
    const amountMatch = message.match(/(\d+(?:,\d{3})*(?:\.\d{2})?)/g);
    const amounts = amountMatch ? amountMatch.map((a) => parseFloat(a.replace(/,/g, ''))) : [];
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

  // MATERIAL used patterns
  if (/used|consumed|applied|finished\s+using/i.test(m) && /\d/.test(m)) {
    const qtyMatch = message.match(/(\d+)\s*(bags?|kg|tons?|pieces?|trips?|units?)/i);
    const itemMatch = message.match(/(?:used|consumed)\s+\d+\s+\w+\s+(?:of\s+)?([a-z\s]+?)(?:\s+for|\s+on|\s*$)/i);
    return {
      intent: 'MATERIAL_LOG',
      extracted: {
        action: 'used',
        quantity: qtyMatch ? parseFloat(qtyMatch[1]) : 0,
        unit: qtyMatch ? qtyMatch[2].toLowerCase() : '',
        item: itemMatch ? itemMatch[1].trim() : '',
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

async function classifyIntent(message: string, phoneNumber: string): Promise<IntentResult> {
  const preClassified = preClassifyIntent(message);
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

Common patterns you MUST classify correctly:

EXPENSE_LOG examples (always has numbers):
- "Bought 50 bags cement for 1,900,000"
- "Bought cement 1900000"
- "Paid plumber 150k"
- "Spent 500k on iron rods"
- "200000 for sand"
- "cement 38000 per bag"
- "purchased tiles 450,000"

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
    'BUDGET_QUERY', 'MATERIAL_QUERY', 'WEATHER_DELAY', 'SMART_QUERY', 'GREETING',
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

  // Try OpenAI first
  if (process.env.OPENAI_API_KEY) {
    try {
      console.log('[Intent] Trying OpenAI...');
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
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

  // Try Gemini as fallback
  if (gemini && process.env.GEMINI_API_KEY) {
    try {
      console.log('[Intent] Trying Gemini...');
      const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = `${systemPrompt}\n\nMessage to classify: "${message}"\n\nReturn ONLY the JSON object, no other text.`;
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
  data: { worker_count?: number; notes?: string; weather_condition?: string; photo_urls?: string[] }
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const { data: existing } = await supabase
    .from('daily_logs')
    .select('id, notes, photo_urls')
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
    await supabase.from('daily_logs').update(updateData).eq('id', existing.id);
  } else {
    await supabase.from('daily_logs').insert({ project_id: projectId, log_date: today, ...data });
  }
}

// ─── Intent Handlers ──────────────────────────────────────────────────────────

async function handleBudgetQuery(from: string, projectId: string): Promise<void> {
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

  let reply = `📊 *Budget Summary*\n\n` +
    `💰 Total Spent: ${fmt(totalSpent)} UGX\n` +
    `🎯 Budget: ${fmt(budget)} UGX\n` +
    `📈 Used: ${pct}%\n` +
    `✅ Remaining: ${fmt(remaining)} UGX`;

  if (weeksLeft !== null) reply += `\n⏱️ At current rate: ~${weeksLeft} weeks of budget left`;
  if (pct > 80) reply += `\n\n⚠️ *Warning:* Over 80% of budget used!`;

  await sendMessage(from, reply);
}

async function handleGreeting(
  from: string,
  profile: any,
  currentProject?: any,
  allProjects?: any[]
): Promise<void> {
  const firstName =
    profile?.full_name && profile.full_name !== 'WhatsApp User'
      ? profile.full_name.split(' ')[0]
      : null;
  const hi = firstName ? `👋 Hey ${firstName}!` : `👋 Hey!`;

  if (currentProject) {
    await sendMessage(
      from,
      `${hi} Welcome back to *JengaTrack* 🏗️\n\n` +
        `📌 *Active project:* ${currentProject.name}\n\n` +
        `What would you like to log?\n\n` +
        `💰 *Expense:* "Bought cement for 400,000"\n` +
        `📦 *Materials:* "Received 50 bags cement"\n` +
        `👷 *Workers:* "8 workers on site today"\n` +
        `📊 *Budget:* "How much have we spent?"\n` +
        `📸 Send a receipt photo or voice note\n\n` +
        `Say *"switch project"* to change projects\n` +
        `Say *"menu"* to see all commands`
    );
    return;
  }

  if (allProjects && allProjects.length > 1) {
    const list = allProjects.map((p: any, i: number) => `${i + 1}. ${p.name}`).join('\n');
    await sendMessage(
      from,
      `${hi} Welcome back to *JengaTrack* 🏗️\n\n` +
        `You have *${allProjects.length} projects*.\n` +
        `Which one are you updating today?\n\n` +
        `${list}\n\n` +
        `Reply with the number (e.g. "1")`
    );
    return;
  }

  await sendMessage(
    from,
    `${hi} Welcome to *JengaTrack* 🏗️\n\n` +
      `I help you track your construction project via WhatsApp — expenses, materials, workers, progress — all in one place.\n\n` +
      `Ready to set up your project?\n\n` +
      `1. 🏗️ Create a new project\n` +
      `2. ℹ️ Learn more\n\n` +
      `Reply *"1"* to get started!`
  );
}

async function handleExpenseLog(
  from: string,
  userId: string,
  projectId: string,
  extracted: Record<string, unknown>,
  rawMessage: string
): Promise<void> {
  let amount = typeof extracted.amount === 'number' ? extracted.amount : 0;
  let item = String(extracted.item || '').trim();
  let quantity = typeof extracted.quantity === 'number' ? extracted.quantity : 0;
  let unit = String(extracted.unit || '').trim();
  let vendor = String(extracted.vendor || '').trim();

  // Regex fallback for quantity
  if (!quantity) {
    const qm = rawMessage.match(/(\d+(?:,\d{3})*)\s*(bags?|kg|tons?|pieces?|trips?|units?)/i);
    if (qm) { quantity = parseFloat(qm[1].replace(/,/g, '')); unit = unit || qm[2].toLowerCase(); }
  }

  // If quantity + item but no price → ask for price
  if ((!amount || amount <= 0) && quantity > 0 && item) {
    await updateExpenseState(userId, 'awaiting_price', { quantity, item, unit: unit || 'units', project_id: projectId, vendor });
    await sendMessage(from, `Got it! ${quantity} ${unit || 'units'} of *${item}*${vendor ? ` from ${vendor}` : ''}.\n\nWhat was the total cost? (e.g. 1,900,000 UGX)`);
    return;
  }

  if (!amount || amount <= 0) {
    await sendMessage(from, `I need the amount. Try:\n"Bought cement for 200,000 UGX"\n"Paid plumber 150k"\n"Spent 500,000 on steel rods"`);
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

  let confirmMsg = `Got it! 🧱\n\n` +
    `📦 ${description}\n` +
    (vendor ? `🏪 Vendor: ${vendor}\n` : '') +
    `💰 Total: ${fmt(amount)} UGX` +
    (quantity > 0 ? `\n📊 Per ${unit || 'unit'}: ${fmt(amount / quantity)} UGX` : '') +
    `\n\nLooks good?`;

  if (anomalyAlert) confirmMsg = `${anomalyAlert}\n\n${confirmMsg}`;

  await sendOptions(from, confirmMsg, ['✅ Yes – Log it', '✏️ Edit', '❌ Cancel']);
}

async function handleMaterialLog(
  from: string,
  projectId: string,
  extracted: Record<string, unknown>,
  rawMessage: string
): Promise<void> {
  let item = String(extracted.item || '').trim();
  let qty = typeof extracted.quantity === 'number' ? extracted.quantity : parseFloat(String(extracted.quantity || '0')) || 0;
  let unit = String(extracted.unit || 'units').trim();
  let action = String(extracted.action || 'bought').toLowerCase();
  let vendor = String(extracted.vendor || '').trim();

  // Fallback regex
  const qm = rawMessage.match(/(\d+(?:,\d+)*)\s*(bags?|kg|tons?|pieces?|trips?|units?)\s+(?:of\s+)?([a-z\s]+)/i);
  if (qm) {
    if (!qty) qty = parseFloat(qm[1].replace(/,/g, ''));
    if (!item) item = qm[3].trim();
    if (!unit || unit === 'units') unit = qm[2].toLowerCase();
  }
  if (/used|consumed|for\s+foundation|for\s+/i.test(rawMessage)) action = 'used';

  if (!item) item = 'material';
  if (!qty || qty <= 0) qty = 1;

  const materialName = item.toLowerCase().trim();
  const { data: existing } = await supabase
    .from('materials_inventory')
    .select('id, quantity')
    .eq('project_id', projectId)
    .eq('material_name', materialName)
    .maybeSingle();

  const delta = action === 'used' ? -Math.abs(qty) : Math.abs(qty);
  const newQty = Math.max(0, parseFloat(String(existing?.quantity || 0)) + delta);

  if (existing) {
    await supabase.from('materials_inventory')
      .update({ quantity: newQty, last_updated: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase.from('materials_inventory').insert({
      project_id: projectId,
      material_name: materialName,
      quantity: Math.max(0, newQty),
      unit,
    });
  }

  // Track vendor if buying
  if (action !== 'used' && vendor) await upsertVendor(projectId, vendor, 0);

  let reply = `✅ *Inventory updated*\n\n` +
    `📦 ${materialName}: ${action === 'used' ? `used ${qty}` : `added ${qty}`} ${unit}\n` +
    `📊 Current stock: *${newQty} ${unit}*`;

  // Low stock alert (threshold: less than 10% of what was last received, or absolute threshold)
  if (newQty <= 5 && action === 'used') {
    reply += `\n\n🚨 *Low stock alert!* Only ${newQty} ${unit} of ${materialName} remaining. Consider restocking soon.`;
  }

  await sendMessage(from, reply);
}

async function handleLaborLog(
  from: string,
  projectId: string,
  extracted: Record<string, unknown>,
  rawMessage: string
): Promise<void> {
  let workerCount = typeof extracted.worker_count === 'number'
    ? extracted.worker_count
    : parseInt(String(extracted.worker_count || '0'), 10) || 0;

  if (workerCount <= 0) {
    const m = rawMessage.match(/(\d+)\s*(workers?|people|men|casuals?|labou?rers?)/i);
    workerCount = m ? parseInt(m[1], 10) : 0;
  }

  if (workerCount <= 0) {
    await sendMessage(from, 'How many workers were on site today? e.g. "6 workers on site"');
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
  await sendMessage(from, `✅ *${workerCount} workers* logged for today.${anomalyMsg}`);
}

async function handleProgressUpdate(
  from: string,
  projectId: string,
  extracted: Record<string, unknown>,
  rawMessage: string
): Promise<void> {
  const note = String(extracted.note || rawMessage).trim();
  await upsertDailyLog(projectId, { notes: note });
  await sendMessage(from, `✅ Progress logged:\n"${note}"\n\nThis will appear on your dashboard timeline.`);
}

async function handleWeatherDelay(
  from: string,
  projectId: string,
  extracted: Record<string, unknown>,
  rawMessage: string
): Promise<void> {
  const reason = String(extracted.reason || rawMessage).trim();
  await upsertDailyLog(projectId, { weather_condition: reason, notes: `Delay: ${reason}` });
  await sendMessage(from, `✅ Delay noted: "${reason}"\n\nThis has been added to your project timeline.`);
}

async function handleMaterialQuery(from: string, projectId: string): Promise<void> {
  const { data: materials } = await supabase
    .from('materials_inventory')
    .select('material_name, quantity, unit')
    .eq('project_id', projectId)
    .order('material_name');

  if (!materials || materials.length === 0) {
    await sendMessage(from, 'No materials in inventory yet.\n\nLog some with:\n"Received 50 bags cement from Hima Hardware"');
    return;
  }

  const lines = materials.map((m) => `• ${m.material_name}: *${m.quantity} ${m.unit || 'units'}*`).join('\n');
  await sendMessage(from, `📦 *Current Inventory:*\n\n${lines}\n\nView full details on your dashboard.`);
}

// ─── SMART_QUERY: free-form questions over historical data ─────────────────────

async function handleSmartQuery(from: string, projectId: string, question: string): Promise<void> {
  await sendMessage(from, '🔍 Looking up your data…');

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
  };

  const systemPrompt = `You are a construction project financial assistant for JengaTrack. Answer the user's question using ONLY the provided project data. Use UGX for all amounts. Be concise and friendly (2-4 short paragraphs max). If the data does not contain enough information to answer, say so clearly. Do not make up numbers. Format numbers with commas (e.g. 1,500,000 UGX).`;

  const userMessage = `Project data (JSON):\n${JSON.stringify(dataContext)}\n\nUser question: "${question}"\n\nProvide a direct, helpful answer based on the data above.`;

  let answer: string | null = null;

  if (process.env.OPENAI_API_KEY) {
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

  if (!answer && gemini && process.env.GEMINI_API_KEY) {
    try {
      const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent([systemPrompt, userMessage]);
      answer = result.response.text()?.trim() || null;
      if (answer) console.log('[SmartQuery] Gemini success');
    } catch (err: any) {
      console.error('[SmartQuery] Gemini failed:', err?.message);
    }
  }

  if (answer) {
    await sendMessage(from, answer);
  } else {
    await sendMessage(
      from,
      "I couldn't generate an answer right now. Try asking something like:\n• \"How much did I spend on cement last month?\"\n• \"What was my biggest expense in January?\"\n• \"Compare spending this month vs last month\""
    );
  }
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
    const activityDot = hadActivity ? '🟢' : '🔴';

    let msg = `🌆 *Daily Heartbeat — ${project.name}*\n\n` +
      `${activityDot} Site activity today: ${hadActivity ? 'Yes' : 'No updates received'}\n`;
    if (todayLog?.worker_count) msg += `👷 Workers: ${todayLog.worker_count}\n`;
    if (dailySpend > 0) msg += `💰 Spent today: ${fmt(dailySpend)} UGX\n`;
    if (todayLog?.notes) msg += `📝 Update: "${todayLog.notes}"\n`;
    msg += `\n📊 Total spent: ${fmt(totalSpent)} UGX / ${fmt(budget)} UGX (${pct}%)`;
    if (!hadActivity) msg += `\n\n⚠️ No updates from site today. Consider following up with your manager.`;
    msg += `\n\nFull dashboard: ${DASHBOARD_URL}`;

    await sendMessage(`whatsapp:${owner.whatsapp_number}`, msg);
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
      await updateOnboardingState(profile.id, 'welcome_sent');
      await sendWelcomeMessage(From, profile.full_name);
      res.setHeader('Content-Type', 'text/xml');
      return res.status(200).send(twimlOk);
    }

    const userId = profile.id;
    const onboardingState = profile.onboarding_state as OnboardingState;
    const needsOnboarding = !profile.onboarding_completed_at;

    // "Start over" — reset onboarding cleanly without creating duplicate profile
    if (/start\s*over|startover/i.test(rawMessage.trim())) {
      await supabase.from('profiles').update({
        onboarding_state: null,
        onboarding_data: {},
        onboarding_completed_at: null,
        expense_state: null,
        expense_pending_data: {},
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
              await sendMessage(From, `⚠️ Couldn't create the project.\n\nError: ${err.message}\n\nType "start over" to try again.`);
            }
          } else if (message.includes('2') || /edit/i.test(message)) {
            await updateOnboardingState(userId, 'welcome_sent', {});
            await sendWelcomeMessage(From, profile.full_name);
          } else {
            await updateOnboardingState(userId, 'completed');
            await sendMessage(From, 'No problem! Create a project from the dashboard anytime.\n\nYou can still send me updates and I\'ll log them.');
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

    // Handle reply to "Which project?" menu (BEFORE intent classification)
    if (expenseState === 'awaiting_project_selection') {
      const options = pendingData.project_options || [];
      const selection = parseInt(rawMessage.trim(), 10);
      const nameMatch = options.findIndex(
        (p: any) => message.toLowerCase().includes(String(p.name).toLowerCase().split(' ')[0])
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

        await sendMessage(
          From,
          `✅ Got it! Logging updates to:\n*${selectedProject.name}*` +
            (selectedProject.location && selectedProject.location !== 'No location'
              ? ` — ${selectedProject.location}`
              : '') +
            `\n\nSend your first update now or type "switch project" to change projects.`
        );
        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(twimlOk);
      } else {
        const projectList = options.map((p: any, i: number) => `${i + 1}. ${p.name}`).join('\n');
        await sendMessage(From, `Please reply with a number:\n\n${projectList}`);
        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(twimlOk);
      }
    }

    // Get active project (or require selection for multi-project users)
    const { project, needsSelection, projects } = await getActiveProject(userId, profile);

    if (needsSelection) {
      await sendProjectSelectionMenu(From, userId, projects);
      res.setHeader('Content-Type', 'text/xml');
      return res.status(200).send(twimlOk);
    }

    // Check for "switch project" command (before classifyIntent)
    if (/switch\s*project|change\s*project|select\s*project/i.test(rawMessage)) {
      if (projects.length <= 1) {
        await sendMessage(
          From,
          `You only have one active project: *${projects[0]?.name || 'None'}*`
        );
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

    // Help / menu — full list of commands (no AI needed)
    if (/^(help|menu|commands)$/i.test(rawMessage.trim())) {
      const helpText =
        `📋 *JengaTrack – All commands*\n\n` +
        `💰 *Expenses:* "Bought 50 bags cement for 1,900,000" or "Paid plumber 150k"\n` +
        `📦 *Materials in:* "Received 50 bags cement from Hima"\n` +
        `📦 *Materials used:* "Used 5 bags cement today"\n` +
        `👷 *Workers:* "8 workers on site today"\n` +
        `📊 *Progress:* "Foundation 80% complete" or "Finished ring beam"\n` +
        `🌧️ *Weather delay:* "Heavy rain, no work today"\n` +
        `📊 *Budget:* "How much have we spent?" or "What's left in budget?"\n` +
        `🔍 *Ask anything:* "How much did I spend on cement last month?" or "Compare spending this month vs last month"\n` +
        `📦 *Stock:* "How much cement do we have?"\n` +
        `📸 *Receipt:* Send a photo → I'll extract vendor & amount\n` +
        `🎙️ *Voice:* Send a voice note → I'll transcribe and process\n\n` +
        `*Other:* "Switch project" to change project • "Start over" to reset onboarding`;
      await sendMessage(From, helpText);
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
          await sendMessage(From, `🚩 Flagged "${lastExpense.description}" (${fmt(parseFloat(lastExpense.amount))} UGX) as disputed on the dashboard.`);
        } else {
          await sendMessage(From, 'No recent expense to dispute.');
        }
        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(twimlOk);
      }
      if (!isManager && !isOwner) {
        await sendMessage(From, 'Only the project manager can log updates in this group.');
        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(twimlOk);
      }
    }

    // ── STEP 5: Handle media ──────────────────────────────────────────────────
    if (hasMedia && MediaUrl0) {
      if (isVoiceNote) {
        await sendMessage(From, '🎙️ Voice note received! Transcribing...');
        const transcribed = await processVoiceNote(MediaUrl0);
        if (transcribed) {
          await sendMessage(From, `📝 I heard: "${transcribed}"\n\nProcessing this now...`);
          const { intent, extracted } = await classifyIntent(transcribed, phoneNumber);
          if (!project) {
            await sendMessage(From, 'You need a project first. Type "hey jenga" to create one.');
          } else {
            await routeIntent(intent, extracted, transcribed, From, userId, project, profile, projects || []);
          }
        } else {
          await sendMessage(From, `Couldn't transcribe that voice note. Try speaking clearly or type your update instead.`);
        }
        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(twimlOk);
      }

      if (isImage && project) {
        await processReceiptPhoto(From, userId, project.id, MediaUrl0);
        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(twimlOk);
      }

      // Video or other media — save as progress photo
      if (project) {
        await upsertDailyLog(project.id, { photo_urls: [MediaUrl0] });
        await sendMessage(From, '📸 Photo/video saved to your progress feed on the dashboard!');
      }
      res.setHeader('Content-Type', 'text/xml');
      return res.status(200).send(twimlOk);
    }

    // ── STEP 6: Handle awaiting_confirmation ──────────────────────────────────
    if (expenseState === 'awaiting_confirmation' && pendingData.project_id) {
      if (message.includes('1') || /yes|ok|✅|log it|confirm/i.test(message)) {
        console.log('[Expense Insert] Attempting:', {
          user_id: userId,
          project_id: pendingData.project_id,
          description: pendingData.description,
          amount: String(pendingData.amount),
          supabaseUrl: process.env.SUPABASE_URL?.substring(0, 30),
        });

        const { error: insertError } = await supabase
          .from('expenses')
          .insert({
            user_id: userId,
            project_id: pendingData.project_id,
            description: pendingData.description || 'Expense',
            amount: String(pendingData.amount),
            quantity_logged: pendingData.quantity ? String(pendingData.quantity) : null,
            currency: 'UGX',
            expense_date: new Date().toISOString().split('T')[0],
            source: 'whatsapp',
          });

        if (insertError) {
          console.error('[Expense Insert] FAILED:', {
            error: insertError.message,
            code: insertError.code,
            details: insertError.details,
            hint: insertError.hint,
          });
          await sendMessage(
            From,
            `⚠️ Could not save expense.\nError: ${insertError.message}\n\nPlease try again.`
          );
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
        await updateExpenseState(userId, null, {});
        await sendMessage(
          From,
          `✅ *Logged!*\n\n${pendingData.description}\n💰 ${fmt(pendingData.amount!)} UGX\n\nYour dashboard and budget have been updated.`
        );
      } else if (message.includes('2') || /edit|✏️/i.test(message)) {
        await updateExpenseState(userId, null, {});
        await sendMessage(From, 'No problem! Send the corrected details.');
      } else if (message.includes('3') || /cancel|❌/i.test(message)) {
        await updateExpenseState(userId, null, {});
        await sendMessage(From, 'Cancelled. Send a new update anytime.');
      } else {
        await sendOptions(From, `Still waiting for your reply on:\n${pendingData.description} — ${fmt(pendingData.amount || 0)} UGX`, ['✅ Yes – Log it', '✏️ Edit', '❌ Cancel']);
      }
      res.setHeader('Content-Type', 'text/xml');
      return res.status(200).send(twimlOk);
    }

    // ── STEP 7: Handle awaiting_price ─────────────────────────────────────────
    if (expenseState === 'awaiting_price' && pendingData.quantity && pendingData.item) {
      const priceMatch = rawMessage.replace(/,/g, '').match(/\d+(?:\.\d{2})?/);
      const mMatch = rawMessage.match(/(\d+(?:\.\d+)?)\s*[Mm]/);
      const price = mMatch
        ? parseFloat(mMatch[1]) * 1_000_000
        : priceMatch ? parseFloat(priceMatch[0]) : null;

      if (price !== null && price > 0) {
        const { quantity, unit, item, vendor } = pendingData;
        const unitPrice = Math.round(price / quantity!);
        const description = `${quantity} ${unit || 'units'} of ${item}`;

        const anomalyAlert = await checkPriceAnomaly(pendingData.project_id!, item!, price, quantity!);

        await updateExpenseState(userId, 'awaiting_confirmation', {
          ...pendingData, amount: price, unit_price: unitPrice, description,
        });

        let confirmMsg = `Got it! 🧱\n\n` +
          `📦 ${description}\n` +
          (vendor ? `🏪 Vendor: ${vendor}\n` : '') +
          `💰 Total: ${fmt(price)} UGX\n` +
          `📊 Per ${unit || 'unit'}: ${fmt(unitPrice)} UGX\n\n` +
          `Looks good?`;
        if (anomalyAlert) confirmMsg = `${anomalyAlert}\n\n${confirmMsg}`;

        await sendOptions(From, confirmMsg, ['✅ Yes – Log it', '✏️ Edit', '❌ Cancel']);
      } else {
        await sendMessage(From, 'Please send the total cost as a number (e.g. 1,900,000 or 1.9M).');
      }
      res.setHeader('Content-Type', 'text/xml');
      return res.status(200).send(twimlOk);
    }

    // ── STEP 8: No project → prompt ───────────────────────────────────────────
    if (!project) {
      await sendMessage(From, 'You need a project first. Say "hey jenga" or "start" to create one!');
      res.setHeader('Content-Type', 'text/xml');
      return res.status(200).send(twimlOk);
    }

    // ── STEP 9: GPT-4o-mini intent classification + routing ───────────────────
    const { intent, extracted } = await classifyIntent(rawMessage, phoneNumber);
    console.log('[Intent]', intent, JSON.stringify(extracted));
    await routeIntent(intent, extracted, rawMessage, From, userId, project, profile, projects || []);

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

async function routeIntent(
  intent: IntentType,
  extracted: Record<string, unknown>,
  rawMessage: string,
  from: string,
  userId: string,
  project: any,
  profile: any,
  projects: any[]
): Promise<void> {
  switch (intent) {
    case 'BUDGET_QUERY':
      await handleBudgetQuery(from, project.id);
      break;
    case 'EXPENSE_LOG':
      await handleExpenseLog(from, userId, project.id, extracted, rawMessage);
      break;
    case 'MATERIAL_LOG':
      await handleMaterialLog(from, project.id, extracted, rawMessage);
      break;
    case 'LABOR_LOG':
      await handleLaborLog(from, project.id, extracted, rawMessage);
      break;
    case 'PROGRESS_UPDATE':
      await handleProgressUpdate(from, project.id, extracted, rawMessage);
      break;
    case 'WEATHER_DELAY':
      await handleWeatherDelay(from, project.id, extracted, rawMessage);
      break;
    case 'MATERIAL_QUERY':
      await handleMaterialQuery(from, project.id);
      break;
    case 'SMART_QUERY':
      await handleSmartQuery(from, project.id, rawMessage);
      break;
    case 'GREETING':
    default:
      await handleGreeting(from, profile, project, projects);
  }
}