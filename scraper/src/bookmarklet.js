let s = document.createElement("script");
s.type = "text/javascript";
s.src = "https://ddr.ongakusei.tokyo/scraper/index.js";
document.head.appendChild(s);
s.onload = () => updateScores("user", "pass");