
local redis = require "resty.redis"
local cjson = require "cjson"

local _M = {}

local REDIS_HOST = os.getenv("REDIS_HOST") or "redis"
local REDIS_PORT = tonumber(os.getenv("REDIS_PORT")) or 6379
local REDIS_TIMEOUT = 1000

local RATE_LIMITS = {
    api = { requests = 10, window = 60 },
    auth = { requests = 5, window = 60 },
    files = { requests = 20, window = 60 },
    global = { requests = 50, window = 60 }
}

local function get_client_ip()
    local ip = ngx.var.http_x_real_ip or ngx.var.http_x_forwarded_for or ngx.var.remote_addr
    if ip and string.find(ip, ",") then
        ip = string.match(ip, "([^,]+)")
    end
    return ip or "unknown"
end

local function get_rate_limit_type(uri)
    if string.match(uri, "^/api/v1/auth/") then
        return "auth"
    elseif string.match(uri, "^/api/v1/files/") then
        return "files"
    elseif string.match(uri, "^/api/v1/") then
        return "api"
    else
        return "global"
    end
end

local function connect_redis()
    local red = redis:new()
    red:set_timeout(REDIS_TIMEOUT)
    
    local ok, err = red:connect(REDIS_HOST, REDIS_PORT)
    if not ok then
        ngx.log(ngx.ERR, "Failed to connect to Redis: ", err)
        return nil
    end
    
    return red
end

local function get_user_window_offset(red, ip)
    local offset_key = "rate_limit:user_offset:" .. ip
    local offset = red:get(offset_key)
    
    if offset == ngx.null then
        local current_time = ngx.time()
        red:set(offset_key, current_time)
        return current_time
    else
        return tonumber(offset) or ngx.time()
    end
end

local function is_blocked_and_extend(red, ip, limit_type, window_seconds)
    local block_key = "rate_limit:block:" .. limit_type .. ":" .. ip
    local blocked = red:get(block_key)
    
    if blocked and blocked ~= ngx.null then
        red:setex(block_key, window_seconds, "blocked")
        ngx.log(ngx.WARN, "IP ", ip, " attempted request during block period, extending block for full window (", window_seconds, " seconds) on ", limit_type)
        return true
    end
    
    return false
end

local function block_ip(red, ip, limit_type, window_seconds)
    local block_key = "rate_limit:block:" .. limit_type .. ":" .. ip
    local block_end_key = "rate_limit:block_end:" .. limit_type .. ":" .. ip
    local current_time = ngx.time()
    local block_end_time = current_time + window_seconds
    
    red:setex(block_key, window_seconds, "blocked")
    red:setex(block_end_key, window_seconds + 60, block_end_time)
    
    ngx.log(ngx.WARN, "IP ", ip, " blocked for full window (", window_seconds, " seconds) due to rate limit violation on ", limit_type)
end

local function calculate_window_start(current_time, user_offset, window_seconds, ip, limit_type, red)
    local block_end_key = "rate_limit:block_end:" .. limit_type .. ":" .. ip
    local last_block_end = red:get(block_end_key)
    
    if last_block_end and last_block_end ~= ngx.null then
        last_block_end = tonumber(last_block_end)
        if last_block_end and last_block_end > user_offset then
            local windows_since_block = math.floor((current_time - last_block_end) / window_seconds)
            return last_block_end + (windows_since_block * window_seconds)
        end
    end
    
    local windows_since_creation = math.floor((current_time - user_offset) / window_seconds)
    return user_offset + (windows_since_creation * window_seconds)
end

function _M.check_rate_limit()
    local ip = get_client_ip()
    local uri = ngx.var.uri
    local limit_type = get_rate_limit_type(uri)
    local config = RATE_LIMITS[limit_type]
    
    if not config then
        ngx.log(ngx.ERR, "No rate limit config for type: ", limit_type)
        return
    end
    
    local red = connect_redis()
    if not red then
        ngx.log(ngx.ERR, "Redis unavailable, denying request (fail-closed)")
        ngx.status = 503
        ngx.header.content_type = "application/json"
        ngx.say(cjson.encode({
            error = "Service temporarily unavailable",
            message = "Rate limiter backend unavailable"
        }))
        return ngx.exit(503)
    end
    
    if is_blocked_and_extend(red, ip, limit_type, config.window) then
        red:set_keepalive(10000, 100)
        ngx.status = 429
        ngx.header.content_type = "application/json"
        ngx.say(cjson.encode({
            error = "Rate limit exceeded",
            message = "IP blocked due to rate limit violation - block extended for full window",
            type = limit_type,
            retry_after = "Please wait for the full window duration"
        }))
        ngx.exit(429)
    end
    
    local current_time = ngx.time()
    local user_offset = get_user_window_offset(red, ip)
    local window_start = calculate_window_start(current_time, user_offset, config.window, ip, limit_type, red)
    local count_key = "rate_limit:count:" .. limit_type .. ":" .. ip .. ":" .. window_start
    
    -- Use atomic INCR to avoid race conditions between concurrent requests
    local current_count, err = red:incr(count_key)
    if not current_count then
        ngx.log(ngx.ERR, "Failed to increment rate limit counter: ", err)
        red:set_keepalive(10000, 100)
        return
    end
    
    -- Set TTL on first increment (when count becomes 1)
    if current_count == 1 then
        local window_end = window_start + config.window
        local ttl = window_end - current_time
        if ttl > 0 then
            red:expire(count_key, ttl)
        end
    end
    
    if current_count > config.requests then
        block_ip(red, ip, limit_type, config.window)
        red:set_keepalive(10000, 100)
        
        ngx.status = 429
        ngx.header.content_type = "application/json"
        ngx.say(cjson.encode({
            error = "Rate limit exceeded",
            message = "Request limit exceeded, IP blocked for full window",
            type = limit_type,
            limit = config.requests,
            window = config.window,
            current_count = current_count
        }))
        ngx.exit(429)
    end
    
    local window_end = window_start + config.window
    
    ngx.header["X-RateLimit-Type"] = limit_type
    ngx.header["X-RateLimit-Limit"] = config.requests
    ngx.header["X-RateLimit-Remaining"] = math.max(0, config.requests - current_count)
    ngx.header["X-RateLimit-Reset"] = window_end
    
    red:set_keepalive(10000, 100)
end

return _M
