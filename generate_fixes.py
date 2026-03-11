import json
import os

with open('/Users/istore/.gemini/antigravity/brain/3f9224c4-5d0d-44af-a855-9d62d09a546f/.system_generated/steps/204/output.txt', 'r') as f:
    data = json.load(f)

sql = []

# Add company_id to os_part_usage_history
sql.append("-- Fix os_part_usage_history missing company_id")
sql.append("ALTER TABLE public.os_part_usage_history ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;")
sql.append("CREATE INDEX IF NOT EXISTS idx_os_part_usage_history_company_id ON public.os_part_usage_history(company_id);")
sql.append("")

lints = data.get("result", {}).get("lints", [])

# Handle Unindexed Foreign Keys
sql.append("-- Missing Foreign Key Indexes")
for lint in lints:
    if lint["name"] == "unindexed_foreign_keys":
        schema = lint["metadata"]["schema"]
        table = lint["metadata"]["name"]
        fkey = lint["metadata"]["fkey_name"]
        cols = ", ".join([f'"{c}"' for c in lint["metadata"].get("fkey_columns_names", ["fk_col_" + str(i) for i in lint["metadata"]["fkey_columns"]])])
        
        # We don't have column names directly in the JSON, so let's check information_schema via SQL, or just use the suggested remediation:
        # Wait, the fkey_columns is just a list of ordinals! I need column names.
        pass

# Wait, if we don't have column names easily, I will just generate a PL/pgSQL function to automatically index all foreign keys without an index!
pg_script = """
DO $$
DECLARE
    r RECORD;
    idx_name TEXT;
    q TEXT;
BEGIN
    FOR r IN (
        SELECT
            tc.table_name,
            kcu.column_name,
            tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
    ) LOOP
        idx_name := 'idx_' || r.table_name || '_' || r.column_name;
        
        IF NOT EXISTS (
            SELECT 1 FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = idx_name AND n.nspname = 'public'
        ) THEN
            q := 'CREATE INDEX IF NOT EXISTS "' || idx_name || '" ON "public"."' || r.table_name || '" ("' || r.column_name || '");';
            EXECUTE q;
        END IF;
    END LOOP;
END;
$$;
"""

sql.append(pg_script)

# Duplicate Indexes
sql.append("\n-- Clean up Duplicate Indexes")
for lint in lints:
    if lint["name"] == "duplicate_index":
        table = lint["metadata"]["name"]
        indexes = lint["metadata"]["indexes"]
        # keep the first one, drop the rest
        for idx in indexes[1:]:
            sql.append(f"DROP INDEX IF EXISTS public.{idx};")


with open('/Users/istore/Desktop/Arquivos iStorePro/backup_istorepro_2026-02-10_final_v24/sql/fix_final_multitenant_indexes.sql', 'w') as out_f:
    out_f.write("\n".join(sql))

print("Script generated at sql/fix_final_multitenant_indexes.sql")
