import test from 'node:test';
import assert from 'node:assert/strict';
import { testDatabase } from './e2e/test-database.mjs';

test('browser tests refuse app or remote databases and do not provision a provided test database',async()=>{
  const previous=process.env.E2E_DATABASE_URL;
  try {
    for(const url of ['postgresql://tester@127.0.0.1/strength_training','postgresql://tester@example.com/strength_test','postgresql://tester@127.0.0.1/strength_test?host=example.com']){
      process.env.E2E_DATABASE_URL=url;
      await assert.rejects(testDatabase(),/dedicated _test or _integration/);
    }
    // This unreachable port is deliberate: accepting an existing test URL must
    // not initialize, stop or remove a PostgreSQL cluster.
    const url='postgresql://tester@127.0.0.1:1/strength_e2e_test';
    process.env.E2E_DATABASE_URL=url;const database=await testDatabase();assert.equal(database.url,url);await database.close();
  } finally {if(previous===undefined)delete process.env.E2E_DATABASE_URL;else process.env.E2E_DATABASE_URL=previous;}
});
