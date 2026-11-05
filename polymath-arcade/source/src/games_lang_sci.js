/* =====================================================================
   English + Science: Word Scramble, Lexicon, Element Match, Science Snap
   ===================================================================== */
function maxTier(d) { return d <= 3 ? 1 : d <= 6 ? 2 : 3; }
function pickTiered(list, d, r, tierOf = x => x.t) {
  const top = maxTier(d);
  const exact = list.filter(x => tierOf(x) === top);
  if (exact.length && r.chance(0.6)) return r.pick(exact);
  return r.pick(list.filter(x => tierOf(x) <= top));
}

/* ---------- Word Scramble ---------- */
// [WORD, clue, tier, other real words from the same letters]
const WORDS = [
  ['BRAIN', 'The organ you think with', 1], ['MONEY', 'Coins and bills used to buy things', 1], ['PLANT', 'A living thing that makes food from sunlight', 1],
  ['ORBIT', 'The curved path of a moon around a planet', 1], ['GRAPH', 'A chart that shows data visually', 1], ['RATIO', 'A comparison of two amounts, like 3 to 1', 1],
  ['WATER', 'H₂O', 1], ['MUSIC', 'Sound arranged with rhythm and melody', 1], ['PIXEL', 'One tiny dot of color on a screen', 1],
  ['STOCK', 'A share of ownership in a company', 1], ['BONUS', 'An extra payment on top of regular pay', 1], ['PIANO', 'An instrument with 88 keys', 1],
  ['CHESS', 'Strategy game with kings, queens and pawns', 1], ['LOGIC', 'Reasoning step by step to a sound conclusion', 1], ['QUIZ', 'A short test of knowledge', 1],
  ['SOLID', 'State of matter with a fixed shape', 1], ['VALUE', 'What something is worth', 1], ['PRISM', 'Glass shape that splits light into colors', 1],
  ['FOCUS', 'To give all your attention to one thing', 1], ['TIGER', 'A large striped wild cat', 1], ['BYTE', 'A unit of data made of 8 bits', 1],
  ['DEBT', 'Money that you owe', 1], ['LOAN', 'Money borrowed that must be paid back', 1], ['GENE', 'A unit of heredity carried in DNA', 1],
  ['ATLAS', 'A book of maps', 1], ['COMET', 'An icy space object with a glowing tail', 1], ['WAGE', 'Pay for work, often by the hour', 1],
  ['PLANET', 'Mercury, Venus and Earth are examples', 2], ['BUDGET', 'A plan for spending and saving', 2], ['MARKET', 'Where buyers and sellers trade', 2],
  ['ENERGY', 'The ability to do work', 2], ['MAGNET', 'An object that attracts iron', 2], ['PUZZLE', 'A problem made to test your cleverness', 2],
  ['PROFIT', 'Revenue minus costs', 2], ['GRAVITY', 'The force that pulls objects toward each other', 2], ['BALANCE', 'The amount in an account, or a steady state', 2],
  ['CIRCUIT', 'A closed loop that electricity flows around', 2], ['PATTERN', 'Something that repeats in a predictable way', 2], ['ALGEBRA', 'Math that uses letters to stand for numbers', 2],
  ['SAVINGS', 'Money set aside for later', 2], ['OXYGEN', 'The gas we need to breathe, symbol O', 2], ['CLIMATE', 'The long-term weather pattern of a region', 2],
  ['NETWORK', 'A group of connected computers or people', 2], ['LIBRARY', 'A place to borrow books', 2], ['LIQUID', 'State of matter that flows and fills its container', 2],
  ['ROCKET', 'A vehicle pushed upward by hot exhaust', 2], ['INVEST', 'To put money in something hoping it grows', 2], ['DOLLAR', 'The currency of the United States', 2],
  ['VOLCANO', 'A mountain that can erupt lava', 2], ['PYTHON', 'A popular programming language, and a snake', 2], ['SYNTAX', 'The rules for how code or sentences are put together', 2],
  ['TARIFF', 'A tax on imported goods', 2], ['INCOME', 'Money you receive, such as your pay', 2], ['VERTEX', 'A corner point of a shape', 2],
  ['NEURON', 'A nerve cell in the brain', 2], ['FOSSIL', 'The preserved remains of ancient life in rock', 2], ['GALAXY', 'A huge system of stars, like the Milky Way', 2],
  ['PROTON', 'A positive particle in an atom’s nucleus', 2],
  ['ECONOMICS', 'The study of how people use scarce resources', 3], ['VELOCITY', 'Speed in a particular direction', 3], ['HYPOTHESIS', 'A testable prediction', 3],
  ['INFLATION', 'A general rise in prices over time', 3], ['MOMENTUM', 'Mass times velocity', 3], ['ALGORITHM', 'Step-by-step instructions for solving a problem', 3, ['LOGARITHM']],
  ['DIVIDEND', 'A share of company profits paid to shareholders', 3], ['PROTOTYPE', 'An early working model of a product', 3], ['VOCABULARY', 'All the words a person knows', 3],
  ['TELESCOPE', 'An instrument for seeing distant objects', 3], ['EQUATION', 'A statement that two expressions are equal', 3], ['PARAGRAPH', 'A group of sentences about one idea', 3],
  ['MOLECULE', 'Two or more atoms bonded together', 3], ['SATELLITE', 'An object that orbits a planet', 3], ['COMPOUND', 'Interest earned on interest, or a mix of bonded elements', 3],
  ['MONOPOLY', 'A market with only one seller', 3], ['ELECTRON', 'A negative particle in an atom', 3], ['FUNCTION', 'A reusable block of code', 3],
  ['VARIABLE', 'A named value that can change', 3], ['DATABASE', 'An organized collection of stored data', 3], ['BENCHMARK', 'A standard to measure against', 3],
  ['FRACTION', 'Part of a whole, like three quarters', 3], ['METAPHOR', 'Describing something as if it were something else', 3], ['QUOTIENT', 'The result of a division', 3],
  ['RECESSION', 'A period when the economy shrinks', 3], ['PORTFOLIO', 'A collection of investments', 3], ['AMBIGUOUS', 'Open to more than one meaning', 3],
  ['CATALYST', 'Speeds up a reaction without being used up', 3], ['ITERATION', 'One pass through a loop', 3], ['RESILIENT', 'Able to bounce back from setbacks', 3]
];
function flyLetter(fromRect, toEl, ch) {
  if (reduceMotion() || !fromRect || !toEl) return;
  const to = toEl.getBoundingClientRect();
  const f = h('div', { class: 'ws-fly', 'aria-hidden': 'true' }, ch);
  Object.assign(f.style, { left: fromRect.left + 'px', top: fromRect.top + 'px', width: fromRect.width + 'px', height: fromRect.height + 'px' });
  document.body.append(f);
  toEl.style.visibility = 'hidden';
  requestAnimationFrame(() => requestAnimationFrame(() => { f.style.transform = `translate(${to.left - fromRect.left}px, ${to.top - fromRect.top}px) scale(${to.width / fromRect.width}, ${to.height / fromRect.height})`; }));
  setTimeout(() => { f.remove(); toEl.style.visibility = ''; }, 360);
}
IMPL.scramble = {
  play(ctx) {
    const r = ctx.r, d = ctx.diff;
    const tiers = d <= 2 ? [1] : d <= 4 ? [1, 2, 2] : d <= 7 ? [2, 3] : [3];
    const used = new Set(), missed = [];
    let W = null, letters = [], picked = [], hintN = 0, hintsThis = 0, solved = 0, skipped = 0, score = 0, streak = 0, best = 0, busy = false;
    const clue = h('div', { class: 'ws-clue', 'aria-live': 'polite' });
    const slots = h('div', { class: 'ws-slots', role: 'group', 'aria-label': 'Your word' });
    const pool = h('div', { class: 'ws-letters', role: 'group', 'aria-label': 'Letters' });
    const msg = h('p', { class: 'msg', 'aria-live': 'polite' });
    ctx.body.append(h('div', { class: 'stack' }, h('div', { class: 'panel stack' }, clue, slots), pool, msg,
      h('div', { class: 'row center' }, h('button', { class: 'btn', type: 'button', onclick: shuffle }, 'Shuffle'), h('button', { class: 'btn', type: 'button', onclick: hint }, 'Hint (−40)'), h('button', { class: 'btn ghost', type: 'button', onclick: skip }, 'Skip'))));
    const mult = () => 1 + Math.min(Math.floor(streak / 2), 4) * 0.5;
    const say = (t, cls = '') => { msg.className = 'msg ' + cls; msg.innerHTML = t; };
    function pickWord() {
      const tier = r.pick(tiers);
      let cand = WORDS.filter(w => w[2] === tier && !used.has(w[0]));
      if (!cand.length) cand = WORDS.filter(w => !used.has(w[0]));
      if (!cand.length) { used.clear(); cand = WORDS; }
      const w = r.pick(cand); used.add(w[0]); return w;
    }
    function next() {
      W = pickWord();
      const word = W[0];
      let order; do { order = r.shuffle([...word]); } while (order.join('') === word);
      letters = order.map((ch, i) => ({ ch, id: i, used: false }));
      picked = []; hintN = 0; hintsThis = 0; busy = false;
      clue.innerHTML = `<small>Clue · ${word.length} letters</small><p>${esc(W[1])}</p>`;
      say(''); draw();
    }
    function draw(state) {
      slots.innerHTML = '';
      for (let k = 0; k < W[0].length; k++) {
        const id = picked[k];
        slots.append(h('button', { class: 'ws-slot' + (id != null ? ' filled' : '') + (k < hintN ? ' hint' : '') + (state === 'ok' ? ' ok' : ''), type: 'button', 'aria-label': id != null ? `Remove ${letters[id].ch}` : `Empty slot ${k + 1}`, onclick: () => unpick(k) }, id != null ? letters[id].ch : ''));
      }
      pool.innerHTML = '';
      letters.forEach(L => pool.append(h('button', { class: 'ws-letter' + (L.used ? ' used' : ''), type: 'button', 'aria-label': 'Letter ' + L.ch, tabindex: L.used ? '-1' : null, onclick: () => pick(L.id) }, L.ch)));
    }
    function pick(id) {
      if (busy || ctx.done) return;
      const L = letters[id];
      if (L.used || picked.length >= W[0].length) return;
      const from = pool.children[id] ? pool.children[id].getBoundingClientRect() : null;
      L.used = true; picked.push(id); SFX.click(); draw();
      flyLetter(from, slots.children[picked.length - 1], L.ch);
      if (picked.length === W[0].length) check();
    }
    function unpick(k) {
      if (busy || k < hintN || k >= picked.length) return;
      const [id] = picked.splice(k, 1); letters[id].used = false; draw();
    }
    function clearToHint() { picked.slice(hintN).forEach(id => { letters[id].used = false; }); picked = picked.slice(0, hintN); draw(); }
    function check() {
      const guess = picked.map(id => letters[id].ch).join('');
      if (guess === W[0]) {
        busy = true; solved++; streak++; best = Math.max(best, streak);
        const pts = Math.max(20, Math.round((100 + 20 * W[0].length - 40 * hintsThis) * mult()));
        score += pts; SFX.good(); draw('ok'); burstFrom(slots, cssVar('--good'), 34);
        say(`<b>${W[0]}</b> · +${pts}`, 'good');
        ctx.hud('score', 'Score', fmt(score)); ctx.hud('solved', 'Solved', String(solved)); ctx.hud('combo', 'Combo', '×' + mult(), mult() > 1 ? 'hot' : '');
        ctx.timeout(next, 750);
      } else if (W[3] && W[3].includes(guess)) {
        say(`${guess} is a real word, but not the one this clue describes.`, 'bad');
        ctx.timeout(clearToHint, 900);
      } else {
        SFX.bad(); streak = 0; slots.classList.add('shake'); ctx.timeout(() => slots.classList.remove('shake'), 400);
        say('Not quite. Try another order.', 'bad');
        ctx.hud('combo', 'Combo', '×1', '');
        ctx.timeout(clearToHint, 450);
      }
    }
    function hint() {
      if (busy || ctx.done) return;
      picked.forEach(id => { letters[id].used = false; }); picked = [];
      hintN = Math.min(W[0].length, hintN + 1); hintsThis++;
      for (let k = 0; k < hintN; k++) { const L = letters.find(x => !x.used && x.ch === W[0][k]); L.used = true; picked.push(L.id); }
      say(`Starts with “${W[0].slice(0, hintN)}”`);
      draw();
      if (picked.length === W[0].length) check();
    }
    function skip() {
      if (busy || ctx.done) return;
      busy = true; skipped++; streak = 0;
      missed.push({ q: esc(W[1]), a: W[0], why: '' });
      say(`The word was <span class="ws-reveal">${W[0]}</span>`);
      ctx.hud('combo', 'Combo', '×1', '');
      ctx.timeout(next, 1700);
    }
    function shuffle() {
      if (busy) return;
      const free = letters.filter(L => !L.used), order = r.shuffle(free.map(L => L.ch));
      free.forEach((L, i) => { L.ch = order[i]; });
      draw();
    }
    function end() {
      ctx.finish({
        score, stars: (solved >= 2) + (solved >= 5) + (solved >= 8), perf: Math.min(1, solved / 8), maxCombo: best, review: missed,
        summary: [['Words solved', String(solved)], ['Skipped', String(skipped)], ['Best streak', String(best)], ['Goal for 3★', '8 words']],
        lesson: 'Look for common chunks first: endings like -ION, -ITY and -ENT, and pairs like TH, CH and QU. Placing them shrinks the puzzle fast.'
      });
    }
    ctx.onKey(e => {
      if (/^[a-zA-Z]$/.test(e.key)) { const ch = e.key.toUpperCase(); const L = letters.find(x => !x.used && x.ch === ch); if (L) pick(L.id); return true; }
      if (e.key === 'Backspace') { if (picked.length > hintN) unpick(picked.length - 1); return true; }
      return false;
    });
    ctx.hud('score', 'Score', '0'); ctx.hud('solved', 'Solved', '0'); ctx.hud('combo', 'Combo', '×1');
    ctx.countdown(90, end);
    next();
  }
};

