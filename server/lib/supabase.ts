import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// SUPABASE CLIENT INITIALIZATION
// ============================================================================

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env file'
  );
}

/**
 * Supabase client initialized with service role key
 * Use this for backend operations that bypass RLS
 * ⚠️ NEVER expose this client to frontend code
 */
export const supabase: SupabaseClient = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// ============================================================================
// TYPESCRIPT TYPES
// ============================================================================

export interface Profile {
  id: string;
  whatsapp_number: string;
  full_name: string;
  default_currency: string;
  preferred_language: string;
  created_at: string;
  updated_at: string;
  last_active_at: string | null;
  deleted_at: string | null;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  budget_amount: string | null;
  status: 'active' | 'completed' | 'paused';
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  deleted_at: string | null;
}

export interface WhatsAppMessageData {
  user_id?: string | null;
  whatsapp_message_id?: string;
  direction: 'inbound' | 'outbound';
  message_body?: string | null;
  media_url?: string | null;
  intent?: string | null;
  processed?: boolean;
  ai_used?: boolean;
  error_message?: string | null;
}

export interface AIUsageData {
  user_id?: string | null;
  intent?: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  model: string;
  estimated_cost_usd: number;
}

export interface SupabaseResponse<T> {
  data: T | null;
  error: Error | null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get user profile by WhatsApp phone number
 * @param phoneNumber - WhatsApp number (format: +256XXXXXXXXX)
 * @returns User profile or null if not found
 */
export async function getUserByWhatsApp(
  phoneNumber: string
): Promise<SupabaseResponse<Profile>> {
  try {
    console.log(`[Supabase] Looking up user by WhatsApp: ${phoneNumber}`);

    // Normalize phone number (remove spaces, ensure + prefix)
    const normalizedPhone = phoneNumber.trim().startsWith('+')
      ? phoneNumber.trim()
      : `+${phoneNumber.trim()}`;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('whatsapp_number', normalizedPhone)
      .is('deleted_at', null) // Only active users
      .single();

    if (error) {
      // Not found is not an error, just return null
      if (error.code === 'PGRST116') {
        console.log(`[Supabase] User not found: ${normalizedPhone}`);
        return { data: null, error: null };
      }
      
      console.error('[Supabase] Error fetching user by WhatsApp:', error);
      return { data: null, error: new Error(error.message) };
    }

    console.log(`[Supabase] Found user: ${data.id}`);
    return { data, error: null };
  } catch (err) {
    console.error('[Supabase] Unexpected error in getUserByWhatsApp:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Get user's default/active project
 * Returns the most recently active project, or creates one if none exists
 * @param userId - User's profile ID
 * @returns Active project or null if none found
 */
export async function getUserDefaultProject(
  userId: string
): Promise<SupabaseResponse<Project>> {
  try {
    console.log(`[Supabase] Fetching default project for user: ${userId}`);

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // No active project found
      if (error.code === 'PGRST116') {
        console.log(`[Supabase] No active project found for user: ${userId}`);
        return { data: null, error: null };
      }

      console.error('[Supabase] Error fetching default project:', error);
      return { data: null, error: new Error(error.message) };
    }

    console.log(`[Supabase] Found default project: ${data.id}`);
    return { data, error: null };
  } catch (err) {
    console.error('[Supabase] Unexpected error in getUserDefaultProject:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Log WhatsApp message to audit table
 * @param messageData - WhatsApp message details
 * @returns Inserted message record or null on error
 */
export async function logWhatsAppMessage(
  messageData: WhatsAppMessageData
): Promise<SupabaseResponse<any>> {
  try {
    console.log(
      `[Supabase] Logging WhatsApp message: ${messageData.direction} - ${messageData.whatsapp_message_id || 'no-id'}`
    );

    // Set received_at timestamp
    const record = {
      ...messageData,
      received_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('whatsapp_messages')
      .insert(record)
      .select()
      .single();

    if (error) {
      console.error('[Supabase] Error logging WhatsApp message:', error);
      return { data: null, error: new Error(error.message) };
    }

    console.log(`[Supabase] WhatsApp message logged: ${data.id}`);
    return { data, error: null };
  } catch (err) {
    console.error('[Supabase] Unexpected error in logWhatsAppMessage:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Mark WhatsApp message as processed
 * @param messageId - Message ID to update
 * @param processed - Whether processing was successful
 * @param errorMessage - Optional error message if processing failed
 */
export async function updateWhatsAppMessageStatus(
  messageId: string,
  processed: boolean,
  errorMessage?: string
): Promise<SupabaseResponse<any>> {
  try {
    console.log(
      `[Supabase] Updating message status: ${messageId} - processed: ${processed}`
    );

    const { data, error } = await supabase
      .from('whatsapp_messages')
      .update({
        processed,
        processed_at: new Date().toISOString(),
        error_message: errorMessage || null,
      })
      .eq('id', messageId)
      .select()
      .single();

    if (error) {
      console.error('[Supabase] Error updating message status:', error);
      return { data: null, error: new Error(error.message) };
    }

    console.log(`[Supabase] Message status updated: ${data.id}`);
    return { data, error: null };
  } catch (err) {
    console.error('[Supabase] Unexpected error in updateWhatsAppMessageStatus:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Log AI API usage for cost tracking
 * @param usageData - AI usage details (tokens, model, cost)
 * @returns Inserted usage record or null on error
 */
export async function logAIUsage(
  usageData: AIUsageData
): Promise<SupabaseResponse<any>> {
  try {
    console.log(
      `[Supabase] Logging AI usage: ${usageData.model} - ${usageData.total_tokens} tokens - $${usageData.estimated_cost_usd}`
    );

    const { data, error } = await supabase
      .from('ai_usage_log')
      .insert(usageData)
      .select()
      .single();

    if (error) {
      console.error('[Supabase] Error logging AI usage:', error);
      return { data: null, error: new Error(error.message) };
    }

    console.log(`[Supabase] AI usage logged: ${data.id}`);
    return { data, error: null };
  } catch (err) {
    console.error('[Supabase] Unexpected error in logAIUsage:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Create a new user profile (typically called after WhatsApp message from unknown number)
 * @param whatsappNumber - User's WhatsApp number
 * @param fullName - User's full name (optional)
 * @returns Created profile or null on error
 */
export async function createUserProfile(
  whatsappNumber: string,
  fullName?: string
): Promise<SupabaseResponse<Profile>> {
  try {
    console.log(`[Supabase] Creating new user profile: ${whatsappNumber}`);

    // Normalize phone number
    const normalizedPhone = whatsappNumber.trim().startsWith('+')
      ? whatsappNumber.trim()
      : `+${whatsappNumber.trim()}`;

    const profileData = {
      whatsapp_number: normalizedPhone,
      full_name: fullName || `User ${normalizedPhone.slice(-4)}`,
      default_currency: 'UGX',
      preferred_language: 'en',
    };

    const { data, error } = await supabase
      .from('profiles')
      .insert(profileData)
      .select()
      .single();

    if (error) {
      console.error('[Supabase] Error creating user profile:', error);
      return { data: null, error: new Error(error.message) };
    }

    console.log(`[Supabase] User profile created: ${data.id}`);
    return { data, error: null };
  } catch (err) {
    console.error('[Supabase] Unexpected error in createUserProfile:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Update user's last active timestamp
 * @param userId - User's profile ID
 */
export async function updateUserLastActive(
  userId: string
): Promise<SupabaseResponse<void>> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        last_active_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      console.error('[Supabase] Error updating last active:', error);
      return { data: null, error: new Error(error.message) };
    }

    return { data: null, error: null };
  } catch (err) {
    console.error('[Supabase] Unexpected error in updateUserLastActive:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Get user's expense categories
 * @param userId - User's profile ID
 * @returns Array of expense categories
 */
export async function getUserExpenseCategories(
  userId: string
): Promise<SupabaseResponse<any[]>> {
  try {
    console.log(`[Supabase] Fetching expense categories for user: ${userId}`);

    const { data, error } = await supabase
      .from('expense_categories')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (error) {
      console.error('[Supabase] Error fetching expense categories:', error);
      return { data: null, error: new Error(error.message) };
    }

    console.log(`[Supabase] Found ${data.length} expense categories`);
    return { data, error: null };
  } catch (err) {
    console.error('[Supabase] Unexpected error in getUserExpenseCategories:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Get project summary with expense totals
 * Uses the deployed helper function get_project_summary(uuid)
 * @param projectId - Project ID
 * @returns Project summary with totals
 */
export async function getProjectSummary(
  projectId: string
): Promise<SupabaseResponse<any>> {
  try {
    console.log(`[Supabase] Fetching project summary: ${projectId}`);

    // Call the Supabase function
    const { data, error } = await supabase.rpc('get_project_summary', {
      proj_id: projectId,
    });

    if (error) {
      console.error('[Supabase] Error fetching project summary:', error);
      return { data: null, error: new Error(error.message) };
    }

    console.log(`[Supabase] Project summary retrieved`);
    return { data, error: null };
  } catch (err) {
    console.error('[Supabase] Unexpected error in getProjectSummary:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * Test Supabase connection
 * @returns true if connection is working, false otherwise
 */
export async function testConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1);
    
    if (error) {
      console.error('[Supabase] Connection test failed:', error);
      return false;
    }
    
    console.log('[Supabase] Connection test successful');
    return true;
  } catch (err) {
    console.error('[Supabase] Connection test error:', err);
    return false;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  supabase,
  getUserByWhatsApp,
  getUserDefaultProject,
  logWhatsAppMessage,
  updateWhatsAppMessageStatus,
  logAIUsage,
  createUserProfile,
  updateUserLastActive,
  getUserExpenseCategories,
  getProjectSummary,
  testConnection,
};


