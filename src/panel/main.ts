import { STAFF } from "../config";
import { pl } from "../i18n/pl";
import {
  createMemoryStorage,
  createMockKodyAuth,
  type SessionStorageLike,
} from "./auth";
import { INITIAL_CODE_CHECK, createCodeCheck } from "./code-check";
import { renderCodeCheck } from "./code-check-view";
import { createPanel, isPanelSection, type PanelState } from "./controller";
import { MOCK_CODES, createMockStaffApi } from "./mock-staff-api";
import { createHttpStaffApi, type StaffApi } from "./staff-api";
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

/** Local dev has no Kody fetch handler, so it uses the mock staff API (issue #17 adds the handler). */
function staffApi(): StaffApi {
  if (import.meta.env.DEV) {
    return createMockStaffApi({ codes: MOCK_CODES, now: () => new Date() });
  }
  return createHttpStaffApi((input, init) => window.fetch(input, init));
}

let panelState: PanelState | null = null;
let checkState = INITIAL_CODE_CHECK;

function draw(): void {
  if (!panelState) return;
  app.innerHTML = renderPanel(panelState, renderCodeCheck(checkState));
}

const codeCheck = createCodeCheck({
  api: staffApi(),
  render: (state) => {
    checkState = state;
    draw();
  },
});

/** Until issue #17 wires Kody package app auth, the panel uses the mock Kody session. */
const username =
  new URLSearchParams(window.location.search).get("kodyUser") ||
  STAFF.mockUsername;
const panel = createPanel({
  auth: createMockKodyAuth({
    storage: sessionStore(),
    user: { userId: `mock-${username}`, username },
  }),
  allowList: STAFF.allowList,
  render: (state) => {
    panelState = state;
    draw();
  },
});

app.addEventListener("click", (event) => {
  const button =
    event.target instanceof Element ? event.target.closest("button") : null;
  if (!button) return;
  const section = button.dataset.section;
  if (button.id === "login") void panel.signIn();
  else if (button.id === "logout") {
    codeCheck.reset();
    void panel.signOut();
  } else if (button.id === "redeem") void codeCheck.redeem();
  else if (isPanelSection(section)) panel.select(section);
});

app.addEventListener("submit", (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== "code-check-form") {
    return;
  }
  event.preventDefault();
  const value = new FormData(form).get("code");
  void codeCheck.check(typeof value === "string" ? value : "");
});

void panel.start();
