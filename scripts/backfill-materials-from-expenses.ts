#!/usr/bin/env tsx
/**
 * Backfill materials_inventory from existing expenses
 *
 * Parses expense descriptions for material patterns (e.g. "10 bags cement")
 * and upserts into materials_inventory + material_transactions.
 *
 * Run once. Re-running will add quantities again (no deduplication).
 *
 * Usage: npx tsx scripts/backfill-materials-from-expenses.ts [--dry-run]
 */

import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(process.cwd(), '.env') });

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Check .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const MATERIAL_KEYWORDS = [
  'cement', 'sand', 'gravel', 'bricks', 'iron bars', 'steel', 'timber', 'wood',
  'poles', 'tiles', 'paint', 'roofing', 'pipes', 'wire', 'aggregate', 'ballast',
  'blocks', 'stone',
];

function parseMaterialFromDescription(desc: string): { quantity: number; unit: string; item: string } | null {
  if (!desc || typeof desc !== 'string') return null;
  const m = desc.trim().match(/^(\d+(?:\.\d+)?)\s*(bags?|tonnes?|pieces?|bars?|sheets?|litres?|rolls?|units?)?\s*(?:of\s+)?(.+)$/i);
  if (m) {
    const qty = parseFloat(m[1]);
    const unit = (m[2] || 'units').toLowerCase() || 'units';
    const item = m[3].trim();
    if (item && !isNaN(qty) && qty > 0) return { quantity: qty, unit, item };
  }
  const fallback = desc.match(/(\d+)\s*(bags?|pieces?|units?|kg|tons?)?/i);
  if (fallback) {
    const item = desc.replace(fallback[0], '').replace(/\s*(?:for|@|at)\s*[\d,.]+\s*$/i, '').trim();
    if (item.length > 1 && MATERIAL_KEYWORDS.some((k) => item.toLowerCase().includes(k))) {
      return {
        quantity: parseFloat(fallback[1]),
        unit: (fallback[2] || 'units').toLowerCase(),
        item,
      };
    }
  }
  return null;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    console.log('🔍 DRY RUN — no changes will be made\n');
  }

  console.log('Fetching expenses...');
  const { data: expenses, error: expError } = await supabase
    .from('expenses')
    .select('id, project_id, user_id, description, amount, expense_date, quantity_logged')
    .is('deleted_at', null)
    .order('expense_date', { ascending: true });

  if (expError) {
    console.error('Failed to fetch expenses:', expError.message);
    process.exit(1);
  }

  if (!expenses || expenses.length === 0) {
    console.log('No expenses found.');
    return;
  }

  console.log(`Found ${expenses.length} expenses. Scanning for material patterns...\n`);

  let processed = 0;
  let skipped = 0;

  for (const exp of expenses) {
    const desc = exp.description || '';
    let parsed = parseMaterialFromDescription(desc);

    // Fallback: use quantity_logged if description is just the item name
    if (!parsed && exp.quantity_logged) {
      const qty = parseFloat(String(exp.quantity_logged));
      if (!isNaN(qty) && qty > 0 && desc.trim().length > 1) {
        parsed = { quantity: qty, unit: 'units', item: desc.trim() };
      }
    }

    if (!parsed || !parsed.item || parsed.quantity <= 0) {
      skipped++;
      continue;
    }

    const amount = parseFloat(String(exp.amount || 0)) || 0;
    const unitCost = amount && parsed.quantity > 0 ? amount / parsed.quantity : 0;
    const totalCost = amount || parsed.quantity * unitCost;
    const nameNorm = parsed.item.toLowerCase().trim();
    const projectId = exp.project_id;
    const userId = exp.user_id;
    const now = new Date().toISOString();

    if (dryRun) {
      console.log(`  [DRY] ${desc} → ${parsed.quantity} ${parsed.unit} of ${nameNorm} (project: ${projectId})`);
      processed++;
      continue;
    }

    const { data: existing } = await supabase
      .from('materials_inventory')
      .select('id, quantity, unit_cost, total_cost')
      .eq('project_id', projectId)
      .eq('name', nameNorm)
      .maybeSingle();

    if (existing) {
      const newQty = parseFloat(String(existing.quantity || 0)) + parsed.quantity;
      const newTotalCost = parseFloat(String(existing.total_cost || 0)) + totalCost;
      const { error: updateErr } = await supabase
        .from('materials_inventory')
        .update({
          quantity: newQty,
          unit_cost: unitCost || parseFloat(String(existing.unit_cost || 0)),
          total_cost: newTotalCost,
          last_purchased_at: now,
          updated_at: now,
        })
        .eq('id', existing.id);

      if (updateErr) {
        console.error(`  ❌ Update failed for ${nameNorm}:`, updateErr.message);
        continue;
      }

      await supabase.from('material_transactions').insert({
        material_id: existing.id,
        project_id: projectId,
        user_id: userId,
        transaction_type: 'purchase',
        quantity: parsed.quantity,
        unit_cost: unitCost,
        total_cost: totalCost,
        description: `Backfill from expense: ${desc}`,
        source: 'dashboard',
      });
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from('materials_inventory')
        .insert({
          project_id: projectId,
          user_id: userId,
          name: nameNorm,
          quantity: parsed.quantity,
          unit: parsed.unit || 'units',
          unit_cost: unitCost,
          total_cost: totalCost,
          source: 'dashboard',
          last_purchased_at: now,
          updated_at: now,
        })
        .select('id')
        .single();

      if (insertErr) {
        console.error(`  ❌ Insert failed for ${nameNorm}:`, insertErr.message);
        continue;
      }

      if (inserted?.id) {
        await supabase.from('material_transactions').insert({
          material_id: inserted.id,
          project_id: projectId,
          user_id: userId,
          transaction_type: 'purchase',
          quantity: parsed.quantity,
          unit_cost: unitCost,
          total_cost: totalCost,
          description: `Backfill from expense: ${desc}`,
          source: 'dashboard',
        });
      }
    }

    console.log(`  ✅ ${desc} → ${parsed.quantity} ${parsed.unit} of ${nameNorm}`);
    processed++;
  }

  console.log(`\nDone. Processed: ${processed}, Skipped: ${skipped}`);
  if (dryRun && processed > 0) {
    console.log('\nRun without --dry-run to apply changes.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
