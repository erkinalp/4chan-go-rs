package utils

import (
	"encoding/base64"
	"strings"
	"testing"

	"golang.org/x/crypto/argon2"
)

func TestHashPassword_Format(t *testing.T) {
	hash, err := HashPassword("correct horse battery staple")
	if err != nil {
		t.Fatalf("HashPassword failed: %v", err)
	}

	if !strings.HasPrefix(hash, "$argon2id$v=19$m=65536,t=3,p=4$") {
		t.Fatalf("unexpected hash format: %s", hash)
	}

	parts := strings.Split(hash, "$")
	if len(parts) != 6 {
		t.Fatalf("expected 6 hash parts, got %d", len(parts))
	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil || len(salt) != argon2SaltLen {
		t.Fatalf("invalid salt in hash: %v len=%d", err, len(salt))
	}

	key, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil || len(key) != argon2KeyLen {
		t.Fatalf("invalid key in hash: %v len=%d", err, len(key))
	}
}

func TestHashPassword_UniqueSalts(t *testing.T) {
	h1, err := HashPassword("same-password")
	if err != nil {
		t.Fatalf("HashPassword failed: %v", err)
	}
	h2, err := HashPassword("same-password")
	if err != nil {
		t.Fatalf("HashPassword failed: %v", err)
	}
	if h1 == h2 {
		t.Fatal("expected different salts to produce different hashes")
	}
}

func TestVerifyPassword_RoundTrip(t *testing.T) {
	password := "s3cret!password"
	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword failed: %v", err)
	}

	ok, err := VerifyPassword(password, hash)
	if err != nil {
		t.Fatalf("VerifyPassword failed: %v", err)
	}
	if !ok {
		t.Fatal("expected password to verify")
	}
}

func TestVerifyPassword_WrongPassword(t *testing.T) {
	hash, err := HashPassword("right-password")
	if err != nil {
		t.Fatalf("HashPassword failed: %v", err)
	}

	ok, err := VerifyPassword("wrong-password", hash)
	if err != nil {
		t.Fatalf("VerifyPassword failed: %v", err)
	}
	if ok {
		t.Fatal("expected wrong password to fail verification")
	}
}

// TestVerifyPassword_KnownVector verifies against a PHC string built
// independently from a raw argon2.IDKey computation.
func TestVerifyPassword_KnownVector(t *testing.T) {
	password := "vector-password"
	salt := []byte("0123456789abcdef")
	key := argon2.IDKey([]byte(password), salt, argon2Time, argon2Memory, argon2Threads, argon2KeyLen)

	phc := "$argon2id$v=19$m=65536,t=3,p=4$" +
		base64.RawStdEncoding.EncodeToString(salt) + "$" +
		base64.RawStdEncoding.EncodeToString(key)

	ok, err := VerifyPassword(password, phc)
	if err != nil {
		t.Fatalf("VerifyPassword failed: %v", err)
	}
	if !ok {
		t.Fatal("expected known vector to verify")
	}
}

func TestVerifyPassword_MalformedHashes(t *testing.T) {
	tests := []struct {
		name string
		hash string
	}{
		{"empty", ""},
		{"not-a-hash", "abcdef"},
		{"too-few-parts", "$argon2id$v=19$m=65536,t=3,p=4"},
		{"bad-params", "$argon2id$v=19$garbage$c2FsdA$aGFzaA"},
		{"bad-salt-base64", "$argon2id$v=19$m=65536,t=3,p=4$!!!invalid!!!$aGFzaA"},
		{"bad-hash-base64", "$argon2id$v=19$m=65536,t=3,p=4$c2FsdA$!!!invalid!!!"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := VerifyPassword("pw", tt.hash)
			if err == nil {
				t.Fatalf("expected error for %s", tt.name)
			}
		})
	}
}

func TestParseEncodedHash_RoundTrip(t *testing.T) {
	encoded, err := HashPassword("pw")
	if err != nil {
		t.Fatalf("HashPassword failed: %v", err)
	}

	p, salt, hash, err := parseEncodedHash(encoded)
	if err != nil {
		t.Fatalf("parseEncodedHash failed: %v", err)
	}
	if p.memory != argon2Memory || p.time != argon2Time || p.threads != argon2Threads || p.keyLen != argon2KeyLen {
		t.Fatalf("unexpected params: %+v", p)
	}
	if len(salt) != argon2SaltLen {
		t.Fatalf("unexpected salt length %d", len(salt))
	}
	if len(hash) != argon2KeyLen {
		t.Fatalf("unexpected hash length %d", len(hash))
	}
}

func TestParseEncodedHash_CustomParams(t *testing.T) {
	// A PHC string with different parameters must be honoured by VerifyPassword,
	// not silently re-hashed with the package defaults.
	salt := []byte("0123456789abcdef")
	password := "pw"
	key := argon2.IDKey([]byte(password), salt, 1, 8*1024, 2, argon2KeyLen)
	encoded := "$argon2id$v=19$m=8192,t=1,p=2$" +
		base64.RawStdEncoding.EncodeToString(salt) + "$" +
		base64.RawStdEncoding.EncodeToString(key)

	p, gotSalt, gotHash, err := parseEncodedHash(encoded)
	if err != nil {
		t.Fatalf("parseEncodedHash failed: %v", err)
	}
	if p.memory != 8*1024 || p.time != 1 || p.threads != 2 {
		t.Fatalf("unexpected parsed params: %+v", p)
	}
	if string(gotSalt) != string(salt) {
		t.Fatal("salt mismatch")
	}
	if len(gotHash) != len(key) {
		t.Fatal("hash mismatch")
	}

	ok, err := VerifyPassword(password, encoded)
	if err != nil || !ok {
		t.Fatalf("expected verification to succeed, ok=%v err=%v", ok, err)
	}
}
