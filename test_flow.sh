#!/bin/bash
set -e

echo "1. Register/Login..."
# Register (ignore error if exists)
curl -s -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "tester2", "email": "test2@test.com", "password": "Password123!"}' > /dev/null

# Login
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test2@test.com", "password": "Password123!"}' | jq -r '.token')

if [ "$TOKEN" == "null" ]; then
  echo "Login failed"
  exit 1
fi
echo "Logged in."

echo "2. Uploading Sitemap..."
SITEMAP_RES=$(curl -s -X POST http://localhost:5000/api/sitemaps \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @/opt/webscraper-saas/api_payload.json)

SITEMAP_ID=$(echo $SITEMAP_RES | jq -r '.sitemap.id')
echo "Sitemap ID: $SITEMAP_ID"

if [ "$SITEMAP_ID" == "null" ]; then
  echo "Upload failed: $SITEMAP_RES"
  exit 1
fi

echo "3. Creating Job..."
JOB_RES=$(curl -s -X POST http://localhost:5000/api/jobs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"sitemap_id\": $SITEMAP_ID}")

JOB_ID=$(echo $JOB_RES | jq -r '.job.id')
echo "Job ID: $JOB_ID"

echo "4. Monitoring Job..."
for i in {1..30}; do
  STATUS=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/jobs/$JOB_ID | jq -r '.job.status')
  echo -ne "Status: $STATUS\r"
  
  if [ "$STATUS" == "completed" ]; then
    echo -e "\nJob Completed!"
    break
  elif [ "$STATUS" == "failed" ]; then
    echo -e "\nJob Failed!"
    break
  fi
  sleep 2
done

echo "5. Fetching Results..."
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/jobs/$JOB_ID/data > /opt/webscraper-saas/test_results.json

# Count items
COUNT=$(jq '.data | length' /opt/webscraper-saas/test_results.json)
echo "Total Items Scraped: $COUNT"

# Show first item
echo "First Item:"
jq '.data[0].data' /opt/webscraper-saas/test_results.json
