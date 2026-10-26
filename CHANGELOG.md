# Changelog — dsh-better-workspace

> 倒序排列,新版本条目在最上面。条目格式:`## vX.Y.Z — YYYY-MM-DD` + 类型(feat / fix / docs / chore)+ 要点 + 相关链接。
> 纪律见 AGENTS.md「变更记录纪律」:发版前先更新本文件并随版本提交;事故复盘、复现与真机验证记录也记在这里。

## v0.3.7 — 2026-10-22

**类型**:fix(当前对话所在的工作区不显示高亮:宿主 0.2 已删除 `SessionListState.current`)

- **用户需求**:「在工作区高亮当前正在对话的项目」。
- **根因**:插件判断「当前会话」一直读 `list.current`。dsh 0.2 的 `SessionListState` 已经没有这个字段(`ids` / `byId` / `phase` / `projectionsBySession`,见 `@deepseek-ai/dsh-api-session-controller` 的 `sessions/service.d.ts`),所以 `list.current` 恒为 `undefined`:会话行的高亮、工作区行的高亮、以及"空会话仅当前可见"的可见性规则**全部静默失效**。官方 0.2 的判定方式是摘要上的保留计数 `retainedBy.mainView > 0`。
- **修法**:新增 `currentSessionIdOf(list)` —— 0.1 宿主仍读 `list.current`,否则遍历 `byId` 找 `retainedBy.mainView > 0` 的那一行;每个渲染只算一次 `currentSessionId`,四处消费点(会话行 `current`、工作区行 `currentInside`、两处 `sessionVisible`)统一改用它。
- **视觉**:工作区行额外挂 `bw-ws-current`(会话行仍只挂 `bw-row-current` 的官方淡底)——主题活动色混合背景 + 2px 内嵌左侧强调条(品牌色)+ 图标品牌色;全部走主题 token,跟随宿主主题与主题类插件。
- **验证**:`npm test` **33/33 全绿**(新增用例钉住:helper 读 `retainedBy.mainView`、保留 0.1 字段、源码里不得再有 `list.current === session.id` / `includes(list.current)`、工作区类与 accent 样式存在)。真机:打开当前会话后 `dsh测试文件夹` 行同时带 `bw-row-current bw-ws-current`,背景为品牌色混合、左侧 2px 强调条,控制台零 error/warn。

## v0.3.6 — 2026-10-22

**类型**:feat(侧栏「添加工作区」可走 Windows 原生文件夹选择器,WSL 内可直接驱动)

- **用户的需求**:「有办法实现windows的文件夹选择器吗？不知道wsl里运行的能不能实现」。
- **先修好的环境事实**:这台机器的 WSL **Windows 互操作之前是坏的** —— `systemd=true` 让 systemd 重挂了 `binfmt_misc`,`WSLInterop` 处理器消失,从 WSL 跑任何 `.exe` 都报 `Exec format error`(顺带说明:插件原有的「打开工作区文件夹」一直因此失败)。补注册 `:WSLInterop:M::MZ::/init:PF` 后恢复。
- **可行性已实测**:`user=yupeg`、`SessionId=1`、`UserInteractive=True`(console 活动会话);`pwsh 7.6.7` / `.NET 10`;`System.Windows.Forms.FolderBrowserDialog` + `-STA` 可用;真实模态框能弹出并正确返回结果(测试时自动关闭,`ShowDialog` 返回 `Cancel`);`wslpath -u 'D:\Downloads'` → `/mnt/d/Downloads`。
- **新增宿主模块 `src/pick-folder.js`**(挂在 `/_dsh/virtual-workspace/pick-folder`):
  - `GET` = 能力探测(绝不弹窗);`POST` = 弹出对话框,返回 `{status: picked|cancelled|unavailable, path?, reason?}`。
  - 脚本是**常量**,不接受任何请求数据 → 没有注入面;`-NoProfile -NonInteractive -STA`,TopMost 无主窗体保证对话框浮在浏览器上面;stdout 用 `DSH-PICK:OK:` / `DSH-PICK:CANCEL` 标记解析。
  - **interop 自愈**:`/proc/sys/fs/binfmt_misc/WSLInterop` 缺失时用免密 `sudo -n` 补注册;没有 sudo 就报 `windows-interop-disabled` 回退,不报错。
  - **只服务回环请求**:非回环一律 `unavailable/not-loopback`,避免对话框弹在没人看着的服务器桌面上。
  - 路径转换 `wslpath -u` 优先,失败退回纯 JS 的盘符映射;选中的必须是**存在且是目录**。
  - 同一时刻只允许一个对话框(`busy` 标志),超时 5 分钟(超时按取消处理)。
- **客户端**:`AddWorkspaceFlow` 的优先顺序改为 **OS 对话框 → 宿主 native 后端 → vendored 官方 web 浏览器**;路由缺失(宿主半侧是旧版)或非 WSL 时静默回退,不影响现有体验。
- **验证**:`npm test` **32/32 全绿**(新增一条:路由常量两半一致、脚本含 `FolderBrowserDialog`/标记、`-STA`、盘符转换、非 WSL/无 PowerShell/无 sudo/取消/选中/非回环六种分支);真机跑生产路径 `pickFolder({timeoutMs:4000})` → 对话框出现、4s 后被杀,返回 `{"status":"cancelled","reason":"timeout"}`(4015ms)。
- **注意**:宿主路由在 `dsh web` 启动时挂载,**需要重启一次 dsh web 才生效**。

## v0.3.5 — 2026-10-22

**类型**:feat(侧栏新增工作区入口 + 直接复用官方目录选择器组件)

