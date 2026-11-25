# 매일 09:30 자동 갱신 작업 등록 (PC가 꺼져 있었으면 켜진 뒤 바로 실행)
$bat = Join-Path $PSScriptRoot "daily.bat"
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$bat`""
$trigger = New-ScheduledTaskTrigger -Daily -At "09:30"
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1)
Register-ScheduledTask -TaskName "BemyB-Dashboard-AutoSync" -Description "비마이비 대시보드 매일 자동 갱신" -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Write-Host "작업 스케줄러 등록 완료: 매일 09:30"
