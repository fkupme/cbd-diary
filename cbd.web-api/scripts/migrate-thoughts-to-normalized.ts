import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

/**
 * Data Migration Script: JSON to Normalized Tables
 * 
 * This script migrates existing JSON-stored thoughts and emotions
 * from the `thoughts` field in `cbt_entries` to normalized tables.
 */

const prisma = new PrismaClient();

interface OldThoughtChain {
  id?: string;
  thought: string;
  is_automatic?: boolean;
  intensity?: number;
  emotions?: OldEmotionEntry[];
  cognitive_distortions?: OldCognitiveDistortion[];
}

interface OldEmotionEntry {
  emotionId?: number;
  emotion_id?: number;
  id?: number;
  intensity?: number;
  duration_minutes?: number;
  name?: string;
  emoji?: string;
}

interface OldCognitiveDistortion {
  type: string;
  description?: string;
  intensity?: number;
}

async function migrateThoughtsToNormalizedTables() {
  console.log('🚀 Starting migration of thoughts from JSON to normalized tables...');

  try {
    // Get all CBT entries with JSON thoughts
    const entries = await prisma.cbtEntry.findMany({
      select: {
        id: true,
        thoughts: true,
        createdAt: true,
      },
    });

    console.log(`📊 Found ${entries.length} CBT entries to migrate`);

    let totalThoughts = 0;
    let totalEmotions = 0;
    let totalDistortions = 0;
    let skippedEntries = 0;

    for (const entry of entries) {
      try {
        // Parse JSON thoughts
        let thoughtsData: OldThoughtChain[] = [];
        
        if (typeof entry.thoughts === 'string') {
          try {
            thoughtsData = JSON.parse(entry.thoughts);
          } catch (e) {
            console.warn(`❌ Failed to parse thoughts JSON for entry ${entry.id}:`, e);
            skippedEntries++;
            continue;
          }
        } else if (Array.isArray(entry.thoughts)) {
	          thoughtsData = entry.thoughts as unknown as OldThoughtChain[];
        } else {
          console.warn(`⚠️ Unexpected thoughts format for entry ${entry.id}`);
          skippedEntries++;
          continue;
        }

        if (!Array.isArray(thoughtsData)) {
          console.warn(`⚠️ Thoughts data is not an array for entry ${entry.id}`);
          skippedEntries++;
          continue;
        }

        // Migrate each thought chain
        for (let i = 0; i < thoughtsData.length; i++) {
          const oldThought = thoughtsData[i];
          
          if (!oldThought.thought || typeof oldThought.thought !== 'string') {
            console.warn(`⚠️ Invalid thought text for entry ${entry.id}, thought ${i}`);
            continue;
          }

          // Create normalized thought chain
          const thoughtChainId = uuidv4();
          
          await prisma.thoughtChain.create({
            data: {
              id: thoughtChainId,
              cbtEntryId: entry.id,
              thought: oldThought.thought,
              isAutomatic: oldThought.is_automatic ?? false,
              intensity: oldThought.intensity ?? 5,
              orderIndex: i,
              createdAt: entry.createdAt,
              updatedAt: entry.createdAt,
            },
          });
          
          totalThoughts++;

          // Migrate emotions for this thought
          if (Array.isArray(oldThought.emotions)) {
            for (const oldEmotion of oldThought.emotions) {
              const emotionId = oldEmotion.emotionId ?? oldEmotion.emotion_id ?? oldEmotion.id;
              
              if (!emotionId || typeof emotionId !== 'number') {
                console.warn(`⚠️ Invalid emotion ID for entry ${entry.id}, thought ${i}:`, oldEmotion);
                continue;
              }

              // Verify emotion exists in database
              const emotionExists = await prisma.emotion.findUnique({
                where: { id: emotionId },
              });

              if (!emotionExists) {
                console.warn(`⚠️ Emotion ${emotionId} not found in database, skipping`);
                continue;
              }

              await prisma.emotionEntry.create({
                data: {
                  id: uuidv4(),
                  thoughtChainId: thoughtChainId,
                  emotionId: emotionId,
                  intensity: oldEmotion.intensity ?? 5,
                  durationMinutes: oldEmotion.duration_minutes,
                  createdAt: entry.createdAt,
                  updatedAt: entry.createdAt,
                },
              });
              
              totalEmotions++;
            }
          }

          // Migrate cognitive distortions for this thought
          if (Array.isArray(oldThought.cognitive_distortions)) {
            for (const oldDistortion of oldThought.cognitive_distortions) {
              if (!oldDistortion.type || typeof oldDistortion.type !== 'string') {
                console.warn(`⚠️ Invalid distortion type for entry ${entry.id}, thought ${i}`);
                continue;
              }

              await prisma.cognitiveDistortion.create({
                data: {
                  id: uuidv4(),
                  thoughtChainId: thoughtChainId,
                  type: oldDistortion.type,
                  description: oldDistortion.description,
                  intensity: oldDistortion.intensity ?? 5,
                  createdAt: entry.createdAt,
                  updatedAt: entry.createdAt,
                },
              });
              
              totalDistortions++;
            }
          }
        }

      } catch (error) {
        console.error(`❌ Failed to migrate entry ${entry.id}:`, error);
        skippedEntries++;
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log(`📊 Migration Statistics:`);
    console.log(`  - Processed entries: ${entries.length}`);
    console.log(`  - Skipped entries: ${skippedEntries}`);
    console.log(`  - Migrated thoughts: ${totalThoughts}`);
    console.log(`  - Migrated emotions: ${totalEmotions}`);
    console.log(`  - Migrated distortions: ${totalDistortions}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

async function verifyMigration() {
  console.log('\n🔍 Verifying migration...');

  const stats = await Promise.all([
    prisma.thoughtChain.count(),
    prisma.emotionEntry.count(),
    prisma.cognitiveDistortion.count(),
  ]);

  console.log(`📊 Verification Results:`);
  console.log(`  - Thought chains: ${stats[0]}`);
  console.log(`  - Emotion entries: ${stats[1]}`);
  console.log(`  - Cognitive distortions: ${stats[2]}`);

  // Sample query to test new analytics capabilities
  const emotionStats = await prisma.emotionEntry.groupBy({
    by: ['emotionId'],
    _count: {
      id: true,
    },
    _avg: {
      intensity: true,
    },
    orderBy: {
      _count: {
        id: 'desc',
      },
    },
    take: 5,
  });

  console.log('\n🎯 Top 5 emotions (new analytics):');
  for (const stat of emotionStats) {
    const emotion = await prisma.emotion.findUnique({
      where: { id: stat.emotionId },
      select: { nameKey: true, emoji: true },
    });
    
    console.log(`  ${emotion?.emoji} ${emotion?.nameKey}: ${stat._count.id} times (avg intensity: ${stat._avg.intensity?.toFixed(1)})`);
  }
}

async function main() {
  try {
    await migrateThoughtsToNormalizedTables();
    await verifyMigration();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration if called directly
if (require.main === module) {
  main();
}

export { migrateThoughtsToNormalizedTables, verifyMigration };