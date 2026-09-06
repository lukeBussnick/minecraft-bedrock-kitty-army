$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$required = @(
    "behavior_pack/manifest.json",
    "behavior_pack/items/kittie_whistle.json",
    "behavior_pack/items/kittie_collar.json",
    "behavior_pack/entities/army_cat.json",
    "behavior_pack/recipes/kittie_whistle.json",
    "behavior_pack/recipes/kittie_collar.json",
    "behavior_pack/functions/give_collar.mcfunction",
    "behavior_pack/scripts/main.js",
    "behavior_pack/scripts/kitty_transformation.js",
    "behavior_pack/pack_icon.png",
    "resource_pack/manifest.json",
    "resource_pack/entity/army_cat.entity.json",
    "resource_pack/entity/player.entity.json",
    "resource_pack/attachables/kittie_collar.json",
    "resource_pack/animations/kittie_army.animation.json",
    "resource_pack/animations/kitty_player.animation.json",
    "resource_pack/animation_controllers/kittie_army.animation_controllers.json",
    "resource_pack/animation_controllers/kitty_player.animation_controllers.json",
    "resource_pack/models/entity/kittie_army_cat.geo.json",
    "resource_pack/models/entity/kittie_collar_invisible.geo.json",
    "resource_pack/render_controllers/kittie_army.render_controllers.json",
    "resource_pack/render_controllers/kitty_player.render_controllers.json",
    "resource_pack/render_controllers/kitty_equipment.render_controllers.json",
    "resource_pack/render_controllers/kitty_held_items.render_controllers.json",
    "resource_pack/render_controllers/kittie_collar.render_controllers.json",
    "resource_pack/textures/item_texture.json",
    "resource_pack/textures/items/kittie_whistle.png",
    "resource_pack/textures/items/kittie_collar.png",
    "resource_pack/textures/entity/kittie_army_cat.png",
    "resource_pack/textures/particle/kittie_sparkle.png",
    "resource_pack/textures/particle/kitty_transform_dark.png",
    "resource_pack/textures/entity/kittie_collar_invisible.png",
    "resource_pack/particles/whistle_sparkle.particle.json",
    "resource_pack/particles/kitty_transform.particle.json",
    "resource_pack/sounds/sound_definitions.json",
    "resource_pack/sounds/kittie/whistle_tone.wav",
    "resource_pack/texts/en_US.lang",
    "resource_pack/pack_icon.png"
)

foreach ($relative in $required) {
    $full = Join-Path $projectRoot $relative
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
        throw "Missing required file: $relative"
    }
}

$jsonFiles = Get-ChildItem -LiteralPath (Join-Path $projectRoot "behavior_pack"),(Join-Path $projectRoot "resource_pack") -Recurse -File -Filter *.json
foreach ($file in $jsonFiles) {
    try {
        Get-Content -Raw -LiteralPath $file.FullName | ConvertFrom-Json | Out-Null
    } catch {
        throw "Invalid JSON: $($file.FullName): $($_.Exception.Message)"
    }
}

$bpManifest = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "behavior_pack/manifest.json") | ConvertFrom-Json
$rpManifest = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "resource_pack/manifest.json") | ConvertFrom-Json
$rpDependency = $bpManifest.dependencies | Where-Object { $_.uuid -eq $rpManifest.header.uuid }
if (-not $rpDependency) { throw "Behavior pack does not depend on the resource-pack header UUID." }
$serverDependency = $bpManifest.dependencies | Where-Object { $_.module_name -eq "@minecraft/server" }
if ($serverDependency.version -ne "2.9.0") { throw "Expected @minecraft/server 2.9.0." }
$expectedVersion = "1.6.5"
if (($bpManifest.header.version -join ".") -ne $expectedVersion -or ($rpManifest.header.version -join ".") -ne $expectedVersion) { throw "Expected synchronized pack version $expectedVersion." }
if ($bpManifest.header.name -ne 'Kitty Army Behavior Pack' -or $rpManifest.header.name -ne 'Kitty Army Resource Pack') { throw "Visible pack names must use the corrected Kitty Army spelling." }
foreach ($module in @($bpManifest.modules) + @($rpManifest.modules)) {
    if (($module.version -join ".") -ne $expectedVersion) { throw "Every pack module must use version $expectedVersion." }
}
if (($rpDependency.version -join ".") -ne $expectedVersion) { throw "Resource-pack dependency must use version $expectedVersion." }

