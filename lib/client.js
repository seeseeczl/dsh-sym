window.__ModuleLoader__.load({
	id: "dsh-sym",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const React = require("react");

		//#region diagnostics
		/**
		* Diagnostic sink for this bundle's deliberate degradations (AUD-QUAL-002).
		*
		* The client half must never show a placeholder for data it does not have
		* (NFR-02: 安静退场) — a missing module or a rejected Remote call means the
		* readout simply stays away. That silence is a feature for the user and a
		* problem for whoever is debugging it, so every degradation is recorded here
		* once per locus: a per-render failure cannot flood the console.
		*
		* Declared before every consumer in this factory on purpose — the first
		* consumer is the `react-dom` probe at the top of the styles region, and a
		* later `const` would leave it in the temporal dead zone.
		*
		* @param where - short stable locus, e.g. `panel:react-dom`.
		* @param detail - what went wrong, already stringified.
		*/
		const DEGRADE_LOG_LIMIT = 40;
		const degradedLoci = new Set();
		function noteDegrade(where, detail) {
			if (degradedLoci.has(where) || degradedLoci.size >= DEGRADE_LOG_LIMIT) return;
			degradedLoci.add(where);
			try {
				console.warn("[dsh-sym] " + where + " 降级：" + detail);
			} catch {
				// No console in this environment; the readout stays silent as designed.
			}
		}
		/** One line describing a caught value, for the diagnostic log. */
		function describeError(error) {
			if (error !== null && error !== void 0 && error.message !== void 0) return String(error.message);
			return String(error);
		}
		//#endregion

		//#region contract
		/**
		* The cross-end contract constants (AUD-ARCH-001).
		*
		* This bundle cannot import the host half: it is a browser module factory,
		* and `lib/host-v13.js` is a Node module that reads the filesystem. So both
		* ends keep their own copy of these three values and `test/contracts.test.mjs`
		* asserts the copies are equal, plus one end-to-end case proving a mark this
		* half writes is one the host half actually expands. **When you change one
		* side, change the other and run `npm test`.**
		*
		* `PROJECTION_KEY` — the session projection the readouts fold over.
		* `QUOTE_MARK_PREFIX` + `QUOTE_MARK_ID_LENGTH` — the durable mark a quote
		* action writes into the composer draft.
		*/
		const PROJECTION_KEY = "sessionCost";
		const QUOTE_MARK_PREFIX = "@引用#";
		const QUOTE_MARK_ID_LENGTH = 12;
		/** 快捷按钮条的投影 key；与宿主 `QUICK_ACTIONS_KEY` 必须一致（契约测试守卫）。 */
		const QUICK_ACTIONS_KEY = "quickActions";
		//#endregion

		//#region styles
		/**
		* `react-dom`, for the portalled cost panel. Absence is survivable: the panel
		* degrades to the hover tooltip that was already there.
		*/
		let ReactDOM = null;
		try {
			ReactDOM = require("react-dom");
		} catch (error) {
			// No portal, no panel: the hover tooltip still carries the same figures.
			ReactDOM = null;
			noteDegrade("panel:react-dom", describeError(error));
		}


		/**
		* The two cost cells deliberately share `dsh-client-ui-chat`'s StatsPills row
		* type scale; the balance cell sits in the composer tool row and reads with it.
		*
		* 这里曾经有过一条把官方侧栏 footer 从竖排改成横排的静态规则
		* （`_footArea` / `_footerActions` / `_settingsArea` 三个官方类名）。
		* 余额格自 c0cf3a5 起就是 `position: fixed`，位置由 JS 量 `_sidebarCol` 写死，
		* **不依赖** footer 怎么排；那条规则唯一的实际效果是把官方账户行
		* （头像 + 用户名）推到右侧 —— 用户报的「名字的位置变了」就是它。
		*
		* 教训：改官方布局的静态规则，只有在你**确实替换**了官方排版时才划算；
		* 否则就是在替官方元素决定位置。
		* 余额格已不再借位：它注册在 `conversation.input.right`，位置由官方工具行布局决定，
		* 既不 fixed 也不量 DOM。本插件剩下的浮层（面板、菜单、竖条）仍旧自己定位。
		*/
		const CSS = ".dshSym_root{box-sizing:border-box;min-width:0;max-width:100%;font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px);line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));gap:12px;display:flex}.dshSym_pill{box-sizing:border-box;corner-shape:round;max-width:100%;color:var(--dsw-alias-label-secondary);font:inherit;font-variant-numeric:tabular-nums;line-height:inherit;white-space:nowrap;background:0 0;border:none;border-radius:999px;align-items:center;gap:6px;padding:1px 8px;display:inline-flex;cursor:pointer}.dshSym_pill svg{flex:none;width:14px;height:14px}.dshSym_pill:not(.dshSym_mem):hover,.dshSym_panelWrap[data-open=\"true\"] .dshSym_pill:not(.dshSym_mem):hover,.dshSym_panelWrap[data-open=\"true\"] .dshSym_pill:not(.dshSym_mem){background:var(--dsw-alias-interactive-bg-hover)}.dshSym_label{text-overflow:ellipsis;min-width:0;overflow:hidden}.dshSym_sep{opacity:.45;margin:0 -2px}.dshSym_mem{cursor:default}.dshBalance_root{box-sizing:border-box;height:28px;flex:none;max-width:100%;color:var(--dsw-alias-label-secondary);font-size:13px;font-variant-numeric:tabular-nums;line-height:20px;white-space:nowrap;background:0 0;border:none;border-radius:8px;align-items:center;gap:4px;padding:0 8px;display:inline-flex;cursor:pointer}.dshBalance_root svg{flex:none;width:14px;height:14px}.dshBalance_root:focus-visible{outline:var(--dsh-focus-ring-width) solid var(--dsh-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}.dshBalance_value{font-variant-numeric:tabular-nums;min-width:60px;text-align:left}.dshSym_panelWrap{position:relative;display:inline-flex}.dshSym_panel{position:fixed;z-index:1100;box-sizing:border-box;border-radius:var(--dsw-radius-lg);background:var(--dsw-specific-menu);backdrop-filter:var(--dsw-menu-backdrop-filter);box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-secondary);border:0;padding:12px;font-size:12px;line-height:20px;text-align:left;width:min(300px,calc(100vw - 24px));cursor:default}.dshSym_panelTitle{display:flex;align-items:center;justify-content:space-between;gap:12px;font-weight:600}.dshSym_panelRule{height:1px;background:var(--dsw-alias-separator-primary);margin:8px 0}.dshSym_panelRow{display:flex;align-items:baseline;justify-content:space-between;gap:12px;font-variant-numeric:tabular-nums}.dshSym_panelRow>span:last-child{white-space:nowrap}.dshSym_panelMuted{color:var(--dsw-alias-label-secondary)}.dshSym_panelHeading{color:var(--dsw-alias-label-secondary);margin:8px 0 2px;font-size:11px}.dshSym_panelSave{color:color-mix(in srgb,var(--dsw-alias-state-business-primary,var(--dsw-alias-label-secondary)) 68%,var(--dsw-alias-label-primary))}.dshSym_menu{position:fixed;z-index:1100;box-sizing:border-box;border-radius:var(--dsw-radius-lg);background:var(--dsw-specific-menu);backdrop-filter:var(--dsw-menu-backdrop-filter);box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-secondary);border:0;padding:4px;font-size:12px;line-height:20px;min-width:160px;max-width:min(420px,92vw)}.dshSym_menuItem{display:block;width:100%;box-sizing:border-box;text-align:left;background:0 0;border:0;color:inherit;font:inherit;padding:6px 10px;border-radius:var(--dsw-radius-sm);cursor:pointer;white-space:nowrap}.dshSym_menuItem:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.dshSym_menuPath{display:block;padding:4px 10px 6px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:15px;word-break:break-all;max-width:min(420px,92vw)}.dshSym_panelNudge{margin-top:4px;color:var(--dsw-alias-state-business-primary,var(--dsw-alias-label-secondary));font-size:11px;line-height:16px}.dshQuickRail{position:fixed;z-index:21;top:50%;left:8px;transform:translateY(-50%);box-sizing:border-box;display:flex;flex-direction:column;align-items:center;gap:4.4px;padding:5px 4px;border-radius:14px;background:var(--dsw-specific-menu);--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);backdrop-filter:var(--dsw-menu-backdrop-filter);box-shadow:var(--dsw-elevation-prominent);pointer-events:auto}.dshQuickRail_group{display:flex;flex-direction:column;align-items:center;gap:4.4px}.dshQuickRail_rule{width:16px;height:1px;flex:none;border-radius:1px;background:color-mix(in srgb,var(--dsw-alias-label-tertiary) 50%,var(--dsw-alias-label-secondary))}.dshQuickRail_btn{box-sizing:border-box;display:grid;place-items:center;width:30px;height:30px;padding:0;border:0;border-radius:8px;background:0 0;color:var(--dsw-alias-label-secondary);cursor:pointer}.dshQuickRail_btn svg{display:block;width:19.8px;height:19.8px}.dshQuickRail_btn:hover{background:var(--dsw-alias-interactive-bg-hover)}.dshQuickRail_btn:focus-visible{outline:var(--dsh-focus-ring-width) solid var(--dsh-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}.dshQuickSet_section{margin-top:10px;font-size:12px;font-weight:600;color:var(--dsw-alias-label-tertiary)}.dshQuickSet_groupTitle{margin-top:8px;font-size:11px;font-weight:600;line-height:16px;letter-spacing:.02em;color:var(--dsw-alias-label-secondary)}.dshQuickOptRow{display:flex;align-items:center;flex-wrap:wrap;gap:18px}.dshQuickOpt{display:flex;align-items:center;gap:8px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary);cursor:pointer}.dshQuickOpt input{margin:0}.dshQuickSet{box-sizing:border-box;display:flex;flex-direction:column;gap:8px;padding:4px 0;max-width:780px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}.dshQuickSet_title{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary)}.dshQuickSet_hint,.dshQuickSet_note{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.dshQuickSet_error{color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-primary));font-size:12px;line-height:18px}.dshQuickSet_toggle{display:flex;align-items:center;gap:6px;font-size:12px}.dshQuickSet_row{display:flex;align-items:center;gap:6px}.dshQuickSet_iconBtn{box-sizing:border-box;display:grid;place-items:center;width:28px;height:28px;flex:none;padding:0;border:.5px solid var(--dsw-alias-border-l3);border-radius:8px;background:0 0;color:var(--dsw-alias-label-secondary);cursor:pointer}.dshQuickSet_iconBtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.dshQuickSet_input{box-sizing:border-box;width:100px;flex:none;padding:3px 8px;border:.5px solid var(--dsw-alias-border-l3);border-radius:8px;background:0 0;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px}.dshQuickSet_input::placeholder{color:var(--dsw-alias-label-caption,var(--dsw-alias-label-tertiary))}.dshQuickSet_pair{display:flex;align-items:center;gap:6px;flex:1 1 auto;min-width:0}.dshQuickSet_wide{flex:1 1 0;width:auto;min-width:0}.dshQuickSet_select.dshQuickSet_wide{flex:1 1 0;width:auto;min-width:0}.dshQuickSet_select{box-sizing:border-box;flex:none;padding:3px 6px;border:.5px solid var(--dsw-alias-border-l3);border-radius:8px;background:0 0;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px}.dshQuickSet_mini{box-sizing:border-box;display:grid;place-items:center;width:26px;height:26px;flex:none;padding:0;border:0;border-radius:8px;background:0 0;color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer}.dshQuickSet_mini:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.dshQuickSet_mini:disabled{opacity:.4;cursor:default}.dshQuickSet_picker{display:grid;grid-template-columns:repeat(auto-fill,minmax(34px,1fr));gap:4px;padding:8px;border-radius:12px;background:var(--dsw-specific-menu);box-shadow:var(--dsw-elevation-prominent)}.dshQuickSet_pickCell{box-sizing:border-box;display:grid;place-items:center;height:34px;padding:0;border:0;border-radius:8px;background:0 0;color:var(--dsw-alias-label-secondary);cursor:pointer}.dshQuickSet_pickCell svg{display:block;width:24px;height:24px}.dshQuickSet_pickCell:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.dshQuickSet_footer{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:4px}.dshQuickSet_add,.dshQuickSet_save{box-sizing:border-box;flex:none;white-space:nowrap;padding:4px 12px;border-radius:999px;font:inherit;font-size:12px;cursor:pointer}.dshQuickSet_add{border:.5px solid var(--dsw-alias-border-l3);background:0 0;color:var(--dsw-alias-label-secondary)}.dshQuickSet_add:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.dshQuickSet_save{border:0;background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-state-business-primary,var(--dsw-alias-interactive-bg-hover)));color:var(--dsw-alias-label-primary-foreground,var(--dsw-alias-label-primary))}.dshQuickSet_save:disabled{opacity:.5;cursor:default}.dshQuickSet_status{flex-basis:100%;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}.dshQuickSet_status[data-state=\"saved\"]{color:var(--dsw-alias-state-success-primary,var(--dsw-alias-label-secondary))}.dshQuickSet_status[data-state=\"error\"]{color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-secondary))}.dshQuoteAction{box-sizing:border-box;color:var(--dsw-alias-label-tertiary);font:inherit;font-weight:500;background:0 0;border:none;border-radius:999px;place-items:center;width:28px;height:28px;padding:0;display:grid;cursor:pointer}.dshQuoteAction:disabled{cursor:default;opacity:.45}.dshQuoteAction:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}.dshQuoteAction:focus-visible{outline:var(--dsh-focus-ring-width) solid var(--dsh-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}.dshQuoteMark{font-size:15px;line-height:1}.dshQuoteFlag{font-size:10px;line-height:1;color:var(--dsw-alias-label-caption,inherit)}.dshSymTurnCost{display:inline-flex;align-items:center;gap:4px;color:var(--dsw-alias-label-tertiary);font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px);line-height:calc(24px + var(--dsh-content-font-delta,0px));height:calc(28px + var(--dsh-content-font-delta,0px));font-variant-numeric:tabular-nums;white-space:nowrap;order:1}.dshSymTurnCost svg{flex:none;width:calc(15px + var(--dsh-content-font-delta,0px));height:calc(15px + var(--dsh-content-font-delta,0px))}[class*=\"_endInfo\"]{order:2}.dshBrandRow{display:flex;align-items:center;gap:6px;min-width:0}.dshPeakTag{box-sizing:border-box;font-size:10px;font-weight:500;line-height:14px;white-space:nowrap;border:.5px solid transparent;border-radius:5px;padding:0 5px;cursor:default}.dshPeakOn{color:var(--dsw-alias-state-warn-primary,var(--dsw-alias-label-secondary));border-color:currentColor}[class*=\"_brandIdentity\"]::after{content:var(--dsh-peak-label,\"\");font-size:10px;font-weight:500;line-height:14px;white-space:nowrap;color:var(--dsw-alias-label-primary);background:color-mix(in srgb,var(--dsh-peak-color,transparent) 16%,transparent);border:.5px solid color-mix(in srgb,var(--dsh-peak-color,transparent) 55%,transparent);border-radius:5px;padding:0 5px;margin-inline-start:6px;align-self:center}html[data-dsh-peak=\"peak\"] [class*=\"_brandIdentity\"]::after{--dsh-peak-color:var(--dsw-alias-state-warn-primary)}html[data-dsh-peak=\"off\"] [class*=\"_brandIdentity\"]::after{--dsh-peak-color:var(--dsw-alias-state-success-primary)}";
		const CSS_TAG = "dsh-sym/CostPill.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(CSS_TAG) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-sym";
			tag.dataset.pluginCss = CSS_TAG;
			tag.textContent = CSS;
			document.head.appendChild(tag);
		}
		//#endregion

		//#region locale
		const NS = "dsh-sym";
		/** Simplified Chinese dictionary and key-set source of truth. */
		const zh = {
			"amount": "¥{amount}",
			"totalTitle": "本会话总费用 {amount} 元",
			"taskTitle": "本次任务（第 {turn} 轮）费用 {amount} 元",
			"billed": "计费请求 {count} 次",
			"peak": "高峰 {count} 次",
			"allOffPeak": "全部空闲时段",
			"tierPeak": "高峰价 ×{mult}",
			"tierOffPeak": "空闲价 ×{mult}",
			"tierFlat": "单一价（该厂商不分时段）",
			"times": "{count} 次",
			"unit": "单价（元/百万）：命中 {hit} · 未命中 {miss} · 输出 {out}",
			"unitRaw": "价目原始值 $ {hit} / {miss} / {out} 每百万 · 按 1 USD = {fx} CNY 折算",
			"cacheHit": "缓存命中输入",
			"cacheMiss": "缓存未命中输入",
			"output": "输出",
			"cacheWrite": "缓存写入",
			"cacheFree": "官方不收缓存写入费",
			"subtotal": "小计 ¥{amount}",
			"notPriced": "未收录价目，未计入金额",
			"unpricedNote": "未计价模型：{models}",
			"offPeakSaved": "谷时折扣为你省下 ¥{amount}",
			"actualCost": "实际支出",
			"panelTitle": "会话花费",
			"panelHint": "点一下收起",
			"breakdownHeading": "花费明细",
			"offPeakOnly": "仅高峰/空闲定价的模型参与谷时折扣",
			"offPeakSavedLabel": "谷时为你省下",
			"taskLabel": "本次任务（第 {turn} 轮）",
			"amountLabel": "花费",
			"peakSpend": "峰时",
			"offPeakSpend": "谷时",
			"tierHeading": "按时段",
			"moveToOffPeak": "峰时改到谷时，还能再省 ¥{amount}",
			"moveToOffPeakNone": "没有可挪到谷时的峰时用量（该厂商没有谷时折扣，或本来就在谷时）",
			"unknownVendor": "未知厂商",
			"balanceTitle": "DeepSeek 账户余额（点击刷新）",
			"balanceCash": "充值余额",
			"balanceBonus": "赠送余额",
			"balanceUpdated": "更新于 {time}",
			"balanceFailed": "余额读取失败",
			"quoteAction": "引用这条回复作为上下文",
			"quickCommand": "指令",
			"displayBalance": "显示账户余额",
			"displayBalance": "显示账户余额",
			"displayCost": "显示会话计费",
			"displayMemory": "显示内存占用",
			"quickSettingsTitle": "读数与快捷按钮",
			"quickSettingsSubtitle": "共生体（symbiote）插件：控制界面上的读数与快捷按钮。",
			"quickSectionButtons": "快捷按钮",
			"displaySectionTitle": "显示项",
			"displaySectionHint": "控制界面上显示哪些信息。拨动即生效，不用保存。",
			"quickSettingsHint": "这些按钮显示在输入框左侧的竖条上。配置保存在本机浏览器里，保存后立即生效。",
			"quickSettingsLoading": "正在读取配置…",
			"quickSettingsNoRemote": "拿不到设置通道（remote.settings），无法读写配置。",
			"quickSettingsNotFound": "没找到本插件的配置项；请确认它是作为组合包装进来的。",
			"quickSettingsEnabled": "显示快捷按钮条",
			"quickSettingsAdd": "添加按钮",
			"quickSettingsLabel": "名称",
			"quickSettingsValuePrompt": "点一下填进输入框的提示词",
			"quickSettingsValueCommand": "官方命令，例如 /compact、/goal",
			"quickSettingsValueSkill": "技能名，例如 code-review",
			"quickSettingsKindCommand": "官方命令",
			"quickSettingsKindPrompt": "预设提示词",
			"quickSettingsKindSkill": "技能",
			"quickGroupCommand": "官方命令",
			"quickGroupSkill": "技能",
			"quickGroupPrompt": "提示词",
			"quickGroupHint": "排序只能在同一类里做：按钮按「官方命令 → 技能 → 提示词」三组排列，同组内用 ↑ ↓ 调整。",
			"quickCommandDegraded": "官方命令通道不可用，已退回填进输入框",
			"quickSettingsSave": "保存",
			"quickSettingsRevert": "放弃更改",
			"quickSettingsSaving": "保存中…",
			"quickSettingsSaved": "已保存 {count} 个按钮，立即生效。",
			"quickSettingsSavedSkipped": "已保存，但有 {count} 个按钮没填内容、已被跳过（它们不会显示在竖条上）。",
			"quickSettingsPickIcon": "选择图标",
			"quickSettingsMoveUp": "上移",
			"quickSettingsMoveDown": "下移",
			"quickSettingsRemove": "删除",
			"quickSettingsReset": "恢复默认",
			"quickSettingsExport": "导出 JSON",
			"quickSettingsImport": "导入 JSON",
			"quickSettingsExported": "已导出文件；换机器时导入它即可恢复。",
			"quickSettingsExportFailed": "导出失败：这个环境不允许下载文件。",
			"quickSettingsImported": "已导入 {count} 个按钮，点「保存」后生效。",
			"quickSettingsImportFailed": "导入失败：文件不是有效的按钮清单。",
			"quickSettingsNoStorage": "无法写入本机存储，改动没有保存。",
			"quoteHeader": "【引用此前的回复】",
			"quoteHint": "已插入引用标记，发送时自动展开成完整内容",
			"quoteTruncated": "（引用过长，已截断）",
			"quoteDone": "已插入引用",
			"quoteMissing": "输入框不可用，请先把光标放进输入框",
			"peakOn": "峰时",
			"peakOff": "谷时",
			"peakOnTitle": "现在是 DeepSeek 高峰时段（价格 ×1）\n周一至周五 09:00–12:00、14:00–18:00，法定节假日除外",
			"peakOffTitle": "现在是 DeepSeek 空闲时段（半价 ×0.5）\n高峰以外的时间，含周末与法定节假日全天",
			"peakUnknown": "峰谷",
			"memoryTitle": "DSH 进程内存占用（rss）",
			"copyPath": "复制路径",
			"revealInFinder": "在访达中显示",
			"copiedPath": "已复制路径",
			"revealFailed": "无法在访达中显示：{reason}",
			"shotBusy": "正在截图…",
			"shotDone": "已截好，放进输入框并复制到剪贴板",
			"shotEmpty": "没有截到图",
			"shotUnavailable": "当前环境不支持应用内截图（系统未放开屏幕捕获），请用 ⌘⇧4 截图后按 ⌘V",
			"shotNoEditor": "找不到输入框",
			"shotCopied": "已复制到系统剪贴板，按 ⌘V 放进输入框"
		};
		const en = {
			"amount": "¥{amount}",
			"totalTitle": "This session: {amount} CNY",
			"taskTitle": "This task (turn {turn}): {amount} CNY",
			"billed": "{count} billed requests",
			"peak": "{count} at peak",
			"allOffPeak": "all off-peak",
			"tierPeak": "peak rate ×{mult}",
			"tierOffPeak": "off-peak rate ×{mult}",
			"tierFlat": "single rate (no time-of-day pricing)",
			"times": "{count}×",
			"unit": "rate (CNY / 1M): hit {hit} · miss {miss} · out {out}",
			"unitRaw": "list price $ {hit} / {miss} / {out} per 1M · converted at 1 USD = {fx} CNY",
			"cacheHit": "Cached input",
			"cacheMiss": "Uncached input",
			"output": "Output",
			"cacheWrite": "Cache write",
			"cacheFree": "no cache-write fee",
			"subtotal": "subtotal ¥{amount}",
			"notPriced": "no price found; excluded from the amount",
			"unpricedNote": "Unpriced models: {models}",
			"offPeakSaved": "Off-peak discount ¥{amount}",
			"actualCost": "Actually spent",
			"panelTitle": "Session cost",
			"panelHint": "click to collapse",
			"breakdownHeading": "Cost breakdown",
			"offPeakOnly": "only peak/off-peak priced models take the off-peak discount",
			"offPeakSavedLabel": "Off-peak saved you",
			"taskLabel": "This task (turn {turn})",
			"amountLabel": "Cost",
			"peakSpend": "Peak",
			"offPeakSpend": "Off-peak",
			"tierHeading": "By tier",
			"moveToOffPeak": "Moving peak usage to off-peak saves another ¥{amount}",
			"moveToOffPeakNone": "nothing to move — this vendor has no off-peak discount, or it was already all off-peak",
			"unknownVendor": "unknown vendor",
			"balanceTitle": "DeepSeek account balance (click to refresh)",
			"balanceCash": "Credit",
			"balanceBonus": "Bonus",
			"balanceUpdated": "Updated {time}",
			"balanceFailed": "Balance unavailable",
			"quoteAction": "Quote this reply as context",
			"quickCommand": "Command",
			"displayBalance": "Show account balance",
			"displayCost": "Show session cost",
			"displayMemory": "Show memory usage",
			"quickSettingsTitle": "Readouts & quick buttons",
			"quickSettingsSubtitle": "Symbiote plugin: readout toggles and the quick-button rail.",
			"quickSectionButtons": "Quick buttons",
			"displaySectionTitle": "Visibility",
			"displaySectionHint": "Which readouts appear in the UI. Changes apply immediately, no save needed.",
			"quickSettingsHint": "These buttons live on the rail left of the composer. The list is stored in this browser and applies immediately.",
			"quickSettingsLoading": "Reading configuration…",
			"quickSettingsNoRemote": "The settings channel (remote.settings) is unavailable, so configuration cannot be read or written.",
			"quickSettingsNotFound": "No configuration entry found for this plugin; make sure it was installed as a bundle.",
			"quickSettingsEnabled": "Show the quick-button rail",
			"quickSettingsAdd": "Add button",
			"quickSettingsLabel": "Label",
			"quickSettingsValuePrompt": "Prompt text to drop into the composer",
			"quickSettingsValueCommand": "Official command, e.g. /compact or /goal",
			"quickSettingsValueSkill": "Skill name, e.g. code-review",
			"quickSettingsKindCommand": "Official command",
			"quickSettingsKindPrompt": "Preset prompt",
			"quickSettingsKindSkill": "Skill",
			"quickGroupCommand": "Official commands",
			"quickGroupSkill": "Skills",
			"quickGroupPrompt": "Prompts",
			"quickGroupHint": "Ordering stays inside a group: buttons are arranged as commands → skills → prompts, reordered with ↑ ↓ within their own group.",
			"quickCommandDegraded": "Official command channel unavailable; fell back to filling the composer",
			"quickSettingsSave": "Save",
			"quickSettingsRevert": "Discard changes",
			"quickSettingsSaving": "Saving…",
			"quickSettingsSaved": "Saved {count} buttons; effective immediately.",
			"quickSettingsSavedSkipped": "Saved, but {count} button(s) had no content and were skipped (they will not appear on the rail).",
			"quickSettingsPickIcon": "Choose icon",
			"quickSettingsMoveUp": "Move up",
			"quickSettingsMoveDown": "Move down",
			"quickSettingsRemove": "Remove",
			"quickSettingsReset": "Restore defaults",
			"quickSettingsExport": "Export JSON",
			"quickSettingsImport": "Import JSON",
			"quickSettingsExported": "File exported; import it on another machine to restore.",
			"quickSettingsExportFailed": "Export failed: this environment does not allow downloads.",
			"quickSettingsImported": "Imported {count} buttons; press Save to apply.",
			"quickSettingsImportFailed": "Import failed: the file is not a valid button list.",
			"quickSettingsNoStorage": "Could not write to local storage; nothing was saved.",
			"quoteHeader": "[Quoted earlier reply]",
			"quoteHint": "Quote mark inserted; it expands to the full reply on send",
			"quoteTruncated": "(quote truncated: reply was longer)",
			"quoteDone": "Quote inserted",
			"quoteMissing": "Composer unavailable; put the caret in the input first",
			"peakOn": "Peak",
			"peakOff": "Off-peak",
			"peakOnTitle": "DeepSeek peak window (rate ×1)\nMon–Fri 09:00–12:00 and 14:00–18:00 Beijing, public holidays excluded",
			"peakOffTitle": "DeepSeek off-peak window (half rate ×0.5)\nEverything outside peak, weekends and public holidays included",
			"peakUnknown": "Rate",
			"memoryTitle": "Resident memory of the DSH process (rss)",
			"copyPath": "Copy path",
			"revealInFinder": "Reveal in Finder",
			"copiedPath": "Path copied",
			"revealFailed": "Could not reveal: {reason}",
			"shotBusy": "Capturing…",
			"shotDone": "Captured, placed in the composer and copied to the clipboard",
			"shotEmpty": "Nothing captured",
			"shotUnavailable": "This environment has no in-app screen capture (the app does not enable it); use ⌘⇧4 then ⌘V",
			"shotNoEditor": "Composer not found",
			"shotCopied": "Copied to the system clipboard — press ⌘V to drop it into the composer"
		};
		/** `{name}` substitution, shared by the seat and the built-in fallback. */
		function fill(template, params) {
			return String(template).replace(/\{(\w+)\}/g, (match, key) => (params !== void 0 && Object.hasOwn(params, key) ? String(params[key]) : match));
		}
		/**
		* Read one dictionary entry through the slot's locale seat, falling back to
		* the built-in Chinese dictionary when no seat was supplied.
		* @param t - the slot's translate seat, when the owner projects one.
		* @param key - dictionary key.
		* @param params - substitution values.
		* @returns display text.
		*/
		function tr(t, key, params) {
			if (typeof t === "function") {
				const value = t(key, params);
				if (typeof value === "string" && value.length > 0 && value !== key) return value;
			}
			return fill(Object.hasOwn(zh, key) ? zh[key] : key, params);
		}
		//#endregion

		//#region formatting
		/**
		* Adaptive precision for a money amount: a fresh session costs fractions of
		* a fen, a long one costs yuan.
		* @param value - CNY amount.
		* @returns the amount without its currency mark.
		*/
		function formatCny(value) {
			if (!Number.isFinite(value) || value <= 0) return "0.00";
			if (value >= 1) return value.toFixed(2);
			if (value >= 0.01) return value.toFixed(3);
			return value.toFixed(4);
		}
		/**
		* A unit price, trimmed of trailing zeros so the tooltip reads like a price
		* list rather than a spreadsheet.
		* @param value - price per 1M tokens.
		* @returns display text.
		*/
		function formatRate(value) {
			if (!Number.isFinite(value) || value === 0) return "0";
			if (value >= 1) return String(Math.round(value * 100) / 100);
			if (value >= 0.01) return String(Math.round(value * 1000) / 1000);
			return String(Math.round(value * 1e6) / 1e6);
		}
		/**
		* Compact token count, matching the neighbouring usage pill's scale.
		* @param value - token count.
		* @returns display text.
		*/
		function formatTokens(value) {
			if (!Number.isFinite(value) || value <= 0) return "0";
			if (value >= 1e9) return (value / 1e9).toFixed(2) + "B";
			if (value >= 1e6) return (value / 1e6).toFixed(1) + "M";
			if (value >= 1e3) return (value / 1e3).toFixed(1) + "K";
			return String(Math.round(value));
		}
		/**
		* A wallet amount with its currency mark and digit grouping, following the
		* Platform's own presentation: two decimals, sub-cent shown as `<0.01`.
		* @param amount - the wallet's balance string.
		* @param currency - `CNY`, `USD`, or anything else.
		* @returns display text.
		*/
		function formatWallet(amount, currency) {
			const mark = currency === "CNY" ? "¥" : currency === "USD" ? "$" : String(currency) + " ";
			const value = Number(amount);
			if (!Number.isFinite(value)) return mark + String(amount);
			if (value > 0 && value < 0.01) return mark + "<0.01";
			const magnitude = Math.abs(value) < 0.01 && value !== 0 ? 0.01 : Math.abs(value);
			return (value < 0 ? "-" : "") + mark + magnitude.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
		}
		/** Bucket-wise sum of two bucket records. */
		function addBuckets(left, right) {
			return {
				cacheHit: (left?.cacheHit ?? 0) + (right?.cacheHit ?? 0),
				cacheMiss: (left?.cacheMiss ?? 0) + (right?.cacheMiss ?? 0),
				cacheWrite: (left?.cacheWrite ?? 0) + (right?.cacheWrite ?? 0),
				output: (left?.output ?? 0) + (right?.output ?? 0)
			};
		}
		function isZeroBuckets(buckets) {
			return buckets.cacheHit === 0 && buckets.cacheMiss === 0 && buckets.cacheWrite === 0 && buckets.output === 0;
		}
		//#endregion

		//#region breakdown
		/**
		* One model's auditable arithmetic: who served it, which price list was
		* used, whether the peak/off-peak rule applied, the unit prices actually
		* charged, and each bucket's `tokens × rate = amount`.
		* @param entry - the view's per-model record.
		* @param t - translate seat.
		* @returns lines to append to the tooltip.
		*/
		function modelLines(entry, t) {
			const lines = [""];
			const vendor = entry.vendor || entry.provider || tr(t, "unknownVendor");
			const name = entry.label !== void 0 && entry.label !== entry.model ? entry.label + " (" + entry.model + ")" : entry.model;
			lines.push(name + " · " + vendor + (entry.source !== void 0 && entry.source !== "" ? " · " + entry.source : ""));
			if (entry.known !== true) {
				lines.push("  " + tr(t, "notPriced"));
				return lines;
			}
			const rates = entry.rates ?? {};
			const tokens = entry.tokens ?? {};
			const cost = entry.cost ?? {};
			// A vendor without time-of-day pricing bills one rate, so its two
			// wall-clock buckets are reported as the single tier they really are.
			const tiers = entry.peakPriced === true
				? [["peak", tr(t, "tierPeak", { mult: 1 })], ["offPeak", tr(t, "tierOffPeak", { mult: 0.5 })]]
				: [["flat", tr(t, "tierFlat")]];
			for (const pair of tiers) {
				const tier = pair[0];
				const applied = tier === "flat" ? rates.offPeak : rates[tier];
				if (applied === void 0) continue;
				const tierTokens = tier === "flat" ? addBuckets(tokens.peak, tokens.offPeak) : tokens[tier];
				const tierCost = tier === "flat" ? addBuckets(cost.peak, cost.offPeak) : cost[tier];
				const requests = tier === "flat"
					? (entry.requests?.peak ?? 0) + (entry.requests?.offPeak ?? 0)
					: (entry.requests?.[tier] ?? 0);
				if (requests === 0 && isZeroBuckets(tierTokens)) continue;
				lines.push("  " + pair[1] + " · " + tr(t, "times", { count: requests }));
				lines.push("    " + tr(t, "unit", {
					hit: formatRate(applied.cny.cacheHit),
					miss: formatRate(applied.cny.cacheMiss),
					out: formatRate(applied.cny.output)
				}));
				if (entry.fx !== null && entry.fx !== void 0) {
					lines.push("    " + tr(t, "unitRaw", {
						hit: formatRate(applied.vendor.cacheHit),
						miss: formatRate(applied.vendor.cacheMiss),
						out: formatRate(applied.vendor.output),
						fx: entry.fx
					}));
				}
				for (const bucket of ["cacheHit", "cacheMiss", "output"]) {
					if (tierTokens[bucket] === 0) continue;
					lines.push("    " + tr(t, bucket) + " " + formatTokens(tierTokens[bucket])
						+ " × " + formatRate(applied.cny[bucket]) + " = ¥" + formatCny(tierCost[bucket]));
				}
				if ((tierTokens.cacheWrite ?? 0) > 0) {
					lines.push("    " + tr(t, "cacheWrite") + " " + formatTokens(tierTokens.cacheWrite) + " · " + tr(t, "cacheFree"));
				}
			}
			lines.push("  " + tr(t, "subtotal", { amount: formatCny(entry.cny) }));
			return lines;
		}
		/**
		* The hover breakdown of one scope (session or task).
		* @param scope - the session view or one turn entry.
		* @param t - translate seat.
		* @param title - the first line, naming the scope and the amount.
		* @returns multi-line plain text.
		*/
		/**
		* Spend split by rate tier, plus what relocating the peak half would save.
		* DeepSeek bills off-peak at half the peak rate, so every yuan spent inside a
		* peak window would have cost half as much outside one — the difference is a
		* concrete number to steer later work by. Only models the book marks as
		* peak-priced take part; a flat-priced vendor has no cheaper window and so
		* contributes nothing to the "move it" figure.
		* @param scope - the projection view or one turn's scope.
		* @returns `{ peak, offPeak, movable }` in CNY.
		*/
		function tierSpend(scope) {
			let peak = 0;
			let offPeak = 0;
			let peakPriced = 0;
			for (const entry of Array.isArray(scope?.models) ? scope.models : []) {
				if (entry.known !== true) continue;
				for (const bucket of ["cacheHit", "cacheMiss", "cacheWrite", "output"]) {
					const inPeak = entry.cost?.peak?.[bucket];
					const inOff = entry.cost?.offPeak?.[bucket];
					if (typeof inPeak === "number") {
						peak += inPeak;
						if (entry.peakPriced === true) peakPriced += inPeak;
					}
					if (typeof inOff === "number") offPeak += inOff;
				}
			}
			return { peak, offPeak, movable: peakPriced * 0.5 };
		}

		/**
		* What the off-peak discount saved across one scope, in CNY. DeepSeek bills
		* off-peak at half the peak rate, and `cost.offPeak` is what was actually
		* charged there — so without the discount that same usage would have cost
		* twice as much, and the saving equals the amount spent. Only models the
		* book marks as peak-priced take part; a flat-priced vendor gets no discount
		* and contributes nothing.
		* @param scope - the projection view or one turn's scope.
		* @returns the saving in CNY; 0 when nothing was billed off-peak.
		*/
		function offPeakSaving(scope) {
			let saved = 0;
			for (const entry of Array.isArray(scope?.models) ? scope.models : []) {
				if (entry.known !== true || entry.peakPriced !== true) continue;
				const cost = entry.cost?.offPeak;
				if (cost === void 0) continue;
				for (const bucket of ["cacheHit", "cacheMiss", "cacheWrite", "output"]) {
					if (typeof cost[bucket] === "number") saved += cost[bucket];
				}
			}
			return saved;
		}

		function describeScope(scope, t, title) {
			const lines = [title];
			lines.push(tr(t, "billed", { count: scope.requests })
				+ " · " + (scope.peakRequests > 0 ? tr(t, "peak", { count: scope.peakRequests }) : tr(t, "allOffPeak")));
			for (const entry of scope.models ?? []) lines.push(...modelLines(entry, t));
			const tiers = tierSpend(scope);
			if (tiers.peak > 0 || tiers.offPeak > 0) {
				lines.push("");
				lines.push(tr(t, "tierHeading"));
				if (tiers.peak > 0) lines.push("  " + tr(t, "peakSpend") + " ¥" + formatCny(tiers.peak));
				if (tiers.offPeak > 0) lines.push("  " + tr(t, "offPeakSpend") + " ¥" + formatCny(tiers.offPeak));
				lines.push("  " + (tiers.movable > 0 ? tr(t, "moveToOffPeak", { amount: formatCny(tiers.movable) }) : tr(t, "moveToOffPeakNone")));
			}
			// 只报谷时折扣。缓存省下曾被写在这里，但它是个反事实数字——拿命中的
			// token 去乘「未命中价 − 命中价」，等于假设没有缓存时这些 token 照样
			// 会以未命中价计费；用户认为这个说法夸大，已整块移除。
			const offSaved = offPeakSaving(scope);
			if (offSaved > 0) {
				lines.push("");
				lines.push(tr(t, "offPeakSaved", { amount: formatCny(offSaved) }));
			}
			if (Array.isArray(scope.unpriced) && scope.unpriced.length > 0) {
				lines.push("");
				lines.push(tr(t, "unpricedNote", { models: scope.unpriced.join(", ") }));
			}
			return lines.join("\n");
		}
		//#endregion

		//#region memory
		/**
		* Bytes as a short readout: `1.8G`, `456M`.
		* @param value - bytes.
		* @returns the label, or null when there is nothing to show.
		*/
		function formatBytes(value) {
			if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
			if (value >= 1024 * 1024 * 1024) return (value / (1024 * 1024 * 1024)).toFixed(1) + "G";
			return Math.round(value / (1024 * 1024)) + "M";
		}

		/**
		* A chip glyph: a square die with pins on all four sides. Deliberately unlike
		* the shipped context gauge, which is a ring — both are resource readouts and
		* sitting side by side, so they must not read as the same shape family. The
		* earlier memory-module outline (a wide rectangle with pins) was too close to
		* the banknote glyph next to it.
		* @returns the icon.
		*/
		function MemoryGlyph() {
			return React.createElement("svg", {
				viewBox: "0 0 16 16",
				"aria-hidden": true,
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.3,
				strokeLinejoin: "round",
				strokeLinecap: "round"
			}, [
				React.createElement("rect", { key: "die", x: "4", y: "4", width: "8", height: "8", rx: "1.6" }),
				React.createElement("rect", { key: "core", x: "6.6", y: "6.6", width: "2.8", height: "2.8", rx: ".6" }),
				React.createElement("path", { key: "pins", d: "M6.2 4V2.1M9.8 4V2.1M6.2 14v-1.9M9.8 14v-1.9M4 6.2H2.1M4 9.8H2.1M14 6.2h-1.9M14 9.8h-1.9" })
			]);
		}

		//#endregion

		//#region link menu
		/**
		* Path prefixes that mean "this link points at a real file on disk". The
		* browser resolves a Markdown link written as `/Users/...` against the app
		* origin, so the location keeps the original path in its `pathname` — that is
		* what gets handed back here. Anything else (a normal web link, an app route)
		* returns null and the shipped context menu keeps working.
		*/
		const LOCAL_PATH_PREFIXES = ["/Users/", "/home/", "/Volumes/", "/private/", "/tmp/", "/opt/", "/var/", "/usr/"];

		/**
		* The on-disk path a link points at.
		* @param anchor - the clicked `a`, if any.
		* @returns the decoded absolute path, or null when this is not a file link.
		*/
		function filePathOfLink(anchor) {
			if (anchor === null || anchor === void 0 || typeof anchor.getAttribute !== "function") return null;
			const raw = anchor.getAttribute("href") ?? "";
			if (raw === "" || raw.startsWith("#")) return null;
			let pathname = raw;
			try {
				pathname = new URL(raw, window.location.href).pathname;
			} catch (error) {
				noteDegrade("link:url", describeError(error));
				return null;
			}
			for (const prefix of LOCAL_PATH_PREFIXES) {
				if (pathname.startsWith(prefix)) {
					try {
						return decodeURIComponent(pathname);
					} catch (error) {
						noteDegrade("link:decode", describeError(error));
						return pathname;
					}
				}
			}
			return null;
		}

		/**
		* A context menu for file links in the transcript. Only file links are taken
		* over — everywhere else the shipped menu is left alone — and it offers the
		* two things a plain click cannot: the path on the clipboard, and the reveal
		* the Host already exposes through `session.openWorkspacePath`.
		* @param props - `t` and the account/session `remote` face.
		* @returns nothing visible; the menu is portalled while open.
		*/
		function LinkContextMenu(props) {
			const t = props.t;
			const [menu, setMenu] = React.useState(null);
			const [note, setNote] = React.useState("");
			const menuRef = React.useRef(null);
			React.useEffect(() => {
				const onContext = (event) => {
					const target = event.target;
					const anchor = target !== null && target !== void 0 && typeof target.closest === "function" ? target.closest("a") : null;
					const path = filePathOfLink(anchor);
					if (path === null) return;
					event.preventDefault();
					setNote("");
					setMenu({ x: event.clientX, y: event.clientY, path });
				};
				const onDown = (event) => {
					if (menuRef.current?.contains(event.target) === true) return;
					setMenu(null);
				};
				const onKey = (event) => {
					if (event.key === "Escape") setMenu(null);
				};
				document.addEventListener("contextmenu", onContext, true);
				document.addEventListener("pointerdown", onDown, true);
				document.addEventListener("keydown", onKey);
				return () => {
					document.removeEventListener("contextmenu", onContext, true);
					document.removeEventListener("pointerdown", onDown, true);
					document.removeEventListener("keydown", onKey);
				};
			}, []);
			if (menu === null || ReactDOM === null) return null;
			const copy = () => {
				try {
					void navigator.clipboard.writeText(menu.path);
					setNote(tr(t, "copiedPath"));
				} catch (error) {
					noteDegrade("link:clipboard", describeError(error));
					setNote(menu.path);
				}
			};
			const reveal = () => {
				const call = remote?.session?.openWorkspacePath;
				if (typeof call !== "function") {
					setNote(tr(t, "revealFailed", { reason: "no session remote" }));
					return;
				}
				Promise.resolve(call({ path: menu.path, action: "reveal" })).then(
					() => setMenu(null),
					(error) => setNote(tr(t, "revealFailed", { reason: String(error?.message ?? error).slice(0, 80) }))
				);
			};
			// Keep the card inside the viewport without measuring it first.
			const style = {
				left: Math.max(8, Math.min(menu.x, window.innerWidth - 300)) + "px",
				top: Math.max(8, Math.min(menu.y, window.innerHeight - 140)) + "px"
			};
			return ReactDOM.createPortal(React.createElement("div", {
				className: "dshSym_menu",
				role: "menu",
				ref: menuRef,
				style,
				"data-sym-link-menu": true
			}, [
				React.createElement("div", { className: "dshSym_menuPath", key: "p" }, menu.path),
				React.createElement("button", { className: "dshSym_menuItem", type: "button", role: "menuitem", key: "c", onClick: copy }, tr(t, "copyPath")),
				React.createElement("button", { className: "dshSym_menuItem", type: "button", role: "menuitem", key: "r", onClick: reveal }, tr(t, "revealInFinder")),
				note === "" ? null : React.createElement("div", { className: "dshSym_menuPath", key: "n" }, note)
			]), document.body);
		}
		//#endregion

		//#region cost panel
		/**
		* One row of the panel.
		* @param props - `label`, `value`, and optional `muted` / `save` styling.
		* @returns the row element.
		*/
		function PanelRow(props) {
			const cls = "dshSym_panelRow" + (props.save === true ? " dshSym_panelSave" : "") + (props.muted === true ? " dshSym_panelMuted" : "");
			// `data` carries the stable `data-sym-*` readout markers (AUD-QUAL-003):
			// they exist so a verification script can assert "this row rendered and
			// said this", which the class names alone cannot promise.
			return React.createElement("div", { className: cls, ...(props.data ?? {}) }, [
				React.createElement("span", { key: "l" }, props.label),
				React.createElement("span", { key: "v" }, props.value)
			]);
		}

		/**
		* The click-to-open cost panel. The shipped usage readout opens a dialog the
		* same way, but its `useStatDialog` hook and stylesheet are private, so this
		* measures its own trigger and portals its own card. Content is money only:
		* the spend split by tier, what the cache and the off-peak discount saved,
		* what it would have cost without them, what moving peak usage would save,
		* and the selected turn's own figure. Token counts are left to the shipped
		* usage readout rather than repeated here.
		* @param props - `scope` (the view), `task` (the selected turn's scope or null), `t`.
		* @returns the trigger and, while open, the portalled panel.
		*/
		function CostPanel(props) {
			const t = props.t;
			const scope = props.scope;
			const task = props.task;
			const [open, setOpen] = React.useState(false);
			const [pos, setPos] = React.useState(null);
			const wrapRef = React.useRef(null);
			const panelRef = React.useRef(null);
			// Dismiss on an outside press or Escape, the way the shipped dialogs do.
			React.useEffect(() => {
				if (!open) return undefined;
				const onDown = (event) => {
					const target = event.target;
					if (panelRef.current?.contains(target) === true) return;
					if (wrapRef.current?.contains(target) === true) return;
					setOpen(false);
				};
				const onKey = (event) => {
					if (event.key === "Escape") setOpen(false);
				};
				document.addEventListener("pointerdown", onDown, true);
				document.addEventListener("keydown", onKey);
				return () => {
					document.removeEventListener("pointerdown", onDown, true);
					document.removeEventListener("keydown", onKey);
				};
			}, [open]);
			const toggle = () => {
				if (!open && wrapRef.current !== null) {
					const rect = wrapRef.current.getBoundingClientRect();
					setPos({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 300)), bottom: Math.max(8, window.innerHeight - rect.top + 8) });
				}
				setOpen(!open);
			};
			const savedOff = offPeakSaving(scope);
			const spent = typeof scope.cny === "number" ? scope.cny : 0;
			// Token counts are deliberately absent: the shipped usage readout already
			// reports them, and repeating them here only diluted the money figures.
			const tiers = tierSpend(scope);
			const rows = [];
			// No "actual spend" row: the header already carries that figure.
			// Peak and off-peak share one line — they are a split of the same total,
			// and the off-peak figure doubles as the discount below, so the heading
			// that used to introduce them is gone too.
			if (tiers.peak > 0 || tiers.offPeak > 0) {
				const split = [];
				if (tiers.peak > 0) split.push(tr(t, "peakSpend") + " ¥" + formatCny(tiers.peak));
				if (tiers.offPeak > 0) split.push(tr(t, "offPeakSpend") + " ¥" + formatCny(tiers.offPeak));
				rows.push(React.createElement("div", {
					className: "dshSym_panelRow dshSym_panelMuted",
					key: "tier",
					"data-sym-tier-spend": "peak=" + String(tiers.peak) + ";offPeak=" + String(tiers.offPeak)
				}, React.createElement("span", null, split.join("  ·  "))));
			}
			// 缓存省下与「原本要花多少」都已移除：前者是反事实数字，后者是它的产物，
			// 留着会让面板上唯一的一笔省下（谷时折扣）对不上任何总数。
			if (savedOff > 0) {
				rows.push(React.createElement("div", { className: "dshSym_panelRule", key: "r0" }));
				rows.push(React.createElement(PanelRow, {
					key: "o",
					label: tr(t, "offPeakSavedLabel"),
					value: "¥" + formatCny(savedOff),
					save: true,
					data: { "data-sym-offpeak-saved": formatCny(savedOff) }
				}));
			}
			if (tiers.movable > 0) {
				rows.push(React.createElement("div", { className: "dshSym_panelRule", key: "r1" }));
				rows.push(React.createElement("div", {
					className: "dshSym_panelNudge",
					key: "nudge",
					"data-sym-move-nudge": formatCny(tiers.movable)
				}, "\u{1F4A1} " + tr(t, "moveToOffPeak", { amount: formatCny(tiers.movable) })));
			}
			if (task !== null && task !== void 0) {
				rows.push(React.createElement("div", { className: "dshSym_panelRule", key: "r3" }));
				rows.push(React.createElement("div", { className: "dshSym_panelHeading", key: "h2" }, tr(t, "taskLabel", { turn: task.turn })));
				rows.push(React.createElement(PanelRow, { key: "taskCost", label: tr(t, "amountLabel"), value: "¥" + formatCny(task.cny), muted: true }));
			}
			const panel = open && pos !== null && ReactDOM !== null
				? ReactDOM.createPortal(React.createElement("div", {
					className: "dshSym_panel",
					role: "dialog",
					"aria-label": tr(t, "panelTitle"),
					style: { left: pos.left + "px", bottom: pos.bottom + "px" },
					"data-sym-cost-panel": true,
					ref: panelRef
				}, [
					React.createElement("div", { className: "dshSym_panelTitle", key: "t" }, [
						React.createElement("span", { key: "l" }, tr(t, "panelTitle")),
						React.createElement("span", { className: "dshSym_panelMuted", key: "v" }, tr(t, "amount", { amount: formatCny(spent) }))
					]),
					...rows
				]), document.body)
				: null;
			// 面板触发器是个 `display:contents` 的 span：按下它会让当前焦点掉到 body，
			// 正在打字时点一下花费就得重新点回输入框，所以和按钮一样阻止默认行为。
			// 只阻止"被抢"，不主动把焦点抓过来 —— 看花费不是要写字。
			return React.createElement("span", { className: "dshSym_panelWrap", ref: wrapRef, "data-open": open ? "true" : void 0 }, [
				React.createElement("span", { key: "g", onClick: toggle, onMouseDown: keepComposerFocus, style: { display: "contents" } }, props.children),
				panel
			]);
		}
		//#endregion

		//#region active turn
		/**
		* The turn the chat's right-hand rail currently marks. The shipped Chat view
		* keeps that selection in component-local state and projects it to no slot,
		* so the rail's own accessibility contract is the readable source: the active
		* mark is the only `button[aria-current="true"]` inside a navigation whose
		* marks are labelled with their turn number.
		* @returns the active turn number, or null when no rail is on screen.
		*/
		function readActiveTurn() {
			if (typeof document === "undefined") return null;
			for (const nav of document.querySelectorAll("nav")) {
				const marks = nav.querySelectorAll("button");
				if (marks.length < 2) continue;
				let labelled = 0;
				for (const mark of marks) if (/\d/.test(mark.getAttribute("aria-label") || "")) labelled += 1;
				// A nav whose marks are numbered is the turn rail; the sidebar and
				// header navs are not.
				if (labelled < 2) continue;
				const active = nav.querySelector('button[aria-current="true"]');
				if (active === null) continue;
				const match = /\d+/.exec(active.getAttribute("aria-label") || "");
				if (match !== null) return Number(match[0]);
			}
			return null;
		}
		/**
		* Follow the rail's active mark across scroll and click, coalesced to one
		* read per animation frame.
		* @returns the active turn number, or null.
		*/
		function useActiveTurn() {
			const [turn, setTurn] = React.useState(() => readActiveTurn());
			React.useEffect(() => {
				let frame = 0;
				const sync = () => {
					frame = 0;
					const next = readActiveTurn();
					setTurn((previous) => (previous === next ? previous : next));
				};
				const schedule = () => {
					if (frame === 0) frame = requestAnimationFrame(sync);
				};
				const observer = new MutationObserver(schedule);
				observer.observe(document.body, {
					subtree: true,
					childList: true,
					attributes: true,
					attributeFilter: ["aria-current"]
				});
				schedule();
				return () => {
					observer.disconnect();
					if (frame !== 0) cancelAnimationFrame(frame);
				};
			}, []);
			return turn;
		}
		/**
		* Pick the task to price: the rail's selection when the log folded it,
		* otherwise the newest turn.
		* @param turns - the view's per-turn entries, ascending.
		* @param activeTurn - the rail's active turn number.
		* @returns the entry, or null.
		*/
		function pickTurn(turns, activeTurn) {
			if (turns.length === 0) return null;
			if (activeTurn !== null) {
				const hit = turns.find((entry) => entry.turn === activeTurn);
				if (hit !== void 0) return hit;
			}
			return turns[turns.length - 1];
		}
		//#endregion

		//#region account balance
		/** Last balance read, so a remounted cell has something to paint immediately. */
		let balanceCache = null;

		/** How often a mounted balance cell re-reads while it has a figure to keep fresh. */
		const BALANCE_REFRESH_MS = 60000;
		/** The slower beat used while there is nothing to show, e.g. after a sign-out. */
		const BALANCE_RETRY_MS = 300000;

		/**
		* Build the sidebar-foot balance cell for one plugin context. The account
		* Remote namespace is captured in the closure, so the component needs no
		* extra slot hook and never holds a stale service.
		* @param ctx - the client context that injected `remote.account`.
		* @returns the slot component.
		*/
		/**
		* 取数失败时的下一个状态：**保留最近一次成功的数值**，只标记为 stale。
		*
		* 直接清空会让元素消失，而元素消失正是「闪」的来源 —— 它还会连带影响官方
		* footer 的布局。宁可显示一个稍旧的数字（用 `stale` 变淡表示），也不要让它闪。
		* @returns 下一个状态。
		*/
		function unavailableBalance() {
			if (balanceCache !== null && balanceCache !== void 0 && balanceCache.status === "ready") {
				return Object.assign({}, balanceCache, { stale: true });
			}
			return { status: "unavailable" };
		}

		function createBalanceCell(ctx) {
			/** The identity headers the Platform expects from this UI, read per call. */
			const clientIdentity = () => {
				let locale = "zh-CN";
				try {
					const snapshot = ctx.locale.getSnapshot();
					if (typeof snapshot?.active === "string") locale = snapshot.active;
				} catch (error) { noteDegrade("identity:locale", describeError(error)) }
				return {
					version: "unknown",
					locale,
					timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60
				};
			};
			return function BalanceCell(props) {
				// Seeded from the last read so a remount paints the figure at once
				// instead of blinking through an empty first frame.
				const [state, setState] = React.useState(() => balanceCache ?? { status: "loading" });
				const alive = React.useRef(true);
				const read = React.useCallback(async () => {
					let next;
					try {
						const result = await ctx.remote.account.getBalance(clientIdentity());
						const value = result !== null && result !== void 0 && result.ok === true ? result.value : null;
						if (value === null || value === void 0 || value.status !== "ready") {
							next = unavailableBalance();
						} else {
							next = {
								status: "ready",
								wallets: Array.isArray(value.value) ? value.value : [],
								bonusWallets: Array.isArray(value.bonusWallets) ? value.bonusWallets : [],
								at: Date.now()
							};
						}
					} catch (error) {
						noteDegrade("balance:remote", describeError(error));
						next = unavailableBalance();
					}
					balanceCache = next;
					if (alive.current) setState(next);
				}, []);
				React.useEffect(() => {
					alive.current = true;
					read();
					return () => {
						alive.current = false;
					};
				}, [read]);
				// Re-read on a slow beat, and much more slowly while there is no
				// balance to show, so a signed-out client barely touches the account
				// seam.
				const period = state.status === "ready" ? BALANCE_REFRESH_MS : BALANCE_RETRY_MS;
				React.useEffect(() => {
					const timer = setInterval(read, period);
					return () => {
						clearInterval(timer);
					};
				}, [read, period]);
				const display = useDisplayOptions();
				const t = props.t;
				// 设置里关掉了就整块不渲染（放在 hooks 之后，保证 hook 调用顺序稳定）。
				if (display.balance === false) return null;
				// **始终渲染**，数据没到就显示占位符。元素忽隐忽现本身就是一次布局跳动 ——
				// 它在输入框工具行里，出现/消失会把身旁的模型选择器推一下，这就是最后剩下的那一下闪。
				// 再配合 CSS 的固定最小宽度，"位数变化"也不会推动布局。
				const wallet = state.status === "ready" ? pickWallet(state.wallets) : null;
				const bonus = state.status === "ready" ? pickWallet(state.bonusWallets) : null;
				const lines = [tr(t, "balanceTitle")];
				if (wallet === null) {
					lines.push(tr(t, "balanceLoading"));
				} else {
					lines.push(tr(t, "balanceCash") + " " + formatWallet(wallet.balance, wallet.currency));
					if (bonus !== null && bonus !== void 0) lines.push(tr(t, "balanceBonus") + " " + formatWallet(bonus.balance, bonus.currency));
				}
				if (typeof state.at === "number") {
					const clock = new Date(state.at);
					lines.push(tr(t, "balanceUpdated", {
						time: String(clock.getHours()).padStart(2, "0") + ":" + String(clock.getMinutes()).padStart(2, "0")
					}));
				}
				const title = lines.join("\n");
				return React.createElement("button", {
					type: "button",
					className: "dshBalance_root",
					title,
					"aria-label": title,
					"data-account-balance": true,
					"data-stale": state.stale === true ? "true" : void 0,
					// 工具行里点一下不该把输入框的光标弄丢（点非聚焦元素会把焦点甩给 body）。
					onMouseDown: keepComposerFocus,
					onClick: () => {
						read();
					}
				}, [
					React.createElement(WalletGlyph, { key: "glyph" }),
					React.createElement("span", { className: "dshBalance_value", key: "value" },
						wallet === null ? "\u2014" : formatWallet(wallet.balance, wallet.currency))
				]);
			};
		}

		/**
		* The wallet to show on the cell: the CNY credit wallet when the account has
		* one, otherwise whatever credit wallet the Platform returned.
		* @param wallets - the account's credit wallets.
		* @returns the chosen wallet, or null.
		*/
		function pickWallet(wallets) {
			if (!Array.isArray(wallets) || wallets.length === 0) return null;
			return wallets.find((wallet) => wallet !== null && typeof wallet === "object" && wallet.currency === "CNY") ?? wallets[0];
		}

		/** The wallet glyph: a stacked-coins mark, distinct from the cost cells' marks. */
		function WalletGlyph() {
			return React.createElement("svg", {
				viewBox: "0 0 16 16",
				"aria-hidden": true,
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.3
			}, React.createElement("rect", { x: "1.4", y: "3.6", width: "13.2", height: "8.8", rx: "2" }), React.createElement("path", { d: "M1.4 6.6h13.2" }), React.createElement("circle", { cx: "11.2", cy: "9.6", r: "1.1", fill: "currentColor", stroke: "none" }));
		}

		//#endregion

		//#region turn cost
		/**
		* The Turn a durable assistant message belongs to, read from the chat store.
		* @param order - the store's node keys, in transcript order.
		* @param nodes - the store's node map.
		* @param messageId - the durable assistant message id.
		* @returns the Turn number, or null.
		*/
		function findMessageTurn(order, nodes, messageId) {
			if (!Array.isArray(order) || messageId === undefined) return null;
			for (const key of order) {
				const node = nodes.get(key);
				const data = node?.data;
				if (data === undefined) continue;
				const id = data.messageId ?? data.finalNode?.messageId;
				if (id !== messageId) continue;
				const turn = data.turn ?? data.finalNode?.turn;
				return typeof turn === "number" ? turn : null;
			}
			return null;
		}

		/**
		* What this one Turn cost, shown on that Turn's own action row rather than
		* only on the composer readout. The row's usage figure and its clock share one
		* flex container, so `order` seats this cell between them.
		* @param props - slot props; `messageId` names the reply.
		* @returns the cell, or null when this Turn has no priced usage.
		*/
		function TurnCostCell(props) {
			const useProjection = props.useProjection;
			const useChat = props.useChat;
			const t = props.t;
			const messageId = props.messageId;
			const view = useProjection(PROJECTION_KEY);
			const turn = useChat((state) => findMessageTurn(state.order, state.nodes, messageId));
			if (view === null || view === void 0 || turn === null) return null;
			const turns = Array.isArray(view.turns) ? view.turns : [];
			const scope = turns.find((item) => item.turn === turn);
			if (scope === void 0) return null;
			return React.createElement("span", {
				className: "dshSymTurnCost",
				title: describeScope(scope, t, tr(t, "taskTitle", { turn, amount: formatCny(scope.cny) })),
				"data-sym-turn-cost": String(turn)
			}, [
				React.createElement(TaskGlyph, { key: "g" }),
				React.createElement("span", { key: "v" }, tr(t, "amount", { amount: formatCny(scope.cny) }))
			]);
		}
		//#endregion

		//#region peak tag
		/**
		* Chinese statutory public holidays in Beijing time, mirroring the host
		* half's table. The brand row is root-scoped, so it has no Session projection
		* to read and works the window out locally.
		*/
		const PEAK_HOLIDAYS = new Set([
			"2026-01-01", "2026-01-02", "2026-01-03",
			"2026-02-15", "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19",
			"2026-02-20", "2026-02-21", "2026-02-22", "2026-02-23",
			"2026-04-04", "2026-04-05", "2026-04-06",
			"2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04", "2026-05-05",
			"2026-06-19", "2026-06-20", "2026-06-21",
			"2026-09-25", "2026-09-26", "2026-09-27",
			"2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05",
			"2026-10-06", "2026-10-07"
		]);

		/**
		* Whether DeepSeek bills its peak rate right now: Beijing time, Monday to
		* Friday, public holidays excluded, 09:00–12:00 and 14:00–18:00.
		* @param now - epoch milliseconds.
		* @returns true inside a peak window.
		*/
		function isPeakNow(now) {
			const shifted = new Date(now + 8 * 60 * 60 * 1000);
			const day = shifted.getUTCDay();
			if (day === 0 || day === 6) return false;
			const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
			const date = String(shifted.getUTCFullYear()) + "-" + month + "-" + String(shifted.getUTCDate()).padStart(2, "0");
			if (PEAK_HOLIDAYS.has(date)) return false;
			const minutes = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
			return (minutes >= 9 * 60 && minutes < 12 * 60) || (minutes >= 14 * 60 && minutes < 18 * 60);
		}

		/**
		* The live DeepSeek rate window as a small tag. It re-reads every half minute,
		* which is far finer than the two daily boundaries it can cross.
		* @param props - slot props; `t` is the locale seat.
		* @returns the tag.
		*/
		function PeakTag(props) {
			const t = props.t;
			const [peak, setPeak] = React.useState(() => isPeakNow(Date.now()));
			React.useEffect(() => {
				const timer = setInterval(() => {
					setPeak(isPeakNow(Date.now()));
				}, 30000);
				return () => {
					clearInterval(timer);
				};
			}, []);
			const title = peak ? tr(t, "peakOnTitle") : tr(t, "peakOffTitle");
			return React.createElement("span", {
				className: "dshPeakTag " + (peak ? "dshPeakOn" : "dshPeakOff"),
				title,
				"aria-label": title,
				"data-peak-now": peak ? "peak" : "off-peak"
			}, peak ? tr(t, "peakOn") : tr(t, "peakOff"));
		}
		//#endregion

		/** Beijing hours where DeepSeek's rate window can flip. */
		const PEAK_BOUNDARY_HOURS = [9, 12, 14, 18];

		/**
		* Milliseconds from `now` until the next instant the rate window can change:
		* the coming Beijing boundary hour, or the coming midnight — which can flip a
		* weekend or a holiday on its own. Answering the exact gap lets the tag flip
		* on the boundary instead of up to one poll interval late.
		* @param now - epoch milliseconds.
		* @returns milliseconds until the next possible change.
		*/
		function msUntilRateChange(now) {
			const shifted = new Date(now + 8 * 60 * 60 * 1000);
			const intoDay = ((shifted.getUTCHours() * 60 + shifted.getUTCMinutes()) * 60 + shifted.getUTCSeconds()) * 1000 + shifted.getUTCMilliseconds();
			const hour = 60 * 60 * 1000;
			for (const boundary of PEAK_BOUNDARY_HOURS) {
				if (boundary * hour > intoDay) return boundary * hour - intoDay;
			}
			return 24 * hour - intoDay;
		}

		/**
		* Publish the live DeepSeek rate window on the document root. The brand row
		* is a shipped element with no additive seat, so the tag rides its `::after`
		* instead: CSS takes the label from a custom property and the peak/off-peak
		* colour from a data attribute. Nothing is replaced, and unloading the plugin
		* removes both again.
		*
		* The timer lands just past the next boundary instead of polling on an
		* interval, and every return to the surface re-reads the clock — a background
		* timer can be throttled by minutes, and waking from sleep can leave it stale.
		* @param ctx - client root context, which owns the timer's lifetime.
		*/
		function installPeakTag(ctx) {
			const root = document.documentElement;
			const sync = () => {
				const peak = isPeakNow(Date.now());
				root.style.setProperty("--dsh-peak-label", JSON.stringify(peak ? tr(null, "peakOn") : tr(null, "peakOff")));
				root.dataset.dshPeak = peak ? "peak" : "off";
			};
			ctx.effect(() => {
				let timer = 0;
				const schedule = () => {
					sync();
					// Re-arm from the clock every time, so drift never accumulates.
					timer = setTimeout(schedule, msUntilRateChange(Date.now()) + 500);
				};
				const wake = () => {
					if (document.visibilityState === "hidden") return;
					clearTimeout(timer);
					schedule();
				};
				schedule();
				document.addEventListener("visibilitychange", wake);
				window.addEventListener("focus", wake);
				return () => {
					clearTimeout(timer);
					document.removeEventListener("visibilitychange", wake);
					window.removeEventListener("focus", wake);
					root.style.removeProperty("--dsh-peak-label");
					delete root.dataset.dshPeak;
				};
			}, "dsh-sym: peak window tag");
		}

		//#region composer focus
		/**
		* The composer's editable root. The shipped composer is a Lexical
		* `contenteditable` div that carries this attribute on itself, so one
		* attribute selector finds it without depending on a hashed class name.
		*/
		const COMPOSER_INPUT_SELECTOR = "[data-composer-input]";

		/**
		* The slot wrapper that owns one conversation occurrence. `dsh-client-ui-renderer`
		* stamps `data-slot=<slot name>` on every slot it renders, and the shipped
		* stylesheet itself selects `[data-slot=conversation\.session]` — so this is a
		* hook the host cannot rename without breaking its own CSS.
		*
		* It matters because **several conversation occurrences can be mounted at
		* once**: the right pane's chat tab renders `sidebar.chat.conversation`
		* (a full occurrence, `inputActions` and all) and the subagent panel renders
		* `conversation.content` with `variant: "embedded"`. A document-wide query for
		* the composer would then hand the caret to whichever occurrence happens to
		* come first in DOM order — not necessarily the one this button belongs to.
		*/
		const CONVERSATION_SCOPE_SELECTOR = "[data-slot=\"conversation.content\"], [data-slot=\"conversation.session\"]";

		/**
		* Is this node a live composer root? The shipped composer attaches its
		* Lexical editor to the contenteditable it mounts (`root.__lexicalEditor`,
		* set in `setRootElement` and deleted again on unmount).
		* @param node - a candidate node.
		* @returns whether it carries a usable editor instance.
		*/
		function hasComposerEditor(node) {
			if (node === null || node === void 0) return false;
			const editor = node.__lexicalEditor;
			return editor !== null && editor !== void 0 && typeof editor.focus === "function";
		}

		/**
		* Can this node take the caret right now? Two shapes of "not really the
		* composer" share the same attribute:
		*
		* - the workspace-trigger state renders the div with `editor: null`, so it is
		*   `contenteditable=false` and its editor instance is gone;
		* - a settling session keeps the whole composer seat mounted but
		*   `visibility: hidden` (shipped CSS), where `focus()` silently does nothing.
		*
		* Both would otherwise make `focusComposer` report a success it did not have.
		* @param node - a candidate node.
		* @returns whether the caret should be handed to it.
		*/
		function isUsableComposer(node) {
			if (!hasComposerEditor(node)) return false;
			if (node.contentEditable !== "true") return false;
			const view = document.defaultView;
			if (view === null || view === void 0 || typeof view.getComputedStyle !== "function") return true;
			const style = view.getComputedStyle(node);
			if (style === null || style === void 0) return true;
			return style.visibility !== "hidden" && style.display !== "none";
		}

		/**
		* The composer this button should hand the keyboard back to, narrowed to the
		* conversation the button itself lives in. A scope is only trusted when it
		* was actually found: if the button sits outside every conversation wrapper
		* we fall back to the document, but if its own conversation has no usable
		* composer we return nothing rather than reaching into a different one.
		* @param from - the element the interaction started on, when known.
		* @returns the composer root, or null.
		*/
		function findComposer(from) {
			const active = document.activeElement;
			// 光标已经在某个输入框里（鼠标路径下 preventDefault 让它根本没动过）——
			// 不要再去抢。副作用是：同时开着两份会话时，如果你正在 A 里打字却点了
			// B 的按钮，焦点留在 A（文字还是进了 B 的草稿），这比把光标从你手上拽走好。
			if (active !== null && active !== void 0 && isUsableComposer(active)) return active;
			let scope = null;
			try {
				scope = from !== null && from !== void 0 && typeof from.closest === "function" ? from.closest(CONVERSATION_SCOPE_SELECTOR) : null;
			} catch (error) {
				noteDegrade("focus:scope", describeError(error));
				scope = null;
			}
			const searchIn = (container) => {
				const found = typeof container.querySelectorAll === "function" ? container.querySelectorAll(COMPOSER_INPUT_SELECTOR) : [];
				for (const node of Array.from(found ?? [])) {
					if (isUsableComposer(node)) return node;
				}
				return null;
			};
			if (scope !== null && scope !== void 0) return searchIn(scope);
			return searchIn(document);
		}

		/**
		* Give the caret back to the composer after a button wrote into it.
		*
		* Every "click to insert" control (the rail's prompt buttons, the quote
		* button) is a `<button>`, and pressing one moves DOM focus onto itself —
		* the text lands in the draft, but the caret is gone and the next keystroke
		* goes nowhere. Callers pair this with `onMouseDown` + `preventDefault()` so
		* focus never leaves the composer in the mouse case at all; this call covers
		* the rest (keyboard activation, or a caret that was never in the composer).
		*
		* A bare `focus()` on the contenteditable would drop the caret at offset 0
		* (the shipped client says so in `SessionInputShell.focus()`), and Lexical
		* reconciles DOM selections back into its own model — so a bare focus could
		* poison the insertion point as well. Therefore: no editor instance, no
		* focus. The degradation is recorded instead of guessed at.
		*
		* @param from - the element the interaction started on, when known.
		* @returns whether the caret is (or was handed to) a composer.
		*/
		function focusComposer(from) {
			if (typeof document === "undefined" || typeof document.querySelector !== "function") return false;
			let root = null;
			try {
				root = findComposer(from ?? null);
			} catch (error) {
				noteDegrade("focus:query", describeError(error));
				return false;
			}
			if (root === null || root === void 0) return false;
			// 键盘已经在这个输入框里了：不重复 focus，免得打扰 Lexical 的选区。
			if (root === document.activeElement) return true;
			if (!hasComposerEditor(root)) {
				noteDegrade("focus:no-editor", "输入框没有 Lexical 实例，放弃接管焦点（裸 focus 会把光标丢到开头）");
				return false;
			}
			// 与官方同序：先给 DOM 焦点（拿回键盘），再让 Lexical 还原它记的选区。
			try {
				if (typeof root.focus === "function") root.focus({ preventScroll: true });
				root.__lexicalEditor.focus();
			} catch (error) {
				noteDegrade("focus:call", describeError(error));
				return false;
			}
			return true;
		}

		/**
		* `onMouseDown` for a button that writes into the composer: keep the browser
		* from moving focus to the button, so the composer keeps both the focus ring
		* and its caret. The click still fires.
		* @param event - the mousedown event.
		*/
		function keepComposerFocus(event) {
			if (event !== null && event !== void 0 && typeof event.preventDefault === "function") event.preventDefault();
		}
		//#endregion

		//#region quote action
		/**
		* The durable mark a quote action writes into the composer. The host half
		* expands it back into the named reply as the message enters the step, so the
		* draft stays one short token while the model still reads the whole answer.
		* @param messageId - the durable assistant message id.
		* @returns the mark to insert.
		*/
		function quoteMark(messageId) {
			return QUOTE_MARK_PREFIX + String(messageId).replace(/-/g, "").slice(0, QUOTE_MARK_ID_LENGTH).toLowerCase();
		}

		/**
		* One finalized reply's quote action: it drops that short mark into the
		* composer, and the host expands it when the message is submitted.
		* @param props - slot props; `messageId` names the reply.
		* @returns the button.
		*/
		function QuoteAction(props) {
			const inputActions = props.inputActions;
			const t = props.t;
			const messageId = props.messageId;
			const [flag, setFlag] = React.useState(null);
			React.useEffect(() => {
				if (flag === null) return undefined;
				const timer = setTimeout(() => {
					setFlag(null);
				}, 2000);
				return () => {
					clearTimeout(timer);
				};
			}, [flag]);
			if (typeof messageId !== "string" || messageId.length === 0) return null;
			const pick = (event) => {
				const payload = quoteMark(messageId) + " ";
				// Capture the caret first: the click moved focus, and `insertText`
				// applies to the insertion point captured for this edit.
				let span;
				try {
					span = typeof inputActions.captureInsertion === "function" ? inputActions.captureInsertion() : undefined;
				} catch (error) {
					noteDegrade("quote:capture", describeError(error));
					span = undefined;
				}
				let ok = false;
				try {
					ok = inputActions.insertText(payload, span) !== false;
				} catch (error) {
					noteDegrade("quote:insert", describeError(error));
					ok = false;
				}
				// 标记写进去了，键盘还留在按钮上：把光标交回输入框，接着就能输入。
				// 传按钮自己进去，让查询能收窄到这条消息所属的那份会话。
				if (ok) focusComposer(event === null || event === void 0 ? null : event.currentTarget);
				setFlag(ok ? "done" : "missing");
			};
			const label = flag === "done" ? tr(t, "quoteDone") : flag === "missing" ? tr(t, "quoteMissing") : tr(t, "quoteAction");
			return React.createElement("button", {
				type: "button",
				className: "dshQuoteAction",
				title: label,
				"aria-label": label,
				"data-quote-action": messageId,
				"data-sym-quote": messageId,
				onMouseDown: keepComposerFocus,
				onClick: pick
			}, flag === null
				? React.createElement("span", { className: "dshQuoteMark", "aria-hidden": true }, "@")
				: React.createElement("span", { className: "dshQuoteFlag", "aria-hidden": true }, flag === "done" ? "\u2713" : "!"));
		}
		//#endregion

		//#region quick actions
		/**
		* The buttons a projection view carries, dropping malformed records.
		* Exported so the bar's data path is testable without a DOM.
		* @param view - the `quickActions` projection value.
		* @returns the usable buttons, in order.
		*/
		function quickButtonsOf(view) {
			if (view === null || view === void 0 || !Array.isArray(view.buttons)) return [];
			return view.buttons.filter((button) => button !== null && typeof button === "object" && typeof button.id === "string" && button.id.length > 0 && typeof button.value === "string" && button.value.length > 0);
		}

		/**
		* 内置的默认按钮：宿主配置还没写、或投影尚未送到时用它顶上。
		*
		* 这是**有意的第二份拷贝**——客户端不能读宿主模块，而按钮必须在任何情况下
		* 都看得见。两份清单是否一致由 `test/contracts.test.mjs` 守卫：改一边必须改
		* 另一边，否则测试红。
		*/
		const DEFAULT_QUICK_ACTIONS = [
			{ id: "goal", label: "目标", icon: "goal", kind: "command", value: "/goal" },
			{ id: "plan", label: "计划", icon: "plan", kind: "command", value: "/plan" },
			{ id: "compact", label: "压缩上下文", icon: "compact", kind: "command", value: "/compact" },
			{ id: "review", label: "审查改动", icon: "search", kind: "prompt", value: "请审查这次改动，指出可能的问题与遗漏。" },
			{ id: "regression", label: "跑一遍回归", icon: "refresh", kind: "prompt", value: "请跑一遍回归测试，并把失败项贴出来。" },
			{ id: "explain", label: "解释报错", icon: "help", kind: "prompt", value: "请解释这个报错的原因，并给出修复方案。" },
			{ id: "commit-message", label: "写提交信息", icon: "document", kind: "prompt", value: "请根据当前改动写一条中文提交信息。" }
		];

		/**
		* 官方命令通道的取用点（模块级，插件加载时挂一次）。
		*
		* `commandUi`（`/` 菜单的决策表）与 `sessions`（会话作用域 ctx）都是**官方内部
		* 服务**：不在公开服务目录里、也没有面向插件的文档。所以这里只存"怎么拿"，
		* 每次点击现取 —— 服务晚就绪、或某一版干脆没有时，取到 `null` 就走降级路径，
		* 而不是让竖条整个不渲染。
		*/
		const commandBridge = { ui: null, sessions: null };

		/**
		* 一个永不中止的 `AbortSignal`。
		*
		* 官方 `commandDirectory.ensureReady(sessionId, signal)` 内部第一件事就是读
		* `signal.aborted`，传 `undefined` 会当场抛 TypeError —— 目录因此永远停在未就绪，
		* `dispatch` 拿不到 descriptor，按钮会静默退化成填草稿。实测踩过一次。
		*/
		const NEVER_ABORT = typeof AbortController === "function" ? new AbortController().signal : null;

		/**
		* 三类按钮的固定顺序。**组序就是渲染序**：竖条与设置页都按它分组，
		* 所以"不能跨类排列"是结构性保证，不靠调用方自觉。
		*/
		const QUICK_KINDS = Object.freeze(["command", "skill", "prompt"]);

		/**
		* 一个按钮归哪一类。认不出的按提示词处理（与 `toConfigButton` 同一口径），
		* 保证任何配置都落进三组之一、不会凭空消失。
		* @param button - 一条按钮记录。
		* @returns `command` / `skill` / `prompt`。
		*/
		function quickKindOf(button) {
			const kind = button !== null && typeof button === "object" ? button.kind : null;
			return kind === "command" ? "command" : kind === "skill" ? "skill" : "prompt";
		}

		/**
		* 按类分组，保持组内原有顺序。空组也会返回（调用方据此决定要不要画分割线）。
		* @param buttons - 按钮清单。
		* @returns 三组 `{ kind, buttons }`，顺序固定为 `QUICK_KINDS`。
		*/
		function groupQuickButtons(buttons) {
			const list = Array.isArray(buttons) ? buttons : [];
			return QUICK_KINDS.map((kind) => ({
				kind,
				buttons: list.filter((button) => quickKindOf(button) === kind)
			}));
		}

		/**
		* 图标集：设置页里可选，按钮按 `icon` 名取用。
		*
		* 每条是若干 `[标签名, 属性]`，统一 16 格 viewBox、1.3 描边、currentColor ——
		* 与项目既有图标同一风格。加图标只要往这里添一行，设置页的选择器会自动带上。
		*/
		const QUICK_ICONS = {
			// 自定义工作流图标：对抗 / 架构师 / 设计 / designFlow / 推送 / 知识库。
			// 对象顺序即选择器顺序：放在最前，就会紧跟官方那批之后、第一屏就能看到，
			// 不至于沉到 105 枚的末尾。同 16 格、1.3 描边、纯线条、currentColor。
			adversarial: [["path", { d: "M3.2 12.8 12.8 3.2" }], ["path", { d: "M12.8 12.8 3.2 3.2" }], ["path", { d: "M4.5 8.7 7.3 11.5" }], ["path", { d: "M8.7 11.5 11.5 8.7" }], ["circle", { cx: 3.2, cy: 12.8, r: "1.1", fill: "currentColor", stroke: "none" }], ["circle", { cx: 12.8, cy: 12.8, r: "1.1", fill: "currentColor", stroke: "none" }]],
			architect: [["path", { d: "M2.4 6.4 8 2.4l5.6 4Z" }], ["path", { d: "M4.8 7.6v4.6M8 7.6v4.6M11.2 7.6v4.6" }], ["path", { d: "M3.2 13.4h9.6" }]],
			design: [["path", { d: "M8.6 2.6C5.4 2.6 2.8 5 2.8 8C2.8 11 5.4 13.4 8.6 13.4C9.3 13.4 9.9 12.8 9.9 12.1C9.9 11.7 9.7 11.5 9.5 11.2C9.4 10.9 9.2 10.7 9.2 10.3C9.2 9.6 9.8 9 10.5 9L11.5 9C12.8 9 13.9 7.9 13.9 6.6C13.9 4.2 11.6 2.6 8.6 2.6Z" }], ["circle", { cx: 5.9, cy: 6.4, r: ".9", fill: "currentColor", stroke: "none" }], ["circle", { cx: 9.2, cy: 5.6, r: ".9", fill: "currentColor", stroke: "none" }], ["circle", { cx: 5.5, cy: 9.9, r: ".9", fill: "currentColor", stroke: "none" }]],
			// 专给 dsh-design-flow 用：设计稿 + 对勾 = "过闸门、出可评审结果"。
			// 与 design（调色板）分工：design = 设计这件事本身，designFlow = 这个工具。
			// ⚠ 与 plan 骨架相近（都是"框 + 对勾"）；plan 另有两条文本线用于区分。
			// ⚠ 与 home 都是"带顶的方盒子"；architect 靠三根柱子与台基区分。
			designFlow: [["rect", { x: 2.4, y: 3.2, width: 11.2, height: 9.6, rx: 1.5 }], ["path", { d: "M5.4 8.4 7.4 10.4 11 6" }]],
			push: [["path", { d: "M8 9.4V2.8M5.4 5.4 8 2.8l2.6 2.6" }], ["path", { d: "M3.4 11.2v1.4a1 1 0 0 0 1 1h7.2a1 1 0 0 0 1-1v-1.4" }]],
			library: [["path", { d: "M3.4 3.6a1 1 0 0 1 1-1h7.2a1 1 0 0 1 1 1v9.8a1 1 0 0 1-1 1H4.4a1 1 0 0 1-1-1Z" }], ["path", { d: "M5.8 2.6v10.8" }], ["path", { d: "M8.6 2.6v5.2l1.5-1.3 1.5 1.3V2.6" }]],
			// 扩充包：有意思但不常见的选题（航海天文 / 匠人器物 / 自然生命 / 文房手作 / 系统 / 抽象结构）。
			// 全部按同一份网格手绘：16 格、1.3 描边、round cap/join、纯线条、currentColor。
			lighthouse: [["path", { d: "M6.6 13.4 7.4 6.4h1.2l.8 7Z" }], ["path", { d: "M6.9 6.4V4.9h2.2v1.5" }], ["path", { d: "M4.4 5.9 2.6 4.7M11.6 5.9 13.4 4.7" }], ["path", { d: "M4.6 13.4h6.8" }]],
			sextant: [["path", { d: "M3.2 12.8A9.6 9.6 0 0 1 12.8 3.2" }], ["path", { d: "M3.2 12.8 11.6 4.4" }], ["circle", { cx: 11.6, cy: 4.4, r: 1 }]],
			compassRose: [["circle", { cx: 8, cy: 8, r: 5.6 }], ["path", { d: "M8 2.4 9.4 6.6 13.6 8 9.4 9.4 8 13.6 6.6 9.4 2.4 8 6.6 6.6Z" }]],
			telescope: [["path", { d: "M2.6 8.2 10.6 3.8l1.8 3.2-8 4.4Z" }], ["path", { d: "M13.6 5.6 14.6 6.4" }], ["path", { d: "M6.8 10.4v2.6M5.2 13h3.2" }]],
			constellation: [["path", { d: "M3.6 11.4 7.2 6.8 10 9.2 12.6 4.2" }], ["circle", { cx: 3.6, cy: 11.4, r: ".9", fill: "currentColor", stroke: "none" }], ["circle", { cx: 7.2, cy: 6.8, r: ".9", fill: "currentColor", stroke: "none" }], ["circle", { cx: 10, cy: 9.2, r: ".9", fill: "currentColor", stroke: "none" }], ["circle", { cx: 12.6, cy: 4.2, r: ".9", fill: "currentColor", stroke: "none" }]],
			sundial: [["path", { d: "M2.6 12.4a5.4 5.4 0 0 1 10.8 0Z" }], ["path", { d: "M8 12.4V6.2" }], ["path", { d: "M8 6.2 5.2 12.4" }]],
			anvil: [["path", { d: "M2.6 6.6h7.2l3.4 1.5-3.4 1.5H2.6Z" }], ["path", { d: "M5.8 9.6 4.6 12.6h6.8L10.2 9.6" }], ["path", { d: "M3.8 12.6h8.4" }]],
			tuningFork: [["path", { d: "M5.8 2.8v5.4a2.2 2.2 0 0 0 4.4 0V2.8" }], ["path", { d: "M8 10.6v2.6" }], ["path", { d: "M6.3 13.2h3.4" }]],
			metronome: [["path", { d: "M5.6 13.4 7 4.4h2l1.4 9Z" }], ["path", { d: "M4.8 13.4h6.4" }], ["path", { d: "M8 12.9 9.7 4.7" }], ["circle", { cx: 9.2, cy: 6.6, r: ".9", fill: "currentColor", stroke: "none" }]],
			hourglass: [["path", { d: "M5 2.8h6M5 13.2h6" }], ["path", { d: "M5.6 2.8C5.6 5.6 7 6.6 8 8.2 9 6.6 10.4 5.6 10.4 2.8" }], ["path", { d: "M5.6 13.2C5.6 10.4 7 9.4 8 7.8 9 9.4 10.4 10.4 10.4 13.2" }]],
			flask: [["path", { d: "M6.8 2.8v3.4L3.4 12a1.4 1.4 0 0 0 1.2 2.1h6.8A1.4 1.4 0 0 0 12.6 12L9.2 6.2V2.8" }], ["path", { d: "M6.1 2.8h3.8" }], ["path", { d: "M5.2 11.2h5.6" }]],
			caliper: [["path", { d: "M2.6 6.6h10.8" }], ["path", { d: "M3.4 6.6v3.6M12.6 6.6v2.4" }], ["path", { d: "M6.2 6.6v1.4M8.2 6.6v1.4M10.2 6.6v1.4" }]],
			spiritLevel: [["rect", { x: "2.4", y: "6.4", width: "11.2", height: "3.2", rx: "1.6" }], ["circle", { cx: 8, cy: 8, r: "1.4" }], ["path", { d: "M5.2 6.9v2.2M10.8 6.9v2.2" }]],
			feather: [["path", { d: "M13.2 2.8C9 4.2 6 7.2 4.6 11.4" }], ["path", { d: "M13.2 2.8C13 7.6 10.2 10.6 5.8 11.6" }], ["path", { d: "M4.6 11.4 2.8 13.6" }]],
			honeycomb: [["path", { d: "M8 3.6 4.4 5.8v4.4L8 12.4l3.6-2.2V5.8Z" }], ["path", { d: "M8 6.2 6.2 7.4v2L8 10.6l1.8-1.2v-2Z" }]],
			tent: [["path", { d: "M2.6 12.8 8 3.6l5.4 9.2Z" }], ["path", { d: "M8 3.6 6.2 12.8M8 3.6l1.8 9.2" }]],
			mushroom: [["path", { d: "M2.8 9.2a5.2 5.2 0 0 1 10.4 0Z" }], ["path", { d: "M6.6 9.2v2.6a1.4 1.4 0 0 0 2.8 0V9.2" }]],
			sprout: [["path", { d: "M8 13.4V7.6" }], ["path", { d: "M8 7.6C8 5 6.2 3.2 3.6 3.2c0 2.6 1.8 4.4 4.4 4.4Z" }], ["path", { d: "M8 9.4c0-2.2 1.6-3.8 4-3.8 0 2.2-1.6 3.8-4 3.8Z" }]],
			shell: [["path", { d: "M8 13.6C5.6 12.4 2.6 9.8 2.6 7.2C2.6 4.6 5 2.8 8 2.8C11 2.8 13.4 4.6 13.4 7.2C13.4 9.8 10.4 12.4 8 13.6Z" }], ["path", { d: "M8 13.6V4.2M5.6 12.6 6.4 4.8M10.4 12.6 9.6 4.8" }]],
			treeRings: [["circle", { cx: 7.4, cy: 8.4, r: 5.4 }], ["circle", { cx: 7.8, cy: 8.2, r: 3.4 }], ["circle", { cx: 8, cy: 8, r: 1.4 }]],
			inkwell: [["path", { d: "M5 8.2h6v4a1.2 1.2 0 0 1-1.2 1.2H6.2A1.2 1.2 0 0 1 5 12.2Z" }], ["path", { d: "M6.4 8.2V6.6h3.2v1.6" }], ["path", { d: "M8.6 6.6 11.6 3.4" }]],
			typeBlock: [["rect", { x: 3.6, y: 3.6, width: 8.8, height: 8.8, rx: 1.2 }], ["path", { d: "M6 6.6h4M8 6.6v3.4" }]],
			foldedMap: [["path", { d: "M2.6 4.6 6.4 3.2v9.2L2.6 13.8ZM6.4 3.2 9.6 4.6v9.2L6.4 12.4ZM9.6 4.6 13.4 3.2v9.2l-3.8 1.4Z" }]],
			seal: [["path", { d: "M6.4 2.6h3.2v3.2H6.4Z" }], ["path", { d: "M6.4 5.8 5 9.4h6L9.6 5.8" }], ["path", { d: "M3.4 12.6h9.2" }]],
			spool: [["path", { d: "M4.8 3.6h6.4v8.8H4.8Z" }], ["path", { d: "M3.8 3.6h8.4M3.8 12.4h8.4" }], ["path", { d: "M4.8 6h6.4M4.8 8h6.4M4.8 10h6.4" }]],
			serverRack: [["rect", { x: 3.4, y: 2.6, width: 9.2, height: 10.8, rx: 1.2 }], ["path", { d: "M3.4 6.2h9.2M3.4 9.8h9.2" }], ["circle", { cx: 5.4, cy: 4.4, r: ".6", fill: "currentColor", stroke: "none" }], ["circle", { cx: 5.4, cy: 8, r: ".6", fill: "currentColor", stroke: "none" }], ["circle", { cx: 5.4, cy: 11.6, r: ".6", fill: "currentColor", stroke: "none" }]],
			plug: [["path", { d: "M5.6 6.6h4.8v3a2.4 2.4 0 0 1-4.8 0Z" }], ["path", { d: "M6.8 6.6V3.6M9.2 6.6V3.6" }], ["path", { d: "M8 12v1.6" }]],
			latticeTower: [["path", { d: "M5.8 13.4 8 3.2l2.2 10.2" }], ["path", { d: "M6.6 10.4h2.8M7.2 7.4h1.6" }], ["path", { d: "M8 3.2V2" }]],
			satellite: [["rect", { x: "6.3", y: "6.3", width: "3.4", height: "3.4", rx: ".8" }], ["path", { d: "M6.3 8H3.4M9.7 8h2.9" }], ["rect", { x: "1.4", y: "6.6", width: "2", height: "2.8", rx: ".5" }], ["rect", { x: "12.6", y: "6.6", width: "2", height: "2.8", rx: ".5" }], ["path", { d: "M8 6.3V4.6M6.9 4.6a1.5 1.5 0 0 1 2.2 0" }]],
			cableCoil: [["circle", { cx: 8, cy: 7.6, r: 4.4 }], ["circle", { cx: 8, cy: 7.6, r: 2 }], ["path", { d: "M11.4 10.6c1 1.3.7 2.7-.4 3.2" }]],
			spiral: [["path", { d: "M8.50 8.00L8.59 8.22L8.59 8.49L8.45 8.78L8.18 9.02L7.79 9.15L7.34 9.12L6.90 8.91L6.53 8.52L6.30 7.99L6.29 7.36L6.51 6.72L6.97 6.17L7.64 5.80L8.44 5.68L9.28 5.86L10.04 6.34L10.61 7.10L10.89 8.05L10.83 9.09L10.38 10.08L9.59 10.88L8.53 11.39L7.31 11.49L6.08 11.16L5.01 10.39L4.25 9.26L3.91 7.90L4.07 6.45L4.74 5.11L5.86 4.05L7.33 3.43L8.97 3.34L10.57 3.84L11.95 4.90L12.90 6.40" }]],
			maze: [["path", { d: "M2.6 13.4V2.6h10.8v10.8H5.4V5.4h5.6v5.2H8.2" }]],
			infinity: [["path", { d: "M8 8C6.8 5.6 5.6 4.4 4.2 4.4a3.6 3.6 0 0 0 0 7.2C5.6 11.6 6.8 10.4 8 8c1.2-2.4 2.4-3.6 3.8-3.6a3.6 3.6 0 0 1 0 7.2C10.4 11.6 9.2 10.4 8 8Z" }]],
			arch: [["path", { d: "M3 13.4V8a5 5 0 0 1 10 0v5.4" }], ["path", { d: "M1.8 13.4h12.4" }], ["path", { d: "M6 13.4V8a2 2 0 0 1 4 0v5.4" }]],
			bridge: [["path", { d: "M5 11.8V4.6M11 11.8V4.6" }], ["path", { d: "M5 4.6C6.4 7.4 9.6 7.4 11 4.6" }], ["path", { d: "M1.8 9.6h12.4" }], ["path", { d: "M6.4 6.7v2.9M9.6 6.7v2.9" }], ["path", { d: "M2.6 13.2h3M10.4 13.2h3" }]],
			dot: [["circle", { cx: 8, cy: 8, r: 3.2 }]],
			compact: [["path", { d: "M3 8h10" }], ["path", { d: "M8 2.6v3.1M6.4 4.2 8 5.8l1.6-1.6" }], ["path", { d: "M8 13.4v-3.1M6.4 11.8 8 10.2l1.6 1.6" }]],
			search: [["circle", { cx: 7.2, cy: 7.2, r: 4.1 }], ["path", { d: "M10.3 10.3 14 14" }]],
			refresh: [["path", { d: "M13.4 8a5.4 5.4 0 1 1-1.6-3.9" }], ["path", { d: "M13.5 2.5v2.6H11" }]],
			help: [["circle", { cx: 8, cy: 8, r: 5.6 }], ["path", { d: "M6.3 6.4a1.7 1.7 0 1 1 2.3 1.6c-.4.2-.7.5-.7 1v.3" }], ["circle", { cx: 7.9, cy: 11.6, r: ".7", fill: "currentColor", stroke: "none" }]],
			document: [["path", { d: "M3.4 13.6V3.4a1 1 0 0 1 1-1h4.4l3.8 3.8v7.4a1 1 0 0 1-1 1H4.4a1 1 0 0 1-1-1Z" }], ["path", { d: "M8.6 2.4v4h4" }], ["path", { d: "M5.8 9.4h4.4M5.8 11.6h2.8" }]],
			code: [["path", { d: "M5.6 4 2 8l3.6 4" }], ["path", { d: "M10.4 4 14 8l-3.6 4" }]],
			terminal: [["rect", { x: 2, y: 3, width: 12, height: 10, rx: 1.5 }], ["path", { d: "M4.8 6.6 6.8 8.4 4.8 10.2" }], ["path", { d: "M8.4 10.6h2.8" }]],
			bug: [["rect", { x: 5, y: 5.4, width: 6, height: 7.2, rx: 3 }], ["path", { d: "M5 7.2H2.6M13.4 7.2H11M5.4 10.4H2.8M13.2 10.4h-2.6M6 4 4.6 2.6M10 4l1.4-1.4" }]],
			play: [["path", { d: "M5.2 3.4 12.6 8l-7.4 4.6Z" }]],
			square: [["rect", { x: 4, y: 4, width: 8, height: 8, rx: 1.6 }]],
			check: [["path", { d: "M3.4 8.6 6.6 11.8 12.6 4.6" }]],
			plus: [["path", { d: "M8 3.4v9.2M3.4 8h9.2" }]],
			arrowUp: [["path", { d: "M8 13V3.4M4.4 7 8 3.4 11.6 7" }]],
			arrowDown: [["path", { d: "M8 3v9.6M4.4 9 8 12.6 11.6 9" }]],
			sparkles: [["path", { d: "M6.4 2.4 7.5 5.5l3.1 1.1-3.1 1.1L6.4 10.8 5.3 7.7 2.2 6.6l3.1-1.1Z" }], ["path", { d: "M11.8 9.2l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7Z" }]],
			bulb: [["path", { d: "M8 2.4a4 4 0 0 1 2.4 7.2c-.4.3-.6.7-.6 1.2v.6H6.2v-.6c0-.5-.2-.9-.6-1.2A4 4 0 0 1 8 2.4Z" }], ["path", { d: "M6.4 13.4h3.2" }]],
			list: [["path", { d: "M6 4h8M6 8h8M6 12h8" }], ["circle", { cx: 3.2, cy: 4, r: ".8", fill: "currentColor", stroke: "none" }], ["circle", { cx: 3.2, cy: 8, r: ".8", fill: "currentColor", stroke: "none" }], ["circle", { cx: 3.2, cy: 12, r: ".8", fill: "currentColor", stroke: "none" }]],
			layers: [["path", { d: "M8 2.2 14.4 5.6 8 9 1.6 5.6Z" }], ["path", { d: "M2.6 8.6 8 11.5l5.4-2.9" }], ["path", { d: "M2.6 11.4 8 14.3l5.4-2.9" }]],
			branch: [["circle", { cx: 4.4, cy: 3.6, r: 1.6 }], ["circle", { cx: 4.4, cy: 12.4, r: 1.6 }], ["circle", { cx: 11.6, cy: 6.4, r: 1.6 }], ["path", { d: "M4.4 5.2v5.6" }], ["path", { d: "M11.6 8v1.4c0 1.4-1.2 2.4-2.6 2.4H4.4" }]],
			book: [["path", { d: "M2.6 3.4h4.2c.9 0 1.6.7 1.6 1.6v7.6c0-.7-.6-1.2-1.3-1.2H2.6Z" }], ["path", { d: "M13.4 3.4H9.2c-.9 0-1.6.7-1.6 1.6v7.6c0-.7.6-1.2 1.3-1.2h4.5Z" }]],
			wand: [["path", { d: "M3 13 10.6 5.4" }], ["path", { d: "M9.4 4.2 11.8 6.6" }], ["path", { d: "M12.4 2v2.2M11.3 3.1h2.2M5.4 3v1.6M4.6 3.8h1.6" }]],
			lock: [["rect", { x: 3.4, y: 7, width: 9.2, height: 6.6, rx: 1.6 }], ["path", { d: "M5.6 7V5.4a2.4 2.4 0 0 1 4.8 0V7" }]],
			clock: [["circle", { cx: 8, cy: 8, r: 5.6 }], ["path", { d: "M8 4.8V8l2.4 1.6" }]],
			send: [["path", { d: "M2.8 8h9.6M8.8 4.4 12.4 8l-3.6 3.6" }]],
			image: [["rect", { x: 2.2, y: 3.4, width: 11.6, height: 9.2, rx: 1.6 }], ["circle", { cx: 5.8, cy: 6.6, r: 1.1 }], ["path", { d: "M3.2 11.6 6.6 8.4l3 2.6 2-1.6 2.4 2.2" }]],
			file: [["path", { d: "M10.4 4.6 5.6 9.4a2.2 2.2 0 0 0 3.1 3.1l4.2-4.2a3.4 3.4 0 0 0-4.8-4.8L3.9 7.7a4.6 4.6 0 0 0 6.5 6.5l3.4-3.4" }]],
			goal: [["circle", { cx: 7.4, cy: 8.6, r: 3.6 }], ["circle", { cx: 7.4, cy: 8.6, r: 1.4 }], ["path", { d: "M7.4 8.6 13 3M13 3h-3.2M13 3v3.2" }]],
			plan: [["rect", { x: 3, y: 2.6, width: 10, height: 10.8, rx: 1.6 }], ["path", { d: "M5.6 6.4 6.9 7.6 9.2 5.2" }], ["path", { d: "M9.6 9.4h1.8M5.6 11.6h5.8" }]],
			feedback: [["path", { d: "M14 2 7.4 8.6M14 2 9.8 14l-2.4-5.4L2 6.2Z" }]],
			ring: [["circle", { cx: 8, cy: 8, r: 5.4 }]],
			permission: [["path", { d: "M8 2.2 13.2 4v4.2c0 3-2.2 5-5.2 5.8-3-.8-5.2-2.8-5.2-5.8V4Z" }], ["path", { d: "M8 6.2v2.4" }], ["circle", { cx: 8, cy: 10.4, r: ".7", fill: "currentColor", stroke: "none" }]],
			model: [["ellipse", { cx: 7, cy: 4.4, rx: 3.4, ry: 1.4 }], ["path", { d: "M3.6 4.4v6.2c0 .8 1.5 1.4 3.4 1.4s3.4-.6 3.4-1.4V4.4" }], ["path", { d: "M3.6 7.5c0 .8 1.5 1.4 3.4 1.4s3.4-.6 3.4-1.4" }], ["path", { d: "M12.6 9.4l.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4-1.4-.5 1.4-.5Z" }]],
			download: [["path", { d: "M8 2.6v6.6M5.4 6.8 8 9.4l2.6-2.6" }], ["path", { d: "M3.4 11.2v1.4a1 1 0 0 0 1 1h7.2a1 1 0 0 0 1-1v-1.4" }]],
			star: [["path", { d: "M8 2.4 9.7 6l3.9.5-2.9 2.7.8 3.9L8 11.3l-3.5 1.8.8-3.9-2.9-2.7L6.3 6Z" }]],
			heart: [["path", { d: "M8 13.4S2.6 10.2 2.6 6.6a2.9 2.9 0 0 1 5.4-1.6 2.9 2.9 0 0 1 5.4 1.6c0 3.6-5.4 6.8-5.4 6.8Z" }]],
			flag: [["path", { d: "M4 14V2.6M4 3.4h7.4l-1.6 2.6 1.6 2.6H4" }]],
			tag: [["path", { d: "M8.4 2.6h5v5L7.2 13.8a1.4 1.4 0 0 1-2 0L2.6 11.2a1.4 1.4 0 0 1 0-2Z" }], ["circle", { cx: 11, cy: 5, r: ".8", fill: "currentColor", stroke: "none" }]],
			pin: [["path", { d: "M9.6 2.4 13.6 6.4M11.4 4.6 6.4 9.6l-2-.6-1.4 1.4 3.2 3.2 1.4-1.4-.6-2Z" }]],
			calendar: [["rect", { x: 2.6, y: 3.6, width: 10.8, height: 9.8, rx: 1.6 }], ["path", { d: "M2.6 6.8h10.8M5.4 2.2v2.6M10.6 2.2v2.6" }]],
			folder: [["path", { d: "M2.4 12.4V4.6a1 1 0 0 1 1-1h3l1.6 2h5.6a1 1 0 0 1 1 1v5.8a1 1 0 0 1-1 1H3.4a1 1 0 0 1-1-1Z" }]],
			save: [["path", { d: "M3 3.4h8.2L13.4 5.6v7a1 1 0 0 1-1 1H3.4a1 1 0 0 1-1-1V4.4a1 1 0 0 1 1-1Z" }], ["path", { d: "M5.4 3.4v3.4h4.4V3.4M5 13.4V9.6h6v3.8" }]],
			copy: [["rect", { x: 5.4, y: 5.4, width: 8, height: 8, rx: 1.4 }], ["path", { d: "M10.6 5.4V3.9a1 1 0 0 0-1-1H3.4a1 1 0 0 0-1 1v6.2a1 1 0 0 0 1 1h1.5" }]],
			edit: [["path", { d: "M11.4 2.6 13.4 4.6 5.6 12.4l-2.6.6.6-2.6Z" }], ["path", { d: "M10 4l2 2" }]],
			trash: [["path", { d: "M3.4 4.6h9.2M6.2 4.6V3.2h3.6v1.4" }], ["path", { d: "M4.8 4.6 5.5 13a1 1 0 0 0 1 .9h3a1 1 0 0 0 1-.9l.7-8.4" }]],
			filter: [["path", { d: "M2.6 3.4h10.8l-4.2 5v4.8l-2.4-1.4V8.4Z" }]],
			sort: [["path", { d: "M4.6 3.4v9.2M2.6 10.6 4.6 12.6 6.6 10.6M11.4 12.6V3.4M9.4 5.4 11.4 3.4 13.4 5.4" }]],
			grid: [["rect", { x: 2.6, y: 2.6, width: 4.6, height: 4.6, rx: 1 }], ["rect", { x: 8.8, y: 2.6, width: 4.6, height: 4.6, rx: 1 }], ["rect", { x: 2.6, y: 8.8, width: 4.6, height: 4.6, rx: 1 }], ["rect", { x: 8.8, y: 8.8, width: 4.6, height: 4.6, rx: 1 }]],
			chart: [["path", { d: "M2.8 13.2V2.8M2.8 13.2h10.4M5.6 10.8V8M8.4 10.8V5.6M11.2 10.8V9.2" }]],
			warning: [["path", { d: "M8 2.8 14.2 13H1.8Z" }], ["path", { d: "M8 6.6v3" }], ["circle", { cx: 8, cy: 11.4, r: ".7", fill: "currentColor", stroke: "none" }]],
			info: [["circle", { cx: 8, cy: 8, r: 5.6 }], ["path", { d: "M8 7.4v3.2" }], ["circle", { cx: 8, cy: 5, r: ".7", fill: "currentColor", stroke: "none" }]],
			user: [["circle", { cx: 8, cy: 5.6, r: 2.6 }], ["path", { d: "M3.2 13.4a4.8 4.8 0 0 1 9.6 0" }]],
			users: [["circle", { cx: 6.2, cy: 5.6, r: 2.4 }], ["path", { d: "M1.8 13.4a4.4 4.4 0 0 1 8.8 0" }], ["path", { d: "M10.6 3.4a2.4 2.4 0 0 1 0 4.6M11.6 9.6a4.4 4.4 0 0 1 2.6 3.8" }]],
			globe: [["circle", { cx: 8, cy: 8, r: 5.6 }], ["path", { d: "M2.4 8h11.2" }], ["path", { d: "M8 2.4c1.6 1.6 2.4 3.5 2.4 5.6S9.6 12 8 13.6C6.4 12 5.6 10.1 5.6 8S6.4 4 8 2.4Z" }]],
			link: [["path", { d: "M6.6 9.4 9.4 6.6M6 4.4 7.4 3a2.8 2.8 0 0 1 4 4L10 8.4M10 11.6 8.6 13a2.8 2.8 0 0 1-4-4L6 7.6" }]],
			mail: [["rect", { x: 2.4, y: 4, width: 11.2, height: 8, rx: 1.4 }], ["path", { d: "M2.8 5 8 9l5.2-4" }]],
			bell: [["path", { d: "M8 2.6a3.8 3.8 0 0 1 3.8 3.8c0 3 .8 4 1.4 4.6H2.8c.6-.6 1.4-1.6 1.4-4.6A3.8 3.8 0 0 1 8 2.6Z" }], ["path", { d: "M6.6 13.2a1.6 1.6 0 0 0 2.8 0" }]],
			eye: [["path", { d: "M1.8 8S4.4 4.2 8 4.2 14.2 8 14.2 8 11.6 11.8 8 11.8 1.8 8 1.8 8Z" }], ["circle", { cx: 8, cy: 8, r: 1.8 }]],
			mic: [["rect", { x: 6, y: 2.4, width: 4, height: 6.6, rx: 2 }], ["path", { d: "M3.6 7.8a4.4 4.4 0 0 0 8.8 0M8 12.2v1.6" }]],
			rocket: [["path", { d: "M8 2.2c2.2 1.8 3.2 4.2 3.2 6.8L8 13.6 4.8 9C4.8 6.4 5.8 4 8 2.2Z" }], ["circle", { cx: 8, cy: 6.8, r: 1.3 }]],
			flash: [["path", { d: "M9 2.2 3.6 9.2h3.6L6.8 13.8 12.4 6.8H8.8Z" }]],
			puzzle: [["path", { d: "M3 3.4h3.4v1.4a1.4 1.4 0 1 0 2.8 0V3.4H13v3.4h-1.4a1.4 1.4 0 1 0 0 2.8H13V13H9.2v-1.4a1.4 1.4 0 1 0-2.8 0V13H3V9.6h1.4a1.4 1.4 0 1 0 0-2.8H3Z" }]],
			home: [["path", { d: "M2.6 7.4 8 2.8l5.4 4.6V13a1 1 0 0 1-1 1H3.6a1 1 0 0 1-1-1Z" }], ["path", { d: "M6.4 14V9.4h3.2V14" }]],
			settings: [["circle", { cx: 8, cy: 8, r: 2.2 }], ["path", { d: "M8 1.8v2M8 12.2v2M1.8 8h2M12.2 8h2M3.6 3.6l1.4 1.4M11 11l1.4 1.4M12.4 3.6 11 5M5 11l-1.4 1.4" }]]
		};

		/**
		* 官方 `/` 菜单里那几个图标：在选择器里**排在最前面**。
		*
		* 它们本来在 64 个图标的末尾，翻到底也很难认出来 —— 提到最前，第一眼就能看到。
		*/
		const FEATURED_ICONS = Object.freeze(["file", "goal", "plan", "feedback", "ring", "permission", "model", "download"]);

		/** 图标名清单：官方那几个在前，其余保持原顺序。 */
		const QUICK_ICON_NAMES = FEATURED_ICONS
			.filter((name) => Object.hasOwn(QUICK_ICONS, name))
			.concat(Object.keys(QUICK_ICONS).filter((name) => FEATURED_ICONS.indexOf(name) < 0));

		/**
		* 按名字取图标；认不出的名字退化成中性圆点，界面不会空掉。
		* @param props - `name`.
		* @returns the icon element.
		*/
		function QuickIcon(props) {
			const shapes = Object.hasOwn(QUICK_ICONS, props.name) ? QUICK_ICONS[props.name] : QUICK_ICONS.dot;
			return React.createElement("svg", {
				viewBox: "0 0 16 16",
				"aria-hidden": true,
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.3,
				strokeLinecap: "round",
				strokeLinejoin: "round"
			}, shapes.map((shape, index) => React.createElement(shape[0], Object.assign({ key: index }, shape[1]))));
		}

		/**
		* 侧栏右缝里的竖排快捷条（纯图形按钮）。
		*
		* 它注册在会话作用域的 `conversation.input.dock` —— 只有会话作用域才拿得到
		* `inputActions`、`sessionId` 与 `useProjection`。但元素本身是 `position: fixed`
		* 的，**完全脱离文档流**：既不占 dock 的位置（不再和待办/目标/队列抢空间，
		* 也不会把上面的用时读数挤走），又跟着会话一起挂载与卸载。
		*
		* 位置靠量 DOM 的侧栏右边缘，并往右让开 4px 避开官方那 8px 拖拽手柄；
		* 侧栏折叠、拖动改宽时由 ResizeObserver 跟随。
		*
		* @param props - slot props: `t`, `inputActions`, `sessionId`, `useProjection`, `remote`.
		* @returns the rail, or null.
		*/
		function QuickActionsRail(props) {
			// 该槽的 owner 不投影 locale，文案由注册方通过 `text` 传入。
			const text = typeof props.text === "function" ? props.text : (key) => (Object.hasOwn(zh, key) ? zh[key] : key);
			const inputActions = props.inputActions;
			const sessionId = props.sessionId;
			const remote = props.remote;
			let view = null;
			try {
				view = typeof props.useProjection === "function" ? props.useProjection(QUICK_ACTIONS_KEY) : null;
			} catch (error) {
				noteDegrade("quick:projection", describeError(error));
				view = null;
			}
			// 配置来源优先级：**本机存储（设置页存的）→ 宿主投影 → 内置默认**。
			// 有投影视图就以它为准（哪怕空数组），拿不到才回落默认 —— 用 length>0 判断会把
			// 「用户关掉了」误判成「没配置」。
			const [stored, setStored] = React.useState(readStoredQuickActions);
			React.useEffect(() => {
				const onChange = () => setStored(readStoredQuickActions());
				if (typeof window !== "undefined" && typeof window.addEventListener === "function") window.addEventListener(QUICK_CHANGED_EVENT, onChange);
				return () => {
					if (typeof window !== "undefined" && typeof window.removeEventListener === "function") window.removeEventListener(QUICK_CHANGED_EVENT, onChange);
				};
			}, []);
			const hasView = view !== null && view !== void 0 && Array.isArray(view.buttons);
			const fromProjection = hasView ? quickButtonsOf(view) : DEFAULT_QUICK_ACTIONS;
			const buttons = stored === null ? fromProjection : stored.buttons;
			const visible = stored === null || stored.enabled !== false;
			const [flag, setFlag] = React.useState(null);
			const railRef = React.useRef(null);
			React.useEffect(() => {
				if (flag === null) return undefined;
				const timer = setTimeout(() => {
					setFlag(null);
				}, 2000);
				return () => {
					clearTimeout(timer);
				};
			}, [flag]);
			// 位置**直接写 style**，不走 React state：拖动侧栏时每一次宽度变化都必须在同一帧里
			// 落到 `left` 上；setState → 重渲染那条路会慢半拍，拖动时就表现为"跟随不同步"。
			// ResizeObserver 的回调发生在布局之后、绘制之前，在那里改样式会在同一帧重新布局。
			React.useEffect(() => {
				const rail = railRef.current;
				if (rail === null) return undefined;
				// 侧栏宽度是 AppFrame 的内联 `gridTemplateColumns`，macOS 下没有对应的 CSS 变量，
				// `ctx.layout` 也不提供几何 —— 只能量 DOM。量不到就安静退场（CSS 默认 hidden）。
				const column = typeof document !== "undefined" && typeof document.querySelector === "function" ? document.querySelector('[class*="_sidebarCol"]') : null;
				const place = () => {
					// 量不到侧栏列时**退到一个保底位置**，而不是整条不显示 —— 宁可位置不完美，
					// 也不要让功能凭空消失（隐藏最难查）。
					if (column === null || typeof column.getBoundingClientRect !== "function") {
						noteDegrade("quick:sidebar", "量不到侧栏列，竖条退到保底位置");
						rail.style.left = "8px";
						return;
					}
					const rect = column.getBoundingClientRect();
					if (!(rect.width > 0)) {
						rail.style.left = "8px";
						return;
					}
					// +10 是让开官方那 8px 拖拽手柄（中心正压在侧栏右边缘，左右各 4px），再多留一点空。
					rail.style.left = String(Math.round(rect.right) + 8) + "px";
				};
				place();
				let observer = null;
				if (column !== null && typeof ResizeObserver === "function") {
					observer = new ResizeObserver(place);
					observer.observe(column);
				}
				if (typeof window !== "undefined" && typeof window.addEventListener === "function") window.addEventListener("resize", place);
				return () => {
					if (observer !== null) observer.disconnect();
					if (typeof window !== "undefined" && typeof window.removeEventListener === "function") window.removeEventListener("resize", place);
				};
			}, [buttons.length]);
			if (!visible || buttons.length === 0) return null;
			const insert = (text) => {
				let span;
				try {
					span = typeof inputActions.captureInsertion === "function" ? inputActions.captureInsertion() : undefined;
				} catch (error) {
					noteDegrade("quick:capture", describeError(error));
					span = undefined;
				}
				try {
					return inputActions.insertText(text, span) !== false;
				} catch (error) {
					noteDegrade("quick:insert", describeError(error));
					return false;
				}
			};
			const run = (button, from) => {
				// 三类动作：
				// · 官方命令 —— 走官方菜单 pick 的同一条代码路径（见 `runOfficialCommand`），
				//   效果与从输入框左下角菜单里选中同一条命令一致；通道不可用时降级
				// · 预设提示词 —— 把内容填进草稿，你确认后发送
				// · 技能 —— 填 `/技能名 `（末尾那个空格是关键：客户端把"命令 + 空格"认作指令行）
				if (quickKindOf(button) === "command") {
					runCommandButton(button, from);
					return;
				}
				const payload = button.kind === "skill"
					? "/" + button.value.replace(/^\/+/, "") + " "
					: button.value;
				const ok = insert(payload);
				// 填完把光标交回输入框 —— 点按钮会把 DOM 焦点抢到按钮上，
				// 不还回去的话光标就没了，接着打字也打不进去。
				// 传按钮自己进去，让查询能收窄到这条竖条所属的那份会话
				// （右侧栏聊天标签是第二份完整会话，它也有自己的输入框）。
				if (ok) focusComposer(from ?? null);
				setFlag({ id: button.id, state: ok ? "done" : "missing" });
			};
			/**
			* 走官方的「菜单 pick」决策表：与用户从输入框左下角菜单里选中同一条命令
			* **是同一条代码路径** ——
			*
			*   `commandUi.dispatch({candidate, session, span})`
			*     · 无参数命令（压缩上下文）：内部直接执行，返回 `"handled"`
			*     · 有参数命令（目标 / 计划）：返回 `{ claim }`，我们要把它交回会话 shell，
			*       方法与官方菜单点击时完全一致：向会话作用域派发 `slash/input-begin-command`
			*       （`SessionInputShell.beginCommand` 把草稿换成命令 chip，并进入收参数状态）
			*
			* `commandUi` / `sessions` 都是**官方内部服务**（不在公开服务目录里），所以整条
			* 路径写成都可能失败：任何一步拿不到就返回 `null`，由调用方降级成"填进草稿"。
			*
			* @param name - 命令名，不含前导斜杠。
			* @param from - 触发按钮（交还焦点时按它收窄会话）。
			* @returns 处理结果：`true` 已生效 / `false` 交回了但被拒 / `null` 通道不可用。
			*/
			const runOfficialCommand = (name, from) => {
				const ui = typeof commandBridge.ui === "function" ? commandBridge.ui() : null;
				const sessions = typeof commandBridge.sessions === "function" ? commandBridge.sessions() : null;
				if (ui === null || ui === void 0 || sessions === null || sessions === void 0) return Promise.resolve(null);
				let binding;
				try {
					binding = typeof sessions.binding === "function" ? sessions.binding(sessionId) : void 0;
				} catch (error) {
					noteDegrade("quick:binding", describeError(error));
					return Promise.resolve(null);
				}
				if (binding === void 0 || binding === null || binding.ctx === void 0 || binding.session === void 0) return Promise.resolve(null);
				const wait = ui.directory !== null && ui.directory !== void 0 && typeof ui.directory.ensureReady === "function"
					? ui.directory.ensureReady(sessionId, NEVER_ABORT)
					: null;
				return Promise.resolve(wait).catch(() => void 0).then(() => {
					let span;
					try {
						span = inputActions.captureInsertion();
					} catch (error) {
						noteDegrade("quick:span", describeError(error));
						return null;
					}
					let outcome;
					try {
						outcome = ui.dispatch({ candidate: { name }, session: binding.session, span });
					} catch (error) {
						noteDegrade("quick:dispatch", describeError(error));
						return null;
					}
					if (outcome === void 0 || outcome === null) return null;
					const claim = outcome.claim;
					if (claim === void 0) return true;
					try {
						const applied = binding.ctx.bail(binding.ctx, "slash/input-begin-command", { claim, span });
						if (applied === true) focusComposer(from === void 0 ? null : from);
						return applied === true;
					} catch (error) {
						noteDegrade("quick:claim", describeError(error));
						return null;
					}
				});
			};
			/**
			* 官方命令按钮的入口：先试官方通道，失败再降级。
			*
			* 降级按"这条命令要不要参数"分流（目录里 `descriptor.input`）：
			* · 要参数 → 填 `命令 + 空格` 进草稿，回车时客户端自己会进 claim（功能一致）
			* · 不要参数 → 走宿主 `remote.commands.execute`，点一下即生效
			*   （**不能**对无参数命令填草稿：`/compact ` 带空格回车会被当成普通消息发出去）
			*
			* @param button - 按钮记录。
			* @param from - 触发按钮。
			*/
			const runCommandButton = (button, from) => {
				const line = String(button.value).trim();
				const name = line.replace(/^\/+/u, "").split(/\s+/u)[0];
				const fill = (text) => {
					const ok = insert(text);
					if (ok) focusComposer(from === void 0 ? null : from);
					setFlag({ id: button.id, state: ok ? "done" : "missing" });
					return ok;
				};
				Promise.resolve(runOfficialCommand(name, from)).then((handled) => {
					if (handled !== null) {
						setFlag({ id: button.id, state: handled ? "done" : "missing" });
						return;
					}
					// —— 降级 ——
					const ui = typeof commandBridge.ui === "function" ? commandBridge.ui() : null;
					let desc;
					try {
						desc = ui !== null && ui !== void 0 && ui.directory !== null && ui.directory !== void 0 && typeof ui.directory.resolve === "function"
							? ui.directory.resolve(sessionId, name)
							: void 0;
					} catch (error) {
						noteDegrade("quick:resolve", describeError(error));
						desc = void 0;
					}
					if (desc !== void 0 && desc !== null && desc.input !== void 0) {
						noteDegrade("quick:command", "官方 pick 通道不可用，改填草稿：" + name);
						fill(line + " ");
						return;
					}
					const remote = typeof props.remote === "function" ? props.remote() : props.remote;
					const commands = remote !== null && remote !== void 0 && typeof remote.commands === "object" ? remote.commands : null;
					if (commands === null || typeof commands.execute !== "function") {
						noteDegrade("quick:command", "官方 pick 通道与宿主通道都不可用，改填草稿：" + name);
						fill(line + " ");
						return;
					}
					// 方法调用形式必须保留（解构会丢 `this`）。
					Promise.resolve(commands.execute(sessionId, line, [])).then((result) => {
						if (result !== void 0) {
							setFlag({ id: button.id, state: "done" });
							return;
						}
						noteDegrade("quick:command", "宿主通道不认这条命令，改填草稿：" + name);
						fill(line + " ");
					}).catch((error) => {
						noteDegrade("quick:command:" + button.id, describeError(error));
						setFlag({ id: button.id, state: "failed" });
					});
				}).catch((error) => {
					noteDegrade("quick:command:" + button.id, describeError(error));
					setFlag({ id: button.id, state: "failed" });
				});
			};
			// 分组渲染：三类各一组，组与组之间画一条分割线。组序固定为 QUICK_KINDS，
			// 所以"同一类挨在一起"是结构性的，不依赖配置顺序。
			const groups = groupQuickButtons(buttons).filter((group) => group.buttons.length > 0);
			const children = [];
			groups.forEach((group, index) => {
				if (index > 0) children.push(React.createElement("div", { key: "rule-" + group.kind, className: "dshQuickRail_rule", role: "separator", "aria-orientation": "horizontal" }));
				children.push(React.createElement("div", { key: "group-" + group.kind, className: "dshQuickRail_group", "data-sym-quick-group": group.kind },
					group.buttons.map((button) => React.createElement("button", {
						key: button.id,
						type: "button",
						className: "dshQuickRail_btn",
						title: button.label + "：" + button.value,
						"aria-label": button.label,
						"data-sym-quick-id": button.id,
						"data-sym-quick-kind": quickKindOf(button),
						"data-state": flag !== null && flag.id === button.id ? flag.state : void 0,
						// 鼠标按下时不抢焦点：光标原地留在输入框里，连"闪一下"都没有。
						onMouseDown: keepComposerFocus,
						onClick: (event) => {
							void run(button, event === null || event === void 0 ? null : event.currentTarget);
						}
					}, React.createElement(QuickIcon, { name: button.icon || button.id, key: "g" })))));
			});
			return React.createElement("div", {
				className: "dshQuickRail",
				ref: railRef,
				"data-sym-quick-actions": String(buttons.length),
				"data-sym-quick-source": stored !== null ? "stored" : (hasView ? "projection" : "fallback")
			}, children);
		}

		//#region quick actions settings

		/**
		* 非渲染上下文里的本地化文字：slot 的 `label` 是注册期给的（可以是 thunk），
		* 那里拿不到组件里的 `t`，所以直接读 locale 快照 + 自带字典。
		* @param ctx - client context carrying `locale`.
		* @param key - dictionary key.
		* @returns 当前语言下的文字。
		*/
		function localeLabel(ctx, key) {
			let locale = "zh";
			try {
				const snapshot = ctx.locale.getSnapshot();
				if (snapshot !== null && typeof snapshot === "object" && typeof snapshot.active === "string") locale = snapshot.active;
			} catch (error) {
				noteDegrade("label:locale", describeError(error));
			}
			const dict = locale.toLowerCase().startsWith("en") ? en : zh;
			return Object.hasOwn(dict, key) ? dict[key] : key;
		}

		/** 新按钮的 id：只用于配置里的去重与图标回退，取一个不易撞的短串即可。 */
		function newButtonId() {
			return "custom-" + Math.random().toString(36).slice(2, 8);
		}

		/**
		* 竖条最近一次渲染错误（模块级）：竖条一旦抛错就被 React 卸载，错误一闪而过，
		* 所以留一份在这里，设置页会把它显示出来。
		*/
		let railError = null;

		/** 读竖条最近的渲染错误文本，没有时返回空串。 */
		function getRailError() {
			return railError === null ? "" : String(railError);
		}

		/** 显示项开关存在浏览器本地，与快捷按钮同一套思路（广播同一个变更事件）。 */
		const DISPLAY_STORAGE_KEY = "dsh-sym.display-options";
		/** 三个显示项默认都开。 */
		const DEFAULT_DISPLAY_OPTIONS = Object.freeze({ balance: true, cost: true, memory: true });

		/**
		* 读显示项开关；读不到或读坏时全开。
		* @returns `{ balance, cost, memory }`。
		*/
		function readDisplayOptions() {
			try {
				if (typeof localStorage === "undefined") return DEFAULT_DISPLAY_OPTIONS;
				const raw = localStorage.getItem(DISPLAY_STORAGE_KEY);
				if (raw === null || raw === "") return DEFAULT_DISPLAY_OPTIONS;
				const parsed = JSON.parse(raw);
				if (parsed === null || typeof parsed !== "object") return DEFAULT_DISPLAY_OPTIONS;
				return {
					balance: parsed.balance !== false,
					cost: parsed.cost !== false,
					memory: parsed.memory !== false
				};
			} catch (error) {
				noteDegrade("display:read", describeError(error));
				return DEFAULT_DISPLAY_OPTIONS;
			}
		}

		/**
		* 写显示项开关。
		* @param options - `{ balance, cost, memory }`。
		* @returns 是否写入成功。
		*/
		function writeDisplayOptions(options) {
			try {
				if (typeof localStorage === "undefined") return false;
				localStorage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify({
					balance: options.balance !== false,
					cost: options.cost !== false,
					memory: options.memory !== false
				}));
				return true;
			} catch (error) {
				noteDegrade("display:write", describeError(error));
				return false;
			}
		}

		/**
		* 读显示项开关并**跟随变更事件重新渲染**：设置页一改，界面上各处立即同步。
		* @returns `{ balance, cost, memory }`。
		*/
		function useDisplayOptions() {
			const [options, setOptions] = React.useState(readDisplayOptions);
			React.useEffect(() => {
				const onChange = () => setOptions(readDisplayOptions());
				if (typeof window !== "undefined" && typeof window.addEventListener === "function") window.addEventListener(QUICK_CHANGED_EVENT, onChange);
				return () => {
					if (typeof window !== "undefined" && typeof window.removeEventListener === "function") window.removeEventListener(QUICK_CHANGED_EVENT, onChange);
				};
			}, []);
			return options;
		}

		/** 用户配置存放在浏览器本地：按钮清单只有客户端在用，不必绕宿主一圈。 */
		const QUICK_STORAGE_KEY = "dsh-sym.quick-actions";
		/** 设置页保存后广播，让页面上的竖条重新读取（两者是不同的组件实例）。 */
		const QUICK_CHANGED_EVENT = "dsh-sym:quick-actions-changed";

		/**
		* 读用户配置。
		* @returns `{ buttons, enabled, commandsAdded }`，没配过或读坏时 null（调用方回落默认）。
		*/
		function readStoredQuickActions() {
			try {
				if (typeof localStorage === "undefined") return null;
				const raw = localStorage.getItem(QUICK_STORAGE_KEY);
				if (raw === null || raw === "") return null;
				const parsed = JSON.parse(raw);
				if (parsed === null || typeof parsed !== "object") return null;
				const buttons = quickButtonsOf(parsed);
				if (buttons.length === 0) return null;
				return { buttons, enabled: parsed.enabled !== false, commandsAdded: parsed.commandsAdded === true };
			} catch (error) {
				noteDegrade("quick:storage-read", describeError(error));
				return null;
			}
		}

		/**
		* 写用户配置。
		*
		* `commandsAdded` 是"官方命令的补回动作已经做过（或用户已经手动管过清单）"的标记：
		* 不传就**沿用存储里的旧值**——设置页保存、导出这类日常写入不该把它清掉，
		* 否则用户删掉官方命令后，下次刷新又会被自动补回来。
		*
		* @param buttons - 按钮数组；null 表示恢复内置默认（清掉存储）。
		* @param enabled - 是否显示整条竖条。
		* @param options - `{ commandsAdded }`，省略时沿用旧值。
		* @returns 是否写入成功。
		*/
		function writeStoredQuickActions(buttons, enabled, options) {
			try {
				if (typeof localStorage === "undefined") return false;
				if (buttons === null) {
					localStorage.removeItem(QUICK_STORAGE_KEY);
					return true;
				}
				const previous = readStoredQuickActions();
				const commandsAdded = options !== null && options !== void 0 && options.commandsAdded !== void 0
					? options.commandsAdded === true
					: previous !== null && previous.commandsAdded === true;
				localStorage.setItem(QUICK_STORAGE_KEY, JSON.stringify({ enabled, buttons, commandsAdded }));
				return true;
			} catch (error) {
				noteDegrade("quick:storage-write", describeError(error));
				return false;
			}
		}

		/**
		* 一次性迁移：把内置的三条官方命令补回**已保存**的清单。
		*
		* 为什么需要它：默认清单只对"从没配过"的人生效，而已经配过按钮的人（比如本项目
		* 作者自己）清单里一条官方命令都没有，加回默认也看不见。触发条件收紧到三条同时成立：
		* 存储存在、里面**一个 `command` 类型都没有**、且**没补过**（`commandsAdded` 标记）。
		* 所以用户手动删掉之后不会再被加回来——用户的选择优先于默认值。
		*
		* @returns 是否真的写了存储。
		*/
		function migrateStoredQuickActions() {
			const stored = readStoredQuickActions();
			if (stored === null || stored.commandsAdded) return false;
			if (stored.buttons.some((button) => quickKindOf(button) === "command")) return false;
			const taken = new Set(stored.buttons.map((button) => button.id));
			const add = DEFAULT_QUICK_ACTIONS.filter((button) => quickKindOf(button) === "command" && !taken.has(button.id));
			if (add.length === 0) return false;
			const ok = writeStoredQuickActions(add.concat(stored.buttons), stored.enabled, { commandsAdded: true });
			if (ok) notifyQuickActionsChanged();
			return ok;
		}

		/** 广播一次「配置变了」。 */
		function notifyQuickActionsChanged() {
			try {
				if (typeof window !== "undefined" && typeof window.dispatchEvent === "function" && typeof CustomEvent === "function") {
					window.dispatchEvent(new CustomEvent(QUICK_CHANGED_EVENT));
				}
			} catch (error) {
				noteDegrade("quick:notify", describeError(error));
			}
		}

		/**
		* 导出：把按钮清单存成 JSON 文件下载。
		* @param buttons - 按钮数组。
		* @returns 是否发起了下载。
		*/
		function downloadQuickActions(buttons) {
			try {
				if (typeof document === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return false;
				const blob = new Blob([JSON.stringify({ version: 1, buttons }, null, 2)], { type: "application/json" });
				const url = URL.createObjectURL(blob);
				const anchor = document.createElement("a");
				anchor.href = url;
				anchor.download = "dsh-sym-quick-actions.json";
				anchor.click();
				URL.revokeObjectURL(url);
				return true;
			} catch (error) {
				noteDegrade("quick:export", describeError(error));
				return false;
			}
		}

		/**
		* 解析导入的 JSON：既接受 `{ buttons: [...] }`，也接受裸数组。
		* @param raw - 文件内容。
		* @returns 按钮数组；认不出或为空时 null。
		*/
		function parseQuickActionsFile(raw) {
			try {
				const parsed = JSON.parse(raw);
				const buttons = quickButtonsOf(Array.isArray(parsed) ? { buttons: parsed } : parsed);
				return buttons.length === 0 ? null : buttons;
			} catch (error) {
				noteDegrade("quick:import", describeError(error));
				return null;
			}
		}

		/** 设置页的初始草稿：存储优先，否则内置默认。 */
		function quickDraftFromStorage() {
			const stored = readStoredQuickActions();
			return (stored === null ? DEFAULT_QUICK_ACTIONS : stored.buttons).map(buttonToDraft);
		}

		/** 设置页的初始开关：存储优先，否则默认开启。 */
		function quickEnabledFromStorage() {
			const stored = readStoredQuickActions();
			return stored === null ? true : stored.enabled !== false;
		}

		/** 只留 schema 声明的字段，别把界面状态一起写回配置文件。 */
		function toConfigButton(button) {
			return {
				id: typeof button.id === "string" && button.id.length > 0 ? button.id : newButtonId(),
				label: typeof button.label === "string" ? button.label : "",
				icon: typeof button.icon === "string" && button.icon.length > 0 ? button.icon : "dot",
				kind: button.kind === "command" ? "command" : button.kind === "skill" ? "skill" : "prompt",
				value: typeof button.value === "string" ? button.value : ""
			};
		}

		/** 配置/默认清单里的按钮 → 编辑用草稿（补齐可显示的字段）。 */
		function buttonToDraft(button) {
			const base = toConfigButton(button);
			return {
				id: base.id,
				label: base.label.length > 0 ? base.label : base.id,
				icon: base.icon,
				kind: base.kind,
				value: base.value
			};
		}

		/** 「内容」输入框的占位文案随动作类型变化。 */
		function valuePlaceholderKey(kind) {
			return kind === "command" ? "quickSettingsValueCommand" : kind === "skill" ? "quickSettingsValueSkill" : "quickSettingsValuePrompt";
		}

		/** 设置页里每一类的分组小标题。 */
		function groupTitleKey(kind) {
			return kind === "command" ? "quickGroupCommand" : kind === "skill" ? "quickGroupSkill" : "quickGroupPrompt";
		}

		/**
		* 快捷按钮的设置页。
		*
		* 配置读写全部走官方 `remote.settings`：`describe()` 读（顺带拿到 namespace 与
		* revision），`update()` 写回 profile patch 里本插件 entry 的 config。保存后插件
		* 会重载、新清单随即生效，所以这里不需要自己通知界面刷新。
		*
		* @param props - `t`, `remote`.
		* @returns the settings page.
		*/
		/**
		* 设置页的错误边界：把渲染阶段抛出的异常显示成一行文字，而不是让整页空白。
		* 空白最难查 —— 它和「没挂上」「没渲染」「渲染了但没内容」长得一模一样。
		*/
		class QuickActionsSettingsBoundary extends React.Component {
			constructor(props) {
				super(props);
				this.state = { error: null };
			}
			static getDerivedStateFromError(error) {
				return { error };
			}
			componentDidCatch(error) {
				if (typeof this.props.onError === "function") this.props.onError(error);
			}
			render() {
				if (this.state.error !== null) {
					const message = this.state.error !== null && this.state.error !== void 0 && this.state.error.message !== void 0 ? this.state.error.message : String(this.state.error);
					return React.createElement("div", { className: "dshQuickSet" },
						React.createElement("div", { className: "dshQuickSet_error" }, "快捷按钮渲染失败：" + message));
				}
				return this.props.children;
			}
		}

		/**
		* 快捷按钮的设置页。
		*
		* 配置存在**浏览器本地**（localStorage），保存后**立即生效**：这里写完广播一次
		* `QUICK_CHANGED_EVENT`，页面上的竖条收到就重新读取。所以整条链路不需要任何宿主
		* 往返，也不需要重载插件。
		*
		* 为什么不用官方设置表单（走 remote.settings + Config schema）：那条路要求字段声明
		* 为 `.volatile()`，而实测 `.volatile()` 的语义是「该字段的值由设置服务托管」——
		* 它会把值变成 `{}`（`new Config({})` → `{ enabled: {}, buttons: {} }`），不是
		* 「标记为可编辑」。按钮清单只有客户端在用，本地存储既够用又更即时。
		*
		* @param props - `text`（本地化函数；这个槽的 owner 不投影 locale）。
		* @returns the settings page.
		*/
		/**
		* 显示项的一行开关（余额 / 计费 / 内存）。
		*
		* 拨动即写本地存储并广播变更事件，界面各处收到就重读 —— 这里不需要"保存"按钮。
		*
		* @param props - `optionKey`（`balance` / `cost` / `memory`）与 `label`。
		* @returns the row element.
		*/
		function DisplayToggle(props) {
			const options = useDisplayOptions();
			return React.createElement("label", { className: "dshQuickOpt" }, [
				React.createElement("input", {
					key: "cb",
					type: "checkbox",
					checked: options[props.optionKey] !== false,
					onChange: (event) => {
						const next = Object.assign({}, readDisplayOptions(), { [props.optionKey]: event.target.checked });
						writeDisplayOptions(next);
						notifyQuickActionsChanged();
					}
				}),
				React.createElement("span", { key: "tx" }, props.label)
			]);
		}

		function QuickActionsSettings(props) {
			const text = typeof props.text === "function" ? props.text : (key) => (Object.hasOwn(zh, key) ? zh[key] : key);
			const [draft, setDraft] = React.useState(quickDraftFromStorage);
			const [enabled, setEnabled] = React.useState(quickEnabledFromStorage);
			const [picker, setPicker] = React.useState(null);
			const [status, setStatus] = React.useState("");
			const patchButton = (index, patch) => {
				setDraft((list) => list.map((button, i) => (i === index ? Object.assign({}, button, patch) : button)));
			};
			/**
			* 组内换位：只与**同类**的相邻按钮交换，所以永远跨不出这一类。
			*
			* 交换的是 draft 数组里的两个槽位（长度与槽位不动），因此其他类的按钮位置
			* 完全不受影响 —— "不能跨类排列"是运算本身的性质，不是渲染时的错觉。
			*
			* @param kind - 所属类。
			* @param offsetInGroup - 该按钮在本组内的序号。
			* @param delta - `-1` 上移 / `+1` 下移。
			*/
			const moveButton = (kind, offsetInGroup, delta) => {
				setDraft((list) => {
					const inGroup = list
						.map((button, index) => ({ button, index }))
						.filter((entry) => quickKindOf(entry.button) === kind);
					const from = inGroup[offsetInGroup];
					const to = inGroup[offsetInGroup + delta];
					if (from === void 0 || to === void 0) return list;
					const next = list.slice();
					next[from.index] = to.button;
					next[to.index] = from.button;
					return next;
				});
			};
			const removeButton = (index) => {
				setDraft((list) => list.filter((_, i) => i !== index));
				setPicker(null);
			};
			const addButton = () => {
				setDraft((list) => list.concat([{ id: newButtonId(), label: "", icon: "sparkles", kind: "prompt", value: "" }]));
			};
			const commit = () => {
				const buttons = draft.map(toConfigButton).filter((button) => button.value.length > 0);
				const skipped = draft.length - buttons.length;
				// 用户在这里明确管过清单了：打上标记，此后不再自动补回官方命令。
				const ok = writeStoredQuickActions(buttons.length === 0 ? null : buttons, enabled, { commandsAdded: true });
				notifyQuickActionsChanged();
				if (!ok) {
					setStatus(text("quickSettingsNoStorage"));
					return;
				}
				// 被跳过的条目要说出来：静默丢弃会让人以为「保存没生效」。
				setStatus(skipped > 0
					? text("quickSettingsSavedSkipped").replace("{count}", String(skipped))
					: text("quickSettingsSaved").replace("{count}", String(buttons.length)));
			};
			const fileRef = React.useRef(null);
			const exportAll = () => {
				const ok = downloadQuickActions(draft.map(toConfigButton).filter((button) => button.value.length > 0));
				setStatus(ok ? text("quickSettingsExported") : text("quickSettingsExportFailed"));
			};
			const importFile = (event) => {
				const files = event.target.files;
				const file = files !== null && files !== void 0 && files.length > 0 ? files[0] : null;
				// 清空 value：同一个文件连选两次也要能触发 change。
				event.target.value = "";
				if (file === null || typeof FileReader === "undefined") {
					setStatus(text("quickSettingsImportFailed"));
					return;
				}
				const reader = new FileReader();
				reader.onload = () => {
					const buttons = parseQuickActionsFile(String(reader.result));
					if (buttons === null) {
						setStatus(text("quickSettingsImportFailed"));
						return;
					}
					setDraft(buttons.map(buttonToDraft));
					setStatus(text("quickSettingsImported").replace("{count}", String(buttons.length)));
				};
				reader.onerror = () => {
					setStatus(text("quickSettingsImportFailed"));
				};
				reader.readAsText(file);
			};
			const reset = () => {
				writeStoredQuickActions(null, true);
				notifyQuickActionsChanged();
				setDraft(DEFAULT_QUICK_ACTIONS.map(buttonToDraft));
				setEnabled(true);
				setPicker(null);
				setStatus(text("quickSettingsReset"));
			};
			/**
			* 一行按钮的编辑控件。`index` 是它在 draft 里的绝对下标（改值 / 删除用），
			* `offsetInGroup` 与 `groupSize` 是它在**本组内**的位置（上下移用）——
			* 两套坐标分开，↑↓ 才只能在本类里走。
			*
			* @param button - 该行的按钮。
			* @param index - draft 里的绝对下标。
			* @param kind - 所属类。
			* @param offsetInGroup - 组内序号。
			* @param groupSize - 本组条数。
			* @returns the row element.
			*/
			const rowFor = (button, index, kind, offsetInGroup, groupSize) => React.createElement("div", { className: "dshQuickSet_row", key: button.id + "-" + String(index) }, [
				React.createElement("button", {
					key: "icon",
					type: "button",
					className: "dshQuickSet_iconBtn",
					title: text("quickSettingsPickIcon"),
					"aria-label": text("quickSettingsPickIcon"),
					onClick: () => {
						setPicker(picker === index ? null : index);
					}
				}, React.createElement(QuickIcon, { name: button.icon })),
				React.createElement("input", {
					key: "label",
					className: "dshQuickSet_input",
					value: button.label,
					placeholder: text("quickSettingsLabel"),
					"aria-label": text("quickSettingsLabel"),
					onChange: (event) => {
						patchButton(index, { label: event.target.value });
					}
				}),
				React.createElement("select", {
					key: "kind",
					className: "dshQuickSet_select",
					value: kind,
					"aria-label": text("quickSettingsKindPrompt"),
					onChange: (event) => {
						const next = event.target.value;
						// 换了类型就清空内容：提示词与命令行语义不同，留着会变成另一种类型的脏值
						patchButton(index, { kind: next, value: next === kind ? button.value : "" });
					}
				}, [
					React.createElement("option", { key: "c", value: "command" }, text("quickSettingsKindCommand")),
					React.createElement("option", { key: "s", value: "skill" }, text("quickSettingsKindSkill")),
					React.createElement("option", { key: "p", value: "prompt" }, text("quickSettingsKindPrompt"))
				]),
				React.createElement("input", {
						key: "value",
						className: "dshQuickSet_input dshQuickSet_wide",
						value: button.value,
						placeholder: text(valuePlaceholderKey(kind)),
						"aria-label": text(valuePlaceholderKey(kind)),
						onChange: (event) => {
							patchButton(index, { value: event.target.value });
						}
					}),
				React.createElement("button", {
					key: "up",
					type: "button",
					className: "dshQuickSet_mini",
					title: text("quickSettingsMoveUp"),
					"aria-label": text("quickSettingsMoveUp"),
					disabled: offsetInGroup === 0,
					onClick: () => {
						moveButton(kind, offsetInGroup, -1);
					}
				}, "\u2191"),
				React.createElement("button", {
					key: "down",
					type: "button",
					className: "dshQuickSet_mini",
					title: text("quickSettingsMoveDown"),
					"aria-label": text("quickSettingsMoveDown"),
					disabled: offsetInGroup === groupSize - 1,
					onClick: () => {
						moveButton(kind, offsetInGroup, 1);
					}
				}, "\u2193"),
				React.createElement("button", {
					key: "remove",
					type: "button",
					className: "dshQuickSet_mini",
					title: text("quickSettingsRemove"),
					"aria-label": text("quickSettingsRemove"),
					onClick: () => {
						removeButton(index);
					}
				}, "\u2715")
			]);
			// 按类分区渲染：每类一个小标题 + 本类若干行。空组不占位（否则三行标题里
			// 有两行是空的，读起来像坏了）。顺序固定 `QUICK_KINDS`，与竖条一致。
			const rows = [];
			QUICK_KINDS.forEach((kind) => {
				const inGroup = draft
					.map((button, index) => ({ button, index }))
					.filter((entry) => quickKindOf(entry.button) === kind);
				if (inGroup.length === 0) return;
				rows.push(React.createElement("div", { className: "dshQuickSet_groupTitle", key: "group-" + kind }, text(groupTitleKey(kind))));
				inGroup.forEach((entry, offset) => {
					rows.push(rowFor(entry.button, entry.index, kind, offset, inGroup.length));
				});
			});
			const pickerBox = picker === null ? null : React.createElement("div", { className: "dshQuickSet_picker" }, QUICK_ICON_NAMES.map((name) => React.createElement("button", {
				key: name,
				type: "button",
				className: "dshQuickSet_pickCell",
				title: name,
				"aria-label": name,
				onClick: () => {
					patchButton(picker, { icon: name });
					setPicker(null);
				}
			}, React.createElement(QuickIcon, { name }))));
			return React.createElement("div", { className: "dshQuickSet" }, [
				React.createElement("div", { className: "dshQuickSet_title", key: "title" }, text("quickSettingsTitle")),
				React.createElement("div", { className: "dshQuickSet_hint", key: "subtitle" }, text("quickSettingsSubtitle")),
				getRailError() === "" ? null : React.createElement("div", { className: "dshQuickSet_error", key: "railError" }, "竖条渲染失败：" + getRailError()),
				React.createElement("div", { className: "dshQuickSet_section", key: "secDisplay" }, text("displaySectionTitle")),
				React.createElement("div", { className: "dshQuickSet_hint", key: "displayHint" }, text("displaySectionHint")),
				React.createElement("div", { className: "dshQuickOptRow", key: "displayRow" }, [
					React.createElement(DisplayToggle, { key: "t-balance", optionKey: "balance", label: text("displayBalance") }),
					React.createElement(DisplayToggle, { key: "t-cost", optionKey: "cost", label: text("displayCost") }),
					React.createElement(DisplayToggle, { key: "t-memory", optionKey: "memory", label: text("displayMemory") })
				]),
				React.createElement("div", { className: "dshQuickSet_section", key: "secButtons" }, text("quickSectionButtons")),
				React.createElement("div", { className: "dshQuickSet_hint", key: "hint" }, text("quickSettingsHint")),
				React.createElement("div", { className: "dshQuickSet_hint", key: "groupHint" }, text("quickGroupHint")),
				React.createElement("label", { className: "dshQuickSet_toggle", key: "toggle" }, [
					React.createElement("input", {
						key: "cb",
						type: "checkbox",
						checked: enabled,
						onChange: (event) => {
							setEnabled(event.target.checked);
						}
					}),
					React.createElement("span", { key: "tx" }, text("quickSettingsEnabled"))
				]),
				...rows,
				pickerBox,
				React.createElement("div", { className: "dshQuickSet_footer", key: "footer" }, [
					React.createElement("button", {
						key: "add",
						type: "button",
						className: "dshQuickSet_add",
						onClick: addButton
					}, "+ " + text("quickSettingsAdd")),
					React.createElement("button", {
						key: "save",
						type: "button",
						className: "dshQuickSet_save",
						onClick: commit
					}, text("quickSettingsSave")),
					React.createElement("button", {
						key: "reset",
						type: "button",
						className: "dshQuickSet_add",
						onClick: reset
					}, text("quickSettingsReset")),
					React.createElement("button", {
						key: "export",
						type: "button",
						className: "dshQuickSet_add",
						onClick: exportAll
					}, text("quickSettingsExport")),
					React.createElement("button", {
						key: "import",
						type: "button",
						className: "dshQuickSet_add",
						onClick: () => {
							if (fileRef.current !== null) fileRef.current.click();
						}
					}, text("quickSettingsImport")),
					React.createElement("input", {
						key: "file",
						type: "file",
						accept: ".json,application/json",
						ref: fileRef,
						style: { display: "none" },
						onChange: importFile
					}),
					status === "" ? null : React.createElement("span", {
						key: "status",
						className: "dshQuickSet_status",
						"data-state": status === text("quickSettingsNoStorage") ? "error" : "saved"
					}, status)
				])
			]);
		}

		//#endregion

		//#region cost component
		/**
		* A banknote, marking the whole-session figure.
		*/
		function SessionGlyph() {
			return React.createElement("svg", {
				viewBox: "0 0 16 16",
				"aria-hidden": true,
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.3
			}, React.createElement("rect", { x: "1.3", y: "4.1", width: "13.4", height: "7.8", rx: "1.6" }), React.createElement("circle", { cx: "8", cy: "8", r: "1.9" }));
		}
		/**
		* A speech bubble: the task figure is one turn of this conversation, and the
		* bubble is the row's own word for that. The earlier tick-on-a-track mark
		* read as a slider, not as one task's cost.
		*/
		function TaskGlyph() {
			return React.createElement("svg", {
				viewBox: "0 0 16 16",
				"aria-hidden": true,
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.3,
				strokeLinejoin: "round"
			}, React.createElement("rect", { x: "1.8", y: "3.0", width: "12.4", height: "8.0", rx: "2" }), React.createElement("path", { d: "M4.9 10.9v2.6l3.1-2.6" }));
		}
		/**
		* One cost cell: leading glyph and the amount.
		* @param props - glyph, amount text, breakdown text, and a test hook.
		* @returns the pill element.
		*/
		/**
		* Ordered `conversation.composer.dock` entry: the session's running cost,
		* then the cost of the task the rail has selected — both in RMB, after the
		* shipped statistics pills.
		* @param props - slot standard props; `useProjection` reads the host value.
		* @returns the cells, or null while nothing has been billed yet.
		*/
		function CostPill(props) {
			const useProjection = props.useProjection;
			const view = useProjection(PROJECTION_KEY);
			const activeTurn = useActiveTurn();
			// hooks 必须无条件、按同一顺序调用 —— 所以这三个都提到任何 return 之前。
			// （原先 `useDisplayOptions()` 排在下面那道 return 之后：第一轮从"未结算"走到
			//  "已结算"时 hook 数量会从 2 变 4，属于条件 hook，React 会报错。）
			const display = useDisplayOptions();
			const t = props.t;
			if (view === null || view === void 0) return null;
			// 计费要等第一次结算（`assistant/message` 带 usage）之后才有数据：宿主的 `requests`
			// 与 token 桶都只在那一个事件里累加，流式分片里没有任何用量字段。所以新会话第一轮
			// **进行中**算不出金额，是数据层面的必然，不是这里偷懒。
			// 但内存读数与结算无关，不能跟着一起消失 —— 原先那道 `!(view.requests > 0)` 把整格
			// return 掉，进行中连内存都没有，看起来像整个读数坏了（用户就是这么误判的）。
			const billed = view.requests > 0;
			const turns = Array.isArray(view.turns) ? view.turns : [];
			const task = pickTurn(turns, activeTurn);
			const unpricedMark = Array.isArray(view.unpriced) && view.unpriced.length > 0 ? "*" : "";
			// One button carries both figures: the session total, then the task the rail
			// has selected. They used to be two separate pills; the click-through panel
			// already breaks them apart, so the bar itself needs one entry point.
			const parts = [React.createElement("span", { className: "dshSym_label", key: "session" },
				tr(t, "amount", { amount: formatCny(view.cny) }) + unpricedMark)];
			const taskTitle = turns.length >= 2 && task !== null
				? describeScope(task, t, tr(t, "taskTitle", { turn: task.turn, amount: formatCny(task.cny) }))
				: null;
			if (taskTitle !== null) {
				parts.push(React.createElement("span", { className: "dshSym_sep", key: "sep", "aria-hidden": true }, "·"));
				parts.push(React.createElement("span", { className: "dshSym_label", key: "task" },
					tr(t, "amount", { amount: formatCny(task.cny) })));
			}
			const sessionTitle = describeScope(view, t, tr(t, "totalTitle", { amount: formatCny(view.cny) }));
			const title = taskTitle === null ? sessionTitle : sessionTitle + "\n\n" + taskTitle;
			const memLabel = formatBytes(view.memory === null || view.memory === void 0 ? null : view.memory.rss);
			const showCost = display.cost !== false && billed;
			const showMemory = display.memory !== false && memLabel !== null;
			// 两个都关掉就整块不渲染，免得留下一个空容器占位。
			if (!showCost && !showMemory) return null;
			const body = React.createElement("span", {
				className: "dshSym_root",
				"data-sym-cost": true,
				"data-sym-cost-turn": task === null ? "" : String(task.turn)
			}, [
				showCost ? React.createElement("span", {
					className: "dshSym_pill",
					title,
					"aria-label": title,
					"data-sym-cost-part": "merged",
					key: "cost"
				}, [React.createElement(SessionGlyph, { key: "glyph" }), ...parts]) : null,
				// Resident memory sits last, as a plain readout: it is not clickable and
				// has no panel, so it stays out of the cost button.
				showMemory ? React.createElement("span", {
					className: "dshSym_pill dshSym_mem",
					title: tr(t, "memoryTitle"),
					"aria-label": tr(t, "memoryTitle"),
					"data-sym-memory": view.memory.rss,
					key: "mem"
				}, [React.createElement(MemoryGlyph, { key: "g" }), React.createElement("span", { className: "dshSym_label", key: "l" }, memLabel)]) : null
			]);
			// 没有花费数据时（新会话第一轮进行中）只渲染内存读数，不给它套可点击的面板包装：
			// 内存本来就是不可点的普通读数，套上去只会点出一个空账单。
			return showCost ? React.createElement(CostPanel, { scope: view, task, t }, body) : body;
		}
		//#endregion

		//#region plugin
		/**
		* The brand wordmark component, when this deployment ships it. Absence is not
		* an error: the sidebar keeps its own name and only the rate tag is lost.
		* @returns the primitives module, or null.
		*/
		function brandPrimitives() {
			try {
				const module = require("@deepseek-ai/dsh-client-ui-primitives");
				return module !== null && typeof module === "object" && module.BrandWordmark !== void 0 ? module : null;
			} catch (error) {
				// A deployment without the primitives bundle is not broken — only the
				// brand-row rate tag is unavailable. Recorded once, for that question.
				noteDegrade("brand:primitives", describeError(error));
				return null;
			}
		}

		/** The slot and locale registries are this entry's base outreach. */
		const inject = ["slots", "locale"];

		/**
		* Cells this bundle already claimed in this page, keyed by `slot#id`.
		*
		* The `slots` service exposes no way to ask "is this id taken?" — `register`,
		* `registerFactory` and `inject` are the whole client face — so the bundle
		* keeps its own ledger. A duplicate id must never take the whole declaration
		* down with it (AUD-OPS-001): the second call is skipped, and anything the
		* registry itself rejects is caught and reported instead of thrown.
		*/
		const claimedSlotCells = new Set();

		/**
		* Register one additive slot cell, tolerating a duplicate id.
		*
		* Only a successful registration is recorded, so a registry-side rejection can
		* be retried later; a duplicate within this bundle instance is skipped outright.
		* Callers ignore the return value — the disposer is owned by `ctx.effect`, and
		* a skipped or failed cell simply contributes nothing.
		*
		* @param ctx - the client context that owns the registration's lifetime.
		* @param name - slot key.
		* @param id - entry id, unique within the slot.
		* @param order - additive ordering among the slot's occupants.
		* @param component - the slot component.
		* @param extra - extra registration options (e.g. `label` for a nav entry).
		* @returns the registry's disposer, or null when nothing was registered.
		*/
		function registerSlotCell(ctx, name, id, order, component, extra) {
			const claim = name + "#" + id;
			if (claimedSlotCells.has(claim)) {
				noteDegrade("slot:" + claim, "同一 id 在本页已注册过，跳过重复注册以免整块失败");
				return null;
			}
			try {
				const options = { name, id, order, locale: NS };
				if (extra !== null && extra !== void 0) Object.assign(options, extra);
				// `locale: null` 表示这个槽的 owner **不投影 locale**（`settings.section` 就是：
				// shell 不订阅 locale 状态，本地化文字由注册方自己给），此时不能带这个字段。
				if (options.locale === null) delete options.locale;
				const disposer = ctx.slots.register(options, component);
				claimedSlotCells.add(claim);
				return disposer;
			} catch (error) {
				const detail = error !== null && error !== void 0 && error.message !== void 0 ? error.message : String(error);
				noteDegrade("slot:" + claim, "注册被拒：" + detail);
				return null;
			}
		}
		/**
		* Claim one additive cell in the composer's ambient dock, ordered after the
		* shipped `stats` cell so the cost reads as the last figures of the group.
		* The balance cell is registered separately and only when the account Remote
		* namespace is present, so a deployment without it still gets the cost cells.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-sym: dictionaries");
			// 官方命令通道：`commandUi` 的菜单 pick 决策表 + `sessions` 的会话 ctx。
			// 两者都是官方内部服务，拿不到时整块留空、按钮自动降级，不影响其他功能。
			commandBridge.ui = null;
			commandBridge.sessions = null;
			ctx.inject(["commandUi", "sessions"], (scope) => {
				commandBridge.ui = () => scope.get("commandUi");
				commandBridge.sessions = () => scope.get("sessions");
			});
			// 宿主命令通道（降级路径用）。必须**条件注入**：`ctx.get("remote")` 在未声明
			// 注入时会抛 `cannot get property "remote" without inject`，而这里的调用点
			// 在点击时，抛错就会把整次点击吞成"失败"。拿不到时返回 null，按钮改填草稿。
			let remoteGetter = () => null;
			ctx.inject(["remote", "remote.commands"], (scope) => {
				remoteGetter = () => {
					try {
						return scope.get("remote");
					} catch (error) {
						noteDegrade("quick:remote", describeError(error));
						return null;
					}
				};
			});
			installPeakTag(ctx);
			// 一次性迁移：把三条官方命令补回已保存的清单（只补一次，用户删掉后不再补）。
			// 放在 apply 里：插件每次加载正好执行一次，早于竖条与设置页的首次读取。
			migrateStoredQuickActions();
			ctx.slots.inject("conversation.composer.dock", () => registerSlotCell(ctx, "conversation.composer.dock", "sym-cost", 10, CostPill));
			// Quote action on every finalized reply. It needs only the chat store and
			// the composer actions, so it registers unconditionally.
			// Context menu for file links in the transcript. Registered unconditionally:
			// copying a path needs nothing from the Host, and only the reveal action
			// checks for the session remote at call time.
			ctx.slots.inject("conversation.composer.dock", () => registerSlotCell(ctx, "conversation.composer.dock", "link-menu", 20, function LinkMenuSlot(slotProps) {
				return React.createElement(LinkContextMenu, { t: slotProps.t, remote: ctx.get("remote") });
			}));
			ctx.slots.inject("conversation.chat.assistant-actions", () => registerSlotCell(ctx, "conversation.chat.assistant-actions", "turn-cost", 30, TurnCostCell));
			ctx.slots.inject("conversation.chat.assistant-actions", () => registerSlotCell(ctx, "conversation.chat.assistant-actions", "quote-reference", 20, QuoteAction));
			// 竖条挂在**会话头部**，不是 composer 上。`conversation.composer` 是 `chain` 型槽：
			// 问卷、审批、计划复核出现时，整个 composer 会被替换掉，挂在它下面的条目一并
			// 卸载 —— 实机表现就是「交互式问卷一弹出来，竖条就没了」。会话头部在整个会话
			// 期间常驻，而且 standard props 一样齐全（inputActions / sessionId / useProjection）。
			// 元素自身是 `position: fixed`，所以并不会混进头部那排官方工具图标里。
			// `remote` 每次渲染现取，不随注册固定：该服务可能在本条目之后才就绪。
			// 注册点：`conversation.session.header.utilities` —— 会话头部在整个会话期间常驻，
			// **不会**因为问卷/审批把内容区整体替换而卸载（`conversation.input.dock` 就会，
			// 表现为「问卷一弹出来竖条就没了」）。
			//
			// `locale: null` 是必须的：这个槽的 owner 不投影 locale（standardProps 里没有 `t`），
			// 带了 locale 声明的条目不会被渲染。文案由 `text` 传入。详见 AGENTS.md。
			ctx.slots.inject("conversation.session.header.utilities", () => registerSlotCell(ctx, "conversation.session.header.utilities", "quick-actions", 30, function QuickActionsSlot(slotProps) {
				// 用错误边界包住：竖条渲染期一旦抛错，React 会把它整块卸载掉，
				// 界面上就是「什么都没有」——把错误显示出来才查得动。
				return React.createElement(QuickActionsSettingsBoundary, {
					onError: (error) => {
						railError = error !== null && error !== void 0 && error.message !== void 0 ? error.message : String(error);
						notifyQuickActionsChanged();
					}
				},
					React.createElement(QuickActionsRail, {
						text: (key) => localeLabel(ctx, key),
						inputActions: slotProps.inputActions,
						sessionId: slotProps.sessionId,
						useProjection: slotProps.useProjection,
						// 降级路径要用宿主命令通道。**现取**（不是注册时快照）：该服务可能
						// 晚于本条目就绪；取不到时 `commands` 为 null，按钮改填草稿。
						remote: remoteGetter
					}));
			}, { locale: null }));
			// Optional dependency: without an account Remote this whole block stays
			// inert and the cost cells above are unaffected. Both the `remote`
			// service and its `account` namespace are required — the namespace
			// alone leaves `ctx.remote` undefined.
			// 设置 →「快捷按钮」整页。label 用 thunk：切换语言时宿主会重新投影，不必重新注册。
			// 这个槽的 owner 不投影 locale（见 registerSlotCell 的说明），所以文案由我们自己给：
			// `locale: null` 去掉 locale 声明，`text` 传入本地化函数，`label` 是导航项文字。
			// 配置走本机存储，因此这里不需要任何 remote 注入。
			// 插件分区里的标签页：同一个编辑器再挂一处。这个槽同样**不投影 locale**，
			// 所以照样是 `locale: null` + `label` thunk。
			// （`plugins.bundle.config` / `plugins.row.config` 才是"bundle 自己的页面"，
			// 但那是给插件管理器安装的 bundle 用的；本插件是 file:// 手动挂载，
			// 插件页里没有它的卡片，所以挂在插件分区的标签页上。）
			ctx.slots.inject("settings.plugins.tab", () => registerSlotCell(ctx, "settings.plugins.tab", "quick-actions", 20, function QuickActionsSettingsTab() {
				return React.createElement(QuickActionsSettingsBoundary, null,
					React.createElement(QuickActionsSettings, { text: (key) => localeLabel(ctx, key) }));
			}, { locale: null, label: () => localeLabel(ctx, "quickSettingsTitle") }));
			ctx.slots.inject("settings.section", () => registerSlotCell(ctx, "settings.section", "quick-actions", 60, function QuickActionsSettingsSlot() {
				return React.createElement(QuickActionsSettingsBoundary, null,
					React.createElement(QuickActionsSettings, { text: (key) => localeLabel(ctx, key) }));
			}, { locale: null, label: () => localeLabel(ctx, "quickSettingsTitle") }));
			ctx.inject(["remote", "remote.account"], (child) => {
				// 挂在 `conversation.input.right`：它与**模型选择器同属 `standardControls` 容器**，
				// 官方 JSX 的顺序就是 `[input.right][input.model]`，所以余额落在模型名的**正左边** ——
				// 这就是"靠右、贴着模型选择"要的位置，不需要任何 CSS 去推它。
				// 它属于 `conversation.composer.bar`（resident composer body），问卷/审批把内容区
				// 整体替换时不会跟着卸载（`conversation.input.dock` 会）。
				//
				// ⚠ 已知代价：`standardControls` 带 `hidden={activity}`。这个 `activity` 来自
				// `conversation.input.activity` 的 occupant —— 官方的**实验性语音输入**
				// （`phase !== "idle"` 时为真，见 VoiceInput 的 useLayoutEffect）。即录音/转写期间
				// 整个容器（连同模型选择器）一起隐藏，余额跟着隐藏，与模型名同进同退。
				// 没装那个实验 bundle 时 `activity` 恒为 false，永不隐藏。
				//
				// 为什么不再用 `position: fixed` + 量 `_sidebarCol`：那是把条目挂在**会话头部**、
				// 却把像素画到**侧栏底部**，注册点（会话级，切会话重挂）与视觉位置（全局）是两套
				// 生命周期，每次重挂都要重新测量、重试 25 × 200ms，量不到就停在视口右下角。
				// 现在位置由官方工具行决定：零测量、零改官方布局、零重试。
				//
				// locale 声明：**带**（保持 `registerSlotCell` 的默认 `locale: NS`）。
				// 机制（asar 里 slots 渲染侧，代码级核对过）：`entry.locale` **只决定是否给条目注入
				// `t`**，不参与任何渲染过滤 —— `if (entry.locale !== void 0) kit["t"] =
				// localeSeat(host.locale, entry.locale)`，全库没有基于它的渲染判断。唯一会伤到渲染的
				// 情形是 `host.locale` 缺失时抛 `SlotAssemblyError`，而本插件自己就
				// `ctx.locale.register(NS, …)`，不会缺。
				// 所以删掉 locale **不是**"防不渲染"，而是主动放弃 `t`：`tr()` 会回退内置中文字典
				// （见 `tr` 的实现），英文界面下余额的悬停 / aria 文案会变回中文。
				child.slots.inject("conversation.input.right", () => registerSlotCell(child, "conversation.input.right", "account-balance", 20, createBalanceCell(child)));
			});
		}
		//#endregion

		exports.apply = apply;
		exports.inject = inject;
		exports.PROJECTION_KEY = PROJECTION_KEY;
		exports.QUOTE_MARK_PREFIX = QUOTE_MARK_PREFIX;
		exports.QUOTE_MARK_ID_LENGTH = QUOTE_MARK_ID_LENGTH;
		exports.quoteMark = quoteMark;
		exports.focusComposer = focusComposer;
		exports.keepComposerFocus = keepComposerFocus;
		exports.formatCny = formatCny;
		exports.formatRate = formatRate;
		exports.formatWallet = formatWallet;
		exports.pickWallet = pickWallet;
		exports.readActiveTurn = readActiveTurn;
		exports.pickTurn = pickTurn;
		exports.describeScope = describeScope;
		exports.QUICK_ACTIONS_KEY = QUICK_ACTIONS_KEY;
		exports.DEFAULT_QUICK_ACTIONS = DEFAULT_QUICK_ACTIONS;
		exports.QUICK_KINDS = QUICK_KINDS;
		exports.quickKindOf = quickKindOf;
		exports.groupQuickButtons = groupQuickButtons;
		exports.QUICK_ICON_NAMES = QUICK_ICON_NAMES;
		exports.QUICK_ICONS = QUICK_ICONS;
		exports.migrateStoredQuickActions = migrateStoredQuickActions;
		exports.quickButtonsOf = quickButtonsOf;
		exports.toConfigButton = toConfigButton;
		exports.readStoredQuickActions = readStoredQuickActions;
		exports.getRailError = getRailError;
		exports.parseQuickActionsFile = parseQuickActionsFile;
		exports.readDisplayOptions = readDisplayOptions;
		exports.writeDisplayOptions = writeDisplayOptions;
		exports.QuickActionsRail = QuickActionsRail;
		exports.QuickActionsSettings = QuickActionsSettings;
		exports.writeStoredQuickActions = writeStoredQuickActions;
		exports.registerSlotCell = registerSlotCell;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
