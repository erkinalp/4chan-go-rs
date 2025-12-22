-- Circuit Breaker implementation for upstream services
-- Provides fault tolerance and automatic recovery

local redis = require "resty.redis"
local cjson = require "cjson"

local _M = {}

-- Configuration
local REDIS_HOST = os.getenv("REDIS_HOST") or "redis"
local REDIS_PORT = tonumber(os.getenv("REDIS_PORT")) or 6379
local REDIS_TIMEOUT = 1000

-- Circuit breaker states
local STATE_CLOSED = "closed"      -- Normal operation
local STATE_OPEN = "open"          -- Failing, reject requests
local STATE_HALF_OPEN = "half_open" -- Testing if service recovered

-- Circuit breaker configuration per service
local CIRCUIT_CONFIG = {
    api = {
        failure_threshold = 5,      -- Failures before opening circuit
        success_threshold = 3,      -- Successes in half-open to close
        timeout = 30,               -- Seconds before trying half-open
        request_timeout = 60        -- Request timeout in seconds
    },
    auth = {
        failure_threshold = 3,
        success_threshold = 2,
        timeout = 20,
        request_timeout = 30
    },
    files = {
        failure_threshold = 5,
        success_threshold = 3,
        timeout = 30,
        request_timeout = 300
    },
    media = {
        failure_threshold = 5,
        success_threshold = 3,
        timeout = 60,
        request_timeout = 600
    },
    frontend = {
        failure_threshold = 5,
        success_threshold = 3,
        timeout = 30,
        request_timeout = 30
    }
}

local function connect_redis()
    local red = redis:new()
    red:set_timeout(REDIS_TIMEOUT)
    
    local ok, err = red:connect(REDIS_HOST, REDIS_PORT)
    if not ok then
        ngx.log(ngx.ERR, "Circuit breaker: Failed to connect to Redis: ", err)
        return nil
    end
    
    return red
end

local function get_service_from_uri(uri)
    if string.match(uri, "^/api/v1/auth/") then
        return "auth"
    elseif string.match(uri, "^/api/v1/files/") then
        return "files"
    elseif string.match(uri, "^/api/v1/media/") then
        return "media"
    elseif string.match(uri, "^/api/v1/") then
        return "api"
    else
        return "frontend"
    end
end

local function get_circuit_state(red, service)
    local state_key = "circuit:" .. service .. ":state"
    local state = red:get(state_key)
    
    if state == ngx.null then
        return STATE_CLOSED
    end
    
    return state
end

local function set_circuit_state(red, service, state, ttl)
    local state_key = "circuit:" .. service .. ":state"
    if ttl then
        red:setex(state_key, ttl, state)
    else
        red:set(state_key, state)
    end
end

local function get_failure_count(red, service)
    local count_key = "circuit:" .. service .. ":failures"
    local count = red:get(count_key)
    
    if count == ngx.null then
        return 0
    end
    
    return tonumber(count) or 0
end

local function increment_failure_count(red, service)
    local count_key = "circuit:" .. service .. ":failures"
    local count = red:incr(count_key)
    red:expire(count_key, 120) -- Reset after 2 minutes of no failures
    return count
end

local function reset_failure_count(red, service)
    local count_key = "circuit:" .. service .. ":failures"
    red:del(count_key)
end

local function get_success_count(red, service)
    local count_key = "circuit:" .. service .. ":successes"
    local count = red:get(count_key)
    
    if count == ngx.null then
        return 0
    end
    
    return tonumber(count) or 0
end

local function increment_success_count(red, service)
    local count_key = "circuit:" .. service .. ":successes"
    local count = red:incr(count_key)
    red:expire(count_key, 120)
    return count
end

local function reset_success_count(red, service)
    local count_key = "circuit:" .. service .. ":successes"
    red:del(count_key)
end

