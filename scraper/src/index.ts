interface Logger {
  logBody: HTMLParagraphElement;
  append(text?: string): HTMLParagraphElement;
}

function init(): Logger {
  const logArea: HTMLDivElement = document.createElement("div");
  logArea.setAttribute(
    "style",
    "position: fixed; top: 0; width: 100%; padding: 5; z-index: 10000; background-color: rgba(255,255,255,0.9);"
  );

  const log: Logger = {
    logBody: document.createElement("p"),
    append(text?: string): HTMLParagraphElement {
      const p = document.createElement("p");
      if (text != null) {
        p.innerText = text;
      }
      this.logBody.appendChild(p);
      return p;
    },
  };
  logArea.appendChild(log.logBody);
  document.body.appendChild(logArea);
  return log;
}

type Score = Readonly<{
  title: string;
  difficulty: string;
  score: number | null;
  rank: string | null;
  clear_kind: string | null;
  flare_skill: number | null;
  flare_rank: number | null;
}>;

const BASE_URL = "https://ddr.ongakusei.tokyo/";
const PLAYDATA_URL =
  "https://p.eagate.573.jp/game/ddr/ddrworld/playdata/music_data_single.html";
const DIFFICULTIES = ["beginner", "basic", "difficult", "expert", "challenge"];
const RANK_BY_SCORE: [number, string][] = [
  [990000, "AAA"],
  [950000, "AA+"],
  [900000, "AA"],
  [890000, "AA-"],
  [850000, "A+"],
  [800000, "A"],
  [790000, "A-"],
  [750000, "B+"],
  [700000, "B"],
  [690000, "B-"],
  [650000, "C+"],
  [600000, "C"],
  [590000, "C-"],
  [550000, "D+"],
];
const KIND_BY_IMG: [string, string][] = [
  ["cl_marv.png", "MFC"],
  ["cl_perf.png", "PFC"],
  ["cl_great.png", "GFC"],
  ["cl_good.png", "FC"],
  ["cl_li4clear.png", "LIFE4"],
  ["cl_clear.png", "CLEAR"],
  ["cl_asclear.png", "ASSISTED"],
];
const FLARE_BY_IMG: [string, number][] = [
  ["flare_ex.png", 10],
  ["flare_9.png", 9],
  ["flare_8.png", 8],
  ["flare_7.png", 7],
  ["flare_6.png", 6],
  ["flare_5.png", 5],
  ["flare_4.png", 4],
  ["flare_3.png", 3],
  ["flare_2.png", 2],
  ["flare_1.png", 1],
];

function pageUrl(index: number): string {
  return `${PLAYDATA_URL}?offset=${index}&filter=0&filtertype=0&display=score`;
}

function rankFromScore(score: number): string | null {
  for (const [thres, rank] of RANK_BY_SCORE) {
    if (score >= thres) {
      return rank;
    }
  }
  if (score == 0) {
    return null;
  } else {
    return "D";
  }
}

function clearkindFromImg(url: string): string {
  for (const [img, kind] of KIND_BY_IMG) {
    if (url.endsWith(img)) {
      return kind;
    }
  }
  return "NO PLAY";
}

function flarerankFromImg(url: string): number {
  for (const [img, rank] of FLARE_BY_IMG) {
    if (url.endsWith(img)) {
      return rank;
    }
  }
  return 0;
}

function scrapeMusicData(tr: HTMLTableRowElement): Score[] {
  // "DDR System Songs+Replicant Mix "
  // "Something Just Like This (Alesso Remix) "
  // "THIS IS MY LAST RESORT "
  let title = tr.querySelector("td a.music_info")?.textContent?.trimEnd();
  if (title == null) {
    return [];
  }

  let res: Score[] = [];
  DIFFICULTIES.forEach((dif) => {
    const cell = tr.querySelector<HTMLAnchorElement>(`td#${dif} a.music_info`);
    if (cell == null) {
      return;
    }

    const score = Number(
      cell.querySelector<HTMLDivElement>(".data_score")?.textContent
    );
    if (isNaN(score)) {
      res.push({
        title: title,
        difficulty: dif,
        score: null,
        rank: null,
        clear_kind: "NO PLAY",
        flare_skill: null,
        flare_rank: null,
      });
      return;
    }

    const rankImg = cell.querySelector<HTMLImageElement>(".data_rank img")?.src;
    if (rankImg == null) {
      return;
    }
    const rank = rankImg.endsWith("rank_s_e.png") ? "E" : rankFromScore(score);

    const kindImg = cell.querySelector<HTMLImageElement>(
      ".data_clearkind img"
    )?.src;
    if (kindImg == null) {
      return;
    }
    const clearkind = rank == "E" ? "FAILED" : clearkindFromImg(kindImg);

    let flareskill: number | null = Number(
      cell.querySelector<HTMLDivElement>(".data_flareskill")?.textContent
    );
    if (isNaN(flareskill)) {
      flareskill = null;
    }

    const flareImg = cell.querySelector<HTMLImageElement>(
      ".data_flarerank img"
    )?.src;
    if (flareImg == null) {
      return;
    }
    const flarerank = flareskill ? flarerankFromImg(flareImg) : null;

    res.push({
      title: title,
      difficulty: dif,
      score: score,
      rank: rank,
      clear_kind: clearkind,
      flare_skill: flareskill,
      flare_rank: flarerank,
    });
  });

  return res;
}

