import fs from 'node:fs'
import path from 'node:path'

const root = '/Users/iriskong/Documents/AI律师/ai-lawyer-figma-current'
const srcDir = path.join(root, 'src')

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === 'imports') return [] // raw Figma exports, dead code with Tailwind utilities
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return walk(full)
    return entry.name.endsWith('.tsx') ? [path.relative(srcDir, full)] : []
  })
}

const tsxFiles = walk(srcDir).sort()

const classTokens = new Map() // token -> Set(files)
function addToken(tok, file) {
  tok = tok.trim()
  if (!tok) return
  if (!classTokens.has(tok)) classTokens.set(tok, new Set())
  classTokens.get(tok).add(file)
}
function addSpaceSeparated(s, file) {
  s.split(/\s+/).forEach(t => t && addToken(t, file))
}

// ---- robust attribute value reader ----
function readAttrValue(text, start) {
  // text[start] should be '=' ... actually we pass index right after 'className'
  let i = start
  while (i < text.length && /\s/.test(text[i])) i++
  if (text[i] !== '=') return null
  i++
  while (i < text.length && /\s/.test(text[i])) i++
  if (text[i] === '"' || text[i] === "'") {
    const q = text[i]; i++
    let s = ''
    while (i < text.length && text[i] !== q) { s += text[i]; i++ }
    return { type: 'string', value: s, end: i + 1 }
  }
  if (text[i] === '{') {
    const startBrace = i
    let depth = 0
    let j = i
    while (j < text.length) {
      const c = text[j]
      if (c === '"' || c === "'" || c === '`') {
        // skip string/template
        const q = c; j++
        while (j < text.length && text[j] !== q) {
          if (text[j] === '\\') j++
          j++
        }
        j++
        continue
      }
      if (c === '{' || c === '(' || c === '[') { depth++; j++; continue }
      if (c === '}' || c === ')' || c === ']') {
        depth--
        if (depth === 0) { return { type: 'expr', value: text.slice(startBrace + 1, j), end: j + 1 } }
        j++; continue
      }
      j++
    }
    return { type: 'expr', value: text.slice(startBrace + 1), end: j }
  }
  return null
}

// Extract "produced" class tokens from an expression string
function tokensFromExpr(expr, file) {
  // Walk expr, find template literals and quoted strings.
  let i = 0
  while (i < expr.length) {
    const c = expr[i]
    if (c === '`') {
      // template literal: read until matching backtick handling ${}
      i++
      let staticBuf = ''
      while (i < expr.length && expr[i] !== '`') {
        if (expr[i] === '$' && expr[i + 1] === '{') {
          addSpaceSeparated(staticBuf, file); staticBuf = ''
          i += 2
          let depth = 1, buf = ''
          while (i < expr.length && depth > 0) {
            if (expr[i] === '{') depth++
            else if (expr[i] === '}') { depth--; if (depth === 0) { i++; break } }
            buf += expr[i]; i++
          }
          tokensFromExpr(buf, file) // recurse into ${...}
        } else {
          // handle escaped
          if (expr[i] === '\\') { staticBuf += expr[i + 1] ?? ''; i += 2; continue }
          staticBuf += expr[i]; i++
        }
      }
      addSpaceSeparated(staticBuf, file)
      i++ // skip closing backtick
      continue
    }
    if (c === '"' || c === "'") {
      const q = c; const qpos = i; i++
      let s = ''
      while (i < expr.length && expr[i] !== q) {
        if (expr[i] === '\\') { s += expr[i + 1] ?? ''; i += 2; continue }
        s += expr[i]; i++
      }
      i++
      // is this string a comparison operand? look immediately before opening quote
      const pre = expr.slice(0, qpos).trimEnd()
      const isComparisonOperand = /(===|!==|==|!=|<=|>=|<|>)$/.test(pre)
      if (!isComparisonOperand) addSpaceSeparated(s, file)
      continue
    }
    i++
  }
}

for (const file of tsxFiles) {
  const text = fs.readFileSync(path.join(srcDir, file), 'utf8')
  const re = /className/g
  let m
  while ((m = re.exec(text))) {
    const res = readAttrValue(text, m.index + 'className'.length)
    if (!res) continue
    if (res.type === 'string') addSpaceSeparated(res.value, file)
    else tokensFromExpr(res.value, file)
    re.lastIndex = res.end
  }
}

// ---- parse CSS ----
const css = fs.readFileSync(path.join(srcDir, 'index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const definedClasses = new Set()
const ruleRe = /([^{}]+)\{/g
let rm
while ((rm = ruleRe.exec(css))) {
  const sel = rm[1]
  const clsRe = /\.(-?[_a-zA-Z][_a-zA-Z0-9-]*)/g
  let cm
  while ((cm = clsRe.exec(sel))) definedClasses.add(cm[1])
}

const undefinedTokens = []
for (const [tok, files] of classTokens) {
  if (definedClasses.has(tok)) continue
  undefinedTokens.push({ tok, files: [...files] })
}
undefinedTokens.sort((a, b) => a.tok.localeCompare(b.tok))

console.log('=== unique class tokens: ' + classTokens.size)
console.log('\n=== defined in index.css: ' + definedClasses.size)
console.log('\n=== UNDEFINED (not in index.css):')
if (!undefinedTokens.length) console.log('(none)')
else undefinedTokens.forEach(u => console.log(`  ${u.tok}   <- ${u.files.join(', ')}`))

console.log('\n=== all tokens ===')
console.log([...classTokens.keys()].sort().join(' '))

fs.writeFileSync(path.join(root, 'tools/_class_report.json'), JSON.stringify({
  all: [...classTokens.keys()].sort(),
  defined: [...definedClasses].sort(),
  undefined: undefinedTokens,
}, null, 2))

// ---- completeness audit ----
console.log('\n=== completeness audit ===')
for (const file of tsxFiles) {
  const text = fs.readFileSync(path.join(srcDir, file), 'utf8')
  const total = (text.match(/className/g) || []).length
  let handled = 0, skipped = 0
  const re2 = /className/g
  let m2
  while ((m2 = re2.exec(text))) {
    const res = readAttrValue(text, m2.index + 'className'.length)
    if (!res) { skipped++; continue }
    handled++
    re2.lastIndex = res.end
  }
  console.log(`${file}: total=${total} handled=${handled} skipped(no-value)=${skipped}`)
}
