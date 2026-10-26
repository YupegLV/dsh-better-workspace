/**
 * Windows folder picker for the host half (WSL only).
 *
 * A browser can render a directory tree, but it can never show the operating
 * system's own folder dialog. Under WSL that dialog is one `powershell.exe`
 * away — the host launches Windows PowerShell / PowerShell 7 with a WinForms
 * `FolderBrowserDialog`, waits for the user, converts the chosen Windows path
 * back to the mount path the workspace registry needs, and answers JSON.
 *
 * Two environment facts make this work:
 *
 *  1. **WSL interop** must be registered in `binfmt_misc`. WSL registers the
 *     `WSLInterop` handler itself, but a `systemd=true` distro mounts a fresh
 *     `binfmt_misc` instance and the handler disappears — every Windows `.exe`
 *     then fails with `Exec format error`. This module repairs that registration
 *     on demand (passwordless sudo only) so the picker — and the unrelated
 *     "open workspace folder" action, which drives the same interop path —
 *     keep working after a reboot.
 *  2. The dialog appears on the **host's** screen. It is therefore offered to
 *     loopback requests only: a directory picker popping up on a server nobody
 *     is looking at is worse than a fallback.
 *
 * Nothing here interpolates request data into the PowerShell script; the script
 * is a constant and the browser supplies no arguments.
 */

import { execFile } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'

import { isWsl } from './open-folder.js'

/** Exact route the client half posts to (and probes with GET). */
export const PICK_FOLDER_ROUTE = '/_dsh/virtual-workspace/pick-folder'

/** How long the host waits for one human to finish picking a folder. */
export const PICK_TIMEOUT_MS = 5 * 60 * 1000

const INTEROP_HANDLER = '/proc/sys/fs/binfmt_misc/WSLInterop'
const INTEROP_REGISTER = '/proc/sys/fs/binfmt_misc/register'
const INTEROP_ENTRY = ':WSLInterop:M::MZ::/init:PF'

/**
 * Launchers in preference order. PowerShell 7 renders the modern Vista-style
 * folder dialog; Windows PowerShell 5.1 falls back to the legacy tree. Both
 * print the same marker, so the caller cannot tell them apart.
 */
const POWERSHELL_CANDIDATES = [
  '/mnt/c/Program Files/PowerShell/7/pwsh.exe',
  '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
]

const MARKER = 'DSH-PICK:'
const MARKER_OK = MARKER + 'OK:'
const MARKER_CANCEL = MARKER + 'CANCEL'

/**
 * The dialog script. A constant on purpose: no request data reaches it, so
 * there is no quoting or injection surface. The topmost owner form keeps the
 * dialog above the browser window; closing the owner is also what lets a parent
 * process end the wait.
 */
export const DIALOG_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  'Add-Type -AssemblyName System.Windows.Forms | Out-Null',
  '$owner = New-Object System.Windows.Forms.Form',
  '$owner.TopMost = $true',
  '$owner.ShowInTaskbar = $false',
  '$owner.WindowState = [System.Windows.Forms.FormWindowState]::Minimized',
  '$dlg = New-Object System.Windows.Forms.FolderBrowserDialog',
  "$dlg.Description = 'Select a workspace folder for DeepSeek Harness'",
  '$dlg.ShowNewFolderButton = $true',
  'try { $result = $dlg.ShowDialog($owner) } finally { $owner.Dispose() }',
  "if ($result -eq [System.Windows.Forms.DialogResult]::OK -and $dlg.SelectedPath) {",
  "  [Console]::Out.Write('" + MARKER_OK + "' + $dlg.SelectedPath)",
  '} else {',
  "  [Console]::Out.Write('" + MARKER_CANCEL + "')",
  '}',
].join('\n')

/** Arguments for one launcher: STA is required by WinForms, no profile by policy. */
export function launcherArgs() {
  return ['-NoProfile', '-NonInteractive', '-STA', '-Command', DIALOG_SCRIPT]
}

