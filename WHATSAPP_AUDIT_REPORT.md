# WhatsApp Bot Intelligence & Behavior Audit Report

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1 | Natural language NLU | ✅ | AI (Gemini/OpenAI) processes all messages; preClassifyIntent regex first, unknown → classifyIntent → AI |
| 2 | No menu fallback | ✅ | GREETING/default → handleNaturalLanguageQuery (no "1. Log expense 2. Check budget" menu) |
| 3 | Context awareness | ✅ | getActiveProject loads project; all queries use project_id |
| 4 | No hallucination | ✅ | Prompts: "Use ONLY data provided", "Never invent", "Do not make up numbers" |
| 5 | Multi-item expense | ❌ | Only first item extracted; no array/loop for "10 bags cement and 5 poles" |
| 6 | Expense confirmation itemized | ⚠️ | Confirms with description+amount but not exact "✅ Logged!\n• item — UGX\n• item — UGX\nTotal" format |
| 7 | Labor/service detection | ⚠️ | No explicit SKIP_KEYWORDS; labor not added to materials (MATERIAL_KEYWORDS) but should be explicit |
| 8 | Expense query | ✅ | handleBudgetQuery: SUM(amount), total spent, remaining, pct |
| 9 | Auto inventory | ⚠️ | Material purchase via expense asks YES/NO before adding; MATERIAL_LOG direct adds immediately |
| 10 | Inventory confirmation | ⚠️ | handleMaterialLog says "Current stock: X" but format differs from checklist |
| 11 | Usage tracking | ✅ | UPDATE quantity, material_transactions usage, reply with remaining |
| 12 | Low stock alert | ✅ | newQty <= lowThreshold → "⚠️ Low stock" in reply |
| 13 | Stock query | ✅ | Single-material: "You have X unit of Y. Last purchased: date." |
| 14 | Purchase history query | ✅ | handleNaturalLanguageQuery "when did I buy X" → expenses ILIKE, reply with date+amount |
| 15 | Garbage data prevention | ❌ | No name length >= 2, no blocklist for material/item/thing/stuff |
| 16 | Worker count | ✅ | upsertDailyLog with worker_count |
| 17 | Daily activity entries | ❌ | Progress goes to tasks + notes; NOT to daily_logs.activity_entries |
| 18 | Photo logging | ⚠️ | Uploads to site-photos bucket, upserts daily_logs.photo_urls; no site_photos table/caption prompt |
| 19 | Issue logging | ❌ | No INSERT into issues from webhook for "foundation crack" type messages |
| 20 | Issue severity | ❌ | N/A - no issue logging from webhook |
| 21 | Project switching | ✅ | UPDATE profiles active_project_id, confirm switch |
| 22 | Project query | ⚠️ | Works via handleNaturalLanguageQuery context; no explicit "which project am I working on" handler |
| 23 | Budget alert | ⚠️ | handleBudgetQuery warns if pct>80; NOT proactive after every expense insert |
| 24 | Multilingual | ⚠️ | Luganda translated to English for parsing; AI responds in English, not "same language as user" |
| 25 | Friendly tone | ✅ | firstName, varied greetings via AI |
| 26 | Error handling | ✅ | try/catch, user-facing "Sorry, please try again" |
| 27 | User isolation | ✅ | Queries filter by user_id and project ownership |
| 28 | Onboarding complete | ✅ | onboarding_completed_at checked; redirect to onboarding if not |
| 29 | Duplicate prevention | ❌ | No idempotency or time-based deduplication |
