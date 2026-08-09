import {
  CAPTIVATE_FIXTURE_LIBRARY_DEFAULT_BRANCH,
  CAPTIVATE_FIXTURE_LIBRARY_REPO_SLUG,
} from '../../shared/captivateFixtureLibraryRemote'

/**
 * Online fixture browsing without burning GitHub's anonymous API budget.
 *
 * The API allows 60 requests per hour **per IP** when unauthenticated, so listing a
 * directory per manufacturer ran out after a few dozen clicks and every later request
 * came back 403/429. Each source now loads one index up front and answers every
 * manufacturer from memory:
 *
 * | Source | API requests |
 * |--------|--------------|
 * | QLC+ | 0 — `FixturesMap.xml` off `raw.githubusercontent.com` |
 * | Open Fixture Library | 1 — one recursive git tree (plus a raw manufacturer list) |
 * | Captivate community | 1 — one recursive git tree |
 *
 * `raw.githubusercontent.com` is a CDN and is not on the API rate limit at all, so the
 * fixture downloads themselves stay free too.
 */

const GITHUB_RAW = 'https://raw.githubusercontent.com'
const GITHUB_API = 'https://api.github.com'

const QLC_REPO = 'mcallegari/qlcplus'
const QLC_BRANCH = 'master'
const QLC_FIXTURES_DIR = 'resources/fixtures'
const QLC_FIXTURES_MAP_URL = `${GITHUB_RAW}/${QLC_REPO}/${QLC_BRANCH}/${QLC_FIXTURES_DIR}/FixturesMap.xml`

const OFL_REPO = 'OpenLightingProject/open-fixture-library'
const OFL_BRANCH = 'master'
const OFL_MANUFACTURERS_URL = `${GITHUB_RAW}/${OFL_REPO}/${OFL_BRANCH}/fixtures/manufacturers.json`

export type FixtureSourceId = 'captivate' | 'qlc' | 'ofl'

export type ManufacturerOption = {
  key: string
  label: string
}

export type FixtureFile = {
  name: string
  path: string
  downloadUrl: string
}

export type FixtureLibraryIndex = {
  manufacturers: ManufacturerOption[]
  fixturesByManufacturer: { [manufacturerKey: string]: FixtureFile[] }
  /** Set when the listing is known to be incomplete, for display next to the list. */
  warning?: string
}

function rawUrl(repo: string, branch: string, path: string): string {
  const encoded = path
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  return `${GITHUB_RAW}/${repo}/${branch}/${encoded}`
}

function recursiveTreeUrl(repo: string, branch: string): string {
  return `${GITHUB_API}/repos/${repo}/git/trees/${branch}?recursive=1`
}

function rateLimitResetAt(response: Response): Date | null {
  const reset = Number(response.headers.get('x-ratelimit-reset'))
  if (!Number.isFinite(reset) || reset <= 0) return null
  return new Date(reset * 1000)
}

/** GitHub reports the anonymous cap as 429, or 403 with the budget at zero. */
function describeGitHubFailure(response: Response, sourceLabel: string): string {
  const remaining = Number(response.headers.get('x-ratelimit-remaining'))
  const rateLimited =
    response.status === 429 ||
    (response.status === 403 && Number.isFinite(remaining) && remaining <= 0)

  if (!rateLimited) {
    return `${sourceLabel} request failed (${response.status}).`
  }

  const resetAt = rateLimitResetAt(response)
  const resetText =
    resetAt === null
      ? ''
      : ` It resets at ${resetAt.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}.`
  return `GitHub's hourly limit for anonymous requests is used up.${resetText} The QLC+ library does not use that limit, so it still works in the meantime.`
}

async function fetchJson(
  url: string,
  sourceLabel: string,
  init?: RequestInit
): Promise<unknown> {
  const response = await fetch(url, init)
  if (!response.ok) {
    throw new Error(describeGitHubFailure(response, sourceLabel))
  }
  return (await response.json()) as unknown
}

async function fetchText(url: string, sourceLabel: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(describeGitHubFailure(response, sourceLabel))
  }
  return response.text()
}

type TreeEntry = { path?: unknown; type?: unknown }

async function fetchRepoFilePaths(
  repo: string,
  branch: string,
  sourceLabel: string
): Promise<{ paths: string[]; truncated: boolean }> {
  const payload = (await fetchJson(recursiveTreeUrl(repo, branch), sourceLabel, {
    headers: { Accept: 'application/vnd.github+json' },
  })) as { tree?: unknown; truncated?: unknown }

  const tree = Array.isArray(payload.tree) ? (payload.tree as TreeEntry[]) : []
  const paths: string[] = []
  for (const entry of tree) {
    if (entry.type !== 'blob' || typeof entry.path !== 'string') continue
    paths.push(entry.path)
  }
  return { paths, truncated: payload.truncated === true }
}

/**
 * Builds an index from `{dir}/{manufacturer}/{file}{extension}` paths.
 * `labelFor` turns a directory name into what the picker shows.
 */
function indexFromRepoPaths(options: {
  paths: string[]
  repo: string
  branch: string
  dir: string
  extension: string
  labelFor: (manufacturerKey: string) => string
}): {
  manufacturers: ManufacturerOption[]
  fixturesByManufacturer: { [manufacturerKey: string]: FixtureFile[] }
} {
  const prefix = `${options.dir}/`
  const fixturesByManufacturer: { [key: string]: FixtureFile[] } = {}

  for (const path of options.paths) {
    if (!path.startsWith(prefix)) continue
    if (!path.toLowerCase().endsWith(options.extension)) continue
    const segments = path.slice(prefix.length).split('/')
    if (segments.length !== 2) continue
    const [manufacturerKey, fileName] = segments
    if (manufacturerKey.length === 0 || fileName.length === 0) continue

    const files = fixturesByManufacturer[manufacturerKey] ?? []
    files.push({
      name: fileName,
      path,
      downloadUrl: rawUrl(options.repo, options.branch, path),
    })
    fixturesByManufacturer[manufacturerKey] = files
  }

  for (const files of Object.values(fixturesByManufacturer)) {
    files.sort((left, right) => left.name.localeCompare(right.name))
  }

  const manufacturers = Object.keys(fixturesByManufacturer)
    .map((key) => ({ key, label: options.labelFor(key) }))
    .sort((left, right) => left.label.localeCompare(right.label))

  return { manufacturers, fixturesByManufacturer }
}

