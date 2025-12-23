-- Prometheus Metrics Collection for API Gateway
-- Exposes metrics in Prometheus text format

local _M = {}

-- Shared dictionary for metrics storage
local metrics_dict = ngx.shared.prometheus_metrics

-- Metric definitions
local METRICS = {
    -- Counters
    http_requests_total = {
        type = "counter",
        help = "Total number of HTTP requests processed by the gateway",
        labels = {"method", "endpoint", "status", "service"}
    },
    http_request_errors_total = {
        type = "counter",
        help = "Total number of HTTP request errors",
        labels = {"method", "endpoint", "error_type", "service"}
    },
    rate_limit_hits_total = {
        type = "counter",
        help = "Total number of rate limit hits",
        labels = {"endpoint", "service"}
    },
    circuit_breaker_trips_total = {
        type = "counter",
        help = "Total number of circuit breaker trips",
        labels = {"service", "from_state", "to_state"}
    },
    auth_requests_total = {
        type = "counter",
        help = "Total number of authentication requests",
        labels = {"result", "endpoint"}
    },
    
    -- Histograms (using pre-defined buckets)
    http_request_duration_seconds = {
        type = "histogram",
        help = "HTTP request latencies in seconds",
        labels = {"method", "endpoint", "service"},
        buckets = {0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10}
    },
    upstream_response_time_seconds = {
        type = "histogram",
        help = "Upstream service response times in seconds",
        labels = {"service"},
        buckets = {0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10}
    },
    
    -- Gauges
    active_connections = {
        type = "gauge",
        help = "Number of active client connections",
        labels = {}
    },
    circuit_breaker_state = {
        type = "gauge",
        help = "Circuit breaker state (0=closed, 1=half_open, 2=open)",
        labels = {"service"}
    }
}

-- Initialize metrics storage
function _M.init()
    if not metrics_dict then
        ngx.log(ngx.ERR, "Metrics: prometheus_metrics shared dict not found")
        return false
    end
    
    -- Initialize all counters to 0
    for name, metric in pairs(METRICS) do
        if metric.type == "counter" or metric.type == "gauge" then
            local key = name .. "{}"
            local val = metrics_dict:get(key)
            if not val then
                metrics_dict:set(key, 0)
            end
        end
    end
    
    return true
end

-- Generate a metric key from name and labels
local function make_key(name, labels)
    if not labels or next(labels) == nil then
        return name .. "{}"
    end
    
    local parts = {}
    local sorted_keys = {}
    for k in pairs(labels) do
        table.insert(sorted_keys, k)
    end
    table.sort(sorted_keys)
    
    for _, k in ipairs(sorted_keys) do
        local v = labels[k] or ""
        -- Escape special characters in label values
        v = string.gsub(tostring(v), '\\', '\\\\')
        v = string.gsub(v, '"', '\\"')
        v = string.gsub(v, '\n', '\\n')
        table.insert(parts, k .. '="' .. v .. '"')
    end
    
    return name .. "{" .. table.concat(parts, ",") .. "}"
end

-- Increment a counter
function _M.inc(name, labels, value)
    if not metrics_dict then return end
    
    value = value or 1
    local key = make_key(name, labels)
    
    local newval, err = metrics_dict:incr(key, value, 0)
    if err then
        ngx.log(ngx.ERR, "Metrics: Failed to increment ", key, ": ", err)
    end
end

-- Set a gauge value
function _M.set(name, labels, value)
    if not metrics_dict then return end
    
    local key = make_key(name, labels)
    local ok, err = metrics_dict:set(key, value)
    if not ok then
        ngx.log(ngx.ERR, "Metrics: Failed to set ", key, ": ", err)
    end
end

-- Add a gauge value
function _M.add(name, labels, value)
    if not metrics_dict then return end
    
    local key = make_key(name, labels)
    local newval, err = metrics_dict:incr(key, value, 0)
    if err then
        ngx.log(ngx.ERR, "Metrics: Failed to add to ", key, ": ", err)
    end
end

