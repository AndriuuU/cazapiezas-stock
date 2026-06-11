const INTERNAL_EAN_PREFIX = "20";

function calculateEan13CheckDigit(firstTwelveDigits: string) {
  const sum = firstTwelveDigits
    .split("")
    .reduce((total, digit, index) => {
      const value = Number(digit);
      return total + value * (index % 2 === 0 ? 1 : 3);
    }, 0);

  return String((10 - (sum % 10)) % 10);
}

export function createInternalEan13() {
  const randomDigits = Array.from({ length: 10 }, () =>
    Math.floor(Math.random() * 10)
  ).join("");
  const firstTwelveDigits = `${INTERNAL_EAN_PREFIX}${randomDigits}`;

  return `${firstTwelveDigits}${calculateEan13CheckDigit(firstTwelveDigits)}`;
}

export function isValidEan13(value: string) {
  if (!/^\d{13}$/.test(value)) {
    return false;
  }

  return calculateEan13CheckDigit(value.slice(0, 12)) === value.slice(12);
}

