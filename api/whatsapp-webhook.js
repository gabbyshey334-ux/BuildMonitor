import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fetch from "node-fetch";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });
const gemini = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
async function projectOwnerProfileId(projectId) {
  const { data, error } = await supabase.from("projects").select("user_id").eq("id", projectId).maybeSingle();
  if (error || !data?.user_id) {
    console.error("[projectOwnerProfileId]", error?.message || "missing user_id", projectId);
    return null;
  }
  return data.user_id;
}
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886";
const DASHBOARD_URL = process.env.DASHBOARD_URL || "https://build-monitor-lac.vercel.app";
const rateLimitMap = /* @__PURE__ */ new Map();
const recentMessagesMap = /* @__PURE__ */ new Map();
const DEDUP_WINDOW_MS = 3e4;
function checkDuplicateMessage(phoneNumber, message) {
  const key = `${phoneNumber}:${message.trim().toLowerCase().substring(0, 100)}`;
  const now = Date.now();
  const last = recentMessagesMap.get(key) ?? 0;
  if (now - last < DEDUP_WINDOW_MS) return true;
  recentMessagesMap.set(key, now);
  if (recentMessagesMap.size > 1e3) {
    const oldest = Math.min(...recentMessagesMap.values());
    for (const [k, v] of recentMessagesMap) {
      if (v < oldest + DEDUP_WINDOW_MS) recentMessagesMap.delete(k);
    }
  }
  return false;
}
function checkRateLimit(phoneNumber) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1e3;
  const maxCalls = 60;
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
const MATERIAL_KEYWORDS = [
  "cement",
  "sand",
  "gravel",
  "bricks",
  "iron bars",
  "steel",
  "timber",
  "wood",
  "poles",
  "tiles",
  "paint",
  "roofing",
  "pipes",
  "wire",
  "aggregate",
  "ballast",
  "blocks",
  "stone",
  "nails",
  "rebar",
  "hardcore",
  "murram"
];
const SKIP_KEYWORDS = [
  "labor",
  "labour",
  "transport",
  "service",
  "rent",
  "wage",
  "salary",
  "fee",
  "fuel",
  "petrol",
  "diesel",
  "machine",
  "machinery",
  "equipment",
  "hire"
];
const GARBAGE_MATERIAL_NAMES = ["material", "item", "thing", "stuff", "goods", "product", "units"];
function normalizeMaterialName(raw) {
  const s = String(raw || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!s) return "";
  return s.split(/\s+/).map((w) => {
    if (w.length < 2) return w;
    if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y";
    if (w.endsWith("s") && !w.endsWith("ss") && w.length >= 4) return w.slice(0, -1);
    return w;
  }).join(" ");
}
function parseQuantityFromDescription(desc) {
  const m = desc.match(/(\d+)\s*(bags?|tonnes?|pieces?|bars?|sheets?|litres?|rolls?)?/i);
  if (!m) return null;
  const quantity = parseInt(m[1], 10);
  const unit = m[2] || void 0;
  return { quantity: isNaN(quantity) ? 1 : quantity, unit };
}
async function logOutbound(userId, messageBody, projectId) {
  try {
    await supabase.from("whatsapp_messages").insert({
      user_id: userId,
      direction: "outbound",
      message_body: messageBody.substring(0, 4e3),
      processed: true,
      project_id: projectId ?? null
      // phone_number intentionally omitted — column is nullable, outbound msgs don't have one
    });
  } catch (err) {
    console.warn("[LogOutbound] Failed:", err?.message);
  }
}
async function sendMessage(to, message, userId, projectId) {
  try {
    const toNumber = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
    await withDeadline(
      twilioClient.messages.create({
        from: TWILIO_WHATSAPP_NUMBER,
        to: toNumber,
        body: message
      }),
      TWILIO_SEND_DEADLINE_MS,
      "twilio.messages.create"
    );
    if (userId) await logOutbound(userId, message, projectId);
  } catch (error) {
    console.error("[Twilio Send Error]", error);
    throw error;
  }
}
async function sendOptions(to, message, options, userId, projectId) {
  let text = message + "\n\n";
  options.forEach((opt, idx) => {
    text += `${idx + 1}. ${opt}
`;
  });
  await sendMessage(to, text, userId, projectId);
}
const fmt = (n) => new Intl.NumberFormat("en-UG").format(Math.round(n));
function escapeXml(text) {
  return String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function withDeadline(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      reject(Object.assign(new Error(`${label} timed out after ${ms}ms`), { code: "DEADLINE_EXCEEDED" }));
    }, ms);
    promise.then((v) => {
      clearTimeout(t);
      resolve(v);
    }).catch((e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}
const GEMINI_CALL_DEADLINE_MS = 14e3;
const OPENAI_AGENT_DEADLINE_MS = 14e3;
const TWILIO_SEND_DEADLINE_MS = 12e3;
function parseAmount(text) {
  const clean = text.replace(/,/g, "").trim();
  const bMatch = clean.match(/(\d+(?:\.\d+)?)\s*[Bb](?:illion)?/);
  const mMatch = clean.match(/(\d+(?:\.\d+)?)\s*[Mm](?:illion)?/);
  const kMatch = clean.match(/(\d+(?:\.\d+)?)\s*[Kk](?:$|\b)/);
  const numMatch = clean.match(/(\d+(?:\.\d+)?)/);
  if (bMatch) return parseFloat(bMatch[1]) * 1e9;
  if (mMatch) return parseFloat(mMatch[1]) * 1e6;
  if (kMatch) return parseFloat(kMatch[1]) * 1e3;
  if (numMatch) return parseFloat(numMatch[1]);
  return 0;
}
function detectLanguage(text) {
  const t = text.toLowerCase();
  if (/mpa|nze|nno|sseminti|emisumaali|okulunda|nsimba|abasajja|bajja|nfunyeyo|mugezi|hali|jangu|genda|kola|nkola|leeta|sente|eggulo|enkya/i.test(t)) return "Luganda";
  if (/habari|asante|karibu|ndio|hapana|bei|kazi|wafanyakazi/i.test(t)) return "Swahili";
  return "en";
}
async function ai(prompt, fallback, maxTokens = 300, lang) {
  const langInstruction = lang && lang !== "en" ? `The user wrote in ${lang}. You MUST respond in ${lang}, not English.` : "Respond in English unless the user wrote in another language.";
  const systemContent = `You are JengaTrack \u2014 a brilliant, warm WhatsApp construction assistant for African building projects. You combine the expertise of a senior site supervisor, quantity surveyor, and financial analyst. You are like Claude AI but specialized for construction.

Plain text only. No markdown asterisks (**), no bold, no bullet (*) symbols. Use dashes (-) for lists. WhatsApp displays asterisks as raw characters.
Never say "I am an AI" or "I cannot help with that". Never refuse a question.
Keep replies concise unless depth is genuinely needed.
${langInstruction}`;
  if (gemini && process.env.GEMINI_API_KEY) {
    for (const modelName of ["gemini-2.0-flash", "gemini-2.5-flash-lite"]) {
      try {
        const model = gemini.getGenerativeModel({ model: modelName, systemInstruction: systemContent });
        const result = await withDeadline(
          model.generateContent(prompt),
          GEMINI_CALL_DEADLINE_MS,
          `[AI Helper] Gemini ${modelName}`
        );
        const text = result.response.text().trim();
        if (text) return text;
      } catch (err) {
        console.error(`[AI Helper] Gemini ${modelName} failed:`, err?.message);
      }
    }
  }
  if (process.env.OPENAI_API_KEY) {
    try {
      const completion = await withDeadline(
        openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemContent },
            { role: "user", content: prompt }
          ],
          temperature: 0.7,
          max_tokens: maxTokens
        }),
        OPENAI_AGENT_DEADLINE_MS,
        "[AI Helper] OpenAI gpt-4o-mini"
      );
      const text = completion.choices[0]?.message?.content?.trim();
      if (text) return text;
    } catch (err) {
      console.error("[AI Helper] OpenAI failed:", err?.message);
    }
  }
  return fallback;
}
async function getUserProfile(phoneNumber) {
  const { data, error } = await supabase.from("profiles").select("*, active_project_id, active_project_set_at").eq("whatsapp_number", phoneNumber).single();
  if (error && error.code !== "PGRST116") console.error("[Supabase Error]", error);
  return data;
}
async function createUserProfile(phoneNumber) {
  const { data, error } = await supabase.from("profiles").insert({
    whatsapp_number: phoneNumber,
    email: `${phoneNumber.replace("+", "")}@whatsapp.local`,
    full_name: "WhatsApp User",
    default_currency: "UGX",
    preferred_language: "en",
    onboarding_state: null,
    onboarding_data: {}
  }).select().single();
  if (error) {
    console.error("[Create Profile Error]", error);
    throw error;
  }
  return data;
}
async function updateOnboardingState(userId, state, data) {
  const { data: profile } = await supabase.from("profiles").select("onboarding_data").eq("id", userId).single();
  const current = profile?.onboarding_data || {};
  const updated = { ...current, ...data };
  const payload = {
    onboarding_state: state,
    onboarding_data: updated,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (state === "completed") payload.onboarding_completed_at = (/* @__PURE__ */ new Date()).toISOString();
  const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
  if (error) {
    console.error("[Update State Error]", error);
    throw error;
  }
}
async function updateExpenseState(userId, state, data) {
  const { error } = await supabase.from("profiles").update({
    expense_state: state,
    expense_pending_data: data || {},
    expense_state_set_at: state ? (/* @__PURE__ */ new Date()).toISOString() : null,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("id", userId);
  if (error) {
    console.error("[Update Expense State Error]", error);
    throw error;
  }
}
async function clearPendingMaterialUpdate(userId) {
  const { error } = await supabase.from("profiles").update({
    pending_material_update: null,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("id", userId);
  if (error) console.error("[Clear Pending Material Error]", error);
}
async function setPendingMaterialUpdate(userId, data) {
  const { error } = await supabase.from("profiles").update({
    pending_material_update: data,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("id", userId);
  if (error) {
    console.error("[Set Pending Material Error]", error);
    throw error;
  }
}
async function getActiveProject(userId, profile) {
  const { data: ownedProjects } = await supabase.from("projects").select("id, name, description, status, channel_type, manager_id, user_id").eq("user_id", userId).eq("status", "active").order("created_at", { ascending: false });
  const { data: managedProjects } = await supabase.from("projects").select("id, name, description, status, channel_type, manager_id, user_id").eq("manager_id", userId).eq("status", "active").order("created_at", { ascending: false });
  const allProjects = [...ownedProjects || [], ...managedProjects || []].filter((p, i, self) => i === self.findIndex((t) => t.id === p.id));
  if (allProjects.length === 0) {
    return { project: null, needsSelection: false, projects: [] };
  }
  if (allProjects.length === 1) {
    if (profile.active_project_id !== allProjects[0].id) {
      await supabase.from("profiles").update({
        active_project_id: allProjects[0].id,
        active_project_set_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", userId);
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
async function sendProjectSelectionMenu(to, userId, projects) {
  await supabase.from("profiles").update({
    expense_state: "awaiting_project_selection",
    expense_pending_data: {
      project_options: projects.map((p) => ({
        id: p.id,
        name: p.name,
        location: p.description || "No location"
      }))
    }
  }).eq("id", userId);
  const projectList = projects.map((p, i) => `${i + 1}. ${p.name}` + (p.description ? ` \u2014 ${p.description}` : "")).join("\n");
  const msg = await ai(
    `Ask the user which project they are working on today. List these projects:
${projectList}
Tell them to reply with the number.`,
    `You have ${projects.length} active projects:

${projectList}

Which one are you updating today? Reply with the number.`
  );
  await sendMessage(to, msg);
}
async function sendWelcomeMessage(to, name) {
  const greeting = name && name !== "WhatsApp User" ? name.split(" ")[0] : null;
  const msg = await ai(
    `Welcome a new user named ${greeting || "a new user"} to JengaTrack. Tell them JengaTrack helps track construction expenses, materials, workers and progress via WhatsApp. Ask them what kind of project they are building. Give 3 short project type options numbered 1-3: residential home, commercial building, other.`,
    `Hey${greeting ? " " + greeting : ""}! Welcome to JengaTrack. I help you track your construction project via WhatsApp.

What kind of build is this?

1. Residential home
2. Commercial building
3. Other`
  );
  await sendMessage(to, msg);
}
async function handleProjectTypeSelection(userId, to, msg) {
  let projectType = "btn_other";
  if (msg.includes("1") || /residential|home/i.test(msg)) projectType = "btn_residential";
  else if (msg.includes("2") || /commercial|office|shop/i.test(msg)) projectType = "btn_commercial";
  await updateOnboardingState(userId, "awaiting_location", { project_type: projectType });
  const out = await ai(
    "Ask the user where their construction site is located. Keep it casual and short. Examples: Kampala Road, Plot 24 Mukono. Tell them they can skip.",
    'Great choice! Where is the site? (e.g. Kampala Road, Entebbe \u2014 or type "skip")'
  );
  await sendMessage(to, out);
}
async function handleLocationInput(userId, to, body) {
  const location = /skip/i.test(body) ? void 0 : body.trim();
  await updateOnboardingState(userId, "awaiting_start_date", { location });
  const out = await ai(
    "Ask the user when their construction project started. Keep it casual. Examples: Today, 15 Feb 2026. Tell them they can skip.",
    'When did the project start? (e.g. Today, 15 Feb 2026 \u2014 or "skip")'
  );
  await sendMessage(to, out);
}
async function handleStartDateInput(userId, to, body) {
  const start_date = /skip/i.test(body) ? void 0 : body.trim();
  await updateOnboardingState(userId, "awaiting_budget", { start_date });
  const out = await ai(
    "Ask the user what their total project budget is in UGX. Keep it casual. Examples: 150,000,000 or 150M. Tell them they can skip.",
    'What is the total project budget? (e.g. 150M UGX \u2014 or "skip")'
  );
  await sendMessage(to, out);
}
async function handleBudgetInput(userId, to, body) {
  let budget;
  if (!/skip/i.test(body)) {
    budget = parseAmount(body);
  }
  await updateOnboardingState(userId, "confirmation", { budget });
  await supabase.from("profiles").update({
    expense_state: null,
    expense_pending_data: {},
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("id", userId);
  const { data: profile } = await supabase.from("profiles").select("onboarding_data").eq("id", userId).single();
  const d = profile?.onboarding_data || {};
  const typeLabel = d.project_type === "btn_residential" ? "Residential home" : d.project_type === "btn_commercial" ? "Commercial building" : "Construction Project";
  const summaryPrompt = `Present this project summary to the user and ask them to confirm:
  Type: ${typeLabel}
  Location: ${d.location || "TBD"}
  Started: ${d.start_date || "TBD"}
  Budget: ${budget ? fmt(budget) + " UGX" : "TBD"}
  Ask them to reply 1 to confirm and create the project, 2 to edit, or 3 to skip. Keep it friendly and concise.`;
  const summary = await ai(
    summaryPrompt,
    `Here's your project summary:

Type: ${typeLabel}
Location: ${d.location || "TBD"}
Budget: ${budget ? fmt(budget) + " UGX" : "TBD"}

1. Create project
2. Edit
3. Skip`
  );
  await sendOptions(to, summary, ["1. Yes \u2013 Create project", "2. Edit", "3. Skip"]);
}
async function createProjectFromOnboarding(userId) {
  console.log("[CreateProject] Starting...");
  console.log("[CreateProject] userId:", userId);
  const { data: profile } = await supabase.from("profiles").select("id, onboarding_data").eq("id", userId).single();
  if (!profile) {
    console.error("[CreateProject] Profile not found:", userId);
    throw new Error("User profile not found. Please try again.");
  }
  const onboardingData = profile.onboarding_data || {};
  console.log("[CreateProject] onboardingData:", JSON.stringify(onboardingData));
  const typeLabel = onboardingData.project_type === "btn_residential" ? "Residential home" : onboardingData.project_type === "btn_commercial" ? "Commercial building" : "Construction Project";
  const projectName = onboardingData.location ? `${typeLabel} - ${onboardingData.location}` : onboardingData.location || typeLabel;
  const budgetNum = parseFloat(String(onboardingData.budget || 0));
  const startDate = onboardingData.start_date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const { data: newProject, error } = await supabase.from("projects").insert({
    name: projectName,
    description: onboardingData.location ? `Started: ${startDate}. Created via WhatsApp.` : "Created via WhatsApp.",
    budget: budgetNum,
    spent: 0,
    user_id: userId,
    status: "active",
    currency: "UGX",
    channel_type: "direct",
    created_at: (/* @__PURE__ */ new Date()).toISOString(),
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }).select().single();
  if (error) {
    console.error("[CreateProject] FAILED:", error);
    throw error;
  }
  if (!newProject || !newProject.id) {
    console.error("[CreateProject] No data returned from insert");
    throw new Error("Project was not saved. No data returned.");
  }
  console.log("[CreateProject] SUCCESS:", newProject.id, newProject.name);
  await supabase.from("profiles").update({
    active_project_id: newProject.id,
    onboarding_completed_at: (/* @__PURE__ */ new Date()).toISOString(),
    onboarding_state: "completed",
    onboarding_data: {},
    expense_state: null,
    expense_pending_data: {},
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("id", userId);
  return newProject.id;
}
async function sendPostCreationMessage(to, projectId) {
  const msg = await ai(
    `Tell the user their construction project has been created and their dashboard is live at this URL: ${DASHBOARD_URL}/dashboard?project=${projectId}. Then briefly explain they can now log expenses, materials, workers and progress just by chatting. Give 3-4 short examples naturally. End by saying they can send a receipt photo or voice note too.`,
    `Project created! Dashboard: ${DASHBOARD_URL}/dashboard?project=${projectId}

Just chat updates to me anytime:
\u2022 "Bought cement for 400,000"
\u2022 "6 workers on site"
\u2022 "Foundation 80% done"
\u2022 Send receipt photos or voice notes`
  );
  await sendMessage(to, msg);
}
async function handleOnboardingMessage(from, profile, message) {
  const state = profile.onboarding_state;
  if (state === "confirmation" && (message.includes("1") || /yes|create|confirm/i.test(message))) {
    try {
      const projectId = await createProjectFromOnboarding(profile.id);
      await sendPostCreationMessage(from, projectId);
    } catch (err) {
      console.error("[Onboarding] Project creation failed (handleOnboardingMessage):", err);
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
async function processReceiptPhoto(from, userId, projectId, mediaUrl) {
  await sendMessage(from, await ai(
    "Tell the user you received their receipt and are scanning it. One short line.",
    "Receipt received! Scanning it now..."
  ));
  const receiptPrompt = `This is a construction receipt. Extract all details and return ONLY valid JSON:
{
  "vendor": "shop or supplier name",
  "date": "date on receipt or null",
  "items": [{"name": "item name", "quantity": number_or_null, "unit": "unit_or_null", "amount": number_in_UGX}],
  "total": total_amount_in_UGX,
  "notes": "any other relevant info"
}
If amounts are in another currency, convert to UGX (1 USD \u2248 3700 UGX, 1 KES \u2248 28 UGX).`;
  async function applyOcrResult(content) {
    try {
      let jsonStr = content.trim();
      const codeMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeMatch) jsonStr = codeMatch[1].trim();
      const ocrData = JSON.parse(jsonStr);
      const total = ocrData.total || 0;
      const vendor = ocrData.vendor || "Unknown vendor";
      const itemsList = (ocrData.items || []).map((i) => `  \u2022 ${i.name}${i.quantity ? ` x${i.quantity}` : ""}: ${fmt(i.amount || 0)} UGX`).join("\n");
      if (ocrData.items && ocrData.items.length > 0) {
        for (const item of ocrData.items) {
          if (!item.name) continue;
          const materialName = String(item.name).toLowerCase().trim();
          const qty = parseFloat(String(item.quantity || 0));
          if (qty <= 0) continue;
          const itemUnitCost = parseFloat(String(item.amount || 0)) / (qty || 1);
          const itemTotalCost = parseFloat(String(item.amount || 0));
          const now = (/* @__PURE__ */ new Date()).toISOString();
          const { data: existing } = await supabase.from("materials_inventory").select("id, quantity, unit_cost, total_cost").eq("project_id", projectId).eq("name", materialName).maybeSingle();
          const newQty = parseFloat(String(existing?.quantity || 0)) + qty;
          if (existing) {
            const newTotalCost = parseFloat(String(existing.total_cost || 0)) + itemTotalCost;
            await supabase.from("materials_inventory").update({
              quantity: newQty,
              unit_cost: itemUnitCost || parseFloat(String(existing.unit_cost || 0)),
              total_cost: newTotalCost,
              last_purchased_at: now,
              updated_at: now
            }).eq("id", existing.id);
            await supabase.from("material_transactions").insert({
              material_id: existing.id,
              project_id: projectId,
              user_id: userId,
              transaction_type: "purchase",
              quantity: qty,
              unit_cost: itemUnitCost,
              total_cost: itemTotalCost,
              description: `Receipt: ${materialName} +${qty}`,
              source: "whatsapp"
            });
          } else {
            const { data: inserted } = await supabase.from("materials_inventory").insert({
              project_id: projectId,
              user_id: userId,
              name: materialName,
              quantity: qty,
              unit: item.unit || "units",
              unit_cost: itemUnitCost,
              total_cost: itemTotalCost,
              source: "whatsapp",
              last_purchased_at: now,
              updated_at: now
            }).select("id").single();
            if (inserted?.id) {
              await supabase.from("material_transactions").insert({
                material_id: inserted.id,
                project_id: projectId,
                user_id: userId,
                transaction_type: "purchase",
                quantity: qty,
                unit_cost: itemUnitCost,
                total_cost: itemTotalCost,
                description: `Receipt: ${materialName}`,
                source: "whatsapp"
              });
            }
          }
          console.log("[OCR Materials] Inventory updated:", materialName, "+", qty);
        }
      }
      const summary = await ai(
        `Summarise this receipt scan result naturally and ask the user to confirm saving it:
    Vendor: ${vendor}
    Date: ${ocrData.date || "Not visible"}
    Items: ${itemsList || "(unable to read items)"}
    Total: ${fmt(total)} UGX
    End with: reply 1 to save, 2 to edit, 3 to cancel.`,
        `Receipt scanned!

Vendor: ${vendor}
Date: ${ocrData.date || "Not visible"}
Total: ${fmt(total)} UGX

Save it?
1. Yes
2. Edit
3. Cancel`
      );
      await updateExpenseState(userId, "awaiting_confirmation", {
        amount: total,
        description: `Receipt: ${vendor}${ocrData.items?.length ? ` (${ocrData.items.map((i) => i.name).join(", ")})` : ""}`,
        vendor,
        project_id: projectId
      });
      await sendOptions(from, summary, ["\u2705 Yes \u2013 Save it", "\u270F\uFE0F Edit details", "\u274C Cancel"]);
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
        ).toString("base64")}`
      }
    });
    const buffer = await response.buffer();
    const base64Image = buffer.toString("base64");
    const contentType = response.headers.get("content-type") || "image/jpeg";
    if (gemini && process.env.GEMINI_API_KEY) {
      try {
        const model = gemini.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
        const imagePart = {
          inlineData: {
            data: base64Image,
            mimeType: contentType
          }
        };
        const result = await model.generateContent([receiptPrompt, imagePart]);
        const content = result.response.text().trim();
        if (content && await applyOcrResult(content)) {
          console.log("[OCR] Gemini success");
          return;
        }
      } catch (err) {
        console.error("[OCR] Gemini failed:", err?.message);
      }
    }
    if (process.env.OPENAI_API_KEY) {
      try {
        const ocrResult = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: `data:${contentType};base64,${base64Image}` }
                },
                { type: "text", text: receiptPrompt }
              ]
            }
          ],
          max_tokens: 500
        });
        const content = ocrResult.choices[0]?.message?.content?.trim() || "";
        if (content && await applyOcrResult(content)) {
          console.log("[OCR] OpenAI success");
          return;
        }
      } catch (err) {
        console.error("[OCR] OpenAI failed:", err?.message);
      }
    }
    await sendMessage(from, await ai(
      "Tell the user you could not read the receipt clearly. Suggest better lighting, laying it flat, or typing the details manually with an example.",
      'Could not read that receipt clearly. Try better lighting or type: "Bought [item] for [amount] from [vendor]"'
    ));
  } catch (err) {
    console.error("[OCR Error]", err);
    await sendMessage(from, await ai(
      "Tell the user you could not read the receipt clearly. Suggest better lighting, laying it flat, or typing the details manually with an example.",
      'Could not read that receipt clearly. Try better lighting or type: "Bought [item] for [amount] from [vendor]"'
    ));
  }
}
async function processVoiceNote(mediaUrl) {
  try {
    const response = await fetch(mediaUrl, {
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
        ).toString("base64")}`
      }
    });
    const buffer = await response.buffer();
    if (gemini && process.env.GEMINI_API_KEY) {
      try {
        const model = gemini.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
        const audioPart = {
          inlineData: {
            data: buffer.toString("base64"),
            mimeType: "audio/ogg"
          }
        };
        const result = await model.generateContent([
          "Transcribe this voice note exactly. Return only the transcribed text, nothing else.",
          audioPart
        ]);
        const text = result.response.text()?.trim();
        if (text) {
          console.log("[Voice] Gemini success");
          return text;
        }
      } catch (err) {
        console.error("[Voice] Gemini failed:", err?.message);
      }
    }
    if (process.env.OPENAI_API_KEY) {
      try {
        const blob = new Blob([new Uint8Array(buffer)], { type: "audio/ogg" });
        const file = new File([blob], "voice.ogg", { type: "audio/ogg" });
        const transcription = await openai.audio.transcriptions.create({
          model: "whisper-1",
          file,
          language: "en"
        });
        if (transcription.text) {
          console.log("[Voice] OpenAI Whisper success");
          return transcription.text;
        }
      } catch (err) {
        console.error("[Voice] OpenAI Whisper failed:", err?.message);
      }
    }
    return null;
  } catch (err) {
    console.error("[Voice Error]", err);
    return null;
  }
}
async function translateToEnglish(text) {
  const hasLugandaIndicators = /mpa|nze|nno|sseminti|emisumaali|okulunda|nsimba|abasajja|bajja|nfunyeyo|mugezi|hali|jangu|genda|kola|nkola|leeta|sente|eggulo|enkya/i.test(text);
  if (!hasLugandaIndicators) return text;
  console.log("[Translate] Detected Luganda, translating...");
  try {
    if (gemini && process.env.GEMINI_API_KEY) {
      const model = gemini.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
      const result = await model.generateContent(
        `Translate this Luganda construction site message to English. Return ONLY the English translation, nothing else: "${text}"`
      );
      const translated = result.response.text().trim();
      console.log("[Translate] Result:", translated);
      return translated || text;
    }
  } catch (err) {
    console.error("[Translate] Failed:", err?.message);
  }
  return text;
}
function preClassifyIntent(message) {
  const m = message.toLowerCase().trim();
  if (/edit.*budget|update.*budget|add.*budget|increase.*budget|change.*budget|set.*budget|new.*budget/i.test(m)) {
    const amount = parseAmount(message);
    const isAdd = /add|increase|plus|more/i.test(m);
    return { intent: "BUDGET_UPDATE", extracted: { amount, action: isAdd ? "add" : "set" } };
  }
  if (/log\s+this\s+expense|add\s+expense|record\s+expense|log\s+expense/i.test(m)) {
    return { intent: "EXPENSE_LOG", extracted: { description: message.trim() } };
  }
  if (/how (much|many).*(?:do|did) (?:i|we) have|current stock|stock.*left/i.test(m) && !/when did|last buy|last time|per bag|per unit|per kg|price|quote|should i|advice|recommend/i.test(m) && !/budget|spent|expense|cost/i.test(m) && !/worker|staff|people|men|mason|labourer|laborer|came|on site|show up/i.test(m) && (MATERIAL_KEYWORDS.some((k) => m.includes(k)) || /inventory|stock|material|supply|supplies/i.test(m))) {
    return { intent: "MATERIAL_QUERY", extracted: {} };
  }
  if (/switch|change.*project|other project|different project|wanna switch|want to switch|work on.*project|record for.*project|switch to.*mode|let.*work on|move to.*project|i want.*work on|want us to work|have data.*for.*project/i.test(m) && !/how much|budget|spent|expense|material|cement|sand|workers|bought|paid/i.test(m)) {
    const nameMatch = message.match(/(?:on|for|to|switch to|work on|the)\s+([A-Za-z][A-Za-z\s]+?)(?:\s+project|\s+mode|$)/i);
    const mentionedName = nameMatch ? nameMatch[1].trim() : null;
    return { intent: "SWITCH_PROJECT", extracted: { project_name: mentionedName } };
  }
  if (/list.*project|my project|show.*project|all.*project|project.*list|what project/i.test(m)) {
    return { intent: "LIST_PROJECTS", extracted: {} };
  }
  if (/which project|what project.*(?:am i|working on|tracking)|current project|active project/i.test(m) && !/list|show all/i.test(m)) {
    return { intent: "PROJECT_QUERY", extracted: {} };
  }
  if (/update.*dashboard|log.*expense|add.*expense|record|log something|what can|what do/i.test(m)) {
    return { intent: "GREETING", extracted: {} };
  }
  if (/bought|paid|spent|purchased|cost|price|buying|pay|expense/i.test(m) && /\d/.test(m)) {
    const amountMatches = message.match(/(\d+(?:\.\d+)?\s*[KkMmBb]?|\d{1,3}(?:,\d{3})*(?:\.\d+)?)/g);
    const amounts = amountMatches ? amountMatches.map((a) => parseAmount(a)) : [];
    const amount = amounts.length > 0 ? Math.max(...amounts) : 0;
    const itemMatch = message.match(/(?:bought|paid|spent|purchased)\s+(?:\d+\s+\w+\s+)?(?:of\s+)?([a-z\s]+?)(?:\s+for|\s+at|\s+from|\s*$)/i);
    const item = itemMatch ? itemMatch[1].trim() : "";
    const qtyMatch = message.match(/(\d+)\s*(bags?|kg|tons?|pieces?|trips?|units?|rolls?|sheets?)/i);
    const quantity = qtyMatch ? parseFloat(qtyMatch[1]) : 0;
    const unit = qtyMatch ? qtyMatch[2].toLowerCase() : "";
    const vendorMatch = message.match(/from\s+([A-Za-z\s]+?)(?:\s+for|\s*$)/i);
    const vendor = vendorMatch ? vendorMatch[1].trim() : "";
    return {
      intent: "EXPENSE_LOG",
      extracted: { item, amount, quantity, unit, vendor }
    };
  }
  if (/used|consumed|applied|finished\s+using/i.test(m) && /\d/.test(m)) {
    const qtyMatch = message.match(/(\d+)\s*(bags?|kg|tons?|pieces?|trips?|units?|bricks?|rods?|bars?)/i);
    const itemMatch = message.match(/(?:used|consumed)\s+\d+\s+\w+\s+(?:of\s+)?([a-z\s]+?)(?:\s+for|\s+on|\s*$)/i);
    const usedEndMatch = message.match(/(?:used|consumed|update)\s+.*?(\d+)\s+(bags?|kg|bricks?|pieces?|units?|rods?|bars?|sheets?)\s*[,.]?\s*$/i);
    const qty = qtyMatch ? parseFloat(qtyMatch[1]) : usedEndMatch ? parseFloat(usedEndMatch[1]) : 0;
    const unit = (qtyMatch ? qtyMatch[2] : usedEndMatch ? usedEndMatch[2] : "").toLowerCase();
    let item = itemMatch ? itemMatch[1].trim() : "";
    if (!item && usedEndMatch) item = usedEndMatch[2].toLowerCase();
    return {
      intent: "MATERIAL_LOG",
      extracted: {
        action: "used",
        quantity: qty,
        unit,
        item: item || (usedEndMatch ? usedEndMatch[2].toLowerCase() : "")
      }
    };
  }
  if (/received|delivered|got|arrived|brought/i.test(m) && /\d/.test(m)) {
    return {
      intent: "MATERIAL_LOG",
      extracted: { action: "bought" }
    };
  }
  if (/(\d+)\s*(workers?|casuals?|labou?rers?|men|guys?|people|staff|on\s+site)/i.test(m) || /(we\s+have\s+)?(about\s+)?(\d+)\s*(guys?|workers?|men)/i.test(m)) {
    const match = message.match(/(\d+)\s*(workers?|casuals?|labou?rers?|men|guys?|people|staff|on\s+site)/i) || message.match(/(?:we\s+have\s+)?(?:about\s+)?(\d+)\s*(?:guys?|workers?|men)/i);
    return {
      intent: "LABOR_LOG",
      extracted: { worker_count: match ? parseInt(match[1], 10) : 0 }
    };
  }
  if (/how much|budget|spent|remaining|left|balance|total cost/i.test(m) && /spent|budget|left|remaining|balance/i.test(m)) {
    return { intent: "BUDGET_QUERY", extracted: {} };
  }
  if (/there is|there's|we have|we've got|foundation crack|wall crack|crack|leak|damage|broken|problem|issue|defect|structural|safety concern/i.test(m) && /crack|leak|damage|broken|problem|issue|defect|structural/i.test(m) && !/any alerts|any issues|are there any|what issues|show.*issues|list.*issues|do we have any|should i know/i.test(m)) {
    const severity = /emergency|critical|urgent|serious|dangerous|immediate/i.test(m) ? "critical" : /major|severe|significant/i.test(m) ? "high" : "medium";
    return { intent: "ISSUE_REPORT", extracted: { description: message, severity } };
  }
  if (/rain|flood|weather|delay|couldn't work|no work|storm/i.test(m)) {
    return {
      intent: "WEATHER_DELAY",
      extracted: { reason: message }
    };
  }
  if (/finished|completed|done|\d+%|percent|progress|milestone/i.test(m)) {
    return {
      intent: "PROGRESS_UPDATE",
      extracted: { note: message }
    };
  }
  return null;
}
function parseMultiItemMessage(message) {
  const hasMultipleItems = (message.match(/,/g) || []).length >= 2 || /\band\b.*\band\b/i.test(message) || /\d+\s*\w+\s+at\s+\d+.*,.*\d+\s*\w+\s+at\s+\d+/i.test(message);
  if (!hasMultipleItems) return null;
  const items = [];
  const parts = message.split(/,(?!\s*\d{3})/);
  for (const part of parts) {
    const p = part.trim();
    const m1 = p.match(/(\d+(?:\.\d+)?)\s*(bags?|kg|kgs?|tonnes?|pieces?|pcs?|rods?|bars?|sheets?|poles?|litres?|rolls?|units?)?\s+(?:of\s+)?([a-z][a-z\s]+?)\s+(?:at\s+|[-–]\s*)?(\d[\d,.]*[KkMmBb]?)\s*(?:each|per\s+\w+)?/i);
    if (m1) {
      const qty = parseFloat(m1[1]);
      const unit = (m1[2] || "units").toLowerCase();
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
      const unit = (m2[2] || "units").toLowerCase();
      const item = m2[3].trim();
      const total = parseAmount(m2[4]);
      if (qty > 0 && total > 0 && item.length > 1) {
        items.push({ item, quantity: qty, unit, amount: total });
      }
    }
  }
  return items.length >= 2 ? items : null;
}
async function classifyIntent(message, phoneNumber) {
  const translatedMessage = await translateToEnglish(message);
  const preClassified = preClassifyIntent(translatedMessage);
  if (preClassified) {
    console.log("[Intent] Regex match:", preClassified.intent);
    return preClassified;
  }
  if (!checkRateLimit(phoneNumber)) {
    console.log("[Rate Limit] Hit for:", phoneNumber);
    return { intent: "GREETING", extracted: {} };
  }
  const systemPrompt = `You are a construction site assistant for African building projects.

IMPORTANT: Be aggressive about classifying expense and material messages. When in doubt between EXPENSE_LOG and GREETING, choose EXPENSE_LOG if there are numbers involved.
Amounts: 150K means 150,000 UGX, 1.5M means 1,500,000 UGX, 2B means 2,000,000,000 UGX. Always use these conversions in extracted.amount.
CRITICAL amount parsing rules: K or k = multiply by 1,000 (4k=4000, 30k=30000, 150k=150000). M or m = multiply by 1,000,000. B or b = multiply by 1,000,000,000. Never multiply K by 10.

Common patterns you MUST classify correctly:

EXPENSE_LOG examples (always has numbers):
- "10 masons worked today and I paid each 20k" \u2192 EXPENSE_LOG, amount: 200000, description: "Labour - 10 masons", quantity: 10
- "I just bought 10 bags cement at 30k each, 10kg nails at 4k per kg, 2 timber poles 30k" \u2192 EXPENSE_LOG with items array: [{item:"cement",quantity:10,unit:"bags",amount:300000},{item:"nails",quantity:10,unit:"kg",amount:40000},{item:"timber poles",quantity:2,unit:"pieces",amount:30000}]
- "log this expense: Bought cement for 400,000" \u2192 EXPENSE_LOG
- "add this expense: Paid labour 150K" \u2192 EXPENSE_LOG
- Any message with quantities AND prices \u2192 EXPENSE_LOG, never GREETING or SMART_QUERY
- "Bought 50 bags cement for 1,900,000"
- "Bought cement 1900000"
- "Paid plumber 150k"
- "Spent 500k on iron rods"
- "200000 for sand"
- "cement 38000 per bag"
- "purchased tiles 450,000"
- MULTI-ITEM: "I bought 10 bags cement at 30k each and 5 wood poles at 10k each" \u2192 return items: [{item:"cement",quantity:10,unit:"bags",amount:300000},{item:"wood poles",quantity:5,unit:"pieces",amount:50000}]
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

SMART_QUERY \u2014 use for free-form analytical questions about historical data:
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

ISSUE_REPORT \u2014 use when user reports a problem, defect, or safety concern:
- "log this alert issue - The rain ruined 10 bags cement" \u2192 ISSUE_REPORT, description: "The rain ruined 10 bags cement" (strip the command prefix)
- "There is a foundation crack"
- "We have a leak in the roof"
- "Structural damage on the wall"
- "Safety concern: loose scaffolding"
Return severity: "critical" for emergency/urgent, "high" for major/severe, "medium" otherwise. In extracted.description strip any leading "log this alert issue - " type prefix.

PROJECT_QUERY \u2014 use when user asks which project they are on:
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
  const validIntents = [
    "EXPENSE_LOG",
    "MATERIAL_LOG",
    "LABOR_LOG",
    "PROGRESS_UPDATE",
    "BUDGET_QUERY",
    "MATERIAL_QUERY",
    "BUDGET_UPDATE",
    "WEATHER_DELAY",
    "SMART_QUERY",
    "LIST_PROJECTS",
    "ISSUE_REPORT",
    "PROJECT_QUERY",
    "GREETING"
  ];
  function parseIntentResponse(content) {
    try {
      const jsonStr = content.replace(/```(?:json)?\s*([\s\S]*?)```/, "$1").trim();
      const parsed = JSON.parse(jsonStr);
      return validIntents.includes(parsed.intent) ? parsed : null;
    } catch {
      return null;
    }
  }
  if (gemini && process.env.GEMINI_API_KEY) {
    try {
      console.log("[Intent] Trying Gemini...");
      const model = gemini.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
      const prompt = `${systemPrompt}

Message to classify: "${translatedMessage}"

Return ONLY the JSON object, no other text.`;
      const result = await model.generateContent(prompt);
      const content = result.response.text().trim();
      const parsed = parseIntentResponse(content);
      if (parsed) {
        console.log("[Intent] Gemini success:", parsed.intent);
        return parsed;
      }
    } catch (err) {
      console.error("[Intent] Gemini failed:", err?.message);
    }
  }
  if (process.env.OPENAI_API_KEY) {
    try {
      console.log("[Intent] Trying OpenAI...");
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: translatedMessage }
        ],
        temperature: 0.1,
        max_tokens: 300
      });
      const content = completion.choices[0]?.message?.content?.trim() || "";
      const parsed = parseIntentResponse(content);
      if (parsed) {
        console.log("[Intent] OpenAI success:", parsed.intent);
        return parsed;
      }
    } catch (err) {
      console.error("[Intent] OpenAI failed:", err?.message);
    }
  }
  console.log("[Intent] All AI failed, defaulting to GREETING");
  return { intent: "GREETING", extracted: {} };
}
async function checkPriceAnomaly(projectId, item, amount, quantity) {
  if (!quantity || quantity <= 0) return null;
  const unitPrice = amount / quantity;
  const { data: history } = await supabase.from("expenses").select("amount, quantity_logged").eq("project_id", projectId).ilike("description", `%${item}%`).not("quantity_logged", "is", null).order("created_at", { ascending: false }).limit(10);
  if (!history || history.length < 2) return null;
  const historicalUnitPrices = history.filter((e) => e.quantity_logged && parseFloat(e.quantity_logged) > 0).map((e) => parseFloat(e.amount) / parseFloat(e.quantity_logged));
  if (historicalUnitPrices.length < 2) return null;
  const avg = historicalUnitPrices.reduce((a, b) => a + b, 0) / historicalUnitPrices.length;
  const pctDiff = (unitPrice - avg) / avg * 100;
  if (pctDiff > 15) {
    return `\u26A0\uFE0F *Price Alert:* ${item} at ${fmt(unitPrice)} UGX/unit is *${Math.round(pctDiff)}% above* your recent average of ${fmt(avg)} UGX/unit.

Market increase or possible overcharge? Reply "ok" to log anyway or "cancel" to discard.`;
  }
  if (pctDiff < -20) {
    return `\u2705 *Good deal:* ${item} at ${fmt(unitPrice)} UGX/unit is *${Math.round(Math.abs(pctDiff))}% below* your recent average of ${fmt(avg)} UGX/unit.`;
  }
  return null;
}
async function upsertVendor(projectId, vendorName, amount) {
  if (!vendorName || vendorName.toLowerCase() === "unknown vendor") return;
  const name = vendorName.trim().toLowerCase();
  const { data: existing } = await supabase.from("vendors").select("id, total_transactions, total_spent").eq("project_id", projectId).eq("name", name).maybeSingle();
  if (existing) {
    await supabase.from("vendors").update({
      total_transactions: (existing.total_transactions || 0) + 1,
      total_spent: (parseFloat(existing.total_spent) || 0) + amount
    }).eq("id", existing.id);
  } else {
    await supabase.from("vendors").insert({
      project_id: projectId,
      name,
      total_transactions: 1,
      total_spent: amount
    });
  }
}
async function upsertDailyLog(projectId, data) {
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const { data: existing } = await supabase.from("daily_logs").select("id, notes, photo_urls, activity_entries").eq("project_id", projectId).eq("log_date", today).maybeSingle();
  if (existing) {
    const updateData = { ...data };
    if (data.notes && existing.notes) {
      updateData.notes = `${existing.notes}
${data.notes}`;
    }
    if (data.photo_urls && existing.photo_urls) {
      updateData.photo_urls = [...existing.photo_urls || [], ...data.photo_urls];
    }
    if (data.activity_entries && data.activity_entries.length > 0) {
      const existingEntries = Array.isArray(existing.activity_entries) ? existing.activity_entries : [];
      updateData.activity_entries = [...existingEntries, ...data.activity_entries];
    }
    await supabase.from("daily_logs").update(updateData).eq("id", existing.id);
  } else {
    const insertData = { project_id: projectId, log_date: today, ...data };
    if (data.activity_entries && data.activity_entries.length > 0) {
      insertData.activity_entries = data.activity_entries;
    }
    await supabase.from("daily_logs").insert(insertData);
  }
}
async function handleBudgetQuery(from, projectId, lang) {
  const { data: project } = await supabase.from("projects").select("budget, name").eq("id", projectId).single();
  const { data: expenses } = await supabase.from("expenses").select("amount").eq("project_id", projectId);
  const totalSpent = (expenses || []).reduce((s, e) => s + parseFloat(String(e.amount || 0)), 0);
  const budget = parseFloat(String(project?.budget || 0));
  const pct = budget > 0 ? Math.round(totalSpent / budget * 100) : 0;
  const remaining = budget > 0 ? Math.max(0, budget - totalSpent) : 0;
  const { data: allExpensesForBurn } = await supabase.from("expenses").select("amount, expense_date").eq("project_id", projectId);
  let weeklyBurn = 0;
  if (allExpensesForBurn && allExpensesForBurn.length > 0) {
    const burnDates = allExpensesForBurn.map((e) => e.expense_date ? (/* @__PURE__ */ new Date(e.expense_date + "T12:00:00")).getTime() : null).filter((t) => t !== null);
    const firstMs = burnDates.length > 0 ? Math.min(...burnDates) : Date.now();
    const daysSince = Math.max(1, (Date.now() - firstMs) / (1e3 * 60 * 60 * 24));
    const spent = allExpensesForBurn.reduce((s, e) => s + parseFloat(String(e.amount || 0)), 0);
    weeklyBurn = Math.round(spent / daysSince * 7);
  }
  const weeksLeft = weeklyBurn > 0 ? Math.round(remaining / weeklyBurn) : null;
  const msg = await ai(
    `Give the user a natural budget summary for their project:
    Total spent: ${fmt(totalSpent)} UGX
    Budget: ${fmt(budget)} UGX
    Used: ${pct}%
    Remaining: ${fmt(remaining)} UGX
    ${weeksLeft !== null ? "At current rate: ~" + weeksLeft + " weeks of budget left" : ""}
    ${pct > 80 ? "IMPORTANT: Warn them they have used over 80% of budget!" : ""}
    Be conversational, not just a list of numbers.`,
    `Budget summary: Spent: ${fmt(totalSpent)} UGX | Budget: ${fmt(budget)} UGX | Used: ${pct}% | Remaining: ${fmt(remaining)} UGX`,
    300,
    lang
  );
  await sendMessage(from, msg);
}
async function handleGreeting(from, profile, currentProject, allProjects, rawMessage, lang) {
  const firstName = profile?.full_name && profile.full_name !== "WhatsApp User" ? profile.full_name.split(" ")[0] : null;
  let recentActivity = "", budgetSummary = "", alertsSummary = "";
  if (currentProject) {
    const [exRes, logRes, issRes, matRes] = await Promise.all([
      supabase.from("expenses").select("description,amount,expense_date").eq("project_id", currentProject.id).is("deleted_at", null).order("created_at", { ascending: false }).limit(5),
      supabase.from("daily_logs").select("worker_count,notes,weather_condition").eq("project_id", currentProject.id).eq("log_date", (/* @__PURE__ */ new Date()).toISOString().split("T")[0]).maybeSingle(),
      supabase.from("issues").select("title,severity,status").eq("project_id", currentProject.id).eq("status", "open").order("created_at", { ascending: false }).limit(3),
      supabase.from("materials_inventory").select("name,quantity,low_stock_threshold").eq("project_id", currentProject.id).order("quantity", { ascending: true }).limit(5)
    ]);
    const recent = exRes.data || [];
    const todayLog = logRes.data;
    const issues = issRes.data || [];
    const lowStock = (matRes.data || []).filter((m) => m.quantity <= (m.low_stock_threshold ?? 5));
    if (recent.length) {
      const tot = recent.reduce((s, e) => s + parseFloat(String(e.amount || 0)), 0);
      recentActivity = `Recent spend (last ${recent.length} entries): UGX ${fmt(tot)}. Latest: ${recent[0].description} (UGX ${fmt(parseFloat(String(recent[0].amount || 0)))}, ${recent[0].expense_date || "today"}). `;
    }
    if (todayLog?.worker_count) recentActivity += `Today: ${todayLog.worker_count} workers on site. `;
    if (todayLog?.notes) recentActivity += `Site note: ${todayLog.notes}. `;
    if (todayLog?.weather_condition) recentActivity += `Weather: ${todayLog.weather_condition}. `;
    const budgetV = parseFloat(String(currentProject.budget || 0));
    if (budgetV > 0) {
      const { data: allEx } = await supabase.from("expenses").select("amount").eq("project_id", currentProject.id).is("deleted_at", null);
      const spent = (allEx || []).reduce((s, e) => s + parseFloat(String(e.amount || 0)), 0);
      budgetSummary = `Budget: UGX ${fmt(spent)} spent of UGX ${fmt(budgetV)} (${Math.min(100, Math.round(spent / budgetV * 100))}% used). `;
    }
    if (issues.length) alertsSummary = `Open alerts: ${issues.map((i) => `${i.title} (${i.severity})`).join(", ")}. `;
    if (lowStock.length) alertsSummary += `Low stock: ${lowStock.map((m) => m.name).join(", ")}. `;
  }
  const today = (/* @__PURE__ */ new Date()).toLocaleDateString("en-UG", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const langInstruction = lang && lang !== "en" ? `The user wrote in ${lang}. You MUST respond in ${lang}, not English.` : "Respond in English unless the user wrote in another language.";
  const systemPrompt = `You are JengaTrack \u2014 an intelligent WhatsApp construction site assistant, like a brilliant site supervisor who also understands finance, engineering, and project management. You behave like Claude AI but specialized for construction.

Today is ${today}. ${langInstruction}

USER: ${firstName || "Site manager"}
ACTIVE PROJECT: ${currentProject?.name || "None set"}
${budgetSummary}
${recentActivity}
${alertsSummary}
ALL PROJECTS: ${(allProjects || []).map((p) => p.name).join(", ") || "None"}

YOUR CAPABILITIES:
1. Log expenses, materials, workers, progress, issues, weather delays \u2014 all just by chatting
2. Answer any question about this project: budget, spending, materials, vendors, daily logs
3. Answer ANY construction question: concrete mixing, reinforcement ratios, material quantities, cost estimation, structural advice, Uganda/East Africa building codes and market prices
4. Handle voice notes and receipt photos
5. Manage tasks, issues, milestones
6. Analyse spending patterns, vendor history, burn rate, budget projections

RULES:
- Plain text only. No markdown asterisks, no ** bold, no * bullets. Use dashes (-) for lists.
- NEVER say "I cannot help with that", "I am an AI", "please use the format X", or "check your dashboard"
- NEVER show numbered menus unless user explicitly asks
- For greetings: respond warmly, mention the project by name, mention any open alerts or low stock naturally, offer to help with something specific in 2-3 lines
- For general construction questions (how to mix concrete, rebar spacing, waterproofing, etc.): answer fully and expertly with specific numbers and ratios
- For project data questions: give a direct, specific answer using the context above
- If user wants to log something: confirm naturally and tell them you are saving it`;
  let reply = null;
  if (gemini && process.env.GEMINI_API_KEY) {
    for (const modelName of ["gemini-2.0-flash", "gemini-2.5-flash-lite"]) {
      try {
        const model = gemini.getGenerativeModel({ model: modelName, systemInstruction: systemPrompt });
        const result = await model.generateContent(rawMessage || "Hello");
        reply = result.response.text().trim();
        if (reply) break;
      } catch (err) {
        console.error(`[Greeting] Gemini ${modelName} failed:`, err?.message);
      }
    }
  }
  if (!reply && process.env.OPENAI_API_KEY) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: rawMessage || "Hello" }
        ],
        temperature: 0.7,
        max_tokens: 400
      });
      reply = completion.choices[0]?.message?.content?.trim() || null;
    } catch (err) {
      console.error("[Greeting] OpenAI failed:", err?.message);
    }
  }
  if (!reply) {
    reply = firstName ? `Hey ${firstName}! What would you like to update on ${currentProject?.name || "your project"} today?` : `Hey! What would you like to update today?`;
  }
  await sendMessage(from, reply, profile?.id, currentProject?.id);
}
async function handleBudgetUpdate(from, projectId, extracted) {
  const { data: project } = await supabase.from("projects").select("budget, name").eq("id", projectId).single();
  const currentBudget = parseFloat(String(project?.budget || 0));
  const amount = typeof extracted.amount === "number" ? extracted.amount : 0;
  const action = extracted.action;
  if (!amount || amount <= 0) {
    await sendMessage(from, await ai(
      'Ask the user what the new budget should be. Give examples: "Set budget to 200M" or "Add 10M to budget".',
      'What should the new budget be? Try: "Set budget to 200M" or "Add 10M to budget"'
    ));
    return;
  }
  const newBudget = action === "add" ? currentBudget + amount : amount;
  await supabase.from("projects").update({ budget: newBudget, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", projectId);
  console.log("[BudgetUpdate] Old:", currentBudget, "\u2192 New:", newBudget);
  const msg = await ai(
    `Tell the user their budget was updated. Previous: ${fmt(currentBudget)} UGX. ${action === "add" ? "Added" : "New budget"}: ${fmt(amount)} UGX. New total: ${fmt(newBudget)} UGX. Tell them to refresh their dashboard.`,
    `Budget updated! Previous: ${fmt(currentBudget)} UGX. New total: ${fmt(newBudget)} UGX. Refresh your dashboard to see the update.`
  );
  await sendMessage(from, msg);
}
async function handleExpenseLog(from, userId, projectId, extracted, rawMessage, lang) {
  const rawItems = extracted.items;
  if (Array.isArray(rawItems) && rawItems.length > 1) {
    const items = rawItems.map((x) => ({
      item: String(x.item || "").trim(),
      quantity: typeof x.quantity === "number" ? x.quantity : parseFloat(String(x.quantity || 0)) || 1,
      unit: String(x.unit || "units").trim(),
      amount: typeof x.amount === "number" ? x.amount : parseFloat(String(x.amount || 0)) || 0
    })).filter((x) => x.item && x.amount > 0);
    if (items.length > 1) {
      const total = items.reduce((s, x) => s + x.amount, 0);
      const lines = items.map((x) => `\u2022 ${x.quantity} ${x.unit} of ${x.item} \u2014 UGX ${fmt(x.amount)}`).join("\n");
      await updateExpenseState(userId, "awaiting_confirmation", {
        project_id: projectId,
        items,
        amount: total,
        description: items.map((x) => `${x.quantity} ${x.unit} of ${x.item}`).join(" and ")
      });
      await sendMessage(from, `\u2705 Confirm expense:
${lines}

Total: UGX ${fmt(total)}

1. Yes \u2014 Log it
2. Edit
3. Cancel`);
      return;
    }
  }
  let amount = typeof extracted.amount === "number" ? extracted.amount : 0;
  let item = String(extracted.item || "").trim();
  let quantity = typeof extracted.quantity === "number" ? extracted.quantity : 0;
  let unit = String(extracted.unit || "").trim();
  let vendor = String(extracted.vendor || "").trim();
  if (!amount || amount <= 0) amount = parseAmount(rawMessage);
  if (!quantity) {
    const qm = rawMessage.match(/(\d+(?:,\d{3})*)\s*(bags?|kg|tons?|pieces?|trips?|units?)/i);
    if (qm) {
      quantity = parseFloat(qm[1].replace(/,/g, ""));
      unit = unit || qm[2].toLowerCase();
    }
  }
  if ((!amount || amount <= 0) && quantity > 0 && item) {
    const isMaterial = MATERIAL_KEYWORDS.some((k) => item.toLowerCase().includes(k)) && !SKIP_KEYWORDS.some((k) => item.toLowerCase().includes(k));
    if (isMaterial) {
      const nameNorm = normalizeMaterialName(item);
      if (nameNorm.length >= 2 && !GARBAGE_MATERIAL_NAMES.includes(nameNorm)) {
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const { data: ex } = await supabase.from("materials_inventory").select("id, quantity").eq("project_id", projectId).eq("name", nameNorm).maybeSingle();
        if (ex) {
          await supabase.from("materials_inventory").update({
            quantity: parseFloat(String(ex.quantity || 0)) + quantity,
            last_purchased_at: now,
            updated_at: now
          }).eq("id", ex.id);
        } else {
          await supabase.from("materials_inventory").insert({
            project_id: projectId,
            name: nameNorm,
            quantity,
            unit: unit || "units",
            source: "whatsapp",
            last_purchased_at: now,
            updated_at: now
          });
        }
        console.log(`[ExpenseLog] Inventory pre-updated: +${quantity} ${unit || "units"} of ${nameNorm}`);
      }
    }
    await updateExpenseState(userId, "awaiting_price", {
      quantity,
      item,
      unit: unit || "units",
      project_id: projectId,
      vendor
    });
    const vendorStr = vendor ? ` from ${vendor}` : "";
    const matLine = isMaterial ? `
\u{1F4E6} ${quantity} ${unit || "units"} of ${item} added to Materials & Supplies.` : "";
    const msg2 = await ai(
      `Tell the user you've noted ${quantity} ${unit || "units"} of ${item}${vendorStr}.${isMaterial ? " Also tell them the quantity has been added to their Materials & Supplies inventory." : ""} Now ask them what the total cost was so you can log the expense. Give a price example like 500,000 UGX or 1.2M. Keep it brief and friendly.`,
      `Got it! ${quantity} ${unit || "units"} of ${item}${vendorStr} noted.${matLine}

What was the total cost? (e.g. 500,000 UGX or 1.2M)`,
      200,
      lang
    );
    await sendMessage(from, msg2, userId, projectId);
    return;
  }
  if (!amount || amount <= 0) {
    await sendMessage(from, await ai(
      "Tell the user you need the amount. Give examples: Bought cement for 200,000 UGX, Paid plumber 150k, Spent 500,000 on steel rods.",
      'I need the amount. Try: "Bought cement for 200,000 UGX" or "Paid plumber 150k"',
      200,
      lang
    ));
    return;
  }
  const description = item ? `${quantity > 0 ? `${quantity} ${unit || "units"} of ` : ""}${item}` : `Expense: ${fmt(amount)} UGX`;
  const anomalyAlert = quantity > 0 && item ? await checkPriceAnomaly(projectId, item, amount, quantity) : null;
  await updateExpenseState(userId, "awaiting_confirmation", {
    amount,
    description,
    project_id: projectId,
    quantity,
    unit,
    item,
    vendor,
    unit_price: quantity > 0 ? Math.round(amount / quantity) : void 0
  });
  const msg = await ai(
    `Confirm this expense with the user and ask if it looks correct:
    Item: ${description}
    Total: ${fmt(amount)} UGX
    ${vendor ? "From: " + vendor : ""}
    ${quantity > 0 ? "Per " + (unit || "unit") + ": " + fmt(amount / quantity) + " UGX" : ""}
    ${anomalyAlert ? "Note: " + anomalyAlert : ""}
    End with: reply 1 to save, 2 to edit, 3 to cancel.`,
    `${description} \u2014 ${fmt(amount)} UGX${vendor ? " from " + vendor : ""}. Save it?

1. Yes
2. Edit
3. Cancel`,
    200,
    lang
  );
  const confirmMsg = anomalyAlert ? `${anomalyAlert}

${msg}` : msg;
  await sendMessage(from, confirmMsg);
}
async function handleMaterialLog(from, userId, projectId, extracted, rawMessage, lang) {
  let item = String(extracted.item || "").trim();
  let qty = typeof extracted.quantity === "number" ? extracted.quantity : parseFloat(String(extracted.quantity || "0")) || 0;
  let unit = String(extracted.unit || "units").trim();
  const action = String(extracted.action || "bought").toLowerCase();
  const vendor = String(extracted.vendor || "").trim();
  const amount = typeof extracted.amount === "number" ? extracted.amount : parseFloat(String(extracted.amount || "0")) || 0;
  const unitCost = amount && qty > 0 ? amount / qty : 0;
  const totalCost = amount || qty * unitCost;
  const qm = rawMessage.match(/(\d+(?:,\d+)*)\s*(bags?|kg|tons?|pieces?|trips?|units?)\s+(?:of\s+)?([a-z\s]+)/i);
  if (qm) {
    if (!qty) qty = parseFloat(qm[1].replace(/,/g, ""));
    if (!item) item = qm[3].trim();
    if (!unit || unit === "units") unit = qm[2].toLowerCase();
  }
  const effectiveAction = /used|consumed|for\s+foundation|for\s+/i.test(rawMessage) ? "used" : action;
  if ((!item || item === "material") && effectiveAction === "used") {
    const altMatch = rawMessage.match(/(\d+)\s+(bags?|kg|tonnes?|pieces?|bricks?|rods?|bars?|sheets?|poles?|litres?|rolls?|units?)\s+(?:of\s+)?([a-z\s]+?)(?:\s+(?:from|for|to|update|inventory)|[,.]|$)/i);
    if (altMatch) {
      if (!qty || qty <= 0) qty = parseFloat(altMatch[1]);
      if (!unit || unit === "units") unit = altMatch[2].toLowerCase();
      if (!item) item = altMatch[3].trim();
    }
    const simpleMatch = rawMessage.match(/(?:used?|consumed?|update|deduct)\s+.*?(\d+)\s+(bricks?|cement|sand|gravel|timber|wood|steel|iron|tiles|paint|pipes?|wire|blocks?|poles?|nails?|aggregate|ballast)/i);
    if (simpleMatch && (!item || item === "material")) {
      if (!qty || qty <= 0) qty = parseFloat(simpleMatch[1]);
      if (!item) item = simpleMatch[2].toLowerCase();
      if (!unit || unit === "units") unit = /bricks?|blocks?|pieces?|poles?|sheets?|rolls?|pipes?|rods?/.test(simpleMatch[2]) ? "pieces" : /cement|sand|gravel|aggregate|ballast/.test(simpleMatch[2]) ? "bags" : "units";
    }
  }
  if (!qty || qty <= 0) {
    const naturalMatch = rawMessage.match(
      /(\d+)\s*(bricks?|bags?|kg|tons?|pieces?|rods?|bars?|sheets?|units?|rolls?)/i
    );
    if (naturalMatch) {
      qty = parseFloat(naturalMatch[1]);
      if (!unit || unit === "units") unit = naturalMatch[2].toLowerCase();
    }
  }
  if (!item || item === "material") {
    const itemMatch = rawMessage.match(
      /(\d+)\s+(?:bags?\s+of\s+|pieces?\s+of\s+|units?\s+of\s+)?([a-z\s]+?)(?:\s*$|\s+for|\s+from)/i
    );
    if (itemMatch) item = itemMatch[2].trim();
  }
  if (!item) item = "material";
  if (!unit || unit === "units") unit = "units";
  const singleWord = rawMessage.trim().toLowerCase().replace(/[.?!,]/g, "");
  const isSingleMaterialName = singleWord.length < 30 && !/\d/.test(singleWord) && (MATERIAL_KEYWORDS.some((k) => singleWord === k || singleWord.includes(k)) || ["bricks", "cement", "sand", "gravel", "timber", "wood", "steel", "iron", "tiles", "paint", "pipes", "wire", "blocks", "poles", "nails", "aggregate", "ballast"].some((k) => singleWord === k));
  if (isSingleMaterialName && (!qty || qty <= 0) && !extracted.quantity) {
    const materialLabel = item && item !== "material" ? item : singleWord;
    await sendMessage(from, `How many ${materialLabel} were used? e.g. "4 bricks" or "today we used 4 bricks"`);
    return;
  }
  if (!qty || qty <= 0) qty = 1;
  const nameNormCheck = item.toLowerCase().trim();
  if (nameNormCheck.length < 2) {
    await sendMessage(from, "Please provide a valid material name (at least 2 characters).");
    return;
  }
  if (GARBAGE_MATERIAL_NAMES.includes(nameNormCheck)) {
    await sendMessage(from, "Please specify the actual material name (e.g. cement, bricks, sand).");
    return;
  }
  const { data: allMaterials } = await supabase.from("materials_inventory").select("id, name, quantity, unit, low_stock_threshold").eq("project_id", projectId);
  let materialName = item.toLowerCase().trim() || "material";
  if (allMaterials && allMaterials.length > 0 && materialName !== "material") {
    const fuzzyMatch = allMaterials.find(
      (m) => m.name === materialName || m.name.includes(materialName) || materialName.includes(m.name) || materialName.split(" ").some(
        (word) => word.length > 3 && m.name.includes(word)
      )
    );
    if (fuzzyMatch) {
      console.log("[MaterialLog] Fuzzy matched:", materialName, "\u2192", fuzzyMatch.name);
      materialName = fuzzyMatch.name;
    }
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (effectiveAction === "used") {
    const { data: existing2 } = await supabase.from("materials_inventory").select("id, quantity, unit, low_stock_threshold").eq("project_id", projectId).eq("name", materialName).maybeSingle();
    if (!existing2) {
      await sendMessage(from, `No material matching "${materialName}" in inventory. Add it first by logging a purchase.`);
      return;
    }
    const usedQty = Math.abs(qty);
    const currentQty = parseFloat(String(existing2.quantity || 0));
    const newQty = Math.max(0, currentQty - usedQty);
    const lowThreshold = existing2.low_stock_threshold != null ? parseFloat(String(existing2.low_stock_threshold)) : 5;
    await supabase.from("materials_inventory").update({
      quantity: newQty,
      last_used_at: now,
      updated_at: now
    }).eq("id", existing2.id);
    await supabase.from("material_transactions").insert({
      material_id: existing2.id,
      project_id: projectId,
      user_id: userId,
      transaction_type: "usage",
      quantity: -usedQty,
      unit_cost: 0,
      total_cost: 0,
      description: `Used ${usedQty} ${unit} of ${materialName}`,
      source: "whatsapp"
    });
    let reply = `\u2705 Updated! Used ${usedQty} ${unit} of ${materialName}. Remaining stock: ${newQty} ${unit}.`;
    if (newQty <= lowThreshold) {
      reply += ` \u26A0\uFE0F Low stock (threshold: ${lowThreshold}). Consider restocking.`;
    }
    await sendMessage(from, reply);
    return;
  }
  const { data: existing } = await supabase.from("materials_inventory").select("id, quantity, unit_cost, total_cost").eq("project_id", projectId).eq("name", materialName).maybeSingle();
  let materialId;
  if (existing) {
    const newQty = parseFloat(String(existing.quantity || 0)) + qty;
    const newTotalCost = parseFloat(String(existing.total_cost || 0)) + totalCost;
    await supabase.from("materials_inventory").update({
      quantity: newQty,
      unit_cost: unitCost || parseFloat(String(existing.unit_cost || 0)),
      total_cost: newTotalCost,
      last_purchased_at: now,
      updated_at: now
    }).eq("id", existing.id);
    materialId = existing.id;
  } else {
    const { data: inserted } = await supabase.from("materials_inventory").insert({
      project_id: projectId,
      user_id: userId,
      name: materialName,
      quantity: qty,
      unit: unit || "units",
      unit_cost: unitCost,
      total_cost: totalCost,
      source: "whatsapp",
      last_purchased_at: now,
      updated_at: now
    }).select("id").single();
    materialId = inserted?.id;
  }
  if (materialId) {
    const { data: row } = await supabase.from("materials_inventory").select("quantity").eq("id", materialId).single();
    const newTotal = row ? parseFloat(String(row.quantity || 0)) : qty;
    await supabase.from("material_transactions").insert({
      material_id: materialId,
      project_id: projectId,
      user_id: userId,
      transaction_type: "purchase",
      quantity: qty,
      unit_cost: unitCost,
      total_cost: totalCost,
      description: `Added ${qty} ${unit} of ${materialName}`,
      source: "whatsapp"
    });
    const reply = `\u2705 Logged! Added ${qty} ${unit} of ${materialName} to your Materials & Supplies. Current stock: ${newTotal} ${unit}.`;
    await sendMessage(from, reply);
  }
  if (vendor) await upsertVendor(projectId, vendor, 0);
}
async function handleLaborLog(from, projectId, extracted, rawMessage, lang) {
  let workerCount = typeof extracted.worker_count === "number" ? extracted.worker_count : parseInt(String(extracted.worker_count || "0"), 10) || 0;
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
  const { data: recentLogs } = await supabase.from("daily_logs").select("worker_count").eq("project_id", projectId).not("worker_count", "is", null).order("log_date", { ascending: false }).limit(7);
  let anomalyMsg = "";
  if (recentLogs && recentLogs.length >= 3) {
    const avg = recentLogs.reduce((s, l) => s + (l.worker_count || 0), 0) / recentLogs.length;
    if (workerCount > avg * 1.5) {
      anomalyMsg = `

\u{1F514} *Note:* ${workerCount} workers is more than usual (avg: ${Math.round(avg)}). Special task today?`;
    } else if (workerCount < avg * 0.5) {
      anomalyMsg = `

\u{1F514} *Note:* ${workerCount} workers is fewer than usual (avg: ${Math.round(avg)}). Is everything okay on site?`;
    }
  }
  await upsertDailyLog(projectId, { worker_count: workerCount });
  const msg = await ai(
    `Confirm to the user that ${workerCount} workers were logged for today.
    ${anomalyMsg ? "Also note: " + anomalyMsg : ""}
    Tell them to check Daily Accountability page.
    Keep it brief.`,
    `${workerCount} workers logged for today. Check Daily Accountability page.`,
    200,
    lang
  );
  await sendMessage(from, msg);
}
async function handleProgressUpdate(from, _userId, projectId, extracted, rawMessage, lang) {
  const taskLines = rawMessage.split("\n").map((l) => l.replace(/^[\d\.\-\*\•]\s*/, "").trim()).filter(
    (l) => l.length > 5 && !/^(i completed|following tasks|tasks today|completed today)/i.test(l)
  );
  const activityEntry = {
    log_time: (/* @__PURE__ */ new Date()).toISOString().split("T")[1]?.substring(0, 5) || "12:00",
    activity_type: "Milestone",
    description: rawMessage.trim()
  };
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const taskOwnerId = await projectOwnerProfileId(projectId);
  if (taskLines.length > 1) {
    for (const taskText of taskLines) {
      if (!taskOwnerId) {
        console.error("[Task Insert Error] no project owner for", projectId);
        break;
      }
      const { error } = await supabase.from("tasks").insert({
        user_id: taskOwnerId,
        project_id: projectId,
        title: taskText,
        status: "completed",
        source: "whatsapp",
        completed_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso
      });
      if (error) console.error("[Task Insert Error]", error.message);
    }
    await upsertDailyLog(projectId, { notes: taskLines.join("\n"), activity_entries: [activityEntry] });
    const msg = await ai(
      `Tell the user their progress update was logged: ${taskLines.length} tasks: ${taskLines.join(", ")}. Tell them it will appear on their dashboard timeline. Keep it brief and encouraging.`,
      `Logged ${taskLines.length} completed tasks. Check your dashboard timeline.`,
      200,
      lang
    );
    await sendMessage(from, msg);
  } else {
    const note = String(extracted.note || rawMessage).trim();
    await upsertDailyLog(projectId, { notes: note, activity_entries: [activityEntry] });
    if (/finished|completed|done|built|laid|poured|installed/i.test(note)) {
      if (taskOwnerId) {
        await supabase.from("tasks").insert({
          user_id: taskOwnerId,
          project_id: projectId,
          title: note,
          status: "completed",
          source: "whatsapp",
          completed_at: nowIso,
          created_at: nowIso,
          updated_at: nowIso
        });
      } else {
        console.error("[Task Insert Error] no project owner for", projectId);
      }
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
async function handleProjectQuery(from, projectId, projectName) {
  await sendMessage(from, `You are currently working on: ${projectName}`);
}
async function handleIssueReport(from, userId, projectId, extracted, rawMessage, lang) {
  const rawDesc = String(extracted.description || rawMessage).trim();
  const cleanedDesc = rawDesc.replace(/^(log\s+)?(this\s+)?(alert\s+)?(issue|problem|bug|report|alert)[:\s\-]*/i, "").trim();
  const description = cleanedDesc || rawDesc;
  const title = description.length > 80 ? description.substring(0, 77) + "..." : description;
  let severity = "medium";
  const extractedSeverity = String(extracted.severity || "").toLowerCase().trim();
  if (["low", "medium", "high", "critical"].includes(extractedSeverity)) {
    severity = extractedSeverity;
  } else {
    const d = description.toLowerCase();
    if (/emergency|critical|urgent|immediate|danger|collapse|fire|flood|electr|fatal|death/i.test(d)) {
      severity = "critical";
    } else if (/major|severe|structural|crack|unsafe|injur|serious|significant/i.test(d)) {
      severity = "high";
    } else if (/minor|small|slight|low|cosmetic/i.test(d)) {
      severity = "low";
    } else {
      severity = "medium";
    }
  }
  const { error } = await supabase.from("issues").insert({
    project_id: projectId,
    title: title || "Reported issue",
    description: description || null,
    severity,
    status: "open",
    type: "general"
  });
  if (error) {
    console.error("[Issue Report]", error.message);
    await sendMessage(
      from,
      "Sorry, I had trouble logging that issue. Please try again.",
      userId,
      projectId
    );
    return;
  }
  const severityEmoji = severity === "critical" ? "\u{1F6A8}" : severity === "high" ? "\u26A0\uFE0F" : severity === "low" ? "\u{1F535}" : "\u{1F7E1}";
  const msg = await ai(
    `Tell the user their issue was logged immediately: "${title}". Severity was auto-set to ${severity} ${severityEmoji}. It is now visible on the Issues & Risks page on the dashboard. Mention they can say "change the [issue] to high" if the severity is wrong. Plain text, no markdown.`,
    `${severityEmoji} Issue logged: "${title}" (${severity} severity).

View it on the Issues & Risks page. To adjust severity, say "change the [issue] to high" anytime.`,
    200,
    lang
  );
  await sendMessage(from, msg, userId, projectId);
}
async function handleWeatherDelay(from, projectId, extracted, rawMessage) {
  const reason = String(extracted.reason || rawMessage).trim();
  await upsertDailyLog(projectId, { weather_condition: reason, notes: `Delay: ${reason}` });
  const msg = await ai(
    `Tell the user their weather delay has been noted: "${reason}". Tell them it has been added to their project timeline. Express brief empathy about the delay.`,
    `Delay noted: "${reason}". Added to your project timeline.`
  );
  await sendMessage(from, msg);
}
async function handleMaterialQuery(from, projectId, message) {
  const materialKeyword = message.replace(/how (?:much|many)|do (?:i|we) have|in (?:my )?inventory|current stock|stock (?:left|of)|remaining/i, "").replace(/\?|\./g, "").trim().toLowerCase();
  const words = materialKeyword.split(/\s+/).filter((w) => w.length > 2 && !/^(the|and|for|have|has|get)$/.test(w));
  const keyword = words.length > 0 ? words.join(" ") : null;
  if (keyword) {
    const { data: materials2 } = await supabase.from("materials_inventory").select("name, quantity, unit, last_purchased_at, last_used_at").eq("project_id", projectId).ilike("name", `%${keyword}%`).limit(5);
    if (materials2 && materials2.length > 0) {
      const m = materials2[0];
      const qty = parseFloat(String(m.quantity || 0));
      const unit = m.unit || "units";
      const lastPurchased = m.last_purchased_at ? new Date(m.last_purchased_at).toLocaleDateString(void 0, { dateStyle: "medium" }) : "not recorded";
      const reply = `You have ${qty} ${unit} of ${m.name}. Last purchased: ${lastPurchased}.`;
      await sendMessage(from, reply);
      return;
    }
  }
  const { data: materials } = await supabase.from("materials_inventory").select("name, quantity, unit, last_purchased_at").eq("project_id", projectId).order("name");
  if (!materials || materials.length === 0) {
    const msg2 = await ai(
      'Tell the user there are no materials in inventory yet. Give an example: "Received 50 bags cement from Hima".',
      'No materials in inventory yet. Log received stock like: "Received 50 bags cement from Hima"'
    );
    await sendMessage(from, msg2);
    return;
  }
  const lines = materials.map(
    (m) => `\u2022 ${m.name}: ${m.quantity} ${m.unit || "units"}`
  ).join("\n");
  const msg = await ai(
    `Show the user their current inventory:
${lines}
Then tell them they can send "Used X bags cement" to update stock. Be brief.`,
    `Current inventory:

${lines}

Send "Used X bags cement" to update stock.`
  );
  await sendMessage(from, msg);
}
async function handleSmartQuery(from, projectId, question) {
  const workerDateMatch = question.match(/worker|staff|people|men|mason|came|on site/i);
  const dateMatch = question.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)|(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})|(\d{4})-(\d{2})-(\d{2})/i);
  if (workerDateMatch && dateMatch) {
    let logDate;
    const months = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
    if (dateMatch[5] && dateMatch[6] && dateMatch[7]) {
      logDate = `${dateMatch[5]}-${dateMatch[6]}-${dateMatch[7]}`;
    } else if (dateMatch[1] && dateMatch[2]) {
      const month = months[dateMatch[2].toLowerCase()];
      const day = parseInt(dateMatch[1], 10);
      const year = (/* @__PURE__ */ new Date()).getFullYear();
      logDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    } else if (dateMatch[3] && dateMatch[4]) {
      const month = months[dateMatch[3].toLowerCase()];
      const day = parseInt(dateMatch[4], 10);
      const year = (/* @__PURE__ */ new Date()).getFullYear();
      logDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    } else {
      logDate = "";
    }
    if (logDate) {
      const { data: log } = await supabase.from("daily_logs").select("log_date, worker_count, notes").eq("project_id", projectId).eq("log_date", logDate).maybeSingle();
      if (log) {
        const wc = log.worker_count != null ? log.worker_count : "not recorded";
        const dateFormatted2 = (/* @__PURE__ */ new Date(log.log_date + "T12:00:00")).toLocaleDateString("en-UG", { day: "numeric", month: "long", year: "numeric" });
        const reply = wc !== "not recorded" ? `On ${dateFormatted2}: ${wc} workers on site.${log.notes ? ` Notes: ${log.notes}` : ""}` : `On ${dateFormatted2}: No worker count recorded.${log.notes ? ` Notes: ${log.notes}` : ""}`;
        await sendMessage(from, reply);
        return;
      }
      const dateFormatted = (/* @__PURE__ */ new Date(logDate + "T12:00:00")).toLocaleDateString("en-UG", { day: "numeric", month: "long", year: "numeric" });
      await sendMessage(from, `I don't have a log for ${dateFormatted}. Check your Daily Accountability page at ${DASHBOARD_URL}/daily`);
      return;
    }
  }
  const today = /* @__PURE__ */ new Date();
  const todayStr = today.toISOString().split("T")[0];
  const last7Start = new Date(today);
  last7Start.setDate(today.getDate() - 7);
  const last7StartStr = last7Start.toISOString().split("T")[0];
  const last30Start = new Date(today);
  last30Start.setDate(today.getDate() - 30);
  const last30StartStr = last30Start.toISOString().split("T")[0];
  const dayOfWeek = today.getDay();
  const lastMondayCal = new Date(today);
  lastMondayCal.setDate(today.getDate() - dayOfWeek - 6);
  const lastSundayCal = new Date(lastMondayCal);
  lastSundayCal.setDate(lastMondayCal.getDate() + 6);
  const lastWeekStartStr = lastMondayCal.toISOString().split("T")[0];
  const lastWeekEndStr = lastSundayCal.toISOString().split("T")[0];
  const thisMondayCal = new Date(today);
  thisMondayCal.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const thisWeekStartStr = thisMondayCal.toISOString().split("T")[0];
  const thisMonthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthStart = lastMonthDate.toISOString().split("T")[0];
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split("T")[0];
  const q = question.toLowerCase();
  let periodStart = null;
  let periodEnd = todayStr;
  let periodLabel = "";
  const isPurchaseQuery = /what did (i|we) buy|things i purchased|things we purchased|purchases|purchased|bought|buy\b/i.test(q);
  const wantsDetailed = /detailed|detail|breakdown|itemize|items|list|everything|show me/i.test(q) || isPurchaseQuery;
  const lastNDaysMatch = q.match(/(?:last|past)\s+(\d{1,3})\s+days\b|\b(\d{1,3})\s+days\b/);
  const nDaysRaw = lastNDaysMatch ? lastNDaysMatch[1] || lastNDaysMatch[2] : null;
  const nDays = nDaysRaw ? parseInt(nDaysRaw, 10) : NaN;
  if (!isNaN(nDays) && nDays >= 1 && nDays <= 365 && /(last|past)\s+\d{1,3}\s+days|\b\d{1,3}\s+days\b/.test(q)) {
    const start = new Date(today);
    start.setDate(today.getDate() - (nDays - 1));
    periodStart = start.toISOString().split("T")[0];
    periodEnd = todayStr;
    periodLabel = `the last ${nDays} days`;
  } else if (/a month ago|one month ago|month ago/i.test(q)) {
    periodStart = last30StartStr;
    periodEnd = todayStr;
    periodLabel = "the last 30 days";
  } else if (/last 7 days|past 7 days|past week/i.test(q)) {
    periodStart = last7StartStr;
    periodEnd = todayStr;
    periodLabel = "the last 7 days";
  } else if (/last week|previous week/i.test(q)) {
    periodStart = lastWeekStartStr;
    periodEnd = lastWeekEndStr;
    periodLabel = `last week (${lastWeekStartStr} to ${lastWeekEndStr})`;
  } else if (/this week|current week/i.test(q)) {
    periodStart = thisWeekStartStr;
    periodEnd = todayStr;
    periodLabel = "this week";
  } else if (/this month|current month/i.test(q)) {
    periodStart = thisMonthStart;
    periodEnd = todayStr;
    periodLabel = "this month";
  } else if (/last month|previous month/i.test(q)) {
    periodStart = lastMonthStart;
    periodEnd = lastMonthEnd;
    periodLabel = "last month";
  } else if (isPurchaseQuery) {
    periodStart = last30StartStr;
    periodEnd = todayStr;
    periodLabel = "the last 30 days";
  }
  if (periodStart) {
    const { data: periodExpenses } = await supabase.from("expenses").select("description, amount, expense_date").eq("project_id", projectId).gte("expense_date", periodStart).lte("expense_date", periodEnd).order("expense_date", { ascending: false });
    const periodTotal = (periodExpenses || []).reduce((s, e) => s + parseFloat(String(e.amount || 0)), 0);
    if (!periodExpenses || periodExpenses.length === 0) {
      await sendMessage(from, `No expenses recorded for ${periodLabel}.`);
      return;
    }
    const byDate = {};
    for (const e of periodExpenses) {
      const d = e.expense_date || "Unknown";
      byDate[d] = (byDate[d] || 0) + parseFloat(String(e.amount || 0));
    }
    const breakdownLines = Object.entries(byDate).sort(([a], [b]) => b.localeCompare(a)).map(([date, amt]) => {
      const formatted = (/* @__PURE__ */ new Date(date + "T12:00:00")).toLocaleDateString("en-UG", { day: "numeric", month: "long", year: "numeric" });
      return `- ${formatted}: UGX ${fmt(amt)}`;
    }).join("\n");
    const normalizeKey = (desc) => {
      return String(desc || "").toLowerCase().replace(/ugx|shs|shillings?/g, "").replace(/\b\d+(?:[.,]\d+)?\b/g, "").replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 6).join(" ") || "unknown";
    };
    const byItem = {};
    for (const e of periodExpenses) {
      const key = normalizeKey(e.description);
      const amt = parseFloat(String(e.amount || 0));
      byItem[key] = byItem[key] || { total: 0, count: 0 };
      byItem[key].total += amt;
      byItem[key].count += 1;
    }
    const topItemsLines = Object.entries(byItem).sort((a, b) => b[1].total - a[1].total).slice(0, 10).map(([k, v]) => `- ${k}: UGX ${fmt(v.total)} (${v.count})`).join("\n");
    const lineItemsLines = wantsDetailed ? periodExpenses.slice(0, 40).map((e) => {
      const d = e.expense_date ? (/* @__PURE__ */ new Date(e.expense_date + "T12:00:00")).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" }) : "Unknown date";
      const desc = (e.description || "Expense").toString().trim();
      const amt = parseFloat(String(e.amount || 0));
      return `- ${d}: ${desc} \u2014 UGX ${fmt(amt)}`;
    }).join("\n") : "";
    const replyParts = [];
    replyParts.push(`Spending for ${periodLabel} (from ${periodStart} to ${periodEnd}):`);
    replyParts.push(`Total: UGX ${fmt(periodTotal)}`);
    replyParts.push("");
    replyParts.push("Breakdown by date:");
    replyParts.push(breakdownLines);
    if (isPurchaseQuery || wantsDetailed) {
      replyParts.push("");
      replyParts.push("Top items (grouped):");
      replyParts.push(topItemsLines || "- (no item descriptions found)");
    }
    if (wantsDetailed && lineItemsLines) {
      replyParts.push("");
      replyParts.push("Recent line items:");
      replyParts.push(lineItemsLines);
    }
    const reply = replyParts.join("\n");
    await sendMessage(from, reply);
    return;
  }
  const pad2 = (n) => String(n).padStart(2, "0");
  const toYMD = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const twoYearsAgo = /* @__PURE__ */ new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const fromDate = toYMD(twoYearsAgo);
  const { data: project } = await supabase.from("projects").select("name, budget").eq("id", projectId).single();
  const { data: expenses } = await supabase.from("expenses").select("description, amount, expense_date, created_at").eq("project_id", projectId).gte("expense_date", fromDate).order("expense_date", { ascending: false }).limit(500);
  const { data: dailyLogs } = await supabase.from("daily_logs").select("log_date, worker_count, notes").eq("project_id", projectId).gte("log_date", fromDate).order("log_date", { ascending: false }).limit(500);
  const { data: materials } = await supabase.from("materials_inventory").select("name, quantity, unit, last_updated, updated_at").eq("project_id", projectId);
  let vendors = [];
  try {
    const { data: vendorsData } = await supabase.from("vendors").select("name, total_spent").eq("project_id", projectId).order("total_spent", { ascending: false }).limit(100);
    vendors = (vendorsData || []).map((v) => ({
      name: v.name,
      total_spent: parseFloat(String(v.total_spent || 0))
    }));
  } catch {
  }
  const dataContext = {
    project: project ? { name: project.name, budget: project.budget } : null,
    expenses: (expenses || []).map((e) => ({
      description: e.description,
      amount: parseFloat(String(e.amount || 0)),
      date: e.expense_date
    })),
    dailyLogs: (dailyLogs || []).map((l) => ({
      date: l.log_date,
      worker_count: l.worker_count,
      notes: l.notes
    })),
    vendors,
    materialsInventory: (materials || []).map((m) => ({
      name: m.name,
      currentStock: m.quantity,
      unit: m.unit || "units",
      lastUpdated: m.updated_at || m.last_updated
    }))
  };
  const systemPrompt = `You are JengaTrack \u2014 an elite AI construction project assistant combining the expertise of a senior quantity surveyor, financial analyst, project manager, and structural engineer.

RULES:
- Answer project data questions directly and precisely from the data provided. Give actual numbers.
- Answer ANY general construction question (mixing ratios, quantities, costs, building codes, best practices) comprehensively from your expertise as a construction professional.
- Answer Uganda/East Africa market price questions from your knowledge (caveat prices may vary locally).
- NEVER say "I cannot find that", "the data doesn't contain", "I don't have access", "check the dashboard".
- Plain text only. No markdown asterisks or ** bold. Use dashes (-) for lists.
- UGX with commas for all amounts (e.g. 1,500,000 UGX).
- Dates in human-readable format (March 16, 2026 not 2026-03-16).
- For construction knowledge: give specific numbers, ratios, practical steps \u2014 be the expert.`;
  const userMessage = `Project data (JSON):
${JSON.stringify(dataContext)}

User question: "${question}"

Provide a direct, helpful answer based on the data above.`;
  let answer = null;
  if (gemini && process.env.GEMINI_API_KEY) {
    try {
      const model = gemini.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent([systemPrompt, userMessage]);
      answer = result.response.text()?.trim() || null;
      if (answer) console.log("[SmartQuery] Gemini success");
    } catch (err) {
      console.error("[SmartQuery] Gemini failed:", err?.message);
    }
  }
  if (!answer && process.env.OPENAI_API_KEY) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        temperature: 0.3,
        max_tokens: 600
      });
      answer = completion.choices[0]?.message?.content?.trim() || null;
      if (answer) console.log("[SmartQuery] GPT-4o success");
    } catch (err) {
      console.error("[SmartQuery] OpenAI failed:", err?.message);
    }
  }
  if (answer) {
    await sendMessage(from, answer);
  } else {
    await sendMessage(from, await ai(
      "Tell the user you could not generate an answer right now. Suggest they try asking something like: How much did I spend on cement last month? Compare spending this month vs last month. Be brief.",
      'Could not generate an answer right now. Try: "How much did I spend on cement last month?" or "Compare spending this month vs last month"'
    ));
  }
}
async function handleNaturalLanguageQuery(from, userId, projectId, rawMessage) {
  if (!projectId) {
    return 'Please select a project first. Reply with the project number from your list, or say "list projects" to see options.';
  }
  const { data: project } = await supabase.from("projects").select("id, name, budget, user_id, manager_id").eq("id", projectId).single();
  if (!project || project.user_id !== userId && project.manager_id !== userId) {
    return 'Project not found. Say "list projects" to switch.';
  }
  const whenDidIBuyMatch = rawMessage.match(/when\s+did\s+I\s+(?:last\s+)?buy\s+(.+?)(?:\?|$)/i);
  if (whenDidIBuyMatch) {
    const material = whenDidIBuyMatch[1].trim();
    if (material) {
      const { data: lastPurchase } = await supabase.from("expenses").select("description, amount, expense_date, created_at").eq("project_id", projectId).ilike("description", `%${material}%`).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (lastPurchase) {
        const dateStr = lastPurchase.expense_date || (lastPurchase.created_at || "").split("T")[0];
        const dateFormatted = dateStr ? (/* @__PURE__ */ new Date(dateStr + "T12:00:00")).toLocaleDateString("en-UG", { day: "numeric", month: "long", year: "numeric" }) : dateStr;
        const amount = parseFloat(String(lastPurchase.amount || 0));
        return `You last bought ${lastPurchase.description || "it"} on ${dateFormatted} for ${fmt(amount)} UGX.`;
      }
      return `I couldn't find a purchase of ${material} in this project's expense history.`;
    }
  }
  const { data: profileFull } = await supabase.from("profiles").select("*").eq("id", userId).single();
  const { data: ownedProjects } = await supabase.from("projects").select("id, name").eq("user_id", userId);
  const { data: managedProjects } = await supabase.from("projects").select("id, name").eq("manager_id", userId);
  const merged = [...ownedProjects || [], ...managedProjects || []].filter(
    (p, i, self) => i === self.findIndex((t) => t.id === p.id)
  );
  return await runAgent(userId, projectId, rawMessage, profileFull || {}, merged);
}
function parseToolCall(text) {
  const stripped = text.replace(/```(?:json)?\s*([\s\S]*?)```/g, "$1").trim();
  try {
    const parsed = JSON.parse(stripped);
    if (parsed.tool && parsed.params !== void 0) return parsed;
  } catch {
  }
  const start = stripped.indexOf('{"tool"');
  if (start === -1) return null;
  let depth = 0;
  let end = -1;
  for (let i = start; i < stripped.length; i++) {
    if (stripped[i] === "{") depth++;
    else if (stripped[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) return null;
  try {
    const parsed = JSON.parse(stripped.substring(start, end));
    if (parsed.tool && parsed.params !== void 0) return parsed;
  } catch {
  }
  return null;
}
async function toolUpdateProfile(userId, params) {
  const { full_name, whatsapp_number, preferred_language } = params;
  const updates = { updated_at: (/* @__PURE__ */ new Date()).toISOString() };
  if (full_name) updates.full_name = String(full_name).trim();
  if (whatsapp_number) {
    const cleaned = String(whatsapp_number).replace(/\s/g, "").trim();
    if (!/^\+\d{7,15}$/.test(cleaned)) {
      return { success: false, reply: "Please use a valid international format for your number, e.g. +256701234567." };
    }
    updates.whatsapp_number = cleaned;
  }
  if (preferred_language) {
    const lang = String(preferred_language).toLowerCase().trim();
    if (!["en", "lg", "sw"].includes(lang)) {
      return { success: false, reply: "Supported languages are: en (English), lg (Luganda), sw (Swahili)." };
    }
    updates.preferred_language = lang;
  }
  if (Object.keys(updates).length === 1) {
    return { success: false, reply: "Please tell me what to update \u2014 your name, WhatsApp number, or language preference." };
  }
  const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
  if (error) return { success: false, reply: "Failed to update your profile. Please try again." };
  const parts = [];
  if (updates.full_name) parts.push(`name updated to "${updates.full_name}"`);
  if (updates.whatsapp_number) parts.push(`WhatsApp number updated to ${updates.whatsapp_number}`);
  if (updates.preferred_language) parts.push(`language set to ${updates.preferred_language}`);
  return { success: true, reply: `\u2705 Profile updated! ${parts.join(", ")}.`, data: updates };
}
async function toolCreateProject(userId, params) {
  const { name, budget, description, location } = params;
  if (!name || String(name).trim().length < 2) {
    return { success: false, reply: "Please provide a project name (at least 2 characters)." };
  }
  const budgetVal = budget ? parseFloat(String(budget)) : 0;
  const desc = description || location || null;
  const { data: newProject, error } = await supabase.from("projects").insert({
    name: String(name).trim(),
    description: desc,
    budget: budgetVal > 0 ? budgetVal : 0,
    spent: 0,
    user_id: userId,
    status: "active",
    currency: "UGX",
    channel_type: "direct",
    created_at: (/* @__PURE__ */ new Date()).toISOString(),
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }).select("id, name").single();
  if (error || !newProject) return { success: false, reply: `Failed to create the project. ${error?.message || "Please try again."}` };
  await supabase.from("profiles").update({
    active_project_id: newProject.id,
    active_project_set_at: (/* @__PURE__ */ new Date()).toISOString(),
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("id", userId);
  return {
    success: true,
    reply: `\u2705 Project created! *${newProject.name}* is now your active project${budgetVal > 0 ? ` with a budget of UGX ${fmt(budgetVal)}` : ""}. You can start logging expenses, materials, and daily updates. View it at ${DASHBOARD_URL}/dashboard`,
    data: { projectId: newProject.id, projectName: newProject.name }
  };
}
async function toolAcknowledgeIssue(projectId, params) {
  const { title_keyword } = params;
  if (!title_keyword) return { success: false, reply: "Please specify which issue to acknowledge (part of its title)." };
  const { data: issues } = await supabase.from("issues").select("id, title").eq("project_id", projectId).ilike("title", `%${title_keyword}%`).eq("status", "open").limit(1);
  if (!issues || issues.length === 0) {
    return { success: false, reply: `No open issue found matching "${title_keyword}". It may already be acknowledged or resolved.` };
  }
  const issue = issues[0];
  await supabase.from("issues").update({
    status: "acknowledged",
    acknowledged_at: (/* @__PURE__ */ new Date()).toISOString(),
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("id", issue.id);
  return { success: true, reply: `\u2705 Issue acknowledged: "${issue.title}". It will show as acknowledged on the Issues & Risks page.`, data: { title: issue.title } };
}
async function toolEditExpense(projectId, params) {
  const { description_keyword, new_amount, new_description, date } = params;
  if (!description_keyword) {
    return { success: false, reply: 'Please say which expense to edit (part of the description), e.g. "edit the cement expense".' };
  }
  const query = supabase.from("expenses").select("id, description, amount, expense_date").eq("project_id", projectId).ilike("description", `%${description_keyword}%`).order("expense_date", { ascending: false }).limit(1);
  const { data: expenses } = await query;
  if (!expenses || expenses.length === 0) {
    return { success: false, reply: `No expense found matching "${description_keyword}". Check the Budgets & Costs page for the exact name.` };
  }
  const expense = expenses[0];
  const updates = { updated_at: (/* @__PURE__ */ new Date()).toISOString() };
  if (new_amount != null && parseFloat(String(new_amount)) > 0) updates.amount = String(parseFloat(String(new_amount)));
  if (new_description) updates.description = String(new_description).trim();
  if (date) updates.expense_date = date;
  if (Object.keys(updates).length === 1) {
    return { success: false, reply: "Please specify the new amount, description, or date for this expense." };
  }
  const { error } = await supabase.from("expenses").update(updates).eq("id", expense.id);
  if (error) return { success: false, reply: "Failed to update that expense. Please try again." };
  const oldAmt = parseFloat(String(expense.amount || 0));
  const newAmt = updates.amount ? parseFloat(updates.amount) : oldAmt;
  const parts = [];
  if (updates.amount) parts.push(`amount changed from UGX ${fmt(oldAmt)} \u2192 UGX ${fmt(newAmt)}`);
  if (updates.description) parts.push(`description updated to "${updates.description}"`);
  if (updates.expense_date) parts.push(`date changed to ${(/* @__PURE__ */ new Date(updates.expense_date + "T12:00:00")).toLocaleDateString("en-UG", { day: "numeric", month: "long", year: "numeric" })}`);
  return { success: true, reply: `\u2705 Expense updated! "${expense.description}" \u2014 ${parts.join(", ")}. Dashboard will reflect the change.`, data: { id: expense.id } };
}
async function toolDeleteExpense(projectId, params) {
  const { description_keyword } = params;
  if (!description_keyword) {
    return { success: false, reply: 'Please specify which expense to delete (part of the description), e.g. "delete the cement expense".' };
  }
  const { data: expenses } = await supabase.from("expenses").select("id, description, amount, expense_date").eq("project_id", projectId).ilike("description", `%${description_keyword}%`).order("expense_date", { ascending: false }).limit(1);
  if (!expenses || expenses.length === 0) {
    return { success: false, reply: `No expense found matching "${description_keyword}". Check the Budgets & Costs page for the exact name.` };
  }
  const expense = expenses[0];
  const amt = parseFloat(String(expense.amount || 0));
  const { error } = await supabase.from("expenses").delete().eq("id", expense.id);
  if (error) return { success: false, reply: "Failed to delete that expense. Please try again." };
  return {
    success: true,
    reply: `\u2705 Deleted! Expense "${expense.description}" \u2014 UGX ${fmt(amt)} has been removed. Your budget and dashboard have been updated.`,
    data: { deleted: expense.description, amount: amt }
  };
}
async function toolUpdateProject(projectId, params) {
  const { budget, name, description, status } = params;
  const updateData = { updated_at: (/* @__PURE__ */ new Date()).toISOString() };
  if (budget != null && parseFloat(String(budget)) > 0) updateData.budget = parseFloat(String(budget));
  if (name && String(name).trim().length > 2) {
    const { data: current } = await supabase.from("projects").select("name").eq("id", projectId).single();
    const newName = String(name).trim();
    if (current && newName !== current.name) {
      updateData.name = newName;
    }
  }
  if (description) updateData.description = String(description).trim();
  if (status) {
    const s = String(status).toLowerCase();
    if (["active", "completed", "paused", "on_hold", "archived"].includes(s)) updateData.status = s;
  }
  if (Object.keys(updateData).length === 1) return { success: false, reply: "Please specify what to update \u2014 budget, name, description, or status." };
  const { error } = await supabase.from("projects").update(updateData).eq("id", projectId);
  if (error) return { success: false, reply: "Failed to update project. Please try again." };
  const parts = [];
  if (updateData.budget) parts.push(`budget updated to UGX ${fmt(updateData.budget)}`);
  if (updateData.name) parts.push(`name updated to "${updateData.name}"`);
  if (updateData.description) parts.push("description updated");
  if (updateData.status) parts.push(`status set to ${updateData.status}`);
  return { success: true, reply: `\u2705 Project updated! ${parts.join(", ")}. Refresh your dashboard to see the changes.`, data: updateData };
}
async function toolResolveIssue(projectId, params) {
  const { title_keyword, resolution_note } = params;
  if (!title_keyword) return { success: false, reply: "Please specify which issue to resolve (part of its title)." };
  const { data: issues } = await supabase.from("issues").select("id, title").eq("project_id", projectId).ilike("title", `%${title_keyword}%`).in("status", ["open", "acknowledged"]).limit(1);
  if (!issues || issues.length === 0) return { success: false, reply: `No open issue found matching "${title_keyword}". Check the Issues page for the exact title.` };
  const issue = issues[0];
  await supabase.from("issues").update({ status: "resolved", resolved_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", issue.id);
  return { success: true, reply: `\u2705 Issue resolved: "${issue.title}".${resolution_note ? " Note: " + resolution_note : ""} View on Issues & Risks page.`, data: { title: issue.title } };
}
async function toolLogWeatherDelay(projectId, params) {
  const { reason, date } = params;
  if (!reason) return { success: false, reply: "Please describe the weather delay." };
  const logDate = date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const delayNote = `Weather delay: ${reason}`;
  const { data: existing } = await supabase.from("daily_logs").select("id, notes").eq("project_id", projectId).eq("log_date", logDate).maybeSingle();
  if (existing) {
    await supabase.from("daily_logs").update({ weather_condition: reason, notes: existing.notes ? `${existing.notes}
${delayNote}` : delayNote, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", existing.id);
  } else {
    await supabase.from("daily_logs").insert({ project_id: projectId, log_date: logDate, weather_condition: reason, notes: delayNote });
  }
  const dateLabel = (/* @__PURE__ */ new Date(logDate + "T12:00:00")).toLocaleDateString("en-UG", { day: "numeric", month: "long" });
  return { success: true, reply: `\u2705 Weather delay logged for ${dateLabel}: "${reason}". Added to your daily timeline.`, data: { reason, logDate } };
}
async function toolCreateTask(_actingUserId, projectId, params) {
  const { title, status } = params;
  if (!title) return { success: false, reply: "Please provide a task title." };
  const taskOwnerId = await projectOwnerProfileId(projectId);
  if (!taskOwnerId) return { success: false, reply: "Could not resolve this project. Try again or open the dashboard." };
  const taskStatus = ["pending", "completed", "in_progress"].includes(String(status || "").toLowerCase()) ? String(status).toLowerCase() : "pending";
  const ts = (/* @__PURE__ */ new Date()).toISOString();
  const { error } = await supabase.from("tasks").insert({
    user_id: taskOwnerId,
    project_id: projectId,
    title: String(title).trim(),
    status: taskStatus,
    source: "whatsapp",
    created_at: ts,
    updated_at: ts,
    ...taskStatus === "completed" ? { completed_at: ts } : {}
  });
  if (error) return { success: false, reply: "Failed to create task. Please try again." };
  return { success: true, reply: `\u2705 Task created: "${title}" (${taskStatus}). View on your dashboard.`, data: { title, status: taskStatus } };
}
async function toolUpdateTask(projectId, params) {
  const { title_keyword, status, new_title } = params;
  if (!title_keyword) return { success: false, reply: "Please specify which task to update." };
  const { data: task } = await supabase.from("tasks").select("id, title, status").eq("project_id", projectId).is("deleted_at", null).ilike("title", `%${title_keyword}%`).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!task) return { success: false, reply: `No task found matching "${title_keyword}". Check your task list and try again.` };
  const updates = { updated_at: (/* @__PURE__ */ new Date()).toISOString() };
  if (status) {
    const s = String(status).toLowerCase();
    if (!["pending", "in_progress", "completed"].includes(s)) {
      return { success: false, reply: "Status must be pending, in_progress, or completed." };
    }
    updates.status = s;
    if (s === "completed") updates.completed_at = (/* @__PURE__ */ new Date()).toISOString();
  }
  if (new_title) updates.title = String(new_title).trim();
  const { error } = await supabase.from("tasks").update(updates).eq("id", task.id);
  if (error) return { success: false, reply: "Failed to update the task. Please try again." };
  const displayStatus = updates.status || task.status;
  return { success: true, reply: `\u2705 Task "${task.title}" updated to *${displayStatus}*.`, data: { title: task.title, status: displayStatus } };
}
async function toolDeleteTask(projectId, params) {
  const { title_keyword } = params;
  if (!title_keyword) return { success: false, reply: "Please specify which task to delete." };
  const { data: task } = await supabase.from("tasks").select("id, title").eq("project_id", projectId).is("deleted_at", null).ilike("title", `%${title_keyword}%`).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!task) return { success: false, reply: `No task found matching "${title_keyword}".` };
  const { error } = await supabase.from("tasks").update({ deleted_at: (/* @__PURE__ */ new Date()).toISOString(), updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", task.id);
  if (error) return { success: false, reply: "Failed to delete the task. Please try again." };
  return { success: true, reply: `\u{1F5D1}\uFE0F Task "${task.title}" deleted.`, data: { title: task.title } };
}
async function toolUpdateIssue(projectId, params) {
  const { title_keyword, severity, description } = params;
  if (!title_keyword) return { success: false, reply: "Please specify which issue to update." };
  const { data: issue } = await supabase.from("issues").select("id, title, severity, description").eq("project_id", projectId).ilike("title", `%${title_keyword}%`).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!issue) return { success: false, reply: `No issue found matching "${title_keyword}".` };
  const updates = { updated_at: (/* @__PURE__ */ new Date()).toISOString() };
  if (severity) {
    const s = String(severity).toLowerCase();
    if (!["low", "medium", "high", "critical"].includes(s)) {
      return { success: false, reply: "Severity must be low, medium, high, or critical." };
    }
    updates.severity = s;
  }
  if (description) updates.description = String(description).trim();
  const { error } = await supabase.from("issues").update(updates).eq("id", issue.id);
  if (error) return { success: false, reply: "Failed to update the issue. Please try again." };
  const parts = [];
  if (updates.severity) parts.push(`severity \u2192 *${updates.severity}*`);
  if (updates.description) parts.push("description updated");
  return { success: true, reply: `\u2705 Issue "${issue.title}" updated: ${parts.join(", ")}.`, data: { title: issue.title } };
}
async function toolDeleteIssue(projectId, params) {
  const { title_keyword } = params;
  if (!title_keyword) return { success: false, reply: "Please specify which issue to delete." };
  const { data: issue } = await supabase.from("issues").select("id, title").eq("project_id", projectId).ilike("title", `%${title_keyword}%`).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!issue) return { success: false, reply: `No issue found matching "${title_keyword}".` };
  const { error } = await supabase.from("issues").delete().eq("id", issue.id);
  if (error) return { success: false, reply: "Failed to delete the issue. Please try again." };
  return { success: true, reply: `\u{1F5D1}\uFE0F Issue "${issue.title}" removed from the project.`, data: { title: issue.title } };
}
async function toolLogExpense(userId, projectId, params) {
  const { description, amount, items, date, vendor } = params;
  const expenseDate = date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  if (items && Array.isArray(items) && items.length > 0) {
    for (const item of items) {
      const amt2 = parseFloat(String(item.total || item.amount || 0));
      const desc = item.item ? `${item.quantity || 1} ${item.unit || "units"} of ${item.item}` : description || "Expense";
      await supabase.from("expenses").insert({
        user_id: userId,
        project_id: projectId,
        description: desc,
        amount: String(amt2),
        quantity_logged: item.quantity ? String(item.quantity) : null,
        currency: "UGX",
        expense_date: expenseDate,
        source: "whatsapp"
      });
      const itemName = String(item.item || "").toLowerCase().trim();
      const isMat = MATERIAL_KEYWORDS.some((k) => itemName.includes(k)) && !SKIP_KEYWORDS.some((k) => itemName.includes(k));
      if (isMat && item.quantity > 0 && itemName.length >= 2 && !GARBAGE_MATERIAL_NAMES.includes(itemName)) {
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const uc = amt2 / (item.quantity || 1);
        const { data: ex } = await supabase.from("materials_inventory").select("id, quantity, total_cost").eq("project_id", projectId).eq("name", itemName).maybeSingle();
        if (ex) {
          await supabase.from("materials_inventory").update({ quantity: parseFloat(String(ex.quantity || 0)) + item.quantity, unit_cost: uc, total_cost: parseFloat(String(ex.total_cost || 0)) + amt2, last_purchased_at: now, updated_at: now }).eq("id", ex.id);
        } else {
          await supabase.from("materials_inventory").insert({ project_id: projectId, user_id: userId, name: itemName, quantity: item.quantity, unit: item.unit || "units", unit_cost: uc, total_cost: amt2, source: "whatsapp", last_purchased_at: now, updated_at: now });
        }
      }
    }
    const total = items.reduce((s, i) => s + parseFloat(String(i.total || i.amount || 0)), 0);
    const lines = items.map((i) => `\u2022 ${i.quantity || 1} ${i.unit || "units"} of ${i.item} \u2014 UGX ${fmt(parseFloat(String(i.total || i.amount || 0)))}`).join("\n");
    return { success: true, reply: `\u2705 Logged ${items.length} items:
${lines}
Total: UGX ${fmt(total)}`, data: { total } };
  }
  const amt = parseFloat(String(amount || 0));
  if (!amt || amt <= 0) return { success: false, reply: 'Please include the amount. E.g. "Paid plumber 150k" or "Bought cement for 400,000 UGX".' };
  const { error } = await supabase.from("expenses").insert({
    user_id: userId,
    project_id: projectId,
    description: description || `Expense: ${fmt(amt)} UGX`,
    amount: String(amt),
    currency: "UGX",
    expense_date: expenseDate,
    source: "whatsapp"
  });
  if (error) return { success: false, reply: "Failed to save that expense. Please try again." };
  if (vendor) await upsertVendor(projectId, vendor, amt);
  if (params.item && params.quantity > 0) {
    const itemName = String(params.item).toLowerCase().trim();
    const isMat = MATERIAL_KEYWORDS.some((k) => itemName.includes(k)) && !SKIP_KEYWORDS.some((k) => itemName.includes(k));
    if (isMat && !GARBAGE_MATERIAL_NAMES.includes(itemName)) {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const uc = amt / params.quantity;
      const { data: ex } = await supabase.from("materials_inventory").select("id, quantity, total_cost").eq("project_id", projectId).eq("name", itemName).maybeSingle();
      if (ex) {
        await supabase.from("materials_inventory").update({ quantity: parseFloat(String(ex.quantity || 0)) + params.quantity, unit_cost: uc, total_cost: parseFloat(String(ex.total_cost || 0)) + amt, last_purchased_at: now, updated_at: now }).eq("id", ex.id);
      } else {
        await supabase.from("materials_inventory").insert({ project_id: projectId, user_id: userId, name: itemName, quantity: params.quantity, unit: params.unit || "units", unit_cost: uc, total_cost: amt, source: "whatsapp", last_purchased_at: now, updated_at: now });
      }
    }
  }
  const { data: allEx } = await supabase.from("expenses").select("amount").eq("project_id", projectId);
  const { data: proj } = await supabase.from("projects").select("budget").eq("id", projectId).single();
  const totalSpentNow = (allEx || []).reduce((s, e) => s + parseFloat(String(e.amount || 0)), 0);
  const budgetVal = parseFloat(String(proj?.budget || 0));
  const pct = budgetVal > 0 ? Math.round(totalSpentNow / budgetVal * 100) : 0;
  let budgetNote = "";
  if (pct >= 100) budgetNote = "\n\u{1F6A8} Budget exceeded!";
  else if (pct >= 80) budgetNote = `
\u26A0\uFE0F Budget at ${pct}% \u2014 running low.`;
  return { success: true, reply: `\u2705 Logged! ${description || "Expense"} \u2014 UGX ${fmt(amt)}.${budgetNote}`, data: { amount: amt, description } };
}
async function toolLogLabor(userId, projectId, params) {
  const { worker_count, amount, description, date } = params;
  const wc = parseInt(String(worker_count || 0), 10) || 0;
  const amt = parseFloat(String(amount || 0));
  if (wc > 0) await upsertDailyLog(projectId, { worker_count: wc });
  if (amt > 0) {
    const expenseDate = date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    await supabase.from("expenses").insert({
      user_id: userId,
      project_id: projectId,
      description: description || `Labour \u2014 ${wc > 0 ? wc + " workers" : "site crew"}`,
      amount: String(amt),
      currency: "UGX",
      expense_date: expenseDate,
      source: "whatsapp"
    });
  }
  const parts = [];
  if (wc > 0) parts.push(`${wc} workers logged`);
  if (amt > 0) parts.push(`UGX ${fmt(amt)} recorded`);
  if (parts.length === 0) return { success: false, reply: 'Please include worker count or payment amount. E.g. "6 workers today" or "Paid 10 workers 20k each".' };
  return { success: true, reply: `\u2705 ${parts.join(". ")}.`, data: { worker_count: wc, amount: amt } };
}
async function toolUpdateInventory(userId, projectId, params) {
  const { material_name, action, quantity, unit } = params;
  if (!material_name) return { success: false, reply: "Please specify the material name." };
  if (!quantity || parseFloat(String(quantity)) <= 0) return { success: false, reply: "Please specify the quantity." };
  const name = String(material_name).toLowerCase().trim();
  const qty = parseFloat(String(quantity));
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const { data: existing } = await supabase.from("materials_inventory").select("id, quantity, unit").eq("project_id", projectId).eq("name", name).maybeSingle();
  if (action === "use" || action === "used") {
    if (!existing) return { success: false, reply: `"${material_name}" is not in your inventory yet. Log a purchase first.` };
    const newQty = Math.max(0, parseFloat(String(existing.quantity || 0)) - qty);
    await supabase.from("materials_inventory").update({ quantity: newQty, last_used_at: now, updated_at: now }).eq("id", existing.id);
    const lowWarn = newQty <= 5 ? " \u26A0\uFE0F Low stock!" : "";
    return { success: true, reply: `\u2705 Updated! Used ${qty} ${unit || existing.unit || "units"} of ${material_name}. Remaining: ${newQty} ${unit || existing.unit || "units"}.${lowWarn}`, data: { newQty } };
  }
  if (action === "set") {
    if (existing) {
      await supabase.from("materials_inventory").update({ quantity: qty, unit: unit || existing.unit, updated_at: now }).eq("id", existing.id);
    } else {
      await supabase.from("materials_inventory").insert({ project_id: projectId, user_id: userId, name, quantity: qty, unit: unit || "units", updated_at: now });
    }
    return { success: true, reply: `\u2705 Stock set! ${material_name}: ${qty} ${unit || "units"}.`, data: { newQty: qty } };
  }
  if (existing) {
    const newQty = parseFloat(String(existing.quantity || 0)) + qty;
    await supabase.from("materials_inventory").update({ quantity: newQty, last_purchased_at: now, updated_at: now }).eq("id", existing.id);
    return { success: true, reply: `\u2705 Added! ${material_name} stock is now ${newQty} ${unit || existing.unit || "units"}.`, data: { newQty } };
  }
  await supabase.from("materials_inventory").insert({ project_id: projectId, user_id: userId, name, quantity: qty, unit: unit || "units", source: "whatsapp", last_purchased_at: now, updated_at: now });
  return { success: true, reply: `\u2705 Logged! ${qty} ${unit || "units"} of ${material_name} added to inventory.`, data: { newQty: qty } };
}
async function toolDeleteMaterial(projectId, params) {
  const { material_name } = params;
  if (!material_name) return { success: false, reply: "Please specify the material name to delete." };
  const name = String(material_name).toLowerCase().trim();
  const { data: existing } = await supabase.from("materials_inventory").select("id, name, quantity, unit").eq("project_id", projectId).ilike("name", `%${name}%`).maybeSingle();
  if (!existing) return { success: false, reply: `No material matching "${material_name}" found in inventory.` };
  const { error } = await supabase.from("materials_inventory").delete().eq("id", existing.id);
  if (error) return { success: false, reply: "Could not delete that material. Try again." };
  return { success: true, reply: `\u{1F5D1}\uFE0F Removed "${existing.name}" (${existing.quantity} ${existing.unit || "units"}) from Materials & Supplies.`, data: { name: existing.name } };
}
async function toolRenameMaterial(projectId, params) {
  const { old_name, new_name } = params;
  if (!old_name || !new_name) return { success: false, reply: "Please provide both the current name and the new name." };
  const oldNorm = String(old_name).toLowerCase().trim();
  const newNorm = String(new_name).toLowerCase().trim();
  if (oldNorm === newNorm) return { success: false, reply: "The new name is the same as the current name." };
  const { data: existing } = await supabase.from("materials_inventory").select("id, name").eq("project_id", projectId).ilike("name", `%${oldNorm}%`).maybeSingle();
  if (!existing) return { success: false, reply: `No material matching "${old_name}" found in inventory.` };
  const { error } = await supabase.from("materials_inventory").update({ name: newNorm, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", existing.id);
  if (error) return { success: false, reply: "Could not rename that material. Try again." };
  return { success: true, reply: `\u2705 Renamed "${existing.name}" \u2192 "${newNorm}" in Materials & Supplies.`, data: { oldName: existing.name, newName: newNorm } };
}
async function toolSetMaterialThreshold(projectId, params) {
  const { material_name, threshold } = params;
  if (!material_name) return { success: false, reply: "Please specify the material name." };
  const thr = parseInt(String(threshold ?? 0), 10);
  if (isNaN(thr) || thr < 0) return { success: false, reply: "Please provide a valid threshold number (e.g. 10)." };
  const name = String(material_name).toLowerCase().trim();
  const { data: existing } = await supabase.from("materials_inventory").select("id, name").eq("project_id", projectId).ilike("name", `%${name}%`).maybeSingle();
  if (!existing) return { success: false, reply: `No material matching "${material_name}" found in inventory.` };
  const { error } = await supabase.from("materials_inventory").update({ low_stock_threshold: thr, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", existing.id);
  if (error) return { success: false, reply: "Could not update the threshold. Try again." };
  return { success: true, reply: `\u2705 Low stock alert for "${existing.name}" set to ${thr} units. You will be warned when stock drops to or below this.`, data: { name: existing.name, threshold: thr } };
}
async function toolDeleteProject(userId, projectId, params) {
  const { data: project } = await supabase.from("projects").select("name, user_id").eq("id", projectId).single();
  if (!project) return { success: false, reply: "Project not found." };
  if (project.user_id !== userId) return { success: false, reply: "Only the project owner can delete a project." };
  if (!params.confirmed) {
    return { success: false, reply: `\u26A0\uFE0F You are about to permanently delete "${project.name}" and ALL its data (expenses, materials, logs, tasks, issues). This cannot be undone.

To confirm, say: "Yes delete ${project.name} permanently"` };
  }
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) return { success: false, reply: "Could not delete the project. Try again or use the dashboard Settings page." };
  await supabase.from("profiles").update({ active_project_id: null, active_project_set_at: null, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", userId).eq("active_project_id", projectId);
  return { success: true, reply: `\u{1F5D1}\uFE0F Project "${project.name}" has been permanently deleted. All data removed.`, data: { deletedName: project.name } };
}
async function toolLogIssue(projectId, params) {
  const { title, description, severity } = params;
  if (!title) return { success: false, reply: "Please describe the issue so I can log it." };
  const sev = ["low", "medium", "high", "critical"].includes(String(severity || "").toLowerCase()) ? String(severity).toLowerCase() : "medium";
  const { error } = await supabase.from("issues").insert({
    project_id: projectId,
    title: String(title).substring(0, 120),
    description: description || title,
    severity: sev,
    status: "open",
    type: "general"
  });
  if (error) return { success: false, reply: "Failed to log that issue. Please try again or report from the dashboard." };
  return { success: true, reply: `\u2705 Issue logged: "${title}" (${sev} severity). View it on the Issues & Risks page.`, data: { title, severity: sev } };
}
async function toolLogProgress(projectId, params) {
  const { description, worker_count, date } = params;
  if (!description) return { success: false, reply: "Please describe the progress update." };
  const logTime = (/* @__PURE__ */ new Date()).toISOString().split("T")[1]?.substring(0, 5) || "12:00";
  const entry = { log_time: logTime, activity_type: "Milestone", description };
  const updateData = { notes: description, activity_entries: [entry] };
  const wc = parseInt(String(worker_count || 0), 10);
  if (wc > 0) updateData.worker_count = wc;
  if (date) {
    const { data: existing } = await supabase.from("daily_logs").select("id, notes, activity_entries").eq("project_id", projectId).eq("log_date", date).maybeSingle();
    if (existing) {
      const existingEntries = Array.isArray(existing.activity_entries) ? existing.activity_entries : [];
      await supabase.from("daily_logs").update({ notes: existing.notes ? `${existing.notes}
${description}` : description, activity_entries: [...existingEntries, entry], updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", existing.id);
    } else {
      await supabase.from("daily_logs").insert({ project_id: projectId, log_date: date, ...updateData });
    }
  } else {
    await upsertDailyLog(projectId, updateData);
  }
  return { success: true, reply: `\u2705 Progress logged! "${description}" added to your daily timeline.`, data: { description } };
}
async function toolSwitchProject(userId, params, allProjects) {
  const { project_name_or_id } = params;
  if (!project_name_or_id) return { success: false, reply: "Please specify the project name." };
  const search = String(project_name_or_id).toLowerCase().trim();
  const matched = allProjects.find((p) => {
    const pname = String(p.name).toLowerCase();
    return p.id === project_name_or_id || pname === search || pname.includes(search) || search.includes(pname.split(" ")[0]);
  });
  if (!matched) {
    const names = allProjects.map((p) => p.name).join(", ");
    return { success: false, reply: `No project found matching "${project_name_or_id}". Your projects: ${names || "none"}. Say "list projects" to see options.` };
  }
  await supabase.from("profiles").update({ active_project_id: matched.id, active_project_set_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", userId);
  return { success: true, reply: `\u2705 Switched to "${matched.name}". How can I help with this project?`, data: { projectId: matched.id, projectName: matched.name } };
}
async function toolUpdateDailyLog(projectId, params) {
  const { date, worker_count, notes, milestones } = params;
  const wc = worker_count != null ? parseInt(String(worker_count), 10) : null;
  const updateData = {};
  if (wc && wc > 0) updateData.worker_count = wc;
  if (notes) updateData.notes = notes;
  if (milestones) updateData.milestones = milestones;
  if (Object.keys(updateData).length === 0) return { success: false, reply: "Nothing to update. Specify worker count, notes, or milestones." };
  const logDate = date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const { data: existing } = await supabase.from("daily_logs").select("id, notes").eq("project_id", projectId).eq("log_date", logDate).maybeSingle();
  if (existing) {
    if (notes && existing.notes) updateData.notes = `${existing.notes}
${notes}`;
    await supabase.from("daily_logs").update({ ...updateData, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", existing.id);
  } else {
    await supabase.from("daily_logs").insert({ project_id: projectId, log_date: logDate, ...updateData });
  }
  const parts = [];
  if (wc && wc > 0) parts.push(`${wc} workers`);
  if (notes) parts.push("notes saved");
  if (milestones) parts.push("milestones recorded");
  return { success: true, reply: `\u2705 Daily log updated! ${parts.join(", ")}.`, data: updateData };
}
const STEP9_AGENT_BUDGET_MS = 45e3;
const STEP9_TIMEOUT_REPLY = "Hi! JengaTrack here \u2014 how can I help with your project today? Ask about spending, materials, or tell me what you bought.";
async function runAgentWithTimeBudget(userId, projectId, rawMessage, profile, allProjects) {
  let settled = false;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.warn(`[Agent] ${STEP9_AGENT_BUDGET_MS}ms budget \u2014 sync fallback (no ai() on timeout path)`);
      resolve(STEP9_TIMEOUT_REPLY);
    }, STEP9_AGENT_BUDGET_MS);
    runAgent(userId, projectId, rawMessage, profile, allProjects).then((r) => {
      if (settled) return;
      settled = true;
      clearTimeout(t);
      resolve(r);
    }).catch((e) => {
      if (settled) return;
      settled = true;
      clearTimeout(t);
      reject(e);
    });
  });
}
async function runAgent(userId, projectId, rawMessage, profile, allProjects) {
  console.log("[Agent] Loading DB context\u2026");
  const [
    projectRes,
    expensesRecentRes,
    expensesFullRes,
    materialsRes,
    vendorsRes,
    dailyLogsRes,
    issuesRes,
    tasksRes,
    materialTxRes
  ] = await Promise.all([
    supabase.from("projects").select("id, name, budget, status, description, start_date").eq("id", projectId).single(),
    supabase.from("expenses").select("description, amount, expense_date").eq("project_id", projectId).order("expense_date", { ascending: false }).limit(120),
    supabase.from("expenses").select("description, amount, expense_date").eq("project_id", projectId).order("expense_date", { ascending: false }).limit(1500),
    supabase.from("materials_inventory").select("name, quantity, unit, unit_cost, total_cost, last_purchased_at, last_used_at, low_stock_threshold").eq("project_id", projectId).order("name"),
    supabase.from("vendors").select("name, total_spent, total_transactions").eq("project_id", projectId).order("total_spent", { ascending: false }).limit(20),
    supabase.from("daily_logs").select("log_date, worker_count, notes, milestones, activity_entries, weather_condition").eq("project_id", projectId).order("log_date", { ascending: false }).limit(90),
    supabase.from("issues").select("title, description, severity, status, created_at").eq("project_id", projectId).order("created_at", { ascending: false }).limit(40),
    supabase.from("tasks").select("title, status, completed_at, created_at").eq("project_id", projectId).is("deleted_at", null).order("created_at", { ascending: false }).limit(50),
    supabase.from("material_transactions").select("material_id, transaction_type, quantity, unit_cost, total_cost, description, created_at").eq("project_id", projectId).order("created_at", { ascending: false }).limit(100)
  ]);
  console.log("[Agent] DB context loaded");
  const { data: convHistory } = await supabase.from("whatsapp_messages").select("direction, message_body, created_at").eq("user_id", userId).eq("project_id", projectId).not("message_body", "is", null).neq("message_body", "").order("created_at", { ascending: false }).limit(10);
  const rawHistory = (convHistory || []).reverse().filter((m) => {
    if (!m.message_body?.trim()) return false;
    if (m.direction === "inbound" && m.message_body?.trim() === rawMessage.trim()) return false;
    return true;
  }).map((m) => ({
    role: m.direction === "inbound" ? "user" : "model",
    parts: [{ text: (m.message_body || "").trim().substring(0, 1e3) }]
  }));
  const formattedHistory = [];
  let lastRole = "";
  for (const msg of rawHistory) {
    if (msg.role === lastRole) continue;
    formattedHistory.push(msg);
    lastRole = msg.role;
  }
  if (formattedHistory.length > 0 && formattedHistory[0].role !== "user") {
    formattedHistory.shift();
  }
  const project = projectRes.data;
  if (!project || projectRes.error) {
    console.error("[Agent] Project missing or error:", projectId, projectRes.error?.message);
    return await ai(
      `User said: "${rawMessage}". Briefly ask them to say "list projects" or switch project.`,
      'Could not load this project. Say "list projects" to choose one.',
      220
    ) || 'Say "list projects" to pick which project to use.';
  }
  const allExpenses = (expensesFullRes.data || []).map((e) => ({
    description: e.description,
    amount: parseFloat(String(e.amount || 0)),
    date: e.expense_date
  }));
  const materials = (materialsRes.data || []).map((m) => ({
    name: m.name,
    stock: m.quantity,
    unit: m.unit,
    unitCostUgx: m.unit_cost,
    totalCostUgx: m.total_cost,
    lastPurchased: m.last_purchased_at,
    lastUsed: m.last_used_at,
    lowStockAt: m.low_stock_threshold
  }));
  const vendors = !vendorsRes.error && vendorsRes.data ? vendorsRes.data.map((v) => ({
    name: v.name,
    totalSpentUgx: parseFloat(String(v.total_spent || 0)),
    transactions: v.total_transactions
  })) : [];
  const dailyLogs = (dailyLogsRes.data || []).map((l) => ({
    date: l.log_date,
    workers: l.worker_count,
    notes: l.notes,
    milestones: l.milestones,
    weatherCondition: l.weather_condition
  }));
  const allIssues = (issuesRes.data || []).map((i) => ({
    title: i.title,
    severity: i.severity,
    status: i.status,
    date: i.created_at?.split("T")[0]
  }));
  const tasks = !tasksRes.error && tasksRes.data ? tasksRes.data.map((t) => ({ title: t.title, status: t.status, completedAt: t.completed_at })) : [];
  const materialTransactions = !materialTxRes.error && materialTxRes.data ? materialTxRes.data.map((r) => ({
    type: r.transaction_type,
    quantity: r.quantity,
    unitCostUgx: r.unit_cost,
    totalCostUgx: r.total_cost,
    description: r.description,
    at: r.created_at
  })) : [];
  const now = /* @__PURE__ */ new Date();
  const pad2 = (n) => String(n).padStart(2, "0");
  const isoDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const todayStr = isoDate(now);
  const startOf7Days = new Date(now);
  startOf7Days.setDate(now.getDate() - 6);
  const startOf30Days = new Date(now);
  startOf30Days.setDate(now.getDate() - 29);
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  const dayOfWeek = now.getDay();
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);
  const endOfLastWeek = new Date(startOfThisWeek);
  endOfLastWeek.setDate(startOfThisWeek.getDate() - 1);
  const inRange = (e, from, to) => e.date >= isoDate(from) && e.date <= isoDate(to);
  const sumRange = (from, to) => Math.round(allExpenses.filter((e) => inRange(e, from, to)).reduce((s, e) => s + e.amount, 0));
  const spendLast7Days = sumRange(startOf7Days, now);
  const spendLast30Days = sumRange(startOf30Days, now);
  const spendThisMonth = sumRange(startOfThisMonth, now);
  const spendLastMonth = sumRange(startOfLastMonth, endOfLastMonth);
  const spendThisWeek = sumRange(startOfThisWeek, now);
  const spendLastWeek = sumRange(startOfLastWeek, endOfLastWeek);
  const momChange = spendLastMonth > 0 ? Math.round((spendThisMonth - spendLastMonth) / spendLastMonth * 100) : null;
  const spendByCategory = {};
  for (const e of allExpenses) {
    const desc = (e.description || "").toLowerCase();
    let cat = "Other";
    if (/cement|sand|gravel|ballast|aggregate|stone|block|brick/i.test(desc)) cat = "Materials";
    else if (/labor|labour|worker|mason|casual|wage|salary/i.test(desc)) cat = "Labour";
    else if (/transport|fuel|petrol|diesel|truck|lorry|delivery/i.test(desc)) cat = "Transport";
    else if (/equipment|machine|hire|rental|scaffold/i.test(desc)) cat = "Equipment";
    else if (/paint|finish|tile|plumbing|electrical|wire|pipe/i.test(desc)) cat = "Finishing";
    spendByCategory[cat] = (spendByCategory[cat] || 0) + e.amount;
  }
  const spendByItem = {};
  for (const e of allExpenses) {
    const key = (e.description || "Other").substring(0, 60).trim() || "Other";
    spendByItem[key] = (spendByItem[key] || 0) + e.amount;
  }
  const topItemsBySpend = Object.entries(spendByItem).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([desc, amt]) => ({ desc, amountUgx: Math.round(amt) }));
  const spendingByMonth = {};
  for (const e of allExpenses) {
    const month = e.date?.substring(0, 7) || "unknown";
    spendingByMonth[month] = (spendingByMonth[month] || 0) + e.amount;
  }
  const monthlyTrend = Object.entries(spendingByMonth).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6).map(([month, amt]) => ({ month, amountUgx: Math.round(amt) }));
  const totalSpent = allExpenses.reduce((s, e) => s + e.amount, 0);
  const budget = parseFloat(String(project?.budget || 0));
  const remaining = Math.max(0, budget - totalSpent);
  const pctUsed = budget > 0 ? Math.round(totalSpent / budget * 100) : 0;
  let weeklyBurnRate = 0;
  let weeksElapsed = null;
  if (allExpenses.length > 0) {
    const expenseDates = allExpenses.map((e) => e.date ? (/* @__PURE__ */ new Date(e.date + "T12:00:00")).getTime() : null).filter((t) => t !== null);
    const firstExpenseMs = expenseDates.length > 0 ? Math.min(...expenseDates) : now.getTime();
    const daysSinceFirst = Math.max(1, (now.getTime() - firstExpenseMs) / (1e3 * 60 * 60 * 24));
    weeklyBurnRate = Math.round(totalSpent / daysSinceFirst * 7);
    weeksElapsed = Math.max(1, Math.round(daysSinceFirst / 7));
  }
  const weeksRemaining = weeklyBurnRate > 0 ? Math.floor(remaining / weeklyBurnRate) : null;
  const workerLogs = dailyLogs.filter((l) => l.workers && l.workers > 0);
  const avgWorkersPerDay = workerLogs.length > 0 ? Math.round(workerLogs.reduce((s, l) => s + (l.workers || 0), 0) / workerLogs.length) : 0;
  const peakWorkers = workerLogs.length > 0 ? Math.max(...workerLogs.map((l) => l.workers || 0)) : 0;
  const todayLog = dailyLogs.find((l) => l.date === todayStr);
  const workersToday = todayLog?.workers || 0;
  const lowStock = materials.filter((m) => m.lowStockAt != null && m.stock <= m.lowStockAt);
  const todayFormatted = now.toLocaleDateString("en-UG", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const userName = profile?.full_name && profile.full_name !== "WhatsApp User" ? profile.full_name.split(" ")[0] : "Site Manager";
  const contextBlock = JSON.stringify({
    project: {
      name: project?.name,
      budgetUgx: budget,
      spentUgx: Math.round(totalSpent),
      remainingUgx: Math.round(remaining),
      percentUsed: pctUsed,
      status: project?.status,
      startDate: project?.start_date,
      description: project?.description
    },
    analytics: {
      todayIso: todayStr,
      spendingPeriods: {
        last7Days: spendLast7Days,
        last30Days: spendLast30Days,
        thisMonth: spendThisMonth,
        lastMonth: spendLastMonth,
        thisWeek: spendThisWeek,
        lastWeek: spendLastWeek,
        monthOverMonthChangePercent: momChange
      },
      spendingByCategory: spendByCategory,
      topItemsBySpend: topItemsBySpend.slice(0, 10),
      monthlyTrend: monthlyTrend.slice(0, 6),
      burnRate: {
        weeklyUgx: weeklyBurnRate,
        weeksRemaining,
        projectedOverBudget: remaining <= 0
      },
      workers: {
        today: workersToday,
        avgPerDay: avgWorkersPerDay,
        peak: peakWorkers,
        totalDaysLogged: workerLogs.length
      },
      lowStockAlerts: lowStock.map((m) => `${m.name}: ${m.stock} ${m.unit} left`),
      topVendors: vendors.slice(0, 5),
      totalExpenseRecords: allExpenses.length
    },
    // CRITICAL: Only send last 20 expenses to AI — full history used for analytics only
    recentExpenses: (expensesRecentRes.data || []).slice(0, 20).map((e) => ({
      description: e.description,
      amountUgx: Math.round(parseFloat(String(e.amount || 0))),
      date: e.expense_date
    })),
    materialsInventory: materials,
    recentDailyLogs: dailyLogs.slice(0, 14),
    issues: {
      open: allIssues.filter((i) => i.status === "open"),
      acknowledged: allIssues.filter((i) => i.status === "acknowledged"),
      recentlyResolved: allIssues.filter((i) => i.status === "resolved").slice(0, 3)
    },
    tasks: {
      pending: tasks.filter(
        (t) => ["pending", "in_progress", "todo"].includes(String(t.status || "").toLowerCase())
      ).slice(0, 20),
      recentlyCompleted: tasks.filter((t) => ["completed", "done"].includes(String(t.status || "").toLowerCase())).slice(0, 5)
    },
    userProjects: allProjects.map((p) => ({ name: p.name }))
  });
  const systemPrompt = `CRITICAL: Never compute totals or sums yourself from the expenses array. All financial totals are pre-computed in analytics.spendingPeriods and analytics.spendingByCategory \u2014 use those values directly.

You are JengaTrack \u2014 an elite AI construction project assistant combining the intelligence of a senior quantity surveyor, financial analyst, project manager, and structural engineer. You behave like Claude AI but specialized for construction in Uganda/East Africa. You work for ${userName} and have COMPLETE access to the live project database below.

TODAY: ${todayFormatted}
USER: ${userName}
ACTIVE PROJECT: ${project?.name || "Unknown"}

\u2501\u2501\u2501 LIVE PROJECT DATABASE \u2501\u2501\u2501
${contextBlock}

\u2501\u2501\u2501 YOUR COMPLETE CAPABILITIES \u2501\u2501\u2501
1. Finance: log expenses (single/multi-item/labor), edit/delete expenses, update budget, analyse spending
2. Materials: add/use/set inventory, check stock, identify low-stock items, log transactions
3. Daily logs: record workers, progress, milestones, weather delays, query any past date
4. Issues & Alerts: log/acknowledge/resolve/update/delete issues, list open issues
5. Tasks: create/update/complete/delete tasks, list pending tasks
6. Projects: create new projects, update budget/name/status, switch between projects
7. Profile: update name, WhatsApp number, language preference
8. Analytics: burn rate, vendor history, monthly trends, worker patterns \u2014 all pre-computed above
9. Construction expertise: answer ANY construction question \u2014 mixing ratios, structural calculations, quantity estimation, Uganda/East Africa building costs and codes, material specifications, best practices

\u2501\u2501\u2501 YOU ARE LIKE CLAUDE AI FOR CONSTRUCTION \u2501\u2501\u2501
You behave like a brilliant, helpful AI (similar to Claude or ChatGPT) but specialized for construction:

- GENERAL CONSTRUCTION QUESTIONS: answer fully from your expertise:
  "how do I mix concrete for a slab?", "what is standard rebar spacing?", "how many bags of cement for a 10x10 room?", "Uganda National Building Code?", "how do I prevent waterproofing issues?", "difference between OPC and PPC cement?", "how to cure concrete?", "correct mortar ratio?", "standard column size for 3 floors?"
  For ALL of these: give a complete, expert answer. Never say "I cannot answer that."

- PROJECT DATA: use the database above to give precise answers.

- UGANDA/EAST AFRICA MARKET PRICES: answer from knowledge (cement ~38,000-45,000 UGX/bag in 2025, rebar, labour rates, truck hire). Caveat that prices change and should be verified locally.

- PERSONAL/CONVERSATIONAL: respond warmly and helpfully.

- NEVER: say "I cannot help with that", "outside my scope", "I don't have access", "please check the dashboard", "I am an AI", "the context does not contain". These are NEVER acceptable responses.

\u2501\u2501\u2501 ANALYTICS \u2014 USE PRE-COMPUTED VALUES \u2501\u2501\u2501
All time-period amounts are in analytics.spendingPeriods \u2014 USE THEM DIRECTLY, do not re-sum from the expenses array:
- last 7 days: ${fmt(spendLast7Days)} UGX
- this month: ${fmt(spendThisMonth)} UGX
- last month: ${fmt(spendLastMonth)} UGX
- this week: ${fmt(spendThisWeek)} UGX
- last week: ${fmt(spendLastWeek)} UGX
- month vs last month: ${momChange !== null ? momChange + "%" : "N/A"}
- Burn rate: ${fmt(weeklyBurnRate)} UGX/week, ~${weeksRemaining !== null ? weeksRemaining + " weeks remaining" : "unknown weeks remaining"}
- Workers today: ${workersToday}, average: ${avgWorkersPerDay}/day, peak: ${peakWorkers}
Today is ${todayStr}. For "X days ago" questions, count backward. Never say you do not know the current date.

\u2501\u2501\u2501 TOOLS \u2014 return ONLY a JSON object (no other text) to take an action \u2501\u2501\u2501
{"tool":"log_expense","params":{"description":"...","amount":number,"date":"YYYY-MM-DD","vendor":"optional","item":"material name if material","quantity":number,"unit":"bags/kg/etc"}}
{"tool":"log_expense","params":{"description":"...","amount":total,"items":[{"item":"name","quantity":n,"unit":"bags","unit_price":n,"total":n}]}}
{"tool":"log_labor","params":{"worker_count":number,"amount":number,"description":"...","date":"YYYY-MM-DD"}}
{"tool":"update_inventory","params":{"material_name":"...","action":"add|use|set","quantity":number,"unit":"..."}}
{"tool":"log_issue","params":{"title":"...","description":"...","severity":"low|medium|high|critical"}}
{"tool":"acknowledge_issue","params":{"title_keyword":"part of issue title"}}
{"tool":"resolve_issue","params":{"title_keyword":"part of issue title","resolution_note":"optional"}}
{"tool":"update_issue","params":{"title_keyword":"part of issue title","severity":"low|medium|high|critical","description":"optional"}}
{"tool":"delete_issue","params":{"title_keyword":"part of issue title"}}
{"tool":"delete_all_issues","params":{}}
{"tool":"clear_resolved_issues","params":{}}
{"tool":"edit_expense","params":{"description_keyword":"part of existing expense desc","new_amount":number,"new_description":"optional","date":"YYYY-MM-DD optional"}}
{"tool":"delete_expense","params":{"description_keyword":"part of existing expense description"}}
{"tool":"log_progress","params":{"description":"...","worker_count":number,"date":"YYYY-MM-DD"}}
{"tool":"update_daily_log","params":{"worker_count":number,"notes":"...","milestones":"...","date":"YYYY-MM-DD"}}
{"tool":"update_project","params":{"budget":number}}
{"tool":"create_project","params":{"name":"...","budget":number,"description":"optional"}}
{"tool":"update_profile","params":{"full_name":"...","whatsapp_number":"+256...","preferred_language":"en|lg|sw"}}
{"tool":"log_weather_delay","params":{"reason":"...","date":"YYYY-MM-DD"}}
{"tool":"create_task","params":{"title":"...","status":"pending|completed"}}
{"tool":"update_task","params":{"title_keyword":"part of task title","status":"pending|in_progress|completed","new_title":"optional"}}
{"tool":"delete_task","params":{"title_keyword":"part of task title"}}
{"tool":"delete_material","params":{"material_name":"..."}}
{"tool":"rename_material","params":{"old_name":"current material name","new_name":"new name"}}
{"tool":"set_material_threshold","params":{"material_name":"...","threshold":number}}
{"tool":"delete_project","params":{"confirmed":true}}
{"tool":"switch_project","params":{"project_name_or_id":"..."}}
{"tool":"query_data","params":{"answer":"your complete answer to the user's question"}}
{"tool":"get_daily_summary","params":{"date":"YYYY-MM-DD"}}
{"tool":"compare_periods","params":{}}

\u2501\u2501\u2501 DECISION GUIDE \u2501\u2501\u2501
- LOG/RECORD/ADD/BUY/PAY/UPDATE/RESOLVE/CREATE/DELETE/EDIT \u2192 return JSON tool call only
- QUESTION about project data \u2192 query_data with full answer
- GENERAL CONSTRUCTION QUESTION \u2192 query_data with comprehensive expert answer
- ANY other question \u2192 query_data and answer helpfully
- "any alerts/issues?" \u2192 list from issues.open. NEVER call log_issue for a question.
- "delete all alerts/issues" \u2192 delete_all_issues {}
- "clear resolved" \u2192 clear_resolved_issues {}
- "delete [X] material / remove [X] from inventory" \u2192 delete_material {material_name}
- "rename [X] material to [Y]" \u2192 rename_material {old_name, new_name}
- "set low stock alert for [X] to [N]" \u2192 set_material_threshold {material_name, threshold}
- "delete this project / permanently delete project" \u2192 delete_project {confirmed: true}
- NEVER auto-confirm project deletion \u2014 always require the user to explicitly say "yes delete [name] permanently" first. If they just say "delete project", call delete_project WITHOUT confirmed:true so the warning message is shown first.
- "delete [X] issue" \u2192 delete_issue {title_keyword}
- "switch to X project" \u2192 switch_project immediately
- "update name/language" \u2192 update_profile
- "create project" \u2192 create_project
- "acknowledge/resolve [X]" \u2192 acknowledge_issue or resolve_issue
- "edit/correct [X] expense" \u2192 edit_expense
- "delete [X] expense" \u2192 delete_expense
- "mark task [X] done" \u2192 update_task with status=completed
- "what happened on [date]?" \u2192 get_daily_summary with YYYY-MM-DD
- "compare this week vs last" \u2192 compare_periods
- General construction question \u2192 query_data with expert answer

\u2501\u2501\u2501 CRITICAL RULES \u2501\u2501\u2501
1. Workers/masons/labourers = PEOPLE. log_labor for payments. update_daily_log for counting. NEVER update_inventory for people.
2. "any alerts?" = QUESTION. List from issues.open. Never log_issue for a question.
3. Amounts: K=1,000 | M=1,000,000 | B=1,000,000,000. "paid 3 workers 25k each" \u2192 amount = 75,000. Always multiply.
4. NEVER expose UUIDs or raw database IDs in replies.
5. NEVER say "I cannot", "I don't have", "context does not contain", "please check dashboard", "I am an AI".
6. Dates in replies: "March 16, 2026" not "2026-03-16".
7. Currency: UGX with commas: 1,500,000 UGX.
8. If unsure: ask ONE short clarifying question via query_data.
9. For multi-part questions: answer ALL parts in one reply.
10. For delete/create/update/log: ALWAYS return ONLY the JSON tool call.
11. update_project: ONLY include params user explicitly asked to change. NEVER auto-generate a project name.
12. When answering construction knowledge: give actual numbers, ratios, and practical advice. Be the expert.
13. If user switches language mid-conversation: respond in that language immediately.

\u2501\u2501\u2501 FORMATTING \u2501\u2501\u2501
Plain text only. No markdown asterisks, no ** bold, no * bullets.
Use dashes (-) for lists. WhatsApp renders asterisks as raw characters.
Be thorough on analysis and knowledge questions. Be concise on simple confirmations.`;
  const userPrompt = rawMessage;
  console.log("[Agent] Context ready \u2014 calling LLM (Gemini \u2192 OpenAI fallback)");
  let rawResponse = null;
  if (gemini && process.env.GEMINI_API_KEY) {
    for (const modelName of ["gemini-2.0-flash", "gemini-2.5-flash-lite"]) {
      try {
        const model = gemini.getGenerativeModel({ model: modelName, systemInstruction: systemPrompt });
        try {
          const chat = model.startChat({ history: formattedHistory });
          const result2 = await withDeadline(
            chat.sendMessage(userPrompt),
            GEMINI_CALL_DEADLINE_MS,
            `Gemini ${modelName} sendMessage`
          );
          rawResponse = result2.response.text()?.trim() || null;
        } catch (histErr) {
          console.warn(`[Agent] Gemini ${modelName} with history failed, retrying without history:`, histErr?.message);
          const result2 = await withDeadline(
            model.generateContent([
              { text: systemPrompt },
              { text: userPrompt }
            ]),
            GEMINI_CALL_DEADLINE_MS,
            `Gemini ${modelName} generateContent`
          );
          rawResponse = result2.response.text()?.trim() || null;
        }
        if (rawResponse) {
          console.log(`[Agent] Gemini (${modelName}):`, rawResponse.substring(0, 120));
          break;
        }
      } catch (err) {
        console.error(`[Agent] Gemini ${modelName} failed:`, err?.message);
      }
    }
  }
  if (!rawResponse && process.env.OPENAI_API_KEY) {
    try {
      const histMsgs = formattedHistory.map((m) => ({
        role: m.role === "model" ? "assistant" : "user",
        content: m.parts[0].text
      }));
      const completion = await withDeadline(
        openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            ...histMsgs,
            { role: "user", content: userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 800
        }),
        OPENAI_AGENT_DEADLINE_MS,
        "OpenAI gpt-4o chat"
      );
      rawResponse = completion.choices[0]?.message?.content?.trim() || null;
      if (rawResponse) console.log("[Agent] GPT-4o:", rawResponse.substring(0, 120));
    } catch (err) {
      console.error("[Agent] GPT-4o failed:", err?.message);
    }
  }
  if (!rawResponse) {
    if (gemini && process.env.GEMINI_API_KEY) {
      try {
        const model = gemini.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
        const simplePrompt = `You are JengaTrack, a construction assistant. The user says: "${rawMessage}". Answer helpfully in plain text. No markdown.`;
        const result2 = await withDeadline(
          model.generateContent(simplePrompt),
          GEMINI_CALL_DEADLINE_MS,
          "Gemini simple fallback generateContent"
        );
        rawResponse = result2.response.text()?.trim() || null;
        if (rawResponse) console.log("[Agent] Gemini fallback succeeded");
      } catch (err) {
        console.error("[Agent] Gemini fallback failed:", err?.message);
      }
    }
  }
  if (!rawResponse) {
    return await withDeadline(
      ai(
        `The user said: "${rawMessage}". Respond helpfully as JengaTrack construction assistant.`,
        "I didn't catch that \u2014 could you try again? You can say things like 'how much did I spend this month?' or 'log 50 bags cement for 2M'.",
        300
      ),
      OPENAI_AGENT_DEADLINE_MS,
      "ai() helper fallback"
    );
  }
  const toolCall = parseToolCall(rawResponse);
  if (!toolCall) {
    return rawResponse.replace(/\{[\s\S]*?"tool"[\s\S]*?\}/g, "").trim() || rawResponse;
  }
  console.log("[Agent] Tool:", toolCall.tool, JSON.stringify(toolCall.params).substring(0, 100));
  let result;
  switch (toolCall.tool) {
    case "log_expense":
      result = await toolLogExpense(userId, projectId, toolCall.params);
      break;
    case "log_labor":
      result = await toolLogLabor(userId, projectId, toolCall.params);
      break;
    case "update_inventory":
      result = await toolUpdateInventory(userId, projectId, toolCall.params);
      break;
    case "log_issue":
      result = await toolLogIssue(projectId, toolCall.params);
      break;
    case "acknowledge_issue":
      result = await toolAcknowledgeIssue(projectId, toolCall.params);
      break;
    case "resolve_issue":
      result = await toolResolveIssue(projectId, toolCall.params);
      break;
    case "edit_expense":
      result = await toolEditExpense(projectId, toolCall.params);
      break;
    case "delete_expense":
      result = await toolDeleteExpense(projectId, toolCall.params);
      break;
    case "log_progress":
      result = await toolLogProgress(projectId, toolCall.params);
      break;
    case "update_daily_log":
      result = await toolUpdateDailyLog(projectId, toolCall.params);
      break;
    case "update_project":
      result = await toolUpdateProject(projectId, toolCall.params);
      break;
    case "create_project":
      result = await toolCreateProject(userId, toolCall.params);
      break;
    case "update_profile":
      result = await toolUpdateProfile(userId, toolCall.params);
      break;
    case "log_weather_delay":
      result = await toolLogWeatherDelay(projectId, toolCall.params);
      break;
    case "create_task":
      result = await toolCreateTask(userId, projectId, toolCall.params);
      break;
    case "update_task":
      result = await toolUpdateTask(projectId, toolCall.params);
      break;
    case "delete_task":
      result = await toolDeleteTask(projectId, toolCall.params);
      break;
    case "update_issue":
      result = await toolUpdateIssue(projectId, toolCall.params);
      break;
    case "delete_issue":
      result = await toolDeleteIssue(projectId, toolCall.params);
      break;
    case "delete_all_issues": {
      const { data: openIssues } = await supabase.from("issues").select("id, title").eq("project_id", projectId).not("status", "eq", "resolved");
      if (!openIssues?.length) {
        result = { success: true, reply: "\u2705 No open alerts to delete \u2014 your issues list is already clear." };
      } else {
        const titleList = openIssues.map((i) => `- ${i.title}`).join("\n");
        const { error: delErr } = await supabase.from("issues").delete().eq("project_id", projectId).not("status", "eq", "resolved");
        if (delErr) result = { success: false, reply: "Could not delete those alerts. Try again." };
        else result = { success: true, reply: `\u{1F5D1}\uFE0F Cleared ${openIssues.length} alert${openIssues.length > 1 ? "s" : ""}:
${titleList}

Issues & Risks page is now clean.` };
      }
      break;
    }
    case "clear_resolved_issues": {
      const { data: resolvedIssues } = await supabase.from("issues").select("id").eq("project_id", projectId).eq("status", "resolved");
      if (!resolvedIssues?.length) {
        result = { success: true, reply: "\u2705 No resolved alerts in history to clear." };
      } else {
        const { error: delErr } = await supabase.from("issues").delete().eq("project_id", projectId).eq("status", "resolved");
        if (delErr) result = { success: false, reply: "Could not clear resolved alerts. Try again." };
        else result = { success: true, reply: `\u{1F5D1}\uFE0F Cleared ${resolvedIssues.length} resolved alert${resolvedIssues.length > 1 ? "s" : ""} from history.` };
      }
      break;
    }
    case "delete_material":
      result = await toolDeleteMaterial(projectId, toolCall.params);
      break;
    case "rename_material":
      result = await toolRenameMaterial(projectId, toolCall.params);
      break;
    case "set_material_threshold":
      result = await toolSetMaterialThreshold(projectId, toolCall.params);
      break;
    case "delete_project":
      result = await toolDeleteProject(userId, projectId, toolCall.params);
      break;
    case "switch_project":
      result = await toolSwitchProject(userId, toolCall.params, allProjects);
      break;
    case "query_data":
      result = {
        success: true,
        reply: String(toolCall.params.answer || "").trim() || "Here is what I found from your project data."
      };
      break;
    case "get_daily_summary": {
      const queryDate = String(toolCall.params.date || todayStr);
      const log = dailyLogs.find((l) => l.date === queryDate);
      if (!log) {
        const dateLabel = (/* @__PURE__ */ new Date(queryDate + "T12:00:00")).toLocaleDateString("en-UG", {
          day: "numeric",
          month: "long",
          year: "numeric"
        });
        result = { success: true, reply: `No daily log found for ${dateLabel}. Nothing was logged that day.` };
      } else {
        const dateLabel = (/* @__PURE__ */ new Date(queryDate + "T12:00:00")).toLocaleDateString("en-UG", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric"
        });
        const parts = [];
        if (log.workers) parts.push(`${log.workers} workers on site`);
        if (log.notes) parts.push(String(log.notes));
        if (log.milestones) parts.push(`Milestone: ${log.milestones}`);
        if (log.weatherCondition) parts.push(`Weather: ${log.weatherCondition}`);
        result = {
          success: true,
          reply: `${dateLabel}: ${parts.length > 0 ? parts.join(". ") : "Log exists but no details recorded."}`
        };
      }
      break;
    }
    case "compare_periods": {
      const momLine = momChange !== null ? `Month vs prior month: ${momChange > 0 ? "+" : ""}${momChange}% change in spending` : "Month vs prior month: N/A (no spend last month to compare)";
      result = {
        success: true,
        reply: [
          `Spending comparison (UGX):`,
          `- This week: ${fmt(spendThisWeek)} | Last week: ${fmt(spendLastWeek)}`,
          `- This month: ${fmt(spendThisMonth)} | Last month: ${fmt(spendLastMonth)}`,
          `- Last 7 days: ${fmt(spendLast7Days)} | Last 30 days: ${fmt(spendLast30Days)}`,
          momLine
        ].join("\n")
      };
      break;
    }
    default:
      console.log("[Agent] Unknown tool:", toolCall.tool);
      return rawResponse.replace(/\{[\s\S]*?"tool"[\s\S]*?\}/g, "").trim() || "Got it! What else can I help with?";
  }
  return result.reply;
}
async function sendDailyHeartbeat() {
  const { data: projects } = await supabase.from("projects").select("id, name, budget, user_id").eq("status", "active");
  if (!projects) return;
  for (const project of projects) {
    const { data: owner } = await supabase.from("profiles").select("whatsapp_number").eq("id", project.user_id).single();
    if (!owner?.whatsapp_number) continue;
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const { data: todayLog } = await supabase.from("daily_logs").select("*").eq("project_id", project.id).eq("log_date", today).maybeSingle();
    const { data: todayExpenses } = await supabase.from("expenses").select("amount").eq("project_id", project.id).gte("created_at", `${today}T00:00:00`);
    const dailySpend = (todayExpenses || []).reduce((s, e) => s + parseFloat(String(e.amount || 0)), 0);
    const { data: allExpenses } = await supabase.from("expenses").select("amount").eq("project_id", project.id);
    const totalSpent = (allExpenses || []).reduce((s, e) => s + parseFloat(String(e.amount || 0)), 0);
    const budget = parseFloat(String(project.budget || 0));
    const pct = budget > 0 ? Math.round(totalSpent / budget * 100) : 0;
    const hadActivity = todayLog !== null;
    const heartbeatMsg = await ai(
      `Generate a daily site update summary for the project owner:
    Project: ${project.name}
    Site active today: ${hadActivity ? "Yes" : "No updates received"}
    ${todayLog?.worker_count ? "Workers: " + todayLog.worker_count : ""}
    ${dailySpend > 0 ? "Spent today: " + fmt(dailySpend) + " UGX" : ""}
    ${todayLog?.notes ? "Update: " + todayLog.notes : ""}
    Total spent: ${fmt(totalSpent)} UGX of ${fmt(budget)} UGX (${pct}%)
    Dashboard: ${DASHBOARD_URL}
    ${!hadActivity ? "Mention no updates were received and suggest following up with site manager." : ""}
    Be professional but brief. Include the dashboard URL.`,
      `Daily update \u2014 ${project.name}

Active today: ${hadActivity ? "Yes" : "No"}
Total spent: ${fmt(totalSpent)}/${fmt(budget)} UGX (${pct}%)

${DASHBOARD_URL}`
    );
    await sendMessage(`whatsapp:${owner.whatsapp_number}`, heartbeatMsg);
  }
}
async function handler(req, res) {
  const twimlOk = `<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`;
  try {
    let body = {};
    if (req.body && typeof req.body === "object") body = req.body;
    else if (req.body && typeof req.body === "string") body = Object.fromEntries(new URLSearchParams(req.body));
    else body = req.query || {};
    const { From = "", Body = "", MessageSid, NumMedia = "0", MediaUrl0 = "", MediaContentType0 = "" } = body;
    const phoneNumber = (From || "").replace("whatsapp:", "").trim();
    const rawMessage = (Body || "").trim();
    const message = rawMessage.toLowerCase();
    const hasMedia = parseInt(NumMedia, 10) > 0;
    const isVoiceNote = MediaContentType0.startsWith("audio/");
    const isImage = MediaContentType0.startsWith("image/");
    console.log("\u2705 Webhook called:", { phoneNumber, message: message.substring(0, 80), hasMedia, MediaContentType0 });
    let profile = await getUserProfile(phoneNumber);
    if (!profile) {
      profile = await createUserProfile(phoneNumber);
    }
    const userId = profile.id;
    const onboardingState = profile.onboarding_state;
    const needsOnboarding = !profile.onboarding_completed_at;
    console.log("[webhook] userId:", userId, "projectId:", profile.active_project_id ?? "none");
    if (profile.expense_state && profile.expense_state_set_at) {
      const stateAgeMs = Date.now() - new Date(profile.expense_state_set_at).getTime();
      if (stateAgeMs > 30 * 60 * 1e3) {
        console.log("[StateExpiry] Clearing stale expense_state:", profile.expense_state, "age:", Math.round(stateAgeMs / 6e4), "min");
        await supabase.from("profiles").update({
          expense_state: null,
          expense_pending_data: {},
          expense_state_set_at: null,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }).eq("id", userId);
        profile.expense_state = null;
        profile.expense_pending_data = {};
      }
    }
    if (MessageSid) {
      try {
        const { data: alreadySeen } = await supabase.from("whatsapp_messages").select("id").eq("message_sid", MessageSid).eq("direction", "inbound").maybeSingle();
        if (alreadySeen) {
          console.log(`[WhatsApp] Duplicate MessageSid ${MessageSid} \u2014 already logged; still processing (Twilio retry)`);
        } else {
          await supabase.from("whatsapp_messages").insert({
            user_id: userId,
            message_sid: MessageSid,
            phone_number: phoneNumber,
            direction: "inbound",
            message_body: rawMessage.substring(0, 4e3),
            processed: false,
            project_id: profile.active_project_id ?? null
          });
        }
      } catch (e) {
        console.warn("[WhatsApp] Failed to log inbound:", e?.message);
      }
    }
    if (rawMessage.trim().length > 5 && !hasMedia) {
      if (checkDuplicateMessage(phoneNumber, rawMessage)) {
        await sendMessage(From, "This looks like a duplicate \u2014 did you mean to send this again?", userId);
        res.setHeader("Content-Type", "text/xml");
        return res.status(200).send(twimlOk);
      }
    }
    const isObviousGreeting = /^(hello|hi|hey|good\s*(morning|afternoon|evening|night)|howdy|greetings|jambo|oli\s*otya)/i.test(rawMessage.trim()) && rawMessage.trim().split(/\s+/).length <= 5;
    if (isObviousGreeting && (profile.expense_state || profile.pending_material_update)) {
      console.log("[GreetingInterceptor] Clearing stale state:", rawMessage.trim());
      await supabase.from("profiles").update({
        expense_state: null,
        expense_pending_data: {},
        expense_state_set_at: null,
        pending_material_update: null,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", userId);
      profile.expense_state = null;
      profile.expense_pending_data = {};
      profile.pending_material_update = null;
    }
    if (/start\s*over|startover/i.test(rawMessage.trim())) {
      await supabase.from("profiles").update({
        onboarding_state: null,
        onboarding_data: {},
        onboarding_completed_at: null,
        expense_state: null,
        expense_pending_data: {},
        expense_state_set_at: null,
        pending_material_update: null,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", userId);
      await sendWelcomeMessage(From, profile.full_name);
      res.setHeader("Content-Type", "text/xml");
      return res.status(200).send(twimlOk);
    }
    if (needsOnboarding) {
      switch (onboardingState) {
        case null:
          await updateOnboardingState(userId, "welcome_sent");
          await sendWelcomeMessage(From, profile.full_name);
          break;
        case "welcome_sent":
          await handleProjectTypeSelection(userId, From, message);
          break;
        case "awaiting_project_type":
          await handleProjectTypeSelection(userId, From, message);
          break;
        case "awaiting_location":
          await handleLocationInput(userId, From, rawMessage);
          break;
        case "awaiting_start_date":
          await handleStartDateInput(userId, From, rawMessage);
          break;
        case "awaiting_budget":
          await handleBudgetInput(userId, From, rawMessage);
          break;
        case "confirmation":
          if (message.includes("1") || /yes|create|confirm/i.test(message)) {
            try {
              const projectId = await createProjectFromOnboarding(userId);
              await sendPostCreationMessage(From, projectId);
            } catch (err) {
              console.error("[Onboarding] Project creation failed:", err);
              await sendMessage(From, await ai(
                `Tell the user the project could not be created. Error: ${err.message}. Tell them to type "start over" to try again.`,
                `Could not create the project. Error: ${err.message}. Type "start over" to try again.`
              ));
            }
          } else if (message.includes("2") || /edit/i.test(message)) {
            await updateOnboardingState(userId, "welcome_sent", {});
            await sendWelcomeMessage(From, profile.full_name);
          } else {
            await updateOnboardingState(userId, "completed");
            await sendMessage(From, await ai(
              "Tell the user no problem \u2014 they can create a project from the dashboard anytime. Say they can still send you updates and you will log them.",
              "No problem! Create a project from the dashboard anytime. You can still send me updates and I will log them."
            ));
          }
          break;
        default:
          await sendWelcomeMessage(From, profile.full_name);
      }
      res.setHeader("Content-Type", "text/xml");
      return res.status(200).send(twimlOk);
    }
    const expenseState = profile.expense_state ?? null;
    const pendingData = profile.expense_pending_data || {};
    const pendingMaterial = profile.pending_material_update;
    if (pendingMaterial && pendingMaterial.project_id) {
      const trimmed = rawMessage.trim().toLowerCase();
      const isYes = /^(yes|y)$/.test(trimmed);
      const isNo = /^(no|n)$/.test(trimmed);
      if (isYes || isNo) {
        if (isYes) {
          try {
            const pendingNameNorm = String(pendingMaterial.material_name || "").toLowerCase().trim();
            const { data: existing } = await supabase.from("materials_inventory").select("id, quantity, unit").eq("project_id", pendingMaterial.project_id).eq("name", pendingNameNorm).maybeSingle();
            if (existing) {
              const newQty = parseFloat(String(existing.quantity || 0)) + pendingMaterial.quantity;
              const now = (/* @__PURE__ */ new Date()).toISOString();
              await supabase.from("materials_inventory").update({
                quantity: newQty,
                unit: pendingMaterial.unit || existing.unit,
                last_purchased_at: now,
                updated_at: now
              }).eq("id", existing.id);
              console.log(`[Materials] Updated ${existing.id}: +${pendingMaterial.quantity} \u2192 ${newQty}`);
              await supabase.from("material_transactions").insert({
                material_id: existing.id,
                project_id: pendingMaterial.project_id,
                user_id: userId,
                transaction_type: "purchase",
                quantity: pendingMaterial.quantity,
                unit_cost: 0,
                total_cost: 0,
                source: "whatsapp",
                description: `Added ${pendingMaterial.quantity} ${pendingMaterial.unit || "units"} via WhatsApp`
              });
            } else {
              const now = (/* @__PURE__ */ new Date()).toISOString();
              const { data: inserted } = await supabase.from("materials_inventory").insert({
                project_id: pendingMaterial.project_id,
                user_id: userId,
                name: pendingNameNorm,
                quantity: pendingMaterial.quantity,
                unit: pendingMaterial.unit || "units",
                last_purchased_at: now,
                updated_at: now
              }).select("id").single();
              console.log(`[Materials] Created ${pendingMaterial.material_name}: ${pendingMaterial.quantity}`);
              if (inserted?.id) {
                await supabase.from("material_transactions").insert({
                  material_id: inserted.id,
                  project_id: pendingMaterial.project_id,
                  user_id: userId,
                  transaction_type: "purchase",
                  quantity: pendingMaterial.quantity,
                  unit_cost: 0,
                  total_cost: 0,
                  source: "whatsapp",
                  description: `Added ${pendingMaterial.quantity} ${pendingMaterial.unit || "units"} via WhatsApp`
                });
              }
            }
            await sendMessage(From, await ai(
              `Tell the user you added ${pendingMaterial.quantity} ${pendingMaterial.unit || "units"} of ${pendingMaterial.material_name} to their Materials & Supplies inventory. Be brief.`,
              `Added ${pendingMaterial.quantity} ${pendingMaterial.unit || "units"} of ${pendingMaterial.material_name} to Materials & Supplies.`
            ));
          } catch (err) {
            console.error("[Materials] Insert/update failed:", err?.message);
            await sendMessage(From, "Could not add to inventory. Please try again from the dashboard.");
          }
        } else {
          await sendMessage(From, await ai(
            "Tell the user you skipped adding to materials. Be brief.",
            "Skipped. Send another update anytime."
          ));
        }
        await clearPendingMaterialUpdate(userId);
        res.setHeader("Content-Type", "text/xml");
        return res.status(200).send(twimlOk);
      } else {
        await sendMessage(From, "Please reply YES to add to Materials & Supplies, or NO to skip.");
        res.setHeader("Content-Type", "text/xml");
        return res.status(200).send(twimlOk);
      }
    }
    if (expenseState === "awaiting_photo_caption" && pendingData.photo_url) {
      const looksLikeIntent = /\d/.test(rawMessage) && /log|paid|bought|spent|expense|worker|cement|sand|gravel|steel|iron|update|switch|task|issue|progress|budget|record|create|delete|edit/i.test(rawMessage);
      if (looksLikeIntent) {
        await updateExpenseState(userId, null, {});
      } else {
        const caption = rawMessage.trim();
        const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
        const { data: todayLog } = await supabase.from("daily_logs").select("id, notes").eq("project_id", pendingData.project_id).eq("log_date", today).maybeSingle();
        if (todayLog) {
          const updatedNotes = todayLog.notes ? `${todayLog.notes}
Photo: ${caption}` : `Photo: ${caption}`;
          await supabase.from("daily_logs").update({ notes: updatedNotes }).eq("id", todayLog.id);
        }
        try {
          await supabase.from("site_photos").insert({
            project_id: pendingData.project_id,
            user_id: userId,
            photo_url: pendingData.photo_url,
            caption,
            tag: "Other",
            source: "whatsapp",
            created_at: (/* @__PURE__ */ new Date()).toISOString()
          });
        } catch (err) {
          console.log("[Photo Caption] site_photos insert skipped:", err?.message);
        }
        await updateExpenseState(userId, null, {});
        await sendMessage(From, await ai(
          `Tell the user their photo caption was saved: "${caption}". It has been added to today's Daily Accountability log. Be brief.`,
          `Caption saved! "${caption}" added to today's Daily Accountability.`
        ));
        res.setHeader("Content-Type", "text/xml");
        return res.status(200).send(twimlOk);
      }
    }
    if (expenseState === "awaiting_project_selection") {
      if (/list.*project|my project|show.*project|all.*project|project.*list|what project/i.test(message)) {
        await handleListProjects(From, userId);
        res.setHeader("Content-Type", "text/xml");
        return res.status(200).send(twimlOk);
      }
      const options = pendingData.project_options || [];
      const selection = parseInt(rawMessage.trim(), 10);
      const nameMatch = options.findIndex(
        (p) => message.toLowerCase().includes(String(p.name).toLowerCase().split(" ")[0]) || String(p.name).toLowerCase().includes(message.toLowerCase().trim())
      );
      let selectedProject = null;
      if (!isNaN(selection) && selection >= 1 && selection <= options.length) {
        selectedProject = options[selection - 1];
      } else if (nameMatch !== -1) {
        selectedProject = options[nameMatch];
      }
      if (selectedProject) {
        await supabase.from("profiles").update({
          active_project_id: selectedProject.id,
          active_project_set_at: (/* @__PURE__ */ new Date()).toISOString(),
          expense_state: null,
          expense_pending_data: {}
        }).eq("id", userId);
        const msg = await ai(
          `Tell the user you are now tracking updates for their project called "${selectedProject.name}". Be brief and encouraging. Tell them to send their first update.`,
          `Got it! Tracking updates for ${selectedProject.name}. Send your first update anytime.`
        );
        await sendMessage(From, msg);
        res.setHeader("Content-Type", "text/xml");
        return res.status(200).send(twimlOk);
      } else {
        const defaultProject = options[0];
        if (defaultProject) {
          await supabase.from("profiles").update({
            active_project_id: defaultProject.id,
            active_project_set_at: (/* @__PURE__ */ new Date()).toISOString(),
            expense_state: null,
            expense_pending_data: {}
          }).eq("id", userId);
          const agentReply2 = await runAgent(userId, defaultProject.id, rawMessage, profile, options || []);
          await sendMessage(From, `\u{1F4CC} Active project set to *${defaultProject.name}*.

${agentReply2}`);
        } else {
          await sendProjectSelectionMenu(From, userId, options);
        }
        res.setHeader("Content-Type", "text/xml");
        return res.status(200).send(twimlOk);
      }
    }
    const { project, needsSelection, projects } = await getActiveProject(userId, profile);
    const currentProjectId = project?.id ?? null;
    console.log("[webhook] userId:", userId, "projectId:", currentProjectId);
    if (needsSelection) {
      await sendProjectSelectionMenu(From, userId, projects);
      res.setHeader("Content-Type", "text/xml");
      return res.status(200).send(twimlOk);
    }
    if (/switch\s*project|change\s*project|select\s*project/i.test(rawMessage)) {
      if (projects.length <= 1) {
        await sendMessage(From, await ai(
          `Tell the user they only have one active project: ${projects[0]?.name}. They cannot switch because there is nothing to switch to.`,
          `You only have one active project: ${projects[0]?.name}`
        ));
      } else {
        await supabase.from("profiles").update({ active_project_id: null, active_project_set_at: null }).eq("id", userId);
        await sendProjectSelectionMenu(From, userId, projects);
      }
      res.setHeader("Content-Type", "text/xml");
      return res.status(200).send(twimlOk);
    }
    if (/^(help|menu|commands)$/i.test(rawMessage.trim())) {
      await handleGreeting(
        From,
        profile,
        project,
        projects || [],
        "Give me a quick overview of everything you can help me with on this project.",
        detectLanguage(rawMessage)
      );
      res.setHeader("Content-Type", "text/xml");
      return res.status(200).send(twimlOk);
    }
    const channelType = project?.channel_type || "direct";
    if (channelType === "group" && project) {
      const isOwner = project.user_id === userId;
      const isManager = project.manager_id === userId;
      const isDispute = /that\s*seems?\s*expensive|too\s*expensive|dispute|flag|overcharge/i.test(rawMessage);
      if (isOwner && isDispute) {
        const { data: lastExpense } = await supabase.from("expenses").select("id, description, amount").eq("project_id", project.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (lastExpense) {
          await supabase.from("expenses").update({ disputed: true }).eq("id", lastExpense.id);
          await sendMessage(From, await ai(
            `Tell the user that the expense "${lastExpense.description}" for ${fmt(parseFloat(lastExpense.amount))} UGX has been flagged as disputed on the dashboard.`,
            `Flagged "${lastExpense.description}" as disputed on the dashboard.`
          ));
        } else {
          await sendMessage(From, await ai(
            "Tell the user there is no recent expense to dispute.",
            "No recent expense to dispute."
          ));
        }
        res.setHeader("Content-Type", "text/xml");
        return res.status(200).send(twimlOk);
      }
      if (!isManager && !isOwner) {
        await sendMessage(From, await ai(
          "Tell the user politely that only the project manager can log updates in this group.",
          "Only the project manager can log updates in this group."
        ));
        res.setHeader("Content-Type", "text/xml");
        return res.status(200).send(twimlOk);
      }
    }
    if (hasMedia && MediaUrl0) {
      if (isVoiceNote) {
        const transcribed = await processVoiceNote(MediaUrl0);
        if (transcribed) {
          let actionReply;
          if (!project) {
            actionReply = "You need a project first. Type 'hey jenga' to create one.";
          } else {
            actionReply = await runAgent(userId, project.id, transcribed, profile, projects || []);
          }
          const summary = transcribed.length > 60 ? transcribed.substring(0, 57) + "..." : transcribed;
          await sendMessage(From, `Transcribed \u2705 "${summary}"

${actionReply}`);
        } else {
          await sendMessage(From, await ai(
            "Tell the user you could not transcribe their voice note clearly. Ask them to try again with clearer audio or type their update instead.",
            "Could not transcribe that voice note clearly. Try again or type your update."
          ));
        }
        res.setHeader("Content-Type", "text/xml");
        return res.status(200).send(twimlOk);
      }
      if (isImage && project) {
        try {
          const mediaResponse = await fetch(MediaUrl0, {
            headers: {
              Authorization: `Basic ${Buffer.from(
                `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
              ).toString("base64")}`
            }
          });
          const buffer = await mediaResponse.buffer();
          const contentType = mediaResponse.headers.get("content-type") || "image/jpeg";
          const ext = contentType.includes("png") ? "png" : "jpg";
          const fileName = `${project.id}/${Date.now()}.${ext}`;
          const { error: uploadError } = await supabase.storage.from("site-photos").upload(fileName, buffer, { contentType, upsert: false });
          if (uploadError) throw uploadError;
          const { data: urlData } = supabase.storage.from("site-photos").getPublicUrl(fileName);
          const permanentUrl = urlData?.publicUrl || MediaUrl0;
          console.log("[Photo] Saved to Supabase:", permanentUrl);
          await upsertDailyLog(project.id, { photo_urls: [permanentUrl] });
          const captionPatterns = [
            /save (?:the )?note as[:\s]+"?([^"]+)"?/i,
            /caption[:\s]+"?([^"]+)"?/i,
            /note[:\s]+"?([^"]+)"?/i,
            /tag[:\s]+"?([^"]+)"?/i
          ];
          let inlineCaption = null;
          for (const pattern of captionPatterns) {
            const match = rawMessage.match(pattern);
            if (match) {
              inlineCaption = match[1].trim();
              break;
            }
          }
          if (inlineCaption) {
            const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
            const { data: todayLog } = await supabase.from("daily_logs").select("id, notes").eq("project_id", project.id).eq("log_date", today).maybeSingle();
            if (todayLog) {
              const updatedNotes = todayLog.notes ? `${todayLog.notes}
Photo: ${inlineCaption}` : `Photo: ${inlineCaption}`;
              await supabase.from("daily_logs").update({ notes: updatedNotes }).eq("id", todayLog.id);
            }
            try {
              await supabase.from("site_photos").insert({
                project_id: project.id,
                user_id: userId,
                photo_url: permanentUrl,
                caption: inlineCaption,
                tag: "Other",
                source: "whatsapp",
                created_at: (/* @__PURE__ */ new Date()).toISOString()
              });
            } catch (err) {
              console.log("[Photo Caption] site_photos insert skipped:", err?.message);
            }
            await sendMessage(From, `Photo saved with caption: '${inlineCaption}'`);
          } else {
            await sendMessage(From, await ai(
              "Tell the user their photo was saved. Ask them to add a caption by replying with a description.",
              "Photo saved! What caption would you like to add?"
            ));
            await updateExpenseState(userId, "awaiting_photo_caption", {
              photo_url: permanentUrl,
              project_id: project.id
            });
          }
        } catch (err) {
          console.error("[Photo Upload Error]", err?.message);
          await upsertDailyLog(project.id, { photo_urls: [MediaUrl0] });
          await sendMessage(From, await ai(
            "Tell the user their photo was saved. Tell them to view it on their dashboard.",
            "Photo saved! View it on your dashboard."
          ));
        }
        res.setHeader("Content-Type", "text/xml");
        return res.status(200).send(twimlOk);
      }
      if (project) {
        await upsertDailyLog(project.id, { photo_urls: [MediaUrl0] });
        await sendMessage(From, await ai(
          "Tell the user their photo or video was saved to their progress feed on the dashboard. One short line.",
          "Photo/video saved to your progress feed on the dashboard!"
        ));
      }
      res.setHeader("Content-Type", "text/xml");
      return res.status(200).send(twimlOk);
    }
    const { data: freshProfile } = await supabase.from("profiles").select("onboarding_state, onboarding_completed_at").eq("id", userId).single();
    const isConfirmingProject = freshProfile?.onboarding_state === "confirmation" && !freshProfile?.onboarding_completed_at && (message.includes("1") || /yes|create|confirm/i.test(message));
    if (isConfirmingProject) {
      try {
        const projectId = await createProjectFromOnboarding(userId);
        await sendPostCreationMessage(From, projectId);
      } catch (err) {
        console.error("[Onboarding] Project creation failed (from re-check):", err);
        await sendMessage(From, await ai(
          `Tell the user the project could not be created. Error: ${err.message}. Tell them to type "start over" to try again.`,
          `Could not create the project. Error: ${err.message}. Type "start over" to try again.`
        ));
      }
      res.setHeader("Content-Type", "text/xml");
      return res.status(200).send(twimlOk);
    }
    if (expenseState === "awaiting_confirmation" && pendingData.project_id) {
      const trimmed = rawMessage.trim();
      const isConfirmationResponse = /^[123]$/.test(trimmed) || trimmed.length <= 10 && /^(yes|yep|yea|yeah|ok|okay|no|nope|save|confirm|cancel|edit|log it|log|✅|❌|✏️)$/i.test(trimmed);
      const looksLikeNewMessage = /^(hello|hi|hey|good|morning|evening|afternoon|howdy)/i.test(trimmed) || trimmed.length > 60 || trimmed.split(/\s+/).length > 8;
      const shouldProcessAsConfirmation = isConfirmationResponse && !looksLikeNewMessage;
      if (!shouldProcessAsConfirmation) {
        console.log("[AutoClear] Clearing stale expense_state \u2014 not a confirmation:", trimmed.substring(0, 50));
        await updateExpenseState(userId, null, {});
      } else {
        if (!profile.onboarding_completed_at) {
          console.log("[Expense Confirm] Blocked - user still onboarding");
          await handleOnboardingMessage(From, profile, message);
          res.setHeader("Content-Type", "text/xml");
          return res.status(200).send(twimlOk);
        }
        if (message.includes("1") || /yes|ok|✅|log it|confirm/i.test(message)) {
          const toInsert = pendingData.items && pendingData.items.length > 1 ? pendingData.items.map((x) => ({ ...x, description: `${x.quantity} ${x.unit || "units"} of ${x.item}` })) : [{ item: pendingData.item, quantity: pendingData.quantity, unit: pendingData.unit, amount: pendingData.amount, description: pendingData.description || "Expense" }];
          console.log("[Expense Insert] Attempting:", {
            user_id: userId,
            project_id: pendingData.project_id,
            count: toInsert.length,
            supabaseUrl: process.env.SUPABASE_URL?.substring(0, 30)
          });
          let insertError = null;
          let insertedExpense = null;
          for (const entry of toInsert) {
            const desc = entry.description || (entry.item ? `${entry.quantity || 0} ${entry.unit || "units"} of ${entry.item}` : "Expense");
            const amt = entry.amount ?? pendingData.amount ?? 0;
            const { data: ins, error: err } = await supabase.from("expenses").insert({
              user_id: userId,
              project_id: pendingData.project_id,
              description: desc,
              amount: String(amt),
              quantity_logged: entry.quantity ? String(entry.quantity) : null,
              currency: "UGX",
              expense_date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
              source: "whatsapp"
            }).select().single();
            if (err) insertError = err;
            if (ins && !insertedExpense) insertedExpense = ins;
          }
          console.log("[Expense Insert] Result:", insertedExpense ? { id: insertedExpense.id, amount: insertedExpense.amount } : null);
          console.log("[Expense Insert] Error:", insertError ? { message: insertError.message, code: insertError.code, details: insertError.details } : null);
          if (insertError) {
            console.error("[Expense Insert] FAILED:", insertError.message, insertError.code, insertError.details);
            await sendMessage(From, await ai(
              `Tell the user there was an error saving their expense and ask them to try again. Error details: ${insertError.message}`,
              `Could not save that expense. Please try again.`
            ));
            res.setHeader("Content-Type", "text/xml");
            return res.status(200).send(twimlOk);
          }
          if (!insertedExpense || !insertedExpense.id) {
            console.error("[Expense Insert] No data returned from insert");
            await sendMessage(From, await ai(
              "Tell the user the expense failed to save and ask them to try again.",
              "Failed to save expense. Please try again."
            ));
            res.setHeader("Content-Type", "text/xml");
            return res.status(200).send(twimlOk);
          }
          console.log("[Expense Insert] SUCCESS:", {
            project_id: pendingData.project_id,
            amount: pendingData.amount,
            description: pendingData.description
          });
          if (pendingData.vendor && pendingData.amount) {
            await upsertVendor(pendingData.project_id, pendingData.vendor, pendingData.amount);
          }
          const materialEntries = toInsert.map((e) => ({
            materialName: (e.item || e.description || "").trim(),
            quantity: e.quantity && e.quantity > 0 ? e.quantity : 0,
            unit: e.unit || "units",
            amount: e.amount ?? 0,
            description: e.description || ""
          }));
          if (materialEntries.length === 1 && (!materialEntries[0].quantity || !materialEntries[0].materialName)) {
            const parsed = parseQuantityFromDescription(pendingData.description || "");
            if (parsed) {
              materialEntries[0].quantity = parsed.quantity;
              materialEntries[0].unit = parsed.unit || materialEntries[0].unit;
            }
            materialEntries[0].materialName = (pendingData.item || pendingData.description || "").trim();
          }
          const materialLines = [];
          for (const ent of materialEntries) {
            const descLower = (ent.description || ent.materialName).toLowerCase();
            const matLower = (ent.materialName || "").toLowerCase();
            const isSkipType = SKIP_KEYWORDS.some((k) => descLower.includes(k));
            const isMaterial = !!ent.materialName && ent.quantity > 0 && !isSkipType && (MATERIAL_KEYWORDS.some((k) => descLower.includes(k)) || MATERIAL_KEYWORDS.some((k) => matLower.includes(k)));
            if (isMaterial && ent.materialName && ent.quantity > 0) {
              const nameNorm = ent.materialName.toLowerCase().trim();
              if (nameNorm.length >= 2 && !GARBAGE_MATERIAL_NAMES.includes(nameNorm)) {
                const now = (/* @__PURE__ */ new Date()).toISOString();
                const unitCost = ent.amount && ent.quantity > 0 ? ent.amount / ent.quantity : 0;
                const totalCost = ent.amount || ent.quantity * unitCost;
                const { data: existing } = await supabase.from("materials_inventory").select("id, quantity, unit_cost, total_cost").eq("project_id", pendingData.project_id).eq("name", nameNorm).maybeSingle();
                if (existing) {
                  const newQty = parseFloat(String(existing.quantity || 0)) + ent.quantity;
                  const newTotalCost = parseFloat(String(existing.total_cost || 0)) + totalCost;
                  await supabase.from("materials_inventory").update({
                    quantity: newQty,
                    unit_cost: unitCost || parseFloat(String(existing.unit_cost || 0)),
                    total_cost: newTotalCost,
                    last_purchased_at: now,
                    updated_at: now
                  }).eq("id", existing.id);
                  await supabase.from("material_transactions").insert({
                    material_id: existing.id,
                    project_id: pendingData.project_id,
                    user_id: userId,
                    transaction_type: "purchase",
                    quantity: ent.quantity,
                    unit_cost: unitCost,
                    total_cost: totalCost,
                    description: `Added ${ent.quantity} ${ent.unit} via WhatsApp expense`,
                    source: "whatsapp"
                  });
                  materialLines.push(`\u{1F4E6} ${ent.quantity} ${ent.unit} of ${ent.materialName} added. Total stock: ${newQty} ${ent.unit}.`);
                } else {
                  const { data: inserted } = await supabase.from("materials_inventory").insert({
                    project_id: pendingData.project_id,
                    user_id: userId,
                    name: nameNorm,
                    quantity: ent.quantity,
                    unit: ent.unit,
                    unit_cost: unitCost,
                    total_cost: totalCost,
                    source: "whatsapp",
                    last_purchased_at: now,
                    updated_at: now
                  }).select("id").single();
                  if (inserted?.id) {
                    await supabase.from("material_transactions").insert({
                      material_id: inserted.id,
                      project_id: pendingData.project_id,
                      user_id: userId,
                      transaction_type: "purchase",
                      quantity: ent.quantity,
                      unit_cost: unitCost,
                      total_cost: totalCost,
                      description: `Added ${ent.quantity} ${ent.unit} via WhatsApp expense`,
                      source: "whatsapp"
                    });
                    materialLines.push(`\u{1F4E6} ${ent.quantity} ${ent.unit} of ${ent.materialName} added. Total stock: ${ent.quantity} ${ent.unit}.`);
                  }
                }
              }
            }
          }
          const materialsUpdateLine = materialLines.length ? "\n\u{1F4E6} Materials updated:\n\u2022 " + materialLines.join("\n\u2022 ") : "";
          await updateExpenseState(userId, null, {});
          const { data: proj } = await supabase.from("projects").select("budget, name").eq("id", pendingData.project_id).single();
          const budgetTotal = parseFloat(String(proj?.budget || 0));
          const { data: allEx } = await supabase.from("expenses").select("amount").eq("project_id", pendingData.project_id);
          const totalSpentNow = (allEx || []).reduce((s, e) => s + parseFloat(String(e.amount || 0)), 0);
          const pctNow = budgetTotal > 0 ? totalSpentNow / budgetTotal * 100 : 0;
          let budgetAlert = "";
          if (pctNow >= 100) {
            budgetAlert = `

\u{1F6A8} Budget exceeded! You've spent more than your total budget for ${proj?.name || "this project"}.`;
          } else if (pctNow >= 80) {
            budgetAlert = `

\u26A0\uFE0F Budget alert: You've used ${Math.round(pctNow)}% of your budget for ${proj?.name || "this project"}.`;
          }
          const baseMsg = `\u2705 Logged! ${pendingData.description} \u2014 ${fmt(pendingData.amount)} UGX.${materialsUpdateLine}${budgetAlert}`;
          const msg = materialsUpdateLine || budgetAlert ? baseMsg : await ai(
            `Tell the user their expense was saved successfully: ${pendingData.description} \u2014 ${fmt(pendingData.amount)} UGX. Tell them their dashboard and budget have been updated. Keep it short and friendly. Tell them to check Budgets & Costs page.`,
            `Saved! ${pendingData.description} \u2014 ${fmt(pendingData.amount)} UGX logged. Check Budgets & Costs to see the update.`
          );
          await sendMessage(From, msg);
        } else if (message.includes("2") || /edit|✏️/i.test(message)) {
          await updateExpenseState(userId, null, {});
          await sendMessage(From, await ai(
            "Tell the user to send the corrected expense details.",
            "No problem! Send the corrected details."
          ));
        } else if (message.includes("3") || /cancel|❌/i.test(message)) {
          await updateExpenseState(userId, null, {});
          await sendMessage(From, await ai(
            "Tell the user the expense was cancelled. Keep it very brief.",
            "Cancelled. Send a new update anytime."
          ));
        } else {
          const stillMsg = await ai(
            `Tell the user you are still waiting for their reply on this pending expense: ${pendingData.description} \u2014 ${fmt(pendingData.amount || 0)} UGX. Ask them to reply 1 to save, 2 to edit, or 3 to cancel.`,
            `Still waiting: ${pendingData.description} \u2014 ${fmt(pendingData.amount || 0)} UGX

1. Save
2. Edit
3. Cancel`
          );
          await sendOptions(From, stillMsg, ["1. Yes \u2013 Log it", "2. Edit", "3. Cancel"]);
        }
        res.setHeader("Content-Type", "text/xml");
        return res.status(200).send(twimlOk);
      }
    }
    if (expenseState === "awaiting_price" && pendingData.quantity && pendingData.item) {
      const price = parseAmount(rawMessage);
      if (price > 0) {
        const { quantity, unit, item, vendor } = pendingData;
        const unitPrice = Math.round(price / quantity);
        const description = `${quantity} ${unit || "units"} of ${item}`;
        const anomalyAlert = await checkPriceAnomaly(pendingData.project_id, item, price, quantity);
        await updateExpenseState(userId, "awaiting_confirmation", {
          ...pendingData,
          amount: price,
          unit_price: unitPrice,
          description
        });
        const confirmMsg = await ai(
          `Confirm this expense with the user and ask if it looks correct:
          Item: ${description}
          Total: ${fmt(price)} UGX
          ${vendor ? "From: " + vendor : ""}
          Per ${unit || "unit"}: ${fmt(unitPrice)} UGX
          ${anomalyAlert ? "Note: " + anomalyAlert : ""}
          End with: reply 1 to save, 2 to edit, 3 to cancel.`,
          `${description} \u2014 ${fmt(price)} UGX${vendor ? " from " + vendor : ""}. Save it?

1. Yes
2. Edit
3. Cancel`
        );
        const finalMsg = anomalyAlert ? `${anomalyAlert}

${confirmMsg}` : confirmMsg;
        await sendOptions(From, finalMsg, ["1. Yes \u2013 Log it", "2. Edit", "3. Cancel"]);
      } else {
        await sendMessage(From, await ai(
          "Tell the user to send the total cost as a number. Give examples: 1,900,000 or 1.9M.",
          "Send the total cost as a number (e.g. 1,900,000 or 1.9M)."
        ));
      }
      res.setHeader("Content-Type", "text/xml");
      return res.status(200).send(twimlOk);
    }
    if (!project) {
      await sendMessage(From, await ai(
        'Tell the user they need to create a project first before logging updates. Tell them to say "hey jenga" or "start" to create one.',
        'You need a project first. Say "hey jenga" or "start" to create one!'
      ));
      res.setHeader("Content-Type", "text/xml");
      return res.status(200).send(twimlOk);
    }
    console.log("[Agent] Processing message:", rawMessage.substring(0, 80));
    if (!checkRateLimit(phoneNumber)) {
      await sendMessage(From, "You've been very busy! You've reached the message limit for this hour. Please wait a few minutes and try again.", userId, project.id);
      res.setHeader("Content-Type", "text/xml");
      return res.status(200).send(twimlOk);
    }
    let agentReply;
    try {
      agentReply = await runAgentWithTimeBudget(userId, project.id, rawMessage, profile, projects || []);
    } catch (agentErr) {
      console.error("\u274C runAgent failed:", agentErr?.message, agentErr?.stack);
      agentReply = "Sorry \u2014 I couldn't finish that just now. Please try again in a few seconds.";
    }
    console.log("[Webhook] STEP9: reply ready, sending via Twilio (chars=", String(agentReply || "").length, ")");
    try {
      await sendMessage(From, agentReply, userId, project.id);
      console.log("[Webhook] STEP9: WhatsApp reply sent OK (Twilio REST)");
    } catch (sendErr) {
      console.error("[Webhook] STEP9 Twilio REST failed, falling back to TwiML &lt;Message&gt;:", sendErr?.message, sendErr?.code);
      const body2 = (agentReply || "JengaTrack could not reach WhatsApp \u2014 please try again.").substring(0, 1600);
      res.setHeader("Content-Type", "text/xml");
      return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Message>${escapeXml(body2)}</Message></Response>`);
    }
    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(twimlOk);
  } catch (error) {
    console.error("\u274C Webhook error:", error.message, error.stack);
    if (res.headersSent) {
      console.error("\u274C Response already sent; cannot return TwiML (error was likely after early 200).");
      return;
    }
    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Message>Sorry, something went wrong. Please try again.</Message></Response>`);
  }
}
async function handleListProjects(from, userId) {
  const { data: ownedProjects } = await supabase.from("projects").select("id, name, description, budget, status").eq("user_id", userId).order("created_at", { ascending: false });
  const { data: managedProjects } = await supabase.from("projects").select("id, name, description, budget, status").eq("manager_id", userId).order("created_at", { ascending: false });
  const all = [...ownedProjects || [], ...managedProjects || []].filter((p, i, self) => i === self.findIndex((t) => t.id === p.id));
  if (all.length === 0) {
    await sendMessage(from, await ai(
      'Tell the user they have no projects yet. Tell them to type "start" to create their first project.',
      'You do not have any projects yet. Type "start" to create your first project.'
    ));
    return;
  }
  const lines = all.map((p, i) => {
    const budget = parseFloat(String(p.budget || 0));
    const budgetStr = budget > 0 ? ` \u2014 Budget: ${fmt(budget)} UGX` : "";
    return `${i + 1}. ${p.name}${budgetStr}`;
  }).join("\n");
  const msg = await ai(
    `List the user's projects and tell them they can say "switch project" to change their active project. Here are the projects:
${lines}`,
    `Your projects (${all.length}):

${lines}

Say "switch project" to change your active project.`
  );
  await sendMessage(from, msg);
}
async function routeIntent(intent, extracted, rawMessage, from, userId, project, profile, projects, lang) {
  const currentProjectId = project?.id ?? null;
  console.log("[webhook] userId:", userId, "projectId:", currentProjectId);
  switch (intent) {
    case "BUDGET_QUERY":
      await handleBudgetQuery(from, project.id, lang);
      break;
    case "BUDGET_UPDATE":
      await handleBudgetUpdate(from, project.id, extracted);
      break;
    case "EXPENSE_LOG":
      await handleExpenseLog(from, userId, project.id, extracted, rawMessage, lang);
      break;
    case "MATERIAL_LOG":
      await handleMaterialLog(from, userId, project.id, extracted, rawMessage, lang);
      break;
    case "LABOR_LOG":
      await handleLaborLog(from, project.id, extracted, rawMessage, lang);
      break;
    case "PROGRESS_UPDATE":
      await handleProgressUpdate(from, userId, project.id, extracted, rawMessage, lang);
      break;
    case "WEATHER_DELAY":
      await handleWeatherDelay(from, project.id, extracted, rawMessage);
      break;
    case "MATERIAL_QUERY":
      await handleMaterialQuery(from, project.id, rawMessage);
      break;
    case "SMART_QUERY":
      await handleSmartQuery(from, project.id, rawMessage);
      break;
    case "SWITCH_PROJECT": {
      const mentionedName = extracted.project_name;
      if (mentionedName && projects.length > 0) {
        const match = projects.find(
          (p) => p.name.toLowerCase().includes(mentionedName.toLowerCase()) || mentionedName.toLowerCase().includes(p.name.toLowerCase().split(" ")[0])
        );
        if (match) {
          await supabase.from("profiles").update({
            active_project_id: match.id,
            active_project_set_at: (/* @__PURE__ */ new Date()).toISOString()
          }).eq("id", userId);
          await sendMessage(from, `Switched to ${match.name}! What would you like to update?`);
          break;
        }
      }
      if (projects.length > 0) {
        await sendProjectSelectionMenu(from, userId, projects);
      } else {
        await sendMessage(from, 'You only have one project. Say "list projects" to see it.');
      }
      break;
    }
    case "LIST_PROJECTS":
      await handleListProjects(from, userId);
      break;
    case "PROJECT_QUERY":
      await handleProjectQuery(from, project?.id ?? "", project?.name ?? "Unknown");
      break;
    case "ISSUE_REPORT":
      await handleIssueReport(from, userId, project.id, extracted, rawMessage, lang);
      break;
    case "GREETING":
    default: {
      const aiResponse = await handleNaturalLanguageQuery(from, userId, project?.id ?? null, rawMessage);
      await sendMessage(from, aiResponse);
      break;
    }
  }
}
export {
  handler as default,
  sendDailyHeartbeat
};
