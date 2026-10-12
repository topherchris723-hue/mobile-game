--!strict
-- Per-player token bucket. Each remote handler owns one limiter and calls Check before doing work.
-- Call Remove on PlayerRemoving so buckets do not leak.

local RateLimiter = {}
RateLimiter.__index = RateLimiter

type Bucket = { Tokens: number, LastRefill: number }

type RateLimiterData = {
	_capacity: number,
	_refillPerSecond: number,
	_buckets: { [Player]: Bucket },
}

export type RateLimiter = typeof(setmetatable({} :: RateLimiterData, RateLimiter))

-- capacity: burst size. refillPerSecond: sustained requests per second.
function RateLimiter.new(capacity: number, refillPerSecond: number): RateLimiter
	local self: RateLimiterData = {
		_capacity = capacity,
		_refillPerSecond = refillPerSecond,
		_buckets = {},
	}
	return setmetatable(self, RateLimiter)
end

function RateLimiter.Check(self: RateLimiter, player: Player): boolean
	local now = os.clock()
	local bucket = self._buckets[player]
	if not bucket then
		bucket = { Tokens = self._capacity, LastRefill = now }
		self._buckets[player] = bucket
	end
	bucket.Tokens = math.min(self._capacity, bucket.Tokens + (now - bucket.LastRefill) * self._refillPerSecond)
	bucket.LastRefill = now
	if bucket.Tokens < 1 then
		return false
	end
	bucket.Tokens -= 1
	return true
end

function RateLimiter.Remove(self: RateLimiter, player: Player)
	self._buckets[player] = nil
end

return RateLimiter