/** True when WSL registered its Windows-executable handler (see module docs). */
export function interopRegistered(internals = {}) {
  const exists = internals.exists ?? existsSync
  return exists(INTEROP_HANDLER)
}

/** One process invocation, captured — never a shell string. */
function runCapture(command, args, internals = {}) {
  const timeout = internals.timeoutMs ?? PICK_TIMEOUT_MS
  return new Promise((resolve, reject) => {
    execFile(command, args, { encoding: 'utf8', timeout, windowsHide: true }, (error, stdout, stderr) => {
      if (error !== null) {
        reject(Object.assign(new Error(error.message, { cause: error }), {
          code: error.code,
          killed: error.killed === true,
          stdout: String(stdout ?? ''),
          stderr: String(stderr ?? ''),
        }))
        return
      }
      resolve({ stdout: String(stdout ?? ''), stderr: String(stderr ?? '') })
    })
  })
}

/**
 * Repair the lost `WSLInterop` registration when it is missing.
 *
 * `sudo -n` is required: registering a binfmt handler is a root operation. A
 * distro without passwordless sudo simply reports "unavailable" — the picker
 * then falls back to the in-app browser instead of failing the flow.
 * @returns whether the handler is registered afterwards.
 */
export async function ensureInterop(internals = {}) {
  if (interopRegistered(internals)) return true
  const run = internals.run ?? runCapture
  if ((internals.platform ?? process.platform) !== 'linux') return false
  try {
    await run('sudo', ['-n', 'sh', '-c', 'echo ' + INTEROP_ENTRY + ' > ' + INTEROP_REGISTER], { timeoutMs: 15000 })
  } catch (error) {
    return false
  }
  return interopRegistered(internals)
}

/**
 * Pick the launcher for this host.
 * @returns `{ command, modern }` or null when no Windows PowerShell is visible.
 */
export function detectLauncher(internals = {}) {
  if (!isWsl(internals)) return null
  const exists = internals.exists ?? existsSync
  const command = POWERSHELL_CANDIDATES.find((candidate) => exists(candidate)) ?? null
  if (command === null) return null
  return { command, modern: command.includes('/PowerShell/7/') }
}

/**
 * Convert a Windows path the dialog returned into the path this Linux host can
 * use. `wslpath` is authoritative; the drive-letter mapping is the fallback for
 * a distro whose `wslpath` is unavailable (it needs the same interop plumbing).
 * @param windowsPath - e.g. `D:\code\app`
 * @returns e.g. `/mnt/d/code/app`; UNC/unknown forms are returned untouched.
 */
export function toHostPath(windowsPath, internals = {}) {
  const raw = String(windowsPath ?? '').trim()
  if (raw === '') return ''
  const manual = manualHostPath(raw)
  const run = internals.run ?? runCapture
  return Promise.resolve()
    .then(() => run('wslpath', ['-u', raw], { timeoutMs: 15000 }))
    .then((result) => {
      const converted = String((result && result.stdout) || '').trim()
      return converted === '' ? manual : converted
    })
    .catch(() => manual)
}

/** Pure drive-letter mapping (`D:\a\b` → `/mnt/d/a/b`). */
export function manualHostPath(windowsPath) {
  const raw = String(windowsPath ?? '').trim()
  const match = /^([A-Za-z]):[\\/](.*)$/.exec(raw)
  if (match === null) return raw
  const rest = match[2].replace(/\\/g, '/').replace(/\/+$/, '')
  return '/mnt/' + match[1].toLowerCase() + (rest === '' ? '' : '/' + rest)
}

/**
 * Open the OS folder dialog once and report what happened.
 * @returns `{ status: 'picked', path }` | `{ status: 'cancelled' }` |
 *          `{ status: 'unavailable', reason }`.
 */
