const K1 = [3, 7, 6, 1, 8, 9, 4, 5, 2];
const K2 = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

function control(digits: number[], weights: number[]): number | null {
    const sum = weights.reduce((acc, w, i) => acc + w * digits[i], 0);
    const rest = 11 - (sum % 11);
    if (rest === 11) return 0;
    return rest === 10 ? null : rest;
}

export function normalizeNationalId(input: string): string {
    return input.replace(/[\s.-]/g, "");
}

// Checks the shape and both control digits of a fødselsnummer or D-number.
// It cannot tell whether the number belongs to anyone.
export function isValidNationalId(input: string): boolean {
    const value = normalizeNationalId(input);
    if (!/^\d{11}$/.test(value)) return false;
    const digits = [...value].map(Number);
    // D-numbers add 40 to the day. Synthetic test numbers add 40 or 80 to the month.
    const day = Number(value.slice(0, 2)) % 40;
    const month = Number(value.slice(2, 4)) % 40;
    if (day < 1 || day > 31 || month < 1 || month > 12) return false;
    const c1 = control(digits, K1);
    if (c1 === null || c1 !== digits[9]) return false;
    const c2 = control(digits, K2);
    return c2 !== null && c2 === digits[10];
}