- **用户的要求与质疑**:「不好，还是在创建虚拟目录旁边有个更好」,随后追问「dsh是开源的，为什么你说没有开源api？」。第二问是对的:0.3.4 的结论「只能自绘」只针对**运行时 API**,漏掉了开源代码本身可复用。
- **重新查证(开源侧)**:`@deepseek-ai/dsh-client-ui-directory-picker-browse` 是 **MIT**(Copyright (c) 2026 DeepSeek);它的 `./client` 只导出 `apply`/`inject`,组件本体不在导出面,但**整份转译代码随包分发**。所以正确做法是**vendor 官方组件**,而不是重写一个像它的。
- **实现**:
  - 把官方 `DirectoryBrowser`(含其 CSS 模块、Miller 两列、状态/错误行、新建文件夹子对话框)原样 vendor 进 `src/client.js`,只替换三处:模块内的 `require` 垫片 → 本插件已绑定的 `React` / `ui` / `cls`;CSS 前缀 `ZuhsRW_` → `bwdb_`(避免与同页加载的官方插件样式互踩);内置 clsx 垫片删除(用本插件 `cls`)。
  - 新增 `AddWorkspaceFlow`:先探测宿主后端——`native` 走系统选择器,`browse` 渲染上面这份官方组件;选完目录后若是虚拟模型,再弹「所属虚拟目录」选择,确认时 `createWorkspace` + `wsAssign` + 展开目录,**标题与路径仍由宿主决定、绝不改写**;`useTree:false` 回退路径保留旧的前缀行为。
  - 入口放在「新建虚拟目录」旁边:展开态工具栏与 rail 收起态各一个按钮;虚拟目录行右键恢复「新增子工作区」(带上该目录预选)。
  - 官组件的文案走它自己的 namespace(`browser.*`),用一张映射表转成本插件已有的 21 门词典键(`browse.*`),不重复注册语言。
- **两个 picker 的关系**:hero 菜单仍然用宿主自己的官方 picker(插件不占 `directoryFlow` 洞);侧栏按钮用同一份官方组件,分叉只在「谁当 owner」——这正是宿主契约里 owner 与 occupant 的分工。
- **验证**:`npm test` **31/31 全绿**(替换掉 0.3.4 的「不得有 picker」用例,新增一条钉住:入口在工具栏/rail、vendored 组件与 `bwdb_` 前缀、`ZuhsRW_` 不得出现、flow 用 `pickTranslator` 驱动、虚拟分支只 `wsAssign` 不 `renameWorkspace`、两个 directoryFlow 洞仍不占)。真机:侧栏三个按钮(sort/add/folder),点 add 弹出**与 hero 完全相同的 680×500 官方浏览器**,选目录后出现「所属虚拟目录」步骤,取消/确认路径正常,控制台零 error/warn。

## v0.3.4 — 2026-10-22

**类型**:fix(目录选择彻底交还宿主:删掉插件自己的添加工作区入口与整套自绘选择器)

- **用户的决策**:「用官方的」。0.3.3 只把两个 `directoryFlow` 洞还给了宿主，侧栏工具栏那颗「添加工作区」按钮仍是插件自绘 —— 用户刷新后点的正是它，所以看到的仍是 380×470 那个「不全」的弹窗。核实过三条替代路都不通:`uiWorkspace` 只有 picker 动词（pick / list / 建子目录），没有「打开宿主添加流程」的 API；slot 的 `children` 不能重复声明同一个 key（直接抛 `slot "…" is already declared`）；宿主 `workspace.add` 快捷键（Ctrl+Alt+O）的 `controls.add` 指向被本插件替换掉的官方侧栏浏览器内部 state，触发了也没有 UI。**只要入口在插件自己的界面上，就只能自带选择 UI** —— 于是按要求把入口一并去掉。
- **删掉的**:侧栏「添加工作区」按钮（展开态与 rail 收起态各一个）、虚拟目录行/旧式前缀行右键的「新增子工作区」、`BetterFlow`、`DirectoryBrowseDialog`（含盘符探测）、目录选择器能力探测（`pickerState` / `pickerCapabilityNow` / `pickerRefusal` / `markPickerBrowse`）、`browserInjected` 里的 `createWorkspace` / `pickDirectory` / `listDirectory` / `createDirectory` 与 `directoryFlow` hook、35 条 `.bw-browse*` / `.bw-select` / `.bw-path-echo` CSS，以及随之失效的 25 个词典键 × 21 门（`flow.*`、`browse.*`、`add`、`create`、`rail.add`、`menu.newSubWorkspace`，共 525 行）。
- **一行没动的**:虚拟目录的创建（工具栏「新建虚拟目录」+ 目录行「新增子分组」）、重命名/删除/拖动排序/移入目录、工作区行的重命名 / 打开工作区文件夹 / 复制路径 / **移动到目录…**（含「（根层级）」）/ 删除 / 自定义外观、会话行与会话分组行的全部右键项、全部拖拽 —— 归类工作区的能力完整保留，且「移动到目录…」本来就不改标题。
- **新的路径**:建项目走对话空态的官方 picker（`Add workspace…`，680×500），建完落在根层级，再右键「移动到目录…」归类。
- **验证**:`npm test` **31/31 全绿**（删掉 3 条针对已删代码的用例，新增 1 条钉住这次交接：插件不得再出现任何自绘选择器/添加工作区入口/新增工作区菜单项、注入面不得再有 picker 动词、`flow.*`/`browse.*` 词典键必须清零；同时断言「移动到目录…」、打开文件夹、复制路径、目录增删仍在）。真机（web profile，browse 后端，刷新即生效）：侧栏工具栏只剩搜索与「新建虚拟目录」，rail 收起态同样；右键菜单项与拖拽全部正常；hero 的「Add workspace…」是官方 680×500 弹窗；控制台零 error/warn。

## v0.3.3 — 2026-10-22

**类型**:fix(目录选择弹窗交还宿主:插件不再自绘那个 380×470 的「不全」对话框)

