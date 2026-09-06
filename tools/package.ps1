$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
& (Join-Path $PSScriptRoot "validate.ps1")

$dist = Join-Path $projectRoot "dist"
$staging = Join-Path $dist "staging"
$artifact = Join-Path $dist "Kitty Army.mcaddon"
if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
New-Item -ItemType Directory -Path $staging -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot "behavior_pack") -Destination (Join-Path $staging "KittieArmy_BP") -Recurse
Copy-Item -LiteralPath (Join-Path $projectRoot "resource_pack") -Destination (Join-Path $staging "KittieArmy_RP") -Recurse
if (Test-Path -LiteralPath $artifact) { Remove-Item -LiteralPath $artifact -Force }
Compress-Archive -Path (Join-Path $staging "*") -DestinationPath ($artifact + ".zip") -Force
Move-Item -LiteralPath ($artifact + ".zip") -Destination $artifact
Remove-Item -LiteralPath $staging -Recurse -Force

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($artifact)
try {
    $requiredEntries = @(
        "KittieArmy_BP/manifest.json",
        "KittieArmy_BP/items/kittie_collar.json",
        "KittieArmy_BP/scripts/kitty_transformation.js",
        "KittieArmy_BP/scripts/outward_routes.js",
        "KittieArmy_BP/entities/departure_waypoint.json",
        "KittieArmy_RP/entity/departure_waypoint.entity.json",
        "KittieArmy_RP/models/entity/departure_waypoint.geo.json",
        "KittieArmy_RP/entity/player.entity.json",
        "KittieArmy_RP/render_controllers/kitty_held_items.render_controllers.json",
        "KittieArmy_RP/models/entity/kittie_army_cat.geo.json",
        "KittieArmy_RP/textures/entity/kittie_army_cat.png",
        "KittieArmy_RP/animations/kittie_army.animation.json",
        "KittieArmy_RP/textures/items/kittie_collar.png"
    )
    $entryNames = @($archive.Entries | ForEach-Object { $_.FullName.Replace('\','/') })
    foreach ($requiredEntry in $requiredEntries) {
        if ($entryNames -notcontains $requiredEntry) { throw "Package is missing $requiredEntry" }
    }

    foreach ($entry in $archive.Entries) {
        if ([string]::IsNullOrEmpty($entry.Name)) { continue }
        $normalized = $entry.FullName.Replace('\','/')
        if ($normalized.StartsWith('KittieArmy_BP/')) {
            $sourceFile = Join-Path (Join-Path $projectRoot 'behavior_pack') $normalized.Substring('KittieArmy_BP/'.Length)
        } elseif ($normalized.StartsWith('KittieArmy_RP/')) {
            $sourceFile = Join-Path (Join-Path $projectRoot 'resource_pack') $normalized.Substring('KittieArmy_RP/'.Length)
        } else {
            throw "Unexpected archive entry: $normalized"
        }
        if (-not (Test-Path -LiteralPath $sourceFile -PathType Leaf)) { throw "Archive entry has no source file: $normalized" }
        $stream = $entry.Open()
        try {
            $sha256 = [Security.Cryptography.SHA256]::Create()
            try {
                $archiveHash = ([BitConverter]::ToString($sha256.ComputeHash($stream))).Replace('-', '')
            } finally {
                $sha256.Dispose()
            }
        } finally {
            $stream.Dispose()
        }
        $sourceHash = (Get-FileHash -LiteralPath $sourceFile -Algorithm SHA256).Hash
        if ($archiveHash -ne $sourceHash) { throw "Archive/source hash mismatch: $normalized" }
    }
} finally {
    $archive.Dispose()
}

$artifactHash = (Get-FileHash -LiteralPath $artifact -Algorithm SHA256).Hash
Write-Host "Packaged and archive-verified: $artifact"
Write-Host "SHA-256: $artifactHash"
