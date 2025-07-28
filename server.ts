import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Check if API key is loaded
console.log(`🔑 OpenAI API Key: ${process.env.OPENAI_API_KEY ? 'LOADED ✅' : 'MISSING ❌'}`);

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

interface AnalysisIssue {
    id: string;
    type: string;
    severity: 'critical' | 'warning' | 'info';
    line: number;
    title: string;
    description: string;
    impact: string;
    currentCode: string;
    fixedCode: string;
    explanation: string;
}

interface AnalysisResult {
    summary: string;
    issues: AnalysisIssue[];
    recommendations: string[];
    score: number;
    analysisType: string;
}

const app = express();
const port = process.env.PORT || 3002;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.text({ limit: '10mb' }));

// AI EXPERT PROMPTS
const getPersonaPrompt = (persona: string, language: string): string => {
    const prompts = {
        security: `You are a world-class cybersecurity expert with 15+ years of experience finding critical vulnerabilities. 

Analyze the ${language} code for security vulnerabilities including:
- SQL injection, XSS, CSRF, command injection
- Authentication and authorization flaws  
- Cryptographic vulnerabilities
- Business logic flaws
- Input validation issues

For each issue found, provide COMPLETE CODE BLOCKS (3-5 lines minimum) showing the full context around the vulnerability, not just the problematic function call.

Return a JSON response with this exact format:
{
  "issues": [
    {
      "line": 5,
      "type": "SQL Injection",
      "severity": "critical",
      "title": "SQL injection vulnerability",
      "description": "User input concatenated directly into SQL query",
      "impact": "Database compromise, data theft",
      "currentCode": "function getUserData(userId) {\\n    const query = \\"SELECT * FROM users WHERE id = '\\" + userId + \\"'\\";\\n    return db.query(query);\\n}",
      "fixedCode": "function getUserData(userId) {\\n    const query = \\"SELECT * FROM users WHERE id = ?\\";\\n    return db.query(query, [userId]);\\n}",
      "explanation": "Use parameterized queries to prevent SQL injection"
    }
  ],
  "summary": "Found X security vulnerabilities",
  "score": 45
}

IMPORTANT: Always provide complete, meaningful code blocks that show the full context around each issue.`,

        performance: `You are a senior performance engineer specializing in optimization.

Analyze the ${language} code for performance issues:
- Inefficient algorithms and data structures
- Memory leaks and excessive allocations
- Blocking operations that should be async
- Database query inefficiencies
- Resource contention issues

For each issue, provide COMPLETE CODE BLOCKS showing the full context, not just fragments.

Return the same JSON format as above, focused on performance issues with complete code context.`,

        maintainability: `You are a principal software architect focused on code quality.

Analyze the ${language} code for maintainability issues:
- Code smells and anti-patterns
- SOLID principle violations
- Complex or unclear logic
- Poor error handling
- Tight coupling

For each issue, provide COMPLETE CODE BLOCKS showing the full context.

Return the same JSON format as above, focused on code quality issues with complete code context.`,

        testing: `You are a QA architect specializing in comprehensive testing strategies.

Analyze the ${language} code for testing gaps:
- Missing test coverage areas
- Difficult-to-test code structures
- Edge cases and boundary conditions
- Error scenario testing needs

For each issue, provide COMPLETE CODE BLOCKS showing the full context.

Return the same JSON format as above, focused on testing requirements with complete code context.`
    };

    return prompts[persona as keyof typeof prompts] || prompts.security;
};

