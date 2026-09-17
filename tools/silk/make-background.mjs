// 从用户提供的原图生成灰色版用的背景图：去色 + 抬浅，输出中性的灰阶 PNG。
//
// 两步都是必需的：
//
// 1. 去色。原图不是中性的 —— 均值 (233, 233, 234)，最暗处 (197, 205, 207)，
//    偏差 10。灰色主题有条硬规则：背景必须 R = G = B 精确相等，用户为
//    #f0f0f2（偏差 2）投诉过。用亮度系数 0.2126/0.7152/0.0722 算出 L，
//    三通道全写 L，天然 R = G = B。
//
// 2. 抬浅。原图丝纹最暗处到 199，而平台的表格页文字就压在这些暗带上，
//    深色文字后面的花纹一浓就整行读不清（用户原话：这种界面的文字都看不清了）。
//    抬浅把暗部往白里推，压掉丝纹的振幅，而不是把整张图冲淡：
//      L' = L + (255 - L) * lift
//    lift 只作用在暗部，255 处不动 —— 也就是说 **它管不了本来就白的那片**。
//
// 3. 水平镜像（--flip-x）。这也是张逆光丝绸，过曝在左上：24×14 的色块量下来，
//    x<1100、y<500 那一片的标准差只有 0.5–1.2，是真平，不是「亮」。cover 铺满时
//    它几乎正好落在侧边栏右边 —— 第一眼的位置，读起来就是一块白色的半透明蒙版。
//    平区域任何滤波都救不了（减掉一块平的局部均值还是得到一块平的），只能换它
//    出现的位置：镜像把它挪到右上角，侧边栏旁边留给丝纹本身。
//
// 4. 压高光（--cap=阈值:保留比例）。镜像后右上仍有一片 253–255 的纯白，lift 也
//    压不动它（本来就贴着 255）。这一步把超过阈值的部分按比例收进去，只削白、
//    不碰灰：阈值以下一个像素都不改。
//
// apps/web 用的就是第 1/2/3/4 步：
//   node make-background.mjs <源图> <输出> 0.25 --flip-x --cap=246:0.35
// 原型自己的 background.png 只用了前两步（lift 0.5），不加开关时行为不变。
//
// 另有三个拉平开关（--flatten 按列 / --flatten-rows 按行 / --flatten2d=N 二维低频
// 场）是排查这块「白底」时加的，**最后没有采用**。它们能把过曝区的亮度拉到全图
// 均值，却拉不平它的「平」，同时把丝纹的大尺度结构一并抹掉，整页退化成一层均匀
// 灰雾 —— 那层灰雾读起来又是一块白蒙版。留着是因为「该不该用」本身要靠量出来
// 的数字判断，不代表可以顺手加回 apps/web 的配方里。
//
// 输出用 PNG 色彩类型 0（8 位灰阶）而不是画布默认的 RGBA：同样的像素，
// 文件体积大约只有四分之一，而且完全无损。
//
//   node tools/silk/make-background.mjs <in.png> <out.png> [lift=0]

import { readFileSync, writeFileSync } from 'node:fs'
import { deflateSync, inflateSync } from 'node:zlib'

const argv = process.argv.slice(2)
const flags = argv.filter((a) => a.startsWith('--'))
const [inPath, outPath, liftArg] = argv.filter((a) => !a.startsWith('--'))
const lift = liftArg === undefined ? 0 : Number(liftArg)
if (!(lift >= 0 && lift <= 1)) throw new Error(`lift must be 0..1, got ${liftArg}`)
const flatten = flags.includes('--flatten')
const flattenRows = flags.includes('--flatten-rows')
const flipX = flags.includes('--flip-x')
const flat2dArg = flags.find((f) => f.startsWith('--flatten2d'))
const flat2d = flat2dArg
  ? Number(flat2dArg.includes('=') ? flat2dArg.slice(flat2dArg.indexOf('=') + 1) : 160)
  : 0
if (flat2dArg && !(flat2d >= 8 && flat2d <= 2000)) {
  throw new Error(`--flatten2d expects a window radius 8..2000, got ${flat2dArg}`)
}
const capArg = flags.find((f) => f.startsWith('--cap='))
const cap = capArg ? capArg.slice(6).split(':').map(Number) : null
if (cap && !(cap.length === 2 && cap.every((n) => Number.isFinite(n)))) {
  throw new Error(`--cap expects --cap=<threshold>:<keep>, got ${capArg}`)
}
const buf = readFileSync(inPath)

// ── 读 PNG 块 ───────────────────────────────────────────────────────────────
const SIG = [137, 80, 78, 71, 13, 10, 26, 10]
for (let i = 0; i < 8; i++) {
  if (buf[i] !== SIG[i]) throw new Error('not a PNG')
}

let pos = 8
let ihdr = null
const idat = []
while (pos < buf.length) {
  const len = buf.readUInt32BE(pos)
  const type = buf.toString('ascii', pos + 4, pos + 8)
  const data = buf.subarray(pos + 8, pos + 8 + len)
  if (type === 'IHDR') ihdr = data
  else if (type === 'IDAT') idat.push(data)
  else if (type === 'IEND') break
  pos += 12 + len
}
if (!ihdr) throw new Error('no IHDR')

