import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Open a native folder picker; returns the chosen path or null when cancelled. */
export async function pickFolder(prompt: string): Promise<string | null> {
  const platform = process.platform;
  if (platform === "win32") return pickWindows(prompt);
  if (platform === "darwin") return pickMac(prompt);
  return pickLinux(prompt);
}

async function pickWindows(prompt: string): Promise<string | null> {
  const script = [
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
    "Add-Type -AssemblyName System.Windows.Forms",
    "$dlg = New-Object System.Windows.Forms.FolderBrowserDialog",
    `$dlg.Description = '${prompt.replace(/'/g, "''")}'`,
    "$dlg.ShowNewFolderButton = $false",
    "if ($dlg.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { exit 0 }",
    "[Console]::WriteLine($dlg.SelectedPath)",
  ].join("\n");
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
      { maxBuffer: 4 * 1024 * 1024 },
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function pickMac(prompt: string): Promise<string | null> {
  const escaped = prompt.replace(/"/g, '\\"');
  try {
    const { stdout } = await execFileAsync(
      "osascript",
      ["-e", `POSIX path of (choose folder with prompt "${escaped}")`],
      { maxBuffer: 1024 * 1024 },
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function pickLinux(prompt: string): Promise<string | null> {
  for (const [bin, args] of [
    ["kdialog", ["--getexistingdirectory"]],
    ["zenity", ["--file-selection", "--directory", `--title=${prompt}`]],
  ] as const) {
    try {
      const { stdout } = await execFileAsync(bin, args, { maxBuffer: 1024 * 1024 });
      const out = stdout.trim();
      if (out) return out;
      return null; // dialog was cancelled
    } catch {
      /* try next */
    }
  }
  return null;
}