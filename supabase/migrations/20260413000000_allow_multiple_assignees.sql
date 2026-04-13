-- Migration to allow multiple assignees in schedules
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS staff_ids TEXT[];

-- Migrate existing staff_id to staff_ids array
UPDATE schedules 
SET staff_ids = ARRAY[staff_id] 
WHERE staff_id IS NOT NULL AND (staff_ids IS NULL OR array_length(staff_ids, 1) = 0);
