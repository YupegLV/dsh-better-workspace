// Smoke tests: pure helper/file-level, no Cordis runtime, no network.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

test('package.json declares a dual-face dsh web plugin', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.name, 'dsh-virtual-workspace')
  assert.equal(pkg.main, 'src/index.js')
  assert.equal(pkg.exports['./client'], './src/client.js')
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(pkg.dsh.client.platform, 'web')
  assert.ok(pkg.files.includes('src/client.js'), 'client entry must ship')
  assert.ok(pkg.files.includes('src/index.js'), 'host entry must ship')
})

test('dsh.plugin.json version matches package.json', () => {
  const pkg = JSON.parse(read('package.json'))
  const manifest = JSON.parse(read('dsh.plugin.json'))
  assert.equal(manifest.id, 'dsh-external/dsh-virtual-workspace')
  assert.equal(manifest.version, pkg.version)
  assert.equal(manifest.main, './src/index.js')
})

test('cordis.patch.yml inserts exactly one plugin row', () => {
  const text = read('cordis.patch.yml')
  assert.match(text, /^- insert:/m)
  assert.match(text, /id: virtual-workspace/)
  assert.match(text, /name: 'dsh-virtual-workspace'/)
  const insertRows = text.match(/name: 'dsh-virtual-workspace'/g) || []
  assert.equal(insertRows.length, 2) // comment example + real row
})

test('package.json declares the dsh engine floor (plugin market requirement)', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.engines.node, '>=18')
  assert.equal(pkg.engines.dsh, '>=0.1.0')
})

