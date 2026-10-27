# dsh-checkin-workbuddy

WorkBuddy 每日签到快捷按钮（DSH bundle 插件，纯客户端）。

在输入框下方工具行（`conversation.input.left` 座位）常驻一个「签到」按钮，
点击后 POST 到 [dsh-connect-workbuddy](https://github.com/dingminhua/dsh-connect-workbuddy)
的宿主签到路由 `POST /plugins/dsh-connect-workbuddy/checkin?region=cn`，
为当前选中的 WorkBuddy 账号完成当日签到，并在按钮旁显示结果
（已签 / 加分 / 连签天数）。

English: a one-click WorkBuddy daily check-in button pinned to the DSH composer tool row. It calls the check-in route provided by dsh-connect-workbuddy and shows the result (already checked in / credits claimed / streak days) next to the button.

## 功能

- 「签到」按钮常驻输入框下方工具行，无需打开插件设置页
- 签到后按钮旁显示结果：今日已签 / 签到成功 +积分 / 连签天数
- 签到活动未开启（409）时明确提示
- 纯客户端插件：不改宿主行为、不存任何持久配置

## 安装

前提：已安装 [DSH](https://github.com/deepseek-ai/DeepSeek-Harness) 桌面版与
[dsh-connect-workbuddy](https://github.com/dingminhua/dsh-connect-workbuddy)（签到路由由它提供）。

在 DSH 插件页「添加插件」中填入本仓库地址：

```
github:Andyfree-98/dsh-checkin-workbuddy
```

或使用 CLI：

```
dsh plugin add github:Andyfree-98/dsh-checkin-workbuddy
```

安装后重启 DSH，按钮出现在输入框下方工具行。

## 配置

- 区域：默认 `cn`（WorkBuddy 国内版）。国际版（global）无签到活动，
  点击会提示「签到活动未开启」。

## 工作原理

- 插件注册到 `conversation.input.left` 座位（composer 工具行），
  渲染一个 React 按钮
- 点击后向宿主侧 `dsh-connect-workbuddy` 注册的 loopback 路由发 POST 请求
  （同源请求，自动满足 loopback Origin 校验）
- 该路由对「当前选中的 WorkBuddy 账号」执行签到，返回
  `{alreadyCheckedIn, claim: {credit}, checkin: {streakDays, ...}}`

## 卸载

在插件页停用/移除即可，无任何持久配置残留。

## License

MIT
