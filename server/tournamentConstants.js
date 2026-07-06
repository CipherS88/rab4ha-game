/** رسوم وثوابت البطولات الترفيهية */
const TOURNAMENT_CREATE_FEE = 500;
const TOURNAMENT_CUSTOMIZE_FEE = 100;

/** نقاط البطولات الترفيهية (غير قابلة للتداول) */
const REC_TOURNEY_POINTS = {
  CHAMPION: 8,
  RUNNER_UP: 4,
  QUARTERFINAL: 1,
  EARLY: 0,
};

module.exports = {
  TOURNAMENT_CREATE_FEE,
  TOURNAMENT_CUSTOMIZE_FEE,
  REC_TOURNEY_POINTS,
};
