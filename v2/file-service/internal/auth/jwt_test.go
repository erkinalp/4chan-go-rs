package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/erkinalp/4chan-go-rs/v2/file-service/config"
	"github.com/gin-gonic/gin"
)

const testSecret = "test-secret-key-for-unit-tests"

func createTestToken(claims Claims, secret string) string {
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	payload, _ := json.Marshal(claims)
	payloadEnc := base64.RawURLEncoding.EncodeToString(payload)

	signingInput := header + "." + payloadEnc
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(signingInput))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	return header + "." + payloadEnc + "." + sig
}

func TestValidateToken_Valid(t *testing.T) {
	claims := Claims{
		Sub:   "user-123",
		Email: "test@example.com",
		Role:  "USER",
		Iss:   "4chan-v2",
		Exp:   time.Now().Add(1 * time.Hour).Unix(),
		Iat:   time.Now().Unix(),
	}

	token := createTestToken(claims, testSecret)

	result, err := validateToken(token, testSecret)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Sub != "user-123" {
		t.Fatalf("expected sub=user-123, got %s", result.Sub)
	}
	if result.Email != "test@example.com" {
		t.Fatalf("expected email=test@example.com, got %s", result.Email)
	}
	if result.Role != "USER" {
		t.Fatalf("expected role=USER, got %s", result.Role)
	}
}

func TestValidateToken_InvalidSignature(t *testing.T) {
	claims := Claims{
		Sub: "user-123",
		Exp: time.Now().Add(1 * time.Hour).Unix(),
	}

	token := createTestToken(claims, testSecret)

	_, err := validateToken(token, "wrong-secret")
	if err == nil {
		t.Fatal("expected error for invalid signature")
	}
}

func TestValidateToken_InvalidFormat(t *testing.T) {
	_, err := validateToken("not.a.valid.token.with.too.many.parts", testSecret)
	if err == nil {
		t.Fatal("expected error for invalid format")
	}

	_, err = validateToken("onlyonepart", testSecret)
	if err == nil {
		t.Fatal("expected error for single part token")
	}
}

func TestJWTAuthMiddleware_NoHeader(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cfg := config.JWTConfig{SecretKey: testSecret, Issuer: "4chan-v2"}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)

	handler := JWTAuthMiddleware(cfg)
	handler(c)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestJWTAuthMiddleware_ValidToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cfg := config.JWTConfig{SecretKey: testSecret, Issuer: "4chan-v2"}

	claims := Claims{
		Sub:  "user-456",
		Role: "ADMIN",
		Iss:  "4chan-v2",
		Exp:  time.Now().Add(1 * time.Hour).Unix(),
		Iat:  time.Now().Unix(),
	}
	token := createTestToken(claims, testSecret)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	c.Request.Header.Set("Authorization", "Bearer "+token)

	handler := JWTAuthMiddleware(cfg)
	handler(c)

	if c.IsAborted() {
		t.Fatalf("request was aborted, expected pass-through")
	}

	user, ok := GetUserFromContext(c)
	if !ok {
		t.Fatal("expected user in context")
	}
	if user.Sub != "user-456" {
		t.Fatalf("expected sub=user-456, got %s", user.Sub)
	}
	if user.Role != "ADMIN" {
		t.Fatalf("expected role=ADMIN, got %s", user.Role)
	}
}

func TestJWTAuthMiddleware_ExpiredToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cfg := config.JWTConfig{SecretKey: testSecret, Issuer: "4chan-v2"}

	claims := Claims{
		Sub: "user-789",
		Exp: time.Now().Add(-1 * time.Hour).Unix(),
		Iat: time.Now().Add(-2 * time.Hour).Unix(),
	}
	token := createTestToken(claims, testSecret)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	c.Request.Header.Set("Authorization", "Bearer "+token)

	handler := JWTAuthMiddleware(cfg)
	handler(c)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}
