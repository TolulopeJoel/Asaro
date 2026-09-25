/**
 * The line in Home's hero band, one per day of the year — the most-read text in
 * the app by a distance. Three constraints shape every line:
 *
 * **Low volume** (design/ASARO-CHARACTER.md §5). Seen every visit, so he is an
 * accent rather than a character: short, dry, and nothing that stops being
 * funny on its fourth viewing. Not a calm meditation voice (§1), and never a
 * wellness affirmation or a motivational poster.
 *
 * **No line may assume anything the app has not checked.** Picked by day of the
 * year and nothing else — not the hour, not whether the reader has been away,
 * not whether they have read today. So no "Morning", no "Look who's back"
 * (that is `WelcomeBack`'s job, and it actually knows), nothing about
 * yesterday. The falsifiability rule governing `render.ts` governs this too.
 *
 * **§4①: he teases about being ignored by HIM, never about standing with
 * Jehovah.** Nothing here appoints him judge of anybody's spiritual life.
 */

/** He is present and says so. */
const watching = [
    "The text won't read itself. 😏",
    'Look who it is. 👀',
    "I'm here. Where are you?",
    'I was here before you.',
    'You again. Good.',
    'I see you o.',
    'Still watching. Just so you know.',
    'Ehen.',
    "I don't miss things.",
    'Somebody is around.',
];

/** Deadpan one-word verdicts — §3. */
const deadpan = [
    'Interesting.',
    'Oh. Today we are serious.',
    'Hmmm. Look at this.',
    'So we are doing this.',
    'Okay o.',
    'Wonders.',
    'Something is happening today.',
    'Well. Well.',
    'Surprising.',
    'Noted.',
];

/** Mock-menace, always undercut — a threat with no wink is just unpleasant. */
const menace = [
    "Don't start with excuses o.",
    'I have all day. Do you?',
    'Try me. 👀',
    'One chapter. That is all I am asking.',
    "Don't make me follow you around. 😏",
    'You know how I can be. 👀',
    "Let's not do this today o.",
    "I'm not going anywhere. 😌",
    'Test me and see. 😂',
    'Face your front. The Bible is there.',
];

/** The softening — it always arrives, and it arrives last. */
const conceding = [
    'Fine. You showed up.',
    'Alright, alright.',
    'No complaints from me.',
    "I'll allow it. 😌",
    'See? It is not hard.',
    'Good. I said what I said.',
    'This one, I like.',
    'Carry on then.',
    'Small respect o.',
    'You and I are fine today.',
];

/**
 * No character at all — a fifth of the year he gets out of the way. A voice
 * that performs every day becomes wallpaper, and these are the days that keep
 * the other four banks worth reading. Functional, never soothing: a line here
 * that starts comforting the reader has turned into a wellness affirmation.
 */
const plain = [
    'The reading is there.',
    'Whenever you are ready.',
    'Open it.',
    "Today's chapter is waiting.",
    'Start where you stopped.',
    'Your place is kept.',
    'The plan is up to date.',
    'Begin.',
    'Pick it up.',
    'It is there when you are.',
];

/*
 * Interleaved so consecutive days never share a register. EVERY BANK MUST BE
 * THE SAME LENGTH — an uneven one indexes past its end and the hero band
 * renders nothing on those days. Building from the shortest bank makes that
 * unrepresentable rather than merely fixed.
 */
const BANKS = [watching, deadpan, menace, conceding, plain];
const PER_BANK = Math.min(...BANKS.map(bank => bank.length));

export const HOME_TITLES: string[] = Array.from({ length: PER_BANK }, (_, i) =>
    BANKS.map(bank => bank[i]),
).flat();

export function getDailyTitle(): string {
    const dayOfYear = Math.floor(
        (new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
    );
    return HOME_TITLES[dayOfYear % HOME_TITLES.length];
}