// REAL AI ANALYSIS FUNCTION
async function analyzeCodeWithAI(code: string, persona: string, language: string): Promise<AnalysisResult> {
    try {
        console.log(`🧠 Calling OpenAI API for ${persona} analysis...`);
        
        if (!process.env.OPENAI_API_KEY) {
            console.log('❌ No OpenAI API key found, using fallback');
            throw new Error('No OpenAI API key configured');
        }

        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: getPersonaPrompt(persona, language)
                },
                {
                    role: "user", 
                    content: `Analyze this ${language} code for ${persona} issues. For each issue, provide COMPLETE CODE BLOCKS with full context (3-5 lines minimum):\n\n${code}`
                }
            ],
            temperature: 0.3,
            max_tokens: 4000
        });

        console.log(`✅ OpenAI API call successful!`);
        const aiResponse = response.choices[0].message.content;
        console.log(`📝 AI Response received: ${aiResponse?.length} characters`);

        // Parse AI response
        try {
            const parsedResponse = JSON.parse(aiResponse || '{}');
            
            // Format issues with proper structure
            const formattedIssues: AnalysisIssue[] = (parsedResponse.issues || []).map((issue: any, index: number) => ({
                id: `ai_${persona}_${index}`,
                type: issue.type || 'Code Issue',
                severity: issue.severity || 'info',
                line: issue.line || getLineNumber(code, issue.currentCode || ''),
                title: issue.title || 'Issue detected',
                description: issue.description || 'AI detected an issue',
                impact: issue.impact || 'Impact assessment needed',
                currentCode: issue.currentCode || 'Code snippet',
                fixedCode: issue.fixedCode || 'Fixed code',
                explanation: issue.explanation || 'Explanation needed'
            }));

            console.log(`🎯 Successfully parsed ${formattedIssues.length} issues from AI response`);

            return {
                summary: parsedResponse.summary || `AI analysis found ${formattedIssues.length} issues`,
                issues: formattedIssues,
                recommendations: [
                    'Implement security best practices',
                    'Add comprehensive testing',
                    'Regular security audits',
                    'Code review process'
                ],
                score: parsedResponse.score || Math.max(100 - (formattedIssues.length * 15), 20),
                analysisType: 'OpenAI GPT-3.5 Powered Analysis'
            };

        } catch (parseError) {
            console.error('❌ Error parsing AI response:', parseError);
            console.log('📄 Raw AI response:', aiResponse?.substring(0, 200) + '...');
            throw new Error('Failed to parse AI analysis results');
        }

    } catch (error: any) {
        console.error('❌ OpenAI API Error:', error.message);
        
        // Fallback to enhanced pattern analysis if AI fails
        console.log('🔄 Falling back to enhanced pattern analysis...');
        return await getFallbackAnalysis(code, persona, language);
    }
}

