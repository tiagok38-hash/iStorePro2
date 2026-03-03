CREATE TABLE IF NOT EXISTS public.catalog_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    catalog_item_id UUID REFERENCES public.catalog_items(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.catalog_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert to catalog_events" ON public.catalog_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated read to catalog_events" ON public.catalog_events FOR SELECT TO authenticated USING (true);
