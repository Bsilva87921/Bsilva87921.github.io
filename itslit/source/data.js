/* ---------- ItsLit content: the Library, emblems, sample Gazette letters ---------- */
const EMBLEMS = {
  quill:'M50 6C34 10 21 25 17 45L14 58M50 6C47 22 37 36 21 43M50 6C41 13 31 22 24 34M14 58l-3 3',
  bolt:'M37 5L17 35H31L24 59L48 25H34L41 5Z',
  key:'M8 32a10 10 0 1 0 20 0a10 10 0 1 0-20 0M28 32H57M48 32v9M55 32v6',
  candle:'M22 57h20M27 57V30h10v27M32 30v-4M32 26c-6-5-4-12 0-17c4 5 6 12 0 17Z',
  chain:'M11 45a6 6 0 0 1 0-8l10-10a6 6 0 0 1 8 8L19 45a6 6 0 0 1-8 0ZM53 19a6 6 0 0 1 0 8L43 37a6 6 0 0 1-8-8l10-10a6 6 0 0 1 8 0ZM30 37l-3 5M34 33l5-1M33 40l1 5',
  flame:'M32 58c-10 0-16-7-16-16c0-10 8-14 10-24c6 6 4 12 8 14c2-4 2-8 1-12c8 6 13 14 13 22c0 9-6 16-16 16Z',
  tree:'M20 58c4-10 6-20 4-30M24 28c6-6 14-8 24-6M23 36c6-2 12-2 18 2M24 22c4-6 10-10 18-10M8 58h48M42 30h14M46 38h12',
  whale:'M32 54V34M32 34C26 24 14 22 6 26C14 30 22 34 32 34C42 34 50 30 58 26C50 22 38 24 32 34ZM18 60c4-2 8-2 12 0s8 2 12 0',
  clock:'M12 32a20 20 0 1 0 40 0a20 20 0 1 0-40 0M32 32L17 41M32 32L21 34M32 14v3M32 50v-3M14 32h3M50 32h-3',
  teacup:'M13 27h31v7a15.5 15.5 0 0 1-31 0ZM44 30h4a5 5 0 0 1 0 10h-6M9 55h42M22 19c0-4 4-4 4-8M32 19c0-4 4-4 4-8',
  cross:'M32 7v50M19 21h26M27 7h10M27 57h10',
  stars:'M20 11Q20 20 29 20Q20 20 20 29Q20 20 11 20Q20 20 20 11ZM44 11Q44 20 53 20Q44 20 44 29Q44 20 35 20Q44 20 44 11ZM20 35Q20 44 29 44Q20 44 20 53Q20 44 11 44Q20 44 20 35ZM44 35Q44 44 53 44Q44 44 44 53Q44 44 35 44Q44 44 44 35Z',
  flask:'M26 7h12M28 7v15L15 48a6 6 0 0 0 5 9h24a6 6 0 0 0 5-9L36 22V7M19 40h26M29 49a2 2 0 1 0 0.1 0M38 45a1.5 1.5 0 1 0 0.1 0',
  frame:'M12 7h40v50H12ZM18 13h28v38H18ZM12 7l6 6M52 7l-6 6M12 57l6-6M52 57l-6-6M32 24a5 5 0 1 0 0.1 0M24 46c1-7 5-10 8-10s7 3 8 10',
  glass:'M12 26a13 13 0 1 0 26 0a13 13 0 1 0-26 0M34 35l18 18M48 49l6 6',
  bat:'M32 30c-3-6-7-6-8-2c-6-8-16-8-20 0c6 0 9 3 10 8c3-3 7-3 9 1c2-3 6-3 9 0c3-3 7-3 9-1c1-5 4-8 10-8c-4-8-14-8-20 0c-1-4-5-4-8 2ZM29 26l1-4l2 3l2-3l1 4',
  beetle:'M32 13a5 5 0 1 0 0.1 0M22 37a10 14 0 1 0 20 0a10 14 0 1 0-20 0M32 23v28M22 31l-8-4M22 39h-9M23 46l-7 5M42 31l8-4M42 39h9M41 46l7 5M29 9l-4-5M35 9l4-5',
  light:'M32 30v26M25 56h14M27 20h10v10H27ZM32 14v-4M22 18l-4-3M42 18l4-3M20 26h-6M44 26h6',
  ship:'M9 40h46l-7 10H16ZM32 40V9M32 11l15 21H32M32 15L19 32h13M6 57c4-3 8-3 12 0s8 3 12 0s8-3 12 0s8 3 12 0',
  rose:'M32 13a9 9 0 1 0 0.1 0M32 14c-4 3-4 8 0 9c4-1 4-6 0-9M24 22c0 8 4 12 8 12s8-4 8-12M32 34v23M32 46c-5-5-10-5-13-2c3 5 9 5 13 2'
};

