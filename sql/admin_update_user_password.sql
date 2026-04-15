-- Create a Supabase RPC to allow administrators to update the password of any user.
-- This function verifies if the user calling it is an admin (has permissionProfileId = 'profile-admin' or canManageUsers)

CREATE OR REPLACE FUNCTION admin_update_user_password(target_user_id UUID, new_password TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_profile_id TEXT;
  caller_company_id UUID;
  target_company_id UUID;
  can_manage_users BOOLEAN;
BEGIN
  -- Verificar se quem está chamando é um usuário logado
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autorizado. Usuário não autenticado.';
  END IF;

  -- Buscar informações do usuário que está chamando a função
  SELECT "permissionProfileId", "company_id" INTO caller_profile_id, caller_company_id
  FROM public.users
  WHERE id = auth.uid();

  -- Buscar informações da empresa do usuário alvo para garantir que são da mesma empresa
  SELECT "company_id" INTO target_company_id
  FROM public.users
  WHERE id = target_user_id;

  -- Se empresas forem diferentes, negar acesso
  IF caller_company_id IS NOT NULL AND target_company_id IS NOT NULL AND caller_company_id != target_company_id THEN
    RAISE EXCEPTION 'Acesso negado. O usuário não pertence à sua empresa.';
  END IF;

  -- Checar permissões (assumimos que 'profile-admin' tem sempre permissão)
  IF caller_profile_id != 'profile-admin' THEN
    -- Opcional: verificar no JSON se tem a permissão canManageUsers
    SELECT (permissions->>'canManageUsers')::boolean INTO can_manage_users
    FROM public.permissions_profiles
    WHERE id = caller_profile_id;
    
    IF can_manage_users IS NOT TRUE THEN
      RAISE EXCEPTION 'Acesso negado. Você não tem permissão para gerenciar usuários.';
    END IF;
  END IF;

  -- Atualizar a senha no schema auth.users
  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE id = target_user_id;

END;
$$;
