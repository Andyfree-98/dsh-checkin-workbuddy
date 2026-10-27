// dsh-checkin-workbuddy — browser half.
// Registers a button in the composer tool row (`conversation.input.left`).
// Clicking it POSTs to the dsh-connect-workbuddy host check-in route, which
// checks in the currently selected WorkBuddy account (cn region by default).
//
// The route is loopback-guarded by the host plugin; requests must be
// same-origin (the button runs inside the DSH web app, so plain relative
// fetch works and carries the loopback origin automatically).
window.__ModuleLoader__.load({
  id: "dsh-checkin-workbuddy",
  factory: (require) => {
    const react = require("react");
    const jsx = require("react/jsx-runtime");

    const CHECKIN_PATH = "/plugins/dsh-connect-workbuddy/checkin";
    const USAGE_PATH = "/plugins/dsh-connect-workbuddy/usage";
    const REGION_PARAM = "region";
    // Read the region from plugin settings when present; default cn.
    let region = "cn";

    // --- Day-scoped done state (survives conversation switches and reloads) ---
    // localStorage key carries the local date (YYYY-MM-DD), so it expires by
    // itself the next day without any timer. SSR-less browser plugin: guard
    // for storage being unavailable (private mode etc.) — degrade to memory.
    const memoryDone = { date: "", checked: false };
    function todayStamp() {
      const d = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
    function readDoneStamp() {
      try {
        return window.localStorage.getItem("dsh-checkin-workbuddy/done") || "";
      } catch {
        return memoryDone.date === todayStamp() ? "stored" : "";
      }
    }
    function writeDoneStamp() {
      const stamp = todayStamp();
      try {
        window.localStorage.setItem("dsh-checkin-workbuddy/done", stamp);
      } catch {
        memoryDone.date = stamp;
        memoryDone.checked = true;
      }
    }

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

    const CSS_ID = "dsh-checkin-workbuddy/button.css";
    const CSS = `
.dsh-checkin-btn{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--dsw-alias-border-secondary,rgba(128,128,128,.35));border-radius:999px;padding:2px 10px;font-size:12px;line-height:18px;background:transparent;color:inherit;cursor:pointer;white-space:nowrap}
.dsh-checkin-btn:hover:not(:disabled){background:var(--dsw-alias-fill-secondary,rgba(128,128,128,.12))}
.dsh-checkin-btn:disabled{opacity:.6;cursor:default}
.dsh-checkin-btn.is-done{color:var(--dsw-alias-text-success,#22a06b)}
.dsh-checkin-btn.is-disabled{opacity:.45;cursor:not-allowed;pointer-events:none}
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
      const [done, setDone] = react.useState(() => readDoneStamp() !== "");

      // On mount: reconcile the day-scoped cache against the live upstream
      // status. If the cache says done but upstream disagrees (different
      // account checked in, cache from another region, clock skew), the
      // button flips back to the actionable state. Also handles the
      // "checked in elsewhere" case: upstream says done -> stamp + show.
      // NOTE: full detail only — the `fast` first-paint variant omits the
      // live `checkin` block entirely (liveFigures is skipped on fast).
      react.useEffect(() => {
        let cancelled = false;
        (async () => {
          try {
            const response = await fetch(`${USAGE_PATH}?${REGION_PARAM}=${encodeURIComponent(region)}`, {
              method: "GET",
              credentials: "same-origin",
              headers: { accept: "application/json" },
            });
            if (!response.ok) return;
            const value = await response.json();
            const checkin = value?.checkin;
            if (cancelled || checkin?.active !== true) return;
            if (checkin?.todayCheckedIn === true) {
              writeDoneStamp();
              if (!cancelled) {
                setDone(true);
                const streak = checkin?.streakDays;
                if (streak) setMessage(t("checkin.already", { streak }));
              }
            } else if (checkin?.todayCheckedIn === false && readDoneStamp() !== "") {
              // Cache claims done but upstream says otherwise: clear it.
              try { window.localStorage.removeItem("dsh-checkin-workbuddy/done"); } catch {}
              memoryDone.checked = false;
              if (!cancelled) setDone(false);
            }
          } catch {
            // Status unavailable: keep whatever the cache says.
          }
        })();
        return () => { cancelled = true; };
      }, []);

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
          writeDoneStamp();
          setDone(true);
          setState("done");
          setTimeout(() => { setState("idle"); }, 6000);
        } catch {
          setMessage(t("checkin.failed"));
          setState("error");
        }
      }, []);

      const label = state === "busy" && !done ? t("checkin.buttonDoing") : done ? t("checkin.done") : t("checkin.button");
      return jsx.jsxs("span", {
        style: { display: "inline-flex", alignItems: "center", gap: 6 },
        children: [
          jsx.jsx("button", {
            type: "button",
            className: "dsh-checkin-btn" + (done ? " is-done is-disabled" : ""),
            disabled: state === "busy" || done,
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
          id: "dsh-checkin-workbuddy-composer",
          order: 12,
        }, CheckinButton));
      } catch (error) {
        console.error("[dsh-checkin-workbuddy] failed to register slot:", error);
      }
    }

    return {
      name: "dsh-checkin-workbuddy-client",
      inject: ["slots"],
      apply,
    };
  },
});
