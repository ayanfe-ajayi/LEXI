param([string]$ProjectRef='pgxbzcsplpjtbvmtifta', [string]$SecretsFile='supabase/secrets.local')
$ErrorActionPreference='Stop'
function Invoke-LexiSupabase {
  param([string[]]$Arguments)
  & npx.cmd supabase @Arguments
  if ($LASTEXITCODE -ne 0) { throw 'Supabase stopped. Resolve the reported issue before continuing.' }
}
Write-Host 'Deploying Lexi backend. Supabase may ask you to sign in and enter your database password.'
Invoke-LexiSupabase -Arguments @('login')
Invoke-LexiSupabase -Arguments @('link','--project-ref',$ProjectRef)
Invoke-LexiSupabase -Arguments @('db','push')
if (Test-Path -LiteralPath $SecretsFile) {
  Invoke-LexiSupabase -Arguments @('secrets','set','--env-file',$SecretsFile)
} else {
  Write-Host 'No secrets file found. Dictionary lookup and deterministic review work without AI; configure server secrets in the Dashboard for AI and push.'
}
foreach ($LexiFunction in @('vocabulary','review','reverse-search','ai','notifications')) {
  Invoke-LexiSupabase -Arguments @('functions','deploy',$LexiFunction,'--project-ref',$ProjectRef)
}
Write-Host 'Migrations and Edge Functions deployed. Configure Auth redirects and the optional reminder schedule using docs/DEPLOYMENT.md.'
