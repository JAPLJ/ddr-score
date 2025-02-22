import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
  Drawer,
  IconButton,
  styled,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Chart,
  clearKindColors,
  clearKindOrder,
  clearRankColors,
  difficultyColors,
  fetchCharts,
  flareColors,
} from "./Data.tsx";
import { USER } from "./User.tsx";

const BESTS_URL = `data/bests.tsv.gz`;
const SCORES_URL = `data/scores.tsv.gz`;

type SortKey = "song" | "score" | "kind" | "flare";
type SortOrder = "asc" | "desc";

function getSortKey(c: Chart, k: SortKey) {
  if (k == "song") return c.song;
  if (k == "score") return c.best.score || null;
  if (k == "kind") return c.best.clearKind;
  if (k == "flare") return c.best.flareSkill;
  return null;
}

function* range(start: number, end: number) {
  for (let i = start; i < end; ++i) {
    yield i;
  }
}

const ScoreView = () => {
  const [error, setError] = useState<string | null>(null);
  const [charts, setCharts] = useState<Chart[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<number>(15);
  const [sortKey, setSortKey] = useState<SortKey>("song");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [selectedChart, setSelectedChart] = useState<Chart | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const charts = await fetchCharts(BESTS_URL, SCORES_URL);
        setCharts(charts);
      } catch (err) {
        console.log(err);
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    };
    fetchData();
  }, []);

  const filteredCharts = [...charts].filter((c) => c.level == selectedLevel);

  const sortedCharts = [...filteredCharts].sort((a, b) => {
    let cmp = 0;

    const av = getSortKey(a, sortKey);
    const bv = getSortKey(b, sortKey);

    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;

    if (sortKey === "song") {
      cmp = (av as string).localeCompare(bv as string);
    } else if (sortKey === "score") {
      cmp = (av as number) - (bv as number);
    } else if (sortKey === "kind") {
      cmp =
        clearKindOrder[av as keyof typeof clearKindOrder] -
        clearKindOrder[bv as keyof typeof clearKindOrder];
    } else if (sortKey === "flare") {
      cmp = (av as number) - (bv as number);
    }

    return sortOrder == "asc" ? cmp : -cmp;
  });

  const handleSelectedLevel = (lev: string | null) => {
    const level = Number(lev);
    if (level > 0) {
      setSelectedLevel(level);
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey == key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  if (error) return <Typography color="error">Error: {error}</Typography>;
  if (charts.length == 0) return <Typography>Loading data...</Typography>;

  return (
    <Box display="flex" height="100vh">
      <Box flex={1} p={2}>
        <Typography variant="h5" gutterBottom>
          {USER.toUpperCase()}
        </Typography>

        <Box flex={1} paddingBottom={2}>
          <ToggleButtonGroup
            size="small"
            value={selectedLevel}
            exclusive
            onChange={(_, a) => handleSelectedLevel(a)}
          >
            {[...range(1, 20)].map((lev) => (
              <ToggleButton value={lev}>{lev}</ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        <Table size="small" style={{ width: "auto" }}>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={sortKey === "song"}
                  direction={sortKey === "song" ? sortOrder : "asc"}
                  onClick={() => handleSort("song")}
                >
                  Song
                </TableSortLabel>
              </TableCell>
              <TableCell>Diff</TableCell>
              <TableCell>Level</TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortKey === "score"}
                  direction={sortKey === "score" ? sortOrder : "asc"}
                  onClick={() => handleSort("score")}
                >
                  Score
                </TableSortLabel>
              </TableCell>
              <TableCell>Rank</TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortKey === "kind"}
                  direction={sortKey === "kind" ? sortOrder : "asc"}
                  onClick={() => handleSort("kind")}
                >
                  Clear
                </TableSortLabel>
              </TableCell>
              <TableCell>F.Rnk</TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortKey === "flare"}
                  direction={sortKey === "flare" ? sortOrder : "asc"}
                  onClick={() => handleSort("flare")}
                >
                  F.Skl
                </TableSortLabel>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedCharts.map((chart) => {
              const diffCol = difficultyColors[chart.difficulty];
              const rankCol = clearRankColors[chart.best.clearRank || "E"];
              const kindCol =
                clearKindColors[chart.best.clearKind || "NO PLAY"];
              const flareCol = flareColors[chart.best.flareRank || 0];
              const ColoredRow = styled(TableRow)`
                :not(:hover) .diff {
                  background-color: ${diffCol};
                }
                :not(:hover) .rank {
                  background-color: ${rankCol};
                }
                :not(:hover) .kind {
                  ${kindCol[0]}: ${kindCol[1]};
                }
                :not(:hover) .flare {
                  ${flareCol[0]}: ${flareCol[1]};
                }
              `;
              return (
                <ColoredRow
                  key={chart.id}
                  hover
                  onClick={() => {
                    if (chart.scores.length > 0) {
                      setSelectedChart(chart);
                    }
                  }}
                >
                  <TableCell className="diff">{chart.song}</TableCell>
                  <TableCell className="diff">
                    {chart.difficulty || "-"}
                  </TableCell>
                  <TableCell className="diff">{chart.level || "-"}</TableCell>
                  <TableCell className="rank">
                    {chart.best.score || "-"}
                  </TableCell>
                  <TableCell className="rank">
                    {chart.best.clearRank || "-"}
                  </TableCell>
                  <TableCell className="kind">
                    {chart.best.clearKind || "-"}
                  </TableCell>
                  <TableCell className="flare">
                    {chart.best.flareRank || "-"}
                  </TableCell>
                  <TableCell className="flare">
                    {chart.best.flareSkill || "-"}
                  </TableCell>
                </ColoredRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>

      <Drawer
        anchor="right"
        open={Boolean(selectedChart)}
        onClose={() => setSelectedChart(null)}
        PaperProps={{ sx: { width: "50%", minWidth: 400, padding: 2 } }}
      >
        {selectedChart && (
          <Box>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
            >
              <Typography variant="h6">
                {selectedChart.song} ({selectedChart.difficulty})
              </Typography>
              <IconButton onClick={() => setSelectedChart(null)}>
                <CloseIcon />
              </IconButton>
            </Box>
            <ResponsiveContainer width="100%" height={600}>
              <LineChart
                data={selectedChart.scores}
                margin={{ left: 15, right: 5, top: 10 }}
              >
                <CartesianGrid strokeDasharray="5 5" />
                <XAxis dataKey="updatedAt" />
                <YAxis
                  domain={[
                    Math.floor(
                      Math.min(
                        ...selectedChart.scores.map((s) => s.score || 1000000)
                      ) / 50000
                    ) * 50000,
                    1000000,
                  ]}
                />
                <Tooltip />
                <ReferenceLine y={1000000} label="MFC" />
                <ReferenceLine y={990000} label="AAA" />
                <ReferenceLine y={950000} label="AA+" />
                <ReferenceLine y={900000} label="AA" />
                <ReferenceLine y={890000} label="AA-" />
                <ReferenceLine y={850000} label="A+" />
                <ReferenceLine y={800000} label="A" />
                <ReferenceLine y={790000} label="A-" />
                <ReferenceLine y={750000} label="B+" />
                <ReferenceLine y={700000} label="B" />
                <ReferenceLine y={690000} label="B-" />
                <ReferenceLine y={650000} label="C+" />
                <ReferenceLine y={600000} label="C" />
                <ReferenceLine y={590000} label="C-" />
                <ReferenceLine y={550000} label="D+" />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#8884d8"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Score</TableCell>
                  <TableCell>Rank</TableCell>
                  <TableCell>Clear</TableCell>
                  <TableCell>F.Skill</TableCell>
                  <TableCell>Updated At</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {selectedChart.scores.map((se) => {
                  return (
                    <TableRow>
                      <TableCell>{se.score}</TableCell>
                      <TableCell>{se.clearRank}</TableCell>
                      <TableCell>{se.clearKind}</TableCell>
                      <TableCell>{se.flareSkill}</TableCell>
                      <TableCell>{se.updateAt?.toLocaleString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        )}
      </Drawer>
    </Box>
  );
};

export default ScoreView;
