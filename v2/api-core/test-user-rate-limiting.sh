#!/bin/bash

echo "Testing user-based rate limiting across backend services..."


JWT_USER1="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEiLCJyb2xlIjoiVVNFUiIsImNyZWF0ZWRfYXQiOjE3MDQwNjcyMDAsImV4cCI6MTc1NTM1NzQwMCwiaWF0IjoxNzU1MzU3NDAwfQ.test"

JWT_USER2="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTIiLCJyb2xlIjoiVVNFUiIsImNyZWF0ZWRfYXQiOjE3MTcyMDAwMDAsImV4cCI6MTc1NTM1NzQwMCwiaWF0IjoxNzU1MzU3NDAwfQ.test"

echo "Testing Go file service user rate limiting (50 requests/60s)..."
echo "User 1 - should be blocked after 50 requests:"
for i in {1..55}; do
    response=$(curl -s -H "Authorization: Bearer $JWT_USER1" -w "%{http_code}" -o /dev/null http://localhost:8080/api/v1/health)
    if [ "$response" = "429" ]; then
        echo "User 1 blocked at request $i (expected around 51)"
        break
    fi
done

echo "User 2 - should have separate limit:"
for i in {1..5}; do
    response=$(curl -s -H "Authorization: Bearer $JWT_USER2" -w "%{http_code}" -o /dev/null http://localhost:8080/api/v1/health)
    echo "User 2 request $i: $response"
done

echo ""
echo "Testing Rust media processor user rate limiting (20 requests/60s)..."
echo "User 1 - should be blocked after 20 requests:"
for i in {1..25}; do
    response=$(curl -s -H "Authorization: Bearer $JWT_USER1" -w "%{http_code}" -o /dev/null http://localhost:8081/api/v1/health)
    if [ "$response" = "429" ]; then
        echo "User 1 blocked at request $i (expected around 21)"
        break
    fi
done

echo ""
echo "Testing NestJS API core user rate limiting (100 requests/60s)..."
echo "User 1 - should be blocked after 100 requests:"
for i in {1..105}; do
    response=$(curl -s -H "Authorization: Bearer $JWT_USER1" -w "%{http_code}" -o /dev/null http://localhost:3000/api/v1/health)
    if [ "$response" = "429" ]; then
        echo "User 1 blocked at request $i (expected around 101)"
        break
    fi
done

echo ""
echo "Testing fallback IP-based rate limiting for unauthenticated requests..."
echo "Should be blocked after 50 requests:"
for i in {1..55}; do
    response=$(curl -s -w "%{http_code}" -o /dev/null http://localhost:8080/api/v1/health)
    if [ "$response" = "429" ]; then
        echo "IP blocked at request $i (expected around 51)"
        break
    fi
done

echo ""
echo "Testing block extension behavior..."
echo "Making request from blocked user (should extend block):"
curl -s -H "Authorization: Bearer $JWT_USER1" -w "%{http_code}\n" http://localhost:8080/api/v1/health

echo ""
echo "User-based rate limiting test completed!"