const BOOKS = [
{id:'the-odyssey',t:'The Odyssey',st:'The Odyssey',a:'Homer',sur:'Homer',y:-700,yr:'c. 700 BCE',era:'Ancient Greece',pages:416,lvl:2,spine:'#1E4F55',em:'ship',g:1727,
 mood:['epic','adventure'],set:['sea','ancient'],
 line:'A war hero spends ten years trying to get home, and every island on the way wants to eat, enchant or keep him.',
 why:'It is the original road-trip story: monsters, temptation, a disguise reveal and a homecoming fight. Nolan\'s 2026 film sent a whole new crowd back to it.',
 parts:[
  {h:'Books 1 to 4: The son',s:'Odysseus has been gone for twenty years. At home in Ithaca, suitors are eating his house bare and pressing his wife Penelope to remarry, so his son Telemachus sets out to find news of his father.'},
  {h:'Books 5 to 12: The tales',s:'Freed from the nymph Calypso, Odysseus washes up among the Phaeacians and tells his story: the Cyclops, the witch Circe, a visit to the dead, the Sirens, and the twin terrors of Scylla and Charybdis.'},
  {h:'Books 13 to 20: The beggar',s:'Home at last but disguised as an old beggar, Odysseus tests who is still loyal: his swineherd, his son, his old nurse, and Penelope herself.'},
  {h:'Books 21 to 24: The bow',s:'Penelope sets a challenge: whoever can string Odysseus\'s great bow and shoot through twelve axe-heads may marry her. Only one man can.'}],
 end:'Odysseus strings the bow, reveals himself and, with Telemachus, kills the suitors. Penelope tests him with a secret only her husband would know, the bed built around a living olive tree, and the goddess Athena finally imposes peace on Ithaca.',
 chars:[['Odysseus','Clever, boastful, and very hard to kill'],['Penelope','Outwits a hall full of suitors for years'],['Telemachus','A boy learning to become a man'],['Athena','The goddess who keeps rescuing him']],
 themes:['Home','Cunning versus strength','Loyalty','Hospitality'],
 q:'Tell me, O Muse, of that ingenious hero who travelled far and wide after he had sacked the famous town of Troy.',qs:'Book I (Samuel Butler translation)',
 note:'Battle violence, mostly in the final books.',pair:['the-count-of-monte-cristo','moby-dick']},

{id:'romeo-and-juliet',t:'Romeo and Juliet',st:'Romeo & Juliet',a:'William Shakespeare',sur:'Shakespeare',y:1597,yr:'1597',era:'Renaissance England',pages:160,lvl:2,spine:'#6B1E2E',em:'rose',g:1513,
 mood:['romance'],set:['city','ballroom'],
 line:'Two teenagers from feuding families fall in love in a single night, and the adults around them make every choice worse.',
 why:'Juliet is not yet fourteen, and the whole romance lasts about four days. It is less a love story than a warning about haste, pride and adults who will not listen.',
 parts:[
  {h:'Act 1: The party',s:'Another street brawl between the Montagues and the Capulets. Romeo, lovesick over someone else, crashes the Capulet feast and falls for Juliet before learning whose daughter she is.'},
  {h:'Act 2: The balcony',s:'Under her window they trade vows, and by the next day Friar Laurence has secretly married them, hoping the match will end the feud.'},
  {h:'Act 3: The duel',s:'Juliet\'s cousin Tybalt kills Romeo\'s friend Mercutio, and Romeo kills Tybalt in revenge. He is banished, and Juliet\'s father orders her to marry Paris.'},
  {h:'Acts 4 and 5: The plan',s:'The Friar gives Juliet a potion to fake her death, but the message explaining the plan never reaches Romeo.'}],
 end:'Romeo hears Juliet is dead, buys poison and dies beside her in the tomb. Juliet wakes, finds him and stabs herself. Their grieving fathers finally make peace over their children\'s bodies.',
 chars:[['Romeo','Falls in love fast and hard, every time'],['Juliet','Sharper and braver than anyone around her'],['Mercutio','Romeo\'s friend, the funniest man in Verona'],['Friar Laurence','Means well; plans badly']],
 themes:['Love and haste','Family feuds','Fate','Youth versus age'],
 q:'What\'s in a name? That which we call a rose by any other name would smell as sweet.',qs:'Act 2, Scene 2',
 note:'Tragic deaths, including suicide.',pair:['pride-and-prejudice','wuthering-heights']},

{id:'pride-and-prejudice',t:'Pride and Prejudice',st:'Pride & Prejudice',a:'Jane Austen',sur:'Austen',y:1813,yr:'1813',era:'Regency England',pages:432,lvl:2,spine:'#7A2236',em:'quill',g:1342,
 mood:['romance','wit'],set:['ballroom','country'],
 line:'A sharp-tongued young woman and a proud rich man misjudge each other badly, then slowly learn they were both wrong.',
 why:'It is the blueprint for the enemies-to-lovers romance, and the jokes still land. Austen is funnier than her reputation, and Elizabeth Bennet is the original main character.',
 parts:[
  {h:'Volume I: First impressions',s:'Five unmarried Bennet sisters and a mother desperate to marry them off. At a country ball, the wealthy Mr Darcy snubs Elizabeth, and she decides he is the proudest man alive.'},
  {h:'Volume II: The proposal',s:'Charming Mr Wickham tells Elizabeth that Darcy ruined him. Then Darcy proposes, insultingly, and she refuses him to his face. His letter the next day changes everything she thought she knew.'},
  {h:'Volume III: The reckoning',s:'Visiting Darcy\'s estate, Elizabeth sees a kinder man. Then her youngest sister Lydia runs off with Wickham, and the family faces ruin.'}],
 end:'Darcy quietly pays Wickham to marry Lydia and saves the family\'s name. When Elizabeth learns what he did, she accepts his second proposal, and her sister Jane marries Mr Bingley.',
 chars:[['Elizabeth Bennet','Quick, proud of her judgement, often wrong'],['Mr Darcy','Rich, reserved, terrible at first impressions'],['Jane Bennet','The kind sister who thinks well of everyone'],['Mr Wickham','Charming, and not to be trusted']],
 themes:['First impressions','Class and money','Marriage','Changing your mind'],
 q:'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',qs:'Chapter 1',
 note:'None. A comedy of manners.',pair:['jane-eyre','little-women']},

{id:'frankenstein',t:'Frankenstein',st:'Frankenstein',a:'Mary Shelley',sur:'Shelley',y:1818,yr:'1818',era:'Regency England',pages:280,lvl:2,spine:'#24402F',em:'bolt',g:84,
 mood:['gothic','ideas'],set:['castle','wild'],
 line:'A young scientist builds a living being, abandons it in horror, and spends the rest of his life paying for it.',
 why:'Mary Shelley began it at 18, in a ghost-story contest. Two centuries later it is the story we reach for whenever someone builds something they cannot control, AI included.',
 parts:[
  {h:'The letters',s:'An Arctic explorer, Robert Walton, rescues a half-frozen man from the ice. The stranger, Victor Frankenstein, decides to tell him a warning story.'},
  {h:'Victor\'s tale',s:'Obsessed with the secret of life, Victor assembles a creature and brings it to life, then flees from what he has made. His little brother is murdered soon after, and an innocent servant is hanged for it.'},
  {h:'The creature\'s tale',s:'On a glacier, the creature speaks. He taught himself to read, longed for friendship, and was rejected by everyone. He demands Victor build him a companion.'},
  {h:'The pursuit',s:'Victor agrees, then destroys the second creature. The creature swears revenge on everyone Victor loves.'}],
 end:'The creature kills Victor\'s friend Clerval and his bride Elizabeth on their wedding night. Victor chases him to the Arctic and dies on Walton\'s ship. The creature mourns over his maker and vanishes into the ice to die.',
 chars:[['Victor Frankenstein','Brilliant, obsessive, never takes responsibility'],['The creature','Eloquent and abandoned; misery made him cruel'],['Elizabeth','Raised alongside Victor, then his bride'],['Robert Walton','An explorer who may be making Victor\'s mistake']],
 themes:['Responsibility','Ambition','Loneliness','Who is the monster?'],
 q:'I was benevolent and good; misery made me a fiend.',qs:'The creature, Volume II',
 note:'Murders, mostly off the page.',pair:['dracula','jekyll-and-hyde']},

{id:'a-christmas-carol',t:'A Christmas Carol',st:'A Christmas Carol',a:'Charles Dickens',sur:'Dickens',y:1843,yr:'1843',era:'Victorian London',pages:104,lvl:1,spine:'#2C4A2A',em:'candle',g:46,
 mood:['gothic','wit'],set:['city'],
 line:'A miser is visited by four ghosts in one night and gets the rarest gift in fiction: a second chance.',
 why:'It is short enough for one cosy evening and spookier than you remember. Every redemption arc since owes it something, and it is this December\'s Salon read.',
 parts:[
  {h:'Stave One: Marley\'s ghost',s:'On Christmas Eve, the miser Ebenezer Scrooge refuses charity and sneers at his cheerful nephew. That night, the ghost of his dead partner Marley appears, dragging a chain he forged in life.'},
  {h:'Staves Two and Three: Past and present',s:'The first spirit shows Scrooge the lonely boy and the hopeful young man he used to be. The second shows him the poor but loving Cratchit family, and the sickly Tiny Tim.'},
  {h:'Stave Four: Yet to come',s:'A silent, hooded spirit shows Scrooge a death that nobody mourns, and an empty chair at the Cratchits\' table.'}],
 end:'Scrooge wakes on Christmas morning a changed man. He sends a prize turkey to the Cratchits, raises Bob\'s salary, becomes a second father to Tiny Tim, who does not die, and keeps Christmas well for the rest of his life.',
 chars:[['Ebenezer Scrooge','The grumpiest man in London, for now'],['Bob Cratchit','Scrooge\'s underpaid, ever-patient clerk'],['Tiny Tim','Small, ill, and the heart of the book'],['Jacob Marley','A ghost with a very heavy chain']],
 themes:['Second chances','Generosity','Memory','Poverty'],
 q:'I will honour Christmas in my heart, and try to keep it all the year.',qs:'Stave Four',
 note:'Mild ghostly scares.',pair:['great-expectations','jekyll-and-hyde']},

{id:'the-count-of-monte-cristo',t:'The Count of Monte Cristo',st:'Monte Cristo',a:'Alexandre Dumas',sur:'Dumas',y:1844,yr:'1844 to 1846',era:'19th-century France',pages:1276,lvl:2,spine:'#1C2A4A',em:'key',g:1184,
 mood:['revenge','adventure','romance'],set:['sea','city','castle'],
 line:'A young sailor is framed by jealous friends, escapes prison fourteen years later with a treasure map, and comes back as someone else.',
 why:'It is the greatest revenge plot ever written, published in instalments like a show you cannot stop bingeing. Long, yes, but it moves.',
 parts:[
  {h:'The betrayal',s:'On the day of his engagement, Edmond Dantès is arrested on a false charge cooked up by jealous rivals and sealed by an ambitious prosecutor, then buried in the island fortress of the Château d\'If.'},
  {h:'The prison',s:'A fellow prisoner, the Abbé Faria, tunnels into his cell, educates him and tells him where a vast treasure is hidden. When Faria dies, Edmond escapes in his burial sack.'},
  {h:'The Count',s:'Years later, the mysterious and fabulously rich Count of Monte Cristo arrives in Paris society, charming the very men who ruined Edmond.'},
  {h:'The reckoning',s:'One by one, the Count turns each enemy\'s own crimes against him. But his revenge begins to hurt the innocent too.'}],
 end:'Fernand is exposed and takes his own life, Danglars is bankrupted, and Villefort goes mad. Shaken by the harm his vengeance caused, the Count spares Danglars, rewards his friends and sails away with Haydée, leaving a message: wait and hope.',
 chars:[['Edmond Dantès','The sailor who becomes the Count'],['Mercédès','His lost fiancée, married to his enemy'],['Abbé Faria','The prisoner-teacher who changes everything'],['Fernand, Danglars, Villefort','Three men with a debt to pay']],
 themes:['Revenge','Justice','Hope','Reinvention'],
 q:'All human wisdom is contained in these two words, "Wait and hope."',qs:'Final chapter (1846 English translation)',
 note:'Violence, poisoning, a suicide.',pair:['the-odyssey','great-expectations']},

{id:'narrative-of-frederick-douglass',t:'Narrative of the Life of Frederick Douglass',st:'Douglass: Narrative',a:'Frederick Douglass',sur:'Douglass',y:1845,yr:'1845',era:'19th-century America',pages:128,lvl:2,spine:'#3A2A1E',em:'chain',g:23,
 mood:['ideas'],set:['country','city'],
 line:'A man born into slavery teaches himself to read, fights back, escapes, and writes the book that made him one of the most powerful voices in America.',
 why:'It is a true story, under 130 pages, and still one of the most direct arguments ever made about freedom, literacy and courage.',
 parts:[
  {h:'Childhood',s:'Douglass is separated from his mother as a baby and grows up on a Maryland plantation, witnessing brutal violence against the people around him.'},
  {h:'Learning to read',s:'Sent to Baltimore, he is taught the alphabet until his enslaver forbids it. He realises reading is the path to freedom and secretly teaches himself.'},
  {h:'The turning point',s:'Hired out to Edward Covey, a notorious "slave-breaker", Douglass is worked and beaten to exhaustion, until the day he fights back.'}],
 end:'Douglass escapes to the North in 1838, marries Anna Murray and settles in Massachusetts. He begins speaking against slavery and becomes a leading abolitionist; he deliberately leaves out how he escaped, to protect others still trying.',
 chars:[['Frederick Douglass','Author, narrator, self-taught and unbreakable'],['Sophia Auld','Teaches him letters, then is taught to stop'],['Edward Covey','The man Douglass finally stands up to'],['Anna Murray','A free woman who helps him and marries him']],
 themes:['Freedom','Literacy as power','Resistance','Truth-telling'],
 q:'You have seen how a man was made a slave; you shall see how a slave was made a man.',qs:'Chapter X',
 note:'Depicts slavery, whipping and murder.',pair:['crime-and-punishment','little-women']},

{id:'jane-eyre',t:'Jane Eyre',st:'Jane Eyre',a:'Charlotte Brontë',sur:'Brontë',y:1847,yr:'1847',era:'Victorian England',pages:532,lvl:2,spine:'#4B2340',em:'flame',g:1260,
 mood:['romance','gothic','coming-of-age'],set:['moor','country'],
 line:'A plain, poor, fiercely independent governess falls for her moody employer, then discovers what is locked in his attic.',
 why:'Jane refuses to be anyone\'s possession, in 1847. It has a gothic mystery, a slow-burn romance and a heroine who chooses self-respect over everything.',
 parts:[
  {h:'Gateshead and Lowood',s:'Orphaned Jane is bullied by her aunt, then sent to a cruel charity school where her best friend Helen dies. She survives, studies, and becomes a teacher.'},
  {h:'Thornfield',s:'As governess at Thornfield Hall, Jane meets its brooding master, Mr Rochester. Strange laughter echoes at night, a fire starts in his bed, and the two fall in love.'},
  {h:'The wedding',s:'At the altar, a stranger stops the ceremony: Rochester is already married. His wife Bertha, mentally ill, is kept locked in the attic. Jane flees with nothing.'},
  {h:'Moor House',s:'Starving on the moors, Jane is taken in by the Rivers family, finds she has relatives and an inheritance, and is pressed to marry her cold cousin St John.'}],
 end:'Jane hears Rochester calling her name and returns to find Thornfield burned down. Bertha died in the fire she set, and Rochester is blinded and maimed. Jane, now independent, marries him by choice. "Reader, I married him."',
 chars:[['Jane Eyre','Small, plain, unbreakable'],['Edward Rochester','Charismatic, secretive, sorry'],['Bertha Mason','The wife in the attic'],['St John Rivers','A cold saint who wants Jane as a missionary wife']],
 themes:['Independence','Self-respect','Love and equality','Secrets'],
 q:'I am no bird; and no net ensnares me: I am a free human being with an independent will.',qs:'Chapter 23',
 note:'Child cruelty, a death from illness, mental illness depicted in Victorian terms.',pair:['wuthering-heights','pride-and-prejudice']},

{id:'wuthering-heights',t:'Wuthering Heights',st:'Wuthering Heights',a:'Emily Brontë',sur:'Brontë',y:1847,yr:'1847',era:'Victorian England',pages:416,lvl:3,spine:'#2F3A2A',em:'tree',g:768,
 mood:['romance','gothic','revenge'],set:['moor'],
 line:'Two soulmates on the wild Yorkshire moors choose wrong, and their obsession poisons two families for two generations.',
 why:'Fennell\'s 2026 film made it the book everyone argued about. It is not a sweet romance; it is a revenge story about love that turns to cruelty, and that is the point.',
 parts:[
  {h:'The visitor',s:'A tenant named Lockwood stays at the grim farmhouse Wuthering Heights, meets its savage owner Heathcliff, and is haunted by a ghost at the window. The housekeeper Nelly begins to explain.'},
  {h:'Catherine and Heathcliff',s:'Heathcliff, a foundling, grows up wild alongside Catherine Earnshaw. They are soulmates, but Catherine marries refined Edgar Linton for status. Heathcliff overhears part of it and vanishes.'},
  {h:'The return',s:'Heathcliff comes back rich and bent on revenge. He marries Edgar\'s sister to hurt him, and Catherine, torn between the two men, falls ill.'},
  {h:'The next generation',s:'After Catherine dies, Heathcliff turns his cruelty on the children: his own son, Hindley\'s son Hareton, and Catherine\'s daughter Cathy.'}],
 end:'Heathcliff loses his appetite for revenge, sees Catherine everywhere, and dies longing to join her. Young Cathy and Hareton fall in love, she teaches him to read, and the cycle is broken. Locals say the two ghosts walk the moors together.',
 chars:[['Heathcliff','A wronged boy who becomes a tyrant'],['Catherine Earnshaw','Wild, proud, torn in two'],['Nelly Dean','The housekeeper telling the story, not neutrally'],['Edgar Linton','Gentle, wealthy, never Heathcliff']],
 themes:['Obsessive love','Revenge','Class','Nature versus civilisation'],
 q:'Whatever our souls are made of, his and mine are the same.',qs:'Catherine, Chapter 9',
 note:'Domestic cruelty and abuse, a violent household.',pair:['jane-eyre','romeo-and-juliet']},

{id:'moby-dick',t:'Moby-Dick',st:'Moby-Dick',a:'Herman Melville',sur:'Melville',y:1851,yr:'1851',era:'19th-century America',pages:635,lvl:3,spine:'#22364F',em:'whale',g:2701,
 mood:['adventure','ideas','epic'],set:['sea'],
 line:'A one-legged captain drags his whole crew around the world to hunt the white whale that took his leg.',
 why:'Part thriller, part encyclopedia, part philosophy podcast. Skim the whale-science chapters if you like; Ahab\'s obsession is worth the voyage.',
 parts:[
  {h:'Call me Ishmael',s:'A restless young man signs on to the whaling ship Pequod out of Nantucket, after sharing a bed and a friendship with the harpooner Queequeg.'},
  {h:'The captain',s:'Captain Ahab finally appears and reveals the real mission: to hunt Moby Dick, the white whale that bit off his leg. He nails a gold coin to the mast for the man who spots him.'},
  {h:'The voyage',s:'Across oceans the crew hunt other whales, meet other ships, and Ishmael explains everything there is to know about whales, while the first mate Starbuck begs Ahab to turn back.'}],
 end:'After a three-day chase, Moby Dick destroys the boats and rams the Pequod. Ahab is dragged under by his own harpoon line, and the ship sinks with all hands. Only Ishmael survives, floating on Queequeg\'s coffin.',
 chars:[['Ishmael','Narrator, survivor, curious about everything'],['Captain Ahab','Obsession with a peg leg'],['Queequeg','Harpooner and true friend'],['Starbuck','The sensible first mate nobody listens to']],
 themes:['Obsession','Nature\'s power','Fate','Friendship'],
 q:'Call me Ishmael.',qs:'Chapter 1',
 note:'Whaling violence, a shipwreck.',pair:['the-odyssey','frankenstein']},

{id:'great-expectations',t:'Great Expectations',st:'Great Expectations',a:'Charles Dickens',sur:'Dickens',y:1861,yr:'1861',era:'Victorian England',pages:544,lvl:2,spine:'#5A3A1A',em:'clock',g:1400,
 mood:['coming-of-age','mystery','wit'],set:['city','country'],
 line:'A poor orphan receives a fortune from a secret benefactor, becomes a snob in London, and learns who really made him.',
 why:'It has a jilted bride who stopped every clock, a convict in the marshes and a twist about where the money came from. It is also about becoming embarrassed by the people who love you.',
 parts:[
  {h:'Part 1: The marshes',s:'Young Pip helps an escaped convict on the Kent marshes. He is summoned to play at the house of Miss Havisham, who stopped her clocks when she was jilted, and falls for her cold ward Estella.'},
  {h:'Part 2: London',s:'An anonymous benefactor gives Pip "great expectations". He moves to London to become a gentleman, sure Miss Havisham is behind it, and grows ashamed of his loyal brother-in-law Joe.'},
  {h:'Part 3: The truth',s:'The convict, Magwitch, returns: he is the benefactor. Pip must hide him from the law while the secrets of Estella\'s birth come out.'}],
 end:'Magwitch is caught and dies in prison, and his fortune is forfeited. Pip falls ill, is nursed by Joe, and works abroad to pay his debts. Years later he meets a softened Estella in the ruins of Miss Havisham\'s house, and they leave together.',
 chars:[['Pip','Ambitious, guilty, good underneath'],['Estella','Raised to break hearts'],['Miss Havisham','Still in her wedding dress, decades later'],['Joe Gargery','Kind, simple, the best man in the book']],
 themes:['Ambition and class','Guilt','Loyalty','Who makes us'],
 q:'I have been bent and broken, but, I hope, into a better shape.',qs:'Estella, Chapter 59',
 note:'Child abuse, a fire, prison.',pair:['a-christmas-carol','the-count-of-monte-cristo']},

{id:'alices-adventures-in-wonderland',t:'Alice\'s Adventures in Wonderland',st:'Alice in Wonderland',a:'Lewis Carroll',sur:'Carroll',y:1865,yr:'1865',era:'Victorian England',pages:96,lvl:1,spine:'#2A5A7A',em:'teacup',g:11,
 mood:['wit','adventure'],set:['dream'],
 line:'A bored girl follows a rabbit down a hole into a world where logic is upside down and everyone is rude.',
 why:'It is short, funny and stranger than any film version. Every page plays with words, and the nonsense hides sharp jokes about grown-ups and rules.',
 parts:[
  {h:'Down the rabbit hole',s:'Alice falls into Wonderland, shrinks and grows with every cake and bottle, and nearly drowns in her own tears.'},
  {h:'The strange creatures',s:'She meets a hookah-smoking Caterpillar, a pig-baby, the grinning Cheshire Cat and the Mad Hatter\'s endless tea party.'},
  {h:'The Queen\'s court',s:'In the Queen of Hearts\' garden, croquet is played with flamingos and everyone is threatened with beheading. Then the Knave of Hearts is put on trial for stealing tarts.'}],
 end:'At the absurd trial, Alice grows to full size and calls the court "nothing but a pack of cards". The cards fly at her, and she wakes on the riverbank beside her sister. It was all a dream.',
 chars:[['Alice','Curious, polite, increasingly fed up'],['The White Rabbit','Always late'],['The Cheshire Cat','A grin with opinions'],['The Queen of Hearts','Off with their heads']],
 themes:['Growing up','Nonsense and logic','Identity','Rules'],
 q:'Curiouser and curiouser!',qs:'Chapter 2',
 note:'None. Mild peril.',pair:['the-metamorphosis','a-christmas-carol']},

{id:'crime-and-punishment',t:'Crime and Punishment',st:'Crime & Punishment',a:'Fyodor Dostoevsky',sur:'Dostoevsky',y:1866,yr:'1866',era:'19th-century Russia',pages:545,lvl:3,spine:'#3D1F28',em:'cross',g:2554,
 mood:['ideas','mystery'],set:['city'],
 line:'A broke ex-student commits murder to prove he is extraordinary, then falls apart under the weight of what he has done.',
 why:'It is a psychological thriller told from inside the killer\'s head, with a detective who plays mind games. If White Nights got you into Dostoevsky, this is the next step.',
 parts:[
  {h:'The crime',s:'In a stifling St Petersburg summer, Raskolnikov convinces himself a great man may break the law for a greater good. He kills a pawnbroker with an axe, and her sister who walks in.'},
  {h:'The fever',s:'He falls ill, nearly confesses a dozen times, and meets Sonya, a young woman forced into prostitution to feed her family, who is gentle and deeply religious.'},
  {h:'The cat and mouse',s:'The investigator Porfiry Petrovich suspects him and slowly tightens the net with friendly conversations that are anything but.'}],
 end:'Raskolnikov confesses to Sonya, then to the police. He is sentenced to eight years in Siberia, and Sonya follows him there. At last, he begins to feel love and the hope of a new life.',
 chars:[['Raskolnikov','Brilliant, proud, unravelling'],['Sonya Marmeladova','Gentle, poor, morally unshakeable'],['Porfiry Petrovich','A detective who plays the long game'],['Dunya','Raskolnikov\'s fiercely loyal sister']],
 themes:['Guilt','Pride','Redemption','Poverty'],
 q:'Pain and suffering are always inevitable for a large intelligence and a deep heart.',qs:'Part III, Chapter 5 (Constance Garnett translation)',
 note:'Axe murders, poverty and sex work depicted.',pair:['narrative-of-frederick-douglass','the-picture-of-dorian-gray']},

{id:'little-women',t:'Little Women',st:'Little Women',a:'Louisa May Alcott',sur:'Alcott',y:1868,yr:'1868 to 1869',era:'19th-century America',pages:759,lvl:1,spine:'#5E3A52',em:'stars',g:514,
 mood:['coming-of-age','romance'],set:['country'],
 line:'Four sisters grow up during the American Civil War, chasing very different dreams of what a good life looks like.',
 why:'It is cosy and heartbreaking at once. Jo March, the writer who will not fit the mould, is one of fiction\'s great heroines.',
 parts:[
  {h:'Growing up',s:'With their father away at war, Meg, Jo, Beth and Amy March face poverty, squabbles and small triumphs, and befriend Laurie, the lonely boy next door.'},
  {h:'Leaving home',s:'The sisters grow into women. Meg marries, Amy travels to Europe, Jo moves to New York to write, and Beth grows weaker.'},
  {h:'Loss',s:'Jo comes home to nurse Beth through her last illness, and the family learns to carry on.'}],
 end:'Jo turns down Laurie, who later marries Amy. Jo marries Professor Bhaer, an older German teacher who respects her writing, and they open a school. The family gathers, older and changed, at the harvest.',
 chars:[['Jo March','Writer, tomboy, temper to match'],['Meg March','The eldest, longs for a gentle life'],['Beth March','Shy, musical, the family\'s heart'],['Amy March','Artistic, ambitious, underrated']],
 themes:['Sisterhood','Ambition','Women\'s choices','Growing up'],
 q:'I\'m not afraid of storms, for I\'m learning how to sail my ship.',qs:'Amy, Part 2',
 note:'A death from illness.',pair:['pride-and-prejudice','jane-eyre']},

{id:'jekyll-and-hyde',t:'Strange Case of Dr Jekyll and Mr Hyde',st:'Jekyll & Hyde',a:'Robert Louis Stevenson',sur:'Stevenson',y:1886,yr:'1886',era:'Victorian London',pages:92,lvl:1,spine:'#201B1E',em:'flask',g:43,
 mood:['gothic','mystery'],set:['city'],
 line:'A respected doctor\'s friends cannot understand why he protects a brutal little man named Hyde, until the truth comes out.',
 why:'You know the twist, but the book is a tight, foggy detective story you can finish in an afternoon, and it is darker than the memes.',
 parts:[
  {h:'The door',s:'The lawyer Utterson hears of a sinister man, Edward Hyde, who trampled a child and paid her family off with a cheque signed by the respected Dr Jekyll.'},
  {h:'The murder',s:'Hyde beats a member of Parliament to death in the street. Jekyll swears he is done with Hyde, but his behaviour grows stranger.'},
  {h:'The locked room',s:'Jekyll locks himself in his laboratory. His servant, terrified, fetches Utterson, and they break down the door.'}],
 end:'They find Hyde dead in Jekyll\'s clothes. Jekyll\'s confession explains it all: a potion split him into his darker self, and Hyde grew stronger until Jekyll could not change back. Hyde was Jekyll all along.',
 chars:[['Dr Henry Jekyll','Respectable on the outside'],['Edward Hyde','Small, brutal, gleeful'],['Gabriel Utterson','The lawyer who follows the clues'],['Dr Lanyon','A friend who sees too much']],
 themes:['Two selves','Respectability','Science','Secrets'],
 q:'Man is not truly one, but truly two.',qs:'Henry Jekyll\'s full statement',
 note:'Violent assaults, a murder.',pair:['frankenstein','the-picture-of-dorian-gray']},

{id:'the-picture-of-dorian-gray',t:'The Picture of Dorian Gray',st:'Dorian Gray',a:'Oscar Wilde',sur:'Wilde',y:1890,yr:'1890',era:'Victorian London',pages:254,lvl:2,spine:'#4A3A10',em:'frame',g:174,
 mood:['gothic','wit','ideas'],set:['city','ballroom'],
 line:'A beautiful young man wishes his portrait would age instead of him, and gets his wish.',
 why:'It is the original "never age, never pay" story, packed with Wilde\'s quotable lines. The aesthetic is gorgeous; the moral is brutal.',
 parts:[
  {h:'The portrait',s:'The painter Basil Hallward finishes a portrait of the dazzling Dorian Gray. The witty, cynical Lord Henry tells Dorian that youth is all that matters, and Dorian wishes the picture could grow old instead.'},
  {h:'The first cruelty',s:'Dorian falls for the actress Sibyl Vane, then dumps her cruelly. She takes her own life, and Dorian notices a new sneer on the face in the portrait.'},
  {h:'The double life',s:'For years Dorian stays young and beautiful while he lives in secret vice. The portrait, hidden in a locked room, grows hideous.'}],
 end:'Dorian murders Basil when the painter sees the portrait. Tormented, he stabs the canvas to destroy it. His servants find the portrait restored to its original beauty, and on the floor a withered, ugly old man with a knife in his heart.',
 chars:[['Dorian Gray','Beautiful, then rotten'],['Lord Henry Wotton','The cleverest, worst influence in London'],['Basil Hallward','The painter who loved him'],['Sibyl Vane','A young actress Dorian destroys']],
 themes:['Beauty and youth','Influence','Conscience','Art'],
 q:'The only way to get rid of a temptation is to yield to it.',qs:'Lord Henry, Chapter 2',
 note:'A suicide, a murder, drug use alluded to.',pair:['jekyll-and-hyde','the-great-gatsby']},

{id:'the-adventures-of-sherlock-holmes',t:'The Adventures of Sherlock Holmes',st:'Sherlock Holmes',a:'Arthur Conan Doyle',sur:'Doyle',y:1892,yr:'1892',era:'Victorian London',pages:307,lvl:1,spine:'#4A2A1A',em:'glass',g:1661,
 mood:['mystery','wit'],set:['city','country'],
 line:'Twelve cases for the world\'s first consulting detective and his long-suffering friend, Dr Watson.',
 why:'Each story is a 30-minute episode with a clever reveal. Perfect for reading on the bus, and the start of almost every detective show you have ever watched.',
 parts:[
  {h:'A Scandal in Bohemia',s:'A king hires Holmes to recover a compromising photograph from the opera singer Irene Adler, the only person ever to outwit him.'},
  {h:'The Red-Headed League',s:'A pawnbroker is paid to copy out the encyclopedia because of his red hair. Holmes realises the job is a cover for something underground.'},
  {h:'The Speckled Band',s:'A terrified young woman fears she will die the way her sister did, whispering about a speckled band. Holmes spends a night in the locked bedroom.'}],
 end:'In "The Speckled Band", the killer is the stepfather: he trained a venomous swamp adder to climb through a ventilator and down a bell-rope. Holmes drives it back through the vent, and it bites its master.',
 chars:[['Sherlock Holmes','Sees what everyone else misses'],['Dr John Watson','Narrator, doctor, loyal friend'],['Irene Adler','Always "the woman" to Holmes'],['Mrs Hudson','The landlady who puts up with it all']],
 themes:['Observation','Logic','Justice','Friendship'],
 q:'You see, but you do not observe.',qs:'A Scandal in Bohemia',
 note:'Mild violence, some menace.',pair:['dracula','jekyll-and-hyde']},

{id:'dracula',t:'Dracula',st:'Dracula',a:'Bram Stoker',sur:'Stoker',y:1897,yr:'1897',era:'Victorian England',pages:418,lvl:2,spine:'#3B0F18',em:'bat',g:345,
 mood:['gothic','mystery'],set:['castle','city','sea'],
 line:'A Transylvanian count buys property in England, and a group of friends must work out what he is before he takes them one by one.',
 why:'It is told entirely in diaries, letters and newspaper clippings, like a found-footage horror film. The first four chapters in the castle are as creepy as anything written since.',
 parts:[
  {h:'The castle',s:'The young solicitor Jonathan Harker travels to Transylvania to help Count Dracula buy a house in England, and realises he is a prisoner of something that is not human.'},
  {h:'The voyage',s:'A ship runs aground at Whitby with its crew dead and a huge dog leaping ashore. Soon Lucy Westenra, best friend of Jonathan\'s fiancée Mina, grows pale and weak.'},
  {h:'The hunt',s:'Professor Van Helsing leads Lucy\'s suitors, Jonathan and Mina in a hunt for Dracula\'s boxes of earth across London, but the Count targets Mina next.'}],
 end:'The hunters chase Dracula back to Transylvania. Using Mina\'s psychic link to him, they catch his coffin before sunset; Jonathan cuts his throat and Quincey Morris stabs his heart, dying in the attack. Dracula crumbles to dust and Mina is freed.',
 chars:[['Count Dracula','Ancient, charming, insatiable'],['Mina Harker','The real brains of the team'],['Abraham Van Helsing','Professor and vampire expert'],['Jonathan Harker','A solicitor in way over his head']],
 themes:['Fear of outsiders','Modernity versus the ancient','Desire','Teamwork'],
 q:'Listen to them, the children of the night. What music they make!',qs:'Count Dracula, Chapter 2',
 note:'Gothic horror, blood, some sensuality.',pair:['frankenstein','the-adventures-of-sherlock-holmes']},

{id:'the-metamorphosis',t:'The Metamorphosis',st:'Metamorphosis',a:'Franz Kafka',sur:'Kafka',y:1915,yr:'1915',era:'Modernist Europe',pages:70,lvl:2,spine:'#3A3A2A',em:'beetle',g:5200,
 mood:['ideas','gothic'],set:['city'],
 line:'A travelling salesman wakes up as a giant insect, and his first worry is being late for work.',
 why:'It is the most relatable horror story ever written about burnout, family pressure and feeling like a burden. Under 80 pages, and you will think about it for years.',
 parts:[
  {h:'Part I: The morning',s:'Gregor Samsa wakes transformed into a monstrous insect. He struggles to get out of bed while his family and his boss bang on the door.'},
  {h:'Part II: The room',s:'Gregor is shut in his room. His sister Grete feeds him at first, but the family is disgusted and frightened, and his father wounds him with a thrown apple.'},
  {h:'Part III: The burden',s:'Now everyone else has to work. They take in lodgers and grow tired of Gregor, until Grete declares that the creature must go.'}],
 end:'Gregor, weak and injured, dies alone in his room that night, thinking of his family with love. The family feels relief, takes the day off and rides a tram into the country, already planning Grete\'s future.',
 chars:[['Gregor Samsa','Dutiful son, now an insect'],['Grete Samsa','His sister, the first to care and the first to quit'],['Mr Samsa','A father who finally gets a job'],['The lodgers','Three bearded, judgemental strangers']],
 themes:['Alienation','Work and worth','Family duty','Identity'],
 q:'When Gregor Samsa woke one morning from uneasy dreams, he found himself changed in his bed into a monstrous vermin.',qs:'Opening line (ItsLit translation of the 1915 German)',
 note:'Body horror, a lonely death.',pair:['alices-adventures-in-wonderland','crime-and-punishment']},

{id:'the-great-gatsby',t:'The Great Gatsby',st:'The Great Gatsby',a:'F. Scott Fitzgerald',sur:'Fitzgerald',y:1925,yr:'1925',era:'Jazz Age America',pages:180,lvl:1,spine:'#163A35',em:'light',g:64317,
 mood:['romance','ideas'],set:['ballroom','city'],
 line:'A mysterious millionaire throws enormous parties for one reason: to win back the woman he loved five years ago.',
 why:'It is short, glittering and devastating. The parties are pure aesthetic, but the book is really about reinventing yourself, and whether the past can be bought back.',
 parts:[
  {h:'The parties',s:'Nick Carraway rents a cottage on Long Island next to the mansion of Jay Gatsby, who throws lavish parties and stares across the bay at a green light on a dock.'},
  {h:'The reunion',s:'The green light belongs to Nick\'s cousin Daisy, now married to the brutish Tom Buchanan. Nick arranges tea, and Gatsby and Daisy rekindle their romance.'},
  {h:'The hot afternoon',s:'In a stifling Manhattan hotel room, Tom exposes Gatsby\'s shady fortune, and Daisy cannot leave her husband.'}],
 end:'Driving Gatsby\'s car, Daisy hits and kills Myrtle, Tom\'s mistress. Myrtle\'s grieving husband, told the car was Gatsby\'s, shoots Gatsby in his pool and then himself. Almost no one comes to the funeral, and Nick leaves the East for good.',
 chars:[['Jay Gatsby','Self-made, hopeful, hiding everything'],['Daisy Buchanan','Charming and careless'],['Nick Carraway','Narrator, neighbour, reluctant judge'],['Tom Buchanan','Old money, cruel']],
 themes:['The American Dream','Reinvention','Wealth and class','The past'],
 q:'So we beat on, boats against the current, borne back ceaselessly into the past.',qs:'Final line',
 note:'A fatal car crash, a shooting.',pair:['the-picture-of-dorian-gray','pride-and-prejudice']}
];
const BOOK = Object.fromEntries(BOOKS.map(b => [b.id, b]));
const hoursOf = b => Math.max(1, Math.round(b.pages / 50));
const LEVELS = ['', 'Gentle', 'Steady', 'Ambitious'];

