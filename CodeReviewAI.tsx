import React, { useState, useRef, useEffect, useCallback } from 'react';
import { IoClose, IoMoon, IoSunny, IoCopy, IoDownload, IoPlay, IoRefresh } from "react-icons/io5";
import { FiThumbsUp, FiThumbsDown, FiUsers, FiSettings, FiUpload, FiCode, FiShield, FiZap, FiCheckCircle, FiCheck, FiEdit3, FiSave, FiEye } from 'react-icons/fi';

interface StreamData {
    status?: string;
    token?: string;
    text?: string;
    type?: string;
    assistantMessageId?: string;
    conversationID?: string;
    message?: string;
    userMessageid?: string;
}

interface Message {
    id: number;
    text: string;
    sender: 'user' | 'assistant' | 'system';
    timestamp: Date;
    reaction?: 'like' | 'dislike';
    persona?: CodeReviewPersona;
    language?: string;
    isCode?: boolean;
}

interface EditCard {
    cardId: string;
    oldText: string;
    newText: string;
    severity?: 'critical' | 'warning' | 'info';
    issueType?: string;
    lineNumber?: number;
}

type CodeReviewPersona = 'security' | 'performance' | 'maintainability' | 'testing';

const FullPageCodeReviewAI: React.FC = () => {
    // Core state - KEEPING ALL ORIGINAL FUNCTIONALITY
    const [isStreaming, setIsStreaming] = useState<boolean>(false);
    const [currentText, setCurrentText] = useState<string>('');
    const [editCards, setEditCards] = useState<EditCard[]>([]);
    const [originalCode, setOriginalCode] = useState<string>('');
    const [editedCode, setEditedCode] = useState<string>('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isTyping, setIsTyping] = useState<boolean>(false);
    
    // App state
    const [darkMode, setDarkMode] = useState<boolean>(false);
    const [currentPersona, setCurrentPersona] = useState<CodeReviewPersona>('security');
    const [selectedLanguage, setSelectedLanguage] = useState<string>('javascript');
    const [shouldAutoScroll, setShouldAutoScroll] = useState<boolean>(false);
    const [codeChanged, setCodeChanged] = useState<boolean>(false);
    const [isPersonaDropdownOpen, setIsPersonaDropdownOpen] = useState<boolean>(false);
    
    // FIXED: Navigation and formatting state with scroll tracking
    const [highlightedLines, setHighlightedLines] = useState<number[]>([]);
    const [isFormatting, setIsFormatting] = useState<boolean>(false);
    const [scrollTop, setScrollTop] = useState<number>(0);
    
    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const codeTextareaRef = useRef<HTMLTextAreaElement>(null);
    const lineNumbersRef = useRef<HTMLDivElement>(null);

    // Professional personas configuration - KEEPING ALL ORIGINAL
    const personas: Record<CodeReviewPersona, {
        name: string;
        color: string;
        icon: React.ComponentType<{ className?: string }>;
        description: string;
        focus: string;
    }> = {
        security: { 
            name: "Security Expert", 
            color: "bg-red-600", 
            icon: FiShield,
            description: "Vulnerability & security review",
            focus: "SQL injection, XSS, authentication flaws"
        },
        performance: { 
            name: "Performance Expert", 
            color: "bg-orange-600", 
            icon: FiZap,
            description: "Speed & efficiency optimization",
            focus: "Memory leaks, slow queries, inefficient algorithms"
        },
        maintainability: { 
            name: "Code Quality", 
            color: "bg-blue-600", 
            icon: FiCode,
            description: "Clean code & best practices",
            focus: "Structure, readability, design patterns"
        },
        testing: { 
            name: "Test Engineer", 
            color: "bg-green-600", 
            icon: FiCheck,
            description: "Test coverage & quality assurance",
            focus: "Unit tests, edge cases, mocking strategies"
        }
    };

    // Programming languages
    const languages = [
        { value: 'javascript', label: 'JavaScript' },
        { value: 'typescript', label: 'TypeScript' },
        { value: 'python', label: 'Python' },
        { value: 'java', label: 'Java' },
        { value: 'go', label: 'Go' },
        { value: 'rust', label: 'Rust' }
    ];

    // FIXED: Get all line numbers based on actual code content
    const getLineNumbers = useCallback(() => {
        if (!editedCode) return [1];
        return editedCode.split('\n').map((_, index) => index + 1);
    }, [editedCode]);

    // FIXED: Handle scroll synchronization between textarea and line numbers
    const handleScroll = useCallback((event: React.UIEvent<HTMLTextAreaElement>) => {
        const scrollTop = event.currentTarget.scrollTop;
        setScrollTop(scrollTop);
        
        // Sync line numbers scroll
        if (lineNumbersRef.current) {
            lineNumbersRef.current.scrollTop = scrollTop;
        }
    }, []);

    // NEW: Code formatting function
    const formatCode = useCallback((code: string, language: string): string => {
        setIsFormatting(true);
        
        try {
            // Basic formatting rules for different languages
            let formatted = code;
            
            if (language === 'javascript' || language === 'typescript') {
                // Basic JS/TS formatting
                formatted = formatted
                    // Fix indentation
                    .replace(/^(\s*)/gm, (match, spaces) => {
                        const level = (spaces.match(/\t/g) || []).length + Math.floor((spaces.match(/ /g) || []).length / 4);
                        return '    '.repeat(level);
                    })
                    // Add spaces around operators
                    .replace(/([=+\-*/<>!&|])/g, ' $1 ')
                    .replace(/\s+([=+\-*/<>!&|])\s+/g, ' $1 ')
                    // Fix bracket spacing
                    .replace(/\{\s*/g, '{\n    ')
                    .replace(/\s*\}/g, '\n}')
                    // Fix semicolons
                    .replace(/;?\s*$/gm, ';')
                    .replace(/;\s*$/gm, ';');
            } else if (language === 'python') {
                // Basic Python formatting
                formatted = formatted
                    .replace(/^(\s*)/gm, (match, spaces) => {
                        const level = Math.floor((spaces.match(/ /g) || []).length / 4);
                        return '    '.repeat(level);
                    })
                    .replace(/:\s*/g, ':\n    ');
            }
            
            // Clean up excessive whitespace
            formatted = formatted
                .replace(/\n\s*\n\s*\n/g, '\n\n') // Max 2 consecutive newlines
                .replace(/\s+$/gm, '') // Remove trailing spaces
                .trim();
            
            return formatted;
        } catch (error) {
            console.error('Formatting error:', error);
            return code; // Return original code if formatting fails
        } finally {
            setTimeout(() => setIsFormatting(false), 500);
        }
    }, []);

    // FIXED: Navigate to line in code editor with proper scrolling
    const navigateToLine = useCallback((lineNumber: number) => {
        if (!codeTextareaRef.current || !lineNumber) return;
        
        const textarea = codeTextareaRef.current;
        const lines = editedCode.split('\n');
        const targetLineIndex = Math.max(0, Math.min(lineNumber - 1, lines.length - 1));
        
        // Calculate character position of target line
        let charPosition = 0;
        for (let i = 0; i < targetLineIndex; i++) {
            charPosition += lines[i].length + 1; // +1 for newline
        }
        
        // Calculate scroll position to center the target line
        const lineHeight = 24; // Match the CSS line-height
        const textareaHeight = textarea.clientHeight;
        const targetScrollTop = Math.max(0, (targetLineIndex * lineHeight) - (textareaHeight / 2));
        
        // Scroll to line and highlight
        textarea.focus();
        textarea.setSelectionRange(charPosition, charPosition + lines[targetLineIndex].length);
        textarea.scrollTop = targetScrollTop;
        
        // Also sync the line numbers scroll
        if (lineNumbersRef.current) {
            lineNumbersRef.current.scrollTop = targetScrollTop;
        }
        
        // Update scroll state
        setScrollTop(targetScrollTop);
        
        // Highlight the line visually
        setHighlightedLines([lineNumber]);
        
        // Remove highlight after 3 seconds
        setTimeout(() => {
            setHighlightedLines([]);
        }, 3000);
        
        // Show success message
        const statusMessage: Message = {
            id: Date.now(),
            text: `📍 Navigated to line ${lineNumber}`,
            sender: 'system',
            timestamp: new Date()
        };
        setMessages(prev => [...prev, statusMessage]);
        
    }, [editedCode]);

    // Simple sound feedback - KEEPING ORIGINAL
    const playSound = useCallback((type: 'message' | 'success' | 'error' | 'notification') => {
        console.log(`Sound: ${type}`);
    }, []);

    // Copy to clipboard - KEEPING ORIGINAL
    const copyToClipboard = useCallback(async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            playSound('success');
        } catch (err) {
            playSound('error');
            console.error('Failed to copy:', err);
        }
    }, [playSound]);

    // ENHANCED: File upload handler with auto-formatting
    const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            const extension = file.name.split('.').pop()?.toLowerCase();
            
            // Auto-detect language from file extension
            const langMap: Record<string, string> = {
                'js': 'javascript', 'ts': 'typescript', 'py': 'python',
                'java': 'java', 'go': 'go', 'rs': 'rust'
            };
            
            let detectedLanguage = selectedLanguage;
            if (extension && langMap[extension]) {
                detectedLanguage = langMap[extension];
                setSelectedLanguage(detectedLanguage);
            }
            
            // Format the uploaded code
            const formattedContent = formatCode(content, detectedLanguage);
            
            setOriginalCode(formattedContent);
            setEditedCode(formattedContent);
            setCodeChanged(false);
            
            // Show formatting message
            const statusMessage: Message = {
                id: Date.now(),
                text: `✨ File uploaded and formatted: ${file.name} (${formattedContent.split('\n').length} lines)`,
                sender: 'system',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, statusMessage]);
        };
        reader.readAsText(file);
    }, [selectedLanguage, formatCode]);

    // NEW: Handle code paste with auto-formatting
    const handleCodePaste = useCallback((event: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const pastedText = event.clipboardData.getData('text');
        if (pastedText && pastedText.length > 100) { // Only format substantial code blocks
            event.preventDefault();
            const formattedCode = formatCode(pastedText, selectedLanguage);
            
            const textarea = event.currentTarget;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const currentCode = textarea.value;
            
            const newCode = currentCode.substring(0, start) + formattedCode + currentCode.substring(end);
            setEditedCode(newCode);
            setCodeChanged(newCode !== originalCode);
            
            // Show formatting message
            const statusMessage: Message = {
                id: Date.now(),
                text: `✨ Code pasted and auto-formatted (${formattedCode.split('\n').length} lines)`,
                sender: 'system',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, statusMessage]);
        }
    }, [selectedLanguage, formatCode, originalCode]);

    // Auto-scroll functionality - KEEPING ORIGINAL
    const scrollToBottom = (): void => {
        if (shouldAutoScroll) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, currentText, editCards, shouldAutoScroll]);

    // FIXED: Core parsing logic for code analysis results
    const parseEditCards = (text: string): { cleanText: string; cards: EditCard[] } => {
        console.log('🔍 Parsing text for edit cards:', text.substring(0, 200) + '...');
        
        const cardRegex = /<edit_card>\s*cardid:\s*([^\n]+)\s*old_text:\s*([^\n]+(?:\n[^\n]*)*?)\s*new_text:\s*([^\n]+(?:\n[^\n]*)*?)\s*severity:\s*([^\n]*)\s*issue_type:\s*([^\n]*)\s*line:\s*([^\n]*)\s*<\/edit_card>/gi;
        const cardsMap = new Map<string, EditCard>();
        let match;
        
        console.log('🎯 Starting regex matching...');
    
        while ((match = cardRegex.exec(text)) !== null) {
            const cardId = match[1].trim();
            console.log('✅ Found edit card:', cardId);
            
            cardsMap.set(cardId, {
                cardId: cardId,
                oldText: match[2].trim(),
                newText: match[3].trim(),
                severity: (match[4]?.trim() || 'info') as 'critical' | 'warning' | 'info',
                issueType: match[5]?.trim() || 'Code Issue',
                lineNumber: parseInt(match[6]?.trim()) || 0
            });
        }
    
        const cards = Array.from(cardsMap.values());
        console.log(`🎉 Successfully parsed ${cards.length} edit cards`);
        
        let cleanText = text.replace(cardRegex, '').replace(/^\[\]/, '');
        cleanText = cleanText.replace(/\[\][\s\S]*$/s, '');
        cleanText = cleanText.replace(/\d+\.\s*\*\*[^:]+:\*\*[^.]*\./g, '');
        cleanText = cleanText.replace(/^[-•]\s*/gm, '');
        cleanText = cleanText.replace(/\n\s*\n/g, '\n').trim();
        
        return { cleanText, cards };
    };

    // Connect to REAL AI analysis server - KEEPING ORIGINAL
    const startStream = async () => {
        setIsStreaming(true);
        setIsTyping(true);
        setEditCards([]);
        setShouldAutoScroll(true);

        try {
            console.log('🚀 Starting AI analysis with POST request...');
            
            const response = await fetch('http://localhost:3002/api/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream',
                },
                body: JSON.stringify({
                    code: editedCode,
                    persona: currentPersona,
                    language: selectedLanguage
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            console.log('✅ Connected to AI server, processing stream...');

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6));
                                
                                if (data.type === 'final_message') {
                                    const finalText = data.message || data.text || '';
                                    const { cards } = parseEditCards(finalText);
                                    setEditCards(cards);
                                    setIsStreaming(false);
                                    
                                    if (currentText) {
                                        const newMessage: Message = {
                                            id: messages.length + 1,
                                            text: currentText,
                                            sender: 'assistant',
                                            timestamp: new Date(),
                                            persona: currentPersona
                                        };
                                        setMessages(prev => [...prev, newMessage]);
                                    }
                                    setCurrentText('');
                                    setIsTyping(false);
                                    playSound('message');
                                    return;
                                    
                                } else if (data.text) {
                                    let displayText = data.text
                                        .replace(/^\[\]/, '')
                                        .replace(/<edit_card>[\s\S]*?(?:<\/edit_card>|$)/g, '')
                                        .replace(/\[\][\s\S]*$/s, '')
                                        .replace(/I've (analyzed|reviewed)[\s\S]*$/si, '')
                                        .replace(/\d+\.\s*\*\*[^:]+:\*\*[\s\S]*$/g, '')
                                        .replace(/These (issues|improvements)[\s\S]*$/si, '')
                                        .replace(/^[-•]\s*/gm, '')
                                        .replace(/\n\s*\n/g, '\n')
                                        .trim();
                                    
                                    setCurrentText(displayText);
                                }
                            } catch (error) {
                                console.error('Error parsing stream data:', error);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('❌ AI Analysis stream error:', error);
            console.log('🔄 Falling back to demo mode...');
            
            // DEMO MODE - Show example analysis when server is not running
            setCurrentText("Analyzing your code for security vulnerabilities...");
            
            setTimeout(() => {
                setCurrentText("Found several opportunities to optimize this code for better performance and readability.");
                
                // Generate demo suggestions based on the actual code content
                const demoCards: EditCard[] = [];
                const codeLines = editedCode.split('\n');
                
                // More accurate line number detection
                const findLineNumber = (searchText: string): number => {
                    for (let i = 0; i < codeLines.length; i++) {
                        if (codeLines[i].includes(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))) {
                            return i + 1; // Convert to 1-based line numbers
                        }
                    }
                    return 1;
                };
                
                // Check for SQL injection patterns
                if (editedCode.includes('SELECT') && (editedCode.includes(' + ') || editedCode.includes('${') || editedCode.includes('`'))) {
                    const lineNum = findLineNumber('SELECT');
                    demoCards.push({
                        cardId: "sql_injection_001",
                        oldText: `const query = "SELECT * FROM users WHERE id = '" + userId + "'";`,
                        newText: `const query = "SELECT * FROM users WHERE id = ?";
const result = db.query(query, [userId]);`,
                        severity: "critical",
                        issueType: "SQL Injection Vulnerability",
                        lineNumber: lineNum
                    });
                }
                
                // Check for eval usage
                if (editedCode.includes('eval(')) {
                    const lineNum = findLineNumber('eval(');
                    demoCards.push({
                        cardId: "code_injection_001",
                        oldText: `eval("console.log('Admin logged in: " + username + "')");`,
                        newText: `console.log(\`Admin logged in: \${sanitize(username)}\`); // Safe template literal`,
                        severity: "critical",
                        issueType: "Code Injection",
                        lineNumber: lineNum
                    });
                }
                
                // Check for innerHTML usage
                if (editedCode.includes('innerHTML')) {
                    const lineNum = findLineNumber('innerHTML');
                    demoCards.push({
                        cardId: "xss_vulnerability_001",
                        oldText: `document.getElementById("welcome").innerHTML = "Welcome " + username;`,
                        newText: `document.getElementById("welcome").textContent = \`Welcome \${sanitize(username)}\`;`,
                        severity: "critical",
                        issueType: "XSS Vulnerability",
                        lineNumber: lineNum
                    });
                }
                
                // Check for console.log
                if (editedCode.includes('console.log')) {
                    const lineNum = findLineNumber('console.log');
                    demoCards.push({
                        cardId: "info_disclosure_001",
                        oldText: `console.log("Blocking operation: " + i);`,
                        newText: `// console.log("Blocking operation: " + i); // Remove in production`,
                        severity: "warning",
                        issueType: "Information Disclosure",
                        lineNumber: lineNum
                    });
                }
                
                // Check for hardcoded credentials
                if (editedCode.includes('password') && (editedCode.includes('=') || editedCode.includes(':'))) {
                    const lineNum = findLineNumber('password');
                    demoCards.push({
                        cardId: "hardcoded_creds_001",
                        oldText: `var admin_password = "admin123";`,
                        newText: `const admin_password = process.env.ADMIN_PASSWORD; // Use environment variables`,
                        severity: "critical",
                        issueType: "Hardcoded Credentials",
                        lineNumber: lineNum
                    });
                }
                
                setEditCards(demoCards);
                setIsStreaming(false);
                setIsTyping(false);
                
                const newMessage: Message = {
                    id: messages.length + 1,
                    text: `Analysis complete! Found ${demoCards.length} ${demoCards.length === 1 ? 'issue' : 'issues'} in your ${selectedLanguage} code.`,
                    sender: 'assistant',
                    timestamp: new Date(),
                    persona: currentPersona
                };
                setMessages(prev => [...prev, newMessage]);
                setCurrentText('');
                playSound('message');
                
            }, 2000);
        }
    };

    // Analyze code - KEEPING ORIGINAL
    const handleAnalyzeCode = (): void => {
        if (editedCode.trim() && !isStreaming) {
            const newMessage: Message = {
                id: Date.now(),
                text: `Analyzing ${editedCode.length} characters of ${selectedLanguage} code...`,
                sender: 'user',
                timestamp: new Date(),
                persona: currentPersona,
                language: selectedLanguage,
                isCode: false
            };
            
            setMessages(prev => [...prev, newMessage]);
            setEditCards([]);
            setIsTyping(true);
            setShouldAutoScroll(true);
            playSound('message');
            
            setTimeout(() => {
                startStream();
            }, 800);
        }
    };

    // ENHANCED: Apply fix with navigation
    const handleApplyChanges = (accepted: boolean, cardId: string): void => {
        const card = editCards.find(c => c.cardId === cardId);
        if (card && accepted) {
            // Actually modify the code!
            const updatedCode = editedCode.replace(card.oldText, card.newText);
            setEditedCode(updatedCode);
            setCodeChanged(true);
            playSound('success');
            
            // Navigate to the fixed line
            if (card.lineNumber) {
                navigateToLine(card.lineNumber);
            }
            
            // Show success message
            const statusMessage: Message = {
                id: Date.now(),
                text: `✅ Applied fix: ${card.issueType} - Code updated successfully!`,
                sender: 'system',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, statusMessage]);
        } else if (!accepted) {
            playSound('error');
            const statusMessage: Message = {
                id: Date.now() + 1,
                text: `❌ Rejected fix: ${card?.issueType}`,
                sender: 'system',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, statusMessage]);
        }
        
        // Remove the card
        setEditCards(prev => prev.filter(c => c.cardId !== cardId));
    };

    // NEW: Format code manually
    const handleFormatCode = (): void => {
        if (editedCode.trim()) {
            const formattedCode = formatCode(editedCode, selectedLanguage);
            setEditedCode(formattedCode);
            setCodeChanged(formattedCode !== originalCode);
            
            const statusMessage: Message = {
                id: Date.now(),
                text: `✨ Code formatted for ${selectedLanguage}`,
                sender: 'system',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, statusMessage]);
        }
    };

    // Reset code to original - KEEPING ORIGINAL
    const handleResetCode = (): void => {
        setEditedCode(originalCode);
        setCodeChanged(false);
        setEditCards([]);
        setHighlightedLines([]);
        playSound('notification');
    };

    // Save code changes - KEEPING ORIGINAL
    const handleSaveCode = (): void => {
        setOriginalCode(editedCode);
        setCodeChanged(false);
        playSound('success');
        
        // Create downloadable file
        const blob = new Blob([editedCode], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `fixed-code.${selectedLanguage === 'javascript' ? 'js' : selectedLanguage}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // Message reactions - KEEPING ORIGINAL
    const handleReaction = (messageId: number, reaction: 'like' | 'dislike') => {
        setMessages(prev => prev.map(msg => 
            msg.id === messageId 
                ? { ...msg, reaction: msg.reaction === reaction ? undefined : reaction }
                : msg
        ));
        playSound('notification');
    };

    return (
        <div className="h-screen flex flex-col" style={{ backgroundColor: darkMode ? '#1F2937' : '#DDFBFD' }}>
            
            {/* Clean Header with Your Custom Logo */}
            <div className="bg-gray-800 text-white px-6 py-4 shadow-lg">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-gray-600 rounded-full"></div>
                            <div className="w-3 h-3 bg-gray-600 rounded-full"></div>
                        </div>
                        <div className="flex items-center space-x-4">
                            {/* Your Actual Logo - Light/Dark Versions */}
                            <div className="flex items-center space-x-3">
                                <div className="relative w-10 h-10">
                                    {/* Dark Theme Logo (for dark header) */}
                                    <div className={`absolute inset-0 transition-opacity duration-300 ${!darkMode ? 'opacity-100' : 'opacity-0'}`}>
                                        <svg width="40" height="40" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            {/* Hexagonal frame - dark version */}
                                            <path d="M50 25L150 25L175 75L175 125L150 175L50 175L25 125L25 75L50 25Z" 
                                                  stroke="#1E3A47" strokeWidth="8" fill="none"/>
                                            
                                            {/* Left side - Code bracket */}
                                            <path d="M75 60L45 100L75 140" 
                                                  stroke="#4ECDC4" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                                            
                                            {/* Right side - Brain/AI */}
                                            <path d="M110 60C115 55 125 55 130 60C135 55 145 55 150 60C155 65 155 75 150 80C155 85 155 95 150 100C145 105 135 105 130 100C125 105 115 105 110 100C105 95 105 85 110 80C105 75 105 65 110 60Z" 
                                                  stroke="#4ECDC4" strokeWidth="4" fill="none"/>
                                            
                                            {/* Neural nodes */}
                                            <circle cx="120" cy="70" r="3" fill="#4ECDC4"/>
                                            <circle cx="135" cy="75" r="3" fill="#4ECDC4"/>
                                            <circle cx="125" cy="85" r="3" fill="#4ECDC4"/>
                                            <circle cx="140" cy="90" r="3" fill="#4ECDC4"/>
                                            
                                            {/* Neural connections */}
                                            <line x1="120" y1="70" x2="135" y2="75" stroke="#4ECDC4" strokeWidth="2"/>
                                            <line x1="135" y1="75" x2="125" y2="85" stroke="#4ECDC4" strokeWidth="2"/>
                                            <line x1="125" y1="85" x2="140" y2="90" stroke="#4ECDC4" strokeWidth="2"/>
                                            
                                            {/* Corner decorative dots */}
                                            <circle cx="40" cy="40" r="6" fill="#FF6B35"/>
                                            <circle cx="160" cy="40" r="6" fill="#4ECDC4"/>
                                            <circle cx="40" cy="160" r="6" fill="#4A90E2"/>
                                        </svg>
                                    </div>
                                    
                                    {/* Light Theme Logo (for when switching to light mode in panels) */}
                                    <div className={`absolute inset-0 transition-opacity duration-300 ${darkMode ? 'opacity-100' : 'opacity-0'}`}>
                                        <svg width="40" height="40" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            {/* Hexagonal frame - light version */}
                                            <path d="M50 25L150 25L175 75L175 125L150 175L50 175L25 125L25 75L50 25Z" 
                                                  stroke="#E5E7EB" strokeWidth="8" fill="none"/>
                                            
                                            {/* Left side - Code bracket */}
                                            <path d="M75 60L45 100L75 140" 
                                                  stroke="#10B981" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                                            
                                            {/* Right side - Brain/AI */}
                                            <path d="M110 60C115 55 125 55 130 60C135 55 145 55 150 60C155 65 155 75 150 80C155 85 155 95 150 100C145 105 135 105 130 100C125 105 115 105 110 100C105 95 105 85 110 80C105 75 105 65 110 60Z" 
                                                  stroke="#10B981" strokeWidth="4" fill="none"/>
                                            
                                            {/* Neural nodes */}
                                            <circle cx="120" cy="70" r="3" fill="#10B981"/>
                                            <circle cx="135" cy="75" r="3" fill="#10B981"/>
                                            <circle cx="125" cy="85" r="3" fill="#10B981"/>
                                            <circle cx="140" cy="90" r="3" fill="#10B981"/>
                                            
                                            {/* Neural connections */}
                                            <line x1="120" y1="70" x2="135" y2="75" stroke="#10B981" strokeWidth="2"/>
                                            <line x1="135" y1="75" x2="125" y2="85" stroke="#10B981" strokeWidth="2"/>
                                            <line x1="125" y1="85" x2="140" y2="90" stroke="#10B981" strokeWidth="2"/>
                                            
                                            {/* Corner decorative dots */}
                                            <circle cx="40" cy="40" r="6" fill="#FF6B35"/>
                                            <circle cx="160" cy="40" r="6" fill="#10B981"/>
                                            <circle cx="40" cy="160" r="6" fill="#4A90E2"/>
                                        </svg>
                                    </div>
                                </div>
                                <div>
                                    <h1 className="font-bold text-2xl text-white">
                                        Code Review AI
                                    </h1>
                                    <p className="text-sm text-gray-400">Professional Code Analysis</p>
                                </div>
                            </div>
                        </div>
                        
                        {/* Premium Custom Persona Selector */}
                        <div className="relative group">
                            <div 
                                onClick={() => setIsPersonaDropdownOpen(!isPersonaDropdownOpen)}
                                className="flex items-center space-x-3 px-4 py-2.5 rounded-xl border-2 border-transparent transition-all duration-300 cursor-pointer hover:scale-105 hover:shadow-lg"
                                style={{ 
                                    backgroundColor: '#BFEFFF',
                                    background: 'linear-gradient(135deg, #BFEFFF 0%, #87CEEB 100%)',
                                    boxShadow: '0 4px 12px rgba(191, 239, 255, 0.3)'
                                }}
                            >
                                <div 
                                    className="w-2 h-2 rounded-full animate-pulse"
                                    style={{ 
                                        backgroundColor: personas[currentPersona].color === 'bg-red-600' ? '#EF4444' :
                                                       personas[currentPersona].color === 'bg-orange-600' ? '#F59E0B' :
                                                       personas[currentPersona].color === 'bg-blue-600' ? '#3B82F6' :
                                                       '#10B981'
                                    }}
                                ></div>
                                <span className="text-sm font-bold" style={{ color: '#1A1A1A' }}>
                                    {personas[currentPersona].name}
                                </span>
                                <div className="pointer-events-none">
                                    <svg 
                                        className={`w-4 h-4 transition-transform duration-300 ${isPersonaDropdownOpen ? 'rotate-180' : ''}`} 
                                        style={{ color: '#1A1A1A' }} 
                                        fill="none" 
                                        stroke="currentColor" 
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                            
                            {/* Custom Dropdown Menu */}
                            {isPersonaDropdownOpen && (
                                <div 
                                    className="absolute top-full left-0 mt-2 py-2 rounded-xl shadow-2xl border z-50 min-w-full overflow-hidden"
                                    style={{ 
                                        backgroundColor: darkMode ? '#374151' : 'white',
                                        border: `1px solid ${darkMode ? '#4B5563' : '#E5E7EB'}`,
                                        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
                                        animation: 'dropdownFadeIn 0.2s ease-out'
                                    }}
                                >
                                    {Object.entries(personas).map(([key, persona]) => {
                                        const Icon = persona.icon;
                                        const isSelected = currentPersona === key;
                                        return (
                                            <div
                                                key={key}
                                                onClick={() => {
                                                    setCurrentPersona(key as CodeReviewPersona);
                                                    setIsPersonaDropdownOpen(false);
                                                }}
                                                className={`flex items-center space-x-3 px-4 py-3 cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
                                                    isSelected ? 'bg-blue-50' : ''
                                                }`}
                                                style={{
                                                    backgroundColor: isSelected 
                                                        ? (darkMode ? '#1E40AF20' : '#EFF6FF') 
                                                        : 'transparent',
                                                    borderLeft: isSelected ? '4px solid #3B82F6' : '4px solid transparent'
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (!isSelected) {
                                                        e.currentTarget.style.backgroundColor = darkMode ? '#4B556320' : '#F8FAFC';
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (!isSelected) {
                                                        e.currentTarget.style.backgroundColor = 'transparent';
                                                    }
                                                }}
                                            >
                                                <div 
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
                                                    style={{ 
                                                        backgroundColor: persona.color === 'bg-red-600' ? '#FEF2F2' :
                                                                           persona.color === 'bg-orange-600' ? '#FFF7ED' :
                                                                           persona.color === 'bg-blue-600' ? '#EFF6FF' :
                                                                           '#F0FDF4',
                                                        color: persona.color === 'bg-red-600' ? '#EF4444' :
                                                               persona.color === 'bg-orange-600' ? '#F59E0B' :
                                                               persona.color === 'bg-blue-600' ? '#3B82F6' :
                                                               '#10B981'
                                                    }}
                                                >
                                                    <Icon className="w-4 h-4" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center space-x-2">
                                                        <span 
                                                            className="font-semibold text-sm"
                                                            style={{ color: darkMode ? '#F9FAFB' : '#1F2937' }}
                                                        >
                                                            {persona.name}
                                                        </span>
                                                        {isSelected && (
                                                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                                        )}
                                                    </div>
                                                    <div 
                                                        className="text-xs mt-1"
                                                        style={{ color: darkMode ? '#9CA3AF' : '#6B7280' }}
                                                    >
                                                        {persona.description}
                                                    </div>
                                                </div>
                                                <div className="flex items-center">
                                                    {isSelected && (
                                                        <div 
                                                            className="w-6 h-6 rounded-full flex items-center justify-center"
                                                            style={{ backgroundColor: '#3B82F6' }}
                                                        >
                                                            <FiCheck className="w-3 h-3 text-white" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    
                                    {/* Dropdown Footer */}
                                    <div 
                                        className="mt-2 pt-2 px-4 pb-3 border-t"
                                        style={{ 
                                            borderColor: darkMode ? '#4B5563' : '#E5E7EB',
                                            backgroundColor: darkMode ? '#1F293720' : '#F8FAFC'
                                        }}
                                    >
                                        <div className="text-xs" style={{ color: darkMode ? '#9CA3AF' : '#6B7280' }}>
                                            💡 Each expert focuses on different aspects of code quality
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {/* Click Outside Handler */}
                            {isPersonaDropdownOpen && (
                                <div 
                                    className="fixed inset-0 z-40"
                                    onClick={() => setIsPersonaDropdownOpen(false)}
                                ></div>
                            )}
                        </div>
                        
                        {/* Custom CSS for dropdown animation */}
                        <style>
                            {`
                                @keyframes dropdownFadeIn {
                                    from {
                                        opacity: 0;
                                        transform: translateY(-10px) scale(0.95);
                                    }
                                    to {
                                        opacity: 1;
                                        transform: translateY(0) scale(1);
                                    }
                                }
                            `}
                        </style>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={() => setDarkMode(!darkMode)}
                            className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
                            title="Toggle Dark/Light Mode"
                        >
                            {darkMode ? <IoSunny className="w-5 h-5 text-gray-400" /> : <IoMoon className="w-5 h-5 text-gray-400" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content - FLEX LAYOUT */}
            <div className="flex flex-1 overflow-hidden">
                
                {/* Left Panel - Code Editor */}
                <div className="w-1/2 flex flex-col" style={{ borderRight: '1px solid #E5E7EB' }}>
                    
                    {/* Code Header - ENHANCED WITH FORMAT BUTTON */}
                    <div className={`px-6 py-4 border-b ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-3">
                                <h2 className={`text-xl font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>Code</h2>
                                {codeChanged && (
                                    <div className="flex items-center space-x-2 text-orange-500 text-sm">
                                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                                        <span>Modified</span>
                                    </div>
                                )}
                                {highlightedLines.length > 0 && (
                                    <div className="flex items-center space-x-2 text-blue-500 text-sm">
                                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                        <span>Line {highlightedLines[0]} highlighted</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center space-x-3">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`flex items-center space-x-2 px-3 py-1.5 text-sm border rounded transition-colors ${
                                        darkMode 
                                            ? 'border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600' 
                                            : 'border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100'
                                    }`}
                                >
                                    <FiUpload className="w-4 h-4" />
                                    <span>Upload</span>
                                </button>
                                
                                {/* NEW: Format Code Button */}
                                <button
                                    onClick={handleFormatCode}
                                    disabled={!editedCode.trim() || isFormatting}
                                    className={`flex items-center space-x-2 px-3 py-1.5 text-sm border rounded transition-colors ${
                                        darkMode 
                                            ? 'border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50' 
                                            : 'border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-50'
                                    }`}
                                    title="Format and beautify code"
                                >
                                    {isFormatting ? (
                                        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <FiEdit3 className="w-4 h-4" />
                                    )}
                                    <span>{isFormatting ? 'Formatting...' : 'Format'}</span>
                                </button>
                                
                                <select
                                    value={selectedLanguage}
                                    onChange={(e) => setSelectedLanguage(e.target.value)}
                                    className={`px-3 py-1.5 text-sm border rounded focus:outline-none transition-colors ${
                                        darkMode 
                                            ? 'bg-gray-700 border-gray-600 text-gray-300' 
                                            : 'bg-white border-gray-300 text-gray-700'
                                    }`}
                                >
                                    {languages.map((lang) => (
                                        <option key={lang.value} value={lang.value}>
                                            {lang.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        
                        {/* ANALYZE BUTTON - ENHANCED WITH SMART STATES */}
                        <div className="flex items-center space-x-3">
                            <button
                                onClick={handleAnalyzeCode}
                                disabled={!editedCode.trim() || isStreaming}
                                className="group flex items-center space-x-3 px-6 py-3 text-sm font-bold rounded-xl transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl disabled:hover:scale-100 disabled:shadow-none"
                                style={{
                                    backgroundColor: !editedCode.trim() ? '#F3F4F6' : 
                                                   isStreaming ? '#9CA3AF' : '#BFEFFF',
                                    background: !editedCode.trim() ? '#F3F4F6' :
                                               isStreaming ? '#9CA3AF' : 'linear-gradient(135deg, #BFEFFF 0%, #87CEEB 100%)',
                                    color: !editedCode.trim() ? '#9CA3AF' : '#1A1A1A',
                                    cursor: isStreaming || !editedCode.trim() ? 'not-allowed' : 'pointer',
                                    boxShadow: !editedCode.trim() ? 'none' : 
                                              isStreaming ? 'none' : '0 4px 12px rgba(191, 239, 255, 0.4)'
                                }}
                            >
                                {!editedCode.trim() ? (
                                    <>
                                        <div className="w-5 h-5 rounded-full border-2 border-gray-400 flex items-center justify-center">
                                            <span className="text-xs">!</span>
                                        </div>
                                        <span>Add Code First</span>
                                    </>
                                ) : isStreaming ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                                        <span>Analyzing...</span>
                                        <div className="flex space-x-1">
                                            <span className="w-1 h-1 bg-gray-600 rounded-full animate-bounce"></span>
                                            <span className="w-1 h-1 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                                            <span className="w-1 h-1 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="relative">
                                            <IoPlay className="w-5 h-5 transition-transform group-hover:scale-110" />
                                            <div className="absolute inset-0 w-5 h-5 rounded-full bg-current opacity-20 animate-ping"></div>
                                        </div>
                                        <span>Analyze Code</span>
                                        <div className="text-xs opacity-70">
                                            ({editedCode.split('\n').length} lines)
                                        </div>
                                    </>
                                )}
                            </button>
                            
                            {codeChanged && (
                                <>
                                    <button
                                        onClick={handleSaveCode}
                                        className="px-3 py-2 text-sm rounded"
                                        style={{ backgroundColor: '#BFEFFF', color: '#1A1A1A' }}
                                    >
                                        <FiSave className="w-4 h-4 inline mr-1" />
                                        Save
                                    </button>
                                    
                                    <button
                                        onClick={handleResetCode}
                                        className="px-3 py-2 text-sm rounded"
                                        style={{ backgroundColor: '#F3F4F6', color: '#1A1A1A' }}
                                    >
                                        <IoRefresh className="w-4 h-4 inline mr-1" />
                                        Reset
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                    
                    {/* FIXED: Code Editor with Synchronized Line Numbers */}
                    <div className="flex-1 flex overflow-hidden">
                        {/* FIXED: Synchronized Line Numbers */}
                        <div 
                            ref={lineNumbersRef}
                            className="w-16 text-right font-mono text-sm py-4 px-3 overflow-hidden select-none"
                            style={{ 
                                backgroundColor: '#1E1E1E',
                                color: '#6B7280',
                                borderRight: '1px solid #374151',
                                maxHeight: '100%'
                            }}
                        >
                            {getLineNumbers().map((lineNumber) => {
                                const isHighlighted = highlightedLines.includes(lineNumber);
                                return (
                                    <div 
                                        key={lineNumber}
                                        className={`leading-6 transition-all duration-300 cursor-pointer hover:bg-gray-700 px-2 rounded ${
                                            isHighlighted ? 'bg-blue-500 text-white' : ''
                                        }`}
                                        style={{
                                            height: '24px', // Match textarea line height
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'flex-end',
                                            backgroundColor: isHighlighted ? '#3B82F6' : 'transparent',
                                            animation: isHighlighted ? 'pulse 1s infinite' : 'none'
                                        }}
                                        onClick={() => navigateToLine(lineNumber)}
                                        title={`Click to jump to line ${lineNumber}`}
                                    >
                                        {lineNumber}
                                    </div>
                                );
                            })}
                        </div>
                        
                        {/* FIXED: Code Area with Scroll Synchronization */}
                        <textarea
                            ref={codeTextareaRef}
                            value={editedCode}
                            onChange={(e) => {
                                setEditedCode(e.target.value);
                                setCodeChanged(e.target.value !== originalCode);
                            }}
                            onPaste={handleCodePaste}
                            onScroll={handleScroll}
                            placeholder="Paste your code here... (auto-formatting enabled)"
                            className="flex-1 p-4 font-mono text-sm resize-none focus:outline-none leading-6"
                            style={{ 
                                backgroundColor: '#1E1E1E',
                                color: '#FFFFFF',
                                tabSize: 4,
                                lineHeight: '24px' // Ensure consistent line height
                            }}
                            spellCheck={false}
                        />
                    </div>
                    
                    {/* Footer - ENHANCED WITH FORMATTING STATUS */}
                    <div 
                        className="px-6 py-3 text-sm flex items-center justify-between flex-shrink-0"
                        style={{ 
                            backgroundColor: darkMode ? '#374151' : 'white',
                            borderTop: '1px solid #E5E7EB',
                            color: '#6B7280'
                        }}
                    >
                        <span>
                            Analysis {isStreaming ? 'in progress' : 'complete'} - {editedCode ? editedCode.split('\n').length : 0} lines - {codeChanged ? '1 unsaved change' : 'saved'}
                            {isFormatting && ' - Formatting...'}
                        </span>
                    </div>
                    
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".js,.ts,.py,.java,.go,.rs,.cpp,.cs,.php,.rb,.swift,.kt,.jsx,.tsx"
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                </div>

                {/* Right Panel - AI Analysis - ENHANCED WITH NAVIGATION */}
                <div className="w-1/2 flex flex-col">
                    
                    {/* Analysis Header */}
                    <div className={`px-6 py-4 border-b ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                        <div className="flex items-center justify-between">
                            <h2 className={`text-xl font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>AI Analysis</h2>
                            {editCards.length > 0 && (
                                <span className="px-2 py-1 text-xs rounded" style={{ backgroundColor: '#BFEFFF', color: '#1A1A1A' }}>
                                    {editCards.length} suggestions
                                </span>
                            )}
                        </div>
                    </div>
                    
                    {/* Analysis Content */}
                    <div 
                        ref={chatContainerRef}
                        className="flex-1 p-6 space-y-6 overflow-y-auto"
                    >
                        {/* Analysis in Progress */}
                        {isTyping && !currentText && (
                            <div 
                                className="p-4 rounded-lg text-sm"
                                style={{ 
                                    backgroundColor: darkMode ? '#374151' : 'white',
                                    color: darkMode ? '#F9FAFB' : '#1A1A1A',
                                    border: `1px solid ${darkMode ? '#4B5563' : '#E5E7EB'}`
                                }}
                            >
                                <div className="flex items-center space-x-3">
                                    <div className="flex space-x-1">
                                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></span>
                                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                                    </div>
                                    <span className="text-sm">
                                        {personas[currentPersona].name} analyzing your {selectedLanguage} code...
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Live Analysis Results */}
                        {currentText && (
                            <div 
                                className="p-4 rounded-lg text-sm"
                                style={{ 
                                    backgroundColor: darkMode ? '#374151' : 'white',
                                    color: darkMode ? '#F9FAFB' : '#1A1A1A',
                                    border: `1px solid ${darkMode ? '#4B5563' : '#E5E7EB'}`
                                }}
                            >
                                <p>
                                    {currentText}
                                    {isStreaming && <span className="animate-pulse ml-1 text-blue-400">|</span>}
                                </p>
                            </div>
                        )}

                        {/* Enhanced Message History with Reactions */}
                        {messages.map((message) => (
                            <div key={message.id} className="group">
                                <div 
                                    className={`p-4 rounded-lg text-sm transition-all duration-200 ${
                                        message.sender === 'system' 
                                            ? 'bg-green-50 border border-green-200 text-green-800' 
                                            : darkMode 
                                                ? 'bg-gray-800 border border-gray-700 text-gray-100' 
                                                : 'bg-white border border-gray-200 text-gray-900'
                                    }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-2 mb-1">
                                                {message.persona && (
                                                    <span className="text-xs text-blue-600 font-medium">
                                                        {personas[message.persona].name}
                                                    </span>
                                                )}
                                                <span className="text-xs text-gray-400">
                                                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <p>{message.text}</p>
                                        </div>
                                        
                                        {message.sender === 'assistant' && (
                                            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleReaction(message.id, 'like')}
                                                    className={`p-1 rounded transition-colors ${
                                                        message.reaction === 'like' 
                                                            ? 'text-green-600 bg-green-100' 
                                                            : 'text-gray-400 hover:text-green-600'
                                                    }`}
                                                >
                                                    <FiThumbsUp className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={() => handleReaction(message.id, 'dislike')}
                                                    className={`p-1 rounded transition-colors ${
                                                        message.reaction === 'dislike' 
                                                            ? 'text-red-600 bg-red-100' 
                                                            : 'text-gray-400 hover:text-red-600'
                                                    }`}
                                                >
                                                    <FiThumbsDown className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* ENHANCED Code Issue Cards with View and Navigate Features */}
                        {editCards.map((card, index) => (
                            <div 
                                key={card.cardId} 
                                className="transition-all duration-600 ease-out"
                                style={{ 
                                    opacity: 0,
                                    transform: 'translateY(30px)',
                                    animation: `fadeInUp 0.6s ease-out ${index * 150}ms forwards`
                                }}
                            >
                                <div 
                                    className="p-6 rounded-xl mb-4 transition-all duration-300 hover:shadow-xl hover:scale-[1.02] border-l-4 group"
                                    style={{ 
                                        backgroundColor: darkMode ? '#374151' : 'white',
                                        border: `1px solid ${darkMode ? '#4B5563' : '#E5E7EB'}`,
                                        borderLeftColor: card.severity === 'critical' ? '#EF4444' : 
                                                        card.severity === 'warning' ? '#F59E0B' : '#3B82F6',
                                        boxShadow: darkMode 
                                            ? '0 4px 6px -1px rgba(0, 0, 0, 0.3)' 
                                            : '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                    }}
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-3 mb-3">
                                                <span 
                                                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all duration-200 ${
                                                        card.severity === 'critical' 
                                                            ? 'bg-red-100 text-red-800 border-red-200' 
                                                            : card.severity === 'warning'
                                                            ? 'bg-orange-100 text-orange-800 border-orange-200'
                                                            : 'bg-blue-100 text-blue-800 border-blue-200'
                                                    }`}
                                                    style={{ 
                                                        boxShadow: card.severity === 'critical' 
                                                            ? '0 0 0 3px rgba(239, 68, 68, 0.1)' 
                                                            : card.severity === 'warning'
                                                            ? '0 0 0 3px rgba(245, 158, 11, 0.1)'
                                                            : '0 0 0 3px rgba(59, 130, 246, 0.1)'
                                                    }}
                                                >
                                                    {card.severity === 'critical' && '🚨'} 
                                                    {card.severity === 'warning' && '⚠️'} 
                                                    {card.severity === 'info' && 'ℹ️'} 
                                                    {card.severity?.toUpperCase() || 'INFO'}
                                                </span>
                                                <span className={`font-semibold text-lg ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                                                    {card.issueType}
                                                </span>
                                                {card.lineNumber && card.lineNumber > 0 && (
                                                    <button
                                                        onClick={() => navigateToLine(card.lineNumber!)}
                                                        className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all duration-200 hover:scale-105 cursor-pointer ${
                                                            darkMode 
                                                                ? 'bg-blue-600 text-white hover:bg-blue-500' 
                                                                : 'bg-blue-500 text-white hover:bg-blue-600'
                                                        }`}
                                                        title="Click to navigate to this line in the code editor"
                                                    >
                                                        📍 Line {card.lineNumber} (Click to navigate)
                                                    </button>
                                                )}
                                            </div>
                                            <p className={`text-sm leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                                Consider using a more secure and efficient approach for this code section.
                                            </p>
                                        </div>
                                    </div>

                                    <div className={`text-xs font-semibold mb-3 flex items-center space-x-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                        <span>🤖</span>
                                        <span>AI SUGGESTED IMPROVEMENT</span>
                                    </div>
                                    
                                    {/* Before/After Code Comparison */}
                                    <div className="space-y-4 mb-6">
                                        {/* Current Code */}
                                        <div>
                                            <div className={`text-xs font-semibold mb-2 flex items-center space-x-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                                <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                                                <span>CURRENT CODE (ISSUE)</span>
                                            </div>
                                            <div 
                                                className="relative p-4 rounded-lg border-l-4 border-red-500 transition-all duration-200 hover:bg-opacity-80"
                                                style={{ 
                                                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                                    border: '1px solid rgba(239, 68, 68, 0.2)'
                                                }}
                                            >
                                                <pre className="whitespace-pre-wrap text-sm text-red-400 font-mono leading-relaxed">
                                                    {card.oldText}
                                                </pre>
                                            </div>
                                        </div>

                                        {/* Arrow Transition */}
                                        <div className="flex justify-center">
                                            <div className={`px-4 py-2 rounded-full text-xs font-bold flex items-center space-x-2 ${
                                                darkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
                                            } transition-all duration-200 hover:scale-105`}>
                                                <span>⬇️</span>
                                                <span>IMPROVED VERSION</span>
                                                <span>⬇️</span>
                                            </div>
                                        </div>

                                        {/* Improved Code */}
                                        <div>
                                            <div className={`text-xs font-semibold mb-2 flex items-center space-x-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                                                <span>IMPROVED CODE (SOLUTION)</span>
                                            </div>
                                            <div 
                                                className="relative p-4 rounded-lg border-l-4 border-green-500 transition-all duration-200 hover:bg-opacity-80"
                                                style={{ 
                                                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                                    border: '1px solid rgba(16, 185, 129, 0.2)'
                                                }}
                                            >
                                                <pre className="whitespace-pre-wrap text-sm text-green-400 font-mono leading-relaxed">
                                                    {card.newText}
                                                </pre>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ENHANCED Action Buttons with View and Navigation */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            {/* NEW: View in Editor Button */}
                                            {card.lineNumber && card.lineNumber > 0 && (
                                                <button
                                                    onClick={() => navigateToLine(card.lineNumber!)}
                                                    className="group px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-md hover:shadow-lg"
                                                    style={{ 
                                                        backgroundColor: '#E5E7EB',
                                                        color: '#374151'
                                                    }}
                                                    title="Navigate to this issue in the code editor"
                                                >
                                                    <span className="flex items-center space-x-2">
                                                        <FiEye className="w-4 h-4 transition-transform group-hover:scale-110" />
                                                        <span>View Line {card.lineNumber}</span>
                                                    </span>
                                                </button>
                                            )}
                                            
                                            <button
                                                onClick={() => handleApplyChanges(true, card.cardId)}
                                                className="group px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
                                                style={{ 
                                                    backgroundColor: '#BFEFFF',
                                                    color: '#1A1A1A'
                                                }}
                                            >
                                                <span className="flex items-center space-x-2">
                                                    <FiCheckCircle className="w-4 h-4 transition-transform group-hover:rotate-12" />
                                                    <span>Apply Fix</span>
                                                </span>
                                            </button>
                                            <button
                                                onClick={() => handleApplyChanges(false, card.cardId)}
                                                className="group px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
                                                style={{ 
                                                    backgroundColor: '#F3F4F6',
                                                    color: '#1A1A1A'
                                                }}
                                            >
                                                <span className="flex items-center space-x-2">
                                                    <IoClose className="w-4 h-4 transition-transform group-hover:rotate-90" />
                                                    <span>Reject</span>
                                                </span>
                                            </button>
                                        </div>
                                        
                                        {/* Copy Code Button */}
                                        <button
                                            onClick={() => copyToClipboard(card.newText)}
                                            className={`p-2 rounded-lg transition-all duration-200 hover:scale-110 ${
                                                darkMode 
                                                    ? 'hover:bg-gray-600 text-gray-400 hover:text-gray-200' 
                                                    : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                                            }`}
                                            title="Copy improved code"
                                        >
                                            <IoCopy className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* No Issues Found - Success State */}
                        {!isTyping && !currentText && editCards.length === 0 && messages.length > 0 && (
                            <div className="text-center py-12">
                                <div 
                                    className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                                    style={{ backgroundColor: '#10B981', color: 'white' }}
                                >
                                    <FiCheckCircle className="w-8 h-8" />
                                </div>
                                <h3 className="text-lg font-medium mb-2" style={{ color: darkMode ? 'white' : '#1A1A1A' }}>
                                    ✨ Code Looks Great!
                                </h3>
                                <p className="text-sm" style={{ color: '#10B981' }}>
                                    No issues found by {personas[currentPersona].name}. Your code follows best practices!
                                </p>
                                <div className="mt-4">
                                    <p className="text-xs" style={{ color: darkMode ? '#9CA3AF' : '#6B7280' }}>
                                        Try switching to a different analysis type or upload another file to continue reviewing.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Empty State - Initial with Enhanced UI */}
                        {!isTyping && !currentText && editCards.length === 0 && messages.length === 0 && (
                            <div className="text-center py-16">
                                <div className="relative">
                                    {/* Animated Background Circles */}
                                    <div 
                                        className="absolute inset-0 w-32 h-32 rounded-full mx-auto opacity-10 animate-pulse"
                                        style={{ backgroundColor: '#BFEFFF', animationDuration: '3s' }}
                                    ></div>
                                    <div 
                                        className="absolute inset-4 w-24 h-24 rounded-full mx-auto opacity-20 animate-pulse"
                                        style={{ backgroundColor: '#87CEEB', animationDuration: '2s', animationDelay: '0.5s' }}
                                    ></div>
                                    
                                    {/* Main Icon */}
                                    <div 
                                        className="relative w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center transform transition-all duration-500 hover:scale-110 hover:rotate-3"
                                        style={{ 
                                            backgroundColor: darkMode ? '#374151' : '#F8FAFC',
                                            border: `2px solid ${darkMode ? '#4B5563' : '#E2E8F0'}`,
                                            boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1)'
                                        }}
                                    >
                                        <FiCode className="w-10 h-10" style={{ color: darkMode ? '#9CA3AF' : '#6B7280' }} />
                                        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center"
                                             style={{ backgroundColor: '#BFEFFF' }}>
                                            <span className="text-xs">✨</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <h3 className="text-2xl font-bold mb-3" style={{ color: darkMode ? 'white' : '#1A1A1A' }}>
                                    Ready for AI Analysis
                                </h3>
                                <p className="text-lg mb-8" style={{ color: darkMode ? '#9CA3AF' : '#6B7280' }}>
                                    Get {personas[currentPersona].description.toLowerCase()} from our {personas[currentPersona].name}
                                </p>
                                
                                {/* Quick Start Steps */}
                                <div className="max-w-md mx-auto space-y-4 mb-8">
                                    <div className="flex items-center space-x-4 p-4 rounded-xl" style={{ backgroundColor: darkMode ? '#374151' : 'white', border: '1px solid #E5E7EB' }}>
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#BFEFFF' }}>
                                            <span className="text-sm font-bold" style={{ color: '#1A1A1A' }}>1</span>
                                        </div>
                                        <div className="text-left">
                                            <div className="font-medium" style={{ color: darkMode ? 'white' : '#1A1A1A' }}>
                                                Add Your Code
                                            </div>
                                            <div className="text-sm" style={{ color: '#6B7280' }}>
                                                Paste code or upload a file (auto-format enabled)
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center space-x-4 p-4 rounded-xl" style={{ backgroundColor: darkMode ? '#374151' : 'white', border: '1px solid #E5E7EB' }}>
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#BFEFFF' }}>
                                            <span className="text-sm font-bold" style={{ color: '#1A1A1A' }}>2</span>
                                        </div>
                                        <div className="text-left">
                                            <div className="font-medium" style={{ color: darkMode ? 'white' : '#1A1A1A' }}>
                                                Choose Analysis Type
                                            </div>
                                            <div className="text-sm" style={{ color: '#6B7280' }}>
                                                Security, Performance, Testing, etc.
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center space-x-4 p-4 rounded-xl" style={{ backgroundColor: darkMode ? '#374151' : 'white', border: '1px solid #E5E7EB' }}>
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#BFEFFF' }}>
                                            <span className="text-sm font-bold" style={{ color: '#1A1A1A' }}>3</span>
                                        </div>
                                        <div className="text-left">
                                            <div className="font-medium" style={{ color: darkMode ? 'white' : '#1A1A1A' }}>
                                                Get Smart Suggestions
                                            </div>
                                            <div className="text-sm" style={{ color: '#6B7280' }}>
                                                Navigate to issues and apply fixes with one click
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Sample Code Button */}
                                <button
                                    onClick={() => {
                                        const sampleCode = `function login(username, password) {
    const query = "SELECT * FROM users WHERE username = '" + username + "' AND password = '" + password + "'";
    const result = db.query(query);
    
    if (result.length > 0) {
        document.getElementById("welcome").innerHTML = "Welcome " + username + "!";
        console.log("User logged in: " + username);
        return true;
    }
    return false;
}`;
                                        const formattedSample = formatCode(sampleCode, 'javascript');
                                        setEditedCode(formattedSample);
                                        setOriginalCode(formattedSample);
                                        setCodeChanged(false);
                                    }}
                                    className="group px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
                                    style={{ 
                                        backgroundColor: '#F3F4F6',
                                        color: '#6B7280',
                                        border: '2px dashed #D1D5DB'
                                    }}
                                >
                                    <span className="flex items-center space-x-2">
                                        <span>📝</span>
                                        <span>Try Sample Code</span>
                                        <span className="text-xs opacity-70">(with security issues)</span>
                                    </span>
                                </button>
                                
                                <div className="mt-8">
                                    <p className="text-xs" style={{ color: darkMode ? '#6B7280' : '#9CA3AF' }}>
                                        💡 New: Click line numbers or "View Line X" to navigate directly to issues in your code!
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Enhanced CSS Animations */}
                        <style>
                            {`
                                @keyframes fadeInUp {
                                    from {
                                        opacity: 0;
                                        transform: translateY(30px);
                                    }
                                    to {
                                        opacity: 1;
                                        transform: translateY(0);
                                    }
                                }
                                
                                @keyframes pulse {
                                    0%, 100% {
                                        opacity: 1;
                                    }
                                    50% {
                                        opacity: 0.5;
                                    }
                                }
                            `}
                        </style>

                        <div ref={messagesEndRef} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FullPageCodeReviewAI;