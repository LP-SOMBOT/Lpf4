import React from 'react';
import { Button, Card } from '../components/UI';
import { useNavigate } from 'react-router-dom';

const DownloadPage: React.FC = () => {
  const navigate = useNavigate();

  const handleDownload = () => {
    // Attempt to trigger download with correct filename from local public folder
    const link = document.createElement('a');
    link.href = '/LP-F4.apk';
    link.target = '_blank'; // Use blank to avoid navigating away if download fails or opens in view
    link.setAttribute('download', 'LP-F4.apk'); 
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors flex flex-col">
      {/* Navbar/Header for landing page */}
      <nav className="p-6 flex justify-between items-center max-w-6xl mx-auto w-full z-10">
         <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <img src="https://files.catbox.moe/qn40s6.png" className="w-10 h-10 shadow-sm rounded-full" />
            <span className="text-2xl font-extrabold text-somali-blue dark:text-white tracking-tight">LP-F4</span>
         </div>
         <button 
           onClick={() => navigate('/auth')} 
           className="font-bold text-gray-600 dark:text-gray-300 hover:text-somali-blue dark:hover:text-blue-400 transition-colors bg-white/50 dark:bg-black/20 px-4 py-2 rounded-xl backdrop-blur-sm"
         >
           Login / Web App
         </button>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-4xl mx-auto w-full z-0 relative">
         <div className="animate__animated animate__fadeInDown">
            <span className="inline-block py-1 px-3 rounded-full bg-blue-100 dark:bg-blue-900/30 text-somali-blue dark:text-blue-300 text-xs font-bold uppercase tracking-widest mb-4 border border-blue-200 dark:border-blue-800">
                Official Android App
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold mb-6 text-gray-900 dark:text-white tracking-tight leading-tight">
                Learn. Compete. <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-somali-blue to-purple-600">Win.</span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-10 max-w-2xl mx-auto leading-relaxed">
                The ultimate multiplayer quiz battle platform for Somali students. 
                Challenge friends, climb the leaderboard, and master your subjects anywhere, anytime.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
                <button 
                    onClick={handleDownload}
                    className="px-8 py-4 bg-somali-blue hover:bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-500/30 transform hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
                >
                    <i className="fab fa-android text-2xl"></i>
                    <span>Download APK</span>
                </button>
                <button 
                     onClick={() => navigate('/auth')}
                     className="px-8 py-4 bg-white dark:bg-gray-800 text-gray-700 dark:text-white border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-2xl font-bold text-lg shadow-sm transition-all"
                >
                    Open Web App
                </button>
            </div>
         </div>

         {/* Features Grid */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full animate__animated animate__fadeInUp delay-200">
             <Card className="text-left border-t-4 border-t-purple-500 transform hover:-translate-y-1 transition-transform">
                 <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/50 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400 mb-4">
                     <i className="fas fa-bolt text-xl"></i>
                 </div>
                 <h3 className="font-bold text-xl mb-2 dark:text-white">Real-time Battles</h3>
                 <p className="text-gray-500 dark:text-gray-400 text-sm">Challenge opponents in real-time quiz duels with live updates.</p>
             </Card>
             <Card className="text-left border-t-4 border-t-green-500 transform hover:-translate-y-1 transition-transform">
                 <div className="w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-xl flex items-center justify-center text-green-600 dark:text-green-400 mb-4">
                     <i className="fas fa-brain text-xl"></i>
                 </div>
                 <h3 className="font-bold text-xl mb-2 dark:text-white">Solo Training</h3>
                 <p className="text-gray-500 dark:text-gray-400 text-sm">Practice by subject and chapter at your own pace to improve.</p>
             </Card>
             <Card className="text-left border-t-4 border-t-yellow-500 transform hover:-translate-y-1 transition-transform">
                 <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/50 rounded-xl flex items-center justify-center text-yellow-600 dark:text-yellow-400 mb-4">
                     <i className="fas fa-trophy text-xl"></i>
                 </div>
                 <h3 className="font-bold text-xl mb-2 dark:text-white">Leaderboards</h3>
                 <p className="text-gray-500 dark:text-gray-400 text-sm">Compete for the top spot among all students in Somalia.</p>
             </Card>
         </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-gray-400 text-sm border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 z-10">
          <p>&copy; 2024 LP-F4 Team. <a href="#" onClick={handleDownload} className="text-somali-blue hover:underline">Download App</a></p>
      </footer>
    </div>
  );
};

export default DownloadPage;