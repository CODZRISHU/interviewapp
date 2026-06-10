param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("dev", "test", "prod")]
    [string]$Environment
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$envRoot = Join-Path $repoRoot "config\environments"

$backendSource = Join-Path $envRoot "backend.$Environment.example"
$frontendSource = Join-Path $envRoot "frontend.$Environment.example"
$backendTarget = Join-Path $repoRoot "backend\.env"
$frontendTarget = Join-Path $repoRoot "frontend\.env"

Copy-Item -LiteralPath $backendSource -Destination $backendTarget -Force
Copy-Item -LiteralPath $frontendSource -Destination $frontendTarget -Force

Write-Host "Kevin AI local environment activated: $Environment"
Write-Host "Backend env: $backendTarget"
Write-Host "Frontend env: $frontendTarget"
