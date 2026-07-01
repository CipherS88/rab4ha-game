const assert = require('assert');
const { isQaidAllySeat, qaidDealerPosition } = require('../public/js/qaid_ui.js');

assert.strictEqual(isQaidAllySeat(0, 0), true);
assert.strictEqual(isQaidAllySeat(2, 0), true);
assert.strictEqual(isQaidAllySeat(1, 0), false);

assert.deepStrictEqual(qaidDealerPosition(3, 3), { arrow: '♦', label: 'موزع' });
assert.deepStrictEqual(qaidDealerPosition(0, 3), { arrow: '→', label: 'يمين' });
assert.deepStrictEqual(qaidDealerPosition(1, 3), { arrow: '↑', label: 'شريك' });
assert.deepStrictEqual(qaidDealerPosition(2, 3), { arrow: '←', label: 'يسار' });

console.log('qaid_ui_test: ok');
