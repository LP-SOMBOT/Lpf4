import React from 'react';
import { Button } from '../components/UI';
import { useNavigate } from 'react-router-dom';

const DownloadPage: React.FC = () => {
  const navigate = useNavigate();

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = '/LP-F4.apk';
    link.target = '_blank';
    link.setAttribute('download', 'LP-F4.apk'); 
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gray-50 dark:bg-slate-900 transition-colors flex flex-col font-sans">
      {/* Background Elements matching Auth/Home */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-game-primary/20 rounded-full blur-[120px] animate-blob"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-500/20 rounded-full blur-[120px] animate-blob animation-delay-2000"></div>
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }}></div>
      </div>

      {/* Navbar */}
      <nav className="p-6 flex justify-between items-center max-w-6xl mx-auto w-full z-10 relative">
         <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
            <div className="relative">
                <div className="absolute inset-0 bg-game-primary blur-lg opacity-40 group-hover:opacity-70 transition-opacity"></div>
                <img src="https://files.catbox.moe/qn40s6.png" className="w-12 h-12 relative z-10 drop-shadow-md" alt="Logo" />
            </div>
            <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">LP-F4</span>
         </div>
         <Button 
           variant="outline"
           onClick={() => navigate('/auth')} 
           className="hidden md:flex"
         >
           Web App Login
         </Button>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-5xl mx-auto w-full z-10 relative">
         <div className="animate__animated animate__fadeInDown w-full">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-game-primary dark:text-blue-300 text-xs font-black uppercase tracking-widest mb-6 border border-blue-100 dark:border-blue-800 shadow-sm backdrop-blur-sm">
                <i className="fab fa-android text-lg"></i>
                Official Android App
            </div>
            
            <h1 className="text-5xl md:text-8xl font-black mb-6 text-slate-900 dark:text-white tracking-tight leading-tight drop-shadow-sm">
                Learn. Battle. <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-game-primary to-purple-600">Conquer.</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-300 mb-12 max-w-3xl mx-auto leading-relaxed font-medium">
                The ultimate multiplayer quiz arena for Somali students. 
                Join thousands of learners, challenge friends in real-time, and climb the ranks.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-20">
                <button 
                    onClick={handleDownload}
                    className="relative group px-8 py-5 bg-game-primary text-white rounded-2xl font-black text-xl shadow-xl shadow-indigo-500/30 overflow-hidden transition-all hover:scale-105 active:scale-95"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700"></div>
                    <div className="flex items-center gap-3 relative z-10">
                        <i className="fab fa-android text-3xl"></i>
                        <span>Download .APK</span>
                    </div>
                </button>
                
                <button 
                     onClick={() => navigate('/auth')}
                     className="px-8 py-5 bg-white dark:bg-slate-800 text-slate-700 dark:text-white border-2 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-2xl font-bold text-lg shadow-sm transition-all hover:-translate-y-1"
                >
                    Launch Web App
                </button>
            </div>
         </div>

         {/* Features Grid */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full animate__animated animate__fadeInUp delay-200 px-4">
             <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-lg text-left group hover:-translate-y-2 transition-transform duration-300">
                 <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-900/50 rounded-2xl flex items-center justify-center text-game-primary dark:text-indigo-400 mb-6 group-hover:scale-110 transition-transform">
                     <i className="fas fa-bolt text-2xl"></i>
                 </div>
                 <h3 className="font-black text-xl mb-3 text-slate-900 dark:text-white">Real-time PvP</h3>
                 <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">Challenge opponents in intense live quiz battles. Answer fast to win.</p>
             </div>
             
             <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-lg text-left group hover:-translate-y-2 transition-transform duration-300 delay-100">
                 <div className="w-14 h-14 bg-green-100 dark:bg-green-900/50 rounded-2xl flex items-center justify-center text-green-600 dark:text-green-400 mb-6 group-hover:scale-110 transition-transform">
                     <i className="fas fa-layer-group text-2xl"></i>
                 </div>
                 <h3 className="font-black text-xl mb-3 text-slate-900 dark:text-white">Subject Mastery</h3>
                 <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">Practice specific chapters in solo mode to improve your knowledge.</p>
             </div>
             
             <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-lg text-left group hover:-translate-y-2 transition-transform duration-300 delay-200">
                 <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/50 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400 mb-6 group-hover:scale-110 transition-transform">
                     <i className="fas fa-trophy text-2xl"></i>
                 </div>
                 <h3 className="font-black text-xl mb-3 text-slate-900 dark:text-white">Global Ranking</h3>
                 <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">Compete for the top spot on the leaderboard among all students.</p>
             </div>
         </div>
      </main>

      {/* Footer */}
      <footer className="p-8 text-center border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-10">
          <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">
              &copy; 2024 LP-F4 Team. <button onClick={handleDownload} className="text-game-primary hover:underline ml-1">Download v2.5</button>
          </p>
      </footer>
    </div>
  );
};

export default DownloadPage;