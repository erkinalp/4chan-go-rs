-- GNAP Token Introspection and Role-Based Access Control
-- Implements gateway-level authentication and authorization

local redis = require "resty.redis"
local http = require "resty.http"
local cjson = require "cjson"

local _M = {}

-- Configuration
local REDIS_HOST = os.getenv("REDIS_HOST") or "redis"
local REDIS_PORT = tonumber(os.getenv("REDIS_PORT")) or 6379
local REDIS_TIMEOUT = 1000

local GNAP_SERVER_URL = os.getenv("GNAP_SERVER_URL") or "http://auth:3000"
local GNAP_INTROSPECT_PATH = "/gnap/introspect"

-- Token cache TTL in seconds (5 minutes)
local TOKEN_CACHE_TTL = 300

-- Role hierarchy for authorization
local ROLE_HIERARCHY = {
    ADMIN = 100,
    MODERATOR = 50,
    USER = 10,
    ANONYMOUS = 0
}

-- Endpoint role requirements
local ENDPOINT_ROLES = {
    -- Admin-only endpoints
    ["/api/v1/admin/"] = { "ADMIN" },
    ["/api/v1/moderation/bans/"] = { "ADMIN", "MODERATOR" },
    ["/api/v1/moderation/reports/"] = { "ADMIN", "MODERATOR" },
    
    -- Moderator endpoints
    ["/api/v1/moderation/"] = { "ADMIN", "MODERATOR" },
    
    -- User endpoints (authenticated users)
    ["/api/v1/posts/create"] = { "ADMIN", "MODERATOR", "USER" },
    ["/api/v1/threads/create"] = { "ADMIN", "MODERATOR", "USER" },
    ["/api/v1/files/upload"] = { "ADMIN", "MODERATOR", "USER" },
    ["/api/v1/media/upload"] = { "ADMIN", "MODERATOR", "USER" },
    ["/api/v1/users/me"] = { "ADMIN", "MODERATOR", "USER" },
    
    -- Public endpoints (no auth required) - handled separately
}

-- Public endpoints that don't require authentication
local PUBLIC_ENDPOINTS = {
    "/health",
    "/api/v1/health",
    "/api/v1/boards",
    "/api/v1/threads",
    "/api/v1/posts",
    "/api/v1/files/public/",
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/refresh",
    "/nginx_status",
    "/metrics"
}

local function connect_redis()
    local red = redis:new()
    red:set_timeout(REDIS_TIMEOUT)
    
    local ok, err = red:connect(REDIS_HOST, REDIS_PORT)
    if not ok then
        ngx.log(ngx.ERR, "GNAP Auth: Failed to connect to Redis: ", err)
        return nil
    end
    
    return red
end

