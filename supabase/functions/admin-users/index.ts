// Supabase Edge Function: admin-users
// Master-only user administration. Uses the service role key to create/invite
// users and to manage their project memberships and dataset permissions.
//
// Actions:
//   invite          { email, fullName?, password?, projectIds[], datasets[] }
//   delete          { userId }
//   update_password { userId, password }

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-project-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: profile } = await admin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (profile?.role !== 'master') {
      return json({ error: 'Forbidden: master role required' }, 403);
    }

    const body = await req.json();
    const action = body.action ?? 'invite';

    if (action === 'delete') {
      const { userId } = body;
      if (!userId) return json({ error: 'userId required' }, 400);
      if (userId === user.id) return json({ error: 'Cannot delete yourself' }, 400);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === 'update_password') {
      const { userId, password } = body;
      if (!userId || !password) return json({ error: 'userId and password required' }, 400);
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) throw error;
      return json({ success: true });
    }

    // invite / create
    const { email, fullName, password, projectIds = [], datasets = [] } = body;
    if (!email) return json({ error: 'email required' }, 400);

    let newUserId: string | undefined;
    if (password) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName ?? '' },
      });
      if (error) throw error;
      newUserId = data.user?.id;
    } else {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName ?? '' },
      });
      if (error) throw error;
      newUserId = data.user?.id;
    }
    if (!newUserId) return json({ error: 'Could not create user' }, 500);

    await admin.from('user_profiles').upsert({
      id: newUserId,
      email,
      full_name: fullName ?? null,
      role: 'user',
    });

    if (projectIds.length) {
      await admin.from('project_members').upsert(
        projectIds.map((pid: string) => ({
          project_id: pid,
          user_id: newUserId,
          role: 'member',
        })),
        { onConflict: 'project_id,user_id' }
      );

      const rows: Array<{
        user_id: string;
        project_id: string;
        dataset: string;
        can_access: boolean;
      }> = [];
      for (const pid of projectIds) {
        for (const ds of datasets) {
          rows.push({ user_id: newUserId, project_id: pid, dataset: ds, can_access: true });
        }
      }
      if (rows.length) {
        await admin
          .from('user_dataset_permissions')
          .upsert(rows, { onConflict: 'user_id,project_id,dataset' });
      }
    }

    return json({ success: true, userId: newUserId });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});
