import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';
import { BigFiveTraits, TrustScore, ScoreExplanation, AIAnalysis, BiasFlag, ErrorCodes } from '../types/index.js';

export interface PersonalityAnalysisService {
  analyzeMessageHistory(messages: string[]): Promise<BigFiveTraits>;
  calculateTrustworthiness(traits: BigFiveTraits): Promise<TrustScore>;
  explainScore(score: TrustScore): Promise<ScoreExplanation>;
}

export interface ClaudeAPIConfig {
  apiKey: string;
  maxRetries: number;
  retryDelay: number;
  timeout: number;
}

export class ClaudeIntegrationService implements PersonalityAnalysisService {
  private client: Anthropic;
  private config: ClaudeAPIConfig;
  private readonly MODEL_VERSION = 'claude-3-5-sonnet-20241022';

  constructor(config: ClaudeAPIConfig) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
  }

  /**
   * Analyzes message history to extract Big Five personality traits
   * Requirements: 2.1, 2.9
   */
  async analyzeMessageHistory(messages: string[]): Promise<BigFiveTraits> {
    if (!messages || messages.length === 0) {
      throw new Error('Message history cannot be empty');
    }

    const preprocessedMessages = this.preprocessMessages(messages);
    const prompt = this.buildPersonalityAnalysisPrompt(preprocessedMessages);

    try {
      const response = await this.callClaudeWithRetry(prompt);
      return this.parsePersonalityTraits(response);
    } catch (error) {
      throw new Error(`AI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculates trustworthiness score from Big Five traits
   * Requirements: 2.2, 2.3, 2.4
   */
  async calculateTrustworthiness(traits: BigFiveTraits): Promise<TrustScore> {
    // Weighted scoring algorithm as per requirements
    const weights = {
      conscientiousness: 0.40,
      neuroticism: 0.25,      // Inverse relationship
      agreeableness: 0.20,
      openness: 0.10,
      extraversion: 0.05
    };

    // Calculate weighted score (neuroticism is inversely related)
    const score = Math.round(
      (traits.conscientiousness * weights.conscientiousness) +
      ((100 - traits.neuroticism) * weights.neuroticism) +
      (traits.agreeableness * weights.agreeableness) +
      (traits.openness * weights.openness) +
      (traits.extraversion * weights.extraversion)
    );

    // Ensure score is within valid range
    const normalizedScore = Math.max(0, Math.min(100, score));

    const now = new Date();
    const expiresAt = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days

    return {
      score: normalizedScore,
      traits,
      confidenceLevel: traits.confidence,
      lastUpdated: now,
      expiresAt
    };
  }

  /**
   * Provides explanation for trustworthiness score
   * Requirements: 2.8
   */
  async explainScore(score: TrustScore): Promise<ScoreExplanation> {
    const weights = {
      conscientiousness: 0.40,
      neuroticism: 0.25,
      agreeableness: 0.20,
      openness: 0.10,
      extraversion: 0.05
    };

    const traitContributions = [
      {
        trait: 'conscientiousness' as keyof BigFiveTraits,
        value: score.traits.conscientiousness,
        weight: weights.conscientiousness,
        contribution: score.traits.conscientiousness * weights.conscientiousness
      },
      {
        trait: 'neuroticism' as keyof BigFiveTraits,
        value: score.traits.neuroticism,
        weight: weights.neuroticism,
        contribution: (100 - score.traits.neuroticism) * weights.neuroticism
      },
      {
        trait: 'agreeableness' as keyof BigFiveTraits,
        value: score.traits.agreeableness,
        weight: weights.agreeableness,
        contribution: score.traits.agreeableness * weights.agreeableness
      },
      {
        trait: 'openness' as keyof BigFiveTraits,
        value: score.traits.openness,
        weight: weights.openness,
        contribution: score.traits.openness * weights.openness
      },
      {
        trait: 'extraversion' as keyof BigFiveTraits,
        value: score.traits.extraversion,
        weight: weights.extraversion,
        contribution: score.traits.extraversion * weights.extraversion
      }
    ];

    const confidenceFactors = this.generateConfidenceFactors(score);
    const recommendations = this.generateRecommendations(score);

    return {
      overallScore: score.score,
      traitContributions,
      confidenceFactors,
      recommendations
    };
  }

  /**
   * Preprocesses message history for analysis
   * Removes PII and normalizes text
   */
  private preprocessMessages(messages: string[]): string[] {
    return messages.map(message => {
      // Remove potential PII patterns
      let cleaned = message
        .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')           // SSN
        .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]') // Credit card
        .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]') // Email
        .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]')  // Phone
        .replace(/\b\d{1,5}\s\w+\s(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)\b/gi, '[ADDRESS]'); // Address

      // Normalize whitespace
      cleaned = cleaned.replace(/\s+/g, ' ').trim();
      
      return cleaned;
    }).filter(message => message.length > 10); // Filter out very short messages
  }

  /**
   * Builds the prompt for personality analysis using Claude
   */
  private buildPersonalityAnalysisPrompt(messages: string[]): string {
    const messageText = messages.join('\n\n');
    
    return `You are a psychological assessment expert specializing in the Big Five personality model. Analyze the following text messages and extract personality traits.

IMPORTANT INSTRUCTIONS:
1. Focus only on personality traits, not demographic characteristics
2. Base analysis on communication patterns, word choice, and expressed attitudes
3. Avoid bias based on topics discussed or cultural references
4. Provide confidence scores based on text quality and quantity

TEXT TO ANALYZE:
${messageText}

Please analyze these messages and provide scores (0-100) for each Big Five trait:

1. CONSCIENTIOUSNESS: Organization, responsibility, self-discipline, goal-orientation
2. NEUROTICISM: Emotional instability, anxiety, moodiness, stress sensitivity  
3. AGREEABLENESS: Cooperation, trust, empathy, altruism
4. OPENNESS: Creativity, curiosity, openness to experience, intellectual interests
5. EXTRAVERSION: Sociability, assertiveness, energy, positive emotions

Respond with ONLY a JSON object in this exact format:
{
  "conscientiousness": <score 0-100>,
  "neuroticism": <score 0-100>,
  "agreeableness": <score 0-100>,
  "openness": <score 0-100>,
  "extraversion": <score 0-100>,
  "confidence": <overall confidence 0-100>
}

Base confidence on:
- Text quantity (more text = higher confidence)
- Text quality (coherent, varied content = higher confidence)
- Trait clarity (clear indicators = higher confidence)`;
  }

  /**
   * Calls Claude API with retry logic
   */
  private async callClaudeWithRetry(prompt: string): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await this.client.messages.create({
          model: this.MODEL_VERSION,
          max_tokens: 1000,
          temperature: 0.1, // Low temperature for consistent analysis
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        });

        if (response.content && response.content.length > 0) {
          const content = response.content[0];
          if (content.type === 'text') {
            return content.text;
          }
        }

        throw new Error('Invalid response format from Claude API');
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          await this.sleep(delay);
        }
      }
    }

    throw new Error(`Claude API failed after ${this.config.maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Parses personality traits from Claude response
   */
  private parsePersonalityTraits(response: string): BigFiveTraits {
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      const requiredFields = ['conscientiousness', 'neuroticism', 'agreeableness', 'openness', 'extraversion', 'confidence'];
      for (const field of requiredFields) {
        if (typeof parsed[field] !== 'number' || parsed[field] < 0 || parsed[field] > 100) {
          throw new Error(`Invalid ${field} value: ${parsed[field]}`);
        }
      }

      return {
        conscientiousness: Math.round(parsed.conscientiousness),
        neuroticism: Math.round(parsed.neuroticism),
        agreeableness: Math.round(parsed.agreeableness),
        openness: Math.round(parsed.openness),
        extraversion: Math.round(parsed.extraversion),
        confidence: Math.round(parsed.confidence)
      };
    } catch (error) {
      throw new Error(`Failed to parse personality traits: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generates confidence factors for score explanation
   */
  private generateConfidenceFactors(score: TrustScore): string[] {
    const factors: string[] = [];
    
    if (score.confidenceLevel >= 80) {
      factors.push('High-quality message history with clear personality indicators');
    } else if (score.confidenceLevel >= 60) {
      factors.push('Moderate message history with some personality indicators');
    } else {
      factors.push('Limited message history - consider providing more communication samples');
    }

    if (score.traits.conscientiousness >= 70) {
      factors.push('Strong indicators of reliability and responsibility');
    }

    if (score.traits.neuroticism <= 30) {
      factors.push('Low emotional instability suggests stable decision-making');
    }

    if (score.traits.agreeableness >= 60) {
      factors.push('Cooperative communication style indicates trustworthiness');
    }

    return factors;
  }

  /**
   * Generates recommendations based on score
   */
  private generateRecommendations(score: TrustScore): string[] {
    const recommendations: string[] = [];

    if (score.score >= 70) {
      recommendations.push('Eligible for standard loan terms based on personality assessment');
    } else if (score.score >= 50) {
      recommendations.push('Consider community endorsements to strengthen application');
      recommendations.push('Smaller initial loan amounts recommended');
    } else {
      recommendations.push('Alternative verification methods recommended');
      recommendations.push('Community-based trust building suggested');
    }

    if (score.confidenceLevel < 60) {
      recommendations.push('Provide additional communication history for more accurate assessment');
    }

    return recommendations;
  }

  /**
   * Creates hash of message history for audit trail
   */
  createMessageHistoryHash(messages: string[]): string {
    const combined = messages.join('|');
    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  /**
   * Utility function for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Factory function to create Claude integration service
 */
export function createClaudeIntegrationService(): ClaudeIntegrationService {
  const config: ClaudeAPIConfig = {
    apiKey: process.env.CLAUDE_API_KEY || '',
    maxRetries: parseInt(process.env.CLAUDE_MAX_RETRIES || '3'),
    retryDelay: parseInt(process.env.CLAUDE_RETRY_DELAY || '1000'),
    timeout: parseInt(process.env.CLAUDE_TIMEOUT || '30000')
  };

  if (!config.apiKey) {
    throw new Error('CLAUDE_API_KEY environment variable is required');
  }

  return new ClaudeIntegrationService(config);
}