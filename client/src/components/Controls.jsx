import './Controls.css';

export default function Controls({
    isCameraOn,
    isMicOn,
    isScreenSharing,
    onToggleCamera,
    onToggleMic,
    onToggleScreenShare,
    onSwitchCamera,
    onLeave
}) {
    // Check if device is mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    return (
        <div className="controls-container">
            <div className="controls-group">
                <button
                    onClick={onToggleCamera}
                    className={`btn-control ${!isCameraOn ? 'btn-control-off' : ''}`}
                    title={isCameraOn ? 'Stäng av kamera' : 'Sätt på kamera'}
                >
                    {isCameraOn ? '📹' : '📷'}
                </button>

                <button
                    onClick={onToggleMic}
                    className={`btn-control ${!isMicOn ? 'btn-control-off' : ''}`}
                    title={isMicOn ? 'Stäng av mikrofon' : 'Sätt på mikrofon'}
                >
                    {isMicOn ? '🎤' : '🔇'}
                </button>

                <button
                    onClick={onToggleScreenShare}
                    className={`btn-control ${isScreenSharing ? 'btn-control-active' : ''}`}
                    title={isScreenSharing ? 'Sluta dela skärm' : 'Dela skärm'}
                >
                    🖥️
                </button>

                {isMobile && onSwitchCamera && (
                    <button
                        onClick={onSwitchCamera}
                        className="btn-control"
                        title="Byt kamera"
                    >
                        🔄
                    </button>
                )}
            </div>

            <button onClick={onLeave} className="btn-leave">
                Lämna möte
            </button>
        </div>
    );
}
