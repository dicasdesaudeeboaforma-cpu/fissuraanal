/* =====================================================
   Configuração pública do app
   -----------------------------------------------------
   Estes dois valores NÃO são segredo (a anon key é
   protegida pelas políticas de RLS do Supabase).
   Pegue-os em: Supabase > Project Settings > API
   ===================================================== */
window.APP_CONFIG = {
  SUPABASE_URL: "https://wejgiterhfxqelpzhzki.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_U4t-XVpkKkjJAD0CyeZdBw_8vekRwKw",

  // dias antes de expirar em que o app começa a avisar
  AVISO_EXPIRA_DIAS: 15,

  // link do checkout da Hotmart (botão "Renovar acesso")
  COMPRA_URL: "https://pay.hotmart.com/SEU-PRODUTO"
};
