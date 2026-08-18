import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreatePlayerBody {
  action?: "reset_password";
  user_id?: string;
  nome?: string;
  apelido?: string | null;
  numero?: number | null;
  posicao?: string | null;
  telefone?: string | null;
  telefone_normalizado?: string | null;
  data_entrada?: string | null;
  data_nascimento?: string | null;
  observacoes?: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    if (roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Método não permitido" }), {
        status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: CreatePlayerBody = await req.json();
// ============================================
// REDEFINIR SENHA DE JOGADOR
// ============================================
if (body.action === "reset_password") {
  const userId = body.user_id;

  if (!userId) {
    return new Response(JSON.stringify({
      error: "user_id é obrigatório"
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Buscar jogador
  const { data: player, error: playerErr } = await adminClient
    .from("profiles")
    .select("id, user_id, nome, telefone_normalizado, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (playerErr || !player) {
    return new Response(JSON.stringify({
      error: "Jogador não encontrado"
    }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (player.status !== "active") {
    return new Response(JSON.stringify({
      error: "O jogador não está ativo"
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Gerar senha temporária aleatória de 6 dígitos
  const tempPassword = Math.floor(
    100000 + Math.random() * 900000
  ).toString();

  // Alterar senha diretamente no Supabase Auth
  const { error: authErr } =
    await adminClient.auth.admin.updateUserById(
      userId,
      { password: tempPassword }
    );

  if (authErr) {
    console.error("Erro ao redefinir senha no Auth:", authErr);

    return new Response(JSON.stringify({
      error: authErr.message
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Atualizar profile
  const { error: profileErr } = await adminClient
    .from("profiles")
    .update({
      must_change_password: true,
      temp_password: tempPassword,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (profileErr) {
    console.error("Erro ao atualizar profile:", profileErr);

    return new Response(JSON.stringify({
      error: "A senha foi alterada no Auth, mas não foi possível atualizar o perfil. Não tente redefinir novamente sem verificar o usuário."
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    success: true,
    player: {
      id: player.id,
      user_id: player.user_id,
      nome: player.nome,
    },
    credentials: {
      password: tempPassword,
    },
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
    if (!body.nome || !body.nome.trim()) {
      return new Response(JSON.stringify({ error: "Nome é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const telefoneNormalizado = body.telefone_normalizado || "";
    if (!telefoneNormalizado || telefoneNormalizado.length < 10) {
      return new Response(JSON.stringify({ error: "Telefone válido é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check phone uniqueness
    const { data: existing } = await adminClient
      .from("profiles")
      .select("id")
      .eq("telefone_normalizado", telefoneNormalizado)
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ error: "Telefone já cadastrado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Email is derived from phone — no fake names, deterministic
    const email = `${telefoneNormalizado}@alif-fc.local`;

    // Initial password = last 4 digits of phone number
    const tempPassword = telefoneNormalizado.slice(-4);

    // Create auth user
    const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });
    if (authErr) {
      return new Response(JSON.stringify({ error: authErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = authData.user.id;

    // Create profile
    const { data: profile, error: profErr } = await adminClient
      .from("profiles")
      .insert({
        user_id: userId,
        auth_email: email,
        nome: body.nome.trim(),
        apelido: body.apelido?.trim() || null,
        numero: body.numero ?? null,
        posicao: body.posicao || null,
        telefone: body.telefone || null,
        telefone_normalizado: telefoneNormalizado,
        data_entrada: body.data_entrada || null,
        data_nascimento: body.data_nascimento || null,
        observacoes: body.observacoes || null,
        status: "active",
        must_change_password: true,
        temp_password: tempPassword,
      })
      .select()
      .single();
    if (profErr) {
      await adminClient.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ error: profErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Assign player role
    const { error: roleErr } = await adminClient
      .from("user_roles")
      .insert({ user_id: userId, role: "player" });
    if (roleErr) {
      console.error("Failed to assign role:", roleErr.message);
    }

    return new Response(JSON.stringify({
      profile,
      credentials: { telefone: body.telefone || telefoneNormalizado, password: tempPassword },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
