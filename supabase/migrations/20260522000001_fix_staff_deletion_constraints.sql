-- Fix foreign key constraints for staff table to allow deletion
-- 1. Update schedules table constraints
ALTER TABLE public.schedules 
    DROP CONSTRAINT IF EXISTS schedules_staff_id_fkey;

ALTER TABLE public.schedules
    ADD CONSTRAINT schedules_staff_id_fkey 
    FOREIGN KEY (staff_id) 
    REFERENCES public.staff(id) 
    ON DELETE SET NULL;

-- 2. Check and update requests or other tables if they reference staff
-- If there are comments or other tables, we should also ensure they don't block deletion
DO $$ 
BEGIN 
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'comments_user_id_fkey'
    ) THEN
        ALTER TABLE public.comments DROP CONSTRAINT comments_user_id_fkey;
        ALTER TABLE public.comments ADD CONSTRAINT comments_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES public.staff(id) ON DELETE SET NULL;
    END IF;
END $$;
