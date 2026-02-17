#!/bin/bash

# Test the API endpoints directly

CLOUDFRONT_URL="https://d1eu4g8o2o0px3.cloudfront.net"

echo "Testing API endpoints..."
echo ""

echo "1. Testing health endpoint:"
curl -s "$CLOUDFRONT_URL/api/health" | jq . || echo "Failed"
echo ""

echo "2. Testing profile endpoint (SQL Injection):"
curl -s "$CLOUDFRONT_URL/api/profile/1" | jq . || echo "Failed"
echo ""

echo "3. Testing comments GET:"
curl -s "$CLOUDFRONT_URL/api/comments" | jq . || echo "Failed"
echo ""

echo "4. Testing comments POST:"
curl -s -X POST "$CLOUDFRONT_URL/api/comments" \
  -H "Content-Type: application/json" \
  -d '{"content":"Test comment","user_id":1}' | jq . || echo "Failed"
echo ""

echo "5. Testing ping tool:"
curl -s -X POST "$CLOUDFRONT_URL/api/tools/ping" \
  -H "Content-Type: application/json" \
  -d '{"host":"127.0.0.1"}' | jq . || echo "Failed"
