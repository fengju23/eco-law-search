# 生态环境法典检索 · eco-law-search

把《中华人民共和国生态环境法典》**1242 条全文**装进口袋：可检索、可跳转、可朗读，**完全离线**。

一个纯前端项目，同时提供**网页版**与**Android App**。没有后端、没有账号、没有广告，检索全部在本地完成。

## 🌐 在线访问

| 方式 | 地址 | 说明 |
|------|------|------|
| 网页版（推荐先用这个） | **https://fengju23.github.io/eco-law-search/** | 推送 main 分支自动构建发布 |
| Android App 下载 | [Releases](https://github.com/fengju23/eco-law-search/releases/latest) → `eco-law-search-v1.0.apk` | 约 8.2MB，Android 7.0+ |

> ⚠️ **国内访问提示**：GitHub Pages 与 GitHub Releases 的下载走 Fastly CDN，中国大陆直连常不稳定或不通（需代理）。
> 如果面向国内用户，建议另部署一份到 Cloudflare Pages、Vercel、Netlify，或国内对象存储 + 自定义域名（国内主机需 ICP 备案）。
> 部署只需上传 `dist/` 静态文件，无需任何后端。

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![React](https://img.shields.io/badge/React-19-61dafb.svg)
![Vite](https://img.shields.io/badge/Vite-8-646cff.svg)
![Capacitor](https://img.shields.io/badge/Capacitor-8-119eff.svg)

---

## 它解决什么问题

以前查"楼下烧烤油烟归谁管"，要翻好几部法律、还要懂法条术语；现在**用日常说话的方式搜一下**，就能定位到具体条文，并且能顺着条文里的引用继续跳转。

## 功能

### 检索
- **全文检索**：1242 条 / 正文约 15.5 万字，浏览器本地建索引（约 45ms），单次检索约 0.3ms
- **查询语法**：多词 AND、`"精确短语"`、`-排除词`、`条:570`、`条:100-200`、`编:污染防治`、`章:噪声`、中文条号
- **同义词扩展**：生活用语直接可搜 —— `噪音`→噪声、`垃圾`→固体废物、`广场舞`→娱乐/健身、`双碳`→碳排放
- **相关性排序**：BM25-lite 打分 + 短语加权 + 编章标题加权 + 条号直达置顶
- **命中摘要**：定位命中位置并向两侧展开，安全转义 + 高亮；附**按编命中分布**可下钻

### 阅读
- **交叉引用可点击**：`本法第X条` 一键跳转；`《某法》` 标注"已废止"（10 部被整合的旧法）
- **相关条文推荐**：按二元组 IDF 加权重合度实时推荐
- **朗读**：优先原生 TTS（Android），回退浏览器语音合成
- **复制引用**：一键生成 `《中华人民共和国生态环境法典》第X条`
- **三套主题**（日间 / 宣纸 / 夜间）、字号可调、4 种程序合成背景音

### 组织
- 编 → 章 → 节三级目录树，搜索时显示各节点命中徽标
- 18 个"生活场景"预设，一键发起精准检索
- 收藏、检索历史本地保存
- 深链路由：`#/a/570` 直达条文、`#/q/噪声` 直达检索结果
- 快捷键：`/` 聚焦搜索、`Esc` 关闭浮层

## 技术栈

| 层 | 选型 |
|----|------|
| 前端 | React 19 + Vite 8 |
| 检索 | 自研轻量检索引擎（倒排索引 + BM25-lite），纯函数、无依赖 |
| 打包 | Capacitor 8 → Android（WebView 外壳，全离线） |
| 素材 | 全部由 Node 脚本程序化生成（手写 PNG/WAV 编码器，零外部素材） |

## 目录结构

```
src/
  search/engine.js      检索引擎：索引 / 查询解析 / 打分 / 摘要 / 交叉引用 / 相关条文（纯函数）
  search/terms.js       同义词组 · 场景预设 · 术语表 · 已废止法律清单
  components/           SearchBar / TocTree / ResultList / ArticleView / SidePanel / Home / Ambience
  hooks/                useLawCode（加载+建索引） · usePrefs（偏好与个人数据）
  App.jsx               应用外壳与哈希路由
public/
  data/law-code.json    1242 条全文（运行时 fetch，不进入 JS bundle）
public-mobile/          移动端精简素材（仅背景音，见下）
docs/                   使用说明书（面向普通用户）与安装说明
scripts/                数据提取与素材生成脚本
android/                Capacitor 生成的 Android 工程
```

## 快速开始

```bash
npm install
npm run dev        # 开发服务器，默认 http://localhost:5188
npm run build      # 生产构建（桌面/网页版）
npm test           # 检索引擎验收测试（31 项）
npm run lint       # oxlint
```

## 部署

网页版由 GitHub Actions 自动部署到 GitHub Pages（见 `.github/workflows/deploy-pages.yml`）：
推送到 `main` 即触发构建并发布，子路径为 `/eco-law-search/`。

部署后可运行冒烟测试校验线上可用性：

```bash
npm run smoke        # 校验首页 / 资源 / 数据 / 背景音 / 深链
# 国内网络需让 Node 走代理：
#   $env:HTTPS_PROXY="http://127.0.0.1:7897"; $env:NODE_USE_ENV_PROXY="1"
```

如需部署到其他平台（Cloudflare Pages / Vercel / Netlify / 对象存储），
直接上传 `dist/` 目录即可，无需后端；注意若部署在子路径下，构建时需指定 `--base=/子路径/`。

## 打包 Android App

```bash
npm run apk            # 构建 debug APK
npm run apk:release    # 构建已签名的 release APK
```

产物位于 `android/app/build/outputs/apk/`。

### 环境要求

| 组件 | 要求 |
|------|------|
| Node.js | 20+ |
| JDK | **21**（Capacitor 8 的 Android 库要求 `JavaVersion.VERSION_21`） |
| Android SDK | Platform 36 + Build-Tools 36（Android Studio 或命令行工具皆可） |
| Gradle | 由 wrapper 自动下载（8.14.3） |

构建前设置环境变量：

```bash
export JAVA_HOME=/path/to/jdk-21
export ANDROID_HOME=/path/to/android-sdk
```

```powershell
# Windows PowerShell
$env:JAVA_HOME = "C:\path\to\jdk-21"
$env:ANDROID_HOME = "C:\path\to\android-sdk"
```

> ⚠️ **项目路径必须是纯 ASCII**。AGP 会拒绝在含非 ASCII 字符的目录下构建
> （报错 `Your project path contains non-ASCII characters`），
> 中文路径下的项目请先移动到英文路径再打包。

### 签名

release 构建读取 `android/key.properties`（**不入版本库**）：

```properties
storeFile=/absolute/path/to/your.jks
storePassword=******
keyAlias=your-alias
keyPassword=******
```

生成密钥库：

```bash
keytool -genkeypair -v -keystore android/your-release.jks -alias your-alias \
  -keyalg RSA -keysize 2048 -validity 10950
```

### 应用图标

```bash
npm run gen:icon    # 生成天平衡器造型图标（5 种密度 × 3 类，程序化绘制）
```

## 体积策略：为什么仓库里没有音频

桌面版内置 48 首 60 秒环境音（约 485MB），**不适合放进 Git 仓库**，因此：

| 素材 | 桌面版 | 移动版 |
|------|--------|--------|
| 背景音 | 48 首 × 60s / 44.1kHz 立体声（485MB） | 4 首 × 30s / 22.05kHz 单声道（5MB） |
| 存放 | `public/sounds/`（**已 gitignore**） | `public-mobile/sounds/`（**已 gitignore**） |
| 重建 | `npm run gen:sound` | `npm run gen:sound:mobile` |

脚本一键重建（合成 48 首约 25 秒）：

```bash
npm run gen:sound          # 桌面版：48 首 60s 立体声
npm run gen:sound:mobile   # 移动版：4 首 30s 单声道
npm run gen:art            # 30 幅山水画（归档到 assets-archive/）
npm run gen:paper          # 30 张宣纸纹理
npm run gen:solar          # 24 幅节气画作
```

> 全部音频与图像素材均为算法合成，**无任何第三方版权素材**。

## 数据来源

- 全文 1242 条整理自公开发布文本（新华社受权播发）。
- 提取脚本：`npm run gen:law`（`scripts/extract-law.cjs`）从本地 HTML 副本解析为 `public/data/law-code.json`。
  出于版权考虑，**仓库不包含该 HTML 副本**（`scripts/law-raw.html`，已 gitignore）；
  如只需使用本项目，直接使用仓库内已生成的 JSON 即可。
- 法律、法规等官方文件不受著作权保护；本仓库对其的整理与检索实现供普法学习使用。

## 免责声明

本项目是**学习与查询工具**，非官方发布平台，不构成法律意见。
涉及实际维权、投诉、诉讼等正式场合，请以《中华人民共和国生态环境法典》**官方正式文本及有权机关的解释**为准。

噪声、油烟、恶臭、光污染等扰民问题，请拨打 **12345 / 12369**。

## 许可证

[MIT](LICENSE) © 2026 fengju23
