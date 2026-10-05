# 发布与在别的终端复用

## 先说结论：官方没有开放插件市场

- **官方插件就是 npm 上的 `@deepseek-ai/dsh-*` 包**。DSH 没有类似 VS Code Marketplace
  那样的公开插件市场，也没有面向第三方的插件提交入口。
- App 里「设置 → 内置插件」看到的官方分组，是**这个部署自带的清单**（随 App 打包），
  它只反映本机装了什么，不是你可以往里投稿的目录。
- 安装能力本身是开放的：DSH 的插件管理器接受 **npm registry / 本地目录 / tarball / git**
  四类来源。所以「发布」= 把这四类来源之一交给目标机器即可，不需要官方审核。

本包已经做成 **组合包（bundle）**：`package.json` 里有 `dsh.bundle.patch` 指向
`cordis.patch.yml`，安装后 profile 会自动把计费插件插进配置树，**不需要再手改配置**。

## 四种复用方式

### 方式一：tarball（推荐，离线可用、最干净）

```bash
# ① 源机器：打包
cd ~/GitHub/DSH-Sym
npm pack                     # 得到 dsh-sym-1.5.0.tgz（约 240 KB）

# ② 把 tgz 拷到目标机器，然后安装
dsh plugin --profile desktop add ./dsh-sym-1.5.0.tgz
```

`dsh` 可执行文件在 `…/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh`，
如果不在 PATH 里就用全路径。也可以完全不碰命令行：**设置 → 插件 → 安装**，把 tgz 路径填进去。

装完重启 App（宿主插件在启动时装配）。

### 方式二：本地目录（同一台机器 / 局域网挂载）

```bash
dsh plugin --profile desktop add /path/to/dsh-sym
```

注意这是 **link** 安装：源目录不能删、不能移，否则插件失效。适合一边开发一边用。

### 方式三：git 仓库

```bash
cd ~/GitHub/DSH-Sym
git init && git add -A && git commit -m "dsh-sym 1.5.0"
git remote add origin git@github.com:<你>/dsh-sym.git && git push -u origin main

# 目标机器
dsh plugin --profile desktop add github:<你>/dsh-sym
```

### 方式四：npm（公开或私有 registry）

公开：

```bash
# 1) 改包名，避免和别人的包重名——推荐加 scope
#    package.json:  "name": "@<你的npm用户名>/dsh-sym"
#    cordis.patch.yml:  name: '@<你的npm用户名>/dsh-sym'   ← 必须同步改！
# 2) 登录并发布
npm login
npm publish --access public

# 3) 目标机器
dsh plugin --profile desktop add @<你的npm用户名>/dsh-sym
```

私有 registry（Verdaccio / 公司内网 registry 等）：DSH 支持在插件管理器配置里设
`registry` 和 `fallbackRegistries`，安装时会按顺序询问；私有 registry 不会回落到公共源。

## 版本兼容：发布前必须想清楚的一件事

DSH 安装时会用包的 `peerDependencies` / `engines` 与**运行时版本**比对，
不兼容会**拒绝启用**（包留在 node_modules 里，但启动时不加载）。

本包**零运行时依赖、不声明任何 peer**，所以对 `0.2.x` 全系通用——这是它最大的便利。
如果你以后引用了 `@deepseek-ai/dsh-llm`、`@deepseek-ai/dsh-session` 这类运行时包，
peer 版本必须与目标 DSH 完全一致（例如运行时是 `0.2.0-rc.2`，就写 `0.2.0-rc.2`，
写 `^0.2.0` 也一样会被判不兼容，因为 peer 是精确匹配语义）。

> 现成的例子：本机 profile 里的 `@deepseek-ai/dsh-computer-use@0.2.0-rc.1`、
> `dsh-experimental-computer-use-cua-driver-native@0.2.0-rc.1`、`dsh-subagent-codex@0.2.0-rc.1`
> 都因为 peer 写的是 `rc.1`、而运行时已经升到 `rc.2`，现在处于「装了但被启动拒载」的状态。
> 要么升级包，要么用 `dsh plugin allow-version` 显式豁免那个精确版本组合。

## 发布前检查清单

- [x] `dsh.bundle.patch` 指向 `cordis.patch.yml`，后者用**裸包名** insert 自己
- [x] `exports["./client"]` 指向 `lib/client.js`（浏览器侧产物，`window.__ModuleLoader__` 格式）
- [x] 零依赖：宿主侧只用 `node:fs` / `node:path` / `node:url`，浏览器侧只用平台自带的 `react`
- [x] `npm pack` 的 `files` 清单只含必要文件（19 个，约 240 KB）
- [ ] 公开前把 README 里与本机相关的路径、备份目录名清掉或通用化
- [ ] `npm pack --dry-run` 再看一眼清单
- [ ] 真正发布前想好包名（重名会被 npm 拒绝）

## 不装包的手动方式（保底）

把整个目录拷到目标机器任意位置，然后在那个 profile 的 `cordis.patch.yml` 里加：

```yaml
- insert:
    - id: session-cost
      name: '/绝对路径/dsh-sym/lib/host-v12.js'
```

这正是本机当前使用的形态（见 `~/.dsh/profiles/desktop/cordis.patch.yml`）。
好处是完全不依赖包管理器；代价是改代码要靠「停用 → 换文件名 → 启用」来热替换，
或者干脆重启 App。

## 验证安装是否成功

```bash
dsh plugin --profile desktop list          # 看依赖里有没有你的包
```

或看 App：**设置 → 插件** 里应出现 `dsh-sym`，且计费插件行处于开启状态；
会话状态栏右下角会出现两个人民币金额。
