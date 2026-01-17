import { useEffect, useRef, useState } from 'react';
import './RecordingPreview.css';

export default function RecordingPreview({ recordedBlob, onSave, onDiscard }) {
    const videoRef = useRef(null);
    const [videoError, setVideoError] = useState(false);

    useEffect(() => {
        if (recordedBlob && videoRef.current) {
            // Create a MediaSource-based approach for better compatibility on hosted platforms
            try {
                const url = URL.createObjectURL(recordedBlob);
                videoRef.current.src = url;
                
                // Set attributes to prevent range request issues
                videoRef.current.preload = 'metadata';
                videoRef.current.crossOrigin = 'anonymous';
                
                // Handle errors gracefully - this error is typically harmless for playback
                const handleError = (e) => {
                    // Check if it's the range request error which doesn't affect playback
                    const target = e.target || e.currentTarget;
                    if (target && target.error) {
                        const errorCode = target.error.code;
                        // MEDIA_ERR_SRC_NOT_SUPPORTED (4) or MEDIA_ERR_NETWORK (2) can occur with blob URLs
                        if (errorCode === 2 || errorCode === 4) {
                            console.warn('Video preview: Non-critical network error with blob URL');
                            setVideoError(false); // Don't show error to user if video still plays
                        } else {
                            console.error('Video preview error:', target.error);
                            setVideoError(true);
                        }
                    }
                };
                
                videoRef.current.addEventListener('error', handleError, true);
                
                // Try to load the video
                videoRef.current.load();
                
                return () => {
                    if (videoRef.current) {
                        videoRef.current.removeEventListener('error', handleError, true);
                    }
                    URL.revokeObjectURL(url);
                };
            } catch (err) {
                console.error('Error setting up video preview:', err);
                setVideoError(true);
            }
        }
    }, [recordedBlob]);

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    return (
        <div className="recording-preview-overlay">
            <div className="recording-preview-modal">
                <div className="recording-preview-header">
                    <h3>Förhandsgranska inspelning</h3>
                    <button 
                        className="close-button"
                        onClick={onDiscard}
                        title="Stäng"
                    >
                        ✕
                    </button>
                </div>
                
                <div className="recording-preview-content">
                    {videoError ? (
                        <div className="video-error-message">
                            <p>⚠️ Kan inte förhandsgranska videon, men du kan fortfarande spara den.</p>
                        </div>
                    ) : (
                        <video
                            ref={videoRef}
                            controls
                            className="preview-video"
                            playsInline
                        />
                    )}
                    
                    <div className="recording-info">
                        <p>
                            <strong>Storlek:</strong> {recordedBlob ? formatFileSize(recordedBlob.size) : 'N/A'}
                        </p>
                        <p>
                            <strong>Format:</strong> WebM
                        </p>
                    </div>
                </div>
                
                <div className="recording-preview-actions">
                    <button 
                        className="btn btn-secondary"
                        onClick={onDiscard}
                    >
                        🗑️ Kasta
                    </button>
                    <button 
                        className="btn btn-primary"
                        onClick={onSave}
                    >
                        💾 Spara lokalt
                    </button>
                </div>
            </div>
        </div>
    );
}