test('client half is a __ModuleLoader__ bundle with baseline requires only', () => {
  const text = read('src/client.js')
  assert.match(text, /window\.__ModuleLoader__\.load\(/)
  assert.match(text, /id: 'dsh-virtual-workspace'/)
  const requires = [...text.matchAll(/require\('([^']+)'\)/g)].map((m) => m[1])
  const baseline = new Set([
    'react',
    'react/jsx-runtime',
    'react-dom',
    'react-dom/client',
    '@deepseek-ai/cordis',
    '@deepseek-ai/dsh-client-store',
    '@deepseek-ai/dsh-client-ui-slots',
    '@deepseek-ai/dsh-client-ui-primitives',
  ])
  for (const specifier of requires) {
    assert.ok(baseline.has(specifier), 'non-baseline require: ' + specifier)
  }
  assert.ok(requires.length > 0, 'expected at least one require')
})

test('client half owns the sidebar browser and leaves directory picking to the Host', () => {
  const text = read('src/client.js')
  assert.match(text, /slots\.inject\('sidebar\.workspaces'/)
  assert.match(text, /priority: -1/, 'browser shadowing needs the lowest rank')
  // The two directoryFlow holes belong to the shipped picker again: taking them
  // over replaced a 680x500 Host browser with the plugin's 380x470 hand-rolled
  // dialog, which read as an unfinished UI. Virtual-directory filing therefore
  // lives on the plugin's OWN surface (sidebar toolbar / directory row), never
  // in a slot the Host also serves.
  const injections = [...text.matchAll(/slots\.inject\('([^']+)'/g)].map((m) => m[1])
  assert.deepEqual(injections, ['settings.plugin.item', 'sidebar.workspaces'],
    'only the settings card and the sidebar browser may be filled')
})

test('client plugin exports the cordis plugin triple', () => {
  const text = read('src/client.js')
  assert.match(text, /name: 'dsh-virtual-workspace'/)
  assert.match(text, /inject: \['slots', 'sessions', 'workspaces', 'locale', 'uiWorkspace'\]/)
  assert.match(text, /function apply\(ctx\)/)
})

test('client half stays plain JavaScript (no import/JSX/TS syntax)', () => {
  const text = read('src/client.js')
  assert.doesNotMatch(text, /(^|\n)\s*import\s/)
  assert.doesNotMatch(text, /(^|\n)\s*export\s/)
  assert.doesNotMatch(text, /=> </, 'JSX arrow syntax is forbidden')
  assert.doesNotMatch(text, /:\s*(string|number|boolean)\b/, 'TypeScript annotations are forbidden')
  // Compiles as a function body (never executed — window is absent in Node).
  new Function(text)
})

/**
 * Extract the pure title-splitting helpers from the client bundle and run
 * them for real. Everything between splitPlainSegs and normPath is plain,
 * dependency-free JavaScript, so evaluating the slice in one Function scope
 * executes exactly what ships.
 */
const loadTitleSegs = () => {
  const text = read('src/client.js')
  const start = text.indexOf('const splitPlainSegs = (text) => {')
  const end = text.indexOf('const normPath =')
  assert.ok(start !== -1 && end !== -1 && start < end, 'splitting helpers not found')
  const scope = new Function(text.slice(start, end) + '\nreturn { splitTitleSegs }')
  return scope()
}

test('splitTitleSegs: paired quotes verbatim, lone quotes are plain text', () => {
  const { splitTitleSegs } = loadTitleSegs()
  // Unquoted slashes split (deliberate user grouping).
  assert.deepEqual(splitTitleSegs('插件开发/更好的左侧边栏'), ['插件开发', '更好的左侧边栏'])
  // Paired quotes: one verbatim leaf including the quote characters.
  assert.deepEqual(splitTitleSegs('“插件开发/更好的左侧边栏”'), ['“插件开发/更好的左侧边栏”'])
  assert.deepEqual(splitTitleSegs('"a/b" and c/d'), ['"a/b"', 'and c', 'd'])
  // A lone opener (no matching closer) is an ORDINARY character — 0.9.1
  // swallowed the rest of the title instead.
  assert.deepEqual(splitTitleSegs('插件开发/"abc'), ['插件开发', '"abc'])
  assert.deepEqual(splitTitleSegs('say “hello'), ['say “hello'])
  // A closer without an opener never started a span.
  assert.deepEqual(splitTitleSegs('a/b”c'), ['a', 'b”c'])
  // URL tail stays opaque from the first :// onward.
  assert.deepEqual(splitTitleSegs('see https://x.dev/a/b'), ['see https://x.dev/a/b'])
})

test('quote-on-land effect: blank-born only, user renames pinned, stability window', () => {
  const text = read('src/client.js')
  // Eligibility is keyed off an observed BLANK snapshot, not "first time seen".
  assert.match(text, /blankSeen\.add\(id\)/, 'blank birth mark must be recorded')
  assert.match(text, /!blankSeen\.has\(id\) \|\| touched\.has\(id\)/, 'untouched blankSeen/human guard')
  assert.doesNotMatch(text, /titledSeenRef/, '0.9.1 first-snapshot heuristic must be gone')
  // User renames route through the pinning wrapper; the automatic path alone
  // keeps the raw injected renameSession.
  assert.match(text, /const renameByUser = \(sessionId, title\) => \{/)
  assert.equal((text.match(/renameByUser\(/g) || []).length, 3, 'exactly 3 user call sites')
  // The automatic quote waits out a stabilization window instead of racing
  // the async LLM name.
  assert.match(text, /TITLE_STABLE_MS = 20000/)
  assert.match(text, /prev\.title === text/, 'title change resets the window')
  assert.match(text, /\[list, stableTick\]/, 'stability tick re-runs the effect')
})

test('host half imports cleanly and applies without side effects', async () => {
  const plugin = await import('../src/index.js')
  assert.equal(plugin.name, 'dsh-virtual-workspace')
  assert.equal(typeof plugin.apply, 'function')
  let logged = ''
  plugin.apply({ logger: { info: (m) => { logged = String(m) } } })
  assert.match(logged, /dsh-better-workspace/)
  plugin.apply(undefined) // must not throw without a logger
})

test('locale dictionaries cover every static t() key in both languages', () => {
  const text = read('src/client.js')
  const slice = (startMarker, endMarker) => {
    const start = text.indexOf(startMarker)
    assert.ok(start !== -1, 'missing block: ' + startMarker)
    const end = text.indexOf(endMarker, start)
    assert.ok(end !== -1, 'missing end marker for ' + startMarker)
    return text.slice(start, end)
  }
  const keysOf = (block) => new Set([...block.matchAll(/'([a-zA-Z][^']*)':/g)].map((m) => m[1]))
  const zhBlock = slice('const zh = {', 'const en = {')
  const enBlock = slice('const en = {', 'const LOCALES = {')
  const zhKeys = keysOf(zhBlock)
  const enKeys = keysOf(enBlock)
  assert.ok(zhKeys.size > 20, 'zh dictionary looks too small')
  assert.deepEqual([...enKeys].sort(), [...zhKeys].sort(), 'zh/en dictionaries must be key-aligned')
  const used = new Set([...text.matchAll(/\bt\('([^']+)'\)/g)].map((m) => m[1]))
  for (const key of used) {
    assert.ok(zhKeys.has(key), 't("' + key + '") missing from zh dictionary')
    assert.ok(enKeys.has(key), 't("' + key + '") missing from en dictionary')
  }
  // dynamic time keys
  for (const unit of ['minutes', 'hours', 'days', 'months', 'years']) {
    assert.ok(zhKeys.has('time.' + unit) && enKeys.has('time.' + unit), 'missing time.' + unit)
  }
})

// Same guard as dsh-ide-git's smoke suite. Every third-language block is
// preceded by a /* locale: <tag> */ marker, so the blocks can be sliced out of
// the file without parsing it. Equality matters because a key missing from a
// third language falls back to English at lookup time — a silent
// half-translated panel, which is exactly what this catches.
const SHIPPED_LOCALES = [
  'ar', 'de', 'fr', 'hi', 'id', 'it', 'ja', 'ko', 'nl', 'pl',
  'pt', 'ru', 'sv', 'th', 'tr', 'vi', 'zh-HK', 'zh-MO', 'zh-TW',
]

test('every shipped dictionary carries the same key set as zh', () => {
  const text = read('src/client.js')
  const keyLines = (segment) => [...segment.matchAll(/^ +'([^']+)': '/gm)].map((m) => m[1]).sort()
  const zhKeys = keyLines(text.slice(text.indexOf('const zh = {'), text.indexOf('const en = {')))
  assert.ok(zhKeys.length >= 100, 'the zh dictionary looks truncated: ' + zhKeys.length)

  const start = text.indexOf('const LOCALES = {')
  const end = text.indexOf('/* ============================= helpers', start)
  assert.ok(start !== -1 && end !== -1 && start < end, 'the LOCALES table is missing')
  const parts = text.slice(start, end).split('/* locale: ')
  assert.ok(
    parts.length - 1 >= SHIPPED_LOCALES.length,
    'expected at least ' + SHIPPED_LOCALES.length + ' third-language dictionaries, saw ' + (parts.length - 1),
  )
  const tags = []
  for (let index = 1; index < parts.length; index += 1) {
    const tag = parts[index].slice(0, parts[index].indexOf(' */'))
    tags.push(tag)
    assert.deepEqual(keyLines(parts[index]), zhKeys, 'dictionary ' + tag + ' does not match the zh key set')
  }
  assert.deepEqual(tags, SHIPPED_LOCALES, 'the shipped language list changed')
  // All dictionaries ride the one register call the host locale service reads;
  // a dropped locale here would leave that language on English.
  assert.match(
    text,
    /ctx\.locale\.register\(NS, Object\.assign\(\{ zh, en \}, LOCALES\)\)/,
    'every dictionary must be published through ctx.locale.register',
  )

  // Live switching is the host's job here. `t` is a seat the renderer binds
  // from the registration's locale: NS and rebuilds on every locale revision,
  // so nothing may resolve or capture a dictionary plugin-side — a
  // translatorOf / dictionaryFor (which dsh-ide-git needs only because its
  // panel is not a DSH slot) would fork that single source of truth and pin
  // the language until the next page load.
  assert.match(text, /locale: NS/, 'every registration must name the dictionary namespace')
  assert.doesNotMatch(
    text,
    /translatorOf|dictionaryFor|dictionaryOf\(/,
    'dictionary resolution belongs to the host locale service, not this plugin',
  )
})

/**
 * Cold-restart title fallback (0.9.4). The host list serves titles only from
 * the persisted projection cache; fork-born and never-checkpointed sessions
 * restart with title absent and displayTitle degraded to the workspace
 * basename. The plugin remembers last-known real wire titles and feeds them
 * through sessionTitleOf's third parameter.
 */
test('sessionTitleOf: wire title wins, remembered fills the cold-restart window', () => {
  const text = read('src/client.js')
  const start = text.indexOf('const sessionTitleOf =')
  const end = text.indexOf('/**', start)
  assert.ok(start !== -1 && end !== -1, 'sessionTitleOf not found')
  const { sessionTitleOf } = new Function(text.slice(start, end) + '\nreturn { sessionTitleOf }')()
  const t = (k) => k
  assert.equal(sessionTitleOf({ blank: true }, t, 'x'), 'session.new', 'blank stays New Session')
  assert.equal(sessionTitleOf({ title: 'wire/real' }, t, 'old/name'), 'wire/real', 'wire title beats memory')
  assert.equal(sessionTitleOf({ displayTitle: 'basename' }, t, 'web/前端'), 'web/前端', 'remembered beats the basename fallback')
  assert.equal(sessionTitleOf({ displayTitle: 'basename' }, t), 'basename', 'no memory: fallback stands')
  assert.equal(sessionTitleOf({ displayTitle: 'basename' }, t, ''), 'basename', 'blank memory never masks the fallback')
  assert.equal(sessionTitleOf(undefined, t, 'x'), '', 'no summary renders nothing')
})

test('title cache: persisted key, batch learning, debounced save, bounded eviction (0.9.6)', async () => {
  const text = read('src/client.js')
  // 0.9.6 shape (issue #1): the cache is plain module state — no reactive
  // store, no per-session dispatch; one batch pass + one debounced save.
  assert.doesNotMatch(text, /createTitleCacheStore|actions\.rememberTitle/)
  assert.match(text, /const TITLE_CACHE_KEY = 'dsh\.betterWorkspace\.titles\.v1'/)
  // Learning discipline kept: only real wire titles (summary.title), never blank rows.
  assert.match(text, /if \(!summary \|\| summary\.blank\) continue/)
  assert.match(text, /typeof title !== 'string' \|\| title === ''\) continue/)
  assert.match(text, /titleCacheRef\.rememberAllTitles\(list\)/)
  // Rows render through the remembered fallback.
  assert.match(text, /sessionTitleOf\(summary, t, rememberedTitleOf\(id\)\)/)
  // Drive the real block with a mocked localStorage.
  const start = text.indexOf('const TITLE_CACHE_LIMIT =')
  const end = text.indexOf('/* ======================= host settings sync')
  assert.ok(start !== -1 && end !== -1 && start < end, 'title cache block not found')
  const saved = new Map()
  const fakeLocalStorage = {
    getItem: (k) => (saved.has(k) ? saved.get(k) : null),
    setItem: (k, v) => { saved.set(k, String(v)) },
  }
  const scope = new Function('localStorage', 'setTimeout', 'clearTimeout',
    text.slice(start, end)
    + '\nreturn { titleCache, loadTitleCache, rememberAllTitles, TITLE_CACHE_LIMIT, TITLE_CACHE_KEEP }')
  const api = scope(fakeLocalStorage, setTimeout, clearTimeout)
  // Hydration: existing persisted state replaces the empty seed.
  saved.set('dsh.betterWorkspace.titles.v1', JSON.stringify({ byId: { old: { title: 'a/b', at: 1 } } }))
  api.loadTitleCache()
  assert.equal(api.titleCache.byId.old.title, 'a/b')
  // Batch learning: blank and empty-title rows never learn; real titles do.
  const list = { byId: { a: { title: 'web/one' }, b: { blank: true }, c: { title: '' }, d: { title: 'web/two' } } }
  assert.equal(api.rememberAllTitles(list), true, 'first pass learns')
  assert.ok(api.titleCache.byId.a && api.titleCache.byId.d)
  assert.ok(!api.titleCache.byId.b && !api.titleCache.byId.c)
  assert.equal(typeof api.titleCache.byId.a.at, 'number')
  // Same values again: nothing changes, nothing schedules a save.
  assert.equal(api.rememberAllTitles(list), false, 'unchanged pass is a no-op')
  // Eviction past the cap keeps the newest TITLE_CACHE_KEEP entries.
  const big = { byId: {} }
  for (let i = 0; i < api.TITLE_CACHE_LIMIT + 1; i++) big.byId['k' + i] = { title: 't' + i }
  api.rememberAllTitles(big)
  assert.equal(Object.keys(api.titleCache.byId).length, api.TITLE_CACHE_KEEP)
  assert.ok(api.titleCache.byId['k' + api.TITLE_CACHE_LIMIT], 'newest survives')
  assert.ok(!api.titleCache.byId.old, 'oldest evicted')
  // Debounced save lands under the same persist key (~200 ms).
  await new Promise((r) => setTimeout(r, 260))
  assert.ok(saved.has('dsh.betterWorkspace.titles.v1'), 'debounced save persisted')
  const persisted = JSON.parse(saved.get('dsh.betterWorkspace.titles.v1'))
  assert.ok(persisted && typeof persisted.byId === 'object')
})


test('manual cross-device sync: host scope bind, dual writes, pull modes', () => {
  const text = read('src/client.js')
  // Scope bound once per activation; failures degrade to browser-local.
  assert.match(text, /const bindPrefsScope =/)
  assert.match(text, /ctx\.get\('configForms'\)/)
  assert.match(text, /ctx\.get\('settingsScope'\)/)
  assert.match(text, /bind\(\{ namespace: 'better-workspace' \}\)/)
  // Dual-write wrappers exist and route every preference mutation through them.
  assert.match(text, /const makeSharedWrites = \(actions, stylingMap, foldersList, dirsMap, wsDirMap\)/)
  assert.equal((text.match(/shared\.(setStyling|addFolder|removeFolder|renameFolder)\(/g) || []).length, 6,
    'browser (5) + flow (1) preference writes all go through the shared wrappers')
  // Pull modes: overwrite replaces, merge unions with the pulled copy winning.
  assert.match(text, /importHost: \(d, host\)/)
  assert.match(text, /mergeHost: \(d, host\)/)
  // Surface detection picks the pull label direction.
  assert.match(text, /location\.protocol === 'dsh-app:'/)
  assert.match(text, /t\(IS_DESKTOP_SURFACE \? 'sync\.pull\.web' : 'sync\.pull\.desktop'\)/)
  // No automatic mirror/migration remains: sync is manual by user decision.
  assert.doesNotMatch(text, /useHostMirror/)
  assert.doesNotMatch(text, /HOST_SYNC_MARK/)
  for (const key of ['sync.pull.desktop', 'sync.pull.web', 'sync.mode.overwrite', 'sync.mode.merge', 'sync.push']) {
    assert.ok(text.includes("'" + key + "':"), 'missing dictionary key ' + key)
  }
})

/**
 * Appearance defaults + the derived text outline (0.10.0). The outline color is
 * never picked by hand: it is the pole that contrasts with the label color, so
 * it survives a theme or background-plugin light/dark flip.
 */
test('appearance: outline on (gray default), pick or auto, field-by-field merge (0.10.0)', () => {
  const text = read('src/client.js')
  const start = text.indexOf('const colorToRgb =')
  const end = text.indexOf('function FolderRow(')
  assert.ok(start !== -1 && end !== -1 && start < end, 'appearance helpers not found')
  const loaded = new Function(text.slice(start, end) +
    '\nreturn { DEFAULT_APPEARANCE, readAppearance, mergeAppearance, contrastStrokeColor, parseCssColor, strokeStyleOf }')()
  const { DEFAULT_APPEARANCE, readAppearance, mergeAppearance, contrastStrokeColor, parseCssColor, strokeStyleOf } = loaded
  // The outline ships ON — text over a background image is unreadable without it.
  assert.equal(DEFAULT_APPEARANCE.stroke, true)
  assert.equal(DEFAULT_APPEARANCE.strokeWidth, 1)
  assert.equal(DEFAULT_APPEARANCE.color, '')
  assert.equal(DEFAULT_APPEARANCE.strokeColor, '#808080', 'the outline defaults to gray')
  // Hydration replaces state wholesale: every read tolerates missing keys.
  assert.deepEqual(readAppearance(undefined), DEFAULT_APPEARANCE)
  assert.equal(readAppearance({}).stroke, true, 'a missing stroke key keeps the default outline')
  assert.equal(readAppearance({}).strokeColor, '#808080', 'a missing color key keeps the gray default')
  assert.equal(readAppearance({ stroke: false }).stroke, false, 'an explicit off survives')
  assert.equal(readAppearance({ strokeWidth: 99 }).strokeWidth, 2, 'width clamps to the slider range')
  assert.equal(readAppearance({ strokeWidth: 0 }).strokeWidth, 1, 'a zero width falls back to the default')
  // Row entries override the default FIELD BY FIELD: entries written before the
  // outline existed still inherit it.
  const merged = mergeAppearance(DEFAULT_APPEARANCE, { color: '#f85149', glow: 6 })
  assert.equal(merged.color, '#f85149')
  assert.equal(merged.glow, 6)
  assert.equal(merged.stroke, true, 'older entries inherit the default outline')
  assert.equal(merged.strokeWidth, 1)
  assert.equal(mergeAppearance(DEFAULT_APPEARANCE, { stroke: false }).stroke, false, 'a row can turn it off')
  // The pole follows the LABEL color (WCAG contrast against both poles).
  assert.equal(contrastStrokeColor([255, 255, 255]), '#000000')
  assert.equal(contrastStrokeColor([0, 0, 0]), '#ffffff')
  assert.equal(contrastStrokeColor([230, 230, 230]), '#000000')
  assert.equal(contrastStrokeColor([91, 141, 239]), '#000000')
  assert.equal(contrastStrokeColor(null), '#000000')
  assert.equal(parseCssColor('rgb(230, 230, 230)')[0], 230)
  assert.equal(parseCssColor('rgba(18, 18, 20, 0.9)')[2], 20)
  assert.equal(parseCssColor('color(srgb 0.9 0.9 0.9)')[0], 229.5, 'color(srgb ...) is understood too')
  assert.equal(parseCssColor('nonsense'), null)
  // Custom colors compute their own pole; rows without one read the sampled
  // variable so a palette flip needs no React render.
  assert.equal(strokeStyleOf({ color: '#ffffff', stroke: true, strokeWidth: 2 }).WebkitTextStrokeColor, '#808080', 'gray is the default pick')
  assert.equal(strokeStyleOf({ color: '#ffffff', stroke: true, strokeWidth: 2, strokeColor: '#f85149' }).WebkitTextStrokeColor, '#f85149', 'a picked color wins')
  assert.equal(strokeStyleOf({ color: '#ffffff', stroke: true, strokeWidth: 2, strokeColor: 'not-a-color' }).WebkitTextStrokeColor, '#808080', 'a malformed pick falls back to gray')
  assert.equal(strokeStyleOf({ color: '#ffffff', stroke: true, strokeWidth: 2, strokeColor: 'auto' }).WebkitTextStrokeColor, '#000000', 'auto derives the pole')
  assert.equal(strokeStyleOf({ color: '#0b0b0b', stroke: true, strokeWidth: 1, strokeColor: 'auto' }).WebkitTextStrokeColor, '#ffffff')
  assert.match(strokeStyleOf({ color: '', stroke: true, strokeWidth: 1, strokeColor: 'auto' }).WebkitTextStrokeColor, /--bw-stroke-color/)
  // paint-order hides the inner half of the band, so the painted width is TWICE
  // the rim the slider promises: painting the configured value left a 0.5px rim
  // that antialiasing blended away into the pale, uneven edge users reported.
  assert.equal(strokeStyleOf({ color: '#ffffff', stroke: true, strokeWidth: 1 }).WebkitTextStrokeWidth, '2px', 'a 1px rim is painted 2px wide')
  assert.equal(strokeStyleOf({ color: '#ffffff', stroke: true, strokeWidth: 2 }).WebkitTextStrokeWidth, '4px')
  assert.equal(strokeStyleOf({ color: '#ffffff', stroke: true, strokeWidth: 2 }).paintOrder, 'stroke fill')
  assert.equal(strokeStyleOf({ color: '#fff', stroke: false }), null, 'off renders no stroke style')
  // 0.11.1's offset-copy rim is gone: eight directions are four diagonal
  // samples, so slopes and curves came out as detached blocks.
  assert.doesNotMatch(text, /STROKE_DIRECTIONS|strokeShadowsOf/, 'the rim must stay a real geometric stroke')
  // Host schema + cross-device sync carry the new field.
  assert.match(read('src/index.js'), /appearance: Schema\.dict/, 'host namespace must declare appearance')
  assert.match(text, /host\.appearance && typeof host\.appearance === 'object'/, 'pull paths must carry appearance')
  assert.match(text, /scopeSet\('appearance'/, 'the push path must carry appearance')
  assert.match(text, /--bw-stroke-color/, 'the sampled variable is what unattributed rows read')
})

/**
 * Outline clipping + meta-column rules (0.10.1): an outer outline overflows the
 * glyph box, so the label's overflow:hidden (needed for the ellipsis) cut it off
 * at the left edge; the 11px meta column must not be stroked at all.
 */
test('outline: label keeps a bleed, meta column stays unstroked (0.10.1)', () => {
  const text = read('src/client.js')
  assert.match(text, /\.bw-row-label\{[^}]*padding:3px;margin:-3px/, 'the label needs a bleed for the rim')
  assert.match(text, /\.bw-row-label\{[^}]*overflow:hidden/, 'the ellipsis overflow must stay')
  assert.match(text, /\.bw-preview-label\{[^}]*padding:3px;margin:-3px/, 'the preview label bleeds too')
  assert.match(text, /\.bw-row-count,\.bw-row-time\{-webkit-text-stroke-width:0\}/, 'count/time must not be stroked')
  // The rim never travels through text-shadow, so the halo and the breathing
  // keyframes keep working exactly as they did before 0.11.1.
  assert.doesNotMatch(text, /--bw-stroke-shadow|--bw-glow-shadow|--bw-text-glow/, 'the rim must not ride in text-shadow')
  assert.match(text, /@keyframes bw-breathe-text\{0%,100%\{text-shadow:0 0 1px var\(--bw-pulse-color\)/, 'the pulse keyframes are untouched')
})

/**
 * Icon compatibility (0.10.2): dsh 0.1.6-alpha.1 replaced part of the
 * primitives icon set (IconSendOutline16 -> IconPaperPlaneOutline14 and
 * friends), so a persisted custom icon naming a retired glyph must resolve to a
 * surviving equivalent instead of rendering an empty cell.
 */
test('icons: retired glyphs resolve to a survivor; the picker follows the host set (0.10.2)', () => {
  const text = read('src/client.js')
  const start = text.indexOf('const ICON_ALIASES =')
  // The slice must stop at the withTip helper: it is host-Tooltip plumbing, not
  // part of the pure resolution contract this test evaluates.
  const end = text.indexOf('/**\n     * Wrap an icon-only control')
  assert.ok(start !== -1 && end !== -1 && start < end, 'icon resolution helpers not found')
  const load = (ui) => new Function('ui', text.slice(start, end) + '\nreturn { resolveIconName }')(ui)

  const oldUi = { IconSendOutline16: () => null, IconSendOutline14: () => null, IconSearchOutline16: () => null }
  assert.equal(load(oldUi).resolveIconName('IconSendOutline16'), 'IconSendOutline16', 'a live glyph is used as-is')
  assert.equal(load(oldUi).resolveIconName('IconNope'), '', 'an unknown glyph degrades to empty')
  assert.equal(load(oldUi).resolveIconName(''), '')
  assert.equal(load(oldUi).resolveIconName(undefined), '')
  assert.equal(load(oldUi).resolveIconName('solid'), '', 'legacy slots are not glyph names')

  // 0.2.0-rc.2 renamed the whole set: `Icon<Name>Outline<px>` -> `Outline<weight>`.
  // A persisted choice naming the retired spelling must follow the alias to the
  // shipped glyph, and the current spelling must pass through untouched.
  const added = ['IconPaperPlaneOutlineRegular', 'IconShieldOutlineRegular', 'IconCompactOutlineRegular',
    'IconWrapLinesOutlineRegular', 'IconPlanOutlineRegular']
  const newUi = { IconSendOutlineRegular: () => null }
  for (const name of added) newUi[name] = () => null
  assert.equal(load(newUi).resolveIconName('IconSendOutline16'), 'IconSendOutlineRegular', 'a retired 0.2.0 glyph follows its alias chain')
  assert.equal(load(newUi).resolveIconName('IconSendOutlineRegular'), 'IconSendOutlineRegular')
  assert.equal(load(newUi).resolveIconName('IconShieldOutline16'), 'IconShieldOutlineRegular')
  assert.equal(load({}).resolveIconName('IconSendOutline16'), '', 'an alias with no survivor stays empty rather than crashing')

  const choicesStart = text.indexOf('const ICON_CHOICES = [')
  const choicesEnd = text.indexOf('})()', choicesStart) + 4
  assert.ok(choicesStart !== -1 && choicesEnd > choicesStart, 'icon choice list not found')
  const aliasCode = text.slice(start, end)
  const pickerCode = aliasCode + '\n' + text.slice(choicesStart, choicesEnd)
  const listOf = (ui) => new Function('ui', pickerCode + '\nreturn { ICON_CHOICES, ICON_PICKER_CHOICES }')(ui)
  const onNew = listOf(newUi)
  assert.ok(!onNew.ICON_CHOICES.includes('IconSendOutline16'), 'the retired name is gone from the committed list')
  assert.ok(onNew.ICON_CHOICES.includes('IconSendOutlineRegular'), 'the surviving glyph is committed')
  assert.ok(onNew.ICON_PICKER_CHOICES.includes('IconSendOutlineRegular'), 'the surviving glyph is offered')
  assert.equal(new Set(onNew.ICON_PICKER_CHOICES).size, onNew.ICON_PICKER_CHOICES.length, 'no duplicate cells')
  assert.ok(onNew.ICON_PICKER_CHOICES.includes('solid') && onNew.ICON_PICKER_CHOICES.includes('none'), 'legacy slots always survive')
  assert.ok(onNew.ICON_PICKER_CHOICES.length < onNew.ICON_CHOICES.length, 'glyphs this host lacks are filtered out')
  for (const name of added) {
    assert.ok(onNew.ICON_CHOICES.includes(name), name + ' is part of the committed list')
    assert.ok(onNew.ICON_PICKER_CHOICES.includes(name), name + ' is offered on a host that exports it')
  }
  // A host that lacks the newer glyphs still offers the survivors, never them.
  const bare = listOf({ IconSendOutlineRegular: () => null })
  for (const name of added) assert.ok(!bare.ICON_PICKER_CHOICES.includes(name), name + ' must be filtered out on a host that lacks it')
  assert.ok(bare.ICON_PICKER_CHOICES.includes('IconSendOutlineRegular'), 'the survivor stays offered')
})

/**
 * Session reorder fallback (0.10.2): dsh 0.1.6-alpha.1 stopped injecting
 * insertSessionBefore, which used to be the only reorder channel — the browser
 * keeps its own flat order so the gesture keeps working.
 */
test('virtual directories reorder like workspaces: dense sibling numbering', () => {
  const text = read('src/client.js')
  const start = text.indexOf('const childDirsOf = (directories, parentId) =>')
  const end = text.indexOf('const dirPathOf = (directories, dirId) =>')
  assert.ok(start !== -1 && end !== -1 && start < end, 'directory helpers not found')
  const scope = new Function(
    "const ROOT_DIR = ''\n" + text.slice(start, end) + '\nreturn { childDirsOf, reorderDirIds }',
  )()
  const dirs = {
    a: { id: 'a', name: 'alpha', parentId: '', order: 0 },
    b: { id: 'b', name: 'beta', parentId: '', order: 1 },
    c: { id: 'c', name: 'gamma', parentId: '', order: 2 },
    d: { id: 'd', name: 'delta', parentId: '', order: 3 },
  }
  const shown = (orderMap) => {
    const next = {}
    for (const id of Object.keys(dirs)) {
      next[id] = Object.assign({}, dirs[id], { order: orderMap && orderMap[id] !== undefined ? orderMap[id] : dirs[id].order })
    }
    return scope.childDirsOf(next, '').map((dir) => dir.name)
  }
  assert.deepEqual(shown(scope.reorderDirIds(dirs, 'c', 0)), ['gamma', 'alpha', 'beta', 'delta'], 'to the front')
  assert.deepEqual(shown(scope.reorderDirIds(dirs, 'c', 3)), ['alpha', 'beta', 'delta', 'gamma'], 'to the end')
  assert.deepEqual(shown(scope.reorderDirIds(dirs, 'a', 2)), ['beta', 'gamma', 'alpha', 'delta'], 'into the middle')
  assert.deepEqual(shown(scope.reorderDirIds(dirs, 'a', 0)), ['alpha', 'beta', 'gamma', 'delta'], 'a no-op move keeps the order')
  assert.deepEqual(shown(scope.reorderDirIds(dirs, 'a', 99)), ['beta', 'gamma', 'delta', 'alpha'], 'an out-of-range index clamps to the end')
  // Dense 0..n-1: equal orders would make the tree's name tiebreak re-sort the
  // list alphabetically, so a move would visually do nothing.
  const map = scope.reorderDirIds(dirs, 'c', 0)
  assert.deepEqual(Object.keys(map).sort().map((k) => map[k]).sort(), [0, 1, 2, 3], 'orders are renumbered densely')
  assert.equal(scope.reorderDirIds(dirs, 'missing', 0), null, 'an unknown id is refused')
  // Siblings only: a move inside one parent must not touch other parents.
  const nested = {
    p: { id: 'p', name: 'one', parentId: '', order: 0 },
    q: { id: 'q', name: 'two', parentId: '', order: 1 },
    c1: { id: 'c1', name: 'x', parentId: 'p', order: 0 },
    c2: { id: 'c2', name: 'y', parentId: 'p', order: 1 },
  }
  assert.deepEqual(Object.keys(scope.reorderDirIds(nested, 'c2', 0)).sort(), ['c1', 'c2'], 'only the moved directory\'s siblings')
})

test('session reorder: host action preferred, browser-local order as the fallback (0.10.2)', () => {
  const text = read('src/client.js')

  const start = text.indexOf('function reorderIds(ids, id, anchor)')
  const end = text.indexOf('const countSessionTree = (node) =>')
  assert.ok(start !== -1 && end !== -1 && start < end, 'reorderIds not found')
  const { reorderIds } = new Function(text.slice(start, end) + '\nreturn { reorderIds }')()
  assert.deepEqual(reorderIds(['a', 'b', 'c'], 'c', 'a'), ['c', 'a', 'b'], 'move before an anchor')
  assert.deepEqual(reorderIds(['a', 'b', 'c'], 'a', 'c'), ['b', 'a', 'c'])
  assert.deepEqual(reorderIds(['a', 'b', 'c'], 'a', undefined), ['b', 'c', 'a'], 'no anchor appends')
  assert.deepEqual(reorderIds(['a', 'b', 'c'], 'b', 'gone'), ['a', 'c', 'b'], 'a vanished anchor appends')
  assert.deepEqual(reorderIds([], 'a', undefined), ['a'])
  assert.deepEqual(reorderIds(undefined, 'a', undefined), ['a'], 'a missing list is tolerated')

  // Store action: hydration replaces state wholesale, so a state persisted
  // before this key existed must still accept the write.
  const storeStart = text.indexOf('const createViewStore = () => storeKit.defineStore({')
  const storeEnd = text.indexOf('/* ========================= title cache store')
  assert.ok(storeStart !== -1 && storeEnd !== -1 && storeStart < storeEnd, 'view store not found')
  const def = new Function('storeKit', text.slice(storeStart, storeEnd) + '\nreturn createViewStore()')({ defineStore: (d) => d })
  assert.deepEqual(def.init().sessionOrder, {}, 'init carries the new key')
  const setSessionOrder = def.actions.setSessionOrder
  const stale = { folders: [] }
  setSessionOrder(stale, 'ws1', ['a', 'b'])
  assert.deepEqual(stale.sessionOrder.ws1, ['a', 'b'])
  setSessionOrder(stale, 'ws1', [])
  assert.equal('ws1' in stale.sessionOrder, false, 'an empty order clears the entry')
  setSessionOrder(stale, 'ws2', undefined)
  assert.equal('ws2' in stale.sessionOrder, false)
  setSessionOrder(stale, 'ws3', 'not-a-list')
  assert.equal('ws3' in stale.sessionOrder, false)

  // Wiring: the host action stays authoritative; the local order only applies
  // where the host no longer injects one.
  assert.match(text, /typeof insertSessionBefore === 'function' \? \[\] : sessionOrderOf\(workspace\.workspaceId\)/,
    'the host order must win wherever the action exists')
  assert.match(text, /actions\.setSessionOrder\(workspaceId, reorderIds\(flat\.map/,
    'the fallback commits the move into the local order')
  assert.match(text, /const sessionOrderMap = useStore \? \(useStore\(s => s\.sessionOrder\) \|\| \{\}\) : \{\}/,
    'the browser subscribes to the local order')
  assert.match(text, /if \(typeof insertSessionBefore === 'function'\) \{\n          Promise\.resolve\(\)/,
    'the host channel is tried first in the drop commit')
})

const routeOf = (text) => {
  const found = /OPEN_FOLDER_ROUTE = '([^']+)'/.exec(text)
  assert.ok(found, 'no OPEN_FOLDER_ROUTE constant')
  return found[1]
}

test('open-folder route: both halves name the same path', () => {
  const host = read('src/open-folder.js')
  const client = read('src/client.js')
  assert.equal(routeOf(host), routeOf(client), 'a drifted route is a 404 in the browser')
  assert.match(host, /export const OPEN_FOLDER_ROUTE = '\/_dsh\/virtual-workspace\/open-folder'/)
})

test('host half mounts the open-folder route on the webServer service', () => {
  const text = read('src/index.js')
  assert.match(text, /import \{ OPEN_FOLDER_ROUTE, openFolderHandler \} from '\.\/open-folder\.js'/)
  assert.match(text, /ctx\.inject\(\['webServer'\]/, 'webServer may appear after apply')
  assert.match(text, /webCtx\.effect\(\(\) => \{/, 'the route must follow the plugin lifetime')
  assert.match(text, /kind: 'exact',\n\s+path: OPEN_FOLDER_ROUTE,/, 'route path must be the shared constant')
  assert.match(text, /handler: openFolderHandler/)
})

test('client half offers the entries and posts to the host route', () => {
  const text = read('src/client.js')
  assert.match(text, /const OPEN_FOLDER_ROUTE = '\/_dsh\/virtual-workspace\/open-folder'/)
  assert.match(text, /items\.push\(\{ id: 'ws-open-folder', label: t\('menu\.openWsFolder'\) \}\)/)
  assert.match(text, /items\.push\(\{ id: 'ws-copy-path', label: t\('menu\.copyPath'\) \}\)/)
  assert.match(text, /if \(wsPathOf\(ws\) !== ''\) \{/, 'a path-less workspace must not offer the entries')
  assert.match(text, /fetch\(OPEN_FOLDER_ROUTE, \{\n\s+method: 'POST',/, 'the action is a POST')
  assert.match(text, /requestOpenFolder\(path\)\.catch\(\(error\) => \{ showNotice\(messageOf\(error\), 'error'\) \}\)/)
  assert.match(text, /copyText\(path\)\.then\(\(\) => \{ showNotice\(t\('path\.copied'\)\) \}/)
  // The notice must survive the menu close, so it cannot live in React state.
  assert.match(text, /function showNotice\(message, variant\) \{/)
  assert.match(text, /data-bw-notice/)
  // Key coverage across all 21 dictionaries is asserted by the locale-parity
  // test above; this is only the call-site half of the pair.
  for (const key of ['menu.openWsFolder', 'menu.copyPath', 'path.copied', 'path.none']) {
    assert.equal((text.match(new RegExp("t\\('" + key.replace('.', '\\.') + "'\\)", 'g')) || []).length >= 1, true,
      key + ' must be used by the menu or its handler')
  }
})

test('openFolder: argument validation happens before any launcher', async () => {
  const { openFolder } = await import('../src/open-folder.js')
  const calls = []
  const run = (command, args) => { calls.push([command, args]); return Promise.resolve({ stdout: '', stderr: '' }) }
  await assert.rejects(() => openFolder(''), /empty path/)
  await assert.rejects(() => openFolder('relative/folder'), /must be absolute/)
  await assert.rejects(() => openFolder('/definitely/not/here-' + process.pid), /no such folder/)
  assert.equal(calls.length, 0, 'no launcher may run for a rejected path')
})

test('openFolder: WSL translates the path and hands it to the Windows desktop', async () => {
  const { openFolder, isWsl } = await import('../src/open-folder.js')
  const calls = []
  const run = (command, args) => {
    calls.push([command, args])
    return Promise.resolve(command === 'wslpath'
      ? { stdout: 'E:\\dsh测试文件夹\r\n', stderr: '' }
      : { stdout: '', stderr: '' })
  }
  const result = await openFolder(tmpdir(), { platform: 'linux', env: { WSL_DISTRO_NAME: 'Ubuntu-24.04' }, run })
  assert.equal(result.via, 'wsl')
  assert.equal(result.windowsPath, 'E:\\dsh测试文件夹')
  assert.deepEqual(calls[0], ['wslpath', ['-w', tmpdir()]])
  assert.equal(calls[1][0], 'powershell.exe')
  // The translated path must be the PowerShell literal, never a shell splice.
  assert.match(calls[1][1][3], /^Invoke-Item -LiteralPath 'E:\\dsh测试文件夹'$/)
  // WSL is decided by its own markers, not by process.platform.
  assert.equal(isWsl({ platform: 'linux', env: { WSL_INTEROP: '/run/WSL/1_interop' } }), true)
  assert.equal(isWsl({ platform: 'linux', env: {}, osRelease: '5.15.90.1-microsoft-standard-WSL2' }), true)
  assert.equal(isWsl({ platform: 'linux', env: {}, osRelease: '6.8.0-45-generic' }), false)
})

test('openFolder: PowerShell refusal falls back to explorer, unknown exit is a hand-off', async () => {
  const { openFolder } = await import('../src/open-folder.js')
  const calls = []
  const run = (command, args) => {
    calls.push(command)
    if (command === 'wslpath') return Promise.resolve({ stdout: 'C:\\work\r\n', stderr: '' })
    if (command === 'powershell.exe') return Promise.reject(Object.assign(new Error('exit 1'), { code: 1 }))
    // explorer.exe delegates to the running shell and exits 1: NOT a failure.
    return Promise.reject(Object.assign(new Error('exit 1'), { code: 1 }))
  }
  const result = await openFolder(tmpdir(), { platform: 'linux', env: { WSL_DISTRO_NAME: 'x' }, run })
  assert.deepEqual(calls, ['wslpath', 'powershell.exe', 'explorer.exe'])
  assert.equal(result.via, 'wsl')
  // A missing wslpath is a real, reported failure.
  const missing = () => Promise.reject(Object.assign(new Error('spawn wslpath ENOENT'), { code: 'ENOENT' }))
  await assert.rejects(
    () => openFolder(tmpdir(), { platform: 'linux', env: { WSL_DISTRO_NAME: 'x' }, run: missing }),
    /wslpath is unavailable/,
  )
})

test('openFolder: native platforms use their own opener', async () => {
  const { openFolder } = await import('../src/open-folder.js')
  const seen = []
  const run = (command, args) => { seen.push([command, args]); return Promise.resolve({ stdout: '', stderr: '' }) }
  // `osRelease` is spelled out for the Linux cases because the suite also runs
  // ON a WSL host, where an unset release falls back to the real kernel string
  // and a desktop-Linux expectation would silently turn into the WSL branch.
  const plainLinux = { env: {}, osRelease: '6.8.0-45-generic' }
  assert.equal((await openFolder(tmpdir(), { platform: 'darwin', env: {}, run })).via, 'darwin')
  assert.deepEqual(seen.pop(), ['open', [tmpdir()]])
  assert.equal((await openFolder(tmpdir(), { ...plainLinux, platform: 'linux', run })).via, 'linux')
  assert.deepEqual(seen.pop(), ['xdg-open', [tmpdir()]])
  assert.equal((await openFolder(tmpdir(), { ...plainLinux, platform: 'win32', run })).via, 'win32')
  assert.deepEqual(seen.pop(), ['powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Invoke-Item -LiteralPath '${tmpdir()}'`]])
  await assert.rejects(() => openFolder(tmpdir(), { ...plainLinux, platform: 'aix', run }), /unsupported on aix/)
  // The WSL check is Linux-scoped: a WSL marker leaking into a Windows or macOS
  // host process must not divert the open through wslpath.
  assert.equal((await openFolder(tmpdir(), { platform: 'win32', env: { WSL_DISTRO_NAME: 'Ubuntu-24.04' }, run })).via, 'win32')
  assert.deepEqual(seen.pop(), ['powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Invoke-Item -LiteralPath '${tmpdir()}'`]])
})

test('open-folder handler answers JSON for every outcome', async () => {
  const { handlerFor, OPEN_FOLDER_ROUTE } = await import('../src/open-folder.js')
  // The launch itself is injected: a smoke suite must never open windows on the
  // developer's desktop. What is under test here is the HTTP contract — status
  // codes and the message the browser half renders.
  const launched = []
  const handler = handlerFor({
    platform: 'linux',
    env: {},
    osRelease: '6.8.0-45-generic',
    run: (command, args) => { launched.push([command, args]); return Promise.resolve({ stdout: '', stderr: '' }) },
  })
  const server = createServer((req, res) => {
    if (new URL(req.url, 'http://localhost').pathname === OPEN_FOLDER_ROUTE) handler(req, res)
    else { res.writeHead(404); res.end() }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const origin = 'http://127.0.0.1:' + server.address().port
  const post = (body) => fetch(origin + OPEN_FOLDER_ROUTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async (response) => ({ status: response.status, body: await response.json() }))
  try {
    assert.equal((await fetch(origin + OPEN_FOLDER_ROUTE)).status, 405, 'GET is refused')
    assert.equal((await fetch(origin + OPEN_FOLDER_ROUTE, { method: 'POST', body: 'not json' })).status, 400)
    const missing = await post({})
    assert.equal(missing.status, 400)
    assert.equal(missing.body.error.message, 'Missing path')
    // A real absolute path that does not exist: reported, never silently opened.
    const absent = await post({ path: '/definitely/not/here-' + process.pid })
    assert.equal(absent.status, 500)
    assert.equal(absent.body.ok, false)
    assert.match(absent.body.error.message, /no such folder/)
    assert.equal(launched.length, 0, 'a rejected path must reach no launcher')
    // A real folder goes through and answers the same JSON envelope the browser
    // half unwraps (`result.value`).
    const opened = await post({ path: tmpdir() })
    assert.equal(opened.status, 200)
    assert.equal(opened.body.ok, true)
    assert.equal(opened.body.value.path, tmpdir())
    assert.deepEqual(launched, [['xdg-open', [tmpdir()]]])
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})



/**
 * Icon set rename (0.2.0-rc.2): the host retired the whole `Icon<Name>Outline<px>`
 * generation and shipped `Icon<Name>Outline<weight>` instead. Because `icon()`
 * degrades an unknown name to null, EVERY button in this plugin silently became
 * an empty transparent hit area — the sidebar toolbar's three actions were
 * invisible with nothing to hover. This test pins both halves of the repair:
 * every glyph the client names must exist in the host set, and every retired
 * name the alias table carries must resolve to a shipped glyph.
 */
test('icons: every named glyph exists in the host set after the 0.2.0 rename', () => {
  const text = read('src/client.js')
  let hostSet = null
  for (const spec of ['@deepseek-ai/dsh-client-ui-primitives/lib/index.js', '@deepseek-ai/dsh-client-ui-primitives']) {
    try {
      hostSet = readFileSync(createRequire(import.meta.url).resolve(spec), 'utf8')
      break
    } catch (err) { /* try the next spec form */ }
  }
  if (hostSet === null) {
    // dsh is not installed in this environment: the rename contract is not
    // observable here, and a hard failure would be a false alarm.
    return
  }
  const shipped = new Set(hostSet.match(/Icon[A-Za-z0-9]*(Outline|Fill)?(Regular|Medium|Artwork)/g) || [])
  assert.ok(shipped.size > 100, 'the host set must be recognised, saw ' + shipped.size + ' glyphs')

  // (1) Every glyph the client ACTION code names must exist as shipped.
  const named = new Set()
  for (const m of text.matchAll(/icon\(\s*'(Icon[A-Za-z0-9]+)'/g)) named.add(m[1])
  assert.ok(named.size >= 5, 'expected several icon() call sites, saw ' + named.size)
  const dead = [...named].filter((name) => !shipped.has(name))
  assert.deepEqual(dead, [], 'icon() names missing from the host set would render as empty cells')

  // (2) The demo/choice list may only advertise glyphs this host really has —
  //     the picker already filters, and this pins that it never needs to.
  for (const m of text.matchAll(/'(Icon[A-Za-z0-9]+)'/g)) {
    const name = m[1]
    if (name === 'Icona') continue // a font-family name, not a glyph
    assert.ok(shipped.has(name), name + ' is referenced but not shipped by this host')
  }

  // (3) Every retired name in the alias table resolves to a shipped glyph.
  const tableStart = text.indexOf('const ICON_ALIASES = {')
  const tableEnd = text.indexOf('\n    }', tableStart)
  assert.ok(tableStart !== -1 && tableEnd > tableStart, 'alias table not found')
  const pairs = [...text.slice(tableStart, tableEnd).matchAll(/(Icon[A-Za-z0-9]+):\s*\['(Icon[A-Za-z0-9]+)'\]/g)]
  assert.ok(pairs.length >= 60, 'expected the full retired-name table, saw ' + pairs.length)
  for (const [, retired, survivor] of pairs) {
    assert.ok(shipped.has(survivor), retired + ' aliases ' + survivor + ', which this host does not ship')
  }

  // (4) icon() must route through the alias chain, otherwise the table above is
  //     decoration: the render call site is what silently produced empty cells.
  assert.match(text, /const icon = \(name, size\) => \{\s*\n\s*const resolved = resolveIconName\(name\)/,
    'icon() must resolve retired names instead of a raw ui[name] lookup')
})

test('add-workspace entry: the VENDORED official browser + virtual-directory filing', () => {
  const text = read('src/client.js')

  // (1) The entry sits next to "new virtual folder" (expanded toolbar + rail).
  assert.match(text, /'aria-label': t\('add'\)/)
  assert.match(text, /'aria-label': t\('rail\.add'\)/)
  assert.match(text, /'aria-label': t\('dir\.new\.title'\)/)

  // (2) The picker is the OFFICIAL component, vendored from the MIT-licensed
  //     @deepseek-ai/dsh-client-ui-directory-picker-browse package (DSH is open
  //     source; that package exports only apply/inject, so copying the component
  //     is the supported way to reuse it). A hand-rolled imitation would be a
  //     different function with different class names.
  assert.match(text, /const OfficialDirectoryBrowser = \(\(\) => \{/)
  assert.match(text, /function DirectoryBrowser\(\{ open, listDirectory, createDirectory, onOpen, onClose, busy, t \}\)/)
  assert.match(text, /bwdb_/, 'the vendored stylesheet must be namespaced away from the shipped copy')
  assert.ok(text.indexOf('ZuhsRW_') === -1, 'the shipped picker keeps its own CSS prefix')

  // (3) The flow drives the component with OUR owner props and still falls back
  //     to the OS chooser on Hosts that compose the native backend.
  assert.match(text, /E\(OfficialDirectoryBrowser, \{[\s\S]{0,320}?onOpen: acceptPath[\s\S]{0,200}?pickTranslator\(t\)/)
  assert.match(text, /pickerCapabilityNow\(\)/)
  assert.match(text, /markPickerBrowse\(\)/)
  assert.match(text, /pickDirectory\(\)/)
  // The component speaks its own namespace; one table maps it onto ours.
  assert.match(text, /const PICK_LABEL_KEYS = \{/)
  assert.match(text, /'browser\.open': 'browse\.open'/)

  // (4) Filing never rewrites the workspace title: createWorkspace, then wsAssign.
  const flow = text.slice(text.indexOf('function AddWorkspaceFlow(props) {'), text.indexOf('/* ============================== rows'))
  const virtualBranch = flow.slice(flow.indexOf('if (virtualMode) {'), flow.indexOf('const prefix = normPath(parentInput)'))
  assert.ok(virtualBranch.length > 0, 'the virtual branch must exist')
  assert.match(virtualBranch, /shared\.wsAssign\(workspace\.workspaceId, dirId\)/)
  assert.ok(virtualBranch.indexOf('renameWorkspace') === -1, 'filing must never rename the workspace')
  assert.match(virtualBranch, /setExpanded\(dirId, true\)/)

  // (5) Hero picking still belongs to the Host: no directoryFlow registration.
  assert.ok(text.indexOf("slots.inject('conversation.hero.workspace.directoryFlow'") === -1)
  assert.ok(text.indexOf("slots.inject('sidebar.workspaces.directoryFlow'") === -1)

  // (6) Everything the hand-back preserved is still there.
  assert.match(text, /id: 'new-subworkspace'/, 'a directory row can start the flow')
  assert.match(text, /id: 'ws-move'/, 'filing an existing workspace stays')
  assert.match(text, /id: 'dir-new-sub'/, 'creating a sub-directory stays')
})

test('Windows folder picker: route, capability gate, path conversion (0.3.6)', async () => {
  const host = await import(new URL('../src/pick-folder.js', import.meta.url))
  const text = read('src/client.js')
  const index = read('src/index.js')
  const pkg = JSON.parse(read('package.json'))

  // (1) Both halves name the same route, the route is mounted, and the file ships.
  assert.equal(host.PICK_FOLDER_ROUTE, '/_dsh/virtual-workspace/pick-folder')
  assert.match(text, /const PICK_FOLDER_ROUTE = '\/_dsh\/virtual-workspace\/pick-folder'/)
  assert.match(index, /PICK_FOLDER_ROUTE/)
  assert.match(index, /pickFolderHandler/)
  assert.ok(pkg.files.includes('src/pick-folder.js'), 'the host module must ship')

  // (2) The dialog script is a constant with no request data spliced in, asks
  //     WinForms for the OS folder dialog, and prints machine-readable markers.
  assert.match(host.DIALOG_SCRIPT, /System\.Windows\.Forms\.FolderBrowserDialog/)
  assert.match(host.DIALOG_SCRIPT, /ShowDialog\(\$owner\)/)
  assert.match(host.DIALOG_SCRIPT, /DSH-PICK:OK:/)
  assert.match(host.DIALOG_SCRIPT, /DSH-PICK:CANCEL/)
  assert.ok(host.launcherArgs().includes('-STA'), 'WinForms needs a single-threaded apartment')

  // (3) Drive letters convert for the fallback path (wslpath needs interop too).
  assert.equal(host.manualHostPath('D:\\code\\app'), '/mnt/d/code/app')
  assert.equal(host.manualHostPath('E:\\'), '/mnt/e')
  assert.equal(host.manualHostPath('\\\\wsl.localhost\\Ubuntu\\home'), '\\\\wsl.localhost\\Ubuntu\\home')

  // (4) Non-WSL hosts and hosts without a Windows PowerShell are unavailable,
  //     never an error — the client falls back to the in-app browser.
  assert.equal(host.detectLauncher({ platform: 'darwin', env: {} }), null)
  assert.deepEqual(await host.pickFolder({ platform: 'darwin', env: {} }), { status: 'unavailable', reason: 'not-wsl' })
  assert.deepEqual(
    await host.pickFolder({ platform: 'linux', env: { WSL_DISTRO_NAME: 'x' }, exists: () => false }),
    { status: 'unavailable', reason: 'powershell-not-found' },
  )

  // (5) Missing WSLInterop is a capability fact, not a crash: without passwordless
  //     sudo the picker reports it and the flow falls back.
  const noSudo = {
    platform: 'linux', env: { WSL_DISTRO_NAME: 'x' },
    exists: (path) => path.includes('PowerShell/7') && !path.includes('binfmt'),
    run: () => Promise.reject(new Error('sudo: a password is required')),
  }
  assert.deepEqual(await host.pickFolder(noSudo), { status: 'unavailable', reason: 'windows-interop-disabled' })

  // (6) A cancelled dialog and a picked dialog both parse from the marker line.
  const base = {
    platform: 'linux', env: { WSL_DISTRO_NAME: 'x' },
    exists: (path) => path.includes('PowerShell/7') || path.includes('WSLInterop') || path === '/mnt/d/code/app',
    stat: () => ({ isDirectory: () => true }),
  }
  assert.deepEqual(
    await host.pickFolder({ ...base, run: () => Promise.resolve({ stdout: 'noise\nDSH-PICK:CANCEL\n', stderr: '' }) }),
    { status: 'cancelled' },
  )
  assert.deepEqual(
    await host.pickFolder({
      ...base,
      run: (command, args) => {
        if (command === 'wslpath') return Promise.resolve({ stdout: '/mnt/d/code/app\n', stderr: '' })
        return Promise.resolve({ stdout: 'DSH-PICK:OK:D:\\code\\app', stderr: '' })
      },
    }),
    { status: 'picked', path: '/mnt/d/code/app' },
  )

  // (6b) The mojibake regression (0.3.8): `[Console]::Out.Write` re-encodes the
  //      answer with the Windows OEM code page (CP936 on zh-CN), so a Chinese
  //      folder name reached the host garbled, failed the existence check and
  //      the whole pick was dropped — the flow then opened a SECOND picker and
  //      only the second choice worked. The answer now leaves as UTF-8 bytes.
  const cnWin = 'E:\\dsh测试文件夹'
  const cnHost = '/mnt/e/dsh测试文件夹'
  assert.match(host.ANSWER_HELPER, /\[System\.Text\.Encoding\]::UTF8\.GetBytes/)
  assert.match(host.ANSWER_HELPER, /\[Console\]::OpenStandardOutput\(\)/)
  assert.match(host.DIALOG_SCRIPT, /function Write-Answer\(\[string\]\$text\)/)
  assert.match(host.DIALOG_SCRIPT, /Write-Answer \('DSH-PICK:OK:' \+ \$dlg\.SelectedPath\)/)
  assert.ok(
    !host.DIALOG_SCRIPT.includes("[Console]::Out.Write('DSH-PICK:OK:'"),
    'the picked answer must not pass through the console encoder',
  )
  assert.deepEqual(host.parseAnswer('DSH-PICK:OK:' + cnWin), { status: 'path', windowsPath: cnWin })
  assert.deepEqual(host.parseAnswer('DSH-PICK:CANCEL'), { status: 'cancelled' })
  assert.deepEqual(host.parseAnswer('noise'), { status: 'unrecognised' })
  assert.equal(host.manualHostPath(cnWin), cnHost)
  // A decoded Chinese path is picked like any other when the host can see it …
  assert.deepEqual(
    await host.pickFolder({
      ...base,
      exists: (path) => path.includes('PowerShell/7') || path.includes('WSLInterop') || path === cnHost,
      run: (command) => Promise.resolve({
        stdout: command === 'wslpath' ? cnHost + '\n' : 'DSH-PICK:OK:' + cnWin,
        stderr: '',
      }),
    }),
    { status: 'picked', path: cnHost },
  )
  // … and a path the host cannot see stays a diagnosable "not visible" answer
  // (the client logs it before falling back) instead of a silent reset.
  assert.deepEqual(
    await host.pickFolder({
      ...base,
      run: (command) => Promise.resolve({
        stdout: command === 'wslpath' ? cnHost + '\n' : 'DSH-PICK:OK:' + cnWin,
        stderr: '',
      }),
    }),
    { status: 'unavailable', reason: 'selected-path-not-visible', detail: cnWin },
  )
  assert.match(text, /OS folder picker unavailable; falling back:/)

  // (7) Only loopback requests may open a dialog on the host's screen; other
  //     clients get `unavailable` so they fall back to the web picker.
  const respond = () => {
    const state = { status: 0, body: '' }
    return {
      state,
      res: { writeHead: (status) => { state.status = status }, end: (body) => { state.body = body } },
    }
  }
  const remote = respond()
  await host.handlerFor({ busy: { current: false } })({ method: 'POST', socket: { remoteAddress: '192.168.50.9' } }, remote.res)
  assert.equal(remote.state.status, 200)
  assert.match(remote.state.body, /"status":"unavailable"/)
  assert.match(remote.state.body, /not-loopback/)

  // A GET probe never spawns anything: it only reports capability.
  const probe = respond()
  await host.handlerFor({ busy: { current: false }, platform: 'darwin', env: {} })({ method: 'GET', socket: { remoteAddress: '127.0.0.1' } }, probe.res)
  assert.match(probe.state.body, /"available":false/)
})

test('current session highlight: 0.2 retention marker drives the WORKSPACE row (0.3.7)', () => {
  const text = read('src/client.js')

  // (1) dsh 0.2 removed SessionListState.current; the helper must read the
  //     retention counter the host marks on the summary, while still honouring
  //     the 0.1 field for older hosts.
  assert.match(text, /const currentSessionIdOf = \(list\) => \{/)
  assert.match(text, /retainedBy\.mainView \?\? 0\) > 0/)
  assert.match(text, /if \(typeof list\.current === 'string' && list\.current !== ''\) return list\.current/)

  // (2) Nothing may keep reading the field the 0.2 host no longer sends: that
  //     was the bug — every "current" check silently compared against undefined.
  assert.ok(!/list\.current === session\.id/.test(text), 'the session row must use the derived id')
  assert.ok(!/includes\(list\.current\)/.test(text), 'the workspace row must use the derived id')
  assert.match(text, /const currentSessionId = currentSessionIdOf\(list\)/)
  assert.match(text, /current: currentSessionId !== undefined && currentSessionId === session\.id/)
  assert.match(text, /currentInside: !!\(currentSessionId && \(workspace\.sessionIds \|\| \[\]\)\.includes\(currentSessionId\)\)/)

  // (3) The owning workspace row carries its own class on top of the session
  //     pill, and that class has a visible accent (not just a faint tint).
  assert.match(text, /currentInside && 'bw-ws-current'/)
  assert.match(text, /\.bw-ws-current\{box-shadow:inset 2px 0 0 var\(--dsw-alias-brand-primary/)
  assert.match(text, /\.bw-ws-current\{background:color-mix\(/)
})

/**
 * Session UI status (0.3.8). dsh 0.2 moved running / pending interaction /
 * completion unread off the session list summary into the unified status store,
 * published to slot components as the global `useSessionStatus` hook. The
 * plugin kept reading the 0.1 spellings (`useSessionPendingInteraction`, a
 * summary's `completed` flag) which the current Host does not send, so the
 * amber waiting-for-input dot, the compact waiting label and the green
 * task-completed dot silently disappeared — only the running ring survived,
 * because `summary.running` still exists.
 */
test('session status: the 0.2 unified map drives waiting and completed dots (0.3.7+)', () => {
  const text = read('src/client.js')

  // (1) The browser reads the status hook the 0.2 Host injects, keeping both
  //     0.1 hooks as fallbacks (conditional calls on stable host-provided
  //     functions, same pattern as the existing pending hook).
  assert.match(text, /useSessions, useSessionPendingInteraction, useSessionStatus, useWorkspaces,/)
  assert.match(text, /const statuses = typeof useSessionStatus === 'function' \? useSessionStatus\(s => s\) : null/)
  assert.match(text, /const pending = useSessionPendingInteraction \? useSessionPendingInteraction\(s => s\) : null/)

  // (2) Live status wins over the legacy spellings, field by field.
  assert.match(text, /const liveStatusOf = \(statuses, id\) =>/)
  assert.match(text, /const runningOf = \(live, summary\) => \(live && live\.running !== undefined/)
  assert.match(text, /pending: interactionKindOf\(live && live\.pendingInteraction\) \|\| pendingKindOf\(legacyPending, id\)/)
  assert.match(text, /completed: live \? live\.completionUnread === true : !!\(summary && summary\.completed === true\)/)

  // (3) Both session row builders take their facts from that one resolver —
  //     the two duplicated reads that went stale must be gone.
  assert.equal((text.match(/\.\.\.sessionFactsOf\(statuses, pending, id, summary\)/g) || []).length, 2,
    'both the ungrouped list and every workspace list must use the resolver')
  assert.ok(!/running: !!summary\.running/.test(text), 'the row builder must not read the summary running flag directly')
  assert.ok(!/completed: summary\.completed === true/.test(text), 'the row builder must not read a summary completed flag')
  assert.ok(!/pending: pendingKindOf\(pending, id\)/.test(text), 'the row builder must not read the 0.1 pending hook directly')

  // (4) Running subagents follow the same precedence (the ring is a second
  //     status line, not a separate truth).
  assert.match(text, /const subagentRunningCounts = \(byId, statuses\) =>/)
  assert.match(text, /if \(runningOf\(liveStatusOf\(statuses, summary\.id\), summary\)\) count \+= 1/)
  assert.match(text, /subagentRunningCounts\(list \? list\.byId : \{\}, statuses\)/)

  // (5) The trailing cell shows the compact waiting label while an interaction
  //     is pending, and the shipped dot keeps its amber state — the visible
  //     "waiting for user input" treatment.
  assert.match(text, /const PENDING_LABEL_KEYS = \{/)
  for (const kind of ['approval', 'plan-review', 'question']) {
    assert.ok(text.includes("  " + kind + ": 'status.compact.") || text.includes("'" + kind + "': 'status.compact."),
      'missing compact label for ' + kind)
  }
  assert.match(text, /trailing: state === 'warning' && PENDING_LABEL_KEYS\[node\.pending\]/)
  assert.match(text, /status && status\.trailing \? status\.trailing : timeLabel\(node\.updatedAt, now, t\)/)
  assert.match(text, /E\(ui\.StateDot, \{ state: status\.state, size: 10 \}\)/)
  assert.match(text, /\.bw-row-time\{flex:none;font-size:11px;color:var\(--dsw-alias-label-quaternary,#8a8a8a\);white-space:nowrap\}/)

  // (6) The compact labels exist in every shipped dictionary (the locale
  //     guard already enforces the key sets; this pins the three keys that
  //     carry the waiting state).
  const zhBlock = text.slice(text.indexOf('const zh = {'), text.indexOf('const en = {'))
  for (const key of ['status.compact.approval', 'status.compact.answer', 'status.compact.planReview']) {
    assert.ok(zhBlock.includes("'" + key + "':"), 'missing zh key ' + key)
  }
})
