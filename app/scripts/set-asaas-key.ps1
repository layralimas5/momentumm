# Grava a chave do Asaas nos segredos do Supabase lendo-a da area de
# transferencia. Evita colar a chave no terminal (o `$aact_` dentro de
# aspas duplas vira variavel no PowerShell e come o comeco da chave).
#
# Uso: copia a chave no painel do Asaas, depois roda
#   .\scripts\set-asaas-key.ps1
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$key = (Get-Clipboard -Raw).Trim()
if (-not $key.StartsWith('$aact_')) {
  Write-Host "A area de transferencia nao tem uma chave do Asaas (comeca com `$aact_). Copia a chave e roda de novo." -ForegroundColor Red
  exit 1
}

$env = if ($key.StartsWith('$aact_prod_')) { 'production' } else { 'sandbox' }
$api = if ($env -eq 'production') { 'https://api.asaas.com/v3' } else { 'https://api-sandbox.asaas.com/v3' }
Write-Host "Chave de $env com $($key.Length) caracteres. Testando no Asaas..."

try {
  $status = Invoke-RestMethod -Uri "$api/myAccount/status" -Headers @{ access_token = $key; 'User-Agent' = 'Momentumm' }
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Write-Host "O Asaas recusou a chave (HTTP $code). Gera outra em Integracoes > API e tenta de novo." -ForegroundColor Red
  exit 1
}
Write-Host "Chave valida. Conta: geral=$($status.general) documentos=$($status.documentation)" -ForegroundColor Green

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  Write-Host "Falta SUPABASE_ACCESS_TOKEN na sessao. Roda: `$env:SUPABASE_ACCESS_TOKEN = 'sbp_...'" -ForegroundColor Red
  exit 1
}
supabase secrets set "ASAAS_API_KEY=$key" "ASAAS_ENV=$env"
