import React, { useState, useRef, useEffect, useCallback } from 'react';
import { IoClose, IoMoon, IoSunny, IoCopy, IoDownload, IoPlay, IoRefresh, IoSparkles, IoRocket, IoShield } from "react-icons/io5";
import { FiThumbsUp, FiThumbsDown, FiUsers, FiSettings, FiUpload, FiCode, FiShield as FiShieldIcon, FiZap, FiCheckCircle, FiCheck, FiEdit3, FiSave, FiSend, FiMic, FiMicOff } from 'react-icons/fi';

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
    // Core state
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
    const [showSettings, setShowSettings] = useState<boolean>(false);
    const [shouldAutoScroll, setShouldAutoScroll] = useState<boolean>(false);
    const [codeChanged, setCodeChanged] = useState<boolean>(false);
    
    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Professional personas configuration
    const personas: Record<CodeReviewPersona, {
        name: string;
        color: string;
        bgGradient: string;
        icon: React.ComponentType<{ className?: string }>;
        description: string;
        focus: string;
        emoji: string;
    }> = {
        security: { 
            name: "Security Expert", 
            color: "text-red-400", 
            bgGradient: "from-red-500/20 to-pink-500/20",
            icon: FiShieldIcon,
            description: "Vulnerability & security review",
            focus: "SQL injection, XSS, authentication flaws",
            emoji: "🛡️"
        },
        performance: { 
            name: "Performance Expert", 
            color: "text-orange-400", 
            bgGradient: "from-orange-500/20 to-yellow-500/20",
            icon: FiZap,
            description: "Speed & efficiency optimization",
            focus: "Memory leaks, slow queries, inefficient algorithms",
            emoji: "⚡"
        },
        maintainability: { 
            name: "Code Quality", 
            color: "text-blue-400", 
            bgGradient: "from-blue-500/20 to-cyan-500/20",
            icon: FiCode,
            description: "Clean code & best practices",
            focus: "Structure, readability, design patterns",
            emoji: "🎯"
        },
        testing: { 
            name: "Test Engineer", 
            color: "text-green-400", 
            bgGradient: "from-green-500/20 to-emerald-500/20",
            icon: FiCheck,
            description: "Test coverage & quality assurance",
            focus: "Unit tests, edge cases, mocking strategies",
            emoji: "✅"
        }
    };

    // Programming languages
    const languages = [
        { id: 'javascript', name: 'JavaScript', icon: '🟨' },
        { id: 'typescript', name: 'TypeScript', icon: '🔷' },
        { id: 'python', name: 'Python', icon: '🐍' },
        { id: 'java', name: 'Java', icon: '☕' },
        { id: 'go', name: 'Go', icon: '🐹' },
        { id: 'rust', name: 'Rust', icon: '🦀' }
    ];

    // Utility functions
    const playSound = useCallback((type: 'message' | 'success' | 'error' | 'notification') => {
        console.log(`Sound: ${type}`);
    }, []);

    const copyToClipboard = useCallback(async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            playSound('success');
        } catch (err) {
            playSound('error');
            console.error('Failed to copy:', err);
        }
    }, [playSound]);

    const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            const extension = file.name.split('.').pop()?.toLowerCase();
            
            const langMap: Record<string, string> = {
                'js': 'javascript', 'ts': 'typescript', 'py': 'python',
                'java': 'java', 'go': 'go', 'rs': 'rust'
            };
            
            if (extension && langMap[extension]) {
                setSelectedLanguage(langMap[extension]);
            }
            
            setOriginalCode(content);
            setEditedCode(content);
            setCodeChanged(false);
        };
        reader.readAsText(file);
    }, []);

    const scrollToBottom = (): void => {
        if (shouldAutoScroll) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, currentText, editCards, shouldAutoScroll]);

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
            
            setCurrentText("Analyzing your code for security vulnerabilities...");
            
            setTimeout(() => {
                setCurrentText("Found several critical security issues that need immediate attention.");
                
                const demoCards: EditCard[] = [];
                
                if (editedCode.includes('f"SELECT * FROM') || editedCode.includes("f'SELECT * FROM")) {
                    demoCards.push({
                        cardId: "sql_injection_001",
                        oldText: `query = f"SELECT * FROM users WHERE id = '{user_id}'"`,
                        newText: `query = "SELECT * FROM users WHERE id = ?"
cursor.execute(query, (user_id,))`,
                        severity: "critical",
                        issueType: "SQL Injection Vulnerability",
                        lineNumber: 15
                    });
                }

                if (editedCode.includes('innerHTML') || editedCode.includes('dangerouslySetInnerHTML')) {
                    demoCards.push({
                        cardId: "xss_vulnerability_002",
                        oldText: `element.innerHTML = userInput;`,
                        newText: `element.textContent = userInput;`,
                        severity: "critical",
                        issueType: "XSS Vulnerability",
                        lineNumber: 23
                    });
                }

                if (editedCode.includes('password') && !editedCode.includes('hash')) {
                    demoCards.push({
                        cardId: "password_security_003",
                        oldText: `password: user.password`,
                        newText: `password: await bcrypt.hash(user.password, 10)`,
                        severity: "critical",
                        issueType: "Password Security",
                        lineNumber: 8
                    });
                }

                if (demoCards.length === 0) {
                    demoCards.push({
                        cardId: "demo_improvement_001",
                        oldText: `function processData(data) {
    return data.map(item => item.value);
}`,
                        newText: `function processData(data) {
    if (!Array.isArray(data)) {
        throw new Error('Data must be an array');
    }
    return data.map(item => {
        if (!item || typeof item.value === 'undefined') {
            throw new Error('Invalid item structure');
        }
        return item.value;
    });
}`,
                        severity: "warning",
                        issueType: "Error Handling",
                        lineNumber: 12
                    });
                }

                setEditCards(demoCards);
                setIsStreaming(false);
                setIsTyping(false);
                
                const newMessage: Message = {
                    id: messages.length + 1,
                    text: currentText,
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

    const handleApplyChanges = (approved: boolean, cardId: string) => {
        if (approved) {
            const card = editCards.find(c => c.cardId === cardId);
            if (card) {
                const updatedCode = editedCode.replace(card.oldText, card.newText);
                setEditedCode(updatedCode);
                setCodeChanged(true);
                playSound('success');
            }
        }
        setEditCards(prev => prev.filter(c => c.cardId !== cardId));
    };

    const handleReaction = (messageId: number, reaction: 'like' | 'dislike') => {
        setMessages(prev => prev.map(msg => 
            msg.id === messageId 
                ? { ...msg, reaction: msg.reaction === reaction ? undefined : reaction }
                : msg
        ));
        playSound('notification');
    };

    return (
        <div className={`min-h-screen transition-all duration-500 ${darkMode ? 'dark' : ''}`}>
            {/* Main Container with Glassmorphism */}
            <div className="relative min-h-screen overflow-hidden">
                {/* Animated Background Orbs */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-purple-400/30 to-pink-400/30 rounded-full blur-3xl floating" style={{ animationDelay: '0s' }}></div>
                    <div className="absolute top-3/4 right-1/4 w-80 h-80 bg-gradient-to-r from-blue-400/30 to-cyan-400/30 rounded-full blur-3xl floating" style={{ animationDelay: '2s' }}></div>
                    <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-gradient-to-r from-green-400/30 to-emerald-400/30 rounded-full blur-3xl floating" style={{ animationDelay: '4s' }}></div>
                </div>

                {/* Header */}
                <header className="relative z-10 p-6">
                    <div className="max-w-7xl mx-auto">
                        <div className="glass-effect rounded-2xl p-6 border border-white/20">
                            <div className="flex items-center justify-between">
                                {/* Logo & Title */}
                                <div className="flex items-center space-x-4">
                                    <div className="relative">
                                        <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center glow-effect">
                                            <IoSparkles className="w-6 h-6 text-white" />
                                        </div>
                                    </div>
                                    <div>
                                        <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                                            AI Code Review
                                        </h1>
                                        <p className="text-sm text-white/70">
                                            Professional code analysis powered by AI
                                        </p>
                                    </div>
                                </div>

                                {/* Header Controls */}
                                <div className="flex items-center space-x-4">
                                    {/* Persona Selector */}
                                    <div className="flex items-center space-x-2 bg-white/10 rounded-xl p-1 backdrop-blur-sm">
                                        {Object.entries(personas).map(([key, persona]) => (
                                            <button
                                                key={key}
                                                onClick={() => setCurrentPersona(key as CodeReviewPersona)}
                                                className={`relative px-4 py-2 rounded-lg transition-all duration-300 flex items-center space-x-2 ${
                                                    currentPersona === key
                                                        ? 'bg-white/20 text-white shadow-lg transform scale-105'
                                                        : 'text-white/70 hover:text-white hover:bg-white/10'
                                                }`}
                                            >
                                                <span className="text-lg">{persona.emoji}</span>
                                                <span className="font-medium hidden sm:inline">{persona.name}</span>
                                                {currentPersona === key && (
                                                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg -z-10"></div>
                                                )}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Theme Toggle */}
                                    <button
                                        onClick={() => setDarkMode(!darkMode)}
                                        className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-300 backdrop-blur-sm group"
                                    >
                                        {darkMode ? (
                                            <IoSunny className="w-5 h-5 text-yellow-400 group-hover:rotate-180 transition-transform duration-500" />
                                        ) : (
                                            <IoMoon className="w-5 h-5 text-blue-300 group-hover:rotate-180 transition-transform duration-500" />
                                        )}
                                    </button>

                                    {/* Settings */}
                                    <button
                                        onClick={() => setShowSettings(!showSettings)}
                                        className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-300 backdrop-blur-sm group"
                                    >
                                        <FiSettings className="w-5 h-5 text-white group-hover:rotate-90 transition-transform duration-300" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="relative z-10 px-6 pb-6">
                    <div className="max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-200px)]">
                            {/* Code Editor Panel */}
                            <div className="glass-effect rounded-2xl border border-white/20 flex flex-col">
                                {/* Editor Header */}
                                <div className="p-6 border-b border-white/10">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center space-x-3">
                                            <FiCode className="w-5 h-5 text-purple-400" />
                                            <h2 className="text-lg font-semibold text-white">Code Editor</h2>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            {/* Language Selector */}
                                            <select
                                                value={selectedLanguage}
                                                onChange={(e) => setSelectedLanguage(e.target.value)}
                                                className="px-3 py-2 rounded-lg bg-white/10 text-white border border-white/20 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                            >
                                                {languages.map(lang => (
                                                    <option key={lang.id} value={lang.id} className="bg-gray-800 text-white">
                                                        {lang.icon} {lang.name}
                                                    </option>
                                                ))}
                                            </select>
                                            
                                            {/* File Upload */}
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".js,.ts,.py,.java,.go,.rs,.jsx,.tsx,.vue,.html,.css"
                                                onChange={handleFileUpload}
                                                className="hidden"
                                            />
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all duration-300 backdrop-blur-sm group"
                                                title="Upload file"
                                            >
                                                <FiUpload className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {/* Current Persona Info */}
                                    <div className={`p-4 rounded-xl bg-gradient-to-r ${personas[currentPersona].bgGradient} border border-white/20`}>
                                        <div className="flex items-center space-x-3">
                                            <span className="text-2xl">{personas[currentPersona].emoji}</span>
                                            <div>
                                                <h3 className="font-semibold text-white">{personas[currentPersona].name}</h3>
                                                <p className="text-sm text-white/80">{personas[currentPersona].description}</p>
                                                <p className="text-xs text-white/60 mt-1">Focus: {personas[currentPersona].focus}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Code Textarea */}
                                <div className="flex-1 p-6">
                                    <textarea
                                        value={editedCode}
                                        onChange={(e) => {
                                            setEditedCode(e.target.value);
                                            setCodeChanged(true);
                                        }}
                                        className="w-full h-full resize-none bg-black/20 text-white font-mono text-sm leading-relaxed p-4 rounded-xl border border-white/20 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 placeholder-white/50"
                                        placeholder={`// Paste your ${selectedLanguage} code here for analysis...
// Example:
function validateUser(userData) {
    if (!userData) return false;
    return userData.email && userData.password;
}`}
                                        style={{ fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace' }}
                                    />
                                </div>

                                {/* Analyze Button */}
                                <div className="p-6 border-t border-white/10">
                                    <button
                                        onClick={startStream}
                                        disabled={isStreaming || !editedCode.trim()}
                                        className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold text-lg transition-all duration-300 hover:transform hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-3 group"
                                    >
                                        {isStreaming ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                <span>Analyzing Code...</span>
                                            </>
                                        ) : (
                                            <>
                                                <IoRocket className="w-5 h-5 group-hover:transform group-hover:scale-110 transition-transform" />
                                                <span>Analyze Code</span>
                                                <IoSparkles className="w-5 h-5 group-hover:transform group-hover:scale-110 transition-transform" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Analysis Results Panel */}
                            <div className="glass-effect rounded-2xl border border-white/20 flex flex-col">
                                {/* Results Header */}
                                <div className="p-6 border-b border-white/10">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            <IoShield className="w-5 h-5 text-blue-400" />
                                            <h2 className="text-lg font-semibold text-white">Analysis Results</h2>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <button
                                                onClick={() => copyToClipboard(JSON.stringify({ messages, editCards }, null, 2))}
                                                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all duration-300 backdrop-blur-sm group"
                                                title="Export results"
                                            >
                                                <IoDownload className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Results Content */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-6" ref={chatContainerRef}>
                                    {/* Streaming Text */}
                                    {isTyping && currentText && (
                                        <div className="space-y-4">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                                                    <span className="text-sm">{personas[currentPersona].emoji}</span>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-sm font-medium text-white">{personas[currentPersona].name}</span>
                                                    <div className="flex space-x-1">
                                                        <div className="w-1 h-1 bg-purple-400 rounded-full animate-pulse"></div>
                                                        <div className="w-1 h-1 bg-pink-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                                        <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                                <p className="text-white leading-relaxed">{currentText}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Messages */}
                                    {messages.map((message, index) => (
                                        <div key={message.id} className="space-y-4" style={{ animation: `fadeInUp 0.5s ease-out ${index * 0.1}s both` }}>
                                            <div className="flex items-center space-x-3">
                                                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                                                    <span className="text-sm">{message.persona ? personas[message.persona].emoji : '🤖'}</span>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-sm font-medium text-white">
                                                        {message.persona ? personas[message.persona].name : 'AI Assistant'}
                                                    </span>
                                                    <span className="text-xs text-white/50">
                                                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="bg-white/5 rounded-xl p-4 border border-white/10 group">
                                                <p className="text-white leading-relaxed">{message.text}</p>
                                                {message.sender === 'assistant' && (
                                                    <div className="flex items-center justify-end space-x-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleReaction(message.id, 'like')}
                                                            className={`p-2 rounded-lg transition-all duration-200 ${
                                                                message.reaction === 'like' 
                                                                    ? 'bg-green-500/20 text-green-400' 
                                                                    : 'text-white/50 hover:text-green-400 hover:bg-green-500/10'
                                                            }`}
                                                        >
                                                            <FiThumbsUp className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleReaction(message.id, 'dislike')}
                                                            className={`p-2 rounded-lg transition-all duration-200 ${
                                                                message.reaction === 'dislike' 
                                                                    ? 'bg-red-500/20 text-red-400' 
                                                                    : 'text-white/50 hover:text-red-400 hover:bg-red-500/10'
                                                            }`}
                                                        >
                                                            <FiThumbsDown className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {/* Edit Cards */}
                                    {editCards.map((card, index) => (
                                        <div 
                                            key={card.cardId} 
                                            className="space-y-4"
                                            style={{ animation: `fadeInUp 0.6s ease-out ${index * 0.15}s both` }}
                                        >
                                            <div className={`rounded-xl border border-white/20 overflow-hidden bg-gradient-to-br ${
                                                card.severity === 'critical' ? 'from-red-500/10 to-red-600/5' :
                                                card.severity === 'warning' ? 'from-orange-500/10 to-orange-600/5' :
                                                'from-blue-500/10 to-blue-600/5'
                                            } backdrop-blur-sm`}>
                                                {/* Card Header */}
                                                <div className="p-6 border-b border-white/10">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex items-center space-x-3">
                                                            <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center space-x-2 ${
                                                                card.severity === 'critical' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                                                card.severity === 'warning' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                                                                'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                                            }`}>
                                                                <span>
                                                                    {card.severity === 'critical' && '🚨'}
                                                                    {card.severity === 'warning' && '⚠️'}
                                                                    {card.severity === 'info' && 'ℹ️'}
                                                                </span>
                                                                <span>{card.severity?.toUpperCase()}</span>
                                                            </div>
                                                            <div>
                                                                <h3 className="font-semibold text-white text-lg">{card.issueType}</h3>
                                                                {card.lineNumber && card.lineNumber > 0 && (
                                                                    <p className="text-sm text-white/60">Line {card.lineNumber}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Code Comparison */}
                                                <div className="p-6 space-y-4">
                                                    {/* Current Code */}
                                                    <div>
                                                        <div className="flex items-center space-x-2 mb-3">
                                                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                                            <span className="text-sm font-medium text-white/80">Current Code</span>
                                                        </div>
                                                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                                                            <pre className="text-red-300 text-sm font-mono leading-relaxed overflow-x-auto">
                                                                {card.oldText}
                                                            </pre>
                                                        </div>
                                                    </div>

                                                    {/* Arrow */}
                                                    <div className="flex justify-center">
                                                        <div className="bg-white/10 rounded-full px-4 py-2 flex items-center space-x-2">
                                                            <span className="text-white/60 text-sm font-medium">Improved</span>
                                                            <span className="text-white/60">↓</span>
                                                        </div>
                                                    </div>

                                                    {/* Improved Code */}
                                                    <div>
                                                        <div className="flex items-center space-x-2 mb-3">
                                                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                                            <span className="text-sm font-medium text-white/80">Improved Code</span>
                                                        </div>
                                                        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                                                            <pre className="text-green-300 text-sm font-mono leading-relaxed overflow-x-auto">
                                                                {card.newText}
                                                            </pre>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="p-6 border-t border-white/10 flex items-center justify-between">
                                                    <div className="flex items-center space-x-3">
                                                        <button
                                                            onClick={() => handleApplyChanges(true, card.cardId)}
                                                            className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-medium transition-all duration-300 hover:transform hover:scale-105 hover:shadow-lg flex items-center space-x-2 group"
                                                        >
                                                            <FiCheckCircle className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                                                            <span>Apply Fix</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleApplyChanges(false, card.cardId)}
                                                            className="px-6 py-3 bg-white/10 text-white rounded-lg font-medium transition-all duration-300 hover:bg-white/20 flex items-center space-x-2 group"
                                                        >
                                                            <IoClose className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                                                            <span>Dismiss</span>
                                                        </button>
                                                    </div>
                                                    <button
                                                        onClick={() => copyToClipboard(card.newText)}
                                                        className="p-3 rounded-lg bg-white/10 hover:bg-white/20 transition-all duration-300 group"
                                                        title="Copy improved code"
                                                    >
                                                        <IoCopy className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Success State */}
                                    {!isTyping && !currentText && editCards.length === 0 && messages.length > 0 && (
                                        <div className="text-center py-12">
                                            <div className="w-20 h-20 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full mx-auto mb-6 flex items-center justify-center floating">
                                                <FiCheckCircle className="w-10 h-10 text-white" />
                                            </div>
                                            <h3 className="text-xl font-bold text-white mb-2">✨ Excellent Code Quality!</h3>
                                            <p className="text-white/70 mb-4">No issues found by {personas[currentPersona].name}</p>
                                            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 max-w-md mx-auto">
                                                <p className="text-green-300 text-sm">
                                                    Your code follows best practices and security standards. Great job!
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Empty State */}
                                    {!isTyping && !currentText && editCards.length === 0 && messages.length === 0 && (
                                        <div className="text-center py-12">
                                            <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mx-auto mb-6 flex items-center justify-center floating">
                                                <FiCode className="w-10 h-10 text-white" />
                                            </div>
                                            <h3 className="text-xl font-bold text-white mb-2">Ready for Analysis</h3>
                                            <p className="text-white/70 mb-6">
                                                Get expert {personas[currentPersona].description.toLowerCase()} for your code
                                            </p>
                                            <div className="bg-white/5 border border-white/10 rounded-xl p-6 max-w-md mx-auto">
                                                <div className="space-y-3 text-left">
                                                    <div className="flex items-center space-x-2 text-white/60 text-sm">
                                                        <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                                                        <span>Paste your code in the editor</span>
                                                    </div>
                                                    <div className="flex items-center space-x-2 text-white/60 text-sm">
                                                        <span className="w-2 h-2 bg-pink-400 rounded-full"></span>
                                                        <span>Select analysis type</span>
                                                    </div>
                                                    <div className="flex items-center space-x-2 text-white/60 text-sm">
                                                        <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                                                        <span>Click "Analyze Code"</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div ref={messagesEndRef} />
                                </div>
                            </div>
                        </div>
                    </div>
                </main>

                {/* Settings Modal */}
                {showSettings && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                        <div className="glass-effect rounded-2xl border border-white/20 max-w-md w-full max-h-[80vh] overflow-y-auto">
                            <div className="p-6 border-b border-white/10">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-bold text-white">Settings</h2>
                                    <button
                                        onClick={() => setShowSettings(false)}
                                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all duration-300"
                                    >
                                        <IoClose className="w-5 h-5 text-white" />
                                    </button>
                                </div>
                            </div>
                            <div className="p-6 space-y-6">
                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-4">Analysis Preferences</h3>
                                    <div className="space-y-3">
                                        <label className="flex items-center space-x-3">
                                            <input type="checkbox" className="rounded" defaultChecked />
                                            <span className="text-white">Auto-scroll to new messages</span>
                                        </label>
                                        <label className="flex items-center space-x-3">
                                            <input type="checkbox" className="rounded" defaultChecked />
                                            <span className="text-white">Sound notifications</span>
                                        </label>
                                        <label className="flex items-center space-x-3">
                                            <input type="checkbox" className="rounded" />
                                            <span className="text-white">Detailed explanations</span>
                                        </label>
                                    </div>
                                </div>
                                
                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-4">Export Options</h3>
                                    <div className="space-y-2">
                                        <button className="w-full py-2 px-4 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all duration-300">
                                            Export as JSON
                                        </button>
                                        <button className="w-full py-2 px-4 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all duration-300">
                                            Export as PDF Report
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FullPageCodeReviewAI;