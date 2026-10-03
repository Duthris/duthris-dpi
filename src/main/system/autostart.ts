// Start with Windows through Task Scheduler. A Run registry key can't start an
// app that needs administrator rights without a UAC prompt at every logon; a
// task with "highest privileges" can.

import { app } from "electron";
import { psString, runPowerShell } from "./powershell";

const TASK = "Duthris DPI";

export async function isAutostartEnabled(): Promise<boolean> {
  try {
    const out = await runPowerShell(`if (Get-ScheduledTask -TaskName ${psString(TASK)} -ErrorAction SilentlyContinue) { 'yes' }`);
    return out === "yes";
  } catch {
    return false;
  }
}

export async function setAutostart(enabled: boolean): Promise<void> {
  if (!enabled) {
    await runPowerShell(
      `Unregister-ScheduledTask -TaskName ${psString(TASK)} -Confirm:$false -ErrorAction SilentlyContinue`,
    );
    return;
  }
  if (!app.isPackaged) throw new Error("autostart is only available in the installed app");

  // The portable build runs from a temp folder that is gone after it exits;
  // the launcher it was started from is what has to be registered.
  const exe = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;

  // Battery defaults are the classic trap: a laptop on battery would never start it.
  await runPowerShell(`
$user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction -Execute ${psString(exe)} -Argument '--autostart'
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
$trigger.Delay = 'PT5S'
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -StartWhenAvailable
Register-ScheduledTask -TaskName ${psString(TASK)} -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
`);
}
