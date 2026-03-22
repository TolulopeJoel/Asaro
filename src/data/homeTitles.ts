const playful = [
    "The text won't read itself. 😏",
    "Plot twist: today hits different.",
    "Who let you show up this ready?",
    "Main character energy. Let's go.",
    "Fun fact: you're that one.",
    "Chaos? Nah. Clarity.",
    "You woke up curious. Good.",
    "Absolutely unhinged commitment. Respect.",
    "Today's forecast: you, thriving.",
    "Look who's back. 👀",
];

const calm = [
    "Breathe first. Then begin.",
    "One thing at a time.",
    "Still waters run deep.",
    "You don't have to rush this.",
    "Slow is smooth. Smooth is far.",
    "Root down, then rise.",
    "Be here. That's enough.",
    "Quiet strength is still strength.",
    "Peace is your starting point.",
    "Just begin. That's all.",
];

const warm = [
    "You showed up. That matters.",
    "Something here is for you today.",
    "Take your time. No rush.",
    "Growth looks good on you.",
    "You're right on time.",
    "You've come so far already.",
    "You matter more than you know.",
    "Your effort counts. Always.",
    "Keep going. You are loved.",
    "You brought yourself here. Good.",
];

const bold = [
    "Don't just read it. Let it land.",
    "Comfortable? Good. Now go deeper.",
    "The gap closes when you move.",
    "You didn't come this far to skim.",
    "Fear is just a feeling. Dig anyway.",
    "Build what they said you couldn't.",
    "What will you carry out today?",
    "Do it now. Regret nothing.",
    "The version of you that grows — be that.",
];

const hype = [
    "My superstar. 🌟",
    "There you are.",
    "You absolute legend.",
    "Look at you, showing up.",
    "That's my reader right there.",
    "You're doing so well. Seriously.",
    "Big moves start here.",
    "Today's hero: you.",
    "You're built different. For real.",
    "Go off. You've earned it.",
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