import { execSync } from 'child_process';
import path from 'path';

export default async function globalTeardown(): Promise<void> {
  const composeFile = path.resolve(__dirname, 'docker-compose.test.yml');

  console.log('Stopping test infrastructure...');
  execSync(`docker compose -f ${composeFile} down -v --remove-orphans`, {
    stdio: 'inherit',
    timeout: 60000,
  });
  console.log('Test infrastructure stopped.');
}
