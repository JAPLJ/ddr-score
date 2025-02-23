import pako from "pako";
import { parse } from "papaparse";

export type Difficulty =
  | "BEGINNER"
  | "BASIC"
  | "DIFFICULT"
  | "EXPERT"
  | "CHALLENGE";
export const difficultyOrder: Record<Difficulty, number> = {
  BEGINNER: 0,
  BASIC: 1,
  DIFFICULT: 2,
  EXPERT: 3,
  CHALLENGE: 4,
};
export const difficultyIds: Record<number, Difficulty> = {
  0: "BEGINNER",
  1: "BASIC",
  2: "DIFFICULT",
  3: "EXPERT",
  4: "CHALLENGE",
};
export const difficultyColors: Record<Difficulty, string> = {
  BEGINNER: "#eaffff",
  BASIC: "#ffffea",
  DIFFICULT: "#ffeaea",
  EXPERT: "#eaffea",
  CHALLENGE: "#f4eaff",
};

export type ClearRank =
  | "E"
  | "D"
  | "D+"
  | "C-"
  | "C"
  | "C+"
  | "B-"
  | "B"
  | "B+"
  | "A-"
  | "A"
  | "A+"
  | "AA-"
  | "AA"
  | "AA+"
  | "AAA";
export const clearRankOrder: Record<ClearRank, number> = {
  E: 0,
  D: 1,
  "D+": 2,
  "C-": 3,
  C: 4,
  "C+": 5,
  "B-": 6,
  B: 7,
  "B+": 8,
  "A-": 9,
  A: 10,
  "A+": 11,
  "AA-": 12,
  AA: 13,
  "AA+": 14,
  AAA: 15,
};
export const clearRankColors: Record<ClearRank, string> = {
  AAA: "#ffffea",
  "AA+": "#fefefe",
  AA: "#fafafa",
  "AA-": "#f7f7f7",
  "A+": "#fff4f4",
  A: "#ffefef",
  "A-": "#ffecec",
  "B+": "#fff4fa",
  B: "#ffeff7",
  "B-": "#ffecf4",
  "C+": "#fffaf4",
  C: "#fff7ef",
  "C-": "#fff4ec",
  "D+": "#f4faff",
  D: "#eff7ff",
  E: "#fff",
};

export type ClearKind =
  | "MFC"
  | "PFC"
  | "GFC"
  | "FC"
  | "LIFE4"
  | "CLEAR"
  | "ASSISTED"
  | "FAILED"
  | "NO PLAY"
  | "LOCKED";
export const clearKindOrder: Record<ClearKind, number> = {
  LOCKED: 0,
  "NO PLAY": 1,
  FAILED: 2,
  ASSISTED: 3,
  CLEAR: 4,
  LIFE4: 5,
  FC: 6,
  GFC: 7,
  PFC: 8,
  MFC: 9,
};
export const clearKindColors: Record<ClearKind, string[]> = {
  MFC: [
    "background-image",
    "linear-gradient(90deg, rgba(255, 150, 234, 0.5), rgba(255, 243, 148, 0.6) 25%, rgba(252, 255, 221, 0.6) 55%, rgba(153, 255, 177, 0.6) 73%, rgba(182, 186, 255, 0.5))",
  ],
  PFC: [
    "background-image",
    "linear-gradient(90deg, rgba(255, 200, 96, 0.7), rgba(255, 233, 133, 0.7) 20%, rgba(255, 247, 221, 0.7) 85%, rgba(255, 250, 235, 0.7))",
  ],
  GFC: [
    "background-image",
    "linear-gradient(90deg, rgba(135, 255, 176, 0.7), rgba(174, 255, 247, 0.7) 52%, rgba(201, 248, 255, 0.7))",
  ],
  FC: [
    "background-image",
    "linear-gradient(90deg, rgba(147, 217, 255, 0.7), rgba(233, 246, 255, 0.7))",
  ],
  LIFE4: ["background-color", "#ffeaf4"],
  CLEAR: ["background-color", "#eaf4ff"],
  ASSISTED: ["background-color", "#f4eaff"],
  FAILED: ["background-color", "#f9eaea"],
  "NO PLAY": ["background-color", "#fff"],
  LOCKED: ["background-color", "#e0e0e0"],
};