/* ---------- Lexicon ---------- */
const VOCAB = [
  ['candid', 'truthful and straightforward', 1], ['frugal', 'careful not to waste money', 1], ['vivid', 'producing strong, clear images in the mind', 1],
  ['reluctant', 'unwilling and hesitant', 1], ['diligent', 'hardworking and careful', 1], ['obsolete', 'no longer used; out of date', 1],
  ['concise', 'brief but complete', 1], ['resilient', 'able to recover quickly from setbacks', 1], ['meticulous', 'paying very close attention to detail', 1],
  ['skeptical', 'not easily convinced; doubtful', 1], ['lucrative', 'producing a lot of profit', 1], ['versatile', 'able to adapt to many different uses', 1],
  ['hostile', 'unfriendly and aggressive', 1], ['novice', 'a beginner', 1], ['abundant', 'existing in large amounts', 1], ['fragile', 'easily broken or damaged', 1],
  ['ubiquitous', 'found everywhere', 2], ['pragmatic', 'practical rather than idealistic', 2], ['mitigate', 'to make something less severe', 2],
  ['ephemeral', 'lasting a very short time', 2], ['eloquent', 'fluent and persuasive in speaking or writing', 2], ['tenacious', 'persistent; refusing to give up', 2],
  ['benevolent', 'kind and well-meaning', 2], ['scrutinize', 'to examine very closely', 2], ['alleviate', 'to make pain or a problem easier to bear', 2],
  ['verbose', 'using more words than needed', 2], ['lethargic', 'sluggish and lacking energy', 2], ['feasible', 'possible and practical to do', 2],
  ['inevitable', 'certain to happen', 2], ['prudent', 'acting with care and thought for the future', 2], ['arbitrary', 'based on random choice rather than reason', 2],
  ['empathy', 'the ability to understand and share another person’s feelings', 2], ['candor', 'openness and honesty in what you say', 2],
  ['obfuscate', 'to make something unclear on purpose', 3], ['sycophant', 'a person who flatters powerful people to gain favor', 3], ['laconic', 'using very few words', 3],
  ['perfunctory', 'done with minimal effort or care', 3], ['esoteric', 'understood by only a small group', 3], ['magnanimous', 'generous toward a rival or someone less powerful', 3],
  ['quixotic', 'idealistic in an unrealistic way', 3], ['juxtapose', 'to place side by side for contrast', 3], ['ostensible', 'appearing to be true, but not necessarily so', 3],
  ['pernicious', 'harmful in a gradual or hidden way', 3], ['recalcitrant', 'stubbornly uncooperative', 3], ['surreptitious', 'done secretly to avoid notice', 3],
  ['ameliorate', 'to make a bad situation better', 3], ['equivocate', 'to speak vaguely to avoid committing to anything', 3], ['serendipity', 'finding something good by happy chance', 3],
  ['anachronism', 'something that belongs to a different time period', 3], ['hubris', 'excessive pride or self-confidence', 3]
];
// s: sentence (___ marks the blank) or q: full question; c: [correct, ...wrong]; e: explanation; t: tier
const GRAMMAR = [
  { s: '___ going to love this movie.', c: ['They’re', 'Their', 'There'], e: '<b>They’re</b> is short for “they are.” <b>Their</b> shows ownership; <b>there</b> is a place.', t: 1 },
  { s: 'The company raised ___ prices.', c: ['its', 'it’s', 'its’'], e: '<b>Its</b> is possessive. <b>It’s</b> always means “it is” or “it has.”', t: 1 },
  { s: '___ phone is ringing?', c: ['Whose', 'Who’s'], e: '<b>Whose</b> shows ownership. <b>Who’s</b> means “who is.”', t: 1 },
  { s: 'You’re taller ___ your brother.', c: ['than', 'then'], e: '<b>Than</b> compares. <b>Then</b> is about time or order.', t: 1 },
  { s: 'Finish your homework, ___ you can play.', c: ['then', 'than'], e: '<b>Then</b> means “after that.”', t: 1 },
  { s: '___ going to do great!', c: ['You’re', 'Your'], e: '<b>You’re</b> means “you are.” <b>Your</b> shows ownership.', t: 1 },
  { s: 'I can’t wait to see ___ new car.', c: ['your', 'you’re'], e: '<b>Your</b> shows ownership: the car belongs to you.', t: 1 },
  { s: 'These jeans are too ___.', c: ['loose', 'lose'], e: '<b>Loose</b> means not tight. <b>Lose</b> means to misplace or fail to win.', t: 1 },
  { s: 'Try not to ___ your keys again.', c: ['lose', 'loose'], e: '<b>Lose</b> (one o) means to misplace.', t: 1 },
  { s: 'Can I ___ your pen for a minute?', c: ['borrow', 'lend'], e: 'You <b>borrow</b> from someone; they <b>lend</b> to you.', t: 1 },
  { s: 'My sister and ___ went to the game.', c: ['I', 'me', 'myself'], e: 'Drop “my sister and”: you would say “<b>I</b> went,” not “me went.”', t: 1 },
  { s: 'Can you give me some ___ about this?', c: ['advice', 'advise'], e: '<b>Advice</b> is the noun (the thing given). <b>Advise</b> is the verb.', t: 1 },
  { q: 'Which sentence is punctuated correctly?', c: ['Let’s eat, Grandma!', 'Let’s eat Grandma!'], e: 'The comma shows you are talking <i>to</i> Grandma. Commas save lives.', t: 1 },
  { q: 'Which sentence is correct?', c: ['I have two cats and a dog.', 'I have two cat’s and a dog.'], e: 'Plurals never take an apostrophe. Apostrophes show ownership or missing letters.', t: 1 },
  { s: 'The new rule will ___ every student.', c: ['affect', 'effect'], e: '<b>Affect</b> is usually the verb (to influence). <b>Effect</b> is usually the noun (the result).', t: 2 },
  { s: 'The new rule had a big ___ on sales.', c: ['effect', 'affect'], e: 'Here you need the noun, the result: <b>effect</b>.', t: 2 },
  { s: 'There are ___ cars on the road today.', c: ['fewer', 'less'], e: 'Use <b>fewer</b> for things you can count (cars) and <b>less</b> for amounts (traffic).', t: 2 },
  { s: 'I drink ___ coffee than I used to.', c: ['less', 'fewer'], e: 'Coffee is an amount, not a count, so <b>less</b>. (You’d drink fewer <i>cups</i>.)', t: 2 },
  { s: 'He gave the tickets to Sam and ___.', c: ['me', 'I', 'myself'], e: 'Drop “Sam and”: “he gave the tickets to <b>me</b>.”', t: 2 },
  { s: 'Each of the players ___ a locker.', c: ['has', 'have'], e: '<b>Each</b> is singular, so it takes <b>has</b>.', t: 2 },
  { s: 'Honesty is an important ___.', c: ['principle', 'principal'], e: 'A <b>principle</b> is a rule or belief. A <b>principal</b> is a school head or a main amount of money.', t: 2 },
  { s: 'I ___ studied harder for that test.', c: ['should have', 'should of'], e: '“Should of” is a mishearing of <b>should’ve</b>, which means should have.', t: 2 },
  { s: 'Everyone came to the party ___ Tom.', c: ['except', 'accept'], e: '<b>Except</b> means “but not.” <b>Accept</b> means to receive or agree.', t: 2 },
  { s: 'That scarf ___ your coat perfectly.', c: ['complements', 'compliments'], e: '<b>Complement</b> means to complete or go well with. A <b>compliment</b> is praise.', t: 2 },
  { s: 'The car stayed ___ at the red light.', c: ['stationary', 'stationery'], e: '<b>Stationary</b> means not moving. <b>Stationery</b> is paper and envelopes (think “e” for envelope).', t: 2 },
  { s: 'To ___ should I address the letter?', c: ['whom', 'who'], e: 'After a preposition (to), use <b>whom</b>. Test it: “to him,” so whom.', t: 3 },
  { s: '___ is calling at this hour?', c: ['Who', 'Whom'], e: 'The caller is the subject (“he is calling”), so <b>who</b>.', t: 3 },
  { s: 'If I ___ you, I would apologize.', c: ['were', 'was'], e: 'Hypotheticals take the subjunctive: “if I <b>were</b> you.”', t: 3 },
  { s: 'In formal writing: neither of the plans ___ perfect.', c: ['is', 'are'], e: 'In formal usage, <b>neither</b> is singular, so it takes <b>is</b>.', t: 3 },
  { s: 'Between you and ___, this plan won’t work.', c: ['me', 'I'], e: '<b>Between</b> is a preposition, so it takes the object pronoun <b>me</b>.', t: 3 },
  { s: 'She ___ down on the couch an hour ago.', c: ['lay', 'laid', 'lied'], e: 'The past tense of <b>lie</b> (to recline) is <b>lay</b>. <b>Laid</b> is the past of “lay” (to put something down).', t: 3 },
  { s: 'The ___ toys were all over the floor.', c: ['children’s', 'childrens’', 'childrens'], e: '<b>Children</b> is already plural, so add ’s: <b>children’s</b>.', t: 3 },
  { s: 'The two ___ offices share a lobby.', c: ['companies’', 'company’s', 'companys’'], e: 'For a plural ending in s, add just an apostrophe: <b>companies’</b>.', t: 3 },
  { q: 'Which sentence is correct?', c: ['It’s a beautiful day; let’s go outside.', 'It’s a beautiful day, let’s go outside.'], e: 'Joining two full sentences with only a comma is a comma splice. Use a semicolon or a period.', t: 3 }
];
// [correct, wrong, wrong, tier, memory tip]
const SPELL = [
  ['believe', 'beleive', 'belive', 1, 'Never be<b>lie</b>ve a lie.'], ['receive', 'recieve', 'receeve', 1, 'I before E, except after C.'], ['until', 'untill', 'untile', 1, 'Only one L at the end.'],
  ['tomorrow', 'tommorow', 'tommorrow', 1, 'One M, two Rs.'], ['beginning', 'begining', 'beggining', 1, 'Double the N before -ing.'], ['business', 'buisness', 'busness', 1, 'Busy becomes busi + ness.'],
  ['weird', 'wierd', 'weerd', 1, 'Weird is weird: it breaks the I-before-E rule.'], ['calendar', 'calender', 'calandar', 1, 'It ends in -ar.'], ['argument', 'arguement', 'argumant', 1, 'Argue drops its E: argu-ment.'],
  ['government', 'goverment', 'govermant', 1, 'Govern + ment.'], ['February', 'Febuary', 'Februrary', 1, 'Feb-<b>ru</b>-ary.'],
  ['definitely', 'definately', 'definitly', 2, 'It has <b>finite</b> inside: de-finite-ly.'], ['separate', 'seperate', 'seperete', 2, 'There’s <b>a rat</b> in sep-a-rat-e.'],
  ['necessary', 'neccessary', 'necesary', 2, 'One collar (C) and two sleeves (SS).'], ['embarrass', 'embarass', 'embarras', 2, 'Double R, double S.'],
  ['rhythm', 'rythm', 'rhythym', 2, 'Rhythm Helps Your Two Hips Move.'], ['recommend', 'reccommend', 'recomend', 2, 'One C, two Ms.'],
  ['restaurant', 'restaraunt', 'resturant', 2, 'Rest-au-rant.'], ['environment', 'enviroment', 'enviornment', 2, 'Keep the N: environ-ment.'],
  ['guarantee', 'garantee', 'guarentee', 2, 'Starts with GUA.'], ['achieve', 'acheive', 'achive', 2, 'I before E.'], ['schedule', 'schedual', 'scedule', 2, 'Ends in -dule.'],
  ['knowledge', 'knowlege', 'knowladge', 2, 'Know + ledge.'], ['occasionally', 'occasionaly', 'ocassionally', 2, 'Double C, single S, double L.'],
  ['publicly', 'publically', 'publicaly', 2, 'Just add -ly: public-ly.'], ['withhold', 'withold', 'whithold', 2, 'With + hold: two Hs.'],
  ['accommodate', 'accomodate', 'acommodate', 3, 'It’s big enough to accommodate two Cs and two Ms.'], ['occurrence', 'occurence', 'ocurrence', 3, 'Double C, double R, and -ence.'],
  ['conscience', 'concience', 'consciense', 3, 'Con + science.'], ['privilege', 'priviledge', 'privelege', 3, 'No D, and two Is before the E.'],
  ['millennium', 'millenium', 'milennium', 3, 'Two Ls and two Ns.'], ['maintenance', 'maintainance', 'maintenence', 3, 'Main-ten-ance.'],
  ['entrepreneur', 'entreprenuer', 'entrepeneur', 3, 'Entre-pre-neur.'], ['bureaucracy', 'beaurocracy', 'bureaucrasy', 3, 'Bureau + cracy.'],
  ['liaison', 'liason', 'liasion', 3, 'Two Is: li-ai-son.'], ['questionnaire', 'questionaire', 'questionnair', 3, 'Double N, and ends in -aire.'],
  ['conscientious', 'conscientous', 'consciencious', 3, 'Conscience + tious.'], ['mischievous', 'mischievious', 'mischevous', 3, 'Three syllables: MIS-chuh-vus.'],
  ['pronunciation', 'pronounciation', 'pronunsiation', 3, 'Pronounce loses its O: pro-nun-ciation.']
];
function lexGen(d, r) {
  const type = r.weighted([['vocab', 4], ['grammar', 3.5], ['spell', 2.5]]);
  if (type === 'vocab') {
    const w = pickTiered(VOCAB, d, r, x => x[2]);
    const same = VOCAB.filter(x => x !== w && Math.abs(x[2] - w[2]) <= 1);
    const others = r.sample(same, 3);
    if (r.chance(0.5)) return { kind: 'Vocabulary', q: `What does <b>${w[0]}</b> mean?`, choices: [w[1], ...others.map(o => o[1])], explain: `<b>${w[0]}</b>: ${w[1]}.`, key: 'v' + w[0], wide: true };
    return { kind: 'Vocabulary', q: `Which word means <b>“${w[1]}”</b>?`, choices: [w[0], ...others.map(o => o[0])], explain: `<b>${w[0]}</b>: ${w[1]}.`, key: 'v' + w[0] };
  }
  if (type === 'grammar') {
    const g = pickTiered(GRAMMAR, d, r);
    return { kind: 'Grammar', q: g.q || 'Fill in the blank: ' + g.s.replace('___', '<span class="blank"></span>'), choices: g.c, explain: g.e, key: 'g' + (g.q ? g.c[0] : g.s), wide: !!g.q };
  }
  const s = pickTiered(SPELL, d, r, x => x[3]);
  return { kind: 'Spelling', q: 'Which spelling is correct?', choices: [s[0], s[1], s[2]], explain: `<b>${s[0]}</b>. ${s[4]}`, key: 's' + s[0] };
}
QGEN.english = lexGen;
IMPL.lexicon = {
  play(ctx) {
    runQuiz(ctx, { mode: 'classic', count: 10, perQ: 30, gen: lexGen,
      lesson: 'Most grammar mix-ups have a quick test. Expand contractions (it’s → it is), drop the other person (“my sister and I” → “I”), and ask if you can count it (fewer) or not (less).' });
  }
};

