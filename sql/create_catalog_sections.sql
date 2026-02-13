-- Add catalog_sections table
CREATE TABLE IF NOT EXISTS catalog_sections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    emoji TEXT DEFAULT '📋',
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE catalog_sections ENABLE ROW LEVEL SECURITY;

-- Policy: allow all authenticated users to read
CREATE POLICY "Allow authenticated read" ON catalog_sections FOR SELECT TO authenticated USING (true);
-- Policy: allow all authenticated users to manage
CREATE POLICY "Allow authenticated manage" ON catalog_sections FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert default sections
INSERT INTO catalog_sections (name, emoji, display_order) VALUES
    ('Destaques', '⭐', 0),
    ('iPhones Seminovos', '📱', 1),
    ('iPhones Lacrados', '📦', 2),
    ('Acessórios Apple', '🎧', 3),
    ('Promoções', '🔥', 4),
    ('Outros', '📋', 5);

-- Add image_urls column to catalog_items
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';
