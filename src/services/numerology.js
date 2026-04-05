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

function reduceToTarotRangeOrMaster(n, options = {}) {
  const stopAt33 = options.stopAt33 === true;
  let x = Math.abs(Number(n) || 0);
  while (x > 22) {
    const next = sumDigits(x);
    if (MASTER_NUMBERS.has(next)) {
      if (next === 33 && stopAt33) return next;
      if (next === 22) return next;
      if (next === 11) return next;
    }
    x = next;
  }
  return x;
}

function reduceToTarotRangeOrMasterWithSteps(n, options = {}) {
  const stopAt33 = options.stopAt33 === true;
  let x = Math.abs(Number(n) || 0);
  const steps = [];

  while (x > 22) {
    const next = sumDigits(x);
    steps.push({ from: x, to: next });

    if (MASTER_NUMBERS.has(next)) {
      if (next === 33 && stopAt33) return { value: next, steps };
      if (next === 22) return { value: next, steps };
      if (next === 11) return { value: next, steps };
    }

    x = next;
  }

  return { value: x, steps };
}

function lifePathNumber({ year, month, day }) {
  const digits = `${String(year).padStart(4, "0")}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
  const total = digits.split("").reduce((acc, ch) => acc + Number(ch), 0);
  const reduced = reduceToTarotRangeOrMasterWithSteps(total, { stopAt33: true });
  const value = reduced.value;
  return { total, value, is_master: MASTER_NUMBERS.has(value), steps: reduced.steps };
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
  const reduced = reduceToTarotRangeOrMasterWithSteps(total, { stopAt33: false });
  const arcana22 = reduced.value;
  const majorArcanaNumero = arcana22 === 22 ? 0 : arcana22;
  return {
    total,
    arcana_22: arcana22,
    major_arcana_numero: majorArcanaNumero,
    is_master: arcana22 === 11 || arcana22 === 22,
    steps: reduced.steps
  };
}

module.exports = { lifePathNumber, birthArcanaFromBirthdate };