$item = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "behavior_pack/items/kittie_whistle.json") | ConvertFrom-Json
if ($item.'minecraft:item'.description.identifier -ne "kittie:kittie_whistle") { throw "Whistle identifier mismatch." }
if (-not $item.'minecraft:item'.components.'kittie:toggle_army') { throw "Whistle custom component is missing." }

$collar = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "behavior_pack/items/kittie_collar.json") | ConvertFrom-Json
$collarDescription = $collar.'minecraft:item'.description
$collarComponents = $collar.'minecraft:item'.components
if ($collar.format_version -ne "1.26.40" -or $collarDescription.identifier -ne "kittie:kittie_collar") { throw "Collar format or identifier mismatch." }
if ($collarComponents.'minecraft:wearable'.slot -ne "slot.armor.head" -or $collarComponents.'minecraft:wearable'.protection -ne 0) { throw "Collar must be a zero-protection head wearable." }
if ($collarComponents.'minecraft:max_stack_size' -ne 1) { throw "Collar must stack to one." }
foreach ($forbidden in @('minecraft:durability','minecraft:enchantable','minecraft:binding','minecraft:slot_lock')) {
    if ($collarComponents.PSObject.Properties.Name -contains $forbidden) { throw "Collar must not define $forbidden." }
}

$entity = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "behavior_pack/entities/army_cat.json") | ConvertFrom-Json
$families = $entity.'minecraft:entity'.components.'minecraft:type_family'.family
if ($families -notcontains "kittie_army") { throw "Army cat family marker is missing." }
if (-not $entity.'minecraft:entity'.events.'kittie:depart') { throw "Departure event is missing." }

$recipe = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "behavior_pack/recipes/kittie_whistle.json") | ConvertFrom-Json
$pinkDye = $recipe.'minecraft:recipe_shapeless'.ingredients | Where-Object { $_.item -eq "minecraft:dye" -and $_.data -eq 9 }
if (-not $pinkDye) { throw "Recipe must use the Bedrock pink-dye item/data pair (minecraft:dye, data 9)." }
$collarRecipe = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "behavior_pack/recipes/kittie_collar.json") | ConvertFrom-Json
$collarIngredients = $collarRecipe.'minecraft:recipe_shapeless'.ingredients
if (-not ($collarIngredients | Where-Object item -eq 'minecraft:leather') -or -not ($collarIngredients | Where-Object item -eq 'minecraft:string') -or -not ($collarIngredients | Where-Object { $_.item -eq 'minecraft:dye' -and $_.data -eq 9 })) { throw "Collar recipe must use leather, string, and pink dye." }
if ($collarRecipe.'minecraft:recipe_shapeless'.result.item -ne 'kittie:kittie_collar') { throw "Collar recipe result mismatch." }

$clientEntity = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "resource_pack/entity/army_cat.entity.json") | ConvertFrom-Json
$clientDescription = $clientEntity.'minecraft:client_entity'.description
if ($clientDescription.geometry.default -ne "geometry.kittie_army.cat") { throw "Client entity is not linked to the self-contained cat geometry." }
if ($clientDescription.render_controllers -notcontains "controller.render.kittie_army_cat") { throw "Client entity is not linked to the self-contained render controller." }
if ($clientEntity.format_version -ne "1.8.0") { throw "Client entity must use the installed vanilla cat schema version 1.8.0." }
if ($clientDescription.animations.walk -ne "animation.kittie_army.walk" -or $clientDescription.animations.run -ne "animation.kittie_army.run") { throw "Client entity is not linked to both owned locomotion animations." }
$controllerLinks = $clientDescription.animation_controllers | ConvertTo-Json -Compress
if ($controllerLinks -notmatch 'controller\.animation\.kittie_army\.locomotion' -or $controllerLinks -notmatch 'controller\.animation\.kittie_army\.look') { throw "Owned animation-controller links are incomplete." }
if ($clientDescription.scripts) { throw "Client scripts are unsupported by the selected 1.8.0 schema and must remain absent." }

