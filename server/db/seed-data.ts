type SeedUser = { key: string; displayName: string; role: 'student' | 'instructor' };
type SeedPost = { author: string; minutesAgo: number; text: string };
type SeedThread = SeedPost & { replies: SeedPost[] };
type SeedReading = {
  title: string;
  description: string;
  creator: string;
  minutesAgo: number;
  threads: SeedThread[];
};

const HOUR = 60;
const DAY = 24 * HOUR;

export const users: SeedUser[] = [
  { key: 'lee', displayName: 'Dr. Maya Lee', role: 'instructor' },
  { key: 'ortiz', displayName: 'Sam Ortiz', role: 'instructor' },
  { key: 'sarah', displayName: 'Sarah Kim', role: 'student' },
  { key: 'michael', displayName: 'Michael Reyes', role: 'student' },
  { key: 'priya', displayName: 'Priya Shah', role: 'student' },
  { key: 'jordan', displayName: 'Jordan Blake', role: 'student' },
  { key: 'aisha', displayName: 'Aisha Bello', role: 'student' },
  { key: 'tom', displayName: 'Tom Nguyen', role: 'student' },
  { key: 'lena', displayName: 'Lena Fischer', role: 'student' },
  { key: 'omar', displayName: 'Omar Haddad', role: 'student' },
  { key: 'grace', displayName: 'Grace Liu', role: 'student' },
  { key: 'diego', displayName: 'Diego Alvarez', role: 'student' },
  { key: 'hannah', displayName: 'Hannah Cohen', role: 'student' },
  { key: 'kofi', displayName: 'Kofi Mensah', role: 'student' },
];

export const readings: SeedReading[] = [
  {
    title: 'Supervised vs. unsupervised learning',
    description:
      'Chapter 3 of the course text. Focus on how labeled data changes what a model can learn, and when you would choose each approach.',
    creator: 'lee',
    minutesAgo: 4 * DAY,
    threads: [
      {
        author: 'michael',
        minutesAgo: 12,
        text: 'Does clustering count as unsupervised if we choose the number of clusters ourselves?',
        replies: [
          {
            author: 'priya',
            minutesAgo: 8,
            text: 'I think so. The number of clusters is a setting, not a label.',
          },
          {
            author: 'lee',
            minutesAgo: 5,
            text: 'Good question. We will look at how to choose it on Thursday.',
          },
        ],
      },
      {
        author: 'sarah',
        minutesAgo: 3 * HOUR,
        text: "What's the difference between supervised and unsupervised learning in practice? The definitions make sense, but I can't picture when I'd pick one over the other.",
        replies: [
          {
            author: 'jordan',
            minutesAgo: 2 * HOUR + 50,
            text: "If you have labels you trust, supervised. If you're exploring data nobody has labeled yet, unsupervised.",
          },
          {
            author: 'aisha',
            minutesAgo: 2 * HOUR + 30,
            text: 'Labels are expensive, though. The spam example only works because people mark emails as spam anyway.',
          },
          {
            author: 'sarah',
            minutesAgo: 2 * HOUR,
            text: 'That helps. So part of the choice is whether labels come for free.',
          },
          {
            author: 'ortiz',
            minutesAgo: HOUR + 40,
            text: 'Keep that idea in mind. Where labels come from is a big theme next week.',
          },
          {
            author: 'tom',
            minutesAgo: 40,
            text: 'Is semi-supervised learning just doing both?',
          },
          {
            author: 'priya',
            minutesAgo: 20,
            text: 'Roughly: a few labeled examples plus a lot of unlabeled ones.',
          },
        ],
      },
      {
        author: 'grace',
        minutesAgo: DAY,
        text: 'The cluster diagrams in this chapter look very tidy. Is real data ever that clean?',
        replies: [
          {
            author: 'omar',
            minutesAgo: 22 * HOUR,
            text: 'Not the data I worked with last summer. Half the clusters overlapped.',
          },
        ],
      },
      {
        author: 'diego',
        minutesAgo: 2 * DAY,
        text: 'The section on evaluation was the clearest part for me. Comparing against a held-out set finally clicked.',
        replies: [],
      },
    ],
  },
  {
    title: 'Attention is all you need',
    description:
      'Vaswani et al., 2017. Read sections 1 to 3 and skim the rest. Come ready to explain self-attention in your own words.',
    creator: 'lee',
    minutesAgo: 9 * DAY,
    threads: [
      {
        author: 'lena',
        minutesAgo: 3 * DAY,
        text: 'Why divide by the square root of the key dimension? It looks like a small detail, but the paper calls it out.',
        replies: [
          {
            author: 'kofi',
            minutesAgo: 3 * DAY - 2 * HOUR,
            text: 'Without it the dot products grow large, softmax saturates, and the gradients get tiny.',
          },
          {
            author: 'lee',
            minutesAgo: 2 * DAY,
            text: 'Exactly. Try a softmax over [10, 20, 30] and over [1, 2, 3] and compare the results.',
          },
        ],
      },
      {
        author: 'hannah',
        minutesAgo: 5 * DAY,
        text: "I didn't follow the positional encoding. Why sine and cosine?",
        replies: [
          {
            author: 'michael',
            minutesAgo: 5 * DAY - 3 * HOUR,
            text: 'So the model can work out relative positions. Shifting a position becomes a rotation of those values.',
          },
          {
            author: 'hannah',
            minutesAgo: 4 * DAY,
            text: 'That makes it much clearer, thanks.',
          },
        ],
      },
      {
        author: 'jordan',
        minutesAgo: 6 * DAY,
        text: 'Section 3 was much easier after drawing the attention weights for one short sentence by hand.',
        replies: [],
      },
    ],
  },
  {
    title: 'The extended mind',
    description:
      'Clark and Chalmers, 1998. Is a notebook part of someone’s mind? Read the whole paper and note where you disagree.',
    creator: 'ortiz',
    minutesAgo: 20 * DAY,
    threads: [
      {
        author: 'omar',
        minutesAgo: 15 * DAY,
        text: 'The notebook example convinced me until I thought about phones. Is my phone part of my mind?',
        replies: [
          {
            author: 'grace',
            minutesAgo: 14 * DAY,
            text: 'By their criteria it might be, if you trust it and always have it with you.',
          },
          {
            author: 'aisha',
            minutesAgo: 14 * DAY - 5 * HOUR,
            text: "But we don't automatically trust what's on our phones the way the notebook's owner trusts it.",
          },
          {
            author: 'ortiz',
            minutesAgo: 13 * DAY,
            text: 'Good push on the trust criterion. Bring this to section.',
          },
        ],
      },
      {
        author: 'tom',
        minutesAgo: 16 * DAY,
        text: 'The parity principle seems to do most of the work in the argument.',
        replies: [
          {
            author: 'lena',
            minutesAgo: 16 * DAY - 6 * HOUR,
            text: "Agreed, and it's the part critics push back on most.",
          },
        ],
      },
    ],
  },
  {
    title: 'Ethics of automated grading',
    description:
      'A short case study on using software to grade student essays. Read it before Monday and think about who should be accountable for a grade.',
    creator: 'ortiz',
    minutesAgo: 30,
    threads: [],
  },
];
