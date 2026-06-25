import { execSync } from 'child_process';
import path from 'path';

export default async function globalSetup(): Promise<void> {
  const composeFile = path.resolve(__dirname, 'docker-compose.test.yml');

  console.log('Starting test infrastructure...');
  execSync(`docker compose -f ${composeFile} up -d --wait`, {
    stdio: 'inherit',
    timeout: 120000,
  });

  // Wait for services to stabilize
  await new Promise((resolve) => setTimeout(resolve, 3000));
  console.log('Test infrastructure ready.');
}
