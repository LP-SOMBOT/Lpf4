
import React, { useContext } from 'react';
import { UserContext } from '../contexts';
import { UserProfile } from '../types';
import { Modal, Avatar, Button, VerificationBadge } from './UI';
import { SupportActionPanel } from './SupportActionPanel';

interface Props {
    user: UserProfile;
    onClose: () => void;
    actionLabel?: string;
    onAction?: () => void;
}

export const UserProfileModal: React.FC<Props> = ({ user, onClose, actionLabel, onAction }) => {
    const { profile: myProfile } = useContext(UserContext);

    const isSuperAdmin = myProfile?.roles?.superAdmin === true;
    const isSupport = myProfile?.isSupport || myProfile?.roles?.support === true;
    const canManage = isSuperAdmin || isSupport;

    return (
        <Modal isOpen={true} onClose={onClose} title={user.name}>
             <div className="flex flex-col items-center mb-6">
                <Avatar src={user.avatar} seed={user.uid} size="xl" isVerified={user.isVerified} isSupport={user.isSupport} isOnline={user.isOnline} className="mb-4 shadow-xl border-4 border-white dark:border-slate-700" />
                <h2 className="text-2xl font-black text-slate-900 dark:text-white text-center flex items-center gap-2">
                    {user.name}
                    {user.isVerified && <VerificationBadge size="lg" className="text-blue-500" />}
                    {user.isSupport && <i className="fas fa-check-circle text-game-primary text-lg"></i>}
                </h2>
                {user.banned && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded uppercase font-bold mt-1">Banned User</span>}
                <p className="text-slate-400 font-bold font-mono text-sm mt-1">@{user.username || 'guest'}</p>
                
                {user.isOnline && (
                    <div className="mt-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest animate-pulse">
                        <i className="fas fa-circle text-[8px] mr-1"></i> Online
                    </div>
                )}

                {user.isSupport ? (
                    <div className="mt-6">
                        <span className="inline-flex items-center gap-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest">
                            <i className="fas fa-shield-alt"></i> Official Account
                        </span>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4 w-full mt-6">
                        <div className="bg-slate-50 dark:bg-slate-700 p-3 rounded-xl text-center">
                            <div className="text-xs text-slate-400 font-bold uppercase">Level</div>
                            <div className="text-xl font-black text-slate-800 dark:text-white">{Math.floor((user.points || 0) / 10) + 1}</div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700 p-3 rounded-xl text-center">
                            <div className="text-xs text-slate-400 font-bold uppercase">Points</div>
                            <div className="text-xl font-black text-game-primary dark:text-blue-400">{user.points}</div>
                        </div>
                    </div>
                )}

                {/* Support Panel (Visible to Super Admin and Support Staff) */}
                {canManage && <SupportActionPanel targetUser={user} />}
            </div>
            
            <div className="flex gap-3">
                {onAction && actionLabel ? (
                    <Button fullWidth onClick={onAction}>{actionLabel}</Button>
                ) : (
                     <Button fullWidth onClick={onClose} variant="secondary">Close</Button>
                )}
            </div>
        </Modal>
    );
};
