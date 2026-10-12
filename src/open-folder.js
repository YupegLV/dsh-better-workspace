/**
 * dsh-virtual-workspace — "open this workspace folder" host route.
 *
 * The browser half cannot hand a path to the operating system, so the sidebar's
 * workspace context menu posts the real workspace path here and this module
 * launches the host's own file manager on it.
 *
 * The four platforms are dispatched exactly the way DSH's own path opener does
 * it (@deepseek-ai/dsh-native-command), because that is the behaviour this
 * machine already has:
 *
 *   wsl (linux + WSL markers)  wslpath -w  →  powershell.exe Invoke-Item
 *   win32                      powershell.exe Invoke-Item
 *   darwin                     open
 *   linux (desktop)            xdg-open
 *
 * WSL is deliberately tested BEFORE linux: process.platform reports "linux"
 * inside WSL, and `xdg-open` there either does not exist or opens nothing —
 * the Windows desktop is what has to receive the translated path.
 *
 * The module has no DSH imports on purpose: the plugin's own node_modules only
 * carries the three peer links the settings namespace needs, so anything beyond
 * Node built-ins would fail to resolve at runtime. Every command is spawned
 * shell-free with windowsHide, never through a shell string.
 */

import { execFile } from 'node:child_process'
import { stat } from 'node:fs/promises'
import { release } from 'node:os'

/** Exact route the browser half posts to. */
export const OPEN_FOLDER_ROUTE = '/_dsh/virtual-workspace/open-folder'

/** Overall budget for the launcher command. Explorer/PowerShell hand off
 *  quickly; an opener still running after this has hung, and the HTTP reply
 *  must not wait for it. */
const OPEN_TIMEOUT_MS = 15000

/** Windows PowerShell that ships with every Windows install. */
const WINDOWS_POWERSHELL = 'powershell.exe'

const present = (value) => value !== undefined && value !== ''

/**
 * Whether this host is WSL. Linux only: `WSL_DISTRO_NAME` can survive into a
 * child process on another platform (and WSLENV forwards it into Windows ones),
 * but the Windows-desktop hand-off is a LINUX-host concern — macOS and win32
 * open their folder directly and must not be diverted through `wslpath`.
 *
 * Environment markers are checked first (`WSL_INTEROP` only exists in distros
 * with interop enabled, which is precisely when handing a path to a Windows
 * executable can work at all), then the kernel release string, which still
 * carries "microsoft" for WSL1 and WSL2 alike.
 * @param internals - platform, env and kernel-release seam for tests.
 * @returns true when paths must be translated for the Windows desktop.
 */
export function isWsl(internals = {}) {
  if ((internals.platform ?? process.platform) !== 'linux') return false
  const env = internals.env ?? process.env
  if (present(env.WSL_DISTRO_NAME) || present(env.WSL_INTEROP)) return true
  return String(internals.osRelease ?? release()).toLowerCase().includes('microsoft')
}

/**
 * Run one host command with no shell, capturing output.
 * @param command - executable name or absolute path.
 * @param args - argv array (never a shell string).
 * @returns the captured stdout/stderr and exit code.
 */
export function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, {
      encoding: 'utf8',
      timeout: OPEN_TIMEOUT_MS,
      windowsHide: true,
    }, (error, stdout, stderr) => {
      if (error !== null) {
        reject(Object.assign(new Error(error.message, { cause: error }), {
          code: error.code,
          stdout: String(stdout ?? ''),
          stderr: String(stderr ?? ''),
        }))
        return
      }
      resolve({ stdout: String(stdout ?? ''), stderr: String(stderr ?? '') })
    })
  })
}

/** PowerShell single-quoted literal (an embedded quote is doubled). */
function powershellLiteral(path) {
  return `'${path.replace(/'/g, "''")}'`
}

/**
 * Windows Explorer's exit status is not a result: it returns 1 after handing the
 * path to the already-running shell, so a non-zero status from this launcher is
 * still a successful hand-off. Only a spawn failure (ENOENT, EACCES) is real.
 */
function isLaunchFailure(error) {
  return error !== null && error !== undefined && error.code !== undefined
    && ['ENOENT', 'EACCES', 'EPERM', 'EINVAL'].includes(error.code)
}

/**
 * Hand a Windows-resolvable path to the desktop's registered handler.
 *
 * Two launchers are tried in order. PowerShell's `Invoke-Item` reports a real
 * exit status, so a genuine failure is visible and worth a fallback; Explorer is
 * the fallback, and its exit status means nothing (see {@link isLaunchFailure}).
 * Only a spawn failure raises a second attempt — a non-zero *exit* from
 * explorer.exe is a successful delegation, not an error.
 *
 * @param windowsPath - the `C:\...` form of the folder.
 * @param run - the command runner (the production one, or a test seam).
 */
