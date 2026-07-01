/** منطق واجهة القيد — مشترك مع اختبارات Node */
function isQaidAllySeat(seat, objectorSeat) {
  if (objectorSeat === null || objectorSeat === undefined) return false;
  if (seat === null || seat === undefined) return false;
  return seat === objectorSeat || seat === (objectorSeat + 2) % 4;
}

/** موقع المقعد بالنسبة للموزع — سهم + تسمية */
function qaidDealerPosition(seat, dealerIdx) {
  if (dealerIdx === null || dealerIdx === undefined || seat === null || seat === undefined) {
    return { arrow: '', label: '' };
  }
  const diff = (seat - dealerIdx + 4) % 4;
  switch (diff) {
    case 0: return { arrow: '♦', label: 'موزع' };
    case 1: return { arrow: '→', label: 'يمين' };
    case 2: return { arrow: '↑', label: 'شريك' };
    case 3: return { arrow: '←', label: 'يسار' };
    default: return { arrow: '', label: '' };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { isQaidAllySeat, qaidDealerPosition };
}
if (typeof window !== 'undefined') {
  window.__qaidUi = { isQaidAllySeat, qaidDealerPosition };
}
