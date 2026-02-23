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
import fetch from 'node-fetch';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

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

type ExpenseState = null | 'awaiting_price' | 'awaiting_confirmation';

interface ExpensePendingData {
  quantity?: number;
  item?: string;
  unit?: string;
  amount?: number;
  unit_price?: number;
  description?: string;
  project_id?: string;
  vendor?: string;
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
    .select('*')
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
    // Handle "150M" or "150,000,000"
    const mMatch = body.match(/(\d+(?:\.\d+)?)\s*[Mm]/);
    const numMatch = body.match(/(\d+(?:,\d{3})*(?:\.\d{2})?)/);
    if (mMatch) budget = parseFloat(mMatch[1]) * 1_000_000;
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
  const { data: profile } = await supabase.from('profiles').select('onboarding_data').eq('id', userId).single();
  const d = (profile?.onboarding_data as OnboardingData) || {};
  const typeLabel = d.project_type === 'btn_residential' ? 'Residential home'
    : d.project_type === 'btn_commercial' ? 'Commercial building' : 'Construction Project';
  const projectName = d.location ? `${typeLabel} - ${d.location}` : typeLabel;

  const { data: project, error } = await supabase.from('projects').insert({
    user_id: userId,
    name: projectName,
    description: `Started: ${d.start_date || 'TBD'}. Created via WhatsApp.`,
    budget_amount: d.budget ? d.budget.toString() : '0',
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

  try {
    // Download image and convert to base64 for OpenAI Vision
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
            {
              type: 'text',
              text: `This is a construction receipt. Extract all details and return ONLY valid JSON:
{
  "vendor": "shop or supplier name",
  "date": "date on receipt or null",
  "items": [{"name": "item name", "quantity": number_or_null, "unit": "unit_or_null", "amount": number_in_UGX}],
  "total": total_amount_in_UGX,
  "notes": "any other relevant info"
}
If amounts are in another currency, convert to UGX (1 USD ≈ 3700 UGX, 1 KES ≈ 28 UGX).`,
            },
          ],
        },
      ],
      max_tokens: 500,
    });

    const content = ocrResult.choices[0]?.message?.content?.trim() || '';
    let jsonStr = content;
    const codeMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeMatch) jsonStr = codeMatch[1].trim();

    const ocrData = JSON.parse(jsonStr);
    const total = ocrData.total || 0;
    const vendor = ocrData.vendor || 'Unknown vendor';
    const itemsList = (ocrData.items || [])
      .map((i: any) => `  • ${i.name}${i.quantity ? ` x${i.quantity}` : ''}: ${fmt(i.amount || 0)} UGX`)
      .join('\n');

    // Build confirmation
    const summary = `📋 Receipt scanned!\n\n` +
      `🏪 Vendor: ${vendor}\n` +
      `📅 Date: ${ocrData.date || 'Not visible'}\n` +
      `Items:\n${itemsList || '  • (unable to read items)'}\n` +
      `💰 Total: ${fmt(total)} UGX\n\n` +
      `Save this to your records?`;

    // Store pending OCR data so user can confirm
    await updateExpenseState(userId, 'awaiting_confirmation', {
      amount: total,
      description: `Receipt: ${vendor}${ocrData.items?.length ? ` (${ocrData.items.map((i: any) => i.name).join(', ')})` : ''}`,
      vendor,
      project_id: projectId,
    });

    await sendOptions(from, summary, ['✅ Yes – Save it', '✏️ Edit details', '❌ Cancel']);
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

    // Whisper expects a file-like object — use a Blob approach
    const blob = new Blob([buffer], { type: 'audio/ogg' });
    const file = new File([blob], 'voice.ogg', { type: 'audio/ogg' });

    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file,
      language: 'en',
    });

    return transcription.text || null;
  } catch (err: any) {
    console.error('[Whisper Error]', err);
    return null;
  }
}

// ─── Intent Classification (GPT-4o) ──────────────────────────────────────────