function truncatedTreeWarning(sourceLabel: string): string {
  return `${sourceLabel} has more files than GitHub returns in one listing, so some fixtures may be missing.`
}

/** QLC+ ships a complete manufacturer/fixture index, so this needs no API call at all. */
async function loadQlcIndex(): Promise<FixtureLibraryIndex> {
  const xml = await fetchText(QLC_FIXTURES_MAP_URL, 'QLC+ fixture library')
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  if (document.querySelector('parsererror') !== null) {
    throw new Error('QLC+ fixture index could not be parsed.')
  }

  const manufacturers: ManufacturerOption[] = []
  const fixturesByManufacturer: { [key: string]: FixtureFile[] } = {}

  document.querySelectorAll('M').forEach((manufacturerNode) => {
    // DOM decodes XML entities, so names like `Beam&Spot` resolve to real paths.
    const manufacturerKey = manufacturerNode.getAttribute('n')?.trim() ?? ''
    if (manufacturerKey.length === 0) return

    const files: FixtureFile[] = []
    manufacturerNode.querySelectorAll('F').forEach((fixtureNode) => {
      const fileBase = fixtureNode.getAttribute('n')?.trim() ?? ''
      if (fileBase.length === 0) return
      const fileName = `${fileBase}.qxf`
      const path = `${QLC_FIXTURES_DIR}/${manufacturerKey}/${fileName}`
      files.push({
        name: fileName,
        path,
        downloadUrl: rawUrl(QLC_REPO, QLC_BRANCH, path),
      })
    })

    if (files.length === 0) return
    files.sort((left, right) => left.name.localeCompare(right.name))
    fixturesByManufacturer[manufacturerKey] = files
    manufacturers.push({ key: manufacturerKey, label: manufacturerKey })
  })

  manufacturers.sort((left, right) => left.label.localeCompare(right.label))
  return { manufacturers, fixturesByManufacturer }
}

async function loadOflIndex(): Promise<FixtureLibraryIndex> {
  const sourceLabel = 'Open Fixture Library'
  const [manufacturerPayload, repoFiles] = await Promise.all([
    fetchJson(OFL_MANUFACTURERS_URL, sourceLabel),
    fetchRepoFilePaths(OFL_REPO, OFL_BRANCH, sourceLabel),
  ])

  const labels = new Map<string, string>()
  const record = (manufacturerPayload ?? {}) as { [key: string]: unknown }
  for (const [key, value] of Object.entries(record)) {
    if (key === '$schema' || value === null || typeof value !== 'object') continue
    const name = (value as { name?: unknown }).name
    labels.set(
      key,
      typeof name === 'string' && name.trim().length > 0 ? name.trim() : key
    )
  }

  const index = indexFromRepoPaths({
    paths: repoFiles.paths,
    repo: OFL_REPO,
    branch: OFL_BRANCH,
    dir: 'fixtures',
    extension: '.json',
    labelFor: (key) => labels.get(key) ?? key,
  })

  return {
    ...index,
    warning: repoFiles.truncated ? truncatedTreeWarning(sourceLabel) : undefined,
  }
}

async function loadCaptivateIndex(): Promise<FixtureLibraryIndex> {
  const sourceLabel = 'Captivate Community Library'
  const repoFiles = await fetchRepoFilePaths(
    CAPTIVATE_FIXTURE_LIBRARY_REPO_SLUG,
    CAPTIVATE_FIXTURE_LIBRARY_DEFAULT_BRANCH,
    sourceLabel
  )

  const index = indexFromRepoPaths({
    paths: repoFiles.paths,
    repo: CAPTIVATE_FIXTURE_LIBRARY_REPO_SLUG,
    branch: CAPTIVATE_FIXTURE_LIBRARY_DEFAULT_BRANCH,
    dir: 'fixtures',
    extension: '.json',
    labelFor: (key) => key.replace(/-/g, ' '),
  })

  return {
    ...index,
    warning: repoFiles.truncated ? truncatedTreeWarning(sourceLabel) : undefined,
  }
}

const indexLoaders: {
  [key in FixtureSourceId]: () => Promise<FixtureLibraryIndex>
} = {
  captivate: loadCaptivateIndex,
  qlc: loadQlcIndex,
  ofl: loadOflIndex,
}

/** In-flight and settled indexes, so reopening the browser costs nothing. */
const indexCache = new Map<FixtureSourceId, Promise<FixtureLibraryIndex>>()

/** Drops the cached index so the next load refetches (the Refresh button). */
export function invalidateFixtureLibraryIndex(source: FixtureSourceId): void {
  indexCache.delete(source)
}

export function loadFixtureLibraryIndex(
  source: FixtureSourceId
): Promise<FixtureLibraryIndex> {
  const cached = indexCache.get(source)
  if (cached !== undefined) {
    return cached
  }

  const pending = indexLoaders[source]().catch((err) => {
    // Never cache a failure — a rate limit clears, and the user can retry.
    indexCache.delete(source)
    throw err
  })
  indexCache.set(source, pending)
  return pending
}
