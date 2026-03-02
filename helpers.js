import fs from "node:fs";
import path from "node:path";

// General steps: lower case -> tokenize -> stem
const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
/** Split text into words with proper multilingual support */
export function tokenize(text) {
    if (!text) return [];
    return Array.from(segmenter.segment(text)).filter(segment => segment.isWordLike).map(segment => segment.segment);
}

/** Recursive function, return total score up until this point, each text node scored once based on max-scoring parent tag score */
export function scoreNode(node, parentTagScores) {
    let wordScoreMap = {};

    for (const childNode of node.childNodes) {
        if (childNode.nodeType === 3) {
            let words = tokenize(childNode.textContent.toLowerCase());
            const elementScore = Math.max(...parentTagScores);
            if (elementScore > 0) {
                for (const word of words) {
                    const stemmedWord = stemmer(word);
                    if (wordScoreMap[stemmedWord]) {
                        wordScoreMap[stemmedWord] += elementScore;
                    } else {
                        wordScoreMap[stemmedWord] = elementScore;
                    }
                }
            }
        } else {
            let tagScore = 0;
            switch (childNode.tagName) {
                case "P":
                    tagScore = 1;
                    break;
                case "A":
                case "B":
                case "STRONG":
                case "I":
                case "EM":
                    tagScore = 2;
                    break;
                case "H3":
                case "H4":
                case "H5":
                    tagScore = 3;
                    break;
                case "H2":
                    tagScore = 4;
                    break;
                case "H1":
                    tagScore = 5;
                    break;
                case "TITLE":
                    tagScore = 30;
                    break;
            }
            const mapToAdd = scoreNode(childNode, [...parentTagScores, tagScore]);
            for (const [word, score] of Object.entries(mapToAdd)) {
                if (wordScoreMap[word]) {
                    wordScoreMap[word] += score;
                } else {
                    wordScoreMap[word] = score;
                }
            }
        }
    }

    return wordScoreMap;
}

// Porter stemmer in Javascript. Few comments, but it's easy to follow against the rules in the original
// paper, in
//
//  Porter, 1980, An algorithm for suffix stripping, Program, Vol. 14,
//  no. 3, pp 130-137,
//
// see also http://www.tartarus.org/~martin/PorterStemmer

