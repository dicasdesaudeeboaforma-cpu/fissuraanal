// =====================================================
//  Edge Function: hotmart-webhook
//  Recebe a notificação de compra da Hotmart, cria o
//  usuário no Supabase Auth com uma senha gerada e
//  libera 6 meses de acesso. Envia e-mail + senha.
//
//  Deploy:
//    supabase functions deploy hotmart-webhook --no-verify-jwt
//
//  Secrets necessários (supabase secrets set ...):
//    HOTMART_HOTTOK        -> token do webhook (Hotmart > Ferramentas > Webhook)
//    RESEND_API_KEY        -> chave da Resend para envio de e-mail
//    EMAIL_FROM            -> ex: "Guia Fissura <acesso@seudominio.com.br>"
//    APP_URL              -> ex: https://seuapp.com  (link no e-mail)
//    ACCESS_MONTHS        -> opcional, padrão "6"
//  (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem por padrão)
// =====================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HOTTOK = Deno.env.get("HOTMART_HOTTOK") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "Acesso <onboarding@resend.dev>";
const APP_URL = Deno.env.get("APP_URL") ?? "";
const ACCESS_MONTHS = parseInt(Deno.env.get("ACCESS_MONTHS") ?? "6", 10);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// eventos que LIBERAM acesso
const APPROVE = new Set([
  "PURCHASE_APPROVED",
  "PURCHASE_COMPLETE",
  "PURCHASE_COMPLETED",
]);
// eventos que REVOGAM acesso
const REVOKE: Record<string, string> = {
  PURCHASE_REFUNDED: "reembolsado",
  PURCHASE_CHARGEBACK: "chargeback",
  PURCHASE_PROTEST: "chargeback",
  PURCHASE_CANCELED: "cancelado",
  PURCHASE_EXPIRED: "cancelado",
};

function gerarSenha(len = 10): string {
  // sem caracteres ambíguos (0/O, 1/l/I)
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const num = "23456789";
  const sym = "!@#$%&*";
  const all = abc + abc.toLowerCase() + num + sym;
  const buf = crypto.getRandomValues(new Uint32Array(len));
  let out = abc[buf[0] % abc.length] + num[buf[1] % num.length] + sym[buf[2] % sym.length];
  for (let i = 3; i < len; i++) out += all[buf[i] % all.length];
  return out.split("").sort(() => 0.5 - Math.random()).join("");
}

function addMonths(d: Date, m: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + m);
  return r;
}

/** Extrai email / nome / transação de qualquer formato de payload da Hotmart (v1 e v2). */
function parseHotmart(body: any): { email?: string; nome?: string; transacao?: string; evento: string } {
  const evento = body?.event ?? body?.data?.event ?? body?.status ?? "";
  const d = body?.data ?? body;
  const buyer = d?.buyer ?? d?.customer ?? d?.contact ?? {};
  const purchase = d?.purchase ?? d ?? {};
  return {
    evento: String(evento).toUpperCase(),
    email: (buyer.email ?? d?.email ?? "").toString().trim().toLowerCase() || undefined,
    nome: (buyer.name ?? buyer.first_name ?? d?.name ?? "").toString().trim() || undefined,
    transacao: (purchase.transaction ?? d?.transaction ?? purchase.code ?? "").toString().trim() || undefined,
  };
}

