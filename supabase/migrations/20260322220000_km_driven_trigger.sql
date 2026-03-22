-- Migration: Fix driver_shifts status when ended
-- 
-- Context: DeliveryShiftPage.tsx (web) was not setting status = 'ended'
-- when a driver ended their shift. AccountingPage.tsx queries shifts
-- with .eq('status', 'ended'), so those shifts were invisible in accounting.
--
-- Note: km_driven is a GENERATED COLUMN (km_out - km_in), auto-calculated by DB.
-- No trigger needed; just ensure km_out is set when ending a shift.

-- Backfill: set status = 'ended' for all completed shifts that were missing it
UPDATE driver_shifts
SET status = 'ended'
WHERE ended_at IS NOT NULL
  AND status IS DISTINCT FROM 'ended';
