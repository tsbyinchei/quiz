param(
    [switch]$Clean
)

$ErrorActionPreference = 'Stop'

$nodePath = Join-Path $env:ProgramFiles 'nodejs\node.exe'
if (-not (Test-Path $nodePath)) {
    throw "Node.js was not found at $nodePath"
}

Set-Location (Split-Path -Parent $PSScriptRoot)

if ($Clean) {
    & $nodePath tools/build-production.mjs --clean
} else {
    & $nodePath tools/build-production.mjs
}
