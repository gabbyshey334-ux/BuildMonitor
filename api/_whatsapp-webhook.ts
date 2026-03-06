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
  | 'SWITCH_PROJECT'
  | 'LIST_PROJECTS'
  | 'BUDGET_UPDATE'
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

async function ai(prompt: string, fallback: string, maxTokens = 200): Promise<string> {
  if (gemini && process.env.GEMINI_API_KEY) {
    try {
      const model = gemini.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
      const result = await model.generateContent(
        `You are JengaTrack, a WhatsApp construction assistant for African building projects. Be warm, practical, and concise. Plain text only. No markdown. Under 4 lines.\n\n${prompt}`
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
          {
            role: 'system',
            content: 'You are JengaTrack, a WhatsApp construction assistant for African building projects. Be warm, practical, concise. Plain text only. No markdown. Under 4 lines.',
          },
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

        const { data: existing } = await supabase
          .from('materials_inventory')
          .select('id, quantity')
          .eq('project_id', projectId)
          .eq('material_name', materialName)
          .maybeSingle();

        const newQty = parseFloat(String(existing?.quantity || 0)) + qty;

        if (existing) {
          await supabase.from('materials_inventory')
            .update({ quantity: newQty, last_updated: new Date().toISOString() })
            .eq('id', existing.id);
        } else {
          await supabase.from('materials_inventory').insert({
            project_id: projectId,
            material_name: materialName,
            quantity: qty,
            unit: item.unit || 'units',
          });
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
    const mMatch = message.match(/(\d+(?:\.\d+)?)\s*[Mm](?:illion)?/i);
    const bMatch = message.match(/(\d+(?:\.\d+)?)\s*[Bb](?:illion)?/i);
    const numMatch = message.match(/(\d+(?:,\d{3})*)/);
    const isAdd = /add|increase|plus|more/i.test(m);
    let amount = 0;
    if (mMatch) amount = parseFloat(mMatch[1]) * 1_000_000;
    else if (bMatch) amount = parseFloat(bMatch[1]) * 1_000_000_000;
    else if (numMatch) amount = parseFloat(numMatch[1].replace(/,/g, ''));
    return { intent: 'BUDGET_UPDATE', extracted: { amount, action: isAdd ? 'add' : 'set' } };
  }

  // MATERIAL_QUERY — inventory/stock questions (before generic budget query)
  if (/how much|how many|do (i|we) have|in.*inventory|current stock|stock.*left|remaining.*material/i.test(m) && !/budget|spent|expense|cost/i.test(m)) {
    return { intent: 'MATERIAL_QUERY', extracted: {} };
  }

  // SWITCH_PROJECT — must be before greeting check so it's always caught
  if (/switch|change project|other project|different project|wanna switch|want to switch/i.test(m)) {
    return { intent: 'SWITCH_PROJECT', extracted: {} };
  }

  if (/list.*project|my project|show.*project|all.*project|project.*list|what project/i.test(m)) {
    return { intent: 'LIST_PROJECTS', extracted: {} };
  }
  if (/update.*dashboard|log.*expense|add.*expense|record|log something|what can|what do/i.test(m)) {
    return { intent: 'GREETING', extracted: {} };
  }

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
    'BUDGET_QUERY', 'MATERIAL_QUERY', 'BUDGET_UPDATE', 'WEATHER_DELAY', 'SMART_QUERY', 'LIST_PROJECTS', 'GREETING',
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

  const msg = await ai(
    `Give the user a natural budget summary for their project:
    Total spent: ${fmt(totalSpent)} UGX
    Budget: ${fmt(budget)} UGX
    Used: ${pct}%
    Remaining: ${fmt(remaining)} UGX
    ${weeksLeft !== null ? 'At current rate: ~' + weeksLeft + ' weeks of budget left' : ''}
    ${pct > 80 ? 'IMPORTANT: Warn them they have used over 80% of budget!' : ''}
    Be conversational, not just a list of numbers.`,
    `Budget summary: Spent: ${fmt(totalSpent)} UGX | Budget: ${fmt(budget)} UGX | Used: ${pct}% | Remaining: ${fmt(remaining)} UGX`
  );
  await sendMessage(from, msg);
}

async function handleGreeting(
  from: string,
  profile: any,
  currentProject?: any,
  allProjects?: any[],
  rawMessage?: string
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

  const systemPrompt = `You are JengaTrack, a smart WhatsApp assistant for construction site management in Uganda/Africa.

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
    const msg = await ai(
      `Tell the user you got it: ${quantity} ${unit || 'units'} of ${item}${vendor ? ' from ' + vendor : ''}. Ask them what the total cost was. Give an example: 1,900,000 UGX.`,
      `Got it! ${quantity} ${unit || 'units'} of ${item}${vendor ? ' from ' + vendor : ''}. What was the total cost? (e.g. 1,900,000 UGX)`
    );
    await sendMessage(from, msg);
    return;
  }

  if (!amount || amount <= 0) {
    await sendMessage(from, await ai(
      'Tell the user you need the amount. Give examples: Bought cement for 200,000 UGX, Paid plumber 150k, Spent 500,000 on steel rods.',
      'I need the amount. Try: "Bought cement for 200,000 UGX" or "Paid plumber 150k"'
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
    `${description} — ${fmt(amount)} UGX${vendor ? ' from ' + vendor : ''}. Save it?\n\n1. Yes\n2. Edit\n3. Cancel`
  );
  const confirmMsg = anomalyAlert ? `${anomalyAlert}\n\n${msg}` : msg;
  await sendMessage(from, confirmMsg);
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
  const action = String(extracted.action || 'bought').toLowerCase();
  const vendor = String(extracted.vendor || '').trim();

  const qm = rawMessage.match(/(\d+(?:,\d+)*)\s*(bags?|kg|tons?|pieces?|trips?|units?)\s+(?:of\s+)?([a-z\s]+)/i);
  if (qm) {
    if (!qty) qty = parseFloat(qm[1].replace(/,/g, ''));
    if (!item) item = qm[3].trim();
    if (!unit || unit === 'units') unit = qm[2].toLowerCase();
  }
  const effectiveAction = /used|consumed|for\s+foundation|for\s+/i.test(rawMessage) ? 'used' : action;

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
  if (!qty || qty <= 0) qty = 1;

  // Get all existing materials for fuzzy matching
  const { data: allMaterials } = await supabase
    .from('materials_inventory')
    .select('id, material_name, quantity, unit')
    .eq('project_id', projectId);

  let materialName = item.toLowerCase().trim() || 'material';

  if (allMaterials && allMaterials.length > 0 && materialName !== 'material') {
    const fuzzyMatch = allMaterials.find((m: any) =>
      m.material_name === materialName ||
      m.material_name.includes(materialName) ||
      materialName.includes(m.material_name) ||
      materialName.split(' ').some((word: string) =>
        word.length > 3 && m.material_name.includes(word)
      )
    );
    if (fuzzyMatch) {
      console.log('[MaterialLog] Fuzzy matched:', materialName, '→', fuzzyMatch.material_name);
      materialName = fuzzyMatch.material_name;
    }
  }

  const { data: existing } = await supabase
    .from('materials_inventory')
    .select('id, quantity')
    .eq('project_id', projectId)
    .eq('material_name', materialName)
    .maybeSingle();

  const delta = effectiveAction === 'used' ? -Math.abs(qty) : Math.abs(qty);
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

  if (effectiveAction !== 'used' && vendor) await upsertVendor(projectId, vendor, 0);

  const msg = await ai(
    `Tell the user their materials inventory was updated:
    Material: ${materialName}
    Action: ${effectiveAction === 'used' ? 'used ' + qty : 'added ' + qty} ${unit}
    Current stock: ${newQty} ${unit}
    ${newQty <= 5 && effectiveAction === 'used' ? 'IMPORTANT: Warn them stock is critically low at only ' + newQty + ' ' + unit + ' remaining.' : ''}
    Tell them to check Materials & Supplies page.`,
    `Inventory updated — ${materialName}: ${newQty} ${unit} remaining. Check Materials & Supplies page.`
  );
  await sendMessage(from, msg);
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
    await sendMessage(from, await ai(
      'Ask the user how many workers were on site today. Give an example: "6 workers on site".',
      'How many workers were on site today? e.g. "6 workers on site"'
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
    `${workerCount} workers logged for today. Check Daily Accountability page.`
  );
  await sendMessage(from, msg);
}

async function handleProgressUpdate(
  from: string,
  projectId: string,
  extracted: Record<string, unknown>,
  rawMessage: string
): Promise<void> {
  const taskLines = rawMessage
    .split('\n')
    .map((l: string) => l.replace(/^[\d\.\-\*\•]\s*/, '').trim())
    .filter((l: string) =>
      l.length > 5 &&
      !/^(i completed|following tasks|tasks today|completed today)/i.test(l)
    );

  const today = new Date().toISOString().split('T')[0];

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
    await upsertDailyLog(projectId, { notes: taskLines.join('\n') });
    const msg = await ai(
      `Tell the user their progress update was logged: ${taskLines.length} tasks: ${taskLines.join(', ')}. Tell them it will appear on their dashboard timeline. Keep it brief and encouraging.`,
      `Logged ${taskLines.length} completed tasks. Check your dashboard timeline.`
    );
    await sendMessage(from, msg);
  } else {
    const note = String(extracted.note || rawMessage).trim();
    await upsertDailyLog(projectId, { notes: note });

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
      `Progress logged: "${note}". Check your dashboard timeline.`
    );
    await sendMessage(from, msg);
  }
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

async function handleMaterialQuery(from: string, projectId: string): Promise<void> {
  const { data: materials } = await supabase
    .from('materials_inventory')
    .select('material_name, quantity, unit')
    .eq('project_id', projectId)
    .order('material_name');

  if (!materials || materials.length === 0) {
    const msg = await ai(
      'Tell the user there are no materials in inventory yet. Give an example: "Received 50 bags cement from Hima".',
      'No materials in inventory yet. Log received stock like: "Received 50 bags cement from Hima"'
    );
    await sendMessage(from, msg);
    return;
  }

  const lines = materials.map((m: any) =>
    `• ${m.material_name}: ${m.quantity} ${m.unit || 'units'}`
  ).join('\n');

  const msg = await ai(
    `Show the user their current inventory:\n${lines}\nThen tell them they can send "Used X bags cement" to update stock. Be brief.`,
    `Current inventory:\n\n${lines}\n\nSend "Used X bags cement" to update stock.`
  );
  await sendMessage(from, msg);
}

// ─── SMART_QUERY: free-form questions over historical data ─────────────────────

async function handleSmartQuery(from: string, projectId: string, question: string): Promise<void> {
  await sendMessage(from, await ai(
    'Tell the user you are looking up their data. One short line.',
    'Looking up your data…'
  ));

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
    .select('material_name, quantity, unit, last_updated')
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
      name: m.material_name,
      currentStock: m.quantity,
      unit: m.unit || 'units',
      lastUpdated: m.last_updated,
    })),
  };

  const systemPrompt = `You are a construction project financial assistant for JengaTrack. Answer the user's question using ONLY the provided project data. Use UGX for all amounts. Be concise and friendly (2-4 short paragraphs max). For inventory questions use materialsInventory.currentStock. For purchase history check expenses descriptions. Always give a direct answer with the number if data exists. Never say you cannot find information if it is in the data. Do not make up numbers. Format numbers with commas (e.g. 1,500,000 UGX).`;

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
    const { project, needsSelection, projects } = await getActiveProject(userId, profile);

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
        'Give me a quick overview of everything you can help me with on this project.');
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
            await routeIntent(intent, extracted, transcribed, From, userId, project, profile, projects || []);
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
          await sendMessage(From, await ai(
            'Tell the user their photo was saved to their site progress feed on the dashboard. One short line.',
            'Photo saved to your site progress feed on the dashboard!'
          ));
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
        console.log('[Expense Insert] Attempting:', {
          user_id: userId,
          project_id: pendingData.project_id,
          description: pendingData.description,
          amount: String(pendingData.amount),
          supabaseUrl: process.env.SUPABASE_URL?.substring(0, 30),
        });

        const { data: insertedExpense, error: insertError } = await supabase
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
          })
          .select()
          .single();

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
        await updateExpenseState(userId, null, {});
        const msg = await ai(
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
          await routeIntent(lineResult.intent, lineResult.extracted, line, From, userId, project, profile, projects || []);
          processedCount++;
        }
      }
      if (processedCount > 0) {
        console.log('[MultiIntent] Processing', processedCount, 'lines');
        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(twimlOk);
      }
    }

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
  projects: any[]
): Promise<void> {
  switch (intent) {
    case 'BUDGET_QUERY':
      await handleBudgetQuery(from, project.id);
      break;
    case 'BUDGET_UPDATE':
      await handleBudgetUpdate(from, project.id, extracted);
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
    case 'LIST_PROJECTS':
      await handleListProjects(from, userId);
      break;
    case 'GREETING':
    default:
      if (rawMessage.trim().length > 15 && project) {
        await handleSmartQuery(from, project.id, rawMessage);
      } else {
        await handleGreeting(from, profile, project, projects, rawMessage);
      }
      break;
  }
}