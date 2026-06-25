import { ROOM_CODE } from "@auction/shared";

/**
 * Generate a human-friendly room join code using the configured alphabet.
 * Format is 4 numeric digits (e.g., "4125") per the product decision.
 */
export function generateRoomCode(length: number = ROOM_CODE.LENGTH): string {
  const alphabet = ROOM_CODE.ALPHABET;
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}