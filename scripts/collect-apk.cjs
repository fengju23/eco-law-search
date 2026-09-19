// 把构建好的 APK 复制到便于取用的目录（使用中文文件名）
// 用法：node scripts/collect-apk.cjs
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const outDir = path.join(root, 'apk')
fs.mkdirSync(outDir, { recursive: true })

const items = [
  {
    src: 'android/app/build/outputs/apk/release/app-release.apk',
    dst: '生态环境法典检索-v1.0.apk',
    note: 'release 正式签名版（推荐装机）',
  },
  {
    src: 'android/app/build/outputs/apk/debug/app-debug.apk',
    dst: '生态环境法典检索-v1.0-debug.apk',
    note: 'debug 调试版（含调试信息）',
  },
]

let count = 0
for (const it of items) {
  const s = path.join(root, it.src)
  if (!fs.existsSync(s)) {
    console.log(`跳过（不存在）: ${it.src}`)
    continue
  }
  const d = path.join(outDir, it.dst)
  fs.copyFileSync(s, d)
  const mb = (fs.statSync(d).size / 1024 / 1024).toFixed(2)
  console.log(`${it.dst}  ${mb}MB  ← ${it.note}`)
  count++
}

// 文档统一维护在 docs/ 下，本脚本只做复制（不再内置模板，避免覆盖手写文档）
const extraDocs = [
  { src: 'docs/使用说明书.md', dst: '使用说明书.md' },
  { src: 'docs/使用说明书.html', dst: '使用说明书.html' },
  { src: 'docs/安装说明.md', dst: '安装说明.md' },
]
let docCount = 0
for (const d of extraDocs) {
  const s = path.join(root, d.src)
  if (!fs.existsSync(s)) {
    console.log(`跳过（不存在）: ${d.src}`)
    continue
  }
  fs.copyFileSync(s, path.join(outDir, d.dst))
  console.log(`${d.dst}  ${(fs.statSync(s).size / 1024).toFixed(0)}KB  ← 文档`)
  docCount++
}
console.log(`\n共收集 ${count} 个 APK → ${outDir}`)
console.log(`文档 ${docCount} 份已同步（源文件维护在 docs/，改动后重新运行本脚本）`)
