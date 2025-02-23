import { Box, Table, TableBody, TableCell, TableRow } from "@mui/material";
import {
  Chart,
  ClearKind,
  clearKindColors,
  clearKindOrder,
  ClearRank,
  clearRankColors,
  clearRankOrder,
  flareColors,
} from "./Data";

const Stats = ({ charts }: { charts: Chart[] }) => {
  const rankStats = ((cs) => {
    return cs
      .map((c) => c.best.clearRank)
      .filter((r) => r != null)
      .reduce((acc: { [key: string]: number }, r) => {
        acc[r] = (acc[r] || 0) + 1;
        return acc;
      }, {});
  })(charts);

  const kindStats = ((cs) => {
    return cs
      .map((c) => c.best.clearKind)
      .filter((k) => k != null)
      .reduce((acc: { [key: string]: number }, k) => {
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});
  })(charts);

  const flareStats = ((cs) => {
    return cs
      .map((c) => c.best.flareRank)
      .filter((f) => f != null)
      .reduce((acc: { [key: number]: number }, f) => {
        acc[f] = (acc[f] || 0) + 1;
        return acc;
      }, {});
  })(charts);

  return (
    <Box display="flex" flexDirection="row" columnGap={2}>
      <Box>
        <Table size="small">
          <TableBody>
            {Object.keys(clearRankOrder)
              .sort(
                (a, b) =>
                  clearRankOrder[b as ClearRank] -
                  clearRankOrder[a as ClearRank]
              )
              .map((rnk) => (
                <TableRow key={rnk}>
                  <TableCell
                    style={{
                      backgroundColor: clearRankColors[rnk as ClearRank],
                    }}
                  >
                    {rnk}
                  </TableCell>
                  <TableCell>{rankStats[rnk] || 0}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </Box>

      <Box>
        <Table size="small">
          <TableBody>
            {Object.keys(clearKindOrder)
              .sort(
                (a, b) =>
                  clearKindOrder[b as ClearKind] -
                  clearKindOrder[a as ClearKind]
              )
              .map((knd) => {
                const col = clearKindColors[knd as ClearKind];
                const colStyle =
                  col[0] == "background-image"
                    ? { backgroundImage: col[1] }
                    : { backgroundColor: col[1] };
                return (
                  <TableRow key={knd}>
                    <TableCell style={colStyle}>{knd}</TableCell>
                    <TableCell>{kindStats[knd] || 0}</TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </Box>

      <Box>
        <Table size="small">
          <TableBody>
            {(() => {
              let fs = [];
              for (let f = 10; f >= 0; --f) {
                fs.push(f);
              }
              return fs.map((f) => {
                const col = flareColors[f];
                const colStyle =
                  col[0] == "background-image"
                    ? { backgroundImage: col[1] }
                    : { backgroundColor: col[1] };
                return (
                  <TableRow key={f}>
                    <TableCell style={colStyle}>{f == 10 ? "EX" : f}</TableCell>
                    <TableCell>{flareStats[f] || 0}</TableCell>
                  </TableRow>
                );
              });
            })()}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
};

export default Stats;
