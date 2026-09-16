$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$project = Join-Path $root "src\ProxyMockTool.Host\ProxyMockTool.Host.csproj"
$staging = Join-Path $root "artifacts\host"
$destination = Join-Path $root "ProxyMockTool.Host.exe"

if (-not (Test-Path $project)) {
    throw "Could not find $project"
}

if (Test-Path $staging) {
    Remove-Item $staging -Recurse -Force
}

dotnet publish $project `
    -c Release `
    -r win-x64 `
    --self-contained `
    -o $staging `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -p:EnableCompressionInSingleFile=true `
    -p:DebugType=none `
    -p:DebugSymbols=false `
    -p:CopyOutputSymbolsToPublishDirectory=false

if ($LASTEXITCODE -ne 0) {
    throw "dotnet publish failed with exit code $LASTEXITCODE."
}

$published = Join-Path $staging "ProxyMockTool.Host.exe"
if (-not (Test-Path $published)) {
    throw "Publish succeeded but $published was not produced."
}

Copy-Item $published $destination -Force
Write-Host "Published $destination ($([int]((Get-Item $destination).Length / 1MB)) MB)"
