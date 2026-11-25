import { STAFF } from "../config";
import { pl } from "../i18n/pl";
import {
  createMemoryStorage,
  createMockKodyAuth,
  type SessionStorageLike,
} from "./auth";
import { createPanel, isPanelSection } from "./controller";
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
    app.innerHTML = renderPanel(state);
  },
});

app.addEventListener("click", (event) => {
  const button =
    event.target instanceof Element ? event.target.closest("button") : null;
  if (!button) return;
  const section = button.dataset.section;
  if (button.id === "login") void panel.signIn();
  else if (button.id === "logout") void panel.signOut();
  else if (isPanelSection(section)) panel.select(section);
});

void panel.start();
