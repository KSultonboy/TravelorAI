[CmdletBinding()]
param(
  [string]$SshHost = 'rux-backend'
)

$ErrorActionPreference = 'Stop'
$secureKey = Read-Host "Resend API keyni kiriting (ekranda ko'rinmaydi)" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
$plainKey = $null

try {
  $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  if ($plainKey -notmatch '^re_[A-Za-z0-9_-]{12,}$') {
    throw "API key noto'g'ri: u re_ bilan boshlanishi kerak."
  }

  $configureScript = (Resolve-Path (Join-Path $PSScriptRoot '..\..\backend\scripts\configureResendSmtp.js')).Path
  $verifyScript = (Resolve-Path (Join-Path $PSScriptRoot '..\..\backend\scripts\verifyResendSmtp.js')).Path

  & scp $configureScript "${SshHost}:/tmp/configureResendSmtp.js"
  if ($LASTEXITCODE -ne 0) { throw "Sozlagichni VPSga yuborib bo'lmadi." }
  & scp $verifyScript "${SshHost}:/tmp/verifyResendSmtp.js"
  if ($LASTEXITCODE -ne 0) { throw "SMTP tekshiruvchini VPSga yuborib bo'lmadi." }

  $remoteCommand = @'
set -eu
podman cp /tmp/configureResendSmtp.js voyageai_backend:/tmp/configureResendSmtp.js
podman cp /tmp/verifyResendSmtp.js voyageai_backend:/tmp/verifyResendSmtp.js
podman exec -i -e RESEND_ENV_FILE=/app/.env voyageai_backend node /tmp/configureResendSmtp.js
podman restart voyageai_backend
n=0
until curl -fsS localhost:4000/api/v1/health >/dev/null; do
  n=$((n+1))
  if [ "$n" -ge 20 ]; then
    podman logs --tail 80 voyageai_backend
    exit 1
  fi
  sleep 2
done
podman exec -e RESEND_ENV_FILE=/app/.env voyageai_backend node /tmp/verifyResendSmtp.js
curl -fsS localhost:4000/api/v1/health
'@

  $plainKey | & ssh $SshHost $remoteCommand
  if ($LASTEXITCODE -ne 0) { throw "Resend SMTP sozlamasi yoki tekshiruvi muvaffaqiyatsiz tugadi." }
  Write-Host "`nTAYYOR: Resend SMTP /app/.env ga saqlandi va login tekshirildi." -ForegroundColor Green
} finally {
  if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  $plainKey = $null
  $secureKey.Dispose()
}
