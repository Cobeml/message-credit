import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { ClaudeIntegrationService } from '../services/ai-trustworthiness.js';
import type { BigFiveTraits } from '../types/index.js';

// Test configuration
const config = {
  apiKey: process.env.CLAUDE_API_KEY || 'test-key',
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 60000 // Increased timeout for real API calls
};

describe('Synthetic Data AI Analysis', () => {
  // Skip if no API key
  const hasApiKey = process.env.CLAUDE_API_KEY && process.env.CLAUDE_API_KEY !== 'test-key';
  
  if (!hasApiKey) {
    it.skip('Skipping AI tests - no Claude API key provided', () => {});
    return;
  }

  const aiService = new ClaudeIntegrationService(config);

  it('should analyze reliable user (Alex) and show high conscientiousness', async () => {
    // Load reliable user dataset
    const dataPath = path.join(process.cwd(), 'test-uploads', 'reliable-user-messages.json');
    const messagesData = JSON.parse(readFileSync(dataPath, 'utf8'));
    const messageContents = messagesData.map((msg: any) => msg.content).slice(0, 20); // Use first 20 for speed

    console.log(`\n🧠 Analyzing RELIABLE user (Alex) with ${messageContents.length} messages`);
    console.log(`Sample: "${messageContents[0].substring(0, 80)}..."`);

    // Analyze personality traits
    const traits = await aiService.analyzeMessageHistory(messageContents);
    
    console.log('\n✅ Personality Analysis Results:');
    console.log(`  Conscientiousness: ${traits.conscientiousness}/100`);
    console.log(`  Neuroticism: ${traits.neuroticism}/100`);
    console.log(`  Agreeableness: ${traits.agreeableness}/100`);
    console.log(`  Openness: ${traits.openness}/100`);
    console.log(`  Extraversion: ${traits.extraversion}/100`);
    console.log(`  Confidence: ${traits.confidence}/100`);

    // Calculate trustworthiness score
    const trustScore = await aiService.calculateTrustworthiness(traits);
    console.log(`\n💯 Trust Score: ${trustScore.score}/100`);

    // Validate expected patterns for reliable user
    expect(traits.conscientiousness).toBeGreaterThan(60); // Should show high organization/reliability
    expect(traits.neuroticism).toBeLessThan(50);          // Should show low anxiety/stress
    expect(trustScore.score).toBeGreaterThan(65);         // Should have decent trust score

    return { traits, trustScore, userType: 'reliable' };
  }, 120000); // 2 minute timeout

  it('should analyze unreliable user (Jordan) and show high neuroticism, low conscientiousness', async () => {
    // Load unreliable user dataset
    const dataPath = path.join(process.cwd(), 'test-uploads', 'unreliable-user-messages.json');
    const messagesData = JSON.parse(readFileSync(dataPath, 'utf8'));
    const messageContents = messagesData.map((msg: any) => msg.content).slice(0, 20); // Use first 20 for speed

    console.log(`\n🧠 Analyzing UNRELIABLE user (Jordan) with ${messageContents.length} messages`);
    console.log(`Sample: "${messageContents[0].substring(0, 80)}..."`);

    // Analyze personality traits
    const traits = await aiService.analyzeMessageHistory(messageContents);
    
    console.log('\n✅ Personality Analysis Results:');
    console.log(`  Conscientiousness: ${traits.conscientiousness}/100`);
    console.log(`  Neuroticism: ${traits.neuroticism}/100`);
    console.log(`  Agreeableness: ${traits.agreeableness}/100`);
    console.log(`  Openness: ${traits.openness}/100`);
    console.log(`  Extraversion: ${traits.extraversion}/100`);
    console.log(`  Confidence: ${traits.confidence}/100`);

    // Calculate trustworthiness score
    const trustScore = await aiService.calculateTrustworthiness(traits);
    console.log(`\n💯 Trust Score: ${trustScore.score}/100`);

    // Validate expected patterns for unreliable user
    expect(traits.conscientiousness).toBeLessThan(50);    // Should show low organization/reliability
    expect(traits.neuroticism).toBeGreaterThan(55);       // Should show high anxiety/stress
    expect(trustScore.score).toBeLessThan(55);            // Should have lower trust score

    return { traits, trustScore, userType: 'unreliable' };
  }, 120000); // 2 minute timeout

  it('should show meaningful differences between reliable and unreliable users', async () => {
    // This test will run both analyses and compare
    const reliableData = JSON.parse(readFileSync(path.join(process.cwd(), 'test-uploads', 'reliable-user-messages.json'), 'utf8'));
    const unreliableData = JSON.parse(readFileSync(path.join(process.cwd(), 'test-uploads', 'unreliable-user-messages.json'), 'utf8'));
    
    const reliableMessages = reliableData.map((msg: any) => msg.content).slice(0, 15);
    const unreliableMessages = unreliableData.map((msg: any) => msg.content).slice(0, 15);

    console.log('\n🎯 COMPARATIVE ANALYSIS');
    console.log('========================');

    // Analyze both users
    const reliableTraits = await aiService.analyzeMessageHistory(reliableMessages);
    const unreliableTraits = await aiService.analyzeMessageHistory(unreliableMessages);
    
    const reliableTrust = await aiService.calculateTrustworthiness(reliableTraits);
    const unreliableTrust = await aiService.calculateTrustworthiness(unreliableTraits);

    // Calculate differences
    const conscientiousnessGap = reliableTraits.conscientiousness - unreliableTraits.conscientiousness;
    const neuroticismGap = unreliableTraits.neuroticism - reliableTraits.neuroticism;
    const trustGap = reliableTrust.score - unreliableTrust.score;

    console.log('\n📊 RESULTS COMPARISON:');
    console.log(`Alex (Reliable)   - Conscientiousness: ${reliableTraits.conscientiousness}, Neuroticism: ${reliableTraits.neuroticism}, Trust: ${reliableTrust.score}`);
    console.log(`Jordan (Unreliable) - Conscientiousness: ${unreliableTraits.conscientiousness}, Neuroticism: ${unreliableTraits.neuroticism}, Trust: ${unreliableTrust.score}`);

    console.log('\n🔍 GAPS:');
    console.log(`Conscientiousness Gap: ${conscientiousnessGap.toFixed(1)} points (Reliable > Unreliable)`);
    console.log(`Neuroticism Gap: ${neuroticismGap.toFixed(1)} points (Unreliable > Reliable)`);
    console.log(`Trust Score Gap: ${trustGap.toFixed(1)} points (Reliable > Unreliable)`);

    // Validate that differences align with expectations
    expect(conscientiousnessGap).toBeGreaterThan(10); // Reliable should be significantly more conscientious
    expect(neuroticismGap).toBeGreaterThan(5);         // Unreliable should be more neurotic
    expect(trustGap).toBeGreaterThan(10);              // Reliable should have higher trust score

    console.log('\n✅ VALIDATION RESULTS:');
    console.log(`✅ Conscientiousness differentiation: ${conscientiousnessGap > 10 ? 'PASS' : 'FAIL'} (${conscientiousnessGap.toFixed(1)} > 10)`);
    console.log(`✅ Neuroticism differentiation: ${neuroticismGap > 5 ? 'PASS' : 'FAIL'} (${neuroticismGap.toFixed(1)} > 5)`);
    console.log(`✅ Trust score differentiation: ${trustGap > 10 ? 'PASS' : 'FAIL'} (${trustGap.toFixed(1)} > 10)`);

    return {
      reliable: { traits: reliableTraits, trust: reliableTrust },
      unreliable: { traits: unreliableTraits, trust: unreliableTrust },
      gaps: { conscientiousnessGap, neuroticismGap, trustGap }
    };
  }, 180000); // 3 minute timeout for double analysis
});