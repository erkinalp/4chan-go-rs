use anyhow::Result;
use deadpool_redis::{redis, Config as RedisConfig, Pool};

#[derive(Clone)]
pub struct RedisRepository {
    pool: Pool,
}

impl RedisRepository {
    pub fn new(url: &str) -> Result<Self> {
        // deadpool_redis::Config::default() sets `connection`, which conflicts
        // with `url` ("url and connection must not be specified at the same time").
        let cfg = RedisConfig {
            url: Some(url.to_string()),
            connection: None,
            ..RedisConfig::default()
        };
        let pool = cfg.create_pool(Some(deadpool_redis::Runtime::Tokio1))?;
        Ok(Self { pool })
    }

    pub async fn ping(&self) -> Result<String> {
        let mut conn = self.pool.get().await?;
        let pong: String = redis::cmd("PING").query_async(&mut conn).await?;
        Ok(pong)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_accepts_valid_url() {
        // deadpool-redis creates the pool lazily — no connection is made here.
        let repo = RedisRepository::new("redis://127.0.0.1:6379");
        assert!(repo.is_ok(), "{:?}", repo.err());
    }

    #[test]
    fn new_rejects_invalid_url() {
        assert!(RedisRepository::new("not a url").is_err());
    }
}
