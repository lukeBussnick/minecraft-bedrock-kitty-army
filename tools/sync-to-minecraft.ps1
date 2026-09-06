$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Get-Sha256([string]$Path) {
    $stream = [IO.File]::OpenRead($Path)
    try {
        $sha256 = [Security.Cryptography.SHA256]::Create()
        try {
            return ([BitConverter]::ToString($sha256.ComputeHash($stream))).Replace("-", "")
        } finally {
            $sha256.Dispose()
        }
    } finally {
        $stream.Dispose()
    }
}
& (Join-Path $PSScriptRoot "validate.ps1")

$comMojang = Join-Path $env:APPDATA "Minecraft Bedrock\Users\Shared\games\com.mojang"
$pairs = @(
    @{ Source = Join-Path $projectRoot "behavior_pack"; Target = Join-Path $comMojang "development_behavior_packs\KittieArmy_BP" },
    @{ Source = Join-Path $projectRoot "resource_pack"; Target = Join-Path $comMojang "development_resource_packs\KittieArmy_RP" }
)

$deploymentStamp = Get-Date -Format "yyyyMMdd-HHmmss"
$deploymentRoot = Join-Path $projectRoot ".forge\deployments\$deploymentStamp"
New-Item -ItemType Directory -Path $deploymentRoot -Force | Out-Null

foreach ($pair in $pairs) {
    $parent = Split-Path -Parent $pair.Target
    $resolvedParent = (Resolve-Path -LiteralPath $parent).Path
    if (-not $pair.Target.StartsWith($resolvedParent + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing unsafe sync target: $($pair.Target)"
    }
    if (Test-Path -LiteralPath $pair.Target) {
        $backupName = Split-Path -Leaf $pair.Target
        Copy-Item -LiteralPath $pair.Target -Destination (Join-Path $deploymentRoot $backupName) -Recurse
        Write-Host "Backed up scoped target: $($pair.Target)"
    }
    if (Test-Path -LiteralPath $pair.Target) { Remove-Item -LiteralPath $pair.Target -Recurse -Force }
    Copy-Item -LiteralPath $pair.Source -Destination $pair.Target -Recurse

    $sourceFiles = Get-ChildItem -LiteralPath $pair.Source -Recurse -File
    foreach ($sourceFile in $sourceFiles) {
        $relative = $sourceFile.FullName.Substring($pair.Source.Length).TrimStart('\')
        $targetFile = Join-Path $pair.Target $relative
        $sourceHash = Get-Sha256 $sourceFile.FullName
        $targetHash = Get-Sha256 $targetFile
        if ($sourceHash -ne $targetHash) { throw "Hash mismatch after sync: $relative" }
    }
    Write-Host "Synced and verified: $($pair.Target)"
}
Write-Host "Deployment evidence: $deploymentRoot"
