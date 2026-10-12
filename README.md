# dsh-virtual-workspace

给 DeepSeek Harness Web 侧栏装一棵**真正的虚拟目录树**。

- **目录是独立记录**：可以自己创建、命名、嵌套、排序，不依赖任何真实文件夹。
- **真实工作区挂在目录下作为叶子**：把已有工作区"移入目录"即可归类，它的**标题和路径一个字节都不改**。
- 支持任意多级（`ai` → `web` → 工作区）。

> 本插件 fork 自 [dsh-better-workspace](https://github.com/KannaKuron/dsh-better-workspace)（MIT）。上游用的是**标题前缀**模型——工作区标题里的 `/` 被投影成分组；本插件把它换成了显式的目录记录，上游那套投影仍保留为回退路径。

## 与上游的关键差别

| | 上游 dsh-better-workspace | 本插件 |
|---|---|---|
| 分组的本质 | 工作区**标题**里 `/` 前面那段文字 | 独立的目录记录（`{id, name, parentId, order}`） |
| 创建一级目录 | 必须先在"添加工作区"里选一个**真实文件夹**，分组是那次操作的副作用 | 点工具栏的「新建虚拟目录」直接建，**不碰磁盘** |
| 归类已有工作区 | 右键重命名加 `ai/` 前缀 —— **会改工作区标题** | 右键「移动到目录…」——**标题不变** |
| 空目录 | 只能靠添加工作区催生 | 随时可建，空目录照常显示 |
| 目录进目录 | 不支持 | 支持（可在菜单里移动整棵子树） |
| 单子链 | 默认压缩成一行（`ai/web/前端`） | 不压缩，目录永远显示为目录 |

## 用法

**新建目录**：侧栏工具栏 →「新建虚拟目录」，输入名称即可（不需要选文件夹）。目录行右键可「新增子分组」，往下嵌套。

**归类已有工作区**：右键任意工作区 →「移动到目录…」→ 选目标目录；选「（根层级）」则移回根层。

**移动目录**：右键目录行 →「移动到目录…」，选新的父目录（不能移进自己的子孙里，会被拒绝）。

**打开工作区文件夹**（0.3.0）：右键任意**真实工作区** →「打开工作区文件夹」，由宿主（不是浏览器）用系统文件管理器打开它磁盘上的目录；同一菜单里的「复制路径」把它复制到剪贴板。虚拟目录行没有磁盘路径，因此不提供这两项。

**删除目录**：右键目录行 →「删除虚拟目录」。删除整棵子树，**里面的真实工作区会回到根层级，磁盘上的文件夹不会被删**。

## 打开文件夹是怎么实现的

浏览器不能启动进程，所以这是**宿主半侧**的功能。宿主在 `webServer` 上挂一个精确路由，客户端把工作区注册表里的 `path` POST 过去：

```
POST /_dsh/virtual-workspace/open-folder   { "path": "/mnt/e/dsh测试文件夹" }
```

平台分派与 DSH 自带的 path opener（`@deepseek-ai/dsh-native-command`）一致：

| 宿主 | 实际动作 |
|---|---|
| WSL（`linux` + WSL 标记） | `wslpath -w` 转成 `E:\…`，再交给 `powershell.exe Invoke-Item`（失败退回 `explorer.exe`） |
| Windows | `powershell.exe Invoke-Item`（失败退回 `explorer.exe`） |
| macOS | `open` |
| Linux 桌面 | `xdg-open` |

几个刻意的取舍：

- **先判 WSL 再判 linux**：WSL 里 `process.platform` 报的是 `linux`，而 `xdg-open` 在那儿打不开任何东西——只有 Windows 桌面能接这个路径。
- **路径先校验再启动**：必须是绝对路径、存在、且是目录；否则返回可读错误（例如“no such folder”），而不是弹出一个空的资源管理器窗口。中文/空格路径全程走 argv（无 shell 字符串）。
- **explorer.exe 的退出码 1 不算失败**：它把路径交给已在运行的 shell 后就是这么退的；只有 spawn 失败（ENOENT/EACCES）才上报。
- 失败时浏览器右上角弹一条红色提示，成功打开则不打扰。

> 路由是宿主启动时注册的：**改了 `src/index.js` / `src/open-folder.js` 需要重启 dsh web 服务**才会生效；只改 `src/client.js`（界面部分）刷新页面即可。

## 数据与持久化

两份数据，都不碰真实工作区：

```
directories: { [dirId]: { id, name, parentId, order } }
wsDir:       { [workspaceId]: dirId }      // 缺失 ⇒ 根层级
```

- **浏览器本地**（主）：`dsh.betterWorkspace.view.v1`
- **宿主 settings**（跨端）：`~/.dsh/settings.yaml` 的 `better-workspace` 段，以 `directoriesJson` / `wsDirJson` 两个 JSON 字符串存放。用字符串而不是 schemastery dict，是因为目录 id 是运行时生成的，dict 会永久保留历史上出现过的每个 id。

设置命名空间沿用 `better-workspace`，浏览器 store key 也沿用，因此**上游的外观自定义等偏好会直接继承**。

## 回退

设置里有 `useTree`（默认 `true`）。设为 `false` 即切回上游的标题前缀投影模型，本插件的目录数据保留不动。

## 安装

插件位于 `~/.dsh/plugins/dsh-virtual-workspace`，通过 profile 依赖接入：

```json
// profiles/web/package.json → dependencies
"dsh-virtual-workspace": "link:/home/yupeg/.dsh/plugins/dsh-virtual-workspace"
```

并在 `profiles/web/node_modules/` 下建立同名符号链接指向该目录。

> **注意**：本插件在自己目录内有 `node_modules/@deepseek-ai/{dsh-settings,schemastery,cordis}` 三个 peer 链接。少了它们，Node 无法从 `~/.dsh/plugins/` 逐级向上解析到 dsh 安装目录，宿主端 settings schema 会**静默注册失败**（浏览器侧仍能工作，但跨端持久化不会写）。

## 许可

MIT，继承上游。上游版权归 KannaKuron。
