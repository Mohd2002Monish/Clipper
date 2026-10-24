import { mcpToolService } from '../src/lib/services/mcpToolService';
import { connectMongo } from '../src/lib/db';
import { ThreadsPost } from '../src/models/ThreadsPost';

async function runTest() {
  console.log('Testing McpToolService...');
  await connectMongo();

  // 1. Test getTools
  const tools = mcpToolService.getTools();
  console.log(`Available tools count: ${tools.length}`);
  const toolNames = tools.map((t) => t.name);
  console.log(`Tools: ${toolNames.join(', ')}`);

  if (!toolNames.includes('create_post') || !toolNames.includes('list_providers')) {
    throw new Error('Missing core tools in getTools');
  }

  // 2. Test list_time_slots
  const timeSlots = await mcpToolService.executeTool('list_time_slots', {});
  console.log('Time slots returned:', timeSlots.slots?.length);
  if (timeSlots.slots?.length !== 5) {
    throw new Error('Expected 5 daily cinema slots');
  }

  // 3. Test list_providers
  const providers = await mcpToolService.executeTool('list_providers', {});
  console.log(`Providers count: ${providers.total}`);

  // 4. Test create_post (scheduled)
  const scheduledTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const created = await mcpToolService.executeTool('create_post', {
    providerId: 'default',
    posts: [
      {
        text: 'The 1975 masterpiece Deewaar is a masterclass in screenwriting. Vijay and Ravi represent two sides of the same moral dilemma.',
        topic: 'BollywoodCinema',
      },
      {
        text: 'Salim-Javed wrote dialogues that became part of the Indian cultural lexicon. Which Salim-Javed line is your all-time favorite?',
        topic: 'CinemaVault',
      },
    ],
    scheduleAt: scheduledTime,
    followUp: {
      enabled: true,
      text: "I've spent 1000s of hours finding movies that most people never discover. Comment #VAULT if you want early access when it launches.",
    },
  });

  console.log('Create post result:', created);
  if (!created.success || !created.threadId) {
    throw new Error('Failed to create post');
  }

  // 5. Test get_thread
  const thread = await mcpToolService.executeTool('get_thread', { threadId: created.threadId });
  console.log('Fetched thread status:', thread.status, 'posts count:', thread.posts.length);

  // 6. Test reschedule_thread
  const newTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const rescheduled = await mcpToolService.executeTool('reschedule_thread', {
    threadId: created.threadId,
    scheduledAt: newTime,
  });
  console.log('Rescheduled result:', rescheduled.message);

  // 7. Clean up test post
  await ThreadsPost.findByIdAndDelete(created.threadId);
  console.log('Cleaned up test post.');

  console.log('ALL MCP SERVICE TESTS PASSED PERFECTLY!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
