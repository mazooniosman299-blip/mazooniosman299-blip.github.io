const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const script = fs.readFileSync(require('node:path').join(__dirname, '../assets/app.js'), 'utf8');
function calculate(birthday, today) {
  const RealDate = Date;
  class FixedDate extends RealDate {
    constructor(...args) { super(...(args.length ? args : [...today, 12])); }
  }
  const elements = {birthday: {value: birthday}, ageBtn: {}, ageOut: {textContent: ''}};
  vm.runInNewContext(script, {
    document: {body: {dataset: {tool: 'age'}}, getElementById: id => elements[id]},
    Date: FixedDate,
  });
  elements.ageBtn.onclick();
  return elements.ageOut.textContent;
}
test('month end never produces negative days', () => {
  assert.equal(calculate('2025-01-31', [2025, 2, 1]), 'عمرك التقريبي: 0 سنة و1 شهر و1 يوم.');
});
test('leap day anniversary is clamped to the last day of February', () => {
  assert.equal(calculate('2000-02-29', [2025, 1, 28]), 'عمرك التقريبي: 25 سنة و0 شهر و0 يوم.');
});
test('ordinary birthday and year boundary', () => {
  assert.equal(calculate('2000-10-27', [2026, 9, 27]), 'عمرك التقريبي: 26 سنة و0 شهر و0 يوم.');
  assert.equal(calculate('2024-12-31', [2025, 0, 1]), 'عمرك التقريبي: 0 سنة و0 شهر و1 يوم.');
});
test('future, missing, and malformed dates are rejected', () => {
  assert.match(calculate('2027-01-01', [2026, 9, 27]), /المستقبل/);
  assert.match(calculate('', [2026, 9, 27]), /اختر/);
  assert.match(calculate('2025-02-31', [2026, 9, 27]), /صحيح/);
});
