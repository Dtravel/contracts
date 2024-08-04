import { FunctionFragment, toBeHex, toBigInt } from 'ethers';

// eslint-disable-next-line
export function Enum({ options = [] }: { options?: any[] } = {}) {
  return Object.fromEntries(options.map((key, i) => [key, BigInt(i)]));
}
export function getRandomInt(min: number, max: number): number {
  min = Math.ceil(min); // Ensure minimum is an integer
  max = Math.floor(max); // Ensure maximum is an integer
  return Math.floor(Math.random() * (max - min + 1)) + min; // Returns a random integer between min and max (inclusive)
}

function selector(signature: string) {
  return FunctionFragment.from(signature).selector;
}

export function getInterfaceId(signatures: string[]) {
  return toBeHex(
    signatures.reduce((acc, signature) => acc ^ toBigInt(selector(signature)), 0n),
    4,
  );
}

// Create a new object by mapping the values through a function, keeping the keys
// Example: mapValues({a:1,b:2,c:3}, x => x**2) → {a:1,b:4,c:9}
// eslint-disable-next-line
export function mapValues(obj: any, fn: any) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(v)]));
}

export default {
  Enum,
  getRandomInt,
  getInterfaceId,
  mapValues,
};
