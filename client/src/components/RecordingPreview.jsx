import { useEffect, useRef } from 'react';
import './RecordingPreview.css';

export default function RecordingPreview({ recordedBlob, onSave, onDiscard }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (recordedBlob && videoRef.current) {
            const url = URL.createObjectURL(recordedBlob);
            videoRef.current.src = url;
            
            return () => {
                URL.revokeObjectURL(url);
            };
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
                    <video
                        ref={videoRef}
                        controls
                        className="preview-video"
                    />
                    
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