async function enviarEmail(to: string, nome: string | undefined, senha: string, expira: Date): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY ausente — pulando envio de e-mail (modo de teste).");
    return false;
  }
  const validade = expira.toLocaleDateString("pt-BR");
  const saud = nome ? `Olá, ${nome.split(" ")[0]}!` : "Olá!";
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#21323d">
      <h2 style="color:#0a3d62">Seu acesso ao Guia foi liberado ✅</h2>
      <p style="font-size:13px;color:#52626d">Esse é o segundo e-mail da sua compra — o primeiro (da Hotmart) trouxe o PDF. Este aqui é o seu acesso ao aplicativo do guia.</p>
      <p>${saud} Sua compra foi aprovada e você já pode acessar o conteúdo completo por <b>${ACCESS_MONTHS} meses</b> (até <b>${validade}</b>).</p>
      <table style="background:#f0f8fd;border-radius:10px;padding:14px 18px;margin:16px 0">
        <tr><td style="padding:4px 0">E-mail de acesso:</td><td style="padding:4px 0"><b>${to}</b></td></tr>
        <tr><td style="padding:4px 0">Senha:</td><td style="padding:4px 0"><b style="font-size:18px;letter-spacing:1px">${senha}</b></td></tr>
      </table>
      ${APP_URL ? `<p><a href="${APP_URL}" style="background:#0a6ebd;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;display:inline-block">Abrir o Guia</a></p>` : ""}
      <p style="font-size:13px;color:#52626d">Guarde este e-mail. Você pode alterar a senha depois de entrar.</p>
      <p style="font-size:12px;color:#8a97a0">Conteúdo apenas informativo. Todo tratamento deve ser acompanhado por um médico especialista.</p>
    </div>`;
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject: "Seu acesso foi liberado ✅", html }),
  });
  if (!resp.ok) {
    console.error("Falha Resend:", resp.status, await resp.text());
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  // ---- valida o token da Hotmart ----
  const tok = req.headers.get("x-hotmart-hottok") ?? new URL(req.url).searchParams.get("hottok") ?? "";
  if (!HOTTOK || tok !== HOTTOK) {
    console.warn("Hottok inválido.");
    return new Response("unauthorized", { status: 401 });
  }

  let body: any;
  try { body = await req.json(); } catch { return new Response("bad json", { status: 400 }); }

  const { evento, email, nome, transacao } = parseHotmart(body);
  console.log("Evento Hotmart:", evento, email, transacao);

  // ---------- REVOGAÇÃO ----------
  if (REVOKE[evento]) {
    if (email) {
      await admin.from("acessos")
        .update({ status: REVOKE[evento], expira_em: new Date().toISOString() })
        .eq("email", email);
    }
    return new Response(JSON.stringify({ ok: true, acao: "revogado", status: REVOKE[evento] }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // ---------- LIBERAÇÃO ----------
  if (!APPROVE.has(evento)) {
    return new Response(JSON.stringify({ ok: true, ignorado: evento }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!email) return new Response("email ausente no payload", { status: 422 });

  const agora = new Date();
  const expira = addMonths(agora, ACCESS_MONTHS);
  const senha = gerarSenha();

  // usuário já existe?
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existente = list?.users?.find((u) => (u.email ?? "").toLowerCase() === email);

  let userId: string;
  if (existente) {
    userId = existente.id;
    await admin.auth.admin.updateUserById(userId, { password: senha, email_confirm: true });
  } else {
    const { data: novo, error } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome: nome ?? null, origem: "hotmart" },
    });
    if (error || !novo?.user) {
      console.error("createUser:", error);
      return new Response("erro ao criar usuário", { status: 500 });
    }
    userId = novo.user.id;
  }

  const { error: upErr } = await admin.from("acessos").upsert({
    user_id: userId,
    email,
    nome: nome ?? null,
    hotmart_transacao: transacao ?? null,
    status: "ativo",
    liberado_em: agora.toISOString(),
    expira_em: expira.toISOString(),
  }, { onConflict: "user_id" });

  if (upErr) {
    console.error("upsert acessos:", upErr);
    return new Response("erro ao gravar acesso", { status: 500 });
  }

  const emailEnviado = await enviarEmail(email, nome, senha, expira);

  const resposta: Record<string, unknown> = {
    ok: true,
    acao: "liberado",
    email,
    expira_em: expira.toISOString(),
    email_enviado: emailEnviado,
  };
  // Sem e-mail configurado: devolve a senha na resposta para você
  // conseguir testar o login. Em produção, configure a RESEND_API_KEY
  // e a senha NUNCA aparece aqui.
  if (!emailEnviado) resposta.senha_teste = senha;

  return new Response(JSON.stringify(resposta), {
    headers: { "Content-Type": "application/json" },
  });
});