- **用户的实测反馈**:「选择工作区目录的功能被这个插件修改过吗？目前感觉弹窗UI显示的不够完整」。核实:**是**。插件把 `conversation.hero.workspace.directoryFlow` 与 `sidebar.workspaces.directoryFlow` 两个洞都以 `priority: -1` 覆盖了（官方 `@deepseek-ai/dsh-client-ui-directory-picker-browse` 其实一直在 boot graph 里），本机又是 `browse` 后端（127.0.0.1 + 非 SSH + linux 但 PATH 无 zenity/kdialog），于是看到的是插件手写的 `DirectoryBrowseDialog`。实测对比:**官方 680×500**（`min(680px,100%)` / `min(500px,100dvh-32px)`、28px 行、文件夹图标 + 行尾 `›`、进目录多列、底栏 + New folder/Show hidden files + Cancel/Open、status/error 行、新建文件夹独立子对话框）；**插件 380×470**（正文 390、列表固定 240 高带边框、工具三连按钮、无状态行）——宽度只有官方的 56%，观感就像半成品。
- **改法:两个 directoryFlow 洞一律还给宿主。** 删掉两处 `slots.inject(...)` 与只为它们存在的 `flowInjected`；hero 菜单的「Add workspace…」现在走官方 picker，工作区由宿主自己创建（落在根层级）。**虚拟目录这一步保留在插件自己的面上**:侧栏工具栏的添加按钮、以及目录行右键的「新增子工作区」走内联 `BetterFlow` —— 宿主只暴露 picker 的**动词**（pick/list/createDirectory），没有「打开官方添加流程」的 API，所以一个必须再追问目录的入口只能自带选择 UI。
- **代价（明说）**:hero 那条路不再能在创建时选虚拟目录；新项目先落到根层级，再右键「移动到目录…」归类（该能力 0.3.0 就有，不改标题）。若要「创建即归类」，只能从侧栏添加按钮或目录行右键发起。
- **验证**（真机,已还原临时的 priority 实验）:把两处 `priority` 临时抬到 `+1` 让官方组件渲染并截图取证（680×500,标题 `Select Workspace Directory`,底栏 `+ New folder / Show hidden files / Cancel / Open`）——该实验已回滚,工作区未创建。改完后 hero 入口直接就是官方弹窗、侧栏按钮仍是插件弹窗、控制台零 error/warn。
- **冒烟测试 33 项全绿**:slot 用例改为「只允许 `settings.plugin.item` 与 `sidebar.workspaces` 两处 inject,两个 directoryFlow 必须一个都不占」；picker 用例的注入计数 2 → 1，并注明宿主自家 flow 不再注入。

## v0.3.2 — 2026-10-22

**类型**:fix(引入新项目时,「所属分组」看不到已有的虚拟目录,新项目也进不去)

- **用户的实测反馈**:「当我引入一个新的项目的时候,选择虚拟工作区看不到现有的工作区」。
- **根因:0.3 的虚拟目录模型只改到了树和菜单,漏掉了「添加工作区」这条流程。** `BetterFlow` 仍是 0.11 那套**标题前缀**实现:候选分组 `folderOptions` 只由旧的 `folders` 列表 + 工作区标题里的 `/` 拼出来,**从不读 `state.directories`**;`confirm()` 也只是把新工作区**改名**成 `前缀/名字` 并顺手 `addFolder(前缀)`,而虚拟模型里目录是一条独立记录、真正需要写的是 `wsDir[workspaceId] = dirId`。于是:目录行里明明有目录,流程里却一个都选不到(真机实测:输入框的 datalist **只有 1 条**,来自一个带 `/` 的老标题;点开输入框浏览器也不弹任何提示);即便手打目录名,建出来的也是同名**旧式前缀分组**,新项目还落在根层级 —— 看起来就像"引入的项目不见了"。
- **第二个缺口**:两个 `directoryFlow` 座位(`conversation.hero.workspace.directoryFlow` / `sidebar.workspaces.directoryFlow`)注册时**没有传 `store`**,宿主渲染器因此不绑 `useStore`/`actions`。就算流程代码会读目录,从对话空态「Choose workspace → Add workspace…」进去时读到的也是空表 —— 必须把 `viewStore` 的创建提前到注册之前,并把同一个 handle 传给这两处(与 `sidebar.workspaces`、设置卡片共享,仍是**一个** handle)。
- **修法**:虚拟模型下「所属分组」改成**可见的 `<select>`**:`(根层级)` + 深度优先的全部目录(按 `dirPathOf` 显示完整路径,值用稳定的目录 id);确认时走新的 `confirmVirtual()` —— `createWorkspace` 之后只写 `shared.wsAssign(workspaceId, dirId)` 并展开目标目录,**绝不碰标题、不建旧式分组**。`useTree:false` 的回退路径保留原样(`confirmLegacy()`,标题前缀 + `addFolder`)。虚拟目录行右键新增「新增子工作区」,从该目录直接发起引入流程(目录已预选)。新增 2 个词典键(`flow.parentDir` / `flow.parentDirHint`)× 21 门语言。
- **真机实录**(web profile,browse 后端,headless Chrome over CDP;测完删掉工作区登记、临时目录与临时虚拟目录,`workspace.json` 无残留):新建目录「验证目录」→「添加工作区」→ 选 `/tmp/dvw-verify-project` → 弹窗出现 `Parent virtual directory`,下拉里正是 `(root level)` + `验证目录` → 选它 → 创建:侧栏「验证目录」下出现子行 `dvw-verify-project`,`wsDir` 写入、`folders` 保持 `[]`、宿主登记仍是 `{"path":"/tmp/dvw-verify-project","title":"dvw-verify-project"}`(标题未被改写);`useTree:false` 时同一入口仍是旧输入框 + datalist(未回归);对话空态的同一流程也列得出该目录;控制台零 error/warn。
- **冒烟测试 32 → 33 项**:新增用例钉住五件事——`dirOptions` 必须走 `childDirsOf`/`dirPathOf`、虚拟模型必须渲染 `<select>`、`confirmVirtual` 必须 `wsAssign` 且**不得**出现 `renameWorkspace`/`addFolder`、回退分支仍在、两个 slot 必须带 `store: viewStore` 且 store 先于注册创建。

## v0.3.1 — 2026-10-14

**类型**:fix(全套图标静默失效:侧栏工作区三个按钮看不见、也悬停不出提示)