export const flareColors: Record<number, string[]> = {
  10: [
    "background-image",
    "linear-gradient(180deg, rgba(147, 106, 255, 0.3), rgba(255, 75, 75, 0.3) 19%, rgba(255, 184, 63, 0.3) 38%, rgba(245, 255, 124, 0.3) 63%, rgba(119, 255, 115, 0.3) 82%, rgba(97, 240, 255, 0.3))",
  ],
  9: ["background-color", "#f5f5f5"],
  8: ["background-color", "#fcfcfc"],
  7: ["background-color", "#fdf0ec"],
  6: ["background-color", "#fcefff"],
  5: ["background-color", "#fff6f6"],
  4: ["background-color", "#ffffe5"],
  3: ["background-color", "#efffe7"],
  2: ["background-color", "#e0feff"],
  1: ["background-color", "#e9faff"],
  0: ["background-color", "#ffffff"],
};

export type ScoreEntry = {
  score: number | null;
  clearRank: ClearRank | null;
  clearKind: ClearKind | null;
  flareRank: number | null;
  flareSkill: number | null;
  updateAt: Date | null;
};

export type Chart = {
  id: number;
  song: string;
  difficulty: Difficulty;
  level: number;
  best: ScoreEntry;
  scores: ScoreEntry[];
};

export async function fetchTSV(url: string): Promise<string[][]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.statusText}`);
  }

  const raw = await response.arrayBuffer();
  const hdr = new Uint8Array(raw.slice(0, 2));
  const content = new TextDecoder().decode(
    hdr[0] == 0x1f && hdr[1] == 0x8b ? pako.ungzip(raw) : raw
  );
  const parsed = parse<string[]>(content, {
    delimiter: "\t",
    header: false,
    skipEmptyLines: true,
  });
  if (parsed.errors.length > 0) {
    throw new Error(`Error parsing TSV file`);
  }

  return parsed.data.slice(1);
}

export async function fetchCharts(
  bestsUrl: string,
  scoresUrl: string
): Promise<Chart[]> {
  const bests = await fetchTSV(bestsUrl).then((tsv) =>
    tsv.map((line) => ({
      id: Number(line[0]),
      title: line[1],
      difficulty: difficultyIds[Number(line[2])],
      level: Number(line[3]),
      score: {
        score: line[4] ? Number(line[4]) : null,
        clearRank: (line[5] as ClearRank) || null,
        clearKind: (line[6] as ClearKind) || null,
        flareRank: line[7] ? Number(line[7]) : null,
        flareSkill: line[8] ? Number(line[8]) : null,
        updateAt: null,
      } as ScoreEntry,
    }))
  );

  const scores = await fetchTSV(scoresUrl).then((tsv) => {
    const hists = tsv.map((line) => {
      const scores = line[4].split(",").map((s) => (s ? Number(s) : null));
      const clearRanks = line[5]
        .split(",")
        .map((s) => (s as ClearRank) || null);
      const clearKinds = line[6]
        .split(",")
        .map((s) => (s as ClearKind) || null);
      const flareRanks = line[7].split(",").map((s) => (s ? Number(s) : null));
      const flareSkills = line[8].split(",").map((s) => (s ? Number(s) : null));
      const updateAts = line[9].split(",").map((s) => new Date(s));
      let history = [];
      for (let i = 0; i < scores.length; i++) {
        if (clearKinds[i] != "NO PLAY") {
          history.push({
            score: scores[i],
            clearRank: clearRanks[i],
            clearKind: clearKinds[i],
            flareRank: flareRanks[i],
            flareSkill: flareSkills[i],
            updateAt: updateAts[i],
          } as ScoreEntry);
        }
      }
      return { id: Number(line[0]), history: history };
    });
    let scores = {} as Record<number, ScoreEntry[]>;
    for (let h of hists) {
      scores[h.id] = h.history;
    }
    return scores;
  });

  let charts = [];
  for (let b of bests) {
    charts.push({
      id: b.id,
      song: b.title,
      difficulty: b.difficulty,
      level: b.level,
      best: b.score,
      scores: scores[b.id] || [],
    } as Chart);
  }

  return charts;
}
