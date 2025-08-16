package auth

import (
	"errors"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/erkinalp/4chan-go-rs/v2/file-service/config"
)

type UserClaims struct {
	UserID    string    `json:"user_id"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
	jwt.RegisteredClaims
}

func ExtractUserFromJWT(c *gin.Context, cfg config.JWTConfig) (string, time.Time, error) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		return "", time.Time{}, errors.New("no authorization header")
	}

	if len(authHeader) < 7 || authHeader[:7] != "Bearer " {
		return "", time.Time{}, errors.New("invalid authorization header format")
	}

	tokenString := authHeader[7:]
	
	token, err := jwt.ParseWithClaims(tokenString, &UserClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(cfg.SecretKey), nil
	})

	if err != nil {
		return "", time.Time{}, err
	}

	if claims, ok := token.Claims.(*UserClaims); ok && token.Valid {
		return claims.UserID, claims.CreatedAt, nil
	}

	return "", time.Time{}, errors.New("invalid token claims")
}
