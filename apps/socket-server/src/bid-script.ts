export const BID_SCRIPT = `
local itemKey = KEYS[1]
local biddersKey = KEYS[2]

local bidderId = ARGV[1]
local bidderName = ARGV[2]
local amount = tonumber(ARGV[3])
local minIncrement = tonumber(ARGV[4])
local nowMs = tonumber(ARGV[5])
local isoNow = ARGV[6]

local prevReleasedJson = ''

local status = redis.call('HGET', itemKey, 'status')
if status ~= 'ACTIVE' then
  return {'error', 'ITEM_NOT_ACTIVE', '', '', '', ''}
end

local paused = redis.call('HGET', itemKey, 'paused')
if paused == '1' then
  return {'error', 'ROOM_PAUSED', '', '', '', ''}
end

local endsAt = tonumber(redis.call('HGET', itemKey, 'endsAt')) or 0
if endsAt > 0 and endsAt <= nowMs then
  return {'error', 'TIMER_EXPIRED', '', '', '', ''}
end

local bidderJson = redis.call('HGET', biddersKey, bidderId)
if not bidderJson then
  return {'error', 'NOT_AUTHENTICATED', '', '', '', ''}
end

local bidder = cjson.decode(bidderJson)
if bidder.role == 'AUCTIONEER' then
  return {'error', 'AUCTIONEER_CANNOT_BID', '', '', '', ''}
end

local available = tonumber(bidder.available) or 0
if available < amount then
  return {'error', 'INSUFFICIENT_BUDGET', '', '', '', ''}
end

local prevHighId = redis.call('HGET', itemKey, 'highBidUserId') or ''
local prevHighAmount = tonumber(redis.call('HGET', itemKey, 'highBidAmount')) or 0
local startingPrice = tonumber(redis.call('HGET', itemKey, 'startingPrice')) or 0

if prevHighId == bidderId then
  return {'error', 'ALREADY_HIGH_BIDDER', '', '', '', ''}
end

local minRequired
if prevHighId and prevHighId ~= '' then
  minRequired = prevHighAmount + minIncrement
else
  minRequired = startingPrice
end

if amount < minRequired then
  return {'error', 'BID_TOO_LOW', tostring(minRequired), '', '', ''}
end

if prevHighId and prevHighId ~= '' then
  local prevJson = redis.call('HGET', biddersKey, prevHighId)
  if prevJson then
    local prev = cjson.decode(prevJson)
    prev.reserved = math.max(0, tonumber(prev.reserved) - prevHighAmount)
    prev.available = tonumber(prev.available) + prevHighAmount
    redis.call('HSET', biddersKey, prevHighId, cjson.encode(prev))
    prevReleasedJson = cjson.encode(prev)
  end
end

bidder.reserved = amount
bidder.available = math.max(0, available - amount)
redis.call('HSET', biddersKey, bidderId, cjson.encode(bidder))

redis.call('HSET', itemKey,
  'highBidUserId', bidderId,
  'highBidUserName', bidderName,
  'highBidAmount', tostring(amount),
  'highBidPlacedAtMs', tostring(nowMs))

local highBid = cjson.encode({
  userId = bidderId,
  userName = bidderName,
  amount = amount,
  placedAt = isoNow,
})

return {
  'ok',
  tostring(amount),
  prevHighId or '',
  cjson.encode(bidder),
  prevReleasedJson,
  highBid,
}
` as string;