#!/usr/bin/env node
/**
 * Assembles ./nomos-standalone.html from the `vite build` output in ./dist.
 *
 * Two constraints shape this file:
 *  - It must be openable straight from disk, so the bundle is inlined as a
 *    classic <script>. Module scripts are rejected over file:// by CORS.
 *  - The bundle ends by calling createRoot(document.getElementById('root')), so
 *    it has to sit after <div id="root">. Putting it in <head> throws React
 *    error #299 and renders a blank page.
 *
 * 末尾还追加一层「丝绸背景」皮肤 (tools/silk/skin.css)：这一层是用户点名要的
 * 灰色主题背景图，只写 background 声明，组件一个字都不改。它原本只出现在
 * tools/build-silk.mjs 产出的对比变体里，现在主产物也带上了 —— 两个脚本读的是
 * 同一份 skin.css，所以不会漂移。
 *
 * Run via `npm run build:standalone` (which builds dist/ first).
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readSkin } from './silk/load-skin.mjs'
import { writeDeliverable } from './deliverables.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = join(root, 'dist')
const assetsDir = join(distDir, 'assets')

function readAsset(ext) {
  const name = readdirSync(assetsDir).find(n => n.endsWith(ext))
  if (!name) throw new Error(`no ${ext} found in ${assetsDir} — run \`vite build\` first`)
  return readFileSync(join(assetsDir, name), 'utf8')
}

const css = readAsset('.css')
const js = readAsset('.js').replace(/<\/script>/gi, '<\\/script>')

const html = readFileSync(join(distDir, 'index.html'), 'utf8')

const MODULE_TAG = /\s*<script type="module"[^>]*><\/script>/
const LINK_TAG = /\s*<link rel="stylesheet"[^>]*>/
if (!MODULE_TAG.test(html) || !LINK_TAG.test(html)) {
  throw new Error('dist/index.html no longer contains the expected <script type="module"> / <link rel="stylesheet"> pair')
}

// Function replacers, not strings: the bundle is full of `$&` / $` sequences that
// String.replace would expand, duplicating chunks of the payload. The skin is its
// own <style> after the bundle's CSS so it wins on equal specificity without
// needing !important.
const skin = readSkin(root)

const out = html
  .replace(MODULE_TAG, '')
  .replace(LINK_TAG, () => `\n    <style>\n${css}\n    </style>\n    <style>\n${skin.css}\n    </style>`)
  .replace(/\s*<\/body>/, () => `\n    <script>\n${js}\n    </script>\n  </body>`)

writeFileSync(join(root, 'nomos-standalone.html'), out)

// The deliverables copy that sits next to the other saved designs. Same bytes, so
// opening either file from disk can't show a different generation of the app.
writeDeliverable(root, 'nomos-figma.html', out)

console.log(`nomos-standalone.html + output/nomos-figma.html written (${(out.length / 1024).toFixed(0)}KB, silk ${(skin.bytes / 1024).toFixed(0)}KB inlined)`)
