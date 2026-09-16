#!/usr/bin/env node
/**
 * 组装「丝绸背景」单文件变体：nomos-silk.html
 *
 * 和 tools/build-standalone.mjs 是同一套做法 —— 把 dist/ 里的 CSS / JS 内联进
 * 一个可从磁盘直接打开的 html —— 但在末尾多追加一层样式
 * (tools/silk/skin.css)，并把背景图内联成 data URI，所以产物依然是自包含的
 * 单文件，不依赖同目录的 .png。
 *
 * 这一层只换背景，组件完全不动。
 *
 * 注意：这层皮肤现在也进了主产物（nomos-standalone.html / output/nomos-figma.html），
 * 两个脚本共用 tools/silk/load-skin.mjs，所以这里产出的字节和主产物是同一份。
 * 保留这个脚本和 nomos-silk.html 只是为了那个已经发出去的对比链接仍然可打开，
 * 不是还有一个「不带丝绸」的版本存在 —— 要改背景就改 tools/silk/skin.css，
 * 两个产物同时跟着变。
 *
 *   npm run build:silk        # vite build + 本脚本
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readSkin } from './silk/load-skin.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = join(root, 'dist')
const assetsDir = join(distDir, 'assets')

const OUT_NAME = 'nomos-silk.html'

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

// 背景图与那层皮肤全部来自 tools/silk/load-skin.mjs —— 和主产物读的是同一份
// skin.css、同一张 background.png，注释也都在那里。
const skin = readSkin(root)

// Function replacers, not strings: the bundle and the data URI are both full of
// `$&` / $` sequences that String.replace would expand, duplicating the payload.
const out = html
  .replace(MODULE_TAG, '')
  .replace(LINK_TAG, () => `\n    <style>\n${css}\n    </style>\n    <style>\n${skin.css}\n    </style>`)
  .replace(/\s*<\/body>/, () => `\n    <script>\n${js}\n    </script>\n  </body>`)

const written = join(root, OUT_NAME)
writeFileSync(written, out)

// 同一份字节放到 output/，和其他已存档的方案并排。内容完全一致，所以从磁盘
// 打开哪个文件都不可能看到不同的一代。
writeFileSync(join(root, '..', 'output', OUT_NAME), out)

console.log(`${OUT_NAME} + output/${OUT_NAME} written (${(out.length / 1024).toFixed(0)}KB, silk ${(skin.bytes / 1024).toFixed(0)}KB inlined)`)
