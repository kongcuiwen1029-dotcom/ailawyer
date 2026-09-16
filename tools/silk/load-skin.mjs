/**
 * 把「丝绸背景」皮肤装配成可直接内联的 CSS。
 *
 * 皮肤本身是 tools/silk/skin.css，里面有一个 __SILK__ 占位符，指向背景图。
 * 这个模块负责把图读出来、转成 data URI 再把占位符替换掉 —— 产物因此是自包含的
 * 单文件，不依赖同目录的 .png。
 *
 * tools/build-standalone.mjs 与 tools/build-silk.mjs 共用这一份逻辑，两个产物
 * 引入的背景永远是同一张图、同一套规则。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SILK_MARKER = '__SILK__'

export function readSkin(root) {
  const skinPath = join(root, 'tools', 'silk', 'skin.css')
  const skin = readFileSync(skinPath, 'utf8')

  if (!skin.includes(SILK_MARKER)) {
    throw new Error(`${skinPath} no longer contains the ${SILK_MARKER} placeholder`)
  }

  // 背景是用户提供的那张丝绸图（tools/silk/background-source.png），不是程序化生成的。
  //
  // 内联的是 background.png 而不是那个源图，它是 tools/silk/make-background.mjs
  // 从源图生成的、已经去过色并抬浅的版本：
  //   - 去色，因为灰色主题要求背景 R = G = B 精确相等，而源图最暗处是 (197, 205, 207)，
  //     带明显的蓝灰偏色。输出是 8 位灰阶 PNG（色彩类型 0），单通道天然三通道相等。
  //   - 抬浅（lift 0.5，最暗处 199 → 227），因为平台的表格页正文直接落在页面背景上，
  //     丝纹暗带一浓文字就读不清。
  // 重新生成这张图：
  //   node tools/silk/make-background.mjs tools/silk/background-source.png tools/silk/background.png 0.5
  const silk = `data:image/png;base64,${readFileSync(join(root, 'tools', 'silk', 'background.png')).toString('base64')}`

  return { css: skin.split(SILK_MARKER).join(silk), bytes: silk.length }
}
