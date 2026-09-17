/**
 * Builds the single-file deliverable and prints THE share address for it.
 *
 * The address must not move between changes: the preview pane assigns an
 * ephemeral port each time it starts, so a link built from that reads as a
 * different site after every edit. The LAN share on a fixed port is the stable
 * one, and its root path already serves nomos-standalone.html, so the address
 * carries no filename and no query string.
 *
 * Freshness is asserted rather than assumed: the served bytes are md5'd against
 * the file just written. A share server that is up but serving a previous build
 * is the failure this catches — it looks identical from the outside to one
 * serving the current build.
 *
 *   node tools/share-address.mjs          # verify and print
 *   node tools/share-address.mjs --start  # start the share server if it is down
 */
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = Number(process.env.PORT ?? 8080)
const ENTRY = 'nomos-standalone.html'

const md5 = data => createHash('md5').update(data).digest('hex')

// en0 first: Wi-Fi is the interface colleagues share. en1 covers a wired or a
// second adapter, which is what a laptop docked at a desk reports.
function lanAddress() {
  for (const iface of ['en0', 'en1']) {
    try {
      const ip = execFileSync('ipconfig', ['getifaddr', iface], { encoding: 'utf8' }).trim()
      if (ip) return { ip, iface }
    } catch {
      // interface is down; try the next one
    }
  }
  return null
}

const lan = lanAddress()
if (!lan) {
  console.error('no LAN address: en0 and en1 are both down. Connect to the network the colleagues are on.')
  process.exit(1)
}

const address = `http://${lan.ip}:${PORT}/`
const local = md5(readFileSync(join(root, ENTRY)))

async function served() {
  try {
    const res = await fetch(address, { redirect: 'manual' })
    if (!res.ok) return { state: 'error', detail: `HTTP ${res.status}` }
    return { state: 'up', hash: md5(Buffer.from(await res.arrayBuffer())) }
  } catch (error) {
    return { state: 'down', detail: error.cause?.code ?? error.message }
  }
}

let result = await served()

if (result.state === 'down' && process.argv.includes('--start')) {
  const child = spawn('node', [join(root, 'tools', 'serve-lan.mjs')], {
    cwd: root,
    env: { ...process.env, PORT: String(PORT), ENTRY },
    detached: true,
    stdio: 'ignore',
  })
  child.unref()
  for (let i = 0; i < 40 && result.state === 'down'; i++) {
    await new Promise(r => setTimeout(r, 250))
    result = await served()
  }
}

if (result.state !== 'up') {
  console.error(`${address} is not answering (${result.state}${result.detail ? `: ${result.detail}` : ''}).`)
  console.error(`  start it with:  PORT=${PORT} node tools/serve-lan.mjs`)
  console.error(`  macOS firewall set to "block all incoming connections" also produces this.`)
  process.exit(1)
}

if (result.hash !== local) {
  console.error(`${address} is serving a DIFFERENT build than ${ENTRY} on disk.`)
  console.error(`  served md5 ${result.hash}`)
  console.error(`  disk   md5 ${local}`)
  console.error('  restart the share server so it drops its copy.')
  process.exit(1)
}

console.log(address)