/* House prompts that open each Salon thread (written by ItsLit, not invented readers) */
const PROMPTS = {
 'the-odyssey':'Odysseus lies to almost everyone he meets. Is he a hero, or just very good at surviving?',
 'romeo-and-juliet':'Whose fault is the ending really: the lovers, the parents, or the Friar?',
 'pride-and-prejudice':'Whose prejudice is worse at the start, Elizabeth\'s or Darcy\'s?',
 'frankenstein':'Who is the real monster, Victor or the creature? Make your case.',
 'a-christmas-carol':'December Salon: which ghost would scare you straight the fastest?',
 'the-count-of-monte-cristo':'At what point, if any, does the Count go too far?',
 'narrative-of-frederick-douglass':'Douglass calls reading "the pathway from slavery to freedom". What did reading unlock for him first?',
 'jane-eyre':'Was Jane right to leave Thornfield, knowing she might never come back?',
 'wuthering-heights':'Is this a love story at all? Defend your answer.',
 'moby-dick':'Is Ahab mad, or the only honest man on the ship?',
 'great-expectations':'Who is the better role model for Pip: Joe or Magwitch?',
 'alices-adventures-in-wonderland':'Which Wonderland character is most like someone you know?',
 'crime-and-punishment':'Is Raskolnikov punished more by the law or by himself?',
 'little-women':'Team Jo-and-Laurie or team Jo-and-Bhaer? Explain yourself.',
 'jekyll-and-hyde':'Is Hyde a different person, or Jekyll with the mask off?',
 'the-picture-of-dorian-gray':'Is Lord Henry the villain, or is Dorian responsible for his own choices?',
 'the-adventures-of-sherlock-holmes':'Which case did you solve before Holmes, if any?',
 'dracula':'Mina does most of the clever work. Why do the men keep sidelining her?',
 'the-metamorphosis':'Does Gregor\'s family deserve sympathy or blame?',
 'the-great-gatsby':'Is Gatsby "great", or is the title ironic?'
};

