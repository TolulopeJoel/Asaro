const playful = [
    "The text won't read itself. 😏",
    "Plot twist: today hits different.",
    "Who let you show up this ready?",
    "Main character energy. Let's go.",
    "Fun fact: you're that one.",
    "Chaos? Nah. Clarity.",
    "You woke up curious. Good.",
    "Absolutely unhinged commitment. Respect.",
    "Today's forecast: you, thriving.",
    "Look who's back. 👀",
];

const calm = [
    "Breathe first. Then begin.",
    "One thing at a time.",
    "Still waters run deep.",
    "You don't have to rush this.",
    "Slow is smooth. Smooth is far.",
    "Root down, then rise.",
    "Be here. That's enough.",
    "Quiet strength is still strength.",
    "Peace is your starting point.",
    "Just begin. That's all.",
];

const warm = [
    "You showed up. That matters.",
    "Something here is for you today.",
    "Take your time. No rush.",
    "Growth looks good on you.",
    "You're right on time.",
    "You've come so far already.",
    "You matter more than you know.",
    "Your effort counts. Always.",
    "Keep going. You are loved.",
    "You brought yourself here. Good.",
];

const bold = [
    "Don't just read it. Let it land.",
    "Comfortable? Good. Now go deeper.",
    "The gap closes when you move.",
    "You didn't come this far to skim.",
    "Fear is just a feeling. Dig anyway.",
    "Build what they said you couldn't.",
    "What will you carry out today?",
    "Do it now. Regret nothing.",
    "The version of you that grows — be that.",
];

const hype = [
    "My superstar. 🌟",
    "There you are.",
    "You absolute legend.",
    "Look at you, showing up.",
    "That's my reader right there.",
    "You're doing so well. Seriously.",
    "Big moves start here.",
    "Today's hero: you.",
    "You're built different. For real.",
    "Go off. You've earned it.",
];

// Interleaved: playful → calm → warm → bold → hype → repeat
export const HOME_TITLES = playful.flatMap((_, i) => [
    playful[i], calm[i], warm[i], bold[i], hype[i],
]);

export function getDailyTitle(): string {
    const dayOfYear = Math.floor(
        (new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
    );
    return HOME_TITLES[dayOfYear % HOME_TITLES.length];
}

// Tougher variant for Locked In Mode — same brand voice (a little cheeky,
// a little Naija-inflected). Kept deliberately general — no life-circumstance
// references — so it holds up regardless of what's actually going on for you.
const LOCKED_IN_TITLES = [
    // Tough love
    "No excuses today.",
    "Sit down and read it.",
    "One chapter. No delay.",
    "The plan doesn't wait for your mood.",
    "You said you'd lock in. So lock in.",
    "Discipline over vibes. Go.",
    "Ehen. Stop scrolling, start reading.",
    "Today isn't optional.",

    // Funny
    "Netflix will still be there. Read first.",
    "Your phone battery isn't the only thing that needs charging.",
    "Snacks can wait. Scripture first.",
    "You've refreshed your feed enough today.",
    "Plot twist: the discipline was inside you all along.",
    "Multitasking is a myth. Just read.",
    "Àṣàrò doesn't do excuses, only chapters.",
    "Ehen, oya, read.",

    // Faith-inflected
    "Weeping may last the night, but so does your reading plan.",
    "This is a wilderness season, not the promised land. Keep walking.",
    "Job lost everything and still showed up. You can read one chapter.",
    "Even David wrote sad songs. Then he still worshipped.",
    "Ruth kept walking after loss. So can you.",
    "Not every valley is punishment. Some are just valleys.",
    "God's mercies are new every morning. So is your reading plan.",
    "Faithful in the small chapter, faithful in the big story.",

    // Forward motion / resilience
    "Small steps still count as moving.",
    "You don't have to feel ready to show up.",
    "One page today. One page tomorrow. That's the whole plan.",
    "Growth doesn't pause for a bad day.",
    "You're not starting over. You're continuing.",
    "Motion beats mood. Read anyway.",
    "Six months from now, you'll be glad you didn't stop.",
    "Progress hides in ordinary days.",

    // Self-respect / discipline
    "Choose yourself today. Starting with this chapter.",
    "You're allowed to be a work in progress.",
    "Standards don't lower just because you're tired.",
    "You're the main character. Act like it. Read.",
    "Consistency is quieter than motivation. Trust it.",
    "Show up for future you.",

    // Playful / general
    "Manifesting consistency today.",
    "Glow-up starts with showing up.",
    "Still standing. Still reading.",
    "This is a chapter, not the whole story.",
    "Not every day is a good day. This can still be a good five minutes.",
    "Àṣàrò is watching. Get in position.",

    // Extras
    "The plan doesn't care how busy you are.",
    "You don't need to feel inspired to open the book.",
    "One verse can carry a whole day.",
    "Reading beats regretting.",
    "Do the small thing. It adds up.",
    "Show up. No debate.",
];

export function getLockedInTitle(): string {
    const dayOfYear = Math.floor(
        (new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
    );
    return LOCKED_IN_TITLES[dayOfYear % LOCKED_IN_TITLES.length];
}