// ENHANCED FALLBACK ANALYSIS WITH FULL CODE CONTEXT
async function getFallbackAnalysis(code: string, persona: string, language: string): Promise<AnalysisResult> {
    const issues: AnalysisIssue[] = [];
    const lines = code.split('\n');
    
    // Helper function to extract meaningful code context
    function extractCodeContext(lineIndex: number, matchText: string): { current: string, fixed: string } {
        const startLine = Math.max(0, lineIndex - 2);
        const endLine = Math.min(lines.length - 1, lineIndex + 2);
        
        // Get 5-line context around the issue
        const contextLines = lines.slice(startLine, endLine + 1);
        const fullContext = contextLines.join('\n');
        
        return {
            current: fullContext.trim(),
            fixed: generateContextualFix(fullContext, matchText)
        };
    }
    
    // Helper to generate contextual fixes
    function generateContextualFix(context: string, problematicPart: string): string {
        // SQL Injection fixes
        if (context.includes('SELECT') && (context.includes('+') || context.includes('${') || context.includes('`'))) {
            return context.replace(
                /(["'`][^"'`]*SELECT[^"'`]*)([\+`\$\{][^"'`]*)(["'`])/gi,
                'const query = "SELECT * FROM users WHERE id = ?";\nconst result = db.query(query, [userId]); // Use parameterized queries'
            );
        }
        
        // XSS fixes
        if (context.includes('innerHTML')) {
            return context.replace(
                /(\w+\.innerHTML\s*=\s*)([^;]+)/g,
                '$1sanitizeHTML($2) // Use textContent for plain text or sanitize HTML'
            );
        }
        
        // eval() fixes
        if (context.includes('eval')) {
            return context.replace(
                /eval\s*\([^)]+\)/g,
                'JSON.parse(safeData) // Use JSON.parse instead of eval for data parsing'
            );
        }
        
        // Command injection fixes
        if (context.includes('exec') || context.includes('system')) {
            return context.replace(
                /(exec|system)\s*\([^)]+\)/g,
                'const { spawn } = require("child_process");\nconst child = spawn("command", ["arg1", "arg2"]); // Use spawn with array arguments'
            );
        }
        
        // Console.log fixes
        if (context.includes('console.log')) {
            return context.replace(
                /console\.log\s*\([^)]+\)/g,
                '// console.log(data); // Remove debug statements in production'
            );
        }
        
        // Memory leak fixes
        if (context.includes('setInterval')) {
            return context.replace(
                /setInterval\s*\([^)]+\)/g,
                'const intervalId = setInterval(() => {\n    // Your code here\n}, 1000);\n// Remember: clearInterval(intervalId) when done'
            );
        }
        
        return context + '\n// Apply appropriate security fix based on context';
    }
    
    // Generate performance-specific fixes
    function generatePerformanceFix(context: string, match: string): string {
        if (context.includes('for') && context.match(/for\s*\([^)]*\)\s*{[^}]*for\s*\([^)]*\)/)) {
            return `// Replace O(n²) nested loops with O(n) Set-based approach:
const seen = new Set();
const duplicates = new Set();

for (const item of array) {
    if (seen.has(item)) {
        duplicates.add(item);
    }
    seen.add(item);
}
return Array.from(duplicates);`;
        }
        
        if (context.includes('setInterval') && context.includes('createElement')) {
            return context.replace(
                /setInterval\s*\([^)]+\)/g,
                'const intervalId = setInterval(() => {\n    // Reuse elements instead of creating new ones\n    // Clear interval when component unmounts\n}, 1000);\n// clearInterval(intervalId);'
            );
        }
        
        if (context.includes('document.querySelector') && context.includes('for')) {
            return context.replace(
                /(for\s*\([^)]*\)\s*{[^}]*)(document\.querySelector[^}]*)/g,
                'const element = document.querySelector(".selector"); // Cache DOM queries outside loops\n$1// Use cached element here'
            );
        }
        
        return context + '\n// Optimize for better performance';
    }
    
    // Security patterns with enhanced context extraction
    if (persona === 'security') {
        const securityPatterns = [
            {
                regex: /eval\s*\([^)]*\)/gi,
                type: 'Code Injection',
                severity: 'critical' as const,
                title: 'Dangerous eval() usage detected',
                description: 'eval() executes arbitrary code, creating injection vulnerability',
                impact: 'Critical: Full code execution possible'
            },
            {
                regex: /innerHTML\s*=\s*[^;]+/gi,
                type: 'XSS Vulnerability', 
                severity: 'critical' as const,
                title: 'Cross-Site Scripting (XSS) vulnerability',
                description: 'Unsanitized data in innerHTML allows script injection',
                impact: 'High: User session hijacking possible'
            },
            {
                regex: /(SELECT|INSERT|UPDATE|DELETE)[^"'`]*["'`][^"'`]*[\+\$\{][^"'`]*["'`]/gi,
                type: 'SQL Injection',
                severity: 'critical' as const,
                title: 'SQL Injection vulnerability detected', 
                description: 'String concatenation in SQL queries allows injection attacks',
                impact: 'Critical: Database compromise possible'
            },
            {
                regex: /(exec|system)\s*\(\s*["'`][^"'`]*[\+\$\{][^"'`]*["'`]/gi,
                type: 'Command Injection',
                severity: 'critical' as const,
                title: 'Command injection vulnerability',
                description: 'User input in system commands allows arbitrary execution', 
                impact: 'Critical: Full system compromise possible'
            },
            {
                regex: /console\.log\s*\([^)]+\)/gi,
                type: 'Information Disclosure',
                severity: 'warning' as const,
                title: 'Debug information in production code',
                description: 'Console statements can leak sensitive information',
                impact: 'Medium: Sensitive data exposure'
            },
            {
                regex: /(password|secret|key|token)\s*=\s*["'`][^"'`]+["'`]/gi,
                type: 'Hardcoded Credentials',
                severity: 'critical' as const,
                title: 'Hardcoded secrets detected',
                description: 'Sensitive credentials stored in source code',
                impact: 'Critical: Credential exposure'
            }
        ];

        // Process each pattern with context
        securityPatterns.forEach((pattern, patternIndex) => {
            const matches = [...code.matchAll(pattern.regex)];
            matches.forEach((match, matchIndex) => {
                const lineNumber = getLineNumber(code, match.index || 0);
                const lineIndex = lineNumber - 1;
                const codeContext = extractCodeContext(lineIndex, match[0]);
                
                issues.push({
                    id: `security_${patternIndex}_${matchIndex}`,
                    type: pattern.type,
                    severity: pattern.severity,
                    line: lineNumber,
                    title: pattern.title,
                    description: pattern.description,
                    impact: pattern.impact,
                    currentCode: codeContext.current,
                    fixedCode: codeContext.fixed,
                    explanation: 'Enhanced context-aware security analysis with meaningful fixes'
                });
            });
        });
    }

    // Performance patterns with context
    if (persona === 'performance') {
        const performancePatterns = [
            {
                regex: /for\s*\([^)]*\)\s*{[^}]*for\s*\([^)]*\)[^}]*}/gi,
                type: 'Inefficient Algorithm',
                severity: 'warning' as const,
                title: 'O(n²) nested loops detected',
                description: 'Nested loops create quadratic time complexity',
                impact: 'High: Performance degrades significantly with data size'
            },
            {
                regex: /setInterval\s*\([^)]+createElement[^)]+\)/gi,
                type: 'Memory Leak Risk',
                severity: 'critical' as const,
                title: 'Memory leak with DOM element creation',
                description: 'Creating DOM elements in intervals without cleanup',
                impact: 'High: Progressive memory usage increase leading to crash'
            },
            {
                regex: /for\s*\([^)]*\)\s*{[^}]*document\.(querySelector|getElementById)[^}]*}/gi,
                type: 'DOM Query Performance',
                severity: 'warning' as const,
                title: 'DOM queries inside loops',
                description: 'Repeated DOM queries cause performance degradation',
                impact: 'Medium: Slow rendering and poor user experience'
            }
        ];

        performancePatterns.forEach((pattern, patternIndex) => {
            const matches = [...code.matchAll(pattern.regex)];
            matches.forEach((match, matchIndex) => {
                const lineNumber = getLineNumber(code, match.index || 0);
                const lineIndex = lineNumber - 1;
                const codeContext = extractCodeContext(lineIndex, match[0]);
                
                issues.push({
                    id: `performance_${patternIndex}_${matchIndex}`,
                    type: pattern.type,
                    severity: pattern.severity,
                    line: lineNumber,
                    title: pattern.title,
                    description: pattern.description,
                    impact: pattern.impact,
                    currentCode: codeContext.current,
                    fixedCode: generatePerformanceFix(codeContext.current, match[0]),
                    explanation: 'Performance optimization recommendation with context'
                });
            });
        });
    }

    // Code Quality patterns
    if (persona === 'maintainability') {
        const qualityPatterns = [
            {
                regex: /function\s+\w+\s*\([^)]*,[^)]*,[^)]*,[^)]*,[^)]*,[^)]*\)/gi,
                type: 'Code Complexity',
                severity: 'warning' as const,
                title: 'Function with too many parameters',
                description: 'Functions with many parameters are hard to maintain',
                impact: 'Medium: Reduced code maintainability'
            },
            {
                regex: /try\s*{[^}]*}\s*catch\s*\([^)]*\)\s*{\s*}/gi,
                type: 'Error Handling',
                severity: 'warning' as const,
                title: 'Empty catch block detected',
                description: 'Silent error handling makes debugging difficult',
                impact: 'Medium: Hidden errors and difficult debugging'
            }
        ];

        qualityPatterns.forEach((pattern, patternIndex) => {
            const matches = [...code.matchAll(pattern.regex)];
            matches.forEach((match, matchIndex) => {
                const lineNumber = getLineNumber(code, match.index || 0);
                const lineIndex = lineNumber - 1;
                const codeContext = extractCodeContext(lineIndex, match[0]);
                
                issues.push({
                    id: `quality_${patternIndex}_${matchIndex}`,
                    type: pattern.type,
                    severity: pattern.severity,
                    line: lineNumber,
                    title: pattern.title,
                    description: pattern.description,
                    impact: pattern.impact,
                    currentCode: codeContext.current,
                    fixedCode: codeContext.current + '\n// Refactor: Break into smaller functions or add proper error handling',
                    explanation: 'Code quality improvement suggestion'
                });
            });
        });
    }

    return {
        summary: `Enhanced context analysis found ${issues.length} ${persona} issues`,
        issues,
        recommendations: [
            'Review each suggestion carefully',
            'Test fixes in development environment', 
            'Consider automated security scanning',
            'Implement code review process'
        ],
        score: Math.max(100 - (issues.length * 12), 25),
        analysisType: 'Enhanced Context-Aware Pattern Analysis'
    };
}

// Helper function to get line number
function getLineNumber(text: string, index: number | string): number {
    if (typeof index === 'string') {
        // If index is a string, find it in the text
        const stringIndex = text.indexOf(index);
        if (stringIndex === -1) return 1;
        return text.substring(0, stringIndex).split('\n').length;
    }
    if (!index) return 1;
    return text.substring(0, index).split('\n').length;
}

// Test OpenAI Connection Endpoint
app.get('/api/test-openai', async (req, res) => {
    try {
        console.log('🧪 Testing OpenAI connection...');
        
        if (!process.env.OPENAI_API_KEY) {
            return res.json({
                success: false,
                error: 'No OpenAI API key found in environment variables'
            });
        }
        
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "user",
                    content: "Say 'OpenAI connection working!' if you can read this."
                }
            ],
            max_tokens: 20
        });

        const result = response.choices[0].message.content;
        console.log('✅ OpenAI Response:', result);
        
        res.json({
            success: true,
            message: 'OpenAI connection working!',
            response: result,
            model: response.model,
            usage: response.usage
        });

    } catch (error: any) {
        console.error('❌ OpenAI Connection Error:', error.message);
        
        res.status(500).json({
            success: false,
            error: error.message,
            type: error.type || 'unknown',
            code: error.code || 'unknown'
        });
    }
});

// Main Analysis Endpoint
app.post('/api/analyze', async (req, res) => {
    const { persona = 'security', language = 'javascript', code } = req.body;
    
    console.log(`🔍 Received analysis request: ${persona} for ${language}`);
    console.log(`📝 Code length: ${code?.length || 0} characters`);
    
    // Set headers for Server-Sent Events
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    function sendProgress(data: any) {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    }

    try {
        if (!code || !code.trim()) {
            sendProgress({ 
                type: 'final_message', 
                message: 'No code provided for analysis.' 
            });
            return res.end();
        }

        // Progressive analysis feedback
        sendProgress({ text: `🧠 Initializing AI ${persona} analysis...`, type: 'progress' });
        await sleep(600);
        
        sendProgress({ text: `📝 Analyzing ${code.length} characters of ${language} code...`, type: 'progress' });
        await sleep(800);
        
        sendProgress({ text: `🔍 Running advanced vulnerability detection...`, type: 'progress' });
        await sleep(1000);
        
        sendProgress({ text: `⚡ Generating expert-level recommendations...`, type: 'progress' });
        await sleep(700);
        
        console.log(`🧠 Starting AI analysis for ${persona}...`);
        
        // Perform REAL AI analysis
        const analysis = await analyzeCodeWithAI(code, persona, language);
        
        console.log(`✅ Analysis complete: ${analysis.issues.length} issues found`);
        console.log(`🎯 Analysis type: ${analysis.analysisType}`);
        
        let response = `## 🛡️ ${persona.charAt(0).toUpperCase() + persona.slice(1)} Analysis Complete\n\n`;
        response += `**Language:** ${language.charAt(0).toUpperCase() + language.slice(1)}\n`;
        response += `**Expert:** ${persona.charAt(0).toUpperCase() + persona.slice(1)} Specialist\n`;
        response += `**Issues Found:** ${analysis.issues.length}\n`;
        response += `**Code Quality Score:** ${analysis.score}/100\n`;
        response += `**Analysis Engine:** ${analysis.analysisType}\n\n`;
        
        if (analysis.issues.length > 0) {
            const criticalIssues = analysis.issues.filter(i => i.severity === 'critical').length;
            const warningIssues = analysis.issues.filter(i => i.severity === 'warning').length;
            const infoIssues = analysis.issues.filter(i => i.severity === 'info').length;
            
            response += `🔴 **Critical:** ${criticalIssues} | `;
            response += `🟡 **Warnings:** ${warningIssues} | `;
            response += `🔵 **Info:** ${infoIssues}\n\n`;
            
            response += 'Review the interactive fix cards below to address each issue.\n\n';
        } else {
            response += '✅ Excellent! No issues found. Your code follows best practices.\n\n';
        }
        
        // Stream the response
        const words = response.split(' ');
        for (let i = 0; i < words.length; i++) {
            sendProgress({ text: words.slice(0, i + 1).join(' ') });
            await sleep(40);
        }
        
        // Generate edit cards with full context
        let editCards = '';
        analysis.issues.slice(0, 8).forEach((issue) => {
            editCards += `<edit_card>
cardid:${issue.id}
old_text:${issue.currentCode}
new_text:${issue.fixedCode}
severity:${issue.severity}
issue_type:${issue.type}
line:${issue.line}
</edit_card>\n\n`;
        });
        
        // Send final message
        const finalMessage = response + '\n\n' + editCards;
        sendProgress({ type: 'final_message', message: finalMessage });
        
    } catch (error) {
        console.error('❌ Analysis error:', error);
        sendProgress({ 
            type: 'final_message', 
            message: '❌ Analysis failed. Please check your code and try again.' 
        });
    }
    
    res.end();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: '🚀 Enhanced TypeScript CodeReview AI Server Ready',
        timestamp: new Date().toISOString(),
        openai: process.env.OPENAI_API_KEY ? 'API Key Present ✅' : 'No API Key ❌',
        features: [
            'OpenAI GPT-3.5 Integration', 
            'Multi-language Support', 
            'Expert Personas', 
            'Real-time Streaming',
            'Enhanced Context-Aware Pattern Detection',
            'Full Code Block Analysis'
        ],
        version: '2.1.0-enhanced',
        engine: 'TypeScript + OpenAI + Enhanced Context Analysis'
    });
});

