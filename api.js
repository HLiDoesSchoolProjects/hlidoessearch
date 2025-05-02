import express from "express";
import fs from "fs";
import { stemmer } from "./helpers.js";

const PORT = 3001;

const app = express();
const data = JSON.parse(fs.readFileSync("data/data.json", "utf-8"));

app.use(express.static("web")); 

app.get("/api/search", (req, res) => {
    if (req.query.key !== "hlidoessearchsecretkey") return res.send(`{"error":"Disallowed"}`);
    if (!req.query.s) return res.send(`{"error":"Please specify query string!"}`);
    const queryWords = req.query.s.trim().toLowerCase().split(" ").map(word => stemmer(word));

    const infoData = data.map(item => {
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
    const sortedInfoData = infoData.filter(item => item.score > 0).toSorted((a, b) => b.score - a.score);
    const slicedResults = sortedInfoData.slice(0, req.query.count ?? 20);
    return res.send({
        count: slicedResults.length,
        keywords: queryWords,
        results: slicedResults
    });
});

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));