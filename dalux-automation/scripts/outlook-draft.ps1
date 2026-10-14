# Creates a DRAFT (never sent) in the local Outlook profile's Drafts folder.
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File outlook-draft.ps1 <draft.json>
#
# draft.json: { "to": ["a@x","b@y"], "subject": "...", "body": "...", "attachment": "C:\\path\\file.pdf" }
#
# Prints DRAFT_SAVED on success so the caller can detect it.

param([Parameter(Mandatory = $true)][string]$JsonPath)

$ErrorActionPreference = 'Stop'

$d = Get-Content -Raw -Encoding UTF8 $JsonPath | ConvertFrom-Json

$ol = New-Object -ComObject Outlook.Application
$mail = $ol.CreateItem(0)   # 0 = olMailItem

$mail.To = ($d.to -join ';')
$mail.Subject = $d.subject
$mail.Body = $d.body
if ($d.attachment) { [void]$mail.Attachments.Add($d.attachment) }

# Save() puts the message in Drafts. It does NOT send.
$mail.Save()

Write-Output 'DRAFT_SAVED'
