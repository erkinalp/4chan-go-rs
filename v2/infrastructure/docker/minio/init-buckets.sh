#!/bin/bash

until mc alias set myminio http://localhost:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD; do
  echo "Waiting for MinIO to be ready..."
  sleep 2
done

mc mb myminio/4chan-v2 --ignore-existing
mc mb myminio/4chan-v2-thumbnails --ignore-existing
mc mb myminio/4chan-v2-backups --ignore-existing

mc anonymous set download myminio/4chan-v2
mc anonymous set download myminio/4chan-v2-thumbnails

cat > /tmp/lifecycle.json << EOF
{
    "Rules": [
        {
            "ID": "DeleteOldFiles",
            "Status": "Enabled",
            "Filter": {
                "Prefix": "temp/"
            },
            "Expiration": {
                "Days": 7
            }
        }
    ]
}
EOF

mc ilm import myminio/4chan-v2 < /tmp/lifecycle.json

echo "MinIO buckets initialized successfully"
