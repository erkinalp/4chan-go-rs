package database

import (
	"context"
	"fmt"
	"time"

	"github.com/erkinalp/4chan-go-rs/v2/file-service/config"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresDB represents a PostgreSQL database connection
type PostgresDB struct {
	pool *pgxpool.Pool
}

// NewPostgresDB creates a new PostgreSQL database connection
func NewPostgresDB(cfg config.DatabaseConfig) (*PostgresDB, error) {
	// Create a connection pool configuration
	poolConfig, err := pgxpool.ParseConfig(cfg.ConnectionString)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database connection string: %w", err)
	}

	// Set connection pool parameters
	poolConfig.MaxConns = int32(cfg.MaxOpenConns)
	poolConfig.MinConns = int32(cfg.MaxIdleConns)
	poolConfig.MaxConnLifetime = time.Duration(cfg.ConnMaxLifetime) * time.Second

	// Create a connection pool
	pool, err := pgxpool.NewWithConfig(context.Background(), poolConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Test connection
	if err := pool.Ping(context.Background()); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return &PostgresDB{pool: pool}, nil
}

// Close closes the database connection
func (db *PostgresDB) Close() {
	if db.pool != nil {
		db.pool.Close()
	}
}

// GetPool returns the connection pool
func (db *PostgresDB) GetPool() *pgxpool.Pool {
	return db.pool
}

// Ping checks if the database connection is alive
func (db *PostgresDB) Ping(ctx context.Context) error {
	return db.pool.Ping(ctx)
}

// RunMigrations runs database migrations
func (db *PostgresDB) RunMigrations() error {
	// Use golang-migrate to run migrations
	migrationDir := "file://migrations"

	// Create a new migrate instance
	m, err := migrate.New(migrationDir, db.pool.Config().ConnConfig.ConnString())
	if err != nil {
		return fmt.Errorf("failed to create migrate instance: %w", err)
	}

	// Run migrations
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	return nil
}
