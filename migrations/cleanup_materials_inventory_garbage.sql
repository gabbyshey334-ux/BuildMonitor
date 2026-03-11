-- ============================================================================
-- Cleanup: Remove garbage rows from materials_inventory
-- Matches validation in WhatsApp webhook (GARBAGE_MATERIAL_NAMES, min length, quantity)
-- ============================================================================

-- Delete rows with generic/invalid names or invalid quantity
DELETE FROM materials_inventory
WHERE
  LOWER(TRIM(name)) IN (
    'material', 'item', 'thing', 'stuff', 'goods', 'product', 'units'
  )
  OR LENGTH(TRIM(name)) < 2
  OR COALESCE(quantity, 0) <= 0;

-- Optional: report how many were deleted (run separately if desired)
-- SELECT COUNT(*) FROM materials_inventory WHERE ...