-- Observe a histogram value
function _M.observe(name, labels, value)
    if not metrics_dict then return end
    
    local metric = METRICS[name]
    if not metric or metric.type ~= "histogram" then
        ngx.log(ngx.ERR, "Metrics: ", name, " is not a histogram")
        return
    end
    
    -- Increment the sum
    local sum_key = make_key(name .. "_sum", labels)
    metrics_dict:incr(sum_key, value, 0)
    
    -- Increment the count
    local count_key = make_key(name .. "_count", labels)
    metrics_dict:incr(count_key, 1, 0)
    
    -- Increment bucket counters
    for _, bucket in ipairs(metric.buckets) do
        if value <= bucket then
            local bucket_labels = {}
            for k, v in pairs(labels or {}) do
                bucket_labels[k] = v
            end
            bucket_labels["le"] = tostring(bucket)
            local bucket_key = make_key(name .. "_bucket", bucket_labels)
            metrics_dict:incr(bucket_key, 1, 0)
        end
    end
    
    -- Always increment +Inf bucket
    local inf_labels = {}
    for k, v in pairs(labels or {}) do
        inf_labels[k] = v
    end
    inf_labels["le"] = "+Inf"
    local inf_key = make_key(name .. "_bucket", inf_labels)
    metrics_dict:incr(inf_key, 1, 0)
end

-- Get service name from URI
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

-- Normalize endpoint for metrics (remove IDs, etc.)
local function normalize_endpoint(uri)
    -- Replace numeric IDs with :id placeholder
    local normalized = string.gsub(uri, "/(%d+)", "/:id")
    -- Replace UUIDs with :uuid placeholder
    normalized = string.gsub(normalized, "/([a-f0-9%-]+%-[a-f0-9%-]+)", "/:uuid")
    -- Truncate query string
    normalized = string.gsub(normalized, "%?.*$", "")
    return normalized
end

-- Record request metrics (call in log_by_lua)
function _M.record_request()
    local method = ngx.var.request_method or "UNKNOWN"
    local uri = ngx.var.uri or "/"
    local status = ngx.var.status or "0"
    local request_time = tonumber(ngx.var.request_time) or 0
    local upstream_time = tonumber(ngx.var.upstream_response_time) or 0
    
    local service = get_service_from_uri(uri)
    local endpoint = normalize_endpoint(uri)
    
    -- Increment request counter
    _M.inc("http_requests_total", {
        method = method,
        endpoint = endpoint,
        status = status,
        service = service
    })
    
    -- Record request duration histogram
    _M.observe("http_request_duration_seconds", {
        method = method,
        endpoint = endpoint,
        service = service
    }, request_time)
    
    -- Record upstream response time if available
    if upstream_time > 0 then
        _M.observe("upstream_response_time_seconds", {
            service = service
        }, upstream_time)
    end
    
    -- Record errors
    local status_num = tonumber(status) or 0
    if status_num >= 400 then
        local error_type = "client_error"
        if status_num >= 500 then
            error_type = "server_error"
        elseif status_num == 429 then
            error_type = "rate_limited"
        elseif status_num == 401 or status_num == 403 then
            error_type = "auth_error"
        end
        
        _M.inc("http_request_errors_total", {
            method = method,
            endpoint = endpoint,
            error_type = error_type,
            service = service
        })
    end
end

-- Record rate limit hit
function _M.record_rate_limit(endpoint, service)
    endpoint = endpoint or ngx.var.uri or "/"
    service = service or get_service_from_uri(endpoint)
    
    _M.inc("rate_limit_hits_total", {
        endpoint = normalize_endpoint(endpoint),
        service = service
    })
end

-- Record circuit breaker state change
function _M.record_circuit_breaker_trip(service, from_state, to_state)
    _M.inc("circuit_breaker_trips_total", {
        service = service,
        from_state = from_state,
        to_state = to_state
    })
    
    -- Update gauge (0=closed, 1=half_open, 2=open)
    local state_value = 0
    if to_state == "half_open" then
        state_value = 1
    elseif to_state == "open" then
        state_value = 2
    end
    
    _M.set("circuit_breaker_state", {service = service}, state_value)
