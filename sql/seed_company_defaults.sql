-- Script para automatizar o cadastro de dados padrão para novas empresas
-- e popular empresas existentes que ainda não possuem esses dados.

CREATE OR REPLACE FUNCTION public.seed_company_defaults(p_company_id UUID)
RETURNS VOID AS $$
BEGIN
    -- 1. Inserir Condições de Produto
    INSERT INTO public.product_conditions (name, company_id)
    SELECT name, p_company_id
    FROM (VALUES 
        ('Novo'), 
        ('Seminovo'), 
        ('CPO'), 
        ('Open Box')
    ) AS v(name)
    WHERE NOT EXISTS (
        SELECT 1 FROM public.product_conditions 
        WHERE name = v.name AND company_id = p_company_id
    );

    -- 2. Inserir Formas de Pagamento
    -- Pix
    IF NOT EXISTS (SELECT 1 FROM public.payment_methods WHERE name = 'Pix' AND company_id = p_company_id) THEN
        INSERT INTO public.payment_methods (id, name, type, active, config, company_id)
        VALUES (
            gen_random_uuid()::text, 
            'Pix', 
            'cash', 
            true, 
            jsonb_build_object(
                '_meta_type', 'cash',
                '_meta_active', true,
                '_meta_variations', '[]'::jsonb,
                'debitRate', 0,
                'creditNoInterestRates', '[]'::jsonb,
                'creditWithInterestRates', '[]'::jsonb
            ), 
            p_company_id
        );
    END IF;

    -- Dinheiro
    IF NOT EXISTS (SELECT 1 FROM public.payment_methods WHERE name = 'Dinheiro' AND company_id = p_company_id) THEN
        INSERT INTO public.payment_methods (id, name, type, active, config, company_id)
        VALUES (
            gen_random_uuid()::text, 
            'Dinheiro', 
            'cash', 
            true, 
            jsonb_build_object(
                '_meta_type', 'cash',
                '_meta_active', true,
                'debitRate', 0
            ), 
            p_company_id
        );
    END IF;

    -- Cashback
    IF NOT EXISTS (SELECT 1 FROM public.payment_methods WHERE name = 'Cashback' AND company_id = p_company_id) THEN
        INSERT INTO public.payment_methods (id, name, type, active, config, company_id)
        VALUES (
            gen_random_uuid()::text, 
            'Cashback', 
            'cash', 
            true, 
            jsonb_build_object(
                '_meta_type', 'cash',
                '_meta_active', true,
                'debitRate', 0
            ), 
            p_company_id
        );
    END IF;

    -- Aparelho na troca
    IF NOT EXISTS (SELECT 1 FROM public.payment_methods WHERE name = 'Aparelho na troca' AND company_id = p_company_id) THEN
        INSERT INTO public.payment_methods (id, name, type, active, config, company_id)
        VALUES (
            gen_random_uuid()::text, 
            'Aparelho na troca', 
            'cash', 
            true, 
            jsonb_build_object(
                '_meta_type', 'cash',
                '_meta_active', true,
                'debitRate', 0
            ), 
            p_company_id
        );
    END IF;

    -- Cartão Débito
    IF NOT EXISTS (SELECT 1 FROM public.payment_methods WHERE name = 'Cartão Débito' AND company_id = p_company_id) THEN
        INSERT INTO public.payment_methods (id, name, type, active, config, company_id)
        VALUES (
            gen_random_uuid()::text, 
            'Cartão Débito', 
            'card', 
            true, 
            jsonb_build_object(
                '_meta_type', 'card',
                '_meta_active', true,
                'debitRate', 0
            ), 
            p_company_id
        );
    END IF;

    -- Cartão Crédito
    IF NOT EXISTS (SELECT 1 FROM public.payment_methods WHERE name = 'Cartão Crédito' AND company_id = p_company_id) THEN
        INSERT INTO public.payment_methods (id, name, type, active, config, company_id)
        VALUES (
            gen_random_uuid()::text, 
            'Cartão Crédito', 
            'card', 
            true, 
            jsonb_build_object(
                '_meta_type', 'card',
                '_meta_active', true,
                'debitRate', 0,
                'creditNoInterestRates', '[]'::jsonb,
                'creditWithInterestRates', '[]'::jsonb
            ), 
            p_company_id
        );
    END IF;

    -- Crediário
    IF NOT EXISTS (SELECT 1 FROM public.payment_methods WHERE name = 'Crediário' AND company_id = p_company_id) THEN
        INSERT INTO public.payment_methods (id, name, type, active, config, company_id)
        VALUES (
            gen_random_uuid()::text, 
            'Crediário', 
            'cash', 
            true, 
            jsonb_build_object(
                '_meta_type', 'cash',
                '_meta_active', true,
                'debitRate', 0
            ), 
            p_company_id
        );
    END IF;

    -- 3. Inserir Garantias
    INSERT INTO public.warranties (name, days, company_id)
    SELECT name, days, p_company_id
    FROM (VALUES 
        ('1 Ano', 365), 
        ('6 Meses', 180), 
        ('3 Meses', 90), 
        ('30 Dias', 30)
    ) AS v(name, days)
    WHERE NOT EXISTS (
        SELECT 1 FROM public.warranties 
        WHERE name = v.name AND company_id = p_company_id
    );

    -- 4. Inserir Locais de Estoque
    INSERT INTO public.storage_locations (name, company_id)
    SELECT name, p_company_id
    FROM (VALUES 
        ('Estoque Principal'), 
        ('Loja')
    ) AS v(name)
    WHERE NOT EXISTS (
        SELECT 1 FROM public.storage_locations 
        WHERE name = v.name AND company_id = p_company_id
    );

    -- 5. Inserir Termos de Recebimento
    INSERT INTO public.receipt_terms (name, "warrantyTerm", "warrantyExclusions", "imageRights", company_id)
    SELECT name, to_jsonb(warranty_term), to_jsonb(warranty_exclusions), to_jsonb(image_rights), p_company_id
    FROM (VALUES 
        ('Termo Padrão', 'Garantia legal de 90 dias.', 'Danos físicos, contato com líquidos, violação de lacre.', 'Autorizo o uso de imagem para fins de registro.', p_company_id)
    ) AS v(name, warranty_term, warranty_exclusions, image_rights, company_id)
    WHERE NOT EXISTS (SELECT 1 FROM public.receipt_terms WHERE name = v.name AND company_id = p_company_id);

    -- 6. Inserir Itens de Checklist
    INSERT INTO public.checklist_items (name, company_id)
    SELECT name, p_company_id
    FROM (VALUES 
        ('Arranhado'), ('Tela Trincada'), ('Amassado'), ('Não Liga'), 
        ('Sem Wi-Fi'), ('Bateria Ruim'), ('Câm. Frontal'), ('Câm. Traseira'), 
        ('Sem Som'), ('Mic Ruim')
    ) AS v(name)
    WHERE NOT EXISTS (SELECT 1 FROM public.checklist_items WHERE name = v.name AND company_id = p_company_id);

    -- 7. Inserir Garantias de OS (os_warranties)
    INSERT INTO public.os_warranties (name, days, company_id)
    SELECT name, days, p_company_id
    FROM (VALUES 
        ('Garantia de Serviço - 90 Dias', 90, p_company_id),
        ('Sem Garantia', 0, p_company_id)
    ) AS v(name, days, company_id)
    WHERE NOT EXISTS (SELECT 1 FROM public.os_warranties WHERE name = v.name AND company_id = p_company_id);

    -- 8. Inserir Termos de OS (os_receipt_terms)
    INSERT INTO public.os_receipt_terms (name, "warrantyTerm", "warrantyExclusions", "imageRights", company_id)
    SELECT name, to_jsonb(warranty_term), to_jsonb(warranty_exclusions), to_jsonb(image_rights), p_company_id
    FROM (VALUES 
        ('Termo de OS Padrão', 'Garantia de 90 dias sobre a mão de obra.', 'Danos por mau uso.', 'Uso para fins técnicos.', p_company_id)
    ) AS v(name, warranty_term, warranty_exclusions, image_rights, company_id)
    WHERE NOT EXISTS (SELECT 1 FROM public.os_receipt_terms WHERE name = v.name AND company_id = p_company_id);

    -- Formas de Pagamento OS
    -- Pix OS
    IF NOT EXISTS (SELECT 1 FROM public.os_payment_methods WHERE name = 'Pix' AND company_id = p_company_id) THEN
        INSERT INTO public.os_payment_methods (id, name, type, active, config, company_id)
        VALUES (
            'os_' || gen_random_uuid()::text, 
            'Pix', 
            'cash', 
            true, 
            jsonb_build_object('_meta_type', 'cash', '_meta_active', true, 'debitRate', 0), 
            p_company_id
        );
    END IF;

    -- Dinheiro OS
    IF NOT EXISTS (SELECT 1 FROM public.os_payment_methods WHERE name = 'Dinheiro' AND company_id = p_company_id) THEN
        INSERT INTO public.os_payment_methods (id, name, type, active, config, company_id)
        VALUES (
            'os_' || gen_random_uuid()::text, 
            'Dinheiro', 
            'cash', 
            true, 
            jsonb_build_object('_meta_type', 'cash', '_meta_active', true, 'debitRate', 0), 
            p_company_id
        );
    END IF;

    -- Cartão Débito OS
    IF NOT EXISTS (SELECT 1 FROM public.os_payment_methods WHERE name = 'Cartão Débito' AND company_id = p_company_id) THEN
        INSERT INTO public.os_payment_methods (id, name, type, active, config, company_id)
        VALUES (
            'os_' || gen_random_uuid()::text, 
            'Cartão Débito', 
            'card', 
            true, 
            jsonb_build_object('_meta_type', 'card', '_meta_active', true, 'debitRate', 0), 
            p_company_id
        );
    END IF;

    -- Cartão Crédito OS
    IF NOT EXISTS (SELECT 1 FROM public.os_payment_methods WHERE name = 'Cartão Crédito' AND company_id = p_company_id) THEN
        INSERT INTO public.os_payment_methods (id, name, type, active, config, company_id)
        VALUES (
            'os_' || gen_random_uuid()::text, 
            'Cartão Crédito', 
            'card', 
            true, 
            jsonb_build_object('_meta_type', 'card', '_meta_active', true, 'debitRate', 0, 'creditNoInterestRates', '[]'::jsonb, 'creditWithInterestRates', '[]'::jsonb), 
            p_company_id
        );
    END IF;

    -- Crediário OS
    IF NOT EXISTS (SELECT 1 FROM public.os_payment_methods WHERE name = 'Crediário' AND company_id = p_company_id) THEN
        INSERT INTO public.os_payment_methods (id, name, type, active, config, company_id)
        VALUES (
            'os_' || gen_random_uuid()::text, 
            'Crediário', 
            'cash', 
            true, 
            jsonb_build_object('_meta_type', 'cash', '_meta_active', true, 'debitRate', 0), 
            p_company_id
        );
    END IF;

    -- 9. Inserir Dados Bloom (Demonstração: Xiaomi)
    DECLARE
        v_brand_id UUID;
        v_category_id UUID;
        v_grade_id UUID;
    BEGIN
        -- Marca: Xiaomi
        SELECT id INTO v_brand_id FROM public.brands WHERE name = 'Xiaomi' AND company_id = p_company_id;
        IF v_brand_id IS NULL THEN
            INSERT INTO public.brands (name, company_id) VALUES ('Xiaomi', p_company_id) RETURNING id INTO v_brand_id;
        END IF;

        -- Categoria: Smartphone
        SELECT id INTO v_category_id FROM public.categories WHERE name = 'Smartphone' AND company_id = p_company_id;
        IF v_category_id IS NULL THEN
            INSERT INTO public.categories (name, brand_id, company_id) VALUES ('Smartphone', v_brand_id, p_company_id) RETURNING id INTO v_category_id;
        END IF;

        -- Modelo: Redmi Note 15 8GB/256GB Preto
        IF NOT EXISTS (SELECT 1 FROM public.product_models WHERE name = 'Redmi Note 15 8GB/256GB Preto' AND company_id = p_company_id) THEN
            INSERT INTO public.product_models (name, "brandId", "categoryId", category_id, company_id) 
            VALUES ('Redmi Note 15 8GB/256GB Preto', v_brand_id, v_category_id, v_category_id, p_company_id);
        END IF;

        -- Grade: Nacionalidade
        SELECT id INTO v_grade_id FROM public.grades WHERE name = 'Nacionalidade' AND company_id = p_company_id;
        IF v_grade_id IS NULL THEN
            INSERT INTO public.grades (name, company_id) VALUES ('Nacionalidade', p_company_id) RETURNING id INTO v_grade_id;
        END IF;

        -- Variação de grade: Global
        IF NOT EXISTS (SELECT 1 FROM public.grade_values WHERE name = 'Global' AND grade_id = v_grade_id AND company_id = p_company_id) THEN
            INSERT INTO public.grade_values (name, grade_id, company_id) VALUES ('Global', v_grade_id, p_company_id);
        END IF;
    END;

END;
$$ LANGUAGE plpgsql;

-- Trigger para novas empresas
CREATE OR REPLACE FUNCTION public.on_company_created_seed_data()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.seed_company_defaults(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_seed_company_defaults ON public.companies;
CREATE TRIGGER tr_seed_company_defaults
AFTER INSERT ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.on_company_created_seed_data();

-- Popular empresas existentes (executar uma vez)
DO $$
DECLARE
    company_record RECORD;
BEGIN
    FOR company_record IN SELECT id FROM public.companies LOOP
        PERFORM public.seed_company_defaults(company_record.id);
    END LOOP;
END $$;
