import express from "express";
import fs from "fs";
import { stemmer } from "./helpers.js";
import { buildBm25Stats, getDocLength, scoreBm25Query } from "./bm25.js";

const PORT = 3001;
const BM25_STATS_DATA_PATH = "data/bm25_stats.json";

const app = express();
const data = JSON.parse(fs.readFileSync("data/data.json", "utf-8"));
let bm25Stats;

try {
    bm25Stats = JSON.parse(fs.readFileSync(BM25_STATS_DATA_PATH, "utf-8"));
} catch {
    bm25Stats = buildBm25Stats(data);
}

app.use(express.static("web")); 

app.get("/api/search", (req, res) => {
    if (!req.query.q) return res.send("Error: please specify query string!");
    const queryWords = req.query.q.trim().toLowerCase().split(/\s+/).filter(Boolean).map(word => stemmer(word));
    const mode = req.query.mode?.toLowerCase();

    if (queryWords.length === 0) return res.send([]);

    let infoData = [];
    if (mode === "bm25") {
        // BM25 mode
        infoData = data.map(item => {
            const docLength = Number.isFinite(item.docLength) ? item.docLength : getDocLength(item.data ?? {});
            const score = scoreBm25Query(queryWords, item.data ?? {}, docLength, bm25Stats);
            return {
                link: item.link,
                title: item.title,
                description: item.description,
                date: item.date,
                score: score
            };
        });
    } else if (mode === "classic") {
        // Classic mode (default)
        infoData = data.map(item => {
            let score = 0;
            for (const queryWord of queryWords) {
                const wordScore = item.data[queryWord];
                score += wordScore ?? 0;
            }
            return {
                link: item.link,
                title: item.title,
                description: item.description,
                date: item.date,
                score: score
            };
        });
    }

    const slicedSortedInfoData = infoData.filter(item => item.score > 0).toSorted((a, b) => b.score - a.score).slice(0, req.query.count ?? 20);
    return res.send(slicedSortedInfoData);
});

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
