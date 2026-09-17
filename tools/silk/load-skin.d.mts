/**
 * load-skin.mjs 的类型声明。
 *
 * `tsconfig.json` 开着 strict 且没有 allowJs，而 vite.config.ts 要 import 这个 .mjs
 * 才能和构建脚本共用同一份皮肤装配逻辑。补一份声明比在配置里放宽 allowJs 更收得拢。
 */

/** 把 skin.css 里的 __SILK__ 换成 background.png 的 data URI 之后得到的 CSS。 */
export declare function readSkin(root: string): { css: string; bytes: number }
