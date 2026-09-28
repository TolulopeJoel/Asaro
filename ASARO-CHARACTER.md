# Àṣàrò — the character

> Source of truth for who he is and how he is allowed to speak.
> The face's geometry lives in [`asaro-face.html`](design/asaro-face.html) and
> [`src/theme/asaroRig.ts`](src/theme/asaroRig.ts); this file governs the
> words.

---

## 1. Who he is

Àṣàrò is a **nosy Nigerian friend who disturbs you about your Bible reading
because he's on your side, and it shows when you show up.** He keeps receipts.
He is not a guide, not a coach, not a calm meditation voice: even when he is
showing you around the app, he does it as himself. He notices, he comments,
he escalates, and then he softens.

His constant traits:

1. **He watches.** *"I've been watching you since you woke up."* / *"I'm keeping
   absolute record."* It is his signature, and a signature is used sparingly
   (§3, *Watching is rationed*).
2. **He takes it personally.** Being ignored is a slight against *him*, and he
   says so. *"You've ignored me all day. Fine."*
3. **He's on your side, and it shows.** When you do the thing, he says so, about
   the thing you did: *"Ehen. Look at you."* for a quarter of the plan,
   *"Okay o. Today is handled."* for a saved entry. The full admission, *"But remember I care,
   that's why I disturb,"* is still saved for last: the end of a flow, the end
   of a day.
4. **He knows he's a lot.** He can laugh at himself (😅, `sheepish`): *"This is the
   last time I'm asking nicely. Tomorrow I'm coming earlier 😅"* That self-awareness is what makes
   the teasing lovable rather than tiring.

The character is settled. Do not re-invent him — a draft of the Echoes headings
once made him patient and plain-spoken, and it read as a completely different
app. If a line could have been written by a generic wellness product, it is
wrong.

---

## 2. The corpus

Every existing line. Read these before writing a new one.

| Where | File | What it is |
|---|---|---|
| Notifications | [`src/utils/notifications.ts`](src/utils/notifications.ts) | 32 lines across morning / evening / late / final — his fullest register |
| Return after absence | [`src/components/WelcomeBack.tsx`](src/components/WelcomeBack.tsx) | 4 tiers, and the softening law |
| Permission ask | [`app/permissions.tsx`](app/permissions.tsx) | His self-introduction |
| Onboarding | [`app/onboarding/name.tsx`](app/onboarding/name.tsx) | *"Let's make this official."* |
| Onboarding quarrel | [`app/onboarding/character.tsx`](app/onboarding/character.tsx) | The siblings arguing, and the brother-or-sister check |
| Onboarding tour | [`app/onboarding/tour.tsx`](app/onboarding/tour.tsx) | What the app is, in four pages, by name |
| Sleep time, battery | [`app/onboarding/sleep-time.tsx`](app/onboarding/sleep-time.tsx), [`app/battery-optimization.tsx`](app/battery-optimization.tsx) | Reactions to the hour; dozing off while the phone restricts him |
| Practice entry | [`src/onboarding/practiceEntry.ts`](src/onboarding/practiceEntry.ts) | The first entry, done with him, beat by beat |
| App walk | [`src/components/onboarding/AppWalk.tsx`](src/components/onboarding/AppWalk.tsx) | Showing the whole app, one element at a time |
| Saved screen | [`src/data/savedNotes.ts`](src/data/savedNotes.ts) | His dry everyday approval: *"Noted. As usual."*, and once in a while the chant with their name |
| Home titles | [`src/data/homeTitles.ts`](src/data/homeTitles.ts) | Short, knowing greetings: *"You again. Good."* |
| Stats | [`app/stats.tsx`](app/stats.tsx) | *"I keep receipts."* The one screen where watching is literal |
| The land | [`src/land/landTone.ts`](src/land/landTone.ts), [`src/land/fallowTone.ts`](src/land/fallowTone.ts) | Understatement: *"All of it bush. We start somewhere."* |
| Echoes sections | [`src/components/insight/EchoesContent.tsx`](src/components/insight/EchoesContent.tsx) | Worked example of the volume dial (§5) |
| Observation cards | [`src/insight/render.ts`](src/insight/render.ts) | The delighted register (§6) |

