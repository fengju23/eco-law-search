// 为移动端构建准备共用素材：全文数据与图标。
// 这些文件与 public/ 共用同一份，避免在仓库里出现重复副本。
// 由 npm run build:mobile 自动调用。
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const srcDir = path.join(root, 'public')
const dstDir = path.join(root, 'public-mobile')

const pairs = [
  ['data/law-code.json', 'data/law-code.json'],
  ['favicon.svg', 'favicon.svg'],
]

let n = 0
for (const [s, d] of pairs) {
  const from = path.join(srcDir, s)
  if (!fs.existsSync(from)) {
    console.log(`跳过（源文件不存在）: public/${s}`)
    continue
  }
  const to = path.join(dstDir, d)
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.copyFileSync(from, to)
  console.log(`public/${s}  ->  public-mobile/${d}`)
  n++
}
console.log(`移动端素材准备完成（${n} 个文件）`)
