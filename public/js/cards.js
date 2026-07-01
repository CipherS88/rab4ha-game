/* Card image helpers */
const SUIT_PREFIX = { HEARTS: 'H', DIAMONDS: 'D', CLUBS: 'C', SPADES: 'S' };
const SUIT_SORT_ORDER = { HEARTS: 0, SPADES: 1, DIAMONDS: 2, CLUBS: 3 };
const SUN_RANKING = ['A', '10', 'K', 'Q', 'J', '9', '8', '7'];
const HAKAM_RANKING = ['J', '9', 'A', '10', 'K', 'Q', '8', '7'];

function cardImageUrl(card) {
  if (!card || card.hidden) return '/cards/back_dark.png';
  return `/cards/${SUIT_PREFIX[card.suit]}${card.rank}.png`;
}

function cardBackUrl() {
  return window.__cardBackUrl || '/cards/back_dark.png';
}

function setCardBackUrl(url) {
  if (url) window.__cardBackUrl = url;
}

function cardEquals(a, b) {
  return a && b && a.suit === b.suit && a.rank === b.rank;
}

function cardKey(c) {
  return `${c.rank}_of_${c.suit}`;
}

/** ترتيب العرض: هاص → سبيت → ديمن → شيريا، كل لون مع بعض */
function sortHandForDisplay(hand, bid) {
  const isHakam = bid?.type === 'HAKAM' && bid?.suit;
  const hakamSuit = isHakam ? bid.suit : null;
  return hand
    .map((card, serverIdx) => ({ card, serverIdx }))
    .sort((a, b) => {
      const sa = SUIT_SORT_ORDER[a.card.suit] - SUIT_SORT_ORDER[b.card.suit];
      if (sa !== 0) return sa;
      const ranks = isHakam && a.card.suit === hakamSuit ? HAKAM_RANKING : SUN_RANKING;
      return ranks.indexOf(a.card.rank) - ranks.indexOf(b.card.rank);
    });
}