-- Check if request should be allowed through
function _M.check_circuit(service)
    if not service then
        service = get_service_from_uri(ngx.var.uri)
    end
    
    local config = CIRCUIT_CONFIG[service]
    if not config then
        return true -- Allow if no config
    end
    
    local red = connect_redis()
    if not red then
        return true -- Allow if Redis unavailable (fail open)
    end
    
    local state = get_circuit_state(red, service)
    
    if state == STATE_OPEN then
        -- Check if timeout has passed
        local timeout_key = "circuit:" .. service .. ":open_time"
        local open_time = red:get(timeout_key)
        
        if open_time ~= ngx.null then
            local elapsed = ngx.time() - tonumber(open_time)
            if elapsed >= config.timeout then
                -- Transition to half-open
                set_circuit_state(red, service, STATE_HALF_OPEN)
                reset_success_count(red, service)
                ngx.log(ngx.WARN, "Circuit breaker: ", service, " transitioning to half-open")
                red:set_keepalive(10000, 100)
                return true
            end
        end
        
        red:set_keepalive(10000, 100)
        ngx.log(ngx.WARN, "Circuit breaker: ", service, " is OPEN, rejecting request")
        return false
    end
    
    red:set_keepalive(10000, 100)
    return true
end

-- Record a successful request
function _M.record_success(service)
    if not service then
        service = get_service_from_uri(ngx.var.uri)
    end
    
    local config = CIRCUIT_CONFIG[service]
    if not config then
        return
    end
    
    local red = connect_redis()
    if not red then
        return
    end
    
    local state = get_circuit_state(red, service)
    
    if state == STATE_HALF_OPEN then
        local successes = increment_success_count(red, service)
        if successes >= config.success_threshold then
            -- Close the circuit
            set_circuit_state(red, service, STATE_CLOSED)
            reset_failure_count(red, service)
            reset_success_count(red, service)
            ngx.log(ngx.INFO, "Circuit breaker: ", service, " closed after successful recovery")
        end
    elseif state == STATE_CLOSED then
        -- Reset failure count on success
        reset_failure_count(red, service)
    end
    
    red:set_keepalive(10000, 100)
end

-- Record a failed request
function _M.record_failure(service)
    if not service then
        service = get_service_from_uri(ngx.var.uri)
    end
    
    local config = CIRCUIT_CONFIG[service]
    if not config then
        return
    end
    
    local red = connect_redis()
    if not red then
        return
    end
    
    local state = get_circuit_state(red, service)
    
    if state == STATE_HALF_OPEN then
        -- Immediately open circuit on failure in half-open state
        set_circuit_state(red, service, STATE_OPEN, config.timeout + 60)
        red:setex("circuit:" .. service .. ":open_time", config.timeout + 60, ngx.time())
        reset_success_count(red, service)
        ngx.log(ngx.WARN, "Circuit breaker: ", service, " reopened after failure in half-open state")
    elseif state == STATE_CLOSED then
        local failures = increment_failure_count(red, service)
        if failures >= config.failure_threshold then
            -- Open the circuit
            set_circuit_state(red, service, STATE_OPEN, config.timeout + 60)
            red:setex("circuit:" .. service .. ":open_time", config.timeout + 60, ngx.time())
            ngx.log(ngx.WARN, "Circuit breaker: ", service, " opened after ", failures, " failures")
        end
    end
    
    red:set_keepalive(10000, 100)
end

-- Get circuit breaker status for monitoring
function _M.get_status(service)
    local red = connect_redis()
    if not red then
        return { state = "unknown", error = "Redis unavailable" }
    end
    
    local state = get_circuit_state(red, service)
    local failures = get_failure_count(red, service)
    local successes = get_success_count(red, service)
    local config = CIRCUIT_CONFIG[service] or {}
    
    red:set_keepalive(10000, 100)
    
    return {
        service = service,
        state = state,
        failures = failures,
        successes = successes,
        failure_threshold = config.failure_threshold,
        success_threshold = config.success_threshold,
        timeout = config.timeout
    }
end

-- Reject request when circuit is open
function _M.reject_request(service)
    ngx.status = 503
    ngx.header.content_type = "application/json"
    ngx.header["Retry-After"] = CIRCUIT_CONFIG[service] and CIRCUIT_CONFIG[service].timeout or 30
    ngx.say(cjson.encode({
        error = "Service Unavailable",
        message = "Circuit breaker is open for " .. (service or "unknown") .. " service",
        retry_after = CIRCUIT_CONFIG[service] and CIRCUIT_CONFIG[service].timeout or 30
    }))
    ngx.exit(503)
end

return _M
