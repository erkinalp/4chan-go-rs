package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type GNAPClient struct {
	ServerURL    string
	ClientKey    string
	ClientSecret string
	HTTPClient   *http.Client
}

type GNAPAccessToken struct {
	Value     string                 `json:"value"`
	Label     string                 `json:"label,omitempty"`
	Manage    string                 `json:"manage,omitempty"`
	Access    []GNAPAccessRight      `json:"access"`
	ExpiresIn int                    `json:"expires_in,omitempty"`
	Key       map[string]interface{} `json:"key,omitempty"`
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
	Start  []string     `json:"start"`
	Finish *GNAPFinish  `json:"finish,omitempty"`
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

type UserContext struct {
	Sub         string    `json:"sub"`
	Email       string    `json:"email,omitempty"`
	Role        string    `json:"role,omitempty"`
	Permissions []string  `json:"permissions,omitempty"`
	CreatedAt   time.Time `json:"created_at,omitempty"`
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

func (c *GNAPClient) ValidateToken(ctx context.Context, token string) (*UserContext, error) {
	if token == "" {
		return nil, fmt.Errorf("empty token")
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
