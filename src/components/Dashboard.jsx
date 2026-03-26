import { useState, useRef, useEffect } from 'react';

// Help escape unsafe strings for HTML display
const escapeHtml = (unsafe) => {
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const fetchWikipedia = async (query) => {
  try {
    const cleanQuery = query.replace(/[?.,!]/g, '');
    const stopWords = ['what', 'why', 'how', 'when', 'explain', 'define', 'the', 'is', 'a', 'an', 'are', 'in', 'of', 'to', 'can', 'you'];
    const words = cleanQuery.split(' ').filter(w => !stopWords.includes(w.toLowerCase()));
    const searchTopic = words.join(' ') || query;

    const res = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTopic)}&utf8=&format=json&origin=*`);
    const data = await res.json();

    if (data.query?.search?.length > 0) {
      const title = data.query.search[0].title;
      const summaryRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exsentences=3&exlimit=1&titles=${encodeURIComponent(title)}&explaintext=1&format=json&origin=*`);
      const summaryData = await summaryRes.json();
      const pages = summaryData.query.pages;
      const pageId = Object.keys(pages)[0];
      const snippet = pages[pageId].extract;

      if (snippet && snippet.trim().length > 10) {
        return {
          text: snippet,
          source: "Wikipedia",
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`
        };
      }
    }
  } catch (e) {
    console.warn("Wiki fetch failed", e);
  }
  return null;
};

export default function Dashboard({ user, onSignOut, showToast }) {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [useAI, setUseAI] = useState(() => !!localStorage.getItem('gemini_api_key'));

  const saveApiKey = (key) => {
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
    if (key) setUseAI(true);
  };

  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(`doubts_${user.username}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Migrate old format to new format
        return parsed.map(item => {
          if (item.result && !item.messages) {
            return {
              id: item.id,
              title: item.doubt,
              messages: [{ id: item.id, doubt: item.doubt, subject: item.subject, result: item.result }]
            };
          }
          return item;
        });
      }
    } catch (e) { }
    return [];
  });

  const [activeId, setActiveId] = useState('new');
  const [doubt, setDoubt] = useState('');
  const [subject, setSubject] = useState('');
  const [programmingLang, setProgrammingLang] = useState('javascript');
  const [fileName, setFileName] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showStarredOnly, setShowStarredOnly] = useState(false);

  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(`doubts_${user.username}`, JSON.stringify(history));
  }, [history, user.username]);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const scrollToEnd = () => {
    setTimeout(() => {
      if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const startListening = () => {
    if (isRecording) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      showToast("Voice input is not supported in this browser. Please try Chrome.");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsRecording(true);
      showToast("Listening...");
    };

    recognition.onresult = (event) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        currentTranscript += event.results[i][0].transcript;
      }
      setDoubt(currentTranscript);

      const lower = currentTranscript.toLowerCase();
      if (lower.match(/(math|calculate|add|sum|divide|multiply|fraction|algebra|equation|\bnumber)/)) {
        setSubject('mathematics');
      } else if (lower.match(/(science|physics|chemistry|biology|reaction|force|energy|cell|atom)/)) {
        setSubject('science');
      } else if (lower.match(/(code|program|loop|array|function|variable|python|java|c\+\+|javascript|string)/)) {
        setSubject('programming');
      }
    };

    recognition.onerror = (event) => {
      setIsRecording(false);
      if (event.error !== 'no-speech') {
        showToast("Microphone error: " + event.error);
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  const handleDeleteChat = (e, id) => {
    e.stopPropagation();
    const newHistory = history.filter(h => h.id !== id);
    setHistory(newHistory);
    if (activeId === id) setActiveId('new');
    showToast("Chat deleted");
  };

  const handleCopy = (text) => {
    const cleanText = text
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/<[^>]*>?/gm, '')
      .trim();
    navigator.clipboard.writeText(cleanText);
    showToast("Copied to clipboard!");
  };

  const handleStarMsg = (chatId, msgId) => {
    setHistory(prev => prev.map(chat => {
      if (chat.id === chatId) {
        return {
          ...chat,
          messages: chat.messages.map(msg => msg.id === msgId ? { ...msg, isStarred: !msg.isStarred } : msg)
        };
      }
      return chat;
    }));
  };

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!doubt || !subject) {
      showToast("Please enter a doubt and select a subject.");
      return;
    }

    setLoading(true);
    scrollToEnd();

    let finalResult;

    if (useAI && apiKey) {
      try {
        const prompt = `You are an expert tutor. The user has a doubt about ${subject}. ${subject === 'programming' ? `Preferred programming language: ${programmingLang}. Output all code examples natively in ${programmingLang}.` : ''} 
        User's Doubt: "${doubt}"
        
        Respond STRICTLY with a valid JSON object matching this exact structure, with no markdown code blocks around it:
        {
          "steps": "<div style='font-size: 1.05rem; line-height: 1.6;'><h5 style='color: var(--primary-color);'><i class='ri-book-open-line'></i> Brief Explanation</h5><p>Provide a detailed brief explanation here using previous knowledge and facts.</p> <h5 style='color: var(--text-primary); margin-top: 1.5rem;'>Steps</h5><ol><li>Step by step HTML explanation...</li></ol></div>",
          "example": "<p>A real life analogy or code snippet in HTML.</p>",
          "quiz": [
            { "question": "Q1", "options": ["A", "B", "C"], "correctIndex": 0, "explanation": "Why A is correct" },
            { "question": "Q2", "options": ["A", "B", "C"], "correctIndex": 1, "explanation": "Why B is correct" },
            { "question": "Q3", "options": ["A", "B", "C"], "correctIndex": 2, "explanation": "Why C is correct" },
            { "question": "Q4", "options": ["A", "B", "C"], "correctIndex": 0, "explanation": "Why A is correct" }
          ]
        }`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (!res.ok) throw new Error("API Key Invalid or Exhausted.");
        const data = await res.json();
        let jsonStr = data.candidates[0].content.parts[0].text.trim();
        if (jsonStr.startsWith('\`\`\`json')) {
          jsonStr = jsonStr.slice(7, -3).trim();
        } else if (jsonStr.startsWith('\`\`\`')) {
          jsonStr = jsonStr.slice(3, -3).trim();
        }

        finalResult = JSON.parse(jsonStr);
      } catch (err) {
        console.error(err);
        showToast("AI API Error. Falling back to offline mock mode.");
        finalResult = getMockData(subject, doubt, programmingLang);
      }
    } else {
      let finalMock = getMockData(subject, doubt, programmingLang);

      // Enhance mock with Real Website Knowledge!
      const wikiContent = await fetchWikipedia(doubt);
      if (wikiContent) {
        const wikiHtml = `
          <div style="background: rgba(255,255,255,0.05); padding: 1.2rem; border-left: 4px solid var(--primary-color); border-radius: 0 8px 8px 0; margin-top: 1rem; margin-bottom: 1.5rem;">
            <p style="margin-bottom: 0.5rem; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-secondary);">
              <i class="ri-book-open-line" style="margin-right: 5px;"></i> Brief Explanation (from <a href="${wikiContent.url}" target="_blank" style="color: var(--primary-color); text-decoration: none;">${wikiContent.source}</a>)
            </p>
            <p style="font-style: italic; line-height: 1.6; color: var(--text-primary);">"${wikiContent.text}"</p>
          </div>
        `;
        finalMock.steps = wikiHtml + finalMock.steps;
      }

      finalResult = finalMock;
    }

    setLoading(false);
    const newMsg = {
      id: Date.now(),
      doubt,
      subject,
      result: finalResult
    };

    if (activeId === 'new') {
      const newChat = {
        id: Date.now().toString(),
        title: doubt,
        messages: [newMsg],
        timestamp: new Date().toISOString()
      };
      setHistory([newChat, ...history]);
      setActiveId(newChat.id);
    } else {
      setHistory(prev => prev.map(chat =>
        chat.id === activeId
          ? { ...chat, messages: [...chat.messages, newMsg] }
          : chat
      ));
    }
    setDoubt('');
    scrollToEnd();
  };

  const handleQuizSelect = (chatId, msgId, questionIndex, selectedOptionIndex, correctIndex) => {
    const isCorrect = selectedOptionIndex === correctIndex;
    if (isCorrect) showToast("Correct! Great job. 🎉");
    else showToast("Oops! Incorrect. Review the steps above. 📚");

    setHistory(prev => prev.map(chat => {
      if (chat.id === chatId) {
        return {
          ...chat,
          messages: chat.messages.map(msg => {
            if (msg.id === msgId) {
              const newQuiz = [...msg.result.quiz];
              if (!newQuiz[questionIndex].answered) {
                newQuiz[questionIndex].answered = true;
                newQuiz[questionIndex].selectedIndex = selectedOptionIndex;
              }
              return { ...msg, result: { ...msg.result, quiz: newQuiz } };
            }
            return msg;
          })
        };
      }
      return chat;
    }));
  };

  const activeItem = history.find(h => h.id === activeId);

  return (
    <div className="app-container">
      {isSidebarOpen && <div className="sidebar-overlay" onClick={toggleSidebar}></div>}

      {/* Sidebar */}
      <aside className={`sidebar glass-panel ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-small">
            <i className="ri-history-line"></i>
            <h2>History</h2>
          </div>
          <div style={{ display: 'flex', gap: '0.2rem' }}>
            <button className="icon-btn" onClick={() => setShowStarredOnly(!showStarredOnly)} title={showStarredOnly ? "Show All History" : "Show Starred Only"}>
              <i className={showStarredOnly ? "ri-star-fill" : "ri-star-line"} style={{ color: showStarredOnly ? '#ffd700' : 'var(--text-primary)' }}></i>
            </button>
            <button className="icon-btn" onClick={toggleSidebar}><i className="ri-close-line"></i></button>
          </div>
        </div>

        <button className="new-doubt-btn" onClick={() => { setActiveId('new'); setIsSidebarOpen(false); }}>
          <i className="ri-add-line"></i> New Doubt
        </button>

        <div className="history-list">
          {history.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', marginTop: '1rem' }}>No history yet.</p>}
          {showStarredOnly && history.filter(chat => chat.isStarred || chat.messages.some(m => m.isStarred)).length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', marginTop: '1rem' }}>No starred doubts yet.</p>}
          {history.filter(item => showStarredOnly ? (item.isStarred || item.messages.some(m => m.isStarred)) : true).map(item => (
            <div
              key={item.id}
              className={`history-item ${activeId === item.id ? 'active' : ''}`}
              onClick={() => { setActiveId(item.id); setIsSidebarOpen(false); }}
              title={item.title}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</span>
              <button
                onClick={(e) => handleDeleteChat(e, item.id)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
                title="Delete Chat"
                className="icon-btn"
              >
                <i className="ri-delete-bin-line"></i>
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="dashboard-main glass-panel" style={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

        {/* Header */}
        <header style={{ padding: '1.25rem 2rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', overflow: 'hidden' }}>
            <button className="icon-btn" onClick={toggleSidebar} title="View History"><i className="ri-menu-line"></i></button>
            <div className="logo-small" style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
              <i className="ri-brain-line"></i>
              <h2 style={{ fontSize: '1.1rem', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {activeItem ? activeItem.title : "New Discussion"}
              </h2>
            </div>
          </div>
          <div
            className="user-profile"
            style={{ position: 'relative', cursor: 'pointer', padding: '0.4rem 0.8rem', background: 'var(--glass-bg)', borderRadius: '30px', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            onClick={() => setIsProfileOpen(!isProfileOpen)}
          >
            <div className="avatar" style={{ margin: 0, width: '28px', height: '28px', background: 'var(--primary-color)' }}><i className="ri-user-smile-fill"></i></div>
            <i className="ri-arrow-down-s-line" style={{ color: 'var(--text-secondary)' }}></i>

            {isProfileOpen && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', background: 'var(--bg-color)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '0.5rem', zIndex: 100, minWidth: '220px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', cursor: 'default' }} onClick={(e) => e.stopPropagation()}>
                <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--glass-border)', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Logged in as <br /><strong style={{ color: 'var(--text-primary)' }}>@{user.username}</strong>
                </div>

                <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--glass-border)', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary-color)' }}>Real AI Mode</span>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input type="checkbox" checked={useAI} onChange={(e) => {
                        if (e.target.checked && !apiKey) {
                          showToast("Please enter your Gemini API Key first.");
                          return;
                        }
                        setUseAI(e.target.checked);
                      }} style={{ cursor: 'pointer' }} />
                    </label>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', lineHeight: '1.4' }}>
                    Unlock real dynamic answers from Google Gemini AI. <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)' }}>Get Free Key</a>
                  </div>
                  <input
                    type="password"
                    placeholder="Enter Gemini Key..."
                    value={apiKey}
                    onChange={(e) => saveApiKey(e.target.value)}
                    style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                  />
                </div>

                <button onClick={onSignOut} style={{ background: 'transparent', border: 'none', color: '#ff6b6b', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '0.5rem 1rem', width: '100%', borderRadius: '6px', transition: '0.2s' }}>
                  <i className="ri-logout-box-r-line" style={{ pointerEvents: 'none' }}></i> Sign Out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* FEED / CHAT LOG */}
        <div className="chat-feed" style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
          {activeId === 'new' ? (
            <div style={{ textAlign: 'center', marginTop: '10vh' }}>
              <div className="logo-icon" style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.8 }}>
                <i className="ri-brain-line"></i>
              </div>
              <h3 style={{ color: 'var(--text-primary)', fontWeight: '500' }}>What do you want to learn today?</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Ask your doubt below to start a continuous conversation.</p>
            </div>
          ) : (
            activeItem?.messages.map((msg, idx) => (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '3rem' }}>

                {/* User Message Bubble */}
                <div style={{ position: 'relative', alignSelf: 'flex-end', maxWidth: '85%', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <button
                      onClick={() => handleCopy(msg.doubt)}
                      className="icon-btn"
                      style={{ opacity: 0.5, border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px' }}
                      title="Copy Prompt"
                    >
                      <i className="ri-file-copy-line"></i>
                    </button>
                    <button
                      onClick={() => handleStarMsg(activeItem.id, msg.id)}
                      className="icon-btn"
                      style={{ opacity: msg.isStarred ? 1 : 0.5, border: 'none', background: 'transparent', cursor: 'pointer', color: msg.isStarred ? '#ffd700' : 'inherit', padding: '4px', transition: '0.2s' }}
                      title={msg.isStarred ? "Unstar Doubt" : "Star Doubt"}
                    >
                      <i className={msg.isStarred ? "ri-star-fill" : "ri-star-line"}></i>
                    </button>
                  </div>
                  <div style={{
                    background: 'rgba(88,166,255,0.15)',
                    border: '1px solid rgba(88,166,255,0.3)',
                    padding: '1rem 1.5rem',
                    borderRadius: '20px 20px 0 20px',
                  }}>
                    <p style={{ margin: 0, fontSize: '1rem', lineHeight: '1.5' }}>{msg.doubt}</p>
                  </div>
                </div>

                {/* AI Response Card */}
                <div className="result-card glass-panel" style={{ alignSelf: 'flex-start', padding: '1.5rem', borderRadius: '0 20px 20px 20px', width: '100%' }}>
                  <div className="result-header" style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div className="badge">{msg.subject.charAt(0).toUpperCase() + msg.subject.slice(1)}</div>
                      <h4 style={{ margin: 0 }}>Explanation</h4>
                    </div>
                    <button
                      onClick={() => handleCopy(`${msg.result.steps}\n\n${msg.result.example}`)}
                      className="icon-btn"
                      title="Copy Explanation"
                      style={{ background: 'var(--glass-bg)', fontSize: '0.9rem', padding: '0.4rem 0.8rem', borderRadius: '20px', display: 'flex', gap: '0.4rem', border: '1px solid var(--glass-border)' }}
                    >
                      <i className="ri-file-copy-line"></i>
                      <span className="hide-on-mobile">Copy</span>
                    </button>
                  </div>

                  <div className="answer-content">
                    <div className="answer-block">
                      <h5><i className="ri-list-check"></i> Step-by-Step Breakdown</h5>
                      <div className="text-content" dangerouslySetInnerHTML={{ __html: msg.result.steps }} />
                    </div>

                    <div className="answer-block">
                      <h5><i className="ri-lightbulb-flash-line"></i> Explanation Example</h5>
                      <div className="text-content" dangerouslySetInnerHTML={{ __html: msg.result.example }} />
                    </div>

                    <div className="answer-block">
                      <h5><i className="ri-questionnaire-line"></i> Check your understanding!</h5>
                      <div className="quiz-container">
                        {msg.result.quiz.map((q, qIndex) => (
                          <div key={qIndex} className="quiz-item">
                            <div className="quiz-question">{qIndex + 1}. {q.question}</div>
                            <div className="quiz-options">
                              {q.options.map((opt, oIndex) => {
                                let optionClass = "quiz-option";
                                if (q.answered) {
                                  if (oIndex === q.correctIndex) optionClass += " correct";
                                  else if (oIndex === q.selectedIndex) optionClass += " wrong";
                                }
                                return (
                                  <div
                                    key={oIndex}
                                    className={optionClass}
                                    onClick={() => !q.answered && handleQuizSelect(activeItem.id, msg.id, qIndex, oIndex, q.correctIndex)}
                                  >
                                    <span>{String.fromCharCode(65 + oIndex)}.</span>
                                    <span>{opt}</span>
                                  </div>
                                );
                              })}
                            </div>
                            {q.answered && q.selectedIndex !== q.correctIndex && (
                              <div style={{ marginTop: '0.8rem', padding: '0.8rem', background: 'rgba(255, 107, 107, 0.08)', borderLeft: '3px solid #ff6b6b', borderRadius: '4px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                <i className="ri-lightbulb-flash-line" style={{ color: '#ff6b6b', marginRight: '6px' }}></i>
                                <strong>Explanation:</strong> The correct answer is <span style={{ color: 'var(--text-primary)' }}>{q.options[q.correctIndex]}</span>. {q.explanation || "Review the step-by-step breakdown above to understand why!"}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            ))
          )}

          {loading && (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              <div className="loader" style={{ margin: 0, width: '24px', height: '24px', borderWidth: '2px' }}></div>
              <span>AI is thinking...</span>
            </div>
          )}
          <div ref={chatEndRef} style={{ height: '1px' }} />
        </div>

        {/* PINNED INPUT BAR */}
        <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid var(--glass-border)', background: 'var(--glass-bg)' }}>
          <form onSubmit={handleAsk}>
            <div className="search-bar-wrapper" style={{ maxWidth: '100%', background: 'rgba(0,0,0,0.4)', flexWrap: 'wrap' }}>

              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                style={{ width: '120px', background: 'transparent', border: 'none', paddingLeft: '1rem', color: 'var(--text-secondary)' }}
              >
                <option value="" disabled>Subject...</option>
                <option value="programming">💻 Coding</option>
                <option value="mathematics">📐 Math</option>
                <option value="science">🔬 Science</option>
                <option value="physics">⚙️ Physics</option>
                <option value="chemistry">🧪 Chemistry</option>
              </select>

              {subject === 'programming' && (
                <>
                  <div style={{ width: '1px', background: 'var(--glass-border)', height: '2rem', margin: '0 0.5rem' }}></div>
                  <select
                    value={programmingLang}
                    onChange={(e) => setProgrammingLang(e.target.value)}
                    style={{ width: '90px', background: 'transparent', border: 'none', color: 'var(--primary-color)', fontSize: '0.9rem' }}
                  >
                    <option value="javascript">JS</option>
                    <option value="c">C</option>
                    <option value="c++">C++</option>
                    <option value="java">Java</option>
                    <option value="python">Python</option>
                  </select>
                </>
              )}

              <div style={{ width: '1px', background: 'var(--glass-border)', height: '2rem', margin: '0 0.5rem' }}></div>

              <input
                type="text"
                className="search-input"
                placeholder="Ask your follow-up doubt here..."
                value={doubt}
                onChange={(e) => setDoubt(e.target.value)}
                required
              />

              <div className="action-buttons">
                <button type="button" className={`icon-btn ${isRecording ? 'recording' : ''}`} onClick={startListening} title={isRecording ? "Stop Listening" : "Voice Input"}>
                  <i className="ri-mic-line"></i>
                </button>
                <label className="icon-btn" style={{ cursor: 'pointer' }}>
                  <i className="ri-image-add-line"></i>
                  <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={(e) => {
                    if (e.target.files.length > 0) setFileName(e.target.files[0].name);
                  }} />
                </label>
                <button type="submit" className="btn-primary ask-btn" style={{ whiteSpace: 'nowrap', display: 'flex', gap: '8px', padding: '0.6rem 1rem' }}>
                  <span className="hide-on-mobile">Send</span>
                  <i className="ri-send-plane-fill"></i>
                </button>
              </div>
            </div>

            {fileName && (
              <div className="upload-preview" style={{ marginTop: '0.5rem' }}>
                <span>📷 {fileName}</span>
                <i className="ri-close-line remove-file" onClick={() => { setFileName(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}></i>
              </div>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}

// Mock Data Generator (Dynamic based on doubt text)
function getMockData(subject, doubt, selectedLang) {
  const lowerDoubt = String(doubt).toLowerCase();
  const safeDoubt = escapeHtml(doubt);

  // Fallback map languages
  let lang = selectedLang || 'javascript';
  const langDisplay = lang === 'c++' ? 'C++' : lang === 'js' || lang === 'javascript' ? 'JavaScript' : lang.charAt(0).toUpperCase() + lang.slice(1);

  // Detailed Code Snippet Map
  const cLangMap = {
    loop: {
      python: `<span style="color: var(--primary-color)">for</span> i <span style="color: var(--primary-color)">in</span> <span style="color: #d2a8ff">range</span>(5):<br/>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #d2a8ff">print</span>(f"Count: {i}")`,
      java: `<span style="color: var(--primary-color)">for</span> (<span style="color: var(--primary-color)">int</span> i = 0; i &lt; 5; i++) {<br/>&nbsp;&nbsp;&nbsp;&nbsp;System.out.<span style="color: #d2a8ff">println</span>("Count: " + i);<br/>}`,
      c: `<span style="color: var(--primary-color)">for</span> (<span style="color: var(--primary-color)">int</span> i = 0; i &lt; 5; i++) {<br/>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #d2a8ff">printf</span>("Count: %d\\n", i);<br/>}`,
      'c++': `<span style="color: var(--primary-color)">for</span> (<span style="color: var(--primary-color)">int</span> i = 0; i &lt; 5; i++) {<br/>&nbsp;&nbsp;&nbsp;&nbsp;std::<span style="color: #d2a8ff">cout</span> &lt;&lt; "Count: " &lt;&lt; i &lt;&lt; std::<span style="color: #d2a8ff">endl</span>;<br/>}`,
      javascript: `<span style="color: var(--primary-color)">for</span> (<span style="color: var(--primary-color)">let</span> i = 0; i &lt; 5; i++) {<br/>&nbsp;&nbsp;&nbsp;&nbsp;console.<span style="color: #d2a8ff">log</span>("Count: ", i);<br/>}`
    },
    array: {
      python: `fruits = ["apple", "banana"]<br/><span style="color: var(--primary-color)">for</span> f <span style="color: var(--primary-color)">in</span> fruits:<br/>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #d2a8ff">print</span>(f)`,
      java: `<span style="color: var(--primary-color)">String</span>[] fruits = {"apple", "banana"};<br/><span style="color: var(--primary-color)">for</span> (<span style="color: var(--primary-color)">String</span> f : fruits) {<br/>&nbsp;&nbsp;&nbsp;&nbsp;System.out.<span style="color: #d2a8ff">println</span>(f);<br/>}`,
      c: `<span style="color: var(--primary-color)">char</span> *fruits[] = {"apple", "banana"};<br/><span style="color: var(--primary-color)">for</span> (<span style="color: var(--primary-color)">int</span> i=0; i&lt;2; i++) {<br/>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #d2a8ff">printf</span>("%s\\n", fruits[i]);<br/>}`,
      'c++': `<span style="color: var(--primary-color)">std::vector&lt;std::string&gt;</span> fruits = {"apple", "banana"};<br/><span style="color: var(--primary-color)">for</span> (<span style="color: var(--primary-color)">auto</span> f : fruits) {<br/>&nbsp;&nbsp;&nbsp;&nbsp;std::<span style="color: #d2a8ff">cout</span> &lt;&lt; f &lt;&lt; std::<span style="color: #d2a8ff">endl</span>;<br/>}`,
      javascript: `<span style="color: var(--primary-color)">const</span> fruits = ["apple", "banana"];<br/>fruits.<span style="color: #d2a8ff">forEach</span>(f =&gt; console.<span style="color: #d2a8ff">log</span>(f));`
    },
    func: {
      python: `<span style="color: var(--primary-color)">def</span> <span style="color: #d2a8ff">greet</span>(name):<br/>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: var(--primary-color)">return</span> f"Hello {name}!"`,
      java: `<span style="color: var(--primary-color)">public static String</span> <span style="color: #d2a8ff">greet</span>(<span style="color: var(--primary-color)">String</span> name) {<br/>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: var(--primary-color)">return</span> "Hello " + name;<br/>}`,
      c: `<span style="color: var(--primary-color)">void</span> <span style="color: #d2a8ff">greet</span>(<span style="color: var(--primary-color)">char</span>* name) {<br/>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #d2a8ff">printf</span>("Hello %s", name);<br/>}`,
      'c++': `<span style="color: var(--primary-color)">std::string</span> <span style="color: #d2a8ff">greet</span>(<span style="color: var(--primary-color)">std::string</span> name) {<br/>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: var(--primary-color)">return</span> "Hello " + name;<br/>}`,
      javascript: `<span style="color: var(--primary-color)">function</span> <span style="color: #d2a8ff">greet</span>(name) {<br/>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: var(--primary-color)">return</span> "Hello " + name;<br/>}`
    },
    add: {
      python: `a = <span style="color: #79c0ff">5</span><br/>b = <span style="color: #79c0ff">10</span><br/>sum = a + b<br/><span style="color: #d2a8ff">print</span>(f"Sum is: {sum}")`,
      java: `<span style="color: var(--primary-color)">int</span> a = <span style="color: #79c0ff">5</span>;<br/><span style="color: var(--primary-color)">int</span> b = <span style="color: #79c0ff">10</span>;<br/><span style="color: var(--primary-color)">int</span> sum = a + b;<br/>System.out.<span style="color: #d2a8ff">println</span>("Sum is: " + sum);`,
      c: `<span style="color: var(--primary-color)">int</span> a = <span style="color: #79c0ff">5</span>, b = <span style="color: #79c0ff">10</span>;<br/><span style="color: var(--primary-color)">int</span> sum = a + b;<br/><span style="color: #d2a8ff">printf</span>("Sum is: %d\\n", sum);`,
      'c++': `<span style="color: var(--primary-color)">int</span> a = <span style="color: #79c0ff">5</span>, b = <span style="color: #79c0ff">10</span>;<br/><span style="color: var(--primary-color)">int</span> sum = a + b;<br/>std::<span style="color: #d2a8ff">cout</span> &lt;&lt; "Sum is: " &lt;&lt; sum &lt;&lt; std::<span style="color: #d2a8ff">endl</span>;`,
      javascript: `<span style="color: var(--primary-color)">const</span> a = <span style="color: #79c0ff">5</span>;<br/><span style="color: var(--primary-color)">const</span> b = <span style="color: #79c0ff">10</span>;<br/><span style="color: var(--primary-color)">const</span> sum = a + b;<br/>console.<span style="color: #d2a8ff">log</span>("Sum is: ", sum);`
    },
    swap: {
      python: `a = <span style="color: #79c0ff">5</span><br/>b = <span style="color: #79c0ff">10</span><br/><span style="color: var(--text-secondary)"># Swap logic</span><br/>a, b = b, a<br/><span style="color: #d2a8ff">print</span>(a, b)`,
      java: `<span style="color: var(--primary-color)">int</span> a = <span style="color: #79c0ff">5</span>;<br/><span style="color: var(--primary-color)">int</span> b = <span style="color: #79c0ff">10</span>;<br/><span style="color: var(--text-secondary)">// Swap logic</span><br/><span style="color: var(--primary-color)">int</span> temp = a;<br/>a = b;<br/>b = temp;`,
      c: `<span style="color: var(--primary-color)">int</span> a = <span style="color: #79c0ff">5</span>, b = <span style="color: #79c0ff">10</span>;<br/><span style="color: var(--text-secondary)">// Swap logic</span><br/><span style="color: var(--primary-color)">int</span> temp = a;<br/>a = b;<br/>b = temp;`,
      'c++': `<span style="color: var(--primary-color)">int</span> a = <span style="color: #79c0ff">5</span>, b = <span style="color: #79c0ff">10</span>;<br/><span style="color: var(--text-secondary)">// Uses STL algorithm</span><br/>std::<span style="color: #d2a8ff">swap</span>(a, b);`,
      javascript: `<span style="color: var(--primary-color)">let</span> a = <span style="color: #79c0ff">5</span>, b = <span style="color: #79c0ff">10</span>;<br/><span style="color: var(--text-secondary)">// Array destructuring swap</span><br/>[a, b] = [b, a];`
    },
    reverse: {
      python: `s = "hello"<br/><span style="color: var(--text-secondary)"># Slicing trick</span><br/><span style="color: #d2a8ff">print</span>(s[::-1])`,
      java: `<span style="color: var(--primary-color)">String</span> s = "hello";<br/><span style="color: var(--primary-color)">String</span> rev = <span style="color: var(--primary-color)">new</span> StringBuilder(s).reverse().toString();`,
      c: `<span style="color: var(--primary-color)">char</span> s[] = "hello";<br/><span style="color: var(--text-secondary)">// Requires iteration in C</span><br/>strrev(s);`,
      'c++': `<span style="color: var(--primary-color)">std::string</span> s = "hello";<br/>std::<span style="color: #d2a8ff">reverse</span>(s.begin(), s.end());`,
      javascript: `<span style="color: var(--primary-color)">const</span> s = "hello";<br/><span style="color: var(--primary-color)">const</span> rev = s.<span style="color: #d2a8ff">split</span>('').<span style="color: #d2a8ff">reverse</span>().<span style="color: #d2a8ff">join</span>('');`
    },
    fallbackStruct: {
      python: `<span style="color: var(--text-secondary)"># Step 1: Initialize inputs</span><br/>inputs = []<br/><span style="color: var(--text-secondary)"># Step 2: Custom Algorithm Logic</span><br/><span style="color: var(--primary-color)">for</span> x <span style="color: var(--primary-color)">in</span> inputs:<br/>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: var(--primary-color)">pass</span><br/><span style="color: var(--text-secondary)"># Step 3: Print result</span><br/><span style="color: #d2a8ff">print</span>("Done")`,
      java: `<span style="color: var(--text-secondary)">// Step 1: Initialize inputs</span><br/><span style="color: var(--primary-color)">int</span>[] inputs = {};<br/><span style="color: var(--text-secondary)">// Step 2: Custom Algorithm Logic</span><br/><span style="color: var(--primary-color)">for</span> (<span style="color: var(--primary-color)">int</span> x : inputs) {<br/>}<br/><span style="color: var(--text-secondary)">// Step 3: Print result</span><br/>System.out.<span style="color: #d2a8ff">println</span>("Done");`,
      c: `<span style="color: var(--text-secondary)">// Step 1: Define types</span><br/><span style="color: var(--primary-color)">int</span> arr[] = {0};<br/><span style="color: var(--text-secondary)">// Step 2: Execute memory operations</span><br/><span style="color: var(--primary-color)">for</span>(<span style="color: var(--primary-color)">int</span> i=0; i&lt;1; i++) {<br/>}<br/><span style="color: var(--text-secondary)">// Step 3: Print output</span><br/><span style="color: #d2a8ff">printf</span>("Done\\n");`,
      'c++': `<span style="color: var(--text-secondary)">// Step 1: Use STL containers</span><br/><span style="color: var(--primary-color)">std::vector&lt;int&gt;</span> vec;<br/><span style="color: var(--text-secondary)">// Step 2: Apply algorithms</span><br/><span style="color: var(--primary-color)">for</span>(<span style="color: var(--primary-color)">auto</span>& x : vec) {<br/>}<br/><span style="color: var(--text-secondary)">// Step 3: Output</span><br/>std::<span style="color: #d2a8ff">cout</span> &lt;&lt; "Done\\n";`,
      javascript: `<span style="color: var(--text-secondary)">// Step 1: Initialize constants</span><br/><span style="color: var(--primary-color)">const</span> items = [];<br/><span style="color: var(--text-secondary)">// Step 2: Perform logic mapping</span><br/>items.<span style="color: #d2a8ff">map</span>(item =&gt; {<br/>});<br/><span style="color: var(--text-secondary)">// Step 3: Return result</span><br/>console.<span style="color: #d2a8ff">log</span>("Done");`
    }
  };

  // Dynamic programming logic selector
  let codeSnippet = '';
  let progExample = '';
  let progQuiz = [];

  if (lowerDoubt.includes('loop') || lowerDoubt.includes('for') || lowerDoubt.includes('while')) {
    codeSnippet = cLangMap.loop[lang] || cLangMap.loop.javascript;
    progExample = `Thinking about loops is like looking at a music playlist on repeat. The code block above is a track that repeats exactly 5 times until the song ends.`;
    progQuiz = [
      { question: `What does the loop do in the ${langDisplay} code above?`, options: ["Runs forever", "Runs 5 times", "Causes an error"], correctIndex: 1 },
      { question: `In programming, why do we use loops?`, options: ["To repeat tasks efficiently", "To declare variables", "To slow down the program"], correctIndex: 0 },
      { question: `What happens if a loop has no exit condition?`, options: ["It runs once", "It becomes an infinite loop", "It throws a syntax error"], correctIndex: 1 },
      { question: `Which type of loop requires you to know exactly how many times you will iterate upfront in most cases?`, options: ["While loop", "For loop", "Do-While loop"], correctIndex: 1 },
      { question: `Can inside variables be accessed outside the loop?`, options: ["Yes, always", "No, it depends on variable scope", "Yes, only in java"], correctIndex: 1 }
    ];
  } else if (lowerDoubt.includes('array') || lowerDoubt.includes('list')) {
    codeSnippet = cLangMap.array[lang] || cLangMap.array.javascript;
    progExample = `An array (or list) is like a row of lockers in a hallway. You can put a different item in each locker (index) and retrieve it later!`;
    progQuiz = [
      { question: `What is the first index of an array in most languages?`, options: ["1", "0", "-1"], correctIndex: 1 },
      { question: `What are arrays primarily used for?`, options: ["Storing single values", "Storing collections of data", "Defining methods"], correctIndex: 1 },
      { question: `How do you access the second element of an array 'arr'?`, options: ["arr[2]", "arr[0]", "arr[1]"], correctIndex: 2 },
      { question: `What happens if you try to access an index larger than the array size?`, options: ["It resizes automatically", "It returns null or throws an OutOfBounds error", "It loops back to 0"], correctIndex: 1 }
    ];
  } else if (lowerDoubt.includes('function') || lowerDoubt.includes('method')) {
    codeSnippet = cLangMap.func[lang] || cLangMap.func.javascript;
    progExample = `A function is like a pizza oven. It takes ingredients (arguments), bakes them (processes logic), and hands you a pizza (return value).`;
    progQuiz = [
      { question: `What does a function use to give back a result?`, options: ["Console log", "Return statement", "Variables"], correctIndex: 1 },
      { question: `What is an argument?`, options: ["Input data passed to a function", "A program error", "A loop condition"], correctIndex: 0 },
      { question: `Why do we use functions?`, options: ["To make code messy", "To isolate, reuse, and organize logic", "To declare variables out of scope"], correctIndex: 1 },
      { question: `What do you call the act of executing a function?`, options: ["Calling or Invoking", "Looping", "Compiling"], correctIndex: 0 },
      { question: `Can a function execute without arguments?`, options: ["No", "Yes, if defined to accept no parameters", "Only in C++"], correctIndex: 1 }
    ];
  } else if (lowerDoubt.includes('add') || lowerDoubt.includes('sum') || lowerDoubt.includes('plus')) {
    codeSnippet = cLangMap.add[lang] || cLangMap.add.javascript;
    progExample = `To perform mathematical logic, computers use basic arithmetic operators (+) to sum memory allocations and save the result into a new allocation (like 'sum').`;
    progQuiz = [
      { question: `Which operator is used to add two numbers?`, options: ["-", "+", "*"], correctIndex: 1 },
      { question: `How does memory handle a sum operation?`, options: ["Overrides the first variable automatically", "Takes two references, performs ALU logic, issues new value to output reference", "Deletes data"], correctIndex: 1 },
      { question: `Is 5 + 5 the same as "5" + "5" in ${langDisplay}?`, options: ["Yes", "Usually no, the second is string concatenation", "Depends on computer speed"], correctIndex: 1 },
      { question: `How many values can you add at once?`, options: ["Two logic gates at a time limit operations, though expressions compound", "Only One", "Infinite instantaneously"], correctIndex: 0 }
    ];
  } else if (lowerDoubt.includes('swap') || lowerDoubt.includes('exchange')) {
    codeSnippet = cLangMap.swap[lang] || cLangMap.swap.javascript;
    progExample = `Swapping variables is like having a glass of juice and a glass of milk. To swap the contents, you need a third empty 'temporary' glass, unless the language has built-in destructuring!`;
    progQuiz = [
      { question: `Why do old languages require a 'temp' variable to swap?`, options: ["To make code longer", "You cannot overwrite a variable without losing its original value first", "Memory is infinite"], correctIndex: 1 },
      { question: `What happens if you just do a = b; b = a; without temp?`, options: ["It works", "Both variables end up with 'b's value", "Syntax error"], correctIndex: 1 },
      { question: `Does ${langDisplay} have a built-in way to swap without temp?`, options: ["Depends tightly on the language version (like Python and JS destructuring)", "No, never", "Yes, all do"], correctIndex: 0 },
      { question: `Can you swap pointers instead of values?`, options: ["Yes, in languages with pointers like C++", "No, impossible", "Only in JavaScript"], correctIndex: 0 }
    ];
  } else if (lowerDoubt.includes('reverse') || lowerDoubt.includes('backward')) {
    codeSnippet = cLangMap.reverse[lang] || cLangMap.reverse.javascript;
    progExample = `Reversing data requires the computer logic to iterate over indexes perfectly backwards. Some languages have highly optimized helper methods instead of manually looping.`;
    progQuiz = [
      { question: `What is the risk of manual looping for reversing?`, options: ["OutOfBounds or Off-By-One errors", "Hard disk failure", "Network lag"], correctIndex: 0 },
      { question: `Are strings usually mutable (changeable in place) during reversal?`, options: ["Yes, always", "In many environments (Java/JS/Python), strings are Immutable and require returning a new copy", "Only on mobile"], correctIndex: 1 },
      { question: `Is string reversal visually the same as array reversal?`, options: ["Yes", "Usually array reversal modifies in-place natively faster", "No"], correctIndex: 1 },
      { question: `What does 'index out of bounds' error mean during reversal logic?`, options: ["You looped too far past 0 or array length", "The computer is too slow", "Your password is wrong"], correctIndex: 0 }
    ];
  } else {
    codeSnippet = cLangMap.fallbackStruct[lang] || cLangMap.fallbackStruct.javascript;

    progExample = `Because algorithm logic is highly specific to the problem "<i>${safeDoubt}</i>", computer scientists use pseudo-code structures (like the template above) first to model logic before implementing variables.`;
    progQuiz = [
      { question: `What is the foundational concept behind solving programming logic doubts?`, options: ["Guessing", "Breaking problems into logical algorithmic steps and defining expected inputs/outputs", "Copying code blindly"], correctIndex: 1 },
      { question: `Why is syntax logic important in ${langDisplay}?`, options: ["Computers are strict algorithmic engines that require exact formatting to evaluate logic", "It looks nice", "It makes it run slower"], correctIndex: 0 },
      { question: `What should you do first when logical execution fails?`, options: ["Give up", "Trace variables systematically step by step (Debugging)", "Delete everything"], correctIndex: 1 },
      { question: `What is 'Pseudo-code'?`, options: ["Fake bad code", "Human-readable structural templates defining algorithm logic", "A compiler virus"], correctIndex: 1 }
    ];
  }

  // Dynamic Math Logic
  let mathExample = "";
  let mathQuiz = [];
  if (lowerDoubt.includes('fraction') || lowerDoubt.includes('divide') || lowerDoubt.includes('/')) {
    mathExample = "If you have a pizza and cut it into 8 slices, taking 4 slices means you have 4/8, which is exactly half (1/2) the pizza!";
    mathQuiz = [
      { question: "What is 4/8 simplified?", options: ["1/4", "1/2", "2"], correctIndex: 1 },
      { question: "If you have 1/2 of a pie and get another 1/4, how much pie do you have?", options: ["3/4", "2/6", "1 pie"], correctIndex: 0 },
      { question: "Which is bigger? 1/3 or 1/4?", options: ["1/3, because dividing by smaller number yields bigger parts", "1/4", "They are equal"], correctIndex: 0 },
      { question: "What is the top number of a fraction called?", options: ["Denominator", "Numerator", "Quotient"], correctIndex: 1 }
    ];
  } else if (lowerDoubt.includes('algebra') || lowerDoubt.includes('equation') || lowerDoubt.includes('x')) {
    mathExample = "Solving for X is like decoding a secret message. You isolate the mystery letter 'X' on one side of a seesaw so you can see exactly what weight is on the other side.";
    mathQuiz = [
      { question: "If x + 3 = 10, what is x?", options: ["7", "13", "30"], correctIndex: 0 },
      { question: "What happens if you do something to one side of the equation?", options: ["Nothing", "You must do it to the other side to keep it balanced", "The equation breaks forever"], correctIndex: 1 },
      { question: "If 2X = 8, what is X?", options: ["10", "6", "4"], correctIndex: 2 },
      { question: "What does 'isolating the variable' mean?", options: ["Putting X alone on one side of the equal sign", "Deleting X from existence", "Multiplying by zero"], correctIndex: 0 }
    ];
  } else {
    mathExample = `To figure out "<i>${safeDoubt}</i>", you just need to relate it to real-world quantities. Math is just a language for describing amounts and changes!`;
    mathQuiz = [
      { question: "Math is basically a way to describe...", options: ["Magic", "Quantities and logic", "Random letters"], correctIndex: 1 },
      { question: "Why do we use symbols in math?", options: ["To confuse people", "As shorthand for concepts and unknown quantities", "Because numbers run out"], correctIndex: 1 },
      { question: "What is solving a math problem fundamentally about?", options: ["Guessing loudly", "Finding logical truths based on given rules", "Using calculators"], correctIndex: 1 },
      { question: "If you get stuck on a math concept, what is the best strategy?", options: ["Relate it to a real-world physical object", "Stare at the book", "Memorize it blindly"], correctIndex: 0 }
    ];
  }

  // Dynamic Science/Physics/Chemistry Logic
  let sciDef = '';
  let sciEx = '';
  let sciQuiz = [];

  if (lowerDoubt.includes('force') || lowerDoubt.includes('newton') || lowerDoubt.includes('gravity')) {
    sciDef = `In physics, a <strong>Force</strong> is an interaction that changes the motion of an object. Gravity is a fundamental force that pulls objects with mass towards each other.`;
    sciEx = `When you drop an apple, gravity pulls it to the Earth. If you push a car, your force causes it to accelerate according to Newton's Second Law <i>(F = ma)</i>.`;
    sciQuiz = [
      { question: "What is Newton's Second Law?", options: ["E = mc^2", "V = IR", "F = ma"], correctIndex: 2 },
      { question: "What does gravity do?", options: ["Pulls objects with mass together", "Pushes objects apart", "Creates light"], correctIndex: 0 },
      { question: "If you double the mass but keep force the same, what happens to acceleration?", options: ["Doubles", "Halves", "Stays the same"], correctIndex: 1 },
      { question: "Which of these is a unit of force?", options: ["Joule", "Watt", "Newton"], correctIndex: 2 }
    ];
  } else if (lowerDoubt.includes('atom') || lowerDoubt.includes('element') || lowerDoubt.includes('molecule')) {
    sciDef = `In chemistry, an <strong>Atom</strong> is the smallest unit of ordinary matter. Atoms combine using chemical bonds to form <strong>Molecules</strong>.`;
    sciEx = `Water is a molecule made of two Hydrogen atoms and one Oxygen atom (H₂O). They share electrons to stay bonded together!`;
    sciQuiz = [
      { question: "What is the center of an atom called?", options: ["Electron cloud", "Nucleus", "Mitochondria"], correctIndex: 1 },
      { question: "What charge does an electron have?", options: ["Positive", "Negative", "Neutral"], correctIndex: 1 },
      { question: "What do atoms form when they chemically bond?", options: ["Elements", "Quarks", "Molecules"], correctIndex: 2 },
      { question: "Which element is essential for organic life?", options: ["Carbon", "Helium", "Gold"], correctIndex: 0 }
    ];
  } else if (lowerDoubt.includes('energy') || lowerDoubt.includes('kinetic') || lowerDoubt.includes('potential')) {
    sciDef = `<strong>Energy</strong> is the quantitative property that must be transferred to a body to perform work. <strong>Kinetic energy</strong> is the energy of motion, while <strong>Potential energy</strong> is stored energy.`;
    sciEx = `A roller coaster at the top of a hill has maximum Potential Energy. As it drops, that energy converts into Kinetic Energy (speed)!`;
    sciQuiz = [
      { question: "What is the Law of Conservation of Energy?", options: ["Energy can be destroyed entirely", "Energy cannot be created or destroyed, only transformed", "Energy naturally decays into nothing"], correctIndex: 1 },
      { question: "What type of energy does a moving car possess?", options: ["Kinetic Energy", "Potential Energy", "Chemical Energy"], correctIndex: 0 },
      { question: "A stretched rubber band is an example of what?", options: ["Kinetic Energy", "Potential Energy", "Thermal Energy"], correctIndex: 1 },
      { question: "What is the standard unit of energy?", options: ["Newton", "Joule", "Pascal"], correctIndex: 1 }
    ];
  } else if (lowerDoubt.includes('reaction') || lowerDoubt.includes('acid') || lowerDoubt.includes('base')) {
    sciDef = `A <strong>Chemical Reaction</strong> is a process that leads to the chemical transformation of one set of chemical substances to another. <strong>Acids</strong> and <strong>Bases</strong> are common reactants that neutralize each other.`;
    sciEx = `Mixing vinegar (an acid) and baking soda (a base) creates a violent reaction that releases carbon dioxide gas—this is how fake volcanos work!`;
    sciQuiz = [
      { question: "What is a pH less than 7 considered?", options: ["Acidic", "Basic", "Neutral"], correctIndex: 0 },
      { question: "What gas is produced when acid mixes with baking soda?", options: ["Oxygen", "Nitrogen", "Carbon Dioxide"], correctIndex: 2 },
      { question: "What is formed when a strong acid neutralizes a strong base?", options: ["Pure Acid", "Salt and Water", "Plasma"], correctIndex: 1 },
      { question: "Which of these speeds up a chemical reaction?", options: ["Catalyst", "Inhibitor", "Water"], correctIndex: 0 }
    ];
  } else if (lowerDoubt.includes('cell') || lowerDoubt.includes('dna') || lowerDoubt.includes('biology')) {
    sciDef = `The <strong>Cell</strong> is the basic structural, functional, and biological unit of all known organisms. <strong>DNA</strong> holds the genetic instructions for the development and function of living things.`;
    sciEx = `Your body contains trillions of cells. Inside almost every cell's nucleus is your DNA, which acts as the blueprint for building you!`;
    sciQuiz = [
      { question: "What is known as the powerhouse of the cell?", options: ["Nucleus", "Ribosome", "Mitochondria"], correctIndex: 2 },
      { question: "What does DNA stand for?", options: ["Deoxyribonucleic Acid", "Dinucleic Acid", "Dynamic Neural Array"], correctIndex: 0 },
      { question: "Which cells carry oxygen in the human body?", options: ["White blood cells", "Red blood cells", "Nerve cells"], correctIndex: 1 },
      { question: "What is the process plants use to convert light into food?", options: ["Respiration", "Digestion", "Photosynthesis"], correctIndex: 2 }
    ];
  } else {
    sciDef = `In ${subject}, understanding <strong>${safeDoubt}</strong> requires defining the core physical or chemical interactions involved.`;
    sciEx = `For example, a scientist studying "${safeDoubt}" would set up controlled experiments, define variables, and observe the specific systemic reactions to find its scientific definition.`;
    sciQuiz = [
      { question: `What is the most important element of exploring ${safeDoubt}?`, options: ["Guessing", "Replicable experiments and observation", "Complex math"], correctIndex: 1 },
      { question: "What is a hypothesis?", options: ["A proven fact", "A verified law", "A proposed explanation made as a starting point for further investigation"], correctIndex: 2 },
      { question: "Why do scientists use the scientific method?", options: ["To ensure results are objective and reproducible", "To make it harder", "Because it is required by law"], correctIndex: 0 },
      { question: "When an experiment fails to prove a hypothesis, what does it mean?", options: ["The scientist failed", "You learned something valuable about how nature doesn't work", "Science is broken"], correctIndex: 1 }
    ];
  }

  const sciResponse = {
    steps: `
      <div style="font-size: 1.05rem; line-height: 1.6;">
        <div style="margin-bottom: 1.5rem; background: rgba(88,166,255,0.05); padding: 1rem; border-radius: 8px;">
           <h5 style="margin-top:0; margin-bottom: 0.5rem; color: var(--primary-color)"><i class="ri-book-open-line"></i> Brief Explanation</h5>
           <p style="margin: 0;">${sciDef}</p>
        </div>
        <ol>
          <li><strong>Observe interactions:</strong> Determine how this concept interacts with its environment physically or chemically.</li>
          <li><strong>Apply laws:</strong> Use the established rules of ${subject} to predict the outcome.</li>
        </ol>
      </div>
    `,
    example: `<p>${sciEx}</p>`,
    quiz: sciQuiz
  };

  const mockResponses = {
    programming: {
      steps: `
        <div style="margin-bottom: 1.5rem; background: rgba(88,166,255,0.05); padding: 1rem; border-radius: 8px;">
           <h5 style="margin-top:0; margin-bottom: 0.5rem; color: var(--primary-color)"><i class="ri-book-open-line"></i> Brief Explanation</h5>
           <p style="margin: 0;">In programming, understanding logic fundamentally requires breaking problems down. To grasp <strong>${safeDoubt}</strong> in ${langDisplay}, we must observe its algorithmic properties.</p>
        </div>
        <ol>
          <li><strong>Understand the logic:</strong> We need to break down "<i>${safeDoubt}</i>" step-by-step so the computer understands our instructions.</li>
          <li><strong>Syntax Example:</strong> Here is how you can write the logic in <b>${langDisplay}</b> to solve it:</li>
        </ol>
        <div style="background: rgba(0,0,0,0.5); padding: 1rem; border-radius: 8px; font-family: monospace; margin: 1rem 0; font-size: 0.95rem; border: 1px solid rgba(255,255,255,0.1); overflow-x: auto;">
          <span style="color: var(--text-secondary); display: block; margin-bottom: 0.5rem;">// Example in ${langDisplay}</span>
          ${codeSnippet}
        </div>
        <ol start="3">
          <li><strong>Compile & Debug:</strong> Run the code above to verify that it outputs exactly what you expect.</li>
        </ol>
      `,
      example: `<p>${progExample}</p>`,
      quiz: progQuiz
    },
    mathematics: {
      steps: `
        <div style="font-size: 1.05rem; line-height: 1.6;">
          <div style="margin-bottom: 1.5rem; background: rgba(88,166,255,0.05); padding: 1rem; border-radius: 8px;">
             <h5 style="margin-top:0; margin-bottom: 0.5rem; color: var(--primary-color)"><i class="ri-book-open-line"></i> Brief Explanation</h5>
             <p style="margin: 0;">Let's forget about complicated math jargon and look at "<i>${safeDoubt}</i>" practically. Math uses numbers and logic to define universal principles and quantities!</p>
          </div>
          <ol>
            <li><strong>The Core Idea:</strong> Math is all about fairness and proportion.</li>
            <li><strong>Let's do the math casually:</strong> You identify the known variables and simply move the unknown pieces around until the answer is isolated.</li>
            <li><strong>The Result:</strong> By following standard rules (like balancing both sides), you find the missing value. Easy!</li>
          </ol>
        </div>
      `,
      example: `<p>${mathExample}</p>`,
      quiz: mathQuiz
    },
    science: sciResponse,
    physics: sciResponse,
    chemistry: sciResponse
  };

  return mockResponses[subject] || {
    steps: `<ol><li>Analyze "${safeDoubt}" carefully.</li><li>Break it down.</li><li>Solve step-by-step.</li></ol>`,
    example: `<p>Like breaking your problem into smaller, manageable pieces.</p>`,
    quiz: [
      { question: "Why break down the problem?", options: ["Easier to solve", "Takes more time", "None of the above"], correctIndex: 0 },
      { question: "How does dividing problems into chunks help memory?", options: ["It reduces cognitive load and makes details manageable", "It deletes memory", "It causes confusion"], correctIndex: 0 },
      { question: "What is critical thinking?", options: ["Believing everything immediately", "Objectively analyzing information to form a judgment", "Thinking loudly"], correctIndex: 1 },
      { question: "By dividing problems into steps, what do you primarily achieve?", options: ["A clear roadmap to a solution", "More problems", "Tiredness"], correctIndex: 0 }
    ]
  };
}
