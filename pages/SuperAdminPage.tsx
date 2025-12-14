import React, { useState, useEffect } from 'react';
import { ref, get, update } from 'firebase/database';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { Button, Card, Input } from '../components/UI';
import Swal from 'sweetalert2';

const SuperAdminPage: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);

  const checkPin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple "hidden" pin for demonstration. In production, use Firebase Auth Claims.
    if (pin === '1234') { 
        setIsAuthenticated(true);
        fetchUsers();
    } else {
        Swal.fire('Access Denied', 'Incorrect PIN', 'error');
    }
  };

  const fetchUsers = async () => {
      setLoading(true);
      const userRef = ref(db, 'users');
      const snap = await get(userRef);
      if (snap.exists()) {
          const list: UserProfile[] = Object.values(snap.val());
          setUsers(list);
      }
      setLoading(false);
  };

  const toggleRole = async (uid: string, currentRole?: string) => {
      const newRole = currentRole === 'admin' ? 'user' : 'admin';
      try {
        await update(ref(db, `users/${uid}`), { role: newRole });
        Swal.fire('Success', `User is now ${newRole}`, 'success');
        fetchUsers(); // Refresh
      } catch (e) {
        Swal.fire('Error', 'Failed to update role', 'error');
      }
  };

  if (!isAuthenticated) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
              <Card className="w-full max-w-md !bg-white/10 backdrop-blur-xl border border-white/20">
                  <h1 className="text-2xl font-bold text-white mb-4 text-center">Super Admin Access</h1>
                  <form onSubmit={checkPin}>
                      <Input 
                        type="password" 
                        placeholder="Enter Security PIN" 
                        value={pin} 
                        onChange={e => setPin(e.target.value)}
                        className="text-center text-xl tracking-widest"
                      />
                      <Button fullWidth>Unlock Dashboard</Button>
                  </form>
              </Card>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-6">
        <div className="max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold dark:text-white mb-6">User Management</h1>
            <div className="mb-4">
                <Button onClick={fetchUsers} isLoading={loading} variant="secondary"><i className="fas fa-sync mr-2"></i> Refresh List</Button>
            </div>
            
            <Card className="!bg-white/80 dark:!bg-gray-800/80 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                            <th className="p-3">User</th>
                            <th className="p-3">Email</th>
                            <th className="p-3">Points</th>
                            <th className="p-3">Role</th>
                            <th className="p-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.uid} className="border-b border-gray-100 dark:border-gray-700 hover:bg-black/5 dark:hover:bg-white/5">
                                <td className="p-3 font-bold dark:text-white">{u.name}</td>
                                <td className="p-3 text-sm dark:text-gray-300">{u.email}</td>
                                <td className="p-3 font-mono text-somali-blue">{u.points}</td>
                                <td className="p-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${u.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
                                        {u.role || 'user'}
                                    </span>
                                </td>
                                <td className="p-3">
                                    <button 
                                        onClick={() => toggleRole(u.uid, u.role)}
                                        className={`text-xs font-bold px-3 py-1 rounded transition-colors ${u.role === 'admin' ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-600 hover:bg-green-200'}`}
                                    >
                                        {u.role === 'admin' ? 'Demote' : 'Promote'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
        </div>
    </div>
  );
};

export default SuperAdminPage;