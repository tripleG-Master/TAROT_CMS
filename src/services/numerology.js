const MASTER_NUMBERS = new Set([11, 22, 33]);

function sumDigits(n) {
  let x = Math.abs(Number(n) || 0);
  let sum = 0;
  while (x > 0) {
    sum += x % 10;
    x = Math.floor(x / 10);
  }
  return sum;
}

function reduceToDigitOrMaster(n) {
  let x = Math.abs(Number(n) || 0);
  while (x > 9 && !MASTER_NUMBERS.has(x)) {
    x = sumDigits(x);
  }
  return x;
}

function lifePathNumber({ year, month, day }) {
  const digits = `${String(year).padStart(4, "0")}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
  const total = digits.split("").reduce((acc, ch) => acc + Number(ch), 0);
  const value = reduceToDigitOrMaster(total);
  return { value, is_master: MASTER_NUMBERS.has(value) };
}

function reduceToArcanaNumber(n) {
  let x = Math.abs(Number(n) || 0);
  while (x > 22) x = sumDigits(x);
  if (x === 0) return 22;
  return x;
}

function birthArcanaFromBirthdate({ year, month, day }) {
  const digits = `${String(year).padStart(4, "0")}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
  const total = digits.split("").reduce((acc, ch) => acc + Number(ch), 0);
  const arcana22 = reduceToArcanaNumber(total);
  const majorArcanaNumero = arcana22 === 22 ? 0 : arcana22;
  return { arcana_22: arcana22, major_arcana_numero: majorArcanaNumero };
}

module.exports = { lifePathNumber, birthArcanaFromBirthdate };
