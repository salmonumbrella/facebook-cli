export function redactToken(input: string): string {
  return input.replace(/EAA[0-9A-Za-z]+/g, (m) => `${m.slice(0, 6)}...${m.slice(-4)}`);
}
