#Requires -Version 5.1
<#
.SYNOPSIS
  Build le plugin puis déploie un package minimal dans un dossier Obsidian local.

.DESCRIPTION
  - Exécute `yarn build` à la racine du repo.
  - Copie uniquement les artefacts nécessaires dans le dossier plugin cible.
  - Préserve les préférences plugin (data.json) et pandoc.wasm.

.PARAMETER TargetPluginDir
  Dossier plugin Obsidian de destination.
  Défaut: D:\Notes\.obsidian\plugins\obsidian-pandoc-reference-list

.PARAMETER SkipBuild
  Copie les fichiers sans relancer `yarn build`.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\Deploy-LocalPlugin.ps1

.EXAMPLE
  .\Deploy-LocalPlugin.ps1 -SkipBuild
#>

param(
  [string]$TargetPluginDir = 'D:\Notes\.obsidian\plugins\obsidian-pandoc-reference-list',
  [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Require-Command {
  param([Parameter(Mandatory = $true)][string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Commande introuvable: $Name"
  }
}

function Ensure-File {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Fichier requis absent: $Path"
  }
}

$repoRoot = $PSScriptRoot
Set-Location -LiteralPath $repoRoot

Require-Command -Name 'yarn'

if (-not $SkipBuild) {
  Write-Host '==> Build production (yarn build)...'
  & yarn build
  if ($LASTEXITCODE -ne 0) {
    throw "yarn build a échoué (code $LASTEXITCODE)."
  }
}

$requiredFiles = @(
  'main.js',
  'manifest.json',
  'styles.css',
  'pdf.worker.min.mjs'
)
$requiredDirs = @(
  'pdfjs'
)

foreach ($file in $requiredFiles) {
  Ensure-File -Path (Join-Path $repoRoot $file)
}
foreach ($dir in $requiredDirs) {
  if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $dir) -PathType Container)) {
    throw "Dossier requis absent: $dir"
  }
}

if (-not (Test-Path -LiteralPath $TargetPluginDir)) {
  New-Item -ItemType Directory -Path $TargetPluginDir -Force | Out-Null
}

Write-Host "==> Nettoyage contrôlé destination: $TargetPluginDir"
$preserve = @('data.json', 'pandoc.wasm')
Get-ChildItem -LiteralPath $TargetPluginDir -Force | ForEach-Object {
  if ($preserve -contains $_.Name) {
    Write-Host "    (préservé) $($_.Name)"
    return
  }
  Remove-Item -LiteralPath $_.FullName -Recurse -Force
}

Write-Host '==> Copie des artefacts plugin...'
foreach ($file in $requiredFiles) {
  Copy-Item -LiteralPath (Join-Path $repoRoot $file) -Destination (Join-Path $TargetPluginDir $file) -Force
}
foreach ($dir in $requiredDirs) {
  Copy-Item -LiteralPath (Join-Path $repoRoot $dir) -Destination (Join-Path $TargetPluginDir $dir) -Recurse -Force
}

Write-Host '==> Déploiement terminé.'
Write-Host 'Fichiers copiés:'
Get-ChildItem -LiteralPath $TargetPluginDir | Select-Object Name, Length | Format-Table -AutoSize
