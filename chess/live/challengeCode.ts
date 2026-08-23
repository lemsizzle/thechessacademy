export const CHALLENGE_CODE_LENGTH = 4;
export const CHALLENGE_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const MAX_CHALLENGE_CODE_ATTEMPTS = 12;

const CURRENT_CHALLENGE_CODE_PATTERN = /^[A-Z0-9]{4}$/;
const LEGACY_CHALLENGE_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{12}$/;

export function cleanChallengeCode(value: unknown) {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isSupportedChallengeCode(value: string) {
  return CURRENT_CHALLENGE_CODE_PATTERN.test(value) || LEGACY_CHALLENGE_CODE_PATTERN.test(value);
}

export function generateChallengeCode(randomBytes = crypto.getRandomValues(new Uint8Array(CHALLENGE_CODE_LENGTH))) {
  if (randomBytes.length < CHALLENGE_CODE_LENGTH) throw new Error("Challenge code randomness is incomplete.");
  return Array.from(
    randomBytes.slice(0, CHALLENGE_CODE_LENGTH),
    (value) => CHALLENGE_CODE_ALPHABET[value % CHALLENGE_CODE_ALPHABET.length]
  ).join("");
}
