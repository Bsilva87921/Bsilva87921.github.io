/* ==========================================================================
   Probable — metric guide: what each advanced metric means, how it is
   computed here, and where it appears. Entries marked `x` are industry
   metrics that need play-by-play or tracking data the public feeds lack.
   [name, what it tells you, how it is computed, where it appears, x?]
   ========================================================================== */
(function () {
  'use strict';
  window.APP.GLOSS = {
    all: [
      ['Pythagorean expectation', 'The win % a team\'s scoring "deserves".', 'PF^x ÷ (PF^x + PA^x); x = 2.37 football, 14 basketball, 1.83 baseball, 2.05 hockey.', 'Team stats · Analytics · History'],
      ['Luck (W − Pythag)', 'Wins above or below what the scoring supports; it mostly does not repeat.', 'Actual wins − Pythagorean win % × games.', 'Team stats · Analytics · History'],
      ['Power index', 'One number for how good a team is, blending several views of strength.', 'Average z-score of margin per game, Pythagorean % (xPts in soccer) and results, plus an efficiency measure when team stats are loaded; 50 = average, ±15 per standard deviation.', 'Team stats (Advanced) · Analytics'],
      ['Scoring share', 'Share of all points, runs or goals scored in a team\'s games (GF% in hockey and soccer).', 'PF ÷ (PF + PA).', 'Team stats (Advanced)'],
      ['SRS (Simple Rating System)', 'Point margin adjusted for opponents: how much better than an average team on a neutral field.', 'Average margin with the home edge removed + average opponent SRS, solved for every team at once.', 'Analytics (live)'],
      ['Strength of schedule', 'How hard a team\'s opponents were.', 'SRS − average margin.', 'Analytics (live)'],
      ['Elo', 'A rating updated after every game; beating good teams by a lot moves it most.', 'Expected = 1 ÷ (1 + 10^(−Δ/400)) with a home edge; change = K × margin multiplier × (result − expected).', 'Analytics (live)'],
      ['Noll–Scully ratio', 'League parity: how spread out records are compared with pure chance.', 'SD of team win % ÷ (0.5 ÷ √games). 1.0 = coin flips.', 'History'],
      ['Win probability & excitement', 'Chance each side wins from any game state, and how much it swung.', 'Sport-specific models (Brownian motion, Monte Carlo, Poisson); excitement = sum of absolute swings.', 'Board · Game center · Lab']
    ],
    bk: [
      ['Pace', 'Possessions per game: how fast a team plays.', 'FGA − OREB + TOV + 0.44 × FTA.', 'Team stats'],
      ['Offensive / defensive / net rating', 'Points scored and allowed per 100 possessions; net rating is the best single team metric.', '100 × points ÷ possessions.', 'Team stats · Analytics'],
      ['Four factors', 'Why a team scores: shooting, ball security, offensive rebounding, getting to the line.', 'eFG% = (FGM + 0.5 × 3PM) ÷ FGA; TOV% = TOV ÷ (FGA + 0.44 FTA + TOV); ORB% = OREB ÷ (OREB + opponent DREB, league average here); FT rate = FTM ÷ FGA.', 'Team stats'],
      ['True shooting %', 'Scoring efficiency counting threes and free throws.', 'PTS ÷ (2 × (FGA + 0.44 × FTA)).', 'Team & player stats'],
      ['AST% (team)', 'How much of the offense is created by passing.', 'Assists ÷ made field goals.', 'Team stats'],
      ['3PA rate', 'Share of shots taken from three.', '3PA ÷ FGA.', 'Team & player stats'],
      ['Game Score', 'A player\'s box-score production in one number (about 10 = average starter).', 'PTS + 0.4 FGM − 0.7 FGA − 0.4 missed FT + 0.4 REB + STL + 0.7 AST + 0.7 BLK − 0.4 PF − TOV.', 'Player stats (Advanced)'],
      ['EFF', 'The NBA\'s classic efficiency formula.', 'PTS + REB + AST + STL + BLK − missed FG − missed FT − TOV.', 'Player stats (Advanced)'],
      ['Usage rate (est.)', 'Share of team plays a player finishes while on the floor.', '(FGA + 0.44 FTA + TOV) × 48 ÷ (minutes × league-average team plays).', 'Player stats (Advanced)'],
      ['Per-36 rates', 'Production scaled to 36 minutes so bench and starters compare.', 'Stat ÷ minutes × 36.', 'Player stats'],
      ['PER, BPM, EPM, RAPTOR, on/off', 'All-in-one impact metrics.', 'Need play-by-play lineups or tracking data; Game Score, EFF and usage are the closest here.', 'Not in these feeds', 1]
    ],
    fb: [
      ['Yards per play', 'Offensive efficiency independent of pace.', 'Total yards ÷ offensive plays.', 'Team stats'],
      ['Points per play', 'How well yards turn into points.', 'Points ÷ offensive plays.', 'Team stats (Advanced)'],
      ['ANY/A', 'The most predictive simple passing stat.', '(Pass yds + 20 × TD − 45 × INT − sack yds) ÷ (attempts + sacks).', 'Team & player stats'],
      ['AY/A and NY/A', 'Yards per attempt adjusted for touchdowns and interceptions (AY/A) or sacks (NY/A).', 'AY/A = (yds + 20 TD − 45 INT) ÷ att; NY/A = (yds − sack yds) ÷ (att + sacks).', 'Player stats (Advanced passing)'],
      ['Passer rating', 'The NFL\'s official QB rating.', 'Average of four capped components: completion %, yards, TD and INT per attempt.', 'Player stats'],
      ['Total QBR', 'ESPN\'s play-by-play quarterback rating (0–100).', 'From the ESPN feed.', 'Player stats'],
      ['Sack rate & pass rate', 'How often dropbacks end in sacks, and how pass-heavy a team is.', 'Sacks ÷ dropbacks; dropbacks ÷ plays.', 'Team & player stats'],
      ['Third-down and red-zone TD rates', 'Situational efficiency.', 'Conversions ÷ attempts; TDs ÷ red-zone trips.', 'Team stats'],
      ['Turnover differential', 'Takeaways minus giveaways; large values rarely last.', 'Takeaways − giveaways.', 'Team stats'],
      ['Rushing: 1st-down %, 20+ yd %, TD rate, fumbles/100', 'Efficiency and explosiveness for backs.', 'Per carry.', 'Player stats (Rushing)'],
      ['Receiving: catch %, Y/Tgt, YAC, 1st downs & TDs per target', 'Efficiency per opportunity for receivers.', 'Per target or reception.', 'Player stats (Receiving)'],
      ['Havoc plays', 'Disruptive defensive plays.', 'Tackles for loss + passes defended + forced fumbles + interceptions.', 'Player stats (Defense)'],
      ['EPA/play, success rate, DVOA, CPOE', 'Play-level value metrics.', 'Need full play-by-play for every game; not in the public feeds used here.', 'Not in these feeds', 1]
    ],
    bb: [
      ['wOBA', 'On-base ability weighted by how many runs each event is worth.', '(0.69 BB + 0.88 1B + 1.25 2B + 1.58 3B + 2.03 HR) ÷ PA.', 'Team & player stats'],
      ['wRC+ (est.)', 'Runs created per PA versus league; 100 = average, 150 = 50% better.', '((wOBA − lg wOBA) ÷ 1.2 + lg R/PA) ÷ lg R/PA × 100; no park factors.', 'Team & player stats'],
      ['OPS+', 'OPS relative to league.', '100 × (OBP ÷ lg OBP + SLG ÷ lg SLG − 1); no park factors.', 'Team & player stats'],
      ['ISO, BABIP, BB%, K%, BB/K, HR%', 'Power, luck on balls in play, and plate discipline.', 'ISO = SLG − AVG; BABIP = (H − HR) ÷ (AB − K − HR + SF).', 'Team & player stats'],
      ['Runs created', 'Bill James\'s estimate of a hitter\'s run production.', '(H + BB) × TB ÷ (AB + BB).', 'Player stats (Advanced hitting)'],
      ['BaseRuns', 'Runs a lineup should score from its components; the gap to actual runs is sequencing.', 'A × B ÷ (B + C) + HR, with A = H + BB + HBP − HR, B = 1.02 × (1.4 TB − 0.6 H − 3 HR + 0.1 (BB + HBP)), C = AB − H.', 'Team stats (Advanced) · Analytics'],
      ['FIP and FIP−', 'Pitching judged only on strikeouts, walks and homers.', '(13 HR + 3 BB − 2 K) ÷ IP + constant; FIP− = 100 × FIP ÷ league.', 'Team & player stats'],
      ['ERA+', 'ERA relative to league; higher is better.', '100 × league ERA ÷ ERA; no park factors.', 'Team & player stats'],
      ['K%, BB%, K−BB%', 'Strikeout and walk rates per batter; K−BB% is the best simple predictor.', 'Per batter faced (estimated 3 × IP + H + BB).', 'Team & player stats'],
      ['LOB% and DER', 'Strand rate, and the share of balls in play the defense converts to outs.', 'LOB% = (H + BB + HBP − R) ÷ (H + BB + HBP − 1.4 HR); DER = 1 − BABIP allowed.', 'Team stats (Advanced)'],
      ['QS% and IP/GS', 'Starter reliability and length.', 'Quality starts ÷ starts; innings ÷ starts.', 'Player stats (Advanced pitching)'],
      ['WAR', 'Wins above replacement.', 'From the ESPN feed.', 'Player stats'],
      ['xwOBA, barrel %, exit velocity, Stuff+', 'Statcast quality-of-contact and pitch-quality metrics.', 'Need ball-tracking data; not in these feeds.', 'Not in these feeds', 1]
    ],
    hk: [
      ['GF% and shot share', 'Share of goals, and of shots on goal, in a team\'s games; shot share is the possession proxy.', 'GF ÷ (GF + GA); shots ÷ (shots + shots against).', 'Team stats · Analytics'],
      ['PDO', 'Shooting % + save %; values far from 100 tend to regress (luck).', 'SH% + SV%.', 'Team stats · Analytics'],
      ['PP%, PK% and special-teams index', 'Power-play and penalty-kill success.', 'PP goals ÷ opportunities; kills ÷ times shorthanded; index = PP% + PK%.', 'Team stats (Advanced)'],
      ['Per-60 rates', 'Points, goals, assists and shots per 60 minutes of ice time.', 'Stat ÷ TOI × 60.', 'Player stats (Skater rates)'],
      ['GSAA and GSAA/60', 'Goals a goalie saved beyond a league-average save % on the same shots.', 'Saves − shots against × league SV%.', 'Player stats (Goalies)'],
      ['Corsi, Fenwick, xG, GAR', 'Shot-attempt and shot-quality metrics.', 'Need shot-attempt or location data; shot share is the proxy used here.', 'Not in these feeds', 1]
    ],
    sc: [
      ['Points per game & points pace', 'Form and projected season total.', 'Points ÷ games; × games in the season.', 'Team stats (Advanced)'],
      ['Attack & defense strength', 'Scoring and conceding relative to league average: the inputs of Poisson / Dixon–Coles models.', 'GF per game ÷ league average; GA per game ÷ league average.', 'Team stats (Advanced) · Analytics'],
      ['xPts (goal-based)', 'Points expected from each side\'s scoring and conceding rates; Pts − xPts is luck.', 'Poisson probabilities of every scoreline from GF/G and GA/G.', 'Team stats · Analytics · History'],
      ['GF%', 'Share of the goals in a team\'s matches.', 'GF ÷ (GF + GA).', 'Team stats (Advanced)'],
      ['Goal share (players)', 'How much of a club\'s scoring runs through one player.', 'Player goals ÷ team league goals.', 'Player stats'],
      ['xG, xA, PPDA, field tilt', 'Shot-quality and pressing metrics.', 'Need event or tracking data; not in these feeds.', 'Not in these feeds', 1]
    ]
  };
})();