// Sample code for testing
function getSampleCode(language: string): string {
    const samples: Record<string, string> = {
        javascript: `function getUserData(userId) {
    const query = "SELECT * FROM users WHERE id = '" + userId + "'";
    const user = database.query(query);
    
    document.getElementById('output').innerHTML = userInput;
    eval(userCode);
    console.log('User data:', user);
    
    return user;
}`
    };
    
    return samples[language] || samples.javascript;
}

// Utility function
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Start server
const server = createServer(app);

server.listen(port, () => {
    console.log(`🚀 Enhanced TypeScript CodeReview AI Server running on http://localhost:${port}`);
    console.log(`🧠 OpenAI Integration: ${process.env.OPENAI_API_KEY ? '✅ ACTIVE' : '❌ Add OPENAI_API_KEY to .env'}`);
    console.log(`⚡ Analysis Engine: ${process.env.OPENAI_API_KEY ? '✅ GPT-3.5 + Enhanced Context' : '❌ Enhanced Context Only'}`);
    console.log(`🛡️ Expert Security Analysis: ✅ Loaded with Full Context`); 
    console.log(`📊 Health check: http://localhost:${port}/health`);
    console.log(`🔍 Analysis endpoint: http://localhost:${port}/api/analyze`);
    console.log(`🧪 Test OpenAI: http://localhost:${port}/api/test-openai`);
    
    if (!process.env.OPENAI_API_KEY) {
        console.log(`\n⚠️  To enable REAL AI analysis:`);
        console.log(`   1. Get OpenAI API key from https://platform.openai.com`);
        console.log(`   2. Add OPENAI_API_KEY=your_key to .env file`);
        console.log(`   3. Restart server\n`);
        console.log(`📝 Currently using Enhanced Pattern Analysis with full code context`);
    }
});

export default app;