const width = ihdr.readUInt32BE(0)
const height = ihdr.readUInt32BE(4)
const bitDepth = ihdr[8]
const colorType = ihdr[9]
const interlace = ihdr[12]
if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`)
if (interlace !== 0) throw new Error('interlaced PNG not supported')
if (colorType !== 2 && colorType !== 6 && colorType !== 0) {
  throw new Error(`unsupported color type ${colorType}`)
}

const channels = colorType === 2 ? 3 : colorType === 6 ? 4 : 1
const raw = inflateSync(Buffer.concat(idat))
const stride = width * channels
const bpp = channels

// ── 反 PNG 扫描线滤波 ───────────────────────────────────────────────────────
const px = Buffer.alloc(height * stride)
const paeth = (a, b, c) => {
  const p = a + b - c
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}
for (let y = 0; y < height; y++) {
  const ft = raw[y * (stride + 1)]
  const src = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride)
  const cur = px.subarray(y * stride, (y + 1) * stride)
  const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : null
  for (let i = 0; i < stride; i++) {
    const a = i >= bpp ? cur[i - bpp] : 0
    const b = prev ? prev[i] : 0
    const c = prev && i >= bpp ? prev[i - bpp] : 0
    let v = src[i]
    if (ft === 1) v += a
    else if (ft === 2) v += b
    else if (ft === 3) v += (a + b) >> 1
    else if (ft === 4) v += paeth(a, b, c)
    cur[i] = v & 0xff
  }
}

// ── 转灰阶 + 抬浅（R = G = B = 亮度） ──────────────────────────────────────
// 取整留在抬浅这一步（而不是推到落盘前）：这是脚本最初的行为，原型的
// background.png 就是按它生成的。先取整再抬浅与全程浮点会差 1 级，动这里等于
// 让不带开关的调用不再复现原型产物 —— 后两步（拉平/压高光）都是新功能，
// 在浮点上算不影响这条路径。
const lum = new Float64Array(width * height)
for (let i = 0, n = width * height; i < n; i++) {
  const o = i * channels
  const l0 = channels === 1
    ? px[o]
    : Math.round(0.2126 * px[o] + 0.7152 * px[o + 1] + 0.0722 * px[o + 2])
  lum[i] = lift === 0 ? l0 : Math.round(l0 + (255 - l0) * lift)
}

// ── 水平镜像（--flip-x） ────────────────────────────────────────────────────
// 原图是一张逆光丝绸：光从左上来，左上角（x<1100、y<500）整片过曝，用 24x14 的
// 色块量下来标准差只有 0.5–1.2 —— 是真的平，不是「亮」。平区域任何滤波都救不了
// （减掉一块平的局部均值还是得到一块平的），只能改变它在画面里的位置。cover 铺满
// 时这张图几乎整幅可见，那片过曝就正好压在侧边栏右边（第一眼的位置）。镜像把它
// 换到右上角，侧边栏旁边留给丝纹本身。
if (flipX) {
  for (let y = 0; y < height; y++) {
    const row = y * width
    for (let x = 0; x < width >> 1; x++) {
      const a = row + x
      const b = row + width - 1 - x
      const t = lum[a]
      lum[a] = lum[b]
      lum[b] = t
    }
  }
}

// ── 拉平水平梯度（--flatten） ───────────────────────────────────────────────
// 每列减去「该列均值 − 全图均值」。列均值先做 128 列宽的滑窗，否则逐列的随机
// 起伏会被当成梯度减掉，在图上留下竖条纹。
if (flatten) {
  const colMean = new Float64Array(width)
  for (let x = 0; x < width; x++) {
    let s = 0
    for (let y = 0; y < height; y++) s += lum[y * width + x]
    colMean[x] = s / height
  }
  const globalMean = colMean.reduce((a, b) => a + b, 0) / width
  const W = 128
  const off = new Float64Array(width)
  for (let x = 0; x < width; x++) {
    let s = 0, n = 0
    for (let d = -W; d <= W; d++) {
      s += colMean[Math.min(width - 1, Math.max(0, x + d))]
      n++
    }
    off[x] = s / n - globalMean
  }
  for (let y = 0; y < height; y++) {
    const row = y * width
    for (let x = 0; x < width; x++) lum[row + x] -= off[x]
  }
}

// ── 拉平垂直梯度（--flatten-rows） ──────────────────────────────────────────
// 与 --flatten 同理，换到 y 方向。上半接近 245、下半掉到 224，铺满整页就是
// 「上面一片白、下面发灰」。窗口取 160 行 —— 比水平那个（128 列）宽，因为竖
// 向要保住的丝纹是斜向长弧，窗口太小会把弧本身当梯度减掉。
if (flattenRows) {
  const rowMean = new Float64Array(height)
  for (let y = 0; y < height; y++) {
    let s = 0
    const row = y * width
    for (let x = 0; x < width; x++) s += lum[row + x]
    rowMean[y] = s / width
  }
  const globalMean = rowMean.reduce((a, b) => a + b, 0) / height
  const W = 160
  const off = new Float64Array(height)
  for (let y = 0; y < height; y++) {
    let s = 0, n = 0
    for (let d = -W; d <= W; d++) {
      s += rowMean[Math.min(height - 1, Math.max(0, y + d))]
      n++
    }
    off[y] = s / n - globalMean
  }
  for (let y = 0; y < height; y++) {
    const row = y * width
    for (let x = 0; x < width; x++) lum[row + x] -= off[y]
  }
}

// ── 拉平二维低频场（--flatten2d=<窗口半径>） ────────────────────────────────
// 前两步只压了「整列/整行均值」这一维。图上还有一块**二维的、平的**大区域：
// 左上到顶部是一片几乎没有丝纹的浅色场（原始照片的高光），铺到页面上就是一块
// 边界柔和的「白底」—— 它未必比别处亮多少（离全图均值也就 7 级），但**它是平的**，
// 周围有丝纹、它没有，看上去就成了一层白色半透明蒙版。
//
// 这一步用可分离的均值模糊估出低频场，再把它减掉，只留高频丝纹。窗口半径要够大
// （默认 160，约 1/6 图宽），否则斜向长弧本身也会被当成低频减掉。
if (flat2d) {
  const R = flat2d
  const tmp = new Float64Array(width * height)
  const n1 = 2 * R + 1
  for (let y = 0; y < height; y++) {
    const row = y * width
    let s = 0
    for (let d = -R; d <= R; d++) s += lum[row + Math.min(width - 1, Math.max(0, d))]
    for (let x = 0; x < width; x++) {
      tmp[row + x] = s / n1
      const add = Math.min(width - 1, Math.max(0, x + R + 1))
      const sub = Math.min(width - 1, Math.max(0, x - R))
      s += lum[row + add] - lum[row + sub]
    }
  }
  const blurred = new Float64Array(width * height)
  for (let x = 0; x < width; x++) {
    let s = 0
    for (let d = -R; d <= R; d++) s += tmp[Math.min(height - 1, Math.max(0, d)) * width + x]
    for (let y = 0; y < height; y++) {
      blurred[y * width + x] = s / n1
      const add = Math.min(height - 1, Math.max(0, y + R + 1))
      const sub = Math.min(height - 1, Math.max(0, y - R))
      s += tmp[add * width + x] - tmp[sub * width + x]
    }
  }
  let globalMean = 0
  for (let i = 0; i < lum.length; i++) globalMean += lum[i]
  globalMean /= lum.length
  for (let i = 0; i < lum.length; i++) lum[i] -= blurred[i] - globalMean
}

// ── 压高光（--cap=阈值:保留比例） ───────────────────────────────────────────
// 阈值以下一个像素都不动，只把白的那部分按比例收进来。
if (cap) {
  const [threshold, keep] = cap
  for (let i = 0; i < lum.length; i++) {
    if (lum[i] > threshold) lum[i] = threshold + (lum[i] - threshold) * keep
  }
}

// ── 取整落盘 ────────────────────────────────────────────────────────────────
const gray = Buffer.alloc(width * height)
let min = 255, max = 0, sum = 0
for (let i = 0, n = width * height; i < n; i++) {
  const L = Math.max(0, Math.min(255, Math.round(lum[i])))
  gray[i] = L
  if (L < min) min = L
  if (L > max) max = L
  sum += L
}

// ── 写 8 位灰阶 PNG（色彩类型 0） ───────────────────────────────────────────
const crcTable = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
const crc32 = b => {
  let c = -1
  for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
const chunk = (type, data) => {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  const crcBuf = Buffer.concat([Buffer.from(type, 'ascii'), data])
  out.writeUInt32BE(crc32(crcBuf), 8 + data.length)
  return out
}

// 每行前置滤波字节 0（None）。灰阶图用 None 已经够，且避免引入滤波误差。
const scan = Buffer.alloc(height * (width + 1))
for (let y = 0; y < height; y++) {
  scan[y * (width + 1)] = 0
  gray.copy(scan, y * (width + 1) + 1, y * width, (y + 1) * width)
}

const ihdrOut = Buffer.alloc(13)
ihdrOut.writeUInt32BE(width, 0)
ihdrOut.writeUInt32BE(height, 4)
ihdrOut[8] = 8    // bit depth
ihdrOut[9] = 0    // color type 0 = grayscale
ihdrOut[10] = 0   // compression
ihdrOut[11] = 0   // filter
ihdrOut[12] = 0   // interlace

const png = Buffer.concat([
  Buffer.from(SIG),
  chunk('IHDR', ihdrOut),
  chunk('IDAT', deflateSync(scan, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
])
writeFileSync(outPath, png)

console.log(JSON.stringify({
  in: inPath, out: outPath,
  size: `${width}x${height}`,
  sourceColorType: colorType,
  lift,
  outBytes: png.length,
  luminance: { min, max, mean: +(sum / (width * height)).toFixed(2) },
}))
