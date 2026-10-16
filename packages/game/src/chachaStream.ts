import { chacha20 } from "@noble/ciphers/chacha.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";

const KEY_SIZE = 32;

// In bytes, a multiple of the 64 bytes of a ChaCha20 block.
const BUFFER_SIZE = 4096;

/*
 * The ChaCha20 keystream (RFC 8439) of a key, as a source of random numbers.
 *
 * The nonce is fixed: each key only ever gives one stream, and nothing is encrypted
 * with it, so there is no nonce reuse to worry about.
 */
export class ChaChaStream {
  #key: Uint8Array;
  #nonce = new Uint8Array(12);
  #counter = 0;
  #buffer = new Uint8Array(0);
  #index = 0;

  // Reproducible, and predictable to anyone who knows the seed.
  static fromSeed(seed: string): ChaChaStream {
    return new ChaChaStream(sha256(utf8ToBytes(seed)));
  }

  static withRandomKey(): ChaChaStream {
    return new ChaChaStream(crypto.getRandomValues(new Uint8Array(KEY_SIZE)));
  }

  constructor(key: Uint8Array) {
    if (key.length !== KEY_SIZE) {
      throw new RangeError(`key must be ${KEY_SIZE} bytes, got ${key.length}`);
    }
    this.#key = key;
  }

  uint32(): number {
    if (this.#index === this.#buffer.length) {
      this.#buffer = chacha20(
        this.#key,
        this.#nonce,
        new Uint8Array(BUFFER_SIZE),
        undefined,
        this.#counter,
      );
      this.#counter += BUFFER_SIZE / 64;
      this.#index = 0;
    }
    const b = this.#buffer;
    const i = this.#index;
    this.#index += 4;
    // Little-endian regardless of the platform, so that seeded sequences are portable.
    return (
      (b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)) >>> 0
    );
  }
}
