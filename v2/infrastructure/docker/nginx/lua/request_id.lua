-- Request ID Generation and Propagation
-- Provides distributed tracing support across microservices

local _M = {}

-- Generate a unique request ID using UUID v4 format
local function generate_uuid()
    local template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
    return string.gsub(template, '[xy]', function(c)
        local v = (c == 'x') and math.random(0, 0xf) or math.random(8, 0xb)
        return string.format('%x', v)
    end)
end

-- Initialize random seed (call once at startup)
local function init_random()
    -- Use a combination of time and worker PID for better randomness
    local seed = ngx.now() * 1000 + ngx.worker.pid()
    math.randomseed(seed)
end

-- Initialize on module load
init_random()

-- Generate or extract request ID
function _M.get_or_create_request_id()
    -- Check if request ID already exists in incoming headers
    local request_id = ngx.var.http_x_request_id
    
    if not request_id or request_id == "" then
        -- Generate new request ID
        request_id = generate_uuid()
    end
    
    -- Store in nginx variable for logging
    ngx.var.request_id = request_id
    
    return request_id
end

-- Get or create correlation ID (for tracking across multiple requests)
function _M.get_or_create_correlation_id()
    -- Check if correlation ID exists in incoming headers
    local correlation_id = ngx.var.http_x_correlation_id
    
    if not correlation_id or correlation_id == "" then
        -- Use request ID as correlation ID if not provided
        correlation_id = ngx.var.request_id or _M.get_or_create_request_id()
    end
    
    return correlation_id
end

-- Set tracing headers for downstream services
function _M.set_tracing_headers()
    local request_id = _M.get_or_create_request_id()
    local correlation_id = _M.get_or_create_correlation_id()
    
    -- Set headers for upstream services
    ngx.req.set_header("X-Request-ID", request_id)
    ngx.req.set_header("X-Correlation-ID", correlation_id)
    
    -- Add span ID for distributed tracing (unique per request)
    local span_id = string.sub(generate_uuid(), 1, 16)
    ngx.req.set_header("X-Span-ID", span_id)
    
    -- Add trace timestamp
    ngx.req.set_header("X-Trace-Timestamp", tostring(ngx.now()))
    
    -- Store in context for response headers
    ngx.ctx.request_id = request_id
    ngx.ctx.correlation_id = correlation_id
    ngx.ctx.span_id = span_id
end

-- Set response headers for tracing
function _M.set_response_headers()
    local request_id = ngx.ctx.request_id or ngx.var.request_id
    local correlation_id = ngx.ctx.correlation_id
    
    if request_id then
        ngx.header["X-Request-ID"] = request_id
    end
    
    if correlation_id then
        ngx.header["X-Correlation-ID"] = correlation_id
    end
end

-- Get current request ID (for use in other modules)
function _M.get_request_id()
    return ngx.ctx.request_id or ngx.var.request_id or "-"
end

-- Get current correlation ID
function _M.get_correlation_id()
    return ngx.ctx.correlation_id or ngx.var.http_x_correlation_id or "-"
end

return _M
