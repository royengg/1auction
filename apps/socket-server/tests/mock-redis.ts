import { vi } from "vitest";
import type { RoomParticipant } from "@auction/shared";

export type RedisHash = Record<string, Record<string, string>>;
export type RedisSets = Record<string, Set<string>>;
export type RedisLists = Record<string, string[]>;

export interface MockRedisState {
  hashes: RedisHash;
  sets: RedisSets;
  lists: RedisLists;
  published: { channel: string; message: string }[];
}

export function createMockRedisState(): MockRedisState {
  return {
    hashes: {},
    sets: {},
    lists: {},
    published: [],
  };
}

export function createMockRedis(state: MockRedisState) {
  const hset = (key: string, ...args: unknown[]): number => {
    if (!state.hashes[key]) state.hashes[key] = {};
    if (args.length === 1 && typeof args[0] === "object" && args[0] !== null) {
      const obj = args[0] as Record<string, unknown>;
      for (const [field, value] of Object.entries(obj)) {
        state.hashes[key][field] = String(value);
      }
    } else {
      for (let i = 0; i < args.length; i += 2) {
        const field = String(args[i]);
        const value = String(args[i + 1]);
        state.hashes[key][field] = value;
      }
    }
    return 1;
  };

  const hget = (key: string, field: string): string | null => {
    return state.hashes[key]?.[field] ?? null;
  };

  const hgetall = (key: string): Record<string, string> => {
    return state.hashes[key] ?? {};
  };

  const hexists = (key: string, field: string): number => {
    return state.hashes[key]?.[field] !== undefined ? 1 : 0;
  };

  const hdel = (key: string, ...fields: string[]): number => {
    if (!state.hashes[key]) return 0;
    let deleted = 0;
    for (const f of fields) {
      if (f in state.hashes[key]) {
        delete state.hashes[key][f];
        deleted++;
      }
    }
    return deleted;
  };

  const sadd = (key: string, ...members: string[]): number => {
    if (!state.sets[key]) state.sets[key] = new Set();
    let added = 0;
    for (const m of members) {
      if (!state.sets[key].has(m)) {
        state.sets[key].add(m);
        added++;
      }
    }
    return added;
  };

  const srem = (key: string, ...members: string[]): number => {
    if (!state.sets[key]) return 0;
    let removed = 0;
    for (const m of members) {
      if (state.sets[key].has(m)) {
        state.sets[key].delete(m);
        removed++;
      }
    }
    return removed;
  };

  const smembers = (key: string): string[] => {
    return state.sets[key] ? Array.from(state.sets[key]) : [];
  };

  const expire = (): number => 1;

  const rpush = (key: string, ...values: string[]): number => {
    if (!state.lists[key]) state.lists[key] = [];
    state.lists[key].push(...values);
    return state.lists[key].length;
  };

  const lrange = (key: string, start: number, stop: number): string[] => {
    if (!state.lists[key]) return [];
    const list = state.lists[key];
    const end = stop === -1 ? list.length : stop + 1;
    return list.slice(start, end);
  };

  const del = (...keys: string[]): number => {
    let deleted = 0;
    for (const k of keys) {
      if (state.hashes[k]) {
        delete state.hashes[k];
        deleted++;
      }
      if (state.sets[k]) {
        delete state.sets[k];
        deleted++;
      }
      if (state.lists[k]) {
        delete state.lists[k];
        deleted++;
      }
    }
    return deleted;
  };

  const publish = (channel: string, message: string): number => {
    state.published.push({ channel, message });
    return 1;
  };

  const ping = (): string => "PONG";

  const quit = (): string => "OK";

  const duplicate = () => createMockRedis(state);

  const on = () => {};

  const evalScript = vi.fn((script: string, numkeys: number, ...args: string[]) => {
    return simulateBidScript(state, numkeys, args);
  });

  return {
    hset,
    hget,
    hgetall,
    hexists,
    hdel,
    sadd,
    srem,
    smembers,
    expire,
    rpush,
    lrange,
    del,
    publish,
    ping,
    quit,
    duplicate,
    on,
    eval: evalScript,
  };
}

function simulateBidScript(
  state: MockRedisState,
  numkeys: number,
  args: string[],
): string[] {
  const itemKey = args[0];
  const biddersKey = args[1];
  const bidderId = args[2];
  const bidderName = args[3];
  const amount = Number(args[4]);
  const minIncrement = Number(args[5]);
  const nowMs = Number(args[6]);
  const isoNow = args[7];

  const ERR = (reason: string, extra = ""): string[] => [
    "error",
    reason,
    extra,
    "",
    "",
    "",
  ];

  const itemHash = state.hashes[itemKey];
  if (!itemHash || itemHash.status !== "ACTIVE") {
    return ERR("ITEM_NOT_ACTIVE");
  }

  if (itemHash.paused === "1") {
    return ERR("ROOM_PAUSED");
  }

  const endsAt = Number(itemHash.endsAt ?? 0);
  if (endsAt > 0 && endsAt <= nowMs) {
    return ERR("TIMER_EXPIRED");
  }

  const bidderJson = state.hashes[biddersKey]?.[bidderId];
  if (!bidderJson) {
    return ERR("NOT_AUTHENTICATED");
  }

  const bidder = JSON.parse(bidderJson) as RoomParticipant;
  if (bidder.role === "AUCTIONEER") {
    return ERR("AUCTIONEER_CANNOT_BID");
  }

  if (bidder.available < amount) {
    return ERR("INSUFFICIENT_BUDGET");
  }

  const prevHighId = itemHash.highBidUserId ?? "";
  const prevHighAmount = Number(itemHash.highBidAmount ?? 0);
  const startingPrice = Number(itemHash.startingPrice ?? 0);

  if (prevHighId === bidderId) {
    return ERR("ALREADY_HIGH_BIDDER");
  }

  const minRequired =
    prevHighId && prevHighId !== ""
      ? prevHighAmount + minIncrement
      : startingPrice;

  if (amount < minRequired) {
    return ERR("BID_TOO_LOW", String(minRequired));
  }

  let prevReleasedJson = "";

  if (prevHighId && prevHighId !== "") {
    const prevJson = state.hashes[biddersKey]?.[prevHighId];
    if (prevJson) {
      const prev = JSON.parse(prevJson) as RoomParticipant;
      prev.reserved = Math.max(0, prev.reserved - prevHighAmount);
      prev.available = prev.available + prevHighAmount;
      state.hashes[biddersKey][prevHighId] = JSON.stringify(prev);
      prevReleasedJson = JSON.stringify(prev);
    }
  }

  bidder.reserved = amount;
  bidder.available = Math.max(0, bidder.available - amount);
  state.hashes[biddersKey][bidderId] = JSON.stringify(bidder);

  state.hashes[itemKey].highBidUserId = bidderId;
  state.hashes[itemKey].highBidUserName = bidderName;
  state.hashes[itemKey].highBidAmount = String(amount);
  state.hashes[itemKey].highBidPlacedAtMs = String(nowMs);

  const highBid = JSON.stringify({
    userId: bidderId,
    userName: bidderName,
    amount,
    placedAt: isoNow,
  });

  return [
    "ok",
    String(amount),
    prevHighId,
    JSON.stringify(bidder),
    prevReleasedJson,
    highBid,
  ];
}
