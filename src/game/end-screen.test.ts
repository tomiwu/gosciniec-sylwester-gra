import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  isShareBonus,
  leaderboardHtml,
  loadPlayer,
  markRefReported,
  normalizeToken,
  pendingRef,
  progressText,
  readRefToken,
  referralUrl,
  rememberRef,
  savePlayer,
  shareLink,
  telHref,
  type KeyStore,
  type ShareData,
} from "./end-screen";

function memoryStore(): KeyStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

function brokenStore(): KeyStore {
  return {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
}

const DATA: ShareData = { title: "T", text: "X", url: "https://x.test/?ref=A" };
const STATUS = {
  token: "ABCDEFGH23",
  progress: 2,
  needed: 5,
  discountPercent: 10,
};

describe("referral token", () => {
  it("accepts only the server token shape", () => {
    expect(normalizeToken(" abcdefgh23 ")).toBe("ABCDEFGH23");
    expect(normalizeToken("SYL-7K2P")).toBeNull();
    expect(normalizeToken("ABCDEFGH1O")).toBeNull();
    expect(normalizeToken(null)).toBeNull();
  });

  it("reads ?ref from the query string", () => {
    expect(readRefToken("?ref=abcdefgh23&x=1")).toBe("ABCDEFGH23");
    expect(readRefToken("?x=1")).toBeNull();
  });
});

describe("referralUrl", () => {
  it("adds the token and drops test switches and the hash", () => {
    const url = referralUrl(
      "https://tomiwu.github.io/sylwester-gra-demo/?shot=end&nick=Ada&ref=OLD#x",
      "ABCDEFGH23",
    );
    expect(url).toBe(
      "https://tomiwu.github.io/sylwester-gra-demo/?ref=ABCDEFGH23",
    );
  });

  it("gives the plain game link without a token", () => {
    expect(referralUrl("https://a.test/game/?shot=end", null)).toBe(
      "https://a.test/game/",
    );
  });
});

describe("progress", () => {
  it("shows done of needed and clamps it", () => {
    expect(progressText(STATUS)).toBe("2/5");
    expect(progressText({ ...STATUS, progress: 9 })).toBe("5/5");
    expect(progressText({ ...STATUS, progress: -1, needed: 0 })).toBe("0/1");
  });

  it("knows when the share bonus is active", () => {
    expect(isShareBonus(STATUS)).toBe(false);
    expect(isShareBonus({ ...STATUS, progress: 5 })).toBe(true);
  });
});

describe("telHref", () => {
  it("keeps only digits and the plus sign", () => {
    expect(telHref("+48 63 28 88 628")).toBe("tel:+48632888628");
  });
});

describe("leaderboardHtml", () => {
  const labels = { title: "Top 20", empty: "Brak" };

  it("numbers the rows, escapes nicknames and marks the player", () => {
    const html = leaderboardHtml(
      [
        { nickname: "<b>Ola</b>", score: 300 },
        { nickname: "Ada", score: 250.7 },
      ],
      " ada ",
      labels,
    );
    expect(html).toContain("&lt;b&gt;Ola&lt;/b&gt;");
    expect(html).not.toContain("<b>Ola");
    expect(html).toContain(
      '<li class="me" aria-current="true"><span class="rank">2</span><span class="nick">Ada</span><span class="pts">250</span></li>',
    );
    expect(html.match(/class="me"/g)).toHaveLength(1);
  });

  it("shows the empty text with no rows", () => {
    expect(leaderboardHtml([], null, labels)).toContain(
      '<p class="note">Brak</p>',
    );
  });

  it("escapes every special character", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});

describe("shareLink", () => {
  it("uses the Web Share API first", async () => {
    const shared: ShareData[] = [];
    const nav = {
      share: async (data: ShareData) => {
        shared.push(data);
      },
    };
    await expect(shareLink(nav, DATA)).resolves.toBe("shared");
    expect(shared).toEqual([DATA]);
  });

  it("reports a cancel and does not copy", async () => {
    const copied: string[] = [];
    const abort = new Error("no");
    abort.name = "AbortError";
    const nav = {
      share: async () => {
        throw abort;
      },
      clipboard: { writeText: async (t: string) => void copied.push(t) },
    };
    await expect(shareLink(nav, DATA)).resolves.toBe("cancelled");
    expect(copied).toEqual([]);
  });

  it("copies the link when share fails or is missing", async () => {
    const copied: string[] = [];
    const clipboard = { writeText: async (t: string) => void copied.push(t) };
    const failing = {
      share: async () => {
        throw new Error("not allowed");
      },
      clipboard,
    };
    await expect(shareLink(failing, DATA)).resolves.toBe("copied");
    await expect(shareLink({ clipboard }, DATA)).resolves.toBe("copied");
    expect(copied).toEqual([DATA.url, DATA.url]);
  });

  it("fails when no share and no clipboard work", async () => {
    await expect(shareLink({}, DATA)).resolves.toBe("failed");
    const clipboard = {
      writeText: async () => {
        throw new Error("denied");
      },
    };
    await expect(shareLink({ clipboard }, DATA)).resolves.toBe("failed");
  });
});

describe("local referral state", () => {
  it("keeps the first token and reports it once", () => {
    const store = memoryStore();
    rememberRef(store, null);
    expect(pendingRef(store)).toBeNull();
    rememberRef(store, "ABCDEFGH23");
    rememberRef(store, "ZZZZZZZZZZ");
    expect(pendingRef(store)).toBe("ABCDEFGH23");
    markRefReported(store, "ABCDEFGH23");
    expect(pendingRef(store)).toBeNull();
  });

  it("saves the code and the nickname of the player", () => {
    const store = memoryStore();
    expect(loadPlayer(store)).toEqual({ code: null, nick: null });
    savePlayer(store, "SYL-7K2P", " Ada ");
    expect(loadPlayer(store)).toEqual({ code: "SYL-7K2P", nick: "Ada" });
  });

  it("works when storage is blocked", () => {
    const store = brokenStore();
    rememberRef(store, "ABCDEFGH23");
    savePlayer(store, "SYL-7K2P", "Ada");
    markRefReported(store, "ABCDEFGH23");
    expect(pendingRef(store)).toBeNull();
    expect(loadPlayer(store)).toEqual({ code: null, nick: null });
  });
});