$playerClient = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "resource_pack/entity/player.entity.json") | ConvertFrom-Json
$playerDescription = $playerClient.'minecraft:client_entity'.description
if ($playerClient.format_version -ne '1.26.0' -or $playerDescription.identifier -ne 'minecraft:player') { throw "Player override must retain the installed 1.26.0 retail definition." }
if ($playerDescription.geometry.kittie -ne 'geometry.kittie_army.cat' -or $playerDescription.textures.kittie -ne 'textures/entity/kittie_army_cat' -or $playerDescription.materials.kittie -ne 'cat') { throw "Player override is not bound directly to the approved kitty assets." }
$playerText = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "resource_pack/entity/player.entity.json")
foreach ($needle in @("query.is_item_name_any('slot.armor.head', 0, 'kittie:kittie_collar')", 'query.is_alive', 'query.is_spectator', 'v.kittie_delta / 0.6', 'v.kittie_delta / 0.25', 'controller.render.kittie_player.human', 'controller.render.kittie_player.cat')) {
    if (-not $playerText.Contains($needle)) { throw "Player transformation contract is missing: $needle" }
}
if ($playerText -match 'minecraft:free|follow_orbit|camera_offset') { throw "Primary kitty implementation must retain the normal camera." }
if (Test-Path -LiteralPath (Join-Path $projectRoot 'behavior_pack/entities/player.json')) { throw "Behavior-pack player overrides are forbidden." }

$geometry = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "resource_pack/models/entity/kittie_army_cat.geo.json") | ConvertFrom-Json
$bones = $geometry.'minecraft:geometry'[0].bones
& py (Join-Path $PSScriptRoot "validate-cat.py")
if ($LASTEXITCODE -ne 0) { throw "Reference-reconstruction geometry/UV checks failed." }

$animations = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "resource_pack/animations/kittie_army.animation.json") | ConvertFrom-Json
if (-not $animations.animations.'animation.kittie_army.walk' -or -not $animations.animations.'animation.kittie_army.run') { throw "Owned walk/run animation definitions are incomplete." }
$animationControllers = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "resource_pack/animation_controllers/kittie_army.animation_controllers.json") | ConvertFrom-Json
$locomotion = $animationControllers.animation_controllers.'controller.animation.kittie_army.locomotion' | ConvertTo-Json -Depth 10 -Compress
if ($locomotion -notmatch 'modified_move_speed' -or $locomotion -notmatch '"run"' -or $locomotion -notmatch '"walk"') { throw "Movement-speed locomotion controller is incomplete." }

$playerControllersText = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "resource_pack/animation_controllers/kitty_player.animation_controllers.json")
if ($playerControllersText -notmatch 'query\.is_sprinting' -or $playerControllersText -match '> 0\.28') { throw "Player locomotion must route sprint explicitly and not reuse the army speed threshold." }
$equipmentControllerText = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "resource_pack/render_controllers/kitty_equipment.render_controllers.json")
foreach ($needle in @('controller.render.armor.player','variable.has_trim ? variable.trim_path : Texture.default','Material.enchanted','query.is_owner_identifier_any','kittie:kittie_collar','controller.render.player.cape')) {
    if (-not $equipmentControllerText.Contains($needle)) { throw "Scoped equipment controller is missing: $needle" }
}
$kittyRenderText = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "resource_pack/render_controllers/kitty_player.render_controllers.json")
if ($kittyRenderText -notmatch 'Geometry\.kittie' -or $kittyRenderText -notmatch 'Texture\.kittie' -or $kittyRenderText -notmatch '!variable\.kittie_target') { throw "Kitty render and first-person arm gates are incomplete." }
$heldItemControllerText = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "resource_pack/render_controllers/kitty_held_items.render_controllers.json")
foreach ($needle in @('controller.render.item_default','controller.render.item_sprite','controller.render.shield','controller.render.bow','controller.render.crossbow','c.owning_entity->v.kittie_cat_visible','c.is_first_person')) {
    if (-not $heldItemControllerText.Contains($needle)) { throw "Third-person held-item gate is missing: $needle" }
}
if ($playerText -notmatch '"variable\.kittie_cat_visible"\s*:\s*"public"') { throw "Kitty visibility must be public for attachable render gates." }

