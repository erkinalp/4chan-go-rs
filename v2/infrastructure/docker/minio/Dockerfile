FROM minio/minio:latest

# Install mc (MinIO Client)
RUN microdnf install -y curl && \
    curl -O https://dl.min.io/client/mc/release/linux-amd64/mc && \
    chmod +x mc && \
    mv mc /usr/local/bin/

# Copy initialization script
COPY init-buckets.sh /usr/local/bin/init-buckets.sh
RUN chmod +x /usr/local/bin/init-buckets.sh

# Create entrypoint script
RUN echo '#!/bin/bash' > /usr/local/bin/entrypoint.sh && \
    echo 'minio server /data --console-address ":9001" &' >> /usr/local/bin/entrypoint.sh && \
    echo 'sleep 10' >> /usr/local/bin/entrypoint.sh && \
    echo '/usr/local/bin/init-buckets.sh &' >> /usr/local/bin/entrypoint.sh && \
    echo 'wait' >> /usr/local/bin/entrypoint.sh && \
    chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
