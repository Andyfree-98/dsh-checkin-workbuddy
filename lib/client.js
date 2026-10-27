// dsh-checkin-button — browser half.
// Registers a button in the composer tool row (`conversation.input.left`).
// Clicking it POSTs to the dsh-connect-workbuddy host check-in route, which
// checks in the currently selected WorkBuddy account (cn region by default).
//
// The route is loopback-guarded by the host plugin; requests must be
// same-origin (the button runs inside the DSH web app, so plain relative
// fetch works and carries the loopback origin automatically).
window.__ModuleLoader__.load({
  id: "dsh-checkin-button",
  factory: (require) => {
    const react = require("react");
    const jsx = require("react/jsx-runtime");

    const CHECKIN_PATH = "/plugins/dsh-connect-workbuddy/checkin";
    const REGION_PARAM = "region";
    // Read the region from plugin settings when present; default cn.
    let region = "cn";

    const t = (key, vars) => {
      const dict = {
        "checkin.button": "签到",
        "checkin.buttonDoing": "签到中…",
        "checkin.done": "已签到",
        "checkin.ok": "签到成功 +{credit} 积分 · 连签 {streak} 天",
        "checkin.already": "今天已签到 · 连签 {streak} 天",
        "checkin.inactive": "签到活动未开启",
        "checkin.failed": "签到失败",
      };
      let out = dict[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
      return out;
    };

    const CSS_ID = "dsh-checkin-button/button.css";
    const CSS = `
.dsh-checkin-btn{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--dsw-alias-border-secondary,rgba(128,128,128,.35));border-radius:999px;padding:2px 10px;font-size:12px;line-height:18px;background:transparent;color:inherit;cursor:pointer;white-space:nowrap}
.dsh-checkin-btn:hover:not(:disabled){background:var(--dsw-alias-fill-secondary,rgba(128,128,128,.12))}
.dsh-checkin-btn:disabled{opacity:.6;cursor:default}
.dsh-checkin-btn.is-done{color:var(--dsw-alias-text-success,#22a06b)}
`;
    if (typeof document !== "undefined" && !document.querySelector(`style[data-plugin-css="${CSS_ID}"]`)) {
      const styleTag = document.createElement("style");
      styleTag.dataset.pluginCss = CSS_ID;
      styleTag.textContent = CSS;
      document.head.appendChild(styleTag);
    }

    function CheckinButton() {
      const [state, setState] = react.useState("idle"); // idle | busy | done | error
      const [message, setMessage] = react.useState("");
      const [done, setDone] = react.useState(false);

      const doCheckin = react.useCallback(async () => {
        setState("busy");
        setMessage("");
        try {
          const response = await fetch(`${CHECKIN_PATH}?${REGION_PARAM}=${encodeURIComponent(region)}`, {
            method: "POST",
            credentials: "same-origin",
            headers: { accept: "application/json" },
          });
          const text = await response.text();
          let value = null;
          try { value = JSON.parse(text); } catch {}
          if (!response.ok) {
            if (response.status === 409) {
              setMessage(t("checkin.inactive"));
            } else {
              setMessage(t("checkin.failed"));
            }
            setState("error");
            return;
          }
          if (value?.alreadyCheckedIn) {
            const streak = value?.checkin?.streakDays;
            setMessage(t("checkin.already", { streak: streak ?? "?" }));
          } else {
            const credit = value?.claim?.credit ?? value?.checkin?.todayCredit;
            const streak = value?.checkin?.streakDays;
            setMessage(t("checkin.ok", { credit: credit ?? "?", streak: streak ?? "?" }));
          }
          setDone(true);
          setState("done");
          setTimeout(() => { setState("idle"); }, 6000);
        } catch {
          setMessage(t("checkin.failed"));
          setState("error");
        }
      }, []);

      const label = state === "busy" ? t("checkin.buttonDoing") : done ? t("checkin.done") : t("checkin.button");
      return jsx.jsxs("span", {
        style: { display: "inline-flex", alignItems: "center", gap: 6 },
        children: [
          jsx.jsx("button", {
            type: "button",
            className: "dsh-checkin-btn" + (done ? " is-done" : ""),
            disabled: state === "busy",
            onClick: doCheckin,
            children: label,
          }),
          message ? jsx.jsx("span", { style: { fontSize: 12, opacity: 0.8 }, children: message }) : null,
        ],
      });
    }

    function apply(ctx) {
      try {
        ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
          name: "conversation.input.left",
          id: "dsh-checkin-button-composer",
          order: 12,
        }, CheckinButton));
      } catch (error) {
        console.error("[dsh-checkin-button] failed to register slot:", error);
      }
    }

    return {
      name: "dsh-checkin-button-client",
      inject: ["slots"],
      apply,
    };
  },
});
