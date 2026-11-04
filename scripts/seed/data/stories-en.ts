import type { SeedStory } from "./types";

/** Original English seed stories. All people are fictional. */
export const storiesEn: SeedStory[] = [
  {
    author: "danawrites",
    title: "The heron knows something I don't",
    subtitle: "On standing still as a practice.",
    status: "published",
    daysAgo: 1,
    topics: ["nature", "writing"],
    body: `
There is a great blue heron that fishes the slough behind the community garden. I have watched it, on and off, for three winters. In that time I have never once seen it hurry.

It stands in the shallows on one leg, neck folded into an S, so still that dog walkers pass within ten feet and never notice it. Then, without any warning I can detect, the neck unfolds like a released spring and the bird comes up with a fish. Afterwards it goes back to standing, as if nothing happened.

## What patience looks like from outside

I used to think patience was a kind of waiting: putting up with time until the good part arrives. The heron has convinced me otherwise. It is not waiting for the fish. It is paying such complete attention to the water that the fish, when it comes, is simply the next thing that happens.

I tried it. I stood at the edge of the slough for twenty minutes with my hands in my pockets and my phone in the car. For the first five I made grocery lists in my head. For the next five I was cold and annoyed. Somewhere around minute twelve, something shifted. I noticed the way the wind roughened one patch of water and not another. I noticed a muskrat I had walked past a hundred times.

> Attention is the rarest and purest form of generosity. (Simone Weil)

## Taking it home

I don't stand at the slough every day. But when I sit down to write and the sentence won't come, I think of the heron: one leg, folded neck, the whole body listening. The sentence is not late. I am just not still enough yet to see it moving under the surface.
`,
  },
  {
    author: "danawrites",
    title: "Notes from a river that changed course",
    subtitle: "The map in my glove box is wrong now, and I keep it anyway.",
    status: "published",
    daysAgo: 22,
    topics: ["nature", "memory", "travel"],
    body: `
Two springs ago, after a week of rain on top of a heavy snowpack, the river I grew up beside left its bed. Not dramatically, at least not at first. It simply decided, over three nights, that it preferred a channel a quarter mile to the east.

The old riverbed is still there. It is a long, shallow trough of rounded stones, already filling in with cottonwood seedlings and blackberry. Kids ride bikes along it. If you didn't know, you would think it had always been a dry wash.

I knew. I learned to swim in a pool that is now a gravel bar. My father taught me to cast at a bend that no longer bends.

What surprised me was how quickly everything else adjusted. Within a season, kingfishers were nesting in the new cut bank. The heron moved downstream. The fishermen found new holes and argued about them in the same diner, in the same tones.

I keep an old paper map in my glove box, the kind gas stations used to sell. It shows the river where it used to be. I could replace it. I don't. Some maps are not for finding your way. They are for remembering that the way was once different, and that it was fine, and that the river did not ask anyone's permission.
`,
  },
  {
    author: "arjun_builds",
    title: "The bug was in the calendar",
    subtitle: "Time zones, daylight saving, and the week our app skipped a Sunday.",
    status: "published",
    daysAgo: 3,
    topics: ["technology", "work"],
    body: `
Every engineer has a bug that changes how they think. Mine arrived on a Monday morning in March, in the form of a support ticket that said, in its entirety: "Where did Sunday go?"

We make scheduling software for small clinics. A physical therapist in Arizona had opened her weekly view and found Saturday followed directly by Monday. Her Sunday appointments were still in the database. They just weren't on the screen.

## The cause

Our weekly view built its columns by taking the start of the week and adding twenty-four hours, seven times. That works on almost every week of the year. It does not work on the week the clocks change, when one day is only twenty-three hours long.

Arizona, mostly, does not observe daylight saving time. But our server did, and so did the browser of the person who wrote that code years ago. Somewhere between three systems that disagreed about what a day was, Sunday fell through the crack.

## The fix

The fix was small: build the week from calendar dates, not from hours. Ask "what is the date after this date?" instead of "what time is it twenty-four hours from now?" Store appointments with their own time zone instead of assuming the clinic's. Write a test for every daylight saving transition in every zone our customers live in.

- Days are not twenty-four hours long. Most are.
- "Local time" always means somebody's local time. Write down whose.
- The hardest bugs are hiding in assumptions so obvious nobody wrote them down.

## The lesson

The code took an afternoon. The lesson took longer. I now start every design review with one question: what are we assuming is always true? The answer is usually something about time.
`,
  },
  {
    author: "arjun_builds",
    title: "Write the boring version first",
    subtitle: "Clever code is a loan. The interest is paid by whoever reads it next.",
    status: "published",
    daysAgo: 17,
    topics: ["technology", "work", "writing"],
    body: `
When I review code from people early in their careers, the most common problem is not that it's wrong. It's that it's interesting.

Interesting code uses the newest language feature. It compresses four steps into one line. It anticipates requirements nobody has asked for yet. It is fun to write and miserable to read six months later, at eleven at night, when it is broken and you are the one on call.

So I give the same advice every time: write the boring version first. Name things plainly. Use loops where loops are clear. Handle the one case you actually have, and leave a comment where the second case would go.

This is also, I've noticed, good advice for writing prose. The first draft of a paragraph should say the thing as plainly as you can manage. You can make it beautiful later, once you know it's true.

Boring code is not lazy code. It's code that respects the next person. Usually, that next person is you.
`,
  },
  {
    author: "valecruz",
    title: "My mother's voicemails",
    subtitle: "She leaves them in Spanish. I save every one.",
    status: "published",
    daysAgo: 8,
    topics: ["family", "language", "migration"],
    body: `
My mother does not text. She tried, for about a month in 2019, and decided it was too cold. Instead she calls, and when I don't answer, she leaves a voicemail.

They are always in Spanish, always too long, and always begin the same way: "Hola, mi amor, soy yo, tu mamá," as if there could be any doubt. Then she tells me about the weather in Bogotá, which is always the same, and about my aunt's knee, which is always worse, and about something she saw on television that made her think of me.

I used to let them pile up. Forty, fifty unheard messages, the little red number climbing. I told myself I would listen when I had time, and I never had time.

Then my phone storage filled up and the carrier warned me that old voicemails would be deleted. I panicked in a way that surprised me. I spent a whole Saturday saving them, one by one, into a folder on my laptop named simply "Mamá."

Now I listen to every one, usually in the car. I don't always call back right away. But I hear her voice say "mi amor" on the highway in Texas, and for a minute I'm in a kitchen four thousand kilometers away, and the rain is starting, and someone is putting on coffee.

She is fine, by the way. Her knee is fine. My aunt's knee is worse.
`,
  },
  {
    author: "marcusbell",
    title: "What the bass player hears",
    subtitle: "Notes from the back of the bandstand.",
    status: "published",
    daysAgo: 5,
    topics: ["music", "work"],
    body: `
People ask what it's like to play bass, and I usually say it's like being the floor. Nobody looks at the floor. But if it disappears, everybody falls down.

From the back of the bandstand I hear things the audience doesn't. I hear the drummer rush half a beat when the room gets loud, and I lean back to slow him down without anyone noticing. I hear the piano player's left hand start to wander and I stay put, so she knows where home is. I hear the singer take a breath a little early and I give her an extra bar.

## Listening as the job

The best advice I ever got came from an old player at a Tuesday jam session on the South Side. I was nineteen and playing every note I knew. He waited until the break, walked over, and said, "Son, you're talking. I need you to listen."

It took me years to understand him. A bass line is not a solo spread thin. It's a conversation in which your main contribution is making the others sound good.

## The quiet payoff

There is a moment, maybe once a night if I'm lucky, when the whole band locks in and the room feels it. Conversations stop. Someone at the bar puts down a glass. Nobody is looking at me. That's how I know I did my job.
`,
  },
  {
    author: "marcusbell",
    title: "Teaching a twelve-year-old to swing",
    subtitle: "You can't explain it. You can only clap it until it lands.",
    status: "published",
    daysAgo: 28,
    topics: ["music", "family"],
    body: `
My nephew Theo came to me last summer wanting to learn jazz. He had been taking classical piano for five years and could read anything you put in front of him. He could not, to save his life, make it swing.

I tried explaining. Long-short, I said, like a heartbeat with a limp. He played it exactly, mathematically, and it sounded like a metronome in a tuxedo.

So we stopped playing. For two weeks we just listened to records and clapped on two and four. In the car, in the kitchen, at the grocery store. His mother thought we had lost our minds.

Around the third week, he started tapping his foot without being asked. Then he started laughing at the drummer on one record, not because anything was funny but because it felt good. That's when I knew.

When he sat back down at the piano, it wasn't perfect. But it leaned. It breathed. It sounded like a twelve-year-old who had figured out a secret and couldn't wait to tell somebody.
`,
  },
  {
    author: "ines_delgado",
    title: "A small defense of serif type on screens",
    subtitle: "The old rule said sans for screens. Screens changed; the rule didn't.",
    status: "published",
    daysAgo: 11,
    topics: ["design", "technology"],
    body: `
When I studied design, the rule was simple: serif fonts for print, sans serif for screens. Pixels were large and crude, and the delicate strokes of a serif turned into mush at small sizes. The rule made sense.

That was twenty years ago. The screen in your pocket now has more pixel density than most of the printing I learned on. The reason for the rule is gone, but the rule remains, repeated in style guides by people who never saw the screens it was written for.

## What serifs do

Serifs are not decoration. They help the eye track along a line, especially in long passages. They give each letter a slightly more distinct shape, which matters when you read for twenty minutes instead of glancing for two seconds. And they carry tone: a good serif feels patient, literary, like it expects you to stay.

## Where sans still wins

Interfaces, labels, buttons, and anything read at a glance still belong to sans serif. Clarity at tiny sizes and in quick bursts is what those faces do best. The answer is not to replace one with the other, but to let each do its job.

A reading platform should feel like a book when you're reading and like a tool when you're doing something else. Two typefaces, two jobs, one page.
`,
  },
  {
    author: "danawrites",
    title: "Untitled river piece",
    subtitle: "",
    status: "draft",
    daysAgo: 0,
    topics: ["nature"],
    body: `
Draft. Something about the sound the river makes under ice, and how my grandfather used to say it was "talking in its sleep." Need to find the ending.
`,
  },
  {
    author: "marcusbell",
    title: "The last set of the night",
    subtitle: "When the room is nearly empty, the music finally gets honest.",
    status: "published",
    daysAgo: 40,
    topics: ["music", "cities"],
    body: `
The last set starts after one in the morning. By then the couples on dates have gone home, the out-of-towners have caught their rides, and the bartender is wiping down the far end of the bar. What's left is a handful of regulars and the band.

This is when we play the tunes we actually love. Nobody requests anything. The tempos get slower and the solos get longer. The piano player tries a reharmonization she's been working on for a month. Sometimes it falls apart and we laugh and start over.

There's no money in the last set. Most nights there are more people on the bandstand than in front of it. But if you ever want to hear what musicians sound like when they're playing for each other, stay until close. Order something. Sit near the front. You'll hear the city talking to itself after everyone else has gone to sleep.
`,
  },
];