/* ---------- Element Match ---------- */
// [symbol, name, atomic number, Latin origin]
const ELEMENTS = [
  ['H', 'Hydrogen', 1], ['He', 'Helium', 2], ['Li', 'Lithium', 3], ['Be', 'Beryllium', 4], ['B', 'Boron', 5], ['C', 'Carbon', 6], ['N', 'Nitrogen', 7], ['O', 'Oxygen', 8],
  ['F', 'Fluorine', 9], ['Ne', 'Neon', 10], ['Na', 'Sodium', 11, 'natrium'], ['Mg', 'Magnesium', 12], ['Al', 'Aluminum', 13], ['Si', 'Silicon', 14], ['P', 'Phosphorus', 15],
  ['S', 'Sulfur', 16], ['Cl', 'Chlorine', 17], ['Ar', 'Argon', 18], ['K', 'Potassium', 19, 'kalium'], ['Ca', 'Calcium', 20], ['Sc', 'Scandium', 21], ['Ti', 'Titanium', 22],
  ['V', 'Vanadium', 23], ['Cr', 'Chromium', 24], ['Mn', 'Manganese', 25], ['Fe', 'Iron', 26, 'ferrum'], ['Co', 'Cobalt', 27], ['Ni', 'Nickel', 28], ['Cu', 'Copper', 29, 'cuprum'],
  ['Zn', 'Zinc', 30], ['Ga', 'Gallium', 31], ['Ge', 'Germanium', 32], ['As', 'Arsenic', 33], ['Se', 'Selenium', 34], ['Br', 'Bromine', 35], ['Kr', 'Krypton', 36],
  ['Rb', 'Rubidium', 37], ['Sr', 'Strontium', 38], ['Y', 'Yttrium', 39], ['Zr', 'Zirconium', 40], ['Nb', 'Niobium', 41], ['Mo', 'Molybdenum', 42], ['Tc', 'Technetium', 43],
  ['Ru', 'Ruthenium', 44], ['Rh', 'Rhodium', 45], ['Pd', 'Palladium', 46], ['Ag', 'Silver', 47, 'argentum'], ['Cd', 'Cadmium', 48], ['In', 'Indium', 49], ['Sn', 'Tin', 50, 'stannum'],
  ['Sb', 'Antimony', 51, 'stibium'], ['Te', 'Tellurium', 52], ['I', 'Iodine', 53], ['Xe', 'Xenon', 54], ['Cs', 'Cesium', 55], ['Ba', 'Barium', 56],
  ['W', 'Tungsten', 74, 'wolfram (from German)'], ['Pt', 'Platinum', 78], ['Au', 'Gold', 79, 'aurum'], ['Hg', 'Mercury', 80, 'hydrargyrum'], ['Pb', 'Lead', 82, 'plumbum'],
  ['Rn', 'Radon', 86], ['Ra', 'Radium', 88], ['U', 'Uranium', 92], ['Pu', 'Plutonium', 94]
];
const ELEM_MID = ['Ag', 'Sn', 'I', 'Au', 'Hg', 'Pb', 'Pt', 'W', 'U'];
function elemGen(d, r) {
  const pool = d <= 3 ? ELEMENTS.filter(e => e[2] <= 20) : d <= 6 ? ELEMENTS.filter(e => e[2] <= 36 || ELEM_MID.includes(e[0])) : ELEMENTS;
  const e = r.pick(pool);
  const why = `${e[1]} is <b>${e[0]}</b>, atomic number ${e[2]}.` + (e[3] ? ` The symbol comes from its old name, <i>${e[3]}</i>.` : '');
  const short = e[3] ? `${e[0]} comes from ${e[3]}` : `${e[1]} = ${e[0]}`;
  if (r.chance(0.5)) {
    const tricky = pool.filter(x => x !== e && (x[0][0] === e[1][0] || x[0][0] === e[0][0]));
    const rest = pool.filter(x => x !== e && !tricky.includes(x));
    const wrong = r.sample(tricky, 2).concat(r.sample(rest, 3)).slice(0, 3);
    return { kind: 'Name → symbol', q: `What is the symbol for <b>${e[1]}</b>?`, choices: [e[0], ...wrong.map(x => x[0])], explain: why, short, key: 'n' + e[0] };
  }
  const tricky = pool.filter(x => x !== e && x[1][0] === e[0][0]);
  const rest = pool.filter(x => x !== e && !tricky.includes(x));
  const wrong = r.sample(tricky, 2).concat(r.sample(rest, 3)).slice(0, 3);
  return { kind: 'Symbol → name', q: `Which element has the symbol <b style="font-family:var(--font-display);font-size:30px">${e[0]}</b>?`, choices: [e[1], ...wrong.map(x => x[1])], explain: why, short, key: 's' + e[0] };
}
IMPL.elements = {
  play(ctx) {
    runQuiz(ctx, { mode: 'rush', time: 60, gen: elemGen, starsAt: [6, 12, 18],
      lesson: 'Symbols that don’t match the English name come from Latin or German: Na (natrium), K (kalium), Fe (ferrum), Ag (argentum), Au (aurum), Pb (plumbum) and W (wolfram).' });
  }
};

