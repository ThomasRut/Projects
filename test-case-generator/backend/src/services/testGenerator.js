const Anthropic = require('@anthropic-ai/sdk');

class TestGenerator {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }

  async generateTests(codeContext, requirements) {
    const { targetCode, relatedCode, testType, framework, language } = requirements;

    const prompt = this.buildPrompt(codeContext, targetCode, testType, framework, language);

    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      return {
        tests: message.content[0].text,
        usage: message.usage
      };
    } catch (error) {
      console.error('Error generating tests:', error);
      throw error;
    }
  }

  buildPrompt(codeContext, targetCode, testType, framework, language) {
    const contextSection = codeContext.map((ctx, idx) => 
      `### Related Code ${idx + 1} (${ctx.metadata.fileName})\n\`\`\`${language}\n${ctx.code}\n\`\`\``
    ).join('\n\n');

    return `You are an expert QA engineer writing ${testType} tests using ${framework} for ${language} code.

## Target Code to Test
\`\`\`${language}
${targetCode}
\`\`\`

## Related Code Context
${contextSection}

## Your Task
Generate comprehensive ${testType} tests for the target code above. Include:
1. Test cases for normal/happy path scenarios
2. Edge cases and boundary conditions
3. Error handling and negative test cases
4. Mock any external dependencies appropriately

Use ${framework} syntax and best practices for ${language}.
Provide ONLY the test code, properly formatted and ready to use.`;
  }
}

module.exports = new TestGenerator();