$targeting = $entity.'minecraft:entity'.component_groups.'kittie:active'.'minecraft:behavior.nearest_attackable_target'
if ($targeting.scan_interval -lt 10) { throw "Target scan interval must be at least 10 ticks." }
$activeGroup = $entity.'minecraft:entity'.component_groups.'kittie:active'
$jump = $entity.'minecraft:entity'.components.'minecraft:jump.static'
$navigation = $entity.'minecraft:entity'.components.'minecraft:navigation.walk'
if ($jump.PSObject.Properties.Name -contains 'jump_power' -or $navigation.can_jump -ne $true) { throw "Army cats must use default static jump with navigation jumping enabled." }
$followOwner = $activeGroup.'minecraft:behavior.follow_owner'
if ($followOwner.can_teleport -ne $false) { throw "Army cats must not teleport while following." }
if ($activeGroup.PSObject.Properties.Name -contains 'minecraft:behavior.leap_at_target') { throw "Legacy leap behavior must remain removed to prevent uncontrolled screen streaks." }
if ($followOwner.speed_multiplier -gt 1.1 -or $activeGroup.'minecraft:behavior.ocelotattack'.sprint_speed_multiplier -gt 1.2) { throw "Active army speed multipliers exceed the bounded movement contract." }
$departingGroup = $entity.'minecraft:entity'.component_groups.'kittie:departing'
$fleeGroup = $entity.'minecraft:entity'.component_groups.'kittie:depart_flee'
$scatter = $entity.'minecraft:entity'.component_groups.'kittie:route_0'.'minecraft:behavior.follow_mob'
if ($fleeGroup.PSObject.Properties.Name -contains 'minecraft:behavior.avoid_mob_type') { throw "Departure must not depend on acquiring an avoidance target." }
if ($departingGroup.'minecraft:movement'.value -ne 0.36 -or $scatter.priority -ne 1 -or $scatter.speed_multiplier -ne 1.35 -or $scatter.search_range -ne 16) { throw "Outward waypoint navigation is incomplete." }
& node (Join-Path $projectRoot "tests/outward-routes.mjs")
if ($LASTEXITCODE -ne 0) { throw "Outward route tests failed." }
$events = $entity.'minecraft:entity'.events
if (-not $events.'kittie:restart_flee_off' -or -not $events.'kittie:restart_flee_on') { throw "Bounded flee restart events are missing." }

$python = Get-Command py -ErrorAction Stop
& $python.Source -c "from PIL import Image; from pathlib import Path; root=Path(r'$projectRoot'); checks=[('behavior_pack/pack_icon.png',(256,256)),('resource_pack/pack_icon.png',(256,256)),('resource_pack/textures/items/kittie_whistle.png',(32,32)),('resource_pack/textures/items/kittie_collar.png',(32,32)),('resource_pack/textures/entity/kittie_army_cat.png',(256,256)),('resource_pack/textures/particle/kittie_sparkle.png',(16,16)),('resource_pack/textures/particle/kitty_transform_dark.png',(16,16)),('resource_pack/textures/entity/kittie_collar_invisible.png',(1,1))]; [(lambda im,p,s: (_ for _ in ()).throw(AssertionError(f'{p}: expected {s}, got {im.size}')) if im.size!=s else None)(Image.open(root/p),p,s) for p,s in checks]"
if ($LASTEXITCODE -ne 0) { throw "PNG dimension validation failed." }
& $python.Source -c "from PIL import Image; from pathlib import Path; p=Path(r'$projectRoot/resource_pack/textures/items/kittie_whistle.png'); im=Image.open(p).convert('RGBA'); lo,hi=im.getchannel('A').getextrema(); assert lo==0 and hi==255, f'{p}: expected real transparent and opaque pixels, got alpha {lo}..{hi}'"
if ($LASTEXITCODE -ne 0) { throw "Whistle alpha validation failed." }
& $python.Source -c "from PIL import Image; from pathlib import Path; p=Path(r'$projectRoot/resource_pack/textures/items/kittie_whistle.png'); a=Image.open(p).convert('RGBA').getchannel('A'); assert set(a.getdata()) <= {0,255}, f'{p}: semi-transparent fringe pixels are forbidden'"
if ($LASTEXITCODE -ne 0) { throw "Whistle hard-alpha validation failed." }
& $python.Source -c "from PIL import Image; from pathlib import Path; p=Path(r'$projectRoot/resource_pack/textures/items/kittie_collar.png'); a=Image.open(p).convert('RGBA').getchannel('A'); assert a.getextrema()==(0,255); assert set(a.getdata()) <= {0,255}, f'{p}: collar must have crisp hard alpha'"
if ($LASTEXITCODE -ne 0) { throw "Collar alpha validation failed." }
& $python.Source (Join-Path $PSScriptRoot "validate-collar.py")
if ($LASTEXITCODE -ne 0) { throw "Collar backdrop/region validation failed." }
& $python.Source -c "import wave; from pathlib import Path; root=Path(r'$projectRoot'); w=wave.open(str(root/'resource_pack/sounds/kittie/whistle_tone.wav'),'rb'); assert w.getnchannels()==1 and w.getsampwidth()==2 and w.getframerate()==44100; w.close()"
if ($LASTEXITCODE -ne 0) { throw "Audio format validation failed." }

