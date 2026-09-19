#!/usr/bin/env pwsh
#
# Purpose: Bootstrap the lab operator client on Windows by installing WSL2 +
#          Ubuntu, then pointing at install-operator-client.sh inside WSL.
# Source of truth: this file
# Regenerate: n/a
# Safety: modifies the Windows host (enables the "Virtual Machine Platform" and
#          "Windows Subsystem for Linux" features, installs the Ubuntu distro).
#          Does not touch the lab nodes.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\scripts\utilities\install-operator-client.ps1
#
# After it finishes: open "Ubuntu", clone the lab repo, and run
#   ./scripts/utilities/install-operator-client.sh run
# inside WSL to install Ansible, kubectl, helm, bazelisk, and jq.

$ErrorActionPreference = "Stop"

function Test-IsAdmin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    (New-Object Security.Principal.WindowsPrincipal $id).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-WslAvailable {
    & wsl --status *> $null
    return ($LASTEXITCODE -eq 0)
}

Write-Host "=== DGX Spark lab operator client (Windows) ==="

if (-not (Get-Command wsl -ErrorAction SilentlyContinue)) {
    Write-Error "WSL not found. Update Windows (Settings > Windows Update), then re-run this script."
    exit 1
}

if (-not (Test-WslAvailable)) {
    if (-not (Test-IsAdmin)) {
        Write-Error "This script must run as Administrator to install WSL2 (elevate the terminal and re-run)."
        exit 1
    }
    Write-Host "Installing WSL2 + Ubuntu (this can take a few minutes)..."
    & wsl --install -d Ubuntu
    if ($LASTEXITCODE -ne 0) {
        Write-Error "wsl --install failed (exit $LASTEXITCODE)."
        exit 1
    }
    Write-Host "Windows may need a reboot to finish the WSL install. Reboot, then re-run this script."
    exit 0
}

# WSL is available: check for an installed distribution.
$dists = & wsl -l -v
if ($dists -notmatch "Ubuntu") {
    Write-Host "Installing the Ubuntu distribution..."
    & wsl --install -d Ubuntu
}

Write-Host ""
Write-Host "WSL + Ubuntu is ready. Next steps:"
Write-Host "  1. Open 'Ubuntu' from the start menu and set a Linux user."
Write-Host "  2. Clone the lab repo (e.g. into /home/<you>/nvidia-dgx-spark-lab)."
Write-Host "  3. From the repo root, install the operator toolchain inside WSL:"
Write-Host "       ./scripts/utilities/install-operator-client.sh run"
Write-Host "  4. Verify with:"
Write-Host "       ./scripts/utilities/install-operator-client.sh status"
