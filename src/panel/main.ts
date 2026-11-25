import { STAFF } from "../config";
import { pl } from "../i18n/pl";
import {
  createMemoryStorage,
  createMockKodyAuth,
  type SessionStorageLike,
  type StaffAuth,
} from "./auth";
import { createPanel, isPanelSection } from "./controller";
import { createKodyHostAuth, isKodyHost } from "./kody-host-auth";
import { createSameOriginStaff } from "./staff-api";
import { renderPanel } from "./view";
import "../styles.css";
import "./panel.css";

const root = document.querySelector("#app");
if (!(root instanceof HTMLElement)) {
  throw new Error("The #app root is missing.");
}
const app: HTMLElement = root;
document.title = `${pl.panelTitle} — ${pl.hotel}`;

function sessionStore(): SessionStorageLike {
  try {
    return window.sessionStorage;
  } catch {
    return createMemoryStorage();
  }
}

function panelAuth(): StaffAuth {
  if (isKodyHost(window.location.hostname)) {
    return createKodyHostAuth();
  }
  const username =
    new URLSearchParams(window.location.search).get("kodyUser") ||
    STAFF.mockUsername;
  return createMockKodyAuth({
    storage: sessionStore(),
    user: { userId: `mock-${username}`, username },
  });
}

const panelOptions: Parameters<typeof createPanel>[0] = {
  auth: panelAuth(),
  allowList: STAFF.allowList,
  render: (state) => {
    app.innerHTML = renderPanel(state);
  },
};
if (isKodyHost(window.location.hostname)) {
  panelOptions.staff = createSameOriginStaff();
}
const panel = createPanel(panelOptions);

app.addEventListener("click", (event) => {
  const button =
    event.target instanceof Element ? event.target.closest("button") : null;
  if (!button) return;
  const section = button.dataset.section;
  const hide = button.dataset.hide;
  if (button.id === "login") void panel.signIn();
  else if (button.id === "logout") void panel.signOut();
  else if (button.id === "redeem") void panel.redeem();
  else if (button.id === "hide-ok") void panel.hideNickname();
  else if (button.id === "hide-cancel") panel.cancelHide();
  else if (hide) panel.askHide(hide);
  else if (isPanelSection(section)) void panel.select(section);
});

app.addEventListener("submit", (event) => {
  const form =
    event.target instanceof Element ? event.target.closest("form") : null;
  if (form?.id !== "check-form") return;
  event.preventDefault();
  const input = app.querySelector("#code-input");
  const value = input instanceof HTMLInputElement ? input.value : "";
  void panel.check(value);
});

app.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  if (target.id === "filter-kind") {
    const value = target.value;
    if (value === "all" || value === "base" || value === "share") {
      panel.setListKind(value);
    }
  }
  if (target.id === "filter-used") {
    const value = target.value;
    if (value === "all" || value === "open" || value === "used") {
      panel.setListUsed(value);
    }
  }
});

void panel.start();
