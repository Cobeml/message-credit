import { describe, it, expect } from 'vitest';
import { ClaudeIntegrationService } from '../services/ai-trustworthiness.js';

// Test configuration
const config = {
  apiKey: process.env.CLAUDE_API_KEY || 'test-key',
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 60000
};

// Reliable user messages (high conscientiousness, low neuroticism)
const reliableUserMessages = [
  "Just finished setting up my automatic savings transfer for this month. $500 going into my emergency fund as planned.",
  "Rent payment submitted 3 days early again. I always try to pay bills well before the due date to avoid any issues.",
  "Reviewing my monthly budget spreadsheet. Staying within limits on all categories so far. Food expenses down 8% from last month.", 
  "Credit card balance paid in full, as always. Never carry a balance - the interest rates are just too high to justify.",
  "Car maintenance done on schedule. Regular maintenance prevents expensive repairs later. Same principle applies to finances.",
  "Investment portfolio rebalanced quarterly as planned. Staying disciplined with my long-term strategy regardless of market noise.",
  "Friend asked to borrow $2000. I said yes but drafted a simple loan agreement with payment schedule. Protecting our friendship.",
  "Annual insurance review completed. Increased coverage slightly due to salary raise. Always keep coverage aligned with assets.",
  "May budget planning session complete. Allocating extra income from bonus: 50% savings, 30% investments, 20% fun money.",
  "Student loan payment made early again. On track to pay off 2 years ahead of schedule by making extra principal payments.",
  "Emergency fund now covers 8 months of expenses. Financial security gives me peace of mind to take calculated risks.",
  "Quarterly financial review shows I'm ahead of all savings goals. Consistency and discipline really pay off long-term.",
  "Mortgage payment included extra $300 toward principal. Small consistent payments save thousands in interest over time.",
  "Turned down an expensive impulse purchase today. Asked myself: does this align with my values and goals? Answer was no.",
  "Retirement account maxed out for the year by August. Front-loading contributions maximizes compound growth time."
];

// Unreliable user messages (high neuroticism, low conscientiousness)
const unreliableUserMessages = [
  "Ugh rent is due tomorrow and I totally forgot again. Why is it always at the worst time when I'm already stressed?",
  "Can't sleep, keep worrying about money. Maybe I shouldn't have bought those concert tickets but YOLO right?",
  "Overdraft fee AGAIN. This is so unfair, how was I supposed to know that charge would go through today?",
  "Credit card bill is higher than I thought... I'll just pay the minimum this month and figure it out later.",
  "Saw this amazing jacket on sale for $200. I know I shouldn't but it's 50% off! That's basically saving money right?",
  "Mom called asking when I'll pay her back the $500. I feel terrible but things are just really tight right now.",
  "Stress eating again. Ordered $40 worth of takeout because cooking felt overwhelming today. Bad week financially.",
  "Late fee on my phone bill because I kept forgetting to pay it. Why is everything so complicated and expensive?",
  "Emergency car repair: $800! Where am I supposed to get that money? This always happens at the worst times.",
  "Had to use my credit card for the car repair. I hate adding more debt but what choice did I have?",
  "Credit card declined at grocery store. So humiliating! I thought I had more room on that card.",
  "Can't stop thinking about all my debt. It keeps me up at night. How did I let it get this bad?",
  "Another overdraft fee because I forgot about that automatic payment. Banking fees are eating me alive.",
  "Emotional shopping spree after bad day at work. Spent $300 I don't have on clothes that probably don't even fit.",
  "Panic attack at the ATM when I checked my balance. $47 until payday and it's only Wednesday."
];

