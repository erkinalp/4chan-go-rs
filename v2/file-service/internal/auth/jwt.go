package auth

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/erkinalp/4chan-go-rs/v2/file-service/config"
	"github.com/gin-gonic/gin"
)

// UserContext represents the authenticated user's identity
type UserContext struct {
	Sub         string    `json:"sub"`
	Email       string    `json:"email,omitempty"`
	Role        string    `json:"role,omitempty"`
	Permissions []string  `json:"permissions,omitempty"`
	CreatedAt   time.Time `json:"created_at,omitempty"`
}

// Claims represents JWT token claims
type Claims struct {
	Sub         string   `json:"sub"`
	Email       string   `json:"email,omitempty"`
	Role        string   `json:"role,omitempty"`
	Iss         string   `json:"iss,omitempty"`
	Exp         int64    `json:"exp"`
	Iat         int64    `json:"iat"`
	Permissions []string `json:"permissions,omitempty"`
	// CreatedAt mirrors api-core's `created_at` claim (unix seconds); the rate
	// limiter aligns fixed windows to it.
	CreatedAt int64 `json:"created_at,omitempty"`
}

// JWTAuthMiddleware creates a Gin middleware that validates JWT tokens
func JWTAuthMiddleware(cfg config.JWTConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"statusCode": 401,
				"message":    "Unauthorized",
				"error":      "No authorization header provided",
			})
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || (parts[0] != "Bearer" && parts[0] != "GNAP") {
			c.JSON(http.StatusUnauthorized, gin.H{
				"statusCode": 401,
				"message":    "Unauthorized",
				"error":      "Invalid authorization format, expected 'Bearer <token>' or 'GNAP <token>'",
			})
			c.Abort()
			return
		}

		token := parts[1]
		claims, err := validateToken(token, cfg.SecretKey)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"statusCode": 401,
				"message":    "Unauthorized",
				"error":      err.Error(),
			})
			c.Abort()
			return
		}

		// Check expiration
		if claims.Exp > 0 && time.Now().Unix() > claims.Exp {
			c.JSON(http.StatusUnauthorized, gin.H{
				"statusCode": 401,
				"message":    "Unauthorized",
				"error":      "Token has expired",
			})
			c.Abort()
			return
		}

		// Check issuer if configured
		if cfg.Issuer != "" && claims.Iss != "" && claims.Iss != cfg.Issuer {
			c.JSON(http.StatusUnauthorized, gin.H{
				"statusCode": 401,
				"message":    "Unauthorized",
				"error":      "Invalid token issuer",
			})
			c.Abort()
			return
		}

		// Store user context
		userCtx := &UserContext{
			Sub:         claims.Sub,
			Email:       claims.Email,
			Role:        claims.Role,
			Permissions: claims.Permissions,
		}
		c.Set("user", userCtx)
		c.Set("user_id", claims.Sub)

		c.Next()
	}
}

// validateToken parses and validates a JWT token using HMAC-SHA256
func validateToken(tokenStr string, secret string) (*Claims, error) {
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid token format")
	}

	// Verify signature (HMAC-SHA256)
	signingInput := parts[0] + "." + parts[1]
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(signingInput))
	expectedSig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(parts[2]), []byte(expectedSig)) {
		return nil, fmt.Errorf("invalid token signature")
	}

	// Decode payload
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("invalid token payload encoding: %w", err)
	}

	var claims Claims
	if err := json.Unmarshal(payload, &claims); err != nil {
		return nil, fmt.Errorf("invalid token payload: %w", err)
	}

	return &claims, nil
}

// GetUserFromContext extracts the authenticated user from the gin context
func GetUserFromContext(c *gin.Context) (*UserContext, bool) {
	val, exists := c.Get("user")
	if !exists {
		return nil, false
	}
	user, ok := val.(*UserContext)
	return user, ok
}

// --- GNAP Client (for external token introspection) ---

type GNAPClient struct {
	ServerURL    string
	ClientKey    string
	ClientSecret string
	HTTPClient   *http.Client
	// LocalSecret enables offline HS256 validation of API-issued JWTs before
	// falling back to remote introspection.
	LocalSecret string
}

type GNAPAccessToken struct {
	Value     string            `json:"value"`
	Label     string            `json:"label,omitempty"`
	Manage    string            `json:"manage,omitempty"`
	Access    []GNAPAccessRight `json:"access"`
	ExpiresIn int               `json:"expires_in,omitempty"`
}

type GNAPAccessRight struct {
	Type      string   `json:"type"`
	Actions   []string `json:"actions,omitempty"`
	Locations []string `json:"locations,omitempty"`
	Datatypes []string `json:"datatypes,omitempty"`
}

type GNAPGrantRequest struct {
	AccessToken GNAPAccessTokenRequest `json:"access_token"`
	Client      GNAPClientInstance     `json:"client"`
	User        *GNAPUser              `json:"user,omitempty"`
	Interact    *GNAPInteract          `json:"interact,omitempty"`
}

type GNAPAccessTokenRequest struct {
	Access []GNAPAccessRight `json:"access"`
}

type GNAPClientInstance struct {
	Key     GNAPClientKey `json:"key"`
	ClassID string        `json:"class_id,omitempty"`
	Display *GNAPDisplay  `json:"display,omitempty"`
}

