import { chacha20 } from "@noble/ciphers/chacha.js";
import { describe, expect, test } from "vitest";

import { ChaChaStream } from "./chachaStream";

const take = (stream: ChaChaStream, n: number) =>
  Array.from({ length: n }, () => stream.uint32());

describe("ChaChaStream", () => {
  test("RFC 8439 A.1 test vector #1", () => {
    // Keystream for an all-zero key and nonce, block counter 0.
    const hex =
      "76b8e0ada0f13d90405d6ae55386bd28bdd219b8a08ded1aa836efcc8b770dc7" +
      "da41597c5157488d7724e03fb8d84a376a43b8f41518a11cc387b669b2ee6586";
    const bytes = Uint8Array.from(hex.match(/../g)!, (h) => parseInt(h, 16));
    const words = new DataView(bytes.buffer);
    const expected = Array.from({ length: 16 }, (_, i) =>
      words.getUint32(4 * i, true),
    );

    expect(take(new ChaChaStream(new Uint8Array(32)), 16)).toEqual(expected);
  });

  test("is the keystream, across buffer refills", () => {
    const key = Uint8Array.from({ length: 32 }, (_, i) => i);
    const n = 3000;
    const bytes = chacha20(key, new Uint8Array(12), new Uint8Array(4 * n));
    const words = new DataView(bytes.buffer, bytes.byteOffset);
    const expected = Array.from({ length: n }, (_, i) =>
      words.getUint32(4 * i, true),
    );

    expect(take(new ChaChaStream(key), n)).toEqual(expected);
  });

  test("rejects keys of the wrong size", () => {
    expect(() => new ChaChaStream(new Uint8Array(16))).toThrow();
  });

  test("fromSeed is reproducible", () => {
    expect(take(ChaChaStream.fromSeed("a"), 10)).toEqual(
      take(ChaChaStream.fromSeed("a"), 10),
    );
    expect(take(ChaChaStream.fromSeed("a"), 10)).not.toEqual(
      take(ChaChaStream.fromSeed("b"), 10),
    );
  });

  test("withRandomKey gives different streams", () => {
    expect(take(ChaChaStream.withRandomKey(), 10)).not.toEqual(
      take(ChaChaStream.withRandomKey(), 10),
    );
  });
});