end

-- Record authentication result
function _M.record_auth(result, endpoint)
    endpoint = endpoint or ngx.var.uri or "/"
    
    _M.inc("auth_requests_total", {
        result = result,
        endpoint = normalize_endpoint(endpoint)
    })
end

-- Generate Prometheus text format output
function _M.collect()
    if not metrics_dict then
        return "# ERROR: prometheus_metrics shared dict not available\n"
    end
    
    local output = {}
    local seen_metrics = {}
    
    -- Get all keys from shared dict
    local keys = metrics_dict:get_keys(0)
    
    -- Group metrics by base name
    local metric_values = {}
    for _, key in ipairs(keys) do
        local value = metrics_dict:get(key)
        if value then
            -- Extract base metric name (before { or _bucket/_sum/_count)
            local base_name = string.match(key, "^([^{_]+)")
            if string.match(key, "_bucket{") then
                base_name = string.match(key, "^(.+)_bucket{")
            elseif string.match(key, "_sum{") then
                base_name = string.match(key, "^(.+)_sum{")
            elseif string.match(key, "_count{") then
                base_name = string.match(key, "^(.+)_count{")
            else
                base_name = string.match(key, "^([^{]+)")
            end
            
            if not metric_values[base_name] then
                metric_values[base_name] = {}
            end
            table.insert(metric_values[base_name], {key = key, value = value})
        end
    end
    
    -- Output metrics with HELP and TYPE
    for name, metric in pairs(METRICS) do
        if metric_values[name] then
            -- Add HELP line
            table.insert(output, "# HELP " .. name .. " " .. metric.help)
            
            -- Add TYPE line
            table.insert(output, "# TYPE " .. name .. " " .. metric.type)
            
            -- Add metric values
            for _, mv in ipairs(metric_values[name]) do
                table.insert(output, mv.key .. " " .. mv.value)
            end
            
            -- For histograms, also output _sum, _count, and _bucket
            if metric.type == "histogram" then
                if metric_values[name .. "_sum"] then
                    for _, mv in ipairs(metric_values[name .. "_sum"]) do
                        table.insert(output, mv.key .. " " .. mv.value)
                    end
                end
                if metric_values[name .. "_count"] then
                    for _, mv in ipairs(metric_values[name .. "_count"]) do
                        table.insert(output, mv.key .. " " .. mv.value)
                    end
                end
                if metric_values[name .. "_bucket"] then
                    for _, mv in ipairs(metric_values[name .. "_bucket"]) do
                        table.insert(output, mv.key .. " " .. mv.value)
                    end
                end
            end
            
            table.insert(output, "")
        end
    end
    
    -- Add nginx stub_status metrics
    table.insert(output, "# HELP nginx_connections_active Active client connections")
    table.insert(output, "# TYPE nginx_connections_active gauge")
    table.insert(output, "nginx_connections_active " .. (ngx.var.connections_active or 0))
    
    table.insert(output, "# HELP nginx_connections_reading Connections reading request")
    table.insert(output, "# TYPE nginx_connections_reading gauge")
    table.insert(output, "nginx_connections_reading " .. (ngx.var.connections_reading or 0))
    
    table.insert(output, "# HELP nginx_connections_writing Connections writing response")
    table.insert(output, "# TYPE nginx_connections_writing gauge")
    table.insert(output, "nginx_connections_writing " .. (ngx.var.connections_writing or 0))
    
    table.insert(output, "# HELP nginx_connections_waiting Idle client connections")
    table.insert(output, "# TYPE nginx_connections_waiting gauge")
    table.insert(output, "nginx_connections_waiting " .. (ngx.var.connections_waiting or 0))
    
    return table.concat(output, "\n") .. "\n"
end

-- Serve metrics endpoint
function _M.serve()
    ngx.header.content_type = "text/plain; version=0.0.4; charset=utf-8"
    ngx.say(_M.collect())
end

return _M