type GNAPClientKey struct {
	Proof string                 `json:"proof"`
	JWK   map[string]interface{} `json:"jwk,omitempty"`
}

type GNAPDisplay struct {
	Name string `json:"name"`
	URI  string `json:"uri,omitempty"`
}

type GNAPUser struct {
	SubIDs []GNAPSubjectID `json:"sub_ids,omitempty"`
}

type GNAPSubjectID struct {
	SubjectType string `json:"subject_type"`
	Email       string `json:"email,omitempty"`
}

type GNAPInteract struct {
	Start  []string    `json:"start"`
	Finish *GNAPFinish `json:"finish,omitempty"`
}

type GNAPFinish struct {
	Method string `json:"method"`
	URI    string `json:"uri"`
	Nonce  string `json:"nonce"`
}

type GNAPGrantResponse struct {
	Continue    *GNAPContinue         `json:"continue,omitempty"`
	AccessToken *GNAPAccessToken      `json:"access_token,omitempty"`
	Interact    *GNAPInteractResponse `json:"interact,omitempty"`
	Subject     *GNAPSubject          `json:"subject,omitempty"`
	InstanceID  string                `json:"instance_id,omitempty"`
	Error       *GNAPError            `json:"error,omitempty"`
}

type GNAPContinue struct {
	AccessToken GNAPContinueToken `json:"access_token"`
	URI         string            `json:"uri"`
	Wait        int               `json:"wait,omitempty"`
}

type GNAPContinueToken struct {
	Value string `json:"value"`
}

type GNAPInteractResponse struct {
	Redirect    string `json:"redirect,omitempty"`
	App         string `json:"app,omitempty"`
	UserCode    string `json:"user_code,omitempty"`
	UserCodeURI string `json:"user_code_uri,omitempty"`
	Finish      string `json:"finish,omitempty"`
}

type GNAPSubject struct {
	SubIDs     []GNAPSubjectID        `json:"sub_ids"`
	Assertions map[string]interface{} `json:"assertions,omitempty"`
}

type GNAPError struct {
	Code        string `json:"code"`
	Description string `json:"description,omitempty"`
}

func NewGNAPClient(serverURL, clientKey, clientSecret string) *GNAPClient {
	return &GNAPClient{
		ServerURL:    serverURL,
		ClientKey:    clientKey,
		ClientSecret: clientSecret,
		HTTPClient:   &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *GNAPClient) RequestGrant(ctx context.Context, req *GNAPGrantRequest) (*GNAPGrantResponse, error) {
	reqBody, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal grant request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.ServerURL+"/gnap", strings.NewReader(string(reqBody)))
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.ClientKey)

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send grant request: %w", err)
	}
	defer resp.Body.Close()

	var grantResp GNAPGrantResponse
	if err := json.NewDecoder(resp.Body).Decode(&grantResp); err != nil {
		return nil, fmt.Errorf("failed to decode grant response: %w", err)
	}

	return &grantResp, nil
}

// ValidateLocalToken verifies a locally-issued HS256 JWT (the format api-core
// mints) and converts it to a UserContext. This lets Bearer tokens work even
// when no GNAP introspection service is reachable.
func ValidateLocalToken(tokenStr, secret string) (*UserContext, error) {
	claims, err := validateToken(tokenStr, secret)
	if err != nil {
		return nil, err
	}
	if claims.Exp > 0 && time.Now().Unix() > claims.Exp {
		return nil, fmt.Errorf("token has expired")
	}
	createdAt := time.Now()
	if claims.CreatedAt > 0 {
		createdAt = time.Unix(claims.CreatedAt, 0)
	}
	return &UserContext{
		Sub:         claims.Sub,
		Email:       claims.Email,
		Role:        claims.Role,
		Permissions: claims.Permissions,
		CreatedAt:   createdAt,
	}, nil
}

// ValidateToken first attempts local HS256 validation when a shared secret is
// configured, then falls back to GNAP introspection.
func (c *GNAPClient) ValidateToken(ctx context.Context, token string) (*UserContext, error) {
	if token == "" {
		return nil, fmt.Errorf("empty token")
	}

	if c.LocalSecret != "" {
		if userCtx, err := ValidateLocalToken(token, c.LocalSecret); err == nil {
			return userCtx, nil
		}
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.ServerURL+"/gnap/introspect", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create introspection request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to introspect token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("token validation failed with status: %d", resp.StatusCode)
	}

	var userCtx UserContext
	if err := json.NewDecoder(resp.Body).Decode(&userCtx); err != nil {
		return nil, fmt.Errorf("failed to decode user context: %w", err)
	}

	return &userCtx, nil
}

func ExtractUserFromGNAP(c *gin.Context, gnapClient *GNAPClient) (string, time.Time, error) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		return "", time.Time{}, fmt.Errorf("no authorization header")
	}

	tokenParts := strings.Split(authHeader, " ")
	if len(tokenParts) != 2 || tokenParts[0] != "GNAP" {
		return "", time.Time{}, fmt.Errorf("invalid authorization format")
	}

	token := tokenParts[1]
	userCtx, err := gnapClient.ValidateToken(c.Request.Context(), token)
	if err != nil {
		return "", time.Time{}, err
	}

	return userCtx.Sub, time.Now(), nil
}

func generateNonce() string {
	bytes := make([]byte, 32)
	rand.Read(bytes)
	return base64.URLEncoding.EncodeToString(bytes)
}
