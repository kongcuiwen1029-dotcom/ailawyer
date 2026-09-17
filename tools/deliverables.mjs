/**
 * 把成品再存一份到「已存档方案」目录（`output/`，和 nomos-figma.html 那批并排）。
 *
 * tools/build-standalone.mjs 与 tools/build-silk.mjs 共用这一份逻辑，两个产物
 * 落到同一个存档，从磁盘打开哪个文件都不可能看到不同的一代。
 *
 * 存档目录不是写死的相对路径：这个项目原先就住在那层目录的下一级，`../output`
 * 正好指对；现在它被搬进了 monorepo 的 apps/web/references/ 下，同一段路径会
 * 落到一个不存在的地方（apps/web/references/output），构建以 ENOENT 收场。
 * 所以改成从项目根往上找第一个带 `output/` 的祖先目录，项目藏在多深都还是写回
 * 同一个存档。真的找不到就跳过并说明，而不是悄悄少写一份。
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

function deliverablesDir(root) {
  for (let dir = root; ;) {
    const parent = dirname(dir)
    if (parent === dir) return null
    const candidate = join(parent, 'output')
    if (existsSync(candidate)) return candidate
    dir = parent
  }
}

export function writeDeliverable(root, name, contents) {
  const dir = deliverablesDir(root)
  if (!dir) {
    console.warn(`no output/ archive above ${root} — ${name} kept in the project only`)
    return
  }
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, name), contents)
}
