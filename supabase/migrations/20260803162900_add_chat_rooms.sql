-- Create public.chat_rooms table
CREATE TABLE IF NOT EXISTS public.chat_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    name TEXT NOT NULL,
    created_by UUID REFERENCES public.staff(id) ON DELETE SET NULL
);

-- Enable RLS for chat_rooms
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable read access for all staff" ON public.chat_rooms;
DROP POLICY IF EXISTS "Enable insert for staff" ON public.chat_rooms;
DROP POLICY IF EXISTS "Enable delete for creator or admin" ON public.chat_rooms;

-- Policies for public.chat_rooms
-- 1. All staff can view chat rooms
CREATE POLICY "Enable read access for all staff" ON public.chat_rooms
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.staff
            WHERE auth_user_id = auth.uid()
        )
    );

-- 2. Staff can create chat rooms
CREATE POLICY "Enable insert for staff" ON public.chat_rooms
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.staff
            WHERE auth_user_id = auth.uid() AND id = created_by
        )
    );

-- 3. Room creator or admin can delete chat rooms
CREATE POLICY "Enable delete for creator or admin" ON public.chat_rooms
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.staff
            WHERE auth_user_id = auth.uid() AND (id = created_by OR role = 'admin')
        )
    );

-- Insert a default general chat room if it doesn't exist
INSERT INTO public.chat_rooms (id, name)
VALUES ('00000000-0000-0000-0000-000000000000', '기본 대화방')
ON CONFLICT (id) DO NOTHING;

-- Add room_id to public.memos table referencing chat_rooms(id)
ALTER TABLE public.memos ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE;

-- Update existing memos to be in the default general room if they don't have a room_id
UPDATE public.memos SET room_id = '00000000-0000-0000-0000-000000000000' WHERE room_id IS NULL;

-- Enable Realtime for chat_rooms table
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_rooms;
  EXCEPTION WHEN duplicate_object OR undefined_object THEN
    NULL;
  END;
END $$;