function scrapePage(page: Document): Score[] {
  let res: Score[] = [];
  page
    .querySelectorAll<HTMLTableRowElement>("table#data_tbl tr.data")
    .forEach((row) => {
      res.push(...scrapeMusicData(row));
    });
  return res;
}

async function pageCount(): Promise<number | null> {
  const url = pageUrl(0);
  const top = await fetch(url);
  if (!top.ok) {
    return null;
  }

  const text = await top.text();
  const doc = new DOMParser().parseFromString(text, "text/html");

  const navs = doc.querySelectorAll<HTMLDivElement>("div.page_num");
  if (navs.length == 0) {
    return null;
  }
  return Number(navs[navs.length - 1].innerText);
}

async function scrapeAll(log: Logger): Promise<Score[]> {
  let res: Score[] = [];
  log.append("Starting scraping...");

  const pages = await pageCount();
  if (pages == null) {
    log.append("Number of pages not found. Are you logged in?");
    return [];
  }

  const slog = log.append();
  for (let offset = 0; offset < pages; ++offset) {
    slog.innerText = `Scraping page ${offset + 1} of ${pages}...`;
    const url = pageUrl(offset);
    const response = await fetch(url);
    if (!response.ok) {
      log.append(
        `Failed to fetch ${url} (${response.status}). Scraping canceled.`
      );
    }

    const text = await response.text();
    const doc = new DOMParser().parseFromString(text, "text/html");
    res.push(...scrapePage(doc));
  }

  log.append(`Successfully scraped ${res.length} charts.`);
  return res;
}

async function hashPayload(payload: string): Promise<string> {
  const encoder = new TextEncoder().encode(payload);
  const hash = await crypto.subtle.digest("SHA-256", encoder);
  const hashArray = Array.from(new Uint8Array(hash));
  return hashArray.map((bytes) => bytes.toString(16).padStart(2, "0")).join("");
}

async function updateScores(user: string, pass: string) {
  const log = init();
  const scores = await scrapeAll(log);

  if (scores.length == 0) {
    log.append("No score data to submit. Finished.");
    return;
  }

  log.append("Submitting scores...");
  const updateBody = JSON.stringify({
    user: user,
    password: pass,
    scores: scores,
  });
  const updateHash = await hashPayload(updateBody);
  const updateResponse = await fetch(`${BASE_URL}api/update_score`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-amz-content-sha256": updateHash,
    },
    body: updateBody,
  });
  if (!updateResponse.ok) {
    log.append(`Failed to submit: ${await updateResponse.text()}`);
    return;
  }

  type UpdateScoreResponse = Readonly<{
    updated: number;
    errors: string[];
  }>;
  const updateResult: UpdateScoreResponse = await updateResponse.json();
  log.append(`Successfully updated scores for ${updateResult.updated} charts.`);
  if (updateResult.errors.length > 0) {
    log.append(
      "Some errors occurred. Please check the song/chart database or scraping results."
    );
    for (let i = 0; i < updateResult.errors.length; ++i) {
      log.append(`[${i}]: ${updateResult.errors[i]}`);
    }
    log.append("Skipping score view update due to errors.");
    return;
  }

  log.append("Updating score view...");
  const viewBody = JSON.stringify({ user: user, password: pass });
  const viewHash = await hashPayload(viewBody);
  const viewResponse = await fetch(`${BASE_URL}api/dump_user_data`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-amz-content-sha256": viewHash,
    },
    body: viewBody,
  });
  if (!viewResponse.ok) {
    log.append(`Failed to update: ${await viewResponse.text()}`);
    return;
  }
  log.append(`Successfully updated. Changes may take some time to appear.`);

  const lp = log.append();
  const url = `${BASE_URL}scores/${user}/`;
  const link: HTMLAnchorElement = document.createElement("a");
  link.textContent = url;
  link.href = url;
  lp.appendChild(link);
}
