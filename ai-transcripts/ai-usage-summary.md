# AI Usage Summary

## Tools used
- OpenCode (primary — live coding session)


## What AI helped with
- Initial monorepo scaffolding (bun workspaces, Next.js 15, socket-server layout)
- Shared contract design (`packages/shared` types, zod schemas, socket event names)
- Architectural decisions (server-authoritative timer, Redis atomic bidding, JWT handshake)
- Dockerfile + docker-compose layout for Coolify

## Important manual decisions
- Chose self-hosted Redis over managed services for VPS/Coolify setup.
- Split the Socket.io server into its own service rather than attaching to Next.js, to keep realtime concerns clean and allow independent scaling.
- Used BetterAuth-issued JWT (instead of cookie sharing) to authenticate socket connections — couples auth to a token contract rather than DB session reads.
- Redis is source of truth for live state; Postgres for durable state. Bids persist asynchronously after Redis accepts.
- Wallet budget is per-room (snapshot at join) rather than global, avoiding cross-room contention.
- Role switching restricted to the dashboard (not mid-auction).

## Known limitations
- Phase 1 only: filesystem scaffold + placeholders. Realtime handlers are stubbed `todo` acks.
- No tests yet.
- No seed data yet.

## OpenCode share links
- (Add `/share` links here as sessions are produced.)

## Session transcripts
- See sibling files in `ai-transcripts/` for copied session exports.