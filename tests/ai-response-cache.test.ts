import test from 'node:test';
import assert from 'node:assert/strict';
import { AiResponseCache } from '../src/core/ai-response-cache.ts';

test('AiResponseCache는 데이터를 저장하고 조회할 수 있다', () => {
  const cache = new AiResponseCache(10, 5000);
  const key = cache.hashKey('test_prompt');

  cache.set(key, '생성된 응답', { durationMs: 500, evalCount: 30 });
  const entry = cache.get(key);

  assert.ok(entry);
  assert.equal(entry?.data, '생성된 응답');
  assert.equal(entry?.metrics?.durationMs, 500);
  assert.equal(entry?.metrics?.evalCount, 30);
});

test('AiResponseCache는 TTL 만료 시 null을 반환한다', async () => {
  const cache = new AiResponseCache(10, 50); // 50ms TTL
  const key = cache.hashKey('expiring_prompt');

  cache.set(key, '곧 만료될 응답', undefined, 50);
  assert.ok(cache.get(key));

  await new Promise(resolve => setTimeout(resolve, 60));
  assert.equal(cache.get(key), null);
});

test('AiResponseCache는 최대 개수를 초과하면 오래된 항목을 제거한다', () => {
  const cache = new AiResponseCache(3, 10000);

  cache.set('k1', 'val1');
  cache.set('k2', 'val2');
  cache.set('k3', 'val3');
  assert.equal(cache.size(), 3);

  cache.set('k4', 'val4');
  assert.equal(cache.size(), 3);
  assert.equal(cache.get('k1'), null); // k1 제거됨
  assert.ok(cache.get('k4'));
});
