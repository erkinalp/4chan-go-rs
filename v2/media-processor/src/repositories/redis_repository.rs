use anyhow::Result;
use deadpool_redis::{redis, Config as RedisConfig, Pool};

#[derive(Clone)]
pub struct RedisRepository {
    pool: Pool,
}

impl RedisRepository {
    pub fn new(url: &str) -> Result<Self> {
        let cfg = RedisConfig { url: Some(url.to_string()), ..RedisConfig::default() };
        let pool = cfg.create_pool(Some(deadpool_redis::Runtime::Tokio1))?;
        Ok(Self { pool })
    }

    pub async fn ping(&self) -> Result<String> {
        let mut conn = self.pool.get().await?;
        let pong: String = redis::cmd("PING").query_async(&mut conn).await?;
        Ok(pong)
    }
}
