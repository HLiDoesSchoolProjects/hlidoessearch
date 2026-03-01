const DEFAULT_K1 = 1.2;
const DEFAULT_B = 0.75;

export function createBm25Stats(options = {}) {
    return {
        k1: options.k1 ?? DEFAULT_K1,
        b: options.b ?? DEFAULT_B,
        docCount: 0,
        totalDocLength: 0,
        avgDocLength: 0,
        documentFrequency: {}
    };
}

export function getDocLength(termScoreMap) {
    return Object.values(termScoreMap).reduce((sum, value) => {
        const numericValue = Number(value);
        return Number.isFinite(numericValue) && numericValue > 0 ? sum + numericValue : sum;
    }, 0);
}

export function addDocumentToBm25Stats(stats, termScoreMap, docLength = getDocLength(termScoreMap)) {
    stats.docCount += 1;
    stats.totalDocLength += docLength;
    for (const [term, value] of Object.entries(termScoreMap)) {
        const numericValue = Number(value);
        if (Number.isFinite(numericValue) && numericValue > 0) {
            stats.documentFrequency[term] = (stats.documentFrequency[term] ?? 0) + 1;
        }
    }
    stats.avgDocLength = stats.docCount > 0 ? stats.totalDocLength / stats.docCount : 0;
}

export function buildBm25Stats(pages, options = {}) {
    const stats = createBm25Stats(options);
    for (const page of pages) {
        const docLength = Number.isFinite(page.docLength) ? page.docLength : getDocLength(page.data ?? {});
        addDocumentToBm25Stats(stats, page.data ?? {}, docLength);
    }
    return stats;
}

function getIdf(df, docCount) {
    return Math.log(1 + ((docCount - df + 0.5) / (df + 0.5)));
}

function scoreBm25Term(tf, df, docLength, stats) {
    if (tf <= 0 || df <= 0 || stats.docCount === 0) return 0;
    const avgDocLength = stats.avgDocLength || 1;
    const k1 = stats.k1 ?? DEFAULT_K1;
    const b = stats.b ?? DEFAULT_B;
    const idf = getIdf(df, stats.docCount);
    const normalization = k1 * (1 - b + b * (docLength / avgDocLength));
    return idf * ((tf * (k1 + 1)) / (tf + normalization));
}

export function scoreBm25Query(queryTerms, termScoreMap, docLength, stats) {
    let score = 0;
    for (const term of queryTerms) {
        const tf = Number(termScoreMap[term] ?? 0);
        const df = stats.documentFrequency[term] ?? 0;
        score += scoreBm25Term(tf, df, docLength, stats);
    }
    return score;
}