local function is_public_endpoint(uri)
    for _, pattern in ipairs(PUBLIC_ENDPOINTS) do
        if string.sub(uri, 1, #pattern) == pattern then
            return true
        end
    end
    -- Also check for read-only board/thread/post access (GET requests)
    if ngx.var.request_method == "GET" then
        if string.match(uri, "^/api/v1/boards") or
           string.match(uri, "^/api/v1/threads/%d+$") or
           string.match(uri, "^/api/v1/posts/%d+$") then
            return true
        end
    end
    return false
end

local function get_required_roles(uri)
    -- Check exact matches first
    for pattern, roles in pairs(ENDPOINT_ROLES) do
        if string.sub(uri, 1, #pattern) == pattern then
            return roles
        end
    end
    
    -- Default: require at least USER role for non-public endpoints
    return { "ADMIN", "MODERATOR", "USER" }
end

local function has_required_role(user_role, required_roles)
    if not user_role or not required_roles then
        return false
    end
    
    for _, role in ipairs(required_roles) do
        if user_role == role then
            return true
        end
    end
    
    return false
end

local function extract_token(auth_header)
    if not auth_header then
        return nil
    end
    
    local token = string.match(auth_header, "^Bearer%s+(.+)$")
    return token
end

local function get_cached_token_info(red, token)
    local cache_key = "gnap:token:" .. ngx.md5(token)
    local cached = red:get(cache_key)
    
    if cached and cached ~= ngx.null then
        local ok, info = pcall(cjson.decode, cached)
        if ok then
            return info
        end
    end
    
    return nil
end

local function cache_token_info(red, token, info)
    local cache_key = "gnap:token:" .. ngx.md5(token)
    local ok, json = pcall(cjson.encode, info)
    if ok then
        red:setex(cache_key, TOKEN_CACHE_TTL, json)
    end
end

local function invalidate_token_cache(red, token)
    local cache_key = "gnap:token:" .. ngx.md5(token)
    red:del(cache_key)
end

local function introspect_token(token)
    local httpc = http.new()
    httpc:set_timeout(5000)
    
    local res, err = httpc:request_uri(GNAP_SERVER_URL .. GNAP_INTROSPECT_PATH, {
        method = "POST",
        headers = {
            ["Content-Type"] = "application/json",
            ["Accept"] = "application/json"
        },
        body = cjson.encode({
            access_token = token
        })
    })
    
    if not res then
        ngx.log(ngx.ERR, "GNAP Auth: Token introspection failed: ", err)
        return nil, "introspection_failed"
    end
    
    if res.status ~= 200 then
        ngx.log(ngx.WARN, "GNAP Auth: Token introspection returned status ", res.status)
        return nil, "invalid_token"
    end
    
    local ok, body = pcall(cjson.decode, res.body)
    if not ok then
        ngx.log(ngx.ERR, "GNAP Auth: Failed to parse introspection response")
        return nil, "parse_error"
    end
    
    return body, nil
end

-- Main authentication function
function _M.authenticate()
    local uri = ngx.var.uri
    local request_id = ngx.var.request_id or ngx.var.http_x_request_id or "-"
    
    -- Check if endpoint is public
    if is_public_endpoint(uri) then
        ngx.log(ngx.DEBUG, "GNAP Auth: Public endpoint, skipping auth: ", uri)
        return true
    end
    
    -- Extract token from Authorization header
    local auth_header = ngx.var.http_authorization
    local token = extract_token(auth_header)
    
    if not token then
        ngx.log(ngx.WARN, "GNAP Auth: Missing or invalid Authorization header [", request_id, "]")
        return false, "missing_token"
    end
    
    -- Connect to Redis for caching
    local red = connect_redis()
    local token_info = nil
    
    -- Try to get cached token info
    if red then
        token_info = get_cached_token_info(red, token)
        if token_info then
            ngx.log(ngx.DEBUG, "GNAP Auth: Using cached token info [", request_id, "]")
        end
    end
    
    -- If not cached, introspect the token
    if not token_info then
        local err
        token_info, err = introspect_token(token)
        
        if not token_info then
            if red then
                red:set_keepalive(10000, 100)
            end
            return false, err or "invalid_token"
        end
        
        -- Cache the token info
        if red and token_info.active then
            cache_token_info(red, token, token_info)
        end
    end
    
    -- Check if token is active
    if not token_info.active then
        if red then
            invalidate_token_cache(red, token)
            red:set_keepalive(10000, 100)
        end
        return false, "token_inactive"
    end
    
    -- Check token expiration
    if token_info.exp and token_info.exp < ngx.time() then
        if red then
            invalidate_token_cache(red, token)
            red:set_keepalive(10000, 100)
        end
        return false, "token_expired"
    end
    
    -- Get required roles for this endpoint
    local required_roles = get_required_roles(uri)
    local user_role = token_info.role or "USER"
    
    -- Check role-based access
    if not has_required_role(user_role, required_roles) then
        if red then
            red:set_keepalive(10000, 100)
        end
        ngx.log(ngx.WARN, "GNAP Auth: Insufficient permissions. User role: ", user_role, 
                ", Required: ", table.concat(required_roles, ","), " [", request_id, "]")
        return false, "insufficient_permissions"
    end
    
    -- Set user context headers for downstream services
    ngx.req.set_header("X-User-ID", token_info.sub or "")
    ngx.req.set_header("X-User-Role", user_role)
    ngx.req.set_header("X-User-Email", token_info.email or "")
    
    if red then
        red:set_keepalive(10000, 100)
    end
    
    ngx.log(ngx.DEBUG, "GNAP Auth: Authentication successful for user ", 
            token_info.sub, " with role ", user_role, " [", request_id, "]")
    
    return true
end

-- Reject request with appropriate error
function _M.reject_request(reason)
    local status = 401
    local error_msg = "Authentication required"
    local error_code = "unauthorized"
    
    if reason == "missing_token" then
        error_msg = "Authorization header is required"
        error_code = "missing_authorization"
    elseif reason == "invalid_token" then
        error_msg = "Invalid or malformed token"
        error_code = "invalid_token"
    elseif reason == "token_expired" then
        error_msg = "Token has expired"
        error_code = "token_expired"
    elseif reason == "token_inactive" then
        error_msg = "Token is no longer active"
        error_code = "token_inactive"
    elseif reason == "insufficient_permissions" then
        status = 403
        error_msg = "Insufficient permissions for this resource"
        error_code = "forbidden"
    elseif reason == "introspection_failed" then
        status = 503
        error_msg = "Authentication service unavailable"
        error_code = "service_unavailable"
    end
    
    ngx.status = status
    ngx.header.content_type = "application/json"
    ngx.header["WWW-Authenticate"] = 'Bearer realm="4chan-api", error="' .. error_code .. '"'
    ngx.say(cjson.encode({
        error = error_code,
        message = error_msg,
        status = status
    }))
    ngx.exit(status)
end

-- Check authentication and reject if failed
function _M.check_auth()
    local ok, reason = _M.authenticate()
    if not ok then
        _M.reject_request(reason)
    end
end

return _M
