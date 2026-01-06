import { useState, useRef, useEffect } from 'react';
import './ChatPanel.css';

export default function ChatPanel({ messages, onSendMessage, username, participants = [] }) {
    const [message, setMessage] = useState('');
    const [showParticipants, setShowParticipants] = useState(false);
    const messagesEndRef = useRef(null);
    const participantsRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Close participants list when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (participantsRef.current && !participantsRef.current.contains(event.target)) {
                setShowParticipants(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (message.trim()) {
            onSendMessage(message);
            setMessage('');
        }
    };

    return (
        <div className="chat-panel">
            <div className="chat-header">
                <h3>💬 Chat</h3>
                <div
                    className="chat-participants-toggle"
                    onClick={() => setShowParticipants(!showParticipants)}
                    title="Visa deltagare"
                    ref={participantsRef}
                >
                    <span className="chat-count">👥 {participants.length || 1}</span>

                    {showParticipants && (
                        <div className="participants-dropdown">
                            <h4>Deltagare ({participants.length})</h4>
                            <ul>
                                {participants.map((p) => (
                                    <li key={p.socketId} className={p.username === username ? 'is-me' : ''}>
                                        <div className="participant-avatar">
                                            {p.username[0].toUpperCase()}
                                        </div>
                                        <span>{p.username} {p.username === username && '(Du)'}</span>
                                    </li>
                                ))}
                                {participants.length === 0 && (
                                    <li className="is-me">
                                        <div className="participant-avatar">{username?.[0]?.toUpperCase()}</div>
                                        <span>{username} (Du)</span>
                                    </li>
                                )}
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            <div className="chat-messages">
                {messages.length === 0 ? (
                    <div className="chat-empty">
                        <p className="text-muted text-sm">Inga meddelanden ännu</p>
                    </div>
                ) : (
                    messages.map((msg, index) => (
                        <div
                            key={index}
                            className={`chat-message ${msg.username === username ? 'chat-message-own' : ''}`}
                        >
                            <div className="chat-message-header">
                                <span className="chat-message-author">{msg.username}</span>
                                <span className="chat-message-time">
                                    {new Date(msg.timestamp).toLocaleTimeString('sv-SE', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </span>
                            </div>
                            <div className="chat-message-content">{msg.message}</div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="chat-input-form">
                <input
                    type="text"
                    className="chat-input"
                    placeholder="Skriv ett meddelande..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                />
                <button type="submit" className="chat-send-btn" disabled={!message.trim()}>
                    ➤
                </button>
            </form>
        </div>
    );
}