/* Sample Gazette letters (the editor can hide or replace them from the Writing desk) */
const LETTERS = [
{id:'lamps',date:'2026-11-13',book:'frankenstein',title:'Why we lit the lamps',
 dek:'A reading club for the great works, built for readers who were told the classics were not for them.',
 body:`Dear reader,

Somewhere along the way the classics got a reputation: too long, too old, too much homework. We understand. Most of us met *Great Expectations* with a pop quiz attached.

But here is the secret the syllabus leaves out: these books are wild. An eighteen-year-old began *Frankenstein* during a stormy summer ghost-story contest. *Wuthering Heights* is a revenge story wearing a love story's clothes. *The Count of Monte Cristo* came out in instalments, like a series nobody could stop watching.

## What ItsLit is for

ItsLit is a candlelit reading club for the great works. Every book in the Library comes with a plain-English breakdown, a sealed ending you open only when you are ready, and a Salon where readers talk it through. Shelley, our AI librarian, is on hand day and night for the questions you would never ask in class.

## What happens next

This December we read *A Christmas Carol* together: one stave an evening, five evenings, finished before the holidays. It is short, it is spooky, and it is the best argument ever made for a second chance.

Pull up a chair. The lamps are lit.

The Editor`},
{id:'carol-salon',date:'2026-11-27',book:'a-christmas-carol',title:'A Christmas Carol in five evenings',
 dek:'The December Salon: one stave a night, December 19 to 23, with a question to carry into each.',
 body:`Each stave of *A Christmas Carol* takes about 20 to 30 minutes to read. Here is the plan.

- **Stave One, Saturday Dec 19: Marley's ghost.** What does Marley's chain tell you about how small choices add up?
- **Stave Two, Sunday Dec 20: the first spirit.** When did young Scrooge start to change? One moment, or many?
- **Stave Three, Monday Dec 21: the second spirit.** Which family scene hits hardest, and why does Dickens show it to Scrooge?
- **Stave Four, Tuesday Dec 22: the last spirit.** Why does the final ghost never speak?
- **Stave Five, Wednesday Dec 23: the end of it.** Is Scrooge's change believable? Would you have forgiven him?

> "I will honour Christmas in my heart, and try to keep it all the year."

Read it free on Project Gutenberg, or any edition you like. Then come to the Salon and tell us: who is the real ghost of this story?`},
{id:'short-classics',date:'2026-11-20',book:'the-metamorphosis',title:'Five classics shorter than a season of your favourite show',
 dek:'Big reputations, small page counts. Start here if you have never finished a classic.',
 body:`A classic does not have to be a doorstop. Each of these takes an afternoon or two.

- ***A Christmas Carol*, about 2 hours.** A ghost story and a redemption arc in one sitting.
- ***Strange Case of Dr Jekyll and Mr Hyde*, about 2 hours.** The original split-self thriller, told like a detective case.
- ***The Metamorphosis*, about 1.5 hours.** A man wakes up as an insect, and his family's reaction is the real horror.
- ***Alice's Adventures in Wonderland*, about 2 hours.** Pure nonsense, sharp as a knife, funnier than you remember.
- ***The Great Gatsby*, about 4 hours.** Parties, longing, and one of the most famous last lines in American fiction.

## The ItsLit rule

Finish one, then tell the Salon which one surprised you. Shelley can help if you get stuck, but she will not read it for you.`}
];

const MERCH = [
 {id:'tote',n:'"It\'s Lit" library tote',p:28,d:'Heavy canvas, a gilt candle and our motto. Holds four hardbacks and your snacks.',art:'tote'},
 {id:'candle',n:'Old Library candle',p:24,d:'Leather, parchment and a hint of pipe smoke. Burns for about 40 hours.',art:'candle'},
 {id:'pin',n:'"Reader, I married him" pin',p:12,d:'Gold enamel, for the Jane Eyre devotees.',art:'pin'},
 {id:'bookmarks',n:'Gilt quote bookmarks',p:14,d:'Five public-domain lines in gold foil on oxblood card.',art:'bookmark'},
 {id:'hoodie',n:'"Classically Lit" hoodie',p:55,d:'Brushed fleece in bottle green with a small embroidered flame.',art:'hoodie'},
 {id:'mug',n:'Tea with Mr Darcy mug',p:18,d:'Austen\'s famous first line around a Wedgwood-blue mug.',art:'mug'}
];
