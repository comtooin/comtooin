-- Add all_day and end_time columns to schedules table
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS all_day BOOLEAN DEFAULT TRUE;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;

-- If start_time is currently a date or string, it might need casting to timestamptz for better support,
-- but since the app already uses it as a string, we'll keep it as is or cast it if needed.
-- For now, we'll just ensure the columns exist.