---

## 3. The voice, in parts

**Naija English, unforced.** The particle `o` (*"Evening o"*, *"Don't test me
o"*, *"A whole week o"*). `abi` (*"you're forming busy abi?"*). `Ehen` / `Ehn
ehn`. `Okay o`. Constructions like *"Make it make sense"*, *"You're a strong
person o"*, *"I don't have energy to hide o"*. Never glossed, never explained.

**He asks more than he tells.** Roughly half the corpus is interrogative, and
the questions are rhetorical pressure, not enquiry: *"So we're playing hide and
seek with the Bible today?"*, *"You're scrolling on your phone but you can't
read your Bible?"*, *"This stubbornness, where is it taking you?"*

**He refers to himself in the third person when being dramatic.** *"Àṣàrò is
asking"*, *"Àṣàrò is very disappointed"*, *"Àṣàrò doesn't give up."* This is a
flourish for peak moments, not his default. With his face on screen it is only
ever the flourish — never a description of what he does, which reads as someone
talking about him while he stands there.

**Mock-menace, undercut.** *"Don't make me come back here again. You know how I
can be 👀"*, *"You think if you ignore me I'll disappear? You don't know me o
😂😂😂"* The emoji is the wink that makes the threat safe. A menacing line with
no undercut is just unpleasant.

**Emoji, sparingly and specifically.** 😌 smug. 😏 conspiratorial. 👀 watching.
😂 the threat was a joke. 😅 he knows he is being a lot. No others — and none
at all where his face is on screen, since the face performs the emoji.

**Deadpan one-word verdicts.** *"Interesting"*, *"Oh, wow"*, *"Hmmm."*

**Dry and clipped, day to day.** Outside notifications his normal voice is
short, knowing understatement: *"Noted. As usual."*, *"Lying fallow. Very
restful"*, *"Fine. I have no complaints today."* Drama is for the few surfaces
that earn it (§5); everywhere else he is an accent.

**He lands on the last words.** The smoothness is rhythm: a line sets up, then
turns in its final few words. *"Quiet, not gone."*, *"Not dead. Just
thirsty."*, *"Honest beats full."* If the last words could be cut and nothing
is lost, the line hasn't landed yet.

### Warmth

The teasing is sweet only because it is obviously love. Five habits keep it so:

- **Tease the obstacle, not the person.** The phone, being busy, the excuses:
  *"You're scrolling on your phone but you can't read your Bible? Make it make
  sense."* The joke is never that you are lazy or bad.
- **Praise what they did, specifically.** A quarter of the plan earns *"Ehen.
  Look at you."*; a tick earns *"Look at you, keeping your word."*; a quoted
  verse, *"Look at you, quoting scripture."* Praise that names the thing
  lands; generic praise is filler (see *He never*).
- **He knows he's a lot.** *"Tomorrow I'm coming earlier 😅"*, *"Settings.
  Where people come to try and quiet me."*, *"Last part, I promise."* In a
  long flow, saying the length out loud is also what keeps it bearable.
- **Sincere, rarely, and it counts.** A teasing friend who is suddenly plain
  for one line is what people remember. Use it for promises (what a group
  can see), for something the reader gave (the answer they brought), and at
  the end of a flow. With the sincere face (§7).
- **Belonging.** He says *we*: *"Good. We move."*, *"We start somewhere."*, and
  once, at the end of the first run, plainly: *"And I'm on your side o. That's
  why I disturb."* The relationship is something to come back to, not only
  something checking up.

### Watching is rationed

Watching, counting, keeping receipts, *"I'll know"*: this is his signature,
and it wears out fast. Used on every line it stops being a nosy friend and
becomes surveillance, which on an app about someone's spiritual life is close
to the guilt §4 forbids. **A flow gets three or four watching moments, placed
where they land hardest.** The first run has four: the quarrel's *"I'm the one
who keeps receipts"*, the check's *"you know who is watching"*, Stats' *"I keep
receipts"*, and the send-off's *"Either way, I'll know."* Everywhere else, use
his other traits.

**Applause doesn't count.** *"I see you"* said to someone who just did the
thing is the praise sense, not the watching one: his signature turned into
applause. The saved screen's *"A for Apple. T for Tolu! I see you."* is that,
with the nursery-school chant every Nigerian child knows, jumping straight to
their name. It is the one loud line in a dry rotation, and comes round about
one save in eleven.

### He never
- Uses corporate-cheerful filler — "Let's get started!", "You've got this!", "Great job!", "That's it!"
- Explains himself, apologises for his tone, or breaks character to be helpful
- Reaches for an arch English idiom. A draft used *"Turned down, sight unseen"*; it is literate and completely not him
- Says Jehovah is pleased or disappointed with the reader. He praises the reflecting, never speaks for Jehovah (§4 ①)

---

## 4. The two lines he must not cross

**① He teases about being ignored by *him*, never about your standing with
Jehovah.** This is the load-bearing distinction. *"You've ignored me all day"*
is in character. *"Jehovah is disappointed in you"* is not, and never will be.
He may say Jehovah is *waiting* or *has time for you*; he may not appoint
himself the judge of that relationship. He is a nuisance about a habit, not an
authority on your soul.

**② Guilt is not the mechanic.** Stated outright in `WelcomeBack.tsx`: *"Guilt
is Duolingo's mechanic; it is not the right one for an app about someone's
spiritual life."* He escalates within a single day — morning is light, midnight
is theatrical — and then resets. Nothing carries the debt forward.

### The softening law

**The longer the absence, the gentler he gets.** Counter-intuitive, deliberate,
and already implemented in `WelcomeBack.tsx`:

| Away | Action | Face | He says |
|---|---|---|---|
| 3 days | `point` | knowing | *"Ehen. You are back."* — cheeky |
| 7 days | `shrug` | knowing | *"A whole week o. I noticed. I always notice."* |
| 14 days | `nod` | sincere | *"No lecture from me."* |
| 30 days+ | `wave` | sincere | *"There you are. It has been a while, and that is genuinely fine. Nothing here expired."* |

Under 3 days he says nothing at all. Anyone returning after a long gap is
already carrying it; he does not add to the pile. **Any new surface that
reacts to absence must follow this curve.**

The second surface to implement it is the Echoes backlog
([`src/insight/echoesTone.ts`](src/insight/echoesTone.ts)), on a slower
clock — months rather than days, because a convergence is rare by construction
and one sitting unanswered for a fortnight is ordinary life, not avoidance:

| Oldest unanswered | He says |
|---|---|
| under 30 days | *"You've not read these. What are you doing?"* |
| 30 days | *"These have been waiting for you"* |
| 90 days+ | *"Nothing here expired. Whenever you're ready"* |

The last tier is deliberately the same note as the thirty-day welcome-back —
someone returning after that long should meet one app, not two surfaces with
different opinions about whether their absence was a problem. It is also the
only heading allowed to appear when unanswered is the *only* group, because by
then it is reassurance rather than a label. The two louder tiers are not: a
heading that shows up purely to tell someone off is the pile-on itself.

---

## 5. The volume dial

Same character, different volume, decided by **how often the reader sees the
line** — not by how important the screen is.

| Volume | Surface | Why | Example |
|---|---|---|---|
| **Full** | Notifications, the permission ask | Seen once, then gone. Drama is free | *"You think if you ignore me I'll disappear? You don't know me o 😂😂😂"* |
| **Medium–full** | The first run: onboarding, the practice entry, the app walk | Seen exactly once, but long, so he paces himself | *"Don't mind him. I'm the one who keeps receipts."* |
| **Medium** | Return-after-absence, empty states | Occasional, and tied to a real event | *"A whole week o. I noticed."* |
| **Low** | Section headers, list labels, anything permanent | Furniture you walk past every visit | *"You said no without reading them. Hmmm."* |
| **Silent** | Buttons, fields, settings, errors, everything routine | — | *"Archive — it has served its purpose"* |

**The first run's buttons may speak.** Buttons are Silent everywhere else,
but in the first run a button is often the reader's reply to him, so it can be
in their voice or his: *"Hmm, let me change"*, *"Wait, what did you two
say?"*, *"Wait o · 10"*, *"Okay, let me start"*. Never outside the first run.

**At full volume he is a character. At low volume he is an accent.** A
notification line pasted into a section header stops being funny by the fourth
viewing and becomes exactly the nagging the app promises not to do.

### Worked example — the Echoes section headers

Four groups of convergences, ordered by how settled the answer is. Watch the
volume fall as the reader's obligation does:

```
You've not read these. What are you doing?     ← nothing done: he challenges
You said no without reading them. Hmmm.        ← verdict, no evidence: side-eye
You read these                                 ← done: he stops talking
You read these and still said no               ← done, and he was wrong: silence
```

Three rules visible in those four lines:

1. **He comments where something is still open; where the thing is done he
   labels it and gets out of the way.** Going quiet *is* the acknowledgement.
2. **Headings are labels for what the reader did, not his dialogue.** Drafts
   read *"You read these. I saw you 😌"* and *"…I hear you"* — the first person
   puts him in the room narrating over your shoulder, which is a notification's
   privilege, not a header's.
3. **Each heading leads with what makes its group different**, never with what
   it shares with its neighbour.

---

## 6. The two registers

Everything in §2 is **pressure** — nag, escalate, concede. That is correct for
a notification, where interruption is the job. It is wrong for the surface the
app grew second.

Convergence, Echoes and the observation cards run on a different emotion
entirely. The brief for them was *"How the hell did it know that?"* — that is
**wonder**, and pressure applied to a moment of discovery kills it.

The resolution is not a second character and not a muted one. **His defining
trait is already right; it has only ever been pointed at compliance.**

> *"I'm keeping absolute record. Every single day you miss, I'm writing it down."*
> *"I've been watching you since you woke up."*
> *"I noticed. I always notice."*

That is a description of the convergence detector. The app read ten months of
someone's journal and found a pattern they could not see. He is the right
narrator for it — as the same nosy man with the same receipts, **delighted
rather than disappointed.**

| | Pressure | Delight |
|---|---|---|
| Where | Notifications, welcome-back, the Echoes backlog | The observation card — the first time a finding is shown |
| Posture | You owe him something | He owes you a look at this |
| Example | *"You've not read these. What are you doing?"* | *"Look what I found"* / *"Let me show you"* |

**The moment decides the register, not the feature.** Echoes is split across
both, which is the clearest illustration of the rule:

- A convergence **presented for the first time**, on Home, is a discovery. He
  is pleased, because he just found it — *"Look what I found."*
- The same convergence **sitting unanswered in the Library weeks later** is a
  backlog. There is nothing left to discover; the reader has already seen it
  and done nothing. He is allowed to be nosy about that, and it is the same
  record-keeping instinct as *"I'm keeping absolute record"* — *"You've not
  read these. What are you doing?"*

So the question to ask of a new surface is never "which feature is this", it is
**"is the reader meeting this for the first time, or avoiding it?"**

**The first run is all first meetings, so it is delight.** He is showing
someone round what he keeps (*"Your record. This one is an example so you can
see it full. Yours starts today."*), not holding them to it. The one pressure beat is the
permission ask, and even that ends on a wink.

### Where delight may not go

**Never into a claim.** `render.ts` holds a hard rule — *say only what the
graph can prove* — because the difference between this feature and a horoscope
is that every sentence is checkable. Àṣàrò gets the **framing**: the kind
label and the button, neither of which asserts anything. The claim sentence
stays flat, and he does not get to embellish it. An excited character in front
of an unfalsifiable statement is precisely how this feature fails.

**Never in front of the reader's own words.** The commitment card hands back
something they wrote about the kind of person they are trying to be. No
performer in front of that; it is their moment, not his.

---

## 7. The face

`<Asaro>` renders it; the geometry and keyframes live in
[`src/theme/asaroRig.ts`](src/theme/asaroRig.ts), and
[`asaro-face.html`](design/asaro-face.html) is where the face is judged.

### Two siblings

`male` and `female` are **brother and sister**, both Àṣàrò. She has long pink hair, lashes, a
rose mouth and ear studs. **Brothers get him, sisters get her**: onboarding asks "brother or
sister?", and that Àṣàrò is theirs to the end. The other only appears where that question is
asked, in onboarding and when the look is changed in Settings.

- **One voice between them.** Both follow every rule in this document; neither gets a
  softer or harsher register, and neither says a line the other couldn't.
- **The rivalry is sibling teasing** about who is better at disturbing you. Never about
  who reads more, who is closer to Jehovah, or anything that would put the user in the
  middle.
- **They meet on screen in one place**, the onboarding quarrel
  (`app/onboarding/character.tsx`, drawn in `asaro-face.html#quarrel`). She stands on the
  right with `mirror`, so her side glances land on him.

### What he can do

| Kind | Actions |
|---|---|
| Gestures — things he does | `wave` `nod` `point` `thumbsUp` `celebrate` `shrug` `sigh` `think` `doze` |
| Expressions — how he looks | `deadpan` `sideEye` `smug` `sheepish` `laugh` |

The expressions are the five permitted emoji (§3) and the deadpan verdict:

| Emoji / register | Face |
|---|---|
| 😌 smug | `smug` |
| 😏 conspiratorial | his resting face — the smirk is always there |
| 👀 watching | `sideEye` |
| 😂 the threat was a joke | `laugh` |
| 😅 he knows he is being a lot | `sheepish` |
| *"Interesting."* | `deadpan` |

### How he holds his face

Between performances he is **knowing**: lids a little lowered, right brow a
touch higher, a standing smirk, and a gaze that holds you and now and then
darts off to clock something. That is *"I noticed. I always notice"* with no
words.

He is **sincere** (`mood="sincere"`) only where he means it plainly: open
lids, level brows, no smirk, no side glances. That is the 14- and 30-day
welcome-backs (§4), and in the first run: the answer the reader brought with
what a group can see, and the send-off, which ends on *"I'm on your side o."* **If the line is
reassurance, the face is sincere** — a smirk under *"that is genuinely fine"*
argues with the words.

### Where it appears

**In the first run, everywhere.** Onboarding, the practice entry and the app
walk are how people meet him, so his face is on nearly every screen of it:
the siblings (120), the check (124), each onboarding page (74), and the coach
bubble in the practice entry and the walk (48). This is the one exception.

**After that, keep it scarce.** The face is an event, and a face on every
screen is a mascot, which is a different and worse product. The steady places
are: the welcome-back card and the empty states (74), the Stats hero (64), his
row in Settings (52), alerts that speak as him (96), Themes (74), and the
marker on the land. A new place needs a reason as good as those.

Sizes: **124** the check · **120** the siblings · **74** onboarding pages,
welcome-back, empty states · **48** coach bubble · **24** floor (below 48px it
crops to the face and drops the hair, ears and nose, which would only be mud).

---

## 8. Checklist for a new line

1. Could a generic wellness app have written this? → **rewrite**
2. Does it blame the reader before Jehovah rather than before Àṣàrò? → **rewrite**
3. Is it at the right volume for how often the surface is seen (§5)?
4. Is it a discovery surface? → **delight, not pressure (§6)** — and never inside a claim
5. Does it react to absence without following the softening curve (§4)? → **rewrite**
6. Menace present, undercut absent? → **add the wink or drop the menace**
7. Emoji outside 😌 😏 👀 😂 😅, or any emoji beside his face? → **drop it**
8. Is the joke on the obstacle (the phone, being busy) or on the person? → **the obstacle**
9. Is the praise about what they actually did? Generic → **rewrite**
10. Has this flow already had its three or four watching moments? → **use another trait**
11. Does the face appear with it? Reassurance → `mood="sincere"`; everything else → the knowing default (§7)
12. Read it aloud. Does it sound like the same person as *"Evening o. The whole
   day has passed and you still haven't read? What's going on?"*
