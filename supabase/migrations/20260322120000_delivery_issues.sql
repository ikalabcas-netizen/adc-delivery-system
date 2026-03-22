-- Migration for delivery_issues table

CREATE TABLE IF NOT EXISTS public.delivery_issues (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    order_id TEXT,
    issue_category TEXT NOT NULL,
    description TEXT,
    photo_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, investigating, resolved, cancelled
    dispatcher_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.delivery_issues ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Drivers can view their own issues"
    ON public.delivery_issues
    FOR SELECT
    USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can insert their own issues"
    ON public.delivery_issues
    FOR INSERT
    WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Admins can view and edit all issues"
    ON public.delivery_issues
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Trigger to update updated_at
CREATE TRIGGER update_delivery_issues_updated_at
    BEFORE UPDATE ON public.delivery_issues
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
