import { readFileSync } from 'fs';
import { ClaudeIntegrationService } from './src/services/ai-trustworthiness.js';

// Load our synthetic datasets
const reliableMessages = JSON.parse(readFileSync('./test-uploads/reliable-user-messages.json', 'utf8'));
const unreliableMessages = JSON.parse(readFileSync('./test-uploads/unreliable-user-messages.json', 'utf8'));

// Extract content from messages
const reliableContent = reliableMessages.map(msg => msg.content);
const unreliableContent = unreliableMessages.map(msg => msg.content);

const config = {
  apiKey: process.env.CLAUDE_API_KEY,
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 30000
};

const aiService = new ClaudeIntegrationService(config);

console.log('🧠 Testing AI Analysis with Synthetic Datasets');
console.log('=====================================================');

async function testReliableUser() {
  console.log('\n📊 Analyzing RELIABLE user (Alex):');
  console.log(`- Messages: ${reliableContent.length}`);
  console.log(`- Sample: "${reliableContent[0].substring(0, 80)}..."`);
  
  try {
    const traits = await aiService.analyzeMessageHistory(reliableContent);
    console.log('\n✅ Results:');
    console.log(`  Conscientiousness: ${traits.conscientiousness}/100`);
    console.log(`  Neuroticism: ${traits.neuroticism}/100`);
    console.log(`  Agreeableness: ${traits.agreeableness}/100`);
    console.log(`  Openness: ${traits.openness}/100`);
    console.log(`  Extraversion: ${traits.extraversion}/100`);
    console.log(`  Confidence: ${traits.confidence}/100`);
    
    const trustScore = await aiService.calculateTrustworthiness(traits);
    console.log(`\n💯 Trust Score: ${trustScore.score}/100`);
    
    return { traits, trustScore };
  } catch (error) {
    console.error('❌ Error analyzing reliable user:', error.message);
    return null;
  }
}

async function testUnreliableUser() {
  console.log('\n📊 Analyzing UNRELIABLE user (Jordan):');
  console.log(`- Messages: ${unreliableContent.length}`);
  console.log(`- Sample: "${unreliableContent[0].substring(0, 80)}..."`);
  
  try {
    const traits = await aiService.analyzeMessageHistory(unreliableContent);
    console.log('\n✅ Results:');
    console.log(`  Conscientiousness: ${traits.conscientiousness}/100`);
    console.log(`  Neuroticism: ${traits.neuroticism}/100`);
    console.log(`  Agreeableness: ${traits.agreeableness}/100`);
    console.log(`  Openness: ${traits.openness}/100`);
    console.log(`  Extraversion: ${traits.extraversion}/100`);
    console.log(`  Confidence: ${traits.confidence}/100`);
    
    const trustScore = await aiService.calculateTrustworthiness(traits);
    console.log(`\n💯 Trust Score: ${trustScore.score}/100`);
    
    return { traits, trustScore };
  } catch (error) {
    console.error('❌ Error analyzing unreliable user:', error.message);
    return null;
  }
}

// Run the analysis
(async () => {
  const reliableResult = await testReliableUser();
  const unreliableResult = await testUnreliableUser();
  
  if (reliableResult && unreliableResult) {
    console.log('\n🎯 COMPARISON ANALYSIS:');
    console.log('======================');
    
    const diff = {
      conscientiousness: reliableResult.traits.conscientiousness - unreliableResult.traits.conscientiousness,
      neuroticism: unreliableResult.traits.neuroticism - reliableResult.traits.neuroticism,
      trustScore: reliableResult.trustScore.score - unreliableResult.trustScore.score
    };
    
    console.log(`Conscientiousness Gap: +${diff.conscientiousness.toFixed(1)} (Reliable > Unreliable)`);
    console.log(`Neuroticism Gap: +${diff.neuroticism.toFixed(1)} (Unreliable > Reliable)`);
    console.log(`Trust Score Gap: +${diff.trustScore.toFixed(1)} (Reliable > Unreliable)`);
    
    console.log('\n🧪 VALIDATION CHECKS:');
    console.log('====================');
    console.log(`✅ High conscientiousness reliable: ${reliableResult.traits.conscientiousness > 70 ? 'PASS' : 'FAIL'}`);
    console.log(`✅ High neuroticism unreliable: ${unreliableResult.traits.neuroticism > 60 ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Trust score difference > 20: ${diff.trustScore > 20 ? 'PASS' : 'FAIL'}`);
  }
})().catch(console.error);