/* =====================================================
   Configuração pública do app
   -----------------------------------------------------
   Estes dois valores NÃO são segredo (a anon key é
   protegida pelas políticas de RLS do Supabase).
   Pegue-os em: Supabase > Project Settings > API
   ===================================================== */
window.APP_CONFIG = {
  SUPABASE_URL: "https://SEU-PROJETO.supabase.co",
  SUPABASE_ANON_KEY: "COLE_AQUI_A_ANON_PUBLIC_KEY",

  // dias antes de expirar em que o app começa a avisar
  AVISO_EXPIRA_DIAS: 15,

  // link do checkout da Hotmart (botão "Renovar acesso")
  COMPRA_URL: "https://pay.hotmart.com/SEU-PRODUTO"
};
