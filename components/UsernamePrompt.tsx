import React, { useState, useEffect, useContext } from 'react';
import { ref, update, get } from 'firebase/database';
import { db } from '../firebase';
import { UserContext } from '../contexts';
import { Modal, Input, Button } from './UI';
import { showToast, showAlert } from '../services/alert';

export const UsernamePrompt: React.FC = () => {
  const { user, profile } = useContext(UserContext);
  const [isOpen, setIsOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Show if user is guest and hasn't updated/skipped username setup
    if (profile?.isGuest && !profile.usernameUpdated) {
        setIsOpen(true);
    }
  }, [profile]);

  const handleSkip = async () => {
      if (!user) return;
      setIsOpen(false);
      // Mark as updated so we don't ask again
      try {
        await update(ref(db, `users/${user.uid}`), { usernameUpdated: true });
      } catch(e) { console.error(e); }
  };

  const handleSave = async () => {
      if (!user || !username.trim()) return;
      setLoading(true);
      
      const clean = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (clean.length < 3) {
          showToast("Username too short", "error");
          setLoading(false);
          return;
      }

      // Check uniqueness
      const snapshot = await get(ref(db, 'users'));
      let exists = false;
      if (snapshot.exists()) {
          const users = snapshot.val();
          exists = Object.values(users).some((u: any) => (u.username || '').toLowerCase() === clean);
      }

      if (exists) {
          showToast("Username taken", "error");
          setLoading(false);
          return;
      }

      try {
          await update(ref(db, `users/${user.uid}`), { 
              username: clean,
              usernameUpdated: true
          });
          showToast("Username updated!", "success");
          setIsOpen(false);
      } catch (e) {
          console.error(e);
          showAlert("Error", "Failed to update username", "error");
      } finally {
          setLoading(false);
      }
  };

  if (!isOpen) return null;

  return (
      <Modal isOpen={isOpen} title="Set Username" onClose={handleSkip}>
          <div className="space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center font-bold">
                  Create a unique ID to be recognized on the leaderboard.
              </p>
              <div className="text-center">
                  <div className="inline-block bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-lg text-xs font-mono text-slate-500 mb-2">
                      Current: @{profile?.username}
                  </div>
              </div>
              <Input 
                  placeholder="New Username" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className="text-center font-bold text-lg"
                  autoFocus
              />
              <div className="flex gap-3 pt-2">
                  <Button variant="secondary" fullWidth onClick={handleSkip}>Skip</Button>
                  <Button fullWidth onClick={handleSave} isLoading={loading}>Save ID</Button>
              </div>
          </div>
      </Modal>
  );
};
