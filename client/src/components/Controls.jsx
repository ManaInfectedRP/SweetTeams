import { useState } from 'react';
import './Controls.css';

export default function Controls({
    isCameraOn,
    isMicOn,
    isScreenSharing,
    onToggleCamera,
    onToggleMic,
    onToggleScreenShare,
    onSwitchCamera,
    onLeave,
    // Device selection
    devices,
    selectedCameraId,
    selectedMicrophoneId,
    selectedSpeakerId,
    onSelectCamera,
    onSelectMicrophone,
    onSelectSpeaker,
    // Audio settings
    micVolume = 100,
    noiseReduction = true,
    spatialAudio = false,
    onMicVolumeChange,
    onNoiseReductionChange,
    onSpatialAudioChange
}) {
    // Check if device is mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const supportsOutputSelection = typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
    const [showSettings, setShowSettings] = useState(false);
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

            <div className="controls-group">
                <button
                    onClick={() => setShowSettings(s => !s)}
                    className="btn-control"
                    title="Inställningar"
                >
                    ⚙️
                </button>

                <button onClick={onLeave} className="btn-leave">
                Lämna möte
                </button>
            </div>

            {showSettings && (
                <div className="device-settings-panel">
                    <div className="device-setting">
                        <label>Kamera</label>
                        <select value={selectedCameraId || ''} onChange={(e) => onSelectCamera?.(e.target.value)}>
                            {(devices?.videoinput || []).map(d => (
                                <option key={d.deviceId} value={d.deviceId}>{d.label || 'Kamera'}</option>
                            ))}
                        </select>
                    </div>
                    <div className="device-setting">
                        <label>Mikrofon</label>
                        <select value={selectedMicrophoneId || ''} onChange={(e) => onSelectMicrophone?.(e.target.value)}>
                            {(devices?.audioinput || []).map(d => (
                                <option key={d.deviceId} value={d.deviceId}>{d.label || 'Mikrofon'}</option>
                            ))}
                        </select>
                    </div>

                    <div className="device-setting">
                        <label>Mikrofonvolym: {micVolume}%</label>
                        <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={micVolume} 
                            onChange={(e) => onMicVolumeChange?.(parseInt(e.target.value))}
                            className="volume-slider"
                        />
                    </div>

                    <div className="device-setting">
                        <label>
                            <input 
                                type="checkbox" 
                                checked={noiseReduction} 
                                onChange={(e) => onNoiseReductionChange?.(e.target.checked)}
                            />
                            <span style={{ marginLeft: '8px' }}>Brusreducering</span>
                        </label>
                    </div>

                    <div className="device-setting">
                        <label>
                            <input 
                                type="checkbox" 
                                checked={spatialAudio} 
                                onChange={(e) => onSpatialAudioChange?.(e.target.checked)}
                            />
                            <span style={{ marginLeft: '8px' }}>Spatialljud</span>
                        </label>
                    </div>

                    <div className="device-setting">
                        <label>Högtalare</label>
                        {supportsOutputSelection ? (
                            <select value={selectedSpeakerId || ''} onChange={(e) => onSelectSpeaker?.(e.target.value)}>
                                {(devices?.audiooutput || []).map(d => (
                                    <option key={d.deviceId} value={d.deviceId}>{d.label || 'Högtalare'}</option>
                                ))}
                            </select>
                        ) : (
                            <div className="text-secondary" style={{ fontSize: '0.9rem' }}>Din webbläsare stöder inte val av uppspelningsenhet.</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
