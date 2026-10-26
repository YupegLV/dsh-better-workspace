/**
 * dsh-better-workspace — client half (plain JavaScript, no build step).
 *
 * Three registrations:
 *  1. `sidebar.workspaces` (priority -1): replaces the shipped workspace
 *     browser with a hierarchy tree derived from "/" inside workspace titles.
 *  2. `conversation.hero.workspace.directoryFlow`: the add-workspace picking
 *     interaction for the conversation empty-state menu — native directory
 *     pick, then a parent-group popup, then create + rename with the prefix.
 *  3. `sidebar.workspaces.directoryFlow`: the same interaction for the
 *     shipped sidebar browser (fills only when that hole is declared, i.e.
 *     whenever this plugin's own browser is not the occupying entry).
 *
 * Every require below is a dsh client baseline module (see
 * @deepseek-ai/dsh-client-web seed.ts): react, @deepseek-ai/dsh-client-store,
 * @deepseek-ai/dsh-client-ui-primitives.
 */
window.__ModuleLoader__.load({
  id: 'dsh-virtual-workspace',
  factory: (require) => {
    const React = require('react')
    const storeKit = require('@deepseek-ai/dsh-client-store')
    const ui = require('@deepseek-ai/dsh-client-ui-primitives')

    const E = React.createElement
    const NS = 'betterWorkspace'

    /* ============================== i18n ============================== */

    const zh = {
      'title': '工作区',
      'add': '添加工作区',
      'create': '创建',
      'rail.add': '添加工作区',
      'menu.newSubWorkspace': '新增子工作区',
      'flow.title': '添加工作区',
      'flow.picked': '所选文件夹',
      'flow.parent': '所属分组',
      'flow.parentHint': '输入或下拉选择分组路径,留空表示根分组;多级用 / 分隔',
      'flow.creating': '正在创建…',
      'flow.parentDir': '所属虚拟目录',
      'flow.parentDirHint': '工作区会挂到所选虚拟目录下,选「根层级」则不归类;还没有目录时,先用工具栏的「新建虚拟目录」建一个。',
      'browse.title': '选择工作区目录',
      'browse.home': '主目录',
      'browse.newFolder': '新建文件夹',
      'browse.folderName': '文件夹名称',
      'browse.showHidden': '显示隐藏文件',
      'browse.loading': '加载中…',
      'browse.truncated': '文件夹过多,仅显示开头部分。',
      'browse.editPath': '编辑路径',
      'browse.open': '打开',
      'browse.createIn': '在「{name}」中创建',
      'browse.untitledFolder': '新建文件夹',
      'search.placeholder': '搜索工作区或会话',
      'rail.search': '搜索',
      'empty': '暂无工作区',
      'empty.search': '没有匹配的结果',
      'session.new': '新会话',
      'group.ungrouped': '未分组',
      /* virtual directory strings */
      'session.more': '… 还有 {n} 条历史',
      'session.more.less': '收起历史',
      'session.more.title': '只显示最近 7 天内、最多 5 条；点击展开其余 {n} 条',
      'dir.new.title': '新建虚拟目录',
      'dir.new.hint': '只创建一个分组，不会在磁盘上建文件夹、也不改动任何工作区',
      'dir.rename.title': '重命名虚拟目录',
      'dir.rename.hint': '只改分组名称，真实文件夹与工作区都不受影响',
      'dir.delete.title': '删除虚拟目录',
      'dir.delete.body': '删除虚拟目录「{name}」及其全部子目录？里面的真实工作区会回到根层级，文件夹本身不会被删除。',
      'dir.moveTo': '移动到目录…',
      'dir.rootLevel': '（根层级）',
      'sessions.expand': '展开 {n} 个会话',
      'sessions.collapse': '收起',
      'time.now': '刚刚',
      'time.minutes': '{n} 分钟',
      'time.hours': '{n} 小时',
      'time.days': '{n} 天',
      'time.months': '{n} 个月',
      'time.years': '{n} 年',
      'status.running': '生成中',
      'status.completed': '已完成',
      'status.approval': '等待批准',
      'status.planReview': '等待计划确认',
      'status.question': '等待回答',
      'status.subagents': '{n} 个子任务运行中',
      'status.compact.approval': '待审批',
      'status.compact.answer': '待回答',
      'status.compact.planReview': '计划待审',
      'schedule.active': '有活动定时任务',
      'menu.rename': '重命名',
      'menu.openWsFolder': '打开工作区文件夹',
      'menu.copyPath': '复制路径',
      'path.copied': '已复制路径',
      'path.none': '该工作区没有文件夹路径',
      'menu.delete': '删除',
      'menu.fork': '分叉',
      'menu.archive': '归档',
      'menu.newSubfolder': '新增子分组',
      'menu.renameFolder': '重命名分组',
      'menu.removeFolder': '删除分组',
      'menu.renameSgroup': '重命名会话分组',
      'settings.title': '更好的工作区',
      'settings.desc': '工作区树的外观与折叠偏好',
      'settings.expand': '展开',
      'settings.collapse': '收起',
      'settings.compactChains': '单链分组折叠显示',
      'settings.compactChains.hint': '单层链合并为一行,出现多个子级时自动展开为树状;拖拽工作区期间单链临时展开回文件夹树,可放入任意一级;展开状态与自定义外观保存在当前浏览器。',
      'settings.statusPulse': '状态呼吸灯',
      'settings.statusPulse.hint': '被折叠藏起的状态灯(完成绿 / 运行蓝 / 待交互琥珀)沿层级向外冒泡:工作区与分组行以图标呼吸发光(颜色随状态,自定义过发光的标题一起呼吸),会话分组行显示呼吸状态灯;默认开启,可在此关闭。',
      'settings.appearance': '默认外观',
      'settings.appearance.hint': '没有单独自定义过的行使用这套外观;字体描边默认开启——背景画面下不描边文字常常看不清。字体颜色留空即跟随主题。',
      'settings.appearance.reset': '恢复默认外观',
      'custom.title': '自定义外观',
      'custom.color': '颜色',
      'custom.glow': '发光',
      'custom.preview': '实时预览',
      'custom.preview.sample': '工作区示例',
      'custom.weight': '字体粗细',
      'custom.weight.regular': '常规',
      'custom.weight.medium': '中',
      'custom.weight.semibold': '半粗',
      'custom.weight.bold': '粗',
      'custom.shadow': '字体阴影',
      'custom.stroke': '字体描边',
      'custom.stroke.hint': '描边颜色默认灰色,可改黑 / 白 / 任意取色,或选「自动」按字体颜色取反差色(浅色字配黑边、深色字配白边);自动模式跟随主题明暗与背景插件的界面明暗。',
      'custom.strokeWidth': '描边粗细',
      'custom.strokeColor': '描边颜色',
      'custom.strokeColor.auto': '自动',
      'custom.weak': '弱',
      'custom.medium': '中',
      'custom.strong': '强',
      'custom.icon': '图标',
      'custom.icon.solid': '实心文件夹',
      'custom.icon.outline': '空心文件夹',
      'custom.icon.none': '不显示',
      'custom.none': '不显示',
      'custom.reset': '清除自定义',
      'custom.done': '完成',
      'settings.on': '开',
      'settings.off': '关',
      'sync.title': '跨端同步',
      'sync.desc': '外观自定义、显式分组与开关保存在本设备的浏览器里;通过宿主设置存储与另一端互传。平时的新修改会自动写入宿主,另一端点「获取」即可拿到;旧版本的历史数据首次需要点一次「发送」。',
      'sync.mode.overwrite': '覆盖本设备',
      'sync.mode.merge': '合并两端',
      'sync.pull.desktop': '从客户端获取',
      'sync.pull.web': '从 Web 获取',
      'sync.push': '发送本设备数据',
      'sync.done': '已同步',
      'sync.empty': '另一端暂无数据可获取',
      'sync.off': '当前环境不支持同步(需要宿主设置服务)',
      'sync.loading': '正在连接宿主设置…',
      'error.title': '出错了',
      'cancel': '取消',
      'confirm': '确定',
      'close': '关闭',
      'ws.rename.title': '重命名工作区',
      'ws.rename.hint': '名称中的 / 即层级分组,例如 web/前端',
      'ws.delete.title': '删除工作区',
      'ws.delete.body': '仅移除工作区登记,目录和会话记录都会保留。确定删除「{name}」?',
      'folder.new.title': '新建分组',
      'folder.new.hint': '分组路径,可用 / 表示多级,例如 web/前端',
      'folder.rename.title': '重命名分组',
      'folder.rename.hint': '重命名会同步更新组内所有工作区名称',
      'folder.delete.body': '删除空分组「{name}」?',
      'folder.error.empty': '分组路径不能为空',
      'folder.error.exists': '分组已存在',
      'folder.error.notEmpty': '分组内还有工作区,无法删除',
    }

    const en = {
      'title': 'Workspaces',
      'add': 'Add workspace',
      'create': 'Create',
      'rail.add': 'Add workspace',
      'menu.newSubWorkspace': 'New workspace here',
      'flow.title': 'Add workspace',
      'flow.picked': 'Chosen folder',
      'flow.parent': 'Parent group',
      'flow.parentHint': 'Type or pick a group path; empty means root. Nest with /',
      'flow.creating': 'Creating…',
      'flow.parentDir': 'Parent virtual directory',
      'flow.parentDirHint': 'The workspace is filed under the chosen virtual directory; the root level leaves it ungrouped. With no directories yet, create one from the sidebar toolbar first.',
      'browse.title': 'Select Workspace Directory',
      'browse.home': 'Home',
      'browse.newFolder': 'New folder',
      'browse.folderName': 'Folder name',
      'browse.showHidden': 'Show hidden files',
      'browse.loading': 'Loading…',
      'browse.truncated': 'Too many folders to list; only the beginning is shown.',
      'browse.editPath': 'Edit path',
      'browse.open': 'Open',
      'browse.createIn': 'Create in "{name}"',
      'browse.untitledFolder': 'New folder',
      'search.placeholder': 'Search workspaces or sessions',
      'rail.search': 'Search',
      'empty': 'No workspaces yet',
      'empty.search': 'No matches',
      'session.new': 'New session',
      'group.ungrouped': 'Ungrouped',
      'session.more': '… {n} more in history',
      'session.more.less': 'Collapse history',
      'session.more.title': 'Shows only the last 7 days, up to 5 items; click to reveal the other {n}',
      'dir.new.title': 'New virtual folder',
      'dir.new.hint': 'Creates a grouping only — no folder on disk, no workspace touched',
      'dir.rename.title': 'Rename virtual folder',
      'dir.rename.hint': 'Renames the group only; real folders and workspaces are untouched',
      'dir.delete.title': 'Delete virtual folder',
      'dir.delete.body': 'Delete virtual folder "{name}" and all its subfolders? Real workspaces inside return to the root level; no folder on disk is deleted.',
      'dir.moveTo': 'Move into folder…',
      'dir.rootLevel': '(root level)',
      'sessions.expand': 'Show {n} more sessions',
      'sessions.collapse': 'Collapse',
      'time.now': 'now',
      'time.minutes': '{n}min',
      'time.hours': '{n}h',
      'time.days': '{n}d',
      'time.months': '{n}mo',
      'time.years': '{n}y',
      'status.running': 'Running',
      'status.completed': 'Completed',
      'status.approval': 'Waiting for approval',
      'status.planReview': 'Waiting for plan review',
      'status.question': 'Waiting for answer',
      'status.subagents': '{n} subagent(s) running',
      'status.compact.approval': 'Approval',
      'status.compact.answer': 'Answer',
      'status.compact.planReview': 'Plan review',
      'schedule.active': 'Has active scheduled task',
      'menu.rename': 'Rename',
      'menu.openWsFolder': 'Open workspace folder',
      'menu.copyPath': 'Copy path',
      'path.copied': 'Path copied',
      'path.none': 'This workspace has no folder path',
      'menu.delete': 'Delete',
      'menu.fork': 'Fork',
      'menu.archive': 'Archive',
      'menu.newSubfolder': 'New subfolder',
      'menu.renameFolder': 'Rename folder',
      'menu.removeFolder': 'Delete folder',
      'menu.renameSgroup': 'Rename session group',
      'settings.title': 'Better Workspaces',
      'settings.desc': 'Workspace tree appearance and folding preferences',
      'settings.expand': 'Expand',
      'settings.collapse': 'Collapse',
      'settings.compactChains': 'Merge single-child chains',
      'settings.compactChains.hint': 'Single-child chains merge into one row; levels with multiple children expand as a tree. Chains re-expand into folder rows while you drag a workspace, so it can drop into any level. State and custom styling persist in this browser.',
      'settings.statusPulse': 'Status breathing light',
      'settings.statusPulse.hint': 'Status dots hidden by collapse (done green / running blue / pending amber) bubble outward: workspace and folder rows breathe on their icon in the status color (custom-glow labels breathe along), session-group rows show a breathing dot; on by default, turn it off here.',
      'settings.appearance': 'Default appearance',
      'settings.appearance.hint': 'Rows that were never customized use this appearance; the outline is on by default — text without it is often unreadable over a background image. Leave the color empty to follow the theme.',
      'settings.appearance.reset': 'Reset to default',
      'custom.title': 'Customize',
      'custom.color': 'Color',
      'custom.glow': 'Glow',
      'custom.preview': 'Live preview',
      'custom.preview.sample': 'Workspace sample',
      'custom.weight': 'Font weight',
      'custom.weight.regular': 'Regular',
      'custom.weight.medium': 'Medium',
      'custom.weight.semibold': 'Semi-bold',
      'custom.weight.bold': 'Bold',
      'custom.shadow': 'Font shadow',
      'custom.stroke': 'Font outline',
      'custom.stroke.hint': 'The outline is gray by default — pick black, white, any color, or Auto to derive the contrasting pole from the font color (light text gets a black rim, dark text a white one); Auto follows the theme and a background plugin\'s light/dark switch.',
      'custom.strokeWidth': 'Outline width',
      'custom.strokeColor': 'Outline color',
      'custom.strokeColor.auto': 'Auto',
      'custom.weak': 'Subtle',
      'custom.medium': 'Medium',
      'custom.strong': 'Strong',
      'custom.icon': 'Icon',
      'custom.icon.solid': 'Solid folder',
      'custom.icon.outline': 'Outline folder',
      'custom.icon.none': 'Hidden',
      'custom.none': 'None',
      'custom.reset': 'Clear custom style',
      'custom.done': 'Done',
      'settings.on': 'On',
      'settings.off': 'Off',
      'sync.title': 'Cross-device sync',
      'sync.desc': "Appearance, explicit folders, and toggles live in this device's browser; they exchange with the other surface (web / desktop app) through the host settings store. New edits are written to the host automatically — the other surface just pulls. History created before this version needs one explicit Send.",
      'sync.mode.overwrite': 'Overwrite this device',
      'sync.mode.merge': 'Merge both sides',
      'sync.pull.desktop': 'Pull from desktop app',
      'sync.pull.web': 'Pull from web',
      'sync.push': "Send this device's data",
      'sync.done': 'Synced',
      'sync.empty': 'No data on the other surface yet',
      'sync.off': 'Sync unavailable here (requires the host settings service)',
      'sync.loading': 'Connecting to host settings…',
      'error.title': 'Something went wrong',
      'cancel': 'Cancel',
      'confirm': 'OK',
      'close': 'Close',
      'ws.rename.title': 'Rename workspace',
      'ws.rename.hint': 'Use / inside the name to nest, e.g. web/frontend',
      'ws.delete.title': 'Delete workspace',
      'ws.delete.body': 'Only the workspace registration is removed; the directory and session logs remain. Delete "{name}"?',
      'folder.new.title': 'New folder',
      'folder.new.hint': 'Folder path; nest with /, e.g. web/frontend',
      'folder.rename.title': 'Rename folder',
      'folder.rename.hint': 'Renaming updates every workspace title inside the folder',
      'folder.delete.body': 'Delete empty folder "{name}"?',
      'folder.error.empty': 'Folder path must not be empty',
      'folder.error.exists': 'Folder already exists',
      'folder.error.notEmpty': 'Folder still contains workspaces',
    }

    /* Third-language dictionaries, keyed by BCP 47 tag. Every entry must carry
       the SAME key set as zh: a key missing here falls back to English at
       lookup time, which is exactly the silent half-translated panel that
       tests/smoke.mjs refuses. This plugin does not resolve dictionaries
       itself — `t` arrives as a slot seat bound to NS by the host renderer,
       so one entry below is all a new language needs. */
    const LOCALES = {
      /* locale: ar */
      'ar': {
        'title': 'مساحات العمل',
        'add': 'إضافة مساحة عمل',
        'create': 'إنشاء',
        'rail.add': 'إضافة مساحة عمل',
        'menu.newSubWorkspace': 'مساحة عمل فرعية هنا',
        'flow.title': 'إضافة مساحة عمل',
        'flow.picked': 'المجلد المختار',
        'flow.parent': 'المجموعة التابعة لها',
        'flow.parentHint': 'اكتب مسار المجموعة أو اختره؛ الفراغ يعني الجذر؛ تُفصل المستويات بـ /',
        'flow.creating': 'جارٍ الإنشاء…',
        'flow.parentDir': 'مجلد افتراضي أب',
        'flow.parentDirHint': 'The workspace is filed under the chosen virtual directory; the root level leaves it ungrouped. With no directories yet, create one from the sidebar toolbar first.',
        'browse.title': 'اختيار مجلد مساحة العمل',
        'browse.home': 'المجلد الرئيسي',
        'browse.newFolder': 'مجلد جديد',
        'browse.folderName': 'اسم المجلد',
        'browse.showHidden': 'إظهار الملفات المخفية',
        'browse.loading': 'جارٍ التحميل…',
        'browse.truncated': 'المجلدات كثيرة جدًا؛ يُعرض الجزء الأول فقط.',
        'browse.editPath': 'تعديل المسار',
        'browse.open': 'Open',
        'browse.createIn': 'Create in "{name}"',
        'browse.untitledFolder': 'New folder',
        'search.placeholder': 'ابحث في مساحات العمل أو الجلسات',
        'rail.search': 'بحث',
        'empty': 'لا توجد مساحات عمل بعد',
        'empty.search': 'لا توجد نتائج مطابقة',
        'session.new': 'جلسة جديدة',
        'group.ungrouped': 'بلا مجموعة',
        'session.more': '… {n} more in history',
        'session.more.less': 'Collapse history',
        'session.more.title': 'Shows only the last 7 days, up to 5 items; click to reveal the other {n}',
        'sessions.expand': 'عرض {n} جلسات إضافية',
        'sessions.collapse': 'طيّ',
        'time.now': 'الآن',
        'time.minutes': '{n} دقيقة',
        'time.hours': '{n} ساعة',
        'time.days': '{n} يوم',
        'time.months': '{n} شهر',
        'time.years': '{n} سنة',
        'status.running': 'قيد التوليد',
        'status.completed': 'مكتمل',
        'status.approval': 'بانتظار الموافقة',
        'status.planReview': 'بانتظار تأكيد الخطة',
        'status.question': 'بانتظار الرد',
        'status.subagents': '{n} من الوكلاء الفرعيين قيد التشغيل',
        'status.compact.approval': 'الموافقة',
        'status.compact.answer': 'الرد',
        'status.compact.planReview': 'مراجعة الخطة',
        'schedule.active': 'توجد مهمة مجدولة نشطة',
        'menu.rename': 'إعادة التسمية',
        'menu.openWsFolder': 'فتح مجلد مساحة العمل',
        'menu.copyPath': 'نسخ المسار',
        'path.copied': 'تم نسخ المسار',
        'path.none': 'لا يوجد مسار مجلد لمساحة العمل هذه',
        'menu.delete': 'حذف',
        'menu.fork': 'تفريع',
        'menu.archive': 'أرشفة',
        'menu.newSubfolder': 'مجلد فرعي جديد',
        'menu.renameFolder': 'إعادة تسمية المجلد',
        'menu.removeFolder': 'حذف المجلد',
        'menu.renameSgroup': 'إعادة تسمية مجموعة الجلسات',
        'settings.title': 'مساحات عمل أفضل',
        'settings.desc': 'مظهر شجرة مساحات العمل وتفضيلات الطيّ',
        'settings.expand': 'توسيع',
        'settings.collapse': 'طيّ',
        'settings.compactChains': 'دمج السلاسل ذات الفرع الواحد',
        'settings.compactChains.hint': 'تُدمج المستويات ذات الفرع الواحد في سطر واحد، وتتوسع الشجرة تلقائياً عند وجود أكثر من فرع؛ أثناء سحب مساحة عمل تُفكّ السلاسل مؤقتاً إلى مجلدات ليصبح الإفلات ممكناً في أي مستوى؛ تُحفظ حالة التوسيع والمظهر المخصص في هذا المتصفح.',
        'settings.statusPulse': 'مؤشر حالة نابض',
        'settings.statusPulse.hint': 'مؤشرات الحالة التي يخفيها الطيّ (مكتمل أخضر / قيد التشغيل أزرق / بانتظار تفاعل كهرماني) تتصاعد عبر المستويات: تصدر أسطر مساحات العمل والمجلدات وميضاً نابضاً للأيقونة بلون الحالة (وتنبض معها العناوين ذات التوهج المخصص)، وتعرض أسطر مجموعات الجلسات نقطة حالة نابضة؛ مفعّل افتراضياً ويمكن إيقافه هنا.',
        'settings.appearance': 'المظهر الافتراضي',
        'settings.appearance.hint': 'تستخدم الأسطر غير المخصصة هذا المظهر؛ حدّ النص مفعّل افتراضياً — فبدونه يصعب قراءة النص فوق صورة خلفية. اترك اللون فارغاً لاتباع السمة.',
        'settings.appearance.reset': 'استعادة المظهر الافتراضي',
        'custom.title': 'تخصيص المظهر',
        'custom.color': 'اللون',
        'custom.glow': 'التوهج',
        'custom.preview': 'معاينة مباشرة',
        'custom.preview.sample': 'مساحة عمل نموذجية',
        'custom.weight': 'سماكة الخط',
        'custom.weight.regular': 'عادي',
        'custom.weight.medium': 'متوسط',
        'custom.weight.semibold': 'شبه عريض',
        'custom.weight.bold': 'عريض',
        'custom.shadow': 'ظل النص',
        'custom.stroke': 'حدّ النص',
        'custom.stroke.hint': 'الحدّ رمادي افتراضياً؛ يمكن اختيار الأسود / الأبيض / أي لون، أو «تلقائي» لاشتقاق اللون المتباين من لون النص (النص الفاتح بحدّ أسود والغامق بحدّ أبيض)؛ يتبع الوضع التلقائي السمة وتبدّل الوضع الفاتح/الداكن في إضافة الخلفية.',
        'custom.strokeWidth': 'سماكة الحدّ',
        'custom.strokeColor': 'لون الحدّ',
        'custom.strokeColor.auto': 'تلقائي',
        'custom.weak': 'ضعيف',
        'custom.medium': 'متوسط',
        'custom.strong': 'قوي',
        'custom.icon': 'الأيقونة',
        'custom.icon.solid': 'مجلد ممتلئ',
        'custom.icon.outline': 'مجلد مفرّغ',
        'custom.icon.none': 'مخفية',
        'custom.none': 'بلا',
        'custom.reset': 'مسح التخصيص',
        'custom.done': 'تم',
        'settings.on': 'تشغيل',
        'settings.off': 'إيقاف',
        'sync.title': 'المزامنة بين الأجهزة',
        'sync.desc': 'يبقى المظهر المخصص والمجلدات الصريحة والمفاتيح في متصفح هذا الجهاز، ويجري تبادلها مع الطرف الآخر (الويب / تطبيق سطح المكتب) عبر مخزن إعدادات المضيف. تُكتب التعديلات الجديدة في المضيف تلقائياً، ويكفي أن يضغط الطرف الآخر «جلب»؛ أما بيانات الإصدارات القديمة فتحتاج ضغطة «إرسال» واحدة.',
        'sync.mode.overwrite': 'الكتابة فوق هذا الجهاز',
        'sync.mode.merge': 'دمج الطرفين',
        'sync.pull.desktop': 'الجلب من تطبيق سطح المكتب',
        'sync.pull.web': 'الجلب من الويب',
        'sync.push': 'إرسال بيانات هذا الجهاز',
        'sync.done': 'تمت المزامنة',
        'sync.empty': 'لا توجد بيانات لدى الطرف الآخر بعد',
        'sync.off': 'المزامنة غير متاحة هنا (تحتاج خدمة إعدادات المضيف)',
        'sync.loading': 'الاتصال بإعدادات المضيف…',
        'error.title': 'حدث خطأ ما',
        'cancel': 'إلغاء',
        'confirm': 'موافق',
        'close': 'إغلاق',
        'ws.rename.title': 'إعادة تسمية مساحة العمل',
        'ws.rename.hint': 'الشرطة المائلة / في الاسم تصنع مستوى المجموعة، مثل web/frontend',
        'ws.delete.title': 'حذف مساحة العمل',
        'ws.delete.body': 'يُزال تسجيل مساحة العمل فقط؛ يبقى الدليل وسجلات الجلسات. هل تريد حذف «{name}»؟',
        'folder.new.title': 'مجموعة جديدة',
        'folder.new.hint': 'مسار المجموعة؛ استخدم / لمستويات متعددة، مثل web/frontend',
        'folder.rename.title': 'إعادة تسمية المجموعة',
        'folder.rename.hint': 'تحديث الاسم يعيد تسمية كل مساحات العمل داخل المجموعة',
        'folder.delete.body': 'هل تريد حذف المجموعة الفارغة «{name}»؟',
        'folder.error.empty': 'لا يمكن أن يكون مسار المجموعة فارغاً',
        'folder.error.exists': 'المجموعة موجودة بالفعل',
        'folder.error.notEmpty': 'لا تزال المجموعة تحتوي على مساحات عمل',
        'dir.new.title': 'New virtual folder',
        'dir.new.hint': 'Creates a grouping only — no folder on disk, no workspace touched',
        'dir.rename.title': 'Rename virtual folder',
        'dir.rename.hint': 'Renames the group only; real folders and workspaces are untouched',
        'dir.delete.title': 'Delete virtual folder',
        'dir.delete.body': 'Delete virtual folder "{name}" and all its subfolders? Real workspaces inside return to the root level; no folder on disk is deleted.',
        'dir.moveTo': 'Move into folder…',
        'dir.rootLevel': '(root level)',
      },
      /* locale: de */
      'de': {
        'title': 'Arbeitsbereiche',
        'add': 'Arbeitsbereich hinzufügen',
        'create': 'Erstellen',
        'rail.add': 'Arbeitsbereich hinzufügen',
        'menu.newSubWorkspace': 'Unterarbeitsbereich anlegen',
        'flow.title': 'Arbeitsbereich hinzufügen',
        'flow.picked': 'Gewählter Ordner',
        'flow.parent': 'Übergeordnete Gruppe',
        'flow.parentHint': 'Gruppenpfad eingeben oder auswählen, leer bedeutet Wurzel; Ebenen mit / trennen',
        'flow.creating': 'Wird erstellt…',
        'flow.parentDir': 'Übergeordnetes virtuelles Verzeichnis',
        'flow.parentDirHint': 'The workspace is filed under the chosen virtual directory; the root level leaves it ungrouped. With no directories yet, create one from the sidebar toolbar first.',
        'browse.title': 'Arbeitsbereichsordner wählen',
        'browse.home': 'Home',
        'browse.newFolder': 'Neuer Ordner',
        'browse.folderName': 'Ordnername',
        'browse.showHidden': 'Versteckte Dateien anzeigen',
        'browse.loading': 'Wird geladen…',
        'browse.truncated': 'Zu viele Ordner; nur der Anfang wird angezeigt.',
        'browse.editPath': 'Pfad bearbeiten',
        'browse.open': 'Open',
        'browse.createIn': 'Create in "{name}"',
        'browse.untitledFolder': 'New folder',
        'search.placeholder': 'Arbeitsbereiche oder Sitzungen suchen',
        'rail.search': 'Suchen',
        'empty': 'Noch keine Arbeitsbereiche',
        'empty.search': 'Keine Treffer',
        'session.new': 'Neue Sitzung',
        'group.ungrouped': 'Ohne Gruppe',
        'session.more': '… {n} more in history',
        'session.more.less': 'Collapse history',
        'session.more.title': 'Shows only the last 7 days, up to 5 items; click to reveal the other {n}',
        'sessions.expand': '{n} Sitzungen einblenden',
        'sessions.collapse': 'Einklappen',
        'time.now': 'gerade eben',
        'time.minutes': '{n} Min.',
        'time.hours': '{n} Std.',
        'time.days': '{n} T.',
        'time.months': '{n} Mon.',
        'time.years': '{n} J.',
        'status.running': 'Wird generiert',
        'status.completed': 'Abgeschlossen',
        'status.approval': 'Wartet auf Freigabe',
        'status.planReview': 'Wartet auf Planprüfung',
        'status.question': 'Wartet auf Antwort',
        'status.subagents': '{n} Unteragenten aktiv',
        'status.compact.approval': 'Freigabe',
        'status.compact.answer': 'Antwort',
        'status.compact.planReview': 'Planprüfung',
        'schedule.active': 'Aktive geplante Aufgabe',
        'menu.rename': 'Umbenennen',
        'menu.openWsFolder': 'Arbeitsbereichsordner öffnen',
        'menu.copyPath': 'Pfad kopieren',
        'path.copied': 'Pfad kopiert',
        'path.none': 'Dieser Arbeitsbereich hat keinen Ordnerpfad',
        'menu.delete': 'Löschen',
        'menu.fork': 'Abzweigen',
        'menu.archive': 'Archivieren',
        'menu.newSubfolder': 'Neuer Unterordner',
        'menu.renameFolder': 'Ordner umbenennen',
        'menu.removeFolder': 'Ordner löschen',
        'menu.renameSgroup': 'Sitzungsgruppe umbenennen',
        'settings.title': 'Bessere Arbeitsbereiche',
        'settings.desc': 'Aussehen und Einklappverhalten des Arbeitsbereich-Baums',
        'settings.expand': 'Ausklappen',
        'settings.collapse': 'Einklappen',
        'settings.compactChains': 'Einzelketten zusammenfassen',
        'settings.compactChains.hint': 'Ebenen mit genau einem Kind werden zu einer Zeile zusammengefasst; bei mehreren Kindern klappt der Baum auf; beim Ziehen eines Arbeitsbereichs klappen die Ketten vorübergehend zum Ordnerbaum auf, sodass jede Ebene als Ziel dient; Klappzustand und eigenes Aussehen bleiben in diesem Browser gespeichert.',
        'settings.statusPulse': 'Status-Pulslicht',
        'settings.statusPulse.hint': 'Vom Einklappen verdeckte Statuspunkte (fertig grün / läuft blau / wartet amber) steigen die Hierarchie hinauf: Arbeitsbereich- und Ordnerzeilen lassen ihr Symbol in der Statusfarbe pulsieren (eigens gefärbte Titel pulsieren mit), Sitzungsgruppen zeigen einen pulsierenden Statuspunkt; standardmäßig an, hier abschaltbar.',
        'settings.appearance': 'Standardaussehen',
        'settings.appearance.hint': 'Zeilen ohne eigene Anpassung nutzen dieses Aussehen; die Textkontur ist standardmäßig an – ohne sie ist Text über einem Hintergrundbild oft kaum lesbar. Bleibt die Farbe leer, folgt sie dem Thema.',
        'settings.appearance.reset': 'Standard wiederherstellen',
        'custom.title': 'Aussehen anpassen',
        'custom.color': 'Farbe',
        'custom.glow': 'Leuchten',
        'custom.preview': 'Live-Vorschau',
        'custom.preview.sample': 'Beispiel-Arbeitsbereich',
        'custom.weight': 'Schriftstärke',
        'custom.weight.regular': 'Normal',
        'custom.weight.medium': 'Mittel',
        'custom.weight.semibold': 'Halbfett',
        'custom.weight.bold': 'Fett',
        'custom.shadow': 'Textschatten',
        'custom.stroke': 'Textkontur',
        'custom.stroke.hint': 'Die Kontur ist standardmäßig grau; wählbar sind Schwarz / Weiß / eine beliebige Farbe oder „Automatisch“, das aus der Textfarbe den Gegenpol ableitet (helle Schrift bekommt eine schwarze Kante, dunkle eine weiße); Automatik folgt dem Hell/Dunkel des Themas und eines Hintergrund-Plugins.',
        'custom.strokeWidth': 'Konturstärke',
        'custom.strokeColor': 'Konturfarbe',
        'custom.strokeColor.auto': 'Automatisch',
        'custom.weak': 'Schwach',
        'custom.medium': 'Mittel',
        'custom.strong': 'Stark',
        'custom.icon': 'Symbol',
        'custom.icon.solid': 'Gefüllter Ordner',
        'custom.icon.outline': 'Umriss-Ordner',
        'custom.icon.none': 'Ausgeblendet',
        'custom.none': 'Keins',
        'custom.reset': 'Anpassung entfernen',
        'custom.done': 'Fertig',
        'settings.on': 'An',
        'settings.off': 'Aus',
        'sync.title': 'Geräteübergreifende Synchronisierung',
        'sync.desc': 'Aussehen, ausdrückliche Ordner und Schalter liegen im Browser dieses Geräts; über den Host-Einstellungsspeicher werden sie mit der anderen Seite (Web / Desktop-App) ausgetauscht. Neue Änderungen gehen automatisch an den Host, die andere Seite muss nur „Abrufen“; Daten aus älteren Versionen brauchen einmalig „Senden“.',
        'sync.mode.overwrite': 'Dieses Gerät überschreiben',
        'sync.mode.merge': 'Beide Seiten zusammenführen',
        'sync.pull.desktop': 'Von der Desktop-App abrufen',
        'sync.pull.web': 'Aus dem Web abrufen',
        'sync.push': 'Daten dieses Geräts senden',
        'sync.done': 'Synchronisiert',
        'sync.empty': 'Auf der anderen Seite liegen noch keine Daten',
        'sync.off': 'Hier nicht verfügbar (erfordert den Host-Einstellungsdienst)',
        'sync.loading': 'Verbindung zum Host-Einstellungsspeicher…',
        'error.title': 'Etwas ist schiefgelaufen',
        'cancel': 'Abbrechen',
        'confirm': 'OK',
        'close': 'Schließen',
        'ws.rename.title': 'Arbeitsbereich umbenennen',
        'ws.rename.hint': 'Ein / im Namen bildet die Gruppenebene, z. B. web/frontend',
        'ws.delete.title': 'Arbeitsbereich löschen',
        'ws.delete.body': 'Nur die Registrierung wird entfernt; Verzeichnis und Sitzungsprotokolle bleiben erhalten. „{name}“ löschen?',
        'folder.new.title': 'Neuer Ordner',
        'folder.new.hint': 'Ordnerpfad; Ebenen mit /, z. B. web/frontend',
        'folder.rename.title': 'Ordner umbenennen',
        'folder.rename.hint': 'Umbenennen aktualisiert alle Arbeitsbereichsnamen im Ordner',
        'folder.delete.body': 'Leeren Ordner „{name}“ löschen?',
        'folder.error.empty': 'Der Ordnerpfad darf nicht leer sein',
        'folder.error.exists': 'Ordner existiert bereits',
        'folder.error.notEmpty': 'Der Ordner enthält noch Arbeitsbereiche',
        'dir.new.title': 'New virtual folder',
        'dir.new.hint': 'Creates a grouping only — no folder on disk, no workspace touched',
        'dir.rename.title': 'Rename virtual folder',
        'dir.rename.hint': 'Renames the group only; real folders and workspaces are untouched',
        'dir.delete.title': 'Delete virtual folder',
        'dir.delete.body': 'Delete virtual folder "{name}" and all its subfolders? Real workspaces inside return to the root level; no folder on disk is deleted.',
        'dir.moveTo': 'Move into folder…',
        'dir.rootLevel': '(root level)',
      },
      /* locale: fr */
      'fr': {
        'title': 'Espaces de travail',
        'add': 'Ajouter un espace de travail',
        'create': 'Créer',
        'rail.add': 'Ajouter un espace de travail',
        'menu.newSubWorkspace': 'Nouvel espace de travail ici',
        'flow.title': 'Ajouter un espace de travail',
        'flow.picked': 'Dossier choisi',
        'flow.parent': 'Groupe parent',
        'flow.parentHint': 'Saisissez ou choisissez un chemin de groupe; vide = racine; niveaux séparés par /',
        'flow.creating': 'Création…',
        'flow.parentDir': 'Répertoire virtuel parent',
        'flow.parentDirHint': 'The workspace is filed under the chosen virtual directory; the root level leaves it ungrouped. With no directories yet, create one from the sidebar toolbar first.',
        'browse.title': 'Choisir le dossier de l’espace de travail',
        'browse.home': 'Dossier personnel',
        'browse.newFolder': 'Nouveau dossier',
        'browse.folderName': 'Nom du dossier',
        'browse.showHidden': 'Afficher les fichiers cachés',
        'browse.loading': 'Chargement…',
        'browse.truncated': 'Trop de dossiers ; seul le début est affiché.',
        'browse.editPath': 'Modifier le chemin',
        'browse.open': 'Open',
        'browse.createIn': 'Create in "{name}"',
        'browse.untitledFolder': 'New folder',
        'search.placeholder': 'Rechercher un espace de travail ou une session',
        'rail.search': 'Rechercher',
        'empty': 'Aucun espace de travail',
        'empty.search': 'Aucun résultat',
        'session.new': 'Nouvelle session',
        'group.ungrouped': 'Sans groupe',
        'session.more': '… {n} more in history',
        'session.more.less': 'Collapse history',
        'session.more.title': 'Shows only the last 7 days, up to 5 items; click to reveal the other {n}',
        'sessions.expand': 'Afficher {n} sessions',
        'sessions.collapse': 'Réduire',
        'time.now': 'à l\'instant',
        'time.minutes': '{n} min',
        'time.hours': '{n} h',
        'time.days': '{n} j',
        'time.months': '{n} mois',
        'time.years': '{n} an(s)',
        'status.running': 'Génération en cours',
        'status.completed': 'Terminé',
        'status.approval': 'En attente d\'approbation',
        'status.planReview': 'En attente de validation du plan',
        'status.question': 'En attente de réponse',
        'status.subagents': '{n} sous-agents en cours',
        'status.compact.approval': 'Approbation',
        'status.compact.answer': 'Réponse',
        'status.compact.planReview': 'Plan',
        'schedule.active': 'Tâche planifiée active',
        'menu.rename': 'Renommer',
        'menu.openWsFolder': 'Ouvrir le dossier de l’espace de travail',
        'menu.copyPath': 'Copier le chemin',
        'path.copied': 'Chemin copié',
        'path.none': 'Cet espace de travail n’a pas de chemin de dossier',
        'menu.delete': 'Supprimer',
        'menu.fork': 'Bifurquer',
        'menu.archive': 'Archiver',
        'menu.newSubfolder': 'Nouveau sous-dossier',
        'menu.renameFolder': 'Renommer le dossier',
        'menu.removeFolder': 'Supprimer le dossier',
        'menu.renameSgroup': 'Renommer le groupe de sessions',
        'settings.title': 'Espaces de travail améliorés',
        'settings.desc': 'Apparence et repli de l\'arborescence des espaces de travail',
        'settings.expand': 'Développer',
        'settings.collapse': 'Réduire',
        'settings.compactChains': 'Fusionner les chaînes à un seul enfant',
        'settings.compactChains.hint': 'Les niveaux à un seul enfant se fusionnent en une ligne; dès qu\'il y a plusieurs enfants, l\'arborescence se déploie; pendant le glisser-déposer d\'un espace de travail, les chaînes se déploient temporairement en dossiers pour permettre le dépôt à n\'importe quel niveau; l\'état déplié et l\'apparence personnalisée sont conservés dans ce navigateur.',
        'settings.statusPulse': 'Voyant d\'état pulsant',
        'settings.statusPulse.hint': 'Les voyants masqués par le repli (terminé vert / en cours bleu / en attente ambre) remontent la hiérarchie: les lignes d\'espace de travail et de dossier font pulser leur icône dans la couleur d\'état (les titres à lueur personnalisée pulsent aussi), les lignes de groupe de sessions affichent un voyant pulsant; activé par défaut, désactivable ici.',
        'settings.appearance': 'Apparence par défaut',
        'settings.appearance.hint': 'Les lignes sans personnalisation utilisent cette apparence; le contour du texte est activé par défaut — sans lui, le texte reste souvent illisible sur une image de fond. Laissez la couleur vide pour suivre le thème.',
        'settings.appearance.reset': 'Rétablir l\'apparence par défaut',
        'custom.title': 'Personnaliser l\'apparence',
        'custom.color': 'Couleur',
        'custom.glow': 'Lueur',
        'custom.preview': 'Aperçu en direct',
        'custom.preview.sample': 'Exemple d\'espace de travail',
        'custom.weight': 'Graisse de la police',
        'custom.weight.regular': 'Normal',
        'custom.weight.medium': 'Moyen',
        'custom.weight.semibold': 'Semi-gras',
        'custom.weight.bold': 'Gras',
        'custom.shadow': 'Ombre du texte',
        'custom.stroke': 'Contour du texte',
        'custom.stroke.hint': 'Le contour est gris par défaut; choisissez noir / blanc / une couleur quelconque, ou « Auto » pour dériver le pôle contrasté de la couleur du texte (texte clair: liseré noir, texte foncé: liseré blanc); Auto suit le thème et le passage clair/sombre d\'un plugin d\'arrière-plan.',
        'custom.strokeWidth': 'Épaisseur du contour',
        'custom.strokeColor': 'Couleur du contour',
        'custom.strokeColor.auto': 'Auto',
        'custom.weak': 'Faible',
        'custom.medium': 'Moyen',
        'custom.strong': 'Fort',
        'custom.icon': 'Icône',
        'custom.icon.solid': 'Dossier plein',
        'custom.icon.outline': 'Dossier vide',
        'custom.icon.none': 'Masquée',
        'custom.none': 'Aucune',
        'custom.reset': 'Effacer la personnalisation',
        'custom.done': 'Terminé',
        'settings.on': 'Activé',
        'settings.off': 'Désactivé',
        'sync.title': 'Synchronisation entre appareils',
        'sync.desc': 'L\'apparence, les dossiers explicites et les interrupteurs vivent dans le navigateur de cet appareil; ils s\'échangent avec l\'autre environnement (web / application de bureau) via le stockage de réglages de l\'hôte. Les nouvelles modifications sont écrites automatiquement dans l\'hôte, l\'autre côté n\'a qu\'à « Récupérer »; les données des anciennes versions demandent un premier « Envoyer ».',
        'sync.mode.overwrite': 'Écraser cet appareil',
        'sync.mode.merge': 'Fusionner les deux côtés',
        'sync.pull.desktop': 'Récupérer depuis l\'application de bureau',
        'sync.pull.web': 'Récupérer depuis le web',
        'sync.push': 'Envoyer les données de cet appareil',
        'sync.done': 'Synchronisé',
        'sync.empty': 'Aucune donnée à récupérer de l\'autre côté',
        'sync.off': 'Synchronisation indisponible ici (service de réglages de l\'hôte requis)',
        'sync.loading': 'Connexion aux réglages de l\'hôte…',
        'error.title': 'Une erreur est survenue',
        'cancel': 'Annuler',
        'confirm': 'OK',
        'close': 'Fermer',
        'ws.rename.title': 'Renommer l\'espace de travail',
        'ws.rename.hint': 'Un / dans le nom crée le groupe, par ex. web/frontend',
        'ws.delete.title': 'Supprimer l\'espace de travail',
        'ws.delete.body': 'Seule l\'inscription est supprimée; le dossier et les journaux de session sont conservés. Supprimer « {name} » ?',
        'folder.new.title': 'Nouveau dossier',
        'folder.new.hint': 'Chemin du dossier; niveaux séparés par /, par ex. web/frontend',
        'folder.rename.title': 'Renommer le dossier',
        'folder.rename.hint': 'Le renommage met à jour tous les espaces de travail du dossier',
        'folder.delete.body': 'Supprimer le dossier vide « {name} » ?',
        'folder.error.empty': 'Le chemin du dossier ne doit pas être vide',
        'folder.error.exists': 'Ce dossier existe déjà',
        'folder.error.notEmpty': 'Le dossier contient encore des espaces de travail',
        'dir.new.title': 'New virtual folder',
        'dir.new.hint': 'Creates a grouping only — no folder on disk, no workspace touched',
        'dir.rename.title': 'Rename virtual folder',
        'dir.rename.hint': 'Renames the group only; real folders and workspaces are untouched',
        'dir.delete.title': 'Delete virtual folder',
        'dir.delete.body': 'Delete virtual folder "{name}" and all its subfolders? Real workspaces inside return to the root level; no folder on disk is deleted.',
        'dir.moveTo': 'Move into folder…',
        'dir.rootLevel': '(root level)',
      },
      /* locale: hi */
      'hi': {
        'title': 'कार्यस्थान',
        'add': 'कार्यस्थान जोड़ें',
        'create': 'बनाएँ',
        'rail.add': 'कार्यस्थान जोड़ें',
        'menu.newSubWorkspace': 'यहाँ उप-कार्यस्थान',
        'flow.title': 'कार्यस्थान जोड़ें',
        'flow.picked': 'चुना गया फ़ोल्डर',
        'flow.parent': 'संबंधित समूह',
        'flow.parentHint': 'समूह पथ लिखें या चुनें; खाली का अर्थ मूल है; कई स्तर / से अलग करें',
        'flow.creating': 'बनाया जा रहा है…',
        'flow.parentDir': 'मूल वर्चुअल निर्देशिका',
        'flow.parentDirHint': 'The workspace is filed under the chosen virtual directory; the root level leaves it ungrouped. With no directories yet, create one from the sidebar toolbar first.',
        'browse.title': 'कार्यस्थान फ़ोल्डर चुनें',
        'browse.home': 'होम',
        'browse.newFolder': 'नया फ़ोल्डर',
        'browse.folderName': 'फ़ोल्डर का नाम',
        'browse.showHidden': 'छिपी फ़ाइलें दिखाएँ',
        'browse.loading': 'लोड हो रहा है…',
        'browse.truncated': 'बहुत अधिक फ़ोल्डर; केवल शुरुआत दिखाई गई है।',
        'browse.editPath': 'पथ संपादित करें',
        'browse.open': 'Open',
        'browse.createIn': 'Create in "{name}"',
        'browse.untitledFolder': 'New folder',
        'search.placeholder': 'कार्यस्थान या सत्र खोजें',
        'rail.search': 'खोजें',
        'empty': 'अभी कोई कार्यस्थान नहीं',
        'empty.search': 'कोई मेल खाता परिणाम नहीं',
        'session.new': 'नया सत्र',
        'group.ungrouped': 'बिना समूह',
        'session.more': '… {n} more in history',
        'session.more.less': 'Collapse history',
        'session.more.title': 'Shows only the last 7 days, up to 5 items; click to reveal the other {n}',
        'sessions.expand': '{n} सत्र दिखाएँ',
        'sessions.collapse': 'समेटें',
        'time.now': 'अभी-अभी',
        'time.minutes': '{n} मिनट',
        'time.hours': '{n} घंटे',
        'time.days': '{n} दिन',
        'time.months': '{n} महीने',
        'time.years': '{n} वर्ष',
        'status.running': 'बन रहा है',
        'status.completed': 'पूर्ण',
        'status.approval': 'स्वीकृति की प्रतीक्षा',
        'status.planReview': 'योजना पुष्टि की प्रतीक्षा',
        'status.question': 'उत्तर की प्रतीक्षा',
        'status.subagents': '{n} उप-एजेंट चल रहे हैं',
        'status.compact.approval': 'स्वीकृति',
        'status.compact.answer': 'उत्तर',
        'status.compact.planReview': 'योजना',
        'schedule.active': 'सक्रिय निर्धारित कार्य मौजूद',
        'menu.rename': 'नाम बदलें',
        'menu.openWsFolder': 'कार्यस्थान फ़ोल्डर खोलें',
        'menu.copyPath': 'पथ कॉपी करें',
        'path.copied': 'पथ कॉपी किया गया',
        'path.none': 'इस कार्यस्थान का कोई फ़ोल्डर पथ नहीं है',
        'menu.delete': 'हटाएँ',
        'menu.fork': 'शाखा बनाएँ',
        'menu.archive': 'संग्रह करें',
        'menu.newSubfolder': 'नया उप-फ़ोल्डर',
        'menu.renameFolder': 'फ़ोल्डर का नाम बदलें',
        'menu.removeFolder': 'फ़ोल्डर हटाएँ',
        'menu.renameSgroup': 'सत्र समूह का नाम बदलें',
        'settings.title': 'बेहतर कार्यस्थान',
        'settings.desc': 'कार्यस्थान वृक्ष का रूप और समेटने की प्राथमिकताएँ',
        'settings.expand': 'फैलाएँ',
        'settings.collapse': 'समेटें',
        'settings.compactChains': 'एकल-संतान श्रृंखलाएँ मिलाएँ',
        'settings.compactChains.hint': 'जिन स्तरों पर केवल एक संतान होती है वे एक पंक्ति में मिल जाते हैं; कई संतानें होने पर वृक्ष खुल जाता है; कार्यस्थान खींचते समय श्रृंखलाएँ अस्थायी रूप से फ़ोल्डरों में खुल जाती हैं ताकि किसी भी स्तर पर छोड़ा जा सके; खुलने की स्थिति और अनुकूलित रूप इसी ब्राउज़र में सहेजे जाते हैं।',
        'settings.statusPulse': 'स्थिति की साँस लेती बत्ती',
        'settings.statusPulse.hint': 'समेटने से छिपी स्थिति बत्तियाँ (पूर्ण हरी / चल रहा नीली / प्रतीक्षारत अंबर) पदानुक्रम में ऊपर उठती हैं: कार्यस्थान और फ़ोल्डर पंक्तियों का चिह्न स्थिति के रंग में साँस लेता है (अनुकूलित चमक वाले शीर्षक भी साथ साँस लेते हैं), सत्र समूह पंक्तियों पर साँस लेता स्थिति बिंदु दिखता है; डिफ़ॉल्ट रूप से चालू, यहाँ बंद किया जा सकता है।',
        'settings.appearance': 'डिफ़ॉल्ट रूप',
        'settings.appearance.hint': 'जिन पंक्तियों को अलग से अनुकूलित नहीं किया गया वे यह रूप इस्तेमाल करती हैं; पाठ की रूपरेखा डिफ़ॉल्ट रूप से चालू है — पृष्ठभूमि छवि पर बिना रूपरेखा वाला पाठ अक्सर पढ़ा नहीं जाता। रंग खाली छोड़ने पर वह थीम का अनुसरण करता है।',
        'settings.appearance.reset': 'डिफ़ॉल्ट रूप पर लौटें',
        'custom.title': 'रूप अनुकूलित करें',
        'custom.color': 'रंग',
        'custom.glow': 'चमक',
        'custom.preview': 'लाइव पूर्वावलोकन',
        'custom.preview.sample': 'नमूना कार्यस्थान',
        'custom.weight': 'अक्षर की मोटाई',
        'custom.weight.regular': 'सामान्य',
        'custom.weight.medium': 'मध्यम',
        'custom.weight.semibold': 'अर्ध-मोटा',
        'custom.weight.bold': 'मोटा',
        'custom.shadow': 'पाठ की छाया',
        'custom.stroke': 'पाठ की रूपरेखा',
        'custom.stroke.hint': 'रूपरेखा डिफ़ॉल्ट रूप से धूसर है; इसे काला / सफ़ेद / कोई भी रंग बनाया जा सकता है, या «स्वतः» चुनकर पाठ के रंग से विपरीत रंग निकाला जा सकता है (हल्के पाठ पर काला किनारा, गहरे पाठ पर सफ़ेद); स्वतः मोड थीम और पृष्ठभूमि प्लगइन के उजले/गहरे बदलाव का अनुसरण करता है।',
        'custom.strokeWidth': 'रूपरेखा की मोटाई',
        'custom.strokeColor': 'रूपरेखा का रंग',
        'custom.strokeColor.auto': 'स्वतः',
        'custom.weak': 'हल्का',
        'custom.medium': 'मध्यम',
        'custom.strong': 'तीव्र',
        'custom.icon': 'चिह्न',
        'custom.icon.solid': 'भरा फ़ोल्डर',
        'custom.icon.outline': 'रूपरेखा फ़ोल्डर',
        'custom.icon.none': 'छिपा हुआ',
        'custom.none': 'कुछ नहीं',
        'custom.reset': 'अनुकूलन हटाएँ',
        'custom.done': 'हो गया',
        'settings.on': 'चालू',
        'settings.off': 'बंद',
        'sync.title': 'उपकरणों के बीच समन्वयन',
        'sync.desc': 'अनुकूलित रूप, स्पष्ट फ़ोल्डर और स्विच इस उपकरण के ब्राउज़र में रहते हैं; वे होस्ट सेटिंग भंडार के ज़रिए दूसरे सिरे (वेब / डेस्कटॉप ऐप) से अदल-बदल होते हैं। नए बदलाव अपने-आप होस्ट में लिखे जाते हैं, दूसरे सिरे को केवल «प्राप्त करें» दबाना है; पुराने संस्करण का डेटा एक बार «भेजें» माँगता है।',
        'sync.mode.overwrite': 'इस उपकरण को अधिलेखित करें',
        'sync.mode.merge': 'दोनों सिरे मिलाएँ',
        'sync.pull.desktop': 'डेस्कटॉप ऐप से प्राप्त करें',
        'sync.pull.web': 'वेब से प्राप्त करें',
        'sync.push': 'इस उपकरण का डेटा भेजें',
        'sync.done': 'समन्वित',
        'sync.empty': 'दूसरे सिरे पर अभी कोई डेटा नहीं',
        'sync.off': 'यहाँ समन्वयन उपलब्ध नहीं (होस्ट सेटिंग सेवा चाहिए)',
        'sync.loading': 'होस्ट सेटिंग से जुड़ रहे हैं…',
        'error.title': 'कुछ गड़बड़ हो गई',
        'cancel': 'रद्द करें',
        'confirm': 'ठीक है',
        'close': 'बंद करें',
        'ws.rename.title': 'कार्यस्थान का नाम बदलें',
        'ws.rename.hint': 'नाम में / समूह स्तर बनाता है, जैसे web/frontend',
        'ws.delete.title': 'कार्यस्थान हटाएँ',
        'ws.delete.body': 'केवल पंजीकरण हटता है; निर्देशिका और सत्र लॉग बने रहते हैं। «{name}» हटाएँ?',
        'folder.new.title': 'नया समूह',
        'folder.new.hint': 'समूह पथ; कई स्तरों के लिए /, जैसे web/frontend',
        'folder.rename.title': 'समूह का नाम बदलें',
        'folder.rename.hint': 'नाम बदलने पर समूह के सभी कार्यस्थानों के नाम भी बदल जाते हैं',
        'folder.delete.body': 'खाली समूह «{name}» हटाएँ?',
        'folder.error.empty': 'समूह पथ खाली नहीं हो सकता',
        'folder.error.exists': 'समूह पहले से मौजूद है',
        'folder.error.notEmpty': 'समूह में अभी भी कार्यस्थान हैं',
        'dir.new.title': 'New virtual folder',
        'dir.new.hint': 'Creates a grouping only — no folder on disk, no workspace touched',
        'dir.rename.title': 'Rename virtual folder',
        'dir.rename.hint': 'Renames the group only; real folders and workspaces are untouched',
        'dir.delete.title': 'Delete virtual folder',
        'dir.delete.body': 'Delete virtual folder "{name}" and all its subfolders? Real workspaces inside return to the root level; no folder on disk is deleted.',
        'dir.moveTo': 'Move into folder…',
        'dir.rootLevel': '(root level)',
      },
      /* locale: id */
      'id': {
        'title': 'Ruang kerja',
        'add': 'Tambah ruang kerja',
        'create': 'Buat',
        'rail.add': 'Tambah ruang kerja',
        'menu.newSubWorkspace': 'Ruang kerja baru di sini',
        'flow.title': 'Tambah ruang kerja',
        'flow.picked': 'Folder terpilih',
        'flow.parent': 'Grup induk',
        'flow.parentHint': 'Ketik atau pilih jalur grup; kosong = akar; tingkat dipisah dengan /',
        'flow.creating': 'Membuat…',
        'flow.parentDir': 'Direktori virtual induk',
        'flow.parentDirHint': 'The workspace is filed under the chosen virtual directory; the root level leaves it ungrouped. With no directories yet, create one from the sidebar toolbar first.',
        'browse.title': 'Pilih folder ruang kerja',
        'browse.home': 'Beranda',
        'browse.newFolder': 'Folder baru',
        'browse.folderName': 'Nama folder',
        'browse.showHidden': 'Tampilkan file tersembunyi',
        'browse.loading': 'Memuat…',
        'browse.truncated': 'Terlalu banyak folder; hanya bagian awal yang ditampilkan.',
        'browse.editPath': 'Edit jalur',
        'browse.open': 'Open',
        'browse.createIn': 'Create in "{name}"',
        'browse.untitledFolder': 'New folder',
        'search.placeholder': 'Cari ruang kerja atau sesi',
        'rail.search': 'Cari',
        'empty': 'Belum ada ruang kerja',
        'empty.search': 'Tidak ada hasil yang cocok',
        'session.new': 'Sesi baru',
        'group.ungrouped': 'Tanpa grup',
        'session.more': '… {n} more in history',
        'session.more.less': 'Collapse history',
        'session.more.title': 'Shows only the last 7 days, up to 5 items; click to reveal the other {n}',
        'sessions.expand': 'Tampilkan {n} sesi',
        'sessions.collapse': 'Ciutkan',
        'time.now': 'baru saja',
        'time.minutes': '{n} mnt',
        'time.hours': '{n} jam',
        'time.days': '{n} hr',
        'time.months': '{n} bln',
        'time.years': '{n} thn',
        'status.running': 'Sedang dibuat',
        'status.completed': 'Selesai',
        'status.approval': 'Menunggu persetujuan',
        'status.planReview': 'Menunggu konfirmasi rencana',
        'status.question': 'Menunggu jawaban',
        'status.subagents': '{n} subagen berjalan',
        'status.compact.approval': 'Persetujuan',
        'status.compact.answer': 'Jawaban',
        'status.compact.planReview': 'Rencana',
        'schedule.active': 'Ada tugas terjadwal yang aktif',
        'menu.rename': 'Ganti nama',
        'menu.openWsFolder': 'Buka folder ruang kerja',
        'menu.copyPath': 'Salin jalur',
        'path.copied': 'Jalur disalin',
        'path.none': 'Ruang kerja ini tidak memiliki jalur folder',
        'menu.delete': 'Hapus',
        'menu.fork': 'Cabangkan',
        'menu.archive': 'Arsipkan',
        'menu.newSubfolder': 'Subfolder baru',
        'menu.renameFolder': 'Ganti nama folder',
        'menu.removeFolder': 'Hapus folder',
        'menu.renameSgroup': 'Ganti nama grup sesi',
        'settings.title': 'Ruang kerja yang lebih baik',
        'settings.desc': 'Tampilan dan pelipatan pohon ruang kerja',
        'settings.expand': 'Bentangkan',
        'settings.collapse': 'Ciutkan',
        'settings.compactChains': 'Gabungkan rantai beranak tunggal',
        'settings.compactChains.hint': 'Tingkat yang hanya punya satu anak digabung jadi satu baris; bila anaknya banyak, pohon terbentang; saat menyeret ruang kerja, rantai sementara terbentang kembali jadi folder sehingga bisa dijatuhkan di tingkat mana pun; status terbentang dan tampilan khusus disimpan di browser ini.',
        'settings.statusPulse': 'Lampu status bernapas',
        'settings.statusPulse.hint': 'Lampu status yang tersembunyi karena pelipatan (selesai hijau / berjalan biru / menunggu kuning) menggelembung ke tingkat atas: baris ruang kerja dan folder membuat ikonnya bernapas dalam warna status (judul dengan pendar khusus ikut bernapas), baris grup sesi menampilkan titik status yang bernapas; aktif secara bawaan, bisa dimatikan di sini.',
        'settings.appearance': 'Tampilan bawaan',
        'settings.appearance.hint': 'Baris yang belum disesuaikan memakai tampilan ini; garis luar teks aktif secara bawaan — tanpa itu teks sering tak terbaca di atas gambar latar. Biarkan warna kosong agar mengikuti tema.',
        'settings.appearance.reset': 'Kembalikan tampilan bawaan',
        'custom.title': 'Sesuaikan tampilan',
        'custom.color': 'Warna',
        'custom.glow': 'Pendar',
        'custom.preview': 'Pratinjau langsung',
        'custom.preview.sample': 'Contoh ruang kerja',
        'custom.weight': 'Ketebalan huruf',
        'custom.weight.regular': 'Normal',
        'custom.weight.medium': 'Sedang',
        'custom.weight.semibold': 'Semi tebal',
        'custom.weight.bold': 'Tebal',
        'custom.shadow': 'Bayangan teks',
        'custom.stroke': 'Garis luar teks',
        'custom.stroke.hint': 'Garis luar bawaannya abu-abu; bisa diganti hitam / putih / warna apa pun, atau «Otomatis» untuk menurunkan kutub kontras dari warna teks (teks terang dapat tepi hitam, teks gelap dapat tepi putih); Otomatis mengikuti tema dan pergantian terang/gelap plugin latar.',
        'custom.strokeWidth': 'Ketebalan garis luar',
        'custom.strokeColor': 'Warna garis luar',
        'custom.strokeColor.auto': 'Otomatis',
        'custom.weak': 'Lemah',
        'custom.medium': 'Sedang',
        'custom.strong': 'Kuat',
        'custom.icon': 'Ikon',
        'custom.icon.solid': 'Folder penuh',
        'custom.icon.outline': 'Folder bergaris',
        'custom.icon.none': 'Tersembunyi',
        'custom.none': 'Tidak ada',
        'custom.reset': 'Hapus penyesuaian',
        'custom.done': 'Selesai',
        'settings.on': 'Aktif',
        'settings.off': 'Nonaktif',
        'sync.title': 'Sinkronisasi antar perangkat',
        'sync.desc': 'Tampilan, folder eksplisit, dan tombol simpan di browser perangkat ini; ditukar dengan sisi lain (web / aplikasi desktop) lewat penyimpanan pengaturan host. Perubahan baru otomatis ditulis ke host, sisi lain cukup menekan «Ambil»; data dari versi lama perlu sekali «Kirim».',
        'sync.mode.overwrite': 'Timpa perangkat ini',
        'sync.mode.merge': 'Gabungkan kedua sisi',
        'sync.pull.desktop': 'Ambil dari aplikasi desktop',
        'sync.pull.web': 'Ambil dari web',
        'sync.push': 'Kirim data perangkat ini',
        'sync.done': 'Tersinkron',
        'sync.empty': 'Sisi lain belum punya data',
        'sync.off': 'Sinkronisasi tidak tersedia di sini (perlu layanan pengaturan host)',
        'sync.loading': 'Menyambung ke pengaturan host…',
        'error.title': 'Terjadi kesalahan',
        'cancel': 'Batal',
        'confirm': 'OK',
        'close': 'Tutup',
        'ws.rename.title': 'Ganti nama ruang kerja',
        'ws.rename.hint': '/ di nama membentuk tingkat grup, mis. web/frontend',
        'ws.delete.title': 'Hapus ruang kerja',
        'ws.delete.body': 'Hanya pendaftarannya yang dihapus; direktori dan log sesi tetap ada. Hapus «{name}»?',
        'folder.new.title': 'Folder baru',
        'folder.new.hint': 'Jalur folder; tingkat dengan /, mis. web/frontend',
        'folder.rename.title': 'Ganti nama folder',
        'folder.rename.hint': 'Mengganti nama akan memperbarui semua ruang kerja di folder',
        'folder.delete.body': 'Hapus folder kosong «{name}»?',
        'folder.error.empty': 'Jalur folder tidak boleh kosong',
        'folder.error.exists': 'Folder sudah ada',
        'folder.error.notEmpty': 'Folder masih berisi ruang kerja',
        'dir.new.title': 'New virtual folder',
        'dir.new.hint': 'Creates a grouping only — no folder on disk, no workspace touched',
        'dir.rename.title': 'Rename virtual folder',
        'dir.rename.hint': 'Renames the group only; real folders and workspaces are untouched',
        'dir.delete.title': 'Delete virtual folder',
        'dir.delete.body': 'Delete virtual folder "{name}" and all its subfolders? Real workspaces inside return to the root level; no folder on disk is deleted.',
        'dir.moveTo': 'Move into folder…',
        'dir.rootLevel': '(root level)',
      },
      /* locale: it */
      'it': {
        'title': 'Aree di lavoro',
        'add': 'Aggiungi area di lavoro',
        'create': 'Crea',
        'rail.add': 'Aggiungi area di lavoro',
        'menu.newSubWorkspace': 'Nuova area di lavoro qui',
        'flow.title': 'Aggiungi area di lavoro',
        'flow.picked': 'Cartella scelta',
        'flow.parent': 'Gruppo di appartenenza',
        'flow.parentHint': 'Digita o scegli un percorso di gruppo; vuoto = radice; livelli separati da /',
        'flow.creating': 'Creazione…',
        'flow.parentDir': 'Cartella virtuale superiore',
        'flow.parentDirHint': 'The workspace is filed under the chosen virtual directory; the root level leaves it ungrouped. With no directories yet, create one from the sidebar toolbar first.',
        'browse.title': 'Scegli cartella dell’area di lavoro',
        'browse.home': 'Home',
        'browse.newFolder': 'Nuova cartella',
        'browse.folderName': 'Nome cartella',
        'browse.showHidden': 'Mostra file nascosti',
        'browse.loading': 'Caricamento…',
        'browse.truncated': 'Troppe cartelle; è mostrato solo l’inizio.',
        'browse.editPath': 'Modifica percorso',
        'browse.open': 'Open',
        'browse.createIn': 'Create in "{name}"',
        'browse.untitledFolder': 'New folder',
        'search.placeholder': 'Cerca aree di lavoro o sessioni',
        'rail.search': 'Cerca',
        'empty': 'Nessuna area di lavoro',
        'empty.search': 'Nessun risultato',
        'session.new': 'Nuova sessione',
        'group.ungrouped': 'Senza gruppo',
        'session.more': '… {n} more in history',
        'session.more.less': 'Collapse history',
        'session.more.title': 'Shows only the last 7 days, up to 5 items; click to reveal the other {n}',
        'sessions.expand': 'Mostra {n} sessioni',
        'sessions.collapse': 'Comprimi',
        'time.now': 'adesso',
        'time.minutes': '{n} min',
        'time.hours': '{n} h',
        'time.days': '{n} g',
        'time.months': '{n} mesi',
        'time.years': '{n} anni',
        'status.running': 'Generazione in corso',
        'status.completed': 'Completato',
        'status.approval': 'In attesa di approvazione',
        'status.planReview': 'In attesa di conferma del piano',
        'status.question': 'In attesa di risposta',
        'status.subagents': '{n} sotto-agenti in esecuzione',
        'status.compact.approval': 'Approvazione',
        'status.compact.answer': 'Risposta',
        'status.compact.planReview': 'Piano',
        'schedule.active': 'Attività pianificata attiva',
        'menu.rename': 'Rinomina',
        'menu.openWsFolder': 'Apri cartella area di lavoro',
        'menu.copyPath': 'Copia percorso',
        'path.copied': 'Percorso copiato',
        'path.none': 'Questa area di lavoro non ha un percorso di cartella',
        'menu.delete': 'Elimina',
        'menu.fork': 'Dirama',
        'menu.archive': 'Archivia',
        'menu.newSubfolder': 'Nuova sottocartella',
        'menu.renameFolder': 'Rinomina cartella',
        'menu.removeFolder': 'Elimina cartella',
        'menu.renameSgroup': 'Rinomina gruppo di sessioni',
        'settings.title': 'Aree di lavoro migliori',
        'settings.desc': 'Aspetto e compressione dell\'albero delle aree di lavoro',
        'settings.expand': 'Espandi',
        'settings.collapse': 'Comprimi',
        'settings.compactChains': 'Unisci le catene a figlio unico',
        'settings.compactChains.hint': 'I livelli con un solo figlio si fondono in una riga; con più figli l\'albero si espande; durante il trascinamento di un\'area di lavoro le catene si riespandono temporaneamente in cartelle, così puoi rilasciare su qualsiasi livello; stato di espansione e aspetto personalizzato restano in questo browser.',
        'settings.statusPulse': 'Spia di stato pulsante',
        'settings.statusPulse.hint': 'Le spie nascoste dalla compressione (completato verde / in esecuzione blu / in attesa ambra) risalgono la gerarchia: le righe di aree di lavoro e cartelle fanno pulsare l\'icona nel colore di stato (anche i titoli con bagliore personalizzato pulsano), le righe dei gruppi di sessioni mostrano una spia pulsante; attiva per impostazione predefinita, disattivabile qui.',
        'settings.appearance': 'Aspetto predefinito',
        'settings.appearance.hint': 'Le righe mai personalizzate usano questo aspetto; il contorno del testo è attivo per impostazione predefinita — senza di esso il testo è spesso illeggibile sopra un\'immagine di sfondo. Lascia il colore vuoto per seguire il tema.',
        'settings.appearance.reset': 'Ripristina l\'aspetto predefinito',
        'custom.title': 'Personalizza aspetto',
        'custom.color': 'Colore',
        'custom.glow': 'Bagliore',
        'custom.preview': 'Anteprima dal vivo',
        'custom.preview.sample': 'Area di lavoro di esempio',
        'custom.weight': 'Spessore del carattere',
        'custom.weight.regular': 'Normale',
        'custom.weight.medium': 'Medio',
        'custom.weight.semibold': 'Semigrassetto',
        'custom.weight.bold': 'Grassetto',
        'custom.shadow': 'Ombra del testo',
        'custom.stroke': 'Contorno del testo',
        'custom.stroke.hint': 'Il contorno è grigio per impostazione predefinita; puoi scegliere nero / bianco / un colore qualsiasi, oppure «Auto» per ricavare il polo contrastante dal colore del testo (testo chiaro: bordo nero, testo scuro: bordo bianco); Auto segue il tema e il passaggio chiaro/scuro di un plugin di sfondo.',
        'custom.strokeWidth': 'Spessore del contorno',
        'custom.strokeColor': 'Colore del contorno',
        'custom.strokeColor.auto': 'Auto',
        'custom.weak': 'Debole',
        'custom.medium': 'Medio',
        'custom.strong': 'Forte',
        'custom.icon': 'Icona',
        'custom.icon.solid': 'Cartella piena',
        'custom.icon.outline': 'Cartella vuota',
        'custom.icon.none': 'Nascosta',
        'custom.none': 'Nessuno',
        'custom.reset': 'Rimuovi personalizzazione',
        'custom.done': 'Fine',
        'settings.on': 'Attivo',
        'settings.off': 'Disattivo',
        'sync.title': 'Sincronizzazione tra dispositivi',
        'sync.desc': 'Aspetto, cartelle esplicite e interruttori vivono nel browser di questo dispositivo; si scambiano con l\'altro ambiente (web / app desktop) tramite l\'archivio impostazioni dell\'host. Le nuove modifiche vengono scritte automaticamente nell\'host, l\'altro lato deve solo «Scarica»; i dati delle versioni precedenti richiedono un primo «Invia».',
        'sync.mode.overwrite': 'Sovrascrivi questo dispositivo',
        'sync.mode.merge': 'Unisci i due lati',
        'sync.pull.desktop': 'Scarica dall\'app desktop',
        'sync.pull.web': 'Scarica dal web',
        'sync.push': 'Invia i dati di questo dispositivo',
        'sync.done': 'Sincronizzato',
        'sync.empty': 'Nessun dato da scaricare dall\'altro lato',
        'sync.off': 'Sincronizzazione non disponibile qui (serve il servizio impostazioni dell\'host)',
        'sync.loading': 'Connessione alle impostazioni dell\'host…',
        'error.title': 'Si è verificato un errore',
        'cancel': 'Annulla',
        'confirm': 'OK',
        'close': 'Chiudi',
        'ws.rename.title': 'Rinomina area di lavoro',
        'ws.rename.hint': 'La / nel nome crea il gruppo, ad es. web/frontend',
        'ws.delete.title': 'Elimina area di lavoro',
        'ws.delete.body': 'Viene rimossa solo la registrazione; cartella e registri delle sessioni restano. Eliminare «{name}»?',
        'folder.new.title': 'Nuova cartella',
        'folder.new.hint': 'Percorso della cartella; livelli separati da /, ad es. web/frontend',
        'folder.rename.title': 'Rinomina cartella',
        'folder.rename.hint': 'La rinomina aggiorna tutte le aree di lavoro nella cartella',
        'folder.delete.body': 'Eliminare la cartella vuota «{name}»?',
        'folder.error.empty': 'Il percorso della cartella non può essere vuoto',
        'folder.error.exists': 'La cartella esiste già',
        'folder.error.notEmpty': 'La cartella contiene ancora aree di lavoro',
        'dir.new.title': 'New virtual folder',
        'dir.new.hint': 'Creates a grouping only — no folder on disk, no workspace touched',
        'dir.rename.title': 'Rename virtual folder',
        'dir.rename.hint': 'Renames the group only; real folders and workspaces are untouched',
        'dir.delete.title': 'Delete virtual folder',
        'dir.delete.body': 'Delete virtual folder "{name}" and all its subfolders? Real workspaces inside return to the root level; no folder on disk is deleted.',
        'dir.moveTo': 'Move into folder…',
        'dir.rootLevel': '(root level)',
      },
      /* locale: ja */
      'ja': {
        'title': 'ワークスペース',
        'add': 'ワークスペースを追加',
        'create': '作成',
        'rail.add': 'ワークスペースを追加',
        'menu.newSubWorkspace': 'サブワークスペースを追加',
        'flow.title': 'ワークスペースを追加',
        'flow.picked': '選択したフォルダー',
        'flow.parent': '所属グループ',
        'flow.parentHint': 'グループのパスを入力または選択します,空欄はルート,階層は / で区切ります',
        'flow.creating': '作成中…',
        'flow.parentDir': '所属仮想ディレクトリ',
        'flow.parentDirHint': 'The workspace is filed under the chosen virtual directory; the root level leaves it ungrouped. With no directories yet, create one from the sidebar toolbar first.',
        'browse.title': 'ワークスペースのフォルダーを選択',
        'browse.home': 'ホーム',
        'browse.newFolder': '新しいフォルダー',
        'browse.folderName': 'フォルダー名',
        'browse.showHidden': '隠しファイルを表示',
        'browse.loading': '読み込み中…',
        'browse.truncated': 'フォルダーが多すぎます。先頭のみ表示しています。',
        'browse.editPath': 'パスを編集',
        'browse.open': 'Open',
        'browse.createIn': 'Create in "{name}"',
        'browse.untitledFolder': 'New folder',
        'search.placeholder': 'ワークスペースまたはセッションを検索',
        'rail.search': '検索',
        'empty': 'ワークスペースがありません',
        'empty.search': '一致する結果がありません',
        'session.new': '新しいセッション',
        'group.ungrouped': '未分類',
        'session.more': '… {n} more in history',
        'session.more.less': 'Collapse history',
        'session.more.title': 'Shows only the last 7 days, up to 5 items; click to reveal the other {n}',
        'sessions.expand': '{n} 件のセッションを展開',
        'sessions.collapse': '折りたたむ',
        'time.now': 'たった今',
        'time.minutes': '{n} 分',
        'time.hours': '{n} 時間',
        'time.days': '{n} 日',
        'time.months': '{n} か月',
        'time.years': '{n} 年',
        'status.running': '生成中',
        'status.completed': '完了',
        'status.approval': '承認待ち',
        'status.planReview': 'プラン確認待ち',
        'status.question': '回答待ち',
        'status.subagents': 'サブエージェント {n} 件が実行中',
        'status.compact.approval': '承認待ち',
        'status.compact.answer': '回答待ち',
        'status.compact.planReview': 'プラン確認',
        'schedule.active': '有効なスケジュールタスクあり',
        'menu.rename': '名前を変更',
        'menu.openWsFolder': 'ワークスペースのフォルダを開く',
        'menu.copyPath': 'パスをコピー',
        'path.copied': 'パスをコピーしました',
        'path.none': 'このワークスペースにはフォルダパスがありません',
        'menu.delete': '削除',
        'menu.fork': 'フォーク',
        'menu.archive': 'アーカイブ',
        'menu.newSubfolder': '新しいサブフォルダー',
        'menu.renameFolder': 'フォルダー名を変更',
        'menu.removeFolder': 'フォルダーを削除',
        'menu.renameSgroup': 'セッショングループ名を変更',
        'settings.title': 'より良いワークスペース',
        'settings.desc': 'ワークスペースツリーの外観と折りたたみ設定',
        'settings.expand': '展開',
        'settings.collapse': '折りたたむ',
        'settings.compactChains': '一本鎖の階層を 1 行にまとめる',
        'settings.compactChains.hint': '子が 1 つだけの階層は 1 行にまとまり,複数の子がある階層はツリーとして展開されます;ワークスペースのドラッグ中は一時的にフォルダーツリーへ戻り,どの階層にもドロップできます;展開状態とカスタム外観はこのブラウザーに保存されます。',
        'settings.statusPulse': 'ステータス表示灯',
        'settings.statusPulse.hint': '折りたたみで隠れたステータス表示(完了は緑 / 実行中は青 / 操作待ちは琥珀)が上位の階層へ伝わります:ワークスペースとフォルダーの行はアイコンがステータス色で明滅し(グローを設定したタイトルも連動),セッショングループの行には明滅するステータスドットが出ます;既定はオンで,ここでオフにできます。',
        'settings.appearance': '既定の外観',
        'settings.appearance.hint': '個別にカスタマイズしていない行に適用される外観です;文字の縁取りは既定でオンです——背景画像の上では縁取りのない文字が読みにくいためです。色を空にするとテーマに従います。',
        'settings.appearance.reset': '既定の外観に戻す',
        'custom.title': '外観をカスタマイズ',
        'custom.color': '色',
        'custom.glow': 'グロー',
        'custom.preview': 'ライブプレビュー',
        'custom.preview.sample': 'ワークスペースの例',
        'custom.weight': '文字の太さ',
        'custom.weight.regular': '標準',
        'custom.weight.medium': '中',
        'custom.weight.semibold': '準太字',
        'custom.weight.bold': '太字',
        'custom.shadow': '文字の影',
        'custom.stroke': '文字の縁取り',
        'custom.stroke.hint': '縁取りの色は既定でグレーです;黒 / 白 / 任意の色に変更でき,「自動」を選ぶと文字色からコントラストの強い色(明るい文字には黒,暗い文字には白)を求めます;自動はテーマの明暗と背景プラグインの明暗に追従します。',
        'custom.strokeWidth': '縁取りの太さ',
        'custom.strokeColor': '縁取りの色',
        'custom.strokeColor.auto': '自動',
        'custom.weak': '弱',
        'custom.medium': '中',
        'custom.strong': '強',
        'custom.icon': 'アイコン',
        'custom.icon.solid': '塗りつぶしフォルダー',
        'custom.icon.outline': '枠線フォルダー',
        'custom.icon.none': '表示しない',
        'custom.none': 'なし',
        'custom.reset': 'カスタマイズを解除',
        'custom.done': '完了',
        'settings.on': 'オン',
        'settings.off': 'オフ',
        'sync.title': 'デバイス間の同期',
        'sync.desc': '外観のカスタマイズ,明示的なフォルダー,各種スイッチはこのデバイスのブラウザーに保存され,ホスト設定ストアを通じてもう一方の環境(Web / デスクトップアプリ)とやり取りされます。通常の変更は自動でホストに書き込まれ,もう一方で「取得」を押せば反映されます;旧バージョンで作られたデータは初回だけ「送信」が必要です。',
        'sync.mode.overwrite': 'このデバイスを上書き',
        'sync.mode.merge': '両方を統合',
        'sync.pull.desktop': 'デスクトップアプリから取得',
        'sync.pull.web': 'Web から取得',
        'sync.push': 'このデバイスのデータを送信',
        'sync.done': '同期しました',
        'sync.empty': 'もう一方に取得できるデータがありません',
        'sync.off': 'この環境では同期できません(ホスト設定サービスが必要)',
        'sync.loading': 'ホスト設定に接続中…',
        'error.title': 'エラーが発生しました',
        'cancel': 'キャンセル',
        'confirm': 'OK',
        'close': '閉じる',
        'ws.rename.title': 'ワークスペース名を変更',
        'ws.rename.hint': '名前に含まれる / が階層グループになります(例: web/frontend)',
        'ws.delete.title': 'ワークスペースを削除',
        'ws.delete.body': 'ワークスペースの登録だけを削除します,ディレクトリとセッション記録は残ります。「{name}」を削除しますか?',
        'folder.new.title': '新しいフォルダー',
        'folder.new.hint': 'フォルダーのパス;/ で階層化できます(例: web/frontend)',
        'folder.rename.title': 'フォルダー名を変更',
        'folder.rename.hint': '名前を変更すると,フォルダー内のすべてのワークスペース名も更新されます',
        'folder.delete.body': '空のフォルダー「{name}」を削除しますか?',
        'folder.error.empty': 'フォルダーのパスを入力してください',
        'folder.error.exists': 'フォルダーはすでに存在します',
        'folder.error.notEmpty': 'フォルダー内にワークスペースが残っています',
        'dir.new.title': 'New virtual folder',
        'dir.new.hint': 'Creates a grouping only — no folder on disk, no workspace touched',
        'dir.rename.title': 'Rename virtual folder',
        'dir.rename.hint': 'Renames the group only; real folders and workspaces are untouched',
        'dir.delete.title': 'Delete virtual folder',
        'dir.delete.body': 'Delete virtual folder "{name}" and all its subfolders? Real workspaces inside return to the root level; no folder on disk is deleted.',
        'dir.moveTo': 'Move into folder…',
        'dir.rootLevel': '(root level)',
      },
      /* locale: ko */
      'ko': {
        'title': '워크스페이스',
        'add': '워크스페이스 추가',
        'create': '만들기',
        'rail.add': '워크스페이스 추가',
        'menu.newSubWorkspace': '하위 워크스페이스 추가',
        'flow.title': '워크스페이스 추가',
        'flow.picked': '선택한 폴더',
        'flow.parent': '소속 그룹',
        'flow.parentHint': '그룹 경로를 입력하거나 선택하세요, 비우면 루트, 여러 단계는 / 로 구분합니다',
        'flow.creating': '만드는 중…',
        'flow.parentDir': '상위 가상 디렉터리',
        'flow.parentDirHint': 'The workspace is filed under the chosen virtual directory; the root level leaves it ungrouped. With no directories yet, create one from the sidebar toolbar first.',
        'browse.title': '워크스페이스 폴더 선택',
        'browse.home': '홈',
        'browse.newFolder': '새 폴더',
        'browse.folderName': '폴더 이름',
        'browse.showHidden': '숨김 파일 표시',
        'browse.loading': '불러오는 중…',
        'browse.truncated': '폴더가 너무 많습니다. 앞부분만 표시합니다.',
        'browse.editPath': '경로 편집',
        'browse.open': 'Open',
        'browse.createIn': 'Create in "{name}"',
        'browse.untitledFolder': 'New folder',
        'search.placeholder': '워크스페이스 또는 세션 검색',
        'rail.search': '검색',
        'empty': '워크스페이스가 없습니다',
        'empty.search': '일치하는 결과가 없습니다',
        'session.new': '새 세션',
        'group.ungrouped': '미분류',
        'session.more': '… {n} more in history',
        'session.more.less': 'Collapse history',
        'session.more.title': 'Shows only the last 7 days, up to 5 items; click to reveal the other {n}',
        'sessions.expand': '세션 {n}개 펼치기',
        'sessions.collapse': '접기',
        'time.now': '방금',
        'time.minutes': '{n}분',
        'time.hours': '{n}시간',
        'time.days': '{n}일',
        'time.months': '{n}개월',
        'time.years': '{n}년',
        'status.running': '생성 중',
        'status.completed': '완료됨',
        'status.approval': '승인 대기 중',
        'status.planReview': '계획 확인 대기 중',
        'status.question': '답변 대기 중',
        'status.subagents': '하위 에이전트 {n}개 실행 중',
        'status.compact.approval': '승인 대기',
        'status.compact.answer': '답변 대기',
        'status.compact.planReview': '계획 확인',
        'schedule.active': '활성 예약 작업 있음',
        'menu.rename': '이름 바꾸기',
        'menu.openWsFolder': '작업 공간 폴더 열기',
        'menu.copyPath': '경로 복사',
        'path.copied': '경로를 복사했습니다',
        'path.none': '이 작업 공간에는 폴더 경로가 없습니다',
        'menu.delete': '삭제',
        'menu.fork': '포크',
        'menu.archive': '보관',
        'menu.newSubfolder': '새 하위 폴더',
        'menu.renameFolder': '폴더 이름 바꾸기',
        'menu.removeFolder': '폴더 삭제',
        'menu.renameSgroup': '세션 그룹 이름 바꾸기',
        'settings.title': '더 나은 워크스페이스',
        'settings.desc': '워크스페이스 트리의 모양과 접기 설정',
        'settings.expand': '펼치기',
        'settings.collapse': '접기',
        'settings.compactChains': '단일 체인을 한 줄로 접기',
        'settings.compactChains.hint': '자식이 하나뿐인 단계는 한 줄로 합쳐지고, 자식이 여러 개면 트리로 펼쳐집니다; 워크스페이스를 끌어 놓는 동안에는 체인이 잠시 폴더 트리로 펼쳐져 어느 단계에나 놓을 수 있습니다; 펼침 상태와 사용자 지정 모양은 이 브라우저에 저장됩니다.',
        'settings.statusPulse': '상태 표시등',
        'settings.statusPulse.hint': '접혀서 가려진 상태 표시(완료는 초록 / 실행은 파랑 / 대기는 호박색)가 상위 단계로 번집니다: 워크스페이스와 폴더 행은 아이콘이 상태 색으로 깜빡이고(글로우를 지정한 제목도 함께 깜빡임), 세션 그룹 행에는 깜빡이는 상태 점이 표시됩니다; 기본값은 켜짐이며 여기서 끌 수 있습니다.',
        'settings.appearance': '기본 모양',
        'settings.appearance.hint': '따로 지정하지 않은 행에 적용되는 모양입니다; 글자 외곽선은 기본으로 켜져 있습니다——배경 이미지 위에서는 외곽선 없는 글자가 잘 보이지 않기 때문입니다. 색을 비우면 테마를 따릅니다.',
        'settings.appearance.reset': '기본 모양으로 되돌리기',
        'custom.title': '모양 사용자 지정',
        'custom.color': '색',
        'custom.glow': '글로우',
        'custom.preview': '실시간 미리보기',
        'custom.preview.sample': '워크스페이스 예시',
        'custom.weight': '글자 굵기',
        'custom.weight.regular': '보통',
        'custom.weight.medium': '중간',
        'custom.weight.semibold': '준굵게',
        'custom.weight.bold': '굵게',
        'custom.shadow': '글자 그림자',
        'custom.stroke': '글자 외곽선',
        'custom.stroke.hint': '외곽선 색은 기본적으로 회색입니다; 검정 / 흰색 / 원하는 색으로 바꿀 수 있고, 「자동」을 고르면 글자 색에서 대비가 큰 색(밝은 글자에는 검정, 어두운 글자에는 흰색)을 계산합니다; 자동은 테마의 밝고 어두움과 배경 플러그인의 명암 전환을 따릅니다.',
        'custom.strokeWidth': '외곽선 두께',
        'custom.strokeColor': '외곽선 색',
        'custom.strokeColor.auto': '자동',
        'custom.weak': '약',
        'custom.medium': '중간',
        'custom.strong': '강',
        'custom.icon': '아이콘',
        'custom.icon.solid': '채운 폴더',
        'custom.icon.outline': '빈 폴더',
        'custom.icon.none': '표시 안 함',
        'custom.none': '없음',
        'custom.reset': '사용자 지정 해제',
        'custom.done': '완료',
        'settings.on': '켜기',
        'settings.off': '끄기',
        'sync.title': '기기 간 동기화',
        'sync.desc': '모양 사용자 지정, 명시적 폴더, 각종 스위치는 이 기기의 브라우저에 저장되고 호스트 설정 저장소를 통해 반대쪽(Web / 데스크톱 앱)과 주고받습니다. 평소의 변경은 자동으로 호스트에 기록되므로 반대쪽에서 「가져오기」만 누르면 됩니다; 이전 버전에서 만든 기록은 처음 한 번 「보내기」가 필요합니다.',
        'sync.mode.overwrite': '이 기기 덮어쓰기',
        'sync.mode.merge': '양쪽 병합',
        'sync.pull.desktop': '데스크톱 앱에서 가져오기',
        'sync.pull.web': 'Web 에서 가져오기',
        'sync.push': '이 기기 데이터 보내기',
        'sync.done': '동기화됨',
        'sync.empty': '반대쪽에 가져올 데이터가 없습니다',
        'sync.off': '이 환경에서는 동기화할 수 없습니다(호스트 설정 서비스 필요)',
        'sync.loading': '호스트 설정에 연결하는 중…',
        'error.title': '문제가 발생했습니다',
        'cancel': '취소',
        'confirm': '확인',
        'close': '닫기',
        'ws.rename.title': '워크스페이스 이름 바꾸기',
        'ws.rename.hint': '이름에 있는 / 가 단계 그룹이 됩니다(예: web/frontend)',
        'ws.delete.title': '워크스페이스 삭제',
        'ws.delete.body': '워크스페이스 등록만 제거하며 디렉터리와 세션 기록은 그대로 남습니다. 「{name}」을(를) 삭제할까요?',
        'folder.new.title': '새 폴더',
        'folder.new.hint': '폴더 경로;/ 로 여러 단계를 만들 수 있습니다(예: web/frontend)',
        'folder.rename.title': '폴더 이름 바꾸기',
        'folder.rename.hint': '이름을 바꾸면 폴더 안 모든 워크스페이스 이름도 함께 바뀝니다',
        'folder.delete.body': '빈 폴더 「{name}」을(를) 삭제할까요?',
        'folder.error.empty': '폴더 경로를 입력해야 합니다',
        'folder.error.exists': '폴더가 이미 있습니다',
        'folder.error.notEmpty': '폴더에 워크스페이스가 남아 있습니다',
        'dir.new.title': 'New virtual folder',
        'dir.new.hint': 'Creates a grouping only — no folder on disk, no workspace touched',
        'dir.rename.title': 'Rename virtual folder',
        'dir.rename.hint': 'Renames the group only; real folders and workspaces are untouched',
        'dir.delete.title': 'Delete virtual folder',
        'dir.delete.body': 'Delete virtual folder "{name}" and all its subfolders? Real workspaces inside return to the root level; no folder on disk is deleted.',
        'dir.moveTo': 'Move into folder…',
        'dir.rootLevel': '(root level)',
      },
      /* locale: nl */
      'nl': {
        'title': 'Werkruimten',
        'add': 'Werkruimte toevoegen',
        'create': 'Aanmaken',
        'rail.add': 'Werkruimte toevoegen',
        'menu.newSubWorkspace': 'Subwerkruimte toevoegen',
        'flow.title': 'Werkruimte toevoegen',
        'flow.picked': 'Gekozen map',
        'flow.parent': 'Bovenliggende groep',
        'flow.parentHint': 'Typ of kies een groeppad; leeg betekent hoofdmap; niveaus scheiden met /',
        'flow.creating': 'Bezig met aanmaken…',
        'flow.parentDir': 'Bovenliggende virtuele map',
        'flow.parentDirHint': 'The workspace is filed under the chosen virtual directory; the root level leaves it ungrouped. With no directories yet, create one from the sidebar toolbar first.',
        'browse.title': 'Werkruimtemap kiezen',
        'browse.home': 'Home',
        'browse.newFolder': 'Nieuwe map',
        'browse.folderName': 'Mapnaam',
        'browse.showHidden': 'Verborgen bestanden tonen',
        'browse.loading': 'Laden…',
        'browse.truncated': 'Te veel mappen; alleen het begin wordt getoond.',
        'browse.editPath': 'Pad bewerken',
        'browse.open': 'Open',
        'browse.createIn': 'Create in "{name}"',
        'browse.untitledFolder': 'New folder',
        'search.placeholder': 'Werkruimten of sessies zoeken',
        'rail.search': 'Zoeken',
        'empty': 'Nog geen werkruimten',
        'empty.search': 'Geen resultaten',
        'session.new': 'Nieuwe sessie',
        'group.ungrouped': 'Zonder groep',
        'session.more': '… {n} more in history',
        'session.more.less': 'Collapse history',
        'session.more.title': 'Shows only the last 7 days, up to 5 items; click to reveal the other {n}',
        'sessions.expand': '{n} sessies uitklappen',
        'sessions.collapse': 'Inklappen',
        'time.now': 'zojuist',
        'time.minutes': '{n} min.',
        'time.hours': '{n} u',
        'time.days': '{n} d',
        'time.months': '{n} mnd',
        'time.years': '{n} j',
        'status.running': 'Wordt gegenereerd',
        'status.completed': 'Voltooid',
        'status.approval': 'Wacht op goedkeuring',
        'status.planReview': 'Wacht op planbevestiging',
        'status.question': 'Wacht op antwoord',
        'status.subagents': '{n} subagenten actief',
        'status.compact.approval': 'Goedkeuring',
        'status.compact.answer': 'Antwoord',
        'status.compact.planReview': 'Plan',
        'schedule.active': 'Actieve geplande taak',
        'menu.rename': 'Naam wijzigen',
        'menu.openWsFolder': 'Werkruimtemap openen',
        'menu.copyPath': 'Pad kopiëren',
        'path.copied': 'Pad gekopieerd',
        'path.none': 'Deze werkruimte heeft geen mappad',
        'menu.delete': 'Verwijderen',
        'menu.fork': 'Afsplitsen',
        'menu.archive': 'Archiveren',
        'menu.newSubfolder': 'Nieuwe submap',
        'menu.renameFolder': 'Mapnaam wijzigen',
        'menu.removeFolder': 'Map verwijderen',
        'menu.renameSgroup': 'Sessiegroep naam wijzigen',
        'settings.title': 'Betere werkruimten',
        'settings.desc': 'Uiterlijk en inklapgedrag van de werkruimteboom',
        'settings.expand': 'Uitklappen',
        'settings.collapse': 'Inklappen',
        'settings.compactChains': 'Enkelvoudige ketens samenvoegen',
        'settings.compactChains.hint': 'Niveaus met één kind worden tot één regel samengevoegd; bij meerdere kinderen klapt de boom open; tijdens het slepen van een werkruimte klappen de ketens tijdelijk terug naar mappen, zodat je op elk niveau kunt neerzetten; de uitgeklapte staat en het eigen uiterlijk blijven in deze browser bewaard.',
        'settings.statusPulse': 'Pulserend statuslampje',
        'settings.statusPulse.hint': 'Statuslampjes die door het inklappen verborgen zijn (voltooid groen / actief blauw / wachtend amber) borrelen door de hiërarchie omhoog: werkruimte- en mapregels laten hun pictogram in de statuskleur pulseren (titels met eigen gloed pulseren mee), sessiegroepregels tonen een pulserend statusstipje; standaard aan, hier uit te zetten.',
        'settings.appearance': 'Standaarduiterlijk',
        'settings.appearance.hint': 'Regels zonder eigen aanpassing gebruiken dit uiterlijk; de tekstomtrek staat standaard aan — zonder omtrek is tekst op een achtergrondafbeelding vaak slecht leesbaar. Laat de kleur leeg om het thema te volgen.',
        'settings.appearance.reset': 'Standaarduiterlijk herstellen',
        'custom.title': 'Uiterlijk aanpassen',
        'custom.color': 'Kleur',
        'custom.glow': 'Gloed',
        'custom.preview': 'Live voorbeeld',
        'custom.preview.sample': 'Voorbeeldwerkruimte',
        'custom.weight': 'Letterdikte',
        'custom.weight.regular': 'Normaal',
        'custom.weight.medium': 'Medium',
        'custom.weight.semibold': 'Halfvet',
        'custom.weight.bold': 'Vet',
        'custom.shadow': 'Tekstschaduw',
        'custom.stroke': 'Tekstomtrek',
        'custom.stroke.hint': 'De omtrek is standaard grijs; kies zwart / wit / een willekeurige kleur, of «Automatisch» om het contrasterende uiterste uit de tekstkleur af te leiden (lichte tekst krijgt een zwarte rand, donkere een witte); Automatisch volgt het licht/donker van het thema en van een achtergrondplugin.',
        'custom.strokeWidth': 'Omtrekdikte',
        'custom.strokeColor': 'Omtrekkleur',
        'custom.strokeColor.auto': 'Automatisch',
        'custom.weak': 'Zwak',
        'custom.medium': 'Medium',
        'custom.strong': 'Sterk',
        'custom.icon': 'Pictogram',
        'custom.icon.solid': 'Gevulde map',
        'custom.icon.outline': 'Omtrekmap',
        'custom.icon.none': 'Verborgen',
        'custom.none': 'Geen',
        'custom.reset': 'Aanpassing wissen',
        'custom.done': 'Klaar',
        'settings.on': 'Aan',
        'settings.off': 'Uit',
        'sync.title': 'Synchronisatie tussen apparaten',
        'sync.desc': 'Uiterlijk, expliciete mappen en schakelaars staan in de browser van dit apparaat; ze worden via de instellingenopslag van de host uitgewisseld met de andere kant (web / desktopapp). Nieuwe wijzigingen gaan automatisch naar de host, de andere kant hoeft alleen «Ophalen» te kiezen; gegevens van oudere versies vragen eenmalig «Verzenden».',
        'sync.mode.overwrite': 'Dit apparaat overschrijven',
        'sync.mode.merge': 'Beide kanten samenvoegen',
        'sync.pull.desktop': 'Ophalen uit desktopapp',
        'sync.pull.web': 'Ophalen uit web',
        'sync.push': 'Gegevens van dit apparaat verzenden',
        'sync.done': 'Gesynchroniseerd',
        'sync.empty': 'Aan de andere kant staan nog geen gegevens',
        'sync.off': 'Synchronisatie is hier niet beschikbaar (hostinstellingenservice nodig)',
        'sync.loading': 'Verbinden met hostinstellingen…',
        'error.title': 'Er is iets misgegaan',
        'cancel': 'Annuleren',
        'confirm': 'OK',
        'close': 'Sluiten',
        'ws.rename.title': 'Werkruimte naam wijzigen',
        'ws.rename.hint': 'Een / in de naam maakt de groepslaag, bijv. web/frontend',
        'ws.delete.title': 'Werkruimte verwijderen',
        'ws.delete.body': 'Alleen de registratie wordt verwijderd; de map en sessielogs blijven bestaan. «{name}» verwijderen?',
        'folder.new.title': 'Nieuwe map',
        'folder.new.hint': 'Mappad; niveaus met /, bijv. web/frontend',
        'folder.rename.title': 'Mapnaam wijzigen',
        'folder.rename.hint': 'Naam wijzigen werkt alle werkruimtenamen in de map bij',
        'folder.delete.body': 'Lege map «{name}» verwijderen?',
        'folder.error.empty': 'Het mappad mag niet leeg zijn',
        'folder.error.exists': 'Map bestaat al',
        'folder.error.notEmpty': 'De map bevat nog werkruimten',
        'dir.new.title': 'New virtual folder',
        'dir.new.hint': 'Creates a grouping only — no folder on disk, no workspace touched',
        'dir.rename.title': 'Rename virtual folder',
        'dir.rename.hint': 'Renames the group only; real folders and workspaces are untouched',
        'dir.delete.title': 'Delete virtual folder',
        'dir.delete.body': 'Delete virtual folder "{name}" and all its subfolders? Real workspaces inside return to the root level; no folder on disk is deleted.',
        'dir.moveTo': 'Move into folder…',
        'dir.rootLevel': '(root level)',
      },
      /* locale: pl */
      'pl': {
        'title': 'Obszary robocze',
        'add': 'Dodaj obszar roboczy',
        'create': 'Utwórz',
        'rail.add': 'Dodaj obszar roboczy',
        'menu.newSubWorkspace': 'Nowy podobszar roboczy',
        'flow.title': 'Dodaj obszar roboczy',
        'flow.picked': 'Wybrany folder',
        'flow.parent': 'Grupa nadrzędna',
        'flow.parentHint': 'Wpisz lub wybierz ścieżkę grupy; puste = główna; poziomy rozdziela /',
        'flow.creating': 'Tworzenie…',
        'flow.parentDir': 'Nadrzędny katalog wirtualny',
        'flow.parentDirHint': 'The workspace is filed under the chosen virtual directory; the root level leaves it ungrouped. With no directories yet, create one from the sidebar toolbar first.',
        'browse.title': 'Wybierz folder obszaru roboczego',
        'browse.home': 'Katalog domowy',
        'browse.newFolder': 'Nowy folder',
        'browse.folderName': 'Nazwa folderu',
        'browse.showHidden': 'Pokaż ukryte pliki',
        'browse.loading': 'Wczytywanie…',
        'browse.truncated': 'Zbyt wiele folderów; pokazano tylko początek.',
        'browse.editPath': 'Edytuj ścieżkę',
        'browse.open': 'Open',
        'browse.createIn': 'Create in "{name}"',
        'browse.untitledFolder': 'New folder',
        'search.placeholder': 'Szukaj obszarów roboczych lub sesji',
        'rail.search': 'Szukaj',
        'empty': 'Brak obszarów roboczych',
        'empty.search': 'Brak wyników',
        'session.new': 'Nowa sesja',
        'group.ungrouped': 'Bez grupy',
        'session.more': '… {n} more in history',
        'session.more.less': 'Collapse history',
        'session.more.title': 'Shows only the last 7 days, up to 5 items; click to reveal the other {n}',
        'sessions.expand': 'Pokaż {n} sesji',
        'sessions.collapse': 'Zwiń',
        'time.now': 'przed chwilą',
        'time.minutes': '{n} min',
        'time.hours': '{n} godz.',
        'time.days': '{n} dni',
        'time.months': '{n} mies.',
        'time.years': '{n} lat',
        'status.running': 'Generowanie',
        'status.completed': 'Ukończono',
        'status.approval': 'Czeka na zatwierdzenie',
        'status.planReview': 'Czeka na potwierdzenie planu',
        'status.question': 'Czeka na odpowiedź',
        'status.subagents': '{n} podagentów w toku',
        'status.compact.approval': 'Zatwierdzenie',
        'status.compact.answer': 'Odpowiedź',
        'status.compact.planReview': 'Plan',
        'schedule.active': 'Aktywne zadanie zaplanowane',
        'menu.rename': 'Zmień nazwę',
        'menu.openWsFolder': 'Otwórz folder obszaru roboczego',
        'menu.copyPath': 'Kopiuj ścieżkę',
        'path.copied': 'Skopiowano ścieżkę',
        'path.none': 'Ten obszar roboczy nie ma ścieżki folderu',
        'menu.delete': 'Usuń',
        'menu.fork': 'Rozgałęź',
        'menu.archive': 'Zarchiwizuj',
        'menu.newSubfolder': 'Nowy podfolder',
        'menu.renameFolder': 'Zmień nazwę folderu',
        'menu.removeFolder': 'Usuń folder',
        'menu.renameSgroup': 'Zmień nazwę grupy sesji',
        'settings.title': 'Lepsze obszary robocze',
        'settings.desc': 'Wygląd i zwijanie drzewa obszarów roboczych',
        'settings.expand': 'Rozwiń',
        'settings.collapse': 'Zwiń',
        'settings.compactChains': 'Scal łańcuchy z jednym dzieckiem',
        'settings.compactChains.hint': 'Poziomy z jednym dzieckiem scalają się w jeden wiersz; przy większej liczbie dzieci drzewo się rozwija; podczas przeciągania obszaru roboczego łańcuchy tymczasowo rozwijają się do folderów, więc upuszczenie działa na każdym poziomie; stan rozwinięcia i własny wygląd są zapisywane w tej przeglądarce.',
        'settings.statusPulse': 'Pulsująca lampka stanu',
        'settings.statusPulse.hint': 'Lampki ukryte przez zwinięcie (ukończono zielona / trwa niebieska / czeka bursztynowa) bąbelkują w górę hierarchii: wiersze obszarów roboczych i folderów pulsują ikoną w kolorze stanu (tytuły z własną poświatą pulsują razem), wiersze grup sesji pokazują pulsującą kropkę stanu; domyślnie włączone, tutaj można wyłączyć.',
        'settings.appearance': 'Domyślny wygląd',
        'settings.appearance.hint': 'Wiersze bez własnych ustawień używają tego wyglądu; obrys tekstu jest domyślnie włączony — bez niego tekst na obrazie tła bywa nieczytelny. Puste pole koloru oznacza podążanie za motywem.',
        'settings.appearance.reset': 'Przywróć domyślny wygląd',
        'custom.title': 'Dostosuj wygląd',
        'custom.color': 'Kolor',
        'custom.glow': 'Poświata',
        'custom.preview': 'Podgląd na żywo',
        'custom.preview.sample': 'Przykładowy obszar roboczy',
        'custom.weight': 'Grubość czcionki',
        'custom.weight.regular': 'Zwykła',
        'custom.weight.medium': 'Średnia',
        'custom.weight.semibold': 'Półgruba',
        'custom.weight.bold': 'Pogrubiona',
        'custom.shadow': 'Cień tekstu',
        'custom.stroke': 'Obrys tekstu',
        'custom.stroke.hint': 'Obrys jest domyślnie szary; można wybrać czerń / biel / dowolny kolor albo „Automatycznie”, co wylicza kontrastowy biegun z koloru tekstu (jasny tekst dostaje czarną krawędź, ciemny białą); automat podąża za motywem i jasnością interfejsu wtyczki tła.',
        'custom.strokeWidth': 'Grubość obrysu',
        'custom.strokeColor': 'Kolor obrysu',
        'custom.strokeColor.auto': 'Automatycznie',
        'custom.weak': 'Słaby',
        'custom.medium': 'Średni',
        'custom.strong': 'Silny',
        'custom.icon': 'Ikona',
        'custom.icon.solid': 'Wypełniony folder',
        'custom.icon.outline': 'Konturowy folder',
        'custom.icon.none': 'Ukryta',
        'custom.none': 'Brak',
        'custom.reset': 'Wyczyść dostosowanie',
        'custom.done': 'Gotowe',
        'settings.on': 'Wł.',
        'settings.off': 'Wył.',
        'sync.title': 'Synchronizacja między urządzeniami',
        'sync.desc': 'Wygląd, jawne foldery i przełączniki mieszkają w przeglądarce tego urządzenia; wymieniają się z drugą stroną (web / aplikacja desktopowa) przez magazyn ustawień hosta. Nowe zmiany trafiają do hosta automatycznie, druga strona musi tylko kliknąć „Pobierz”; dane ze starszych wersji wymagają jednorazowego „Wyślij”.',
        'sync.mode.overwrite': 'Nadpisz to urządzenie',
        'sync.mode.merge': 'Scal obie strony',
        'sync.pull.desktop': 'Pobierz z aplikacji desktopowej',
        'sync.pull.web': 'Pobierz z web',
        'sync.push': 'Wyślij dane tego urządzenia',
        'sync.done': 'Zsynchronizowano',
        'sync.empty': 'Druga strona nie ma jeszcze danych',
        'sync.off': 'Synchronizacja niedostępna (wymaga usługi ustawień hosta)',
        'sync.loading': 'Łączenie z ustawieniami hosta…',
        'error.title': 'Coś poszło nie tak',
        'cancel': 'Anuluj',
        'confirm': 'OK',
        'close': 'Zamknij',
        'ws.rename.title': 'Zmień nazwę obszaru roboczego',
        'ws.rename.hint': '/ w nazwie tworzy grupę, np. web/frontend',
        'ws.delete.title': 'Usuń obszar roboczy',
        'ws.delete.body': 'Usuwane jest tylko zgłoszenie; katalog i dzienniki sesji zostają. Usunąć „{name}”?',
        'folder.new.title': 'Nowy folder',
        'folder.new.hint': 'Ścieżka folderu; poziomy rozdziela /, np. web/frontend',
        'folder.rename.title': 'Zmień nazwę folderu',
        'folder.rename.hint': 'Zmiana nazwy zaktualizuje wszystkie obszary robocze w folderze',
        'folder.delete.body': 'Usunąć pusty folder „{name}”?',
        'folder.error.empty': 'Ścieżka folderu nie może być pusta',
        'folder.error.exists': 'Folder już istnieje',
        'folder.error.notEmpty': 'Folder wciąż zawiera obszary robocze',
        'dir.new.title': 'New virtual folder',
        'dir.new.hint': 'Creates a grouping only — no folder on disk, no workspace touched',
        'dir.rename.title': 'Rename virtual folder',
        'dir.rename.hint': 'Renames the group only; real folders and workspaces are untouched',
        'dir.delete.title': 'Delete virtual folder',
        'dir.delete.body': 'Delete virtual folder "{name}" and all its subfolders? Real workspaces inside return to the root level; no folder on disk is deleted.',
        'dir.moveTo': 'Move into folder…',
        'dir.rootLevel': '(root level)',
      },
      /* locale: pt */
      'pt': {
        'title': 'Espaços de trabalho',
        'add': 'Adicionar espaço de trabalho',
        'create': 'Criar',
        'rail.add': 'Adicionar espaço de trabalho',
        'menu.newSubWorkspace': 'Novo espaço de trabalho aqui',
        'flow.title': 'Adicionar espaço de trabalho',
        'flow.picked': 'Pasta escolhida',
        'flow.parent': 'Grupo pai',
        'flow.parentHint': 'Digite ou escolha o caminho do grupo; vazio = raiz; níveis separados por /',
        'flow.creating': 'Criando…',
        'flow.parentDir': 'Diretório virtual pai',
        'flow.parentDirHint': 'The workspace is filed under the chosen virtual directory; the root level leaves it ungrouped. With no directories yet, create one from the sidebar toolbar first.',
        'browse.title': 'Escolher pasta da área de trabalho',
        'browse.home': 'Início',
        'browse.newFolder': 'Nova pasta',
        'browse.folderName': 'Nome da pasta',
        'browse.showHidden': 'Mostrar arquivos ocultos',
        'browse.loading': 'Carregando…',
        'browse.truncated': 'Pastas demais; apenas o início é exibido.',
        'browse.editPath': 'Editar caminho',
        'browse.open': 'Open',
        'browse.createIn': 'Create in "{name}"',
        'browse.untitledFolder': 'New folder',
        'search.placeholder': 'Pesquisar espaços de trabalho ou sessões',
        'rail.search': 'Pesquisar',
        'empty': 'Nenhum espaço de trabalho',
        'empty.search': 'Nenhum resultado',
        'session.new': 'Nova sessão',
        'group.ungrouped': 'Sem grupo',
        'session.more': '… {n} more in history',
        'session.more.less': 'Collapse history',
        'session.more.title': 'Shows only the last 7 days, up to 5 items; click to reveal the other {n}',
        'sessions.expand': 'Mostrar {n} sessões',
        'sessions.collapse': 'Recolher',
        'time.now': 'agora mesmo',
        'time.minutes': '{n} min',
        'time.hours': '{n} h',
        'time.days': '{n} d',
        'time.months': '{n} meses',
        'time.years': '{n} anos',
        'status.running': 'Gerando',
        'status.completed': 'Concluído',
        'status.approval': 'Aguardando aprovação',
        'status.planReview': 'Aguardando confirmação do plano',
        'status.question': 'Aguardando resposta',
        'status.subagents': '{n} subagentes em execução',
        'status.compact.approval': 'Aprovação',
        'status.compact.answer': 'Resposta',
        'status.compact.planReview': 'Plano',
        'schedule.active': 'Tarefa agendada ativa',
        'menu.rename': 'Renomear',
        'menu.openWsFolder': 'Abrir pasta da área de trabalho',
        'menu.copyPath': 'Copiar caminho',
        'path.copied': 'Caminho copiado',
        'path.none': 'Esta área de trabalho não tem caminho de pasta',
        'menu.delete': 'Excluir',
        'menu.fork': 'Bifurcar',
        'menu.archive': 'Arquivar',
        'menu.newSubfolder': 'Nova subpasta',
        'menu.renameFolder': 'Renomear pasta',
        'menu.removeFolder': 'Excluir pasta',
        'menu.renameSgroup': 'Renomear grupo de sessões',
        'settings.title': 'Espaços de trabalho melhores',
        'settings.desc': 'Aparência e recolhimento da árvore de espaços de trabalho',
        'settings.expand': 'Expandir',
        'settings.collapse': 'Recolher',
        'settings.compactChains': 'Mesclar cadeias de filho único',
        'settings.compactChains.hint': 'Níveis com um único filho viram uma linha; com vários filhos a árvore se expande; ao arrastar um espaço de trabalho, as cadeias voltam temporariamente a pastas, permitindo soltar em qualquer nível; o estado de expansão e o estilo personalizado ficam neste navegador.',
        'settings.statusPulse': 'Luz de status pulsante',
        'settings.statusPulse.hint': 'As luzes escondidas pelo recolhimento (concluído verde / em execução azul / aguardando âmbar) sobem pela hierarquia: linhas de espaço de trabalho e pasta pulsam o ícone na cor do status (títulos com brilho personalizado pulsam junto), linhas de grupo de sessões mostram um ponto pulsante; ativado por padrão, pode ser desligado aqui.',
        'settings.appearance': 'Aparência padrão',
        'settings.appearance.hint': 'Linhas sem personalização usam esta aparência; o contorno do texto vem ativado por padrão — sem ele, o texto costuma ficar ilegível sobre uma imagem de fundo. Deixe a cor vazia para seguir o tema.',
        'settings.appearance.reset': 'Restaurar aparência padrão',
        'custom.title': 'Personalizar aparência',
        'custom.color': 'Cor',
        'custom.glow': 'Brilho',
        'custom.preview': 'Prévia ao vivo',
        'custom.preview.sample': 'Espaço de trabalho de exemplo',
        'custom.weight': 'Espessura da fonte',
        'custom.weight.regular': 'Normal',
        'custom.weight.medium': 'Média',
        'custom.weight.semibold': 'Seminegrito',
        'custom.weight.bold': 'Negrito',
        'custom.shadow': 'Sombra do texto',
        'custom.stroke': 'Contorno do texto',
        'custom.stroke.hint': 'O contorno é cinza por padrão; dá para escolher preto / branco / qualquer cor, ou «Auto» para derivar o polo contrastante da cor do texto (texto claro ganha borda preta, escuro ganha branca); o Auto segue o tema e a alternância claro/escuro de um plugin de fundo.',
        'custom.strokeWidth': 'Espessura do contorno',
        'custom.strokeColor': 'Cor do contorno',
        'custom.strokeColor.auto': 'Auto',
        'custom.weak': 'Fraco',
        'custom.medium': 'Médio',
        'custom.strong': 'Forte',
        'custom.icon': 'Ícone',
        'custom.icon.solid': 'Pasta preenchida',
        'custom.icon.outline': 'Pasta vazada',
        'custom.icon.none': 'Oculta',
        'custom.none': 'Nenhum',
        'custom.reset': 'Limpar personalização',
        'custom.done': 'Concluir',
        'settings.on': 'Ativado',
        'settings.off': 'Desativado',
        'sync.title': 'Sincronização entre dispositivos',
        'sync.desc': 'Aparência, pastas explícitas e chaves ficam no navegador deste dispositivo; são trocadas com o outro lado (web / aplicativo de desktop) pelo armazenamento de configurações do host. As novas alterações vão automaticamente para o host, o outro lado só precisa clicar em «Buscar»; dados de versões antigas exigem um «Enviar» inicial.',
        'sync.mode.overwrite': 'Sobrescrever este dispositivo',
        'sync.mode.merge': 'Mesclar os dois lados',
        'sync.pull.desktop': 'Buscar do aplicativo de desktop',
        'sync.pull.web': 'Buscar da web',
        'sync.push': 'Enviar dados deste dispositivo',
        'sync.done': 'Sincronizado',
        'sync.empty': 'O outro lado ainda não tem dados',
        'sync.off': 'Sincronização indisponível aqui (requer o serviço de configurações do host)',
        'sync.loading': 'Conectando às configurações do host…',
        'error.title': 'Algo deu errado',
        'cancel': 'Cancelar',
        'confirm': 'OK',
        'close': 'Fechar',
        'ws.rename.title': 'Renomear espaço de trabalho',
        'ws.rename.hint': 'A / no nome cria o grupo, por exemplo web/frontend',
        'ws.delete.title': 'Excluir espaço de trabalho',
        'ws.delete.body': 'Apenas o registro é removido; o diretório e os logs de sessão são mantidos. Excluir «{name}»?',
        'folder.new.title': 'Nova pasta',
        'folder.new.hint': 'Caminho da pasta; níveis com /, por exemplo web/frontend',
        'folder.rename.title': 'Renomear pasta',
        'folder.rename.hint': 'Renomear atualiza todos os espaços de trabalho da pasta',
        'folder.delete.body': 'Excluir a pasta vazia «{name}»?',
        'folder.error.empty': 'O caminho da pasta não pode ficar vazio',
        'folder.error.exists': 'A pasta já existe',
        'folder.error.notEmpty': 'A pasta ainda contém espaços de trabalho',
        'dir.new.title': 'New virtual folder',
        'dir.new.hint': 'Creates a grouping only — no folder on disk, no workspace touched',
        'dir.rename.title': 'Rename virtual folder',
        'dir.rename.hint': 'Renames the group only; real folders and workspaces are untouched',
        'dir.delete.title': 'Delete virtual folder',
        'dir.delete.body': 'Delete virtual folder "{name}" and all its subfolders? Real workspaces inside return to the root level; no folder on disk is deleted.',
        'dir.moveTo': 'Move into folder…',
        'dir.rootLevel': '(root level)',
      },
      /* locale: ru */
      'ru': {
        'title': 'Рабочие области',
        'add': 'Добавить рабочую область',
        'create': 'Создать',
        'rail.add': 'Добавить рабочую область',
        'menu.newSubWorkspace': 'Новая рабочая область здесь',
        'flow.title': 'Добавить рабочую область',
        'flow.picked': 'Выбранная папка',
        'flow.parent': 'Родительская группа',
        'flow.parentHint': 'Введите или выберите путь группы; пусто — корень; уровни разделяются /',
        'flow.creating': 'Создание…',
        'flow.parentDir': 'Родительский виртуальный каталог',
        'flow.parentDirHint': 'The workspace is filed under the chosen virtual directory; the root level leaves it ungrouped. With no directories yet, create one from the sidebar toolbar first.',
        'browse.title': 'Выбор папки рабочей области',
        'browse.home': 'Домашняя папка',
        'browse.newFolder': 'Новая папка',
        'browse.folderName': 'Имя папки',
        'browse.showHidden': 'Показывать скрытые файлы',
        'browse.loading': 'Загрузка…',
        'browse.truncated': 'Слишком много папок; показано только начало.',
        'browse.editPath': 'Изменить путь',
        'browse.open': 'Open',
        'browse.createIn': 'Create in "{name}"',
        'browse.untitledFolder': 'New folder',
        'search.placeholder': 'Поиск рабочих областей и сессий',
        'rail.search': 'Поиск',
        'empty': 'Рабочих областей пока нет',
        'empty.search': 'Ничего не найдено',
        'session.new': 'Новая сессия',
        'group.ungrouped': 'Без группы',
        'session.more': '… {n} more in history',
        'session.more.less': 'Collapse history',
        'session.more.title': 'Shows only the last 7 days, up to 5 items; click to reveal the other {n}',
        'sessions.expand': 'Показать ещё {n} сессий',
        'sessions.collapse': 'Свернуть',
        'time.now': 'только что',
        'time.minutes': '{n} мин',
        'time.hours': '{n} ч',
        'time.days': '{n} д',
        'time.months': '{n} мес.',
        'time.years': '{n} г.',
        'status.running': 'Генерация',
        'status.completed': 'Завершено',
        'status.approval': 'Ожидает подтверждения',
        'status.planReview': 'Ожидает проверки плана',
        'status.question': 'Ожидает ответа',
        'status.subagents': 'Выполняется субагентов: {n}',
        'status.compact.approval': 'Подтверждение',
        'status.compact.answer': 'Ответ',
        'status.compact.planReview': 'План',
        'schedule.active': 'Есть активная задача по расписанию',
        'menu.rename': 'Переименовать',
        'menu.openWsFolder': 'Открыть папку рабочей области',
        'menu.copyPath': 'Копировать путь',
        'path.copied': 'Путь скопирован',
        'path.none': 'У этой рабочей области нет пути к папке',
        'menu.delete': 'Удалить',
        'menu.fork': 'Ответвить',
        'menu.archive': 'В архив',
        'menu.newSubfolder': 'Новая подпапка',
        'menu.renameFolder': 'Переименовать папку',
        'menu.removeFolder': 'Удалить папку',
        'menu.renameSgroup': 'Переименовать группу сессий',
        'settings.title': 'Улучшенные рабочие области',
        'settings.desc': 'Внешний вид и сворачивание дерева рабочих областей',
        'settings.expand': 'Развернуть',
        'settings.collapse': 'Свернуть',
        'settings.compactChains': 'Объединять цепочки с одним потомком',
        'settings.compactChains.hint': 'Уровни с единственным потомком сливаются в одну строку; при нескольких потомках дерево разворачивается; во время перетаскивания рабочей области цепочки временно разворачиваются в папки, чтобы можно было положить элемент на любой уровень; состояние сворачивания и оформление хранятся в этом браузере.',
        'settings.statusPulse': 'Пульсирующий индикатор состояния',
        'settings.statusPulse.hint': 'Индикаторы, скрытые сворачиванием (завершено — зелёный / выполняется — синий / ожидает — янтарный), всплывают вверх по иерархии: строки рабочих областей и папок пульсируют значком в цвете состояния (заголовки со своим свечением пульсируют вместе с ними), строки групп сессий показывают пульсирующую точку; включено по умолчанию, здесь можно отключить.',
        'settings.appearance': 'Оформление по умолчанию',
        'settings.appearance.hint': 'Строки без своей настройки используют это оформление; обводка текста включена по умолчанию — без неё текст на фоновом изображении часто нечитаем. Пустой цвет означает следование теме.',
        'settings.appearance.reset': 'Вернуть оформление по умолчанию',
        'custom.title': 'Настроить оформление',
        'custom.color': 'Цвет',
        'custom.glow': 'Свечение',
        'custom.preview': 'Живой предпросмотр',
        'custom.preview.sample': 'Пример рабочей области',
        'custom.weight': 'Насыщенность шрифта',
        'custom.weight.regular': 'Обычная',
        'custom.weight.medium': 'Средняя',
        'custom.weight.semibold': 'Полужирная',
        'custom.weight.bold': 'Жирная',
        'custom.shadow': 'Тень текста',
        'custom.stroke': 'Обводка текста',
        'custom.stroke.hint': 'Обводка по умолчанию серая; можно выбрать чёрный / белый / любой цвет, а «Авто» выводит контрастный полюс из цвета текста (светлому тексту — чёрная кромка, тёмному — белая); авто следует за темой и переключением светлого/тёмного у плагина фона.',
        'custom.strokeWidth': 'Толщина обводки',
        'custom.strokeColor': 'Цвет обводки',
        'custom.strokeColor.auto': 'Авто',
        'custom.weak': 'Слабо',
        'custom.medium': 'Средне',
        'custom.strong': 'Сильно',
        'custom.icon': 'Значок',
        'custom.icon.solid': 'Залитая папка',
        'custom.icon.outline': 'Контурная папка',
        'custom.icon.none': 'Скрыт',
        'custom.none': 'Нет',
        'custom.reset': 'Сбросить настройку',
        'custom.done': 'Готово',
        'settings.on': 'Вкл.',
        'settings.off': 'Выкл.',
        'sync.title': 'Синхронизация между устройствами',
        'sync.desc': 'Оформление, явные папки и переключатели хранятся в браузере этого устройства и обмениваются с другой стороной (веб / настольное приложение) через хранилище настроек хоста. Новые изменения записываются в хост автоматически, другой стороне достаточно нажать «Получить»; данные старых версий требуют однократной отправки.',
        'sync.mode.overwrite': 'Перезаписать это устройство',
        'sync.mode.merge': 'Объединить обе стороны',
        'sync.pull.desktop': 'Получить из настольного приложения',
        'sync.pull.web': 'Получить из веба',
        'sync.push': 'Отправить данные этого устройства',
        'sync.done': 'Синхронизировано',
        'sync.empty': 'На другой стороне пока нет данных',
        'sync.off': 'Синхронизация недоступна (нужна служба настроек хоста)',
        'sync.loading': 'Подключение к настройкам хоста…',
        'error.title': 'Что-то пошло не так',
        'cancel': 'Отмена',
        'confirm': 'ОК',
        'close': 'Закрыть',
        'ws.rename.title': 'Переименовать рабочую область',
        'ws.rename.hint': 'Символ / в имени задаёт группу, например web/frontend',
        'ws.delete.title': 'Удалить рабочую область',
        'ws.delete.body': 'Удаляется только регистрация; каталог и журналы сессий остаются. Удалить «{name}»?',
        'folder.new.title': 'Новая папка',
        'folder.new.hint': 'Путь папки; уровни через /, например web/frontend',
        'folder.rename.title': 'Переименовать папку',
        'folder.rename.hint': 'Переименование обновит все рабочие области в папке',
        'folder.delete.body': 'Удалить пустую папку «{name}»?',
        'folder.error.empty': 'Путь папки не может быть пустым',
        'folder.error.exists': 'Папка уже существует',
        'folder.error.notEmpty': 'В папке ещё есть рабочие области',
        'dir.new.title': 'New virtual folder',
        'dir.new.hint': 'Creates a grouping only — no folder on disk, no workspace touched',
        'dir.rename.title': 'Rename virtual folder',
        'dir.rename.hint': 'Renames the group only; real folders and workspaces are untouched',
        'dir.delete.title': 'Delete virtual folder',
        'dir.delete.body': 'Delete virtual folder "{name}" and all its subfolders? Real workspaces inside return to the root level; no folder on disk is deleted.',
        'dir.moveTo': 'Move into folder…',
        'dir.rootLevel': '(root level)',
      },
      /* locale: sv */
      'sv': {
        'title': 'Arbetsytor',
        'add': 'Lägg till arbetsyta',
        'create': 'Skapa',
        'rail.add': 'Lägg till arbetsyta',
        'menu.newSubWorkspace': 'Ny arbetsyta här',
        'flow.title': 'Lägg till arbetsyta',
        'flow.picked': 'Vald mapp',
        'flow.parent': 'Överordnad grupp',
        'flow.parentHint': 'Skriv eller välj en gruppsökväg; tomt = rot; nivåer avgränsas med /',
        'flow.creating': 'Skapar…',
        'flow.parentDir': 'Överordnad virtuell mapp',
        'flow.parentDirHint': 'The workspace is filed under the chosen virtual directory; the root level leaves it ungrouped. With no directories yet, create one from the sidebar toolbar first.',
        'browse.title': 'Välj arbetsyte-mapp',
        'browse.home': 'Hem',
        'browse.newFolder': 'Ny mapp',
        'browse.folderName': 'Mappnamn',
        'browse.showHidden': 'Visa dolda filer',
        'browse.loading': 'Laddar…',
        'browse.truncated': 'För många mappar; endast början visas.',
        'browse.editPath': 'Redigera sökväg',
        'browse.open': 'Open',
        'browse.createIn': 'Create in "{name}"',
        'browse.untitledFolder': 'New folder',
        'search.placeholder': 'Sök arbetsytor eller sessioner',
        'rail.search': 'Sök',
        'empty': 'Inga arbetsytor ännu',
        'empty.search': 'Inga träffar',
        'session.new': 'Ny session',
        'group.ungrouped': 'Utan grupp',
        'session.more': '… {n} more in history',
        'session.more.less': 'Collapse history',
        'session.more.title': 'Shows only the last 7 days, up to 5 items; click to reveal the other {n}',
        'sessions.expand': 'Visa {n} sessioner',
        'sessions.collapse': 'Fäll ihop',
        'time.now': 'nyss',
        'time.minutes': '{n} min',
        'time.hours': '{n} tim',
        'time.days': '{n} d',
        'time.months': '{n} mån',
        'time.years': '{n} år',
        'status.running': 'Genererar',
        'status.completed': 'Klar',
        'status.approval': 'Väntar på godkännande',
        'status.planReview': 'Väntar på planbekräftelse',
        'status.question': 'Väntar på svar',
        'status.subagents': '{n} underagenter körs',
        'status.compact.approval': 'Godkännande',
        'status.compact.answer': 'Svar',
        'status.compact.planReview': 'Plan',
        'schedule.active': 'Aktiv schemalagd uppgift',
        'menu.rename': 'Byt namn',
        'menu.openWsFolder': 'Öppna arbetsytans mapp',
        'menu.copyPath': 'Kopiera sökväg',
        'path.copied': 'Sökvägen kopierad',
        'path.none': 'Den här arbetsytan har ingen mappsökväg',
        'menu.delete': 'Ta bort',
        'menu.fork': 'Förgrena',
        'menu.archive': 'Arkivera',
        'menu.newSubfolder': 'Ny undermapp',
        'menu.renameFolder': 'Byt namn på mapp',
        'menu.removeFolder': 'Ta bort mapp',
        'menu.renameSgroup': 'Byt namn på sessionsgrupp',
        'settings.title': 'Bättre arbetsytor',
        'settings.desc': 'Utseende och ihopfällning för arbetsyteträdet',
        'settings.expand': 'Fäll ut',
        'settings.collapse': 'Fäll ihop',
        'settings.compactChains': 'Slå ihop enkelkedjor',
        'settings.compactChains.hint': 'Nivåer med ett enda barn slås ihop till en rad; med flera barn fälls trädet ut; medan du drar en arbetsyta fälls kedjorna tillfälligt ut till mappar så att du kan släppa på vilken nivå som helst; utfällt läge och eget utseende sparas i den här webbläsaren.',
        'settings.statusPulse': 'Pulserande statuslampa',
        'settings.statusPulse.hint': 'Statuslampor som döljs av ihopfällningen (klart grön / körs blå / väntar bärnsten) bubblar uppåt i hierarkin: rader för arbetsytor och mappar pulserar ikonen i statusfärgen (titlar med egen glöd pulserar med), sessionsgrupper visar en pulserande prick; på som standard, stängs av här.',
        'settings.appearance': 'Standardutseende',
        'settings.appearance.hint': 'Rader utan egen anpassning använder detta utseende; textkonturen är på som standard — utan den är texten ofta oläslig ovanpå en bakgrundsbild. Lämna färgen tom för att följa temat.',
        'settings.appearance.reset': 'Återställ standardutseende',
        'custom.title': 'Anpassa utseende',
        'custom.color': 'Färg',
        'custom.glow': 'Glöd',
        'custom.preview': 'Liveförhandsvisning',
        'custom.preview.sample': 'Exempelarbetsyta',
        'custom.weight': 'Teckenvikt',
        'custom.weight.regular': 'Normal',
        'custom.weight.medium': 'Medium',
        'custom.weight.semibold': 'Halvfet',
        'custom.weight.bold': 'Fet',
        'custom.shadow': 'Textskugga',
        'custom.stroke': 'Textkontur',
        'custom.stroke.hint': 'Konturen är grå som standard; välj svart / vitt / valfri färg, eller «Auto» för att härleda motpolen från textfärgen (ljus text får svart kant, mörk får vit); Auto följer temat och en bakgrundsplugins ljus/mörker-läge.',
        'custom.strokeWidth': 'Konturtjocklek',
        'custom.strokeColor': 'Konturfärg',
        'custom.strokeColor.auto': 'Auto',
        'custom.weak': 'Svag',
        'custom.medium': 'Medium',
        'custom.strong': 'Stark',
        'custom.icon': 'Ikon',
        'custom.icon.solid': 'Fylld mapp',
        'custom.icon.outline': 'Konturmapp',
        'custom.icon.none': 'Dold',
        'custom.none': 'Ingen',
        'custom.reset': 'Rensa anpassning',
        'custom.done': 'Klart',
        'settings.on': 'På',
        'settings.off': 'Av',
        'sync.title': 'Synk mellan enheter',
        'sync.desc': 'Utseende, uttryckliga mappar och reglage ligger i den här enhetens webbläsare; de utbyts med andra sidan (webb / skrivbordsapp) via värduppläggets inställningslager. Nya ändringar skrivs automatiskt till värden, andra sidan behöver bara välja «Hämta»; data från äldre versioner kräver en första «Skicka».',
        'sync.mode.overwrite': 'Skriv över denna enhet',
        'sync.mode.merge': 'Slå ihop båda sidor',
        'sync.pull.desktop': 'Hämta från skrivbordsappen',
        'sync.pull.web': 'Hämta från webben',
        'sync.push': 'Skicka denna enhets data',
        'sync.done': 'Synkroniserat',
        'sync.empty': 'Andra sidan har inga data ännu',
        'sync.off': 'Synk är inte tillgänglig här (kräver värduppläggets inställningstjänst)',
        'sync.loading': 'Ansluter till värduppläggets inställningar…',
        'error.title': 'Något gick fel',
        'cancel': 'Avbryt',
        'confirm': 'OK',
        'close': 'Stäng',
        'ws.rename.title': 'Byt namn på arbetsyta',
        'ws.rename.hint': 'Ett / i namnet bildar gruppnivån, t.ex. web/frontend',
        'ws.delete.title': 'Ta bort arbetsyta',
        'ws.delete.body': 'Endast registreringen tas bort; katalogen och sessionsloggarna finns kvar. Ta bort «{name}»?',
        'folder.new.title': 'Ny mapp',
        'folder.new.hint': 'Mappsökväg; nivåer med /, t.ex. web/frontend',
        'folder.rename.title': 'Byt namn på mapp',
        'folder.rename.hint': 'Namnbytet uppdaterar alla arbetsytor i mappen',
        'folder.delete.body': 'Ta bort den tomma mappen «{name}»?',
        'folder.error.empty': 'Mappsökvägen får inte vara tom',
        'folder.error.exists': 'Mappen finns redan',
        'folder.error.notEmpty': 'Mappen innehåller fortfarande arbetsytor',
        'dir.new.title': 'New virtual folder',
        'dir.new.hint': 'Creates a grouping only — no folder on disk, no workspace touched',
        'dir.rename.title': 'Rename virtual folder',
        'dir.rename.hint': 'Renames the group only; real folders and workspaces are untouched',
        'dir.delete.title': 'Delete virtual folder',
        'dir.delete.body': 'Delete virtual folder "{name}" and all its subfolders? Real workspaces inside return to the root level; no folder on disk is deleted.',
        'dir.moveTo': 'Move into folder…',
        'dir.rootLevel': '(root level)',
      },
      /* locale: th */
      'th': {
        'title': 'พื้นที่ทำงาน',
        'add': 'เพิ่มพื้นที่ทำงาน',
        'create': 'สร้าง',
        'rail.add': 'เพิ่มพื้นที่ทำงาน',
        'menu.newSubWorkspace': 'พื้นที่ทำงานย่อยที่นี่',
        'flow.title': 'เพิ่มพื้นที่ทำงาน',
        'flow.picked': 'โฟลเดอร์ที่เลือก',
        'flow.parent': 'กลุ่มต้นทาง',
        'flow.parentHint': 'พิมพ์หรือเลือกเส้นทางกลุ่ม เว้นว่างคือระดับราก หลายระดับคั่นด้วย /',
        'flow.creating': 'กำลังสร้าง…',
        'flow.parentDir': 'ไดเรกทอรีเสมือนปลายทาง',
        'flow.parentDirHint': 'The workspace is filed under the chosen virtual directory; the root level leaves it ungrouped. With no directories yet, create one from the sidebar toolbar first.',
        'browse.title': 'เลือกโฟลเดอร์เวิร์กสเปซ',
        'browse.home': 'โฮม',
        'browse.newFolder': 'โฟลเดอร์ใหม่',
        'browse.folderName': 'ชื่อโฟลเดอร์',
        'browse.showHidden': 'แสดงไฟล์ที่ซ่อนอยู่',
        'browse.loading': 'กำลังโหลด…',
        'browse.truncated': 'มีโฟลเดอร์มากเกินไป แสดงเฉพาะส่วนต้น',
        'browse.editPath': 'แก้ไขเส้นทาง',
        'browse.open': 'Open',
        'browse.createIn': 'Create in "{name}"',
        'browse.untitledFolder': 'New folder',
        'search.placeholder': 'ค้นหาพื้นที่ทำงานหรือเซสชัน',
        'rail.search': 'ค้นหา',
        'empty': 'ยังไม่มีพื้นที่ทำงาน',
        'empty.search': 'ไม่พบผลลัพธ์ที่ตรงกัน',
        'session.new': 'เซสชันใหม่',
        'group.ungrouped': 'ไม่มีกลุ่ม',
        'session.more': '… {n} more in history',
        'session.more.less': 'Collapse history',
        'session.more.title': 'Shows only the last 7 days, up to 5 items; click to reveal the other {n}',
        'sessions.expand': 'แสดงอีก {n} เซสชัน',
        'sessions.collapse': 'ย่อ',
        'time.now': 'เมื่อสักครู่',
        'time.minutes': '{n} นาที',
        'time.hours': '{n} ชั่วโมง',
        'time.days': '{n} วัน',
        'time.months': '{n} เดือน',
        'time.years': '{n} ปี',
        'status.running': 'กำลังสร้าง',
        'status.completed': 'เสร็จแล้ว',
        'status.approval': 'รอการอนุมัติ',
        'status.planReview': 'รอตรวจแผน',
        'status.question': 'รอคำตอบ',
        'status.subagents': 'ตัวแทนย่อย {n} รายกำลังทำงาน',
        'status.compact.approval': 'อนุมัติ',
        'status.compact.answer': 'ตอบ',
        'status.compact.planReview': 'แผน',
        'schedule.active': 'มีงานตั้งเวลาใช้งานอยู่',
        'menu.rename': 'เปลี่ยนชื่อ',
        'menu.openWsFolder': 'เปิดโฟลเดอร์พื้นที่ทำงาน',
        'menu.copyPath': 'คัดลอกพาธ',
        'path.copied': 'คัดลอกพาธแล้ว',
        'path.none': 'พื้นที่ทำงานนี้ไม่มีพาธโฟลเดอร์',
        'menu.delete': 'ลบ',
        'menu.fork': 'แยกสาย',
        'menu.archive': 'เก็บถาวร',
        'menu.newSubfolder': 'โฟลเดอร์ย่อยใหม่',
        'menu.renameFolder': 'เปลี่ยนชื่อโฟลเดอร์',
        'menu.removeFolder': 'ลบโฟลเดอร์',
        'menu.renameSgroup': 'เปลี่ยนชื่อกลุ่มเซสชัน',
        'settings.title': 'พื้นที่ทำงานที่ดีขึ้น',
        'settings.desc': 'รูปลักษณ์และการย่อของต้นไม้พื้นที่ทำงาน',
        'settings.expand': 'ขยาย',
        'settings.collapse': 'ย่อ',
        'settings.compactChains': 'รวมสายที่มีลูกเดียว',
        'settings.compactChains.hint': 'ระดับที่มีลูกเพียงหนึ่งจะถูกรวมเป็นบรรทัดเดียว เมื่อมีลูกหลายตัวต้นไม้จะขยายออก ขณะลากพื้นที่ทำงาน สายจะขยายกลับเป็นโฟลเดอร์ชั่วคราวเพื่อให้วางได้ทุกระดับ สถานะการขยายและรูปลักษณ์ที่กำหนดเองจะถูกเก็บไว้ในเบราว์เซอร์นี้',
        'settings.statusPulse': 'ไฟสถานะหายใจ',
        'settings.statusPulse.hint': 'ไฟสถานะที่ถูกย่อซ่อนไว้ (เสร็จแล้วสีเขียว / กำลังทำงานสีน้ำเงิน / รอตอบสนองสีเหลืองอำพัน) จะลอยขึ้นตามลำดับชั้น: แถวพื้นที่ทำงานและโฟลเดอร์จะให้ไอคอนหายใจเป็นสีตามสถานะ (ชื่อที่มีการเรืองแสงกำหนดเองก็หายใจตาม) แถวกลุ่มเซสชันจะแสดงจุดสถานะที่หายใจ เปิดไว้เป็นค่าเริ่มต้น ปิดได้ที่นี่',
        'settings.appearance': 'รูปลักษณ์เริ่มต้น',
        'settings.appearance.hint': 'แถวที่ยังไม่ได้กำหนดเองจะใช้รูปลักษณ์นี้ เส้นขอบตัวอักษรเปิดไว้เป็นค่าเริ่มต้น — บนภาพพื้นหลัง ตัวอักษรที่ไม่มีเส้นขอบมักอ่านยาก เว้นสีว่างไว้เพื่อตามธีม',
        'settings.appearance.reset': 'คืนค่ารูปลักษณ์เริ่มต้น',
        'custom.title': 'ปรับแต่งรูปลักษณ์',
        'custom.color': 'สี',
        'custom.glow': 'การเรืองแสง',
        'custom.preview': 'ตัวอย่างสด',
        'custom.preview.sample': 'ตัวอย่างพื้นที่ทำงาน',
        'custom.weight': 'ความหนาตัวอักษร',
        'custom.weight.regular': 'ปกติ',
        'custom.weight.medium': 'ปานกลาง',
        'custom.weight.semibold': 'กึ่งหนา',
        'custom.weight.bold': 'หนา',
        'custom.shadow': 'เงาตัวอักษร',
        'custom.stroke': 'เส้นขอบตัวอักษร',
        'custom.stroke.hint': 'สีเส้นขอบเริ่มต้นเป็นสีเทา เปลี่ยนเป็นดำ / ขาว / สีใดก็ได้ หรือเลือก «อัตโนมัติ» เพื่อคำนวณสีตัดจากสีตัวอักษร (ตัวอักษรสว่างได้ขอบดำ ตัวอักษรเข้มได้ขอบขาว) โหมดอัตโนมัติจะตามธีมและความสว่าง/มืดของปลั๊กอินพื้นหลัง',
        'custom.strokeWidth': 'ความหนาเส้นขอบ',
        'custom.strokeColor': 'สีเส้นขอบ',
        'custom.strokeColor.auto': 'อัตโนมัติ',
        'custom.weak': 'อ่อน',
        'custom.medium': 'ปานกลาง',
        'custom.strong': 'แรง',
        'custom.icon': 'ไอคอน',
        'custom.icon.solid': 'โฟลเดอร์ทึบ',
        'custom.icon.outline': 'โฟลเดอร์โปร่ง',
        'custom.icon.none': 'ไม่แสดง',
        'custom.none': 'ไม่มี',
        'custom.reset': 'ล้างการปรับแต่ง',
        'custom.done': 'เสร็จ',
        'settings.on': 'เปิด',
        'settings.off': 'ปิด',
        'sync.title': 'ซิงก์ข้ามอุปกรณ์',
        'sync.desc': 'รูปลักษณ์ที่กำหนดเอง กลุ่มที่สร้างไว้ และสวิตช์ต่าง ๆ อยู่ในเบราว์เซอร์ของอุปกรณ์นี้ และแลกเปลี่ยนกับอีกฝั่ง (เว็บ / แอปเดสก์ท็อป) ผ่านที่เก็บการตั้งค่าของโฮสต์ การแก้ไขใหม่จะเขียนลงโฮสต์อัตโนมัติ อีกฝั่งเพียงกด «ดึงข้อมูล» ข้อมูลจากเวอร์ชันเก่าต้องกด «ส่งข้อมูล» หนึ่งครั้ง',
        'sync.mode.overwrite': 'เขียนทับอุปกรณ์นี้',
        'sync.mode.merge': 'รวมทั้งสองฝั่ง',
        'sync.pull.desktop': 'ดึงจากแอปเดสก์ท็อป',
        'sync.pull.web': 'ดึงจากเว็บ',
        'sync.push': 'ส่งข้อมูลอุปกรณ์นี้',
        'sync.done': 'ซิงก์แล้ว',
        'sync.empty': 'อีกฝั่งยังไม่มีข้อมูลให้ดึง',
        'sync.off': 'สภาพแวดล้อมนี้ไม่รองรับการซิงก์ (ต้องมีบริการการตั้งค่าของโฮสต์)',
        'sync.loading': 'กำลังเชื่อมต่อการตั้งค่าโฮสต์…',
        'error.title': 'เกิดข้อผิดพลาด',
        'cancel': 'ยกเลิก',
        'confirm': 'ตกลง',
        'close': 'ปิด',
        'ws.rename.title': 'เปลี่ยนชื่อพื้นที่ทำงาน',
        'ws.rename.hint': '/ ในชื่อคือระดับกลุ่ม เช่น web/frontend',
        'ws.delete.title': 'ลบพื้นที่ทำงาน',
        'ws.delete.body': 'ลบเฉพาะทะเบียนพื้นที่ทำงาน ไดเรกทอรีและบันทึกเซสชันยังอยู่ ลบ «{name}» หรือไม่',
        'folder.new.title': 'กลุ่มใหม่',
        'folder.new.hint': 'เส้นทางกลุ่ม ใช้ / แบ่งหลายระดับ เช่น web/frontend',
        'folder.rename.title': 'เปลี่ยนชื่อกลุ่ม',
        'folder.rename.hint': 'การเปลี่ยนชื่อจะอัปเดตพื้นที่ทำงานทั้งหมดในกลุ่ม',
        'folder.delete.body': 'ลบกลุ่มว่าง «{name}» หรือไม่',
        'folder.error.empty': 'เส้นทางกลุ่มต้องไม่ว่าง',
        'folder.error.exists': 'มีกลุ่มนี้อยู่แล้ว',
        'folder.error.notEmpty': 'กลุ่มนี้ยังมีพื้นที่ทำงานอยู่',
        'dir.new.title': 'New virtual folder',
        'dir.new.hint': 'Creates a grouping only — no folder on disk, no workspace touched',
        'dir.rename.title': 'Rename virtual folder',
        'dir.rename.hint': 'Renames the group only; real folders and workspaces are untouched',
        'dir.delete.title': 'Delete virtual folder',
        'dir.delete.body': 'Delete virtual folder "{name}" and all its subfolders? Real workspaces inside return to the root level; no folder on disk is deleted.',
        'dir.moveTo': 'Move into folder…',
        'dir.rootLevel': '(root level)',
      },
      /* locale: tr */
      'tr': {
        'title': 'Çalışma alanları',
        'add': 'Çalışma alanı ekle',
        'create': 'Oluştur',
        'rail.add': 'Çalışma alanı ekle',
        'menu.newSubWorkspace': 'Buraya alt çalışma alanı',
        'flow.title': 'Çalışma alanı ekle',
        'flow.picked': 'Seçilen klasör',
        'flow.parent': 'Bağlı olduğu grup',
        'flow.parentHint': 'Grup yolunu yazın veya seçin; boş = kök; düzeyler / ile ayrılır',
        'flow.creating': 'Oluşturuluyor…',
        'flow.parentDir': 'Üst sanal dizin',
        'flow.parentDirHint': 'The workspace is filed under the chosen virtual directory; the root level leaves it ungrouped. With no directories yet, create one from the sidebar toolbar first.',
        'browse.title': 'Çalışma alanı klasörünü seç',
        'browse.home': 'Ana dizin',
        'browse.newFolder': 'Yeni klasör',
        'browse.folderName': 'Klasör adı',
        'browse.showHidden': 'Gizli dosyaları göster',
        'browse.loading': 'Yükleniyor…',
        'browse.truncated': 'Çok fazla klasör var; yalnızca başlangıç gösteriliyor.',
        'browse.editPath': 'Yolu düzenle',
        'browse.open': 'Open',
        'browse.createIn': 'Create in "{name}"',
        'browse.untitledFolder': 'New folder',
        'search.placeholder': 'Çalışma alanı veya oturum ara',
        'rail.search': 'Ara',
        'empty': 'Henüz çalışma alanı yok',
        'empty.search': 'Eşleşen sonuç yok',
        'session.new': 'Yeni oturum',
        'group.ungrouped': 'Grubusuz',
        'session.more': '… {n} more in history',
        'session.more.less': 'Collapse history',
        'session.more.title': 'Shows only the last 7 days, up to 5 items; click to reveal the other {n}',
        'sessions.expand': '{n} oturumu göster',
        'sessions.collapse': 'Daralt',
        'time.now': 'az önce',
        'time.minutes': '{n} dk',
        'time.hours': '{n} sa',
        'time.days': '{n} g',
        'time.months': '{n} ay',
        'time.years': '{n} yıl',
        'status.running': 'Üretiliyor',
        'status.completed': 'Tamamlandı',
        'status.approval': 'Onay bekliyor',
        'status.planReview': 'Plan onayı bekliyor',
        'status.question': 'Yanıt bekliyor',
        'status.subagents': '{n} alt ajan çalışıyor',
        'status.compact.approval': 'Onay',
        'status.compact.answer': 'Yanıt',
        'status.compact.planReview': 'Plan',
        'schedule.active': 'Etkin zamanlanmış görev var',
        'menu.rename': 'Yeniden adlandır',
        'menu.openWsFolder': 'Çalışma alanı klasörünü aç',
        'menu.copyPath': 'Yolu kopyala',
        'path.copied': 'Yol kopyalandı',
        'path.none': 'Bu çalışma alanının klasör yolu yok',
        'menu.delete': 'Sil',
        'menu.fork': 'Çatalla',
        'menu.archive': 'Arşivle',
        'menu.newSubfolder': 'Yeni alt klasör',
        'menu.renameFolder': 'Klasörü yeniden adlandır',
        'menu.removeFolder': 'Klasörü sil',
        'menu.renameSgroup': 'Oturum grubunu yeniden adlandır',
        'settings.title': 'Daha iyi çalışma alanları',
        'settings.desc': 'Çalışma alanı ağacının görünümü ve daraltma tercihleri',
        'settings.expand': 'Genişlet',
        'settings.collapse': 'Daralt',
        'settings.compactChains': 'Tek çocuklu zincirleri birleştir',
        'settings.compactChains.hint': 'Tek çocuklu düzeyler tek satırda birleşir; birden çok çocuk olduğunda ağaç açılır; bir çalışma alanını sürüklerken zincirler geçici olarak klasörlere açılır, böylece her düzeye bırakabilirsiniz; açılma durumu ve özel görünüm bu tarayıcıda saklanır.',
        'settings.statusPulse': 'Nefes alan durum ışığı',
        'settings.statusPulse.hint': 'Daraltmayla gizlenen durum ışıkları (tamamlandı yeşil / çalışıyor mavi / bekliyor amber) hiyerarşide yukarı taşar: çalışma alanı ve klasör satırlarının simgesi durum renginde nefes alır (özel ışıması olan başlıklar da birlikte nefes alır), oturum grubu satırları nefes alan bir durum noktası gösterir; varsayılan olarak açık, buradan kapatılabilir.',
        'settings.appearance': 'Varsayılan görünüm',
        'settings.appearance.hint': 'Özel olarak uyarlanmamış satırlar bu görünümü kullanır; metin konturu varsayılan olarak açıktır — arka plan görseli üzerinde kontursuz metin çoğu zaman okunmaz. Rengi boş bırakırsanız temayı izler.',
        'settings.appearance.reset': 'Varsayılan görünüme dön',
        'custom.title': 'Görünümü özelleştir',
        'custom.color': 'Renk',
        'custom.glow': 'Işıma',
        'custom.preview': 'Canlı önizleme',
        'custom.preview.sample': 'Örnek çalışma alanı',
        'custom.weight': 'Yazı kalınlığı',
        'custom.weight.regular': 'Normal',
        'custom.weight.medium': 'Orta',
        'custom.weight.semibold': 'Yarı kalın',
        'custom.weight.bold': 'Kalın',
        'custom.shadow': 'Yazı gölgesi',
        'custom.stroke': 'Yazı konturu',
        'custom.stroke.hint': 'Kontur varsayılan olarak grisidir; siyah / beyaz / herhangi bir renk seçebilir ya da «Otomatik» ile yazı renginden karşıt kutbu türetebilirsiniz (açık yazıya siyah kenar, koyu yazıya beyaz kenar); Otomatik, temanın ve arka plan eklentisinin açık/koyu geçişini izler.',
        'custom.strokeWidth': 'Kontur kalınlığı',
        'custom.strokeColor': 'Kontur rengi',
        'custom.strokeColor.auto': 'Otomatik',
        'custom.weak': 'Zayıf',
        'custom.medium': 'Orta',
        'custom.strong': 'Güçlü',
        'custom.icon': 'Simge',
        'custom.icon.solid': 'Dolu klasör',
        'custom.icon.outline': 'Çerçeveli klasör',
        'custom.icon.none': 'Gizli',
        'custom.none': 'Yok',
        'custom.reset': 'Özelleştirmeyi temizle',
        'custom.done': 'Bitti',
        'settings.on': 'Açık',
        'settings.off': 'Kapalı',
        'sync.title': 'Cihazlar arası eşitleme',
        'sync.desc': 'Görünüm, açık klasörler ve anahtarlar bu cihazın tarayıcısında durur; ana makine ayar deposu üzerinden diğer tarafla (web / masaüstü uygulaması) alışveriş edilir. Yeni değişiklikler ana makineye kendiliğinden yazılır, diğer taraf yalnızca «Getir» demelidir; eski sürümlerden kalan veriler için bir kez «Gönder» gerekir.',
        'sync.mode.overwrite': 'Bu cihazın üzerine yaz',
        'sync.mode.merge': 'İki tarafı birleştir',
        'sync.pull.desktop': 'Masaüstü uygulamasından getir',
        'sync.pull.web': 'Web tarafından getir',
        'sync.push': 'Bu cihazın verilerini gönder',
        'sync.done': 'Eşitlendi',
        'sync.empty': 'Diğer tarafta alınacak veri yok',
        'sync.off': 'Bu ortamda eşitleme yok (ana makine ayar servisi gerekir)',
        'sync.loading': 'Ana makine ayarlarına bağlanılıyor…',
        'error.title': 'Bir şeyler ters gitti',
        'cancel': 'İptal',
        'confirm': 'Tamam',
        'close': 'Kapat',
        'ws.rename.title': 'Çalışma alanını yeniden adlandır',
        'ws.rename.hint': 'Addaki / grup düzeyini oluşturur, örn. web/frontend',
        'ws.delete.title': 'Çalışma alanını sil',
        'ws.delete.body': 'Yalnızca kayıt kaldırılır; dizin ve oturum kayıtları kalır. «{name}» silinsin mi?',
        'folder.new.title': 'Yeni klasör',
        'folder.new.hint': 'Klasör yolu; düzeyler / ile, örn. web/frontend',
        'folder.rename.title': 'Klasörü yeniden adlandır',
        'folder.rename.hint': 'Yeniden adlandırma klasördeki tüm çalışma alanlarını günceller',
        'folder.delete.body': 'Boş klasör «{name}» silinsin mi?',
        'folder.error.empty': 'Klasör yolu boş olamaz',
        'folder.error.exists': 'Klasör zaten var',
        'folder.error.notEmpty': 'Klasörde hâlâ çalışma alanları var',
        'dir.new.title': 'New virtual folder',
        'dir.new.hint': 'Creates a grouping only — no folder on disk, no workspace touched',
        'dir.rename.title': 'Rename virtual folder',
        'dir.rename.hint': 'Renames the group only; real folders and workspaces are untouched',
        'dir.delete.title': 'Delete virtual folder',
        'dir.delete.body': 'Delete virtual folder "{name}" and all its subfolders? Real workspaces inside return to the root level; no folder on disk is deleted.',
        'dir.moveTo': 'Move into folder…',
        'dir.rootLevel': '(root level)',
      },
      /* locale: vi */
      'vi': {
        'title': 'Không gian làm việc',
        'add': 'Thêm không gian làm việc',
        'create': 'Tạo',
        'rail.add': 'Thêm không gian làm việc',
        'menu.newSubWorkspace': 'Không gian làm việc con tại đây',
        'flow.title': 'Thêm không gian làm việc',
        'flow.picked': 'Thư mục đã chọn',
        'flow.parent': 'Nhóm trực thuộc',
        'flow.parentHint': 'Nhập hoặc chọn đường dẫn nhóm; để trống là gốc; nhiều tầng cách nhau bằng /',
        'flow.creating': 'Đang tạo…',
        'flow.parentDir': 'Thư mục ảo cha',
        'flow.parentDirHint': 'The workspace is filed under the chosen virtual directory; the root level leaves it ungrouped. With no directories yet, create one from the sidebar toolbar first.',
        'browse.title': 'Chọn thư mục không gian làm việc',
        'browse.home': 'Thư mục chính',
        'browse.newFolder': 'Thư mục mới',
        'browse.folderName': 'Tên thư mục',
        'browse.showHidden': 'Hiện tệp ẩn',
        'browse.loading': 'Đang tải…',
        'browse.truncated': 'Quá nhiều thư mục; chỉ hiển thị phần đầu.',
        'browse.editPath': 'Sửa đường dẫn',
        'browse.open': 'Open',
        'browse.createIn': 'Create in "{name}"',
        'browse.untitledFolder': 'New folder',
        'search.placeholder': 'Tìm không gian làm việc hoặc phiên',
        'rail.search': 'Tìm kiếm',
        'empty': 'Chưa có không gian làm việc',
        'empty.search': 'Không có kết quả phù hợp',
        'session.new': 'Phiên mới',
        'group.ungrouped': 'Chưa phân nhóm',
        'session.more': '… {n} more in history',
        'session.more.less': 'Collapse history',
        'session.more.title': 'Shows only the last 7 days, up to 5 items; click to reveal the other {n}',
        'sessions.expand': 'Hiện thêm {n} phiên',
        'sessions.collapse': 'Thu gọn',
        'time.now': 'vừa xong',
        'time.minutes': '{n} phút',
        'time.hours': '{n} giờ',
        'time.days': '{n} ngày',
        'time.months': '{n} tháng',
        'time.years': '{n} năm',
        'status.running': 'Đang tạo',
        'status.completed': 'Đã xong',
        'status.approval': 'Đang chờ phê duyệt',
        'status.planReview': 'Đang chờ duyệt kế hoạch',
        'status.question': 'Đang chờ trả lời',
        'status.subagents': '{n} tác nhân con đang chạy',
        'status.compact.approval': 'Phê duyệt',
        'status.compact.answer': 'Trả lời',
        'status.compact.planReview': 'Kế hoạch',
        'schedule.active': 'Có tác vụ hẹn giờ đang hoạt động',
        'menu.rename': 'Đổi tên',
        'menu.openWsFolder': 'Mở thư mục không gian làm việc',
        'menu.copyPath': 'Sao chép đường dẫn',
        'path.copied': 'Đã sao chép đường dẫn',
        'path.none': 'Không gian làm việc này không có đường dẫn thư mục',
        'menu.delete': 'Xóa',
        'menu.fork': 'Tách nhánh',
        'menu.archive': 'Lưu trữ',
        'menu.newSubfolder': 'Thư mục con mới',
        'menu.renameFolder': 'Đổi tên thư mục',
        'menu.removeFolder': 'Xóa thư mục',
        'menu.renameSgroup': 'Đổi tên nhóm phiên',
        'settings.title': 'Không gian làm việc tốt hơn',
        'settings.desc': 'Giao diện và cách thu gọn của cây không gian làm việc',
        'settings.expand': 'Mở rộng',
        'settings.collapse': 'Thu gọn',
        'settings.compactChains': 'Gộp chuỗi một nhánh',
        'settings.compactChains.hint': 'Các tầng chỉ có một nhánh con được gộp thành một dòng; khi có nhiều nhánh con, cây tự mở ra; khi kéo không gian làm việc, chuỗi tạm mở lại thành thư mục để có thể thả vào bất kỳ tầng nào; trạng thái mở và giao diện tùy chỉnh được lưu trong trình duyệt này.',
        'settings.statusPulse': 'Đèn trạng thái nhấp nháy',
        'settings.statusPulse.hint': 'Những đèn trạng thái bị thu gọn che đi (xong màu xanh lá / đang chạy màu xanh dương / đang chờ màu hổ phách) sẽ nổi dần lên các tầng trên: hàng không gian làm việc và thư mục cho biểu tượng nhấp nháy theo màu trạng thái (tiêu đề có đặt phát sáng cũng nhấp nháy theo), hàng nhóm phiên hiện một chấm trạng thái nhấp nháy; mặc định bật, có thể tắt tại đây.',
        'settings.appearance': 'Giao diện mặc định',
        'settings.appearance.hint': 'Những hàng chưa tùy chỉnh riêng dùng giao diện này; viền chữ mặc định bật — trên ảnh nền, chữ không viền thường khó đọc. Để trống màu để theo chủ đề.',
        'settings.appearance.reset': 'Khôi phục giao diện mặc định',
        'custom.title': 'Tùy chỉnh giao diện',
        'custom.color': 'Màu',
        'custom.glow': 'Phát sáng',
        'custom.preview': 'Xem trước trực tiếp',
        'custom.preview.sample': 'Không gian làm việc mẫu',
        'custom.weight': 'Độ đậm chữ',
        'custom.weight.regular': 'Thường',
        'custom.weight.medium': 'Vừa',
        'custom.weight.semibold': 'Hơi đậm',
        'custom.weight.bold': 'Đậm',
        'custom.shadow': 'Bóng chữ',
        'custom.stroke': 'Viền chữ',
        'custom.stroke.hint': 'Viền mặc định màu xám; có thể đổi sang đen / trắng / màu bất kỳ, hoặc chọn «Tự động» để lấy màu tương phản từ màu chữ (chữ sáng viền đen, chữ tối viền trắng); chế độ tự động theo chủ đề và độ sáng/tối của plugin nền.',
        'custom.strokeWidth': 'Độ dày viền',
        'custom.strokeColor': 'Màu viền',
        'custom.strokeColor.auto': 'Tự động',
        'custom.weak': 'Nhẹ',
        'custom.medium': 'Vừa',
        'custom.strong': 'Mạnh',
        'custom.icon': 'Biểu tượng',
        'custom.icon.solid': 'Thư mục đặc',
        'custom.icon.outline': 'Thư mục rỗng',
        'custom.icon.none': 'Không hiện',
        'custom.none': 'Không',
        'custom.reset': 'Xóa tùy chỉnh',
        'custom.done': 'Xong',
        'settings.on': 'Bật',
        'settings.off': 'Tắt',
        'sync.title': 'Đồng bộ giữa các thiết bị',
        'sync.desc': 'Giao diện tùy chỉnh, nhóm thư mục rõ ràng và các công tắc nằm trong trình duyệt của thiết bị này; chúng trao đổi với đầu bên kia (web / ứng dụng máy tính) qua kho cài đặt của máy chủ. Thay đổi mới được ghi vào máy chủ tự động, bên kia chỉ cần bấm «Lấy về»; dữ liệu từ phiên bản cũ cần bấm «Gửi đi» một lần.',
        'sync.mode.overwrite': 'Ghi đè thiết bị này',
        'sync.mode.merge': 'Gộp hai bên',
        'sync.pull.desktop': 'Lấy từ ứng dụng máy tính',
        'sync.pull.web': 'Lấy từ web',
        'sync.push': 'Gửi dữ liệu thiết bị này',
        'sync.done': 'Đã đồng bộ',
        'sync.empty': 'Bên kia chưa có dữ liệu để lấy',
        'sync.off': 'Môi trường này không hỗ trợ đồng bộ (cần dịch vụ cài đặt của máy chủ)',
        'sync.loading': 'Đang kết nối cài đặt máy chủ…',
        'error.title': 'Đã xảy ra lỗi',
        'cancel': 'Hủy',
        'confirm': 'OK',
        'close': 'Đóng',
        'ws.rename.title': 'Đổi tên không gian làm việc',
        'ws.rename.hint': 'Dấu / trong tên tạo thành nhóm tầng, ví dụ web/frontend',
        'ws.delete.title': 'Xóa không gian làm việc',
        'ws.delete.body': 'Chỉ xóa đăng ký; thư mục và nhật ký phiên vẫn được giữ. Xóa «{name}»?',
        'folder.new.title': 'Nhóm mới',
        'folder.new.hint': 'Đường dẫn nhóm; dùng / cho nhiều tầng, ví dụ web/frontend',
        'folder.rename.title': 'Đổi tên nhóm',
        'folder.rename.hint': 'Đổi tên sẽ cập nhật mọi không gian làm việc trong nhóm',
        'folder.delete.body': 'Xóa nhóm rỗng «{name}»?',
        'folder.error.empty': 'Đường dẫn nhóm không được để trống',
        'folder.error.exists': 'Nhóm đã tồn tại',
        'folder.error.notEmpty': 'Nhóm vẫn còn không gian làm việc',
        'dir.new.title': 'New virtual folder',
        'dir.new.hint': 'Creates a grouping only — no folder on disk, no workspace touched',
        'dir.rename.title': 'Rename virtual folder',
        'dir.rename.hint': 'Renames the group only; real folders and workspaces are untouched',
        'dir.delete.title': 'Delete virtual folder',
        'dir.delete.body': 'Delete virtual folder "{name}" and all its subfolders? Real workspaces inside return to the root level; no folder on disk is deleted.',
        'dir.moveTo': 'Move into folder…',
        'dir.rootLevel': '(root level)',
      },
      /* locale: zh-HK */
      'zh-HK': {
        'title': '工作區',
        'add': '新增工作區',
        'create': '建立',
        'rail.add': '新增工作區',
        'menu.newSubWorkspace': '新增子工作區',
        'flow.title': '新增工作區',
        'flow.picked': '揀咗嘅文件夾',
        'flow.parent': '所屬分組',
        'flow.parentHint': '輸入或者揀分組路徑,留空代表根分組;多級用 / 分隔',
        'flow.creating': '建立緊…',
        'flow.parentDir': '所屬虛擬目錄',
        'flow.parentDirHint': 'The workspace is filed under the chosen virtual directory; the root level leaves it ungrouped. With no directories yet, create one from the sidebar toolbar first.',
        'browse.title': '揀工作區資料夾',
        'browse.home': '主目錄',
        'browse.newFolder': '新增資料夾',
        'browse.folderName': '資料夾名稱',
        'browse.showHidden': '顯示隱藏檔案',
        'browse.loading': '載入緊…',
        'browse.truncated': '資料夾太多,只顯示開頭部分。',
        'browse.editPath': '編輯路徑',
        'browse.open': 'Open',
        'browse.createIn': 'Create in "{name}"',
        'browse.untitledFolder': 'New folder',
        'search.placeholder': '搵工作區或者對話',
        'rail.search': '搵',
        'empty': '未有工作區',
        'empty.search': '搵唔到符合嘅結果',
        'session.new': '新對話',
        'group.ungrouped': '未分組',
        'session.more': '… {n} more in history',
        'session.more.less': 'Collapse history',
        'session.more.title': 'Shows only the last 7 days, up to 5 items; click to reveal the other {n}',
        'sessions.expand': '展開 {n} 個對話',
        'sessions.collapse': '收起',
        'time.now': '啱啱',
        'time.minutes': '{n} 分鐘',
        'time.hours': '{n} 小時',
        'time.days': '{n} 日',
        'time.months': '{n} 個月',
        'time.years': '{n} 年',
        'status.running': '生成緊',
        'status.completed': '已完成',
        'status.approval': '等緊批准',
        'status.planReview': '等緊計劃確認',
        'status.question': '等緊回答',
        'status.subagents': '{n} 個子任務運行緊',
        'status.compact.approval': '待批准',
        'status.compact.answer': '待回答',
        'status.compact.planReview': '計劃待審',
        'schedule.active': '有進行緊嘅定時任務',
        'menu.rename': '重新命名',
        'menu.openWsFolder': '開啟工作區資料夾',
        'menu.copyPath': '複製路徑',
        'path.copied': '已複製路徑',
        'path.none': '此工作區沒有資料夾路徑',
        'menu.delete': '刪除',
        'menu.fork': '分叉',
        'menu.archive': '封存',
        'menu.newSubfolder': '新增子分組',
        'menu.renameFolder': '重新命名分組',
        'menu.removeFolder': '刪除分組',
        'menu.renameSgroup': '重新命名對話分組',
        'settings.title': '更好嘅工作區',
        'settings.desc': '工作區樹嘅外觀同收起偏好',
        'settings.expand': '展開',
        'settings.collapse': '收起',
        'settings.compactChains': '單鏈分組摺疊顯示',
        'settings.compactChains.hint': '單層鏈會合併成一行,出現多個子級就會自動展開成樹狀;拖拽工作區期間單鏈會臨時展開返做文件夾樹,可以放入任何一級;展開狀態同自訂外觀會喺呢個瀏覽器保存。',
        'settings.statusPulse': '狀態呼吸燈',
        'settings.statusPulse.hint': '被摺疊遮住嘅狀態燈(完成綠 / 運行藍 / 待互動琥珀)會沿住層級向外冒泡:工作區同分組行會以圖示呼吸發光(顏色跟狀態,自訂過發光嘅標題一齊呼吸),對話分組行就會顯示呼吸狀態燈;預設開啟,可以喺度閂咗佢。',
        'settings.appearance': '預設外觀',
        'settings.appearance.hint': '未單獨自訂過嘅行會用呢套外觀;字體描邊預設開啟——有背景圖嗰陣唔描邊嘅字經常睇唔清。字體顏色留空就會跟主題。',
        'settings.appearance.reset': '還原預設外觀',
        'custom.title': '自訂外觀',
        'custom.color': '顏色',
        'custom.glow': '發光',
        'custom.preview': '即時預覽',
        'custom.preview.sample': '工作區示例',
        'custom.weight': '字體粗細',
        'custom.weight.regular': '常規',
        'custom.weight.medium': '中',
        'custom.weight.semibold': '半粗',
        'custom.weight.bold': '粗',
        'custom.shadow': '字體陰影',
        'custom.stroke': '字體描邊',
        'custom.stroke.hint': '描邊顏色預設係灰色,可以改做黑 / 白 / 任意顏色,或者揀「自動」按字體顏色取反差色(淺色字配黑邊、深色字配白邊);自動模式會跟主題明暗同背景插件嘅介面明暗。',
        'custom.strokeWidth': '描邊粗細',
        'custom.strokeColor': '描邊顏色',
        'custom.strokeColor.auto': '自動',
        'custom.weak': '弱',
        'custom.medium': '中',
        'custom.strong': '強',
        'custom.icon': '圖示',
        'custom.icon.solid': '實心文件夾',
        'custom.icon.outline': '空心文件夾',
        'custom.icon.none': '唔顯示',
        'custom.none': '唔顯示',
        'custom.reset': '清除自訂',
        'custom.done': '完成',
        'settings.on': '開',
        'settings.off': '關',
        'sync.title': '跨端同步',
        'sync.desc': '外觀自訂、明確分組同開關會保存喺呢部裝置嘅瀏覽器;透過宿主設定儲存同另一端互傳。平時嘅新修改會自動寫入宿主,另一端撳「獲取」就攞到;舊版本嘅歷史資料第一次要撳一次「發送」。',
        'sync.mode.overwrite': '覆蓋呢部裝置',
        'sync.mode.merge': '合併兩端',
        'sync.pull.desktop': '由桌面客户端獲取',
        'sync.pull.web': '由 Web 獲取',
        'sync.push': '發送呢部裝置嘅資料',
        'sync.done': '已同步',
        'sync.empty': '另一端暫時未有資料可以獲取',
        'sync.off': '呢個環境唔支援同步(需要宿主設定服務)',
        'sync.loading': '連接緊宿主設定…',
        'error.title': '出咗錯',
        'cancel': '取消',
        'confirm': '確定',
        'close': '關閉',
        'ws.rename.title': '重新命名工作區',
        'ws.rename.hint': '名稱入面嘅 / 就係層級分組,例如 web/前端',
        'ws.delete.title': '刪除工作區',
        'ws.delete.body': '只會移除工作區登記,目錄同對話記錄都會保留。確定刪除「{name}」?',
        'folder.new.title': '新增分組',
        'folder.new.hint': '分組路徑,可以用 / 表示多級,例如 web/前端',
        'folder.rename.title': '重新命名分組',
        'folder.rename.hint': '重新命名會同步更新組內所有工作區名稱',
        'folder.delete.body': '刪除空分組「{name}」?',
        'folder.error.empty': '分組路徑唔可以係空',
        'folder.error.exists': '分組已經存在',
        'folder.error.notEmpty': '分組入面仲有工作區,唔可以刪除',
        'dir.new.title': 'New virtual folder',
        'dir.new.hint': 'Creates a grouping only — no folder on disk, no workspace touched',
        'dir.rename.title': 'Rename virtual folder',
        'dir.rename.hint': 'Renames the group only; real folders and workspaces are untouched',
        'dir.delete.title': 'Delete virtual folder',
        'dir.delete.body': 'Delete virtual folder "{name}" and all its subfolders? Real workspaces inside return to the root level; no folder on disk is deleted.',
        'dir.moveTo': 'Move into folder…',
        'dir.rootLevel': '(root level)',
      },
      /* locale: zh-MO */
      'zh-MO': {
        'title': '工作區',
        'add': '新增工作區',
        'create': '建立',
        'rail.add': '新增工作區',
        'menu.newSubWorkspace': '新增子工作區',
        'flow.title': '新增工作區',
        'flow.picked': '揀咗嘅文件夾',
        'flow.parent': '所屬分組',
        'flow.parentHint': '輸入或者揀分組路徑,留空代表根分組;多級用 / 分隔',
        'flow.creating': '建立緊…',
        'flow.parentDir': '所屬虛擬目錄',
        'flow.parentDirHint': 'The workspace is filed under the chosen virtual directory; the root level leaves it ungrouped. With no directories yet, create one from the sidebar toolbar first.',
        'browse.title': '揀工作區資料夾',
        'browse.home': '主目錄',
        'browse.newFolder': '新增資料夾',
        'browse.folderName': '資料夾名稱',
        'browse.showHidden': '顯示隱藏檔案',
        'browse.loading': '載入緊…',
        'browse.truncated': '資料夾太多,只顯示開頭部分。',
        'browse.editPath': '編輯路徑',
        'browse.open': 'Open',
        'browse.createIn': 'Create in "{name}"',
        'browse.untitledFolder': 'New folder',
        'search.placeholder': '搵工作區或者對話',
        'rail.search': '搵',
        'empty': '未有工作區',
        'empty.search': '搵唔到符合嘅結果',
        'session.new': '新對話',
        'group.ungrouped': '未分組',
        'session.more': '… {n} more in history',
        'session.more.less': 'Collapse history',
        'session.more.title': 'Shows only the last 7 days, up to 5 items; click to reveal the other {n}',
        'sessions.expand': '展開 {n} 個對話',
        'sessions.collapse': '收起',
        'time.now': '啱啱',
        'time.minutes': '{n} 分鐘',
        'time.hours': '{n} 小時',
        'time.days': '{n} 日',
        'time.months': '{n} 個月',
        'time.years': '{n} 年',
        'status.running': '生成緊',
        'status.completed': '已完成',
        'status.approval': '等緊批准',
        'status.planReview': '等緊計劃確認',
        'status.question': '等緊回答',
        'status.subagents': '{n} 個子任務運行緊',
        'status.compact.approval': '待批准',
        'status.compact.answer': '待回答',
        'status.compact.planReview': '計劃待審',
        'schedule.active': '有進行緊嘅定時任務',
        'menu.rename': '重新命名',
        'menu.openWsFolder': '開啟工作區資料夾',
        'menu.copyPath': '複製路徑',
        'path.copied': '已複製路徑',
        'path.none': '此工作區沒有資料夾路徑',
        'menu.delete': '刪除',
        'menu.fork': '分叉',
        'menu.archive': '封存',
        'menu.newSubfolder': '新增子分組',
        'menu.renameFolder': '重新命名分組',
        'menu.removeFolder': '刪除分組',
        'menu.renameSgroup': '重新命名對話分組',
        'settings.title': '更好嘅工作區',
        'settings.desc': '工作區樹嘅外觀同收起偏好',
        'settings.expand': '展開',
        'settings.collapse': '收起',
        'settings.compactChains': '單鏈分組摺疊顯示',
        'settings.compactChains.hint': '單層鏈會合併成一行,出現多個子級就會自動展開成樹狀;拖拽工作區期間單鏈會臨時展開返做文件夾樹,可以放入任何一級;展開狀態同自訂外觀會喺呢個瀏覽器保存。',
        'settings.statusPulse': '狀態呼吸燈',
        'settings.statusPulse.hint': '被摺疊遮住嘅狀態燈(完成綠 / 運行藍 / 待互動琥珀)會沿住層級向外冒泡:工作區同分組行會以圖示呼吸發光(顏色跟狀態,自訂過發光嘅標題一齊呼吸),對話分組行就會顯示呼吸狀態燈;預設開啟,可以喺度閂咗佢。',
        'settings.appearance': '預設外觀',
        'settings.appearance.hint': '未單獨自訂過嘅行會用呢套外觀;字體描邊預設開啟——有背景圖嗰陣唔描邊嘅字經常睇唔清。字體顏色留空就會跟主題。',
        'settings.appearance.reset': '還原預設外觀',
        'custom.title': '自訂外觀',
        'custom.color': '顏色',
        'custom.glow': '發光',
        'custom.preview': '即時預覽',
        'custom.preview.sample': '工作區示例',
        'custom.weight': '字體粗細',
        'custom.weight.regular': '常規',
        'custom.weight.medium': '中',
        'custom.weight.semibold': '半粗',
        'custom.weight.bold': '粗',
        'custom.shadow': '字體陰影',
        'custom.stroke': '字體描邊',
        'custom.stroke.hint': '描邊顏色預設係灰色,可以改做黑 / 白 / 任意顏色,或者揀「自動」按字體顏色取反差色(淺色字配黑邊、深色字配白邊);自動模式會跟主題明暗同背景插件嘅介面明暗。',
        'custom.strokeWidth': '描邊粗細',
        'custom.strokeColor': '描邊顏色',
        'custom.strokeColor.auto': '自動',
        'custom.weak': '弱',
        'custom.medium': '中',
        'custom.strong': '強',
        'custom.icon': '圖示',
        'custom.icon.solid': '實心文件夾',
        'custom.icon.outline': '空心文件夾',
        'custom.icon.none': '唔顯示',
        'custom.none': '唔顯示',
        'custom.reset': '清除自訂',
        'custom.done': '完成',
        'settings.on': '開',
        'settings.off': '關',
        'sync.title': '跨端同步',
        'sync.desc': '外觀自訂、明確分組同開關會保存喺呢部裝置嘅瀏覽器;透過宿主設定儲存同另一端互傳。平時嘅新修改會自動寫入宿主,另一端撳「獲取」就攞到;舊版本嘅歷史資料第一次要撳一次「發送」。',
        'sync.mode.overwrite': '覆蓋呢部裝置',
        'sync.mode.merge': '合併兩端',
        'sync.pull.desktop': '由桌面客户端獲取',
        'sync.pull.web': '由 Web 獲取',
        'sync.push': '發送呢部裝置嘅資料',
        'sync.done': '已同步',
        'sync.empty': '另一端暫時未有資料可以獲取',
        'sync.off': '呢個環境唔支援同步(需要宿主設定服務)',
        'sync.loading': '連接緊宿主設定…',
        'error.title': '出咗錯',
        'cancel': '取消',
        'confirm': '確定',
        'close': '關閉',
        'ws.rename.title': '重新命名工作區',
        'ws.rename.hint': '名稱入面嘅 / 就係層級分組,例如 web/前端',
        'ws.delete.title': '刪除工作區',
        'ws.delete.body': '只會移除工作區登記,目錄同對話記錄都會保留。確定刪除「{name}」?',
        'folder.new.title': '新增分組',
        'folder.new.hint': '分組路徑,可以用 / 表示多級,例如 web/前端',
        'folder.rename.title': '重新命名分組',
        'folder.rename.hint': '重新命名會同步更新組內所有工作區名稱',
        'folder.delete.body': '刪除空分組「{name}」?',
        'folder.error.empty': '分組路徑唔可以係空',
        'folder.error.exists': '分組已經存在',
        'folder.error.notEmpty': '分組入面仲有工作區,唔可以刪除',
        'dir.new.title': 'New virtual folder',
        'dir.new.hint': 'Creates a grouping only — no folder on disk, no workspace touched',
        'dir.rename.title': 'Rename virtual folder',
        'dir.rename.hint': 'Renames the group only; real folders and workspaces are untouched',
        'dir.delete.title': 'Delete virtual folder',
        'dir.delete.body': 'Delete virtual folder "{name}" and all its subfolders? Real workspaces inside return to the root level; no folder on disk is deleted.',
        'dir.moveTo': 'Move into folder…',
        'dir.rootLevel': '(root level)',
      },
      /* locale: zh-TW */
      'zh-TW': {
        'title': '工作區',
        'add': '新增工作區',
        'create': '建立',
        'rail.add': '新增工作區',
        'menu.newSubWorkspace': '新增子工作區',
        'flow.title': '新增工作區',
        'flow.picked': '所選資料夾',
        'flow.parent': '所屬群組',
        'flow.parentHint': '輸入或下拉選擇群組路徑,留空表示根群組;多層用 / 分隔',
        'flow.creating': '正在建立…',
        'flow.parentDir': '所屬虛擬目錄',
        'flow.parentDirHint': 'The workspace is filed under the chosen virtual directory; the root level leaves it ungrouped. With no directories yet, create one from the sidebar toolbar first.',
        'browse.title': '選擇工作區資料夾',
        'browse.home': '主目錄',
        'browse.newFolder': '新增資料夾',
        'browse.folderName': '資料夾名稱',
        'browse.showHidden': '顯示隱藏檔案',
        'browse.loading': '載入中…',
        'browse.truncated': '資料夾過多,僅顯示開頭部分。',
        'browse.editPath': '編輯路徑',
        'browse.open': 'Open',
        'browse.createIn': 'Create in "{name}"',
        'browse.untitledFolder': 'New folder',
        'search.placeholder': '搜尋工作區或工作階段',
        'rail.search': '搜尋',
        'empty': '尚無工作區',
        'empty.search': '沒有相符的結果',
        'session.new': '新工作階段',
        'group.ungrouped': '未分組',
        'session.more': '… {n} more in history',
        'session.more.less': 'Collapse history',
        'session.more.title': 'Shows only the last 7 days, up to 5 items; click to reveal the other {n}',
        'sessions.expand': '展開 {n} 個工作階段',
        'sessions.collapse': '收合',
        'time.now': '剛剛',
        'time.minutes': '{n} 分鐘',
        'time.hours': '{n} 小時',
        'time.days': '{n} 天',
        'time.months': '{n} 個月',
        'time.years': '{n} 年',
        'status.running': '生成中',
        'status.completed': '已完成',
        'status.approval': '等待核准',
        'status.planReview': '等待計畫確認',
        'status.question': '等待回答',
        'status.subagents': '{n} 個子任務執行中',
        'status.compact.approval': '待核准',
        'status.compact.answer': '待回答',
        'status.compact.planReview': '計畫待審',
        'schedule.active': '有進行中的排程工作',
        'menu.rename': '重新命名',
        'menu.openWsFolder': '開啟工作區資料夾',
        'menu.copyPath': '複製路徑',
        'path.copied': '已複製路徑',
        'path.none': '此工作區沒有資料夾路徑',
        'menu.delete': '刪除',
        'menu.fork': '分支',
        'menu.archive': '封存',
        'menu.newSubfolder': '新增子群組',
        'menu.renameFolder': '重新命名群組',
        'menu.removeFolder': '刪除群組',
        'menu.renameSgroup': '重新命名工作階段群組',
        'settings.title': '更好的工作區',
        'settings.desc': '工作區樹的外觀與收合偏好',
        'settings.expand': '展開',
        'settings.collapse': '收合',
        'settings.compactChains': '單鏈群組合併顯示',
        'settings.compactChains.hint': '單層鏈會合併成一行,出現多個子層級時自動展開為樹狀;拖曳工作區期間單鏈會暫時展開回資料夾樹,可放入任一層級;展開狀態與自訂外觀會保存在本瀏覽器。',
        'settings.statusPulse': '狀態呼吸燈',
        'settings.statusPulse.hint': '被收合藏起的狀態燈(完成綠 / 執行藍 / 待互動琥珀)會沿著層級向外冒出:工作區與群組列以圖示呼吸發光(顏色隨狀態,自訂過發光的標題一起呼吸),工作階段群組列則顯示呼吸狀態燈;預設開啟,可在此關閉。',
        'settings.appearance': '預設外觀',
        'settings.appearance.hint': '未個別自訂過的列會使用這套外觀;字型外框預設開啟——在背景圖片上沒有外框的文字常常看不清楚。字型顏色留空即跟隨佈景主題。',
        'settings.appearance.reset': '還原預設外觀',
        'custom.title': '自訂外觀',
        'custom.color': '顏色',
        'custom.glow': '發光',
        'custom.preview': '即時預覽',
        'custom.preview.sample': '工作區範例',
        'custom.weight': '字型粗細',
        'custom.weight.regular': '標準',
        'custom.weight.medium': '中',
        'custom.weight.semibold': '半粗',
        'custom.weight.bold': '粗',
        'custom.shadow': '字型陰影',
        'custom.stroke': '字型外框',
        'custom.stroke.hint': '外框顏色預設為灰色,可改成黑 / 白 / 任意顏色,或選「自動」依字型顏色取對比色(淺色字配黑邊、深色字配白邊);自動模式會跟隨佈景主題明暗與背景插件的介面明暗。',
        'custom.strokeWidth': '外框粗細',
        'custom.strokeColor': '外框顏色',
        'custom.strokeColor.auto': '自動',
        'custom.weak': '弱',
        'custom.medium': '中',
        'custom.strong': '強',
        'custom.icon': '圖示',
        'custom.icon.solid': '實心資料夾',
        'custom.icon.outline': '空心資料夾',
        'custom.icon.none': '不顯示',
        'custom.none': '不顯示',
        'custom.reset': '清除自訂',
        'custom.done': '完成',
        'settings.on': '開',
        'settings.off': '關',
        'sync.title': '跨裝置同步',
        'sync.desc': '外觀自訂、明確群組與開關會保存在本裝置的瀏覽器;透過宿主設定儲存與另一端互相傳送。平常的新修改會自動寫入宿主,另一端按「取得」即可拿到;舊版本的歷史資料第一次需要按一次「傳送」。',
        'sync.mode.overwrite': '覆寫本裝置',
        'sync.mode.merge': '合併兩端',
        'sync.pull.desktop': '從桌面用戶端取得',
        'sync.pull.web': '從 Web 取得',
        'sync.push': '傳送本裝置資料',
        'sync.done': '已同步',
        'sync.empty': '另一端尚無資料可取得',
        'sync.off': '目前環境不支援同步(需要宿主設定服務)',
        'sync.loading': '正在連線宿主設定…',
        'error.title': '發生錯誤',
        'cancel': '取消',
        'confirm': '確定',
        'close': '關閉',
        'ws.rename.title': '重新命名工作區',
        'ws.rename.hint': '名稱中的 / 即層級群組,例如 web/前端',
        'ws.delete.title': '刪除工作區',
        'ws.delete.body': '僅移除工作區登錄,目錄與工作階段記錄都會保留。確定刪除「{name}」?',
        'folder.new.title': '新增群組',
        'folder.new.hint': '群組路徑,可用 / 表示多層,例如 web/前端',
        'folder.rename.title': '重新命名群組',
        'folder.rename.hint': '重新命名會同步更新群組內所有工作區名稱',
        'folder.delete.body': '刪除空群組「{name}」?',
        'folder.error.empty': '群組路徑不能為空',
        'folder.error.exists': '群組已存在',
        'folder.error.notEmpty': '群組內還有工作區,無法刪除',
        'dir.new.title': 'New virtual folder',
        'dir.new.hint': 'Creates a grouping only — no folder on disk, no workspace touched',
        'dir.rename.title': 'Rename virtual folder',
        'dir.rename.hint': 'Renames the group only; real folders and workspaces are untouched',
        'dir.delete.title': 'Delete virtual folder',
        'dir.delete.body': 'Delete virtual folder "{name}" and all its subfolders? Real workspaces inside return to the root level; no folder on disk is deleted.',
        'dir.moveTo': 'Move into folder…',
        'dir.rootLevel': '(root level)',
      },
    }

    /* ============================= helpers ============================ */

    const cls = (...xs) => xs.filter(Boolean).join(' ')
    const messageOf = (reason) => (reason instanceof Error ? reason.message : String(reason))

    const basename = (p) => {
      if (!p) return ''
      const s = String(p).replace(/[\\/]+$/, '')
      const i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'))
      return i === -1 ? s : s.slice(i + 1)
    }
    /**
     * Plain-text splitting with the URL tail kept opaque: a bare "/" split
     * shreds URLs ("https:" → empty → host → path...), so from the first
     * "://" onward the tail is ONE leaf; text before the marker splits
     * normally at the last "/" before it. This is the FALLBACK guard —
     * freshly generated titles get their whole "/"-bearing title wrapped in
     * quotes by the quote-on-land effect (see BetterBrowser), which is the
     * primary mechanism.
     */
    const splitPlainSegs = (text) => {
      const s = String(text || '')
      const schemeAt = s.indexOf('://')
      if (schemeAt === -1) return s.split('/').map(x => x.trim()).filter(Boolean)
      const cut = s.lastIndexOf('/', schemeAt)
      const segs = (cut === -1 ? '' : s.slice(0, cut)).split('/').map(x => x.trim()).filter(Boolean)
      const tail = s.slice(cut + 1).trim()
      if (tail !== '') segs.push(tail)
      return segs
    }

    /**
     * Title → hierarchy segments, QUOTE-AWARE: a PAIRED “…” (or "…") span is
     * verbatim — slashes inside quotes never split, the quotes stay part of
     * the leaf. Text outside paired spans splits through splitPlainSegs
     * (URL-tail opaque). A LONE quote character — an opener with no matching
     * closer, or a closer without an opener — is an ORDINARY character and
     * splits normally around it (0.9.1 swallowed the tail after an
     * unterminated opener; the user wants lone quotes as plain text).
     * Grouping is a pure projection, so previously shredded titles re-flow
     * on reload.
     */
    const splitTitleSegs = (title) => {
      const s = String(title || '')
      if (!/["“]/.test(s)) return splitPlainSegs(s)
      const out = []
      let plain = ''
      let i = 0
      while (i < s.length) {
        const ch = s[i]
        if (ch === '"' || ch === '“') {
          const close = ch === '“' ? '”' : '"'
          const j = s.indexOf(close, i + 1)
          if (j === -1) { // lone opener: ordinary character, keep scanning
            plain += ch
            i += 1
            continue
          }
          for (const seg of splitPlainSegs(plain)) out.push(seg)
          plain = ''
          const end = j + 1
          const quoted = s.slice(i, end).trim()
          if (quoted !== '') out.push(quoted)
          i = end
          continue
        }
        plain += ch
        i += 1
      }
      for (const seg of splitPlainSegs(plain)) out.push(seg)
      return out
    }
    const normPath = (p) => splitTitleSegs(p).join('/')

    /**
     * Glyphs a host may have RETIRED, mapped to the surviving equivalents in
     * preference order. dsh 0.1.6-alpha.1 replaced IconSendOutline16 with
     * IconPaperPlaneOutline14 and deleted the old export, so a saved custom
     * icon naming it must land on something real rather than an empty cell.
     *
     * dsh 0.2.0-rc.2 retired the whole `Icon<Name>Outline<px>` generation and
     * shipped `Icon<Name>Outline<weight>` (Regular / Medium / Artwork) instead:
     * all 75 glyph names this plugin renders vanished from the primitives
     * export in one upgrade, and since `icon()` degrades an unknown name to
     * null, every button silently became an empty transparent hit area — the
     * sidebar toolbar's three actions were invisible, with nothing to hover.
     * The table below is the complete rewrite (`Outline<px>` → `OutlineRegular`,
     * which preserves each glyph's meaning) plus the four fill-era names that
     * had no Outline<px> sibling.
     */
    const ICON_ALIASES = {
      IconAgentPresetOutline16: ['IconAgentPresetOutlineRegular'],
      IconAlarmClockOutline16: ['IconAlarmClockOutlineRegular'],
      IconApiOutline14: ['IconApiOutlineRegular'],
      IconArchiveOutline20: ['IconArchiveOutlineRegular'],
      IconBranchOutline16: ['IconBranchOutlineRegular'],
      IconBrowseOutline16: ['IconBrowseOutlineRegular'],
      IconCheckOutline14: ['IconCheckOutlineRegular'],
      IconCheckOutline16: ['IconCheckOutlineRegular'],
      IconChecklistOutline14: ['IconChecklistOutlineRegular'],
      IconChevronDownOutline14: ['IconChevronDownOutlineRegular'],
      IconChevronLeftOutline14: ['IconChevronLeftOutlineRegular'],
      IconChevronRightOutline14: ['IconChevronRightOutlineRegular'],
      IconChevronUpOutline14: ['IconChevronUpOutlineRegular'],
      IconClockOutline16: ['IconClockOutlineRegular'],
      IconCloseOutline16: ['IconCloseOutlineRegular'],
      IconCodeOutline16: ['IconCodeOutlineRegular'],
      IconCompactOutline16: ['IconCompactOutlineRegular'],
      IconContextInjectionOutline16: ['IconContextInjectionOutlineRegular'],
      IconCopyOutline16: ['IconCopyOutlineRegular'],
      IconCordisPluginOutline14: ['IconCordisPluginOutlineRegular'],
      IconDarkOutline16: ['IconDarkOutlineRegular'],
      IconDataOutline16: ['IconDataOutlineRegular'],
      IconDatabaseOutline16: ['IconDatabaseOutlineRegular'],
      IconDislikeOutline16: ['IconDislikeOutlineRegular'],
      IconDownloadOutline16: ['IconDownloadOutlineRegular'],
      IconEditOutline16: ['IconEditOutlineRegular'],
      IconEllipsisOutline16: ['IconEllipsisOutlineRegular'],
      IconEnhanceOutline16: ['IconEnhanceOutlineRegular'],
      IconFolderOpen16: ['IconFolderOpenOutlineRegular'],
      IconFolderOpenOutline16: ['IconFolderOpenOutlineRegular'],
      IconFollowsystemOutline16: ['IconFollowsystemOutlineRegular'],
      IconFullscreenOutline16: ['IconFullscreenOutlineRegular'],
      IconGlobeOutline14: ['IconGlobeOutlineRegular'],
      IconGoalOutline16: ['IconGoalOutlineRegular'],
      IconInspectOutline12: ['IconInspectOutlineRegular'],
      IconLightOutline16: ['IconLightOutlineRegular'],
      IconLikeOutline16: ['IconLikeOutlineRegular'],
      IconLinkOutline14: ['IconLinkOutlineRegular'],
      IconLinkOutline16: ['IconLinkOutlineRegular'],
      IconListPenOutline16: ['IconListPenOutlineRegular'],
      IconLoadingOutline16: ['IconLoadingOutlineRegular'],
      IconNewChatOutline16: ['IconNewChatOutlineRegular'],
      IconPanelLeftOutline16: ['IconPanelLeftOutlineRegular'],
      IconPaperPlaneOutline14: ['IconPaperPlaneOutlineRegular'],
      IconPaperclipOutline16: ['IconPaperclipOutlineRegular'],
      IconPauseOutline16: ['IconPauseOutlineRegular'],
      IconPersonalizationOutline16: ['IconPersonalizationOutlineRegular'],
      IconPlanOutline14: ['IconPlanOutlineRegular'],
      IconPlayOutline16: ['IconPlayOutlineRegular'],
      IconPlusOutline16: ['IconPlusOutlineRegular'],
      IconProjectAddOutline16: ['IconProjectAddOutlineRegular'],
      IconQuestionOutline14: ['IconQuestionOutlineRegular'],
      IconQueueOutline14: ['IconQueueOutlineRegular'],
      IconRefreshOutline14: ['IconRefreshOutlineRegular'],
      IconRefreshOutline16: ['IconRefreshOutlineRegular'],
      IconRightUpOutline14: ['IconRightUpOutlineRegular'],
      IconSearchOutline16: ['IconSearchOutlineRegular'],
      IconSendOutline14: ['IconSendOutlineRegular'],
      IconSendOutline16: ['IconSendOutlineRegular'],
      IconSettingsOutline14: ['IconSettingsOutlineRegular'],
      IconSettingsOutline16: ['IconSettingsOutlineRegular'],
      IconShareOutline16: ['IconShareOutlineRegular'],
      IconShieldOutline16: ['IconShieldOutlineRegular'],
      IconSkillOutline16: ['IconSkillOutlineRegular'],
      IconThinkOutline14: ['IconThinkOutlineRegular'],
      IconThinkOutline16: ['IconThinkOutlineRegular'],
      IconTrashOutline16: ['IconTrashOutlineRegular'],
      IconUserOutline16: ['IconUserOutlineRegular'],
      IconWarningOutline16: ['IconWarningOutlineRegular'],
      IconWrapLinesOutline16: ['IconWrapLinesOutlineRegular'],
      IconFolderClose16: ['IconFolderCloseRegular'],
      IconSparkle16: ['IconSparkleRegular'],
      IconStopFill16: ['IconStopFillRegular'],
      IconTriangleRightFill14: ['IconTriangleRightFillRegular'],
    }

    /**
     * Resolve one configured icon value to a glyph the LOADED primitives
     * actually export (pure). Retired names follow their alias chain, unknown
     * names degrade to '' — so both the picker grid and a choice persisted
     * before an upgrade survive a host that renamed its icon set.
     */
    const resolveIconName = (name) => {
      if (typeof name !== 'string' || name === '') return ''
      if (ui[name]) return name
      const aliases = ICON_ALIASES[name]
      if (aliases) for (const alias of aliases) if (ui[alias]) return alias
      return ''
    }

    /**
     * Render a primitives icon by name; unknown names degrade to null, never
     * crash. Resolution goes through resolveIconName so a retired name (see
     * ICON_ALIASES) still draws its surviving equivalent instead of an empty
     * cell — the alias table only helps call sites that actually consult it.
     */
    const icon = (name, size) => {
      const resolved = resolveIconName(name)
      const C = resolved === '' ? undefined : ui[resolved]
      return C ? E(C, { size: size || 16 }) : null
    }

    /**
     * Wrap an icon-only control in the host's Tooltip so hovering names it —
     * `aria-label` alone serves screen readers and shows NOTHING on hover, so
     * a bare glyph button is unlabelled for anyone with a mouse. The host
     * Tooltip clones its child (ref + mouse/focus handlers, no wrapper DOM),
     * so the button keeps its own layout box; when a host ships no Tooltip the
     * native `title` fallback keeps the hint reachable.
     */
    const withTip = (child, label) => {
      if (!child || typeof label !== 'string' || label === '') return child
      if (typeof ui.Tooltip === 'function') return E(ui.Tooltip, { label: label, side: 'bottom', delayMs: 300 }, child)
      try { return React.cloneElement(child, { title: label }) } catch (err) { return child }
    }

    const FALLBACK_UNITS = { minutes: 'm', hours: 'h', days: 'd', months: 'mo', years: 'y' }
    const timeLabel = (updatedAt, now, t) => {
      if (typeof ui.relativeTime !== 'function') return ''
      const r = ui.relativeTime(updatedAt, now)
      if (!r) return ''
      if (r.unit === 'now') return t('time.now')
      const key = 'time.' + r.unit
      const out = t(key, { n: r.n })
      if (typeof out === 'string' && out !== '' && out !== key) return out
      return String(r.n) + (FALLBACK_UNITS[r.unit] || '')
    }

    const pendingKindOf = (pending, id) => {
      if (!pending) return undefined
      const p = typeof pending.get === 'function' ? pending.get(id) : pending[id]
      if (!p) return undefined
      return p.kind || p.status || p.type || 'pending'
    }

    /**
     * Session UI status across host generations.
     *
     * dsh 0.2 moved the status facts OFF the session list summary into the
     * unified UI status store, published to every slot component as the global
     * `useSessionStatus` standard hook (`ReadonlyMap<SessionId, SessionStatus>`):
     * `running`, `pendingInteraction` and `completionUnread`. The 0.1-era
     * `useSessionPendingInteraction` hook and the summary's `completed` flag no
     * longer exist on current hosts — with them, the amber waiting-for-input dot,
     * the "待回答/待审批" row label and the green task-completed dot silently
     * vanished from this browser (the plugin still rendered the shipped dots for
     * a running session, because `summary.running` survived).
     *
     * Resolution order mirrors the shipped browser: live status first, then the
     * legacy spellings, so a 0.1 host keeps working too.
     */
    const interactionKindOf = (value) => {
      if (!value || typeof value !== 'object') return undefined
      return value.kind || value.status || value.type || undefined
    }

    const liveStatusOf = (statuses, id) => (statuses && typeof statuses.get === 'function'
      ? statuses.get(id)
      : undefined)

    const runningOf = (live, summary) => (live && live.running !== undefined
      ? live.running === true
      : !!(summary && summary.running))

    const sessionFactsOf = (statuses, legacyPending, id, summary) => {
      const live = liveStatusOf(statuses, id)
      return {
        running: runningOf(live, summary),
        pending: interactionKindOf(live && live.pendingInteraction) || pendingKindOf(legacyPending, id),
        completed: live ? live.completionUnread === true : !!(summary && summary.completed === true),
      }
    }

    const sessionTitleOf = (summary, t, rememberedTitle) => {
      if (!summary) return ''
      if (summary.blank) return t('session.new')
      if (summary.title) return String(summary.title)
      // Cold-restart window: when the wire omits title, displayTitle is the
      // host's basename fallback (dsh list only serves the projection cache,
      // and fork-born/never-checkpointed sessions always miss it — the durable
      // title stays in the session log, unread for a list row). A title
      // remembered from an earlier snapshot restores the "/" grouping until
      // the session opens and the wire catches up.
      if (typeof rememberedTitle === 'string' && rememberedTitle !== '') return rememberedTitle
      return String(summary.displayTitle || summary.title || '')
    }

    /**
     * Official visibility rule (dsh tree.ts sessionVisible): subagent children
     * live in their parent's catalog, archived sessions are visible nowhere,
     * and a blank row is the provisional New Session of the current selection.
     */
    const sessionVisible = (summary, current, archivedSet) => !!summary
      && summary.origin !== 'subagent'
      && !(archivedSet && archivedSet.has(summary.id))
      && (!summary.blank || summary.id === current)

    /**
     * The session the main view is showing right now.
     *
     * dsh 0.2 dropped `SessionListState.current` — the list no longer carries a
     * selection field at all; the host marks the retained session on the summary
     * itself (`retainedBy.mainView`, a retention counter, > 0 = shown by the
     * main view). This plugin kept reading `list.current`, which is simply
     * `undefined` on 0.2 hosts, so nothing was ever highlighted as current.
     * Read the old field first so 0.1 hosts keep working, then fall back to the
     * 0.2 retention marker.
     */
    const currentSessionIdOf = (list) => {
      if (!list) return undefined
      if (typeof list.current === 'string' && list.current !== '') return list.current
      const byId = list.byId
      if (!byId || typeof byId !== 'object') return undefined
      for (const id of Object.keys(byId)) {
        const row = byId[id]
        if (row && row.retainedBy && (row.retainedBy.mainView ?? 0) > 0) return row.id || id
      }
      return undefined
    }

    /**
     * Active-schedule marker, mirroring the official tree's
     * hasActiveSchedule(): the list projection carries one entry per active
     * Schedule record, and a non-empty projection is the badge's only gate.
     * Defensive shapes (missing/mis-typed projection) degrade to false.
     */
    const hasActiveScheduleOf = (summary) => !!(summary
      && summary.projectionValues
      && Array.isArray(summary.projectionValues.schedule)
      && summary.projectionValues.schedule.length > 0)

    /**
     * Running subagent descendants per session (light lineage walk over
     * parent links) — a parent row keeps its "ongoing" ring while a spawned
     * subagent is still working. The client SessionSummary exposes the
     * parent as parentId (the session controller maps parentSessionId to
     * parentId on the wire); the old parentSessionId spelling is kept as a
     * fallback for profiles serving the pre-rename shape.
     */
    const subagentRunningCounts = (byId, statuses) => {
      const children = new Map()
      for (const id of Object.keys(byId || {})) {
        const summary = byId[id]
        const parentId = summary && (summary.parentId || summary.parentSessionId)
        if (!summary || !parentId) continue
        let list = children.get(parentId)
        if (!list) { list = []; children.set(parentId, list) }
        list.push(summary)
      }
      const countFor = (rootId) => {
        let count = 0
        const queue = (children.get(rootId) || []).slice()
        const seen = new Set([rootId])
        while (queue.length > 0) {
          const summary = queue.shift()
          if (!summary || seen.has(summary.id)) continue
          seen.add(summary.id)
          // The status map carries the live fact first; the summary's own flag
          // is only the 0.1 fallback (same order as the shipped browser).
          if (runningOf(liveStatusOf(statuses, summary.id), summary)) count += 1
          const kids = children.get(summary.id)
          if (kids) for (const kid of kids) queue.push(kid)
        }
        return count
      }
      const counts = new Map()
      for (const id of Object.keys(byId || {})) counts.set(id, countFor(id))
      return counts
    }

    /**
     * Session nesting inside one workspace: same "/" convention as workspace
     * titles. Groups are virtual (projection of names). Rows keep the Host
     * workspace.sessionIds (manual) order — drag-to-reorder must be visible.
     */
    function buildSessionTree(rows) {
      const root = { path: '', name: '', groups: [], sessions: [] }
      const byPath = new Map([['', root]])
      // SEGMENT-driven: paths arrive as already-split segment arrays (URL-aware
      // splitTitleSegs can yield segments containing "//", e.g. the
      // "scheme://host" authority segment) and are joined into the path KEY
      // verbatim — never re-split on "/", which would shred an authority
      // segment into "https:" + "" + host.
      const ensure = (segs) => {
        let node = root
        let key = ''
        for (const seg of segs) {
          key = key === '' ? seg : key + '/' + seg
          let next = byPath.get(key)
          if (!next) {
            next = { path: key, name: seg, groups: [], sessions: [] }
            byPath.set(key, next)
            node.groups.push(next)
          }
          node = next
        }
        return node
      }
      for (const row of rows || []) {
        const segs = splitTitleSegs(row.title)
        const folderPath = segs.slice(0, -1).join('/')
        const leaf = segs.length > 0 ? segs[segs.length - 1] : row.title
        ensure(segs.slice(0, -1)).sessions.push({ ...row, leaf })
      }
      const sortRec = (node) => {
        node.groups.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
        for (const group of node.groups) sortRec(group)
      }
      sortRec(root)
      return root
    }

    /**
     * Move one id inside a flat list: before `anchor`, or to the end when the
     * anchor is missing (pure). Mirrors the host action's insertSessionBefore
     * semantics, so the browser-local fallback orders rows exactly the way the
     * host would have.
     */
    function reorderIds(ids, id, anchor) {
      const next = (ids || []).filter((x) => x !== id)
      const at = anchor === undefined ? -1 : next.indexOf(anchor)
      if (at === -1) next.push(id)
      else next.splice(at, 0, id)
      return next
    }

    const countSessionTree = (node) => node.sessions.length + node.groups.reduce((sum, group) => sum + countSessionTree(group), 0)

    const collectSessionRows = (node) => {
      const out = node.sessions.slice()
      for (const group of node.groups) out.push(...collectSessionRows(group))
      return out
    }

    const findSessionGroup = (node, path) => {
      if (node.path === path) return node
      for (const group of node.groups) {
        const hit = findSessionGroup(group, path)
        if (hit) return hit
      }
      return null
    }

    /**
     * Build the folder tree. Folders are virtual: they exist where workspace
     * titles contain "/", plus the explicit empty folders the user created.
     * Returns { path, name, folders, workspaces } with workspaces carrying
     * their leaf display name.
     */
    function buildTree(items, explicitFolders) {
      const root = { path: '', name: '', folders: [], workspaces: [] }
      const byPath = new Map([['', root]])
      // SEGMENT-driven, same as buildSessionTree: the joined path is only a
      // KEY; parsing it back on "/" would break URL authority segments.
      const ensure = (segs) => {
        let node = root
        let key = ''
        for (const seg of segs) {
          key = key === '' ? seg : key + '/' + seg
          let next = byPath.get(key)
          if (!next) {
            next = { path: key, name: seg, folders: [], workspaces: [] }
            byPath.set(key, next)
            node.folders.push(next)
          }
          node = next
        }
        return node
      }
      for (const folder of explicitFolders || []) {
        const segs = splitTitleSegs(normPath(folder))
        if (segs.length > 0) ensure(segs)
      }
      for (const workspace of items || []) {
        const segs = splitTitleSegs(workspace.title)
        const folderPath = segs.slice(0, -1).join('/')
        const leaf = segs.length > 0 ? segs[segs.length - 1] : (basename(workspace.path) || String(workspace.title || '') || String(workspace.workspaceId || ''))
        ensure(segs.slice(0, -1)).workspaces.push({
          workspaceId: workspace.workspaceId,
          title: String(workspace.title || ''),
          path: String(workspace.path || ''),
          sessionIds: Array.isArray(workspace.sessionIds) ? workspace.sessionIds : [],
          leaf,
          folderPath,
        })
      }
      const sortRec = (node) => {
        node.folders.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
        for (const child of node.folders) sortRec(child)
      }
      sortRec(root)
      return root
    }

    const countWorkspaces = (node) => (node.kind === 'ws' ? 1 : node.workspaces.length + node.folders.reduce((sum, f) => sum + countWorkspaces(f), 0))

    /**
     * VS Code-style single-child chain compression (preference-controlled):
     * a folder level holding exactly ONE child and nothing else merges into a
     * single display row; a chain ending in one workspace becomes that
     * workspace row with the merged label. Only presentation changes; the
     * underlying workspace/title data is untouched.
     *
     * The merged label is the chain RELATIVE to the first un-compressed
     * ancestor (VS Code explorer behaviour): a chain a/b/c holding only
     * workspace W shows "a/b/c/W" at the root, but the same chain nested
     * inside a populated folder "a" shows "b/c/W". Labels are therefore
     * assembled from RELATIVE segments (segs + pure leaf name) and only
     * materialised into a display node at the chain's top — the pre-0.8 code
     * prefixed each recursion level with the FULL node.path, so nested chains
     * rendered duplicated prefixes like "1/2/1/2/3/A".
     */
    const materializeChain = (chain) => chain.kind === 'ws'
      ? {
        kind: 'ws',
        path: chain.path,
        workspace: { ...chain.workspace, leaf: chain.segs.join('/') + '/' + chain.pure, title: chain.workspace.title, folderPath: '' },
        folders: [],
        workspaces: [],
      }
      : { kind: 'folder', path: chain.path, name: chain.segs.join('/'), folders: chain.folders, workspaces: chain.workspaces }

    function compressTree(node) {
      const folders = (node.folders || []).map(compressTree)
      const workspaces = node.workspaces || []
      if (workspaces.length === 0 && folders.length === 1) {
        // Continue the chain upward: one more relative segment in front of
        // whatever the child chain accumulated. path stays the DEEPEST full
        // path (expansion identity); the label is joined only at the top.
        const child = folders[0]
        return {
          kind: child.kind,
          path: child.path,
          segs: [node.name].concat(child.segs || []),
          pure: child.pure,
          workspace: child.workspace,
          folders: child.folders,
          workspaces: child.workspaces,
        }
      }
      if (folders.length === 0 && workspaces.length === 1) {
        return { kind: 'ws', path: node.path, segs: [node.name], pure: workspaces[0].leaf, workspace: workspaces[0], folders: [], workspaces: [] }
      }
      // Chain top (multiple children, or a mix): children are materialised
      // relative to this node; this node itself keeps its single name.
      return { kind: 'folder', path: node.path, segs: [node.name], folders: folders.map(materializeChain), workspaces }
    }

    /* ============================== styles ============================ */

    const CSS_TEXT = [
      '.bw-root{height:100%;display:flex;flex-direction:column;min-height:0;position:relative;color:var(--dsw-alias-label-primary,#e6e6e6)}',
      '.bw-header{display:flex;align-items:center;gap:2px;padding:10px 10px 4px;flex:none}',
      '.bw-header-title{flex:1;font-size:12px;font-weight:600;letter-spacing:.02em;color:var(--dsw-alias-label-secondary,#b8b8b8);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.bw-icon-btn{flex:none;width:24px;height:24px;border:none;background:transparent;border-radius:6px;display:grid;place-items:center;color:var(--dsw-alias-label-secondary,#b8b8b8);cursor:pointer;padding:0}',
      '.bw-icon-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.15));color:var(--dsw-alias-label-primary,#e6e6e6)}',
      '.bw-search-row{flex:none;padding:0 10px 6px}',
      '.bw-input{width:100%;box-sizing:border-box;height:26px;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.1));border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));border-radius:6px;color:inherit;padding:0 8px;font-size:12px;outline:none;font-family:inherit}',
      '.bw-input:focus{border-color:var(--dsw-alias-brand-primary,#5b8def)}',
      '.bw-input::placeholder{color:var(--dsw-alias-label-quaternary,#8a8a8a)}',
      // A native <select> reuses the input chrome; tighter padding keeps the value
      // clear of the host's dropdown arrow.
      '.bw-select{appearance:auto;padding:0 6px;cursor:pointer}',
      '.bw-path-echo{font-size:11px;color:var(--dsw-alias-label-tertiary,#9a9a9a);word-break:break-all;max-width:380px}',
      // A native <select> reuses the input chrome; its own padding is tighter so
      // the value never slides under the host's dropdown arrow.
      '.bw-tree{flex:1;overflow-y:auto;overflow-x:hidden;padding:2px 6px 12px;min-height:0}',
      '.bw-row{display:flex;align-items:center;gap:6px;min-height:28px;padding:0 6px;border-radius:6px;cursor:pointer;user-select:none;font-size:13px;color:var(--dsw-alias-label-primary,#e6e6e6);position:relative}',
      '.bw-drop-before::after{content:"";position:absolute;left:8px;right:8px;top:-1px;height:2px;border-radius:1px;background:var(--dsw-alias-brand-primary,#5b8def);pointer-events:none}',
      '.bw-drop-after::after{content:"";position:absolute;left:8px;right:8px;bottom:-1px;height:2px;border-radius:1px;background:var(--dsw-alias-brand-primary,#5b8def);pointer-events:none}',
      '.bw-drop-into{outline:1.5px dashed var(--dsw-alias-brand-primary,#5b8def);outline-offset:-1.5px}',
      '.bw-row:hover{background:var(--dsw-specific-sidebar-nav-item-hover,var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12)))}',
      '.bw-row:hover{background:color-mix(in srgb,var(--dsw-specific-sidebar-nav-item-hover,rgba(127,127,127,.14)) 50%,transparent)}',
      '.bw-row-current{background:var(--dsw-specific-sidebar-nav-item-active,rgba(91,141,239,.15))}',
      // The workspace (project) row that owns the session on screen: the session
      // pill alone is easy to miss when the tree is long, so the owning row also
      // carries a brand-tinted background and a 2px inset accent bar. Token-first
      // so it follows the host theme (and any theme plug-in that redefines it).
      '.bw-ws-current{background:color-mix(in srgb,var(--dsw-specific-sidebar-nav-item-active,rgba(91,141,239,.35)) 55%,transparent)}',
      '.bw-ws-current{box-shadow:inset 2px 0 0 var(--dsw-alias-brand-primary,#5b8def)}',
      '.bw-ws-current .bw-row-icon svg{color:var(--dsw-alias-brand-primary,#5b8def)}',
      '.bw-row-icon{flex:none;display:grid;place-items:center;color:var(--dsw-alias-label-tertiary,#9a9a9a)}',
      '.bw-chevron{flex:none;display:grid;place-items:center;color:var(--dsw-alias-label-tertiary,#9a9a9a);transition:transform .15s ease}',
      '.bw-chevron-open{transform:rotate(90deg)}',
      // overflow:hidden (needed for the ellipsis) clips the outline: 3px of
      // padding covers the widest rim (2px at the top of the slider). margin
      // cancels it, so text still starts and truncates where it did.
      '.bw-row-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:3px;margin:-3px}',
      '.bw-row-count{flex:none;font-size:11px;color:var(--dsw-alias-label-quaternary,#8a8a8a)}',
      // The trailing cell carries either the relative time or the compact
      // waiting label ("待回答"); neither may wrap into a second line.
      '.bw-row-time{flex:none;font-size:11px;color:var(--dsw-alias-label-quaternary,#8a8a8a);white-space:nowrap}',
      // The outline is inherited from the row: the 11px meta column (session
      // count / relative time) opts out — stroked meta text outshines the title
      // it is supposed to support.
      '.bw-row-count,.bw-row-time{-webkit-text-stroke-width:0}',
      '.bw-schedule-badge{flex:none;display:inline-flex;align-items:center;color:var(--dsw-alias-label-tertiary,#9a9a9a);margin:0 6px}',
      '.bw-row-actions{flex:none;display:none;align-items:center;gap:2px}',
      '.bw-row:hover .bw-row-actions{display:flex}',
      '.bw-row:hover .bw-row-time,.bw-row:hover .bw-row-count,.bw-row:hover .bw-schedule-badge{display:none}',
      '.bw-dot{flex:none;width:6px;height:6px;border-radius:50%;background:transparent}',
      '.bw-session-row{font-size:12.5px;color:var(--dsw-alias-label-secondary,#b8b8b8);min-height:26px}',
      '.bw-sgroup-row{font-size:12.5px;color:var(--dsw-alias-label-tertiary,#9a9a9a);min-height:24px}',
      '.bw-sgroup-row:hover{color:var(--dsw-alias-label-secondary,#b8b8b8)}',
      '.bw-session-row:hover{color:var(--dsw-alias-label-primary,#e6e6e6)}',
      '.bw-empty{padding:28px 12px;text-align:center;font-size:12px;color:var(--dsw-alias-label-dimmed,#7a7a7a)}',
      '.bw-swatch{width:20px;height:20px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));cursor:pointer;flex:none;background:transparent;padding:0}',
      '.bw-swatch-wide{width:auto;min-width:38px;padding:0 8px;font-size:11px;color:var(--dsw-alias-label-secondary,#b8b8b8)}',
      '.bw-swatch-active{outline:2px solid var(--dsw-alias-brand-primary,#5b8def);outline-offset:1px}',
      '.bw-color-input{width:36px;height:26px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));border-radius:6px;background:transparent;cursor:pointer;padding:0}',
      '.bw-seg{display:flex;gap:6px;flex-wrap:wrap}',
      '.bw-seg-btn{height:24px;padding:0 10px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));background:transparent;color:var(--dsw-alias-label-secondary,#b8b8b8);font-size:12px;cursor:pointer;font-family:inherit}',
      '.bw-seg-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}',
      '.bw-seg-btn-active{background:var(--dsw-alias-brand-primary,#5b8def);border-color:transparent;color:var(--dsw-alias-brand-text,#fff)}',
      '.bw-seg-btn-active:hover{background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-brand-primary,#5b8def));border-color:transparent}',
      '.bw-icon-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(30px,1fr));gap:4px}',
      '.bw-icon-cell{height:30px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));border-radius:6px;background:transparent;display:grid;place-items:center;color:var(--dsw-alias-label-secondary,#b8b8b8);cursor:pointer;padding:0}',
      '.bw-icon-cell:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12));color:var(--dsw-alias-label-primary,#e6e6e6)}',
      '.bw-icon-cell-active{border-color:var(--dsw-alias-brand-primary,#5b8def);color:var(--dsw-alias-label-primary,#e6e6e6);outline:2px solid var(--dsw-alias-brand-primary,#5b8def);outline-offset:-2px}',
      '.bw-icon-none{width:12px;height:2px;background:currentColor;border-radius:1px;opacity:.7}',
      '.bw-rgb-row{display:flex;gap:10px;align-items:center}',
      '.bw-rgb-label{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--dsw-alias-label-tertiary,#9a9a9a)}',
      '.bw-rgb-input{width:52px;height:26px;box-sizing:border-box;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.1));border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));border-radius:6px;color:inherit;font-size:12px;padding:0 6px;font-family:inherit}',
      '.bw-ctx-overlay{position:fixed;inset:0;z-index:40}',
      '.bw-ctx-menu{position:fixed;min-width:170px;background:var(--dsw-specific-menu,var(--dsw-alias-bg-overlay,rgba(28,28,32,.72)));-webkit-backdrop-filter:var(--dsh-any-blur-card-panels,blur(12px) saturate(1.15));backdrop-filter:var(--dsh-any-blur-card-panels,blur(12px) saturate(1.15));border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.3));border-radius:8px;padding:4px;box-shadow:0 8px 24px rgba(0,0,0,.35);display:flex;flex-direction:column}',
      '.bw-ctx-item{display:flex;align-items:center;gap:8px;height:28px;padding:0 10px;border:none;background:transparent;color:var(--dsw-alias-label-primary,#e6e6e6);font-size:12.5px;border-radius:6px;cursor:pointer;text-align:left;font-family:inherit}',
      '.bw-ctx-item:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}',
      '.bw-ctx-danger{color:var(--dsw-alias-state-error-primary,#f85149)}',
      '.bw-ctx-sep{height:1px;background:var(--dsw-alias-border-l1,rgba(127,127,127,.2));margin:4px 6px}',
      /* "…" reveal row for the collapsed session tail: row-shaped (so it lines
         up with the session rows above it) but text-only and unobtrusive. */
      '.bw-more-row{display:flex;align-items:center;height:22px;border:none;background:transparent;cursor:pointer;font:inherit;text-align:left;border-radius:6px;width:100%}',
      '.bw-more-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}',
      '.bw-more-label{font-size:12px;color:var(--dsw-alias-label-tertiary,#9a9a9a);line-height:1}',
      '.bw-more-row:hover .bw-more-label{color:var(--dsw-alias-label-secondary,#b8b8b8)}',
      /* "Move into a directory" picker: the parent row is a label, the child
         rows are the actual choices. Capped height + scroll so a deep tree
         stays usable inside a fixed-position menu. */
      '.bw-ctx-sub{display:flex;flex-direction:column;max-height:260px;overflow-y:auto;margin:2px 0 4px;padding-left:6px;border-left:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.22))}',
      '.bw-ctx-subitem{height:24px;font-size:12px;color:var(--dsw-alias-label-secondary,#b8b8b8)}',
      '.bw-ctx-subitem:hover{color:var(--dsw-alias-label-primary,#e6e6e6)}',
      '.bw-settings{display:flex;flex-direction:column;gap:6px;max-width:640px}',
      '.bw-plugin-card{list-style:none;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.18));border-radius:12px;background:var(--dsw-alias-bg-layer-3,rgba(127,127,127,.05));transition:border-color .16s,background .16s}',
      '.bw-plugin-card:hover{border-color:var(--dsw-alias-label-dimmed,#7a7a7a)}',
      '.bw-plugin-card-open{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.1));border-color:var(--dsw-alias-label-dimmed,#7a7a7a)}',
      '.bw-plugin-head{width:100%;appearance:none;border:0;background:none;font:inherit;color:inherit;text-align:left;cursor:pointer;display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px}',
      '.bw-plugin-head:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5b8def);outline-offset:-2px}',
      '.bw-plugin-headtext{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}',
      '.bw-plugin-name{font-size:15px;font-weight:600;line-height:1.4;color:var(--dsw-alias-label-primary,#e6e6e6)}',
      '.bw-plugin-desc{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary,#9a9a9a)}',
      '.bw-plugin-chevron{flex:none;color:var(--dsw-alias-label-tertiary,#9a9a9a);transition:transform .16s}',
      '.bw-plugin-chevron-open{transform:rotate(180deg)}',
      '.bw-plugin-body{border-top:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.18));margin:0 16px;padding:12px 0 16px}',
      '.bw-setting-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-secondary,#b8b8b8)}',
      '.bw-setting-label{flex:1;min-width:0;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-secondary,#b8b8b8)}',
      '.bw-switch{box-sizing:border-box;position:relative;flex:0 0 auto;width:36px;height:20px;padding:2px;border:0;border-radius:10px;background:var(--dsw-alias-border-l3,rgba(127,127,127,.3));cursor:pointer;transition:background 120ms ease}',
      '.bw-switch:hover{background:var(--dsw-alias-label-dimmed,#7a7a7a)}',
      '.bw-switch-on{background:var(--dsw-alias-brand-primary,#5b8def)}',
      '.bw-switch:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5b8def);outline-offset:2px}',
      '.bw-switch-thumb{display:block;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-label-primary-foreground,#fff);transition:transform 120ms ease}',
      '.bw-switch-on .bw-switch-thumb{transform:translateX(16px)}',
      '.bw-plugin-body .bw-hint{font-size:12px;color:var(--dsw-alias-label-tertiary,#9a9a9a)}',
      '.bw-rail{display:flex;flex-direction:column;align-items:center;gap:6px;padding:6px 0}',
      '.bw-rail-btn{width:36px;height:36px;border:none;background:transparent;border-radius:8px;display:grid;place-items:center;color:var(--dsw-alias-label-secondary,#b8b8b8);cursor:pointer;padding:0}',
      '.bw-rail-btn:hover{background:var(--dsw-specific-sidebar-nav-item-hover,var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12)));color:var(--dsw-alias-label-primary,#e6e6e6)}',
      '.bw-modal-body{display:flex;flex-direction:column;gap:10px;min-width:300px;max-width:380px;box-sizing:border-box}',
      '.bw-field{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--dsw-alias-label-secondary,#b8b8b8)}',
      '.bw-appearance{display:flex;flex-direction:column;gap:10px}',
      '.bw-appearance-box{margin-top:8px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.22));border-radius:8px;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.06))}',
      '.bw-hint{font-size:11px;color:var(--dsw-alias-label-quaternary,#8a8a8a);line-height:1.5;white-space:normal;word-break:break-word}',
      '.bw-modal-actions{display:flex;justify-content:flex-end;gap:8px}',
      '.bw-btn{height:28px;padding:0 14px;border-radius:6px;font-size:12.5px;cursor:pointer;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));background:transparent;color:var(--dsw-alias-label-primary,#e6e6e6);font-family:inherit}',
      '.bw-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}',
      '.bw-btn-primary{background:var(--dsw-alias-brand-primary,#5b8def);border-color:transparent;color:var(--dsw-alias-brand-text,#fff)}',
      '.bw-btn-primary:hover{background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-brand-primary,#5b8def))}',
      '.bw-btn:disabled{opacity:.5;cursor:default}',
      '.bw-error-text{font-size:12.5px;color:var(--dsw-alias-state-error-primary,#f85149);word-break:break-all;max-width:380px}',
      '.bw-dialog-input-row{display:flex;gap:6px;align-items:center}',
      '.bw-glow-row{display:flex;align-items:center;gap:10px}',
      '.bw-slider{flex:1;accent-color:var(--dsw-alias-brand-primary,#5b8def);height:22px}',
      '.bw-glow-value{min-width:44px;text-align:right;font-size:12px;color:var(--dsw-alias-label-secondary,#b8b8b8);font-variant-numeric:tabular-nums}',
      '.bw-preview{display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px dashed var(--dsw-alias-border-l2,rgba(127,127,127,.3));border-radius:6px;min-height:28px}',
      '.bw-preview-icon{flex:none;display:grid;place-items:center;width:20px;height:20px;color:var(--dsw-alias-label-primary,#e6e6e6)}',
      '.bw-preview-icon svg{width:18px;height:18px}',
      '.bw-preview-label{font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:18px;padding:3px;margin:-3px}',
      '.bw-pulse{animation:bw-breathe 1.8s ease-in-out infinite}',
      '@keyframes bw-breathe{0%,100%{filter:drop-shadow(0 0 1px var(--bw-pulse-color));opacity:.55}50%{filter:drop-shadow(0 0 6px var(--bw-pulse-color));opacity:1}}',
      '.bw-pulse-text{animation:bw-breathe-text 1.8s ease-in-out infinite}',
      '@keyframes bw-breathe-text{0%,100%{text-shadow:0 0 1px var(--bw-pulse-color);opacity:.65}50%{text-shadow:0 0 7px var(--bw-pulse-color);opacity:1}}',
      '.bw-sync-modes{display:flex;gap:6px;margin-top:8px}',
      '.bw-sync-mode{flex:1;padding:5px 10px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));background:transparent;color:var(--dsw-alias-label-secondary,#b8b8b8);cursor:pointer;font-size:12px}',
      '.bw-sync-mode-on{border-color:var(--dsw-alias-brand-primary,#5b8def);color:var(--dsw-alias-label-primary,#e6e6e6);background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12))}',
      '.bw-sync-actions{display:flex;gap:8px;margin-top:8px}',
      '.bw-sync-btn{padding:5px 12px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));background:transparent;color:var(--dsw-alias-label-secondary,#b8b8b8);cursor:pointer;font-size:12px}',
      '.bw-sync-btn:disabled{opacity:.45;cursor:default}',
      '.bw-sync-btn-primary{border-color:var(--dsw-alias-brand-primary,#5b8def);color:var(--dsw-alias-label-primary,#e6e6e6)}',
      /*
       * In-app directory browser (Hosts composing the browse backend). Every
       * surface rides the theme token chain like the rest of the plugin — the
       * list panel uses bg-layer-2 so a transparent/background plugin still
       * reads correctly; nothing may hard-code an opaque background.
       */
    ].join('')

    const StyleNode = () => E('style', null, CSS_TEXT)

    /* ========================== view store =========================== */

    /* ===================== virtual directory model ====================
     * The user-facing model of THIS plugin: a real tree of virtual folders
     * that the user creates, names, nests and reorders freely — with the
     * real (host) workspaces hanging off it as LEAVES.
     *
     * Why a separate model instead of the upstream "/"-in-title projection:
     *   - upstream derives folders from workspace TITLES, so a group can only
     *     exist by renaming a real workspace ("web/前端") — the virtual level
     *     is a side effect of a title edit, and it cannot be created on its
     *     own;
     *   - here a folder is a first-class record with its own id/name/parent,
     *     it is created directly, and workspace titles are NEVER touched.
     *
     * Durable shape (both browser-local and cross-device):
     *   directories: { [dirId]: { id, name, parentId, order } }
     *   wsDir:       { [workspaceId]: dirId }   // absence ⇒ root
     * parentId === '' means "hangs off the root". Unknown ids are ignored at
     * render time, so a stale record can never break the tree.
     */
    const ROOT_DIR = ''
    /** Stable empty root sequence: a fresh [] per render would churn the tree memo. */
    const EMPTY_ROOT_ORDER = []
    let dirSeq = 0
    const newDirId = () => {
      dirSeq += 1
      return 'vd' + Date.now().toString(36) + '-' + dirSeq.toString(36)
    }
    /** Normalize the persisted maps; tolerate anything (older/missing/corrupt). */
    const dirMapOf = (state) => (state && state.directories && typeof state.directories === 'object' && !Array.isArray(state.directories) ? state.directories : {})
    const wsDirMapOf = (state) => (state && state.wsDir && typeof state.wsDir === 'object' && !Array.isArray(state.wsDir) ? state.wsDir : {})
    /** Direct children of `parentId`, ordered; unknown-parent records surface at root. */
    const childDirsOf = (directories, parentId) => Object.keys(directories)
      .map((id) => directories[id])
      .filter((dir) => dir && typeof dir === 'object' && (dir.parentId || ROOT_DIR) === (parentId || ROOT_DIR))
      .sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.name || '').localeCompare(String(b.name || ''), 'zh'))
    /** Walk up from a directory: true when `ancestorId` is an ancestor of (or equal to) `dirId`. */
    const isDescendantDir = (directories, dirId, ancestorId) => {
      let cur = dirId
      let guard = 0
      while (cur && guard < 512) {
        if (cur === ancestorId) return true
        const node = directories[cur]
        if (!node) return false
        cur = node.parentId || ROOT_DIR
        if (cur === ROOT_DIR) return cur === ancestorId
        guard += 1
      }
      return false
    }
    /** Sibling order value that appends after the last child of `parentId`. */
    const nextDirOrder = (directories, parentId) => {
      const siblings = childDirsOf(directories, parentId)
      return siblings.length === 0 ? 0 : (siblings[siblings.length - 1].order || 0) + 1
    }
    /** Collect a directory's whole subtree id set (for cascade delete). */
    const subtreeDirIds = (directories, dirId) => {
      const out = [dirId]
      for (let i = 0; i < out.length; i++) {
        for (const child of childDirsOf(directories, out[i])) out.push(child.id)
      }
      return out
    }
    /**
     * Pure sibling reorder: returns a NEW `{ id: order }` map placing `dirId`
     * at `targetOrder` among its current siblings.
     *
     * The result is a DENSE 0..n-1 numbering rather than a value wedged between
     * two neighbours: the tree sorts by `order` and falls back to the NAME when
     * two orders are equal, so ties silently re-sort alphabetically and a move
     * would look like it did nothing. Numbering the whole list removes ties by
     * construction. Unknown ids and no-op moves return the input order as-is.
     */
    const reorderDirIds = (directories, dirId, targetOrder) => {
      const self = directories[dirId]
      if (!self) return null
      const parentId = self.parentId || ROOT_DIR
      const siblings = childDirsOf(directories, parentId)
      const from = siblings.findIndex((d) => d.id === dirId)
      if (from === -1) return null
      const rest = siblings.filter((d) => d.id !== dirId)
      const to = Math.max(0, Math.min(rest.length, Math.round(targetOrder)))
      const ordered = rest.slice(0, to).concat([siblings[from]], rest.slice(to))
      const out = {}
      ordered.forEach((d, index) => { out[d.id] = index })
      return out
    }

    /** Human-readable path of a directory ("ai/web"), for tooltips and dialogs. */
    const dirPathOf = (directories, dirId) => {
      const segs = []
      let cur = dirId
      let guard = 0
      while (cur && guard < 512) {
        const node = directories[cur]
        if (!node) break
        segs.unshift(String(node.name || ''))
        cur = node.parentId || ROOT_DIR
        guard += 1
      }
      return segs.join('/')
    }
    /**
     * Build the render tree from the virtual model + the host workspace list,
     * replacing the upstream title-projection buildTree.
     *
     * `items` are host workspace entries ({workspaceId, title, path, sessionIds}).
     * Directories come from the virtual model; each workspace is placed in its
     * assigned directory, or at the root when unassigned/assigned to a deleted
     * directory. The node shape mirrors the upstream one ({path, name, folders,
     * workspaces}) so every existing row component keeps working: `path` is the
     * directory id here, not a title prefix.
     *
     * `useTree` (default true) switches between:
     *   - true  → the virtual tree (folderId = directory id);
     *   - false → the upstream behaviour (folderId = title prefix path), which
     *             keeps the old projection usable as a fallback.
     */
    /**
     * Root-level display sequence: virtual directories and ROOT-LEVEL real
     * workspaces in ONE ordered list.
     *
     * Without it the root level can only be rendered as "every directory, then
     * every workspace", which pins directories above all workspaces no matter
     * how they are reordered — a directory could never sit BELOW a workspace,
     * because the directories' `order` ranks them among directories only and
     * the workspaces are ordered by the host.
     *
     * `rootOrder` is a list of tokens — "dir:<dirId>" / "ws:<workspaceId>" —
     * naming the entries the user has explicitly positioned. Anything the list
     * does not mention keeps the historical order (directories by `order`,
     * then workspaces in host order), so an empty or absent list reproduces the
     * old layout EXACTLY: existing installs need no migration, and a directory
     * deleted elsewhere simply drops out of the sequence.
     */
    const orderRootEntries = (root, rootOrder) => {
      const entries = []
      const usedDir = new Set()
      const usedWs = new Set()
      const dirById = new Map((root.folders || []).map((node) => [node.path, node]))
      const wsById = new Map((root.workspaces || []).map((ws) => [ws.workspaceId, ws]))
      for (const token of (Array.isArray(rootOrder) ? rootOrder : [])) {
        if (typeof token !== 'string') continue
        if (token.startsWith('dir:')) {
          const id = token.slice(4)
          const node = dirById.get(id)
          if (node && !usedDir.has(id)) {
            usedDir.add(id)
            entries.push({ kind: 'folder', node })
          }
          continue
        }
        if (token.startsWith('ws:')) {
          const id = token.slice(3)
          const ws = wsById.get(id)
          if (ws && !usedWs.has(id)) {
            usedWs.add(id)
            entries.push({ kind: 'workspace', workspace: ws })
          }
        }
      }
      // Entries the sequence does not mention keep the historical order: the
      // directories that were never positioned, then the workspaces. The
      // directories join the LAST POSITIONED directory rather than the end of
      // the whole list — creating a directory is this plugin's most common
      // action, and once a sequence exists it would otherwise appear below
      // every workspace, looking like it went missing.
      let dirSlot = 0
      for (let i = entries.length - 1; i >= 0; i--) {
        if (entries[i].kind === 'folder') { dirSlot = i + 1; break }
      }
      const pendingDirs = (root.folders || []).filter((node) => !usedDir.has(node.path)).map((node) => ({ kind: 'folder', node }))
      entries.splice(dirSlot, 0, ...pendingDirs)
      for (const ws of (root.workspaces || [])) if (!usedWs.has(ws.workspaceId)) entries.push({ kind: 'workspace', workspace: ws })
      return entries
    }

    function buildTreeVirtual(items, directories, wsDir, useTree, rootOrder) {
      const root = { path: '', name: '', folders: [], workspaces: [] }
      const byId = new Map([[ROOT_DIR, root]])
      const ensure = (dirId) => {
        const existing = byId.get(dirId)
        if (existing) return existing
        const dir = directories[dirId]
        if (!dir) return root
        const parent = ensure(dir.parentId || ROOT_DIR)
        const node = { path: dirId, name: String(dir.name || ''), folders: [], workspaces: [] }
        byId.set(dirId, node)
        parent.folders.push(node)
        return node
      }
      if (useTree !== false) {
        for (const id of Object.keys(directories)) ensure(id)
        for (const node of byId.values()) {
          node.folders.sort((a, b) => {
            const oa = (directories[a.path] || {}).order || 0
            const ob = (directories[b.path] || {}).order || 0
            return oa - ob || String(a.name).localeCompare(String(b.name), 'zh')
          })
        }
        for (const workspace of items || []) {
          const assigned = wsDir[workspace.workspaceId]
          const parent = assigned && directories[assigned] ? ensure(assigned) : root
          parent.workspaces.push({
            workspaceId: workspace.workspaceId,
            title: String(workspace.title || ''),
            path: String(workspace.path || ''),
            sessionIds: Array.isArray(workspace.sessionIds) ? workspace.sessionIds : [],
            leaf: String(workspace.title || '') || basename(workspace.path) || String(workspace.workspaceId || ''),
            folderPath: assigned && directories[assigned] ? assigned : '',
          })
        }
        // Root-level interleaving (see orderRootEntries). Nested levels keep
        // the historical "sub-directories, then workspaces" shape.
        root.entries = orderRootEntries(root, rootOrder)
        return root
      }
      // ---- fallback: upstream title-projection tree ----
      return buildTree(items, [])
    }

    const createViewStore = () => storeKit.defineStore({
      init: () => ({ folders: [], directories: {}, wsDir: {}, rootOrder: [], useTree: true, expanded: {}, sessionsExpanded: {}, sessionGroups: {}, sessionOrder: {}, prefs: { compactChains: true }, styling: {} }),
      // NOTE: hydration REPLACES the state with the persisted whole value —
      // init defaults never merge. Every action must tolerate a missing key
      // (states persisted by older plugin versions lack sessionGroups), and
      // every selector read takes a fallback.
      persist: 'dsh.betterWorkspace.view.v1',
      actions: {
        // Manual-sync pull targets (overwrite / merge): the host settings
        // values land in the local store, and rendering keeps reading the
        // local selectors, so scope-less hosts keep working unchanged.
        importHost: (d, host) => {
          if (!host || typeof host !== 'object') return
          if (host.styling && typeof host.styling === 'object') d.styling = host.styling
          if (Array.isArray(host.folders)) d.folders = host.folders.slice()
          if (!d.prefs) d.prefs = {}
          if (host.compactChains !== undefined) d.prefs.compactChains = host.compactChains !== false
          if (host.statusPulse !== undefined) d.prefs.statusPulse = host.statusPulse !== false
          if (host.appearance && typeof host.appearance === 'object') d.prefs.appearance = host.appearance
        },
        // Merge mode: union of both sides, the PULLED (host) copy wins any
        // per-key conflict; prefs take the pulled booleans when present.
        mergeHost: (d, host) => {
          if (!host || typeof host !== 'object') return
          if (host.styling && typeof host.styling === 'object') d.styling = { ...(d.styling || {}), ...host.styling }
          if (Array.isArray(host.folders)) {
            const merged = new Set([...(Array.isArray(d.folders) ? d.folders : []), ...host.folders])
            d.folders = Array.from(merged)
          }
          if (!d.prefs) d.prefs = {}
          if (host.compactChains !== undefined) d.prefs.compactChains = host.compactChains !== false
          if (host.statusPulse !== undefined) d.prefs.statusPulse = host.statusPulse !== false
          if (host.appearance && typeof host.appearance === 'object') d.prefs.appearance = { ...(d.prefs.appearance || {}), ...host.appearance }
        },
        setExpanded: (d, key, value) => { if (!d.expanded) d.expanded = {}; d.expanded[key] = value },
        setSessionsExpanded: (d, key, value) => { if (!d.sessionsExpanded) d.sessionsExpanded = {}; d.sessionsExpanded[key] = value },
        setSessionGroupExpanded: (d, key, value) => { if (!d.sessionGroups) d.sessionGroups = {}; d.sessionGroups[key] = value },
        /**
         * Reveal state of the "…" tail — DEFAULT COLLAPSED, unlike the maps
         * above which default to open. An absent key must read as closed, so
         * the per-workspace flag is stored as a real boolean rather than being
         * "on unless explicitly false".
         */
        setRecentExpanded: (d, key, value) => { if (!d.recentExpanded) d.recentExpanded = {}; d.recentExpanded[key] = value === true },
        /**
         * Root-level display sequence (see orderRootEntries). Whole-list
         * replacement on purpose: every write materializes the full sequence,
         * so there is never a partially-ordered root level to reconcile.
         */
        setRootOrder: (d, list) => { d.rootOrder = Array.isArray(list) ? list.slice() : [] },
        setPref: (d, key, value) => { if (!d.prefs) d.prefs = {}; d.prefs[key] = value },
        setStyling: (d, key, value) => { if (!d.styling) d.styling = {}; if (value === null) delete d.styling[key]; else d.styling[key] = value },
        // Browser-local session order (v0.10.2): the fallback channel for
        // drag-to-reorder on hosts that no longer inject insertSessionBefore
        // (dsh 0.1.6-alpha.1). Per-workspace and per-browser on purpose — the
        // host order stays authoritative wherever the action exists, and this
        // never rides the cross-device sync.
        setSessionOrder: (d, workspaceId, order) => {
          if (!d.sessionOrder || typeof d.sessionOrder !== 'object') d.sessionOrder = {}
          if (!Array.isArray(order) || order.length === 0) delete d.sessionOrder[workspaceId]
          else d.sessionOrder[workspaceId] = order.slice()
        },
        addFolder: (d, path) => {
          if (!Array.isArray(d.folders)) d.folders = []
          const p = normPath(path)
          if (p !== '' && !d.folders.includes(p)) d.folders.push(p)
        },
        removeFolder: (d, path) => {
          if (!Array.isArray(d.folders)) d.folders = []
          d.folders = d.folders.filter(f => f !== path)
        },
        renameFolder: (d, oldPath, newPath) => {
          if (!Array.isArray(d.folders)) d.folders = []
          const oo = oldPath + '/'
          const nn = newPath + '/'
          const next = d.folders.map(f => (f === oldPath ? newPath : (f.startsWith(oo) ? nn + f.slice(oo.length) : f)))
          d.folders = Array.from(new Set(next))
        },

        /* ------------------- virtual directory actions -------------------
         * All of them take the CURRENT state and return the NEXT one, so the
         * shared-write wrappers below can compute the host copy from the same
         * transition (local echo first, durable host write second).
         */
        /** Create a directory under `parentId`; returns the new id. */
        addDirectory: (d, parentId, name, id, order) => {
          if (!d.directories || typeof d.directories !== 'object') d.directories = {}
          const parent = parentId && d.directories[parentId] ? parentId : ROOT_DIR
          const dirId = typeof id === 'string' && id !== '' ? id : newDirId()
          d.directories[dirId] = {
            id: dirId,
            name: String(name || '').trim() || '新建目录',
            parentId: parent,
            order: typeof order === 'number' ? order : nextDirOrder(d.directories, parent),
          }
          return dirId
        },
        renameDirectory: (d, dirId, name) => {
          const dir = d.directories && d.directories[dirId]
          if (!dir) return
          const next = String(name || '').trim()
          if (next !== '') dir.name = next
        },
        /** Re-parent (and optionally re-order) one directory; rejects cycles. */
        moveDirectory: (d, dirId, parentId, order) => {
          const dir = d.directories && d.directories[dirId]
          if (!dir) return
          const parent = parentId && d.directories[parentId] ? parentId : ROOT_DIR
          // A directory may never become its own descendant: that would orphan
          // the whole subtree out of the root walk.
          if (parent === dirId || isDescendantDir(d.directories, parent, dirId)) return
          dir.parentId = parent
          dir.order = typeof order === 'number' ? order : nextDirOrder(d.directories, parent)
        },
        /**
         * Delete a directory subtree. `mode` decides the fate of the real
         * workspaces inside it (they are never deleted themselves):
         *   'root'  → detach to the root level (default);
         *   'keep'  → re-attach to the deleted directory's parent;
         *   'drop'  → also forget their assignment (same as 'root').
         */
        removeDirectory: (d, dirId, mode) => {
          if (!d.directories || !d.directories[dirId]) return
          const parentId = d.directories[dirId].parentId || ROOT_DIR
          const doomed = new Set(subtreeDirIds(d.directories, dirId))
          for (const id of doomed) delete d.directories[id]
          if (!d.wsDir || typeof d.wsDir !== 'object') d.wsDir = {}
          const target = mode === 'keep' ? parentId : ROOT_DIR
          for (const wsId of Object.keys(d.wsDir)) {
            if (doomed.has(d.wsDir[wsId])) {
              if (target) d.wsDir[wsId] = target
              else delete d.wsDir[wsId]
            }
          }
          if (d.expanded && typeof d.expanded === 'object') for (const id of doomed) delete d.expanded[id]
        },
        /** Attach a real workspace to a directory ('' ⇒ back to the root level). */
        assignWorkspace: (d, workspaceId, dirId) => {
          if (!d.wsDir || typeof d.wsDir !== 'object') d.wsDir = {}
          const target = dirId && d.directories && d.directories[dirId] ? dirId : ROOT_DIR
          if (target === ROOT_DIR) delete d.wsDir[workspaceId]
          else d.wsDir[workspaceId] = target
        },
        setUseTree: (d, value) => { d.useTree = value !== false },
      },
    })

    /* ========================= title cache store ====================== */

    // Cold-restart title fallback. The host list serves titles only from the
    // persisted projection cache: sessions that never wrote a checkpoint —
    // and every fork-born (seeded) session, which the list skips entirely —
    // come back after a restart with title absent and displayTitle already
    // degraded to the workspace basename (dsh displayTitleOf: title → cwd
    // basename → id). The durable titles live on in each session's log, but
    // nothing reads a log for a cheap list row. This store remembers the
    // last REAL wire title per session id (learned only from snapshots where
    // summary.title exists — never from displayTitle, which is basename
    // degraded in exactly the window being patched), so the tree restores
    // the "/" grouping until the wire catches up. 0.9.6: plain module
    // state with one debounced whole-file save per real change batch
    // (issue #1: per-session reactive-store dispatches cost O(sessions)
    // immer produces per snapshot tick and froze large installs). Same-
    // value scans allocate nothing; entries evict oldest-at past the hard
    // cap. A stale remembered title (renamed
    // elsewhere, cleared browser storage) self-heals the moment the wire
    // carries the truth again; a missing entry just leaves today's fallback.
    const TITLE_CACHE_LIMIT = 3000
    const TITLE_CACHE_KEEP = 2400
    const TITLE_CACHE_KEY = 'dsh.betterWorkspace.titles.v1'
    const titleCache = { byId: {} }
    let titleSaveTimer = null
    const loadTitleCache = () => {
      try {
        const raw = localStorage.getItem(TITLE_CACHE_KEY)
        if (raw !== null) {
          const parsed = JSON.parse(raw)
          if (parsed && typeof parsed.byId === 'object' && parsed.byId !== null) titleCache.byId = parsed.byId
        }
      } catch (e) { /* storage unavailable/corrupt: cold start without cache */ }
    }
    const scheduleTitleSave = () => {
      clearTimeout(titleSaveTimer)
      titleSaveTimer = setTimeout(() => {
        try { localStorage.setItem(TITLE_CACHE_KEY, JSON.stringify(titleCache)) } catch (e) {}
      }, 200)
    }
    // One plain-object batch pass per snapshot (issue #1). Unchanged scans
    // cost one loop with zero allocation; only real changes mark dirty;
    // eviction runs once per changed batch followed by ONE debounced save.
    const rememberAllTitles = (list) => {
      if (!list || !list.byId) return false
      const byId = titleCache.byId
      const now = Date.now()
      let changed = false
      for (const id of Object.keys(list.byId)) {
        const summary = list.byId[id]
        if (!summary || summary.blank) continue
        const title = summary.title
        if (typeof title !== 'string' || title === '') continue
        const prev = byId[id]
        if (prev && prev.title === title) continue
        byId[id] = { title: title, at: now }
        changed = true
      }
      if (!changed) return false
      const keys = Object.keys(byId)
      if (keys.length > TITLE_CACHE_LIMIT) {
        keys.sort((a, b) => ((byId[a] && byId[a].at) || 0) - ((byId[b] && byId[b].at) || 0))
        for (let i = 0; i < keys.length - TITLE_CACHE_KEEP; i++) delete byId[keys[i]]
      }
      scheduleTitleSave()
      return true
    }

    /* ======================= host settings sync ======================= */

    // Cross-device preferences: styling / explicit folders / the two toggles
    // live in the HOST settings store (~/.dsh/settings.yaml through the
    // better-workspace namespace). Web and the desktop app share one DSH_HOME,
    // so a style set in the browser follows the user into the Electron app and
    // back. The browser localStorage view store stays the rendering source and
    // the fallback: host values are MIRRORED into it one-way, and every write
    // goes to BOTH stores (local action for immediate echo, scope.set for
    // durable cross-device persistence). Hosts without the settingsScope
    // service — or non-loopback pages where the scope stays process-local —
    // simply never mirror and never sync, which is exactly the pre-0.9.5
    // browser-local behavior.
    let prefsScopeRef = null
    const HOST_SNAP_UNAVAILABLE = { status: 'unavailable', value: undefined }
    const hostPrefsOf = (snap) => (snap && snap.status === 'ready' && snap.value && typeof snap.value === 'object'
      ? snap.value
      : null)
    const scopeSet = (field, value) => {
      const scope = prefsScopeRef
      if (!scope || typeof scope.set !== 'function') return
      try {
        Promise.resolve(scope.set(field, value)).catch((error) => {
          console.warn('[dsh-better-workspace] host settings write failed: ' + field, error)
        })
      } catch (error) {
        console.warn('[dsh-better-workspace] host settings write threw: ' + field, error)
      }
    }
    // React hook over the scope snapshot; degrades to a stable "unavailable"
    // constant when the scope is absent so useSyncExternalStore never re-binds.
    // The hook call itself is unconditional (React discipline: no conditional
    // hooks) — capability probing lives inside the callbacks.
    const HAS_USE_SYNC_EXTERNAL_STORE = typeof React.useSyncExternalStore === 'function'
    const useHostScope = () => {
      const scope = prefsScopeRef
      return HAS_USE_SYNC_EXTERNAL_STORE
        ? React.useSyncExternalStore(
          (onChange) => (scope && typeof scope.subscribe === 'function' ? scope.subscribe(onChange) : () => {}),
          () => {
            try { return scope && typeof scope.getSnapshot === 'function' ? scope.getSnapshot() : HOST_SNAP_UNAVAILABLE } catch { return HOST_SNAP_UNAVAILABLE }
          },
        )
        : HOST_SNAP_UNAVAILABLE
    }

    // MANUAL cross-device sync (user-chosen, never automatic): the settings
    // card offers a pull button ("从客户端获取" on the web / "从 Web 获取" in
    // the desktop app — the other surface's copy arrives through the host
    // settings store) with an overwrite-or-merge mode choice, plus a push
    // button that uploads THIS device's current values (pre-0.9.5 history was
    // never uploaded, so a first explicit push is needed once). Routine new
    // writes already dual-write through makeSharedWrites, so the host copy
    // stays fresh after the first push.

    // Shared write wrappers: local action first (immediate echo + fallback
    // store), then the durable host write computed from the CURRENT rendered
    // values — after a manual pull the local store already holds the host
    // copy, so host-only entries written on the other surface survive.
    const makeSharedWrites = (actions, stylingMap, foldersList, dirsMap, wsDirMap) => ({
      setStyling: (key, value) => {
        if (actions && typeof actions.setStyling === 'function') actions.setStyling(key, value)
        const next = { ...stylingMap }
        if (value === null) delete next[key]
        else next[key] = value
        scopeSet('styling', next)
      },
      addFolder: (path) => {
        if (actions && typeof actions.addFolder === 'function') actions.addFolder(path)
        const p = normPath(path)
        const base = Array.isArray(foldersList) ? foldersList : []
        if (p !== '' && !base.includes(p)) scopeSet('folders', [...base, p])
      },
      removeFolder: (path) => {
        if (actions && typeof actions.removeFolder === 'function') actions.removeFolder(path)
        const base = Array.isArray(foldersList) ? foldersList : []
        scopeSet('folders', base.filter(f => f !== path))
      },
      renameFolder: (oldPath, newPath) => {
        if (actions && typeof actions.renameFolder === 'function') actions.renameFolder(oldPath, newPath)
        const base = Array.isArray(foldersList) ? foldersList : []
        const oo = oldPath + '/'
        const nn = newPath + '/'
        scopeSet('folders', Array.from(new Set(base.map(f => (f === oldPath ? newPath : (f.startsWith(oo) ? nn + f.slice(oo.length) : f))))))
      },
      setPref: (key, value) => {
        if (actions && typeof actions.setPref === 'function') actions.setPref(key, value)
        scopeSet(key, value)
      },
      /* ---------------- virtual directory writes ----------------
       * Each op computes the NEXT state deterministically from the currently
       * rendered maps, applies it locally (immediate echo), and mirrors the
       * same change into the host settings store (cross-device durability).
       * Directories ride the host as JSON strings — see src/index.js for why.
       */
      dirAdd: (parentId, name) => {
        const dirs = Object.assign({}, dirsMap)
        const parent = parentId && dirs[parentId] ? parentId : ''
        const id = newDirId()
        dirs[id] = { id, name: String(name || '').trim() || '新建目录', parentId: parent, order: nextDirOrder(dirs, parent) }
        if (actions && typeof actions.addDirectory === 'function') actions.addDirectory(parent, name, id, dirs[id].order)
        scopeSet('directoriesJson', JSON.stringify(dirs))
        return id
      },
      dirRename: (dirId, name) => {
        const dirs = Object.assign({}, dirsMap)
        if (!dirs[dirId]) return
        const next = String(name || '').trim()
        if (next === '') return
        dirs[dirId] = Object.assign({}, dirs[dirId], { name: next })
        if (actions && typeof actions.renameDirectory === 'function') actions.renameDirectory(dirId, next)
        scopeSet('directoriesJson', JSON.stringify(dirs))
      },
      dirMove: (dirId, parentId) => {
        const dirs = Object.assign({}, dirsMap)
        if (!dirs[dirId]) return
        const parent = parentId && dirs[parentId] ? parentId : ''
        if (parent === dirId || isDescendantDir(dirs, parent, dirId)) return
        dirs[dirId] = Object.assign({}, dirs[dirId], { parentId: parent, order: nextDirOrder(dirs, parent) })
        if (actions && typeof actions.moveDirectory === 'function') actions.moveDirectory(dirId, parent, dirs[dirId].order)
        scopeSet('directoriesJson', JSON.stringify(dirs))
      },
      /**
       * Apply a whole sibling renumbering in ONE write.
       *
       * Drag-to-reorder produces a dense `{ id: order }` map covering every
       * sibling (see reorderDirIds). Driving that through per-directory
       * dirMove calls is wrong twice over:
       *   - dirMove takes NO order argument — it always APPENDS
       *     (order = nextDirOrder), so every sibling in the batch would end up
       *     on the same value and the row would only appear to land right
       *     because equal orders fall back to the NAME tie-break;
       *   - each call would write a FULL directoriesJson snapshot derived from
       *     the same render-time dirsMap, so the batch is a lost-update chain
       *     in which only the last snapshot survives.
       * One pass over the batch, one local-store action per changed directory
       * (each carrying its explicit order), one host write.
       */
      dirSetOrders: (orders) => {
        if (!orders || typeof orders !== 'object') return
        const dirs = Object.assign({}, dirsMap)
        let changed = false
        for (const id of Object.keys(orders)) {
          const dir = dirs[id]
          const order = orders[id]
          if (!dir || typeof order !== 'number' || (dir.order || 0) === order) continue
          dirs[id] = Object.assign({}, dir, { order })
          changed = true
          if (actions && typeof actions.moveDirectory === 'function') actions.moveDirectory(id, dir.parentId || '', order)
        }
        if (changed) scopeSet('directoriesJson', JSON.stringify(dirs))
      },
      /**
       * Persist the root-level sequence (see orderRootEntries). Tokens rather
       * than bare ids: one list has to carry directories AND workspaces, whose
       * id spaces are unrelated. The host copy rides `rootOrderJson` — a JSON
       * string, same reasoning as directoriesJson/wsDirJson in src/index.js.
       */
      rootOrderSet: (list) => {
        const next = Array.isArray(list) ? list.slice() : []
        if (actions && typeof actions.setRootOrder === 'function') actions.setRootOrder(next)
        scopeSet('rootOrderJson', JSON.stringify(next))
      },
      /** Delete a directory subtree; real workspaces inside are detached to root. */
      dirRemove: (dirId) => {
        const dirs = Object.assign({}, dirsMap)
        if (!dirs[dirId]) return
        const doomed = new Set(subtreeDirIds(dirs, dirId))
        for (const id of doomed) delete dirs[id]
        const nextWs = Object.assign({}, wsDirMap)
        for (const wsId of Object.keys(nextWs)) if (doomed.has(nextWs[wsId])) delete nextWs[wsId]
        if (actions && typeof actions.removeDirectory === 'function') actions.removeDirectory(dirId, 'root')
        scopeSet('directoriesJson', JSON.stringify(dirs))
        scopeSet('wsDirJson', JSON.stringify(nextWs))
      },
      /** Attach/detach a real workspace to a directory ('' ⇒ root level). */
      wsAssign: (workspaceId, dirId) => {
        const dirs = dirsMap
        const target = dirId && dirs[dirId] ? dirId : ''
        const nextWs = Object.assign({}, wsDirMap)
        if (target === '') delete nextWs[workspaceId]
        else nextWs[workspaceId] = target
        if (actions && typeof actions.assignWorkspace === 'function') actions.assignWorkspace(workspaceId, target)
        scopeSet('wsDirJson', JSON.stringify(nextWs))
      },
    })

    /* ============================ flow dialog ========================= */

    const BTN = (props) => (
      ui.Button
        ? E(ui.Button, props)
        : E('button', { type: 'button', className: cls('bw-btn', props.variant === 'primary' && 'bw-btn-primary'), onClick: props.onClick, disabled: props.disabled }, props.children)
    )

    function TextDialog({ title, hint, initial, confirmLabel, onConfirm, onClose, t }) {
      const [value, setValue] = React.useState(initial)
      const inputRef = React.useRef(null)
      React.useEffect(() => { if (inputRef.current) { inputRef.current.focus(); inputRef.current.select() } }, [])
      const commit = () => onConfirm(value)
      return E(ui.Modal, {
        open: true,
        onClose,
        closeLabel: t('close'),
        title,
        footer: E('div', { className: 'bw-modal-actions' },
          E(BTN, { variant: 'outline', onClick: onClose }, t('cancel')),
          E(BTN, { variant: 'primary', onClick: commit }, confirmLabel || t('confirm')),
        ),
      },
        E('div', { className: 'bw-modal-body' },
          E('div', { className: 'bw-field' },
            E('input', {
              ref: inputRef,
              className: 'bw-input',
              value,
              onChange: (e) => setValue(e.target.value),
              onKeyDown: (e) => { if (e.key === 'Enter') commit() },
            }),
            hint ? E('div', { className: 'bw-hint' }, hint) : null,
          ),
        ),
        StyleNode(),
      )
    }

    function ConfirmDialog({ title, body, onConfirm, onClose, t }) {
      return E(ui.Modal, {
        open: true,
        onClose,
        closeLabel: t('close'),
        title,
        footer: E('div', { className: 'bw-modal-actions' },
          E(BTN, { variant: 'outline', onClick: onClose }, t('cancel')),
          E(BTN, { variant: 'primary', onClick: onConfirm }, t('confirm')),
        ),
      }, E('div', { className: 'bw-modal-body' }, E('div', { className: 'bw-hint' }, body)), StyleNode())
    }

    /**
     * Render crash insurance: dsh boots all-or-nothing (one failed entry
     * fails the whole web boot) and React unmounts the root on an uncaught
     * render error — so our registrations render behind this boundary and a
     * bug degrades to "region renders nothing", never a blank application.
     */
    class QuietBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { failed: false }
      }
      static getDerivedStateFromError() {
        return { failed: true }
      }
      componentDidCatch(error, info) {
        console.error('[dsh-better-workspace] render error (region degraded to empty)', error, info)
      }
      render() {
        return this.state.failed ? null : this.props.children
      }
    }

    /* ============ official directory browser (vendored, MIT) ============ */
    /**
     * MIT-licensed `DirectoryBrowser` from `@deepseek-ai/dsh-client-ui-directory-picker-browse`
     * (Copyright (c) 2026 DeepSeek), vendored verbatim. DSH is open source, but
     * that package's `./client` surface exports only `apply`/`inject`, so the
     * component is not reachable through the module loader; reusing it is what
     * lets the sidebar's "add workspace" button open the SAME 680x500 Miller
     * browser the hero menu shows, instead of a hand-rolled lookalike.
     *
     * Only these alias bindings differ from upstream (the bundle's own
     * `require` shims and its inline clsx shim are replaced by the `React` /
     * `ui` / `cls` this module already has), and the CSS-module prefix is
     * renamed to `bwdb_` so the vendored stylesheet can never collide with the
     * shipped plugin's own injection (both live in the same document).
     */
    const OfficialDirectoryBrowser = (() => {
      const react = React
      const clsx = cls
      const _deepseek_ai_dsh_client_ui_primitives = ui
      const jsxShim = (type, props, key) => {
        const next = Object.assign({}, props)
        const children = next.children
        delete next.children
        if (key !== undefined) next.key = key
        if (children === undefined) return E(type, next)
        return Array.isArray(children) ? E(type, next, ...children) : E(type, next, children)
      }
      const react_jsx_runtime = { Fragment: React.Fragment, jsx: jsxShim, jsxs: jsxShim }
      /* ---- vendored body begins ---- */
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-directory-picker-browse/src/client/DirectoryBrowser.module.css.mjs
		const css = ".bwdb_dialog.bwdb_dialog{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);gap:0;width:min(680px,100%);height:min(500px,100dvh - 32px);padding:0}.bwdb_editorScope{display:contents}.bwdb_header{border-bottom:.5px solid var(--dsw-alias-border-l3);flex-direction:column;flex:none;gap:8px;padding:16px 14px 8px 24px;display:flex}.bwdb_title{min-height:28px;color:var(--dsw-alias-label-primary);align-items:flex-end;margin:0;font-size:16px;font-weight:510;line-height:24px;display:flex}.bwdb_crumbBar{box-sizing:border-box;border-radius:var(--dsw-radius-sm);border:1px solid #0000;align-items:center;gap:4px;min-height:24px;margin-left:-9px;padding:0 8px;display:flex}.bwdb_crumbBar:has(.bwdb_crumbEditZone:enabled:hover),.bwdb_crumbBar:has(.bwdb_crumbEditZone:focus-visible),.bwdb_crumbBar:has(.bwdb_pathInput){border-color:var(--dsw-alias-border-l2)}.bwdb_millerRow{scrollbar-width:none;flex:1 1 0;align-items:stretch;gap:12px;min-height:0;display:flex;overflow-x:auto}.bwdb_crumbTrail{scrollbar-width:none;flex:0 auto;align-items:center;gap:4px;min-width:0;display:flex;overflow-x:auto}.bwdb_crumbSeat{flex:none;align-items:center;gap:4px;min-width:0;display:inline-flex}.bwdb_crumb{text-overflow:ellipsis;white-space:nowrap;max-width:160px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;padding:0;font-size:13px;font-weight:500;line-height:20px;overflow:hidden}.bwdb_crumb:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}.bwdb_crumb:hover{color:var(--dsw-alias-label-primary)}.bwdb_crumbChevron{color:var(--dsw-alias-label-tertiary);flex:none}.bwdb_crumbEditZone{cursor:text;background:0 0;border:none;outline:none;flex:1 0 34px;justify-content:flex-end;align-items:center;min-width:34px;height:22px;padding:0;display:flex}.bwdb_crumbEditGlyph{color:var(--dsw-alias-label-tertiary);flex:none}.bwdb_crumbEditZone:enabled:hover .bwdb_crumbEditGlyph,.bwdb_crumbEditZone:focus-visible .bwdb_crumbEditGlyph{color:var(--dsw-alias-label-primary)}.bwdb_crumbEditZone:disabled{cursor:default}.bwdb_crumbEditZone:disabled .bwdb_crumbEditGlyph{color:var(--dsw-alias-label-caption)}.bwdb_pathInput{box-sizing:border-box;min-width:0;height:22px;color:var(--dsw-alias-label-primary);background:0 0;border:none;outline:none;flex:1 1 0;padding:0;font-size:13px;line-height:20px}.bwdb_content{flex-direction:column;flex:1 1 0;min-height:0;padding:16px 16px 16px 24px;display:flex;position:relative}.bwdb_column{flex-direction:column;flex:1 1 0;gap:2px;min-width:256px;padding-right:8px;display:flex;overflow-y:auto}.bwdb_divider{background:var(--dsw-alias-border-l3);flex:none;width:.5px}.bwdb_rowSeat{flex:none;display:flex}.bwdb_row{border-radius:var(--dsw-radius-sm);text-align:left;cursor:pointer;background:0 0;border:none;flex:none;align-items:center;gap:4px;width:100%;height:28px;padding:4px;display:flex}.bwdb_row:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}.bwdb_row:hover{background:var(--dsw-alias-interactive-bg-hover)}.bwdb_rowSelected,.bwdb_rowSelected:hover{background:var(--dsw-alias-interactive-bg-active,var(--dsw-alias-interactive-bg-hover))}.bwdb_rowIcon{color:var(--dsw-alias-label-secondary);flex:none}.bwdb_rowIconSelected{color:var(--dsw-alias-button-info-fill);flex:none}.bwdb_rowName{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-primary);flex:1 1 0;font-size:13px;font-weight:500;line-height:20px;overflow:hidden}.bwdb_rowChevron{color:var(--dsw-alias-label-tertiary);flex:none}.bwdb_status,.bwdb_error{padding:4px 120px 4px 4px;font-size:12px;line-height:18px}.bwdb_status{color:var(--dsw-alias-label-secondary)}.bwdb_error{color:var(--dsw-alias-state-error-primary)}.bwdb_loadingFloat{background:var(--dsw-alias-bg-layer-2);padding:2px 8px;position:absolute;bottom:8px;right:16px}.bwdb_footerBar{border-top:.5px solid var(--dsw-alias-border-l3);flex-wrap:wrap;flex:none;align-items:center;gap:8px;padding:16px 24px;display:flex}.bwdb_showHiddenToggle{color:var(--dsw-alias-label-secondary);cursor:pointer;white-space:nowrap;background:0 0;border:none;align-items:center;gap:4px;padding:0;font-size:13px;font-weight:500;line-height:20px;display:inline-flex}.bwdb_showHiddenToggle:hover{color:var(--dsw-alias-label-primary)}.bwdb_showHiddenToggle:disabled{color:var(--dsw-alias-label-caption);cursor:default}.bwdb_showHiddenToggleActive{color:var(--dsw-alias-label-primary)}.bwdb_footerGap{flex:1 1 0}.bwdb_footerAction{min-width:72px}.bwdb_createDialog.bwdb_createDialog{gap:0;width:min(380px,100%);padding:0}.bwdb_createBody{flex-direction:column;gap:12px;padding:22px 24px 20px;display:flex}.bwdb_createTitle{color:var(--dsw-alias-label-primary);margin:0;font-size:16px;font-weight:510;line-height:24px}.bwdb_createIn{color:var(--dsw-alias-label-primary);margin:0;font-size:14px;line-height:22px}.bwdb_createInput{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg);width:100%;height:44px;color:var(--dsw-alias-label-primary);background:0 0;outline:none;padding:7px 14px;font-size:14px;line-height:22px}.bwdb_createInput::placeholder{color:var(--dsw-alias-label-caption)}.bwdb_createActions{justify-content:flex-end;align-items:center;gap:8px;margin-top:8px;display:flex}";
		const tagId = "dsh-virtual-workspace/OfficialDirectoryBrowser.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-virtual-workspace";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var DirectoryBrowser_module_css_default = {
			"column": "bwdb_column",
			"content": "bwdb_content",
			"createActions": "bwdb_createActions",
			"createBody": "bwdb_createBody",
			"createDialog": "bwdb_createDialog",
			"createIn": "bwdb_createIn",
			"createInput": "bwdb_createInput",
			"createTitle": "bwdb_createTitle",
			"crumb": "bwdb_crumb",
			"crumbBar": "bwdb_crumbBar",
			"crumbChevron": "bwdb_crumbChevron",
			"crumbEditGlyph": "bwdb_crumbEditGlyph",
			"crumbEditZone": "bwdb_crumbEditZone",
			"crumbSeat": "bwdb_crumbSeat",
			"crumbTrail": "bwdb_crumbTrail",
			"dialog": "bwdb_dialog",
			"divider": "bwdb_divider",
			"editorScope": "bwdb_editorScope",
			"error": "bwdb_error",
			"footerAction": "bwdb_footerAction",
			"footerBar": "bwdb_footerBar",
			"footerGap": "bwdb_footerGap",
			"header": "bwdb_header",
			"loadingFloat": "bwdb_loadingFloat",
			"millerRow": "bwdb_millerRow",
			"pathInput": "bwdb_pathInput",
			"row": "bwdb_row",
			"rowChevron": "bwdb_rowChevron",
			"rowIcon": "bwdb_rowIcon",
			"rowIconSelected": "bwdb_rowIconSelected",
			"rowName": "bwdb_rowName",
			"rowSeat": "bwdb_rowSeat",
			"rowSelected": "bwdb_rowSelected",
			"showHiddenToggle": "bwdb_showHiddenToggle",
			"showHiddenToggleActive": "bwdb_showHiddenToggleActive",
			"status": "bwdb_status",
			"title": "bwdb_title"
		};
		//#endregion
		//#region lib/types/client/DirectoryBrowser.js
		/**
		* The in-app workspace-directory browser (figma Harness 813-23126 family): a
		* 680×500 dialog (clamped to short/narrow viewports — the Miller row scrolls
		* sideways, the columns scroll down) whose header carries the title, the selection-path
		* breadcrumb, and a click-to-edit path zone; below it a Miller view — one
		* full-width level until a row is selected, then two columns splitting the
		* row evenly (256px floor; level | selected folder's children) around a
		* hairline divider. Navigations land selection-anchored and quiet: the
		* previous view keeps rendering while a crumb jump or a submitted path is
		* scanned, then target and parent legs land as one two-pane frame (a slow
		* parent leg falls back to landing the target alone and upgrading in
		* place), so stepping back keeps two panes away from the display root and
		* navigation never flashes an intermediate frame. Selecting in the
		* right column shifts the view one level deeper. "New folder" opens a nested
		* create dialog targeting the selected folder (or the level itself) and
		* selects the created folder. Open adopts the selected folder, falling back
		* to the listed level. Pure consumer of the injected browse calls — the
		* owning flow decides what "Open" means and owns the workspace-creation
		* error surface. Hidden entries are host-flagged and hidden by default; the
		* footer's fixed-label "Show hidden files" toggle (aria-pressed, check when
		* on) reveals them (client-side only). The path editor announces itself with
		* a pencil glyph and a bar-wide hover-lit outline, opens seeded with a
		* trailing separator, and keeps the panes under the draft: the final segment
		* prefix-filters the LAST pane while that pane's level is the one the draft's
		* directory part names (a dot-led prefix also reveals the hidden entries it
		* names, and a prefix nobody matches releases the filter), while any other
		* directory part is scanned after a short debounce and lands like any other
		* navigation — selection-anchored and two-pane away from the display root,
		* both legs waited out so one keystroke moves the view once. The pane arity
		* holds throughout: the last pane is the level the path names and the one
		* beside it is its parent, so typing deeper descends and erasing segments
		* walks back up, moving the Miller view without leaving the editor. Panes the
		* draft walked to stay put when the editor closes (cancellation included):
		* the crumbs name where the walk ended, and Open's fallback target follows
		* them.
		*/
		/** Failure text from the injected directory operation. */
		function failureText(error) {
			if (error !== null && typeof error === "object" && "rpcError" in error) {
				const rpcError = error.rpcError;
				if (rpcError !== null && typeof rpcError === "object" && "message" in rpcError && typeof rpcError.message === "string") return rpcError.message;
			}
			return error instanceof Error ? error.message : String(error);
		}
		/**
		* How long a scan may stay visually silent before the floating "Loading…"
		* pill appears. The stale view keeps rendering while a scan is in flight, so
		* a listing that settles inside this window swaps the panes with no
		* intermediate frame at all; only a genuinely slow host (a network mount, a
		* cold disk) surfaces the indicator.
		*/
		const SLOW_SCAN_DELAY_MS = 300;
		/**
		* How long a navigation landing waits for its parent leg before committing
		* the target alone. Inside the window both legs land as ONE two-pane frame —
		* no single-pane flash between them; past it the target commits single-pane
		* at once (an Enter-submitted navigation is never held hostage by a stalled
		* parent) and the late parent leg upgrades the landing in place.
		*/
		const PARENT_LEG_WAIT_MS = 200;
		/**
		* How long a typed draft rests before the panes follow it to a directory no
		* pane lists. The window absorbs the keystrokes that walk through
		* intermediate directory parts (every character of `/usr/lo` past the
		* separator would otherwise be its own scan) while staying short enough that
		* a pause reads as "the list moved with me".
		*/
		const DRAFT_PREVIEW_DEBOUNCE_MS = 250;
		/**
		* Breadcrumb rows for display: inside the home subtree the chain starts at a
		* localized Home crumb; outside it the full ancestry shows, the root labeled
		* by its own path.
		*/
		function displayCrumbs(listing, homeLabel) {
			const homeIndex = listing.crumbs.findIndex((crumb) => crumb.path === listing.home);
			if (homeIndex === -1) return listing.crumbs;
			const tail = listing.crumbs.slice(homeIndex + 1);
			return [{
				name: homeLabel,
				path: listing.home,
				hidden: false
			}, ...tail];
		}
		/**
		* The listing's platform separator, inferred from the home path the host
		* stamped — never from typed text or entry paths, where a backslash is a
		* legal POSIX name character. Still a heuristic at the last step: a POSIX
		* home directory whose own name contains a backslash would misread.
		* TODO: replace with a host-stamped `separator` field on the wire
		* DirectoryListing so the platform fact travels verbatim (the trade-off is
		* recorded in the directory-picker capability seam Agent Note).
		*/
		function separatorOf(listing) {
			return listing.home.includes("\\") ? "\\" : "/";
		}
		/** The listed level as a directory part: its own path, separator-terminated (the root already is). */
		function levelDirectory(listing) {
			const sep = separatorOf(listing);
			return listing.path.endsWith(sep) ? listing.path : `${listing.path}${sep}`;
		}
		/**
		* The draft's directory part — everything through its last separator — or
		* null while no separator has been typed at all (nothing addresses a
		* directory yet). The platform comes from `listing`: on Windows a forward
		* slash separates too (the host's `resolve` accepts either), while on POSIX a
		* backslash is a legal name character and never separates.
		*/
		function draftDirectory(listing, draft) {
			const cut = separatorOf(listing) === "\\" ? Math.max(draft.lastIndexOf("\\"), draft.lastIndexOf("/")) : draft.lastIndexOf("/");
			return cut === -1 ? null : draft.slice(0, cut + 1);
		}
		/**
		* How the draft reads against one level: the directory part it names, and —
		* when `listing` is the level that directory part addresses — the final
		* segment that prefix-filters it while the user types (case-insensitively,
		* downstream). A level answers a directory part when its own path is that
		* part, or when it is the level that very text just produced (`scanned`): the
		* host resolves what it is given, so `..` segments and Windows forward
		* slashes reach a level whose path spells the request differently.
		* @param listing - the level to read the draft against.
		* @param draft - the current path draft.
		* @param scanned - the last draft-following scan's directory and landing.
		* @returns the draft's directory part (null with no separator typed) and its
		* filtering tail (null when this level does not answer that directory).
		*/
		function readDraft(listing, draft, scanned) {
			const directory = draftDirectory(listing, draft);
			if (directory === null) return {
				directory: null,
				tail: null
			};
			return {
				directory,
				tail: directory === levelDirectory(listing) || scanned !== null && scanned.directory === directory && scanned.landed === listing.path ? draft.slice(directory.length) : null
			};
		}
		/**
		* The rows one column renders. The selection is exempt from every filter: it
		* anchors the two-pane view (crumbs and the child pane point at it), so
		* neither the hidden filter after a dot-reveal pick nor a prefix miss may
		* orphan it. A prefix narrows the level only while some row it would actually
		* show matches — a tail nobody matches is a name being spelled, not a demand
		* for an empty pane, so the level shows whole and its hidden rows return to
		* obeying the toggle. Counting only displayable rows keeps that true because
		* every hidden name is dot-prefixed, and a matching prefix therefore reveals
		* it; otherwise the level could narrow to nothing.
		*/
		function visibleEntries(entries, selectedPath, showHidden, filterPrefix) {
			const needle = filterPrefix === null ? "" : filterPrefix.toLowerCase();
			const displayable = (entry) => showHidden || !entry.hidden || needle.startsWith(".");
			const matches = (entry) => displayable(entry) && entry.name.toLowerCase().startsWith(needle);
			const narrowing = needle !== "" && entries.some(matches);
			return entries.filter((entry) => {
				if (entry.path === selectedPath) return true;
				if (narrowing) return matches(entry);
				return showHidden || !entry.hidden;
			});
		}
		/** One column of folder rows (the Miller view renders one or two of these). */
		function LevelColumn({ entries, selectedPath, busy, onPick, showHidden, filterPrefix, pathEditing }) {
			const visible = visibleEntries(entries, selectedPath, showHidden, filterPrefix);
			return (0, react_jsx_runtime.jsx)("div", {
				className: DirectoryBrowser_module_css_default.column,
				role: "list",
				children: visible.map((entry) => {
					const selected = entry.path === selectedPath;
					return (0, react_jsx_runtime.jsx)("span", {
						role: "listitem",
						className: DirectoryBrowser_module_css_default.rowSeat,
						children: (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							"aria-current": selected || void 0,
							className: clsx(DirectoryBrowser_module_css_default.row, selected && DirectoryBrowser_module_css_default.rowSelected),
							disabled: busy,
							onMouseDown: pathEditing ? (event) => {
								event.preventDefault();
							} : void 0,
							onClick: () => {
								onPick(entry);
							},
							children: [
								selected ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenRegular, {
									size: 16,
									className: DirectoryBrowser_module_css_default.rowIconSelected
								}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderCloseRegular, {
									size: 16,
									className: DirectoryBrowser_module_css_default.rowIcon
								}),
								(0, react_jsx_runtime.jsx)("span", {
									className: DirectoryBrowser_module_css_default.rowName,
									children: entry.name
								}),
								(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {
									size: 12,
									className: DirectoryBrowser_module_css_default.rowChevron
								})
							]
						})
					}, entry.path);
				})
			});
		}
		/**
		* Render the directory-browser dialog.
		* @param props - owner-controlled browser props.
		* @returns the dialog element (null while closed, via Modal).
		*/
		function DirectoryBrowser({ open, listDirectory, createDirectory, onOpen, onClose, busy, t }) {
			const [parent, setParent] = (0, react.useState)(null);
			const [selected, setSelected] = (0, react.useState)(null);
			const [child, setChild] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(false);
			const [slowScan, setSlowScan] = (0, react.useState)(false);
			const [scanWindow, setScanWindow] = (0, react.useState)(0);
			const [error, setError] = (0, react.useState)(null);
			const [pathDraft, setPathDraft] = (0, react.useState)(null);
			const [showHidden, setShowHidden] = (0, react.useState)(false);
			const [folderDraft, setFolderDraft] = (0, react.useState)(null);
			const [creatingFolder, setCreatingFolder] = (0, react.useState)(false);
			const [createError, setCreateError] = (0, react.useState)(null);
			const requestSeq = (0, react.useRef)(0);
			const scanController = (0, react.useRef)(null);
			const openGeneration = (0, react.useRef)(0);
			const crumbTrailRef = (0, react.useRef)(null);
			const composingRef = (0, react.useRef)(false);
			(0, react.useEffect)(() => () => {
				requestSeq.current += 1;
				openGeneration.current += 1;
				scanController.current?.abort();
			}, []);
			const compositionGuard = {
				onCompositionStart: () => {
					composingRef.current = true;
				},
				onCompositionEnd: () => {
					composingRef.current = false;
				}
			};
			/** Newer intent wins: invalidate the pending listing's settlement AND abort its wire request. */
			const supersede = (0, react.useCallback)(() => {
				scanController.current?.abort();
				scanController.current = null;
				return ++requestSeq.current;
			}, []);
			/** Hide any prior indicator and start a fresh silence window for one listing call. */
			const restartSlowScanWindow = (0, react.useCallback)(() => {
				setSlowScan(false);
				setScanWindow((value) => value + 1);
			}, []);
			/** Launch one listing under a fresh controller so a later supersession can abort it. */
			const launchListing = (0, react.useCallback)((path) => {
				const seq = supersede();
				const controller = new AbortController();
				scanController.current = controller;
				restartSlowScanWindow();
				return {
					seq,
					scan: listDirectory(path, controller.signal)
				};
			}, [
				supersede,
				restartSlowScanWindow,
				listDirectory
			]);
			/**
			* Launch a follow-up listing under the CURRENT supersession seq: a newer
			* intent aborts it like the leg it continues, and it supersedes nothing.
			*/
			const continueScan = (0, react.useCallback)((path) => {
				const controller = new AbortController();
				scanController.current = controller;
				restartSlowScanWindow();
				return listDirectory(path, controller.signal);
			}, [restartSlowScanWindow, listDirectory]);
			/**
			* Enter owns the view from submission until its navigation lands, so the
			* debounce timer the same keystrokes armed must not supersede it. Cleared
			* by the next edit (and by opening the editor); a failed submission leaves
			* it set until the operator edits again, so the rejected path is not
			* immediately re-scanned as a preview.
			*/
			const previewSuspended = (0, react.useRef)(false);
			const viewRef = (0, react.useRef)({
				parent: null,
				child: null
			});
			(0, react.useEffect)(() => {
				viewRef.current = {
					parent,
					child
				};
			}, [parent, child]);
			const scanned = (0, react.useRef)(null);
			/**
			* A landed preview replaced the pane a keyboard operator may have Tabbed
			* onto, so the focus it drops is re-parked on the still-open editor (the
			* Modal has no focus trap). Consumed by the refocus effect below.
			*/
			const refocusPathInput = (0, react.useRef)(false);
			/**
			* Replace the whole view with a freshly scanned level. Away from the
			* display root — the same collapse the crumb header renders, so crumbs and
			* pane shape never disagree — the landing is two-pane: the target's ACTUAL
			* parent-level entry re-selected (left pane = parent, right pane = the
			* target), so a crumb jump reads as stepping back one pane. Both legs land
			* as one frame when the parent leg settles within
			* {@link PARENT_LEG_WAIT_MS}; past that bound (or at the display root) the
			* target commits alone — single wide level, loading ends — and a late
			* parent leg still upgrades the landing in place. A failed parent leg, or a
			* truncated parent window that lacks the target, leaves the single-pane
			* landing — the upgrade must never orphan the selection it exists to
			* anchor. Until whichever commit comes first, the previous view keeps
			* rendering: a landing swaps the panes, it never blanks them.
			*
			* Two callers, one landing shape. A submitted path (Enter, a crumb) closes
			* the editor on arrival, announces its failure, and takes the wait bound —
			* it is answering a gesture, so it may not hang on a stalled parent. The
			* editor's own draft-following scan keeps all three to itself: it is
			* speculative, nothing waits on it, and the stale view keeps rendering, so
			* it waits for BOTH legs rather than flashing a single pane it would then
			* upgrade — one keystroke must move the view once. A failure leaves the
			* last readable panes standing and says nothing, while an arrival clears
			* the stale message and re-parks focus the swap dropped.
			* @param path - the level to list; absent lists the Host home directory.
			* @param options - `closeEditor` retires the path draft on arrival and
			* bounds the wait for the parent leg; `announce` surfaces a failure as the
			* dialog's alert.
			*/
			const land = (0, react.useCallback)((path, options) => {
				const { seq, scan } = launchListing(path);
				setLoading(true);
				if (options.announce) setError(null);
				const settle = () => {
					setLoading(false);
					if (options.closeEditor) {
						setPathDraft(null);
						return;
					}
					setError(null);
					refocusPathInput.current = true;
				};
				scan.then((target) => {
					if (seq !== requestSeq.current) return;
					if (!options.closeEditor && path !== void 0) scanned.current = {
						directory: path,
						landed: target.path
					};
					let landed = false;
					const landSingle = () => {
						if (landed || seq !== requestSeq.current) return;
						landed = true;
						setParent(target);
						setSelected(null);
						setChild(null);
						settle();
					};
					if (displayCrumbs(target, "").length < 2) {
						landSingle();
						return;
					}
					const parentCrumb = target.crumbs.at(-2);
					/* v8 ignore next -- narrowing: a two-deep display chain implies a parent crumb (root-to-target inclusive). */
					if (parentCrumb === void 0) {
						landSingle();
						return;
					}
					continueScan(parentCrumb.path).then((parentLevel) => {
						if (seq !== requestSeq.current) return;
						const sep = separatorOf(parentLevel);
						const fold = (value) => sep === "\\" ? value.toLowerCase() : value;
						const match = parentLevel.entries.find((entry) => fold(entry.path) === fold(target.path));
						if (match === void 0) {
							landSingle();
							return;
						}
						landed = true;
						setParent(parentLevel);
						setSelected(match);
						setChild(target);
						settle();
					}, () => {
						landSingle();
					});
					if (options.closeEditor) window.setTimeout(landSingle, PARENT_LEG_WAIT_MS);
				}, (reason) => {
					if (seq !== requestSeq.current) return;
					setLoading(false);
					if (options.announce) setError(failureText(reason));
				});
			}, [launchListing, continueScan]);
			/** Commit a submitted path (Enter, a crumb, the initial home listing): the editor closes, failures surface. */
			const navigate = (0, react.useCallback)((path) => {
				land(path, {
					closeEditor: true,
					announce: true
				});
			}, [land]);
			const refocusPick = (0, react.useRef)(false);
			const refocusEditZone = (0, react.useRef)(false);
			const pathInputRef = (0, react.useRef)(null);
			const editZoneRef = (0, react.useRef)(null);
			/**
			* Select a row of the listed level and preview its children on the right.
			* Deliberately NOT one-frame like navigate(): a pick's first duty is the
			* immediate selected state on the clicked row, and the pane split IS that
			* feedback (aria-current pill, crumbs following the selection) — holding
			* it back for the child listing would make clicks feel dropped. The quiet
			* rule governs whole-view replacement, where nothing acknowledges the
			* click but the swap itself.
			*/
			const select = (0, react.useCallback)((entry) => {
				const { seq, scan } = launchListing(entry.path);
				if (pathDraft !== null) refocusPick.current = true;
				setPathDraft(null);
				setSelected(entry);
				setChild(null);
				setLoading(true);
				setError(null);
				scan.then((next) => {
					if (seq !== requestSeq.current) return;
					setChild(next);
					setLoading(false);
				}, (reason) => {
					if (seq !== requestSeq.current) return;
					setLoading(false);
					setError(failureText(reason));
					setSelected(null);
					refocusEditZone.current = true;
				});
			}, [launchListing, pathDraft]);
			/**
			* Walk the panes to the directory the draft addresses, WITHOUT closing the
			* editor. The landing is an ordinary one — selection-anchored and two-pane
			* away from the display root — so typing a path moves the Miller view
			* exactly as a crumb jump does, and the draft's final segment
			* prefix-filters the arrival from the next render on.
			*/
			const previewDraftLevel = (0, react.useCallback)((directory) => {
				land(directory, {
					closeEditor: false,
					announce: false
				});
			}, [land]);
			/** Abandon path editing (Escape or clicking away) and restore the crumb view. */
			const cancelPathEdit = (0, react.useCallback)(() => {
				supersede();
				setLoading(false);
				setPathDraft(null);
				setError(null);
				if (child === null) setSelected(null);
				if (parent === null) navigate();
			}, [
				supersede,
				child,
				parent,
				navigate
			]);
			/** A right-column pick advances the view one level: child becomes the level. */
			const advance = (0, react.useCallback)((entry) => {
				/* v8 ignore next -- narrowing guard: the right column only renders with a child listing. */
				if (child === null) return;
				setParent(child);
				select(entry);
			}, [child, select]);
			(0, react.useEffect)(() => {
				openGeneration.current += 1;
				if (open) {
					setParent(null);
					setSelected(null);
					setChild(null);
					setCreatingFolder(false);
					setShowHidden(false);
					navigate();
					return;
				}
				supersede();
				setLoading(false);
				setError(null);
				setPathDraft(null);
				setFolderDraft(null);
				setCreateError(null);
				refocusPick.current = false;
				refocusEditZone.current = false;
			}, [
				open,
				navigate,
				supersede
			]);
			/** The folder a create or Open acts on: the selection, else the listed level. */
			const targetPath = selected?.path ?? parent?.path ?? null;
			const targetName = selected?.name ?? (parent === null ? "" : displayCrumbs(parent, t("browser.home")).at(-1)?.name ?? parent.path);
			const confirmCreate = () => {
				/* v8 ignore next -- reentry fence: the nested dialog only renders with a target and disables while creating. */
				if (targetPath === null || folderDraft === null || creatingFolder) return;
				const name = folderDraft;
				if (name.trim() === "") return;
				setCreatingFolder(true);
				setCreateError(null);
				const generation = openGeneration.current;
				createDirectory(targetPath, name).then((createdPath) => {
					if (generation !== openGeneration.current) return;
					setCreatingFolder(false);
					setFolderDraft(null);
					const { seq, scan } = launchListing(targetPath);
					setLoading(true);
					setError(null);
					scan.then((level) => {
						/* v8 ignore next -- same fence as navigate/select; the modal blocks superseding input */
						if (seq !== requestSeq.current) return;
						setParent(level);
						setLoading(false);
						select({
							name,
							path: createdPath,
							hidden: false
						});
					}, (reason) => {
						/* v8 ignore next -- same fence as navigate/select; the modal blocks superseding input */
						if (seq !== requestSeq.current) return;
						setLoading(false);
						setError(failureText(reason));
					});
				}, (reason) => {
					if (generation !== openGeneration.current) return;
					setCreatingFolder(false);
					setCreateError(failureText(reason));
				});
			};
			(0, react.useEffect)(() => {
				if (!loading) {
					setSlowScan(false);
					return;
				}
				const timer = window.setTimeout(() => {
					setSlowScan(true);
				}, SLOW_SCAN_DELAY_MS);
				return () => {
					window.clearTimeout(timer);
				};
			}, [loading, scanWindow]);
			(0, react.useEffect)(() => {
				if (pathDraft === null) return;
				const timer = window.setTimeout(() => {
					if (previewSuspended.current) return;
					const current = viewRef.current.child ?? viewRef.current.parent;
					if (current === null) return;
					const { directory, tail } = readDraft(current, pathDraft, scanned.current);
					if (directory === null || tail !== null) return;
					previewDraftLevel(directory);
				}, DRAFT_PREVIEW_DEBOUNCE_MS);
				return () => {
					window.clearTimeout(timer);
				};
			}, [pathDraft, previewDraftLevel]);
			const crumbSource = child ?? parent;
			const typedPrefix = crumbSource === null || pathDraft === null ? null : readDraft(crumbSource, pathDraft, scanned.current).tail;
			const crumbs = crumbSource === null ? [] : displayCrumbs(crumbSource, t("browser.home"));
			const crumbTail = crumbs.at(-1)?.path;
			(0, react.useEffect)(() => {
				const trail = crumbTrailRef.current;
				if (trail !== null) trail.scrollLeft = trail.scrollWidth;
			}, [crumbTail]);
			const millerRowRef = (0, react.useRef)(null);
			const childPath = child?.path;
			(0, react.useEffect)(() => {
				const row = millerRowRef.current;
				if (row !== null && childPath !== void 0) row.scrollLeft = row.scrollWidth;
			}, [childPath]);
			(0, react.useEffect)(() => {
				if (refocusPathInput.current) {
					refocusPathInput.current = false;
					if (document.activeElement === document.body) pathInputRef.current?.focus();
				}
				if (pathDraft !== null) return;
				if (refocusPick.current) {
					refocusPick.current = false;
					refocusEditZone.current = false;
					const rowHost = millerRowRef.current;
					/* v8 ignore next -- narrowing guard: the miller row is mounted whenever a pick just committed. */
					if (rowHost === null) return;
					const row = rowHost.querySelector("button[aria-current=\"true\"]");
					/* v8 ignore next -- narrowing guard: the pick that set the flag just rendered its aria-current row. */
					if (row === null) return;
					row.focus();
					return;
				}
				if (refocusEditZone.current) {
					refocusEditZone.current = false;
					if (document.activeElement !== document.body) return;
					const zone = editZoneRef.current;
					/* v8 ignore next -- narrowing guard: crumb mode renders the edit zone whenever the editor just closed. */
					if (zone === null) return;
					zone.focus();
				}
			});
			if (!open) return null;
			const twoPane = selected !== null;
			const parentInert = busy || folderDraft !== null;
			const draftPending = pathDraft !== null;
			return (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open,
				onClose: () => {
					if (folderDraft === null && !busy) onClose();
				},
				title: t("browser.title"),
				className: clsx(DirectoryBrowser_module_css_default.dialog),
				headless: true,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: DirectoryBrowser_module_css_default.editorScope,
					onKeyDown: (event) => {
						if (event.key !== "Escape" || pathDraft === null) return;
						event.stopPropagation();
						refocusEditZone.current = document.activeElement === pathInputRef.current;
						cancelPathEdit();
					},
					onBlur: (event) => {
						if (pathDraft === null) return;
						if (!document.hasFocus()) return;
						const card = event.currentTarget.closest("[role=\"dialog\"]");
						/* v8 ignore next -- narrowing guard: this scope always renders inside the Modal card. */
						if (card === null) return;
						if (event.relatedTarget instanceof Node && card.contains(event.relatedTarget)) return;
						refocusEditZone.current = false;
						cancelPathEdit();
					},
					children: [
						(0, react_jsx_runtime.jsxs)("div", {
							className: DirectoryBrowser_module_css_default.header,
							children: [(0, react_jsx_runtime.jsx)("h2", {
								className: DirectoryBrowser_module_css_default.title,
								children: t("browser.title")
							}), (0, react_jsx_runtime.jsx)("div", {
								className: DirectoryBrowser_module_css_default.crumbBar,
								children: pathDraft === null ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("span", {
									className: DirectoryBrowser_module_css_default.crumbTrail,
									role: "navigation",
									ref: crumbTrailRef,
									children: crumbs.map((crumb, index) => (0, react_jsx_runtime.jsxs)("span", {
										className: DirectoryBrowser_module_css_default.crumbSeat,
										children: [index > 0 && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {
											size: 12,
											className: DirectoryBrowser_module_css_default.crumbChevron
										}), (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: DirectoryBrowser_module_css_default.crumb,
											disabled: parentInert,
											onClick: () => {
												navigate(crumb.path);
											},
											children: crumb.name
										})]
									}, crumb.path))
								}), (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: DirectoryBrowser_module_css_default.crumbEditZone,
									"aria-label": t("browser.editPath"),
									title: t("browser.editPath"),
									disabled: parentInert,
									ref: editZoneRef,
									onClick: () => {
										supersede();
										setLoading(false);
										previewSuspended.current = false;
										if (parent === null) {
											setPathDraft("");
											return;
										}
										const base = selected?.path ?? parent.path;
										const sep = separatorOf(parent);
										setPathDraft(base.endsWith(sep) ? base : `${base}${sep}`);
									},
									children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutlineRegular, {
										size: 14,
										className: DirectoryBrowser_module_css_default.crumbEditGlyph
									})
								})] }) : (0, react_jsx_runtime.jsx)("input", {
									className: DirectoryBrowser_module_css_default.pathInput,
									value: pathDraft,
									"aria-label": t("browser.editPath"),
									autoFocus: true,
									ref: pathInputRef,
									disabled: parentInert,
									onChange: (event) => {
										supersede();
										setLoading(false);
										previewSuspended.current = false;
										setPathDraft(event.target.value);
									},
									...compositionGuard,
									onKeyDown: (event) => {
										if (event.key === "Enter" && !composingRef.current) {
											event.preventDefault();
											if (pathDraft.trim() !== "") {
												refocusEditZone.current = true;
												previewSuspended.current = true;
												navigate(pathDraft);
											}
										}
									}
								})
							})]
						}),
						(0, react_jsx_runtime.jsxs)("div", {
							className: DirectoryBrowser_module_css_default.content,
							children: [
								(0, react_jsx_runtime.jsxs)("div", {
									className: DirectoryBrowser_module_css_default.millerRow,
									ref: millerRowRef,
									children: [
										parent !== null && (0, react_jsx_runtime.jsx)(LevelColumn, {
											entries: parent.entries,
											selectedPath: selected?.path ?? null,
											busy: parentInert,
											onPick: select,
											showHidden,
											filterPrefix: child === null ? typedPrefix : null,
											pathEditing: draftPending
										}),
										twoPane && (0, react_jsx_runtime.jsx)("span", { className: DirectoryBrowser_module_css_default.divider }),
										twoPane && child !== null && (0, react_jsx_runtime.jsx)(LevelColumn, {
											entries: child.entries,
											selectedPath: null,
											busy: parentInert,
											onPick: advance,
											showHidden,
											filterPrefix: typedPrefix,
											pathEditing: draftPending
										})
									]
								}),
								loading && slowScan && (0, react_jsx_runtime.jsx)("div", {
									className: clsx(DirectoryBrowser_module_css_default.status, DirectoryBrowser_module_css_default.loadingFloat),
									role: "status",
									children: t("browser.loading")
								}),
								(parent?.truncated === true || child?.truncated === true) && (0, react_jsx_runtime.jsx)("div", {
									className: DirectoryBrowser_module_css_default.status,
									role: "status",
									children: t("browser.truncated")
								}),
								error !== null && (0, react_jsx_runtime.jsx)("div", {
									className: DirectoryBrowser_module_css_default.error,
									role: "alert",
									children: error
								})
							]
						}),
						(0, react_jsx_runtime.jsxs)("div", {
							className: DirectoryBrowser_module_css_default.footerBar,
							children: [
								(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineRegular, { size: 14 }),
									disabled: parent === null || loading || parentInert || draftPending,
									onClick: () => {
										setFolderDraft("");
										setCreateError(null);
									},
									children: t("browser.newFolder")
								}),
								(0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: clsx(DirectoryBrowser_module_css_default.showHiddenToggle, showHidden && DirectoryBrowser_module_css_default.showHiddenToggleActive),
									"aria-pressed": showHidden,
									disabled: parentInert,
									onMouseDown: draftPending ? (event) => {
										event.preventDefault();
									} : void 0,
									onClick: () => {
										setShowHidden((prev) => !prev);
									},
									children: [t("browser.showHidden"), showHidden && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutlineRegular, { size: 14 })]
								}),
								(0, react_jsx_runtime.jsx)("span", { className: DirectoryBrowser_module_css_default.footerGap }),
								(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									className: clsx(DirectoryBrowser_module_css_default.footerAction),
									disabled: parentInert,
									onClick: onClose,
									children: t("browser.cancel")
								}),
								(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "primary",
									className: clsx(DirectoryBrowser_module_css_default.footerAction),
									disabled: targetPath === null || loading || parentInert || draftPending,
									/* v8 ignore next -- narrowing guard: Open disables while no target exists. */
									onClick: () => {
										if (targetPath !== null) onOpen(targetPath);
									},
									children: t("browser.open")
								})
							]
						})
					]
				}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
					open: folderDraft !== null,
					onClose: () => {
						if (!creatingFolder) setFolderDraft(null);
					},
					title: t("browser.newFolder"),
					className: clsx(DirectoryBrowser_module_css_default.createDialog),
					headless: true,
					children: (0, react_jsx_runtime.jsxs)("div", {
						className: DirectoryBrowser_module_css_default.createBody,
						children: [
							(0, react_jsx_runtime.jsx)("h3", {
								className: DirectoryBrowser_module_css_default.createTitle,
								children: t("browser.newFolder")
							}),
							(0, react_jsx_runtime.jsx)("p", {
								className: DirectoryBrowser_module_css_default.createIn,
								children: t("browser.createIn", { name: targetName })
							}),
							(0, react_jsx_runtime.jsx)("input", {
								className: DirectoryBrowser_module_css_default.createInput,
								value: folderDraft ?? "",
								"aria-label": t("browser.folderName"),
								placeholder: t("browser.untitledFolder"),
								"data-modal-autofocus": true,
								disabled: creatingFolder,
								onChange: (event) => {
									setFolderDraft(event.target.value);
								},
								...compositionGuard,
								onKeyDown: (event) => {
									if (event.key === "Enter" && !composingRef.current) {
										event.preventDefault();
										confirmCreate();
									}
									if (event.key === "Escape") {
										event.stopPropagation();
										if (!creatingFolder) setFolderDraft(null);
									}
								}
							}),
							createError !== null && (0, react_jsx_runtime.jsx)("div", {
								className: DirectoryBrowser_module_css_default.error,
								role: "alert",
								children: createError
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: DirectoryBrowser_module_css_default.createActions,
								children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									disabled: creatingFolder,
									onClick: () => {
										setFolderDraft(null);
									},
									children: t("browser.cancel")
								}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "primary",
									disabled: creatingFolder || folderDraft === null || folderDraft.trim() === "",
									onClick: confirmCreate,
									children: t("browser.create")
								})]
							})
						]
					})
				})]
			});
		}
      /* ---- vendored body ends ---- */
      return DirectoryBrowser
    })()


    /* ==================== directory-picker capability ================== */

    // The host composes exactly ONE picking backend
    // (@deepseek-ai/dsh-host-directory-picker-auto): a loopback-only bind on a
    // display-bearing host gets `native` (the OS chooser), every other bind
    // (LAN, SSH, headless — and this WSL box, which has no zenity/kdialog) gets
    // `browse`, whose wire verbs are list/createDirectory only and whose `pick`
    // is refused BY DESIGN. Probe once per page so the flow can choose between
    // the OS chooser and the vendored browser instead of hard-assuming either.
    const pickerState = { kind: 'unknown', probe: null, api: null }
    /**
     * True for the refusal a Host serving the OTHER capability throws: the wire
     * code when the caller still carries it, the Host's fixed sentence
     * otherwise (uiWorkspace.pickDirectory wraps the RPC failure in a plain
     * Error, so the code is gone by the time the flow sees it).
     */
    const pickerRefusal = (error) => {
      if (error && typeof error === 'object' && error.rpcError
        && error.rpcError.code === 'directory-picker/unavailable') return true
      const message = messageOf(error)
      return message.indexOf('needs the native capability') !== -1
        || message.indexOf('directory-picker/unavailable') !== -1
    }
    /** Resolve which backend this page's Host composes (list succeeds on browse only). */
    const pickerCapabilityNow = () => {
      if (pickerState.kind !== 'unknown') return Promise.resolve(pickerState.kind)
      if (pickerState.probe !== null) return pickerState.probe
      const api = pickerState.api
      if (!api || typeof api.listDirectory !== 'function') return Promise.resolve('unknown')
      const probe = Promise.resolve()
        .then(() => api.listDirectory(undefined, undefined))
        .then(
          () => 'browse',
          (error) => (pickerRefusal(error) ? 'native' : 'unknown'),
        )
      pickerState.probe = probe.then((kind) => {
        if (kind === 'unknown') { pickerState.probe = null; return kind }
        pickerState.kind = kind
        return kind
      })
      return pickerState.probe
    }
    /** Commit a browse verdict the flow discovered the hard way (a refused pick). */
    const markPickerBrowse = () => {
      pickerState.kind = 'browse'
      pickerState.probe = Promise.resolve('browse')
    }

    /* ====================== add-workspace flow ======================== */

    /**
     * The vendored official browser is bound to its own locale namespace
     * ("directory-browser"); this seat is bound to ours. One table maps the keys
     * it asks for onto the keys this plugin ships, so the shared dictionary
     * (21 languages) drives the dialog without a second locale registration.
     */
    const PICK_LABEL_KEYS = {
      'browser.title': 'browse.title',
      'browser.home': 'browse.home',
      'browser.newFolder': 'browse.newFolder',
      'browser.folderName': 'browse.folderName',
      'browser.showHidden': 'browse.showHidden',
      'browser.loading': 'browse.loading',
      'browser.truncated': 'browse.truncated',
      'browser.editPath': 'browse.editPath',
      'browser.open': 'browse.open',
      'browser.create': 'create',
      'browser.createIn': 'browse.createIn',
      'browser.untitledFolder': 'browse.untitledFolder',
      'browser.cancel': 'cancel',
    }
    const pickTranslator = (t) => (key, params) => {
      const mapped = PICK_LABEL_KEYS[key]
      return mapped === undefined ? key : t(mapped, params)
    }

    /**
     * Add one real workspace from the sidebar toolbar.
     *
     * Step 1 is directory picking: the OS chooser when the Host composes
     * `native`, otherwise the vendored official browser driven here with our own
     * owner props. Step 2 (virtual model only) files the new workspace into a
     * virtual directory — one `wsDir` entry, the workspace title and path stay
     * exactly as the Host created them, which is the whole difference from the
     * upstream title-prefix model kept below for `useTree: false` installs.
     */
    function AddWorkspaceFlow(props) {
      const { open, initialParent, onCancel, onError, createWorkspace, renameWorkspace, pickDirectory, listDirectory, createDirectory, pickFolder, useStore, actions, t } = props
      const [phase, setPhase] = React.useState('picking') // picking | browsing | parent | submitting
      const [pickedPath, setPickedPath] = React.useState('')
      const [parentDirId, setParentDirId] = React.useState('')
      const [parentInput, setParentInput] = React.useState('')
      // All hooks before any early return: the flow unmounts while closed.
      const storeDirs = typeof useStore === 'function' ? (useStore(s => dirMapOf(s)) || {}) : {}
      const storeFolders = typeof useStore === 'function' ? (useStore(s => s.folders) || []) : {}
      const storeStyling = typeof useStore === 'function' ? (useStore(s => s.styling) || {}) : {}
      const storeWsDir = typeof useStore === 'function' ? (useStore(s => wsDirMapOf(s)) || {}) : {}
      const storeUseTree = typeof useStore === 'function' ? useStore(s => s.useTree !== false) : true
      const virtualMode = storeUseTree !== false
      const shared = makeSharedWrites(actions, storeStyling, storeFolders, storeDirs, storeWsDir)

      const primeParent = () => {
        setParentInput(initialParent)
        setParentDirId(virtualMode && storeDirs[initialParent] ? initialParent : '')
      }

      React.useEffect(() => {
        if (!open) {
          setPhase('picking')
          setPickedPath('')
          setParentDirId('')
          setParentInput('')
          return undefined
        }
        let alive = true
        setPhase('picking')
        // Preference order: the operating system's own dialog (best on a WSL
        // Host — it can browse the whole Windows drive tree), then whatever the
        // Host composed (native chooser), then the vendored in-app browser.
        Promise.resolve()
          .then(() => (typeof pickFolder === 'function' ? pickFolder() : { status: 'unavailable' }))
          .then((result) => {
            if (!alive) return undefined
            if (result && result.status === 'picked' && typeof result.path === 'string' && result.path !== '') {
              setPickedPath(String(result.path))
              primeParent()
              setPhase('parent')
              return undefined
            }
            if (result && result.status === 'cancelled') { onCancel(); return undefined }
            // A pick can be dropped AFTER the operator chose (the Host could not
            // turn the answer into a visible path: console-encoding mojibake, an
            // unmounted drive, a UNC target). Fall back to the in-app browser —
            // but say why, so a vanished selection is diagnosable instead of
            // looking like the click did nothing.
            if (result && result.status === 'unavailable') {
              console.warn(
                '[dsh-better-workspace] OS folder picker unavailable; falling back:',
                result.reason || 'unknown',
                result.detail || '',
              )
            }
            return pickerCapabilityNow()
              .then((kind) => {
                if (!alive) return undefined
                if (kind === 'browse') { setPhase('browsing'); return undefined }
                return Promise.resolve()
                  .then(() => pickDirectory())
                  .then((path) => {
                    if (!alive) return
                    if (!path) { onCancel(); return }
                    setPickedPath(String(path))
                    primeParent()
                    setPhase('parent')
                  })
              })
          })
          .catch((reason) => {
            if (!alive) return
            if (pickerRefusal(reason)) { markPickerBrowse(); setPhase('browsing'); return }
            setPhase('picking')
            onError(messageOf(reason))
          })
          .then(() => undefined)
        return () => { alive = false }
      }, [open])



      const acceptPath = (path) => {
        setPickedPath(String(path))
        primeParent()
        setPhase('parent')
      }

      const confirm = () => {
        if (phase === 'submitting') return
        setPhase('submitting')
        if (virtualMode) {
          const dirId = parentDirId !== '' && storeDirs[parentDirId] ? parentDirId : ''
          Promise.resolve()
            .then(() => createWorkspace({ path: pickedPath }))
            .then((workspace) => {
              if (dirId !== '' && workspace && workspace.workspaceId) {
                shared.wsAssign(workspace.workspaceId, dirId)
                if (actions && typeof actions.setExpanded === 'function') actions.setExpanded(dirId, true)
              }
              onCancel()
            })
            .catch((reason) => { onError(messageOf(reason)); onCancel() })
          return
        }
        const prefix = normPath(parentInput)
        const base = basename(pickedPath)
        const fullTitle = prefix !== '' ? prefix + '/' + base : base
        Promise.resolve()
          .then(() => createWorkspace({ path: pickedPath }))
          .then(async (workspace) => {
            try {
              await renameWorkspace(workspace.workspaceId, fullTitle)
            } catch (renameError) {
              onError(messageOf(renameError))
              onCancel()
              return
            }
            if (prefix !== '') shared.addFolder(prefix)
            onCancel()
          })
          .catch((reason) => { onError(messageOf(reason)); onCancel() })
      }

      if (!open) return null
      if (phase === 'browsing') {
        return E(OfficialDirectoryBrowser, {
          open: true,
          busy: false,
          listDirectory,
          createDirectory,
          onOpen: acceptPath,
          onClose: onCancel,
          t: pickTranslator(t),
        })
      }
      if (phase !== 'parent' && phase !== 'submitting') return null

      const dirOptions = (() => {
        if (!virtualMode) return []
        const out = []
        const walk = (parentId) => {
          for (const dir of childDirsOf(storeDirs, parentId)) {
            out.push({ id: dir.id, path: dirPathOf(storeDirs, dir.id) })
            walk(dir.id)
          }
        }
        walk(ROOT_DIR)
        return out
      })()

      const submitting = phase === 'submitting'
      const body = E('div', { className: 'bw-modal-body' },
        E('div', { className: 'bw-field' },
          t('flow.picked'),
          E('div', { className: 'bw-path-echo' }, pickedPath),
        ),
        virtualMode
          ? E('div', { className: 'bw-field' },
            t('flow.parentDir'),
            E('select', {
              className: 'bw-input bw-select',
              value: parentDirId,
              disabled: submitting,
              onChange: (e) => setParentDirId(e.target.value),
            },
              E('option', { value: '' }, t('dir.rootLevel')),
              dirOptions.map((option) => E('option', { key: option.id, value: option.id }, option.path)),
            ),
            E('div', { className: 'bw-hint' }, t('flow.parentDirHint')),
          )
          : E('div', { className: 'bw-field' },
            t('flow.parent'),
            E('div', { className: 'bw-dialog-input-row' },
              E('input', {
                className: 'bw-input',
                value: parentInput,
                autoFocus: true,
                placeholder: 'web/frontend',
                disabled: submitting,
                onChange: (e) => setParentInput(e.target.value),
                onKeyDown: (e) => { if (e.key === 'Enter') confirm() },
              }),
            ),
            E('div', { className: 'bw-hint' }, t('flow.parentHint')),
          ),
      )
      const footer = E('div', { className: 'bw-modal-actions' },
        E(BTN, { variant: 'outline', onClick: onCancel, disabled: submitting }, t('cancel')),
        E(BTN, { variant: 'primary', onClick: confirm, disabled: submitting }, submitting ? t('flow.creating') : t('create')),
      )
      return E(ui.Modal, { open: true, onClose: () => { if (!submitting) onCancel() }, closeLabel: t('close'), title: t('flow.title'), footer }, body, StyleNode())
    }

    /* ============================== rows ============================== */

    /** Folder glyph variants from the primitives family (solid / outline / hidden). */
    /**
     * Custom icon value → glyph: legacy slots (solid/outline/none) or any
     * primitives icon name, resolved through ICON_ALIASES so a value persisted
     * before a host renamed its icon set still renders something.
     */
    const iconOf = (mode, expanded) => {
      if (!mode || mode === 'none') return null
      if (mode === 'solid') return icon(expanded ? 'IconFolderOpenOutlineRegular' : 'IconFolderCloseRegular')
      if (mode === 'outline') return icon('IconFolderOpenOutlineRegular')
      return icon(resolveIconName(mode))
    }

    const colorToRgb = (hex) => {
      if (!hex) return null
      const m = /^#?([0-9a-fA-F]{6})$/.exec(hex)
      if (!m) return null
      const v = parseInt(m[1], 16)
      return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
    }
    const rgbToHex = (r, g, b) => '#' + [r, g, b]
      .map(n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0'))
      .join('')

    /* ------------------- appearance: defaults + outline ------------------- */

    // Text outline. Width and color are DERIVED, never hand-picked: an outline
    // only helps when it contrasts with the label, and the label color is
    // whatever the theme — or a background plugin's light/dark switch — hands
    // us at that moment. contrastStrokeColor() reads the effective font color
    // and returns the opposite pole; rows without a custom color inherit
    // --bw-stroke-color, sampled from the live computed style (see the sampler
    // in BetterBrowser) so a palette flip needs no React render.
    // The slider is the rim the eye actually sees (0.5..2px). strokeStyleOf
    // paints twice that because paint-order hides the inner half of the band.
    const STROKE_MAX = 2
    // The outline color defaults to a plain gray: it reads on light and dark
    // backgrounds alike without shouting like pure black/white. "auto" derives
    // the contrasting pole from the font color instead.
    const DEFAULT_APPEARANCE = { color: '', glow: 0, weight: 0, shadow: false, stroke: true, strokeWidth: 1, strokeColor: '#808080' }
    const APPEARANCE_FIELDS = ['color', 'glow', 'weight', 'shadow', 'stroke', 'strokeWidth', 'strokeColor']
    const clampStrokeWidth = (raw) => {
      const n = Number(raw)
      if (!isFinite(n) || n <= 0) return DEFAULT_APPEARANCE.strokeWidth
      return Math.min(STROKE_MAX, Math.max(0.5, Math.round(n * 2) / 2))
    }
    // Persisted values arrive from older plugin versions and from the other
    // surface: every read tolerates missing keys and falls back to the default
    // (hydration replaces state wholesale — the 0.9.x hard rule).
    const readAppearance = (raw) => {
      const src = raw && typeof raw === 'object' ? raw : {}
      return {
        color: typeof src.color === 'string' ? src.color : '',
        glow: Math.max(0, Number(src.glow) || 0),
        weight: Number(src.weight) || 0,
        shadow: src.shadow === true,
        stroke: src.stroke !== false,
        strokeWidth: src.strokeWidth === undefined ? DEFAULT_APPEARANCE.strokeWidth : clampStrokeWidth(src.strokeWidth),
        strokeColor: typeof src.strokeColor === 'string' && src.strokeColor !== '' ? src.strokeColor : DEFAULT_APPEARANCE.strokeColor,
      }
    }
    // A row's own entry overrides the default appearance FIELD BY FIELD, so a
    // row customized before this version (no stroke key) still inherits the new
    // default outline instead of losing it.
    const mergeAppearance = (base, entry) => {
      if (!entry || typeof entry !== 'object') return readAppearance(base)
      const merged = { ...base }
      for (const field of APPEARANCE_FIELDS) {
        if (entry[field] !== undefined) merged[field] = entry[field]
      }
      return readAppearance(merged)
    }
    const parseCssColor = (css) => {
      const text = String(css || '')
      const rgb = /^rgba?\(\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)/.exec(text)
      if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
      const srgb = /^color\(srgb\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)/.exec(text)
      if (srgb) return [Number(srgb[1]) * 255, Number(srgb[2]) * 255, Number(srgb[3]) * 255]
      return null
    }
    const relativeLuminance = (rgb) => {
      const [r, g, b] = rgb.map((channel) => {
        const s = Math.max(0, Math.min(255, Number(channel) || 0)) / 255
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    // WCAG contrast against both poles: the outline takes whichever of black /
    // white stands out more from the label color.
    const contrastStrokeColor = (rgb) => {
      if (!rgb) return '#000000'
      const luminance = relativeLuminance(rgb)
      return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? '#000000' : '#ffffff'
    }
    const STROKE_FALLBACK = 'var(--bw-stroke-color, rgba(0,0,0,.75))'
    const STROKE_AUTO = 'auto'
    // A picked color wins; "auto" derives the contrasting pole from the row's
    // font color — computed in JS when the row carries one, read from the
    // sampled --bw-stroke-color variable otherwise (so a theme or background
    // plugin flip needs no render).
    const strokeColorOf = (appearance) => {
      const picked = appearance && typeof appearance.strokeColor === 'string' && appearance.strokeColor !== ''
        ? appearance.strokeColor
        : DEFAULT_APPEARANCE.strokeColor
      if (picked === STROKE_AUTO) {
        const rgb = appearance.color ? colorToRgb(appearance.color) : null
        return rgb ? contrastStrokeColor(rgb) : STROKE_FALLBACK
      }
      return colorToRgb(picked) ? picked : DEFAULT_APPEARANCE.strokeColor
    }
    // paint-order keeps the stroke UNDER the fill so the glyph does not thin out
    // — the whole point of an outer outline. The price is half the band:
    // -webkit-text-stroke centres it on the outline and the fill covers the inner
    // half, so the painted width must be TWICE the rim the slider promises.
    // Painting the configured value (0.10.x) left a 0.5px rim that antialiasing
    // blended away into a pale, uneven edge.
    //
    // 0.11.1 replaced this with eight offset glyph copies. It measured better and
    // looked worse: eight directions are only four diagonal samples, so every
    // slope and curve came out as a string of detached blocks instead of a filled
    // rim. A geometric stroke is continuous by construction — it really is a path
    // stroke — so the answer is to give it enough width to survive antialiasing,
    // not to fake it out of copies.
    const strokeStyleOf = (appearance) => {
      if (!appearance || appearance.stroke === false) return null
      return {
        WebkitTextStrokeWidth: clampStrokeWidth(appearance.strokeWidth) * 2 + 'px',
        WebkitTextStrokeColor: strokeColorOf(appearance),
        paintOrder: 'stroke fill',
      }
    }

    function FolderRow({ node, depth, expanded, onToggle, onContextMenu, dropInto, dropHalf, dragEvents, custStyle, iconMode, pulse, t }) {
      const total = countWorkspaces(node)
      const iconEl = iconOf(iconMode, expanded)
      // Hidden status dots breathe on the icon; with the icon hidden (mode
      // "none" or a missing primitive) the official StateDot stands in.
      const iconChild = pulse
        ? E(PulseGlow, { state: pulse }, iconEl || (typeof ui.StateDot === 'function' ? E(ui.StateDot, { state: pulse, size: 10 }) : null))
        : iconEl
      return E('div', {
        // `dropHalf` is the directory-reorder indicator (before/after the row),
        // `dropInto` the workspace-into-folder highlight; the two never show at
        // once because they come from different drag kinds.
        className: cls('bw-row', dropInto && 'bw-drop-into', dropHalf === 'before' && 'bw-drop-before', dropHalf === 'after' && 'bw-drop-after'),
        style: { paddingLeft: 4 + depth * 12, ...(custStyle || {}), ...(pulse ? { '--bw-pulse-color': PULSE_COLORS[pulse] || PULSE_COLORS.ongoing } : null) },
        onClick: onToggle,
        onContextMenu: onContextMenu,
        role: 'treeitem',
        'aria-expanded': expanded,
        ...(dragEvents || {}),
      },
        E('span', { className: cls('bw-chevron', expanded && 'bw-chevron-open') }, icon('IconTriangleRightFillRegular', 14)),
        E('span', { className: 'bw-row-icon' }, iconChild),
        // A row that already carries a custom label glow breathes in sync.
        E('span', { className: cls('bw-row-label', pulse && custStyle && custStyle.textShadow && 'bw-pulse-text') }, node.name),
        total > 0 ? E('span', { className: 'bw-row-count' }, String(total)) : null,
      )
    }

    function WorkspaceRow({ workspace, depth, count, sessionsOpen, onToggle, onStart, onContextMenu, currentInside, dropHalf, dragEvents, custStyle, iconMode, pulse, t }) {
      const iconEl = iconOf(iconMode, sessionsOpen)
      const iconChild = pulse
        ? E(PulseGlow, { state: pulse }, iconEl || (typeof ui.StateDot === 'function' ? E(ui.StateDot, { state: pulse, size: 10 }) : null))
        : iconEl
      return E('div', {
        className: cls('bw-row', currentInside && 'bw-row-current', currentInside && 'bw-ws-current', dropHalf === 'before' && 'bw-drop-before', dropHalf === 'after' && 'bw-drop-after'),
        style: { paddingLeft: 6 + depth * 12, ...(custStyle || {}), ...(pulse ? { '--bw-pulse-color': PULSE_COLORS[pulse] || PULSE_COLORS.ongoing } : null) },
        onClick: onToggle,
        onContextMenu: onContextMenu,
        role: 'treeitem',
        'aria-expanded': sessionsOpen,
        ...(dragEvents || {}),
      },
        E('span', { className: cls('bw-chevron', sessionsOpen && 'bw-chevron-open') }, icon('IconTriangleRightFillRegular', 14)),
        E('span', { className: 'bw-row-icon' }, iconChild),
        E('span', { className: cls('bw-row-label', pulse && custStyle && custStyle.textShadow && 'bw-pulse-text'), title: workspace.title || workspace.leaf }, workspace.leaf),
        count > 0 ? E('span', { className: 'bw-row-count' }, String(count)) : null,
        E('span', { className: 'bw-row-actions', onClick: (e) => e.stopPropagation() },
          withTip(E('button', { type: 'button', className: 'bw-icon-btn', 'aria-label': t('session.new'), onClick: (e) => { e.stopPropagation(); onStart() } }, icon('IconPlusOutlineRegular')), t('session.new')),
        ),
      )
    }

    // Official status priority: pending interaction > running > running
    // subagents > completed reminder; idle rows show no dot at all.
    const sessionStateOf = (row) => {
      if (!row) return null
      if (row.pending === 'approval' || row.pending === 'plan-review' || row.pending === 'question') return 'warning'
      if (row.running || row.subagents > 0) return 'ongoing'
      if (row.completed) return 'done'
      return null
    }

    /**
     * Status breathing light (preference-controlled, default ON): status dots
     * hidden by a collapse bubble outward to the nearest visible container
     * row. Workspace/folder rows breathe on their icon (drop-shadow glow in
     * the status color; a hidden/no icon falls back to the official StateDot);
     * session-group rows carry a breathing StateDot in front of the label.
     * Colors mirror the official dots: warning amber > ongoing blue > done
     * green, so the glow always matches the lamp it relays.
     */
    const PULSE_RANK = { warning: 3, ongoing: 2, done: 1 }
    const PULSE_COLORS = { warning: '#d29922', ongoing: '#5b8def', done: '#3fb950' }
    const pulseRank = (state) => (state ? (PULSE_RANK[state] || 0) : 0)

    /**
     * Trailing cell copy for a pending interaction, mirroring the shipped
     * browser: while the Agent waits for the operator the row's relative time
     * is replaced by a compact label ("待回答" / "待审批" / "计划待审"), so the
     * waiting state reads without parsing a colour.
     */
    const PENDING_LABEL_KEYS = {
      approval: 'status.compact.approval',
      'plan-review': 'status.compact.planReview',
      question: 'status.compact.answer',
    }

    function PulseGlow({ state, children }) {
      return E('span', {
        className: 'bw-pulse',
        style: { '--bw-pulse-color': PULSE_COLORS[state] || PULSE_COLORS.ongoing },
      }, children)
    }

    // RUNNING deliberately stays on the session row itself (its official ring
    // breathes blue there) and does NOT bubble outward — the user found the
    // ongoing relay noisy. Only pending-amber and done-green propagate.
    const relayStateOf = (row) => {
      const s = sessionStateOf(row)
      return s === 'ongoing' ? null : s
    }

    function SessionRow({ node, depth, current, onOpen, onContextMenu, now, dropHalf, dragEvents, custStyle, breathing, t }) {
      const state = sessionStateOf(node)
      const status = state === null ? null : {
        state,
        title: state === 'warning'
          ? t('status.' + (node.pending === 'plan-review' ? 'planReview' : node.pending))
          : state === 'ongoing'
            ? (node.running ? t('status.running') : t('status.subagents', { n: node.subagents }))
            : t('status.completed'),
        // Only the waiting states own the trailing cell; running and done keep
        // their relative time, exactly like the shipped browser.
        trailing: state === 'warning' && PENDING_LABEL_KEYS[node.pending]
          ? t(PENDING_LABEL_KEYS[node.pending])
          : undefined,
      }
      return E('div', {
        className: cls('bw-row', 'bw-session-row', current && 'bw-row-current', dropHalf === 'before' && 'bw-drop-before', dropHalf === 'after' && 'bw-drop-after'),
        style: { paddingLeft: 8 + depth * 12, ...(custStyle || {}) },
        onClick: () => onOpen(node.id),
        onContextMenu: onContextMenu,
        role: 'treeitem',
        ...(dragEvents || {}),
      },
        E('span', { className: 'bw-row-icon', title: status ? status.title : undefined },
          status && typeof ui.StateDot === 'function'
            ? (state === 'ongoing' && breathing
              // Running breathes blue ON the session row only (never relays);
              // the settings toggle covers this breathing too.
              ? E(PulseGlow, { state: 'ongoing' }, E(ui.StateDot, { state: status.state, size: 10 }))
              : E(ui.StateDot, { state: status.state, size: 10 }))
            : E('span', { className: 'bw-dot' }),
        ),
        E('span', { className: 'bw-row-label' }, node.leaf || node.title),
        node.hasActiveSchedule
          ? E('span', { className: 'bw-schedule-badge', role: 'img', 'aria-label': t('schedule.active'), title: t('schedule.active') }, icon('IconAlarmClockOutlineRegular', 14))
          : null,
        E('span', { className: 'bw-row-time', title: status && status.trailing ? status.title : undefined },
          status && status.trailing ? status.trailing : timeLabel(node.updatedAt, now, t)),
      )
    }

    /**
     * Session sub-group inside a workspace (same "/" convention on session
     * titles). Deliberately NOT styled like a workspace folder — no folder
     * icon, tertiary color — so a session level never reads as a workspace.
     */
    function SessionGroupRow({ name, depth, expanded, count, onToggle, onContextMenu, dropInto, dragEvents, custStyle, pulse, t }) {
      return E('div', {
        className: cls('bw-row', 'bw-sgroup-row', dropInto && 'bw-drop-into'),
        style: { paddingLeft: 10 + depth * 12, ...(custStyle || {}) },
        onClick: onToggle,
        onContextMenu: onContextMenu,
        role: 'treeitem',
        'aria-expanded': expanded,
        ...(dragEvents || {}),
      },
        E('span', { className: cls('bw-chevron', expanded && 'bw-chevron-open') }, icon('IconTriangleRightFillRegular', 14)),
        // Session groups have no icon slot: a collapsed group with hidden
        // status relays through a breathing official StateDot instead.
        pulse ? E(PulseGlow, { state: pulse }, typeof ui.StateDot === 'function' ? E(ui.StateDot, { state: pulse, size: 10 }) : null) : null,
        E('span', { className: 'bw-row-label' }, name),
        count > 0 ? E('span', { className: 'bw-row-count' }, String(count)) : null,
      )
    }

    /* --------------------- customization dialog ----------------------- */

    const SWATCHES = ['', '#5b8def', '#3fb950', '#d29922', '#f85149', '#a371f7', '#39c5cf', '#ec6cb9', '#ff9f45', '#6e7681']
    // Outline-color presets: gray (the default), black, white, brand blue — the
    // native picker next to them covers everything else, and "auto" derives the
    // contrasting pole from the font color.
    const STROKE_PRESETS = ['#808080', '#000000', '#ffffff', '#5b8def']
    const GLOW_MAX = 14
    const ICON_CHOICES = [
      'solid', 'outline', 'none',
      'IconProjectAddOutlineRegular', 'IconBranchOutlineRegular', 'IconArchiveOutlineRegular', 'IconCodeOutlineRegular',
      'IconDataOutlineRegular', 'IconGoalOutlineRegular', 'IconGlobeOutlineRegular', 'IconInspectOutlineRegular',
      'IconCopyOutlineRegular', 'IconLinkOutlineRegular', 'IconListPenOutlineRegular', 'IconChecklistOutlineRegular',
      'IconBrowseOutlineRegular', 'IconDownloadOutlineRegular', 'IconContextInjectionOutlineRegular',
      'IconCordisPluginOutlineRegular', 'IconApiOutlineRegular', 'IconAgentPresetOutlineRegular', 'IconEnhanceOutlineRegular',
      'IconSkillOutlineRegular', 'IconSparkleRegular', 'IconNewChatOutlineRegular',
      'IconCheckOutlineRegular', 'IconCheckOutlineRegular', 'IconChevronDownOutlineRegular', 'IconChevronLeftOutlineRegular',
      'IconChevronRightOutlineRegular', 'IconChevronUpOutlineRegular', 'IconCloseOutlineRegular', 'IconDarkOutlineRegular',
      'IconEditOutlineRegular', 'IconEllipsisOutlineRegular', 'IconFolderCloseRegular', 'IconFolderOpenOutlineRegular',
      'IconFolderOpenOutlineRegular', 'IconFullscreenOutlineRegular', 'IconLightOutlineRegular', 'IconLinkOutlineRegular',
      'IconLoadingOutlineRegular', 'IconPanelLeftOutlineRegular', 'IconPaperclipOutlineRegular', 'IconPersonalizationOutlineRegular',
      'IconPlayOutlineRegular', 'IconPauseOutlineRegular', 'IconPlusOutlineRegular', 'IconQuestionOutlineRegular',
      'IconQueueOutlineRegular', 'IconRefreshOutlineRegular', 'IconRefreshOutlineRegular', 'IconRightUpOutlineRegular',
      'IconSearchOutlineRegular', 'IconSendOutlineRegular', 'IconSettingsOutlineRegular',
      'IconSettingsOutlineRegular', 'IconShareOutlineRegular', 'IconStopFillRegular', 'IconThinkOutlineRegular',
      'IconThinkOutlineRegular', 'IconTrashOutlineRegular', 'IconUserOutlineRegular', 'IconWarningOutlineRegular',
      'IconLikeOutlineRegular', 'IconDislikeOutlineRegular', 'IconFollowsystemOutlineRegular',
      'IconAlarmClockOutlineRegular', 'IconClockOutlineRegular', 'IconDatabaseOutlineRegular',
      // Added with dsh 0.1.6-alpha.1 — absent on older hosts, where the picker
      // filters them out (see ICON_PICKER_CHOICES).
      'IconPaperPlaneOutlineRegular', 'IconShieldOutlineRegular', 'IconPlanOutlineRegular',
      'IconWrapLinesOutlineRegular', 'IconCompactOutlineRegular',
    ]

    /**
     * What the picker actually offers on THIS host: every legacy slot, plus the
     * primitives this page's icon module really exports, deduped by resolved
     * name so a retired alias can never double a cell. Computed once — the icon
     * module is fixed for the lifetime of the page.
     */
    const ICON_PICKER_CHOICES = (() => {
      const seen = new Set()
      return ICON_CHOICES.filter((mode) => {
        if (mode === 'solid' || mode === 'outline' || mode === 'none') return true
        const name = resolveIconName(mode)
        if (name === '' || seen.has(name)) return false
        seen.add(name)
        return true
      })
    })()

    /**
     * Appearance controls shared by the per-row dialog and the settings card's
     * "default appearance" section: color, glow, weight, shadow, the text
     * outline (on/off + width + color) and — where the row actually renders
     * one — the folder glyph. Since v0.10.1 the outline color is a normal
     * choice (presets + picker, gray by default); "auto" is the mode that
     * derives the contrasting pole from the effective font color, so a palette
     * flip keeps working without a re-render.
     */
    function AppearanceControls({ value, onChange, allowIcon, t }) {
      const appearance = readAppearance(value)
      const color = appearance.color || ''
      const glow = appearance.glow
      const weight = appearance.weight
      const shadow = appearance.shadow
      const stroke = appearance.stroke
      const strokeWidth = appearance.strokeWidth
      const strokeColor = appearance.strokeColor
      const iconMode = value && value.icon ? value.icon : 'solid'
      // The glyph this choice actually resolves to on THIS host: a value saved
      // before the host renamed its icon set still highlights a real cell.
      const activeGlyph = resolveIconName(iconMode)
      const patch = (next) => { if (typeof onChange === 'function') onChange(next) }
      const channels = colorToRgb(color)
      const setChannel = (index, raw) => {
        const n = Math.max(0, Math.min(255, parseInt(raw, 10) || 0))
        const base = channels || [0, 0, 0]
        const next = base.slice()
        next[index] = n
        patch({ color: rgbToHex(next[0], next[1], next[2]) })
      }
      const previewShadows = []
      if (glow > 0 && color) previewShadows.push('0 0 ' + glow + 'px ' + color)
      if (shadow) previewShadows.push('1px 1px 2px rgba(0,0,0,.85)')
      // The preview must show the REAL outline: with no custom color the pole
      // comes from the preview text's own computed color, so it reads correctly
      // in the current theme (including a background plugin's light/dark flip).
      const previewRef = React.useRef(null)
      React.useEffect(() => {
        const el = previewRef.current
        if (!el || typeof getComputedStyle !== 'function') return undefined
        const sample = () => {
          try {
            const rgb = parseCssColor(getComputedStyle(el).color)
            if (rgb) el.style.setProperty('--bw-stroke-color', contrastStrokeColor(rgb))
          } catch (error) { /* best effort: the CSS fallback stays in place */ }
        }
        sample()
        const poll = setInterval(sample, 1500)
        return () => clearInterval(poll)
      }, [color, stroke])
      const previewStroke = strokeStyleOf(appearance)
      return E('div', { className: 'bw-appearance' },
        E('div', { className: 'bw-field' },
          t('custom.color'),
          E('div', { className: 'bw-dialog-input-row' },
            SWATCHES.map((swatch) => E('button', {
              key: swatch || 'none',
              type: 'button',
              className: cls('bw-swatch', color === swatch && 'bw-swatch-active'),
              style: swatch === '' ? undefined : { background: swatch },
              'aria-label': swatch === '' ? t('custom.reset') : swatch,
              onClick: () => patch({ color: swatch }),
            })),
            E('input', {
              type: 'color',
              className: 'bw-color-input',
              value: color || '#5b8def',
              onChange: (e) => patch({ color: e.target.value }),
            }),
          ),
          E('div', { className: 'bw-rgb-row' },
            ['R', 'G', 'B'].map((label, index) => E('label', { key: label, className: 'bw-rgb-label' },
              label,
              E('input', {
                type: 'number',
                className: 'bw-rgb-input',
                min: 0,
                max: 255,
                value: channels ? channels[index] : '',
                placeholder: '—',
                onChange: (e) => setChannel(index, e.target.value),
              }),
            )),
          ),
        ),
        E('div', { className: 'bw-field' },
          t('custom.glow'),
          E('div', { className: 'bw-glow-row' },
            E('input', {
              type: 'range',
              className: 'bw-slider',
              min: 0,
              max: GLOW_MAX,
              step: 1,
              value: glow,
              'aria-label': t('custom.glow'),
              onChange: (e) => patch({ glow: Number(e.target.value) }),
            }),
            E('span', { className: 'bw-glow-value' }, glow === 0 ? t('custom.none') : glow + 'px'),
          ),
        ),
        E('div', { className: 'bw-field' },
          t('custom.weight'),
          E('div', { className: 'bw-seg' },
            [400, 500, 600, 700].map((wt) => E('button', {
              key: String(wt),
              type: 'button',
              className: cls('bw-seg-btn', weight === wt && 'bw-seg-btn-active'),
              onClick: () => patch({ weight: wt }),
            }, wt === 400 ? t('custom.weight.regular') : wt === 500 ? t('custom.weight.medium') : wt === 600 ? t('custom.weight.semibold') : t('custom.weight.bold'))),
          ),
        ),
        E('div', { className: 'bw-field' },
          t('custom.shadow'),
          E('div', { className: 'bw-seg' },
            E('button', { type: 'button', className: cls('bw-seg-btn', !shadow && 'bw-seg-btn-active'), onClick: () => patch({ shadow: false }) }, t('custom.none')),
            E('button', { type: 'button', className: cls('bw-seg-btn', shadow && 'bw-seg-btn-active'), onClick: () => patch({ shadow: true }) }, t('settings.on')),
          ),
        ),
        E('div', { className: 'bw-field' },
          t('custom.stroke'),
          E('div', { className: 'bw-seg' },
            E('button', { type: 'button', className: cls('bw-seg-btn', !stroke && 'bw-seg-btn-active'), onClick: () => patch({ stroke: false }) }, t('settings.off')),
            E('button', { type: 'button', className: cls('bw-seg-btn', stroke && 'bw-seg-btn-active'), onClick: () => patch({ stroke: true }) }, t('settings.on')),
          ),
          E('div', { className: 'bw-glow-row' },
            E('input', {
              type: 'range',
              className: 'bw-slider',
              min: 0.5,
              max: STROKE_MAX,
              step: 0.5,
              value: strokeWidth,
              'aria-label': t('custom.strokeWidth'),
              onChange: (e) => patch({ strokeWidth: Number(e.target.value) }),
            }),
            E('span', { className: 'bw-glow-value' }, strokeWidth + 'px'),
          ),
        ),
        E('div', { className: 'bw-field' },
          t('custom.strokeColor'),
          E('div', { className: 'bw-dialog-input-row' },
            E('button', {
              type: 'button',
              className: cls('bw-swatch', 'bw-swatch-wide', strokeColor === STROKE_AUTO && 'bw-swatch-active'),
              title: t('custom.strokeColor.auto'),
              onClick: () => patch({ strokeColor: STROKE_AUTO }),
            }, t('custom.strokeColor.auto')),
            STROKE_PRESETS.map((value) => E('button', {
              key: value,
              type: 'button',
              className: cls('bw-swatch', strokeColor === value && 'bw-swatch-active'),
              style: { background: value },
              'aria-label': value,
              title: value,
              onClick: () => patch({ strokeColor: value }),
            })),
            E('input', {
              type: 'color',
              className: 'bw-color-input',
              value: colorToRgb(strokeColor) ? strokeColor : DEFAULT_APPEARANCE.strokeColor,
              onChange: (e) => patch({ strokeColor: e.target.value }),
            }),
          ),
          E('div', { className: 'bw-hint' }, t('custom.stroke.hint')),
        ),
        allowIcon ? E('div', { className: 'bw-field' },
          t('custom.icon'),
          E('div', { className: 'bw-icon-grid' },
            ICON_PICKER_CHOICES.map((mode) => E('button', {
              key: mode,
              type: 'button',
              // A value saved before an alias flip still highlights the cell it
              // now resolves to, instead of leaving the grid with no selection.
              className: cls('bw-icon-cell',
                (iconMode === mode || (activeGlyph !== '' && resolveIconName(mode) === activeGlyph)) && 'bw-icon-cell-active'),
              title: mode === 'solid' ? t('custom.icon.solid') : (mode === 'outline' ? t('custom.icon.outline') : mode),
              'aria-label': mode === 'solid' ? t('custom.icon.solid') : (mode === 'outline' ? t('custom.icon.outline') : mode),
              onClick: () => patch({ icon: mode }),
            }, mode === 'none' ? E('span', { className: 'bw-icon-none' }) : iconOf(mode, false))),
          ),
        ) : null,
        E('div', { className: 'bw-field' },
          t('custom.preview'),
          E('div', {
            ref: previewRef,
            className: 'bw-preview',
            style: {
              color: color || undefined,
              fontWeight: weight > 0 ? weight : undefined,
              textShadow: previewShadows.length > 0 ? previewShadows.join(',') : undefined,
              ...(previewStroke || null),
            },
          },
            allowIcon ? E('span', { className: 'bw-preview-icon' }, iconOf(iconMode, true)) : null,
            E('span', { className: 'bw-preview-label' }, t('custom.preview.sample')),
          ),
        ),
      )
    }

    /**
     * Per-row appearance dialog: the shared controls plus the commit / reset
     * semantics. Committing exactly the default appearance (with the default
     * solid icon) clears the row's entry instead of pinning a redundant copy;
     * Reset removes the entry outright.
     */
    function CustomizeDialog({ open, initial, defaults, kind, onChange, onReset, onClose, t }) {
      // Icons render only for workspace / workspace-folder rows. Session rows
      // already carry the official status dot (pending/running/done) in the
      // leading slot, and session sub-group rows have no icon either — so the
      // icon grid is offered only where it actually displays.
      const allowIcon = kind === 'folder' || kind === 'workspace'
      const fallback = readAppearance(defaults)
      const [draft, setDraft] = React.useState(DEFAULT_APPEARANCE)
      React.useEffect(() => {
        if (!open) return
        const base = readAppearance(initial)
        setDraft({ ...base, icon: (initial && initial.icon) || 'solid' })
      }, [open, initial])
      if (!open) return null
      const unchanged = APPEARANCE_FIELDS.every((field) => draft[field] === fallback[field])
        && (!allowIcon || (draft.icon || 'solid') === 'solid')
      const commit = () => {
        const entry = {
          color: draft.color,
          glow: draft.glow,
          weight: draft.weight > 0 ? draft.weight : undefined,
          shadow: draft.shadow || undefined,
          stroke: draft.stroke,
          strokeWidth: draft.strokeWidth,
          ...(allowIcon ? { icon: draft.icon || 'solid' } : {}),
        }
        onChange(unchanged ? null : entry)
        onClose()
      }
      return E(ui.Modal, {
        open: true,
        onClose,
        closeLabel: t('close'),
        title: t('custom.title'),
        footer: E('div', { className: 'bw-modal-actions' },
          E(BTN, { variant: 'outline', onClick: () => { onReset(); onClose() } }, t('custom.reset')),
          E(BTN, { variant: 'primary', onClick: commit }, t('custom.done')),
        ),
      },
        E('div', { className: 'bw-modal-body' },
          E(AppearanceControls, {
            value: draft,
            onChange: (patch) => setDraft((prev) => ({ ...readAppearance(prev), ...patch, icon: prev.icon || 'solid' })),
            allowIcon,
            t,
          }),
        ),
        StyleNode(),
      )
    }

    /* ------------------------- settings page ------------------------- */

    // The desktop renderer serves the shell over the private dsh-app: scheme;
    // every other context (http/https) is the web profile.
    const IS_DESKTOP_SURFACE = typeof location !== 'undefined' && location.protocol === 'dsh-app:'

    function BetterWorkspaceSettings({ useStore, actions, t }) {
      const prefs = useStore ? (useStore(s => s.prefs) || {}) : {}
      const localStyling = useStore ? (useStore(s => s.styling) || {}) : {}
      const localFolders = useStore ? (useStore(s => s.folders) || []) : []
      const compactChains = prefs.compactChains !== false
      const statusPulse = prefs.statusPulse !== false
      // Default appearance: the base every row inherits unless it carries its
      // own per-row entry. The outline ships ON — text over a background image
      // is often unreadable without it.
      const appearance = readAppearance(prefs.appearance)
      const setPref = (key, value) => {
        if (actions && typeof actions.setPref === 'function') actions.setPref(key, value)
        scopeSet(key, value)
      }
      const setAppearance = (next) => setPref('appearance', readAppearance(next))
      // Manual cross-device sync state.
      const [syncMode, setSyncMode] = React.useState('overwrite')
      const [syncMsg, setSyncMsg] = React.useState(null)
      const snap = useHostScope()
      const host = hostPrefsOf(snap)
      const scopeLive = prefsScopeRef !== null
      const onPull = () => {
        if (host === null) { setSyncMsg(t('sync.empty')); return }
        if (syncMode === 'merge' && actions && typeof actions.mergeHost === 'function') actions.mergeHost(host)
        else if (actions && typeof actions.importHost === 'function') actions.importHost(host)
        else { setSyncMsg(t('sync.off')); return }
        setSyncMsg(t('sync.done'))
      }
      const onPush = () => {
        const folders = Array.isArray(localFolders) ? localFolders.slice() : []
        scopeSet('styling', localStyling)
        scopeSet('folders', folders)
        scopeSet('compactChains', prefs.compactChains !== false)
        scopeSet('statusPulse', prefs.statusPulse !== false)
        scopeSet('appearance', appearance)
        setSyncMsg(t('sync.done'))
      }
      const modeButton = (id, label) => E('button', {
        type: 'button',
        className: cls('bw-sync-mode', syncMode === id && 'bw-sync-mode-on'),
        'aria-pressed': syncMode === id,
        onClick: () => { setSyncMode(id); setSyncMsg(null) },
      }, label)
      const syncActionButton = (label, onClick, primary, disabled) => E('button', {
        type: 'button',
        className: cls('bw-sync-btn', primary && 'bw-sync-btn-primary'),
        disabled,
        onClick,
      }, label)
      return E('div', { className: 'bw-settings' },
        StyleNode(),
        E('div', { className: 'bw-setting-row' },
          E('div', { className: 'bw-setting-label' }, t('settings.compactChains')),
          E('button', {
            type: 'button',
            role: 'switch',
            'aria-checked': compactChains,
            'aria-label': t('settings.compactChains'),
            className: cls('bw-switch', compactChains && 'bw-switch-on'),
            onClick: () => { setPref('compactChains', !compactChains) },
          }, E('span', { className: 'bw-switch-thumb' })),
        ),
        E('div', { className: 'bw-hint' }, t('settings.compactChains.hint')),
        E('div', { className: 'bw-setting-row', style: { marginTop: 10 } },
          E('div', { className: 'bw-setting-label' }, t('settings.statusPulse')),
          E('button', {
            type: 'button',
            role: 'switch',
            'aria-checked': statusPulse,
            'aria-label': t('settings.statusPulse'),
            className: cls('bw-switch', statusPulse && 'bw-switch-on'),
            onClick: () => { setPref('statusPulse', !statusPulse) },
          }, E('span', { className: 'bw-switch-thumb' })),
        ),
        E('div', { className: 'bw-hint' }, t('settings.statusPulse.hint')),
        E('div', { className: 'bw-setting-label', style: { marginTop: 16 } }, t('settings.appearance')),
        E('div', { className: 'bw-hint' }, t('settings.appearance.hint')),
        E('div', { className: 'bw-appearance-box' },
          E(AppearanceControls, {
            value: appearance,
            onChange: (patch) => setAppearance({ ...appearance, ...patch }),
            allowIcon: false,
            t,
          }),
          E('div', { style: { marginTop: 10 } },
            E(BTN, { variant: 'outline', onClick: () => setAppearance(DEFAULT_APPEARANCE) }, t('settings.appearance.reset')),
          ),
        ),
        E('div', { className: 'bw-setting-label', style: { marginTop: 16 } }, t('sync.title')),
        E('div', { className: 'bw-hint' }, t('sync.desc')),
        E('div', { className: 'bw-sync-modes' },
          modeButton('overwrite', t('sync.mode.overwrite')),
          modeButton('merge', t('sync.mode.merge')),
        ),
        E('div', { className: 'bw-sync-actions' },
          syncActionButton(t(IS_DESKTOP_SURFACE ? 'sync.pull.web' : 'sync.pull.desktop'), onPull, true, !scopeLive || snap.status === 'loading'),
          syncActionButton(t('sync.push'), onPush, false, !scopeLive),
        ),
        syncMsg !== null ? E('div', { className: 'bw-hint' }, syncMsg)
          : (scopeLive ? null : E('div', { className: 'bw-hint' }, t('sync.off'))),
        scopeLive && snap.status === 'loading' ? E('div', { className: 'bw-hint' }, t('sync.loading')) : null,
      )
    }

    /* --------- settings → plug-ins card (accordion like official cards) --------- */

    function BetterWorkspacePluginCard({ useStore, actions, t }) {
      const [open, setOpen] = React.useState(false)
      const Chevron = ui.IconChevronDownOutline14
      return E('li', { className: cls('bw-plugin-card', open && 'bw-plugin-card-open') },
        E('button', {
          type: 'button',
          className: 'bw-plugin-head',
          'aria-expanded': open,
          'aria-label': (open ? t('settings.collapse') : t('settings.expand')) + ': ' + t('settings.title'),
          onClick: () => setOpen(!open),
        },
          E('span', { className: 'bw-plugin-headtext' },
            E('span', { className: 'bw-plugin-name' }, t('settings.title')),
            E('span', { className: 'bw-plugin-desc' }, t('settings.desc')),
          ),
          Chevron ? E(Chevron, { className: cls('bw-plugin-chevron', open && 'bw-plugin-chevron-open') }) : null,
        ),
        open ? E('div', { className: 'bw-plugin-body' },
          E(BetterWorkspaceSettings, { useStore, actions, t }),
        ) : null,
      )
    }

    /* ============================= browser ============================ */

    function BetterBrowser(props) {
      const {
        wide, expandSidebar,
        useSessions, useSessionPendingInteraction, useSessionStatus, useWorkspaces,
        useStore, actions,
        startSession, open, renameSession, forkSession, renameWorkspace, deleteWorkspace,
        archiveSession, createWorkspace, pickDirectory, listDirectory, createDirectory, pickFolder,
        insertWorkspaceBefore, insertSessionBefore,
        t,
      } = props

      if (typeof useWorkspaces !== 'function' || typeof useSessions !== 'function') {
        console.error('[dsh-better-workspace] standard snapshot hooks missing; browser renders nothing')
        return null
      }

      const items = useWorkspaces(s => s.items)
      const phase = useWorkspaces(s => s.phase)
      const archivedSessionIds = useWorkspaces(s => s.archivedSessionIds) || []
      const list = useSessions(s => s)
      // dsh 0.2: the ONE source of session UI status (running / pending
      // interaction / completion unread). Both hooks are stable for the life of
      // a host, so the conditional call order never changes between renders; a
      // 0.1 host simply has the second one undefined and falls back to the first.
      const statuses = typeof useSessionStatus === 'function' ? useSessionStatus(s => s) : null
      const pending = useSessionPendingInteraction ? useSessionPendingInteraction(s => s) : null
      const storeFolders = useStore ? (useStore(s => s.folders) || []) : []
      // Virtual directory model (see buildTreeVirtual): explicit folder
      // records + a workspace→directory assignment map. `useTree` false keeps
      // the legacy title-prefix projection available as a fallback.
      const storeDirs = useStore ? (useStore(s => dirMapOf(s)) || {}) : {}
      /**
       * True when a row's `path` is a virtual directory id (not a title prefix).
       *
       * Declared HERE, beside the model it reads, and only here. The row
       * renderers (`renderPlainFolder` → `dirDropEvents`) call it on the very
       * first render that has a folder row, i.e. while the rest of this
       * component body is still executing — a declaration placed further down
       * (as in v0.2.0, next to the context menu) is therefore still in its
       * temporal dead zone, throws `Cannot access 'isVDir' before
       * initialization`, and the QuietBoundary silently degrades the WHOLE
       * sidebar tree to nothing (only when at least one folder row exists,
       * which is why an empty store never showed it).
       */
      const isVDir = (path) => !!(path && storeDirs && storeDirs[path])
      const storeWsDir = useStore ? (useStore(s => wsDirMapOf(s)) || {}) : {}
      // Root-level sequence (see orderRootEntries). Absent for states persisted
      // before this field existed — an empty list means the historical layout.
      const storeRootOrder = useStore ? (useStore(s => s.rootOrder) || EMPTY_ROOT_ORDER) : EMPTY_ROOT_ORDER
      const storeUseTree = useStore ? useStore(s => s.useTree !== false) : true
      const useTree = storeUseTree
      const expandedMap = useStore ? (useStore(s => s.expanded) || {}) : {}
      const sessionsExpandedMap = useStore ? (useStore(s => s.sessionsExpanded) || {}) : {}
      const sessionGroupsMap = useStore ? (useStore(s => s.sessionGroups) || {}) : {}
      // Per-workspace "…" reveal state. Absent ⇒ collapsed (see the store action).
      const recentExpandedMap = useStore ? (useStore(s => s.recentExpanded) || {}) : {}
      const prefsMap = useStore ? (useStore(s => s.prefs) || {}) : {}
      const stylingMap = useStore ? (useStore(s => s.styling) || {}) : {}
      const sessionOrderMap = useStore ? (useStore(s => s.sessionOrder) || {}) : {}
      // Dual-write wrappers: every preference mutation lands in the local
      // store (immediate echo + scope-less fallback) AND the host settings
      // store (durable cross-device copy for the manual pull on the other
      // surface). Computed from the CURRENT rendered values.
      const shared = makeSharedWrites(actions, stylingMap, storeFolders, storeDirs, storeWsDir)
      /**
       * Self-heal titles mangled by the early 0.1.0 build.
       *
       * That build still ran the UPSTREAM drag handler, so dropping a workspace
       * into a virtual directory called renameWorkspace with the directory ID
       * as the prefix — leaving e.g. "vdmu3jr9rg-1/mclanscopilot" as a real
       * workspace title. The bogus prefix is recognisable: it is one of OUR
       * directory ids, and a uuid-style id is never a legitimate title prefix.
       * So the repair is unambiguous — strip it and file the workspace into
       * that very directory, i.e. the assignment the drop intended.
       *
       * Runs once per mount through the OFFICIAL rename API: no restart, no
       * service stop, no hand-editing the registry file. Failures are left for
       * the next page load to retry.
       */
      const healedRef = React.useRef(false)
      React.useEffect(() => {
        if (healedRef.current) return
        healedRef.current = true
        const dirs = dirMapOf({ directories: storeDirs })
        const ids = Object.keys(dirs)
        if (ids.length === 0) return
        for (const ws of items || []) {
          const title = String(ws.title || '')
          const slash = title.indexOf('/')
          if (slash <= 0) continue
          const prefix = title.slice(0, slash)
          if (ids.indexOf(prefix) === -1) continue
          const real = title.slice(slash + 1)
          if (real === '') continue
          Promise.resolve()
            .then(() => renameWorkspace(ws.workspaceId, real))
            .then(() => {
              if (actions && typeof actions.assignWorkspace === 'function') actions.assignWorkspace(ws.workspaceId, prefix)
            })
            .catch((error) => {
              console.warn('[dsh-virtual-workspace] title repair failed for ' + ws.workspaceId, error)
            })
        }
        // Once per mount on purpose: `items` changes on every rename we issue
        // ourselves, so re-running would fight our own host round-trip.
      }, [])
      const compactChains = prefsMap.compactChains !== false
      const statusPulse = prefsMap.statusPulse !== false
      const archivedSet = React.useMemo(() => new Set(archivedSessionIds), [archivedSessionIds])
      // Which session is on screen — drives BOTH the session row's active pill
      // and the owning workspace row's highlight (0.2 hosts: retainedBy.mainView).
      const currentSessionId = currentSessionIdOf(list)
      const subCounts = React.useMemo(
        () => subagentRunningCounts(list ? list.byId : {}, statuses),
        [list ? list.byId : null, statuses],
      )
      // Last-known real titles for the cold-restart fallback window (see
      // the title-cache block). Read per render via getSnapshot: no
      // subscription, because a cache write only happens when summary.title
      // exists — at that moment the row already renders the wire truth and
      // no re-render is wanted.
      const remembered = (titleCacheRef && typeof titleCacheRef.getSnapshot === 'function')
        ? (titleCacheRef.getSnapshot().byId || {})
        : {}
      const rememberedTitleOf = (id) => (remembered[id] ? remembered[id].title : undefined)

      // Learn real titles from every snapshot: remember exactly what the
      // wire carried (summary.title), never displayTitle — that is already
      // basename-degraded in the very window this patches. Blank rows are
      // provisional New Sessions and never learn. One plain-object batch
      // call per snapshot (issue #1): unchanged scans cost one loop with
      // zero allocation, real changes schedule one debounced save.
      React.useEffect(() => {
        if (!list || !list.byId) return
        if (titleCacheRef && typeof titleCacheRef.rememberAllTitles === 'function') {
          titleCacheRef.rememberAllTitles(list)
        }
      }, [list ? list.byId : null])

      // Outline color sampler. The outline has to contrast with the LABEL
      // color, and the palette can flip (theme, or a background plugin's
      // light/dark switch) without any React render. So sample the tree's live
      // computed color into --bw-stroke-color: attribute mutations on
      // <html>/<body> catch class- and style-driven flips at once, and the slow
      // poll catches stylesheet-only rewrites (CSSOM variable swaps). Rows with
      // their own color compute the pole in JS and never read the variable.
      const treeRef = React.useRef(null)
      React.useEffect(() => {
        const el = treeRef.current
        if (!el || typeof getComputedStyle !== 'function') return undefined
        let stopped = false
        let pending = null
        const sample = () => {
          if (stopped) return
          try {
            const rgb = parseCssColor(getComputedStyle(el).color)
            if (rgb) el.style.setProperty('--bw-stroke-color', contrastStrokeColor(rgb))
          } catch (error) { /* best effort: the CSS fallback stays in place */ }
        }
        const schedule = () => {
          if (stopped || pending !== null) return
          pending = setTimeout(() => { pending = null; sample() }, 150)
        }
        sample()
        let observer = null
        if (typeof MutationObserver === 'function') {
          observer = new MutationObserver(schedule)
          try {
            observer.observe(document.documentElement, { attributes: true })
            if (document.body && document.body !== document.documentElement) observer.observe(document.body, { attributes: true })
          } catch (error) { /* observing is optional */ }
        }
        const poll = setInterval(sample, 1500)
        return () => {
          stopped = true
          if (pending !== null) clearTimeout(pending)
          clearInterval(poll)
          if (observer) observer.disconnect()
        }
      }, [])

      const [query, setQuery] = React.useState('')
      const [searchOpen, setSearchOpen] = React.useState(false)
      const [flowOpen, setFlowOpen] = React.useState(false)
      const [flowParent, setFlowParent] = React.useState('')
      const [dialog, setDialog] = React.useState(null) // { kind, ... }
      // Highlighted virtual directory (the row a click last selected). '' means
      // "no directory selected", matching ROOT_DIR.
      const [selectedDirId, setSelectedDirId] = React.useState('')
      const [ctx, setCtx] = React.useState(null) // context menu { kind, payload, x, y }
      const [customize, setCustomize] = React.useState(null) // { kind, entryKey, name }
      const [errorText, setErrorText] = React.useState(null)
      const [drag, setDrag] = React.useState(null) // { kind: 'workspace'|'session', source, over } | null
      // Workspace drags arm their state one frame LATE (see workspaceDragEvents):
      // arming synchronously re-renders during the dragstart dispatch, the chain
      // expansion inserts rows above the drag source, the cursor leaves the
      // source element, and Chromium cancels the whole gesture. dragEnd clears
      // the timer so a same-tick cancel never leaves a ghost drag behind.
      const wsDragArmTimer = React.useRef(null)
      // Same one-frame arming delay for virtual-directory drags (see
      // dirDropEvents): moving the dragged row during the very first frame
      // makes Chromium cancel the gesture.
      const dirDragArmTimer = React.useRef(null)
      // Quote-on-land eligibility sets (mount-scoped):
      // - blankSeen: ids observed BLANK in any snapshot. A blank row is a
      //   freshly created New Session, so ONLY these may ever receive an
      //   automatic quote. A titled row missing from blankSeen — rows that
      //   stream into the store after mount, fork children (born titled),
      //   rows hidden by load-time filtering — predates this mount or was
      //   named deliberately, and is NEVER touched. (0.9.1 keyed "fresh" off
      //   the first snapshot instead, so late-arriving OLD sessions were
      //   misquoted; blank is the only trustworthy birth mark.)
      // - humanTouched: ids renamed through THIS component's user actions
      //   (rename dialog, drag into a group, group prefix rewrite). A
      //   user-written "/" is a deliberate grouping; a user-written quote
      //   pair is the verbatim escape. The host pins user titles (a later
      //   automatic name is superseded), so the mark is final.
      // - autoStable: id → { title, since } for freshly landed automatic
      //   titles waiting out the stabilization window below.
      const blankSeenRef = React.useRef(null)
      const humanTouchedRef = React.useRef(null)
      const autoStableRef = React.useRef(null)
      const stableTimerRef = React.useRef(null)
      const [stableTick, setStableTick] = React.useState(0)
      // The wire cannot tell the deterministic fallback title (first user
      // message echo, "/"-prone) from the async LLM name that replaces it
      // seconds later — SessionSummary carries no source field. So a landed
      // "/"-bearing title is quoted only after it survives 20s unchanged;
      // any rename resets the window, and the common slash-free LLM name
      // simply releases the session untouched. Only the "new session
      // auto-title stayed slashy" case gets wrapped.
      const TITLE_STABLE_MS = 20000

      // User-driven renames funnel through here: mark first so the
      // quote-on-land effect never second-guesses a deliberate title.
      const renameByUser = (sessionId, title) => {
        if (humanTouchedRef.current === null) humanTouchedRef.current = new Set()
        humanTouchedRef.current.add(String(sessionId))
        if (autoStableRef.current) autoStableRef.current.delete(String(sessionId))
        return renameSession(sessionId, title)
      }

      React.useEffect(() => {
        if (!list || !list.byId || typeof renameSession !== 'function') return
        if (blankSeenRef.current === null) blankSeenRef.current = new Set()
        if (humanTouchedRef.current === null) humanTouchedRef.current = new Set()
        if (autoStableRef.current === null) autoStableRef.current = new Map()
        const blankSeen = blankSeenRef.current
        const touched = humanTouchedRef.current
        const stable = autoStableRef.current
        const now = Date.now()
        const fixes = []
        let deadline = Infinity
        for (const id of Object.keys(list.byId)) {
          const summary = list.byId[id]
          if (!summary) continue
          if (summary.blank) { blankSeen.add(id); stable.delete(id); continue }
          if (!blankSeen.has(id) || touched.has(id)) { stable.delete(id); continue }
          const text = String(summary.title || '')
          if (text.trim() === '' || text.includes('“') || text.includes('"') || !text.includes('/')) {
            stable.delete(id) // quoted already, or the LLM name arrived slash-free: done
            continue
          }
          const prev = stable.get(id)
          if (prev && prev.title === text) {
            if (now - prev.since >= TITLE_STABLE_MS) {
              stable.delete(id)
              fixes.push([id, '“' + text + '”'])
            } else {
              deadline = Math.min(deadline, prev.since + TITLE_STABLE_MS)
            }
            continue
          }
          stable.set(id, { title: text, since: now }) // new landing or fallback→LLM rename: reset
          deadline = Math.min(deadline, now + TITLE_STABLE_MS)
        }
        for (const id of Array.from(stable.keys())) {
          if (!list.byId[id]) stable.delete(id) // session vanished (archived/deleted): drop the wait
        }
        if (stableTimerRef.current !== null) { clearTimeout(stableTimerRef.current); stableTimerRef.current = null }
        if (deadline !== Infinity) {
          stableTimerRef.current = setTimeout(() => {
            stableTimerRef.current = null
            setStableTick(t => t + 1) // re-evaluate through the effect, never rename from a stale closure
          }, Math.max(1, deadline - now))
        }
        if (fixes.length === 0) return
        Promise.resolve()
          .then(async () => { for (const [id, next] of fixes) await renameSession(id, next) })
          .catch(() => { /* display-layer fallback keeps the row flat; a later snapshot re-evaluates */ })
      }, [list, stableTick])
      React.useEffect(() => () => {
        if (stableTimerRef.current !== null) clearTimeout(stableTimerRef.current)
      }, [])
      const normalizedQuery = query.trim().toLowerCase()
      const now = Date.now()

      const fail = (text) => { setFlowOpen(false); setDialog(null); setErrorText(String(text || 'unknown error')) }

      const styleEntry = (key) => stylingMap[key] || null
      // Effective appearance = the settings card's default, overridden field by
      // field by this row's own entry.
      const defaultAppearance = readAppearance(prefsMap.appearance)
      const appearanceOf = (key) => mergeAppearance(defaultAppearance, styleEntry(key))
      const rowStyleOf = (key) => {
        const appearance = appearanceOf(key)
        const color = appearance.color || ''
        const glow = Number(appearance.glow) || 0
        const weight = Number(appearance.weight) || 0
        const shadow = appearance.shadow === true
        const shadows = []
        if (glow > 0 && color) shadows.push('0 0 ' + glow + 'px ' + color)
        if (shadow) shadows.push('1px 1px 2px rgba(0,0,0,.85)')
        const style = {}
        if (color) style.color = color
        if (weight > 0) style.fontWeight = weight
        if (shadows.length > 0) style.textShadow = shadows.join(',')
        const stroke = strokeStyleOf(appearance)
        if (stroke) Object.assign(style, stroke)
        return Object.keys(style).length > 0 ? style : null
      }
      const keyOf = (kind, payload) => {
        if (kind === 'folder') return 'folder:' + payload.path
        if (kind === 'workspace') return 'workspace:' + payload.workspaceId
        if (kind === 'session') return 'session:' + payload.id
        if (kind === 'sgroup') return 'sgroup:' + payload.workspaceId + '|' + payload.path
        return String(kind)
      }

      const accounted = new Set()
      for (const workspace of items || []) for (const id of workspace.sessionIds || []) accounted.add(id)
      const ungrouped = []
      if (list && Array.isArray(list.ids)) {
        for (const id of list.ids) {
          const summary = list.byId[id]
          if (accounted.has(id) || !sessionVisible(summary, currentSessionId, archivedSet)) continue
          ungrouped.push({
            id,
            title: sessionTitleOf(summary, t, rememberedTitleOf(id)),
            leaf: sessionTitleOf(summary, t, rememberedTitleOf(id)),
            blank: !!summary.blank,
            // running / pending kind / completion unread, live status first
            // (see sessionFactsOf): the shipped dots and the waiting label.
            ...sessionFactsOf(statuses, pending, id, summary),
            hasActiveSchedule: hasActiveScheduleOf(summary),
            subagents: subCounts.get(id) || 0,
            updatedAt: summary.updatedAt || 0,
          })
        }
        ungrouped.sort((a, b) => b.updatedAt - a.updatedAt)
      }

      // While a workspace drag is active, single-child chains render UNCOMPRESSED:
      // a merged "group/workspace" row hides every folder level of the chain inside
      // its label, and those levels are exactly the drop targets for "move into
      // this group". Suspending the merge for the drag's duration re-exposes each
      // level as a real folder row (folder expansion defaults apply); when the
      // drag ends, the chains merge back. Session drags keep the merged view —
      // their drop targets live inside workspace rows, which compression merges.
      const draggingWorkspace = drag !== null && drag.kind === 'workspace'
      const tree = React.useMemo(() => {
        // Virtual tree first: directories are explicit records, so a folder
        // EXISTS whether or not it currently holds anything (no bootstrapping
        // through a real workspace needed).
        const built = buildTreeVirtual(items, storeDirs, storeWsDir, storeUseTree, storeRootOrder)
        if (useTree !== false) {
          // Chain compression is a display trick of the PREFIX model: a lone
          // "group/workspace" renders as one merged row, which would hide a
          // directory the user just created. Under the virtual model a folder
          // always renders as a folder, so compression stays off — it remains
          // available only on the legacy fallback path.
          return built
        }
        if (!compactChains || draggingWorkspace) return built
        return { ...built, folders: built.folders.map((f) => materializeChain(compressTree(f))), workspaces: built.workspaces }
      }, [items, storeDirs, storeWsDir, storeRootOrder, storeUseTree, storeFolders, compactChains, draggingWorkspace])

      /** Browser-local flat session order for one workspace (fallback channel). */
      const sessionOrderOf = (workspaceId) => {
        const map = sessionOrderMap && typeof sessionOrderMap === 'object' ? sessionOrderMap : {}
        const list = map[workspaceId]
        return Array.isArray(list) ? list : []
      }

      const sessionsOf = (workspace) => {
        const rows = []
        for (const id of workspace.sessionIds || []) {
          const summary = list && list.byId ? list.byId[id] : undefined
          if (!sessionVisible(summary, currentSessionId, archivedSet)) continue
          rows.push({
            id,
            title: sessionTitleOf(summary, t, rememberedTitleOf(id)),
            leaf: sessionTitleOf(summary, t, rememberedTitleOf(id)),
            blank: !!summary.blank,
            // running / pending kind / completion unread, live status first
            // (see sessionFactsOf): the shipped dots and the waiting label.
            ...sessionFactsOf(statuses, pending, id, summary),
            hasActiveSchedule: hasActiveScheduleOf(summary),
            subagents: subCounts.get(id) || 0,
            updatedAt: summary.updatedAt || 0,
          })
        }
        // Browser-local reorder fallback (dsh 0.1.6-alpha.1 stopped injecting
        // insertSessionBefore): the local flat order wins for the workspaces the
        // user dragged in, and is empty everywhere else — so a host that still
        // exposes the action keeps its authoritative order untouched.
        // Host order stays authoritative wherever the action exists.
        const local = typeof insertSessionBefore === 'function' ? [] : sessionOrderOf(workspace.workspaceId)
        if (local.length === 0) return rows
        const remaining = new Map(rows.map((row) => [row.id, row]))
        const out = []
        for (const id of local) {
          const row = remaining.get(id)
          if (row) { out.push(row); remaining.delete(id) }
        }
        for (const row of rows) if (remaining.has(row.id)) out.push(row)
        return out
      }

      const searchAgent = (agent) => {
        // Returns a pruned copy of the tree node, or null when nothing matches.
        if (!normalizedQuery) return agent
        if (agent.kind === 'ws') {
          const ws = agent.workspace
          const sessions = sessionsOf(ws)
          const wsHit = ws.leaf.toLowerCase().includes(normalizedQuery) || ws.title.toLowerCase().includes(normalizedQuery)
          if (wsHit || sessions.some(s => s.title.toLowerCase().includes(normalizedQuery))) {
            return { ...agent, node: agent, folders: [], workspaces: [ws] }
          }
          return null
        }
        const folders = []
        for (const folder of agent.folders) {
          const hit = searchAgent(folder)
          if (hit) folders.push(hit)
        }
        const workspaces = []
        for (const workspace of agent.workspaces) {
          const sessions = sessionsOf(workspace)
          const wsHit = workspace.leaf.toLowerCase().includes(normalizedQuery) || workspace.title.toLowerCase().includes(normalizedQuery)
          const matchedSessions = wsHit ? sessions : sessions.filter(s => s.title.toLowerCase().includes(normalizedQuery))
          if (wsHit || matchedSessions.length > 0) workspaces.push({ workspace, matchedSessions })
        }
        if (folders.length === 0 && workspaces.length === 0) return null
        return { node: agent, folders, workspaces }
      }
      const searched = normalizedQuery ? searchAgent(tree) : null
      const searching = normalizedQuery !== ''

      /* --------------------- status breathing relay -------------------- */

      // Highest-priority status across a whole session subtree (groups + rows).
      const nodePulseOf = (sessionNode) => {
        let best = null
        for (const group of sessionNode.groups || []) {
          const s = nodePulseOf(group)
          if (pulseRank(s) > pulseRank(best)) best = s
        }
        for (const row of sessionNode.sessions || []) {
          const s = relayStateOf(row)
          if (pulseRank(s) > pulseRank(best)) best = s
        }
        return best
      }
      // A COLLAPSED workspace row relays its whole session tree; an open row
      // shows the real dots (deeper collapsed groups relay on their own rows).
      const wsPulseOf = (workspace) => (!statusPulse || searching || sessionsOpenOf(workspace.workspaceId))
        ? null
        : nodePulseOf(buildSessionTree(sessionsOf(workspace)))
      // A collapsed FOLDER hides everything below — including open workspaces —
      // so its aggregation ignores inner expansion states entirely.
      const wsAllPulseOf = (workspace) => (!statusPulse || searching)
        ? null
        : nodePulseOf(buildSessionTree(sessionsOf(workspace)))
      const folderPulseOf = (node) => {
        if (node.kind === 'ws') return wsAllPulseOf(node.workspace)
        let best = null
        for (const child of node.folders) {
          const s = folderPulseOf(child)
          if (pulseRank(s) > pulseRank(best)) best = s
        }
        for (const w of node.workspaces) {
          const s = wsAllPulseOf(w)
          if (pulseRank(s) > pulseRank(best)) best = s
        }
        return best
      }

      const folderExpanded = (path) => (expandedMap ? expandedMap[path] !== false : true)
      const sessionsOpenOf = (workspaceId) => (sessionsExpandedMap ? sessionsExpandedMap[workspaceId] !== false : true)
      const sessionGroupOpen = (key) => (sessionGroupsMap ? sessionGroupsMap[key] !== false : true)

      /**
       * Collapse rule for a workspace's session list: show only what is BOTH
       * inside the recent window AND within the item cap — meeting EITHER
       * alone is not enough (a session bumped today still hides once the cap is
       * reached). The rest goes behind the "…" row, collapsed by default.
       *
       * Ordering is by recency, not by the stored display order, so the list is
       * deterministic and the revealed tail lands in the same order the head
       * uses (no reshuffle when it opens).
       */
      const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
      const RECENT_MAX = 5
      const sessionStamp = (value) => {
        const n = typeof value === 'number' ? value : Date.parse(value)
        return Number.isFinite(n) ? n : 0
      }
      const recentExpandedOf = (workspaceId) => (recentExpandedMap ? recentExpandedMap[workspaceId] === true : false)
      const splitRecentSessions = (rows, workspaceId) => {
        const cutoff = Date.now() - RECENT_WINDOW_MS
        const sorted = rows.slice().sort((a, b) => sessionStamp(b.updatedAt) - sessionStamp(a.updatedAt))
        const visible = []
        const hidden = []
        sorted.forEach((row, index) => {
          const fresh = sessionStamp(row.updatedAt) >= cutoff
          if (index < RECENT_MAX && fresh) visible.push(row)
          else hidden.push(row)
        })
        return { visible, hidden }
      }

      const openCtx = (kind, payload, e) => {
        if (e) e.preventDefault()
        setCtx({ kind, payload, x: e.clientX, y: e.clientY })
      }

      /* ------------------------- drag & drop -------------------------- */

      React.useEffect(() => {
        if (drag === null) return
        const accept = (event) => {
          event.preventDefault()
          if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
        }
        const acceptDrop = (event) => { event.preventDefault() }
        document.addEventListener('dragover', accept)
        document.addEventListener('drop', acceptDrop)
        return () => {
          document.removeEventListener('dragover', accept)
          document.removeEventListener('drop', acceptDrop)
        }
      }, [drag === null])

      const rowHalf = (event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
      }
      const dragMatches = (kind) => drag !== null && drag.kind === kind
      const canDragWorkspace = typeof insertWorkspaceBefore === 'function'
      // Session REORDER needs the host insertSessionBefore action; dragging a
      // session onto a sub-group row (a pure rename) stays available without it.
      // Session reorder keeps working either way: the host action is preferred
      // (authoritative, visible to every surface), while hosts that no longer
      // inject it — dsh 0.1.6-alpha.1 dropped insertSessionBefore from the
      // browser contract — fall back to the browser-local flat order.
      const canReorderSessions = true

      /* --------------------- workspace drag & drop -------------------- */

      /**
       * The root level's CURRENT display order, as orderRootEntries tokens.
       * Falls back to "directories, then workspaces" when the tree carries no
       * merged entry list (the legacy title-projection mode).
       *
       * Declared here, ABOVE every gesture handler that reads it: a helper
       * defined further down would be in its temporal dead zone for a handler
       * invoked during the very same render pass (see the `isVDir` note).
       */
      const rootTokensNow = () => {
        if (tree && Array.isArray(tree.entries)) {
          return tree.entries.map((entry) => (entry.kind === 'folder' ? 'dir:' + entry.node.path : 'ws:' + entry.workspace.workspaceId))
        }
        const out = []
        if (tree) {
          for (const folder of tree.folders) out.push('dir:' + folder.path)
          for (const workspace of tree.workspaces) out.push('ws:' + workspace.workspaceId)
        }
        return out
      }
      /**
       * Move one root-level token to sit immediately before/after another, and
       * persist the whole (MATERIALIZED) sequence — every root reorder writes
       * the complete list, so a later move never has to reason about which
       * entries were already listed. Returns false when the anchor is not part
       * of the root level (nothing is written then).
       */
      const moveRootToken = (sourceToken, targetToken, half) => {
        if (!sourceToken || !targetToken || sourceToken === targetToken) return false
        const tokens = rootTokensNow()
        if (!tokens.includes(targetToken)) return false
        const rest = tokens.filter((token) => token !== sourceToken)
        const at = rest.indexOf(targetToken)
        if (at === -1) return false
        const cut = at + (half === 'after' ? 1 : 0)
        shared.rootOrderSet(rest.slice(0, cut).concat([sourceToken], rest.slice(cut)))
        return true
      }
      const wsDropHalf = (workspaceId) => {
        if (!dragMatches('workspace')) return null
        const over = drag.over
        return over && over.kind === 'workspace' && over.target === workspaceId ? over.half : null
      }
      /** A row that belongs to the root level (not filed inside a directory). */
      const isRootLevelWorkspace = (workspace) => !(workspace && workspace.folderPath)
      /**
       * Before/after indicator while a DIRECTORY is dragged over a root-level
       * workspace row — the gesture that lets a directory sit below a
       * workspace (see orderRootEntries). Workspaces filed inside a directory
       * are not anchors: filing a directory into another directory stays the
       * "move to directory…" menu's job.
       */
      const dirWsDropHalf = (workspaceId, isRoot) => {
        if (!isRoot || !dragMatches('dir')) return null
        const over = drag.over
        return over && over.kind === 'rootws' && over.target === workspaceId ? (over.half || 'before') : null
      }
      /** Before/after indicator while a SIBLING directory is dragged over a folder row. */
      const dirDropHalf = (path) => {
        if (!dragMatches('dir')) return null
        if (drag && drag.source && drag.source.dirId === path) return null
        const over = drag.over
        return over && over.kind === 'folder' && over.target === path ? (over.half || 'before') : null
      }
      const wsDropInto = (path) => dragMatches('workspace') && drag.over && drag.over.kind === 'folder' && drag.over.target === path
      const workspaceDragEvents = (workspace) => ({
        draggable: !searching && canDragWorkspace,
        onDragStart: (event) => {
          if (searching || !canDragWorkspace) return
          event.stopPropagation()
          try {
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/plain', workspace.workspaceId)
          } catch { /* drag payload is best-effort */ }
          // Drag identity derives from the RAW title, never the displayed leaf:
          // a compressed single-chain row shows "group/workspace" as its leaf with
          // folderPath '' — carrying that would make move-into / cross-folder
          // drops rebuild titles like "x/group/workspace". The real leaf and
          // folder keep every drop target's rename correct.
          const segs = splitTitleSegs(workspace.title)
          const sourceLeaf = segs.length > 0 ? segs[segs.length - 1] : (workspace.leaf || String(workspace.workspaceId))
          const sourceFolder = segs.length > 1 ? segs.slice(0, -1).join('/') : ''
          // Deferred by one frame on purpose (Chromium cancels a just-started
          // drag whose source element is moved out from under the cursor; see
          // wsDragArmTimer above). By the next frame the gesture has settled
          // and the chain expansion is an ordinary mid-drag update.
          if (wsDragArmTimer.current !== null) clearTimeout(wsDragArmTimer.current)
          wsDragArmTimer.current = setTimeout(() => {
            wsDragArmTimer.current = null
            setDrag({ kind: 'workspace', source: { workspaceId: workspace.workspaceId, leaf: sourceLeaf, folderPath: sourceFolder }, over: null })
          }, 0)
        },
        onDragEnd: () => {
          if (wsDragArmTimer.current !== null) { clearTimeout(wsDragArmTimer.current); wsDragArmTimer.current = null }
          setDrag(null)
        },
        onDragOver: (event) => {
          if (dragMatches('dir')) {
            // A directory dragged over a ROOT-LEVEL workspace row: before/after
            // anchors that let the directory land below (or above) a real
            // workspace. See moveRootToken.
            if (!isRootLevelWorkspace(workspace)) return
            event.preventDefault()
            event.stopPropagation()
            try { event.dataTransfer.dropEffect = 'move' } catch { }
            const half = rowHalf(event)
            setDrag(current => (current && current.over && current.over.kind === 'rootws' && current.over.target === workspace.workspaceId && current.over.half === half)
              ? current
              : (current ? { ...current, over: { kind: 'rootws', target: workspace.workspaceId, half } } : current))
            return
          }
          if (!dragMatches('workspace')) return
          event.preventDefault()
          event.stopPropagation()
          try { event.dataTransfer.dropEffect = 'move' } catch { }
          const half = rowHalf(event)
          setDrag(current => (current && current.over && current.over.kind === 'workspace' && current.over.target === workspace.workspaceId && current.over.half === half)
            ? current
            : (current ? { ...current, over: { kind: 'workspace', target: workspace.workspaceId, half } } : current))
        },
        onDrop: (event) => {
          if (dragMatches('dir')) {
            if (!isRootLevelWorkspace(workspace)) return
            // Only a ROOT-LEVEL directory can be placed here: a nested
            // sub-directory moving up to the root level is a reparent gesture,
            // which the "move to directory…" menu owns (its own descendant
            // check included).
            const sourceDirId = drag.source && drag.source.dirId
            const sourceParent = (storeDirs[sourceDirId] && storeDirs[sourceDirId].parentId) || ''
            if (!sourceDirId || sourceParent !== ROOT_DIR) return
            event.preventDefault()
            event.stopPropagation()
            const half = drag.over && drag.over.kind === 'rootws' && drag.over.target === workspace.workspaceId ? drag.over.half : rowHalf(event)
            moveRootToken('dir:' + sourceDirId, 'ws:' + workspace.workspaceId, half)
            setDrag(null)
            return
          }
          if (!dragMatches('workspace')) return
          event.preventDefault()
          event.stopPropagation()
          const half = drag.over && drag.over.kind === 'workspace' && drag.over.target === workspace.workspaceId ? drag.over.half : rowHalf(event)
          commitWorkspaceDrop(workspace, half)
        },
      })
      const folderDropEvents = (path) => ({
        onDragOver: (event) => {
          if (!dragMatches('workspace')) return
          event.preventDefault()
          event.stopPropagation()
          try { event.dataTransfer.dropEffect = 'move' } catch { }
          setDrag(current => (current && current.over && current.over.kind === 'folder' && current.over.target === path)
            ? current
            : (current ? { ...current, over: { kind: 'folder', target: path } } : current))
        },
        onDrop: (event) => {
          if (!dragMatches('workspace')) return
          event.preventDefault()
          event.stopPropagation()
          commitWorkspaceMoveInto(path)
        },
      })

      /* ------------------- virtual directory reordering -------------------
       * A directory is movable exactly like a workspace: grab the row and drop
       * it on a sibling. Order is persisted per parent, and because the tree
       * sorts by `order` and only then falls back to the NAME (so equal orders
       * would silently re-sort alphabetically, making a move look like nothing
       * happened), every reorder renumbers the whole sibling list 0..n-1 to
       * match the display order. The renumber therefore runs on BOTH parents
       * whenever a drop changes the parent.
       */
      const siblingDirsOf = (dirId) => {
        const self = storeDirs[dirId]
        return childDirsOf(storeDirs, self ? (self.parentId || '') : '')
      }
      /**
       * Same-sibling order positions as they are currently displayed. The whole
       * renumbering is handed over as ONE batch (see shared.dirSetOrders): a
       * per-directory dirMove loop can neither express an order nor keep more
       * than its own last snapshot.
       */
      const reorderDir = (dirId, targetOrder) => {
        const next = reorderDirIds(storeDirs, dirId, targetOrder)
        if (!next) return
        shared.dirSetOrders(next)
      }
      /**
       * Drop a dragged directory before/after a sibling. `targetOrder` is the
       * index of the anchor in the CURRENT display list, so a drop "after" it
       * means that index + 1 (the source itself is excluded from the list the
       * pure helper rebuilds, so the index needs no further correction).
       */
      const commitDirReorder = (sourceId, targetId, half) => {
        if (!sourceId || !targetId || sourceId === targetId) return
        // A reorder only ever means "move among my own siblings". Dropping a
        // directory on a row of a DIFFERENT parent is not a reparent gesture
        // (the "move to directory…" menu owns that), and renumbering the
        // source list with an index taken from the target list would misplace
        // it. Ignore the drop instead of writing a wrong order.
        const sourceParent = (storeDirs[sourceId] && storeDirs[sourceId].parentId) || ''
        const targetParent = (storeDirs[targetId] && storeDirs[targetId].parentId) || ''
        if (sourceParent !== targetParent) return
        // The root level is governed by the root SEQUENCE — it is the only
        // ordering that can interleave directories with real workspaces — so a
        // root-level drop edits that sequence instead of the directories'
        // `order`. Nested levels have no workspaces of their own in the same
        // list position, so they keep ranking siblings by `order`.
        if (sourceParent === ROOT_DIR && moveRootToken('dir:' + sourceId, 'dir:' + targetId, half)) return
        const siblings = siblingDirsOf(targetId)
        const targetIndex = siblings.findIndex((d) => d.id === targetId)
        if (targetIndex === -1) return
        reorderDir(sourceId, half === 'after' ? targetIndex + 1 : targetIndex)
      }
      const dirDropEvents = (path) => ({
        draggable: !searching && isVDir(path),
        onDragStart: (event) => {
          if (!isVDir(path)) return
          event.stopPropagation()
          try {
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/plain', path)
          } catch { /* drag payload is best-effort */ }
          // Armed a frame late for the same reason workspace drags are: moving
          // the source row out from under the cursor cancels the gesture.
          if (dirDragArmTimer.current !== null) clearTimeout(dirDragArmTimer.current)
          dirDragArmTimer.current = setTimeout(() => {
            dirDragArmTimer.current = null
            setDrag({ kind: 'dir', source: { dirId: path }, over: null })
          }, 0)
        },
        onDragEnd: () => {
          if (dirDragArmTimer.current !== null) { clearTimeout(dirDragArmTimer.current); dirDragArmTimer.current = null }
          setDrag(null)
        },
        onDragOver: (event) => {
          // Two gestures land on a folder row: a workspace being filed INTO it
          // (handled below, upstream behaviour) and a sibling directory being
          // reordered around it.
          if (dragMatches('dir')) {
            if (drag && drag.source && drag.source.dirId === path) return
            event.preventDefault()
            event.stopPropagation()
            try { event.dataTransfer.dropEffect = 'move' } catch { }
            const half = rowHalf(event)
            setDrag(current => (current && current.over && current.over.kind === 'folder' && current.over.target === path && current.over.half === half)
              ? current
              : (current ? { ...current, over: { kind: 'folder', target: path, half } } : current))
            return
          }
          // Not a directory drag: the workspace-into-folder gesture keeps its
          // upstream handler verbatim instead of a second copy of it here.
          if (!dragMatches('workspace')) return
          folderDropEvents(path).onDragOver(event)
        },
        onDrop: (event) => {
          if (dragMatches('dir')) {
            event.preventDefault()
            event.stopPropagation()
            if (!drag || !drag.source || drag.source.dirId === path) return
            const half = drag.over && drag.over.kind === 'folder' && drag.over.target === path ? (drag.over.half || 'before') : rowHalf(event)
            commitDirReorder(drag.source.dirId, path, half)
            setDrag(null)
            return
          }
          if (!dragMatches('workspace')) return
          folderDropEvents(path).onDrop(event)
        },
      })
      const nextWorkspaceAfter = (folderPath, workspaceId) => {
        const node = findTreeNode(tree, folderPath)
        if (!node) return undefined
        const index = node.workspaces.findIndex(w => w.workspaceId === workspaceId)
        return index === -1 ? undefined : (node.workspaces[index + 1] ? node.workspaces[index + 1].workspaceId : undefined)
      }
      /**
       * Re-file a workspace that was dropped into a row.
       *
       * The two folder families need OPPOSITE handling, and conflating them is
       * what corrupted real workspace titles before:
       *   - a VIRTUAL directory (`isVDir`) is an id, so the move is a pure
       *     assignment — the title must NOT be touched;
       *   - a legacy prefix folder is text, so the upstream behaviour (rewrite
       *     the title prefix) is still the correct one there.
       * A target of '' means "the root level".
       */
      const moveWorkspaceTo = (workspaceId, leaf, folderId) => {
        const target = folderId || ''
        if (target === '' || isVDir(target)) {
          assignWorkspaceToDir(workspaceId, target)
          return Promise.resolve()
        }
        return Promise.resolve().then(() => renameWorkspace(workspaceId, target + '/' + leaf))
      }
      const commitWorkspaceDrop = (targetWorkspace, half) => {
        const source = drag.source
        setDrag(null)
        if (source.workspaceId === targetWorkspace.workspaceId) return
        const target = targetWorkspace.folderPath || ''
        const sameFolder = target === source.folderPath
        // Root-level drags edit the root SEQUENCE as well. The host's
        // insertWorkspaceBefore below stays authoritative for every other
        // surface, but once a sequence exists it — not the host order — decides
        // where a row sits on the root level, so skipping this would make a
        // workspace reorder look like it did nothing.
        if (target === ROOT_DIR) moveRootToken('ws:' + source.workspaceId, 'ws:' + targetWorkspace.workspaceId, half)
        const anchor = half === 'after'
          ? nextWorkspaceAfter(target, targetWorkspace.workspaceId)
          : targetWorkspace.workspaceId
        const chain = sameFolder
          ? Promise.resolve()
          : moveWorkspaceTo(source.workspaceId, source.leaf, target)
        chain
          .then(() => (anchor !== undefined ? insertWorkspaceBefore(source.workspaceId, anchor) : insertWorkspaceBefore(source.workspaceId)))
          .catch(fail)
      }
      const commitWorkspaceMoveInto = (folderPath) => {
        const source = drag.source
        setDrag(null)
        const target = folderPath || ''
        if ((source.folderPath || '') === target) return
        moveWorkspaceTo(source.workspaceId, source.leaf, target)
          .then(() => insertWorkspaceBefore(source.workspaceId))
          .catch(fail)
      }

      /* ---------------------- session drag & drop --------------------- */

      const sessDropHalf = (sessionId) => {
        if (!dragMatches('session')) return null
        const over = drag.over
        return over && over.kind === 'session' && over.target === sessionId ? over.half : null
      }
      const sgroupDropInto = (workspaceId, path) => dragMatches('session') && drag.over && drag.over.kind === 'sgroup' && drag.over.target === path
      const sessionDragEvents = (session, workspaceId) => ({
        draggable: !searching,
        onDragStart: (event) => {
          if (searching) return
          event.stopPropagation()
          try {
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/plain', session.id)
          } catch { }
          setDrag({ kind: 'session', source: { sessionId: session.id, workspaceId, title: session.title, leaf: session.leaf || session.title }, over: null })
        },
        onDragEnd: () => setDrag(null),
        onDragOver: (event) => {
          if (!dragMatches('session') || !canReorderSessions || drag.source.workspaceId !== workspaceId) return
          event.preventDefault()
          event.stopPropagation()
          try { event.dataTransfer.dropEffect = 'move' } catch { }
          const half = rowHalf(event)
          setDrag(current => (current && current.over && current.over.kind === 'session' && current.over.target === session.id && current.over.half === half)
            ? current
            : (current ? { ...current, over: { kind: 'session', target: session.id, half } } : current))
        },
        onDrop: (event) => {
          if (!dragMatches('session') || !canReorderSessions || drag.source.workspaceId !== workspaceId) return
          event.preventDefault()
          event.stopPropagation()
          const half = drag.over && drag.over.kind === 'session' && drag.over.target === session.id ? drag.over.half : rowHalf(event)
          commitSessionDrop(workspaceId, session.id, half)
        },
      })
      const sgroupDropEvents = (workspaceId, path) => ({
        onDragOver: (event) => {
          if (!dragMatches('session') || drag.source.workspaceId !== workspaceId) return
          event.preventDefault()
          event.stopPropagation()
          try { event.dataTransfer.dropEffect = 'move' } catch { }
          setDrag(current => (current && current.over && current.over.kind === 'sgroup' && current.over.target === path)
            ? current
            : (current ? { ...current, over: { kind: 'sgroup', target: path } } : current))
        },
        onDrop: (event) => {
          if (!dragMatches('session') || drag.source.workspaceId !== workspaceId) return
          event.preventDefault()
          event.stopPropagation()
          commitSessionMoveInto(workspaceId, path)
        },
      })
      const commitSessionDrop = (workspaceId, targetSessionId, half) => {
        const source = drag.source
        setDrag(null)
        if (!canReorderSessions) return
        if (source.sessionId === targetSessionId) return
        const workspace = (items || []).find(w => w.workspaceId === workspaceId)
        if (!workspace) return
        const flat = sessionsOf(workspace)
        const index = flat.findIndex(s => s.id === targetSessionId)
        const anchor = half === 'after'
          ? (index === -1 ? undefined : (flat[index + 1] ? flat[index + 1].id : undefined))
          : targetSessionId
        if (typeof insertSessionBefore === 'function') {
          Promise.resolve()
            .then(() => (anchor !== undefined ? insertSessionBefore(workspaceId, source.sessionId, anchor) : insertSessionBefore(workspaceId, source.sessionId)))
            .catch(fail)
          return
        }
        // Host channel gone: commit the same move into the browser-local order.
        if (actions && typeof actions.setSessionOrder === 'function') {
          actions.setSessionOrder(workspaceId, reorderIds(flat.map((s) => s.id), source.sessionId, anchor))
        }
      }
      const commitSessionMoveInto = (workspaceId, groupPath) => {
        const source = drag.source
        setDrag(null)
        const newTitle = groupPath !== '' ? groupPath + '/' + source.leaf : source.leaf
        if (newTitle === source.title) return
        Promise.resolve()
          .then(() => renameByUser(source.sessionId, newTitle))
          .catch(fail)
      }

      /* --------------------------- actions --------------------------- */

      /* ------------------- virtual directory actions -------------------
       * These NEVER touch a workspace title or path: a directory is its own
       * record, and attaching a workspace is one entry in the wsDir map. That
       * is the whole difference from the upstream prefix model.
       */
      /** Create a directory under `parentId` and reveal it (expand + select). */
      const createDir = (parentId, name) => {
        try {
          const id = shared.dirAdd(parentId, name)
          if (id && typeof actions.setExpanded === 'function') {
            if (parentId) actions.setExpanded(parentId, true)
            actions.setExpanded(id, true)
          }
          if (id) setSelectedDirId(id)
        } catch (error) { fail(error) }
      }
      const renameDir = (dirId, name) => {
        try { shared.dirRename(dirId, name) } catch (error) { fail(error) }
      }
      const removeDir = (dirId) => {
        try { shared.dirRemove(dirId) } catch (error) { fail(error) }
      }
      /** Attach a real workspace to a directory ('' ⇒ back to the root level). */
      const assignWorkspaceToDir = (workspaceId, dirId) => {
        try {
          shared.wsAssign(workspaceId, dirId)
          if (dirId && typeof actions.setExpanded === 'function') actions.setExpanded(dirId, true)
        } catch (error) { fail(error) }
      }

      const submitWorkspaceRename = (workspace, nextTitle) => {
        const title = String(nextTitle || '').trim()
        if (title === '' || title === workspace.title) { setDialog(null); return }
        Promise.resolve()
          .then(() => renameWorkspace(workspace.workspaceId, title))
          .then(() => setDialog(null))
          .catch(fail)
      }

      const submitWorkspaceDelete = (workspace) => {
        Promise.resolve()
          .then(() => deleteWorkspace(workspace.workspaceId))
          .then(() => setDialog(null))
          .catch(fail)
      }

      const submitSessionRename = (session, nextTitle) => {
        const title = String(nextTitle || '').trim()
        if (title === '' || title === session.title) { setDialog(null); return }
        Promise.resolve()
          .then(() => renameByUser(session.id, title))
          .then(() => setDialog(null))
          .catch(fail)
      }

      /** Rename one session sub-group: rewrite the title prefix of every member. */
      const submitSessionGroupRename = (target, rawName) => {
        const name = normPath(rawName)
        if (name === '') { setErrorText(t('folder.error.empty')); return }
        if (name === target.name) { setDialog(null); return }
        const workspace = (items || []).find(w => w.workspaceId === target.workspaceId)
        if (!workspace) { setDialog(null); return }
        const node = findSessionGroup(buildSessionTree(sessionsOf(workspace)), target.path)
        if (!node) { setDialog(null); return }
        const parentPath = target.path.includes('/') ? target.path.slice(0, target.path.lastIndexOf('/')) : ''
        const nextPath = parentPath !== '' ? parentPath + '/' + name : name
        const affected = collectSessionRows(node)
        Promise.resolve()
          .then(async () => {
            for (const row of affected) {
              if (row.blank) continue
              const nextTitle = nextPath + row.title.slice(target.path.length)
              await renameByUser(row.id, nextTitle)
            }
          })
          .then(() => setDialog(null))
          .catch(fail)
      }

      const findTreeNode = (node, path) => {
        if (node.path === path) return node
        for (const folder of node.folders) {
          const hit = findTreeNode(folder, path)
          if (hit) return hit
        }
        return null
      }

      const submitFolderNew = (parentPath, rawPath) => {
        const parent = normPath(parentPath)
        const sub = normPath(rawPath)
        if (sub === '') { setErrorText(t('folder.error.empty')); return }
        const p = parent !== '' ? parent + '/' + sub : sub
        // Existence check covers explicit folders AND every folder derived
        // from workspace titles, so "already exists" means either kind.
        const derived = new Set()
        for (const w of items || []) {
          const segs = splitTitleSegs(w.title)
          for (let i = 1; i < segs.length; i++) derived.add(segs.slice(0, i).join('/'))
        }
        if (storeFolders.includes(p) || derived.has(p)) { setErrorText(t('folder.error.exists')); return }
        shared.addFolder(p)
        setDialog(null)
      }

      const submitFolderRename = (oldPath, rawPath) => {
        const newPath = normPath(rawPath)
        if (newPath === '') { setErrorText(t('folder.error.empty')); return }
        if (newPath === oldPath) { setDialog(null); return }
        const node = findTreeNode(tree, oldPath)
        const hasChildren = node ? countWorkspaces(node) > 0 : false
        const prefix = oldPath + '/'
        const affected = hasChildren
          ? (items || []).filter(w => String(w.title || '').startsWith(prefix))
          : []
        Promise.resolve()
          .then(async () => {
            for (const w of affected) {
              const nextTitle = newPath + String(w.title).slice(oldPath.length)
              await renameWorkspace(w.workspaceId, nextTitle)
            }
          })
          .then(() => { shared.renameFolder(oldPath, newPath); setDialog(null) })
          .catch(fail)
      }

      const submitFolderDelete = (path) => {
        const node = findTreeNode(tree, path)
        if (node && countWorkspaces(node) > 0) { setErrorText(t('folder.error.notEmpty')); return }
        shared.removeFolder(path)
        setDialog(null)
      }

      /* ---------------------------- rows ----------------------------- */

      const renderSessionTree = (workspace, depth) => {
        // Folder semantics: a closed workspace shows no sessions at all (the
        // row keeps its count badge); an open one shows the full session tree.
        if (!searching && !sessionsOpenOf(workspace.workspaceId)) return []
        const rows = sessionsOf(workspace)
        if (rows.length === 0) return []
        // Searching is a lookup, not browsing: collapsing hits would hide the
        // very thing the user typed a query to find.
        if (searching) return renderSessionNode(buildSessionTree(rows), workspace.workspaceId, depth)
        const { visible, hidden } = splitRecentSessions(rows, workspace.workspaceId)
        const out = []
        if (visible.length > 0) out.push(...renderSessionNode(buildSessionTree(visible), workspace.workspaceId, depth))
        if (hidden.length > 0) {
          const open = recentExpandedOf(workspace.workspaceId)
          out.push(E('button', {
            key: 'more-' + workspace.workspaceId,
            type: 'button',
            className: 'bw-row bw-more-row',
            style: { paddingLeft: (8 + depth * 12) + 'px' },
            title: t('session.more.title', { n: hidden.length }),
            'aria-expanded': open ? 'true' : 'false',
            onClick: () => actions.setRecentExpanded(workspace.workspaceId, !open),
          },
            E('span', { className: 'bw-more-label' }, open ? t('session.more.less') : t('session.more', { n: hidden.length }))))
        }
        // The revealed tail keeps the SAME recency ordering the head uses, so
        // the list does not reshuffle when it opens.
        if (hidden.length > 0 && recentExpandedOf(workspace.workspaceId)) {
          out.push(...renderSessionNode(buildSessionTree(hidden), workspace.workspaceId, depth))
        }
        return out
      }
      const searchSessionNode = (node) => {
        const groups = []
        for (const group of node.groups) {
          const hit = searchSessionNode(group)
          if (hit) groups.push(hit)
        }
        const sessions = node.sessions.filter(s => ((s.leaf || s.title) + ' ' + s.title).toLowerCase().includes(normalizedQuery))
        if (groups.length === 0 && sessions.length === 0) return null
        return { path: node.path, name: node.name, groups, sessions }
      }
      const renderSessionNode = (node, workspaceId, depth) => {
        const view = searching ? searchSessionNode(node) : node
        if (!view) return []
        const out = []
        for (const group of view.groups) {
          const key = workspaceId + '|' + group.path
          const open = searching || sessionGroupOpen(key)
          out.push(E(SessionGroupRow, {
            key: 'sg-' + key,
            name: group.name,
            depth,
            expanded: open,
            pulse: (statusPulse && !open) ? nodePulseOf(group) : null,
            count: countSessionTree(group),
            onToggle: () => { if (!searching) actions.setSessionGroupExpanded(key, !open) },
            onContextMenu: (e) => openCtx('sgroup', { workspaceId, path: group.path, name: group.name }, e),
            dropInto: sgroupDropInto(workspaceId, group.path),
            dragEvents: sgroupDropEvents(workspaceId, group.path),
            custStyle: rowStyleOf('sgroup:' + workspaceId + '|' + group.path),
            t,
          }))
          if (open) out.push(...renderSessionNode(group, workspaceId, depth + 1))
        }
        for (const s of view.sessions) out.push(renderSessionRow(s, depth, workspaceId))
        return out
      }

      const renderSessionRow = (session, depth, workspaceId) => E(SessionRow, {
        key: session.id,
        node: session,
        depth,
        current: currentSessionId !== undefined && currentSessionId === session.id,
        now,
        onOpen: (id) => open(id),
        onContextMenu: (e) => openCtx('session', session, e),
        dropHalf: workspaceId ? sessDropHalf(session.id) : null,
        dragEvents: workspaceId ? sessionDragEvents(session, workspaceId) : undefined,
        custStyle: rowStyleOf('session:' + session.id),
        breathing: statusPulse,
        t,
      })

      const renderWorkspaceEntry = (entry, depth, pulse) => {
        const { workspace } = entry
        const count = countSessionTree(buildSessionTree(sessionsOf(workspace)))
        const rows = [E(WorkspaceRow, {
          key: 'ws-' + workspace.workspaceId,
          workspace,
          depth,
          count,
          sessionsOpen: searching ? true : sessionsOpenOf(workspace.workspaceId),
          currentInside: !!(currentSessionId && (workspace.sessionIds || []).includes(currentSessionId)),
          onToggle: () => { if (!searching) actions.setSessionsExpanded(workspace.workspaceId, !sessionsOpenOf(workspace.workspaceId)) },
          // Starting a session force-expands the workspace row: the user must
          // SEE the new session appear, even if the row was collapsed.
          onStart: () => { actions.setSessionsExpanded(workspace.workspaceId, true); startSession(workspace.workspaceId) },
          onContextMenu: (e) => openCtx('workspace', workspace, e),
          dropHalf: wsDropHalf(workspace.workspaceId) || dirWsDropHalf(workspace.workspaceId, isRootLevelWorkspace(workspace)),
          dragEvents: workspaceDragEvents(workspace),
          custStyle: rowStyleOf('workspace:' + workspace.workspaceId),
          iconMode: (styleEntry('workspace:' + workspace.workspaceId) || {}).icon || 'solid',
          pulse,
          t,
        })]
        rows.push(...renderSessionTree(workspace, depth + 1))
        return rows
      }

      const renderPlainFolder = (node, depth) => {
        if (node.kind === 'ws') return renderWorkspaceEntry({ workspace: node.workspace }, depth, wsPulseOf(node.workspace))
        const expanded = searching || folderExpanded(node.path)
        const rows = [E(FolderRow, {
          key: 'f-' + node.path,
          node,
          depth,
          expanded,
          onToggle: () => { if (!searching) actions.setExpanded(node.path, !expanded) },
          onContextMenu: (e) => openCtx('folder', { path: node.path, name: node.name }, e),
          dropInto: wsDropInto(node.path),
          dropHalf: dirDropHalf(node.path),
          // One handler set for both gestures on a folder row: filing a
          // workspace INTO it (upstream behaviour) and reordering a sibling
          // directory around it.
          dragEvents: dirDropEvents(node.path),
          custStyle: rowStyleOf('folder:' + node.path),
          iconMode: (styleEntry('folder:' + node.path) || {}).icon || 'solid',
          pulse: expanded ? null : folderPulseOf(node),
          t,
        })]
        if (expanded) {
          for (const child of node.folders) rows.push(...renderPlainFolder(child, depth + 1))
          for (const workspace of node.workspaces) rows.push(...renderWorkspaceEntry({ workspace }, depth + 1, wsPulseOf(workspace)))
        }
        return rows
      }
      const renderSearchedFolder = (hit, depth) => {
        if (hit.kind === 'ws') return renderWorkspaceEntry({ workspace: hit.workspace }, depth)
        const node = hit.node
        const rows = [E(FolderRow, {
          key: 'f-' + node.path,
          node,
          depth,
          expanded: true,
          onToggle: () => {},
          onContextMenu: (e) => openCtx('folder', { path: node.path, name: node.name }, e),
          dropInto: false,
          dragEvents: undefined,
          custStyle: rowStyleOf('folder:' + node.path),
          iconMode: (styleEntry('folder:' + node.path) || {}).icon || 'solid',
          t,
        })]
        for (const child of hit.folders) rows.push(...renderSearchedFolder(child, depth + 1))
        for (const entry of hit.workspaces) rows.push(...renderWorkspaceEntry(entry, depth + 1))
        return rows
      }

      let bodyRows = []
      if (searching) {
        if (searched) {
          for (const child of searched.folders) bodyRows.push(...renderSearchedFolder(child, 0))
          for (const entry of searched.workspaces) bodyRows.push(...renderWorkspaceEntry(entry, 0))
        }
      } else {
        // Root level: ONE merged sequence of directories and root-level
        // workspaces (see orderRootEntries), so a directory can sit below a
        // workspace. `tree.entries` exists in tree mode; the legacy title
        // projection keeps its historical "folders, then workspaces" shape.
        const rootEntries = (useTree !== false && Array.isArray(tree.entries))
          ? tree.entries
          : tree.folders.map((node) => ({ kind: 'folder', node })).concat(tree.workspaces.map((workspace) => ({ kind: 'workspace', workspace })))
        for (const entry of rootEntries) {
          if (entry.kind === 'workspace') bodyRows.push(...renderWorkspaceEntry({ workspace: entry.workspace }, 0, wsPulseOf(entry.workspace)))
          else bodyRows.push(...renderPlainFolder(entry.node, 0))
        }
        if (ungrouped.length > 0) {
          bodyRows.push(E('div', { key: 'ungrouped-label', className: 'bw-header-title', style: { padding: '10px 6px 2px' } }, t('group.ungrouped')))
          for (const s of ungrouped) bodyRows.push(renderSessionRow(s, 0))
        }
      }
      const isEmpty = bodyRows.length === 0
      if (isEmpty) {
        bodyRows = [E('div', { key: 'empty', className: 'bw-empty' }, searching ? t('empty.search') : (phase === 'pending' ? '…' : t('empty')))]
      }

      /* ------------------------- context menu ------------------------ */

      // `isVDir` lives with the rest of the virtual-directory model near the
      // top of this component body (see `storeDirs`): the row renderers reach
      // it through `dirDropEvents` BEFORE this point in the body runs, and a
      // `const` declaration this far down is still in its temporal dead zone
      // there — a ReferenceError that the QuietBoundary degrades into an EMPTY
      // sidebar (the v0.2.0 regression). Keep it declared once, up there.

      /**
       * Flat "move into directory" list for the context menu: every directory
       * in the tree, depth-first, ordered and labelled with its full path.
       * `excludeId` drops the moved subtree itself (a directory may not move
       * into its own descendant). When the workspace already sits somewhere,
       * a "root level" entry is prepended so it can be detached again.
       */
      const dirMenuItems = (excludeId, includeRoot) => {
        const out = []
        if (includeRoot) out.push({ id: 'ws-move-root', label: t('dir.rootLevel') })
        const walk = (parentId, depth) => {
          for (const dir of childDirsOf(storeDirs, parentId)) {
            if (excludeId && dir.id === excludeId) continue
            out.push({ id: 'ws-move:' + dir.id, label: '  '.repeat(depth) + String(dir.name || ''), dirId: dir.id })
            walk(dir.id, depth + 1)
          }
        }
        walk('', 0)
        return out
      }

      /**
       * The real host folder behind a workspace row, or '' when the registry
       * row has none. Workspace entries carry `path` (workspace registry) and
       * `leaf` (the basename the tree displays); only `path` is meaningful to
       * the operating system, so the two are never interchanged.
       */
      const wsPathOf = (workspace) => {
        const path = workspace && typeof workspace.path === 'string' ? workspace.path.trim() : ''
        return path === '' ? '' : path
      }

      /**
       * Folder-row menu. Virtual directories and legacy title-prefix folders
       * look alike but carry different `path` semantics, so the two families
       * are separated here: a vdir id gets the virtual-directory actions, a
       * prefix path keeps the upstream ones untouched.
       */
      const folderMenuItems = (path) => {
        if (isVDir(path)) {
          const items = [
            { id: 'dir-new-sub', label: t('menu.newSubfolder') },
            { id: 'new-subworkspace', label: t('menu.newSubWorkspace') },
            { id: 'dir-rename', label: t('menu.renameFolder') },
            { id: 'dir-move', label: t('dir.moveTo'), children: dirMenuItems(path, true) },
            { id: 'dir-delete', label: t('dir.delete.title'), danger: true },
            { sep: true },
            { id: 'customize', label: t('custom.title') },
          ]
          return items
        }
        const items = [
          { id: 'new-subfolder', label: t('menu.newSubfolder') },
          { id: 'new-subworkspace', label: t('menu.newSubWorkspace') },
          { id: 'rename-folder', label: t('menu.renameFolder') },
        ]
        if (storeFolders.includes(path)) items.push({ id: 'remove-folder', label: t('menu.removeFolder'), danger: true })
        items.push({ sep: true })
        items.push({ id: 'customize', label: t('custom.title') })
        return items
      }

      const ctxItems = () => {
        if (ctx === null) return []
        if (ctx.kind === 'folder') return folderMenuItems(ctx.payload.path)
        if (ctx.kind === 'workspace') {
          const ws = ctx.payload
          const items = [{ id: 'rename', label: t('menu.rename') }]
          // Host-side entries: the workspace folder as the operating system sees
          // it. Only offered when the registry row actually carries a path — a
          // workspace whose path never loaded would otherwise post an empty
          // string and fail with a message about nothing.
          if (wsPathOf(ws) !== '') {
            items.push({ id: 'ws-open-folder', label: t('menu.openWsFolder') })
            items.push({ id: 'ws-copy-path', label: t('menu.copyPath') })
          }
          // The entry the upstream plugin never had: file an EXISTING real
          // workspace into a virtual directory without renaming it. The
          // workspace keeps its title and its path — only the assignment map
          // changes, so nothing about the folder on disk is touched.
          const moves = dirMenuItems('', true)
          if (moves.length > 0) items.push({ id: 'ws-move', label: t('dir.moveTo'), children: moves })
          items.push({ id: 'delete', label: t('menu.delete'), danger: true })
          items.push({ sep: true })
          items.push({ id: 'customize', label: t('custom.title') })
          return items
        }
        if (ctx.kind === 'session') return [
          { id: 'rename', label: t('menu.rename') },
          { id: 'fork', label: t('menu.fork') },
          { id: 'archive', label: t('menu.archive'), danger: true },
          { sep: true },
          { id: 'customize', label: t('custom.title') },
        ]
        return [
          { id: 'rename-sgroup', label: t('menu.renameSgroup') },
          { sep: true },
          { id: 'customize', label: t('custom.title') },
        ]
      }
      const handleCtxPick = (id) => {
        const current = ctx
        if (current === null) return
        if (id === 'customize') {
          const payload = current.payload
          const name = current.kind === 'workspace' ? (payload.title || payload.leaf)
            : (current.kind === 'session' ? payload.title : payload.name)
          setCustomize({ kind: current.kind, entryKey: keyOf(current.kind, payload), name })
          setCtx(null)
          return
        }
        const { kind, payload } = current
        setCtx(null)
        /* ---- virtual directory actions (folder rows that are vdirs) ---- */
        if (id === 'dir-new-sub') { setDialog({ kind: 'dir-new', parentId: payload.path }); return }
        if (id === 'dir-rename') { setDialog({ kind: 'dir-rename', dirId: payload.path, name: payload.name }); return }
        if (id === 'dir-delete') { setDialog({ kind: 'dir-delete', dirId: payload.path, name: payload.name }); return }
        if (id.indexOf('dir-move:') === 0) { shared.dirMove(payload.path, id.slice('dir-move:'.length)); return }
        if (id === 'dir-move') { shared.dirMove(payload.path, ''); return }
        /* ---- move a real workspace between directories ---- */
        if (kind === 'workspace' && id === 'ws-move-root') { assignWorkspaceToDir(payload.workspaceId, ''); return }
        if (kind === 'workspace' && id.indexOf('ws-move:') === 0) { assignWorkspaceToDir(payload.workspaceId, id.slice('ws-move:'.length)); return }
        /* ---- the workspace folder as the OS sees it ---- */
        if (kind === 'workspace' && id === 'ws-open-folder') {
          const path = wsPathOf(payload)
          // The host launch outlives this handler and the reply only ever feeds
          // a notice, so a failure must not escape as an unhandled rejection.
          requestOpenFolder(path).catch((error) => { showNotice(messageOf(error), 'error') })
          return
        }
        if (kind === 'workspace' && id === 'ws-copy-path') {
          const path = wsPathOf(payload)
          if (path === '') { showNotice(t('path.none'), 'error'); return }
          copyText(path).then(() => { showNotice(t('path.copied')) }, (error) => { showNotice(messageOf(error), 'error') })
          return
        }
        /* ---- upstream title-prefix folder actions ---- */
        if (kind === 'folder' && id === 'new-subworkspace') { setFlowParent(payload.path); setFlowOpen(true) }
        else if (kind === 'folder' && id === 'new-subfolder') setDialog({ kind: 'folder-new', parentPath: payload.path })
        else if (kind === 'folder' && id === 'rename-folder') setDialog({ kind: 'folder-rename', path: payload.path })
        else if (kind === 'folder' && id === 'remove-folder') setDialog({ kind: 'folder-delete', path: payload.path })
        else if (kind === 'workspace' && id === 'rename') setDialog({ kind: 'ws-rename', workspace: payload })
        else if (kind === 'workspace' && id === 'delete') setDialog({ kind: 'ws-delete', workspace: payload })
        else if (kind === 'sgroup' && id === 'rename-sgroup') setDialog({ kind: 'sgroup-rename', target: payload })
        else if (kind === 'session' && id === 'rename') setDialog({ kind: 'sess-rename', session: payload })
        else if (kind === 'session' && id === 'fork') forkSession(payload.id)
        else if (kind === 'session' && id === 'archive') { Promise.resolve().then(() => archiveSession(payload.id)).catch(fail) }
      }

      /* --------------------------- dialogs --------------------------- */
      // TextDialog / ConfirmDialog are module-level components: a per-render
      // inline definition would remount on every parent tick and drop input.

      /* ---------------------------- render --------------------------- */

      if (!wide) {
        return E('div', { className: 'bw-rail' },
          StyleNode(),
          withTip(E('button', { type: 'button', className: 'bw-rail-btn', 'aria-label': t('rail.search'), onClick: () => { expandSidebar(); setSearchOpen(true) } }, icon('IconSearchOutlineRegular', 18)), t('rail.search')),
          withTip(E('button', { type: 'button', className: 'bw-rail-btn', 'aria-label': t('rail.add'), onClick: () => { expandSidebar(); setFlowParent(''); setFlowOpen(true) } }, icon('IconProjectAddOutlineRegular', 18)), t('rail.add')),
          // The collapsed rail needs its own entry point: the header buttons
          // only exist in the expanded branch, so without this row the rail is
          // the one state where no virtual directory can be created at all.
          withTip(E('button', { type: 'button', className: 'bw-rail-btn', 'aria-label': t('dir.new.title'), onClick: () => { expandSidebar(); setDialog({ kind: 'dir-new', parentId: '' }) } }, icon('IconFolderOpenOutlineRegular', 18)), t('dir.new.title')),
        )
      }

      const dialogElement = (() => {
        if (dialog === null) return null
        /* ------------------- virtual directory dialogs ------------------- */
        if (dialog.kind === 'dir-new') return E(TextDialog, {
          key: 'dir-new',
          title: t('dir.new.title'),
          hint: t('dir.new.hint'),
          initial: '',
          onConfirm: (v) => {
            const name = String(v || '').trim()
            if (name === '') return
            setDialog(null)
            createDir(dialog.parentId || '', name)
          },
          onClose: () => setDialog(null),
          t,
        })
        if (dialog.kind === 'dir-rename') return E(TextDialog, {
          key: 'dir-rename',
          title: t('dir.rename.title'),
          hint: t('dir.rename.hint'),
          initial: dialog.name || '',
          onConfirm: (v) => {
            const name = String(v || '').trim()
            setDialog(null)
            if (name !== '' && name !== dialog.name) renameDir(dialog.dirId, name)
          },
          onClose: () => setDialog(null),
          t,
        })
        if (dialog.kind === 'dir-delete') return E(ConfirmDialog, {
          key: 'dir-delete',
          title: t('dir.delete.title'),
          body: t('dir.delete.body', { name: dialog.name || '' }),
          onConfirm: () => { setDialog(null); removeDir(dialog.dirId) },
          onClose: () => setDialog(null),
          t,
        })
        if (dialog.kind === 'ws-rename') return E(TextDialog, {
          key: 'ws-rename',
          title: t('ws.rename.title'),
          hint: t('ws.rename.hint'),
          initial: dialog.workspace.title || dialog.workspace.leaf,
          onConfirm: (v) => submitWorkspaceRename(dialog.workspace, v),
          onClose: () => setDialog(null),
          t,
        })
        if (dialog.kind === 'ws-delete') return E(ConfirmDialog, {
          key: 'ws-delete',
          title: t('ws.delete.title'),
          body: t('ws.delete.body', { name: dialog.workspace.title || dialog.workspace.leaf }),
          onConfirm: () => submitWorkspaceDelete(dialog.workspace),
          onClose: () => setDialog(null),
          t,
        })
        if (dialog.kind === 'sess-rename') return E(TextDialog, {
          key: 'sess-rename',
          title: t('menu.rename'),
          initial: dialog.session.title,
          onConfirm: (v) => submitSessionRename(dialog.session, v),
          onClose: () => setDialog(null),
          t,
        })
        if (dialog.kind === 'sgroup-rename') return E(TextDialog, {
          key: 'sgroup-rename',
          title: t('menu.renameSgroup'),
          hint: t('ws.rename.hint'),
          initial: dialog.target.name,
          onConfirm: (v) => submitSessionGroupRename(dialog.target, v),
          onClose: () => setDialog(null),
          t,
        })
        if (dialog.kind === 'folder-new') return E(TextDialog, {
          key: 'folder-new',
          title: t('folder.new.title'),
          hint: t('folder.new.hint'),
          initial: dialog.parentPath ? dialog.parentPath + '/' : '',
          onConfirm: (v) => submitFolderNew(dialog.parentPath || '', v),
          onClose: () => setDialog(null),
          t,
        })
        if (dialog.kind === 'folder-rename') return E(TextDialog, {
          key: 'folder-rename',
          title: t('folder.rename.title'),
          hint: t('folder.rename.hint'),
          initial: dialog.path,
          onConfirm: (v) => submitFolderRename(dialog.path, v),
          onClose: () => setDialog(null),
          t,
        })
        if (dialog.kind === 'folder-delete') {
          return E(ConfirmDialog, {
            key: 'folder-delete',
            title: t('menu.removeFolder'),
            body: t('folder.delete.body', { name: dialog.path }),
            onConfirm: () => submitFolderDelete(dialog.path),
            onClose: () => setDialog(null),
            t,
          })
        }
        return null
      })()

      return E('div', { className: 'bw-root' },
        StyleNode(),
        E('div', { className: 'bw-header' },
          E('div', { className: 'bw-header-title' }, t('title')),
          (searchOpen || query !== '') ? E('input', {
            className: 'bw-input',
            style: { width: 130, flex: 'none' },
            value: query,
            autoFocus: true,
            placeholder: t('search.placeholder'),
            onChange: (e) => setQuery(e.target.value),
            onKeyDown: (e) => { if (e.key === 'Escape') { setQuery(''); setSearchOpen(false) } },
            onBlur: () => { if (query === '') setSearchOpen(false) },
          }) : null,
          withTip(E('button', { type: 'button', className: 'bw-icon-btn', 'aria-label': t('search.placeholder'), onClick: () => setSearchOpen(v => !v) }, icon('IconSearchOutlineRegular')), t('search.placeholder')),
          // Add a REAL workspace next to "new virtual folder": the flow uses the
          // vendored official browser (or the OS chooser on native hosts).
          withTip(E('button', { type: 'button', className: 'bw-icon-btn', 'aria-label': t('add'), onClick: () => { setFlowParent(''); setFlowOpen(true) } }, icon('IconProjectAddOutlineRegular')), t('add')),
          // Create a VIRTUAL directory: no folder is picked, nothing on disk is
          // touched, the directory exists only as a grouping record.
          withTip(E('button', { type: 'button', className: 'bw-icon-btn', 'aria-label': t('dir.new.title'), onClick: () => { setSearchOpen(false); setDialog({ kind: 'dir-new', parentId: '' }) } }, icon('IconFolderOpenOutlineRegular')), t('dir.new.title')),
        ),
        E('div', { ref: treeRef, className: 'bw-tree', role: 'tree', 'aria-label': t('title') }, bodyRows),
        E(AddWorkspaceFlow, {
          open: flowOpen,
          initialParent: flowParent,
          onCancel: () => setFlowOpen(false),
          onError: fail,
          createWorkspace,
          renameWorkspace,
          pickDirectory,
          listDirectory,
          createDirectory,
          pickFolder,
          actions,
          useStore,
          t,
        }),
        dialogElement,
        ctx !== null ? E('div', {
          className: 'bw-ctx-overlay',
          onMouseDown: () => setCtx(null),
          onContextMenu: (e) => e.preventDefault(),
        },
          E('div', {
            className: 'bw-ctx-menu',
            style: { left: Math.min(ctx.x, window.innerWidth - 190), top: Math.min(ctx.y, window.innerHeight - 240) },
            onMouseDown: (e) => e.stopPropagation(),
            onContextMenu: (e) => e.preventDefault(),
          },
            ctxItems().map((item, index) => item.sep
              ? E('div', { key: 'sep-' + index, className: 'bw-ctx-sep' })
              /* A `children` list is the "move into a directory" choice: the
                 parent row labels the group, the child rows are the pickable
                 rows, indented and scrollable so a deep tree still fits. */
              : [E('button', {
                key: item.id,
                type: 'button',
                className: cls('bw-ctx-item', item.danger && 'bw-ctx-danger'),
                onClick: () => (Array.isArray(item.children) ? undefined : handleCtxPick(item.id)),
              }, item.label),
              Array.isArray(item.children)
                ? E('div', { key: item.id + '-sub', className: 'bw-ctx-sub' }, item.children.map((child) => E('button', {
                  key: child.id,
                  type: 'button',
                  className: 'bw-ctx-item bw-ctx-subitem',
                  title: child.label.trim(),
                  onClick: () => handleCtxPick(child.id),
                }, child.label.trim())))
                : null],
            ),
          ),
        ) : null,
        E(CustomizeDialog, {
          open: customize !== null,
          kind: customize ? customize.kind : undefined,
          defaults: defaultAppearance,
          initial: customize
            ? { ...appearanceOf(customize.entryKey), icon: (styleEntry(customize.entryKey) || {}).icon || 'solid' }
            : undefined,
          onChange: (style) => { if (customize) shared.setStyling(customize.entryKey, style) },
          onReset: () => { if (customize) shared.setStyling(customize.entryKey, null) },
          onClose: () => setCustomize(null),
          t,
        }),
        E(ui.Modal, {
          open: errorText !== null,
          onClose: () => setErrorText(null),
          closeLabel: t('close'),
          title: t('error.title'),
          footer: E('div', { className: 'bw-modal-actions' }, E(BTN, { variant: 'primary', onClick: () => setErrorText(null) }, t('close'))),
        }, E('div', { className: 'bw-modal-body' }, E('div', { className: 'bw-error-text', role: 'alert' }, errorText || '')), StyleNode()),
      )
    }

    /* ============================ plugin ============================== */

    // Live title-cache store instance, set once per apply() and read directly
    // by BetterBrowser. NOT a registration store seat: remembered titles only
    // matter before the wire catches up, and every write happens when the
    // wire already carries the same truth, so selector-hook re-renders would
    // be pure noise. One instance per activation (never per mount) keeps the
    // persist key single-writer — dsh-client-store warns same-key instances
    // cross-pollinate one localStorage entry.
    let titleCacheRef = null

    function apply(ctx) {
      const slots = ctx.get('slots')
      if (slots === undefined || typeof slots.register !== 'function') {
        console.error('[dsh-better-workspace] slots service unavailable; plugin idle')
        return
      }
      const sessions = ctx.get('sessions')
      const workspaces = ctx.get('workspaces')
      const uiWorkspace = ctx.get('uiWorkspace')
      if (!sessions || !workspaces || !uiWorkspace) {
        console.error('[dsh-better-workspace] required services missing', {
          sessions: !!sessions, workspaces: !!workspaces, uiWorkspace: !!uiWorkspace,
        })
        return
      }
      if (ctx.locale && typeof ctx.locale.register === 'function') {
        ctx.effect(() => {
          try {
            return ctx.locale.register(NS, Object.assign({ zh, en }, LOCALES))
          } catch (localeError) {
            console.warn('[dsh-better-workspace] dictionary registration failed', localeError)
            return () => {}
          }
        }, 'better-workspace: dictionaries')
      }

      const searchSessions = async (query, signal) => {
        const result = await sessions.search(query, signal)
        if (!result || !result.ok) throw new Error(result && result.error ? result.error.message : 'session search failed')
        return result.value
      }
      const renameSession = async (sessionId, title) => {
        const binding = sessions.binding(sessionId)
        const session = binding && binding.session
        if (!session) throw new Error('unknown session "' + sessionId + '"')
        const result = await session.rename(title)
        if (!result || !result.ok) throw new Error(result && result.error ? result.error.message : 'session rename failed')
      }
      // Switching the conversation shown in the main pane is owned by the
      // workspace UI service, not by the raw sessions store. 0.1 exposed
      // sessions.open(id); 0.2 dropped it in favour of sessions.retain(...),
      // but retain alone only reserves the session — the main-view selection
      // (what the chat pane renders) stays untouched, so the sidebar appeared
      // to do nothing. uiWorkspace.openSession(id) is the shipped path used by
      // dsh's own sidebar: it retains and re-points the main view in one go,
      // and it exists in both 0.1 and 0.2.
      const retainSession = (sessionId) => {
        if (uiWorkspace && typeof uiWorkspace.openSession === 'function') {
          uiWorkspace.openSession(sessionId)
          return
        }
        if (typeof sessions.retain === 'function') {
          sessions.retain(sessionId, { source: 'mainView' })
          return
        }
        sessions.open(sessionId)
      }

      const forkSession = (sessionId) => {
        sessions.fork({ sessionId, increaseTitle: true })
          .then((childId) => retainSession(childId))
          .catch(() => { /* keep current selection */ })
      }

      const browserInjected = () => ({
        startSession: (workspaceId) => { uiWorkspace.startSession(workspaceId) },
        open: (sessionId) => { retainSession(sessionId) },
        searchSessions,
        searchResultLimit: sessions.searchResultLimit !== undefined ? sessions.searchResultLimit : 20,
        renameSession,
        forkSession,
        renameWorkspace: (workspaceId, title) => workspaces.rename(workspaceId, title),
        deleteWorkspace: (workspaceId) => workspaces.delete(workspaceId),
        insertWorkspaceBefore: typeof workspaces.insertBefore === 'function'
          ? (workspaceId, beforeWorkspaceId) => workspaces.insertBefore(workspaceId, beforeWorkspaceId)
          : undefined,
        // Official contract exposes session reorder through the WORKSPACES
        // service (see dsh ui-workspace client index.ts); feature-probed so
        // older hosts degrade to "group-move only" instead of a TypeError.
        insertSessionBefore: typeof workspaces.insertSessionBefore === 'function'
          ? (workspaceId, sessionId, beforeSessionId) => workspaces.insertSessionBefore(workspaceId, sessionId, beforeSessionId)
          : undefined,
        archiveSession: (sessionId) => uiWorkspace.archiveSession(sessionId),
        createWorkspace: (input) => workspaces.create(input),
        pickDirectory: () => uiWorkspace.pickDirectory(),
        // Browse-side primitives: what the vendored official browser drives when
        // this Host composes the `browse` backend instead of the OS chooser.
        listDirectory: (path, signal) => uiWorkspace.listDirectory(path, signal),
        createDirectory: (path, name) => uiWorkspace.createDirectory(path, name),
        pickFolder: () => requestPickFolder(),
      })
      // Registration helper: a thrown register (semantics drift, vanishing
      // hole declaration mid-transition) degrades this one seat, never the
      // plugin fiber — the whole web boot is all-or-nothing.
      const guarded = (slotKey, options, component) => () => {
        try {
          return slots.register(options, (props) => E(QuietBoundary, null, E(component, props)))
        } catch (registerError) {
          console.warn('[dsh-better-workspace] register skipped for ' + slotKey, registerError)
          return undefined
        }
      }

      // One shared store handle: the browser and the settings page must see the
      // SAME persisted state (expansion, directories, assignments, prefs,
      // styling). One handle per activation — two instances on one persist key
      // cross-pollinate the same localStorage entry.
      const viewStore = createViewStore()
      // The capability probe rides the browse verbs, so it needs this handle
      // before any flow can open.
      pickerState.api = uiWorkspace

      /* ------------------- directory picking: not ours at all ----------------
       * The plugin draws NO directory picker and adds NO workspace. Both the
       * `directoryFlow` holes (`conversation.hero.workspace.directoryFlow`,
       * `sidebar.workspaces.directoryFlow`) and the "add a machine folder"
       * action belong to the Host: "Add workspace…" in the conversation
       * hero opens the shipped picker (`dsh-client-ui-directory-picker-browse`,
       * 680x500, Miller columns, status/error lines, create-folder sub-dialog)
       * and the Host creates the workspace itself.
       *
       * 0.3.x used to draw its own 380x470 single-column browser for this and
       * shadow the shipped one at priority -1; users compared the two and the
       * plugin's copy read as a half-finished UI. The picking interaction
       * cannot be borrowed either: `uiWorkspace` exposes the picker VERBS
       * (pick a folder / list it / make a subfolder) but no "open the Host's add flow", a slot
       * cannot re-declare another entry's child key ("already declared"), and
       * the `workspace.add` shortcut drives the SHIPPED sidebar browser's own
       * state — which this plugin replaces. So the plugin keeps only what it
       * can own: the virtual-directory tree, its context menus ("Move into
       * folder…" files an existing workspace without touching its title) and
       * "New virtual folder". A newly added workspace lands at the root level
       * and is filed afterwards from its row menu.
       */

      // Cold-restart title fallback (see the title-cache block). Hydration
      // reads localStorage synchronously here, before the first render, so a
      // restart's first tree already shows every remembered title.
      loadTitleCache()
      titleCacheRef = { getSnapshot: () => titleCache, rememberAllTitles }

      // Cross-device settings scope (manual sync, see the host-settings-sync
      // block). Binding is best-effort: a missing/failed bind leaves the
      // plugin fully browser-local — the pre-0.9.5 behavior.
      prefsScopeRef = null
      // dsh 0.2 renamed settingsScope to configForms, keyed by host entry id
      // (`virtual-workspace` in cordis.patch.yml); 0.1 hosts keep the bind.
      const bindPrefsScope = () => {
        if (prefsScopeRef !== null) return
        try {
          const forms = ctx.get('configForms')
          if (forms && typeof forms.get === 'function') {
            prefsScopeRef = forms.get('virtual-workspace')
            return
          }
          const scope = ctx.get('settingsScope')
          if (scope && typeof scope.bind === 'function') {
            prefsScopeRef = scope.bind({ namespace: 'better-workspace' })
          }
        } catch (error) {
          console.warn('[dsh-better-workspace] settings scope bind failed; sync stays local', error)
          prefsScopeRef = null
        }
      }
      bindPrefsScope()
      if (typeof ctx.inject === 'function') {
        ctx.inject(['configForms'], bindPrefsScope)
        ctx.inject(['settingsScope'], bindPrefsScope)
      }

      // Settings → Plugins card only (the tab dispatches the intersection of
      // served namespaces — registered host-side — and settings.plugin.item
      // cards). The old left-nav settings.section entry was removed: the
      // plugins-section card is the single settings surface now.
      slots.inject('settings.plugin.item', guarded(
        'settings.plugin.item',
        {
          name: 'settings.plugin.item',
          key: 'better-workspace',
          locale: NS,
          store: viewStore,
        },
        BetterWorkspacePluginCard,
      ))

      // 3. the browser itself — lowest priority renders, shadowing the shipped entry.
      slots.inject('sidebar.workspaces', guarded(
        'sidebar.workspaces',
        {
          name: 'sidebar.workspaces',
          priority: -1,
          store: viewStore,
          inject: browserInjected,
          locale: NS,
        },
        BetterBrowser,
      ))
    }

    /* ==================== host actions (open folder, …) ==================== */

    /**
     * Route of the host half's "open folder" action (src/open-folder.js). A
     * browser cannot hand a path to the operating system, so the context menu
     * posts it here and the host launches its own file manager; under WSL that
     * is Explorer on the Windows desktop, reached through the translated path.
     */
    const OPEN_FOLDER_ROUTE = '/_dsh/virtual-workspace/open-folder'

    /**
     * The host half's Windows folder picker (src/pick-folder.js). This rides
     * `POST` because it opens a dialog; GET is the capability probe. The route
     * answers `{ status: 'picked' | 'cancelled' | 'unavailable', path?, reason? }`.
     */
    const PICK_FOLDER_ROUTE = '/_dsh/virtual-workspace/pick-folder'

    /**
     * Short-lived notice for the outcome of a host action. It has to live
     * outside React: the context menu closes on pick, and unless the entry
     * opens a dialog there is no component left to carry the message. The
     * element is keyed by attribute so a second message replaces the first
     * instead of stacking, and it is pointer-transparent so it can never eat a
     * click on the sidebar underneath.
     */
    function showNotice(message, variant) {
      try {
        const existing = document.querySelector('[data-bw-notice]')
        if (existing && existing.parentNode) existing.parentNode.removeChild(existing)
        const box = document.createElement('div')
        box.setAttribute('data-bw-notice', '1')
        box.setAttribute('role', variant === 'error' ? 'alert' : 'status')
        box.textContent = String(message === undefined || message === null ? '' : message)
        box.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483000;max-width:420px;' +
          'pointer-events:none;padding:10px 14px;border-radius:10px;word-break:break-all;' +
          'font:12px/1.6 system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.35);' +
          (variant === 'error' ? 'background:#c34f4f;color:#fff' : 'background:rgba(28,28,32,.92);color:#fff')
        document.body.append(box)
        setTimeout(() => { try { box.remove() } catch (error) { /* already gone */ } }, variant === 'error' ? 6000 : 2600)
      } catch (error) {
        // A missing document.body (or a blocked append) must never break the
        // pick handler that produced the message.
        console.warn('[dsh-better-workspace] notice not shown:', message, error)
      }
    }

    /**
     * Ask the host to open one workspace folder in the OS file manager.
     *
     * The path comes from the sidebar's own workspace registry entry, i.e. the
     * very path this DSH session runs in, so the request carries no authority
     * the caller did not already have. The host re-validates it (absolute,
     * existing, a directory) and answers a readable message on failure.
     *
     * @param path - absolute host path of the workspace folder.
     * @returns the opener result, or a rejection carrying the host's message.
     */
    function requestOpenFolder(path) {
      if (typeof path !== 'string' || path === '') {
        return Promise.reject(new Error('this workspace has no folder path'))
      }
      return fetch(OPEN_FOLDER_ROUTE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      }).then(
        (response) => response.json().catch(() => {
          throw new Error('open folder failed (HTTP ' + response.status + ')')
        }).then((result) => {
          if (!response.ok || !result || !result.ok) {
            throw new Error((result && result.error && result.error.message) || ('open folder failed (HTTP ' + response.status + ')'))
          }
          return result.value
        }),
        // A network-level rejection means the route is not mounted at all —
        // the host half failed to load, or this page is older than it.
        (error) => {
          throw new Error((error && error.message) || 'open folder route unreachable')
        },
      )
    }

    /**
     * Ask the host for the operating system's own folder dialog.
     *
     * A missing route (host half older than this page) or a non-WSL host is NOT
     * an error: the caller falls back to the host's picker backend, then to the
     * vendored in-app browser. Only a genuine pick is reported as `picked`.
     * @returns `{ status, path?, reason? }`.
     */
    function requestPickFolder() {
      return fetch(PICK_FOLDER_ROUTE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }).then(
        (response) => response.json().then(
          (result) => {
            if (!response.ok || !result || !result.ok || !result.value) {
              return { status: 'unavailable', reason: 'route-error' }
            }
            return result.value
          },
          () => ({ status: 'unavailable', reason: 'route-error' }),
        ),
        (error) => {
          console.warn('[dsh-better-workspace] pick-folder route unreachable:', error && error.message)
          return { status: 'unavailable', reason: 'route-unreachable' }
        },
      )
    }

    /**
     * Copy one string to the clipboard.
     *
     * `navigator.clipboard` is the supported path (the Web surface is served
     * from a secure context under 127.0.0.1), but the permission it asks for can
     * be refused; the deprecated `execCommand` route then does the job from a
     * throwaway textarea, and a refused clipboard finally turns into a readable
     * rejection instead of a silent no-op.
     *
     * @param text - the string to place on the clipboard.
     */
    function copyText(text) {
      const value = String(text === undefined || text === null ? '' : text)
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        return navigator.clipboard.writeText(value).catch(() => legacyCopy(value))
      }
      return legacyCopy(value)
    }

    /** The pre-Clipboard-API copy route, kept as the fallback. */
    function legacyCopy(value) {
      return new Promise((resolve, reject) => {
        try {
          const area = document.createElement('textarea')
          area.value = value
          area.setAttribute('readonly', 'readonly')
          // Kept off-screen but inside the document: a detached node cannot be
          // selected, so the copy would silently do nothing.
          area.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0'
          document.body.append(area)
          area.select()
          const copied = typeof document.execCommand === 'function' && document.execCommand('copy')
          area.remove()
          if (copied) resolve(value)
          else reject(new Error('clipboard refused the copy'))
        } catch (error) {
          reject(error)
        }
      })
    }

    return {
      name: 'dsh-virtual-workspace',
      inject: ['slots', 'sessions', 'workspaces', 'locale', 'uiWorkspace'],
      apply,
    }
  },
})
