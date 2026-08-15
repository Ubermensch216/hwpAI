import test from 'node:test';
import assert from 'node:assert/strict';
import { AiChatStore, type ChatSession } from '../src/core/ai-chat-store.ts';

test('AiChatStore는 세션을 저장하고 불러올 수 있다', async () => {
  const store = new AiChatStore();

  const session: ChatSession = {
    id: 'test-session-1',
    documentName: '보고서.hwpx',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [
      { role: 'user', content: '문서 요약해줘' },
      { role: 'assistant', content: '요약 결과입니다.' },
    ],
  };

  await store.saveSession(session);

  const loaded = await store.loadSession('test-session-1');
  assert.ok(loaded);
  assert.equal(loaded?.id, 'test-session-1');
  assert.equal(loaded?.documentName, '보고서.hwpx');
  assert.equal(loaded?.messages.length, 2);
  assert.equal(loaded?.messages[0].content, '문서 요약해줘');

  const list = await store.listSessions('보고서.hwpx');
  assert.equal(list.length, 1);

  await store.deleteSession('test-session-1');
  const deleted = await store.loadSession('test-session-1');
  assert.equal(deleted, null);
});

test('AiChatStore는 최대 세션 개수를 유지하며 오래된 세션을 정리한다', async () => {
  const store = new AiChatStore();

  for (let i = 1; i <= 5; i++) {
    await store.saveSession({
      id: `session-${i}`,
      documentName: '문서.hwpx',
      createdAt: Date.now() + i,
      updatedAt: Date.now() + i,
      messages: [{ role: 'user', content: `질문 ${i}` }],
    });
  }

  const allBefore = await store.listSessions();
  assert.equal(allBefore.length, 5);

  await store.pruneOldSessions(3);
  const allAfter = await store.listSessions();
  assert.equal(allAfter.length, 3);
  // 최신 3개만 남아있어야 함
  assert.equal(allAfter[0].id, 'session-5');
  assert.equal(allAfter[1].id, 'session-4');
  assert.equal(allAfter[2].id, 'session-3');
});
