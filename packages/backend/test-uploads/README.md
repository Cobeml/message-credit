# Test Message Datasets for MVP Validation

This directory contains realistic test message datasets designed to validate the AI trustworthiness scoring system for the Community P2P Lending Platform.

## Dataset Overview

### Reliable User Dataset
- **Files**: `reliable-user-messages.json`, `reliable-user-whatsapp.txt`
- **Message Count**: 105+ messages
- **Time Span**: ~8 months (February 2024 - October 2024)
- **Behavioral Patterns**:
  - Consistent on-time rent payments
  - Early credit card payments in full
  - Fulfilled promises and commitments
  - Proactive financial planning and budgeting
  - Responsible borrowing and lending behavior
  - Strong credit score improvement over time
  - Emergency fund building and investment discipline

### Unreliable User Dataset
- **Files**: `unreliable-user-messages.json`, `unreliable-user-whatsapp.txt`
- **Message Count**: 104+ messages
- **Time Span**: ~8 months (February 2024 - October 2024)
- **Behavioral Patterns**:
  - Late or missed rent payments
  - Broken promises and commitments
  - Financial irresponsibility and poor planning
  - Maxed out credit cards and defaults
  - Anxiety and stress around money management
  - Declining credit score and financial situation
  - Eviction and homelessness due to poor decisions

## File Formats

### JSON Format (`*-messages.json`)
```json
[
  {
    "timestamp": "2024-02-15T09:15:00Z",
    "sender": "Alex",
    "content": "Message content here...",
    "messageType": "text",
    "platform": "imessage"
  }
]
```

### WhatsApp Format (`*-whatsapp.txt`)
```
2/15/24, 9:15 AM - Alex: Message content here...
2/15/24, 9:17 AM - Sarah: Response message here...
```

## Expected AI Analysis Results

### Reliable User (Alex)
- **High Conscientiousness**: Organized, responsible, follows through on commitments
- **Low Neuroticism**: Calm, stable, handles stress well
- **High Agreeableness**: Cooperative, trustworthy, considerate of others
- **Expected Trust Score**: 75-85 (well above 70 threshold)

### Unreliable User (Jordan)
- **Low Conscientiousness**: Disorganized, unreliable, breaks commitments
- **High Neuroticism**: Anxious, stressed, emotionally unstable
- **Variable Agreeableness**: Wants to help but often disappoints
- **Expected Trust Score**: 25-40 (well below 70 threshold)

## Usage in Testing

These datasets are used by:
1. **Message Processing Service**: Validates file format detection and parsing
2. **AI Trustworthiness Service**: Tests personality trait extraction and scoring
3. **Integration Tests**: End-to-end validation of the complete analysis pipeline
4. **Bias Detection**: Ensures fair scoring across different communication styles

## Requirements Satisfied

This implementation satisfies the following requirements from the spec:
- **Requirement 2.1**: AI analysis of message history for personality traits
- **Requirement 2.4**: Trustworthiness scoring based on behavioral patterns
- **Requirement 2.10**: Validation of AI analysis accuracy and consistency

## Test Validation

Run the test suite to validate the datasets:
```bash
npm test -- message-datasets.test.ts --run
```

The tests verify:
- Proper JSON/WhatsApp format structure
- Message count requirements (100+ messages)
- Time span requirements (6+ months)
- Contrasting behavioral patterns between reliable and unreliable users
- Integration with message processing service
- Format detection accuracy