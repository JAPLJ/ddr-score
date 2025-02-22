import { createTheme, ThemeProvider } from "@mui/material";
import ScoreView from "./ScoreView";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#512da8",
    },
    secondary: {
      main: "#f50057",
    },
    background: {
      default: "#ffffff",
    },
  },
  typography: {
    fontFamily: ["Shippori Antique", "Roboto"].join(","),
  },
});

const App = () => {
  return (
    <ThemeProvider theme={theme}>
      <ScoreView />
    </ThemeProvider>
  );
};

export default App;
