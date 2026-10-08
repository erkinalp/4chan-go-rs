package models

import (
	"encoding/json"
	"testing"
	"time"
)

func marshalToMap(t *testing.T, v interface{}) map[string]interface{} {
	t.Helper()
	data, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}
	var m map[string]interface{}
	if err := json.Unmarshal(data, &m); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	return m
}

func mustNotContain(t *testing.T, m map[string]interface{}, keys ...string) {
	t.Helper()
	for _, k := range keys {
		if _, ok := m[k]; ok {
			t.Fatalf("expected key %q to be omitted from JSON, got %v", k, m)
		}
	}
}

func mustContain(t *testing.T, m map[string]interface{}, keys ...string) {
	t.Helper()
	for _, k := range keys {
		if _, ok := m[k]; !ok {
			t.Fatalf("expected key %q in JSON, got %v", k, m)
		}
	}
}

func TestUser_JSONOmitsSecrets(t *testing.T) {
	secret := "totp-secret"
	now := time.Now()
	u := User{
		ID:              "u1",
		Username:        "anon",
		Email:           "a@b.com",
		PasswordHash:    "hashed",
		Role:            "USER",
		IsActive:        true,
		TwoFactorAuth:   true,
		TwoFactorSecret: &secret,
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	m := marshalToMap(t, u)
	mustNotContain(t, m, "passwordHash", "password_hash", "twoFactorSecret", "two_factor_secret")
	mustContain(t, m, "id", "username", "email", "role", "isActive", "isBanned", "twoFactorAuth", "createdAt", "updatedAt")
	if m["username"] != "anon" {
		t.Fatalf("username mismatch: %v", m["username"])
	}
}

func TestThread_JSONOmitsIPHash(t *testing.T) {
	ip := "iphash"
	th := Thread{ID: "t1", IPHash: &ip, BoardID: "b1"}
	m := marshalToMap(t, th)
	mustNotContain(t, m, "ipHash", "ip_hash")
	mustContain(t, m, "id", "boardId", "isSticky", "isLocked", "isCyclic", "bumpedAt")
}

func TestPost_JSONOmitsIPHash(t *testing.T) {
	ip := "iphash"
	p := Post{ID: "p1", PostNumber: 1, IPHash: &ip, ThreadID: "t1"}
	m := marshalToMap(t, p)
	mustNotContain(t, m, "ipHash", "ip_hash")
	mustContain(t, m, "id", "postNumber", "threadId", "isDeleted", "isSpoilered")
}

func TestReport_JSONOmitsIPHash(t *testing.T) {
	r := Report{ID: "r1", Reason: "spam", IPHash: "iphash"}
	m := marshalToMap(t, r)
	mustNotContain(t, m, "ipHash", "ip_hash")
	mustContain(t, m, "id", "reason", "isResolved", "createdAt")
}

func TestAuditLog_JSONOmitsIPAddress(t *testing.T) {
	ip := "127.0.0.1"
	a := AuditLog{ID: "a1", Action: "delete", IPAddress: &ip}
	m := marshalToMap(t, a)
	mustNotContain(t, m, "ipAddress", "ip_address")
	mustContain(t, m, "id", "action", "entityType", "entityId", "details", "createdAt")
}

func TestBan_JSONOmitsIPHash(t *testing.T) {
	b := Ban{ID: "b1", IPHash: "iphash", AppealStatus: "PENDING"}
	m := marshalToMap(t, b)
	mustNotContain(t, m, "ipHash", "ip_hash")
	mustContain(t, m, "id", "isActive", "appealStatus", "createdAt")
}

func TestCaptcha_JSONShape(t *testing.T) {
	c := Captcha{ID: "c1", Solution: "ABC123", IPHash: "iphash", ImageURL: "data:image/png;base64,x"}
	m := marshalToMap(t, c)
	mustNotContain(t, m, "solution", "ipHash", "ip_hash")
	mustContain(t, m, "id", "imageUrl", "expiresAt", "isUsed")
}

func TestFile_JSONShape(t *testing.T) {
	f := File{
		ID:           "f1",
		Filename:     "cat.jpg",
		MD5Hash:      "d41d8cd98f00b204e9800998ecf8427e",
		SHA256Hash:   "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
		URL:          "http://files/f1",
		ThumbnailURL: "http://files/f1/thumb",
		PostID:       "p1",
	}
	m := marshalToMap(t, f)
	mustContain(t, m, "id", "filename", "md5Hash", "sha256Hash", "url", "thumbnailUrl", "postId", "isSpoilered")
}

func TestRefreshToken_JSONShape(t *testing.T) {
	rt := RefreshToken{ID: "rt1", Token: "tok", UserID: "u1"}
	m := marshalToMap(t, rt)
	mustContain(t, m, "id", "token", "userId", "expiresAt", "createdAt")
}

func TestEmbeddedStructs_Marshal(t *testing.T) {
	bwc := BoardWithCategory{
		Board:    Board{ID: "b1", Name: "Technology", CategoryID: "c1"},
		Category: Category{ID: "c1", Name: "Interests"},
	}
	m := marshalToMap(t, bwc)
	if m["id"] != "b1" {
		t.Fatalf("embedded board fields missing: %v", m)
	}
	cat, ok := m["category"].(map[string]interface{})
	if !ok || cat["name"] != "Interests" {
		t.Fatalf("category embedding broken: %v", m)
	}

	tws := ThreadWithStats{
		Thread:     Thread{ID: "t1"},
		ReplyCount: 5,
		FileCount:  2,
	}
	m = marshalToMap(t, tws)
	if m["replyCount"] != float64(5) || m["fileCount"] != float64(2) {
		t.Fatalf("stats fields missing: %v", m)
	}
}
