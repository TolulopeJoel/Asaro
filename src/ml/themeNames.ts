/**
 * Provisional names for themes, taken from the words already in them.
 *
 * clustering.ts records a deliberate "no generated labels" rule, and this does
 * not break it. The objection there is to a model *guessing* what a theme is
 * about — a guess can be confidently wrong, and nobody can hotfix a wrong
 * guess sitting in someone's journal. Nothing here guesses. It is extractive:
 * it counts the words the person themselves wrote and surfaces the ones that
 * set this cluster apart from their other clusters. The worst case is a dull
 * label, not a false one, and it is deterministic — the same entries always
 * produce the same words.
 *
 * What it is for is the empty state. A theme with no name at all is hard to
 * hold in your head or tell apart from the one under it, so the reader had to
 * do naming work before the screen was worth reading. A suggestion makes the
 * list legible immediately and leaves renaming as something you do when you
 * recognise the thing, which is the part that was always the point.
 *
 * These are never persisted. A saved name always wins, and `getNamedThemes`
 * never sees anything from this file — so a suggestion can change freely as
 * the journal grows without ever overwriting words someone chose.
 */

import { Cluster, Embedded } from './clustering';
import { stripReferences } from '../utils/reference';

/**
 * Function words, plus the vocabulary every reflection carries regardless of
 * subject.
 *
 * The IDF term below already discounts anything common to every cluster, but
 * that is a ranking, not a filter: with only a handful of clusters even a
 * heavily discounted "really" can outscore a rare meaningful word. These are
 * the ones that are never a theme no matter how they score.
 */
const STOPWORDS = new Set([
    // articles, pronouns, prepositions, conjunctions, auxiliaries
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are',
    'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but',
    'by', 'can', 'cannot', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each',
    'few', 'for', 'from', 'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here',
    'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it',
    'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now',
    'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves',
    'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that',
    'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this',
    'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were',
    'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'will', 'with', 'would',
    'you', 'your', 'yours', 'yourself', 'yourselves',
    'across', 'along', 'among', 'anyone', 'anymore', 'around', 'behind', 'beside', 'beyond',
    'despite', 'either', 'else', 'everybody', 'everyone', 'except', 'however', 'inside',
    'instead', 'neither', 'nobody', 'none', 'nothing', 'outside', 'since', 'somebody',
    'someone', 'something', 'therefore', 'toward', 'towards', 'unless', 'upon', 'whenever',
    'wherever', 'whether', 'whose', 'within',
    // vague verbs and intensifiers that survive the above but say nothing
    'also', 'always', 'another', 'anything', 'become', 'becomes', 'came', 'come', 'comes',
    'even', 'ever', 'every', 'everything', 'get', 'gets', 'getting', 'give', 'gives', 'go',
    'going', 'good', 'got', 'great', 'keep', 'know', 'known', 'knows', 'let', 'like', 'lot',
    'made', 'make', 'makes', 'many', 'may', 'much', 'must', 'need', 'needs', 'never', 'new',
    'one', 'really', 'said', 'say', 'says', 'see', 'seen', 'still', 'take', 'takes', 'tell',
    'tells', 'thing', 'things', 'think', 'thought', 'time', 'times', 'use', 'used', 'want',
    'way', 'well', 'went', 'whatever', 'without', 'work', 'works',
    // past tenses of the above — the list is useless if 'give' is out but 'gave' rates
    'done', 'felt', 'found', 'gave', 'kept', 'put', 'saw', 'taken', 'took', 'wanted',
    // adverbs and hedges: they modify the idea, they are never the idea
    'able', 'almost', 'already', 'although', 'actually', 'certainly', 'enough', 'especially',
    'finally', 'maybe', 'often', 'perhaps', 'probably', 'quite', 'rather', 'repeatedly',
    'simply', 'sometimes', 'though', 'truly', 'usually', 'yet',
    // the frame every entry is written inside — present in all of them by construction
    'apply', 'bible', 'chapter', 'chapters', 'entry', 'others', 'people', 'person', 'read',
    'reading', 'scripture', 'scriptures', 'study', 'verse', 'verses', 'today',
]);

/** Below this, a word is noise ("is", "am") rather than a short strong word ("joy", "sin"). */
const MIN_WORD_LENGTH = 3;

/** How many words a label may carry. Two reads as a name; three reads as a list. */
const MAX_LABEL_WORDS = 2;

/**
 * Characters compared when deciding two words are the same idea.
 *
 * Crude stemming on purpose. "patience"/"patient", "forgive"/"forgiveness"
 * and "trust"/"trusting" would otherwise fill a two-word label with one idea
 * said twice. Four characters merges those without merging "peace"/"people".
 */
const STEM_LENGTH = 4;

/**
 * Split on anything that isn't a letter or an apostrophe.
 *
 * Citations come out first. The member text here is the raw answer — the
 * snippets rendered beside a theme need the `[[...]]` markers intact — so
 * without this a book someone happened to cite twice outranks what they
 * actually wrote, and the theme gets labelled "Genesis".
 */
function words(text: string): string[] {
    return stripReferences(text)
        .toLowerCase()
        .split(/[^a-z'À-ɏ]+/)
        .map(word => word.replace(/^'+|'+$/g, ''))
        .filter(word => word.length >= MIN_WORD_LENGTH && !STOPWORDS.has(word));
}

function titleCase(word: string): string {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * One provisional label per cluster, in the order the clusters were given.
 *
 * Scored as term frequency against smoothed inverse cluster frequency — the
 * word that matters is the one this cluster leans on and its neighbours do
 * not. Smoothing matters at this scale: with four or five clusters an
 * unsmoothed IDF zeroes every word that appears in all of them, which on a
 * small journal is most of the good ones.
 */
export function suggestNames<T extends Embedded>(clusters: Cluster<T>[]): string[] {
    if (clusters.length === 0) return [];

    /** Per cluster: how often each word appears, and how many words in total. */
    const counts = clusters.map(cluster => {
        const frequency = new Map<string, number>();
        let total = 0;

        for (const member of cluster.members) {
            for (const word of words(member.text)) {
                frequency.set(word, (frequency.get(word) ?? 0) + 1);
                total++;
            }
        }

        return { frequency, total };
    });

    /** How many clusters use each word at all. */
    const clusterFrequency = new Map<string, number>();
    for (const { frequency } of counts) {
        for (const word of frequency.keys()) {
            clusterFrequency.set(word, (clusterFrequency.get(word) ?? 0) + 1);
        }
    }

    const clusterCount = clusters.length;

    return counts.map(({ frequency, total }, index) => {
        if (total === 0) return `Theme ${index + 1}`;

        const scored = [...frequency.entries()]
            .map(([word, count]) => {
                const df = clusterFrequency.get(word) ?? 1;
                const idf = Math.log((clusterCount + 1) / (df + 1)) + 1;
                return { word, score: (count / total) * idf };
            })
            // Ties are common on a short journal, where most words appear once.
            // Falling back to the longer word picks the more specific of two.
            .sort((a, b) => b.score - a.score || b.word.length - a.word.length);

        const chosen: string[] = [];
        const stems = new Set<string>();

        for (const { word } of scored) {
            const stem = word.slice(0, STEM_LENGTH);
            if (stems.has(stem)) continue;
            stems.add(stem);
            chosen.push(titleCase(word));
            if (chosen.length === MAX_LABEL_WORDS) break;
        }

        return chosen.length > 0 ? chosen.join(' · ') : `Theme ${index + 1}`;
    });
}