async function openWindowsPath(windowsPath, run) {
  try {
    await run(WINDOWS_POWERSHELL, [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Invoke-Item -LiteralPath ${powershellLiteral(windowsPath)}`,
    ])
    return
  } catch (error) {
    if (isLaunchFailure(error)) throw error
    // PowerShell is present but refused the hand-off (an execution policy on
    // this box, a killed child). Explorer opens the folder directly.
  }
  try {
    await run('explorer.exe', [windowsPath])
  } catch (error) {
    if (isLaunchFailure(error)) throw error
    // explorer.exe delegates to the already-running shell and exits 1; reaching
    // here means the folder was handed over.
  }
}

/**
 * Launch the host file manager on one absolute directory path.
 *
 * The path must exist and be a directory *on the host*: a path the browser
 * remembers but the host cannot see would otherwise open an empty Explorer
 * window with no explanation, so it is rejected with a readable message first.
 *
 * @param path - absolute host path of the workspace folder.
 * @param internals - platform/env/runner seam for tests.
 * @returns the path and platform command that were used.
 */
export async function openFolder(path, internals = {}) {
  const target = typeof path === 'string' ? path.trim() : ''
  if (target === '') throw new Error('empty path')
  if (!/^([a-zA-Z]:[\\/]|\/|\\\\)/.test(target)) throw new Error('path must be absolute')

  const stats = await stat(target).catch((error) => {
    throw new Error(`cannot read ${target}: ${error && error.code === 'ENOENT' ? 'no such folder' : (error && error.message) || 'stat failed'}`)
  })
  if (!stats.isDirectory()) throw new Error(`not a folder: ${target}`)

  const platform = internals.platform ?? process.platform
  const run = internals.run ?? runCommand

  if (platform === 'linux' && isWsl(internals)) {
    const translated = await run('wslpath', ['-w', target]).catch((error) => {
      const message = error && error.code === 'ENOENT'
        ? 'wslpath is unavailable — cannot translate the path for Windows'
        : (error && error.message) || 'wslpath failed'
      throw new Error(message)
    })
    const windowsPath = String(translated.stdout || '').replace(/[\r\n]+$/, '')
    if (windowsPath === '') throw new Error('wslpath returned no Windows path')
    await openWindowsPath(windowsPath, run)
    return { path: target, windowsPath, via: 'wsl' }
  }
  if (platform === 'win32') {
    await openWindowsPath(target, run)
    return { path: target, via: 'win32' }
  }
  if (platform === 'darwin') {
    await run('open', [target])
    return { path: target, via: 'darwin' }
  }
  if (platform === 'linux') {
    await run('xdg-open', [target])
    return { path: target, via: 'linux' }
  }
  throw new Error(`opening a folder is unsupported on ${platform}`)
}

/** Read one JSON request body with a hard cap. */
export async function readJsonBody(req, limit = 64 * 1024) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > limit) throw new Error('payload too large')
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  return text === '' ? {} : JSON.parse(text)
}

/**
 * Build the handler for {@link OPEN_FOLDER_ROUTE}. Always answers JSON: the
 * browser half renders `error.message` verbatim, so every failure path carries
 * one.
 * @param internals - platform/env/runner seam, forwarded to {@link openFolder}.
 * @returns an http request handler.
 */
export function handlerFor(internals = {}) {
  return async function openFolderRequestHandler(req, res) {
    const respond = (value, status = 200) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(value))
    }
    try {
      if (req.method !== 'POST') {
        respond({ ok: false, error: { code: 'method-not-allowed', message: 'Use POST' } }, 405)
        return
      }
      let body
      try {
        body = await readJsonBody(req)
      } catch (error) {
        respond({ ok: false, error: { code: 'invalid-request', message: (error && error.message) || 'invalid body' } }, 400)
        return
      }
      const path = body && typeof body.path === 'string' ? body.path : ''
      if (path === '') {
        respond({ ok: false, error: { code: 'invalid-request', message: 'Missing path' } }, 400)
        return
      }
      const opened = await openFolder(path, internals)
      respond({ ok: true, value: opened })
    } catch (error) {
      respond({ ok: false, error: { code: 'open-folder-failed', message: (error && error.message) || String(error) } }, 500)
    }
  }
}

/**
 * The route handler the host half mounts: {@link handlerFor} with the real
 * platform, environment and launcher.
 * @param req - the HTTP request.
 * @param res - the HTTP response.
 */
export const openFolderHandler = handlerFor()