describe('AI Pipeline Validation with Research-Based Synthetic Data', () => {
  // Skip if no API key
  const hasApiKey = process.env.CLAUDE_API_KEY && process.env.CLAUDE_API_KEY !== 'test-key';
  
  if (!hasApiKey) {
    it.skip('Skipping AI tests - no Claude API key provided', () => {
      console.log('⚠️  Skipping AI analysis tests - CLAUDE_API_KEY not configured');
    });
    return;
  }

  const aiService = new ClaudeIntegrationService(config);

  it('should identify reliable user as high conscientiousness, low neuroticism', async () => {
    console.log('\n🧠 Testing RELIABLE user personality analysis');
    console.log('Expected: High Conscientiousness (>70), Low Neuroticism (<40)');
    console.log(`Analyzing ${reliableUserMessages.length} financial behavior messages...`);

    const traits = await aiService.analyzeMessageHistory(reliableUserMessages);
    const trustScore = await aiService.calculateTrustworthiness(traits);

    console.log('\n📊 RELIABLE User Results:');
    console.log(`  Conscientiousness: ${traits.conscientiousness}/100 ${traits.conscientiousness > 70 ? '✅' : '❌'}`);
    console.log(`  Neuroticism: ${traits.neuroticism}/100 ${traits.neuroticism < 40 ? '✅' : '❌'}`);
    console.log(`  Agreeableness: ${traits.agreeableness}/100`);
    console.log(`  Openness: ${traits.openness}/100`);
    console.log(`  Extraversion: ${traits.extraversion}/100`);
    console.log(`  Confidence: ${traits.confidence}/100`);
    console.log(`  Trust Score: ${trustScore.score}/100 ${trustScore.score > 70 ? '✅' : '❌'}`);

    // Research-based expectations for financially reliable behavior
    expect(traits.conscientiousness).toBeGreaterThan(70); // Should show high organization/planning
    expect(traits.neuroticism).toBeLessThan(40);           // Should show low anxiety/stress
    expect(trustScore.score).toBeGreaterThan(70);          // Should have high trust score

    return { traits, trustScore, type: 'reliable' };
  }, 90000);

  it('should identify unreliable user as low conscientiousness, high neuroticism', async () => {
    console.log('\n🧠 Testing UNRELIABLE user personality analysis');  
    console.log('Expected: Low Conscientiousness (<40), High Neuroticism (>60)');
    console.log(`Analyzing ${unreliableUserMessages.length} financial behavior messages...`);

    const traits = await aiService.analyzeMessageHistory(unreliableUserMessages);
    const trustScore = await aiService.calculateTrustworthiness(traits);

    console.log('\n📊 UNRELIABLE User Results:');
    console.log(`  Conscientiousness: ${traits.conscientiousness}/100 ${traits.conscientiousness < 40 ? '✅' : '❌'}`);
    console.log(`  Neuroticism: ${traits.neuroticism}/100 ${traits.neuroticism > 60 ? '✅' : '❌'}`);
    console.log(`  Agreeableness: ${traits.agreeableness}/100`);
    console.log(`  Openness: ${traits.openness}/100`);
    console.log(`  Extraversion: ${traits.extraversion}/100`);
    console.log(`  Confidence: ${traits.confidence}/100`);
    console.log(`  Trust Score: ${trustScore.score}/100 ${trustScore.score < 50 ? '✅' : '❌'}`);

    // Research-based expectations for financially unreliable behavior  
    expect(traits.conscientiousness).toBeLessThan(40);    // Should show low organization/planning
    expect(traits.neuroticism).toBeGreaterThan(60);       // Should show high anxiety/stress
    expect(trustScore.score).toBeLessThan(50);            // Should have low trust score

    return { traits, trustScore, type: 'unreliable' };
  }, 90000);

  it('should show statistically significant differences between user types', async () => {
    console.log('\n🎯 COMPARATIVE ANALYSIS: Testing AI differentiation capability');
    
    const reliableTraits = await aiService.analyzeMessageHistory(reliableUserMessages);
    const unreliableTraits = await aiService.analyzeMessageHistory(unreliableUserMessages);
    
    const reliableTrust = await aiService.calculateTrustworthiness(reliableTraits);
    const unreliableTrust = await aiService.calculateTrustworthiness(unreliableTraits);

    // Calculate gaps (reliable - unreliable for positive traits, unreliable - reliable for negative)
    const conscientiousnessGap = reliableTraits.conscientiousness - unreliableTraits.conscientiousness;
    const neuroticismGap = unreliableTraits.neuroticism - reliableTraits.neuroticism;
    const trustGap = reliableTrust.score - unreliableTrust.score;

    console.log('\n📈 DIFFERENTIATION ANALYSIS:');
    console.log('=================================');
    console.log(`Reliable User    - C: ${reliableTraits.conscientiousness}, N: ${reliableTraits.neuroticism}, T: ${reliableTrust.score}`);
    console.log(`Unreliable User  - C: ${unreliableTraits.conscientiousness}, N: ${unreliableTraits.neuroticism}, T: ${unreliableTrust.score}`);
    console.log('');
    console.log(`Conscientiousness Gap: +${conscientiousnessGap.toFixed(1)} (Reliable > Unreliable) ${conscientiousnessGap > 25 ? '✅' : '❌'}`);
    console.log(`Neuroticism Gap: +${neuroticismGap.toFixed(1)} (Unreliable > Reliable) ${neuroticismGap > 15 ? '✅' : '❌'}`);
    console.log(`Trust Score Gap: +${trustGap.toFixed(1)} (Reliable > Unreliable) ${trustGap > 20 ? '✅' : '❌'}`);

    // Validate meaningful differentiation based on research
    expect(conscientiousnessGap).toBeGreaterThan(25); // Strong differentiation in planning/organization
    expect(neuroticismGap).toBeGreaterThan(15);        // Clear differentiation in emotional stability
    expect(trustGap).toBeGreaterThan(20);              // Significant trust score difference

    console.log('\n🏆 VALIDATION SUMMARY:');
    console.log('======================');
    const validationResults = {
      conscientiousDiff: conscientiousnessGap > 25,
      neuroticismDiff: neuroticismGap > 15,
      trustDiff: trustGap > 20
    };
    
    const passCount = Object.values(validationResults).filter(Boolean).length;
    console.log(`✅ Tests Passed: ${passCount}/3`);
    console.log(`📊 AI Differentiation Accuracy: ${((passCount/3) * 100).toFixed(1)}%`);

    if (passCount === 3) {
      console.log('🎉 EXCELLENT: AI successfully differentiates financial behavior patterns!');
    } else if (passCount >= 2) {
      console.log('👍 GOOD: AI shows meaningful differentiation with room for improvement');
    } else {
      console.log('⚠️  NEEDS WORK: AI differentiation below expectations');
    }

    return {
      reliable: { traits: reliableTraits, trust: reliableTrust },
      unreliable: { traits: unreliableTraits, trust: unreliableTrust },
      gaps: { conscientiousnessGap, neuroticismGap, trustGap },
      validationResults,
      accuracy: (passCount/3) * 100
    };
  }, 180000);
});