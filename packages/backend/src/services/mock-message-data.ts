import { BigFiveTraits } from '../types/index.js';

/**
 * Mock message history data for testing personality trait analysis
 * Requirements: 2.4, 2.10
 */

export interface MockMessageProfile {
  name: string;
  description: string;
  messages: string[];
  expectedTraits: BigFiveTraits;
}

export const mockMessageProfiles: MockMessageProfile[] = [
  {
    name: 'High Conscientiousness Profile',
    description: 'Organized, responsible, and reliable individual',
    messages: [
      'I always make sure to complete my tasks on time and double-check my work.',
      'Planning ahead is really important to me. I keep detailed schedules and to-do lists.',
      'I believe in being punctual and reliable. If I say I\'ll do something, I follow through.',
      'Organization helps me stay focused and productive throughout the day.',
      'I prefer to finish projects well before the deadline to avoid any last-minute stress.',
      'Taking responsibility for my actions and decisions is something I value highly.',
      'I like to set clear goals and work systematically towards achieving them.',
      'Attention to detail is crucial in everything I do, whether it\'s work or personal projects.'
    ],
    expectedTraits: {
      conscientiousness: 85,
      neuroticism: 25,
      agreeableness: 70,
      openness: 60,
      extraversion: 50,
      confidence: 90
    }
  },
  {
    name: 'High Neuroticism Profile',
    description: 'Anxious, emotionally unstable individual',
    messages: [
      'I worry a lot about things that might go wrong, even small details.',
      'Sometimes I feel overwhelmed by stress and don\'t know how to handle it.',
      'I tend to get anxious about deadlines and whether I\'m doing things right.',
      'My mood can change quickly depending on what\'s happening around me.',
      'I often second-guess my decisions and wonder if I made the right choice.',
      'Criticism really affects me, even when it\'s meant to be constructive.',
      'I find it hard to relax and often feel tense or on edge.',
      'Small setbacks can really upset me and ruin my whole day.'
    ],
    expectedTraits: {
      conscientiousness: 45,
      neuroticism: 80,
      agreeableness: 60,
      openness: 55,
      extraversion: 35,
      confidence: 85
    }
  },
  {
    name: 'High Agreeableness Profile',
    description: 'Cooperative, trusting, and empathetic individual',
    messages: [
      'I really enjoy helping others and making sure everyone feels included.',
      'Cooperation and teamwork are so much better than competition in my opinion.',
      'I try to see the best in people and give them the benefit of the doubt.',
      'When there\'s conflict, I prefer to find compromises that work for everyone.',
      'I care deeply about other people\'s feelings and try not to hurt anyone.',
      'Volunteering and community service are important parts of my life.',
      'I believe most people are fundamentally good and well-intentioned.',
      'I\'d rather avoid confrontation and find peaceful solutions to problems.'
    ],
    expectedTraits: {
      conscientiousness: 65,
      neuroticism: 35,
      agreeableness: 90,
      openness: 70,
      extraversion: 60,
      confidence: 88
    }
  },
  {
    name: 'High Openness Profile',
    description: 'Creative, curious, and open to new experiences',
    messages: [
      'I love exploring new ideas and learning about different cultures and perspectives.',
      'Art, music, and creative expression are really important to me.',
      'I enjoy philosophical discussions and thinking about abstract concepts.',
      'Trying new foods, traveling to new places, and meeting new people excites me.',
      'I\'m always curious about how things work and why people think the way they do.',
      'I appreciate unconventional approaches and thinking outside the box.',
      'Reading about different topics and expanding my knowledge is a passion of mine.',
      'I find beauty in unexpected places and enjoy artistic and creative pursuits.'
    ],
    expectedTraits: {
      conscientiousness: 60,
      neuroticism: 40,
      agreeableness: 75,
      openness: 95,
      extraversion: 65,
      confidence: 92
    }
  },
  {
    name: 'High Extraversion Profile',
    description: 'Outgoing, energetic, and socially active individual',
    messages: [
      'I love being around people and get energized by social interactions.',
      'Parties and social gatherings are my favorite way to spend weekends.',
      'I\'m usually the one who starts conversations and tries to get everyone involved.',
      'I feel comfortable being the center of attention and speaking in public.',
      'Meeting new people and making connections comes naturally to me.',
      'I prefer working in teams rather than alone - collaboration is more fun.',
      'I\'m optimistic and enthusiastic about most things in life.',
      'I like to be active and busy rather than sitting quietly by myself.'
    ],
    expectedTraits: {
      conscientiousness: 70,
      neuroticism: 30,
      agreeableness: 80,
      openness: 75,
      extraversion: 90,
      confidence: 95
    }
  },
  {
    name: 'Balanced Profile',
    description: 'Well-rounded individual with moderate traits',
    messages: [
      'I try to balance work and personal life, being organized but also flexible.',
      'I enjoy both social activities and quiet time alone to recharge.',
      'I\'m open to new experiences but also appreciate familiar routines.',
      'I can handle stress reasonably well, though everyone has their limits.',
      'I like helping others but also make sure to take care of my own needs.',
      'I\'m interested in learning new things but don\'t need constant novelty.',
      'I can work independently or in teams, depending on what the situation requires.',
      'I try to be reliable and trustworthy while also being understanding of others.'
    ],
    expectedTraits: {
      conscientiousness: 65,
      neuroticism: 45,
      agreeableness: 70,
      openness: 60,
      extraversion: 55,
      confidence: 80
    }
  },
  {
    name: 'Low Trustworthiness Profile',
    description: 'Individual with traits that suggest lower creditworthiness',
    messages: [
      'I often change my mind about commitments and plans at the last minute.',
      'I get really stressed about money and financial responsibilities.',
      'Sometimes I avoid dealing with problems and hope they\'ll go away.',
      'I can be impulsive with purchases and don\'t always think things through.',
      'Deadlines and schedules feel restrictive to me, I prefer to go with the flow.',
      'I worry a lot about what others think of me and my decisions.',
      'I tend to procrastinate on important tasks, especially boring ones.',
      'I sometimes make promises I can\'t keep because I want to please people.'
    ],
    expectedTraits: {
      conscientiousness: 25,
      neuroticism: 75,
      agreeableness: 80,
      openness: 45,
      extraversion: 40,
      confidence: 70
    }
  }
];

