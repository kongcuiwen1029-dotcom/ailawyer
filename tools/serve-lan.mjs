/**
 * 把构建好的单文件成品挂到局域网上，供同一网络的同事用浏览器打开。
 *
 *   PORT=8080 node tools/serve-lan.mjs
 *
 * 根路径 `/` 直接给 nomos-standalone.html，因此地址里不用带文件名；
 * 每次都从磁盘现读，重新构建后刷新页面即可看到新版本。
 */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const port = Number(process.env.PORT ?? 8080)
const entry = process.env.ENTRY ?? 'nomos-standalone.html'

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

http.createServer((request, response) => {
  const pathname = decodeURIComponent((request.url ?? '/').split('?')[0])
  const requested = pathname === '/' ? entry : pathname.replace(/^\/+/, '')
  const target = path.join(root, requested)

  if (!target.startsWith(root + path.sep) && target !== path.join(root, entry)) {
    response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' }).end('forbidden')
    return
  }

  fs.readFile(target, (error, data) => {
    if (error) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end(`not found: ${requested}`)
      return
    }
    response.writeHead(200, {
      'content-type': contentTypes[path.extname(target).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    })
    response.end(data)
  })
}).listen(port, '0.0.0.0', () => {
  console.log(`serving ${path.join(root, entry)} on http://0.0.0.0:${port}/`)
})