async function classifyIntent(message: string): Promise<IntentResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { intent: 'GREETING', extracted: {} };
  }

  const systemPrompt = `You are a construction site assistant for African building projects (Uganda/Kenya/Nigeria).
Classify the user message into exactly one intent and extract key data.

Intents:
- EXPENSE_LOG: reporting money spent ("bought cement for 200k", "paid plumber 150k")
- MATERIAL_LOG: reporting materials bought or used ("received 50 bags cement", "used 5 bags for foundation")
- LABOR_LOG: reporting workers on site ("6 workers today", "8 casuals on site")
- PROGRESS_UPDATE: milestone or progress ("foundation finished", "roof 80% done", "ring beam complete")
- BUDGET_QUERY: asking about spend or remaining budget ("how much spent?", "what's left?", "show budget")
- MATERIAL_QUERY: asking about inventory ("how much cement?", "what materials do we have?")
- WEATHER_DELAY: bad weather or delay ("heavy rain, couldn't work", "no work today, flooding")
- GREETING: general hello, unclear, or anything else

Return ONLY valid JSON, no other text:
{
  "intent": "INTENT_NAME",
  "extracted": {
    "item": "string (for EXPENSE_LOG, MATERIAL_LOG)",
    "amount": number_in_UGX_or_0,
    "quantity": number_or_0,
    "unit": "bags/kg/trips/pieces/etc",
    "action": "bought|used|received (for MATERIAL_LOG)",
    "vendor": "vendor or person name if mentioned",
    "worker_count": number_or_0,
    "note": "string (for PROGRESS_UPDATE)",
    "reason": "string (for WEATHER_DELAY)"
  }
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: 0.1,
      max_tokens: 300,
    });

    const content = completion.choices[0]?.message?.content?.trim() || '';
    let jsonStr = content;
    const codeMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeMatch) jsonStr = codeMatch[1].trim();

    const parsed = JSON.parse(jsonStr) as IntentResult;
    const validIntents: IntentType[] = [
      'EXPENSE_LOG', 'MATERIAL_LOG', 'LABOR_LOG', 'PROGRESS_UPDATE',
      'BUDGET_QUERY', 'MATERIAL_QUERY', 'WEATHER_DELAY', 'GREETING',
    ];
    if (validIntents.includes(parsed.intent)) return parsed;
  } catch (err) {
    console.error('[Intent] Classification failed:', err);
  }
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
    return `✅ *Good deal:* ${item} at ${fmt(unitPrice)} UGX/unit is *${Math.round(Math.abs(pctDiff)}% below* your recent average of ${fmt(avg)} UGX/unit.`;
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
    .from('projects').select('budget_amount, name').eq('id', projectId).single();
  const { data: expenses } = await supabase
    .from('expenses').select('amount').eq('project_id', projectId);

  const totalSpent = (expenses || []).reduce((s, e) => s + parseFloat(String(e.amount || 0)), 0);
  const budget = parseFloat(String(project?.budget_amount || 0));
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

async function handleGreeting(from: string): Promise<void> {
  await sendMessage(from,
    `👋 *JengaTrack Bot* — Here's what you can say:\n\n` +
    `💰 *Log expense:*\n"Bought 50 bags cement from Hima for 1,900,000"\n\n` +
    `📦 *Log materials:*\n"Used 5 bags cement for foundation"\n\n` +
    `👷 *Log workers:*\n"8 workers on site today"\n\n` +
    `🏗️ *Progress:*\n"Foundation 80% complete"\n\n` +
    `📊 *Check budget:*\n"How much have we spent?"\n\n` +
    `📦 *Check stock:*\n"How much cement do we have?"\n\n` +
    `🌧️ *Log delay:*\n"Heavy rain, no work today"\n\n` +
    `📸 Send a *receipt photo* and I'll scan it\n` +
    `🎙️ Send a *voice note* and I'll transcribe it`
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

// ─── Daily Heartbeat (called by a scheduled job at /api/daily-heartbeat) ──────
// Export this so it can be called from a separate serverless cron endpoint

export async function sendDailyHeartbeat(): Promise<void> {
  // Get all active projects
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, budget_amount, user_id')
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
    const budget = parseFloat(String(project.budget_amount || 0));
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

    // ── STEP 3: Get project ───────────────────────────────────────────────────
    const expenseState = (profile.expense_state as ExpenseState) ?? null;
    const pendingData = (profile.expense_pending_data as ExpensePendingData) || {};

    const { data: ownerProject } = await supabase.from('projects')
      .select('id, user_id, channel_type, manager_id, name')
      .eq('user_id', userId).eq('status', 'active')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    const { data: managerProject } = await supabase.from('projects')
      .select('id, user_id, channel_type, manager_id, name')
      .eq('manager_id', userId).eq('status', 'active')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    const project = ownerProject || managerProject;

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
          const { intent, extracted } = await classifyIntent(transcribed);
          if (!project) {
            await sendMessage(From, 'You need a project first. Type "hey jenga" to create one.');
          } else {
            await routeIntent(intent, extracted, transcribed, From, userId, project);
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
        try {
          await supabase.from('expenses').insert({
            user_id: userId,
            project_id: pendingData.project_id,
            description: pendingData.description || 'Expense',
            amount: String(pendingData.amount!),
            quantity_logged: pendingData.quantity ? String(pendingData.quantity) : null,
            currency: 'UGX',
            expense_date: new Date().toISOString().split('T')[0],
            source: 'whatsapp',
          });
          // Track vendor
          if (pendingData.vendor && pendingData.amount) {
            await upsertVendor(pendingData.project_id, pendingData.vendor, pendingData.amount);
          }
          await updateExpenseState(userId, null, {});
          await sendMessage(From,
            `✅ *Logged!*\n\n${pendingData.description}\n💰 ${fmt(pendingData.amount!)} UGX\n\nYour dashboard and budget have been updated.`
          );
        } catch (err: any) {
          console.error('[Expense Insert Error]', err);
          await sendMessage(From, 'Sorry, could not save. Please try again.');
        }
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

    // ── STEP 9: GPT-4o intent classification + routing ────────────────────────
    const { intent, extracted } = await classifyIntent(rawMessage);
    console.log('[Intent]', intent, JSON.stringify(extracted));
    await routeIntent(intent, extracted, rawMessage, From, userId, project);

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
  project: any
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
    case 'GREETING':
    default:
      await handleGreeting(from);
  }
}