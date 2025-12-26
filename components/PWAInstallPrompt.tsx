import React, { useState, useEffect } from 'react';
import { Button } from './UI';
import { playSound } from '../services/audioService';

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsVisible(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    playSound('click');
    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      playSound('correct');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleClose = () => {
      setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 flex justify-center animate__animated animate__slideInUp">
        <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border-t border-white/50 dark:border-slate-700 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] rounded-3xl p-5 max-w-md w-full relative">
            
            <button 
                onClick={handleClose}
                className="absolute top-2 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
                <i className="fas fa-times"></i>
            </button>

            <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-game-primary to-purple-600 shadow-lg flex items-center justify-center shrink-0">
                    <img src="https://files.catbox.moe/qn40s6.png" alt="Icon" className="w-10 h-10 filter brightness-200 drop-shadow-md" />
                </div>
                <div className="flex-1">
                    <h3 className="font-black text-slate-900 dark:text-white text-lg leading-tight">Install App</h3>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
                        Add to Home Screen for fullscreen gameplay & better performance.
                    </p>
                </div>
            </div>

            <div className="mt-4 flex gap-3">
                <Button fullWidth onClick={handleInstallClick} className="shadow-xl">
                    <i className="fas fa-download mr-2"></i> Install Now
                </Button>
            </div>
        </div>
    </div>
  );
};