export async function pickFolder(internals = {}) {
  if (!isWsl(internals)) return { status: 'unavailable', reason: 'not-wsl' }
  const launcher = detectLauncher(internals)
  if (launcher === null) return { status: 'unavailable', reason: 'powershell-not-found' }
  const ready = await ensureInterop(internals)
  if (!ready) return { status: 'unavailable', reason: 'windows-interop-disabled' }

  // `internals.run` is the test seam: without it, a unit test would spawn a
  // REAL modal dialog on the developer's desktop and block for the timeout.
  const run = internals.run ?? runCapture
  let stdout = ''
  try {
    const result = await run(launcher.command, launcherArgs(), internals)
    stdout = result.stdout
  } catch (error) {
    // A killed child means the timeout fired: the dialog is gone with it.
    if (error && error.killed === true) return { status: 'cancelled', reason: 'timeout' }
    const message = (error && error.message) || 'folder picker failed'
    if (error && typeof error.code === 'string') {
      // Spawn failure (missing binary / no interop) is a capability fact.
      if (['ENOENT', 'EACCES', 'EPERM', 'EINVAL', 'ENOEXEC'].includes(error.code)) {
        return { status: 'unavailable', reason: 'windows-interop-disabled', detail: message }
      }
    }
    return { status: 'unavailable', reason: 'picker-failed', detail: message }
  }

  const line = stdout.split(/\r?\n/).map((part) => part.trim()).find((part) => part.startsWith(MARKER)) ?? ''
  if (line === MARKER_CANCEL) return { status: 'cancelled' }
  if (!line.startsWith(MARKER_OK)) return { status: 'unavailable', reason: 'unrecognised-output' }

  const windowsPath = line.slice(MARKER_OK.length).trim()
  if (windowsPath === '') return { status: 'cancelled' }
  const hostPath = await toHostPath(windowsPath, internals)
  const stat = internals.stat ?? statSync
  const exists = internals.exists ?? existsSync
  if (hostPath === '' || !exists(hostPath)) {
    return { status: 'unavailable', reason: 'selected-path-not-visible', detail: windowsPath }
  }
  try {
    if (!stat(hostPath).isDirectory()) {
      return { status: 'unavailable', reason: 'selected-path-not-a-directory', detail: windowsPath }
    }
  } catch (error) {
    return { status: 'unavailable', reason: 'selected-path-not-visible', detail: windowsPath }
  }
  return { status: 'picked', path: hostPath }
}

/** Only a browser on this machine may make a dialog appear on this screen. */
export function isLoopback(req) {
  const socket = req && req.socket ? req.socket : null
  const address = socket && typeof socket.remoteAddress === 'string' ? socket.remoteAddress : ''
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

/**
 * Build the route handler. GET probes capability (never opens a dialog); POST
 * picks. Every answer is JSON and every value has a `status`.
 */
export function handlerFor(internals = {}) {
  return async function pickFolderRequestHandler(req, res) {
    const respond = (value, status = 200) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(value))
    }
    try {
      if (!isLoopback(req)) {
        respond({ ok: true, value: { status: 'unavailable', reason: 'not-loopback' } })
        return
      }
      if (req.method === 'GET' || req.method === 'HEAD') {
        const available = isWsl(internals) && detectLauncher(internals) !== null
        respond({ ok: true, value: { available } })
        return
      }
      if (req.method !== 'POST') {
        respond({ ok: false, error: { code: 'method-not-allowed', message: 'Use GET or POST' } }, 405)
        return
      }
      // The client sends an empty JSON body; consume it so a keep-alive
      // connection is not left with an unread body (the dialog wait is long).
      if (typeof req.resume === 'function') req.resume()
      // One dialog at a time: a second pick would stack windows on the desktop.
      if (internals.busy !== undefined && internals.busy.current === true) {
        respond({ ok: true, value: { status: 'unavailable', reason: 'busy' } })
        return
      }
      if (internals.busy !== undefined) internals.busy.current = true
      try {
        respond({ ok: true, value: await pickFolder(internals) })
      } finally {
        if (internals.busy !== undefined) internals.busy.current = false
      }
    } catch (error) {
      respond({ ok: false, error: { code: 'pick-folder-failed', message: (error && error.message) || String(error) } }, 500)
    }
  }
}

/** Route handler the host half mounts (one shared busy flag per process). */
export const pickFolderHandler = handlerFor({ busy: { current: false } })
