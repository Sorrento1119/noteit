// Curated and pronounceable 4-letter words
const WORDS_4 = [
  'wopl', 'krat', 'zefo', 'vlyn', 'mura', 'piko', 'flux', 'echo',
  'nova', 'brio', 'tide', 'zeno', 'luma', 'dune', 'blip', 'cozy',
  'glen', 'haze', 'iota', 'jive', 'kale', 'lynx', 'mesa', 'neon',
  'opal', 'pyre', 'quip', 'rune', 'surf', 'trek', 'urba', 'veil',
  'wisp', 'yarn', 'zest', 'arch', 'bolt', 'calm', 'dawn', 'epic',
  'glow', 'halo', 'iron', 'jade', 'kite', 'leaf', 'mint', 'nest',
  'peak', 'rust', 'sage', 'teal', 'volt', 'wave', 'zinc', 'axis',
  'byte', 'cyan', 'flow', 'grid', 'hype', 'jolt', 'knot', 'link',
  'myth', 'node', 'plot', 'sync', 'task', 'unit', 'vibe', 'apex',
  'beam', 'clover', 'drift', 'fable', 'glow', 'haze', 'iris', 'jump',
  'keen', 'lark', 'mist', 'nerd', 'onyx', 'pace', 'quiz', 'rift',
  'slot', 'tone', 'undo', 'vow', 'wrap', 'yarn', 'zeal', 'zoom',
  'aura', 'bree', 'cove', 'dell', 'elix', 'fern', 'gust', 'hive',
  'isle', 'juno', 'kelp', 'loom', 'moss', 'nova', 'orbs', 'plum'
].filter(w => w.length === 4);

const CONSONANTS = 'bcdfghjklmnprstvwxz'.split('');
const VOWELS = 'aeiou'.split('');

let lastGenerated = '';

export function generate4LetterWord(): string {
  let word = '';
  for (let attempt = 0; attempt < 10; attempt++) {
    // 50% chance curated, 50% chance generated pronounceable pattern (C-V-C-C or C-V-C-V)
    if (Math.random() < 0.5) {
      word = WORDS_4[Math.floor(Math.random() * WORDS_4.length)];
    } else {
      const c1 = CONSONANTS[Math.floor(Math.random() * CONSONANTS.length)];
      const v1 = VOWELS[Math.floor(Math.random() * VOWELS.length)];
      const c2 = CONSONANTS[Math.floor(Math.random() * CONSONANTS.length)];
      const endChar = Math.random() > 0.45
        ? CONSONANTS[Math.floor(Math.random() * CONSONANTS.length)]
        : VOWELS[Math.floor(Math.random() * VOWELS.length)];
      word = `${c1}${v1}${c2}${endChar}`;
    }
    if (word !== lastGenerated) {
      break;
    }
  }
  lastGenerated = word.toLowerCase();
  return lastGenerated;
}

export function cleanSlug(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9-_]/g, '').slice(0, 32);
}