& node --check (Join-Path $projectRoot "behavior_pack/scripts/main.js")
if ($LASTEXITCODE -ne 0) { throw "JavaScript syntax validation failed." }
& node --check (Join-Path $projectRoot "behavior_pack/scripts/kitty_transformation.js")
if ($LASTEXITCODE -ne 0) { throw "Kitty transformation JavaScript syntax validation failed." }
& node (Join-Path $projectRoot "tests/smoke.mjs")
if ($LASTEXITCODE -ne 0) { throw "Lifecycle smoke test failed." }
& node (Join-Path $projectRoot "tests/kitty_transformation.mjs")
if ($LASTEXITCODE -ne 0) { throw "Kitty transformation smoke test failed." }

$frozenHashes = @{
    'resource_pack/models/entity/kittie_army_cat.geo.json' = '5583C875D9562162503A776E203A3061B7DA4712B076C01194E5AB3391BF1A6C'
    'resource_pack/textures/entity/kittie_army_cat.png' = '90797FFB9458E7D97E540F903C763A050F5A86042B1D89E4F63A6FEDA3E89B20'
    'resource_pack/animations/kittie_army.animation.json' = 'EDB364B8ECA2170972433AF8D4CB4CFA9816DF506096035C613D77B523E70554'
}
foreach ($entry in $frozenHashes.GetEnumerator()) {
    $actual = (Get-FileHash -LiteralPath (Join-Path $projectRoot $entry.Key) -Algorithm SHA256).Hash
    if ($actual -ne $entry.Value) { throw "Frozen approved asset changed: $($entry.Key)" }
}

$whistleSound = Get-Item -LiteralPath (Join-Path $projectRoot "resource_pack/sounds/kittie/whistle_tone.wav")
if ($whistleSound.Length -lt 20000) { throw "Custom whistle tone is unexpectedly small." }
$soundDefinitionsText = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "resource_pack/sounds/sound_definitions.json")
$scriptText = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "behavior_pack/scripts/main.js")
if ($soundDefinitionsText -match 'kittie\.meow' -or $scriptText -match 'kittie\.meow') { throw "Meow playback must remain removed." }

$countLiteral = Select-String -LiteralPath (Join-Path $projectRoot "behavior_pack/scripts/main.js") -Pattern "const ARMY_SIZE = 20;"
if (-not $countLiteral) { throw "Army size contract is not set to 20." }
$mainScriptText = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "behavior_pack/scripts/main.js")
foreach ($forbidden in @('applyImpulse','applyKnockback','clearVelocity','cat.lookAt','DEPART_DIR_X_PROPERTY','DEPART_DIR_Z_PROPERTY','DEPART_DRIVE_INTERVAL_TICKS')) {
    if ($mainScriptText.Contains($forbidden)) { throw "Script locomotion interference remains: $forbidden" }
}
foreach ($needle in @('const LIFECYCLE_INTERVAL_TICKS = 10;','const MAX_DEPART_RETRIES = 2;','cat.triggerEvent("kittie:restart_flee_off")','cat.triggerEvent("kittie:restart_flee_on")','const remaining = observeDeparture(cat);','if (farEnough || remaining <= 0)','pruneTransientTracking(seenIds)')) {
    if (-not $mainScriptText.Contains($needle)) { throw "Departure lifecycle contract is missing: $needle" }
}

Write-Host "Validation passed: $($jsonFiles.Count) JSON files, v1.6.5 linkage, frozen approved assets, direct-player kitty branches, scoped equipment gates, clean collar alpha, outward waypoint navigation, bounded restart/cleanup lifecycle, fixed recipes, whistle-only audio, and 20-cat regression contract."
