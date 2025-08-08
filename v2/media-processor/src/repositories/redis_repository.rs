use deadpool_redis::{redis, Config as RedisConfig, Pool};
use anyhow::Result;

#[derive(Clone)]
pub struct RedisRepository {
    pool: Pool,
}

impl RedisRepository {
    pub fn new(url: &str) -> Result<Self> {
        let mut cfg = RedisConfig::default();
        cfg.url = Some(url.to_string());
        let pool = cfg.create_pool(Some(deadpool_redis::Runtime::Tokio1))?;
        Ok(Self { pool })
    }

    pub async fn ping(&self) -> Result<String> {
        let mut conn = self.pool.get().await?;
        let pong: String = redis::cmd("PING").query_async(&mut conn).await?;
        Ok(pong)
    }
}
