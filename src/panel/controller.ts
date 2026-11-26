import type {
  CodeCheck,
  CodeRow,
  DashboardStats,
  DiscountKind,
  ScoreRow,
  StaffBackend,
} from "../backend/types";
import { BackendError } from "../backend/types";
import { pl } from "../i18n/pl";
import type { KodySession, StaffAuth } from "./auth";
import { fetchStaffRanking } from "./staff-api";

export const PANEL_SECTIONS = ["check", "list", "ranking"] as const;
export type PanelSection = (typeof PANEL_SECTIONS)[number];

export type PanelState = {
  session: KodySession | null;
  allowList: readonly string[];
  section: PanelSection;
  checkQuery?: string;
  check?: CodeCheck | null;
  checkError?: string | null;
  busy?: boolean;
  list?: CodeRow[];
  stats?: DashboardStats | null;
  listKind?: "all" | DiscountKind;
  listUsed?: "all" | "open" | "used";
  ranking?: ScoreRow[];
  hidePending?: string | null;
};

/**
 * Panel state machine with no DOM. Each change calls render().
 * An auth failure gives the login state, so no staff view shows without a session.
 */
export function createPanel(options: {
  auth: StaffAuth;
  allowList: readonly string[];
  render: (state: PanelState) => void;
  staff?: StaffBackend;
  ranking?: () => Promise<ScoreRow[]>;
}) {
  const { auth, allowList, render } = options;
  const loadRanking = options.ranking ?? fetchStaffRanking;
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

  function fail(error: unknown): string {
    if (error instanceof BackendError && error.kind === "forbidden") {
      return pl.panelNoAccess;
    }
    return pl.panelError;
  }

  async function refreshList(): Promise<void> {
    if (!options.staff) return;
    show({ busy: true, checkError: null });
    try {
      const [list, stats] = await Promise.all([
        options.staff.listCodes(200, 0),
        options.staff.stats(),
      ]);
      show({ list, stats, busy: false });
    } catch (error) {
      show({ busy: false, checkError: fail(error) });
    }
  }

  async function refreshRanking(): Promise<void> {
    show({ busy: true, checkError: null });
    try {
      show({ ranking: await loadRanking(), busy: false });
    } catch (error) {
      show({ busy: false, checkError: fail(error) });
    }
  }

  return {
    start: () => load(() => auth.restore()),
    signIn: () => load(() => auth.signIn()),
    async signOut(): Promise<void> {
      await auth.signOut().catch(() => undefined);
      show({ session: null, section: "check", check: null, checkError: null });
    },
    select(section: PanelSection): Promise<void> | void {
      show({ section, checkError: null, hidePending: null });
      if (section === "list") return refreshList();
      if (section === "ranking") return refreshRanking();
    },
    setCheckQuery(checkQuery: string): void {
      show({ checkQuery });
    },
    async check(code: string): Promise<void> {
      if (!options.staff) {
        show({ checkError: pl.panelError, check: null });
        return;
      }
      show({ busy: true, checkQuery: code, checkError: null, check: null });
      try {
        show({ check: await options.staff.check(code), busy: false });
      } catch (error) {
        show({ busy: false, check: null, checkError: fail(error) });
      }
    },
    async redeem(): Promise<void> {
      const code = state.check?.code;
      if (!options.staff || !code) return;
      show({ busy: true, checkError: null });
      try {
        const result = await options.staff.redeem(code);
        show({ check: result.check, busy: false });
      } catch (error) {
        show({ busy: false, checkError: fail(error) });
      }
    },
    setListKind(listKind: "all" | DiscountKind): void {
      show({ listKind });
    },
    setListUsed(listUsed: "all" | "open" | "used"): void {
      show({ listUsed });
    },
    askHide(nickname: string): void {
      show({ hidePending: nickname });
    },
    cancelHide(): void {
      show({ hidePending: null });
    },
    async hideNickname(): Promise<void> {
      const nickname = state.hidePending;
      if (!options.staff || !nickname) return;
      show({ busy: true, checkError: null });
      try {
        await options.staff.hideNickname(nickname);
        show({ hidePending: null, busy: false });
        await refreshRanking();
      } catch (error) {
        show({ busy: false, checkError: fail(error) });
      }
    },
  };
}

export function isPanelSection(value: unknown): value is PanelSection {
  return PANEL_SECTIONS.some((section) => section === value);
}

export function visibleCodes(state: PanelState): CodeRow[] {
  const rows = state.list ?? [];
  const kind = state.listKind ?? "all";
  const used = state.listUsed ?? "all";
  return rows.filter((row) => {
    if (kind !== "all" && row.kind !== kind) return false;
    if (used === "open" && row.usedAt) return false;
    if (used === "used" && !row.usedAt) return false;
    return true;
  });
}
