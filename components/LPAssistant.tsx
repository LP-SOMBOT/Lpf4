import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Avatar, Button, Card, Input } from './UI';
import { playSound } from '../services/audioService';

interface Message {
  role: 'user' | 'model';
  text: string;
}

export const LPAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Messages from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('lp_assistant_history');
    if (saved) {
      setMessages(JSON.parse(saved));
    } else {
        setMessages([{ role: 'model', text: 'Hi! I am the LP Assistant. Ask me anything about the quizzes, the app, or for study tips!' }]);
    }
  }, []);

  // Save to LocalStorage
  useEffect(() => {
    if(messages.length > 0) {
        localStorage.setItem('lp_assistant_history', JSON.stringify(messages));
    }
  }, [messages]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const toggleChat = () => {
    playSound('click');
    setIsOpen(!isOpen);
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim()) return;

    const userMsg = inputText.trim();
    setInputText('');
    
    // Add User Message
    const newHistory: Message[] = [...messages, { role: 'user', text: userMsg }];
    setMessages(newHistory);
    setIsTyping(true);

    try {
      // NOTE: Using process.env.API_KEY as per instructions. 
      // In a real Vite app, this would be import.meta.env.VITE_API_KEY
      // We assume process.env.API_KEY is replaced by the bundler.
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      const systemPrompt = `You are LP Assistant, a helpful AI guide for the LP-F4 Quiz Battle app (Somali Student Quiz Battle). 
      The app allows students to compete in real-time quizzes (Battle Mode), practice solo (Solo Mode), and view Leaderboards.
      Admins can manage quizzes.
      Be concise, encouraging, and friendly. Answer questions about general knowledge or how to use the app.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userMsg,
        config: {
            systemInstruction: systemPrompt,
        }
      });

      const reply = response.text || "I'm having trouble thinking right now. Try again later.";
      
      setMessages([...newHistory, { role: 'model', text: reply }]);
    } catch (error) {
      console.error(error);
      setMessages([...newHistory, { role: 'model', text: "Sorry, I couldn't connect to my brain (Gemini API). Please check the API Key configuration." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button 
        onClick={toggleChat}
        className="fixed bottom-20 md:bottom-8 right-6 w-14 h-14 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full shadow-lg flex items-center justify-center text-white z-50 hover:scale-110 transition-transform animate-bounce hover:animate-none"
      >
        <i className={`fas ${isOpen ? 'fa-times' : 'fa-robot'} text-xl`}></i>
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-36 md:bottom-24 right-6 w-[90vw] md:w-96 h-[60vh] md:h-[500px] z-50 flex flex-col animate__animated animate__fadeInUp origin-bottom-right">
           <Card className="flex-1 flex flex-col !p-0 overflow-hidden !bg-white/90 dark:!bg-gray-900/90 backdrop-blur-xl border border-white/20 shadow-2xl">
               {/* Header */}
               <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-4 flex justify-between items-center text-white">
                   <div className="flex items-center gap-2">
                       <i className="fas fa-robot"></i>
                       <span className="font-bold">LP Assistant</span>
                   </div>
                   <button onClick={() => setMessages([])} className="text-xs bg-white/20 px-2 py-1 rounded hover:bg-white/30" title="Clear History">
                       Clear
                   </button>
               </div>

               {/* Messages */}
               <div className="flex-1 overflow-y-auto p-4 space-y-3">
                   {messages.map((msg, i) => (
                       <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                           <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                               msg.role === 'user' 
                               ? 'bg-purple-500 text-white rounded-br-none' 
                               : 'bg-gray-100 dark:bg-gray-700 dark:text-gray-200 rounded-bl-none'
                           }`}>
                               {msg.text}
                           </div>
                       </div>
                   ))}
                   {isTyping && (
                       <div className="flex justify-start">
                           <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-2xl rounded-bl-none flex gap-1">
                               <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                               <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                               <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></div>
                           </div>
                       </div>
                   )}
                   <div ref={messagesEndRef}></div>
               </div>

               {/* Input */}
               <form onSubmit={handleSend} className="p-3 bg-white/50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex gap-2">
                   <input 
                      value={inputText}
                      onChange={e => setInputText(e.target.value)}
                      placeholder="Ask me..."
                      className="flex-1 bg-transparent border-none focus:ring-0 text-sm dark:text-white placeholder-gray-500"
                   />
                   <button type="submit" disabled={!inputText.trim() || isTyping} className="text-purple-500 font-bold px-2 hover:text-purple-600 disabled:opacity-50">
                       <i className="fas fa-paper-plane"></i>
                   </button>
               </form>
           </Card>
        </div>
      )}
    </>
  );
};