- **用户的实测反馈**:「工作区有是有,但是目前是看不到的,我知道这 3 个块存在,但是他们没有特殊标记,并且鼠标悬浮上去看不到提示」。三个热区确实存在、也能点,但**里面是空的**——不含任何 SVG,所以既看不见图形,也没有可悬停的实体。
- **根因:dsh 0.2.0-rc.2 把整套图标改名了。** 旧世代 `Icon<Name>Outline<边长>`(`IconSearchOutline16` 一类)在 0.2 被换成 `Icon<Name>Outline<字重>`(`IconSearchOutlineRegular` 等 79 个);当前 primitives bundle 里 `Outline16` 这个名字形态**出现 0 次**,也没有兼容层。本插件 `src/client.js` 当时引用的 **75 个图标名在新集合里全部不存在**,而 `icon()` 对未知名字的既定降级是「返回 null,绝不抛错」——于是每一处图标都静静地变成了空按钮。这不是布局或主题问题:计算样式是 `opacity:1 / visibility:visible / display:grid`,只是里面什么都没有。
- **修法一(图标,治本)**:把**调用点**的图标名直接改成新集合里真实存在的名字(73 种;`Outline<px>` → `Outline<字重>` 保持每个字形的语义不变),另把 `ICON_ALIASES` 从 1 条扩成 **74 条**——它现在的职责是**兼容层**:用户持久化过的旧图标偏好(设置里的自定义图标是存名字的)仍能沿别名链落到在售字形,而不是渲染成空格子。四个旧世代 fill 变体在新集合里没有 `Outline<px>` 兄弟,按字重形态落地:`IconFolderClose16` → `IconFolderCloseRegular`、`IconSparkle16` → `IconSparkleRegular`、`IconStopFill16` → `IconStopFillRegular`、`IconTriangleRightFill14` → `IconTriangleRightFillRegular`。`icon()` 改为先过 `resolveIconName` 再取组件,别名表才真正对渲染生效(此前只有自定义图标选择器查它)。
- **修法二(提示)**:新增 `withTip(child, label)`,用**宿主 Tooltip** 包住纯图标按钮(官方侧栏的做法)。宿主 Tooltip 是 `cloneElement`,只挂 ref 与鼠标/焦点处理器,**不额外产生 DOM**,按钮的布局盒子不变;没有 Tooltip 的老宿主退回原生 `title`。已接入:侧栏工具栏 3 个(搜索 / 添加工作区 / 新建虚拟目录)、rail 收起态 3 个、工作区行内联「新会话」。此前全插件 `title=` 按钮 0 处、`aria-label=` 17 处——`aria-label` 只服务读屏器,**鼠标悬浮什么都不会显示**。
- **真机实录**(本实例 web profile,1600×900 与 <1024px 两种布局,刷新页面即生效):修复前 `.bw-header` 三个按钮 `svgPresent:false / pathCount:0`;修复后 `svg:true / width=16 / pathCount 2~3`,全页 19 个 `.bw-icon-btn`/`.bw-rail-btn` **零空按钮**。悬浮「添加工作区」弹出 `role="tooltip"` 气泡,`label` 为「添加工作区」,`side=bottom`(展开态 y=246、rail 态 y=302 均实测可见);rail 态三个 36×36 图标按钮同样有图形 + 气泡。控制台零 error/warn。
- **冒烟测试 31 → 32 项**:原 0.10.2 图标用例的切片锚点改到 `withTip` 之前(工具提示属宿主管线,不在纯解析契约内),断言升级到新世代名字;新增一项 `icons: every named glyph exists in the host set after the 0.2.0 rename`,直接读**宿主 primitives bundle**,钉死三件事——`icon()` 点名的每个字形都真实存在、源文件里引用的每个字形都在售(字体名 `Icona` 除外)、别名表里每条「退役名 → 在售名」的落点都真实存在;当环境里没有 dsh 时该用例自动跳过而不是误报。这条测试的意义在于:**下次宿主再改图标名,会是测试红,而不是侧栏悄悄变空**。
- 相关:上游图标集来自 `@deepseek-ai/dsh-client-ui-primitives`(0.2.0-rc.2,79 个 `Outline<字重>` 字形)。

## v0.11.4 — 2026-09-16

**类型**:fix(应用内目录浏览器的可用性:路径、盘符、选文件夹)

- **用户的实测反馈**:0.11.3 的 browse 对话框「不方便选文件夹,不方便看当前文件夹路径,不方便选盘符」。三条都成立——那一版的面包屑按官方对话框的做法**以 Home 为根**,于是看不到自己在哪;整行单击即进入,想选子文件夹必须先钻进去再点按钮;Windows 的多盘更是**完全没有入口**(browse API 只有 list/createDirectory)。
- **面包屑改为从文件系统根开始**(\C:\ → Users → kanna → Desktop),当前层是纯文本、其余可点;深路径自动贴右端(scrollLeft = scrollWidth),保证「我在哪」这一段始终可见;新增**「主目录」**按钮一键回 home。
- **Windows 盘符**:browse API 只能列路径、没有枚举磁盘的接口,因此在首次打开时**探测 C:–H:**(六次廉价列举,不存在的盘静默失败),把应答的盘做成右侧 chips 并按页缓存(模块级 browseDrives)。当前盘高亮;探测不到的盘仍可用路径编辑手输——那才是通用兜底。
- **选文件夹不再需要「钻进去再选」**:行改为单击**选中**(高亮 + 蓝框)、双击或行尾 › 进入(触摸必须有 chevron,双击不是手势),底部主按钮随选中变为 **「选择「AppData」」**;无选中时仍是「选择此文件夹」= 当前层。新建文件夹后自动选中刚建的那个目录。行支持 Enter 进入 / 空格选中。
- 新增 3 个词典键 × 21 门语言:browse.enter / browse.drives / browse.selectNamed(后者的 {name} 走宿主 locale 座位既有的参数形式 t(key, { name }))。
- **真机实录**(隔离 DSH_HOME + webserver 0.0.0.0 + headless Chrome over CDP):打开即显示「↑ C:\ Users kanna」面包屑与 C: D: E: F: 盘符条(本机四块盘全部探到);单击 AppData → 行高亮、底部按钮变「选择「AppData」」;点 D: → 面包屑变 D:\、列表切到 D 盘内容;点「主目录」→ 回到 C:\Users\kanna;全程零异常、零 console 错误。
- 冒烟测试 21 → **22 项**:新增一条钉住这次的三处交互契约(面包屑不再以 Home 为根、行选中而非直接进入、盘符探测与按页缓存、主按钮随选中变化、三个新键齐备、深路径贴右)。

## v0.11.3 — 2026-09-16

**类型**:fix(webserver 非 loopback 绑定时「添加工作区」必然失败)