/* ---------- Science Snap ---------- */
const SCIENCE = [
  { q: 'Which gas do plants take in to make food by photosynthesis?', c: ['Carbon dioxide', 'Oxygen', 'Nitrogen', 'Hydrogen'], e: 'Plants combine carbon dioxide and water using light energy to make glucose, and release oxygen.', t: 1 },
  { q: 'Which part of a cell releases energy from food?', c: ['Mitochondria', 'Nucleus', 'Ribosome', 'Cell wall'], e: 'Mitochondria carry out cellular respiration, producing ATP, the cell’s energy currency.', t: 1 },
  { q: 'What shape is a DNA molecule?', c: ['A double helix', 'A single ring', 'A flat sheet', 'A triple cube'], e: 'Two strands twist around each other like a spiral ladder.', t: 1 },
  { q: 'What is the pH of pure water at 25 °C?', c: ['7', '0', '1', '14'], e: 'pH 7 is neutral. Lower is acidic, higher is basic.', t: 1 },
  { q: 'Which gas makes up most of Earth’s atmosphere?', c: ['Nitrogen', 'Oxygen', 'Carbon dioxide', 'Argon'], e: 'Air is about 78% nitrogen and 21% oxygen.', t: 1 },
  { q: 'Rock formed when magma or lava cools is called…', c: ['Igneous', 'Sedimentary', 'Metamorphic', 'Fossilized'], e: 'Igneous comes from the Latin for fire. Granite and basalt are examples.', t: 1 },
  { q: 'What is the chemical formula for table salt?', c: ['NaCl', 'KCl', 'NaOH', 'CaCO₃'], e: 'Table salt is sodium chloride: one sodium (Na) for each chlorine (Cl).', t: 1 },
  { q: 'Which blood cells fight infection?', c: ['White blood cells', 'Red blood cells', 'Platelets', 'Plasma'], e: 'White blood cells are the immune system’s defenders.', t: 1 },
  { q: 'What mainly causes ocean tides?', c: ['The Moon’s gravity', 'Wind', 'Underwater volcanoes', 'Earth’s magnetic field'], e: 'The Moon’s gravity pulls on the oceans. The Sun adds a smaller pull.', t: 1 },
  { q: 'Sound cannot travel through…', c: ['A vacuum', 'Water', 'Steel', 'Air'], e: 'Sound is a vibration passed between particles. Empty space has no particles to carry it.', t: 1 },
  { q: 'What is the largest planet in our solar system?', c: ['Jupiter', 'Saturn', 'Neptune', 'Earth'], e: 'Jupiter is more than twice as massive as all the other planets combined.', t: 1 },
  { q: 'Which planet is closest to the Sun?', c: ['Mercury', 'Venus', 'Mars', 'Earth'], e: 'Mercury orbits closest, about 58 million km from the Sun on average.', t: 1 },
  { q: 'Bats find food in the dark mainly by using…', c: ['Echolocation', 'Infrared vision', 'Magnetic sense', 'Taste'], e: 'Bats send out high-pitched calls and listen for the echoes.', t: 1 },
  { q: 'Which of these energy sources is NOT renewable?', c: ['Coal', 'Solar', 'Wind', 'Hydroelectric'], e: 'Coal formed over millions of years and is used up far faster than it forms.', t: 1 },
  { q: 'A light-year is a measure of…', c: ['Distance', 'Time', 'Brightness', 'Speed'], e: 'It is how far light travels in a year: about 9.46 trillion km.', t: 1 },
  { q: 'What is the hardest natural mineral?', c: ['Diamond', 'Quartz', 'Gold', 'Iron'], e: 'Diamond scores 10, the top of the Mohs hardness scale.', t: 1 },
  { q: 'Which particle has a negative charge?', c: ['Electron', 'Proton', 'Neutron', 'Nucleus'], e: 'Electrons are negative, protons positive, neutrons neutral.', t: 1 },
  { q: 'Which part of a plant cell carries out photosynthesis?', c: ['Chloroplast', 'Mitochondrion', 'Nucleus', 'Vacuole'], e: 'Chloroplasts contain chlorophyll, which captures light energy.', t: 1 },
  { q: 'What do red blood cells carry around the body?', c: ['Oxygen', 'Antibodies', 'Insulin', 'Platelets'], e: 'Hemoglobin inside red blood cells binds oxygen in the lungs and releases it in tissues.', t: 1 },
  { q: 'What does H₂O tell you about a water molecule?', c: ['2 hydrogen atoms and 1 oxygen atom', '2 oxygen atoms and 1 hydrogen atom', '2 molecules of hydrogen oxide', '1 hydrogen and 2 oxygen molecules'], e: 'The small 2 belongs to hydrogen: two H atoms bonded to one O atom.', t: 1 },
  { q: 'What causes Earth’s seasons?', c: ['The tilt of Earth’s axis', 'Earth’s changing distance from the Sun', 'The Moon’s orbit', 'Ocean currents'], e: 'Earth’s axis is tilted about 23.4°, so each hemisphere gets more direct sunlight for part of the year. Earth is actually closest to the Sun in early January.', t: 2 },
  { q: 'Why is the sky blue?', c: ['Air scatters blue light more than red', 'Sunlight is mostly blue', 'It reflects the oceans', 'Ozone is blue'], e: 'Shorter blue wavelengths scatter off air molecules much more than red ones (Rayleigh scattering).', t: 2 },
  { q: 'Why does water boil at a lower temperature on a high mountain?', c: ['The air pressure is lower', 'The air is colder', 'There is less oxygen', 'Sunlight is stronger'], e: 'Less pressure pushing down on the water lets it turn to vapor more easily.', t: 2 },
  { q: 'How many chromosomes are in a typical human body cell?', c: ['46', '23', '48', '64'], e: '46 chromosomes in 23 pairs: one set from each parent.', t: 2 },
  { q: 'Which organ makes insulin?', c: ['Pancreas', 'Liver', 'Kidneys', 'Stomach'], e: 'Insulin from the pancreas helps cells absorb sugar from the blood.', t: 2 },
  { q: 'Antibiotics work against which kind of germ?', c: ['Bacteria', 'Viruses', 'Both bacteria and viruses', 'Neither'], e: 'Antibiotics target bacteria. They don’t work on viruses like colds or the flu.', t: 2 },
  { q: 'What does a catalyst do?', c: ['Speeds up a reaction without being used up', 'Gets used up to make heat', 'Stops a reaction', 'Changes what the products are'], e: 'Enzymes in your body are biological catalysts.', t: 2 },
  { q: 'An element’s atomic number tells you its number of…', c: ['Protons', 'Neutrons', 'Outer-shell electrons', 'Isotopes'], e: 'Every atom of carbon has 6 protons; that is what makes it carbon.', t: 2 },
  { q: 'Which layer of Earth is liquid?', c: ['Outer core', 'Inner core', 'Mantle', 'Crust'], e: 'The outer core is molten iron and nickel. Its motion generates Earth’s magnetic field.', t: 2 },
  { q: 'What causes the phases of the Moon?', c: ['We see different amounts of its sunlit half as it orbits', 'Earth’s shadow covering part of it', 'Clouds blocking it', 'The Moon changing shape'], e: 'Half the Moon is always sunlit. Earth’s shadow only matters during a lunar eclipse.', t: 2 },
  { q: 'Absolute zero, the coldest possible temperature, is about…', c: ['−273 °C', '−100 °C', '0 °C', '−459 °C'], e: 'Absolute zero is −273.15 °C, which equals −459.67 °F.', t: 2 },
  { q: 'Which vitamin does your skin make in sunlight?', c: ['Vitamin D', 'Vitamin C', 'Vitamin A', 'Vitamin B12'], e: 'UVB light helps skin produce vitamin D, which supports bone health.', t: 2 },
  { q: 'In which process does one cell divide into two identical cells?', c: ['Mitosis', 'Meiosis', 'Osmosis', 'Photosynthesis'], e: 'Meiosis makes sex cells with half the chromosomes; mitosis makes identical copies.', t: 2 },
  { q: 'How do vaccines protect you?', c: ['They train your immune system to recognize a germ', 'They kill germs directly', 'They replace white blood cells', 'They work like antibiotics'], e: 'Your body builds memory cells, so it can respond fast to the real germ later.', t: 2 },
  { q: 'Mixing an acid with a base produces…', c: ['A salt and water', 'Only a gas', 'A stronger acid', 'Pure oxygen'], e: 'This is called neutralization.', t: 2 },
  { q: 'Where do most earthquakes happen?', c: ['Along tectonic plate boundaries', 'Near the equator', 'In deserts', 'At the poles'], e: 'Plates grinding, colliding or pulling apart release built-up stress as earthquakes.', t: 2 },
  { q: 'The Sun produces its energy through…', c: ['Nuclear fusion', 'Burning gas', 'Nuclear fission', 'Chemical batteries'], e: 'In the core, hydrogen nuclei fuse into helium, releasing huge amounts of energy.', t: 2 },
  { q: 'Which of these is a chemical change?', c: ['Burning wood', 'Melting ice', 'Breaking glass', 'Dissolving sugar in water'], e: 'Burning creates new substances (ash, carbon dioxide). The others change form, not substance.', t: 2 },
  { q: 'What is the closest star to Earth?', c: ['The Sun', 'Proxima Centauri', 'Sirius', 'Polaris'], e: 'Trick question: it’s the Sun. The next closest, Proxima Centauri, is about 4.2 light-years away.', t: 2 },
  { q: 'Which element is the most abundant in the universe?', c: ['Hydrogen', 'Helium', 'Oxygen', 'Carbon'], e: 'Roughly three quarters of the ordinary matter in the universe is hydrogen.', t: 2 },
  { q: 'Isotopes of the same element have different numbers of…', c: ['Neutrons', 'Protons', 'Electrons', 'Nuclei'], e: 'Carbon-12 and carbon-14 both have 6 protons, but 6 and 8 neutrons.', t: 3 },
  { q: 'What does DNA stand for?', c: ['Deoxyribonucleic acid', 'Dinitrogen acid', 'Deoxyribose nitrate', 'Dual nucleic acid'], e: 'Deoxyribonucleic acid carries genetic instructions in almost all living things.', t: 3 },
  { q: 'Which statement about evolution by natural selection is correct?', c: ['Traits that help survival and reproduction become more common over generations', 'Individuals change their genes to fit their environment', 'Animals evolve because they want to', 'Evolution always makes organisms bigger'], e: 'Populations evolve, not individuals: helpful inherited traits spread because their carriers leave more offspring.', t: 3 },
  { q: 'What is the main job of the ozone layer?', c: ['Absorbing harmful ultraviolet light', 'Trapping heat near the ground', 'Producing oxygen for breathing', 'Reflecting radio waves'], e: 'Ozone in the stratosphere absorbs most of the Sun’s UV-B and UV-C radiation.', t: 3 },
  { q: 'A ball is dropped and a ball is thrown sideways from the same height. Ignoring air, which lands first?', c: ['They land at the same time', 'The dropped ball', 'The thrown ball', 'It depends on their mass'], e: 'Sideways speed doesn’t change how fast gravity pulls a ball down, so both fall for the same time.', t: 3 }
];
function sciGen(d, r) { const it = pickTiered(SCIENCE, d, r); return { kind: 'Science', q: it.q, choices: it.c, explain: it.e, key: it.q }; }
QGEN.science = sciGen;
IMPL.science = {
  play(ctx) {
    runQuiz(ctx, { mode: 'classic', count: 10, perQ: 30, gen: sciGen,
      lesson: 'Good science answers explain a mechanism: not just what happens, but why. The seasons come from tilt, not distance, and tides from the Moon’s pull.' });
  }
};
