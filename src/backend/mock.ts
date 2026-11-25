import { REWARD, isNicknameValid, isScoreSane } from "../config";
import type {
  ScoreBackend,
  ScoreRow,
  SubmitInput,
  SubmitResult,
} from "./types";

function makeCode(nickname: string): string {
  const clean = nickname
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "X");
  const seed = `${clean}****`.slice(0, 4);
  return `${REWARD.codePrefix}${seed}`;
}

/** In-memory backend for local play and for tests. It does not use the network. */
export function createMockBackend(seed: ScoreRow[] = []): ScoreBackend {
  const rows: ScoreRow[] = [...seed];
  return {
    async submit(input: SubmitInput): Promise<SubmitResult> {
      if (!isNicknameValid(input.nickname)) {
        return {
          code: "",
          discountPercent: 0,
          referralProgress: 0,
          referralNeeded: REWARD.referralNeeded,
          accepted: false,
          reason: "nickname",
        };
      }
      if (!isScoreSane(input.score)) {
        return {
          code: "",
          discountPercent: 0,
          referralProgress: 0,
          referralNeeded: REWARD.referralNeeded,
          accepted: false,
          reason: "score",
        };
      }
      const code = makeCode(input.nickname);
      const unlocked = input.score >= REWARD.discountScore;
      rows.push({ nickname: input.nickname.trim(), score: input.score, code });
      rows.sort((a, b) => b.score - a.score);
      return {
        code: unlocked ? code : "",
        discountPercent: unlocked ? REWARD.basePercent : 0,
        referralProgress: 0,
        referralNeeded: REWARD.referralNeeded,
        accepted: true,
      };
    },
    async top(limit: number): Promise<ScoreRow[]> {
      return rows.slice(0, limit);
    },
  };
}