- **根因:把「宿主一定组装 native 目录选择器」当成前提。** 宿主侧的 `@deepseek-ai/dsh-host-directory-picker-auto` 只在 `bindHost === '127.0.0.1'`、非 SSH 启动、且平台有可用显示会话时才组装 `native`;其余一切绑定(含 `0.0.0.0`、局域网、SSH 端口转发、无头)一律组装 `browse`——它的 wire 动词**只有** `list` / `createDirectory`,`pick` 被 `DirectoryPickerController.requireCapability('native','pick')` 明确拒绝为 `directory-picker/unavailable`。本插件两个 `directoryFlow` 洞以 `priority: -1` 压过官方 `browse` 占位者(该 profile 下 boot graph 里只有 `dsh-client-ui-directory-picker-browse`),而 BetterFlow 无条件 `pickDirectory()` → 客户端走原生流程、宿主只服务 browse,于是**必然**报错、一个工作区也加不上。**本机 web profile 的 webserver 正是 `host: '0.0.0.0'`**,所以从桌面浏览器走 loopback 访问同样中招——这不是手机/远程独有。
- **修法:先探测宿主组装的后端,再决定交互。** 新增 `pickerState` 与 `pickerCapabilityNow()`:用 `list`(只有 browse 后端会成功)做一次性探测,`native` 侧以能力码拒绝即判定 `native`;无法归类的失败(连接尚未就绪)**不缓存**,下次打开重探并照旧尝试 `pick`;`pickerRefusal()` 同时认「能力码」与「宿主那句固定文案」两种形状,`markPickerBrowse()` 供「pick 被拒」这条硬路径回写判定。判定结果同时决定两处入口(两个 `directoryFlow` 洞 + 侧栏内联流,二者共用同一状态)。
- **browse 后端下改用应用内目录浏览器(`DirectoryBrowseDialog`)**:Home 起点的可点面包屑链、可编辑路径、行内新建文件夹、隐藏文件开关、截断提示;一行 = 进入该目录,底部「选择此文件夹」= 采用当前层。浏览失败(例如 Windows 上 `「开始」菜单` 这类 junction 报 `EPERM`)**留在对话框内**显示,既不关闭流程、也不占用 owner 的 `onError`。选定目录后**照旧弹「所属分组」**,功能一点没少。
- 宿主组装的是未知 kind 时不猜测:直接把宿主的拒绝交给 owner 的错误面(与官方「未知 kind 默认隐藏 picking 交互」的取向一致)。
- **顺带修掉的窄对话框布局**:浏览工具(显示隐藏文件 / 新建文件夹)移到列表上方独立一行,footer 只留「取消 / 选择此文件夹」——0.11.2 的四个按钮在 460px 宽里会挤成两行。
- **A/B 真机实录**(隔离 DSH_HOME、同一台机器、webserver `0.0.0.0`、headless Chrome over CDP,全程不碰用户正在跑的实例):
  - 对照组 `dsh-better-workspace@0.11.2`:点「添加工作区」→ 错误弹窗逐字复现上报文案 `directory picker failed: directoryPicker.pick needs the native capability; the composed picker serves "browse"`,应用内浏览器不存在;
  - 修复版 `0.11.3`:同一操作 → 应用内浏览器列出宿主主目录 → 进入 `Desktop` → 「选择此文件夹」→ 「所属分组」弹窗(填入 `web/验证`)→ 「创建」→ 侧栏树出现 **`web/验证/Desktop`**,控制台零错误、零异常。
- 冒烟测试 20 → **21 项**:新增一项直接驱动 capability 模块的四个分支(browse 判定与缓存、native 判定、未归类失败不缓存且可被硬路径改写、拒绝分类的两侧形状),并断言两处入口都注入了 browse 原语、流程确实查询探测结果。
- 文档:README 双语补上「用哪种选择器跟随宿主实际组装的后端」一段,并写明想强行走原生选择器的代价(LAN 客户端点不到、弹在服务器桌面)。