// Release 1 be 'andargor', Jul 2004
// Release 2 (substantially revised) by Christopher McKenzie, Aug 2009
// Slightly modified by HLiDoesSchoolProjects
/** Trim a word down to its more generally-used form */
export const stemmer = (() => {
    const step2list = {
        "ational" : "ate",
        "tional" : "tion",
        "enci" : "ence",
        "anci" : "ance",
        "izer" : "ize",
        "bli" : "ble",
        "alli" : "al",
        "entli" : "ent",
        "eli" : "e",
        "ousli" : "ous",
        "ization" : "ize",
        "ation" : "ate",
        "ator" : "ate",
        "alism" : "al",
        "iveness" : "ive",
        "fulness" : "ful",
        "ousness" : "ous",
        "aliti" : "al",
        "iviti" : "ive",
        "biliti" : "ble",
        "logi" : "log"
    },

    step3list = {
        "icate" : "ic",
        "ative" : "",
        "alize" : "al",
        "iciti" : "ic",
        "ical" : "ic",
        "ful" : "",
        "ness" : ""
    },

    c = "[^aeiou]",          // consonant
    v = "[aeiouy]",          // vowel
    C = c + "[^aeiouy]*",    // consonant sequence
    V = v + "[aeiou]*",      // vowel sequence

    mgr0 = "^(" + C + ")?" + V + C,               // [C]VC... is m>0
    meq1 = "^(" + C + ")?" + V + C + "(" + V + ")?$",  // [C]VC[V] is m=1
    mgr1 = "^(" + C + ")?" + V + C + V + C,       // [C]VCVC... is m>1
    s_v = "^(" + C + ")?" + v;                   // vowel in stem

    return (w) => {
        let stem,
            suffix,
            firstch,
            re,
            re2,
            re3,
            re4;

        if (w.length < 3) { return w; }

        firstch = w.substr(0,1);
        if (firstch == "y") {
            w = firstch.toUpperCase() + w.substr(1);
        }

        // Step 1a
        re = /^(.+?)(ss|i)es$/;
        re2 = /^(.+?)([^s])s$/;

        if (re.test(w)) { w = w.replace(re,"$1$2"); }
        else if (re2.test(w)) { w = w.replace(re2,"$1$2"); }

        // Step 1b
        re = /^(.+?)eed$/;
        re2 = /^(.+?)(ed|ing)$/;
        if (re.test(w)) {
            let fp = re.exec(w);
            re = new RegExp(mgr0);
            if (re.test(fp[1])) {
                re = /.$/;
                w = w.replace(re,"");
            }
        } else if (re2.test(w)) {
            let fp = re2.exec(w);
            stem = fp[1];
            re2 = new RegExp(s_v);
            if (re2.test(stem)) {
                w = stem;
                re2 = /(at|bl|iz)$/;
                re3 = new RegExp("([^aeiouylsz])\\1$");
                re4 = new RegExp("^" + C + v + "[^aeiouwxy]$");
                if (re2.test(w)) {  w = w + "e"; }
                else if (re3.test(w)) { re = /.$/; w = w.replace(re,""); }
                else if (re4.test(w)) { w = w + "e"; }
            }
        }

        // Step 1c
        re = /^(.+?)y$/;
        if (re.test(w)) {
            let fp = re.exec(w);
            stem = fp[1];
            re = new RegExp(s_v);
            if (re.test(stem)) { w = stem + "i"; }
        }

        // Step 2
        re = /^(.+?)(ational|tional|enci|anci|izer|bli|alli|entli|eli|ousli|ization|ation|ator|alism|iveness|fulness|ousness|aliti|iviti|biliti|logi)$/;
        if (re.test(w)) {
            let fp = re.exec(w);
            stem = fp[1];
            suffix = fp[2];
            re = new RegExp(mgr0);
            if (re.test(stem)) {
                w = stem + step2list[suffix];
            }
        }

        // Step 3
        re = /^(.+?)(icate|ative|alize|iciti|ical|ful|ness)$/;
        if (re.test(w)) {
            let fp = re.exec(w);
            stem = fp[1];
            suffix = fp[2];
            re = new RegExp(mgr0);
            if (re.test(stem)) {
                w = stem + step3list[suffix];
            }
        }

        // Step 4
        re = /^(.+?)(al|ance|ence|er|ic|able|ible|ant|ement|ment|ent|ou|ism|ate|iti|ous|ive|ize)$/;
        re2 = /^(.+?)(s|t)(ion)$/;
        if (re.test(w)) {
            let fp = re.exec(w);
            stem = fp[1];
            re = new RegExp(mgr1);
            if (re.test(stem)) {
                w = stem;
            }
        } else if (re2.test(w)) {
            let fp = re2.exec(w);
            stem = fp[1] + fp[2];
            re2 = new RegExp(mgr1);
            if (re2.test(stem)) {
                w = stem;
            }
        }

        // Step 5
        re = /^(.+?)e$/;
        if (re.test(w)) {
            let fp = re.exec(w);
            stem = fp[1];
            re = new RegExp(mgr1);
            re2 = new RegExp(meq1);
            re3 = new RegExp("^" + C + v + "[^aeiouwxy]$");
            if (re.test(stem) || (re2.test(stem) && !(re3.test(stem)))) {
                w = stem;
            }
        }

        re = /ll$/;
        re2 = new RegExp(mgr1);
        if (re.test(w) && re2.test(w)) {
            re = /.$/;
            w = w.replace(re,"");
        }

        // and turn initial Y back to y

        if (firstch == "y") {
            w = firstch.toLowerCase() + w.substr(1);
        }

        return w;
    }
})();

/** Write to file */
export function writeToFileSync(filePath, data) {
    const dirPath = path.dirname(filePath);
    try {
        fs.mkdirSync(dirPath, { recursive: true });
        fs.writeFileSync(filePath, data);
    } catch (error) {
        console.error(`Failed to write file: ${error}`);
    }
}
