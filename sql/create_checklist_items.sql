-- 1. Create table for dynamic checklist items
CREATE TABLE IF NOT EXISTS checklist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add some default initial items if table is empty
INSERT INTO checklist_items (name)
SELECT name FROM (
    VALUES
        ('Arranhado'),
        ('Tela Trincada'),
        ('Amassado'),
        ('Não Liga'),
        ('Sem Wi-Fi'),
        ('Bateria Ruim'),
        ('Câm. Frontal'),
        ('Câm. Traseira'),
        ('Sem Som'),
        ('Mic Ruim')
) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM checklist_items LIMIT 1);

-- 3. Enable RLS and setup policies
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for all users" ON checklist_items FOR ALL USING (true);
