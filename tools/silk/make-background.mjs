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
//    lift 只作用在暗部，255 处不动，所以最亮的高光不会被削平。
//
// 输出用 PNG 色彩类型 0（8 位灰阶）而不是画布默认的 RGBA：同样的像素，
// 文件体积大约只有四分之一，而且完全无损。
//
//   node tools/silk/make-background.mjs <in.png> <out.png> [lift=0]

import { readFileSync, writeFileSync } from 'node:fs'
import { deflateSync, inflateSync } from 'node:zlib'

const [inPath, outPath, liftArg] = process.argv.slice(2)
const lift = liftArg === undefined ? 0 : Number(liftArg)
if (!(lift >= 0 && lift <= 1)) throw new Error(`lift must be 0..1, got ${liftArg}`)
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

// ── 转灰阶（R = G = B = 亮度） ──────────────────────────────────────────────
const gray = Buffer.alloc(height * width)
let min = 255, max = 0, sum = 0
for (let i = 0, n = width * height; i < n; i++) {
  const o = i * channels
  const l0 = channels === 1
    ? px[o]
    : Math.round(0.2126 * px[o] + 0.7152 * px[o + 1] + 0.0722 * px[o + 2])
  const L = lift === 0 ? l0 : Math.round(l0 + (255 - l0) * lift)
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
