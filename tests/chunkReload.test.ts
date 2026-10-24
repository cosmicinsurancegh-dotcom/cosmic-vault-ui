import { describe, expect, it } from "vitest";
import {
  CHUNK_RELOAD_KEY,
  CHUNK_RELOAD_WINDOW_MS,
  installChunkReloadOnPreloadError,
  shouldReloadForChunkError,
  type ChunkReloadTarget,
} from "../src/lib/chunkReload";

/**
 * A tab open across a deploy asks for a chunk hash the new build replaced. The
 * reload recovers it, but only once per window - otherwise a genuinely missing
 * chunk would reload forever.
 */
describe("shouldReloadForChunkError", () => {
  it("reloads when nothing was recorded", () => {
    expect(shouldReloadForChunkError(1_000, null)).toBe(true);
  });

  it("refuses a second reload inside the window", () => {
    expect(
      shouldReloadForChunkError(1_000 + CHUNK_RELOAD_WINDOW_MS - 1, 1_000),
    ).toBe(false);
  });

  it("allows another reload once the window has passed", () => {
    expect(
      shouldReloadForChunkError(1_000 + CHUNK_RELOAD_WINDOW_MS, 1_000),
    ).toBe(true);
  });

  it("treats a corrupted timestamp as no record", () => {
    expect(shouldReloadForChunkError(1_000, Number.NaN)).toBe(true);
  });
});

function fakeTarget(
  stored: string | null,
  options: { throwOnStorage?: boolean } = {},
) {
  const listeners = new Map<string, (event: Event) => void>();
  let reloads = 0;
  let written: string | null = stored;
  const target: ChunkReloadTarget = {
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    sessionStorage: {
      getItem() {
        if (options.throwOnStorage) throw new Error("storage disabled");
        return written;
      },
      setItem(_key, value) {
        if (options.throwOnStorage) throw new Error("storage disabled");
        written = value;
      },
    },
    location: {
      reload() {
        reloads += 1;
      },
    },
  };
  return {
    target,
    reloads: () => reloads,
    written: () => written,
    fire: () => {
      const listener = listeners.get("vite:preloadError");
      if (!listener) throw new Error("listener was not installed");
      const event = new Event("vite:preloadError", { cancelable: true });
      listener(event);
      return event;
    },
  };
}

describe("installChunkReloadOnPreloadError", () => {
  it("reloads once and records when it happened", () => {
    const fake = fakeTarget(null);
    installChunkReloadOnPreloadError(fake.target);

    const event = fake.fire();

    expect(fake.reloads()).toBe(1);
    expect(event.defaultPrevented).toBe(true);
    expect(fake.written()).toMatch(/^\d+$/);
    expect(CHUNK_RELOAD_KEY).toBe("cv.chunk-reload-at");
  });

  it("does not reload again inside the window", () => {
    const fake = fakeTarget(String(Date.now()));
    installChunkReloadOnPreloadError(fake.target);

    const event = fake.fire();

    expect(fake.reloads()).toBe(0);
    expect(event.defaultPrevented).toBe(false);
  });

  it("does nothing when storage is unavailable, so it cannot loop", () => {
    const fake = fakeTarget(null, { throwOnStorage: true });
    installChunkReloadOnPreloadError(fake.target);

    const event = fake.fire();

    expect(fake.reloads()).toBe(0);
    expect(event.defaultPrevented).toBe(false);
  });
});
