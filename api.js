import express from "express";
import fs from "fs";
import { stemmer, tokenize } from "./helpers.js";
import { buildBm25Stats, getDocLength, scoreBm25Query } from "./bm25.js";

const PORT = 3001;

const app = express();
const pageData = JSON.parse(fs.readFileSync("data/data.json", "utf-8"));
let bm25Stats;
try {
    bm25Stats = JSON.parse(fs.readFileSync("data/bm25_stats.json", "utf-8"));
} catch {
    bm25Stats = buildBm25Stats(pageData);
}

app.use(express.static("web"));

const STOP_WORDS = new Set(["a", "an", "and", "are", "be", "for", "if", "in", "into", "is", "it", "no", "not", "of", "or", "so", "such", "that", "the", "then", "there", "these", "this", "to", "was", "will", "with"]);

app.get("/api/search", (req, res) => {
    const startTime = performance.now();
    if (!req.query.q || !req.query.mode) return res.status(400).send("Error: please specify query and mode!");
    const qParam = String(req.query.q);
    let rawQueryWords = tokenize(qParam.replace(/"([^"]*)"/g, "").toLowerCase());
    let queryWords = rawQueryWords.filter(word => !STOP_WORDS.has(word));
    if (queryWords.length === 0 && rawQueryWords.length > 0) {
        queryWords = rawQueryWords;
    }
    queryWords = queryWords.map(word => stemmer(word));
    const exactPhrases = [];
    const quoteRegex = /"([^"]+)"/g;
    let match;
    while ((match = quoteRegex.exec(qParam)) !== null) {
        if (match[1].trim()) exactPhrases.push(match[1].trim().toLowerCase());
    }
    const mode = req.query.mode?.toLowerCase();

    let infoData = [];
    if (queryWords.length !== 0 || exactPhrases.length !== 0) {
        for (const item of pageData) {
            let passExact = true;
            for (const exactPhrase of exactPhrases) {
                const titleLower = (item.title || "").toLowerCase();
                const descLower = (item.description || "").toLowerCase();
                if (!titleLower.includes(exactPhrase) && !descLower.includes(exactPhrase)) {
                    passExact = false;
                    break;
                }
            }
            if (!passExact) continue;

            let score = 0;
            if (mode === "bm25") {
                // BM25 mode
                const docLength = Number.isFinite(item.docLength) ? item.docLength : getDocLength(item.data ?? {});
                score = scoreBm25Query(queryWords, item.data ?? {}, docLength, bm25Stats);
                for (const exactPhrase of exactPhrases) {
                    const phraseWords = tokenize(exactPhrase).map(word => stemmer(word));
                    score += scoreBm25Query(phraseWords, item.data ?? {}, docLength, bm25Stats) * 3;
                }
            } else if (mode === "classic") {
                // Classic mode
                for (const queryWord of queryWords) {
                    const wordScore = item.data[queryWord];
                    score += wordScore ?? 0;
                }
                for (const exactPhrase of exactPhrases) {
                    const phraseWords = tokenize(exactPhrase).map(word => stemmer(word));
                    for (const phraseWord of phraseWords) {
                        const wordScore = item.data[phraseWord];
                        score += (wordScore ?? 0) * 5;
                    }
                }
            }

            if (exactPhrases.length > 0 && score === 0) {
                score = 1;
            }

            infoData.push({
                link: item.link,
                title: item.title,
                description: item.description,
                date: item.date,
                score: score
            });
        }
    }

    const filteredResults = infoData.filter(item => item.score > 0);
    const slicedSortedResults = infoData.filter(item => item.score > 0).toSorted((a, b) => b.score - a.score).slice(0, req.query.count ?? 20);
    return res.send({
        timeTookMs: Math.round(performance.now() - startTime),
        resultsCount: filteredResults.length,
        results: slicedSortedResults
    });
});

app.get("/api/favicon", async (req, res) => {
    const domain = req.query.domain;
    if (!domain) return res.status(400).send("Error: Please specify a domain!");

    try {
        const response = await fetch(`https://www.google.com/s2/favicons?domain=${domain}&sz=32`);
        if (!response.ok) throw new Error("Couldn't fetch favicon");
        const arrayBuffer = await response.arrayBuffer();
        res.setHeader("Content-Type", response.headers.get("content-type") || "image/png");
        res.setHeader("Cache-Control", "public, max-age=172800"); // 2 days
        return res.send(Buffer.from(arrayBuffer));
    } catch (error) {
        return res.status(500).send(`Error: ${error.message}`);
    }
});

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
