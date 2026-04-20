function countBits(value) {
  let remaining = value;
  let total = 0;

  while (remaining > 0) {
    remaining &= remaining - 1;
    total += 1;
  }

  return total;
}

function makeAtomEntry(value) {
  return {
    key: `n:${value}`,
    text: `${value}`,
    op: 'atom',
    parts: [],
  };
}

function formatPartText(entry) {
  return entry.text;
}

function createCommutativeEntry(op, left, right) {
  const parts = [
    ...(left.op === op ? left.parts : [left]),
    ...(right.op === op ? right.parts : [right]),
  ].sort((first, second) => first.key.localeCompare(second.key));
  const symbol = op === '+' ? ' + ' : ' * ';

  return {
    key: `${op}:${parts.map((part) => part.key).join('|')}`,
    text: `(${parts.map(formatPartText).join(symbol)})`,
    op,
    parts,
  };
}

function createBinaryEntry(op, left, right) {
  const symbol = op === '-' ? ' - ' : ' / ';

  return {
    key: `${op}:${left.key}|${right.key}`,
    text: `(${left.text}${symbol}${right.text})`,
    op,
    parts: [left, right],
  };
}

function mergeValueMaps(target, source) {
  for (const [value, expressionMap] of source.entries()) {
    if (!target.has(value)) {
      target.set(value, new Map());
    }

    const nextMap = target.get(value);

    for (const [key, entry] of expressionMap.entries()) {
      if (!nextMap.has(key)) {
        nextMap.set(key, entry);
      }
    }
  }
}

function getSignature(digits) {
  return digits.slice().sort((left, right) => left - right).join(',');
}

export function createExpressionSolver() {
  const cache = new Map();

  function solveDigits(digits) {
    const signature = getSignature(digits);
    if (cache.has(signature)) {
      return cache.get(signature);
    }

    const size = digits.length;
    const fullMask = (1 << size) - 1;
    const byMask = new Map();

    for (let index = 0; index < size; index += 1) {
      const valueMap = new Map();
      valueMap.set(digits[index], new Map([[`n:${digits[index]}`, makeAtomEntry(digits[index])]]));
      byMask.set(1 << index, valueMap);
    }

    for (let mask = 1; mask <= fullMask; mask += 1) {
      if (byMask.has(mask) || countBits(mask) <= 1) {
        continue;
      }

      const combinedValues = new Map();

      for (let subMask = (mask - 1) & mask; subMask > 0; subMask = (subMask - 1) & mask) {
        const otherMask = mask ^ subMask;

        if (subMask > otherMask || otherMask === 0) {
          continue;
        }

        const leftValues = byMask.get(subMask);
        const rightValues = byMask.get(otherMask);

        if (!leftValues || !rightValues) {
          continue;
        }

        const merged = new Map();

        for (const [leftValue, leftEntries] of leftValues.entries()) {
          for (const [rightValue, rightEntries] of rightValues.entries()) {
            for (const leftEntry of leftEntries.values()) {
              for (const rightEntry of rightEntries.values()) {
                const additionEntry = createCommutativeEntry('+', leftEntry, rightEntry);
                const multiplicationEntry = createCommutativeEntry('*', leftEntry, rightEntry);
                const subtractionEntries = [];
                const divisionEntries = [];

                if (leftValue >= rightValue) {
                  subtractionEntries.push({
                    value: leftValue - rightValue,
                    entry: createBinaryEntry('-', leftEntry, rightEntry),
                  });
                }
                if (rightValue >= leftValue) {
                  subtractionEntries.push({
                    value: rightValue - leftValue,
                    entry: createBinaryEntry('-', rightEntry, leftEntry),
                  });
                }
                if (rightValue !== 0 && leftValue % rightValue === 0) {
                  divisionEntries.push({
                    value: leftValue / rightValue,
                    entry: createBinaryEntry('/', leftEntry, rightEntry),
                  });
                }
                if (leftValue !== 0 && rightValue % leftValue === 0) {
                  divisionEntries.push({
                    value: rightValue / leftValue,
                    entry: createBinaryEntry('/', rightEntry, leftEntry),
                  });
                }

                const nextValues = [
                  { value: leftValue + rightValue, entry: additionEntry },
                  { value: leftValue * rightValue, entry: multiplicationEntry },
                  ...subtractionEntries,
                  ...divisionEntries,
                ].filter(({ value }) => Number.isInteger(value) && value >= 0);

                for (const { value, entry } of nextValues) {
                  if (!merged.has(value)) {
                    merged.set(value, new Map());
                  }

                  if (!merged.get(value).has(entry.key)) {
                    merged.get(value).set(entry.key, entry);
                  }
                }
              }
            }
          }
        }

        mergeValueMaps(combinedValues, merged);
      }

      byMask.set(mask, combinedValues);
    }

    const solvedValues = new Map();

    for (const [value, entries] of byMask.get(fullMask)?.entries() ?? []) {
      solvedValues.set(value, {
        value,
        expressions: Array.from(entries.values())
          .map((entry) => entry.text)
          .sort((left, right) => left.localeCompare(right)),
      });
    }

    cache.set(signature, solvedValues);
    return solvedValues;
  }

  return {
    solveDigits,
  };
}
