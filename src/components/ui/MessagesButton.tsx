import { MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { notificationService } from '../../services/NotificationService';

export const MessagesButton = () => {
    const navigate = useNavigate();
    const [hasUnread, setHasUnread] = useState(false);

    // Check for unread invites occasionally to show dot
    useEffect(() => {
        const check = async () => {
            const count = await notificationService.getUnreadCount();
            setHasUnread(count > 0);
        };
        check();
    }, []);

    return (
        <button
            onClick={() => navigate('/inbox')}
            className="relative p-2 text-neutral-400 hover:text-white transition-colors rounded-full hover:bg-white/10"
        >
            <MessageCircle size={24} />
            {hasUnread && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-gym-primary rounded-full border-2 border-black animate-pulse"></span>
            )}
        </button>
    );
};
