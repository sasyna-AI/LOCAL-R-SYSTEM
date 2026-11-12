$ErrorActionPreference = "Stop"

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $workspaceRoot

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  Write-Error "pnpm is not installed. Install Node.js 24 and enable pnpm with Corepack, then run pnpm install from the project folder."
}

if (-not (Test-Path (Join-Path $workspaceRoot "node_modules"))) {
  Write-Error "Project dependencies are missing. While online, run 'pnpm install' from the project folder, then start SASYNA again."
}

$env:PORT = "5173"
$env:BASE_PATH = "/"

Write-Host "Starting SASYNA locally at http://localhost:5173"
Write-Host "Your browser data stays on this device. Internet-only features will remain unavailable offline."

pnpm --filter @workspace/sasyna run dev
