/**
 * The line in Home's hero band, one per day of the year.
 *
 * The most-read text in the app by a distance — somebody who uses this daily
 * sees these more often than they see any notification, any card, or any
 * reflection they have written. It used to be five banks in five different
 * voices: Gen-Z internet ("Main character energy"), meditation app ("Still
 * waters run deep"), wellness affirmation ("You matter more than you know"),
 * motivational poster ("Build what they said you couldn't") and hype-man
 * ("You absolute legend"). Only two of the forty-nine lines were Àṣàrò's.
 *
 * `design/ASARO-CHARACTER.md` §1 opens by saying he is "not a calm meditation
 * voice", which two of those banks were, verbatim.
 *
 * Three constraints shape every line here.
 *
 * **Low volume.** §5: seen every visit, so he is an accent rather than a
 * character. Short, dry, and nothing that stops being funny on its fourth
 * viewing — a notification line pasted into permanent furniture becomes the
 * nagging the app promises not to do.
 *
 * **No line may assume anything the app has not checked.** This is picked by
 * day of the year and nothing else: not the hour, not whether the reader has
 * been away, not whether they have already read today. So no "Morning", no
 * "Look who's back" (that is `WelcomeBack`'s job, and it actually knows), and
 * nothing claiming they did well yesterday. The falsifiability rule that
 * governs `render.ts` governs the hero too.
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
 * No character at all.
 *
 * A fifth of the year he simply gets out of the way. A voice that performs
 * every single day stops being a voice and becomes wallpaper, and these are
 * the days that keep the other four banks worth reading. Functional, never
 * soothing — the moment a line here starts comforting the reader it has
 * turned back into the wellness bank this file was rewritten to remove.
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
 * Interleaved so consecutive days never share a register.
 *
 * Every bank must be the same length. The previous version had nine `bold`
 * lines against ten of everything else, and the interleave read `bold[9]`
 * regardless — so `HOME_TITLES[48]` was `undefined` and seven days a year the
 * hero band rendered nothing at all. Building the list from the shortest bank
 * makes that unrepresentable rather than merely fixed.
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