/**
 * Service for generating mock message history for testing
 */
export class MockMessageService {
  /**
   * Get all available mock profiles
   */
  getAllProfiles(): MockMessageProfile[] {
    return mockMessageProfiles;
  }

  /**
   * Get a specific mock profile by name
   */
  getProfileByName(name: string): MockMessageProfile | undefined {
    return mockMessageProfiles.find(profile => profile.name === name);
  }

  /**
   * Get mock profiles filtered by expected trustworthiness score
   */
  getProfilesByTrustworthiness(minScore: number, maxScore: number): MockMessageProfile[] {
    return mockMessageProfiles.filter(profile => {
      // Calculate expected trustworthiness score using the same algorithm
      const traits = profile.expectedTraits;
      const score = Math.round(
        (traits.conscientiousness * 0.40) +
        ((100 - traits.neuroticism) * 0.25) +
        (traits.agreeableness * 0.20) +
        (traits.openness * 0.10) +
        (traits.extraversion * 0.05)
      );
      return score >= minScore && score <= maxScore;
    });
  }

  /**
   * Generate random message variations for testing
   */
  generateMessageVariations(baseMessages: string[], count: number = 5): string[] {
    const variations: string[] = [];
    const synonyms = {
      'really': ['very', 'extremely', 'quite', 'truly'],
      'important': ['crucial', 'vital', 'essential', 'significant'],
      'enjoy': ['love', 'like', 'appreciate', 'find pleasure in'],
      'always': ['consistently', 'regularly', 'constantly', 'invariably'],
      'people': ['individuals', 'folks', 'others', 'everyone']
    };

    for (let i = 0; i < count && i < baseMessages.length; i++) {
      let variation = baseMessages[i];
      
      // Apply simple synonym replacements
      Object.entries(synonyms).forEach(([word, replacements]) => {
        if (variation.includes(word)) {
          const replacement = replacements[Math.floor(Math.random() * replacements.length)];
          variation = variation.replace(new RegExp(`\\b${word}\\b`, 'i'), replacement);
        }
      });
      
      variations.push(variation);
    }

    return variations;
  }

  /**
   * Create a custom mock profile for testing specific scenarios
   */
  createCustomProfile(
    name: string,
    description: string,
    baseProfile: string,
    traitOverrides: Partial<BigFiveTraits>
  ): MockMessageProfile {
    const base = this.getProfileByName(baseProfile);
    if (!base) {
      throw new Error(`Base profile '${baseProfile}' not found`);
    }

    return {
      name,
      description,
      messages: this.generateMessageVariations(base.messages),
      expectedTraits: {
        ...base.expectedTraits,
        ...traitOverrides
      }
    };
  }
}

/**
 * Factory function to create mock message service
 */
export function createMockMessageService(): MockMessageService {
  return new MockMessageService();
}