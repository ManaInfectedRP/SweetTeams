import { useState, useRef, useEffect } from 'react';
import './ChatPanel.css';

export default function ChatPanel({ messages, onSendMessage, onDeleteMessage, onReactToMessage, username, participants = [], canModerate = false }) {
    const [message, setMessage] = useState('');
    const [showParticipants, setShowParticipants] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showReactionPicker, setShowReactionPicker] = useState(null); // messageId when showing reactions
    const messagesEndRef = useRef(null);
    const participantsRef = useRef(null);
    const fileInputRef = useRef(null);
    const emojiPickerRef = useRef(null);
    const reactionPickerRef = useRef(null);

    const emojis = ['😀', '😂', '😍', '🥰', '😎', '🤔', '👍', '👎', '❤️', '🎉', '🔥', '👏', '🙌', '💯', '✨', '🎈', '🌟', '⭐', '💪', '🤝', '🙏', '👋', '😊', '😢', '😡'];
    const reactionEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥'];

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
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
                setShowEmojiPicker(false);
            }
            if (reactionPickerRef.current && !reactionPickerRef.current.contains(event.target)) {
                setShowReactionPicker(null);
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
            onSendMessage({ text: message, type: 'text' });
            setMessage('');
        }
    };

    const handleImageUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Check file size (limit to 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('Bilden är för stor. Max 5MB.');
            return;
        }

        // Check file type
        if (!file.type.startsWith('image/')) {
            alert('Endast bilder är tillåtna.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            onSendMessage({ 
                text: file.name, 
                type: 'image', 
                imageData: event.target.result 
            });
        };
        reader.readAsDataURL(file);
        
        // Reset input
        e.target.value = '';
    };

    const handleEmojiClick = (emoji) => {
        setMessage(prev => prev + emoji);
        setShowEmojiPicker(false);
    };

    const handleReaction = (messageId, emoji) => {
        onReactToMessage(messageId, emoji);
        setShowReactionPicker(null);
    };

    const getUserReaction = (msg) => {
        if (!msg.reactions) return null;
        const userReaction = msg.reactions.find(r => r.username === username);
        return userReaction?.emoji;
    };

    const handlePaste = (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            
            // Check if the pasted item is an image
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                
                const file = item.getAsFile();
                if (!file) continue;

                // Check file size (limit to 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    alert('Bilden är för stor. Max 5MB.');
                    continue;
                }

                const reader = new FileReader();
                reader.onload = (event) => {
                    onSendMessage({ 
                        text: file.name || 'Inklistrad bild', 
                        type: 'image', 
                        imageData: event.target.result 
                    });
                };
                reader.readAsDataURL(file);
                break;
            }
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
                    messages.map((msg, index) => {
                        const userReaction = getUserReaction(msg);
                        const reactionCounts = {};
                        msg.reactions?.forEach(r => {
                            reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1;
                        });

                        return (
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
                                    {canModerate && !msg.deleted && (
                                        <button
                                            className="chat-message-delete"
                                            title="Ta bort meddelande"
                                            onClick={() => onDeleteMessage?.(msg.id)}
                                        >
                                            🗑️
                                        </button>
                                    )}
                                </div>
                                <div className={`chat-message-content ${msg.deleted ? 'deleted' : ''}`}>
                                    {msg.deleted ? (
                                        'Meddelandet borttaget av moderator'
                                    ) : msg.type === 'image' ? (
                                        <div className="chat-image-container">
                                            <img 
                                                src={msg.imageData} 
                                                alt={msg.message} 
                                                className="chat-image"
                                                onClick={(e) => {
                                                    e.target.requestFullscreen?.();
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        msg.message
                                    )}
                                </div>
                                {!msg.deleted && (
                                    <div className="chat-message-actions">
                                        <div className="chat-reactions-display">
                                            {Object.entries(reactionCounts).map(([emoji, count]) => (
                                                <span key={emoji} className="reaction-badge">
                                                    {emoji} {count > 1 && count}
                                                </span>
                                            ))}
                                        </div>
                                        <div className="chat-react-container">
                                            <button
                                                className={`chat-react-btn ${userReaction ? 'reacted' : ''}`}
                                                onClick={() => setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id)}
                                                title="Reagera"
                                            >
                                                {userReaction || '😊'}
                                            </button>
                                            {showReactionPicker === msg.id && (
                                                <div className="reaction-picker" ref={reactionPickerRef}>
                                                    {reactionEmojis.map(emoji => (
                                                        <button
                                                            key={emoji}
                                                            className="reaction-option"
                                                            onClick={() => handleReaction(msg.id, emoji)}
                                                        >
                                                            {emoji}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="chat-input-form">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    style={{ display: 'none' }}
                />
                <button
                    type="button"
                    className="chat-image-btn"
                    onClick={() => fileInputRef.current?.click()}
                    title="Skicka bild"
                >
                    📷
                </button>
                <div className="chat-emoji-container">
                    <button
                        type="button"
                        className="chat-emoji-btn"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        title="Lägg till emoji"
                    >
                        😊
                    </button>
                    {showEmojiPicker && (
                        <div className="emoji-picker" ref={emojiPickerRef}>
                            {emojis.map(emoji => (
                                <button
                                    key={emoji}
                                    type="button"
                                    className="emoji-option"
                                    onClick={() => handleEmojiClick(emoji)}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <input
                    type="text"
                    className="chat-input"
                    placeholder="Skriv ett meddelande..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onPaste={handlePaste}
                />
                <button type="submit" className="chat-send-btn" disabled={!message.trim()}>
                    ➤
                </button>
            </form>
        </div>
    );
}
