#Requires -Version 5.1
<#
  DeliveryBuddy MK2 - one-command publish to GitHub Pages.

  What it does (idempotent - safe to re-run):
    1. Installs Git + GitHub CLI if missing (via winget).
    2. Logs you in to GitHub (one-time browser pop-up).
    3. Creates the repo if it doesn't exist, then pushes the app.
    4. Turns on GitHub Pages (branch main, root).
    5. Prints your permanent https link + a QR code to scan on the Pixel 9.

  Usage:
    Right-click > Run with PowerShell        (or)
    pwsh -File deploy.ps1                     (or)
    powershell -ExecutionPolicy Bypass -File deploy.ps1

  Notes:
    - GitHub Pages on a FREE account needs a PUBLIC repo. This app stores all
      data on YOUR phone and contains no secrets, so public is fine. If you have
      GitHub Pro and want it private, run:  .\deploy.ps1 -Visibility private
#>
param(
  [string]$RepoName = "deliverybuddymk2",
  [ValidateSet("public","private")][string]$Visibility = "public"
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Refresh-Path {
  $m = [System.Environment]::GetEnvironmentVariable("Path","Machine")
  $u = [System.Environment]::GetEnvironmentVariable("Path","User")
  $env:Path = "$m;$u"
}

function Need($cmd, $wingetId) {
  if (Get-Command $cmd -ErrorAction SilentlyContinue) { return }
  Write-Host "Installing $cmd ..." -ForegroundColor Cyan
  winget install --id $wingetId -e --accept-source-agreements --accept-package-agreements --silent
  Refresh-Path
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    throw "$cmd was installed but isn't on PATH yet. Close this window, open a NEW terminal, and run deploy again."
  }
}

Write-Host "== DeliveryBuddy MK2 -> GitHub Pages ==" -ForegroundColor Green

Need git "Git.Git"
Need gh  "GitHub.cli"

# --- GitHub login (one time) ---
gh auth status 1>$null 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Opening GitHub login in your browser (one time) ..." -ForegroundColor Cyan
  gh auth login --hostname github.com --git-protocol https --web
  if ($LASTEXITCODE -ne 0) { throw "GitHub login did not complete." }
}
$user = (gh api user --jq .login).Trim()
Write-Host "Signed in as $user" -ForegroundColor DarkGray

# --- local repo ---
if (-not (Test-Path "$root\.git")) { git init -b main | Out-Null }
git add -A
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) { git commit -m "Deploy DeliveryBuddy MK2" | Out-Null }
git branch -M main

# --- remote repo (create or push) ---
gh repo view "$user/$RepoName" 1>$null 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Creating $Visibility repo $user/$RepoName ..." -ForegroundColor Cyan
  gh repo create "$RepoName" --$Visibility --source "." --remote origin --push
  if ($LASTEXITCODE -ne 0) { throw "Could not create the repo." }
} else {
  git remote get-url origin 1>$null 2>$null
  if ($LASTEXITCODE -ne 0) { git remote add origin "https://github.com/$user/$RepoName.git" }
  git push -u origin main
  if ($LASTEXITCODE -ne 0) { throw "git push failed." }
}

# --- enable GitHub Pages (ignore 'already enabled') ---
'{"source":{"branch":"main","path":"/"}}' | gh api -X POST "repos/$user/$RepoName/pages" --input - 1>$null 2>$null

$pagesUrl = "https://$user.github.io/$RepoName/"
Set-Content -Path "$root\install-link.txt" -Value $pagesUrl -Encoding ASCII

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host " Install link (open on the Pixel 9):" -ForegroundColor Green
Write-Host "   $pagesUrl" -ForegroundColor Yellow
Write-Host "=====================================================" -ForegroundColor Green
Write-Host "(also saved to install-link.txt)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Scan this with the Pixel camera:" -ForegroundColor Cyan
try { npx --yes qrcode-terminal $pagesUrl } catch { Write-Host "(QR needs internet/npm - just type the link above on the phone)" -ForegroundColor DarkGray }
Write-Host ""
Write-Host "First publish takes ~1 minute to go live. Then on the phone:" -ForegroundColor White
Write-Host "  Chrome opens the link  >  menu (3 dots)  >  Install app  >  done." -ForegroundColor White
Write-Host "If the page 404s at first, wait a minute and refresh." -ForegroundColor DarkGray
