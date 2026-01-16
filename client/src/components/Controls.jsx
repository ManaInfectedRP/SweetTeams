import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
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
    // Hand raising
    isHandRaised,
    onToggleRaiseHand,
    raisedHandsCount,
    isHost,
    onClearAllHands,
    // Recording
    isRecording,
    onStartRecording,
    onStopRecording,
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
    onSpatialAudioChange,
    // Invite
    onShowInvite
}) {
    const { t } = useLanguage();
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
                    title={isCameraOn ? t('room.camOff') : t('room.camOn')}
                >
                    {isCameraOn ? '📹' : '📷'}
                </button>

                <button
                    onClick={onToggleMic}
                    className={`btn-control ${!isMicOn ? 'btn-control-off' : ''}`}
                    title={isMicOn ? t('room.micOff') : t('room.micOn')}
                >
                    {isMicOn ? '🎤' : '🔇'}
                </button>

                <button
                    onClick={onToggleScreenShare}
                    className={`btn-control ${isScreenSharing ? 'btn-control-active' : ''}`}
                    title={isScreenSharing ? t('room.stopScreenShare') : t('room.screenShare')}
                >
                    🖥️
                </button>
                
                <button
                    onClick={onToggleRaiseHand}
                    className={`btn-control ${isHandRaised ? 'btn-control-active' : ''}`}
                    title={isHandRaised ? t('room.lowerHand', 'Lower hand') : t('room.raiseHand', 'Raise hand')}
                >
                    ✋
                </button>
                
                <button
                    onClick={isRecording ? onStopRecording : onStartRecording}
                    className={`btn-control ${isRecording ? 'btn-control-recording' : ''}`}
                    title={isRecording ? t('room.stopRecord') : t('room.record')}
                >
                    {isRecording ? '⏹️' : '⏺️'}
                </button>
                
                <button
                    onClick={onShowInvite}
                    className="btn-control"
                    title={t('room.sendInvite', 'Send email invitation')}
                >
                    📧
                </button>

                {isMobile && onSwitchCamera && (
                    <button
                        onClick={onSwitchCamera}
                        className="btn-control"
                        title={t('room.switchCamera', 'Switch camera')}
                    >
                        🔄
                    </button>
                )}
            </div>

            <div className="controls-group">
                {isHost && raisedHandsCount > 0 && (
                    <button
                        onClick={onClearAllHands}
                        className="btn-control btn-clear-hands"
                        title={t('room.clearAllHands', `Clear all raised hands (${raisedHandsCount})`)}
                    >
                        ✋❌ {raisedHandsCount}
                    </button>
                )}
                
                <button
                    onClick={() => setShowSettings(s => !s)}
                    className="btn-control"
                    title={t('dashboard.settings')}
                >
                    ⚙️
                </button>

                <button onClick={onLeave} className="btn-leave">
                    {t('room.leave')}
                </button>
            </div>

            {showSettings && (
                <div className="device-settings-panel">
                    <div className="device-setting">
                        <label>{t('room.camera', 'Camera')}</label>
                        <select value={selectedCameraId || ''} onChange={(e) => onSelectCamera?.(e.target.value)}>
                            {(devices?.videoinput || []).map(d => (
                                <option key={d.deviceId} value={d.deviceId}>{d.label || t('room.camera', 'Camera')}</option>
                            ))}
                        </select>
                    </div>
                    <div className="device-setting">
                        <label>{t('room.microphone', 'Microphone')}</label>
                        <select value={selectedMicrophoneId || ''} onChange={(e) => onSelectMicrophone?.(e.target.value)}>
                            {(devices?.audioinput || []).map(d => (
                                <option key={d.deviceId} value={d.deviceId}>{d.label || t('room.microphone', 'Microphone')}</option>
                            ))}
                        </select>
                    </div>

                    <div className="device-setting">
                        <label>{t('room.micVolume', 'Microphone volume')}: {micVolume}%</label>
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
                            <span style={{ marginLeft: '8px' }}>{t('room.noiseReduction', 'Noise reduction')}</span>
                        </label>
                    </div>

                    <div className="device-setting">
                        <label>
                            <input 
                                type="checkbox" 
                                checked={spatialAudio} 
                                onChange={(e) => onSpatialAudioChange?.(e.target.checked)}
                            />
                            <span style={{ marginLeft: '8px' }}>{t('room.spatialAudio', 'Spatial audio')}</span>
                        </label>
                    </div>

                    <div className="device-setting">
                        <label>{t('room.speaker', 'Speaker')}</label>
                        {supportsOutputSelection ? (
                            <select value={selectedSpeakerId || ''} onChange={(e) => onSelectSpeaker?.(e.target.value)}>
                                {(devices?.audiooutput || []).map(d => (
                                    <option key={d.deviceId} value={d.deviceId}>{d.label || t('room.speaker', 'Speaker')}</option>
                                ))}
                            </select>
                        ) : (
                            <div className="text-secondary" style={{ fontSize: '0.9rem' }}>{t('room.noSpeakerSelection', 'Your browser does not support speaker selection.')}</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
