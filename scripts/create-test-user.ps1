<#
  Cria (ou reativa) um usuario de teste direto no Supabase, sem passar
  pelo dashboard: cria o login em auth.users e libera o acesso na
  tabela public.acessos por N meses.
  Compativel com Windows PowerShell 5.1 e PowerShell 7+.

  Uso:
    $env:SUPABASE_URL = "https://wejgiterhfxqelpzhzki.supabase.co"
    $env:SUPABASE_SERVICE_ROLE_KEY = "eyJ...."   # Project Settings > API > service_role (NUNCA vai no front)
    powershell -File scripts/create-test-user.ps1
    powershell -File scripts/create-test-user.ps1 -Email teste2@fissuraanal.com -Password "OutraSenha1!" -Months 6

  A service_role key so deve viver na sua maquina (env var ou -ServiceRoleKey
  na hora de rodar) - nunca em config.js, nunca commitada.
#>
param(
  [string]$Email        = "teste@fissuraanal.com",
  [string]$Password     = "Teste123!",
  [int]$Months          = 6,
  [string]$SupabaseUrl  = $env:SUPABASE_URL,
  [string]$ServiceRoleKey = $env:SUPABASE_SERVICE_ROLE_KEY
)

$ErrorActionPreference = "Stop"

if (-not $SupabaseUrl)     { throw "Defina -SupabaseUrl ou a variavel de ambiente SUPABASE_URL" }
if (-not $ServiceRoleKey)  { throw "Defina -ServiceRoleKey ou a variavel de ambiente SUPABASE_SERVICE_ROLE_KEY (Project Settings > API > service_role)" }
if ($Password.Length -lt 6) { throw "A senha precisa ter pelo menos 6 caracteres" }

$SupabaseUrl = $SupabaseUrl.TrimEnd("/")
$authHeaders = @{
  "apikey"        = $ServiceRoleKey
  "Authorization" = "Bearer $ServiceRoleKey"
  "Content-Type"  = "application/json"
}

function Invoke-Supa {
  param([string]$Method, [string]$Path, [hashtable]$Body, [hashtable]$ExtraHeaders)
  $headers = $authHeaders.Clone()
  if ($ExtraHeaders) { foreach ($k in $ExtraHeaders.Keys) { $headers[$k] = $ExtraHeaders[$k] } }
  $uri = "$SupabaseUrl$Path"
  $params = @{ Uri = $uri; Method = $Method; Headers = $headers; UseBasicParsing = $true }
  if ($Body) { $params.Body = ($Body | ConvertTo-Json -Depth 6) }
  try {
    return Invoke-RestMethod @params
  }
  catch {
    $r = $_.Exception.Response
    if ($r) {
      $sr = New-Object System.IO.StreamReader($r.GetResponseStream())
      $text = $sr.ReadToEnd()
      throw "HTTP $([int]$r.StatusCode) em $Method $Path`: $text"
    }
    throw
  }
}

Write-Host "1) Procurando usuario existente: $Email" -ForegroundColor Cyan
$lista = Invoke-Supa -Method GET -Path "/auth/v1/admin/users?page=1&per_page=1000"
$existente = $lista.users | Where-Object { $_.email -eq $Email } | Select-Object -First 1

if ($existente) {
  Write-Host "   Ja existe (id: $($existente.id)) -> atualizando senha" -ForegroundColor Yellow
  $userId = $existente.id
  Invoke-Supa -Method PUT -Path "/auth/v1/admin/users/$userId" -Body @{
    password      = $Password
    email_confirm = $true
  } | Out-Null
}
else {
  Write-Host "   Nao existe -> criando" -ForegroundColor Cyan
  $novo = Invoke-Supa -Method POST -Path "/auth/v1/admin/users" -Body @{
    email          = $Email
    password       = $Password
    email_confirm  = $true
    user_metadata  = @{ origem = "teste-manual" }
  }
  $userId = $novo.id
}

Write-Host "2) Liberando acesso em public.acessos por $Months meses" -ForegroundColor Cyan
$expiraEm = (Get-Date).ToUniversalTime().AddMonths($Months).ToString("o")

Invoke-Supa -Method POST -Path "/rest/v1/acessos?on_conflict=user_id" -Body @{
  user_id     = $userId
  email       = $Email
  status      = "ativo"
  liberado_em = (Get-Date).ToUniversalTime().ToString("o")
  expira_em   = $expiraEm
} -ExtraHeaders @{ "Prefer" = "resolution=merge-duplicates,return=representation" } | Out-Null

Write-Host ""
Write-Host "Pronto! Acesso liberado ate $expiraEm" -ForegroundColor Green
Write-Host "Login:" -ForegroundColor Green
Write-Host "  E-mail: $Email"
Write-Host "  Senha:  $Password"
