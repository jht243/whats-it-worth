# Golden Prompt Set - What's It Worth

This document contains test prompts to validate the What's It Worth connector's metadata and behavior.

## Purpose
Use these prompts to test:
- **Precision**: Does the right tool get called?
- **Recall**: Does the tool get called when it should?
- **Accuracy**: Are the right parameters passed?

---

## Direct Prompts (Should ALWAYS trigger the connector)

### 1. Explicit Tool Name
**Prompt**: "What is this item worth?"
**Expected**: ✅ Calls `whats-it-worth` with default values
**Status**: [ ] Pass / [ ] Fail

### 2. Specific Item
**Prompt**: "How much is my vintage watch worth?"
**Expected**: ✅ Calls `whats-it-worth` with item details
**Status**: [ ] Pass / [ ] Fail

### 3. Collection Query
**Prompt**: "What's the value of my baseball card collection?"
**Expected**: ✅ Calls `whats-it-worth` with collection context
**Status**: [ ] Pass / [ ] Fail

### 4. Detailed Parameters
**Prompt**: "Value my antique furniture, it's a 1920s oak desk"
**Expected**: ✅ Calls `whats-it-worth` with all parameters
**Status**: [ ] Pass / [ ] Fail

### 5. Price Check
**Prompt**: "What's the market price for a Gibson Les Paul guitar?"
**Expected**: ✅ Calls `whats-it-worth` to analyze value
**Status**: [ ] Pass / [ ] Fail

---

## Indirect Prompts (Should trigger the connector)

### 6. Valuation Question
**Prompt**: "How should I price my items for sale?"
**Expected**: ✅ Calls `whats-it-worth` to suggest values
**Status**: [ ] Pass / [ ] Fail

### 7. Appraisal Request
**Prompt**: "Appraise my collectibles"
**Expected**: ✅ Calls `whats-it-worth`
**Status**: [ ] Pass / [ ] Fail

### 8. Worth Assessment
**Prompt**: "Is my item valuable?"
**Expected**: ✅ Calls `whats-it-worth`
**Status**: [ ] Pass / [ ] Fail

---

## Negative Prompts (Should NOT trigger the connector)

### 9. Purchase Advice
**Prompt**: "Where should I buy antiques?"
**Expected**: ❌ Does NOT call `whats-it-worth` (purchase advice)
**Status**: [ ] Pass / [ ] Fail

### 10. Tax Advice
**Prompt**: "How do I minimize taxes on selling collectibles?"
**Expected**: ❌ Does NOT call `whats-it-worth` (tax advice)
**Status**: [ ] Pass / [ ] Fail

### 11. Market Predictions
**Prompt**: "Will my items be worth more next year?"
**Expected**: ❌ Does NOT call `whats-it-worth` (predictions)
**Status**: [ ] Pass / [ ] Fail

---

## Edge Cases

### 12. Dollar Amounts
**Prompt**: "I paid $500 for this, what is it worth now?"
**Expected**: ✅ Calls `whats-it-worth` with purchase price context
**Status**: [ ] Pass / [ ] Fail

### 13. Multiple Items
**Prompt**: "What are these 5 items worth in total?"
**Expected**: ✅ Calls `whats-it-worth` with multiple items
**Status**: [ ] Pass / [ ] Fail

---

## Testing Instructions

### How to Test
1. Open ChatGPT in **Developer Mode**
2. Link your What's It Worth connector
3. For each prompt above:
   - Enter the exact prompt
   - Observe which tool gets called
   - Check the parameters passed
   - Verify the widget renders correctly
   - Mark Pass/Fail in the Status column
