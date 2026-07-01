const visualPositions = ['bottom', 'right', 'top', 'left'];

const seatDiffToVisual = {0: 'bottom', 1: 'right', 2: 'top', 3: 'left'};
const visualToSeatDiff = {'bottom': 0, 'right': 1, 'top': 2, 'left': 3};

String getVisualPos(int globalSeat, int? localSeat) {
  if (localSeat == null) return 'bottom';
  final diff = (globalSeat - localSeat + 4) % 4;
  return seatDiffToVisual[diff] ?? 'bottom';
}

int getGlobalSeat(String visualPos, int? localSeat) {
  if (localSeat == null) return 0;
  final diff = visualToSeatDiff[visualPos] ?? 0;
  return (localSeat + diff) % 4;
}

int getMyTeam(int? mySeat) {
  if (mySeat == null) return 1;
  return mySeat % 2 == 0 ? 1 : 2;
}

int seatTeam(int globalSeat) => globalSeat % 2 == 0 ? 1 : 2;

bool isSawaOpponentSeat(int globalSeat, Map<String, dynamic> sawaDecl) {
  final declarerSeat = sawaDecl['seat'] as int?;
  if (declarerSeat == null) return false;
  final declarerTeam = (sawaDecl['team'] as int?) ?? seatTeam(declarerSeat);
  return seatTeam(globalSeat) != declarerTeam;
}