- 相关:[Release v0.11.3](https://github.com/KannaKuron/dsh-better-workspace/releases/tag/v0.11.3) · [上游讨论 deepseek-harness#6785](https://github.com/deepseek-ai/deepseek-harness/discussions/6785)(客户端拿不到 capability 的缺口已上报)

## v0.11.2 — 2026-09-15

**类型**:fix(回退 0.11.1 的描边实现)

- **0.11.1 的描边方向是错的,改回几何描边**。那一版把描边换成「八向偏移的字形拷贝」,依据是偏移落在整数设备像素上、实测「达到所选颜色的描边像素占比」从 0.19 升到 0.69。**指标变好了,观感变差了**:八个方向本质上只有四个斜向采样点,于是**每一条斜边、每一段曲线上的描边都碎成一串断开的方块**——字母 A / W / x 的斜线、中文「深」「远」的撇捺最明显,用户的原话是「碎碎的,填充的不好」。几何描边是真实的路径描边,轮廓**天然连续**,这是它不可替代的地方;它唯一的问题是太细时被抗锯齿稀释掉。
- **真正的修法:给几何描边足够的宽度**。`paint-order: stroke fill` 会把带宽的内侧一半盖掉,所以**绘制宽度必须是滑条承诺的两倍**——0.10.x 直接画配置值,留下的那 0.5px 外沿正是被稀释掉的一圈。现在 `WebkitTextStrokeWidth = 配置值 × 2`:滑条 1px 就是屏幕上 1px 的边,连续、饱满、不碎。滑条范围随之从 0.5–4 收敛到 **0.5–2**(对应可见 0.5–2px),默认仍是 1(可见 1px,比 0.10.x 明显、比 0.11.1 干净)。**嫌粗就滑到 0.5**,那正是 0.10.x 的观感。
- **0.11.1 引入的连带机制全部撤销**:描边不再经过 text-shadow,`--bw-stroke-shadow` / `--bw-glow-shadow` / `--bw-text-glow` 三个变量删除,呼吸灯 keyframes、11px 元信息列的 `-webkit-text-stroke-width:0`、以及「有光晕才让文字呼吸」的判据都回到 0.10.1 的写法——它们本来只是为了绕开 text-shadow 的整体替换语义,几何描边路线不需要。
- 保留 0.11.1 唯一站得住的部分:`.bw-row-label` 与 `.bw-preview-label` 的 3px 留白余量(覆盖滑条最大档的外扩)。
- **方法论教训**:「达到纯描边色的像素占比」是个会骗人的指标——它奖励「实」,而「实」可以用离散采样硬凑出来,代价是轮廓断裂。评估描边必须看**轮廓的连续性**,而连续性只有在放大到能看清斜边与曲线时才暴露;只测直线段、或只看统计量,都会得出错误结论。0.11.1 的验证记录因此也一并作废。
- 冒烟测试 20 项全绿:断言回到 `strokeStyleOf`,新增「绘制宽度 = 配置 ×2」与「必须仍是几何描边(不得再出现 STROKE_DIRECTIONS / strokeShadowsOf)」两条。

## v0.11.1 — 2026-09-15

**类型**:fix

- **字体描边不再"锯齿"**:描边从 `-webkit-text-stroke` 换成**八向偏移的字形拷贝**(text-shadow)。原实现是**几何描边**——带宽以字形轮廓为中心,`paint-order: stroke fill` 又把内侧一半盖掉,只剩约 0.5 CSS px 的外沿;而字形轮廓很少正好落在设备像素网格上,光栅器便把这半个像素摊到两三个像素上,描边于是**永远到不了自己选的颜色**,看上去又淡又毛——这就是"锯齿"的真正来源。改成偏移拷贝后,偏移量落在**整数设备像素**上(2x 下 0.5px 正好一个设备像素),描边是实心的:同一行文字在 2x 下实测「达到所选颜色的描边像素占比」从 **0.19 → 0.69**,而涂色面积只涨约 10%——**粗细不变,只是不再被稀释**。1x 屏同样改善(0.22 → 0.53),描边在非 Retina 上从"几乎看不见"变成看得见。
- **偏移量 = 粗细的一半,且不低于一个设备像素**:`strokeOffsetOf` 取 `max(width / 2, 1 / devicePixelRatio)`,所以既有配置的观感粗细不变(1px 设置仍是原来的宽度),而滑到最细一档也不会退化成一片模糊。
- **四处联动改写**:描边既走 text-shadow,(a) 行上额外发布 `--bw-stroke-shadow`(逗号结尾),呼吸灯的 keyframes 用 `var(--bw-stroke-shadow,)` 把描边带进动画——描边行呼吸时不再丢描边,空回退保证关描边的行呼吸行为与从前逐帧一致;(b) 11px 元信息列改为 `text-shadow: var(--bw-glow-shadow, none)`,继续只享受光晕、不带描边(0.10.1 的行为不变);(c) `--bw-text-glow` 取代原先的 `custStyle.textShadow` 作为"这一行要不要文字呼吸"的判据——描边默认开启后 text-shadow 恒非空,旧判据会让每一行都开始呼吸;(d) `.bw-row-label` 与预览标签的留白余量 1px → 3px,覆盖最粗一档的斜向外扩。
- **性能无回退**:400 行侧栏滚动重绘基准,中位帧时 16.7ms,与 `-webkit-text-stroke` 及完全无描边三者一致(DPR 2 / Chrome 152);八层 text-shadow 没有可测量的代价。
- **验证记录**(本机 Chrome 152 / macOS,13px 行、`#808080`、DPR 1 / 1.5 / 2 / 3 逐像素比对):真机页用插件自身 CSS + 真实行结构复现,确认 keyframes 变量展开、元信息列只去描边留光晕、空回退路径均符合预期。同时被试过并否决的方案——`text-rendering: geometricPrecision`(边缘变柔但纯色描边像素反而更少,且文字整体变细约 7%)、`-webkit-font-smoothing: antialiased`(同上)、把 `-webkit-text-stroke` 加宽到 2px(实心度 0.19 → 0.66,但视觉粗一倍)、`filter: drop-shadow` 与半透明描边色(均更差)。
- 冒烟测试 20 项全绿:原 `strokeStyleOf` 断言改写为 `strokeShadowsOf` / `strokeOffsetOf`(八向、颜色优先级、auto 反差、关闭即空数组、偏移钳到设备像素),0.10.1 用例增加预览留白、呼吸 keyframes 变量与"元信息只去描边"三条断言。

## v0.11.0 — 2026-09-15

**类型**:feat

- **界面支持 21 种语言**:原有 `zh` / `en` 两本词典之外,新增 19 门第三语言——`ar` `de` `fr` `hi` `id` `it` `ja` `ko` `nl` `pl` `pt` `ru` `sv` `th` `tr` `vi`,加繁体三件套 `zh-HK` / `zh-MO` / `zh-TW`(港式与台式各一份,`zh-MO` 复用 `zh-HK` 的用词)。每门语言在 `LOCALES` 表里只占一条,条目上一行是 `/* locale: <tag> */` 标记(冒烟测试据此切片),加一门语言 = 追加一条,不改任何逻辑。
- **词典交给 DSH 的 locale 服务**:`ctx.locale.register(NS, Object.assign({ zh, en }, LOCALES))` 一次注册,语言跟随 DSH 的 `ctx.locale`;`t` 仍是宿主渲染器按 slot 注册里 `locale: NS` 绑好的座位,切换语言经 locale revision 即时重渲染生效,本插件不自己解析词典、不缓存词典、也绝不调 `ctx.locale.addLanguage`(那是语言包插件的活)。
- **新增守护测试「每本词典的键集与中文完全相等」**:缺键在查表时静默回退英文,面板会变成半翻译状态而不报错,因此冒烟测试逐门比对 key 集(缺一个即红),并断言 19 门语言的标签顺序与单次注册调用不变。
- **译文为机器辅助翻译,欢迎在 issue / PR 里修正**:每门语言只占一处、互不影响,改一门不会动到别的语言。
- 顺带修掉的文档/文案 bug:README 双语把本地化说成「中英双语跟随界面语言」/「zh/en localization」(0.10.x 起早已不是事实),改为「界面文案跟随 DSH 的语言设置(内置 21 种语言,含简繁中文)」;`npm test` 说明同步改成 21 门词典键集对齐;AGENTS.md「词典纪律」按 21 门重写(标记、键集相等、不自己订阅语言、绝不 addLanguage)并更新目录地图里的冒烟测试描述。
- 冒烟测试 19 → 20 项,全绿。

- 相关:[Release v0.11.0](https://github.com/KannaKuron/dsh-better-workspace/releases/tag/v0.11.0)

## v0.10.2 — 2026-09-15

**类型**:fix + feat

- **图标集不再钉死(适配 dsh 0.1.6-alpha.1)**。新版换了一批 primitives 图标:删除 `IconSendOutline16`,新增 `IconPaperPlaneOutline14` / `IconWrapLinesOutline16` 等。旧实现把图标名钉在 `ICON_CHOICES` 里:**新宿主上会多出一个渲染为空的格子**,而且用户此前保存过该图标的话,那一行的图标会直接消失。现在 `ICON_CHOICES` 只是候选清单,渲染出口由 `ICON_PICKER_CHOICES` 运行时过滤(只留本宿主导出的字形、按解析后的名字去重),已保存的旧值经 `resolveIconName` → `ICON_ALIASES` 落到等价替代(`IconSendOutline16` → `IconSendOutline14`,两版都有)。新版新增的 5 个字形一并纳入候选清单,旧宿主自动滤掉;选过退役图标的行在新宿主上仍高亮正确的格子。
- **会话拖拽排序不再因宿主接口消失而失效**。dsh 0.1.6-alpha.1 把 `insertSessionBefore` 从浏览器注入面移除(官方改成 browser 本地排序),而本插件原来以 `typeof insertSessionBefore === 'function'` 门控——新宿主上拖拽排序会静默失效。现在双通道:宿主动作优先(权威、与其他界面一致),缺失时落到**浏览器本地扁平序**(store 新增 `sessionOrder`,按 workspaceId 存 id 数组;`reorderIds` 复刻 insertSessionBefore 的锚点语义)。本地序**只在宿主无该动作时生效**,且与折叠状态一样每端本地、不进跨端同步。
- 冒烟测试 17 → 19 项:图标解析 / 别名链 / 宿主过滤 / 已存值兜底、`reorderIds` 锚点语义、store 新键的 hydration 容错、两条通道的接线断言。

## v0.10.1 — 2026-09-15

**类型**:feat / fix

- **描边颜色可选**:新增「描边颜色」——预设**灰(默认)/ 黑 / 白 / 品牌蓝**加任意取色器,并保留「自动」(按该行字体颜色取 WCAG 反差色:浅色字配黑边、深色字配白边,且跟随主题与背景插件的界面明暗)。**默认改为灰色 #808080**——深浅背景上都可读,又不像纯黑/纯白那样抢眼。颜色随行级条目与「默认外观」一起持久化、跨端同步。
- **描边被裁切修复**:行标题 `.bw-row-label` 带 `overflow:hidden`(省略号所需),外描边在文字左边界溢出盒外会被切掉——实测「Web」「测试」等首字左侧缺边。改为 `padding:1px; margin:-1px` 预留 1px 余量:文字起点与省略号行为不变,描边四向完整。
- **右侧元信息不再描边**:行尾的会话计数与相对时间(`.bw-row-count` / `.bw-row-time`,11px 次级灰字)描边后比标题还重;统一 `-webkit-text-stroke-width:0`,只留标题、分组名等主干文字带描边。
- 冒烟测试 17/17 全绿:appearance 用例扩展(默认灰、手选色优先、非法色回退、auto 反差),并新增 0.10.1 的裁切补偿与元信息断言。

- **描边被裁切修复**:行标题 `.bw-row-label` 带 `overflow:hidden`(省略号所需),外描边在文字左边界溢出盒外会被切掉——实测「Web」「测试」等首字左侧缺边。改为 `padding:1px; margin:-1px` 预留 1px 余量:文字起点与省略号行为不变,描边四向完整。
- **右侧元信息不再描边**:行尾的会话计数与相对时间(`.bw-row-count` / `.bw-row-time`,11px 次级灰字)描边后比标题还重;统一 `-webkit-text-stroke-width:0`,只留标题、分组名等主干文字带描边。
- 冒烟测试新增样式断言(补偿规则与关描边规则存在),17/17 全绿。

## v0.10.0 — 2026-09-14

**类型**:feat

- **字体描边(新)**:行内文字可加外描边,**默认开启**(背景画面下不描边文字常常看不清),宽度 0.5–4px 可调、默认 1px,步进 0.5px。
- **描边颜色自动判定,不手选**:取该行**最终字体颜色**的反差色——浅色字配黑描边、深色字配白描边(WCAG 对比度取更亮的一极)。行有自定义颜色时按该色现算;没有自定义色的行读树容器采样的 CSS 变量 `--bw-stroke-color`(`getComputedStyle` 实时采样,html/body 属性 mutation + 1.5s 兜底轮询),因此**主题明暗与 dsh-any-background 之类插件的「界面明暗」切换都自动跟随**,且不需要 React 重渲染。`paint-order: stroke fill` 让描边画在填充之下,字形不会变细。
- **设置卡新增「默认外观」**:颜色 / 发光 / 字体粗细 / 字体阴影 / 字体描边开关 / 描边粗细一次配好,没有单独自定义过的行全部继承(其余项默认与「无自定义」一致,只有描边默认开)。行级「自定义外观」对话框与设置卡**共用同一组控件**,并新增描边开关与描边粗细;**实时预览同样显示描边**(默认色的预览按预览文字自身的实时颜色取反差色)。
- **行级条目按字段覆盖默认值**:老版本写下的条目(没有 stroke 键)照样继承新默认描边,而不是丢掉它;提交时若与默认外观完全一致则清除条目,不写冗余副本。
- **跨端同步**:默认外观随宿主设置命名空间 `better-workspace` 的 `appearance` 字段(形状自管,`Schema.dict(Schema.any())`),与其它外观项一样参与手动推送 / 获取。
- 冒烟测试新增 appearance 用例(默认开启、字段级合并、反差色取极、宽度钳制、`color(srgb …)` 解析、宿主字段与同步路径),16/16 全绿。

## v0.9.6 — 2026-09-13

**类型**:fix

- **标题缓存性能修复**([issue #1](https://github.com/KannaKuron/dsh-better-workspace/issues/1),已关闭):0.9.4/0.9.5 把冷重启标题记忆(`dsh.betterWorkspace.titles.v1`)做成了响应式 dsh-client-store——`rememberTitle` 每会话每次快照 dispatch 一次,每个 action 都是 immer produce + sync 广播 + 整串 JSON.stringify 持久化;大会话库下(报告环境 482 会话 × agent 运行时 ~44 快照/s)每秒数千次 action 直接冻结主线程(报告与复现:41% CPU、点击冻 ~0.9s)。修复:改为普通模块对象 `titleCache` + `rememberAllTitles(list)` 每快照**一次批处理**(同值零分配、只有真变化才置脏;淘汰每批一次)+ `scheduleTitleSave` 200ms 防抖整写 localStorage + `loadTitleCache()` 首渲染前同步恢复;`titleCacheRef = { getSnapshot, rememberAllTitles }` 组件直读不订阅;持久键与数据形状不变,升级无迁移。红线(已入 AGENTS.md):标题缓存绝不做响应式 store / 逐会话 dispatch——「reducer 内 no-op」不等于「action 免费」。
- 冒烟测试新增 title-cache 用例(mock localStorage),15/15 全绿;README 双语措辞更新(防抖本地缓存)。
- 相关:[issue #1](https://github.com/KannaKuron/dsh-better-workspace/issues/1) · [Release v0.9.6](https://github.com/KannaKuron/dsh-better-workspace/releases/tag/v0.9.6)

## v0.9.5 — 2026-09-09

**类型**:feat

- 手动跨端同步(web ↔ 桌面):宿主 settings 命名空间 `better-workspace`(~/.dsh/settings.yaml)承载 styling/folders/toggles 作为第三层持久化;偏好每次变更双写(本地即时回显 + 宿主);设置卡同步区按 IS_DESKTOP_SURFACE 方向感知,拉取支持覆盖/合并两模式,旧版本历史数据可显式「发送」。绝不自动镜像/自动迁移(用户明确决定);折叠状态永远每端本地。

## v0.9.4 — 2026-09-09

**类型**:feat

- 冷重启标题记忆:记住每会话最后真实 wire 标题(`dsh.betterWorkspace.titles.v1`),冷列表缺 title 时(fork 出生、从未写过检查点的低活动会话,官方列表只带投影缓存命中者)渲染记忆标题而非工作区 basename 回退;只学 summary.title 绝不学 displayTitle;声明 engines.dsh。——注:本版的响应式 store 形态即 issue #1 的性能根因,v0.9.6 已重写为普通对象 + 批处理。

## v0.9.3 — 2026-09-01

**类型**:chore

- 移除退役的 connectionGeneration 注入(上游已删该注入面);README 加 Awesome DSH Plugin 徽章(收录 PR #3961)。

## v0.9.2 — 2026-08-31

**类型**:fix

- quote-on-land 收紧:只对「本挂载内亲眼见过 blank 快照的会话」生效(0.9.1 按「首轮快照后首次出现」判新,store 渐进填充时存量旧会话被误包引号,实测事故);落地后过 20s 稳定期、期间标题再变即重置;孤立引号只是普通字符。

## v0.9.1 — 2026-08-31

**类型**:feat

- slash 标题 quote-on-land(自动命名带 / 的会话整串包引号,防误分层);移除 URL 嵌套(用户实测后明确不要任何 URL 层级,回到纯 / 切分)。

## v0.9.0 — 2026-08-31

**类型**:feat

- 状态呼吸灯取代完成 toast(toast 全套移除):被折叠遮蔽的状态沿层级向外冒泡到最近可见容器行;冒泡只含 warning 琥珀 > done 绿,ongoing 一律不外渗(用户明确觉得 running 外渗吵)。

## v0.8.0 — 2026-08-31

**类型**:feat

- URL 感知嵌套(0.9.1 已按用户要求回退)、相对链标签(VS Code 式)、右键菜单文件夹操作(新建子分组/子工作区)、完成 toast(0.9 已被呼吸灯取代)。

## v0.7.2 — 2026-08-31

**类型**:fix

- 注入 insertSessionBefore 并以 canReorderSessions 门控会话重排投放——≤0.7.1 拖会话排序即弹 TypeError(browserInjected 曾漏注入该动作)。

## v0.7.1 — 2026-08-31

**类型**:fix

- dragstart 的 setDrag 延迟一帧:Chromium 在拖拽手势建立前,同步重渲染把拖拽源元素从光标下移开会立即取消整个拖拽(参照 react-dnd #3649 同款 setTimeout 解法)。

## v0.7.0 — 2026-08-31

**类型**:feat

- 拖拽期单链展开:工作区拖拽激活期间 compressTree 暂停,单链展开回文件夹行、任意一级可投放,拖完自动合并。

## v0.6.0 — 2026-08-30

**类型**:fix / feat

- dsh ≥ 0.1.2-alpha.2 的 settingsNamespace() 移除适配(register 单次调用双 era 兼容);活跃定时任务角标(IconAlarmClockOutline16);图标网格扩充至 primitives 家族。

## v0.5.0 — 2026-08-30

**类型**:fix

- priority -1 影子化 shell 目录流选择器(hero 面目录流回退官方默认)。

## v0.4.3 — 2026-08-30

**类型**:release

- npm 正式通道切换为 Trusted Publishing(OIDC):0.4.2 用 npm login 令牌 bootstrap 建包,本版起 Release published 自动 OIDC 发布(实测全绿);README 截图排版(两栏布局)。

## v0.4.2 — 2026-08-30

**类型**:fix

- 纯文字发光(禁外框 boxShadow)、primitives 家族图标网格、RGB 输入、选中按钮 hover 态;npm 建包首版(令牌 bootstrap)。

## v0.4.1 — 2026-08-30(无独立版本 tag)

**类型**:fix

- 右键菜单适配透明/磨砂主题插件(dsh-any-background):自绘表面走「主题 token + 插件 CSS 变量」链。

## v0.4.0 — 2026-08-30(无独立版本 tag)

**类型**:feat

- VS Code 式单链压缩树、设置页(设置卡)、右键上下文菜单、外观自定义(颜色/发光/图标/字重)。

## v0.3.0 — 2026-08-30(无独立版本 tag)

**类型**:fix

- 恢复原生拖拽(工作区重排/移动、会话重排/移组),修会话分组折叠。

## v0.2.0 — 2026-08-30(无独立版本 tag)

**类型**:fix

- 对齐官方可见性/状态圆点语义,可折叠会话树,会话级层级。

## v0.1.0 — 2026-08-30(无独立版本 tag)

**类型**:feat

- 首版:侧边栏工作区列表升级为命名层级树(/ 虚拟分组、分组弹窗、重命名即时重排、空分组)。
