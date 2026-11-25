import type { KodySession, StaffAuth } from "./auth";

export const PANEL_SECTIONS = ["check", "list", "ranking"] as const;
export type PanelSection = (typeof PANEL_SECTIONS)[number];

export type PanelState = {
  session: KodySession | null;
  allowList: readonly string[];
  section: PanelSection;
};

/**
 * Panel state machine with no DOM. Each change calls render().
 * An auth failure gives the login state, so no staff view shows without a session.
 */
export function createPanel(options: {
  auth: StaffAuth;
  allowList: readonly string[];
  render: (state: PanelState) => void;
}) {
  const { auth, allowList, render } = options;
  let state: PanelState = { session: null, allowList, section: "check" };

  function show(next: Partial<PanelState>): void {
    state = { ...state, ...next };
    render(state);
  }

  async function load(call: () => Promise<KodySession | null>): Promise<void> {
    try {
      show({ session: await call() });
    } catch {
      show({ session: null });
    }
  }

  return {
    start: () => load(() => auth.restore()),
    signIn: () => load(() => auth.signIn()),
    async signOut(): Promise<void> {
      await auth.signOut().catch(() => undefined);
      show({ session: null, section: "check" });
    },
    select(section: PanelSection): void {
      show({ section });
    },
  };
}

export function isPanelSection(value: unknown): value is PanelSection {
  return PANEL_SECTIONS.some((section) => section === value);
}
